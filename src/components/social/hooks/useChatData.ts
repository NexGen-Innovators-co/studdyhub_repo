// src/components/social/hooks/useChatData.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';
import { ChatSessionWithDetails, ChatMessageWithDetails } from '../types/social';

export const useChatData = (currentUserId: string | null) => {
    const [chatSessions, setChatSessions] = useState<ChatSessionWithDetails[]>([]);
    const [activeSessionMessages, setActiveSessionMessages] = useState<ChatMessageWithDetails[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const sessionsChannelRef = useRef<any>(null);
    const messagesChannelRef = useRef<any>(null);

    // Fetch chat sessions
    const fetchChatSessions = useCallback(async () => {
        if (!currentUserId) {
            setIsLoadingSessions(false);
            return;
        }

        try {
            setIsLoadingSessions(true);

            // Fetch sessions where user is participant
            const { data: sessions, error } = await supabase
                .from('social_chat_sessions')
                .select(`
*,
group:social_groups(*),
user1:social_users!social_chat_sessions_user_id1_fkey(*),
user2:social_users!social_chat_sessions_user_id2_fkey(*)
`)
                .or(`user_id1.eq.${currentUserId},user_id2.eq.${currentUserId}`)
                .order('last_message_at', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch last message for each session
            const sessionsWithDetails = await Promise.all(
                (sessions || []).map(async (session) => {
                    const { data: lastMessage } = await supabase
                        .from('social_chat_messages')
                        .select(`
*,
sender:social_users(*)
`)
                        .eq('session_id', session.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    // Calculate unread count (simplified - in production, track read status)
                    const { count } = await supabase
                        .from('social_chat_messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('session_id', session.id)
                        .neq('sender_id', currentUserId);

                    return {
                        ...session,
                        group: session.group ? { ...session.group, privacy: session.group.privacy as "public" | "private" } : undefined,
                        user1: session.user1,
                        user2: session.user2,
                        last_message: lastMessage || undefined,
                        unread_count: count || 0,
                    };
                })
            );

            setChatSessions(sessionsWithDetails as ChatSessionWithDetails[]);
        } catch (error) {
            console.error('Error fetching chat sessions:', error);
            toast.error('Failed to load chat sessions');
        } finally {
            setIsLoadingSessions(false);
        }
    }, [currentUserId]);

    // Fetch messages for a specific session
    const fetchChatMessages = useCallback(async (sessionId: string) => {
        try {
            setIsLoadingMessages(true);

            const { data: messages, error } = await supabase
                .from('social_chat_messages')
                .select(`
*,
sender:social_users(*),
media:social_chat_message_media(*)
`)
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Fetch resources for each message
            const messagesWithResources = await Promise.all(
                (messages || []).map(async (message) => {
                    const { data: resources } = await supabase
                        .from('social_chat_message_resources')
                        .select('*')
                        .eq('message_id', message.id);

                    return {
                        ...message,
                        sender: message.sender,
                        media: message.media ? message.media.map(m => ({ ...m, type: m.type })) : [],
                        resources: resources || [],
                    };
                })
            );

            setActiveSessionMessages(messagesWithResources as ChatMessageWithDetails[]);
        } catch (error) {
            console.error('Error fetching chat messages:', error);
            toast.error('Failed to load messages');
        } finally {
            setIsLoadingMessages(false);
        }
    }, []);

    // Setup realtime subscriptions
    useEffect(() => {
        if (!currentUserId) return;

        // Subscribe to chat sessions changes
        sessionsChannelRef.current = supabase
            .channel('user_chat_sessions')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'social_chat_sessions',
                    filter: `user_id1=eq.${currentUserId}`,
                },
                () => {
                    fetchChatSessions();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'social_chat_sessions',
                    filter: `user_id2=eq.${currentUserId}`,
                },
                () => {
                    fetchChatSessions();
                }
            )
            .subscribe();

        fetchChatSessions();

        return () => {
            if (sessionsChannelRef.current) {
                supabase.removeChannel(sessionsChannelRef.current);
            }
        };
    }, [currentUserId, fetchChatSessions]);

    // Setup realtime for active session messages
    useEffect(() => {
        if (!activeSessionId) {
            if (messagesChannelRef.current) {
                supabase.removeChannel(messagesChannelRef.current);
                messagesChannelRef.current = null;
            }
            return;
        }

        messagesChannelRef.current = supabase
            .channel(`chat_messages_${activeSessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'social_chat_messages',
                    filter: `session_id=eq.${activeSessionId}`,
                },
                async (payload) => {
                    // Fetch full message details
                    const { data: newMessage } = await supabase
                        .from('social_chat_messages')
                        .select(`*,sender:social_users(*),media:social_chat_message_media(*)`)
                        .eq('id', payload.new.id)
                        .single();

                    if (newMessage) {
                        const { data: resources } = await supabase
                            .from('social_chat_message_resources')
                            .select('*')
                            .eq('message_id', newMessage.id);

                        setActiveSessionMessages((prevMessages => [
                            ...prevMessages,
                            {
                                ...newMessage,
                                sender: newMessage.sender,
                                media: newMessage.media ? newMessage.media.map(m => ({ ...m, type: m.type})) : [],
                                resources: resources || [],
                            } as ChatMessageWithDetails,
                        ])
                        );
                    }
                }
            )
            .subscribe();

        fetchChatMessages(activeSessionId);

        return () => {
            if (messagesChannelRef.current) {
                supabase.removeChannel(messagesChannelRef.current);
            }
        };
    }, [activeSessionId, fetchChatMessages]);

    const setActiveSession = useCallback((sessionId: string | null) => {
        setActiveSessionId(sessionId);
        if (!sessionId) {
            setActiveSessionMessages([]);
        }
    }, []);

    return {
        chatSessions,
        activeSessionMessages,
        isLoadingSessions,
        isLoadingMessages,
        activeSessionId,
        setActiveSession,
        refetchSessions: fetchChatSessions,
        refetchMessages: () => activeSessionId && fetchChatMessages(activeSessionId),
    };
};