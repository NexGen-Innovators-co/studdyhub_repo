// src/components/social/hooks/useChatData.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { apiClient } from '@/services/apiClient';
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
    const allMessagesChannelRef = useRef<any>(null);
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
            let note: any = null;
            try {
                note = await apiClient.get(`notes/${res.resource_id}`);
            } catch {
                note = null;
            }

            if (!note) {
                return { ...res, error: 'Note not found or access denied' };
            }

            fullResource = { ...res, ...note };

            // Only fetch associated document if note has one
            if (note.document_id) {
                let doc: any = null;
                try {
                    doc = await apiClient.get(`documents/${note.document_id}`);
                } catch {
                    doc = null;
                }

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
            let doc: any = null;
            try {
                doc = await apiClient.get(`documents/${res.resource_id}`);
            } catch {
                doc = null;
            }

            if (!doc) {
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
            let recording: any = null;
            try {
                recording = await apiClient.get(`class-recordings/${res.resource_id}`);
            } catch {
                recording = null;
            }

            if (!recording) {
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
            let messages: any[] = [];
            try {
                messages = await apiClient.get('social/chat-messages', { ids: ids.join(',') });
            } catch {
                messages = [];
            }

            if (!messages || messages.length === 0) return;

            const messageIds = messages.map(m => m.id);

            const [allMedia, allBasicResources] = await Promise.all([
                apiClient.get('social/chat-message-media', { message_id: messageIds.join(',') }).catch(() => []),
                apiClient.get('social/chat-message-resources', { message_id: messageIds.join(',') }).catch(() => []),
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
            await apiClient.rpc('mark_session_messages_read', {
                p_session_id: sessionId,
                p_user_id: currentUserId,
            });

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
            await apiClient.patch(`social/chat-messages/${messageId}`, {
                content: newContent.trim(),
                is_edited: true,
                updated_at: new Date().toISOString(),
            });

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
        if (!currentUserId) return;

        // Track message writes for all sessions to keep the chat list + unread status current.
        // This supports toast/notification-driven updates in the UI without manual refresh.
        if (allMessagesChannelRef.current) {
            supabase.removeChannel(allMessagesChannelRef.current);
            allMessagesChannelRef.current = null;
        }

        const activeSessionFilter = chatSessions.map(s => s.id).filter(Boolean).join(',');
        if (!activeSessionFilter) return;

        allMessagesChannelRef.current = supabase
            .channel(`user_chat_messages_all_${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'social_chat_messages',
                    filter: `session_id=in.(${activeSessionFilter})`,
                },
                (payload) => {
                    // if we are currently viewing the active session, rely on active session listener to process content
                    if (payload.new.session_id !== activeSessionId) {
                        fetchChatSessions().catch(() => { });
                    } else {
                        fetchChatSessions().catch(() => { });
                    }
                }
            )
            .subscribe();

        return () => {
            if (allMessagesChannelRef.current) {
                supabase.removeChannel(allMessagesChannelRef.current);
                allMessagesChannelRef.current = null;
            }
        };
    }, [currentUserId, chatSessions, activeSessionId, fetchChatSessions]);

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

                    // Keep the session list in sync while the user is in your app
                    fetchChatSessions().catch(() => {
                        // swallow any edge fetch error to avoid silent effect breakage
                    });
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

    useEffect(() => {
        if (!currentUserId) return;

        const peerIds = new Set<string>();
        chatSessions.forEach(session => {
            if (session.chat_type !== 'p2p') return;
            const other = session.user_id1 === currentUserId ? session.user2 : session.user1;
            if (other?.id) peerIds.add(other.id);
        });

        if (peerIds.size === 0) return;

        const peerIdsList = Array.from(peerIds).join(',');
        const presenceChannel = supabase
            .channel(`user_presence_${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'social_users',
                    filter: `id=in.(${peerIdsList})`,
                },
                (payload) => {
                    const userUpdate = payload.new;

                    setChatSessions(prev =>
                        prev.map(session => {
                            if (session.chat_type !== 'p2p') return session;
                            const isFirst = session.user_id1 === currentUserId;
                            const targetUser = isFirst ? session.user2 : session.user1;
                            if (!targetUser || targetUser.id !== userUpdate.id) return session;

                            const updatedSession = {
                                ...session,
                                ...(isFirst ? { user2: { ...targetUser, ...userUpdate } } : { user1: { ...targetUser, ...userUpdate } })
                            };
                            return updatedSession;
                        })
                    );

                    setActiveSessionMessages(prev =>
                        prev.map(msg =>
                            msg.sender?.id === userUpdate.id
                                ? { ...msg, sender: { ...msg.sender, ...userUpdate } }
                                : msg
                        )
                    );
                }
            )
            .subscribe();

        return () => {
            if (presenceChannel) {
                supabase.removeChannel(presenceChannel);
            }
        };
    }, [currentUserId, chatSessions]);

    const fetchFullMessage = async (messageId: string): Promise<ChatMessageWithDetails | null> => {
        try {
            let msg: any = null;
            try {
                msg = await apiClient.get('social/chat-messages', { id: messageId });
            } catch {
                msg = null;
            }

            if (!msg) return null;

            const [media, resources] = await Promise.all([
                apiClient.get('social/chat-message-media', { message_id: messageId }).catch(() => []),
                apiClient.get('social/chat-message-resources', { message_id: messageId }).catch(() => []),
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
