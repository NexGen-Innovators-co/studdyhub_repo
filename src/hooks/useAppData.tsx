// useAppData.tsx - Highly Optimized version with enhanced performance
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz, QuizQuestion } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { DocumentFolder, FolderTreeNode } from '../types/Folder';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import { clearCache } from '@/utils/socialCache';

// Enhanced pagination with memory optimization
const INITIAL_LOAD_LIMITS = {
  notes: 12, // Reduced for faster initial load
  recordings: 6,
  scheduleItems: 20,
  documents: 10,
  chatMessages: 0,
  quizzes: 6,
  folders: 50 // Added for folders
};

const LOAD_MORE_LIMITS = {
  notes: 20,
  recordings: 12,
  scheduleItems: 30,
  documents: 15,
  chatMessages: 50,
  quizzes: 12,
  folders: 100
};

// Priority-based loading with dependencies
const LOADING_PRIORITIES = {
  profile: 1,
  notes: 2,
  documents: 3,
  folders: 4, // Added folders priority
  recordings: 5,
  scheduleItems: 6,
  quizzes: 7
};

// Cache configuration
const CACHE_CONFIG = {
  enabled: true,
  maxAge: 5 * 60 * 1000, // 5 minutes
  maxSize: 100 // Max items per cache
};

export const useAppData = () => {
  // State management with lazy initialization
  const [notes, setNotes] = useState<Note[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'social' | 'settings'>('notes');
  const [isAILoading, setIsAILoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);

  // Real-time subscription refs
  const documentChannelRef = useRef<any>(null);
  const chatMessageChannelRef = useRef<any>(null);
  const notesChannelRef = useRef<any>(null);
  const recordingsChannelRef = useRef<any>(null);
  const scheduleChannelRef = useRef<any>(null);
  const profileChannelRef = useRef<any>(null);
  const quizzesChannelRef = useRef<any>(null);
  const foldersChannelRef = useRef<any>(null);
  const folderItemsChannelRef = useRef<any>(null);


  // Enhanced loading state with batched updates
  const [dataLoaded, setDataLoaded] = useState<Set<keyof DataLoadingState>>(new Set());
  const [dataLoading, setDataLoading] = useState<DataLoadingState>({
    notes: false,
    recordings: false,
    scheduleItems: false,
    documents: false,
    quizzes: false,
    profile: false,
    folders: false
  });

  // Progressive loading with better progress tracking
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>({
    phase: 'initial',
    progress: 0
  });

  // Optimized pagination state
  const [dataPagination, setDataPagination] = useState<DataPaginationState>({
    notes: { hasMore: true, offset: 0, total: 0 },
    recordings: { hasMore: true, offset: 0, total: 0 },
    scheduleItems: { hasMore: true, offset: 0, total: 0 },
    documents: { hasMore: true, offset: 0, total: 0 },
    quizzes: { hasMore: true, offset: 0, total: 0 },
    folders: { hasMore: false, offset: 0, total: 0 }
  });

  // Enhanced real-time subscription refs with connection management
  const channelRefs = useRef<Record<string, any>>({});

  // Performance optimization refs
  const loadingQueueRef = useRef<Set<keyof DataLoadingState>>(new Set());
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dataCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Add this with your other refs
  const isCurrentlySendingRef = useRef(false);
  // Memoized selectors for better performance
  const filteredNotes = useMemo(() => {
    if (!searchQuery && selectedCategory === 'all') return notes;

    const searchLower = searchQuery.toLowerCase();
    return notes.filter(note => {
      const matchesSearch = note.title.toLowerCase().includes(searchLower) ||
        note.content.toLowerCase().includes(searchLower);
      const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [notes, searchQuery, selectedCategory]);

  // Enhanced auth listener with cleanup
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user || null;

      // Only update if user actually changed
      if (newUser?.id !== currentUser?.id) {
        setCurrentUser(newUser);
      }
    });

    // Initial check with error handling
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id !== currentUser?.id) {
        setCurrentUser(user || null);
      }
    }).catch(console.error);

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [currentUser?.id]); // Only depend on user ID

  // Optimized user change detection with debouncing
  useEffect(() => {
    if (currentUser?.id && currentUser.id !== lastUserId) {
      console.log('🔄 User changed, starting progressive data loading...');
      setLastUserId(currentUser.id);

      // Clear cache and data
      clearCache();
      dataCacheRef.current.clear();
      clearAllData();

      // Start progressive loading
      startProgressiveDataLoading(currentUser);
    } else if (!currentUser && lastUserId !== null) {
      console.log('🚪 User logged out, clearing data...');
      setLastUserId(null);
      clearAllData();
      clearCache();
      dataCacheRef.current.clear();
    }
  }, [currentUser, lastUserId]);

  // Cleanup function for abort controllers and timeouts
  const cleanup = useCallback(() => {
    // Clear all abort controllers
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();

    // Clear timeouts
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    // Clear loading queue
    loadingQueueRef.current.clear();

    // Remove all real-time channels
    Object.values(channelRefs.current).forEach(channel => {
      if (channel) supabase.removeChannel(channel);
    });
    channelRefs.current = {};
  }, []);

  const clearAllData = useCallback(() => {
    cleanup(); // Cleanup before clearing data

    setNotes([]);
    setRecordings([]);
    setScheduleItems([]);
    setChatMessages([]);
    setDocuments([]);
    setUserProfile(null);
    setQuizzes([]);
    setActiveNote(null);
    setFolders([]);
    setFolderTree([]);

    setDataLoaded(new Set());
    setDataLoading({
      notes: false,
      recordings: false,
      scheduleItems: false,
      documents: false,
      quizzes: false,
      profile: false,
      folders: false
    });

    setDataPagination({
      notes: { hasMore: true, offset: 0, total: 0 },
      recordings: { hasMore: true, offset: 0, total: 0 },
      scheduleItems: { hasMore: true, offset: 0, total: 0 },
      documents: { hasMore: true, offset: 0, total: 0 },
      quizzes: { hasMore: true, offset: 0, total: 0 },
      folders: { hasMore: false, offset: 0, total: 0 }
    });

    setLoadingPhase({ phase: 'initial', progress: 0 });
    setLoading(false);
  }, [cleanup]);

  // Cache management utilities
  const getCachedData = useCallback((key: string) => {
    const cached = dataCacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.maxAge) {
      return cached.data;
    }
    dataCacheRef.current.delete(key); // Remove expired cache
    return null;
  }, []);

  const setCachedData = useCallback((key: string, data: any) => {
    // Manage cache size
    if (dataCacheRef.current.size >= CACHE_CONFIG.maxSize) {
      const firstKey = dataCacheRef.current.keys().next().value;
      dataCacheRef.current.delete(firstKey);
    }

    dataCacheRef.current.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);

  // Enhanced documents loading for chat dependency
  const loadDocumentsPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.documents || !dataPagination.documents.hasMore) return;

    setDataLoading(prev => ({ ...prev, documents: true }));

    try {
      const offset = isInitial ? 0 : dataPagination.documents.offset;
      const limit = isInitial ? INITIAL_LOAD_LIMITS.documents : LOAD_MORE_LIMITS.documents;

      const { data, count, error } = await supabase
        .from('documents')
        .select(`
          *,
          folder_items:document_folder_items!document_folder_items_document_id_fkey (folder_id)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      if (data) {
        const formattedDocuments: Document[] = data.map(doc => ({
          id: doc.id,
          title: doc.title,
          file_name: doc.file_name,
          file_type: doc.file_type,
          file_size: doc.file_size || 0,
          file_url: doc.file_url,
          content_extracted: doc.content_extracted || '',
          user_id: doc.user_id,
          type: doc.type,
          processing_status: doc.processing_status || 'pending',
          processing_error: doc.processing_error || null,
          created_at: doc.created_at || new Date().toISOString(),
          updated_at: doc.updated_at || new Date().toISOString(),
          folder_ids: doc.folder_items?.map(item => item.folder_id) || [],
        }));

        setDocuments(prev => isInitial ? formattedDocuments : [...prev, ...formattedDocuments]);

        const newOffset = offset + data.length;
        const hasMore = count ? newOffset < count : data.length === limit;

        setDataPagination(prev => ({
          ...prev,
          documents: {
            hasMore,
            offset: newOffset,
            total: count || 0
          }
        }));

        if (isInitial || !dataLoaded.has('documents')) {
          setDataLoaded(prev => new Set([...prev, 'documents']));
        }
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setDataLoading(prev => ({ ...prev, documents: false }));
    }
  }, [dataLoaded, dataLoading.documents, dataPagination.documents]);

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


  // Enhanced progressive loading with better error handling
  const startProgressiveDataLoading = useCallback(async (user: any) => {
    if (!user?.id) return;

    setLoading(true);
    setLoadingPhase({ phase: 'initial', progress: 10 });

    try {
      // Phase 1: Critical data (profile + real-time setup)
      await Promise.all([
        loadUserProfile(user),
        setupRealTimeListeners(user)
      ]);

      setLoadingPhase({ phase: 'core', progress: 30 });

      // Phase 2: Core content (notes + documents + folders)
      await Promise.all([
        loadNotesPage(user.id, true),
        loadDocumentsPage(user.id, true),
        loadFolders(user.id, true),
      ]);

      setLoadingPhase({ phase: 'secondary', progress: 60 });

      // Phase 3: Secondary data (non-blocking, lower priority)
      setTimeout(() => {
        Promise.allSettled([
          loadRecordingsPage(user.id, true),
          loadSchedulePage(user.id, true),
          loadQuizzesPage(user.id, true)
        ]).then(() => {
          setLoadingPhase({ phase: 'complete', progress: 100 });
        }).catch(() => {
          setLoadingPhase({ phase: 'complete', progress: 100 });
        });
      }, 150); // Increased delay for better UI responsiveness

      // UI is ready after core data
      setLoading(false);

    } catch (error) {
      console.error('❌ Error loading core user data:', error);
      toast.error('Failed to load some data. Please refresh to try again.');
      setLoading(false);
      setLoadingPhase({ phase: 'complete', progress: 100 });
    }
  }, []);

  // Optimized folder loading with caching
  const loadFolders = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.folders) return;

    const cacheKey = `folders_${userId}`;
    const cached = getCachedData(cacheKey);
    if (cached && isInitial) {
      setFolders(cached.folders);
      setFolderTree(cached.tree);
      setDataLoaded(prev => new Set([...prev, 'folders']));
      return;
    }

    setDataLoading(prev => ({ ...prev, folders: true }));

    try {
      const { data, error } = await supabase
        .from('document_folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedFolders: DocumentFolder[] = data.map(folder => ({
          id: folder.id,
          user_id: folder.user_id,
          name: folder.name,
          parent_folder_id: folder.parent_folder_id,
          color: folder.color || '#3B82F6',
          description: folder.description,
          created_at: folder.created_at,
          updated_at: folder.updated_at,
          isExpanded: false,
        }));

        const tree = buildFolderTree(formattedFolders);

        setFolders(formattedFolders);
        setFolderTree(tree);

        // Cache the result
        setCachedData(cacheKey, { folders: formattedFolders, tree });
      }

      setDataLoaded(prev => new Set([...prev, 'folders']));
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setDataLoading(prev => ({ ...prev, folders: false }));
    }
  }, [dataLoading.folders, getCachedData, setCachedData]);

  // Optimized buildFolderTree with memoization
  const buildFolderTree = useCallback((folders: DocumentFolder[]): FolderTreeNode[] => {
    const folderMap = new Map<string, FolderTreeNode>();
    const rootFolders: FolderTreeNode[] = [];

    // First pass: create all nodes
    folders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        children: [],
        documents: [],
        path: [],
        level: 0,
      });
    });

    // Second pass: build hierarchy
    folders.forEach(folder => {
      const node = folderMap.get(folder.id)!;

      if (folder.parent_folder_id) {
        const parent = folderMap.get(folder.parent_folder_id);
        if (parent) {
          parent.children.push(node);
          node.path = [...parent.path, parent.id];
          node.level = parent.level + 1;
        }
      } else {
        rootFolders.push(node);
      }
    });

    return rootFolders;
  }, []);

  // Enhanced user profile loading with better caching
  const loadUserProfile = useCallback(async (user: any) => {
    if (dataLoaded.has('profile')) return;

    const cacheKey = `profile_${user.id}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      setUserProfile(cached);
      setDataLoaded(prev => new Set([...prev, 'profile']));
      return;
    }

    setDataLoading(prev => ({ ...prev, profile: true }));

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading user profile:', profileError);
      }

      let finalProfile: UserProfile;

      if (profileData) {
        finalProfile = {
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
        };
      } else {
        // Create default profile
        finalProfile = {
          id: user.id,
          email: user.email || '',
          full_name: '',
          avatar_url: '',
          learning_style: 'visual' as const,
          learning_preferences: {
            explanation_style: 'detailed' as const,
            examples: true,
            difficulty: 'intermediate' as const
          },
          created_at: new Date(),
          updated_at: new Date()
        };

        // Create in background without blocking
        setTimeout(async () => {
          try {
            await supabase.from('profiles').insert(finalProfile);
          } catch (error) {
            console.error('Error creating default profile:', error);
          }
        }, 0);
      }

      setUserProfile(finalProfile);
      setCachedData(cacheKey, finalProfile);
      setDataLoaded(prev => new Set([...prev, 'profile']));

    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      // Fallback profile
      const fallbackProfile: UserProfile = {
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
      };
      setUserProfile(fallbackProfile);
      setDataLoaded(prev => new Set([...prev, 'profile']));
    } finally {
      setDataLoading(prev => ({ ...prev, profile: false }));
    }
  }, [dataLoaded, getCachedData, setCachedData]);

  // Optimized notes loading with batched queries
  const loadNotesPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.notes) return;
    if (!isInitial && !dataPagination.notes.hasMore) return;

    const cacheKey = `notes_${userId}_${isInitial ? 'initial' : dataPagination.notes.offset}`;
    const cached = getCachedData(cacheKey);
    if (cached && isInitial) {
      setNotes(cached.notes);
      if (cached.activeNote && !activeNote) setActiveNote(cached.activeNote);
      setDataPagination(prev => ({ ...prev, notes: cached.pagination }));
      setDataLoaded(prev => new Set([...prev, 'notes']));
      return;
    }

    setDataLoading(prev => ({ ...prev, notes: true }));

    // Create abort controller for this request
    const controller = new AbortController();
    abortControllersRef.current.set(`notes_${userId}`, controller);

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.notes : LOAD_MORE_LIMITS.notes;
      const offset = isInitial ? 0 : dataPagination.notes.offset;

      const { data, error, count } = await supabase
        .from('notes')
        .select('id, title, content, document_id, user_id, category, tags, created_at, updated_at, ai_summary', {
          count: 'exact'
        })
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

        let newActiveNote = activeNote;
        if (isInitial && formattedNotes.length > 0 && !activeNote) {
          newActiveNote = formattedNotes.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
        }

        if (isInitial) {
          setNotes(formattedNotes);
          if (newActiveNote) setActiveNote(newActiveNote);
        } else {
          setNotes(prev => [...prev, ...formattedNotes]);
        }

        const newOffset = isInitial ? formattedNotes.length : offset + formattedNotes.length;
        const hasMore = count ? newOffset < count : formattedNotes.length === limit;

        const newPagination = { hasMore, offset: newOffset, total: count || 0 };
        setDataPagination(prev => ({ ...prev, notes: newPagination }));

        // Cache the result
        if (isInitial) {
          setCachedData(cacheKey, {
            notes: formattedNotes,
            activeNote: newActiveNote,
            pagination: newPagination
          });
        }
      }

      setDataLoaded(prev => new Set([...prev, 'notes']));
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading notes:', error);
        if (isInitial) toast.error('Failed to load notes');
      }
    } finally {
      abortControllersRef.current.delete(`notes_${userId}`);
      setDataLoading(prev => ({ ...prev, notes: false }));
    }
  }, [dataLoading.notes, dataPagination.notes, activeNote, getCachedData, setCachedData]);

  // Enhanced batch loading with better queue management
  const queueDataLoad = useCallback((dataType: keyof DataLoadingState) => {
    if (loadingQueueRef.current.has(dataType)) return;

    loadingQueueRef.current.add(dataType);

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = setTimeout(() => {
      const toLoad = Array.from(loadingQueueRef.current);
      loadingQueueRef.current.clear();

      // Process in priority order with staggered loading
      const sorted = toLoad.sort((a, b) => LOADING_PRIORITIES[a] - LOADING_PRIORITIES[b]);

      sorted.forEach((dataType, index) => {
        setTimeout(() => {
          loadDataIfNeeded(dataType);
        }, index * 75); // Increased stagger for better performance
      });
    }, 150); // Increased delay for better batching
  }, []);

  // Enhanced lazy loading with cache checking
  const loadDataIfNeeded = useCallback((dataType: keyof DataLoadingState) => {
    if (!currentUser?.id || dataLoaded.has(dataType) || dataLoading[dataType]) return;

    const loaders = {
      recordings: () => loadRecordingsPage(currentUser.id, true),
      scheduleItems: () => loadSchedulePage(currentUser.id, true),
      documents: () => loadDocumentsPage(currentUser.id, true),
      quizzes: () => loadQuizzesPage(currentUser.id, true),
      notes: () => loadNotesPage(currentUser.id, true),
      profile: () => !dataLoading.profile && loadUserProfile(currentUser),
      folders: () => loadFolders(currentUser.id, true),
    };

    if (loaders[dataType]) {
      loaders[dataType]();
    }
  }, [currentUser, dataLoaded, dataLoading, loadRecordingsPage, loadSchedulePage, loadDocumentsPage, loadQuizzesPage, loadNotesPage, loadUserProfile, loadFolders]);

  // Smart tab-based loading optimization
  useEffect(() => {
    if (loadingPhase.phase !== 'complete' || !currentUser?.id) return;

    const tabLoadMap = {
      recordings: ['recordings', 'quizzes'],
      schedule: ['scheduleItems'],
      documents: ['documents'],
      settings: ['quizzes'],
      chat: ['documents'],
      notes: [], // Already loaded in core phase
      social: [] // Social handles its own loading
    };

    const typesToLoad = tabLoadMap[activeTab] || [];
    typesToLoad.forEach(type => queueDataLoad(type as keyof DataLoadingState));
  }, [activeTab, loadingPhase.phase, currentUser?.id, queueDataLoad]);


  // Optimized real-time listeners with better error handling
  const setupDocumentListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`documents_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${user.id}` },
          async (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newDoc = payload.new as any;

              // Fetch folder_ids for this document
              const { data: folderItems } = await supabase
                .from('document_folder_items')
                .select('folder_id')
                .eq('document_id', newDoc.id);

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
                created_at: newDoc.created_at.toISOString(),
                updated_at: new Date(newDoc.updated_at).toISOString(),
                folder_ids: folderItems?.map(item => item.folder_id) || [], // ADD THIS
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
            // Skip if we're currently sending a message to avoid duplicates
            if (isCurrentlySendingRef.current) return;

            const formatMessage = (msg: any): Message => ({
              id: msg.id,
              content: msg.content,
              role: msg.role as 'user' | 'assistant',
              timestamp: msg.timestamp,
              isError: msg.is_error,
              attachedDocumentIds: msg.attached_document_ids || [],
              attachedNoteIds: msg.attached_note_ids || [],
              image_url: msg.image_url,
              image_mime_type: msg.image_mime_type,
              session_id: msg.session_id,
              has_been_displayed: msg.has_been_displayed,
              files_metadata: msg.files_metadata,
              isLoading: false
            });

            if (payload.eventType === 'INSERT') {
              const newMessage = formatMessage(payload.new);

              setChatMessages(prevMessages => {
                // Check if message already exists (optimistic message case)
                const exists = prevMessages.some(msg =>
                  msg.id === newMessage.id ||
                  (msg.id.startsWith('optimistic-') && msg.content === newMessage.content && msg.role === newMessage.role)
                );

                if (exists) {
                  // Replace optimistic message with real message
                  return prevMessages.map(msg =>
                    (msg.id.startsWith('optimistic-') && msg.content === newMessage.content && msg.role === newMessage.role)
                      ? newMessage
                      : msg.id === newMessage.id ? newMessage : msg
                  );
                }

                // Add new message and sort by timestamp
                const updatedMessages = [...prevMessages, newMessage];
                return updatedMessages.sort((a, b) =>
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              });

            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as any;
              setChatMessages(prev => {
                return prev.map(m => {
                  if (m.id !== updated.id) return m;

                  // Preserve existing content if incoming payload has null/undefined content
                  const preservedContent = (updated.content === null || typeof updated.content === 'undefined')
                    ? m.content
                    : updated.content;

                  return {
                    ...m,
                    ...updated,
                    content: preservedContent,
                    isLoading: false
                  };
                });
              });
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
              //console.log('[useAppData] Realtime quiz update received:', formattedQuiz);
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

  const setupFoldersListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`folders_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'document_folders', filter: `user_id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newFolder = payload.new as any;
              const formattedFolder: DocumentFolder = {
                id: newFolder.id,
                user_id: newFolder.user_id,
                name: newFolder.name,
                parent_folder_id: newFolder.parent_folder_id,
                color: newFolder.color || '#3B82F6',
                description: newFolder.description,
                created_at: newFolder.created_at,
                updated_at: newFolder.updated_at,
                isExpanded: false,
              };

              setFolders(prevFolders => {
                let updatedFolders;
                const existingIndex = prevFolders.findIndex(folder => folder.id === formattedFolder.id);
                if (existingIndex > -1) {
                  updatedFolders = [...prevFolders];
                  updatedFolders[existingIndex] = formattedFolder;
                } else {
                  updatedFolders = [formattedFolder, ...prevFolders];
                }
                const tree = buildFolderTree(updatedFolders);
                setFolderTree(tree);
                return updatedFolders;
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setFolders(prevFolders => {
                const updatedFolders = prevFolders.filter(folder => folder.id !== deletedId);
                const tree = buildFolderTree(updatedFolders);
                setFolderTree(tree);
                return updatedFolders;
              });
            }
          }
        )
        .subscribe();

      foldersChannelRef.current = channel;
    } catch (error) {
      console.error('Error setting up folders listener:', error);
    }
  }, [buildFolderTree]);

  const setupFolderItemsListener = useCallback(async (user: any) => {
    try {
      const channel = supabase
        .channel(`folder_items_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'document_folder_items' },
          (payload) => {
            const { eventType, new: newItem, old: oldItem } = payload;
            if (eventType === 'INSERT') {
              const { document_id, folder_id } = newItem as any;
              setDocuments(prevDocs => prevDocs.map(doc => {
                if (doc.id === document_id) {
                  const newFolderIds = [...new Set([...(doc.folder_ids || []), folder_id])];
                  return { ...doc, folder_ids: newFolderIds };
                }
                return doc;
              }));
            } else if (eventType === 'DELETE') {
              const { document_id, folder_id } = oldItem as any;
              setDocuments(prevDocs => prevDocs.map(doc => {
                if (doc.id === document_id) {
                  const newFolderIds = (doc.folder_ids || []).filter(id => id !== folder_id);
                  return { ...doc, folder_ids: newFolderIds };
                }
                return doc;
              }));
            } else if (eventType === 'UPDATE') {
              const { document_id, folder_id: new_folder_id } = newItem as any;
              const { folder_id: old_folder_id } = oldItem as any;
              if (new_folder_id !== old_folder_id) {
                setDocuments(prevDocs => prevDocs.map(doc => {
                  if (doc.id === document_id) {
                    let newFolderIds = (doc.folder_ids || []).filter(id => id !== old_folder_id);
                    newFolderIds = [...new Set([...newFolderIds, new_folder_id])];
                    return { ...doc, folder_ids: newFolderIds };
                  }
                  return doc;
                }));
              }
            }
          }
        )
        .subscribe();

      folderItemsChannelRef.current = channel;
    } catch (error) {
      console.error('Error setting up folder items listener:', error);
    }
  }, []);
  // Enhanced real-time listeners setup with connection pooling
  const setupRealTimeListeners = useCallback(async (user: any) => {
    // Clean up existing listeners
    Object.values(channelRefs.current).forEach(channel => {
      if (channel) supabase.removeChannel(channel);
    });
    channelRefs.current = {};

    if (!user?.id) return;

    // Set up listeners in batches to avoid connection limits
    const listenerBatches = [
      [() => setupDocumentListener(user)],
      [() => setupNotesListener(user)],
      [() => setupRecordingsListener(user), () => setupScheduleListener(user)],
      [() => setupProfileListener(user), () => setupQuizzesListener(user)],
      [() => setupFoldersListener(user), () => setupFolderItemsListener(user)]
    ];

    for (const batch of listenerBatches) {
      await Promise.allSettled(batch.map(setup => setup()));
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between batches
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Enhanced loading state computation
  const enhancedLoading = loading || loadingPhase.phase !== 'complete';
  const loadingProgress = loadingPhase.progress;
  const loadingMessage = {
    'initial': 'Connecting to your account...',
    'core': 'Loading your notes and documents...',
    'secondary': 'Loading additional content...',
    'complete': 'Ready!'
  }[loadingPhase.phase];

  // Return optimized hook API
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
    folders,
    folderTree,

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
    setFolders,
    clearAllData,
    // Lazy loading functions
    loadDataIfNeeded,

    // Load more functions
    loadMoreNotes: useCallback(() => currentUser?.id && loadNotesPage(currentUser.id, false), [currentUser, loadNotesPage]),
    loadMoreRecordings: useCallback(() => currentUser?.id && loadRecordingsPage(currentUser.id, false), [currentUser, loadRecordingsPage]),
    loadMoreDocuments: useCallback(() => currentUser?.id && loadDocumentsPage(currentUser.id, false), [currentUser, loadDocumentsPage]),
    loadMoreSchedule: useCallback(() => currentUser?.id && loadSchedulePage(currentUser.id, false), [currentUser, loadSchedulePage]),
    loadMoreQuizzes: useCallback(() => currentUser?.id && loadQuizzesPage(currentUser.id, false), [currentUser, loadQuizzesPage]),

    // Utility functions
    loadFolders,
    loadSpecificDocuments: useCallback(async (userId: string, ids: string[]) => {
      if (!ids.length) return;

      const cacheKey = `specific_docs_${userId}_${ids.sort().join('_')}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        setDocuments(prev => mergeDocuments(prev, cached));
        return;
      }

      setDataLoading(prev => ({ ...prev, documents: true }));

      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', userId)
          .in('id', ids);

        if (error) throw error;

        const newDocs = data || [];
        setDocuments(prev => {
          const merged = mergeDocuments(prev, newDocs);
          setCachedData(cacheKey, newDocs);
          return merged;
        });
      } catch (error) {
        console.error('Error loading specific documents:', error);
      } finally {
        setDataLoading(prev => ({ ...prev, documents: false }));
      }
    }, [getCachedData, setCachedData]),

    loadSpecificNotes: useCallback(async (userId: string, ids: string[]) => {
      if (!ids.length) return;

      const cacheKey = `specific_notes_${userId}_${ids.sort().join('_')}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        setNotes(prev => mergeNotes(prev, cached));
        return;
      }

      setDataLoading(prev => ({ ...prev, notes: true }));

      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', userId)
          .in('id', ids)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const transformedNotes: Note[] = (data || []).map((item: any) => ({
          id: item.id,
          document_id: item.document_id,
          title: item.title,
          content: item.content,
          category: item.category,
          aiSummary: item.ai_summary,
          tags: item.tags,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          user_id: item.user_id,
        }));

        setNotes(prev => {
          const merged = mergeNotes(prev, transformedNotes);
          setCachedData(cacheKey, transformedNotes);
          return merged;
        });
      } catch (error) {
        console.error('Error loading specific notes:', error);
      } finally {
        setDataLoading(prev => ({ ...prev, notes: false }));
      }
    }, [getCachedData, setCachedData]),
  };
};

// Helper functions for merging data
// Helper functions for merging data - FIXED VERSION
const mergeDocuments = (prev: Document[], newDocs: Document[]): Document[] => {
  const uniqueMap = new Map<string, Document>();

  // Add all previous documents
  prev.forEach(doc => uniqueMap.set(doc.id, doc));

  // Add/overwrite with new documents
  newDocs.forEach(doc => uniqueMap.set(doc.id, doc));

  return Array.from(uniqueMap.values());
};

const mergeNotes = (prev: Note[], newNotes: Note[]): Note[] => {
  const uniqueMap = new Map<string, Note>();

  // Add all previous notes
  prev.forEach(note => uniqueMap.set(note.id, note));

  // Add/overwrite with new notes
  newNotes.forEach(note => uniqueMap.set(note.id, note));

  return Array.from(uniqueMap.values());
};
// Type definitions (add these if missing)
export interface DataLoadingState {
  notes: boolean;
  recordings: boolean;
  scheduleItems: boolean;
  documents: boolean;
  quizzes: boolean;
  profile: boolean;
  folders: boolean;
}

interface DataPaginationState {
  notes: { hasMore: boolean; offset: number; total: number };
  recordings: { hasMore: boolean; offset: number; total: number };
  scheduleItems: { hasMore: boolean; offset: number; total: number };
  documents: { hasMore: boolean; offset: number; total: number };
  quizzes: { hasMore: boolean; offset: number; total: number };
  folders: { hasMore: boolean; offset: number; total: number };
}

interface LoadingPhase {
  phase: 'initial' | 'core' | 'secondary' | 'complete';
  progress: number;
}