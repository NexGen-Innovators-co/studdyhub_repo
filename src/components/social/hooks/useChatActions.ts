// src/components/social/hooks/useChatActions.ts
import { useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';

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

            // Check if session already exists (in either direction)
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

            // Create new session
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
            console.error('Error creating chat session:', error);
            toast.error('Failed to create chat session');
            return null;
        } finally {
            setIsCreatingSession(false);
        }
    };

    // Send a chat message
    const sendChatMessage = async (
        sessionId: string,
        content: string,
        files?: File[]
    ): Promise<boolean> => {
        if (!currentUserId || !content.trim()) {
            return false;
        }

        try {
            setIsSending(true);

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

            // Upload files if any
            if (files && files.length > 0) {
                for (const file of files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('social-media')
                        .upload(fileName, file);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('social-media')
                        .getPublicUrl(fileName);

                    // Insert media record
                    await supabase.from('social_chat_message_media').insert({
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
                    });
                }
            }

            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
            return false;
        } finally {
            setIsSending(false);
        }
    };

    // Share a resource (note, document, or post) in chat
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

            let typeName;
            if (resourceType === 'note') typeName = 'Note';
            else if (resourceType === 'document') typeName = 'Document';
            else if (resourceType === 'post') typeName = 'Post';
            else typeName = 'Resource';

            toast.success(`${typeName} shared`);
            return true;
        } catch (error) {
            console.error('Error sharing resource:', error);
            toast.error('Failed to share resource');
            return false;
        }
    };

    // Send message with shared resource
    const sendMessageWithResource = async (
        sessionId: string,
        content: string,
        resourceId: string,
        resourceType: 'note' | 'document' | 'post'
    ): Promise<boolean> => {
        if (!currentUserId || !content.trim()) {
            return false;
        }

        try {
            setIsSending(true);

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
            await shareResource(newMessage.id, resourceId, resourceType);

            return true;
        } catch (error) {
            console.error('Error sending message with resource:', error);
            toast.error('Failed to send message');
            return false;
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