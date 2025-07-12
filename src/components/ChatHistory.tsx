import React, { useState } from 'react';
import { MessageSquare, Plus, Trash2, Calendar, MoreVertical, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { formatDate } from '../utils/helpers';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onRenameSession: (sessionId: string, newTitle: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  isOpen,
  onClose,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEditing = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDelete = async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      await onDeleteSession(sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-80 bg-white border-r border-slate-200 shadow-none flex flex-col h-full"> 
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Chat History</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="lg:hidden text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Button 
          onClick={onNewSession} 
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {(sessions ?? []).length === 0 ? ( 
          <div className="text-center py-8 text-slate-400">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50 text-slate-300" />
            <p>No chat history yet</p>
            <p className="text-sm">Start a new conversation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(sessions ?? []).map((session) => (
              <Card
                key={session.id}
                className={`cursor-pointer transition-colors rounded-lg shadow-sm 
                  ${activeSessionId === session.id
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-l-blue-500 shadow-md'
                    : 'hover:bg-slate-50 border border-slate-100'
                  }`}
                onClick={() => onSessionSelect(session.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingId === session.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={handleKeyPress}
                          onBlur={saveEdit}
                          className="w-full bg-transparent border-b border-blue-300 outline-none font-medium text-slate-800"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h3 className="font-medium truncate text-slate-800">{session.title}</h3>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>{formatDate(new Date(session.last_message_at))}</span>
                        {session.message_count && (
                          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                            {session.message_count} messages
                          </Badge>
                        )}
                      </div>
                      {(session.document_ids ?? []).length > 0 && ( 
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                            {(session.document_ids ?? []).length} document{session.document_ids?.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-500 hover:bg-slate-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white border border-slate-200 rounded-md shadow-lg">
                        <DropdownMenuItem 
                          onClick={() => startEditing(session)}
                          className="text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(session.id)}
                          className="text-red-600 hover:bg-red-50 cursor-pointer"
                          disabled={deletingId === session.id}
                        >
                          {deletingId === session.id ? (
                            <span className="flex items-center">
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              Deleting...
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </span>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};