import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { SocialChatMessage, SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { getTimeAgo } from '../utils/postUtils';
import { toast } from 'sonner';

interface ChatMessageWithSender extends SocialChatMessage {
  sender: SocialUserWithDetails | null; // Allow null for sender
}

interface GroupChatProps {
  groupId: string;
  currentUser: SocialUserWithDetails | null;
}

export const GroupChat: React.FC<GroupChatProps> = ({ groupId, currentUser }) => {
  const [messages, setMessages] = useState<ChatMessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('social_chat_messages')
          .select(`
            *,
            sender:social_users!sender_id (*)
          `) // Use explicit table name for join
          .eq('group_id', groupId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (error) throw error;

        console.log('Fetched messages:', data);
        setMessages((data as ChatMessageWithSender[]) || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load chat messages');
        setMessages([]);
      }
    };

    fetchMessages();

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
          // Fetch sender details for the new message
          const { data: senderData, error: senderError } = await supabase
            .from('social_users')
            .select('*')
            .eq('id', payload.new.sender_id)
            .single();

          if (senderError) {
            console.error('Error fetching sender for new message:', senderError);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser) {
      toast.error('Please enter a message and ensure you are logged in');
      return;
    }

    try {
      const { error } = await supabase.from('social_chat_messages').insert({
        group_id: groupId,
        sender_id: currentUser.id,
        content: newMessage,
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 modern-scrollbar">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] flex flex-col ${
                  msg.sender_id === currentUser?.id ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={msg.sender?.avatar_url || ''} />
                    <AvatarFallback>
                      {msg.sender?.display_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">
                    {msg.sender?.display_name || 'Unknown User'}
                  </span>
                </div>
                <p className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-sm">
                  {msg.content}
                </p>
                <span className="text-xs text-gray-400 mt-1">{getTimeAgo(msg.created_at)}</span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-4 flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={!currentUser}
        />
        <Button onClick={handleSend} disabled={!currentUser || !newMessage.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
};