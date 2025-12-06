// NotesList.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Trash2, X, Edit, Save, X as CloseIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import { Note, NoteCategory } from '../../../types/Note';
import { formatDate, getCategoryColor } from '../../classRecordings/utils/helpers';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

interface NotesListProps {
  notes: Note[] | null; // Allow notes to be null
  activeNote: Note | null;
  onNoteSelect: (note: Note) => void;
  onNoteDelete: (noteId: string) => void;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
  isOpen?: boolean;
  onClose?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  activeNote,
  onNoteSelect,
  onNoteDelete,
  onNoteUpdate,
  isOpen,
  onClose,
  hasMore,
  isLoadingMore,
  onLoadMore
}) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<NoteCategory>('general');
  const [editTags, setEditTags] = useState('');

  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore || !loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          console.log('Load more triggered!');
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current && loadMoreRef.current) {
        observerRef.current.unobserve(loadMoreRef.current);
      }
    };
  }, [hasMore]);

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const handleNoteSelect = (note: Note) => {
    if (editingNoteId === note.id) return;
    onNoteSelect(note);
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
  };

  const startEditing = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditCategory(note.category);
    setEditTags(note.tags.join(', '));
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(null);
    setEditTitle('');
    setEditCategory('general');
    setEditTags('');
  };

  const saveEditing = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const updatedNote: Partial<Note> = {
      title: editTitle || 'Untitled Note',
      category: editCategory,
      tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    onNoteUpdate(noteId, updatedNote);
    setEditingNoteId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent, noteId: string) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      saveEditing(noteId, e as any);
    } else if (e.key === 'Escape') {
      cancelEditing(e as any);
    }
  };

  // Handle null notes by providing default empty array
  const safeNotes = notes || [];

  return (
    <div className={`flex flex-col h-full ${isOpen
      ? 'translate-x-0 w-72 md:w-64 lg:w-80 max-h-screen lg:max-h-[95vh] overflow-y-auto'
      : 'h-0 lg:h-[95vh] lg:translate-x-0 lg:w-80'
      } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-gray-800 lg:static lg:shadow-none`}>
      {/* Mobile Header with Close Button */}
      <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-800 text-sm sm:text-base dark:text-gray-100">
            {safeNotes.length} {safeNotes.length === 1 ? 'Note' : 'Notes'}
          </h3>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="lg:hidden h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-gray-800 dark:text-gray-400"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Notes List */}
      <div className={`flex-wrap flex-1 overflow-y-auto modern-scrollbar`}>
        <div className="divide-y divide-slate-100 dark:divide-gray-800">
          {safeNotes.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-slate-400 dark:text-gray-500">
              <div className="text-3xl sm:text-4xl mb-3">📝</div>
              <p className="text-sm sm:text-base">
                {notes === null ? 'Failed to load notes.' : 'No notes available.'}
              </p>
              <p className="text-xs sm:text-sm">
                {notes.length === 0 ? 'Please try again later' : 'Create your first note to get started'}
              </p>
              {notes.length === 0 && (
                <Button
                  onClick={() => onLoadMore()}
                  className="mt-4"
                  variant="outline"
                  size="sm"
                >
                  Retry
                </Button>
              )}
            </div>
          ) : (
            safeNotes.map((note) => (
              <div
                key={note.id}
                className={`p-3 sm:p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors border-l-4 group ${activeNote?.id === note.id
                  ? 'bg-blue-50 border-l-blue-500 dark:bg-blue-950 dark:border-l-blue-700'
                  : 'border-l-transparent'
                  } ${editingNoteId === note.id
                    ? 'bg-yellow-50 border-l-yellow-500 dark:bg-yellow-950 dark:border-l-yellow-700'
                    : ''
                  }`}
                onClick={() => handleNoteSelect(note)}
              >
                {/* ... rest of the note rendering code remains the same ... */}
                <div className="flex items-start justify-between mb-2 gap-2">
                  {editingNoteId === note.id ? (
                    <div className="flex-1 min-w-0 space-y-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, note.id)}
                        className="text-sm font-medium border-slate-300 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        placeholder="Note title"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Select value={editCategory} onValueChange={(value: NoteCategory) => setEditCategory(value)}>
                          <SelectTrigger className="flex-1 h-7 text-xs border-slate-300 dark:bg-gray-800 dark:border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                            <SelectItem value="general" className="text-xs dark:text-gray-100">General</SelectItem>
                            <SelectItem value="math" className="text-xs dark:text-gray-100">Mathematics</SelectItem>
                            <SelectItem value="science" className="text-xs dark:text-gray-100">Science</SelectItem>
                            <SelectItem value="history" className="text-xs dark:text-gray-100">History</SelectItem>
                            <SelectItem value="language" className="text-xs dark:text-gray-100">Languages</SelectItem>
                            <SelectItem value="other" className="text-xs dark:text-gray-100">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <h4 className="font-medium text-slate-800 truncate flex-1 text-sm sm:text-base dark:text-gray-100">
                      {note.title}
                    </h4>
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editingNoteId === note.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => saveEditing(note.id, e)}
                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900 dark:hover:text-green-400"
                          title="Save changes"
                        >
                          <Save className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditing}
                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-800 dark:hover:text-gray-400"
                          title="Cancel editing"
                        >
                          <CloseIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getCategoryColor(note.category)}`}>
                          {note.category}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => startEditing(note, e)}
                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-600 transition-opacity dark:hover:bg-blue-900 dark:hover:text-blue-400"
                          title="Edit note title & metadata"
                        >
                          <Edit className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNoteDelete(note.id);
                          }}
                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-opacity dark:hover:bg-red-900 dark:hover:text-red-400"
                          title="Delete note"
                        >
                          <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {editingNoteId === note.id ? (
                  <div className="space-y-2 mt-2">
                    <Input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, note.id)}
                      className="text-xs border-slate-300 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      placeholder="Tags (comma separated)"
                    />
                    <div className="text-xs text-slate-500 dark:text-gray-400">
                      Press Ctrl+Enter to save, Esc to cancel
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs sm:text-sm text-slate-500 mb-2 leading-relaxed line-clamp-2 dark:text-gray-400">
                      {truncateContent(note.content.replace(/[#*]/g, ''), 80)}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-400 gap-2 dark:text-gray-500">
                      <span className="truncate">{note.updated_at}</span>
                      {note.tags.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {note.tags.slice(0, 2).map((tag, index) => (
                            <span key={index} className="bg-slate-100 px-1.5 py-0.5 rounded text-xs dark:bg-gray-700 dark:text-gray-300">
                              #{tag}
                            </span>
                          ))}
                          {note.tags.length > 2 && (
                            <span className="text-slate-400 dark:text-gray-500">+{note.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
          {hasMore && (
            <div
              ref={loadMoreRef}
              className="w-full flex justify-center items-center py-12"
              style={{ minHeight: '100px' }}
            >
              <div className="flex flex-col items-center gap-2">
                {isLoadingMore ? (
                  <div className="text-sm text-slate-500 dark:text-gray-400 animate-pulse">
                    Loading more notes...
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-gray-600">
                    Scroll to load more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};