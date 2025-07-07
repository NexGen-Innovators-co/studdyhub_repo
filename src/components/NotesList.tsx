import React, { useState } from 'react';
import { Trash2, MoreVertical, FileText, Tag, Calendar, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
import { Note } from '../types/Note';
import { formatDate, getCategoryColor } from '../utils/helpers';
import { toast } from 'sonner';

interface NotesListProps {
  notes: Note[];
  activeNote: Note | null;
  onNoteSelect: (note: Note) => void;
  onNoteDelete: (noteId: string) => void;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  activeNote,
  onNoteSelect,
  onNoteDelete
}) => {
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const truncateContent = (content: string, maxLength: number = 120) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
    setDeletingNoteId(noteId);
    
    try {
      await onNoteDelete(noteId);
      toast.success(`"${noteTitle}" deleted successfully`);
    } catch (error) {
      toast.error('Failed to delete note');
      console.error('Error deleting note:', error);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const stripMarkdown = (content: string) => {
    return content
      .replace(/```[\s\S]*?```/g, '[Code Block]')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s/gm, '')
      .replace(/^\s*\d+\.\s/gm, '')
      .replace(/\n+/g, ' ')
      .trim();
  };

  const getWordCount = (content: string) => {
    const words = stripMarkdown(content).split(/\s+/).filter(word => word.length > 0);
    return words.length;
  };

  const getReadingTime = (content: string) => {
    const wordCount = getWordCount(content);
    const wordsPerMinute = 200;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes;
  };

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-slate-400 max-w-sm">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-slate-600 mb-2">No notes found</h3>
          <p className="text-sm">
            Create your first note to get started, or try adjusting your search and filter criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-slate-100">
        {notes.map((note) => {
          const isActive = activeNote?.id === note.id;
          const isDeleting = deletingNoteId === note.id;
          const wordCount = getWordCount(note.content);
          const readingTime = getReadingTime(note.content);
          
          return (
            <div
              key={note.id}
              className={`group relative p-4 cursor-pointer hover:bg-slate-50 transition-all duration-200 border-l-4 ${
                isActive 
                  ? 'bg-blue-50 border-l-blue-500 shadow-sm' 
                  : 'border-l-transparent hover:border-l-slate-300'
              } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => !isDeleting && onNoteSelect(note)}
            >
              {/* Note Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-800 truncate text-base mb-1">
                    {note.title || 'Untitled Note'}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(note.category)}`}>
                      {note.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {wordCount} words
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {readingTime} min read
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 ml-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onNoteSelect(note);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Open Note
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id, note.title);
                        }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Note
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-blue-500 md:hidden" />
                  )}
                </div>
              </div>
              
              {/* Note Content Preview */}
              <div className="mb-3">
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {stripMarkdown(note.content) || 'No content yet...'}
                </p>
              </div>
              
              {/* Note Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Updated {formatDate(note.updatedAt)}</span>
                  {note.aiSummary && (
                    <span className="flex items-center gap-1 text-purple-600">
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                      AI Summary
                    </span>
                  )}
                </div>
                
                {/* Tags */}
                {note.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {note.tags.slice(0, 2).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs"
                      >
                        <Tag className="h-2 w-2" />
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 2 && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                        +{note.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Loading State for Deletion */}
              {isDeleting && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                    Deleting...
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};