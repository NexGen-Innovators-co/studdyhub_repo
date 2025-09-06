// AppStateContext.tsx - Centralized state management for the entire app
import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Message, ChatSession } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { Note } from '../types/Note';
import { toast } from 'sonner';

// State interface
interface AppState {
  // User & Auth
  user: any | null;
  userProfile: UserProfile | null;
  
  // Chat state
  messages: Message[];
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  isLoadingMessages: boolean;
  
  // Documents state
  documents: Document[];
  sessionDocuments: Document[]; // Documents specific to current chat session
  isLoadingDocuments: boolean;
  
  // Other app data
  notes: Note[];
  
  // UI state
  activeTab: string;
  loading: boolean;
  
  // Realtime connections
  isRealtimeConnected: boolean;
}

// Actions
type AppAction =
  | { type: 'SET_USER'; payload: any }
  | { type: 'SET_USER_PROFILE'; payload: UserProfile | null }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: Message }
  | { type: 'DELETE_MESSAGE'; payload: string }
  | { type: 'SET_CHAT_SESSIONS'; payload: ChatSession[] }
  | { type: 'ADD_CHAT_SESSION'; payload: ChatSession }
  | { type: 'UPDATE_CHAT_SESSION'; payload: ChatSession }
  | { type: 'DELETE_CHAT_SESSION'; payload: string }
  | { type: 'SET_ACTIVE_CHAT_SESSION'; payload: string | null }
  | { type: 'SET_DOCUMENTS'; payload: Document[] }
  | { type: 'SET_SESSION_DOCUMENTS'; payload: Document[] }
  | { type: 'ADD_DOCUMENT'; payload: Document }
  | { type: 'UPDATE_DOCUMENT'; payload: Document }
  | { type: 'SET_NOTES'; payload: Note[] }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  | { type: 'SET_LOADING_DOCUMENTS'; payload: boolean }
  | { type: 'SET_REALTIME_CONNECTED'; payload: boolean };

// Initial state
const initialState: AppState = {
  user: null,
  userProfile: null,
  messages: [],
  chatSessions: [],
  activeChatSessionId: null,
  isLoadingMessages: false,
  documents: [],
  sessionDocuments: [],
  isLoadingDocuments: false,
  notes: [],
  activeTab: 'notes',
  loading: false,
  isRealtimeConnected: false,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_USER_PROFILE':
      return { ...state, userProfile: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      // Avoid duplicates
      if (state.messages.some(msg => msg.id === action.payload.id)) {
        return state;
      }
      return { 
        ...state, 
        messages: [...state.messages, action.payload].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id ? { ...msg, ...action.payload } : msg
        ),
      };
    case 'DELETE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter(msg => msg.id !== action.payload),
      };
    case 'SET_CHAT_SESSIONS':
      return { ...state, chatSessions: action.payload };
    case 'ADD_CHAT_SESSION':
      return { 
        ...state, 
        chatSessions: [action.payload, ...state.chatSessions]
      };
    case 'UPDATE_CHAT_SESSION':
      return {
        ...state,
        chatSessions: state.chatSessions.map(session =>
          session.id === action.payload.id ? { ...session, ...action.payload } : session
        ),
      };
    case 'DELETE_CHAT_SESSION':
      return {
        ...state,
        chatSessions: state.chatSessions.filter(session => session.id !== action.payload),
        activeChatSessionId: state.activeChatSessionId === action.payload ? null : state.activeChatSessionId,
      };
    case 'SET_ACTIVE_CHAT_SESSION':
      return { ...state, activeChatSessionId: action.payload };
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload };
    case 'SET_SESSION_DOCUMENTS':
      return { ...state, sessionDocuments: action.payload };
    case 'ADD_DOCUMENT':
      return { 
        ...state, 
        documents: [action.payload, ...state.documents]
      };
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.map(doc =>
          doc.id === action.payload.id ? { ...doc, ...action.payload } : doc
        ),
        sessionDocuments: state.sessionDocuments.map(doc =>
          doc.id === action.payload.id ? { ...doc, ...action.payload } : doc
        ),
      };
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'ADD_NOTE':
      return { 
        ...state, 
        notes: [action.payload, ...state.notes]
      };
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(note =>
          note.id === action.payload.id ? { ...note, ...action.payload } : note
        ),
      };
    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(note => note.id !== action.payload),
      };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_LOADING_MESSAGES':
      return { ...state, isLoadingMessages: action.payload };
    case 'SET_LOADING_DOCUMENTS':
      return { ...state, isLoadingDocuments: action.payload };
    case 'SET_REALTIME_CONNECTED':
      return { ...state, isRealtimeConnected: action.payload };
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // Actions
  loadUserProfile: () => Promise<void>;
  loadChatMessages: (sessionId: string) => Promise<void>;
  loadChatSessions: () => Promise<void>;
  loadDocuments: () => Promise<void>;
  loadSessionDocuments: (sessionId: string) => Promise<void>;
  loadNotes: () => Promise<void>;
  
  // Realtime management
  subscribeToMessages: (sessionId: string) => void;
  unsubscribeFromMessages: () => void;
  subscribeToDocuments: () => void;
  unsubscribeFromDocuments: () => void;
}

const AppStateContext = createContext<AppContextType | undefined>(undefined);

// Provider component
export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const messageChannelRef = useRef<any>(null);
  const documentChannelRef = useRef<any>(null);

  // Load user profile
  const loadUserProfile = useCallback(async () => {
    if (!state.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', state.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user profile:', error);
        return;
      }

      if (data) {
        const profile: UserProfile = {
          id: data.id,
          email: data.email || state.user.email || '',
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
          learning_style: (data.learning_style || 'visual') as 'visual' | 'auditory' | 'kinesthetic' | 'reading',
          learning_preferences: (data.learning_preferences as any) || {
            explanation_style: 'detailed',
            examples: true,
            difficulty: 'intermediate'
          },
          created_at: new Date(data.created_at || Date.now()),
          updated_at: new Date(data.updated_at || Date.now())
        };
        dispatch({ type: 'SET_USER_PROFILE', payload: profile });
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    }
  }, [state.user?.id]);

  // Load chat messages for a session
  const loadChatMessages = useCallback(async (sessionId: string) => {
    if (!state.user?.id) return;

    dispatch({ type: 'SET_LOADING_MESSAGES', payload: true });

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', state.user.id)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const messages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: msg.timestamp,
        session_id: msg.session_id,
        has_been_displayed: msg.has_been_displayed || false,
        attachedDocumentIds: msg.attached_document_ids || [],
        attachedNoteIds: msg.attached_note_ids || [],
        isError: msg.is_error || false,
        conversation_context: msg.conversation_context || undefined,
        image_url: msg.image_url || undefined,
        image_mime_type: msg.image_mime_type || undefined,
        files_metadata: msg.files_metadata || undefined,
      }));

      dispatch({ type: 'SET_MESSAGES', payload: messages });
    } catch (error) {
      console.error('Error loading chat messages:', error);
      toast.error('Failed to load chat messages');
    } finally {
      dispatch({ type: 'SET_LOADING_MESSAGES', payload: false });
    }
  }, [state.user?.id]);

  // Load chat sessions
  const loadChatSessions = useCallback(async () => {
    if (!state.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', state.user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const sessions: ChatSession[] = (data || []).map(session => ({
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
        last_message_at: session.last_message_at,
        document_ids: session.document_ids || [],
        message_count: session.message_count || 0,
      }));

      dispatch({ type: 'SET_CHAT_SESSIONS', payload: sessions });
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      toast.error('Failed to load chat sessions');
    }
  }, [state.user?.id]);

  // Load all documents
  const loadDocuments = useCallback(async () => {
    if (!state.user?.id) return;

    dispatch({ type: 'SET_LOADING_DOCUMENTS', payload: true });

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const documents: Document[] = (data || []).map(doc => ({
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

      dispatch({ type: 'SET_DOCUMENTS', payload: documents });
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      dispatch({ type: 'SET_LOADING_DOCUMENTS', payload: false });
    }
  }, [state.user?.id]);

  // Load documents specific to a chat session
  const loadSessionDocuments = useCallback(async (sessionId: string) => {
    if (!state.user?.id) return;

    try {
      // Get the session to find document IDs
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('document_ids')
        .eq('id', sessionId)
        .eq('user_id', state.user.id)
        .single();

      if (sessionError) throw sessionError;

      const documentIds = sessionData?.document_ids || [];
      
      if (documentIds.length === 0) {
        dispatch({ type: 'SET_SESSION_DOCUMENTS', payload: [] });
        return;
      }

      // Load the specific documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .in('id', documentIds)
        .eq('user_id', state.user.id);

      if (documentsError) throw documentsError;

      const sessionDocuments: Document[] = (documentsData || []).map(doc => ({
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

      dispatch({ type: 'SET_SESSION_DOCUMENTS', payload: sessionDocuments });
    } catch (error) {
      console.error('Error loading session documents:', error);
      dispatch({ type: 'SET_SESSION_DOCUMENTS', payload: [] });
    }
  }, [state.user?.id]);

  // Load notes
  const loadNotes = useCallback(async () => {
    if (!state.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', state.user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const notes: Note[] = (data || []).map(note => ({
        id: note.id,
        title: note.title || 'Untitled Note',
        content: note.content || '',
        document_id: note.document_id || null,
        user_id: note.user_id || state.user.id,
        category: note.category || 'general',
        tags: note.tags || [],
        createdAt: new Date(note.created_at || Date.now()),
        updatedAt: new Date(note.updated_at || Date.now()),
        aiSummary: note.ai_summary || ''
      }));

      dispatch({ type: 'SET_NOTES', payload: notes });
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Failed to load notes');
    }
  }, [state.user?.id]);

  // Subscribe to realtime message updates for a specific session
  const subscribeToMessages = useCallback((sessionId: string) => {
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
    }

    messageChannelRef.current = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newMessage: Message = {
            id: payload.new.id,
            content: payload.new.content,
            role: payload.new.role,
            timestamp: payload.new.timestamp,
            session_id: payload.new.session_id,
            has_been_displayed: payload.new.has_been_displayed || false,
            attachedDocumentIds: payload.new.attached_document_ids || [],
            attachedNoteIds: payload.new.attached_note_ids || [],
            isError: payload.new.is_error || false,
            conversation_context: payload.new.conversation_context || undefined,
            image_url: payload.new.image_url || undefined,
            image_mime_type: payload.new.image_mime_type || undefined,
            files_metadata: payload.new.files_metadata || undefined,
          };
          dispatch({ type: 'ADD_MESSAGE', payload: newMessage });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updatedMessage: Message = {
            id: payload.new.id,
            content: payload.new.content,
            role: payload.new.role,
            timestamp: payload.new.timestamp,
            session_id: payload.new.session_id,
            has_been_displayed: payload.new.has_been_displayed || false,
            attachedDocumentIds: payload.new.attached_document_ids || [],
            attachedNoteIds: payload.new.attached_note_ids || [],
            isError: payload.new.is_error || false,
            conversation_context: payload.new.conversation_context || undefined,
            image_url: payload.new.image_url || undefined,
            image_mime_type: payload.new.image_mime_type || undefined,
            files_metadata: payload.new.files_metadata || undefined,
          };
          dispatch({ type: 'UPDATE_MESSAGE', payload: updatedMessage });
        }
      )
      .subscribe((status) => {
        dispatch({ type: 'SET_REALTIME_CONNECTED', payload: status === 'SUBSCRIBED' });
      });
  }, []);

  // Unsubscribe from message updates
  const unsubscribeFromMessages = useCallback(() => {
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
      messageChannelRef.current = null;
    }
    dispatch({ type: 'SET_REALTIME_CONNECTED', payload: false });
  }, []);

  // Subscribe to document updates
  const subscribeToDocuments = useCallback(() => {
    if (!state.user?.id) return;

    if (documentChannelRef.current) {
      supabase.removeChannel(documentChannelRef.current);
    }

    documentChannelRef.current = supabase
      .channel('documents')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${state.user.id}`,
        },
        (payload) => {
          const newDocument: Document = {
            id: payload.new.id,
            title: payload.new.title || 'Untitled Document',
            user_id: payload.new.user_id,
            file_name: payload.new.file_name || '',
            file_type: payload.new.file_type || '',
            file_url: payload.new.file_url || '',
            file_size: payload.new.file_size || 0,
            content_extracted: payload.new.content_extracted || null,
            type: payload.new.type as Document['type'],
            processing_status: String(payload.new.processing_status) || null,
            processing_error: String(payload.new.processing_error) || null,
            created_at: new Date(payload.new.created_at).toISOString(),
            updated_at: new Date(payload.new.updated_at).toISOString()
          };
          dispatch({ type: 'ADD_DOCUMENT', payload: newDocument });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${state.user.id}`,
        },
        (payload) => {
          const updatedDocument: Document = {
            id: payload.new.id,
            title: payload.new.title || 'Untitled Document',
            user_id: payload.new.user_id,
            file_name: payload.new.file_name || '',
            file_type: payload.new.file_type || '',
            file_url: payload.new.file_url || '',
            file_size: payload.new.file_size || 0,
            content_extracted: payload.new.content_extracted || null,
            type: payload.new.type as Document['type'],
            processing_status: String(payload.new.processing_status) || null,
            processing_error: String(payload.new.processing_error) || null,
            created_at: new Date(payload.new.created_at).toISOString(),
            updated_at: new Date(payload.new.updated_at).toISOString()
          };
          dispatch({ type: 'UPDATE_DOCUMENT', payload: updatedDocument });
        }
      )
      .subscribe();
  }, [state.user?.id]);

  // Unsubscribe from document updates
  const unsubscribeFromDocuments = useCallback(() => {
    if (documentChannelRef.current) {
      supabase.removeChannel(documentChannelRef.current);
      documentChannelRef.current = null;
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch({ type: 'SET_USER', payload: session?.user || null });
    });

    // Initial auth check
    supabase.auth.getUser().then(({ data: { user } }) => {
      dispatch({ type: 'SET_USER', payload: user || null });
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load initial data when user changes
  useEffect(() => {
    if (state.user?.id) {
      loadUserProfile();
      loadChatSessions();
      loadDocuments();
      loadNotes();
      subscribeToDocuments();
    } else {
      // Clear data when user logs out
      dispatch({ type: 'SET_USER_PROFILE', payload: null });
      dispatch({ type: 'SET_MESSAGES', payload: [] });
      dispatch({ type: 'SET_CHAT_SESSIONS', payload: [] });
      dispatch({ type: 'SET_DOCUMENTS', payload: [] });
      dispatch({ type: 'SET_SESSION_DOCUMENTS', payload: [] });
      dispatch({ type: 'SET_NOTES', payload: [] });
      unsubscribeFromMessages();
      unsubscribeFromDocuments();
    }
  }, [state.user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromMessages();
      unsubscribeFromDocuments();
    };
  }, []);

  const contextValue: AppContextType = {
    state,
    dispatch,
    loadUserProfile,
    loadChatMessages,
    loadChatSessions,
    loadDocuments,
    loadSessionDocuments,
    loadNotes,
    subscribeToMessages,
    unsubscribeFromMessages,
    subscribeToDocuments,
    unsubscribeFromDocuments,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
};

// Hook to use the context
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
