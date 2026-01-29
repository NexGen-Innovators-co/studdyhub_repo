// src/components/aiChat/ChatSessionsListMobile.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { Plus, MessageCircle, Trash2, Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface ChatSessionsListMobileProps {
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  onSessionSelect: (id: string) => void;
  onNewChatSession: () => void;
  onDeleteChatSession: (id: string) => void;
  onRenameChatSession: (id: string, title: string) => void;
  hasMoreChatSessions: boolean;
  onLoadMoreChatSessions: () => void;
  isLoading: boolean;
}

export const ChatSessionsListMobile: React.FC<ChatSessionsListMobileProps> = ({
  chatSessions,
  activeChatSessionId,
  onSessionSelect,
  onNewChatSession,
  onDeleteChatSession,
  hasMoreChatSessions,
  onLoadMoreChatSessions,
  isLoading,
}) => {
  // Infinite scroll: observe the sentinel div at the end of the list
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(isLoading);
  loadingRef.current = isLoading;

  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMoreChatSessions && !loadingRef.current) {
      onLoadMoreChatSessions();
    }
  }, [hasMoreChatSessions, onLoadMoreChatSessions]);

  useEffect(() => {
    const observer = new window.IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    });
    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
      observer.disconnect();
    };
  }, [handleIntersect]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            AI Assistant
          </h1>
          <Button
            onClick={onNewChatSession}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {chatSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageCircle className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400">No conversations yet</p>
            <Button onClick={onNewChatSession} className="mt-4">
              Start New Chat
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {chatSessions.map((session) => (
              <Card
                key={session.id}
                className={`m-2 border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                  activeChatSessionId === session.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => onSessionSelect(session.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-white truncate">
                        {session.title || 'New Chat'}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {formatDistanceToNow(new Date(session.last_message_at || session.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChatSession(session.id);
                      }}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Infinite scroll sentinel */}
            {hasMoreChatSessions && (
              <div ref={sentinelRef} className="w-full flex justify-center py-4">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};