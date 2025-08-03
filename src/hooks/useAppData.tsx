// useAppData.tsx - Optimized version with lazy loading and pagination
import { useState, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz, QuizQuestion } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Pagination constants
const INITIAL_LOAD_LIMITS = {
  notes: 10,
  recordings: 5,
  scheduleItems: 20,
  documents: 10,
  chatMessages: 0, // Don't load any by default - loaded per session
  quizzes: 5
};

const LOAD_MORE_LIMITS = {
  notes: 20,
  recordings: 10,
  scheduleItems: 50,
  documents: 20,
  chatMessages: 50,
  quizzes: 10
};

interface DataLoadingState {
  notes: boolean;
  recordings: boolean;
  scheduleItems: boolean;
  documents: boolean;
  quizzes: boolean;
  profile: boolean;
}

interface DataPaginationState {
  notes: { hasMore: boolean; offset: number; total: number };
  recordings: { hasMore: boolean; offset: number; total: number };
  scheduleItems: { hasMore: boolean; offset: number; total: number };
  documents: { hasMore: boolean; offset: number; total: number };
  quizzes: { hasMore: boolean; offset: number; total: number };
}

export const useAppData = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings'>('notes');
  const [isAILoading, setIsAILoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  // New state for tracking what data has been loaded
  const [dataLoaded, setDataLoaded] = useState<Set<keyof DataLoadingState>>(new Set());
  const [dataLoading, setDataLoading] = useState<DataLoadingState>({
    notes: false,
    recordings: false,
    scheduleItems: false,
    documents: false,
    quizzes: false,
    profile: false
  });

  // Pagination state
  const [dataPagination, setDataPagination] = useState<DataPaginationState>({
    notes: { hasMore: true, offset: 0, total: 0 },
    recordings: { hasMore: true, offset: 0, total: 0 },
    scheduleItems: { hasMore: true, offset: 0, total: 0 },
    documents: { hasMore: true, offset: 0, total: 0 },
    quizzes: { hasMore: true, offset: 0, total: 0 }
  });

  const documentChannelRef = useRef<any>(null);
  const chatMessageChannelRef = useRef<any>(null);
  const notesChannelRef = useRef<any>(null);
  const recordingsChannelRef = useRef<any>(null);
  const scheduleChannelRef = useRef<any>(null);
  const profileChannelRef = useRef<any>(null);
  const quizzesChannelRef = useRef<any>(null);

  // Auth listener to set currentUser
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    // Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load essential data when user changes
  useEffect(() => {
    if (currentUser?.id && currentUser.id !== lastUserId) {
      console.log('User changed, loading essential data...');
      setLastUserId(currentUser.id);
      loadEssentialUserData(currentUser);
    } else if (!currentUser && lastUserId !== null) {
      console.log('User logged out, clearing data...');
      setLastUserId(null);
      clearAllData();
    }
  }, [currentUser, lastUserId]);

  const clearAllData = () => {
    setNotes([]);
    setRecordings([]);
    setScheduleItems([]);
    setChatMessages([]);
    setDocuments([]);
    setUserProfile(null);
    setQuizzes([]);
    setActiveNote(null);
    setDataLoaded(new Set());
    setDataLoading({
      notes: false,
      recordings: false,
      scheduleItems: false,
      documents: false,
      quizzes: false,
      profile: false
    });
    setDataPagination({
      notes: { hasMore: true, offset: 0, total: 0 },
      recordings: { hasMore: true, offset: 0, total: 0 },
      scheduleItems: { hasMore: true, offset: 0, total: 0 },
      documents: { hasMore: true, offset: 0, total: 0 },
      quizzes: { hasMore: true, offset: 0, total: 0 }
    });
    setLoading(false);
  };

  // Load only essential data initially (profile + basic counts)
  const loadEssentialUserData = useCallback(async (user: any) => {
    if (!user?.id) return;

    console.log('Loading essential user data for:', user.id);
    setLoading(true);

    try {
      // Load user profile first (always needed)
      await loadUserProfile(user);
      
      // Load initial notes (for sidebar preview)
      await loadNotesPage(user.id, true);
      
      console.log('Essential user data loaded successfully');
    } catch (error) {
      console.error('Unexpected error loading essential user data:', error);
      toast.error('An unexpected error occurred while loading data');
      clearAllData();
    } finally {
      setLoading(false);
    }
  }, []);

  // Load user profile
  const loadUserProfile = useCallback(async (user: any) => {
    if (dataLoaded.has('profile')) return;

    setDataLoading(prev => ({ ...prev, profile: true }));

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading user profile:', profileError);
        toast.error('Failed to load user profile');
        return;
      }

      if (profileData) {
        setUserProfile({
          id: profileData.id,
          email: profileData.email || user.email || '',
          full_name: profileData.full_name || '',
          avatar_url: profileData.avatar_url || '',
          learning_style: (profileData.learning_style || 'visual') as 'visual' | 'auditory' | 'kinesthetic' | 'reading',
          learning_preferences: (profileData.learning_preferences as any) || {
            explanation_style: 'detailed',
            examples: true,
            difficulty: 'intermediate'
          },
          created_at: new Date(profileData.created_at || Date.now()),
          updated_at: new Date(profileData.updated_at || Date.now())
        });
      } else {
        // Create default profile
        const defaultProfile = {
          id: user.id,
          email: user.email || '',
          full_name: '',
          avatar_url: '',
          learning_style: 'visual' as const,
          learning_preferences: {
            explanation_style: 'detailed' as const,
            examples: true,
            difficulty: 'intermediate' as const
          }
        };

        try {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert(defaultProfile);
          
          if (!insertError) {
            setUserProfile({
              ...defaultProfile,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        } catch (error) {
          console.error('Error creating default profile:', error);
          setUserProfile({
            ...defaultProfile,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }

      setDataLoaded(prev => new Set([...prev, 'profile']));
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setDataLoading(prev => ({ ...prev, profile: false }));
    }
  }, [dataLoaded]);

  // Load notes with pagination
  const loadNotesPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.notes) return;
    if (!isInitial && !dataPagination.notes.hasMore) return;

    setDataLoading(prev => ({ ...prev, notes: true }));

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.notes : LOAD_MORE_LIMITS.notes;
      const offset = isInitial ? 0 : dataPagination.notes.offset;

      const { data, error, count } = await supabase
        .from('notes')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      if (data) {
        const formattedNotes = data.map(note => ({
          id: note.id,
          title: note.title || 'Untitled Note',
          content: note.content || '',
          document_id: note.document_id || null,
          user_id: note.user_id || userId,
          category: note.category || 'general',
          tags: note.tags || [],
          createdAt: new Date(note.created_at || Date.now()),
          updatedAt: new Date(note.updated_at || Date.now()),
          aiSummary: note.ai_summary || ''
        }));

        if (isInitial) {
          setNotes(formattedNotes);
          if (formattedNotes.length > 0 && !activeNote) {
            setActiveNote(formattedNotes[0]);
          }
        } else {
          setNotes(prev => [...prev, ...formattedNotes]);
        }

        const newOffset = offset + formattedNotes.length;
        const hasMore = count ? newOffset < count : formattedNotes.length === limit;

        setDataPagination(prev => ({
          ...prev,
          notes: { hasMore, offset: newOffset, total: count || 0 }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'notes']));
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setDataLoading(prev => ({ ...prev, notes: false }));
    }
  }, [dataLoading.notes, dataPagination.notes, activeNote]);

  // Load recordings with pagination
  const loadRecordingsPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.recordings) return;
    if (!isInitial && !dataPagination.recordings.hasMore) return;

    setDataLoading(prev => ({ ...prev, recordings: true }));

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.recordings : LOAD_MORE_LIMITS.recordings;
      const offset = isInitial ? 0 : dataPagination.recordings.offset;

      const { data, error, count } = await supabase
        .from('class_recordings')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      if (data) {
        const formattedRecordings = data.map(recording => ({
          id: recording.id,
          title: recording.title || 'Untitled Recording',
          subject: recording.subject || '',
          date: recording.date || new Date().toISOString(),
          duration: recording.duration || 0,
          audioUrl: recording.audio_url || '',
          transcript: recording.transcript || '',
          summary: recording.summary || '',
          createdAt: recording.created_at || new Date().toISOString(),
          userId: recording.user_id,
          document_id: recording.document_id
        }));

        if (isInitial) {
          setRecordings(formattedRecordings);
        } else {
          setRecordings(prev => [...prev, ...formattedRecordings]);
        }

        const newOffset = offset + formattedRecordings.length;
        const hasMore = count ? newOffset < count : formattedRecordings.length === limit;

        setDataPagination(prev => ({
          ...prev,
          recordings: { hasMore, offset: newOffset, total: count || 0 }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'recordings']));
    } catch (error) {
      console.error('Error loading recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setDataLoading(prev => ({ ...prev, recordings: false }));
    }
  }, [dataLoading.recordings, dataPagination.recordings]);

  // Load documents with pagination
  const loadDocumentsPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.documents) return;
    if (!isInitial && !dataPagination.documents.hasMore) return;

    setDataLoading(prev => ({ ...prev, documents: true }));

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.documents : LOAD_MORE_LIMITS.documents;
      const offset = isInitial ? 0 : dataPagination.documents.offset;

      const { data, error, count } = await supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      if (data) {
        const formattedDocuments = data.map(doc => ({
          id: doc.id,
          title: doc.title || 'Untitled Document',
          user_id: doc.user_id,
          file_name: doc.file_name || '',
          file_type: doc.file_type || '',
          file_url: doc.file_url || '',
          file_size: doc.file_size || 0,
          content_extracted: doc.content_extracted || null,
          type: doc.type as Document['type'],
          processing_status: String(doc.processing_status) || null,
          processing_error: String(doc.processing_error) || null,
          created_at: new Date(doc.created_at).toISOString(),
          updated_at: new Date(doc.updated_at).toISOString()
        }));

        if (isInitial) {
          setDocuments(formattedDocuments);
        } else {
          setDocuments(prev => [...prev, ...formattedDocuments]);
        }

        const newOffset = offset + formattedDocuments.length;
        const hasMore = count ? newOffset < count : formattedDocuments.length === limit;

        setDataPagination(prev => ({
          ...prev,
          documents: { hasMore, offset: newOffset, total: count || 0 }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'documents']));
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setDataLoading(prev => ({ ...prev, documents: false }));
    }
  }, [dataLoading.documents, dataPagination.documents]);

  // Load schedule items with pagination
  const loadSchedulePage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.scheduleItems) return;
    if (!isInitial && !dataPagination.scheduleItems.hasMore) return;

    setDataLoading(prev => ({ ...prev, scheduleItems: true }));

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.scheduleItems : LOAD_MORE_LIMITS.scheduleItems;
      const offset = isInitial ? 0 : dataPagination.scheduleItems.offset;

      const { data, error, count } = await supabase
        .from('schedule_items')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('start_time', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      if (data) {
        const formattedItems = data.map(item => ({
          id: item.id,
          title: item.title || 'Untitled Event',
          subject: item.subject || '',
          startTime: item.start_time,
          endTime: item.end_time,
          type: item.type as 'class' | 'study' | 'assignment' | 'exam' | 'other',
          description: item.description || '',
          location: item.location || '',
          color: item.color || '#3B82F6',
          userId: item.user_id,
          createdAt: item.created_at || new Date().toISOString()
        }));

        if (isInitial) {
          setScheduleItems(formattedItems);
        } else {
          setScheduleItems(prev => [...prev, ...formattedItems]);
        }

        const newOffset = offset + formattedItems.length;
        const hasMore = count ? newOffset < count : formattedItems.length === limit;

        setDataPagination(prev => ({
          ...prev,
          scheduleItems: { hasMore, offset: newOffset, total: count || 0 }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'scheduleItems']));
    } catch (error) {
      console.error('Error loading schedule items:', error);
      toast.error('Failed to load schedule');
    } finally {
      setDataLoading(prev => ({ ...prev, scheduleItems: false }));
    }
  }, [dataLoading.scheduleItems, dataPagination.scheduleItems]);

  // Load quizzes with pagination
  const loadQuizzesPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.quizzes) return;
    if (!isInitial && !dataPagination.quizzes.hasMore) return;

    setDataLoading(prev => ({ ...prev, quizzes: true }));

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.quizzes : LOAD_MORE_LIMITS.quizzes;
      const offset = isInitial ? 0 : dataPagination.quizzes.offset;

      const { data, error, count } = await supabase
        .from('quizzes')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      if (data) {
        const formattedQuizzes = data.map(quiz => ({
          id: quiz.id,
          title: quiz.title || 'Untitled Quiz',
          questions: (Array.isArray(quiz.questions) ? quiz.questions.map((q: any) => ({
            id: q.id,
            question: q.question || '',
            options: q.options || [],
            correctAnswer: q.correctAnswer || 0,
            explanation: q.explanation || ''
          })) : []) as QuizQuestion[],
          classId: quiz.class_id,
          userId: quiz.user_id,
          createdAt: quiz.created_at
        }));

        if (isInitial) {
          setQuizzes(formattedQuizzes);
        } else {
          setQuizzes(prev => [...prev, ...formattedQuizzes]);
        }

        const newOffset = offset + formattedQuizzes.length;
        const hasMore = count ? newOffset < count : formattedQuizzes.length === limit;

        setDataPagination(prev => ({
          ...prev,
          quizzes: { hasMore, offset: newOffset, total: count || 0 }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'quizzes']));
    } catch (error) {
      console.error('Error loading quizzes:', error);
      toast.error('Failed to load quizzes');
    } finally {
      setDataLoading(prev => ({ ...prev, quizzes: false }));
    }
  }, [dataLoading.quizzes, dataPagination.quizzes]);

  // Lazy loading functions for each data type
  const loadDataIfNeeded = useCallback((dataType: keyof DataLoadingState) => {
    if (!currentUser?.id || dataLoaded.has(dataType)) return;

    switch (dataType) {
      case 'recordings':
        loadRecordingsPage(currentUser.id, true);
        break;
      case 'scheduleItems':
        loadSchedulePage(currentUser.id, true);
        break;
      case 'documents':
        loadDocumentsPage(currentUser.id, true);
        break;
      case 'quizzes':
        loadQuizzesPage(currentUser.id, true);
        break;
    }
  }, [currentUser, dataLoaded, loadRecordingsPage, loadSchedulePage, loadDocumentsPage, loadQuizzesPage]);

  // Load more functions for pagination
  const loadMoreNotes = useCallback(() => {
    if (currentUser?.id) {
      loadNotesPage(currentUser.id, false);
    }
  }, [currentUser, loadNotesPage]);

  const loadMoreRecordings = useCallback(() => {
    if (currentUser?.id) {
      loadRecordingsPage(currentUser.id, false);
    }
  }, [currentUser, loadRecordingsPage]);

  const loadMoreDocuments = useCallback(() => {
    if (currentUser?.id) {
      loadDocumentsPage(currentUser.id, false);
    }
  }, [currentUser, loadDocumentsPage]);

  const loadMoreSchedule = useCallback(() => {
    if (currentUser?.id) {
      loadSchedulePage(currentUser.id, false);
    }
  }, [currentUser, loadSchedulePage]);

  const loadMoreQuizzes = useCallback(() => {
    if (currentUser?.id) {
      loadQuizzesPage(currentUser.id, false);
    }
  }, [currentUser, loadQuizzesPage]);

  // Auto-load data when tabs are activated
  useEffect(() => {
    switch (activeTab) {
      case 'recordings':
        loadDataIfNeeded('recordings');
        break;
      case 'schedule':
        loadDataIfNeeded('scheduleItems');
        break;
      case 'documents':
        loadDataIfNeeded('documents');
        break;
      // Chat messages are loaded per session, not globally
      // Notes are loaded initially
    }
  }, [activeTab, loadDataIfNeeded]);

  useEffect(() => {
    return () => {
      [documentChannelRef, chatMessageChannelRef, notesChannelRef,
        recordingsChannelRef, scheduleChannelRef, profileChannelRef,
        quizzesChannelRef].forEach(channelRef => {
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        });
    };
  }, []);

  // Real-time listener for documents
  useEffect(() => {
    const setupDocumentListener = () => {
      if (documentChannelRef.current) {
        supabase.removeChannel(documentChannelRef.current);
        documentChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:documents')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newDoc = payload.new as any;
              const formattedDoc: Document = {
                id: newDoc.id,
                title: newDoc.title,
                user_id: newDoc.user_id,
                file_name: newDoc.file_name,
                file_type: newDoc.file_type,
                file_url: newDoc.file_url,
                content_extracted: newDoc.content_extracted || null,
                file_size: newDoc.file_size || 0,
                type: newDoc.type as Document['type'],
                processing_status: String(newDoc.processing_status) || null,
                processing_error: String(newDoc.processing_error) || null,
                created_at: new Date(newDoc.created_at).toISOString(),
                updated_at: new Date(newDoc.updated_at).toISOString(),
              };

              setDocuments(prevDocs => {
                const existingIndex = prevDocs.findIndex(doc => doc.id === formattedDoc.id);
                if (existingIndex > -1) {
                  const updatedDocs = [...prevDocs];
                  updatedDocs[existingIndex] = formattedDoc;
                  return updatedDocs;
                } else {
                  return [formattedDoc, ...prevDocs];
                }
              });

              if (formattedDoc.processing_status === 'completed') {
                toast.success(`Document "${formattedDoc.title}" processed successfully!`);
              } else if (formattedDoc.processing_status === 'failed') {
                toast.error(`Document "${formattedDoc.title}" processing failed: ${formattedDoc.processing_error}`);
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== deletedId));
              toast.info('Document deleted from list.');
            }
          }
        )
        .subscribe();

      documentChannelRef.current = channel;

      return () => {
        if (documentChannelRef.current) {
          supabase.removeChannel(documentChannelRef.current);
          documentChannelRef.current = null;
        }
      };
    };

    setupDocumentListener();
  }, [currentUser, setDocuments]);

  // Real-time listener for chat messages
  useEffect(() => {
    const setupChatMessageListener = () => {
      if (chatMessageChannelRef.current) {
        supabase.removeChannel(chatMessageChannelRef.current);
        chatMessageChannelRef.current = null;
      }

      if (!currentUser) {
        setChatMessages([]);
        return;
      }

      const channel = supabase
        .channel(`chat_messages_${currentUser.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: `user_id=eq.${currentUser.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMessage: Message = {
                id: payload.new.id,
                content: payload.new.content || '',
                role: payload.new.role as 'user' | 'assistant',
                timestamp: payload.new.timestamp,
                isError: payload.new.is_error || false,
                attachedDocumentIds: payload.new.attached_document_ids || [],
                attachedNoteIds: payload.new.attached_note_ids || [],
                imageUrl: payload.new.image_url || undefined,
                imageMimeType: payload.new.image_mime_type || undefined,
                session_id: payload.new.session_id,
                originalUserMessageContent: payload.new.original_user_message_content || '',
                has_been_displayed: payload.new.has_been_displayed || false
              };

              setChatMessages(prevMessages => {
                const exists = prevMessages.some(msg => msg.id === newMessage.id);
                if (exists) {
                  return prevMessages;
                }

                const updatedMessages = [...prevMessages, newMessage].sort(
                  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                return updatedMessages;
              });
            }
            else if (payload.eventType === 'UPDATE') {
              const updatedMessage: Message = {
                id: payload.new.id,
                content: payload.new.content || '',
                role: payload.new.role as 'user' | 'assistant',
                timestamp: payload.new.timestamp,
                isError: payload.new.is_error || false,
                attachedDocumentIds: payload.new.attached_document_ids || [],
                attachedNoteIds: payload.new.attached_note_ids || [],
                imageUrl: payload.new.image_url || undefined,
                imageMimeType: payload.new.image_mime_type || undefined,
                session_id: payload.new.session_id,
                originalUserMessageContent: payload.new.original_user_message_content || '',
                has_been_displayed: payload.new.has_been_displayed || false
              };

              setChatMessages(prevMessages => {
                const updatedMessages = prevMessages.map(msg =>
                  msg.id === updatedMessage.id ? updatedMessage : msg
                ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                return updatedMessages;
              });
            }
            else if (payload.eventType === 'DELETE') {
              setChatMessages(prevMessages => {
                const filteredMessages = prevMessages.filter(msg => msg.id !== payload.old.id);
                return filteredMessages;
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to chat messages real-time updates');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to chat messages real-time updates');
            toast.error('Failed to connect to real-time chat updates');
          }
        });

      chatMessageChannelRef.current = channel;

      return () => {
        if (chatMessageChannelRef.current) {
          supabase.removeChannel(chatMessageChannelRef.current);
          chatMessageChannelRef.current = null;
        }
      };
    };

    return setupChatMessageListener();
  }, [currentUser, setChatMessages]);

  // Real-time listener for Notes
  useEffect(() => {
    const setupNotesListener = () => {
      if (notesChannelRef.current) {
        supabase.removeChannel(notesChannelRef.current);
        notesChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:notes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newNote = payload.new as any;
              const formattedNote: Note = {
                id: newNote.id,
                title: newNote.title,
                content: newNote.content || '',
                document_id: newNote.document_id || null,
                user_id: newNote.user_id,
                category: newNote.category || 'general',
                tags: newNote.tags || [],
                createdAt: new Date(newNote.created_at || Date.now()),
                updatedAt: new Date(newNote.updated_at || Date.now()),
                aiSummary: newNote.ai_summary || ''
              };

              setNotes(prevNotes => {
                const existingIndex = prevNotes.findIndex(note => note.id === formattedNote.id);
                if (existingIndex > -1) {
                  const updatedNotes = [...prevNotes];
                  updatedNotes[existingIndex] = formattedNote;
                  return updatedNotes;
                } else {
                  return [formattedNote, ...prevNotes];
                }
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setNotes(prevNotes => prevNotes.filter(note => note.id !== deletedId));
            }
          }
        )
        .subscribe();

      notesChannelRef.current = channel;

      return () => {
        if (notesChannelRef.current) {
          supabase.removeChannel(notesChannelRef.current);
          notesChannelRef.current = null;
        }
      };
    };

    setupNotesListener();
  }, [currentUser, setNotes]);

  // Real-time listener for Recordings
  useEffect(() => {
    const setupRecordingsListener = () => {
      if (recordingsChannelRef.current) {
        supabase.removeChannel(recordingsChannelRef.current);
        recordingsChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:class_recordings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'class_recordings', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newRecording = payload.new as any;
              const formattedRecording: ClassRecording = {
                id: newRecording.id,
                title: newRecording.title,
                subject: newRecording.subject,
                date: newRecording.date || new Date().toISOString(),
                duration: newRecording.duration || 0,
                audioUrl: newRecording.audio_url || '',
                transcript: newRecording.transcript || '',
                summary: newRecording.summary || '',
                createdAt: newRecording.created_at || new Date().toISOString(),
                userId: newRecording.user_id,
                document_id: newRecording.document_id
              };

              setRecordings(prevRecordings => {
                const existingIndex = prevRecordings.findIndex(rec => rec.id === formattedRecording.id);
                if (existingIndex > -1) {
                  const updatedRecordings = [...prevRecordings];
                  updatedRecordings[existingIndex] = formattedRecording;
                  return updatedRecordings;
                } else {
                  return [formattedRecording, ...prevRecordings];
                }
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setRecordings(prevRecordings => prevRecordings.filter(rec => rec.id !== deletedId));
            }
          }
        )
        .subscribe();

      recordingsChannelRef.current = channel;

      return () => {
        if (recordingsChannelRef.current) {
          supabase.removeChannel(recordingsChannelRef.current);
          recordingsChannelRef.current = null;
        }
      };
    };

    setupRecordingsListener();
  }, [currentUser, setRecordings]);

  // Real-time listener for Schedule Items
  useEffect(() => {
    const setupScheduleListener = () => {
      if (scheduleChannelRef.current) {
        supabase.removeChannel(scheduleChannelRef.current);
        scheduleChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:schedule_items')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'schedule_items', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newItem = payload.new as any;
              const formattedItem: ScheduleItem = {
                id: newItem.id,
                title: newItem.title,
                subject: newItem.subject,
                startTime: newItem.start_time,
                endTime: newItem.end_time,
                type: newItem.type as 'class' | 'study' | 'assignment' | 'exam' | 'other',
                description: newItem.description || '',
                location: newItem.location || '',
                color: newItem.color || '#3B82F6',
                userId: newItem.user_id,
                createdAt: newItem.created_at || new Date().toISOString()
              };

              setScheduleItems(prevItems => {
                const existingIndex = prevItems.findIndex(item => item.id === formattedItem.id);
                if (existingIndex > -1) {
                  const updatedItems = [...prevItems];
                  updatedItems[existingIndex] = formattedItem;
                  return updatedItems;
                } else {
                  return [formattedItem, ...prevItems];
                }
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setScheduleItems(prevItems => prevItems.filter(item => item.id !== deletedId));
            }
          }
        )
        .subscribe();

      scheduleChannelRef.current = channel;

      return () => {
        if (scheduleChannelRef.current) {
          supabase.removeChannel(scheduleChannelRef.current);
          scheduleChannelRef.current = null;
        }
      };
    };

    setupScheduleListener();
  }, [currentUser, setScheduleItems]);

  // Real-time listener for User Profile
  useEffect(() => {
    const setupProfileListener = () => {
      if (profileChannelRef.current) {
        supabase.removeChannel(profileChannelRef.current);
        profileChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:profiles')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newProfile = payload.new as any;
              setUserProfile({
                id: newProfile.id,
                email: newProfile.email || currentUser.email || '',
                full_name: newProfile.full_name || '',
                avatar_url: newProfile.avatar_url || '',
                learning_style: (newProfile.learning_style || 'visual') as 'visual' | 'auditory' | 'kinesthetic' | 'reading',
                learning_preferences: (newProfile.learning_preferences as any) || {
                  explanation_style: 'detailed',
                  examples: true,
                  difficulty: 'intermediate'
                },
                created_at: new Date(newProfile.created_at || Date.now()),
                updated_at: new Date(newProfile.updated_at || Date.now())
              });
            }
          }
        )
        .subscribe();

      profileChannelRef.current = channel;

      return () => {
        if (profileChannelRef.current) {
          supabase.removeChannel(profileChannelRef.current);
          profileChannelRef.current = null;
        }
      };
    };

    setupProfileListener();
  }, [currentUser, setUserProfile]);

  // Real-time listener for Quizzes
  useEffect(() => {
    const setupQuizzesListener = () => {
      if (quizzesChannelRef.current) {
        supabase.removeChannel(quizzesChannelRef.current);
        quizzesChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:quizzes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quizzes', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newQuiz = payload.new as any;
              const formattedQuiz: Quiz = {
                id: newQuiz.id,
                title: newQuiz.title,
                questions: (Array.isArray(newQuiz.questions) ? newQuiz.questions.map((q: any) => ({
                  id: q.id,
                  question: q.question,
                  options: q.options,
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation
                })) : []) as QuizQuestion[],
                classId: newQuiz.class_id,
                userId: newQuiz.user_id,
                createdAt: newQuiz.created_at
              };

              setQuizzes(prevQuizzes => {
                const existingIndex = prevQuizzes.findIndex(quiz => quiz.id === formattedQuiz.id);
                if (existingIndex > -1) {
                  const updatedQuizzes = [...prevQuizzes];
                  updatedQuizzes[existingIndex] = formattedQuiz;
                  return updatedQuizzes;
                } else {
                  return [formattedQuiz, ...prevQuizzes];
                }
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setQuizzes(prevQuizzes => prevQuizzes.filter(quiz => quiz.id !== deletedId));
            }
          }
        )
        .subscribe();

      quizzesChannelRef.current = channel;

      return () => {
        if (quizzesChannelRef.current) {
          supabase.removeChannel(quizzesChannelRef.current);
          quizzesChannelRef.current = null;
        }
      };
    };

    setupQuizzesListener();
  }, [currentUser, setQuizzes]);

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return {
    // State
    notes,
    recordings,
    scheduleItems,
    chatMessages,
    documents,
    userProfile,
    activeNote,
    searchQuery,
    selectedCategory,
    isSidebarOpen,
    activeTab,
    isAILoading,
    filteredNotes,
    loading,
    quizzes,
    currentUser,

    // Loading states
    dataLoading,
    dataPagination,

    // Setters
    setNotes,
    setRecordings,
    setScheduleItems,
    setChatMessages,
    setDocuments,
    setUserProfile,
    setActiveNote,
    setSearchQuery,
    setSelectedCategory,
    setIsSidebarOpen,
    setActiveTab,
    setIsAILoading,
    setQuizzes,

    // Lazy loading functions
    loadDataIfNeeded,

    // Load more functions
    loadMoreNotes,
    loadMoreRecordings,
    loadMoreDocuments,
    loadMoreSchedule,
    loadMoreQuizzes,
  };
};