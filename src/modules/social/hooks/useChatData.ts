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
    const pendingMessageIds = useRef<Set<string>>(new Set());
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Safe Object.groupBy polyfill
    const groupBy = <T, K extends string | number | symbol>(
        array: T[],
        callback: (item: T) => K
    ): Record<K, T[]> => {
        return array.reduce((result, item) => {
            const key = callback(item);
            if (!result[key]) result[key] = [];
            result[key].push(item);
            return result;
        }, {} as Record<K, T[]>);
    };

    const canDisplayDocumentInline = (doc: any): boolean => {
        if (!doc?.content_extracted) return false;
        return (
            doc.file_type === 'text/plain' ||
            doc.file_type?.includes('text/') ||
            doc.file_type === 'application/pdf' ||
            doc.file_type === 'application/json'
        );
    };

    // ✅ Helper to robustly extract bucket and path from URL
    const extractStorageDetails = (fileUrl: string) => {
        try {
            // Handle full URLs
            if (fileUrl.startsWith('http')) {
                const url = new URL(fileUrl);
                const pathParts = url.pathname.split('/');
                // Expected format: /storage/v1/object/public/{bucket}/{path...}
                const publicIndex = pathParts.indexOf('public');

                if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
                    const bucket = pathParts[publicIndex + 1];
                    const path = pathParts.slice(publicIndex + 2).join('/');
                    return { bucket, path };
                }
            }

            // Fallback for legacy relative paths
            if (fileUrl.includes('/documents/')) {
                return { bucket: 'documents', path: fileUrl.split('/documents/')[1] };
            }

            // Default fallback
            return { bucket: 'documents', path: fileUrl };
        } catch (e) {
            return { bucket: 'documents', path: fileUrl };
        }
    };

    const enrichResource = async (res: any) => {
        let fullResource: any = { ...res };
        let signedFileUrl: string | null = null;

        if (res.resource_type === 'note') {
            // ✅ FIX: Use maybeSingle() to avoid 406 errors if note is deleted
            const { data: note, error } = await supabase
                .from('notes')
                .select('id, title, content, category, tags, created_at, updated_at, ai_summary, document_id')
                .eq('id', res.resource_id)
                .maybeSingle();

            if (error || !note) {
                return { ...res, error: 'Note not found or access denied' };
            }

            fullResource = { ...res, ...note };

            // Only fetch associated document if note has one
            if (note.document_id) {
                const { data: doc } = await supabase
                    .from('documents')
                    .select('id, title, file_name, file_type, file_size, file_url, content_extracted, processing_status')
                    .eq('id', note.document_id)
                    .maybeSingle();

                if (doc?.file_url && !canDisplayDocumentInline(doc)) {
                    // ✅ FIX: Use robust path extraction
                    const { bucket, path } = extractStorageDetails(doc.file_url);

                    if (path && !path.startsWith('http')) {
                        const { data: signed } = await supabase.storage
                            .from(bucket)
                            .createSignedUrl(path, 3600);
                        signedFileUrl = signed?.signedUrl || null;
                    }
                }

                fullResource.associatedDocument = doc || null;
                fullResource.signedFileUrl = signedFileUrl;
                fullResource.displayAsText = doc ? canDisplayDocumentInline(doc) : false;
                fullResource.previewContent = doc?.content_extracted || null;
            }
        }
        else if (res.resource_type === 'document') {
            const { data: doc, error } = await supabase
                .from('documents')
                .select('id, title, file_name, file_type, file_size, file_url, content_extracted, processing_status')
                .eq('id', res.resource_id)
                .maybeSingle();

            if (error || !doc) {
                return { ...res, error: 'Document not found or access denied' };
            }

            fullResource = { ...res, ...doc };

            if (doc.file_url && !canDisplayDocumentInline(doc)) {
                // ✅ FIX: Use robust path extraction
                const { bucket, path } = extractStorageDetails(doc.file_url);

                if (path && !path.startsWith('http')) {
                    const { data: signed } = await supabase.storage
                        .from(bucket)
                        .createSignedUrl(path, 3600);
                    signedFileUrl = signed?.signedUrl || null;
                }
            }

            fullResource.signedFileUrl = signedFileUrl;
            fullResource.displayAsText = canDisplayDocumentInline(doc);
            fullResource.previewContent = doc.content_extracted || null;
        }
        else if (res.resource_type === 'class_recording') {
            const { data: recording, error } = await supabase
                .from('class_recordings')
                .select('id, title, subject, audio_url, duration, date, summary, transcript')
                .eq('id', res.resource_id)
                .maybeSingle();

            if (error || !recording) {
                return { ...res, error: 'Recording not found or access denied' };
            }

            fullResource = { ...res, ...recording };

            if (recording.audio_url) {
                const { bucket, path } = extractStorageDetails(recording.audio_url);

                if (path && !path.startsWith('http')) {
                    const { data: signed } = await supabase.storage
                        .from(bucket)
                        .createSignedUrl(path, 7200); // 2 hours for recordings
                    signedFileUrl = signed?.signedUrl || null;
                }
            }

            fullResource.signedFileUrl = signedFileUrl;
        }

        return fullResource;
    };

    const processPendingMessages = async () => {
        if (pendingMessageIds.current.size === 0) return;

        const ids = Array.from(pendingMessageIds.current);
        pendingMessageIds.current.clear();

        try {
            const { data: messages, error } = await supabase
                .from('social_chat_messages')
                .select('*, sender:social_users(*)')
                .in('id', ids);

            if (error || !messages || messages.length === 0) return;

            const messageIds = messages.map(m => m.id);

            const [{ data: allMedia }, { data: allBasicResources }] = await Promise.all([
                supabase.from('social_chat_message_media').select('*').in('message_id', messageIds),
                supabase.from('social_chat_message_resources').select('*').in('message_id', messageIds),
            ]);

            const mediaByMsg = groupBy(allMedia || [], m => m.message_id);
            const resourcesByMsg = groupBy(allBasicResources || [], r => r.message_id);

            const enrichedMessages = await Promise.all(
                messages.map(async (msg) => {
                    const enrichedResources = await Promise.all(
                        (resourcesByMsg[msg.id] || []).map(enrichResource)
                    );

                    return {
                        ...msg,
                        sender: msg.sender,
                        media: mediaByMsg[msg.id] || [],
                        resources: enrichedResources,
                    } as ChatMessageWithDetails;
                })
            );

            setActiveSessionMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const newMessages = enrichedMessages.filter(m => !existingIds.has(m.id));
                if (newMessages.length === 0) return prev;
                return [...prev, ...newMessages].sort((a, b) => a.created_at.localeCompare(b.created_at));
            });

            if (activeSessionId) markSessionMessagesAsRead(activeSessionId);
        } catch (err) {
            ////console.error('Error processing realtime messages:', err);
        }
    };

    const fetchChatSessions = useCallback(async () => {
        if (!currentUserId) {
            setIsLoadingSessions(false);
            return;
        }

        try {
            setIsLoadingSessions(true);

            const { data: response, error } = await supabase.functions.invoke('get-chat-sessions', {
                body: {},
            });

            if (error) throw error;

            const sessionsWithDetails = (response || []).map((session: any) => ({
                ...session,
                group: session.group ? {
                    ...session.group,
                    privacy: session.group.privacy as "public" | "private"
                } : undefined,
            }));

            setChatSessions(sessionsWithDetails as ChatSessionWithDetails[]);
        } catch (error) {
            toast.error('Failed to load chats');
        } finally {
            setIsLoadingSessions(false);
        }
    }, [currentUserId]);

    const fetchChatMessages = useCallback(async (sessionId: string) => {
        try {
            setIsLoadingMessages(true);

            const { data: response, error } = await supabase.functions.invoke('get-chat-messages', {
                body: { session_id: sessionId },
            });

            if (error) throw error;

            setActiveSessionMessages((response || []) as ChatMessageWithDetails[]);

            // Edge function already marks messages as read, update local state
            setChatSessions(prev =>
                prev.map(s => (s.id === sessionId ? { ...s, unread_count: 0 } : s))
            );
        } catch (error) {
            toast.error('Failed to load messages');
        } finally {
            setIsLoadingMessages(false);
        }
    }, [currentUserId]);

    const markSessionMessagesAsRead = async (sessionId: string) => {
        if (!currentUserId) return;
        try {
            const { error } = await supabase.rpc('mark_session_messages_read', {
                p_session_id: sessionId,
                p_user_id: currentUserId,
            });
            if (error) throw error;

            setChatSessions(prev =>
                prev.map(s => (s.id === sessionId ? { ...s, unread_count: 0 } : s))
            );
        } catch (error) {
            ////console.error('Error marking messages read:', error);
        }
    };

    const deleteMessage = async (messageId: string): Promise<boolean> => {
        try {
            const { data: response, error } = await supabase.functions.invoke('delete-chat-message', {
                body: { message_id: messageId },
            });

            if (error || !response?.success) {
                toast.error('Failed to delete message');
                return false;
            }

            setActiveSessionMessages(prev => prev.filter(m => m.id !== messageId));
            toast.success('Message deleted');
            return true;
        } catch (error) {
            toast.error('Failed to delete message');
            return false;
        }
    };

    const editMessage = async (messageId: string, newContent: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('social_chat_messages')
                .update({
                    content: newContent.trim(),
                    is_edited: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', messageId);

            if (error) throw error;

            setActiveSessionMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? { ...m, content: newContent.trim(), is_edited: true, updated_at: new Date().toISOString() }
                        : m
                )
            );

            toast.success('Message updated');
            return true;
        } catch (error) {
            ////console.error('Error editing message:', error);
            toast.error('Failed to edit message');
            return false;
        }
    };

    useEffect(() => {
        if (!currentUserId) return;

        sessionsChannelRef.current = supabase
            .channel('user_chat_sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'social_chat_sessions', filter: `user_id1=eq.${currentUserId}` }, () => fetchChatSessions())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'social_chat_sessions', filter: `user_id2=eq.${currentUserId}` }, () => fetchChatSessions())
            .subscribe();

        fetchChatSessions();

        return () => {
            if (sessionsChannelRef.current) supabase.removeChannel(sessionsChannelRef.current);
        };
    }, [currentUserId, fetchChatSessions]);

    useEffect(() => {
        if (!activeSessionId || !currentUserId) {
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
                { event: 'INSERT', schema: 'public', table: 'social_chat_messages', filter: `session_id=eq.${activeSessionId}` },
                (payload) => {
                    pendingMessageIds.current.add(payload.new.id);
                    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
                    processingTimeoutRef.current = setTimeout(processPendingMessages, 300);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'social_chat_messages', filter: `session_id=eq.${activeSessionId}` },
                async (payload) => {
                    const message = await fetchFullMessage(payload.new.id);
                    if (message) {
                        setActiveSessionMessages(prev => prev.map(m => (m.id === message.id ? message : m)));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'social_chat_messages', filter: `session_id=eq.${activeSessionId}` },
                (payload) => {
                    setActiveSessionMessages(prev => prev.filter(m => m.id !== payload.old.id));
                }
            )
            .subscribe();

        fetchChatMessages(activeSessionId);

        return () => {
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
            if (messagesChannelRef.current) {
                supabase.removeChannel(messagesChannelRef.current);
                messagesChannelRef.current = null;
            }
        };
    }, [activeSessionId, currentUserId, fetchChatMessages]);

    const fetchFullMessage = async (messageId: string): Promise<ChatMessageWithDetails | null> => {
        try {
            const { data: msg } = await supabase
                .from('social_chat_messages')
                .select('*, sender:social_users(*)')
                .eq('id', messageId)
                .single();

            if (!msg) return null;

            const [{ data: media }, { data: resources }] = await Promise.all([
                supabase.from('social_chat_message_media').select('*').eq('message_id', messageId),
                supabase.from('social_chat_message_resources').select('*').eq('message_id', messageId),
            ]);

            const enriched = await Promise.all((resources || []).map(enrichResource));

            return { ...msg, sender: msg.sender, media: media || [], resources: enriched };
        } catch (err) {
            ////console.error('Error fetching full message:', err);
            return null;
        }
    };

    const setActiveSession = useCallback((sessionId: string | null) => {
        setActiveSessionId(sessionId);
        if (!sessionId) setActiveSessionMessages([]);
    }, []);

    const addOptimisticMessage = useCallback((message: ChatMessageWithDetails) => {
        setActiveSessionMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
        });

        if (message.sender_id === currentUserId && message.session_id === activeSessionId) {
            markSessionMessagesAsRead(message.session_id);
        }
    }, [currentUserId, activeSessionId]);

    return {
        chatSessions,
        activeSessionMessages,
        isLoadingSessions,
        isLoadingMessages,
        activeSessionId,
        setActiveSession,
        refetchSessions: fetchChatSessions,
        refetchMessages: () => activeSessionId && fetchChatMessages(activeSessionId),
        deleteMessage,
        editMessage,
        markSessionMessagesAsRead,
        addOptimisticMessage,
    };
};