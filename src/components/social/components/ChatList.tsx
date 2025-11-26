// src/components/social/components/ChatList.tsx
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Search, Loader2, MessageCircle, LucideChevronLeftSquare, X } from 'lucide-react';
import { ChatSessionWithDetails } from '../types/social';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ChatListProps {
  sessions: ChatSessionWithDetails[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  currentUserId: string;
  isLoading: boolean;
  onbackClick: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  currentUserId,
  isLoading,
  onbackClick,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;

    return sessions.filter(session => {
      // For P2P chats, search by other user's name
      if (session.chat_type === 'p2p') {
        const otherUser = session.user_id1 === currentUserId ? session.user2 : session.user1;
        return otherUser?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase());
      }
      // For group chats, search by group name
      return session.group?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [sessions, searchQuery, currentUserId]);

  const getSessionTitle = (session: ChatSessionWithDetails) => {
    if (session.chat_type === 'group' && session.group) {
      return session.group.name;
    }
    // P2P chat - show other user's name
    const otherUser = session.user_id1 === currentUserId ? session.user2 : session.user1;
    return otherUser?.display_name || 'Unknown User';
  };

  const getSessionAvatar = (session: ChatSessionWithDetails) => {
    if (session.chat_type === 'group' && session.group) {
      return session.group.avatar_url;
    }
    const otherUser = session.user_id1 === currentUserId ? session.user2 : session.user1;
    return otherUser?.avatar_url;
  };

  const getSessionInitials = (session: ChatSessionWithDetails) => {
    if (session.chat_type === 'group' && session.group) {
      return session.group.name[0];
    }
    const otherUser = session.user_id1 === currentUserId ? session.user2 : session.user1;
    return otherUser?.display_name?.[0] || 'U';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full lg:w-96 border-r  border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
      
        <h2 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Messages</h2> 
        <div className="relative flex items-center">
        <button className="mr-2" onClick={() => onbackClick()}>
          <X className="h-5 w-5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" />
        </button>
        <div className="relative flex-1 ml-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        </div>
        
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto modern-scrollbar">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageCircle className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">
              {searchQuery ? 'No chats found' : 'No messages yet'}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {searchQuery ? 'Try a different search' : 'Start a conversation from a user profile'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const hasUnread = (session.unread_count || 0) > 0;

              return (
                <button
                  key={session.id}
                  onClick={() => onSessionSelect(session.id)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={getSessionAvatar(session) || undefined} />
                      <AvatarFallback>{getSessionInitials(session)}</AvatarFallback>
                    </Avatar>
                    {session.chat_type === 'p2p' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-semibold truncate ${hasUnread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                        }`}>
                        {getSessionTitle(session)}
                      </h3>
                      {session.last_message_at && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 flex-shrink-0">
                          {formatDistanceToNow(new Date(session.last_message_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>

                    {session.last_message && (
                      <p className={`text-sm truncate ${hasUnread ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                        {session.last_message.sender_id === currentUserId && 'You: '}
                        {session.last_message.content}
                      </p>
                    )}

                    {hasUnread && (
                      <div className="mt-1">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                          {session.unread_count}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};