// ShareToChatDialog.tsx - Dialog for sharing posts to chat sessions
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Input } from '../../ui/input';
import { Loader2, Search, Send, MessageCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { SocialPostWithDetails } from '../../../integrations/supabase/socialTypes';
import { useChatActions } from '../hooks/useChatActions';

interface ShareToChatDialogProps {
  post: SocialPostWithDetails;
  currentUser: any;
  onClose: () => void;
}

interface ChatSession {
  id: string;
  chat_type: 'p2p' | 'group';
  user1?: any;
  user2?: any;
  group?: any;
  last_message_at?: string;
}

export const ShareToChatDialog: React.FC<ShareToChatDialogProps> = ({
  post,
  currentUser,
  onClose,
}) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const { sendMessageWithResource } = useChatActions(currentUser?.id);

  useEffect(() => {
    fetchChatSessions();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredSessions(
        chatSessions.filter((session) => {
          if (session.chat_type === 'group') {
            return session.group?.name?.toLowerCase().includes(query);
          } else {
            const otherUser =
              session.user1?.id === currentUser.id ? session.user2 : session.user1;
            return (
              otherUser?.display_name?.toLowerCase().includes(query) ||
              otherUser?.username?.toLowerCase().includes(query)
            );
          }
        })
      );
    } else {
      setFilteredSessions(chatSessions);
    }
  }, [searchQuery, chatSessions, currentUser]);

  const fetchChatSessions = async () => {
    try {
      setIsLoading(true);

      // Fetch P2P sessions where user is participant
      const { data: p2pSessions, error: p2pError } = await supabase
        .from('social_chat_sessions')
        .select(`
          *,
          group:social_groups(*),
          user1:social_users!social_chat_sessions_user_id1_fkey(*),
          user2:social_users!social_chat_sessions_user_id2_fkey(*)
        `)
        .eq('chat_type', 'p2p')
        .or(`user_id1.eq.${currentUser.id},user_id2.eq.${currentUser.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (p2pError) throw p2pError;

      // Fetch group sessions
      const { data: groupSessions, error: groupError } = await supabase
        .from('social_chat_sessions')
        .select(`
          *,
          group:social_groups(*),
          user1:social_users!social_chat_sessions_user_id1_fkey(*),
          user2:social_users!social_chat_sessions_user_id2_fkey(*)
        `)
        .eq('chat_type', 'group')
        .not('group_id', 'is', null)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (groupError) throw groupError;

      // Combine both session types
      const allSessions = [...(p2pSessions || []), ...(groupSessions || [])]
        .sort((a, b) => {
          const aTime = a.last_message_at || a.created_at;
          const bTime = b.last_message_at || b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

      // Filter to only show sessions where user is a member (for groups)
      const validSessions: ChatSession[] = [];

      for (const session of allSessions) {
        if (session.chat_type === 'group' && session.group_id) {
          // Check if user is a member of the group
          const { data: membership } = await supabase
            .from('social_group_members')
            .select('id')
            .eq('group_id', session.group_id)
            .eq('user_id', currentUser.id)
            .eq('status', 'active')
            .maybeSingle();

          if (membership) {
            validSessions.push(session);
          }
        } else if (session.chat_type === 'p2p') {
          validSessions.push(session);
        }
      }

      setChatSessions(validSessions);
      setFilteredSessions(validSessions);
    } catch (error) {
      //console.error('Error fetching chat sessions:', error);
      toast.error('Failed to load chats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareToChat = async (session: ChatSession) => {
    try {
      setIsSending(true);

      const shareMessage = `Check out this post: ${post.content.slice(0, 100)}${post.content.length > 100 ? '...' : ''
        }`;

      const result = await sendMessageWithResource(
        session.id,
        shareMessage,
        post.id,
        'post'
      );

      if (result) {
        toast.success('Post shared successfully');
        onClose();
      } else {
        toast.error('Failed to share post');
      }
    } catch (error) {
      //console.error('Error sharing post:', error);
      toast.error('Failed to share post');
    } finally {
      setIsSending(false);
    }
  };

  const getSessionDisplay = (session: ChatSession) => {
    if (session.chat_type === 'group') {
      return {
        name: session.group?.name || 'Group Chat',
        avatar: session.group?.avatar_url,
        icon: <Users className="h-4 w-4" />,
      };
    } else {
      const otherUser =
        session.user1?.id === currentUser.id ? session.user2 : session.user1;
      return {
        name: otherUser?.display_name || 'User',
        avatar: otherUser?.avatar_url,
        icon: <MessageCircle className="h-4 w-4" />,
      };
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share to Chat</DialogTitle>
          <DialogDescription>
            Choose a chat to share this post with
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Chat List */}
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {searchQuery ? 'No chats found' : 'No chats available'}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const display = getSessionDisplay(session);
              return (
                <button
                  key={session.id}
                  onClick={() => handleShareToChat(session)}
                  disabled={isSending}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={display.avatar} />
                    <AvatarFallback>
                      {display.name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      {display.icon}
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {display.name}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">
                      {session.chat_type === 'group' ? 'Group' : 'Direct Message'}
                    </p>
                  </div>

                  <Send className="h-4 w-4 text-blue-600" />
                </button>
              );
            })
          )}
        </div>

        {/* Cancel Button */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};