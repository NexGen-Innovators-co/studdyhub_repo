// contexts/AppContext.tsx - Complete implementation with proper types and timeouts
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
  useState,
  useRef
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../hooks/useAppData';
import { useAppOperations } from '../hooks/useAppOperations';
import { useAudioProcessing } from '../components/classRecordings/hooks/useAudioProcessing';
import { Message, ChatSession, FileData, MessagePart, ClassRecording, ScheduleItem, Quiz } from '../types/Class';
import { Document as AppDocument, UserProfile } from '../types/Document';
import { Note } from '../types/Note';
import { appReducer, initialAppState, AppState, AppAction } from './appReducer';
import { DocumentFolder, FolderTreeNode } from '@/types/Folder';
import { DataLoadingState } from '../hooks/useAppData';
import { useSocialData } from '../hooks/useSocialData';
import { clearCache } from '../utils/socialCache'
import { PlanType, SubscriptionLimits, Subscription, useSubscription, } from '@/hooks/useSubscription';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offlineStorage, STORES } from '@/utils/offlineStorage';

// Context interface
interface AppContextType extends AppState {
    setPendingAttachment: (ids: string[] | null) => void;
  // Auth & data hooks
  user: any;
  authLoading: boolean;

  // Data from useAppData
  notes: Note[];
  recordings: ClassRecording[];
  scheduleItems: ScheduleItem[];
  allChatMessages: Message[];
  documents: AppDocument[];
  userProfile: UserProfile | null;
  activeNote: Note | null;
  searchQuery: string;
  selectedCategory: string;
  isSidebarOpen: boolean;
  isAILoading: boolean;
  filteredNotes: Note[];
  quizzes: Quiz[];
  dataPagination: any;

  // Computed values
  currentActiveTab: string;
  filteredChatMessages: Message[];
  sessionIdFromUrl: string | null;
  currentCourse: { id: string; code?: string; title?: string } | null;

  // Actions
  dispatch: React.Dispatch<AppAction>;

  // Theme actions
  handleThemeChange: (theme: 'light' | 'dark') => void;

  // Chat session actions
  loadChatSessions: () => Promise<void>;
  createNewChatSession: () => Promise<string | null>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  renameChatSession: (sessionId: string, newTitle: string) => Promise<void>;
  handleLoadMoreChatSessions: () => void;

  // Message actions
  loadSessionMessages: (sessionId: string) => Promise<void>;
  handleLoadOlderChatMessages: () => Promise<void>;
  handleDeleteMessage: (messageId: string) => Promise<void>;
  handleRegenerateResponse: (lastUserMessageContent: string) => Promise<void>;
  handleRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>;
  handleMessageUpdate: (updatedMessage: Message) => void;
  handleReplaceOptimisticMessage: (tempId: string, newMessage: Message) => void;

  // App operations
  appOperations: ReturnType<typeof useAppOperations>;

  // Audio processing
  audioProcessing: ReturnType<typeof useAudioProcessing>;


  // Navigation
  handleNavigateToTab: (tab: string) => void;
  handleCreateNew: (type: 'note' | 'recording' | 'schedule' | 'document') => void;

  // Data setters from useAppData
  setNotes: (notes: Note[] | ((prev: Note[]) => Note[])) => void;
  setRecordings: (recordings: any[] | ((prev: any[]) => any[])) => void;
  setScheduleItems: (items: any[] | ((prev: any[]) => any[])) => void;
  setChatMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setDocuments: (docs: AppDocument[] | ((prev: AppDocument[]) => AppDocument[])) => void;
  setUserProfile: (profile: UserProfile | null | ((prev: UserProfile | null) => UserProfile | null)) => void;
  setActiveNote: (note: Note | null | ((prev: Note | null) => Note | null)) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setIsSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setActiveTab: (tab: any) => void;
  setIsAILoading: (loading: boolean) => void;
  loadDataIfNeeded: (dataType: string) => void;
  loadMoreNotes: () => void;
  loadMoreRecordings: () => void;
  loadMoreDocuments: () => void;
  loadMoreSchedule: () => void;
  loadMoreQuizzes: () => void;
  addDocument: (document: AppDocument) => void; // Add this function
  forceRefreshDocuments: () => Promise<void>; // Added for context consumers
  folders: DocumentFolder[];
  folderTree: FolderTreeNode[];
  setFolders: (folders: DocumentFolder[] | ((prev: DocumentFolder[]) => DocumentFolder[])) => void;
  loadFolders: (userId: string, isInitial?: boolean) => Promise<void>;
  updateDocument: (document: AppDocument) => void;
  detailedDataLoading: DataLoadingState;

  inputMessage: string;
  setInputMessage: (message: string) => void;
  attachedFiles: FileData[];
  setAttachedFiles: (files: FileData[] | ((prev: FileData[]) => FileData[])) => void;
  expandedMessages: Set<string>;
  setExpandedMessages: (messages: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  isCurrentlySending: boolean;
  setIsCurrentlySending: (sending: boolean) => void;
  isAiTyping: boolean;
  setIsAiTyping: (typing: boolean) => void;
  isLoadingSession: boolean;
  setIsLoadingSession: (loading: boolean) => void;
  dataErrors: Record<string, string>;
  clearError: (dataType: string) => void;
  retryLoading: (dataType: string) => void;
  // ← Added socialData to the interface
  socialData: ReturnType<typeof useSocialData>;
  refreshNotes: () => Promise<void>; // Add this
  refreshData: (dataType: keyof DataLoadingState) => void; // Added generic refresh
  dataLoading: DataLoadingState;
  navigateToNote: (noteId: string | null) => void; // Fix the syntax error
  subscription: Subscription | null;
  subscriptionLoading: boolean;
  subscriptionTier: PlanType;
  subscriptionLimits: SubscriptionLimits;
  checkSubscriptionAccess: (feature: keyof SubscriptionLimits) => boolean;
  refreshSubscription: () => Promise<void>;
  daysRemaining: number;
  bonusAiCredits: number;
  isAdmin: boolean;
  isAdminLoading: boolean;
}

// Create context
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Constants
const MAX_HISTORY_MESSAGES = 1000;
const CHAT_SESSIONS_PER_PAGE = 15;
const CHAT_MESSAGES_PER_PAGE = 25;

// Timeout constants
const API_TIMEOUT = 30000; // 30 seconds
const LOADING_TIMEOUT = 10000; // 10 seconds for loading states

// Type definitions for Supabase responses
interface SupabaseChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  document_ids: string[];
  user_id: string;
  message_count: number;
}

interface SupabaseChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  is_error: boolean;
  attached_document_ids: string[];
  attached_note_ids: string[];
  image_url: string | null;
  image_mime_type: string | null;
  session_id: string;
  has_been_displayed: boolean;
  files_metadata: any;
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

// Helper function to handle loading state with timeout
const useLoadingWithTimeout = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setLoadingWithTimeout = useCallback((loading: boolean) => {
    setIsLoading(loading);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set timeout to automatically reset loading state
    if (loading) {
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        ////console.warn('Loading state timeout - resetting loading state');
      }, LOADING_TIMEOUT);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [isLoading, setLoadingWithTimeout] as const;
};

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
    // Setter for pendingAttachment
    const setPendingAttachment = useCallback((ids: string[] | null) => {
      dispatch({ type: 'SET_PENDING_ATTACHMENT', payload: ids });
    }, []);
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Use loading states with timeouts
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useLoadingWithTimeout(false);
  const [isLoadingChatSessions, setIsLoadingChatSessions] = useLoadingWithTimeout(false);
  const {
    subscription,
    tier: subscriptionTier,
    limits: subscriptionLimits,
    daysRemaining,
    isLoading: subscriptionLoading,
    bonusAiCredits,
    checkAccess,
    checkAccess: checkSubscriptionAccess,
    refreshSubscription,
  } = useSubscription();

  // Centralized admin check — one query shared by all consumers
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsAdminLoading(false);
        return;
      }
      if (!navigator.onLine) {
        setIsAdminLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('id, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        setIsAdmin(!error && !!data);
      } catch {
        setIsAdmin(false);
      } finally {
        setIsAdminLoading(false);
      }
    };
    checkAdminStatus();
  }, [user]);
  // Get all data from useAppData hook
  const appData = useAppData(user);
  const {
    dataErrors,
    clearError,
    notes,
    recordings,
    scheduleItems,
    chatMessages: allChatMessages,
    documents,
    userProfile,
    activeNote,
    searchQuery,
    selectedCategory,
    isSidebarOpen,
    isAILoading,
    filteredNotes,
    loading: overallLoading,
    quizzes,
    dataPagination,
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
    loadDataIfNeeded,
    forceRefreshDocuments,
    loadMoreNotes,
    loadMoreRecordings,
    loadMoreDocuments,
    loadMoreSchedule,
    loadMoreQuizzes,
    setQuizzes,
    folders,
    folderTree,
    setFolders,
    loadFolders,
    loadSpecificDocuments,
    loadSpecificNotes,
    refreshNotes,
    retryLoading,
  } = appData;

  const refreshData = useCallback((dataType: keyof DataLoadingState) => {
      retryLoading(dataType);
  }, [retryLoading]);

  // Ref to hold social refresh (set after socialData hook is created)
  const socialRefreshRef = useRef<(() => void) | null>(null);

  const retryAllData = useCallback(() => {
    if (user?.id) {
      retryLoading('profile');
      retryLoading('notes');
      retryLoading('folders');
      retryLoading('documents');
      retryLoading('recordings');
      retryLoading('scheduleItems');
      retryLoading('quizzes');
      // Also refresh social feed on reconnect
      socialRefreshRef.current?.();
    }
  }, [user?.id, retryLoading]);

  const { syncPendingChanges } = useOfflineSync(retryAllData);

  const addDocument = useCallback((document: AppDocument) => {
    setDocuments(prev => [document, ...prev]);
  }, [setDocuments]);


  // Update document function
  const updateDocument = useCallback((document: AppDocument) => {
    setDocuments(prev => prev.map(doc => doc.id === document.id ? document : doc));
  }, [setDocuments]);

  // Audio processing
  const audioProcessing = useAudioProcessing({
    onAddRecording: (rec) => setRecordings(prev => [...prev, rec]),
    onUpdateRecording: (rec) => setRecordings(prev => prev.map(r => r.id === rec.id ? rec : r)),
    onNoteCreated: (note) => setNotes(prev => [note, ...prev]),
    onRefreshNotes: refreshNotes
  });
  const enhancedDataLoading = useMemo(() => ({
    ...appData.dataLoading,
    errors: dataErrors
  }), [appData.dataLoading, dataErrors]);
  // App operations
  const appOperations = useAppOperations({
    notes,
    recordings,
    scheduleItems,
    chatMessages: allChatMessages,
    documents,
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
    folders,
    setFolders,
    subscriptionTier,
    subscriptionLimits,
    checkSubscriptionAccess,
    refreshSubscription,
    refreshData: retryAllData,
    isAdmin,
  });
  const socialData = useSocialData(userProfile, 'newest', 'all');

  // Wire social refresh into the ref so retryAllData can trigger it
  useEffect(() => {
    socialRefreshRef.current = socialData.refetchPosts;
  }, [socialData.refetchPosts]);
  const navigateToNote = useCallback((noteId: string | null) => {
    if (noteId) {
      navigate(`/notes/${noteId}`, { replace: true });
    } else {
      navigate('/notes', { replace: true });
    }
  }, [navigate]);
  // Theme management
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      let theme = state.currentTheme;
      // If no theme is set, use system preference
      if (!theme) {
        theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (theme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      localStorage.setItem('theme', theme);
    }
  }, [state.currentTheme]);
  useEffect(() => {
    if (!user) {
      // User logged out, clear cache
      clearCache();
    }
  }, [user]);
  const handleThemeChange = useCallback((theme: 'light' | 'dark') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  // Computed values
  const currentActiveTab = useMemo((): 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'social' | 'settings' | 'quizzes' | 'dashboard' | 'podcasts' | 'library' => {
    const path = location.pathname.split('/')[1];
    switch (path) {
      case 'notes': return 'notes';
      case 'recordings': return 'recordings';
      case 'schedule': return 'schedule';
      case 'chat': return 'chat';
      case 'documents': return 'documents';
      case 'social': return 'social';
      case 'settings': return 'settings';
      case 'quizzes': return 'quizzes';
      case 'podcasts': return 'podcasts';
      case 'library': return 'library';
      default: return 'dashboard';
    }
  }, [location.pathname]);

  const sessionIdFromUrl = useMemo(() => {
    const pathParts = location.pathname.split('/');
    if (pathParts[1] === 'chat' && pathParts[2]) {
      return pathParts[2];
    }
    return null;
  }, [location.pathname]);

  const filteredChatMessages = useMemo(() => {
    if (!state.activeChatSessionId) return [];
    return allChatMessages
      .filter(msg => msg.session_id === state.activeChatSessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [allChatMessages, state.activeChatSessionId]);

  // Helper function to build context
  const buildRichContext = useCallback((
    documentIdsToInclude: string[],
    noteIdsToInclude: string[],
    allDocuments: AppDocument[],
    allNotes: Note[]
  ) => {
    const selectedDocs = (allDocuments ?? []).filter(doc =>
      (documentIdsToInclude ?? []).includes(doc.id)
    );
    const selectedNotes = (allNotes ?? []).filter(note =>
      (noteIdsToInclude ?? []).includes(note.id)
    );

    let context = '';

    if (selectedDocs.length > 0) {
      context += 'ATTACHED DOCUMENTS:\n';
      for (const doc of selectedDocs) {
        const docInfo = `Title: ${doc.title}\nFile: ${doc.file_name}\nType: ${doc.type}\n`;
        if (doc.content_extracted) {
          context += docInfo + `Content: ${doc.content_extracted}\n\n`;
        } else {
          context += docInfo + `Content: ${doc.processing_status === 'completed'
            ? 'No extractable content found'
            : `Processing status: ${doc.processing_status || 'pending'}`}\n\n`;
        }
      }
    }

    if (selectedNotes.length > 0) {
      context += 'ATTACHED NOTES:\n';
      selectedNotes.forEach(note => {
        const noteInfo = `Title: ${note.title}\nCategory: ${note.category}\n`;
        let noteContent = '';
        if (note.content) {
          noteContent = note.content;
        }

        const noteBlock = noteInfo + (noteContent ? `Content: ${noteContent}\n` : '') +
          (note.ai_summary ? `Summary: ${note.ai_summary}\n` : '') +
          (note.tags?.length ? `Tags: ${note.tags.join(', ')}\n` : '') + '\n';

        context += noteBlock;
      });
    }

    return context;
  }, []);

  const loadChatSessions = useCallback(async () => {
    try {
      if (!user) return;

      setIsLoadingChatSessions(true);

      const { data, error } = await withTimeout<SupabaseChatSession[]>(
        supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('last_message_at', { ascending: false })
          .range(0, state.chatSessionsLoadedCount - 1),
        API_TIMEOUT,
        'Failed to load chat sessions'
      );

      if (error) {
        if (!navigator.onLine) {
          const offlineSessions = await offlineStorage.getAll<ChatSession>(STORES.CHAT_SESSIONS);
          const userSessions = offlineSessions
            .filter(s => s.user_id === user.id)
            .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
          
          dispatch({ type: 'SET_CHAT_SESSIONS', payload: userSessions });
          return;
        }
        throw error;
      }

      const formattedSessions: ChatSession[] = (data || []).map((session: SupabaseChatSession) => ({
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
        last_message_at: session.last_message_at || new Date().toISOString(),
        document_ids: session.document_ids || [],
        user_id: session.user_id,
        message_count: session.message_count || 0,
      }));

      // Save to offline storage
      await offlineStorage.saveAll(STORES.CHAT_SESSIONS, formattedSessions);

      dispatch({ type: 'SET_CHAT_SESSIONS', payload: formattedSessions });
      dispatch({
        type: 'SET_HAS_MORE_CHAT_SESSIONS',
        payload: formattedSessions.length === state.chatSessionsLoadedCount
      });
    } catch (error) {
      ////console.error('Error loading chat sessions:', error);
      // toast.error('Failed to load chat sessions.');
    } finally {
      setIsLoadingChatSessions(false);
    }
  }, [user, state.chatSessionsLoadedCount, setIsLoadingChatSessions]);

  const handleLoadMoreChatSessions = useCallback(() => {
    dispatch({
      type: 'INCREMENT_CHAT_SESSIONS_LOADED_COUNT',
      payload: CHAT_SESSIONS_PER_PAGE
    });
  }, []);

  const createNewChatSession = useCallback(async (): Promise<string | null> => {
    try {
      if (!user) {
        toast.error('Please sign in to create a new chat session.');
        return null;
      }

      const { data, error } = await withTimeout<SupabaseChatSession>(
        supabase
          .from('chat_sessions')
          .insert({
            user_id: user.id,
            title: 'New Chat',
            document_ids: state.selectedDocumentIds,
            message_count: 0,
          })
          .select()
          .single(),
        API_TIMEOUT,
        'Failed to create chat session'
      );

      if (error) {
        if (!navigator.onLine) {
          const offlineId = `offline-${Date.now()}`;
          const newSession: ChatSession = {
            id: offlineId,
            title: 'New Chat (Offline)',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
            document_ids: state.selectedDocumentIds,
            message_count: 0,
            user_id: user.id,
          };

          await offlineStorage.save(STORES.CHAT_SESSIONS, newSession);
          await offlineStorage.addPendingSync('create', STORES.CHAT_SESSIONS, {
            user_id: user.id,
            title: 'New Chat',
            document_ids: state.selectedDocumentIds,
            message_count: 0,
          });

          dispatch({ type: 'ADD_CHAT_SESSION', payload: newSession });
          dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: offlineId });
          return offlineId;
        }
        throw error;
      }
      if (!data) throw new Error('No data returned from session creation');

      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_message_at: data.last_message_at || new Date().toISOString(),
        document_ids: data.document_ids || [],
        message_count: 0,
        user_id: data.user_id,
      };

      dispatch({ type: 'ADD_CHAT_SESSION', payload: newSession });
      dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: newSession.id });
      dispatch({ type: 'SET_SELECTED_DOCUMENT_IDS', payload: newSession.document_ids || [] });
      dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: false });
      dispatch({ type: 'SET_IS_LOADING_SESSION_MESSAGES', payload: false });

      navigate(`/chat/${newSession.id}`, { replace: true });
      toast.success('New chat session created!');
      return newSession.id;
    } catch (error: any) {
      ////console.error('Error creating new session:', error);
      toast.error(`Failed to create new chat session: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [user, state.selectedDocumentIds, navigate]);

  const deleteChatSession = useCallback(async (sessionId: string) => {
    try {
      if (!user) return;

      const { error } = await withTimeout<null>(
        supabase
          .from('chat_sessions')
          .delete()
          .eq('id', sessionId)
          .eq('user_id', user.id),
        API_TIMEOUT,
        'Failed to delete chat session'
      );

      if (error) throw error;

      dispatch({ type: 'REMOVE_CHAT_SESSION', payload: sessionId });
      dispatch({ type: 'SET_CHAT_SESSIONS_LOADED_COUNT', payload: CHAT_SESSIONS_PER_PAGE });
      await loadChatSessions();

      if (state.activeChatSessionId === sessionId) {
        if (state.chatSessions.length > 1) {
          const remainingSessions = state.chatSessions.filter(s => s.id !== sessionId);
          if (remainingSessions.length > 0) {
            const mostRecent = remainingSessions.sort((a, b) =>
              new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            )[0];
            dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: mostRecent.id });
            navigate(`/chat/${mostRecent.id}`, { replace: true });
          } else {
            dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: null });
            dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: false });
            navigate('/chat', { replace: true });
          }
        } else {
          dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: null });
          dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: false });
          navigate('/chat', { replace: true });
        }
      }

      toast.success('Chat session deleted.');
    } catch (error: any) {
      ////console.error('Error deleting session:', error);
      toast.error(`Failed to delete chat session: ${error.message || 'Unknown error'}`);
    }
  }, [user, state.chatSessions, state.activeChatSessionId, loadChatSessions, navigate]);

  const renameChatSession = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      if (!user) return;

      const { error } = await withTimeout<null>(
        supabase
          .from('chat_sessions')
          .update({ title: newTitle })
          .eq('id', sessionId)
          .eq('user_id', user.id),
        API_TIMEOUT,
        'Failed to rename chat session'
      );

      if (error) throw error;

      dispatch({
        type: 'UPDATE_CHAT_SESSION',
        payload: { id: sessionId, updates: { title: newTitle } }
      });
      toast.success('Chat session renamed.');
    } catch (error) {
      ////console.error('Error renaming session:', error);
      toast.error('Failed to rename chat session');
    }
  }, [user]);

  // Message management
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!user) return;

    // Prevent multiple simultaneous loads
    if (isLoadingSessionMessages) return;

    setIsLoadingSessionMessages(true);

    try {
      const startTime = Date.now();

      // OPTIMIZATION 1: Use single query with better indexing
      // Only select necessary fields for initial load
      const { data, error } = await withTimeout<SupabaseChatMessage[]>(
        supabase
          .from('chat_messages')
          .select('id, content, role, timestamp, is_error, attached_document_ids, attached_note_ids, session_id, has_been_displayed, files_metadata')
          .eq('session_id', sessionId)
          .order('timestamp', { ascending: false })
          .limit(CHAT_MESSAGES_PER_PAGE),
        API_TIMEOUT,
        'Failed to load session messages'
      );

      const loadTime = Date.now() - startTime;

      if (error) {
        if (!navigator.onLine) {
          const offlineMsgs = await offlineStorage.getAll<Message>(STORES.CHAT_MESSAGES);
          const sessionMsgs = offlineMsgs
            .filter(m => m.session_id === sessionId)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          setChatMessages(sessionMsgs);
          return;
        }
        throw error;
      }

      const fetchedMessages: Message[] = (data || []).reverse().map((msg: SupabaseChatMessage) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
        isError: msg.is_error || false,
        attachedDocumentIds: msg.attached_document_ids || [],
        attachedNoteIds: msg.attached_note_ids || [],
        session_id: msg.session_id,
        has_been_displayed: msg.has_been_displayed || false,
        files_metadata: msg.files_metadata,
        isLoading: false
      }));

      // Save to offline storage
      if (fetchedMessages.length > 0) {
        await offlineStorage.saveAll(STORES.CHAT_MESSAGES, fetchedMessages);
      }

      // OPTIMIZATION 2: Lazy load documents/notes only if needed
      const hasAttachments = fetchedMessages.some(m =>
        (m.attachedDocumentIds?.length || 0) > 0 ||
        (m.attachedNoteIds?.length || 0) > 0
      );

      if (hasAttachments) {
        // Load in background without blocking UI
        setTimeout(() => {
          const allDocIds = [...new Set(fetchedMessages.flatMap(m => m.attachedDocumentIds || []))];
          const allNoteIds = [...new Set(fetchedMessages.flatMap(m => m.attachedNoteIds || []))];

          if (allDocIds.length > 0) {
            loadSpecificDocuments(user.id, allDocIds);
          }
          if (allNoteIds.length > 0) {
            loadSpecificNotes(user.id, allNoteIds);
          }
        }, 100);
      }

      setChatMessages(prevAllMessages => {
        const otherSessionMessages = prevAllMessages.filter(m =>
          m.session_id !== sessionId || !m.id.startsWith('optimistic-')
        );

        const newMessagesForSession = fetchedMessages.filter(
          fm => !otherSessionMessages.some(pm => pm.id === fm.id)
        );

        return [...otherSessionMessages, ...newMessagesForSession].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: (data || []).length === CHAT_MESSAGES_PER_PAGE });
    } catch (error) {
      //console.error('Error loading session messages:', error);
      // Don't show error toast - let UI handle it gracefully
    } finally {
      setIsLoadingSessionMessages(false);
    }
  }, [user, setChatMessages, isLoadingSessionMessages, setIsLoadingSessionMessages, loadSpecificDocuments, loadSpecificNotes]);

  const handleLoadOlderChatMessages = useCallback(async () => {
    if (!state.activeChatSessionId || !user || filteredChatMessages.length === 0) return;

    const oldestMessageTimestamp = filteredChatMessages[0].timestamp;

    try {
      setIsLoadingSessionMessages(true);
      const { data, error } = await withTimeout<SupabaseChatMessage[]>(
        supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', state.activeChatSessionId)
          .lt('timestamp', oldestMessageTimestamp)
          .order('timestamp', { ascending: false })
          .limit(CHAT_MESSAGES_PER_PAGE),
        API_TIMEOUT,
        'Failed to load older messages'
      );

      if (error) throw error;

      const olderMessages: Message[] = (data || []).map((msg: SupabaseChatMessage) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
        isError: msg.is_error || false,
        attachedDocumentIds: msg.attached_document_ids || [],
        attachedNoteIds: msg.attached_note_ids || [],
        imageUrl: msg.image_url || undefined,
        imageMimeType: msg.image_mime_type || undefined,
        session_id: msg.session_id,
        has_been_displayed: msg.has_been_displayed || false,
      })).reverse();

      setChatMessages(prevAllMessages => {
        const newMessagesToAdd = olderMessages.filter(
          om => !prevAllMessages.some(pm => pm.id === om.id)
        );
        return [...newMessagesToAdd, ...prevAllMessages].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: (data || []).length === CHAT_MESSAGES_PER_PAGE });
    } catch (error) {
      ////console.error('Error loading older messages:', error);
      toast.error('Failed to load older messages.');
    } finally {
      setIsLoadingSessionMessages(false);
    }
  }, [state.activeChatSessionId, user, filteredChatMessages, setChatMessages, setIsLoadingSessionMessages]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      if (!user || !state.activeChatSessionId) {
        toast.error('Authentication required or no active chat session.');
        return;
      }

      setChatMessages(prevMessages =>
        (prevMessages || []).filter(msg => msg.id !== messageId)
      );
      toast.info('Deleting message...');

      const { error } = await withTimeout<null>(
        supabase
          .from('chat_messages')
          .delete()
          .eq('id', messageId)
          .eq('session_id', state.activeChatSessionId)
          .eq('user_id', user.id),
        API_TIMEOUT,
        'Failed to delete message'
      );

      if (error) {
        ////console.error('Error deleting message from DB:', error);
        toast.error('Failed to delete message from database.');
        loadSessionMessages(state.activeChatSessionId);
      } else {
        toast.success('Message deleted successfully.');
      }
    } catch (error: any) {
      ////console.error('Error in handleDeleteMessage:', error);
      toast.error(`Error deleting message: ${error.message || 'Unknown error'}`);
      if (state.activeChatSessionId) {
        loadSessionMessages(state.activeChatSessionId);
      }
    }
  }, [user, state.activeChatSessionId, setChatMessages, loadSessionMessages]);

  const handleRegenerateResponse = useCallback(async (lastUserMessageContent: string) => {
    if (!user || !state.activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    const lastAssistantMessage = filteredChatMessages.slice().reverse()
      .find(msg => msg.role === 'assistant');
    const lastUserMessage = filteredChatMessages.slice().reverse()
      .find(msg => msg.role === 'user');

    if (!lastUserMessage) {
      toast.info('No previous user message to regenerate from.');
      return;
    }

    if (!lastAssistantMessage) {
      toast.info('No previous AI message to regenerate.');
      return;
    }

    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === lastAssistantMessage.id
          ? { ...msg, isUpdating: true, isError: false }
          : msg
      )
    );

    toast.info('Regenerating response...');

    try {
      // This would call the message submission handler
      // For now, we'll just show a placeholder implementation
    } catch (error) {
      toast.error('Failed to regenerate response');

      setChatMessages(prevAllMessages =>
        (prevAllMessages || []).map(msg =>
          msg.id === lastAssistantMessage.id
            ? { ...msg, isUpdating: false, isError: true }
            : msg
        )
      );
    }
  }, [user, state.activeChatSessionId, filteredChatMessages, setChatMessages]);

  const handleRetryFailedMessage = useCallback(async (
    originalUserMessageContent: string,
    failedAiMessageId: string
  ) => {
    if (!user || !state.activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    const lastUserMessage = filteredChatMessages.slice().reverse()
      .find(msg => msg.role === 'user' && msg.content === originalUserMessageContent);

    if (!lastUserMessage) {
      toast.error('Could not find original user message to retry.');
      return;
    }

    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === failedAiMessageId
          ? { ...msg, isUpdating: true, isError: false }
          : msg
      )
    );

    toast.info('Retrying message...');

    try {
      // This would call the message submission handler
      // For now, we'll just show a placeholder implementation
    } catch (error) {
      toast.error('Failed to retry message');

      setChatMessages(prevAllMessages =>
        (prevAllMessages || []).map(msg =>
          msg.id === failedAiMessageId
            ? { ...msg, isUpdating: false, isError: true }
            : msg
        )
      );
    }
  }, [user, state.activeChatSessionId, filteredChatMessages, setChatMessages]);

  const handleMessageUpdate = useCallback((updatedMessage: Message) => {
    setChatMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === updatedMessage.id ? updatedMessage : msg
      )
    );
  }, [setChatMessages]);

  const handleReplaceOptimisticMessage = useCallback((tempId: string, newMessage: Message) => {
    setChatMessages(prevMessages =>
      prevMessages.map(msg => (msg.id === tempId ? newMessage : msg))
    );
  }, [setChatMessages]);

  // Navigation helpers
  const handleNavigateToTab = useCallback((tab: string) => {
    navigate(`/${tab}`);
    setIsSidebarOpen(false);
  }, [navigate, setIsSidebarOpen]);

  const handleCreateNew = useCallback((type: 'note' | 'recording' | 'schedule' | 'document') => {
    switch (type) {
      case 'note':
        appOperations.createNewNote();
        break;
      case 'recording':
        handleNavigateToTab('recordings');
        break;
      case 'schedule':
        handleNavigateToTab('schedule');
        break;
      case 'document':
        handleNavigateToTab('documents');
        break;
    }
  }, [appOperations.createNewNote, handleNavigateToTab]);

  // Load data and effects
  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user, loadChatSessions, state.chatSessionsLoadedCount]);
  // Add this effect to handle note ID from URL
  useEffect(() => {
    if (user) {
      const pathParts = location.pathname.split('/');
      const isNotesRoute = pathParts[1] === 'notes' || pathParts[1] === 'note';
      const noteIdFromUrl = isNotesRoute && pathParts[2] ? pathParts[2] : null;

      if (noteIdFromUrl) {
        // Try local state first (user's own notes)
        const noteFromUrl = notes.find(note => note.id === noteIdFromUrl);
        if (noteFromUrl && (!activeNote || activeNote.id !== noteIdFromUrl)) {
          setActiveNote(noteFromUrl);
        } else if (!noteFromUrl) {
          // Note not in local state — could be a course note from another user.
          // Fetch it directly (RLS allows enrolled users to read course notes).
          (async () => {
            try {
              const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('id', noteIdFromUrl)
                .maybeSingle();

              if (data && !error) {
                setActiveNote(data as Note);
              } else {
                // Truly not accessible — navigate away
                navigate('/notes', { replace: true });
              }
            } catch {
              navigate('/notes', { replace: true });
            }
          })();
        }
      }
    }
  }, [location.pathname, notes, user, activeNote, setActiveNote, navigate]);
  // Add these declarations with your other state declarations
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [isCurrentlySending, setIsCurrentlySending] = useLoadingWithTimeout(false);
  const [isAiTyping, setIsAiTyping] = useLoadingWithTimeout(false);
  // Add this with your other state declarations
  const [isLoadingSession, setIsLoadingSession] = useLoadingWithTimeout(false);
  // Add this ref for tracking previous session ID

  // Enhanced session loading with URL session restoration
  useEffect(() => {
    // Handle URL session restoration first
    if (sessionIdFromUrl && sessionIdFromUrl !== state.activeChatSessionId && user) {
      dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: sessionIdFromUrl });
      loadSessionMessages(sessionIdFromUrl);
      return;
    }
  }, [sessionIdFromUrl, state.activeChatSessionId, user]);

  // Load messages for active session
  useEffect(() => {
    if (state.activeChatSessionId && user) {
      const messagesForActiveSession = allChatMessages.filter(m => m.session_id === state.activeChatSessionId);
      const currentSession = state.chatSessions.find(s => s.id === state.activeChatSessionId);

      const shouldLoadMessages = messagesForActiveSession.length === 0 &&
        currentSession &&
        currentSession.message_count !== 0;

      if (shouldLoadMessages) {
        loadSessionMessages(state.activeChatSessionId);
      } else {
        dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: messagesForActiveSession.length > 0 });
        setIsLoadingSessionMessages(false);
      }
    } else if (!state.activeChatSessionId) {
      dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: false });
      setIsLoadingSessionMessages(false);
    }
  }, [state.activeChatSessionId, user, allChatMessages.length, state.chatSessions, loadSessionMessages, setIsLoadingSessionMessages]);

  // Update selected document IDs when active session changes
  useEffect(() => {
    if (state.activeChatSessionId && state.chatSessions.length > 0) {
      const currentSession = state.chatSessions.find(s => s.id === state.activeChatSessionId);
      if (currentSession) {
        dispatch({ type: 'SET_SELECTED_DOCUMENT_IDS', payload: currentSession.document_ids || [] });
      }
    } else if (!state.activeChatSessionId) {
      // Only clear if there is NO documentId in the URL (to support "Ask AI" from library)
      const searchParams = new URLSearchParams(location.search);
      if (!searchParams.get('documentId')) {
        dispatch({ type: 'SET_SELECTED_DOCUMENT_IDS', payload: [] });
      }
    }
  }, [state.activeChatSessionId, state.chatSessions, location.search]);

  // Set active tab based on current route
  useEffect(() => {
    return setActiveTab(currentActiveTab);
  }, [currentActiveTab, setActiveTab]);

  // Smart data loading based on tab activation
  useEffect(() => {
    if (!overallLoading) {
      switch (currentActiveTab) {
        case 'dashboard':
          loadDataIfNeeded('notes');
          loadDataIfNeeded('recordings');
          loadDataIfNeeded('documents');
          break;
        case 'recordings':
          loadDataIfNeeded('recordings');
          loadDataIfNeeded('quizzes');
          break;
        case 'schedule':
          loadDataIfNeeded('scheduleItems');
          break;
        case 'documents':
          loadDataIfNeeded('documents');
          break;
        case 'settings':
          loadDataIfNeeded('quizzes');
          break;
        case 'chat':
          loadDataIfNeeded('documents');
          break;
        default:
          loadDataIfNeeded('notes');
          break;
      }
    }
  }, [currentActiveTab, loadDataIfNeeded, overallLoading]);

  const contextValue: AppContextType = {
    // State
    ...state,
  setPendingAttachment,

    // Auth & data
    user,
    authLoading,
    dataErrors,
    clearError,
    retryLoading,
    // Data from useAppData
    notes,
    recordings,
    scheduleItems,
    allChatMessages,
    documents,
    userProfile,
    activeNote,
    searchQuery,
    selectedCategory,
    isSidebarOpen,
    isAILoading,
    filteredNotes,
    quizzes,
    dataPagination,

    // Computed values
    currentActiveTab,
    filteredChatMessages,
    sessionIdFromUrl,

    // Actions
    dispatch,

    // Theme
    handleThemeChange,

    // Chat sessions
    loadChatSessions,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    handleLoadMoreChatSessions,

    // Messages
    loadSessionMessages,
    handleLoadOlderChatMessages,
    handleDeleteMessage,
    handleRegenerateResponse,
    handleRetryFailedMessage,
    handleMessageUpdate,
    handleReplaceOptimisticMessage,

    // App operations
    appOperations,

    // Audio processing
    audioProcessing,

    // Navigation
    handleNavigateToTab,
    handleCreateNew,

    // Data setters
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
    loadDataIfNeeded,
    loadMoreNotes,
    loadMoreRecordings,
    loadMoreDocuments,
    loadMoreSchedule,
    loadMoreQuizzes,
    addDocument, // Add to context
    updateDocument, // Add to context
    folders,
    folderTree,
    setFolders,
    loadFolders,
    detailedDataLoading: appData.dataLoading,  // ← USE THIS
    inputMessage,
    setInputMessage,
    attachedFiles,
    setAttachedFiles,
    expandedMessages,
    setExpandedMessages,
    isCurrentlySending,
    setIsCurrentlySending,
    isAiTyping,
    setIsAiTyping,
    isLoadingSession,
    setIsLoadingSession,
    socialData,
    refreshNotes,
    refreshData: refreshData,
    dataLoading: appData.dataLoading,
    navigateToNote,
    subscription,
    subscriptionLoading,
    subscriptionTier,
    subscriptionLimits,
    checkSubscriptionAccess: checkAccess,
    refreshSubscription,
    daysRemaining,
    bonusAiCredits,
    isAdmin,
    isAdminLoading,
    forceRefreshDocuments,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}