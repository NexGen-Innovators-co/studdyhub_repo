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
import { offlineStorage, STORES } from '@/utils/offlineStorage';
import { calendarIntegrationService } from '@/services/calendarIntegrationService';

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
  setQuizzes: (quizzes: Quiz[] | ((prev: Quiz[]) => Quiz[])) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setActiveNote: (note: Note | null) => void;
  setActiveTab: (tab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'dashboard' | 'social' | 'quizzes' | 'podcasts' | 'library') => void;
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
  isAdmin: boolean;
}

export const useAppOperations = ({
  notes,
  recordings,
  scheduleItems,
  documents,
  folders,
  userProfile,
  activeNote,
  setNotes,
  setRecordings,
  setScheduleItems,
  setChatMessages,
  setDocuments,
  setQuizzes,
  setUserProfile,
  setActiveNote,
  setActiveTab,
  setIsAILoading,
  isRealtimeConnected = false,
  refreshData = () => { },
  setFolders,
  subscriptionTier,
  subscriptionLimits,
  checkSubscriptionAccess,
  refreshSubscription,
  isAdmin,
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
      // Admins have unlimited access
      if (!isAdmin) {
        // Check subscription limit BEFORE attempting creation
        const noteCount = notes.length;
        const maxNotes = subscriptionLimits.maxNotes;

        // For free tier, strict limit checking
        if (subscriptionTier === 'free' && noteCount >= maxNotes) {
          toast.error(`Note limit reached (${maxNotes}). You have created ${noteCount} notes.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            },
            duration: 5000
          });
          return;
        }

        // For other tiers, check against their specific limits
        if (noteCount >= maxNotes && maxNotes !== Infinity) {
          toast.error(`Note limit reached (${maxNotes}). Upgrade to create more notes.`, {
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

        const newNoteData: Note = {
          id: crypto.randomUUID(), // Generate ID locally for offline support
          title: 'Untitled Note',
          content: '',
          category: 'general',
          tags: [] as string[],
          user_id: user.id,
          document_id: null,
          ai_summary: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // If offline, save locally
        if (!navigator.onLine) {
          await offlineStorage.save(STORES.NOTES, newNoteData);
          await offlineStorage.addPendingSync('create', 'notes', newNoteData);

          setNotes(prev => [newNoteData, ...prev]);
          setActiveNote(newNoteData);
          setActiveTab('notes');
          toast.info('Note created locally (offline)');
          return;
        }

        const { data, error } = await supabase
          .from('notes')
          .insert({
            title: newNoteData.title,
            content: newNoteData.content,
            category: newNoteData.category,
            tags: newNoteData.tags,
            user_id: newNoteData.user_id,
            ai_summary: newNoteData.ai_summary
          })
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

      // If offline, save to IndexedDB and add to pending sync
      if (!navigator.onLine) {
        const noteWithUpdatedTime = {
          ...updatedNote,
          updated_at: new Date().toISOString()
        };

        await offlineStorage.save(STORES.NOTES, noteWithUpdatedTime);
        await offlineStorage.addPendingSync('update', 'notes', noteWithUpdatedTime);

        setNotes(prev =>
          prev.map(note =>
            note.id === updatedNote.id ? noteWithUpdatedTime : note
          )
        );
        setActiveNote(noteWithUpdatedTime);
        toast.info('Note saved locally (offline)');
        return;
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
      // If offline, handle locally
      if (!navigator.onLine) {
        await offlineStorage.delete(STORES.NOTES, noteId);
        await offlineStorage.addPendingSync('delete', 'notes', { id: noteId });

        setNotes(prev => prev.filter(note => note.id !== noteId));
        if (activeNote?.id === noteId) {
          setActiveNote(null);
        }
        toast.info('Note deleted locally (offline)');
        return;
      }

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!navigator.onLine) {
        await offlineStorage.delete(STORES.RECORDINGS, recordingId);
        await offlineStorage.addPendingSync('delete', 'recordings', { id: recordingId });

        if (documentId) {
          await offlineStorage.delete(STORES.DOCUMENTS, documentId);
          await offlineStorage.addPendingSync('delete', 'documents', { id: documentId });
        }

        setRecordings(prev => prev.filter(rec => rec.id !== recordingId));
        toast.success('Recording deleted offline. Will sync when online.');
        return;
      }

      await withRetry(async () => {
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
      // Admins have unlimited access
      if (!isAdmin) {
        // Check folder creation limit BEFORE attempting creation
        const folderCount = folders.length;
        const maxFolders = subscriptionLimits.maxFolders;

        if (subscriptionTier === 'free' && folderCount >= maxFolders) {
          toast.error(`Folder limit reached (${maxFolders}). You have created ${folderCount} folders.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            },
            duration: 5000
          });
          return null;
        }

        if (folderCount >= maxFolders && maxFolders !== Infinity) {
          toast.error(`Folder limit reached (${maxFolders}). Upgrade to create more folders.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            }
          });
          return null;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!navigator.onLine) {
        const offlineFolder: DocumentFolder = {
          id: crypto.randomUUID(),
          user_id: user.id,
          name: input.name,
          parent_folder_id: input.parent_folder_id || null,
          color: input.color || '#3B82F6',
          description: input.description || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          isExpanded: false
        };
        await offlineStorage.save(STORES.FOLDERS, offlineFolder);
        await offlineStorage.addPendingSync('create', 'folders', offlineFolder);
        setFolders(prev => [offlineFolder, ...prev]);
        toast.success('Folder created offline. Will sync when online.');
        return offlineFolder;
      }

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

      if (!navigator.onLine) {
        const existingFolder = folders.find(f => f.id === folderId);
        if (existingFolder) {
          const updatedFolder = { ...existingFolder, ...input, updated_at: new Date().toISOString() };
          await offlineStorage.save(STORES.FOLDERS, updatedFolder);
          await offlineStorage.addPendingSync('update', 'folders', updatedFolder);
          setFolders(prev => prev.map(f => f.id === folderId ? updatedFolder : f));
          toast.success('Folder updated offline. Will sync when online.');
          return true;
        }
        return false;
      }

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

      if (!navigator.onLine) {
        await offlineStorage.delete(STORES.FOLDERS, folderId);
        await offlineStorage.addPendingSync('delete', 'folders', { id: folderId });
        setFolders(prev => prev.filter(f => f.id !== folderId));
        toast.success('Folder deleted offline. Will sync when online.');
        return true;
      }

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
      // Update local state with the new quiz
      setQuizzes(prev => {
        // Check if quiz already exists to avoid duplicates from realtime sync
        const existingIndex = prev.findIndex(q => q.id === quiz.id);
        if (existingIndex >= 0) {
          // Update existing quiz in place
          const updated = [...prev];
          updated[existingIndex] = quiz;
          return updated;
        }
        // Only add if quiz has a valid id
        if (!quiz.id) return prev;
        return [quiz, ...prev];
      });

      // If it's a recording-based quiz, we might want to update the recording's quiz count or similar
      // but for now, just adding to the quizzes list is enough for the history to update.
    } catch (error) {
      //console.error('Error generating quiz (operation hook):', error);
      toast.error('Failed to update quiz list');
    }
  };

  const addScheduleItem = useCallback(async (item: ScheduleItem) => {
    try {
      // Admins have unlimited access
      if (!isAdmin) {
        // Check schedule item limit BEFORE attempting creation
        const scheduleCount = scheduleItems?.length || 0;
        const maxScheduleItems = subscriptionLimits.maxScheduleItems;

        if (subscriptionTier === 'free' && scheduleCount >= maxScheduleItems) {
          toast.error(`Schedule limit reached (${maxScheduleItems}). You have ${scheduleCount} scheduled items.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            },
            duration: 5000
          });
          return;
        }

        if (scheduleCount >= maxScheduleItems && maxScheduleItems !== Infinity) {
          toast.error(`Schedule limit reached (${maxScheduleItems}). Upgrade to add more items.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            }
          });
          return;
        }
      }

      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!navigator.onLine) {
        const offlineItem: ScheduleItem = {
          ...item,
          id: item.id || crypto.randomUUID(),
          userId: user.id,
          created_at: new Date().toISOString()
        };
        await offlineStorage.save(STORES.SCHEDULE, offlineItem);
        await offlineStorage.addPendingSync('create', 'schedule', offlineItem);
        setScheduleItems(prev => [...prev, offlineItem]);
        toast.success('Schedule item added offline. Will sync when online.');
        return;
      }

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
          user_id: user.id,
          is_recurring: item.isRecurring,
          recurrence_pattern: item.recurrencePattern,
          recurrence_interval: item.recurrenceInterval,
          recurrence_days: item.recurrenceDays,
          recurrence_end_date: item.recurrenceEndDate
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
        created_at: data.created_at,
        isRecurring: data.is_recurring,
        recurrencePattern: data.recurrence_pattern as any,
        recurrenceInterval: data.recurrence_interval,
        recurrenceDays: data.recurrence_days,
        recurrenceEndDate: data.recurrence_end_date
      };

      // Create internal reminder if enabled
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        // Attempt to get preferences, but default to TRUE if they haven't set them yet
        // This ensures new users get reminders by default
        const { data: pref } = await supabase
          .from('notification_preferences')
          .select('schedule_reminders, reminder_time')
          .eq('user_id', currentUser?.id)
          .maybeSingle();

        const shouldSetReminder = pref ? pref.schedule_reminders : true;
        const reminderTime = pref?.reminder_time || 15;

        if (shouldSetReminder) {
          const { data: reminderData, error: reminderError } = await supabase
            .from('schedule_reminders')
            .insert({
              schedule_id: newScheduleItem.id,
              reminder_minutes: reminderTime,
              notification_sent: false
            })
            .select()
            .single();

          if (reminderError) {
            toast.error('Failed to create schedule reminder: ' + reminderError.message);
            //console.error('Failed to create schedule reminder:', reminderError);
          } else {
            toast.success('Schedule reminder created successfully!');
            //console.log('Schedule reminder insert result:', reminderData);
          }
        } else {
          toast('Schedule reminders are disabled in your preferences. No reminder created.');
        }
      } catch (remError) {
        toast.error('Unexpected error creating schedule reminder. See console for details.');
        //console.error('Failed to create reminder:', remError);
      }

      // Sync to external calendars
      let syncAttempted = false;
      let syncSuccess = false;

      try {
        // Check if user has active integrations to determine if we should expect a sync
        const integrations = await calendarIntegrationService.getIntegrations(user.id);

        if (integrations.length > 0) {
          syncAttempted = true;
          const syncResult = await calendarIntegrationService.syncToCalendar(newScheduleItem, user.id);
          if (syncResult.success) {
            // Update local object (Database is already updated by the service)
            newScheduleItem.calendarEventIds = syncResult.eventIds;
            syncSuccess = true;
          }
        }
      } catch (syncError) {
        //console.error('Failed to sync to external calendar:', syncError);
      }

      setScheduleItems(prev => [...prev, newScheduleItem]);

      if (syncAttempted) {
        if (syncSuccess) {
          toast.success('Schedule added and synced to calendar');
        } else {
          toast.warning('Schedule added locally, but calendar sync failed. Check your integrations.');
        }
      } else {
        toast.success('Schedule item added successfully');
      }
    } catch (error) {
      //console.error('Error adding schedule item:', error);
      // Re-throw to allow component to handle form state
      throw error;
    }
  }, [setScheduleItems]);

  const updateScheduleItem = useCallback(async (item: ScheduleItem) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!navigator.onLine) {
        await offlineStorage.save(STORES.SCHEDULE, item);
        await offlineStorage.addPendingSync('update', 'schedule', item);
        setScheduleItems(prev => prev.map(i => i.id === item.id ? item : i));
        toast.success('Schedule item updated offline. Will sync when online.');
        return;
      }

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
          color: item.color,
          is_recurring: item.isRecurring,
          recurrence_pattern: item.recurrencePattern,
          recurrence_interval: item.recurrenceInterval,
          recurrence_days: item.recurrenceDays,
          recurrence_end_date: item.recurrenceEndDate
        })
        .eq('id', item.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Reset reminder status if exists
      try {
        await supabase
          .from('schedule_reminders')
          .update({ notification_sent: false, notification_sent_at: null })
          .eq('schedule_id', item.id);
      } catch (remError) {
        //console.error('Failed to reset reminder:', remError);
      }

      // Update external calendars
      let syncStatus = 'no-sync';
      try {
        const integrations = await calendarIntegrationService.getIntegrations(user.id);

        if (item.calendarEventIds) {
          let hasFailures = false;
          let hasSuccess = false;

          for (const integration of integrations) {
            const eventId = item.calendarEventIds[integration.provider];
            if (eventId) {
              const success = await calendarIntegrationService.updateCalendarEvent(
                item,
                eventId,
                integration.provider,
                integration
              );
              if (success) hasSuccess = true;
              else hasFailures = true;
            }
          }

          if (hasSuccess && !hasFailures) syncStatus = 'success';
          else if (hasFailures) syncStatus = 'partial-failure';
        } else if (integrations.length > 0) {
          // Try to sync if not already synced but user has integrations
          const syncResult = await calendarIntegrationService.syncToCalendar(item, user.id);
          if (syncResult.success) {
            item.calendarEventIds = syncResult.eventIds;
            // Database update is handled within syncToCalendar
            syncStatus = 'success';
          } else {
            syncStatus = 'failed';
          }
        }
      } catch (syncError) {
        //console.error('Failed to update external calendar:', syncError);
        syncStatus = 'error';
      }

      setScheduleItems(prev => prev.map(i => i.id === item.id ? item : i));

      if (syncStatus === 'success') {
        toast.success('Schedule updated and synced to calendar');
      } else if (syncStatus === 'partial-failure' || syncStatus === 'failed' || syncStatus === 'error') {
        toast.warning('Schedule updated locally, but calendar sync failed.');
      } else {
        toast.success('Schedule item updated successfully');
      }
    } catch (error) {
      //console.error('Error updating schedule item:', error);
      // Re-throw to allow component to handle form state
      throw error;
    }
  }, [setScheduleItems]);

  const deleteScheduleItem = useCallback(async (id: string) => {
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!navigator.onLine) {
        await offlineStorage.delete(STORES.SCHEDULE, id);
        await offlineStorage.addPendingSync('delete', 'schedule', { id });
        setScheduleItems(prev => prev.filter(i => i.id !== id));
        toast.success('Schedule item deleted offline. Will sync when online.');
        return;
      }

      const { error } = await supabase
        .from('schedule_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Delete from external calendars
      try {
        const itemToDelete = scheduleItems.find(i => i.id === id);
        if (itemToDelete && itemToDelete.calendarEventIds) {
          const integrations = await calendarIntegrationService.getIntegrations(user.id);
          for (const integration of integrations) {
            const eventId = itemToDelete.calendarEventIds[integration.provider];
            if (eventId) {
              await calendarIntegrationService.deleteCalendarEvent(
                eventId,
                integration.provider,
                integration
              );
            }
          }
        }
      } catch (syncError) {
        //console.error('Failed to delete from external calendar:', syncError);
      }

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
      // Admins have unlimited access
      if (!isAdmin) {
        // Check AI message limit for free users
        if (subscriptionTier === 'free') {
          // You might want to track daily AI messages
          // For now, we'll just check the limit
          if (subscriptionLimits.maxAiMessages !== Infinity) {
            // You should implement daily message tracking here
            toast.info(`Free users get ${subscriptionLimits.maxAiMessages} AI messages per day.`);
          }
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
      // Admins have unlimited access
      if (!isAdmin) {
        // Check document upload count limit BEFORE attempting upload
        const docCount = documents.length;
        const maxDocUploads = subscriptionLimits.maxDocUploads;

        if (subscriptionTier === 'free' && docCount >= maxDocUploads) {
          toast.error(`Document limit reached (${maxDocUploads}). You have uploaded ${docCount} documents.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            },
            duration: 5000
          });
          return;
        }

        if (docCount >= maxDocUploads && maxDocUploads !== Infinity) {
          toast.error(`Document limit reached (${maxDocUploads}). Upgrade to upload more documents.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            }
          });
          return;
        }

        // Check file size limit
        const fileSizeMB = (document.file_size || 0) / (1024 * 1024);
        const maxSizeMB = subscriptionLimits.maxDocSize;

        if (fileSizeMB > maxSizeMB) {
          toast.error(`File too large (${fileSizeMB.toFixed(1)}MB). Maximum allowed for your plan: ${maxSizeMB}MB.`, {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/subscription')
            },
            duration: 5000
          });
          return;
        }
      }

      const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object
      if (!user) throw new Error('Not authenticated');

      if (!navigator.onLine) {
        const newDoc = {
          ...document,
          user_id: user.id,
          id: document.id || generateId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await offlineStorage.save(STORES.DOCUMENTS, newDoc);
        await offlineStorage.addPendingSync('create', 'documents', newDoc);
        setDocuments(prev => [newDoc, ...prev]);
        toast.success('Document saved offline. Will sync when online.');
        return;
      }

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

      if (!navigator.onLine) {
        await offlineStorage.delete(STORES.DOCUMENTS, documentId);
        await offlineStorage.addPendingSync('delete', 'documents', { id: documentId });
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        toast.success('Document deleted offline. Will sync when online.');
        return;
      }

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

      if (!navigator.onLine) {
        const updatedProfile = { ...profile, updated_at: new Date().toISOString() };
        await offlineStorage.save(STORES.PROFILE, updatedProfile);
        await offlineStorage.addPendingSync('update', STORES.PROFILE, updatedProfile);
        setUserProfile(updatedProfile);
        toast.success('Profile updated offline. Will sync when online.');
        return;
      }

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

      setUserProfile({ ...profile, updated_at: new Date().toISOString() });
      toast.success('Profile updated successfully');
    } catch (error) {
      //console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  // Search notes from database
  const searchNotesFromDB = useCallback(async (searchQuery: string): Promise<Note[]> => {
    if (!userProfile?.id || !searchQuery.trim()) return [];

    try {
      const searchLower = searchQuery.toLowerCase();

      // Query notes table with search on title and content
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userProfile.id)
        .or(`title.ilike.%${searchLower}%,content.ilike.%${searchLower}%`)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        // console.error('Note search error:', error);
        return [];
      }

      // Also filter by tags if needed (since ilike doesn't work on arrays)
      const results = (data || []).filter((note: any) => {
        const matchesSearch = 
          note.title?.toLowerCase().includes(searchLower) ||
          note.content?.toLowerCase().includes(searchLower) ||
          note.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));
        return matchesSearch;
      });

      return results as Note[];
    } catch (error) {
      // console.error('Note search error:', error);
      return [];
    }
  }, [userProfile?.id]);

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
    searchNotesFromDB,
  };
};
