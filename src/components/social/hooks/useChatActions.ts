import { useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessageWithDetails } from '../types/social';

export const useChatActions = (currentUserId: string | null) => {
    const [isSending, setIsSending] = useState(false);
    const [isCreatingSession, setIsCreatingSession] = useState(false);

    // Create or get existing P2P chat session
    const createP2PChatSession = async (otherUserId: string): Promise<string | null> => {
        if (!currentUserId) {
            toast.error('You must be logged in to start a chat');
            return null;
        }

        try {
            setIsCreatingSession(true);

            const { data: existing, error: searchError } = await supabase
                .from('social_chat_sessions')
                .select('id')
                .eq('chat_type', 'p2p')
                .or(
                    `and(user_id1.eq.${currentUserId},user_id2.eq.${otherUserId}),and(user_id1.eq.${otherUserId},user_id2.eq.${currentUserId})`
                )
                .maybeSingle();

            if (searchError && searchError.code !== 'PGRST116') {
                throw searchError;
            }

            if (existing) {
                return existing.id;
            }

            const { data: newSession, error: createError } = await supabase
                .from('social_chat_sessions')
                .insert({
                    chat_type: 'p2p',
                    user_id1: currentUserId,
                    user_id2: otherUserId,
                })
                .select()
                .single();

            if (createError) throw createError;

            toast.success('Chat session created');
            return newSession.id;
        } catch (error) {
            ////console.error('Error creating chat session:', error);
            toast.error('Failed to create chat session');
            return null;
        } finally {
            setIsCreatingSession(false);
        }
    };

    // Send a chat message - NOW RETURNS THE CREATED MESSAGE
    const sendChatMessage = async (
        sessionId: string,
        content: string,
        files?: File[]
    ): Promise<ChatMessageWithDetails | null> => {
        if (!currentUserId || !content.trim()) {
            return null;
        }

        try {
            setIsSending(true);

            // Get current user info for optimistic update
            const { data: sender } = await supabase
                .from('social_users')
                .select('*')
                .eq('id', currentUserId)
                .single();

            if (!sender) throw new Error('Sender not found');

            // Insert message directly into social_chat_messages
            const { data: newMessage, error: messageError } = await supabase
                .from('social_chat_messages')
                .insert({
                    session_id: sessionId,
                    sender_id: currentUserId,
                    content: content.trim(),
                    group_id: null,
                })
                .select()
                .single();

            if (messageError) throw messageError;

            // Handle file uploads and create media records
            const mediaRecords = [];
            if (files && files.length > 0) {
                for (const file of files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('social-media')
                        .upload(fileName, file);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('social-media')
                        .getPublicUrl(fileName);

                    const { data: mediaRecord } = await supabase
                        .from('social_chat_message_media')
                        .insert({
                            message_id: newMessage.id,
                            type: file.type.startsWith('image/')
                                ? 'image'
                                : file.type.startsWith('video/')
                                    ? 'video'
                                    : 'document',
                            url: publicUrl,
                            filename: file.name,
                            size_bytes: file.size,
                            mime_type: file.type,
                        })
                        .select()
                        .single();

                    if (mediaRecord) mediaRecords.push(mediaRecord);
                }
            }

            // Return complete message with media
            return {
                ...newMessage,
                sender,
                media: mediaRecords,
                resources: [],
            };
        } catch (error) {
            ////console.error('Error sending message:', error);
            toast.error('Failed to send message');
            return null;
        } finally {
            setIsSending(false);
        }
    };

    // Share a resource
    const shareResource = async (
        messageId: string,
        resourceId: string,
        resourceType: 'note' | 'document' | 'post'
    ): Promise<boolean> => {
        if (!currentUserId) {
            toast.error('You must be logged in');
            return false;
        }

        try {
            const { error } = await supabase
                .from('social_chat_message_resources')
                .insert({
                    message_id: messageId,
                    resource_id: resourceId,
                    resource_type: resourceType,
                });

            if (error) throw error;

            const typeNames: Record<string, string> = {
                note: 'Note',
                document: 'Document',
                post: 'Post',
            };

            toast.success(`${typeNames[resourceType] || 'Resource'} shared`);
            return true;
        } catch (error) {
            ////console.error('Error sharing resource:', error);
            toast.error('Failed to share resource');
            return false;
        }
    };

    // Send message with shared resource - NOW RETURNS THE CREATED MESSAGE
    const sendMessageWithResource = async (
        sessionId: string,
        content: string,
        resourceId: string,
        resourceType: 'note' | 'document' | 'post'
    ): Promise<ChatMessageWithDetails | null> => {
        if (!currentUserId || !content.trim()) {
            return null;
        }

        try {
            setIsSending(true);

            // Get current user info
            const { data: sender } = await supabase
                .from('social_users')
                .select('*')
                .eq('id', currentUserId)
                .single();

            if (!sender) throw new Error('Sender not found');

            // Insert message
            const { data: newMessage, error: messageError } = await supabase
                .from('social_chat_messages')
                .insert({
                    session_id: sessionId,
                    sender_id: currentUserId,
                    content: content.trim(),
                    group_id: null,
                })
                .select()
                .single();

            if (messageError) throw messageError;

            // Share resource
            const { data: resourceRecord } = await supabase
                .from('social_chat_message_resources')
                .insert({
                    message_id: newMessage.id,
                    resource_id: resourceId,
                    resource_type: resourceType,
                })
                .select()
                .single();

            // Return complete message with resource
            return {
                ...newMessage,
                sender,
                media: [],
                resources: resourceRecord ? [resourceRecord] : [],
            };
        } catch (error) {
            ////console.error('Error sending message with resource:', error);
            toast.error('Failed to send message');
            return null;
        } finally {
            setIsSending(false);
        }
    };

    return {
        createP2PChatSession,
        sendChatMessage,
        shareResource,
        sendMessageWithResource,
        isSending,
        isCreatingSession,
    };
};