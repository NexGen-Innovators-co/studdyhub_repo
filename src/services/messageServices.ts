// services/messageServices.ts
import { supabase } from '../integrations/supabase/client';
import { Message } from '../types/Class';
import { generateId } from '../components/classRecordings/utils/helpers';

export interface ProcessedFile {
  name: string;
  mimeType: string;
  data: string | null;
  type: 'image' | 'document' | 'other';
  size: number;
  content: string | null;
  processing_status: string;
  processing_error: string | null;
}

export const insertUserMessage = async (
  messageContent: string,
  userId: string,
  sessionId: string,
  attachedDocumentIds?: string[],
  attachedNoteIds?: string[],
  attachedFiles?: ProcessedFile[]
): Promise<Message> => {
  try {
    const userMessage = {
      id: generateId(),
      content: messageContent,
      role: 'user' as const,
      session_id: sessionId,
      user_id: userId,
      timestamp: new Date().toISOString(),
      has_been_displayed: true,
      attached_document_ids: attachedDocumentIds || [],
      attached_note_ids: attachedNoteIds || [],
      is_error: false
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(userMessage)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      content: data.content,
      role: data.role,
      timestamp: data.timestamp || new Date().toISOString(),
      session_id: data.session_id || sessionId,
      has_been_displayed: data.has_been_displayed,
      attachedDocumentIds: data.attached_document_ids || [],
      attachedNoteIds: data.attached_note_ids || [],
      attachedFiles: attachedFiles || [],
      isError: false
    };
  } catch (error) {
    console.error('Error inserting user message:', error);
    throw new Error('Failed to save user message');
  }
};

export const requestAIResponse = async (
  userMessage: Message,
  userProfile: any,
  learningStyle: string,
  learningPreferences: any
): Promise<void> => {
  try {
    // Send to AI chat edge function which will handle AI response and DB insertion
    const { error } = await supabase.functions.invoke('gemini-chat', {
      body: {
        message: userMessage.content,
        sessionId: userMessage.session_id,
        attachedDocumentIds: userMessage.attachedDocumentIds || [],
        attachedNoteIds: userMessage.attachedNoteIds || [],
        attachedFiles: userMessage.attachedFiles || [],
        userProfile,
        learningStyle,
        learningPreferences,
        userMessageId: userMessage.id // Pass the user message ID for reference
      }
    });

    if (error) {
      console.error('AI chat error:', error);
      throw new Error(error.message || 'AI response failed');
    }
  } catch (error) {
    console.error('Error requesting AI response:', error);
    throw error;
  }
};