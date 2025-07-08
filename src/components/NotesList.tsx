import React from 'react';
import { Trash2, MoreVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Note } from '../types/Note';
import { formatDate, getCategoryColor } from '../utils/helpers';

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
  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-medium text-slate-800">
          {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
        </h3>
      </div>

      <div className="divide-y divide-slate-100">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <div className="text-4xl mb-3">📝</div>
            <p>No notes found</p>
            <p className="text-sm">Create your first note to get started</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${
                activeNote?.id === note.id 
                  ? 'bg-blue-50 border-l-blue-500' 
                  : 'border-l-transparent'
              }`}
              onClick={() => onNoteSelect(note)}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-slate-800 truncate flex-1 mr-2">
                  {note.title}
                </h4>
                <div className="flex items-center gap-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(note.category)}`}>
                    {note.category}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteDelete(note.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-slate-500 mb-2 leading-relaxed">
                {truncateContent(note.content.replace(/[#*]/g, ''))}
              </p>
              
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{formatDate(note.updatedAt)}</span>
                {note.tags.length > 0 && (
                  <div className="flex gap-1">
                    {note.tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="bg-slate-100 px-2 py-1 rounded">
                        #{tag}
                      </span>
                    ))}
                    {note.tags.length > 2 && (
                      <span className="text-slate-400">+{note.tags.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
