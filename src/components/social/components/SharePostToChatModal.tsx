// src/components/social/components/SharePostToChatModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { ScrollArea } from '../../ui/scroll-area';
import { Card, CardContent } from '../../ui/card';
import { Search, Loader2, CheckCircle2, MessageCircle, Users } from 'lucide-react';
import { ChatSessionWithDetails } from '../types/social';
import { SocialPostWithDetails } from '@/integrations/supabase/socialTypes';
import { formatDistanceToNow } from 'date-fns';

interface SharePostToChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: SocialPostWithDetails | null;
  chatSessions: ChatSessionWithDetails[];
  currentUserId: string;
  onShare: (sessionId: string, message: string) => Promise<boolean>;
  isSharing: boolean;
}

export const SharePostToChatModal: React.FC<SharePostToChatModalProps> = ({
  isOpen,
  onClose,
  post,
  chatSessions,
  currentUserId,
  onShare,
  isSharing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const filteredSessions = chatSessions.filter(session => {
    if (session.chat_type === 'group' && session.group) {
      return session.group.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    const otherUser = session.user_id1 === currentUserId ? session.user2 : session.user1;
    return (
      otherUser?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getSessionTitle = (session: ChatSessionWithDetails) => {
    if (session.chat_type === 'group' && session.group) {
      return session.group.name;
    }
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

  const handleShare = async () => {
    if (!selectedSessionId || !post) return;

    const shareMessage = message.trim() || `Check out this post by ${post.author?.display_name || 'someone'}`;
    const success = await onShare(selectedSessionId, shareMessage);
    
    if (success) {
      setSelectedSessionId(null);
      setMessage('');
      setSearchQuery('');
      onClose();
    }
  };

  if (!post) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[95vh] w-[95vw] p-0 gap-0 flex flex-col rounded-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogTitle>Share Post to Chat</DialogTitle>
          <DialogDescription>
            Select a conversation to share this post
          </DialogDescription>
        </DialogHeader>

        {/* Top Section: Post Preview, Message, Search - Fixed */}
        <div className="shrink-0 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
           {/* Post Preview */}
          <div className="px-6 pt-4 pb-2">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 border border-slate-100 dark:border-slate-700">
                    <AvatarImage src={post.author?.avatar_url || undefined} />
                    <AvatarFallback>{post.author?.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm truncate">{post.author?.display_name}</span>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                      {post.content}
                    </p>
                    {post.media && post.media.length > 0 && (
                      <div className="mt-1 text-xs text-slate-500 font-medium">
                        📎 {post.media.length} attachment{post.media.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Message Input */}
          <div className="px-6 py-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message..."
              className="min-h-[2.5rem] h-10 py-2 resize-none text-sm bg-white dark:bg-slate-950"
            />
          </div>

          {/* Search */}
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-white dark:bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* Chat Sessions List - Scrollable */}
        <ScrollArea className="flex-1 min-h-0 bg-white dark:bg-slate-950">
          <div className="p-4 max-h-[200px] overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                {searchQuery ? 'Try a different search' : 'Start chatting with someone first'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredSessions.map((session) => {
                const isSelected = selectedSessionId === session.id;
                
                return (
                  <Card
                    key={session.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={getSessionAvatar(session) || undefined} />
                            <AvatarFallback>{getSessionTitle(session)[0]}</AvatarFallback>
                          </Avatar>
                          {session.chat_type === 'group' && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1">
                              <Users className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                              {getSessionTitle(session)}
                            </h4>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            )}
                          </div>
                          
                          {session.chat_type === 'group' && session.group && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {session.group.members_count} members
                            </p>
                          )}
                          
                          {session.last_message && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 truncate mt-1">
                              {session.last_message.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 p-6 pt-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSharing} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={!selectedSessionId || isSharing}
            className="w-full sm:w-auto"
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              'Share to Chat'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};