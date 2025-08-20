// useAppData.tsx - Optimized version with smooth loading and progressive data loading
import { useState, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz, QuizQuestion } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

// Enhanced pagination constants for smoother loading
const INITIAL_LOAD_LIMITS = {
  notes: 15, // Increased for better initial experience
  recordings: 8,
  scheduleItems: 25,
  documents: 12,
  chatMessages: 0,
  quizzes: 8
};

const LOAD_MORE_LIMITS = {
  notes: 25,
  recordings: 15,
  scheduleItems: 50,
  documents: 20,
  chatMessages: 50,
  quizzes: 15
};

// Progressive loading priorities
const LOADING_PRIORITIES = {
  profile: 1,      // Highest - needed for all features
  notes: 2,        // High - main content area
  documents: 3,    // Medium-High - needed for chat
  recordings: 4,   // Medium - tab-specific
  scheduleItems: 5, // Medium - tab-specific  
  quizzes: 6       // Lower - settings specific
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

interface LoadingPhase {
  phase: 'initial' | 'core' | 'secondary' | 'complete';
  progress: number;
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

  // Enhanced loading state tracking
  const [dataLoaded, setDataLoaded] = useState<Set<keyof DataLoadingState>>(new Set());
  const [dataLoading, setDataLoading] = useState<DataLoadingState>({
    notes: false,
    recordings: false,
    scheduleItems: false,
    documents: false,
    quizzes: false,
    profile: false
  });

  // Progressive loading state
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>({
    phase: 'initial',
    progress: 0
  });

  // Pagination state
  const [dataPagination, setDataPagination] = useState<DataPaginationState>({
    notes: { hasMore: true, offset: 0, total: 0 },
    recordings: { hasMore: true, offset: 0, total: 0 },
    scheduleItems: { hasMore: true, offset: 0, total: 0 },
    documents: { hasMore: true, offset: 0, total: 0 },
    quizzes: { hasMore: true, offset: 0, total: 0 }
  });

  // Real-time subscription refs
  const documentChannelRef = useRef<any>(null);
  const chatMessageChannelRef = useRef<any>(null);
  const notesChannelRef = useRef<any>(null);
  const recordingsChannelRef = useRef<any>(null);
  const scheduleChannelRef = useRef<any>(null);
  const profileChannelRef = useRef<any>(null);
  const quizzesChannelRef = useRef<any>(null);

  // Loading queue and batch processing
  const loadingQueueRef = useRef<Set<keyof DataLoadingState>>(new Set());
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Progressive data loading when user changes
  useEffect(() => {
    if (currentUser?.id && currentUser.id !== lastUserId) {
      // console.log('User changed, starting progressive data loading...');
      setLastUserId(currentUser.id);
      startProgressiveDataLoading(currentUser);
    } else if (!currentUser && lastUserId !== null) {
      // console.log('User logged out, clearing data...');
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
    setLoadingPhase({ phase: 'initial', progress: 0 });
    setLoading(false);
  };

  // Progressive loading strategy
  const startProgressiveDataLoading = useCallback(async (user: any) => {
    if (!user?.id) return;

    setLoading(true);
    setLoadingPhase({ phase: 'initial', progress: 10 });

    try {
      // Phase 1: Critical data (profile + basic UI needs)
      await Promise.all([
        loadUserProfile(user),
        setupRealTimeListeners(user)
      ]);

      setLoadingPhase({ phase: 'core', progress: 30 });

      // Phase 2: Core content (notes + documents - needed for most interactions)
      await Promise.all([
        loadNotesPage(user.id, true),
        loadDocumentsPage(user.id, true)
      ]);

      setLoadingPhase({ phase: 'secondary', progress: 60 });

      // Phase 3: Secondary data (loaded in background, non-blocking)
      // Use setTimeout to make this truly non-blocking
      setTimeout(async () => {
        try {
          await Promise.all([
            loadRecordingsPage(user.id, true),
            loadSchedulePage(user.id, true),
            loadQuizzesPage(user.id, true)
          ]);

          setLoadingPhase({ phase: 'complete', progress: 100 });
        } catch (error) {
          console.error('Error loading secondary data:', error);
          // Don't show error toast for secondary data - it will load when needed
          setLoadingPhase({ phase: 'complete', progress: 100 });
        }
      }, 100); // Small delay to ensure UI is responsive

      // UI is ready after core data
      setLoading(false);

      // console.log('Core user data loaded successfully, UI ready');
    } catch (error) {
      console.error('Error loading core user data:', error);
      toast.error('Failed to load some data. Please refresh to try again.');
      setLoading(false);
      setLoadingPhase({ phase: 'complete', progress: 100 });
    }
  }, []);

  // Optimized user profile loading with better error handling
  const loadUserProfile = useCallback(async (user: any) => {
    if (dataLoaded.has('profile')) return;

    setDataLoading(prev => ({ ...prev, profile: true }));

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') { // Ignore "not found" errors
        console.error('Error loading user profile:', profileError);
        // Don't throw - continue with default profile
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
        // Create default profile silently
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

        // Set profile immediately for UI responsiveness
        setUserProfile({
          ...defaultProfile,
          created_at: new Date(),
          updated_at: new Date()
        });

        // Create in background
        setTimeout(async () => {
          try {
            await supabase.from('profiles').insert(defaultProfile);
          } catch (error) {
            console.error('Error creating default profile (non-critical):', error);
          }
        }, 500);
      }

      setDataLoaded(prev => new Set([...prev, 'profile']));
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      // Create minimal profile to prevent UI blocking
      setUserProfile({
        id: user.id,
        email: user.email || '',
        full_name: '',
        avatar_url: '',
        learning_style: 'visual',
        learning_preferences: {
          explanation_style: 'detailed',
          examples: true,
          difficulty: 'intermediate'
        },
        created_at: new Date(),
        updated_at: new Date()
      });
      setDataLoaded(prev => new Set([...prev, 'profile']));
    } finally {
      setDataLoading(prev => ({ ...prev, profile: false }));
    }
  }, [dataLoaded]);

  // Optimized notes loading with better performance
  const loadNotesPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.notes) return;
    if (!isInitial && !dataPagination.notes.hasMore) return;

    setDataLoading(prev => ({ ...prev, notes: true }));

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.notes : LOAD_MORE_LIMITS.notes;
      const offset = isInitial ? 0 : dataPagination.notes.offset;

      // Use more efficient query for better performance
      const query = supabase
        .from('notes')
        .select('id, title, content, document_id, user_id, category, tags, created_at, updated_at, ai_summary', { count: 'exact' })
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (!isInitial) {
        query.range(offset, offset + limit - 1);
      } else {
        query.limit(limit);
      }

      const { data, error, count } = await query;

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
          // Set active note more intelligently
          if (formattedNotes.length > 0 && !activeNote) {
            // Prefer the most recently updated note
            const mostRecent = formattedNotes.sort((a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )[0];
            setActiveNote(mostRecent);
          }
        } else {
          setNotes(prev => [...prev, ...formattedNotes]);
        }

        const newOffset = isInitial ? formattedNotes.length : offset + formattedNotes.length;
        const hasMore = count ? newOffset < count : formattedNotes.length === limit;

        setDataPagination(prev => ({
          ...prev,
          notes: { hasMore, offset: newOffset, total: count || 0 }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'notes']));
    } catch (error) {
      console.error('Error loading notes:', error);
      if (isInitial) {
        toast.error('Failed to load notes');
      }
    } finally {
      setDataLoading(prev => ({ ...prev, notes: false }));
    }
  }, [dataLoading.notes, dataPagination.notes, activeNote]);

  // Enhanced documents loading for chat dependency
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
      //console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setDataLoading(prev => ({ ...prev, documents: false }));
    }
  }, [dataLoading.documents, dataPagination.documents]);

  // Optimized recordings loading
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
      // Don't show error for background loading
    } finally {
      setDataLoading(prev => ({ ...prev, recordings: false }));
    }
  }, [dataLoading.recordings, dataPagination.recordings]);

  // Optimized schedule loading
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
      // Don't show error for background loading
    } finally {
      setDataLoading(prev => ({ ...prev, scheduleItems: false }));
    }
  }, [dataLoading.scheduleItems, dataPagination.scheduleItems]);

  // Optimized quizzes loading
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
      // Don't show error for background loading
    } finally {
      setDataLoading(prev => ({ ...prev, quizzes: false }));
    }
  }, [dataLoading.quizzes, dataPagination.quizzes]);

  // Batch loading for better performance
  const queueDataLoad = useCallback((dataType: keyof DataLoadingState) => {
    loadingQueueRef.current.add(dataType);

    // Clear existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    // Batch process after short delay
    loadingTimeoutRef.current = setTimeout(() => {
      const toLoad = Array.from(loadingQueueRef.current);
      loadingQueueRef.current.clear();

      // Process in priority order
      const sorted = toLoad.sort((a, b) =>
        LOADING_PRIORITIES[a] - LOADING_PRIORITIES[b]
      );

      sorted.forEach((dataType, index) => {
        // Stagger loads to prevent overwhelming
        setTimeout(() => {
          loadDataIfNeeded(dataType);
        }, index * 50);
      });
    }, 100);
  }, []);

  // Enhanced lazy loading
  const loadDataIfNeeded = useCallback((dataType: keyof DataLoadingState) => {
    if (!currentUser?.id || dataLoaded.has(dataType) || dataLoading[dataType]) return;

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
      case 'notes':
        loadNotesPage(currentUser.id, true);
        break;
      case 'profile':
        if (!dataLoading.profile) {
          loadUserProfile(currentUser);
        }
        break;
    }
  }, [currentUser, dataLoaded, dataLoading, loadRecordingsPage, loadSchedulePage, loadDocumentsPage, loadQuizzesPage, loadNotesPage, loadUserProfile]);

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

  // Smart tab-based loading with batching
  useEffect(() => {
    if (loadingPhase.phase === 'complete') return;

    switch (activeTab) {
      case 'recordings':
        queueDataLoad('recordings');
        queueDataLoad('quizzes');
        break;
      case 'schedule':
        queueDataLoad('scheduleItems');
        break;
      case 'documents':
        queueDataLoad('documents');
        break;
      case 'settings':
        queueDataLoad('quizzes');
        break;
      case 'chat':
        // Chat needs documents for context
        queueDataLoad('documents');
        break;
      default:
        // Notes tab - data already loaded in core phase
        break;
    }
  }, [activeTab, loadingPhase.phase, queueDataLoad]);

  // Enhanced real-time listeners setup
  const setupRealTimeListeners = useCallback(async (user: any) => {
    // Clean up existing listeners
    [documentChannelRef, chatMessageChannelRef, notesChannelRef,
      recordingsChannelRef, scheduleChannelRef, profileChannelRef,
      quizzesChannelRef].forEach(channelRef => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      });

    if (!user?.id) return;

    // Set up all listeners in parallel for better performance
    await Promise.all([
      setupDocumentListener(user),
      setupChatMessageListener(user),
      setupNotesListener(user),
      setupRecordingsListener(user),
      setupScheduleListener(user),
      setupProfileListener(user),
      setupQuizzesListener(user)
    ]);
  }, []);

  // Optimized real-time listeners with better error handling
  const setupDocumentListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`documents_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${user.id}` },
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
            }
          }
        )
        .subscribe();

      documentChannelRef.current = channel;
    } catch (error) {
      console.error('Error setting up document listener:', error);
    }
  }, []);

  const setupChatMessageListener = useCallback(async (user: any) => {
    try {
        const channel = supabase
            .channel(`chat_messages_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const formatMessage = (msg: any): Partial<Message> => ({
                        id: msg.id,
                        content: msg.content,
                        role: msg.role as 'user' | 'assistant',
                        timestamp: msg.timestamp,
                        isError: msg.is_error,
                        attachedDocumentIds: msg.attached_document_ids,
                        attachedNoteIds: msg.attached_note_ids,
                        imageUrl: msg.image_url,
                        imageMimeType: msg.image_mime_type,
                        session_id: msg.session_id,
                        has_been_displayed: msg.has_been_displayed
                    });

                     if (payload.eventType === 'INSERT') {
                        const newMessage = formatMessage(payload.new) as Message;
                        // console.log('[useAppData] New message received via realtime:', newMessage);
                        
                        setChatMessages(prevMessages => {
                            const exists = prevMessages.some(msg => msg.id === newMessage.id);
                            if (exists) {
                                // console.log('[useAppData] Message already exists, updating if needed');
                                return prevMessages.map(msg => 
                                    msg.id === newMessage.id 
                                        ? { ...msg, ...newMessage }
                                        : msg
                                );
                            }
                            
                            // console.log('[useAppData] Adding new message to state');
                            const updatedMessages = [...prevMessages, newMessage];
                            updatedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                            return updatedMessages;
                        });
                        
                        // Note: replaceOptimisticMessage should be passed from parent component if needed
                    } else if (payload.eventType === 'UPDATE') {
                      const updated = payload.new as any;
                      setChatMessages(prev => prev.map(m => {
                        if (m.id !== updated.id) return m;
                        // Preserve existing content if incoming payload has null/undefined content
                        const preservedContent = (updated.content === null || typeof updated.content === 'undefined') ? m.content : updated.content;
                        return {
                          ...m,
                          ...updated,
                          content: preservedContent
                        };
                      }));
                    } else if (payload.eventType === 'DELETE') {
                        setChatMessages(prevMessages =>
                            prevMessages.filter(msg => msg.id !== payload.old.id)
                        );
                    }
                }
            )
            .subscribe();

        chatMessageChannelRef.current = channel;
    } catch (error) {
        console.error('Error setting up chat message listener:', error);
    }
}, []);


  const setupNotesListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`notes_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
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
    } catch (error) {
      console.error('Error setting up notes listener:', error);
    }
  }, []);

  const setupRecordingsListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`recordings_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'class_recordings', filter: `user_id=eq.${user.id}` },
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
    } catch (error) {
      console.error('Error setting up recordings listener:', error);
    }
  }, []);

  const setupScheduleListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`schedule_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'schedule_items', filter: `user_id=eq.${user.id}` },
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
    } catch (error) {
      console.error('Error setting up schedule listener:', error);
    }
  }, []);

  const setupProfileListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`profile_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newProfile = payload.new as any;
              setUserProfile({
                id: newProfile.id,
                email: newProfile.email || user.email || '',
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
    } catch (error) {
      console.error('Error setting up profile listener:', error);
    }
  }, []);

  const setupQuizzesListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`quizzes_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quizzes', filter: `user_id=eq.${user.id}` },
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
    } catch (error) {
      console.error('Error setting up quizzes listener:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Clear channels
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

  // Computed values
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Enhanced loading state - show progress and what's loading
  const enhancedLoading = loading || loadingPhase.phase !== 'complete';
  const loadingProgress = loadingPhase.progress;
  const loadingMessage = {
    'initial': 'Connecting to your account...',
    'core': 'Loading your notes and documents...',
    'secondary': 'Loading additional content...',
    'complete': 'Ready!'
  }[loadingPhase.phase];

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
    loading: enhancedLoading,
    quizzes,
    currentUser,

    // Enhanced loading states
    dataLoading,
    dataPagination,
    loadingPhase,
    loadingProgress,
    loadingMessage,

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
