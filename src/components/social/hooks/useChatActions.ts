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

            const { data: response, error } = await supabase.functions.invoke('create-chat-session', {
                body: { other_user_id: otherUserId },
            });

            if (error || !response?.success) {
                throw new Error('Failed to create chat session');
            }

            if (response.created) {
                toast.success('Chat session created');
            }

            return response.session_id;
        } catch (error) {
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

            // Upload files client-side first (requires File objects)
            const mediaItems: Array<{ type: string; url: string; filename: string; size_bytes: number; mime_type: string }> = [];
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

                    mediaItems.push({
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

            // Use edge function for sender fetch + message insert + media record creation
            const { data: response, error } = await supabase.functions.invoke('send-chat-message', {
                body: {
                    session_id: sessionId,
                    content,
                    media_items: mediaItems.length > 0 ? mediaItems : undefined,
                },
            });

            if (error || !response?.success) {
                throw new Error('Failed to send message');
            }

            return response.message as ChatMessageWithDetails;
        } catch (error) {
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
        resourceType: 'note' | 'document' | 'post' | 'class_recording'
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
                class_recording: 'Class Recording',
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
        resourceType: 'note' | 'document' | 'post' | 'class_recording'
    ): Promise<ChatMessageWithDetails | null> => {
        if (!currentUserId || !content.trim()) {
            return null;
        }

        try {
            setIsSending(true);

            // Use edge function for sender fetch + message insert + resource attach
            const { data: response, error } = await supabase.functions.invoke('send-chat-message', {
                body: {
                    session_id: sessionId,
                    content,
                    resource: { resource_id: resourceId, resource_type: resourceType },
                },
            });

            if (error || !response?.success) {
                throw new Error('Failed to send message');
            }

            return response.message as ChatMessageWithDetails;
        } catch (error) {
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