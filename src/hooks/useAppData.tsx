// useAppData.tsx - Highly Optimized version with enhanced performance and timeouts
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
// Type definitions
export interface DataLoadingState {
  notes: boolean;
  recordings: boolean;
  scheduleItems: boolean;
  documents: boolean;
  quizzes: boolean;
  profile: boolean;
  folders: boolean;
}
// In useAppData.tsx - Update timeout constants
const API_TIMEOUT = 45000; // Increase from 30 to 45 seconds
const LOADING_TIMEOUT = 30000; // Increase from 10 to 30 seconds for loading states
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

// Type definitions for Supabase responses
// Update Supabase response types
interface SupabaseDocument {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  file_url: string;
  content_extracted: string | null;
  user_id: string;
  type: string;
  processing_status: string | null;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
  folder_items?: Array<{ folder_id: string }>;
  folder_ids?: string[];
  processing_started_at?: string | null;
  processing_completed_at?: string | null;
  processing_metadata?: any | null;
  extraction_model_used?: string | null;
  total_processing_time_ms?: number | null;
}

interface SupabaseNote {
  id: string;
  title: string;
  content: string | null;
  document_id: string | null;
  user_id: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
}

interface SupabaseRecording {
  id: string;
  title: string;
  subject: string;
  date: string;
  duration: number;
  audio_url: string;
  transcript: string;
  summary: string;
  created_at: string;
  user_id: string;
  document_id: string;
}

interface SupabaseScheduleItem {
  id: string;
  title: string;
  subject: string;
  start_time: string;
  end_time: string;
  type: string;
  description: string;
  location: string;
  color: string;
  user_id: string;
  created_at: string;
}

interface SupabaseQuiz {
  id: string;
  title: string;
  questions: any[];
  class_id: string;
  user_id: string;
  created_at: string;
}

interface SupabaseFolder {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface SupabaseProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  learning_style: string;
  learning_preferences: any;
  created_at: string;
  updated_at: string;
}

// Helper function for timeout handling
const withTimeout = async <T,>(
  supabaseQuery: any,
  timeoutMs: number,
  errorMessage: string
): Promise<{ data: T | null; error: any }> => {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${errorMessage} (timeout after ${timeoutMs}ms)`)), timeoutMs)
    );

    // Execute the Supabase query and race it against the timeout
    const result = await Promise.race([supabaseQuery, timeoutPromise]);
    return result;
  } catch (error) {
    return { data: null, error };
  }
};

// Custom hook for managing loading states with timeouts
// In useAppData.tsx - Enhanced useLoadingState
const useLoadingState = (initialState: DataLoadingState) => {
  const [loading, setLoading] = useState<DataLoadingState>(initialState);
  const timeoutRefs = useRef<Map<keyof DataLoadingState, NodeJS.Timeout>>(new Map());

  const setLoadingWithTimeout = useCallback((key: keyof DataLoadingState, value: boolean, isCritical = false) => {
    setLoading(prev => ({ ...prev, [key]: value }));

    // Clear existing timeout for this key
    const existingTimeout = timeoutRefs.current.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Only set timeout for critical operations or if it's taking too long
    if (value) {
      const timeout = setTimeout(() => {
        // Only log warning for critical operations or if it's really stuck
        if (isCritical) {
          console.warn(`Loading state timeout for ${key} - resetting loading state`);
        }
        setLoading(prev => ({ ...prev, [key]: false }));
        timeoutRefs.current.delete(key);
      }, isCritical ? LOADING_TIMEOUT : LOADING_TIMEOUT * 2); // Longer timeout for non-critical

      timeoutRefs.current.set(key, timeout);
    } else {
      timeoutRefs.current.delete(key);
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  return [loading, setLoadingWithTimeout] as const;
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
  const [activeTab, setActiveTab] = useState<'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'social' | 'settings' | 'quizzes' | 'dashboard'>('notes');
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
  const [dataLoading, setDataLoading] = useLoadingState({
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
  const [dataErrors, setDataErrors] = useState<Record<string, string>>({});

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

  // Enhanced auth listener with cleanup and timeout
  useEffect(() => {
    const authController = new AbortController();

    const setupAuthListener = async () => {
      try {
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          const newUser = session?.user || null;

          // Only update if user actually changed
          if (newUser?.id !== currentUser?.id) {
            setCurrentUser(newUser);
          }
        });

        // Initial check with error handling and timeout
        const getUserPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timeout')), API_TIMEOUT)
        );

        const { data: { user } } = await Promise.race([getUserPromise, timeoutPromise]);

        if (user?.id !== currentUser?.id) {
          setCurrentUser(user || null);
        }

        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Auth setup error:', error);
        if (error instanceof Error && error.message.includes('timeout')) {
          console.warn('Auth check timed out, continuing with current state');
        }
      }
    };

    setupAuthListener();

    return () => {
      authController.abort();
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
    setDataLoading('notes', false);
    setDataLoading('recordings', false);
    setDataLoading('scheduleItems', false);
    setDataLoading('documents', false);
    setDataLoading('quizzes', false);
    setDataLoading('profile', false);
    setDataLoading('folders', false);

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
  }, [cleanup, setDataLoading]);

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

  // Enhanced documents loading for chat dependency with timeout
  // In useAppData.tsx - Update loadDocumentsPage
  // In useAppData.tsx - Fix document loading
  const loadDocumentsPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.documents || !dataPagination.documents.hasMore) return;

    setDataLoading('documents', true);

    try {
      const offset = isInitial ? 0 : dataPagination.documents.offset;
      const limit = isInitial ? INITIAL_LOAD_LIMITS.documents : LOAD_MORE_LIMITS.documents;

      const { data, error } = await withTimeout<any[]>(
        supabase
          .from('documents')
          .select(`*, folder_items:document_folder_items!document_folder_items_document_id_fkey (folder_id)`, { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
        API_TIMEOUT,
        'Failed to load documents'
      );

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
          type: doc.type as Document['type'],
          processing_status: doc.processing_status || 'pending',
          processing_error: doc.processing_error || null,
          created_at: doc.created_at, // Keep as string
          updated_at: doc.updated_at, // Keep as string
          folder_ids: doc.folder_items?.map((item: any) => item.folder_id) || [],
          // Add missing fields with defaults
          processing_started_at: doc.processing_started_at || null,
          processing_completed_at: doc.processing_completed_at || null,
          processing_metadata: doc.processing_metadata || null,
          extraction_model_used: doc.extraction_model_used || null,
          total_processing_time_ms: doc.total_processing_time_ms || null,
        }));

        setDocuments(prev => isInitial ? formattedDocuments : [...prev, ...formattedDocuments]);

        const newOffset = offset + data.length;
        const hasMore = data.length === limit;

        setDataPagination(prev => ({
          ...prev,
          documents: {
            hasMore,
            offset: newOffset,
            total: prev.documents.total + data.length
          }
        }));

        if (isInitial || !dataLoaded.has('documents')) {
          setDataLoaded(prev => new Set([...prev, 'documents']));
        }
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      if (isInitial) {
        toast.error('Failed to load documents');
      }
    } finally {
      setDataLoading('documents', false);
    }
  }, [dataLoaded, dataLoading.documents, dataPagination.documents, setDataLoading]);
  // Optimized recordings loading with timeout
  const loadRecordingsPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.recordings) return;
    if (!isInitial && !dataPagination.recordings.hasMore) return;

    setDataLoading('recordings', true);

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.recordings : LOAD_MORE_LIMITS.recordings;
      const offset = isInitial ? 0 : dataPagination.recordings.offset;

      const { data, error } = await withTimeout<SupabaseRecording[]>(
        supabase
          .from('class_recordings')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
        API_TIMEOUT,
        'Failed to load recordings'
      );

      if (error) throw error;

      if (data) {
        const formattedRecordings: ClassRecording[] = data.map(recording => ({
          id: recording.id,
          title: recording.title || 'Untitled Recording',
          subject: recording.subject || '',
          date: recording.date,
          duration: recording.duration || 0,
          audioUrl: recording.audio_url || '',
          transcript: recording.transcript || '',
          summary: recording.summary || '',
          created_at: recording.created_at,
          userId: recording.user_id,
          document_id: recording.document_id
        }));

        if (isInitial) {
          setRecordings(formattedRecordings);
        } else {
          setRecordings(prev => [...prev, ...formattedRecordings]);
        }

        const newOffset = offset + formattedRecordings.length;
        const hasMore = formattedRecordings.length === limit;

        setDataPagination(prev => ({
          ...prev,
          recordings: { hasMore, offset: newOffset, total: prev.recordings.total + formattedRecordings.length }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'recordings']));
    } catch (error) {
      console.error('Error loading recordings:', error);
      // Don't show error for background loading
    } finally {
      setDataLoading('recordings', false);
    }
  }, [dataLoading.recordings, dataPagination.recordings, setDataLoading]);

  // Optimized schedule loading with timeout
  const loadSchedulePage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.scheduleItems) return;
    if (!isInitial && !dataPagination.scheduleItems.hasMore) return;

    setDataLoading('scheduleItems', true);

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.scheduleItems : LOAD_MORE_LIMITS.scheduleItems;
      const offset = isInitial ? 0 : dataPagination.scheduleItems.offset;

      const { data, error } = await withTimeout<SupabaseScheduleItem[]>(
        supabase
          .from('schedule_items')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('start_time', { ascending: true })
          .range(offset, offset + limit - 1),
        API_TIMEOUT,
        'Failed to load schedule items'
      );

      if (error) throw error;

      if (data) {
        const formattedItems: ScheduleItem[] = data.map(item => ({
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
          created_at: item.created_at
        }));

        if (isInitial) {
          setScheduleItems(formattedItems);
        } else {
          setScheduleItems(prev => [...prev, ...formattedItems]);
        }

        const newOffset = offset + formattedItems.length;
        const hasMore = formattedItems.length === limit;

        setDataPagination(prev => ({
          ...prev,
          scheduleItems: { hasMore, offset: newOffset, total: prev.scheduleItems.total + formattedItems.length }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'scheduleItems']));
    } catch (error) {
      console.error('Error loading schedule items:', error);
      // Don't show error for background loading
    } finally {
      setDataLoading('scheduleItems', false);
    }
  }, [dataLoading.scheduleItems, dataPagination.scheduleItems, setDataLoading]);

  // Optimized quizzes loading with timeout
  const loadQuizzesPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.quizzes) return;
    if (!isInitial && !dataPagination.quizzes.hasMore) return;

    setDataLoading('quizzes', true);

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.quizzes : LOAD_MORE_LIMITS.quizzes;
      const offset = isInitial ? 0 : dataPagination.quizzes.offset;

      const { data, error } = await withTimeout<SupabaseQuiz[]>(
        supabase
          .from('quizzes')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
        API_TIMEOUT,
        'Failed to load quizzes'
      );

      if (error) throw error;

      if (data) {
        const formattedQuizzes: Quiz[] = data.map(quiz => ({
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
          created_at: quiz.created_at
        }));

        if (isInitial) {
          setQuizzes(formattedQuizzes);
        } else {
          setQuizzes(prev => [...prev, ...formattedQuizzes]);
        }

        const newOffset = offset + formattedQuizzes.length;
        const hasMore = formattedQuizzes.length === limit;

        setDataPagination(prev => ({
          ...prev,
          quizzes: { hasMore, offset: newOffset, total: prev.quizzes.total + formattedQuizzes.length }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'quizzes']));
    } catch (error) {
      console.error('Error loading quizzes:', error);
      // Don't show error for background loading
    } finally {
      setDataLoading('quizzes', false);
    }
  }, [dataLoading.quizzes, dataPagination.quizzes, setDataLoading]);

  // Optimized folder loading with caching and timeout
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

    setDataLoading('folders', true);

    try {
      const { data, error } = await withTimeout<SupabaseFolder[]>(
        supabase
          .from('document_folders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        API_TIMEOUT,
        'Failed to load folders'
      );

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
      setDataLoading('folders', false);
    }
  }, [dataLoading.folders, getCachedData, setCachedData, setDataLoading]);

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

  // Enhanced user profile loading with better caching and timeout
  const loadUserProfile = useCallback(async (user: any) => {
    if (dataLoaded.has('profile')) return;

    const cacheKey = `profile_${user.id}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      setUserProfile(cached);
      setDataLoaded(prev => new Set([...prev, 'profile']));
      return;
    }

    setDataLoading('profile', true);

    try {
      const { data: profileData, error: profileError } = await withTimeout<SupabaseProfile>(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
        API_TIMEOUT,
        'Failed to load user profile'
      );

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
            await withTimeout(
              supabase.from('profiles').insert(finalProfile),
              API_TIMEOUT,
              'Failed to create profile'
            );
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
      setDataLoading('profile', false);
    }
  }, [dataLoaded, getCachedData, setCachedData, setDataLoading]);

  // Optimized notes loading with batched queries and timeout
  // Fix the notes loading function
  const loadNotesPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.notes) return;
    if (!isInitial && !dataPagination.notes.hasMore) return;

    setDataLoading('notes', true);
    setDataErrors(prev => ({ ...prev, notes: '' }));

    const cacheKey = `notes_${userId}_${isInitial ? 'initial' : dataPagination.notes.offset}`;
    const cached = getCachedData(cacheKey);
    if (cached && isInitial) {
      setNotes(cached.notes);
      if (cached.activeNote && !activeNote) setActiveNote(cached.activeNote);
      setDataPagination(prev => ({ ...prev, notes: cached.pagination }));
      setDataLoaded(prev => new Set([...prev, 'notes']));
      return;
    }

    const controller = new AbortController();
    abortControllersRef.current.set(`notes_${userId}`, controller);

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.notes : LOAD_MORE_LIMITS.notes;
      const offset = isInitial ? 0 : dataPagination.notes.offset;

      const { data, error } = await withTimeout<any[]>(
        supabase
          .from('notes')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1),
        API_TIMEOUT,
        'Failed to load notes'
      );

      if (error) throw error;

      if (data) {
        const formattedNotes: Note[] = data.map(note => ({
          id: note.id,
          title: note.title || 'Untitled Note',
          content: note.content || '',
          document_id: note.document_id || null,
          user_id: note.user_id,
          category: note.category || 'general',
          tags: note.tags || [],
          created_at: note.created_at,
          updated_at: note.updated_at,
          ai_summary: note.ai_summary || '',
        }));

        let newActiveNote = activeNote;
        if (isInitial && formattedNotes.length > 0 && !activeNote) {
          newActiveNote = formattedNotes.sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )[0];
        }

        if (isInitial) {
          setNotes(formattedNotes);
          if (newActiveNote) setActiveNote(newActiveNote);
        } else {
          setNotes(prev => [...prev, ...formattedNotes]);
        }

        const newOffset = isInitial ? formattedNotes.length : offset + formattedNotes.length;
        const hasMore = formattedNotes.length === limit;

        const newPagination = { hasMore, offset: newOffset, total: dataPagination.notes.total + formattedNotes.length };
        setDataPagination(prev => ({ ...prev, notes: newPagination }));

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
      console.error('Error loading notes:', error);
      setDataErrors(prev => ({ ...prev, notes: 'Failed to load notes' }));

      if (isInitial) {
        toast.error('Failed to load notes');
      }
    } finally {
      abortControllersRef.current.delete(`notes_${userId}`);
      setDataLoading('notes', false);
    }
  }, [dataLoading.notes, dataPagination.notes, activeNote, getCachedData, setCachedData, setDataLoading]);
  // [Rest of the real-time listener functions - setupDocumentListener, setupChatMessageListener, etc.]
  // These would need to be implemented similarly with proper typing

  // Enhanced progressive loading with better error handling and timeouts
  // In useAppData.tsx - Update startProgressiveDataLoading
  const startProgressiveDataLoading = useCallback(async (user: any) => {
    if (!user?.id) return;

    setLoading(true);
    setLoadingPhase({ phase: 'initial', progress: 10 });

    try {
      // Phase 1: Critical data (profile + real-time setup)
      await Promise.race([
        Promise.all([
          loadUserProfile(user),
          // setupRealTimeListeners(user)
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Initial data loading timeout')), API_TIMEOUT)
        )
      ]);

      setLoadingPhase({ phase: 'core', progress: 30 });

      // Phase 2: Core content (notes are critical, documents can load in background)
      await Promise.race([
        Promise.all([
          loadNotesPage(user.id, true), // Critical
          loadFolders(user.id, true),   // Critical for navigation
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Core data loading timeout')), API_TIMEOUT)
        )
      ]);

      setLoadingPhase({ phase: 'secondary', progress: 60 });

      // Phase 3: Start documents loading but don't wait for it
      const documentsPromise = loadDocumentsPage(user.id, true).catch(error => {
        console.warn('Documents loading failed or was slow:', error);
        // Don't throw error here, just log it
      });

      // Phase 4: Secondary data (non-blocking)
      setTimeout(() => {
        Promise.allSettled([
          documentsPromise,
          loadRecordingsPage(user.id, true),
          loadSchedulePage(user.id, true),
          loadQuizzesPage(user.id, true)
        ]).then(() => {
          setLoadingPhase({ phase: 'complete', progress: 100 });
        }).catch(() => {
          setLoadingPhase({ phase: 'complete', progress: 100 });
        });
      }, 500); // Small delay to prioritize core data

      // UI is ready after core data (notes + folders)
      setLoading(false);

    } catch (error) {
      console.error('❌ Error loading core user data:', error);
      toast.error('Failed to load some data. Please refresh to try again.');
      setLoading(false);
      setLoadingPhase({ phase: 'complete', progress: 100 });
    }
  }, [loadUserProfile, loadNotesPage, loadDocumentsPage, loadFolders, loadRecordingsPage, loadSchedulePage, loadQuizzesPage]);
  // [Rest of the implementation continues...]

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
    dataErrors,
    clearError: useCallback((dataType: string) => {
      setDataErrors(prev => ({ ...prev, [dataType]: '' }));
    }, []),
    retryLoading: useCallback((dataType: keyof DataLoadingState) => {
      if (!currentUser?.id) return;

      setDataErrors(prev => ({ ...prev, [dataType]: '' }));

      const loaders = {
        notes: () => loadNotesPage(currentUser.id, true),
        recordings: () => loadRecordingsPage(currentUser.id, true),
        scheduleItems: () => loadSchedulePage(currentUser.id, true),
        documents: () => loadDocumentsPage(currentUser.id, true),
        quizzes: () => loadQuizzesPage(currentUser.id, true),
      };
      if (loaders[dataType]) {
        loaders[dataType]();
      }
    }, [currentUser, loadNotesPage, loadRecordingsPage, loadSchedulePage, loadDocumentsPage, loadQuizzesPage]),
    // Lazy loading functions
    loadDataIfNeeded: useCallback((dataType: keyof DataLoadingState) => {
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
    }, [currentUser, dataLoaded, dataLoading, loadRecordingsPage, loadSchedulePage, loadDocumentsPage, loadQuizzesPage, loadNotesPage, loadUserProfile, loadFolders]),


    // Load more functions
    loadMoreNotes: useCallback(() => currentUser?.id && loadNotesPage(currentUser.id, false), [currentUser, loadNotesPage]),
    loadMoreRecordings: useCallback(() => currentUser?.id && loadRecordingsPage(currentUser.id, false), [currentUser, loadRecordingsPage]),
    loadMoreDocuments: useCallback(() => currentUser?.id && loadDocumentsPage(currentUser.id, false), [currentUser, loadDocumentsPage]),
    loadMoreSchedule: useCallback(() => currentUser?.id && loadSchedulePage(currentUser.id, false), [currentUser, loadSchedulePage]),
    loadMoreQuizzes: useCallback(() => currentUser?.id && loadQuizzesPage(currentUser.id, false), [currentUser, loadQuizzesPage]),

    // Utility functions
    loadFolders,
    // Fix specific documents loading
    loadSpecificDocuments: useCallback(async (userId: string, ids: string[]) => {
      if (!ids.length) return;

      const cacheKey = `specific_docs_${userId}_${ids.sort().join('_')}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        setDocuments(prev => mergeDocuments(prev, cached));
        return;
      }

      setDataLoading('documents', true);

      try {
        const { data, error } = await withTimeout<any[]>(
          supabase
            .from('documents')
            .select('*')
            .eq('user_id', userId)
            .in('id', ids),
          API_TIMEOUT,
          'Failed to load specific documents'
        );

        if (error) throw error;

        const newDocs: Document[] = (data || []).map(doc => ({
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
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          folder_ids: doc.folder_ids || [],
          processing_started_at: doc.processing_started_at || null,
          processing_completed_at: doc.processing_completed_at || null,
          processing_metadata: doc.processing_metadata || null,
          extraction_model_used: doc.extraction_model_used || null,
          total_processing_time_ms: doc.total_processing_time_ms || null,
        }));

        setDocuments(prev => {
          const merged = mergeDocuments(prev, newDocs);
          setCachedData(cacheKey, newDocs);
          return merged;
        });
      } catch (error) {
        console.error('Error loading specific documents:', error);
      } finally {
        setDataLoading('documents', false);
      }
    }, [getCachedData, setCachedData, setDataLoading]),

    // Fix specific notes loading
    loadSpecificNotes: useCallback(async (userId: string, ids: string[]) => {
      if (!ids.length) return;

      const cacheKey = `specific_notes_${userId}_${ids.sort().join('_')}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        setNotes(prev => mergeNotes(prev, cached));
        return;
      }

      setDataLoading('notes', true);

      try {
        const { data, error } = await withTimeout<any[]>(
          supabase
            .from('notes')
            .select('*')
            .eq('user_id', userId)
            .in('id', ids)
            .order('updated_at', { ascending: false }),
          API_TIMEOUT,
          'Failed to load specific notes'
        );

        if (error) throw error;

        const transformedNotes: Note[] = (data || []).map(item => ({
          id: item.id,
          document_id: item.document_id,
          title: item.title,
          content: item.content,
          category: item.category,
          ai_summary: item.ai_summary,
          tags: item.tags,
          created_at: item.created_at,
          updated_at: item.updated_at,
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
        setDataLoading('notes', false);
      }
    }, [getCachedData, setCachedData, setDataLoading]),
  };
};

// Helper functions for merging data
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