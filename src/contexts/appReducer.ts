// contexts/appReducer.ts - Complete reducer with all action types
import { ChatSession, Message } from '../types/Class';

// Extended action types for the complete app state management
export type AppAction =
  // Theme actions
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  
  // Chat session actions
  | { type: 'SET_CHAT_SESSIONS'; payload: ChatSession[] }
  | { type: 'SET_ACTIVE_CHAT_SESSION'; payload: string | null }
  | { type: 'ADD_CHAT_SESSION'; payload: ChatSession }
  | { type: 'UPDATE_CHAT_SESSION'; payload: { id: string; updates: Partial<ChatSession> } }
  | { type: 'REMOVE_CHAT_SESSION'; payload: string }
  
  // Document and attachment actions
  | { type: 'SET_SELECTED_DOCUMENT_IDS'; payload: string[] }
  | { type: 'ADD_SELECTED_DOCUMENT_ID'; payload: string }
  | { type: 'REMOVE_SELECTED_DOCUMENT_ID'; payload: string }
  | { type: 'CLEAR_SELECTED_DOCUMENT_IDS' }
  
  // UI state actions
  | { type: 'SET_IS_NOTES_HISTORY_OPEN'; payload: boolean }
  | { type: 'TOGGLE_NOTES_HISTORY' }
  | { type: 'SET_IS_SUBMITTING_USER_MESSAGE'; payload: boolean }
  | { type: 'SET_IS_LOADING_SESSION_MESSAGES'; payload: boolean }
  | { type: 'SET_IS_AI_LOADING'; payload: boolean }
  
  // File processing actions
  | { type: 'SET_FILE_PROCESSING_PROGRESS'; payload: FileProcessingProgress }
  | { type: 'START_FILE_PROCESSING'; payload: { total: number; currentFile?: string } }
  | { type: 'UPDATE_FILE_PROCESSING'; payload: { completed: number; currentFile?: string; phase?: string } }
  | { type: 'COMPLETE_FILE_PROCESSING' }
  | { type: 'RESET_FILE_PROCESSING' }
  
  // Pagination actions
  | { type: 'SET_CHAT_SESSIONS_LOADED_COUNT'; payload: number }
  | { type: 'INCREMENT_CHAT_SESSIONS_LOADED_COUNT'; payload: number }
  | { type: 'SET_HAS_MORE_CHAT_SESSIONS'; payload: boolean }
  | { type: 'SET_HAS_MORE_MESSAGES'; payload: boolean }
  
  // Message actions
  | { type: 'UPDATE_MESSAGE'; payload: Message }
  | { type: 'REPLACE_OPTIMISTIC_MESSAGE'; payload: { tempId: string; newMessage: Message } }
  | { type: 'SET_MESSAGE_UPDATING'; payload: { messageId: string; isUpdating: boolean } }
  | { type: 'SET_MESSAGE_ERROR'; payload: { messageId: string; isError: boolean } }
  | {type: 'SET_IS_AI_LOADING' ; payload: boolean }
  // Search and filter actions
  | { type: 'SET_SELECTED_CATEGORY'; payload: string }
  | { type: 'CLEAR_SELECTED_CATEGORY' }
  
  // Navigation actions
  | { type: 'SET_CURRENT_TAB'; payload: string }
  
  // Bulk state updates
  | { type: 'RESET_CHAT_STATE' }
  | { type: 'RESET_ALL_STATE' };
  
// File processing progress interface
export interface FileProcessingProgress {
  processing: boolean;
  completed: number;
  total: number;
  currentFile?: string;
  phase?: 'validating' | 'processing' | 'uploading' | 'complete';
}

// Complete app state interface
export interface AppState {
  // Theme
  currentTheme: 'light' | 'dark';
  
  // Chat management
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  selectedDocumentIds: string[];
  
  // UI state
  isNotesHistoryOpen: boolean;
  isSubmittingUserMessage: boolean;
  isLoadingSessionMessages: boolean;
  isAILoading: boolean;
  selectedCategory: string;
  currentTab: string;
  
  // File processing
  fileProcessingProgress: FileProcessingProgress;
  
  // Pagination
  chatSessionsLoadedCount: number;
  hasMoreChatSessions: boolean;
  hasMoreMessages: boolean;
}

// Initial state
export const initialAppState: AppState = {
  currentTheme: (typeof window !== 'undefined' 
    ? (localStorage.getItem('theme') as 'light' | 'dark') || 'dark' 
    : 'dark'),
  chatSessions: [],
  activeChatSessionId: null,
  selectedDocumentIds: [],
  isNotesHistoryOpen: false,
  isSubmittingUserMessage: false,
  isLoadingSessionMessages: false,
  isAILoading: false,
  selectedCategory: '',
  currentTab: 'dashboard',
  fileProcessingProgress: {
    processing: false,
    completed: 0,
    total: 0,
  },
  chatSessionsLoadedCount: 15,
  hasMoreChatSessions: true,
  hasMoreMessages: true,
};

// Enhanced reducer function
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Theme actions
    case 'SET_THEME':
      return { ...state, currentTheme: action.payload };
    
    // Chat session actions
    case 'SET_CHAT_SESSIONS':
      return { ...state, chatSessions: action.payload };
    
    case 'SET_ACTIVE_CHAT_SESSION':
      return { 
        ...state, 
        activeChatSessionId: action.payload,
        // Reset message pagination when switching sessions
        hasMoreMessages: action.payload ? true : false,
        isLoadingSessionMessages: false,
      };
    
    case 'ADD_CHAT_SESSION':
      return {
        ...state,
        chatSessions: [action.payload, ...state.chatSessions].sort(
          (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        ),
      };
    
    case 'UPDATE_CHAT_SESSION':
      return {
        ...state,
        chatSessions: state.chatSessions.map(session =>
          session.id === action.payload.id 
            ? { ...session, ...action.payload.updates }
            : session
        ).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()),
      };
    
    case 'REMOVE_CHAT_SESSION':
      return {
        ...state,
        chatSessions: state.chatSessions.filter(session => session.id !== action.payload),
        // If we're removing the active session, clear it
        activeChatSessionId: state.activeChatSessionId === action.payload ? null : state.activeChatSessionId,
      };
    
    // Document selection actions
    case 'SET_SELECTED_DOCUMENT_IDS':
      return { ...state, selectedDocumentIds: action.payload };
    
    case 'ADD_SELECTED_DOCUMENT_ID':
      return { 
        ...state, 
        selectedDocumentIds: [...state.selectedDocumentIds, action.payload] 
      };
    
    case 'REMOVE_SELECTED_DOCUMENT_ID':
      return { 
        ...state, 
        selectedDocumentIds: state.selectedDocumentIds.filter(id => id !== action.payload) 
      };
    
    case 'CLEAR_SELECTED_DOCUMENT_IDS':
      return { ...state, selectedDocumentIds: [] };
    
    // UI state actions
    case 'SET_IS_NOTES_HISTORY_OPEN':
      return { ...state, isNotesHistoryOpen: action.payload };
    
    case 'TOGGLE_NOTES_HISTORY':
      return { ...state, isNotesHistoryOpen: !state.isNotesHistoryOpen };
    
    case 'SET_IS_SUBMITTING_USER_MESSAGE':
      return { ...state, isSubmittingUserMessage: action.payload };
    
    case 'SET_IS_LOADING_SESSION_MESSAGES':
      return { ...state, isLoadingSessionMessages: action.payload };
    
    case 'SET_IS_AI_LOADING':
      return { ...state, isAILoading: action.payload };
    
    // File processing actions
    case 'SET_FILE_PROCESSING_PROGRESS':
      return { ...state, fileProcessingProgress: action.payload };
    
    case 'START_FILE_PROCESSING':
      return {
        ...state,
        fileProcessingProgress: {
          processing: true,
          completed: 0,
          total: action.payload.total,
          currentFile: action.payload.currentFile,
          phase: 'validating',
        },
      };
    
    case 'UPDATE_FILE_PROCESSING':
      return {
        ...state,
        fileProcessingProgress: {
          ...state.fileProcessingProgress,
          completed: action.payload.completed,
          currentFile: action.payload.currentFile,
          phase: action.payload.phase as any,
        },
      };
    
    case 'COMPLETE_FILE_PROCESSING':
      return {
        ...state,
        fileProcessingProgress: {
          ...state.fileProcessingProgress,
          processing: false,
          phase: 'complete',
        },
      };
    
    case 'RESET_FILE_PROCESSING':
      return {
        ...state,
        fileProcessingProgress: {
          processing: false,
          completed: 0,
          total: 0,
        },
      };
    
    // Pagination actions
    case 'SET_CHAT_SESSIONS_LOADED_COUNT':
      return { ...state, chatSessionsLoadedCount: action.payload };
    
    case 'INCREMENT_CHAT_SESSIONS_LOADED_COUNT':
      return { 
        ...state, 
        chatSessionsLoadedCount: state.chatSessionsLoadedCount + action.payload 
      };
    
    case 'SET_HAS_MORE_CHAT_SESSIONS':
      return { ...state, hasMoreChatSessions: action.payload };
    
    case 'SET_HAS_MORE_MESSAGES':
      return { ...state, hasMoreMessages: action.payload };
    
    // Search and filter actions
    case 'SET_SELECTED_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    
    case 'CLEAR_SELECTED_CATEGORY':
      return { ...state, selectedCategory: '' };
    
    // Navigation actions
    case 'SET_CURRENT_TAB':
      return { ...state, currentTab: action.payload };
    
    // Bulk reset actions
    case 'RESET_CHAT_STATE':
      return {
        ...state,
        activeChatSessionId: null,
        selectedDocumentIds: [],
        isNotesHistoryOpen: false,
        isSubmittingUserMessage: false,
        isLoadingSessionMessages: false,
        hasMoreMessages: true,
        fileProcessingProgress: {
          processing: false,
          completed: 0,
          total: 0,
        },
      };
    
    case 'RESET_ALL_STATE':
      return { ...initialAppState, currentTheme: state.currentTheme };
    
    default:
      return state;
  }
}

// Action creators for common operations
export const appActions = {
  // Theme
  setTheme: (theme: 'light' | 'dark'): AppAction => ({ 
    type: 'SET_THEME', 
    payload: theme 
  }),
  
  // Chat sessions
  setActiveChatSession: (sessionId: string | null): AppAction => ({ 
    type: 'SET_ACTIVE_CHAT_SESSION', 
    payload: sessionId 
  }),
  
  updateChatSession: (id: string, updates: Partial<ChatSession>): AppAction => ({ 
    type: 'UPDATE_CHAT_SESSION', 
    payload: { id, updates } 
  }),
  
  // Document selection
  toggleDocumentSelection: (documentId: string, isSelected: boolean): AppAction => 
    isSelected 
      ? { type: 'ADD_SELECTED_DOCUMENT_ID', payload: documentId }
      : { type: 'REMOVE_SELECTED_DOCUMENT_ID', payload: documentId },
  
  // File processing
  startFileProcessing: (total: number, currentFile?: string): AppAction => ({ 
    type: 'START_FILE_PROCESSING', 
    payload: { total, currentFile } 
  }),
  
  updateFileProcessing: (completed: number, currentFile?: string, phase?: string): AppAction => ({ 
    type: 'UPDATE_FILE_PROCESSING', 
    payload: { completed, currentFile, phase } 
  }),
  
  // UI toggles
  toggleNotesHistory: (): AppAction => ({ type: 'TOGGLE_NOTES_HISTORY' }),
  
  // Loading states
  setLoadingState: (
    loading: boolean, 
    type: 'ai' | 'messages' | 'submitting'
  ): AppAction => {
    switch (type) {
      case 'ai':
        return { type: 'SET_IS_AI_LOADING', payload: loading };
      case 'messages':
        return { type: 'SET_IS_LOADING_SESSION_MESSAGES', payload: loading };
      case 'submitting':
        return { type: 'SET_IS_SUBMITTING_USER_MESSAGE', payload: loading };
      default:
        return { type: 'SET_IS_AI_LOADING', payload: loading };
    }
  },
};