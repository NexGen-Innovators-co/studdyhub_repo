import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz } from '../types/Class'; // Import Quiz
import { Document, UserProfile } from '../types/Document';
import { generateId } from '../utils/helpers';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UseAppOperationsProps {
  notes: Note[];
  recordings: ClassRecording[];
  scheduleItems: ScheduleItem[];
  chatMessages: Message[];
  documents: Document[];
  userProfile: UserProfile | null;
  activeNote: Note | null;
  setNotes: (notes: Note[] | ((prev: Note[]) => Note[])) => void;
  setRecordings: (recordings: ClassRecording[] | ((prev: ClassRecording[]) => ClassRecording[])) => void;
  setScheduleItems: (items: ScheduleItem[] | ((prev: ScheduleItem[]) => ScheduleItem[])) => void;
  setChatMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setDocuments: (documents: Document[] | ((prev: Document[]) => Document[])) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setActiveNote: (note: Note | null) => void;
  setActiveTab: (tab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings') => void;
  setIsAILoading: (loading: boolean) => void;
}

export const useAppOperations = ({
  notes,
  recordings,
  userProfile,
  activeNote,
  setNotes,
  setRecordings,
  setScheduleItems,
  setChatMessages,
  setDocuments, // Destructure setDocuments
  setUserProfile,
  setActiveNote,
  setActiveTab,
  setIsAILoading,
}: UseAppOperationsProps) => {

  const createNewNote = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const newNote = {
        title: 'Untitled Note',
        content: '',
        category: 'general' as const,
        tags: [],
        user_id: user.id,
        ai_summary: ''
      };

      const { data, error } = await supabase
        .from('notes')
        .insert(newNote)
        .select()
        .single();

      if (error) throw error;

      const formattedNote: Note = {
        id: data.id,
        title: data.title,
        content: data.content || '',
        category: data.category || 'general',
        tags: data.tags || [],
        createdAt: new Date(data.created_at || Date.now()),
        updatedAt: new Date(data.updated_at || Date.now()),
        aiSummary: data.ai_summary || '',
        document_id: ''
      };

      setNotes(prev => [formattedNote, ...prev]);
      setActiveNote(formattedNote);
      setActiveTab('notes');
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Failed to create note');
    }
  };

  const updateNote = async (updatedNote: Note) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notes')
        .update({
          title: updatedNote.title,
          content: updatedNote.content,
          category: updatedNote.category,
          tags: updatedNote.tags,
          ai_summary: updatedNote.aiSummary,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedNote.id)
        .eq('user_id', user.id);

      if (error) throw error;

      const noteWithUpdatedTime = {
        ...updatedNote,
        updatedAt: new Date()
      };

      setNotes(prev =>
        prev.map(note =>
          note.id === updatedNote.id ? noteWithUpdatedTime : note
        )
      );
      setActiveNote(noteWithUpdatedTime);
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotes(prev => prev.filter(note => note.id !== noteId));
      if (activeNote?.id === noteId) {
        const remainingNotes = notes.filter(note => note.id !== noteId);
        setActiveNote(remainingNotes.length > 0 ? remainingNotes[0] : null);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const addRecording = useCallback(async (recording: ClassRecording) => {
    try {
      // Recording is already inserted by ClassRecordings.tsx; only update local state
      setRecordings(prev => [recording, ...prev]);
    } catch (error) {
      console.error('Error adding recording to state:', error);
      toast.error('Failed to update recordings state');
    }
  }, [setRecordings]);

  const updateRecording = useCallback(async (updatedRecording: ClassRecording) => {
    try {
      setRecordings(prev =>
        prev.map(rec => (rec.id === updatedRecording.id ? updatedRecording : rec))
      );
    } catch (error) {
      console.error('Error updating recording in state:', error);
      toast.error('Failed to update recording state');
    }
  }, [setRecordings]);

  // NEW: Delete Recording Function
  const deleteRecording = useCallback(async (recordingId: string, documentId: string | null, audioUrl: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Delete from class_recordings table
      const { error: recordingError } = await supabase
        .from('class_recordings')
        .delete()
        .eq('id', recordingId)
        .eq('user_id', user.id);

      if (recordingError) throw new Error(`Failed to delete recording from database: ${recordingError.message}`);

      // 2. Delete from documents table if a document_id is linked
      if (documentId) {
        const { error: documentError } = await supabase
          .from('documents')
          .delete()
          .eq('id', documentId)
          .eq('user_id', user.id);

        if (documentError) console.error(`Failed to delete linked document ${documentId}: ${documentError.message}`);
      }

      // 3. Delete audio file from storage if audioUrl is present
      if (audioUrl) {
        const filePath = audioUrl.split('/public/documents/')[1]; // Extract path from public URL
        if (filePath) {
          const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([filePath]);

          if (storageError) console.error(`Failed to delete audio file from storage: ${storageError.message}`);
        }
      }

      setRecordings(prev => prev.filter(rec => rec.id !== recordingId));
      toast.success('Recording deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting recording:', error);
      toast.error(`Failed to delete recording: ${error.message || 'Unknown error'}`);
    }
  }, [setRecordings]);


  const generateQuiz = async (recording: ClassRecording, quiz: Quiz) => {
    try {
      // Quiz is already inserted by useQuizManagement; only update local state
      // No direct action needed here, as the quiz is managed within the ClassRecordings component's state
      // and the recording itself is updated via onUpdateRecording if needed.
      // This function is kept for consistency with the prop signature, but its body is empty.
    } catch (error) {
      console.error('Error generating quiz (operation hook):', error);
      toast.error('Failed to generate quiz (operation hook)');
    }
  };

  const addScheduleItem = async (item: ScheduleItem) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('schedule_items')
        .insert({
          title: item.title,
          subject: item.subject,
          start_time: typeof item.startTime === 'string' ? item.startTime : item.startTime,
          end_time: typeof item.endTime === 'string' ? item.endTime : item.endTime,
          type: item.type,
          description: item.description,
          location: item.location,
          color: item.color,
          user_id: user.id
        });

      if (error) throw error;

      setScheduleItems(prev => [...prev, item]);
    } catch (error) {
      console.error('Error adding schedule item:', error);
      toast.error('Failed to add schedule item');
    }
  };

  const updateScheduleItem = async (item: ScheduleItem) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('schedule_items')
        .update({
          title: item.title,
          subject: item.subject,
          start_time: typeof item.startTime === 'string' ? item.startTime : item.startTime,
          end_time: typeof item.endTime === 'string' ? item.endTime : item.endTime,
          type: item.type,
          description: item.description,
          location: item.location,
          color: item.color
        })
        .eq('id', item.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setScheduleItems(prev => prev.map(i => i.id === item.id ? item : i));
    } catch (error) {
      console.error('Error updating schedule item:', error);
      toast.error('Failed to update schedule item');
    }
  };

  const deleteScheduleItem = async (id: string) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('schedule_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setScheduleItems(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting schedule item:', error);
      toast.error('Failed to delete schedule item');
    }
  };

  // Updated sendChatMessage to only insert into DB, relying on real-time listener for state update
  const sendChatMessage = async (
    messageContent: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    imageUrl?: string, // New: imageUrl for storage
    imageMimeType?: string, // New: imageMimeType for storage
  ) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const userMessageId = generateId(); // Generate ID for the user message

      // Insert the user message with attached IDs into the database
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          id: userMessageId, // Use the generated ID
          content: messageContent,
          role: 'user',
          timestamp: new Date().toISOString(),
          user_id: user.id,
          attached_document_ids: attachedDocumentIds || [],
          attached_note_ids: attachedNoteIds || [],
          image_url: imageUrl || null, // Store image URL
          image_mime_type: imageMimeType || null, // Store image MIME type
        });

      if (insertError) {
        console.error('Error inserting user message into DB:', insertError);
        throw insertError;
      }
      toast.success('Message sent!');

      // NO LONGER SETTING LOCAL STATE HERE.
      // The real-time listener in useAppData will pick up this insert and update the state.

      // The AI response generation is assumed to be handled by a backend function
      // (e.g., a Supabase Edge Function triggered by the 'chat_messages' insert).
      // This backend function will read the message, its attached IDs, fetch content,
      // call the LLM, and then insert the AI's response into 'chat_messages'.
      // The real-time listener in useAppData will then pick up the AI's response.

    } catch (error) {
      toast.error('Failed to send message.');
      console.error('Error in sendChatMessage:', error);
      // If the initial insert of the user message fails, we need to handle it.
      // The UI will not show the user message if it's not inserted into DB and picked up by listener.
      // For now, rely on the toast for feedback.
    } finally {
      // setIsAILoading(false); // This should be managed by Index.tsx based on AI response status
    }
  };


  const handleDocumentUploaded = async (document: Document) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('documents')
        .insert({
          title: document.title,
          file_name: document.file_name,
          file_type: document.file_type,
          file_size: document.file_size,
          file_url: document.file_url,
          content_extracted: document.content_extracted,
          user_id: user.id,
          type: document.type,
          processing_status: document.processing_status as string,
          processing_error: document.processing_error as string,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          id: document.id || generateId() // Ensure ID is set
        });

      if (error) throw error;

      setDocuments(prev => [document, ...prev]);
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Failed to save document');
    }
  };

  // NEW: Function to update a document in the local state
  const updateDocument = useCallback((updatedDocument: Document) => {
    setDocuments(prev =>
      prev.map(doc => (doc.id === updatedDocument.id ? updatedDocument : doc))
    );
  }, [setDocuments]);

  const handleDocumentDeleted = async (documentId: string) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) throw error;

      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleProfileUpdate = async (profile: UserProfile) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          learning_style: profile.learning_style,
          learning_preferences: profile.learning_preferences,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setUserProfile({ ...profile, updated_at: new Date() });
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  return {
    createNewNote,
    updateNote,
    deleteNote,
    addRecording,
    updateRecording, // Expose new updateRecording
    deleteRecording, // NEW: Expose deleteRecording
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    sendChatMessage, // Updated function
    handleDocumentUploaded,
    updateDocument, // EXPOSE NEW FUNCTION
    handleDocumentDeleted,
    handleProfileUpdate,
  };
};
