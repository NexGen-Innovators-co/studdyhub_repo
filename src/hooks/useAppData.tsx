// useAppData.tsx - Highly Optimized version with enhanced performance, timeouts, and connection management
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz, QuizQuestion } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { DocumentFolder, FolderTreeNode } from '../types/Folder';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import { clearCache } from '@/utils/socialCache';
import { offlineStorage, STORES } from '@/utils/offlineStorage';

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

// Enhanced timeout constants with retry logic
const API_TIMEOUT = 15000; // Reduce from 60s to 15s for better UX
const LOADING_TIMEOUT = 30000; // Reduce from 60s to 30s
const MAX_RETRIES = 2; // Maximum retry attempts
const RETRY_DELAY = 2000; // Delay between retries in ms

// Connection quality detection
const CONNECTION_THRESHOLDS = {
  SLOW: 5000, // Response time threshold for slow connection (ms)
  TIMEOUT: 10000, // Response time threshold for timeout (ms)
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

// Toast deduplication - prevent showing same error multiple times
const recentToastsRef: { current: Map<string, number> } = { current: new Map() };
const TOAST_COOLDOWN = 10000; // Don't show same toast within 10 seconds (increased from 3s)

// Request deduplication - prevent simultaneous fetches
const activeRequestsRef: { current: Map<string, Promise<any>> } = { current: new Map() };

// Group similar errors to show one generic message
const errorGroupsRef: { current: Map<string, number> } = { current: new Map() };
const ERROR_GROUP_COOLDOWN = 15000; // 15 seconds between grouped error messages

const getRequestKey = (type: string, userId: string, isInitial: boolean) => {
  return `${type}_${userId}_${isInitial ? 'initial' : 'more'}`;
};

// Get error group key (e.g., "fetch_error", "network_error")
const getErrorGroup = (message: string): string => {
  if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
    return 'network_error';
  }
  if (message.includes('timeout')) {
    return 'timeout_error';
  }
  if (message.includes('CORS') || message.includes('QUIC')) {
    return 'cors_error';
  }
  return 'general_error';
};

const showToastOnce = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
  const now = Date.now();
  const lastShown = recentToastsRef.current.get(message);

  // For errors, also check error group to prevent similar errors
  if (type === 'error') {
    const errorGroup = getErrorGroup(message);
    const lastGroupError = errorGroupsRef.current.get(errorGroup);

    // If this error group was shown recently, skip
    if (lastGroupError && now - lastGroupError < ERROR_GROUP_COOLDOWN) {
      return;
    }

    errorGroupsRef.current.set(errorGroup, now);
  }

  if (!lastShown || now - lastShown > TOAST_COOLDOWN) {
    recentToastsRef.current.set(message, now);
    toast[type](message);

    // Cleanup old entries
    if (recentToastsRef.current.size > 20) {
      const oldestKey = Array.from(recentToastsRef.current.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      recentToastsRef.current.delete(oldestKey);
    }

    // Cleanup old error groups
    if (errorGroupsRef.current.size > 10) {
      const oldestGroupKey = Array.from(errorGroupsRef.current.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      errorGroupsRef.current.delete(oldestGroupKey);
    }
  }
};

// Type definitions for Supabase responses
interface SupabaseScheduleItem {
  id: string;
  title: string | null;
  subject: string | null;
  start_time: string;
  end_time: string;
  type: string;
  description: string | null;
  location: string | null;
  color: string | null;
  user_id: string;
  created_at: string;
  calendar_event_id: string | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  recurrence_interval: number | null;
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
}


// Enhanced withTimeout helper with retry logic
const withRetry = async <T,>(
  supabaseQuery: () => Promise<{ data: T | null; error: any }>,
  errorMessage: string,
  dataType: string,
  retries = MAX_RETRIES
): Promise<{ data: T | null; error: any; retriesUsed: number }> => {
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const timeoutMs = API_TIMEOUT + (attempt * 2000); // Progressive timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${errorMessage} (timeout after ${timeoutMs}ms)`)), timeoutMs)
      );

      const result = await Promise.race([supabaseQuery(), timeoutPromise]);
      return { ...result, retriesUsed: attempt };
    } catch (error) {
      lastError = error;

      // Don't retry if it's not a timeout or network error
      if (!error.message?.includes('timeout') && !error.message?.includes('network')) {
        break;
      }

      // Exponential backoff for retries
      if (attempt < retries) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { data: null, error: lastError, retriesUsed: retries };
};

// Original withTimeout helper (kept for compatibility)
// Helper function for timeout handling - FIXED VERSION
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
    const result = await Promise.race([supabaseQuery, timeoutPromise]) as any;

    // Check if result has the Supabase response structure
    if (result && typeof result === 'object') {
      // Supabase typically returns { data, error } structure
      return {
        data: result.data || null,
        error: result.error || null
      };
    }

    // If result doesn't match expected structure, return as data
    return {
      data: result as T,
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

// Custom hook for managing loading states with timeouts
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
          //console.warn(`Loading state timeout for ${key} - resetting loading state`);
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

// Connection quality monitor hook
const useConnectionMonitor = () => {
  const connectionRef = useRef<'good' | 'slow' | 'poor'>('good');
  const recentResponseTimesRef = useRef<number[]>([]);

  const recordResponseTime = useCallback((responseTime: number) => {
    recentResponseTimesRef.current.push(responseTime);
    if (recentResponseTimesRef.current.length > 10) {
      recentResponseTimesRef.current.shift();
    }

    const avgTime = recentResponseTimesRef.current.reduce((a, b) => a + b, 0) / recentResponseTimesRef.current.length;

    if (avgTime > CONNECTION_THRESHOLDS.TIMEOUT) {
      connectionRef.current = 'poor';
    } else if (avgTime > CONNECTION_THRESHOLDS.SLOW) {
      connectionRef.current = 'slow';
    } else {
      connectionRef.current = 'good';
    }

    return connectionRef.current;
  }, []);

  const getConnectionQuality = useCallback(() => connectionRef.current, []);

  return { recordResponseTime, getConnectionQuality };
};

// Enhanced loading queue system - using Promise.allSettled
const useLoadingQueue = () => {
  const queueRef = useRef<Array<{
    id: string;
    priority: number;
    execute: () => Promise<void>;
    dataType: string;
  }>>([]);

  const isProcessingRef = useRef(false);
  const concurrentLimitRef = useRef(2); // Start with 2 concurrent requests

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;

    isProcessingRef.current = true;

    try {
      // Sort by priority
      queueRef.current.sort((a, b) => a.priority - b.priority);

      // Take items based on concurrent limit
      const itemsToProcess = queueRef.current.splice(0, concurrentLimitRef.current);

      // Execute in parallel but with controlled concurrency
      const promises = itemsToProcess.map(async (item) => {
        try {
          await item.execute();
        } catch (error) {
          throw error; // Re-throw so Promise.allSettled can catch it
        }
      });

      // Use Promise.allSettled to get results with status
      const results = await Promise.allSettled(promises);

      // Calculate success rate from settled results
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const successRate = successful / itemsToProcess.length;

      if (successRate > 0.8 && concurrentLimitRef.current < 4) {
        concurrentLimitRef.current += 1; // Increase concurrency
      } else if (successRate < 0.3 && concurrentLimitRef.current > 1) {
        concurrentLimitRef.current -= 1; // Decrease concurrency
      }

    } finally {
      isProcessingRef.current = false;

      // Process next batch if any
      if (queueRef.current.length > 0) {
        setTimeout(() => processQueue(), 100);
      }
    }
  }, []);

  const addToQueue = useCallback((item: {
    id: string;
    priority: number;
    execute: () => Promise<void>;
    dataType: string;
  }) => {
    // Avoid duplicates
    const exists = queueRef.current.some(existing => existing.id === item.id);
    if (exists) return;

    queueRef.current.push(item);

    // Trigger processing if not already processing
    if (!isProcessingRef.current) {
      setTimeout(() => processQueue(), 50);
    }
  }, [processQueue]);

  return { addToQueue };
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
  const [activeTab, setActiveTab] = useState<'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'social' | 'settings' | 'quizzes' | 'dashboard' | 'podcasts' | 'library'>('notes');
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

  // Add ref to track loaded IDs for duplicate prevention
  const loadedIdsRef = useRef<Record<string, Set<string>>>({
    notes: new Set(),
    recordings: new Set(),
    scheduleItems: new Set(),
    documents: new Set(),
    quizzes: new Set(),
    folders: new Set(),
  });

  // Add connection monitoring and loading queue
  const { recordResponseTime, getConnectionQuality } = useConnectionMonitor();
  const { addToQueue } = useLoadingQueue();

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

  // Helper function to clear loaded IDs
  const clearLoadedIds = useCallback(() => {
    Object.keys(loadedIdsRef.current).forEach(key => {
      loadedIdsRef.current[key as keyof typeof loadedIdsRef.current].clear();
    });
  }, []);

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
        let userUser = null;

        if (!navigator.onLine) {
          const { data: { session } } = await supabase.auth.getSession();
          userUser = session?.user || null;
        } else {
          const getUserPromise = supabase.auth.getUser();
          const timeoutPromise = new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Auth check timeout')), API_TIMEOUT)
          );

          try {
            const result = await Promise.race([getUserPromise, timeoutPromise]);
            userUser = result.data?.user || null;
          } catch (e) {
            // Fallback to session on timeout
            const { data: { session } } = await supabase.auth.getSession();
            userUser = session?.user || null;
          }
        }

        if (userUser?.id !== currentUser?.id) {
          setCurrentUser(userUser || null);
        }

        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (error) {
        //console.error('Auth setup error:', error);
        if (error instanceof Error && error.message.includes('timeout')) {
          //console.warn('Auth check timed out, continuing with current state');
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
      setLastUserId(currentUser.id);

      // Clear cache and data
      clearCache();
      dataCacheRef.current.clear();
      clearAllData();

      // Start progressive loading
      startProgressiveDataLoading(currentUser);
    } else if (!currentUser && lastUserId !== null) {
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

    // Clear loaded IDs
    clearLoadedIds();
  }, [cleanup, setDataLoading, clearLoadedIds]);

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

  // Enhanced documents loading with retry logic
  const loadDocumentsPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.documents || !dataPagination.documents.hasMore) return;

    setDataLoading('documents', true);

    // Optimistically load from offline storage for initial load
    if (isInitial) {
      if (!navigator.onLine) {
        try {
          const offlineDocs = await offlineStorage.getAll<Document>(STORES.DOCUMENTS);
          if (offlineDocs && offlineDocs.length > 0) {
            setDocuments(offlineDocs);
            offlineDocs.forEach(doc => loadedIdsRef.current.documents.add(doc.id));
            setDataLoaded(prev => new Set([...prev, 'documents']));
            setDataLoading('documents', false);
            return;
          }
        } catch (err) {
          //console.warn('Failed to load offline documents:', err);
        }
      } else {
        offlineStorage.getAll<Document>(STORES.DOCUMENTS).then(offlineDocs => {
          if (offlineDocs && offlineDocs.length > 0) {
            setDocuments(offlineDocs);
          }
        }).catch(err => {
          // Failed to load offline documents
        });
      }
    }

    try {
      const offset = isInitial ? 0 : dataPagination.documents.offset;
      const limit = isInitial ? INITIAL_LOAD_LIMITS.documents : LOAD_MORE_LIMITS.documents;

      const startTime = Date.now();

      const { data, error, retriesUsed } = await withRetry<any[]>(
        () => withTimeout<any[]>(
          supabase
            .from('documents')
            .select(`*, folder_items:document_folder_items!document_folder_items_document_id_fkey (folder_id)`, { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1),
          API_TIMEOUT,
          'Failed to load documents'
        ),
        'Failed to load documents',
        'documents',
        isInitial ? MAX_RETRIES : 1 // Only retry initial loads
      );

      const responseTime = Date.now() - startTime;
      recordResponseTime(responseTime);

      if (error) {
        // Check if it's a network error or QUIC protocol error
        if (!navigator.onLine ||
          error.message?.includes('network') ||
          error.message?.includes('QUIC') ||
          error.message?.includes('ERR_QUIC_PROTOCOL_ERROR') ||
          error.message?.includes('timeout')) {
          // Try to load from IndexedDB
          const offlineDocs = await offlineStorage.getAll<Document>(STORES.DOCUMENTS);
          if (offlineDocs && offlineDocs.length > 0) {
            setDocuments(offlineDocs);
            setDataLoaded(prev => new Set([...prev, 'documents']));
          }
          return;
        }
        throw error;
      }

      if (data) {
        // Filter out duplicates before formatting
        const newDocsData = data.filter(doc =>
          !loadedIdsRef.current.documents.has(doc.id)
        );

        const formattedDocuments: Document[] = newDocsData.map(doc => ({
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
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          folder_ids: doc.folder_items?.map((item: any) => item.folder_id) || [],
          processing_started_at: doc.processing_started_at || null,
          processing_completed_at: doc.processing_completed_at || null,
          processing_metadata: doc.processing_metadata || null,
          extraction_model_used: doc.extraction_model_used || null,
          total_processing_time_ms: doc.total_processing_time_ms || null,
        }));

        // Add new IDs to loaded set
        formattedDocuments.forEach(doc => loadedIdsRef.current.documents.add(doc.id));

        // Save to IndexedDB for offline access
        offlineStorage.save(STORES.DOCUMENTS, formattedDocuments);

        if (isInitial) {
          setDocuments(formattedDocuments);
        } else {
          setDocuments(prev => [...prev, ...formattedDocuments]);
        }

        const newOffset = offset + data.length; // Use original data length for offset
        const hasMore = data.length === limit; // Use original data length for hasMore

        setDataPagination(prev => ({
          ...prev,
          documents: {
            hasMore,
            offset: newOffset,
            total: prev.documents.total + formattedDocuments.length
          }
        }));

        if (isInitial || !dataLoaded.has('documents')) {
          setDataLoaded(prev => new Set([...prev, 'documents']));
        }
      }
    } catch (error) {
      //console.error('Error loading documents:', error);
      if (isInitial && !error.message?.includes('network') && !error.message?.includes('QUIC') && !error.message?.includes('timeout')) {
        setDataErrors(prev => ({ ...prev, documents: 'Failed to load documents' }));
      }
    } finally {
      setDataLoading('documents', false);
    }
  }, [dataLoaded, dataLoading, dataPagination, setDataLoading, recordResponseTime]);

  // Optimized recordings loading with retry logic
  const loadRecordingsPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.recordings) return;
    if (!isInitial && !dataPagination.recordings.hasMore) return;

    setDataLoading('recordings', true);

    // Optimistically load from offline storage for initial load
    if (isInitial) {
      if (!navigator.onLine) {
        try {
          const offlineRecs = await offlineStorage.getAll<ClassRecording>(STORES.RECORDINGS);
          if (offlineRecs && offlineRecs.length > 0) {
            setRecordings(offlineRecs);
            offlineRecs.forEach(rec => loadedIdsRef.current.recordings.add(rec.id));
            setDataLoaded(prev => new Set([...prev, 'recordings']));
            setDataLoading('recordings', false);
            return;
          }
        } catch (err) {
          // console.warn('Failed to load offline recordings:', err);
        }
      } else {
        offlineStorage.getAll<ClassRecording>(STORES.RECORDINGS).then(offlineRecs => {
          if (offlineRecs && offlineRecs.length > 0) {
            setRecordings(offlineRecs);
          }
        }).catch(err => {
          // Failed to load offline recordings
        });
      }
    }

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.recordings : LOAD_MORE_LIMITS.recordings;
      const offset = isInitial ? 0 : dataPagination.recordings.offset;

      const startTime = Date.now();

      const { data, error, retriesUsed } = await withRetry<ClassRecording[]>(
        () => withTimeout<ClassRecording[]>(
          supabase
            .from('class_recordings')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1),
          API_TIMEOUT,
          'Failed to load recordings'
        ),
        'Failed to load recordings',
        'recordings',
        isInitial ? MAX_RETRIES : 1
      );

      const responseTime = Date.now() - startTime;
      recordResponseTime(responseTime);

      if (error) {
        if (!navigator.onLine || error.message?.includes('network') || error.message?.includes('QUIC') || error.message?.includes('timeout')) {
          // Try to load from IndexedDB
          const offlineRecordings = await offlineStorage.getAll<ClassRecording>(STORES.RECORDINGS);
          if (offlineRecordings && offlineRecordings.length > 0) {
            setRecordings(offlineRecordings);
            setDataLoaded(prev => new Set([...prev, 'recordings']));
          }
          return;
        }
        throw error;
      }

      if (data) {
        // Filter out duplicates before formatting
        const newRecordingsData = data.filter(recording =>
          !loadedIdsRef.current.recordings.has(recording.id)
        );

        const formattedRecordings: ClassRecording[] = newRecordingsData.map(recording => ({
          id: recording.id,
          title: recording.title || 'Untitled Recording',
          subject: recording.subject || '',
          date: recording.date,
          duration: recording.duration || 0,
          audioUrl: recording.audio_url || '',
          audio_url: recording.audio_url || '',
          transcript: recording.transcript || '',
          summary: recording.summary || '',
          created_at: recording.created_at,
          userId: recording.user_id,
          user_id: recording.user_id,
          document_id: recording.document_id
        }));

        // Add new IDs to loaded set
        formattedRecordings.forEach(recording => loadedIdsRef.current.recordings.add(recording.id));

        // Save to IndexedDB for offline access
        offlineStorage.save(STORES.RECORDINGS, formattedRecordings);

        if (isInitial) {
          setRecordings(formattedRecordings);
        } else {
          setRecordings(prev => [...prev, ...formattedRecordings]);
        }

        const newOffset = offset + data.length;
        const hasMore = data.length === limit;

        setDataPagination(prev => ({
          ...prev,
          recordings: {
            hasMore,
            offset: newOffset,
            total: prev.recordings.total + formattedRecordings.length
          }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'recordings']));
    } catch (error) {
      //console.error('Error loading recordings:', error);
      if (isInitial && !error.message?.includes('network')) {
        setDataErrors(prev => ({ ...prev, recordings: 'Failed to load recordings' }));
      }
    } finally {
      setDataLoading('recordings', false);
    }
  }, [dataLoading.recordings, dataPagination.recordings, setDataLoading, recordResponseTime]);

  // Optimized schedule loading with better error handling
  const loadSchedulePage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.scheduleItems) return;
    if (!isInitial && !dataPagination.scheduleItems.hasMore) return;

    setDataLoading('scheduleItems', true);

    // Optimistically load from offline storage for initial load
    if (isInitial) {
      if (!navigator.onLine) {
        try {
          const offlineItems = await offlineStorage.getAll<ScheduleItem>(STORES.SCHEDULE);
          if (offlineItems && offlineItems.length > 0) {
            setScheduleItems(offlineItems);
            offlineItems.forEach(item => loadedIdsRef.current.scheduleItems.add(item.id));
            setDataLoaded(prev => new Set([...prev, 'scheduleItems']));
            setDataLoading('scheduleItems', false);
            return;
          }
        } catch (err) {
          // console.warn('Failed to load offline schedule:', err);
        }
      } else {
        offlineStorage.getAll<ScheduleItem>(STORES.SCHEDULE).then(offlineItems => {
          if (offlineItems && offlineItems.length > 0) {
            setScheduleItems(offlineItems);
          }
        }).catch(err => {
          // Failed to load offline schedule
        });
      }
    }

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

      if (error) {
        // Handle CORS/network errors gracefully
        if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('CORS') || error.message?.includes('timeout')) {
          // Try to load from IndexedDB
          const offlineSchedule = await offlineStorage.getAll<ScheduleItem>(STORES.SCHEDULE);
          if (offlineSchedule && offlineSchedule.length > 0) {
            setScheduleItems(offlineSchedule);
            setDataLoaded(prev => new Set([...prev, 'scheduleItems']));
          } else {
            setScheduleItems(prev => isInitial ? [] : prev);
            setDataLoaded(prev => new Set([...prev, 'scheduleItems']));
          }
          return;
        }
        throw error;
      }

      if (data) {
        // Filter out duplicates before formatting
        const newScheduleData = data.filter(item =>
          !loadedIdsRef.current.scheduleItems.has(item.id)
        );

        const formattedItems: ScheduleItem[] = newScheduleData.map(item => ({
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
          created_at: item.created_at,
          calendarEventIds: item.calendar_event_id ? JSON.parse(item.calendar_event_id) : undefined,
          isRecurring: item.is_recurring,
          recurrencePattern: item.recurrence_pattern as any,
          recurrenceInterval: item.recurrence_interval,
          recurrenceDays: item.recurrence_days,
          recurrenceEndDate: item.recurrence_end_date
        }));

        // Add new IDs to loaded set
        formattedItems.forEach(item => loadedIdsRef.current.scheduleItems.add(item.id));

        // Save to IndexedDB for offline access
        offlineStorage.save(STORES.SCHEDULE, formattedItems);

        if (isInitial) {
          setScheduleItems(formattedItems);
        } else {
          setScheduleItems(prev => [...prev, ...formattedItems]);
        }

        const newOffset = offset + data.length;
        const hasMore = data.length === limit;

        setDataPagination(prev => ({
          ...prev,
          scheduleItems: {
            hasMore,
            offset: newOffset,
            total: prev.scheduleItems.total + formattedItems.length
          }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'scheduleItems']));
    } catch (error) {
      //console.error('Error loading schedule items:', error);
      // Don't show error for network/CORS issues
      if (!error.message?.includes('Failed to fetch') && !error.message?.includes('CORS')) {
        setDataErrors(prev => ({ ...prev, scheduleItems: 'Failed to load schedule items' }));
      }
    } finally {
      setDataLoading('scheduleItems', false);
    }
  }, [dataLoading.scheduleItems, dataPagination.scheduleItems, setDataLoading]);
  // Optimized quizzes loading with retry logic
  const loadQuizzesPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.quizzes) return;
    if (!isInitial && !dataPagination.quizzes.hasMore) return;

    setDataLoading('quizzes', true);

    // Optimistically load from offline storage for initial load
    if (isInitial) {
      if (!navigator.onLine) {
        try {
          const offlineQuizzes = await offlineStorage.getAll<Quiz>(STORES.QUIZZES);
          if (offlineQuizzes && offlineQuizzes.length > 0) {
            setQuizzes(offlineQuizzes);
            offlineQuizzes.forEach(quiz => loadedIdsRef.current.quizzes.add(quiz.id));
            setDataLoaded(prev => new Set([...prev, 'quizzes']));
            setDataLoading('quizzes', false);
            return;
          }
        } catch (err) {
          //console.warn('Failed to load offline quizzes:', err);
        }
      } else {
        offlineStorage.getAll<Quiz>(STORES.QUIZZES).then(offlineQuizzes => {
          if (offlineQuizzes && offlineQuizzes.length > 0) {
            setQuizzes(offlineQuizzes);
          }
        }).catch(err => {
          // Failed to load offline quizzes
        });
      }
    }

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.quizzes : LOAD_MORE_LIMITS.quizzes;
      const offset = isInitial ? 0 : dataPagination.quizzes.offset;

      const startTime = Date.now();

      const { data, error, retriesUsed } = await withRetry<Quiz[]>(
        () => withTimeout<Quiz[]>(
          supabase
            .from('quizzes')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1),
          API_TIMEOUT,
          'Failed to load quizzes'
        ),
        'Failed to load quizzes',
        'quizzes',
        isInitial ? MAX_RETRIES : 1
      );

      const responseTime = Date.now() - startTime;
      recordResponseTime(responseTime);

      if (error) {
        if (!navigator.onLine || error.message?.includes('network') || error.message?.includes('QUIC') || error.message?.includes('timeout')) {
          // Try to load from IndexedDB
          const offlineQuizzes = await offlineStorage.getAll<Quiz>(STORES.QUIZZES);
          if (offlineQuizzes && offlineQuizzes.length > 0) {
            setQuizzes(offlineQuizzes);
            setDataLoaded(prev => new Set([...prev, 'quizzes']));
          }
          return;
        }
        throw error;
      }

      if (data) {
        // Filter out duplicates before formatting
        const newQuizzesData = data.filter(quiz =>
          !loadedIdsRef.current.quizzes.has(quiz.id)
        );

        const formattedQuizzes: Quiz[] = newQuizzesData.map(quiz => {
          // Robust parsing for questions which might be a string or an array
          let parsedQuestions: any[] = [];
          try {
            if (Array.isArray(quiz.questions)) {
              parsedQuestions = quiz.questions;
            } else if (typeof quiz.questions === 'string') {
              parsedQuestions = JSON.parse(quiz.questions);
            }
          } catch (e) {
            // console.error('Error parsing quiz questions:', e);
            parsedQuestions = [];
          }

          return {
            id: quiz.id,
            title: quiz.title || 'Untitled Quiz',
            questions: (Array.isArray(parsedQuestions) ? parsedQuestions.map((q: any) => ({
              id: q.id || Math.random().toString(36).substr(2, 9),
              question: q.question || '',
              options: q.options || [],
              correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
              explanation: q.explanation || ''
            })) : []) as QuizQuestion[],
            classId: quiz.class_id,
            class_id: quiz.class_id,
            userId: quiz.user_id,
            user_id: quiz.user_id,
            created_at: quiz.created_at,
            source_type: (quiz.source_type || (quiz.title?.toLowerCase().includes('ai smart') ? 'ai' : (quiz.title?.toLowerCase().includes('notes') ? 'notes' : 'recording'))) as any
          };
        });

        // Add new IDs to loaded set
        formattedQuizzes.forEach(quiz => loadedIdsRef.current.quizzes.add(quiz.id));

        // Save to IndexedDB for offline access
        offlineStorage.save(STORES.QUIZZES, formattedQuizzes);

        if (isInitial) {
          setQuizzes(formattedQuizzes);
        } else {
          setQuizzes(prev => [...prev, ...formattedQuizzes]);
        }

        const newOffset = offset + data.length;
        const hasMore = data.length === limit;

        setDataPagination(prev => ({
          ...prev,
          quizzes: {
            hasMore,
            offset: newOffset,
            total: prev.quizzes.total + formattedQuizzes.length
          }
        }));
      }

      setDataLoaded(prev => new Set([...prev, 'quizzes']));
    } catch (error) {
      //console.error('Error loading quizzes:', error);
      if (isInitial && !error.message?.includes('network')) {
        setDataErrors(prev => ({ ...prev, quizzes: 'Failed to load quizzes' }));
      }
    } finally {
      setDataLoading('quizzes', false);
    }
  }, [dataLoading.quizzes, dataPagination.quizzes, setDataLoading, recordResponseTime]);

  // Optimized folder loading with retry logic
  const loadFolders = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.folders) return;

    const cacheKey = `folders_${userId}`;
    const cached = getCachedData(cacheKey);
    if (cached && isInitial) {
      // Filter out duplicates
      const uniqueFolders = cached.folders.filter(folder =>
        !loadedIdsRef.current.folders.has(folder.id)
      );
      setFolders(uniqueFolders);

      // Add to loaded IDs
      uniqueFolders.forEach(folder => loadedIdsRef.current.folders.add(folder.id));

      setFolderTree(cached.tree);
      setDataLoaded(prev => new Set([...prev, 'folders']));
      return;
    }

    setDataLoading('folders', true);

    // Optimistically load from offline storage for initial load
    if (isInitial && !cached) {
      if (!navigator.onLine) {
        try {
          const offlineFolders = await offlineStorage.getAll<DocumentFolder>(STORES.FOLDERS);
          if (offlineFolders && offlineFolders.length > 0) {
            setFolders(offlineFolders);
            offlineFolders.forEach(folder => loadedIdsRef.current.folders.add(folder.id));

            // Try to build tree if function is available
            try {
              if (typeof buildFolderTree === 'function') {
                setFolderTree(buildFolderTree(offlineFolders));
              }
            } catch (e) {
              // console.warn('Could not build folder tree offline:', e);
            }

            setDataLoaded(prev => new Set([...prev, 'folders']));
            setDataLoading('folders', false);
            return;
          }
        } catch (err) {
          // console.warn('Failed to load offline folders:', err);
        }
      } else {
        offlineStorage.getAll<DocumentFolder>(STORES.FOLDERS).then(offlineFolders => {
          if (offlineFolders && offlineFolders.length > 0) {
            setFolders(offlineFolders);
          }
        }).catch(err => {
          // console.warn('Failed to load offline folders:', err)
        });
      }
    }

    try {
      const startTime = Date.now();

      const { data, error, retriesUsed } = await withRetry<DocumentFolder[]>(
        () => withTimeout<DocumentFolder[]>(
          supabase
            .from('document_folders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          API_TIMEOUT,
          'Failed to load folders'
        ),
        'Failed to load folders',
        'folders',
        isInitial ? MAX_RETRIES : 1
      );

      const responseTime = Date.now() - startTime;
      recordResponseTime(responseTime);

      if (error) {
        if (!navigator.onLine || error.message?.includes('network') || error.message?.includes('QUIC') || error.message?.includes('timeout')) {
          // Try to load from IndexedDB
          const offlineFolders = await offlineStorage.getAll<DocumentFolder>(STORES.FOLDERS);
          if (offlineFolders && offlineFolders.length > 0) {
            setFolders(offlineFolders);
            setFolderTree(buildFolderTree(offlineFolders));
            setDataLoaded(prev => new Set([...prev, 'folders']));
          }
          return;
        }
        throw error;
      }

      if (data) {
        // Filter out duplicates before formatting
        const newFoldersData = data.filter(folder =>
          !loadedIdsRef.current.folders.has(folder.id)
        );

        const formattedFolders: DocumentFolder[] = newFoldersData.map(folder => ({
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

        // Add new IDs to loaded set
        formattedFolders.forEach(folder => loadedIdsRef.current.folders.add(folder.id));

        // Save to IndexedDB for offline access
        offlineStorage.save(STORES.FOLDERS, formattedFolders);

        const tree = buildFolderTree(formattedFolders);

        setFolders(formattedFolders);
        setFolderTree(tree);

        // Cache the result
        setCachedData(cacheKey, { folders: formattedFolders, tree });
      }

      setDataLoaded(prev => new Set([...prev, 'folders']));
    } catch (error) {
      //console.error('Error loading folders:', error);
      if (isInitial && !error.message?.includes('network')) {
        setDataErrors(prev => ({ ...prev, folders: 'Failed to load folders' }));
      }
    } finally {
      setDataLoading('folders', false);
    }
  }, [dataLoading.folders, getCachedData, setCachedData, setDataLoading, recordResponseTime]);

  // Enhanced user profile loading with retry logic
  const loadUserProfile = useCallback(async (user: any) => {
    //console.log('🔄 loadUserProfile called for user:', user?.id);

    if (dataLoaded.has('profile')) {
      return;
    }

    const cacheKey = `profile_${user.id}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      setUserProfile(cached);
      setDataLoaded(prev => new Set([...prev, 'profile']));
      return;
    }

    // Offline check for profile
    if (!navigator.onLine) {
      try {
        const offlineProfiles = await offlineStorage.getAll<UserProfile>(STORES.PROFILE);
        if (offlineProfiles && offlineProfiles.length > 0) {
          const myProfile = offlineProfiles.find(p => p.id === user.id) || offlineProfiles[0];
          if (myProfile) {
            setUserProfile(myProfile);
            setDataLoaded(prev => new Set([...prev, 'profile']));
            setDataLoading('profile', false);
            return;
          }
        }
      } catch (e) {
        //console.warn('Failed to load offline profile:', e);
      }
    }

    setDataLoading('profile', true);

    try {
      const startTime = Date.now();

      const { data: profileData, error: profileError, retriesUsed } = await withRetry<any>(
        () => withTimeout<UserProfile>(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(),
          API_TIMEOUT,
          'Failed to load user profile'
        ),
        'Failed to load user profile',
        'profile',
        1 // Only 1 retry for profile
      );

      const responseTime = Date.now() - startTime;
      recordResponseTime(responseTime);

      if (profileError && profileError.code !== 'PGRST116') {
        if (!navigator.onLine || profileError.message?.includes('network') || profileError.message?.includes('timeout')) {
          // Try to load from IndexedDB
          const offlineProfiles = await offlineStorage.getAll<UserProfile>(STORES.PROFILE);
          const myProfile = offlineProfiles.find(p => p.id === user.id);
          if (myProfile) {
            setUserProfile(myProfile);
            setDataLoaded(prev => new Set([...prev, 'profile']));
            return;
          }
        }
        //console.error('Error loading user profile:', profileError);
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
          bonus_ai_credits: profileData.bonus_ai_credits,
          is_public: profileData.is_public,
          points_balance: profileData.points_balance,
          quiz_preferences: profileData.quiz_preferences,
          referral_code: profileData.referral_code,
          referral_count: profileData.referral_count,
          school: profileData.school,
          username: profileData.username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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
          bonus_ai_credits: 0,
          is_public: false,
          points_balance: 0,
          quiz_preferences: null,
          referral_code: null,
          referral_count: 0,
          school: null,
          username: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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
            //console.error('Error creating default profile:', error);
          }
        }, 0);
      }

      setUserProfile(finalProfile);
      setCachedData(cacheKey, finalProfile);

      // Save to IndexedDB for offline access
      offlineStorage.save(STORES.PROFILE, finalProfile);

      setDataLoaded(prev => new Set([...prev, 'profile']));

    } catch (error) {
      //console.error('❌ Error in loadUserProfile:', error);
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
        bonus_ai_credits: 0,
        is_public: false,
        points_balance: 0,
        quiz_preferences: null,
        referral_code: null,
        referral_count: 0,
        school: null,
        username: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setUserProfile(fallbackProfile);
      setDataLoaded(prev => new Set([...prev, 'profile']));
    } finally {
      setDataLoading('profile', false);
    }
  }, [dataLoaded, getCachedData, setCachedData, setDataLoading]);

  // Optimized notes loading with retry logic
  const loadNotesPage = useCallback(async (userId: string, isInitial = false) => {
    if (dataLoading.notes) return;
    if (!isInitial && !dataPagination.notes.hasMore) return;

    setDataLoading('notes', true);
    setDataErrors(prev => ({ ...prev, notes: '' }));

    const cacheKey = `notes_${userId}_${isInitial ? 'initial' : dataPagination.notes.offset}`;
    const cached = getCachedData(cacheKey);
    if (cached && isInitial) {
      // Filter out any duplicates from cache
      const uniqueCachedNotes = cached.notes.filter(note =>
        !loadedIdsRef.current.notes.has(note.id)
      );
      setNotes(prev => isInitial ? uniqueCachedNotes : [...prev, ...uniqueCachedNotes]);

      // Add to loaded IDs
      uniqueCachedNotes.forEach(note => loadedIdsRef.current.notes.add(note.id));

      if (cached.activeNote && !activeNote) setActiveNote(cached.activeNote);
      setDataPagination(prev => ({ ...prev, notes: cached.pagination }));
      setDataLoaded(prev => new Set([...prev, 'notes']));
      return;
    }

    // Optimistically load from offline storage for initial load
    if (isInitial && !cached) {
      // If offline, prioritize offline data and skip fetch
      if (!navigator.onLine) {
        try {
          const offlineNotes = await offlineStorage.getAll<Note>(STORES.NOTES);
          if (offlineNotes && offlineNotes.length > 0) {
            const formattedNotes = offlineNotes.map(n => ({
              ...n,
              created_at: n.created_at || new Date().toISOString(),
              updated_at: n.updated_at || new Date().toISOString()
            }));
            setNotes(formattedNotes);
            formattedNotes.forEach(note => loadedIdsRef.current.notes.add(note.id));

            // Set active note if needed
            if (!activeNote && formattedNotes.length > 0) {
              setActiveNote(formattedNotes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]);
            }

            setDataLoaded(prev => new Set([...prev, 'notes']));
            setDataLoading('notes', false);
            return;
          }
        } catch (err) {
          // console.warn('Failed to load offline notes:', err);
        }
      } else {
        offlineStorage.getAll<Note>(STORES.NOTES).then(offlineNotes => {
          if (offlineNotes && offlineNotes.length > 0) {
            setNotes(offlineNotes);
          }
        }).catch(err => {
          // Failed to load offline notes
        });
      }
    }

    const controller = new AbortController();
    abortControllersRef.current.set(`notes_${userId}`, controller);

    try {
      const limit = isInitial ? INITIAL_LOAD_LIMITS.notes : LOAD_MORE_LIMITS.notes;
      const offset = isInitial ? 0 : dataPagination.notes.offset;

      const startTime = Date.now();

      const { data, error, retriesUsed } = await withRetry<any[]>(
        () => withTimeout<any[]>(
          supabase
            .from('notes')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1),
          API_TIMEOUT,
          'Failed to load notes'
        ),
        'Failed to load notes',
        'notes',
        isInitial ? MAX_RETRIES : 1
      );

      const responseTime = Date.now() - startTime;
      recordResponseTime(responseTime);

      if (error) {
        if (!navigator.onLine || error.message?.includes('network') || error.message?.includes('QUIC') || error.message?.includes('timeout')) {
          // Try to load from IndexedDB
          const offlineNotes = await offlineStorage.getAll<Note>(STORES.NOTES);
          if (offlineNotes && offlineNotes.length > 0) {
            setNotes(offlineNotes);
            setDataLoaded(prev => new Set([...prev, 'notes']));
            //toast.info('Loaded notes from offline storage');
          }
          return;
        }
        throw error;
      }

      if (data) {
        // Filter out duplicates before formatting
        const newNotesData = data.filter(note =>
          !loadedIdsRef.current.notes.has(note.id)
        );

        const formattedNotes: Note[] = newNotesData.map(note => ({
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

        // Add new IDs to loaded set
        formattedNotes.forEach(note => loadedIdsRef.current.notes.add(note.id));

        // Save to IndexedDB for offline access
        offlineStorage.save(STORES.NOTES, formattedNotes);

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
        const hasMore = data.length === limit;

        const newPagination = {
          hasMore,
          offset: newOffset,
          total: dataPagination.notes.total + formattedNotes.length
        };
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
      //console.error('Error loading notes:', error);
      setDataErrors(prev => ({ ...prev, notes: 'Failed to load notes' }));

      if (isInitial && !error.message?.includes('network')) {
        showToastOnce('Failed to load notes. Please check your connection.', 'error');
      }
    } finally {
      abortControllersRef.current.delete(`notes_${userId}`);
      setDataLoading('notes', false);
    }
  }, [dataLoading, dataPagination, activeNote, getCachedData, setCachedData, setDataLoading, recordResponseTime]);

  // Enhanced progressive loading with connection awareness - UPDATED
  const startProgressiveDataLoading = useCallback(async (user: any) => {
    if (!user?.id) return;

    // Check if we already have active requests to prevent duplicate loading
    const activeCount = activeRequestsRef.current.size;
    if (activeCount > 3) {
      //console.log('Too many active requests, deferring progressive load...');
      return;
    }

    setLoading(true);
    setLoadingPhase({ phase: 'initial', progress: 10 });

    try {
      // Phase 1: Critical data (profile MUST load first)
      const profileResult = await loadUserProfile(user); // Use the existing function

      setLoadingPhase({ phase: 'core', progress: 30 });

      // Phase 2: Core content (notes are critical)
      const notesPromise = loadNotesPage(user.id, true);
      const foldersPromise = loadFolders(user.id, true);

      await Promise.race([
        Promise.all([notesPromise, foldersPromise]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Core data loading timeout')), API_TIMEOUT * 2)
        )
      ]);

      setLoadingPhase({ phase: 'secondary', progress: 60 });

      // Phase 3: Load documents (important but not blocking)
      const documentsPromise = loadDocumentsPage(user.id, true).catch(error => {
        // Continue even if documents fail
      });

      // Phase 4: Load non-critical data in background
      const backgroundPromises = [
        loadRecordingsPage(user.id, true),
        // Schedule items might fail due to CORS, so handle separately
        loadSchedulePage(user.id, true).catch(error => {
          return null; // Don't throw, just continue
        }),
        loadQuizzesPage(user.id, true)
      ];

      // Don't wait for background promises to complete
      Promise.allSettled(backgroundPromises).then(() => {
      }).catch(() => {
        // Ignore errors in background loading
      });

      // Phase 5: UI is ready after core data + documents
      await Promise.race([
        documentsPromise,
        new Promise(resolve => setTimeout(resolve, 3000)) // Max 3s wait for documents
      ]);

      setLoading(false);

      // Set complete phase after a short delay
      setTimeout(() => {
        setLoadingPhase({ phase: 'complete', progress: 100 });
      }, 1000);

    } catch (error) {
      //console.error('❌ Error loading core user data:', error);

      // Even if there's an error, try to show the UI with available data
      const connectionQuality = getConnectionQuality();

      // Only show one toast for initial load failures
      if (connectionQuality === 'poor') {
        showToastOnce('Network connection is poor. Some data may not load.', 'info');
      } else if (!error.message?.includes('timeout') && !error.message?.includes('network')) {
        showToastOnce('Some data failed to load. You can still use the app.', 'info');
      }

      setLoading(false);
      setLoadingPhase({ phase: 'complete', progress: 100 });
    }
  }, [loadUserProfile, loadNotesPage, loadDocumentsPage, loadFolders, loadRecordingsPage, loadSchedulePage, loadQuizzesPage, getConnectionQuality]);// Enhanced loading state computation
  const enhancedLoading = loading || loadingPhase.phase !== 'complete';
  const loadingProgress = loadingPhase.progress;
  const loadingMessage = {
    'initial': 'Connecting to your account...',
    'core': 'Loading your notes and documents...',
    'secondary': 'Loading additional content...',
    'complete': 'Ready!'
  }[loadingPhase.phase];

  // Utility functions for merging data with duplicate prevention
  const mergeDocuments = useCallback((prev: Document[], newDocs: Document[]): Document[] => {
    const uniqueMap = new Map<string, Document>();

    // Add all previous documents
    prev.forEach(doc => uniqueMap.set(doc.id, doc));

    // Add/overwrite with new documents, but skip if already in loaded IDs
    newDocs.forEach(doc => {
      if (!loadedIdsRef.current.documents.has(doc.id)) {
        uniqueMap.set(doc.id, doc);
        loadedIdsRef.current.documents.add(doc.id);
      }
    });

    return Array.from(uniqueMap.values());
  }, []);

  const mergeNotes = useCallback((prev: Note[], newNotes: Note[]): Note[] => {
    const uniqueMap = new Map<string, Note>();

    // Add all previous notes
    prev.forEach(note => uniqueMap.set(note.id, note));

    // Add/overwrite with new notes, but skip if already in loaded IDs
    newNotes.forEach(note => {
      if (!loadedIdsRef.current.notes.has(note.id)) {
        uniqueMap.set(note.id, note);
        loadedIdsRef.current.notes.add(note.id);
      }
    });

    return Array.from(uniqueMap.values());
  }, []);

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

  // Fix specific documents loading with duplicate prevention

  // Add batched loading for specific documents/notes
  const loadSpecificDocuments = useCallback(async (userId: string, ids: string[]) => {
    if (!ids.length) return;

    // Check cache first
    const cacheKey = `specific_docs_${userId}_${ids.sort().join('_')}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      setDocuments(prev => mergeDocuments(prev, cached));
      return;
    }

    // Don't show loading spinner for background loads
    try {
      // OPTIMIZATION: Batch load with minimal fields
      const { data, error } = await withTimeout<any[]>(
        supabase
          .from('documents')
          .select('id, title, file_name, content_extracted, type, processing_status')
          .eq('user_id', userId)
          .in('id', ids),
        5000, // Shorter timeout for background loads
        'Failed to load specific documents'
      );

      if (error) throw error;

      const newDocs: Document[] = (data || []).map(doc => ({
        id: doc.id,
        title: doc.title,
        file_name: doc.file_name,
        file_type: doc.file_type || '',
        file_size: doc.file_size || 0,
        file_url: doc.file_url || '',
        content_extracted: doc.content_extracted || '',
        user_id: userId,
        type: doc.type,
        processing_status: doc.processing_status || 'pending',
        processing_error: null,
        created_at: doc.created_at || new Date().toISOString(),
        updated_at: doc.updated_at || new Date().toISOString(),
        folder_ids: [],
        processing_started_at: null,
        processing_completed_at: null,
        processing_metadata: null,
        extraction_model_used: null,
        total_processing_time_ms: null,
      }));

      setDocuments(prev => {
        const merged = mergeDocuments(prev, newDocs);
        setCachedData(cacheKey, newDocs);
        return merged;
      });
    } catch (error) {
      //console.warn('Background document load failed:', error);
      // Silently fail - documents will load eventually
    }
  }, [getCachedData, setCachedData, mergeDocuments]);

  // Fix specific notes loading with duplicate prevention
  const loadSpecificNotes = useCallback(async (userId: string, ids: string[]) => {
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
      //console.error('Error loading specific notes:', error);
    } finally {
      setDataLoading('notes', false);
    }
  }, [getCachedData, setCachedData, setDataLoading, mergeNotes]);

  // Add this function inside useAppData hook
  const refreshNotes = useCallback(async () => {
    if (!currentUser?.id) return;

    //console.log('🔄 Manually refreshing notes...');

    // Clear notes and loaded IDs
    setNotes([]);
    loadedIdsRef.current.notes.clear();

    // Reset pagination
    setDataPagination(prev => ({
      ...prev,
      notes: { hasMore: true, offset: 0, total: 0 }
    }));

    // Clear any errors
    setDataErrors(prev => ({ ...prev, notes: '' }));

    // Reload notes
    await loadNotesPage(currentUser.id, true);

    toast.success('Notes refreshed!');
  }, [currentUser, loadNotesPage, setNotes, setDataPagination, setDataErrors]);

  // Add automatic retry for failed loads
  useEffect(() => {
    const failedLoads = Object.entries(dataErrors).filter(([_, error]) => error);

    if (failedLoads.length > 0 && currentUser?.id) {

      failedLoads.forEach(([dataType]) => {
        // Clear the error first
        setDataErrors(prev => ({ ...prev, [dataType]: '' }));

        // Add to queue for retry
        const retryMap: Record<string, () => Promise<void>> = {
          notes: () => loadNotesPage(currentUser.id, true),
          recordings: () => loadRecordingsPage(currentUser.id, true),
          scheduleItems: () => loadSchedulePage(currentUser.id, true),
          documents: () => loadDocumentsPage(currentUser.id, true),
          quizzes: () => loadQuizzesPage(currentUser.id, true),
          folders: () => loadFolders(currentUser.id, true),
        };

        if (retryMap[dataType]) {
          addToQueue({
            id: `retry_${dataType}_${currentUser.id}`,
            priority: 5, // Low priority for retries
            dataType,
            execute: retryMap[dataType]
          });
        }
      });
    }
  }, [dataErrors, currentUser, loadNotesPage, loadRecordingsPage, loadSchedulePage, loadDocumentsPage, loadQuizzesPage, loadFolders, addToQueue]);

  // Add a connection health check
  const checkConnectionHealth = useCallback(async () => {
    try {
      const startTime = Date.now();
      const { error } = await withTimeout(
        supabase.from('profiles').select('id').limit(1),
        5000,
        'Connection health check timeout'
      );
      const responseTime = Date.now() - startTime;

      recordResponseTime(responseTime);

      if (error) {
        //console.warn('Connection health check failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      //console.warn('Connection health check error:', error);
      return false;
    }
  }, [recordResponseTime]);

  // Enhanced loading state computation
  const retryAllFailed = useCallback(() => {
    if (!currentUser?.id) return;

    Object.keys(dataErrors).forEach(dataType => {
      if (dataErrors[dataType]) {
        setDataErrors(prev => ({ ...prev, [dataType]: '' }));
      }
    });

    // Trigger reload of all data types
    const reloaders = [
      { type: 'notes', loader: () => loadNotesPage(currentUser.id, true) },
      { type: 'documents', loader: () => loadDocumentsPage(currentUser.id, true) },
      { type: 'recordings', loader: () => loadRecordingsPage(currentUser.id, true) },
      { type: 'scheduleItems', loader: () => loadSchedulePage(currentUser.id, true) },
      { type: 'quizzes', loader: () => loadQuizzesPage(currentUser.id, true) },
      { type: 'folders', loader: () => loadFolders(currentUser.id, true) },
    ];

    reloaders.forEach(({ type, loader }) => {
      addToQueue({
        id: `manual_retry_${type}_${currentUser.id}`,
        priority: 1, // High priority for manual retry
        dataType: type,
        execute: loader
      });
    });

    toast.success('Retrying all failed loads...');
  }, [currentUser, dataErrors, loadNotesPage, loadDocumentsPage, loadRecordingsPage, loadSchedulePage, loadQuizzesPage, loadFolders, addToQueue]);

  // Search notes from database
  const searchNotesFromDB = useCallback(async (searchQuery: string): Promise<Note[]> => {
    if (!currentUser?.id || !searchQuery.trim()) return [];

    try {
      const searchLower = searchQuery.toLowerCase();

      // Query notes table with search on title and content
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', currentUser.id)
        .or(`title.ilike.%${searchLower}%,content.ilike.%${searchLower}%`)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Note search error:', error);
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
      console.error('Note search error:', error);
      return [];
    }
  }, [currentUser?.id]);

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
    refreshNotes,
    clearError: useCallback((dataType: string) => {
      setDataErrors(prev => ({ ...prev, [dataType]: '' }));
    }, []),

    retryLoading: useCallback((dataType: keyof DataLoadingState) => {
      if (!currentUser?.id) return;

      setDataErrors(prev => ({ ...prev, [dataType]: '' }));

      // Clear loaded IDs for this data type
      loadedIdsRef.current[dataType].clear();

      // Reset pagination for this data type
      setDataPagination(prev => ({
        ...prev,
        [dataType]: { hasMore: true, offset: 0, total: 0 }
      }));

      const loaders = {
        notes: () => {
          // Clear notes state first
          setNotes([]);
          loadNotesPage(currentUser.id, true);
        },
        recordings: () => {
          setRecordings([]);
          loadRecordingsPage(currentUser.id, true);
        },
        scheduleItems: () => {
          setScheduleItems([]);
          loadSchedulePage(currentUser.id, true);
        },
        documents: () => {
          setDocuments([]);
          loadDocumentsPage(currentUser.id, true);
        },
        quizzes: () => {
          setQuizzes([]);
          loadQuizzesPage(currentUser.id, true);
        },
        folders: () => {
          setFolders([]);
          loadFolders(currentUser.id, true);
        },
      };

      if (loaders[dataType]) {
        loaders[dataType]();
      }
    }, [currentUser, loadNotesPage, loadRecordingsPage, loadSchedulePage, loadDocumentsPage, loadQuizzesPage, loadFolders, setNotes, setRecordings, setScheduleItems, setDocuments, setQuizzes, setFolders]),


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

    // Force refresh function (always fetches, even if already loaded)
    forceRefreshDocuments: useCallback(() => {
      return new Promise<void>((resolve) => {
        if (!currentUser?.id) return resolve();
        setDocuments([]);
        loadDocumentsPage(currentUser.id, true);
        resolve();
      });
    }, [currentUser, loadDocumentsPage, setDocuments]),

    // Load more functions
    loadMoreNotes: useCallback(() => currentUser?.id && loadNotesPage(currentUser.id, false), [currentUser, loadNotesPage]),
    loadMoreRecordings: useCallback(() => currentUser?.id && loadRecordingsPage(currentUser.id, false), [currentUser, loadRecordingsPage]),
    loadMoreDocuments: useCallback(() => currentUser?.id && loadDocumentsPage(currentUser.id, false), [currentUser, loadDocumentsPage]),
    loadMoreSchedule: useCallback(() => currentUser?.id && loadSchedulePage(currentUser.id, false), [currentUser, loadSchedulePage]),
    loadMoreQuizzes: useCallback(() => currentUser?.id && loadQuizzesPage(currentUser.id, false), [currentUser, loadQuizzesPage]),

    // Utility functions
    loadFolders,
    loadSpecificDocuments,
    loadSpecificNotes,
    clearLoadedIds,
    searchNotesFromDB,

    // Enhanced functions
    checkConnectionHealth,
    getConnectionQuality: () => getConnectionQuality(),
    retryAllFailed,
  };
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
