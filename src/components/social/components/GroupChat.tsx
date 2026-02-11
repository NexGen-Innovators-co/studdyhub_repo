// src/components/social/components/GroupChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { validateChatMessage, sanitizeText, stripHtml } from '../../../utils/validation';
import { SocialChatMessage, SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { getTimeAgo } from '../utils/postUtils';
import { GroupHeader } from './GroupHeader';

interface ChatMessageWithSender extends SocialChatMessage {
  sender: SocialUserWithDetails | null;
}

interface GroupChatProps {
  groupId: string;
  currentUser: SocialUserWithDetails | null;
  isMember?: boolean;

  onOpenSettings?: () => void;
}

export const GroupChat: React.FC<GroupChatProps> = ({
  groupId,
  currentUser,

  isMember = false,

}) => {
  const [messages, setMessages] = useState<ChatMessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('social_chat_messages')
          .select(`
            *,
            sender:social_users!sender_id (*)
          `)
          .eq('group_id', groupId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (error) throw error;
        setMessages((data as ChatMessageWithSender[]) || []);
      } catch (error) {
        //console.error('Error fetching messages:', error);
        toast.error('Failed to load chat messages');
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // Realtime subscription
    channelRef.current = supabase
      .channel(`group_chat_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_chat_messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const { data: senderData, error: senderError } = await supabase
            .from('social_users')
            .select('*')
            .eq('id', payload.new.sender_id)
            .single();

          if (senderError) {
            //console.error('Error fetching sender:', senderError);
            return;
          }

          setMessages((prev) => [
            ...prev,
            { ...payload.new, sender: senderData } as ChatMessageWithSender,
          ]);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [groupId]);

  const handleSend = async () => {
    if (!currentUser) {
      toast.error('Please sign in to send messages');
      return;
    }

    const sanitized = sanitizeText(stripHtml(newMessage));
    const validation = validateChatMessage(sanitized);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('send-group-message', {
        body: { group_id: groupId, content: sanitized },
      });

      if (error || !response?.success) throw new Error('Failed to send message');
      setNewMessage('');
      inputRef.current?.focus();
    } catch (error) {
      //console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-slate-200 dark:border-slate-800">

      {/* Chat Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full pt-6 pb-4">
        <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-10rem)]">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-4 modern-scrollbar py-4 px-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm lg:text-base">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'
                    } mb-3`}
                >
                  <div
                    className={`max-w-[70%] sm:max-w-[60%] lg:max-w-[50%] flex flex-col ${msg.sender_id === currentUser?.id ? 'items-end' : 'items-start'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.sender_id !== currentUser?.id && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={msg.sender?.avatar_url || ''} />
                          <AvatarFallback className="text-xs">
                            {msg.sender?.display_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-sm lg:text-base break-words ${msg.sender_id === currentUser?.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-xs text-gray-400 mt-1">
                      {getTimeAgo(msg.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 py-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 max-w-5xl mx-auto">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={!currentUser || !isMember}
                className="flex-1 text-sm lg:text-base rounded-full"
              />
              <Button
                onClick={handleSend}
                disabled={!currentUser || !newMessage.trim() || !isMember}
                className="rounded-full px-4"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};