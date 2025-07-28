import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message } from '../types/Class';
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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

  const addRecording = async (recording: ClassRecording) => {
    try {
      // Recording is already inserted by ClassRecordings.tsx; only update local state
      setRecordings(prev => [recording, ...prev]);
    } catch (error) {
      console.error('Error adding recording to state:', error);
      toast.error('Failed to update recordings state');
    }
  };

  const generateQuiz = async (classId: string) => {
    const recording = recordings.find(r => r.id === classId);
    if (!recording) return;

    try {
      toast.success(`Generating quiz for "${recording.title}"...`);

      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          title: recording.title,
          subject: recording.subject,
          transcript: recording.transcript,
          summary: recording.summary
        }
      });

      if (error) {
        throw new Error('Failed to generate quiz');
      }

      toast.success('Quiz generated! Check your notes section.');
    } catch (error) {
      toast.error('Failed to generate quiz');
      console.error('Error generating quiz:', error);
    }
  };

  const addScheduleItem = async (item: ScheduleItem) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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

  // Updated sendChatMessage to accept attached document and note IDs
  const sendChatMessage = async (
    messageContent: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[]
  ) => {
    const userMessage: Message = {
      id: generateId(),
      content: messageContent,
      role: 'user',
      timestamp: new Date().toISOString(),
      attachedDocumentIds: attachedDocumentIds || [], // Store attached document IDs
      attachedNoteIds: attachedNoteIds || [],       // Store attached note IDs
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsAILoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert the user message with attached IDs into the database
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          id: userMessage.id,
          content: userMessage.content,
          role: userMessage.role,
          timestamp: userMessage.timestamp,
          user_id: user.id,
          attached_document_ids: userMessage.attachedDocumentIds, // Save attached IDs
          attached_note_ids: userMessage.attachedNoteIds,         // Save attached IDs
        });

      if (insertError) throw insertError;

      // The AI response generation is assumed to be handled by a backend function
      // (e.g., a Supabase Edge Function triggered by the 'chat_messages' insert).
      // This backend function will read the message, its attached IDs, fetch content,
      // call the LLM, and then insert the AI's response into 'chat_messages'.

      // For now, we'll simulate a delay and then fetch recent messages.
      // In a real scenario, you'd listen for the AI's response being inserted.
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate backend processing time

      // Fetch the latest chat messages (including the AI's response if it's already generated)
      const { data: chatData, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true }) // Order ascending to get chronological order
        .limit(50); // Fetch a reasonable number of recent messages

      if (fetchError) throw fetchError;

      // Convert to local format and update state
      const messages: Message[] = chatData.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
        imageUrl: msg.imageUrl || undefined, // Assuming image_url might be stored for historical context
        imageMimeType: msg.imageMimeType || undefined,
        attachedDocumentIds: msg.attachedDocumentIds || [],
        attachedNoteIds: msg.attachedNoteIds || [],
      }));

      setChatMessages(messages);

    } catch (error) {
      toast.error('Failed to send message or get AI response');
      console.error('Error in sendChatMessage:', error);
      // Mark the user message as an error if the process fails
      setChatMessages(prev => prev.map(msg =>
        msg.id === userMessage.id ? { ...msg, isError: true } : msg
      ));
    } finally {
      setIsAILoading(false);
    }
  };

  const handleDocumentUploaded = async (document: Document) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
