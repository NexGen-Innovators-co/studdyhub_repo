import { useCallback } from 'react';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { generateId } from '../components/classRecordings/utils/helpers';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { CreateFolderInput, DocumentFolder, UpdateFolderInput } from '@/types/Folder';
import { PlanType, SubscriptionLimits } from './useSubscription';
import { useNavigate } from 'react-router-dom';

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
  isRealtimeConnected?: boolean;
  refreshData?: () => void;
  folders: DocumentFolder[];
  setFolders: (folders: DocumentFolder[] | ((prev: DocumentFolder[]) => DocumentFolder[])) => void;
  // Add subscription props
  subscriptionTier: PlanType;
  subscriptionLimits: SubscriptionLimits;
  checkSubscriptionAccess: (feature: keyof SubscriptionLimits) => boolean;
  refreshSubscription: () => Promise<void>;
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
  setDocuments,
  setUserProfile,
  setActiveNote,
  setActiveTab,
  setIsAILoading,
  isRealtimeConnected = false,
  refreshData = () => { },
  subscriptionTier,
  subscriptionLimits,
  checkSubscriptionAccess,
  refreshSubscription,
}: UseAppOperationsProps) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  const withRetry = async <T extends any[]>(
    operation: (...args: T) => Promise<void>,
    ...args: T
  ) => {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        await operation(...args);
        return;
      } catch (error) {
        attempt++;
        if (attempt >= MAX_RETRIES) throw error;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  };
  const navigate = useNavigate()
  const createNewNote = useCallback(async () => {
    try {
      // Check if user can create more notes
      if (!checkSubscriptionAccess('maxNotes')) {
        const noteCount = notes.length;
        if (noteCount >= subscriptionLimits.maxNotes) {
          toast.error(`Note limit reached (${subscriptionLimits.maxNotes}). Upgrade to create more notes.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            }
          });
          return;
        }
      }

      await withRetry(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const newNote = {
          title: 'Untitled Note',
          content: '',
          category: 'general',
          tags: [] as string[],
          user_id: user.id,
          ai_summary: ''
        };

        const { data, error } = await supabase
          .from('notes')
          .insert(newNote)
          .select()
          .single();

        if (error) throw error;

        if (!isRealtimeConnected) {
          const formattedNote: Note = {
            id: data.id,
            title: data.title,
            content: data.content || '',
            category: data.category || 'general',
            tags: data.tags || [],
            created_at: data.created_at,
            updated_at: data.updated_at,
            ai_summary: data.ai_summary || '',
            document_id: data.document_id || null,
            user_id: data.user_id
          };
          setNotes(prev => [formattedNote, ...prev]);
          setActiveNote(formattedNote);
        }

        setActiveTab('notes');
      });
    } catch (error) {
      //console.error('Error creating note:', error);
      toast.error('Failed to create note after multiple attempts');
      if (!isRealtimeConnected) refreshData();
    }
  }, [isRealtimeConnected, refreshData, setActiveNote, setActiveTab, setNotes, navigate]);

  const updateNote = useCallback(async (updatedNote: Note) => {
    try {
      if (!updatedNote.id) {
        throw new Error('Note ID is required for update');
      }

      await withRetry(async () => {
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
          .from('notes')
          .update({
            title: updatedNote.title,
            content: updatedNote.content,
            category: updatedNote.category,
            tags: updatedNote.tags,
            ai_summary: updatedNote.ai_summary,
            updated_at: new Date().toISOString()
          })
          .eq('id', updatedNote.id)
          .eq('user_id', user.id);

        if (error) throw error;

        if (!isRealtimeConnected) {
          const noteWithUpdatedTime = {
            ...updatedNote,
            updated_at: new Date().toISOString()
          };
          setNotes(prev =>
            prev.map(note =>
              note.id === updatedNote.id ? noteWithUpdatedTime : note
            )
          );
          setActiveNote(noteWithUpdatedTime);
        }
      });
    } catch (error) {
      //console.error('Error updating note:', error);
      toast.error('Failed to update note after multiple attempts');
      if (!isRealtimeConnected) refreshData();
    }
  }, [isRealtimeConnected, refreshData, setActiveNote, setNotes]);

  const deleteNote = useCallback(async (noteId: string) => {
    try {
      await withRetry(async () => {
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId)
          .eq('user_id', user.id);

        if (error) throw error;

        if (!isRealtimeConnected) {
          setNotes(prev => prev.filter(note => note.id !== noteId));
          if (activeNote?.id === noteId) {
            const remainingNotes = notes.filter(note => note.id !== noteId);
            setActiveNote(remainingNotes.length > 0 ? remainingNotes[0] : null);
          }
        }
      });
    } catch (error) {
      //console.error('Error deleting note:', error);
      toast.error('Failed to delete note after multiple attempts');
      if (!isRealtimeConnected) refreshData();
    }
  }, [activeNote, isRealtimeConnected, notes, refreshData, setActiveNote, setNotes]);

  const addRecording = useCallback(async (recording: ClassRecording) => {
    try {
      await withRetry(async () => {
        setRecordings(prev => [recording, ...prev]);
      });
    } catch (error) {
      //console.error('Error adding recording to state:', error);
      toast.error('Failed to update recordings state');
    }
  }, [setRecordings]);

  const updateRecording = useCallback(async (updatedRecording: ClassRecording) => {
    try {
      await withRetry(async () => {
        setRecordings(prev =>
          prev.map(rec => (rec.id === updatedRecording.id ? updatedRecording : rec))
        );
      });
    } catch (error) {
      //console.error('Error updating recording in state:', error);
      toast.error('Failed to update recording state');
    }
  }, [setRecordings]);

  const deleteRecording = useCallback(async (
    recordingId: string,
    documentId: string | null,
    audioUrl: string | null
  ) => {
    try {
      await withRetry(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // 1. Delete recording
        const { error: recordingError } = await supabase
          .from('class_recordings')
          .delete()
          .eq('id', recordingId)
          .eq('user_id', user.id);

        if (recordingError) throw recordingError;

        // 2. Delete linked document if exists
        if (documentId) {
          const { error: documentError } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId)
            .eq('user_id', user.id);

          // if (documentError) 
        }

        // 3. Delete audio file if exists
        if (audioUrl) {
          const filePath = audioUrl.split('/public/documents/')[1];
          if (filePath) {
            const { error: storageError } = await supabase.storage
              .from('documents')
              .remove([filePath]);

            // if (storageError) 
          }
        }

        if (!isRealtimeConnected) {
          setRecordings(prev => prev.filter(rec => rec.id !== recordingId));
        }
      });
    } catch (error: any) {
      //console.error('Error deleting recording:', error);
      toast.error(`Failed to delete recording: ${error.message || 'Unknown error'}`);
      if (!isRealtimeConnected) refreshData();
    }
  }, [isRealtimeConnected, refreshData, setRecordings]);
  const createFolder = useCallback(async (input: CreateFolderInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('document_folders')
        .insert({
          user_id: user.id,
          name: input.name,
          parent_folder_id: input.parent_folder_id || null,
          color: input.color || '#3B82F6',
          description: input.description || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Folder "${input.name}" created successfully`);
      return data;
    } catch (error: any) {
      //console.error('Error creating folder:', error);
      toast.error(`Failed to create folder: ${error.message}`);
      return null;
    }
  }, []);

  const updateFolder = useCallback(async (folderId: string, input: UpdateFolderInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('document_folders')
        .update(input)
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Folder updated successfully');
      return true;
    } catch (error: any) {
      //console.error('Error updating folder:', error);
      toast.error(`Failed to update folder: ${error.message}`);
      return false;
    }
  }, []);

  const deleteFolder = useCallback(async (folderId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('document_folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Folder deleted successfully');
      return true;
    } catch (error: any) {
      //console.error('Error deleting folder:', error);
      toast.error(`Failed to delete folder: ${error.message}`);
      return false;
    }
  }, []);

  const addDocumentToFolder = useCallback(async (documentId: string, folderId: string) => {
    try {
      const { error } = await supabase
        .from('document_folder_items')
        .insert({ folder_id: folderId, document_id: documentId });

      if (error) throw error;

      toast.success('Document added to folder');
      return true;
    } catch (error: any) {
      //console.error('Error adding document to folder:', error);
      toast.error(`Failed to add document to folder: ${error.message}`);
      return false;
    }
  }, []);

  const removeDocumentFromFolder = useCallback(async (documentId: string, folderId: string) => {
    try {
      const { error } = await supabase
        .from('document_folder_items')
        .delete()
        .eq('folder_id', folderId)
        .eq('document_id', documentId);

      if (error) throw error;

      toast.success('Document removed from folder');
      return true;
    } catch (error: any) {
      //console.error('Error removing document from folder:', error);
      toast.error(`Failed to remove document from folder: ${error.message}`);
      return false;
    }
  }, []);
  // const addRecording = useCallback(async (recording: ClassRecording) => {
  //   try {
  //     // Recording is already inserted by ClassRecordings.tsx; only update local state
  //     setRecordings(prev => [recording, ...prev]);
  //   } catch (error) {
  //     //console.error('Error adding recording to state:', error);
  //     toast.error('Failed to update recordings state');
  //   }
  // }, [setRecordings]);

  // const updateRecording = useCallback(async (updatedRecording: ClassRecording) => {
  //   try {
  //     setRecordings(prev =>
  //       prev.map(rec => (rec.id === updatedRecording.id ? updatedRecording : rec))
  //     );
  //   } catch (error) {
  //     //console.error('Error updating recording in state:', error);
  //     toast.error('Failed to update recording state');
  //   }
  // }, [setRecordings]);

  // // NEW: Delete Recording Function
  // const deleteRecording = useCallback(async (recordingId: string, documentId: string | null, audioUrl: string | null) => {
  //   try {
  //     const { data: { user } } = await supabase.auth.getUser();
  //     if (!user) throw new Error('Not authenticated');

  //     // 1. Delete from class_recordings table
  //     const { error: recordingError } = await supabase
  //       .from('class_recordings')
  //       .delete()
  //       .eq('id', recordingId)
  //       .eq('user_id', user.id);

  //     if (recordingError) throw new Error(`Failed to delete recording from database: ${recordingError.message}`);

  //     // 2. Delete from documents table if a document_id is linked
  //     if (documentId) {
  //       const { error: documentError } = await supabase
  //         .from('documents')
  //         .delete()
  //         .eq('id', documentId)
  //         .eq('user_id', user.id);

  //       if (documentError) //console.error(`Failed to delete linked document ${documentId}: ${documentError.message}`);
  //     }

  //     // 3. Delete audio file from storage if audioUrl is present
  //     if (audioUrl) {
  //       const filePath = audioUrl.split('/public/documents/')[1]; // Extract path from public URL
  //       if (filePath) {
  //         const { error: storageError } = await supabase.storage
  //           .from('documents')
  //           .remove([filePath]);

  //         if (storageError) //console.error(`Failed to delete audio file from storage: ${storageError.message}`);
  //       }
  //     }

  //     setRecordings(prev => prev.filter(rec => rec.id !== recordingId));
  //     toast.success('Recording deleted successfully!');
  //   } catch (error: any) {
  //     //console.error('Error deleting recording:', error);
  //     toast.error(`Failed to delete recording: ${error.message || 'Unknown error'}`);
  //   }
  // }, [setRecordings]);


  const generateQuiz = async (recording: ClassRecording, quiz: Quiz) => {
    try {
      // Quiz is already inserted by useQuizManagement; only update local state
      // No direct action needed here, as the quiz is managed within the ClassRecordings component's state
      // and the recording itself is updated via onUpdateRecording if needed.
      // This function is kept for consistency with the prop signature, but its body is empty.
    } catch (error) {
      //console.error('Error generating quiz (operation hook):', error);
      toast.error('Failed to generate quiz (operation hook)');
    }
  };

  const addScheduleItem = useCallback(async (item: ScheduleItem) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('schedule_items')
        .insert({
          title: item.title,
          subject: item.subject,
          start_time: item.startTime,
          end_time: item.endTime,
          type: item.type,
          description: item.description,
          location: item.location,
          color: item.color,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Create the complete schedule item with the returned data
      const newScheduleItem: ScheduleItem = {
        id: data.id,
        title: data.title,
        subject: data.subject,
        startTime: data.start_time,
        endTime: data.end_time,
        type: data.type,
        description: data.description,
        location: data.location,
        color: data.color,
        userId: data.user_id,
        created_at: data.created_at
      };

      setScheduleItems(prev => [...prev, newScheduleItem]);
      toast.success('Schedule item added successfully');
    } catch (error) {
      //console.error('Error adding schedule item:', error);
      toast.error('Failed to add schedule item');
    }
  }, [setScheduleItems]);

  const updateScheduleItem = useCallback(async (item: ScheduleItem) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('schedule_items')
        .update({
          title: item.title,
          subject: item.subject,
          start_time: item.startTime,
          end_time: item.endTime,
          type: item.type,
          description: item.description,
          location: item.location,
          color: item.color
        })
        .eq('id', item.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setScheduleItems(prev => prev.map(i => i.id === item.id ? item : i));
      toast.success('Schedule item updated successfully');
    } catch (error) {
      //console.error('Error updating schedule item:', error);
      toast.error('Failed to update schedule item');
    }
  }, [setScheduleItems]);

  const deleteScheduleItem = useCallback(async (id: string) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('schedule_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setScheduleItems(prev => prev.filter(i => i.id !== id));
      toast.success('Schedule item deleted successfully');
    } catch (error) {
      //console.error('Error deleting schedule item:', error);
      toast.error('Failed to delete schedule item');
    }
  }, [setScheduleItems]);
  const sendChatMessage = useCallback(async (
    messageContent: string,
    session_id?: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    imageUrl?: string,
    imageMimeType?: string
  ) => {
    try {
      // Check AI message limit for free users
      if (subscriptionTier === 'free') {
        // You might want to track daily AI messages
        // For now, we'll just check the limit
        if (subscriptionLimits.maxAiMessages !== Infinity) {
          // You should implement daily message tracking here
          toast.info(`Free users get ${subscriptionLimits.maxAiMessages} AI messages per day.`);
        }
      }
      await withRetry(async () => {
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const userMessageId = generateId();

        const { error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            id: userMessageId,
            content: messageContent,
            role: 'user',
            timestamp: new Date().toISOString(),
            user_id: user.id,
            attached_document_ids: attachedDocumentIds || [],
            attached_note_ids: attachedNoteIds || [],
            image_url: imageUrl || null,
            image_mime_type: imageMimeType || null,
            session_id: session_id || null,
            has_been_displayed: false,
          });

        if (insertError) throw insertError;

        if (!isRealtimeConnected) {
          const newMessage: Message = {
            id: userMessageId,
            content: messageContent,
            role: 'user',
            timestamp: new Date().toISOString(),
            isError: false,
            attachedDocumentIds: attachedDocumentIds || [],
            attachedNoteIds: attachedNoteIds || [],
            image_url: imageUrl,
            image_mime_type: imageMimeType,
            session_id: session_id,
            has_been_displayed: false,
          };
          setChatMessages(prev => [...prev, newMessage]);
        }

        toast.success('Message sent!');
      });
    } catch (error) {
      toast.error('Failed to send message after multiple attempts');
      //console.error('Error in sendChatMessage:', error);
      if (!isRealtimeConnected) refreshData();
    }
  }, [isRealtimeConnected, refreshData, setChatMessages]);

  const handleDocumentUploaded = async (document: Document) => {
    try {
      // Check if user can upload more documents
      if (!checkSubscriptionAccess('maxDocUploads')) return

      // Check file size limit
      const fileSizeMB = (document.file_size || 0) / (1024 * 1024);
      if (fileSizeMB > subscriptionLimits.maxDocSize) {
        toast.error(`File too large (${fileSizeMB.toFixed(1)}MB). Maximum allowed: ${subscriptionLimits.maxDocSize}MB.`, {
          action: {
            label: 'Upgrade',
            onClick: () => navigate('/subscription')
          }
        });
        return;
      }

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
      //console.error('Error saving document:', error);
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
      //console.error('Error deleting document:', error);
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
      //console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  return {
    createNewNote,
    updateNote,
    deleteNote,
    addRecording,
    updateRecording,
    deleteRecording,
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    sendChatMessage,
    handleDocumentUploaded,
    updateDocument,
    handleDocumentDeleted,
    handleProfileUpdate,
    createFolder,
    updateFolder,
    deleteFolder,
    addDocumentToFolder,
    removeDocumentFromFolder,
  };
};
