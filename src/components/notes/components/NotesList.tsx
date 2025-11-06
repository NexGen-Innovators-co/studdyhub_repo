import React from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Note } from '../../../types/Note';
import { formatDate, getCategoryColor } from '../../classRecordings/utils/helpers';

interface NotesListProps {
  notes: Note[];
  activeNote: Note | null;
  onNoteSelect: (note: Note) => void;
  onNoteDelete: (noteId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  activeNote,
  onNoteSelect,
  onNoteDelete,
  isOpen,
  onClose
}) => {
  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const handleNoteSelect = (note: Note) => {
    onNoteSelect(note);
    // Close mobile drawer when note is selected
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <div className={`flex flex-col  ${
          isOpen
            ? 'translate-x-0 w-72 md:w-64 h-screen'
            : 'h-0 lg:h-[95vh] lg:translate-x-0'
        }   bg-white dark:bg-gray-900 `}>
      {/* Mobile Header with Close Button */}
      <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-800 text-sm sm:text-base dark:text-gray-100">
            {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
          </h3>
          {/* Close button for mobile */}
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
          {notes.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-slate-400 dark:text-gray-500">
              <div className="text-3xl sm:text-4xl mb-3">📝</div>
              <p className="text-sm sm:text-base">No notes found</p>
              <p className="text-xs sm:text-sm">Create your first note to get started</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`p-3 sm:p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors border-l-4 group ${activeNote?.id === note.id
                  ? 'bg-blue-50 border-l-blue-500 dark:bg-blue-950 dark:border-l-blue-700'
                  : 'border-l-transparent'
                  }`}
                onClick={() => handleNoteSelect(note)}
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h4 className="font-medium text-slate-800 truncate flex-1 text-sm sm:text-base dark:text-gray-100">
                    {note.title}
                  </h4>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getCategoryColor(note.category)}`}>
                      {note.category}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 sm:h-6 sm:w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-opacity dark:hover:bg-red-900 dark:hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNoteDelete(note.id);
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-500 mb-2 leading-relaxed line-clamp-2 dark:text-gray-400">
                  {truncateContent(note.content.replace(/[#*]/g, ''), 80)}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-400 gap-2 dark:text-gray-500">
                  <span className="truncate">{formatDate(note.updatedAt)}</span>
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
