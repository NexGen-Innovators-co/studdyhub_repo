// Index.tsx - Fixed Dashboard Integration
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { TabContent } from '../components/TabContent';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../hooks/useAppData';
import { useAppOperations } from '../hooks/useAppOperations';
import { Button } from '../components/ui/button';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Message, Quiz, ClassRecording } from '../types/Class';
import { Document as AppDocument, UserProfile } from '../types/Document';
import { Note } from '../types/Note';
import { User } from '@supabase/supabase-js';
import { generateId } from '@/utils/helpers';
import { useAudioProcessing } from '../hooks/useAudioProcessing';
import Dashboard from '../components/Dashboard';
import BookPagesAnimation, { LoadingScreen } from '@/components/bookloader';

// Enhanced loading component with progress


// Enhanced interface definitions
interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface FileData {
  name: string;
  mimeType: string;
  data: string | null;
  type: 'image' | 'document' | 'other';
  size: number;
  content: string | null;
  processing_status: string;
  processing_error: string | null;
}

// Optimized constants
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_FILES_PER_MESSAGE = 10;
const MAX_TOTAL_CONTEXT_SIZE = 2 * 1024 * 1024;
const MAX_SINGLE_FILE_CONTEXT = 500 * 1024;
const MAX_HISTORY_MESSAGES = 30;
const CHAT_SESSIONS_PER_PAGE = 15;
const CHAT_MESSAGES_PER_PAGE = 25;

// Enhanced file type configuration
const SUPPORTED_FILE_TYPES = {
  'image/jpeg': { type: 'image', maxSize: 20 * 1024 * 1024, priority: 'high' },
  'image/png': { type: 'image', maxSize: 20 * 1024 * 1024, priority: 'high' },
  'image/gif': { type: 'image', maxSize: 10 * 1024 * 1024, priority: 'medium' },
  'image/webp': { type: 'image', maxSize: 15 * 1024 * 1024, priority: 'high' },
  'image/svg+xml': { type: 'image', maxSize: 5 * 1024 * 1024, priority: 'medium' },
  'application/pdf': { type: 'document', maxSize: 50 * 1024 * 1024, priority: 'high' },
  'application/msword': { type: 'document', maxSize: 25 * 1024 * 1024, priority: 'medium' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'document', maxSize: 25 * 1024 * 1024, priority: 'high' },
  'application/vnd.ms-excel': { type: 'spreadsheet', maxSize: 20 * 1024 * 1024, priority: 'medium' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { type: 'spreadsheet', maxSize: 20 * 1024 * 1024, priority: 'high' },
  'text/plain': { type: 'text', maxSize: 10 * 1024 * 1024, priority: 'high', fastProcess: true },
  'text/csv': { type: 'csv', maxSize: 15 * 1024 * 1024, priority: 'high', fastProcess: true },
  'text/markdown': { type: 'text', maxSize: 5 * 1024 * 1024, priority: 'high', fastProcess: true },
  'application/json': { type: 'json', maxSize: 5 * 1024 * 1024, priority: 'medium', fastProcess: true },
  'text/javascript': { type: 'code', maxSize: 2 * 1024 * 1024, priority: 'medium', fastProcess: true },
  'text/typescript': { type: 'code', maxSize: 2 * 1024 * 1024, priority: 'medium', fastProcess: true },
  'text/css': { type: 'code', maxSize: 2 * 1024 * 1024, priority: 'low', fastProcess: true },
  'text/html': { type: 'code', maxSize: 5 * 1024 * 1024, priority: 'medium', fastProcess: true }
};

// Enhanced file validation
const validateFileForProcessing = (file: File): {
  valid: boolean;
  error?: string;
  warnings?: string[];
  config?: any;
} => {
  const config = SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES];

  if (!config) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Please use supported formats like PDF, Word, Excel, images, or text files.`
    };
  }

  if (file.size > config.maxSize) {
    return {
      valid: false,
      error: `File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size for ${config.type} files is ${Math.round(config.maxSize / 1024 / 1024)}MB.`
    };
  }

  const warnings: string[] = [];

  if (file.size > config.maxSize * 0.7) {
    warnings.push('Large file may take longer to process');
  }

  if (['spreadsheet', 'document'].includes(config.type) && file.size > 10 * 1024 * 1024) {
    warnings.push('Complex document structure may require additional processing time');
  }

  return { valid: true, warnings, config };
};

// Enhanced context optimization
const estimateContextSize = (content: any[]): number => {
  return JSON.stringify(content).length;
};

const optimizeContextForProcessing = (
  chatHistory: Array<{ role: string; parts: MessagePart[] }>,
  currentContextParts: MessagePart[] // Changed to accept MessagePart[]
): Array<{ role: string; parts: MessagePart[] }> => {
  let totalSize = estimateContextSize([{ role: 'user', parts: currentContextParts }]);
  const optimizedHistory: Array<{ role: string; parts: MessagePart[] }> = [];

  // Start with the current user message and its immediate context/files
  const currentUserMessage = { role: 'user', parts: currentContextParts };

  for (let i = chatHistory.length - 1; i >= 0 && totalSize < MAX_TOTAL_CONTEXT_SIZE; i--) {
    const messageSize = estimateContextSize([chatHistory[i]]);

    if (totalSize + messageSize <= MAX_TOTAL_CONTEXT_SIZE) {
      optimizedHistory.unshift(chatHistory[i]);
      totalSize += messageSize;
    } else {
      break;
    }
  }

  return [...optimizedHistory, currentUserMessage];
};

const extractFirstSentence = (text: string): string => {
  if (!text || text.trim() === '') return 'New Chat';

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 'New Chat';

  const firstSentence = sentences[0].trim();
  return firstSentence.length > 100 ? firstSentence.substring(0, 97) + '...' : firstSentence;
};

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = new URL(window.location.href);

  // Theme management
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      if (currentTheme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      localStorage.setItem('theme', currentTheme);
    }
  }, [currentTheme]);

  const handleThemeChange = useCallback((theme: 'light' | 'dark') => {
    setCurrentTheme(theme);
  }, []);

  // Enhanced app data with progressive loading - FIXED: Include 'dashboard' in the type
  const {
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
    loading: dataLoading,
    quizzes,
    dataLoading: specificDataLoading,
    dataPagination,
    loadingPhase,
    loadingProgress,
    loadingMessage,
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
  } = useAppData();

  // Audio processing
  const {
    handleGenerateNoteFromAudio,
    triggerAudioProcessing,
  } = useAudioProcessing({
    onAddRecording: (rec) => setRecordings(prev => [...prev, rec]),
    onUpdateRecording: (rec) => setRecordings(prev => prev.map(r => r.id === rec.id ? rec : r))
  });

  // Chat session management
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isNotesHistoryOpen, setIsNotesHistoryOpen] = useState(false);
  const [isSubmittingUserMessage, setIsSubmittingUserMessage] = useState(false);
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false);

  // Enhanced file processing state
  const [fileProcessingProgress, setFileProcessingProgress] = useState<{
    processing: boolean;
    completed: number;
    total: number;
    currentFile?: string;
    phase?: 'validating' | 'processing' | 'uploading' | 'complete';
  }>({ processing: false, completed: 0, total: 0 });

  const [chatSessionsLoadedCount, setChatSessionsLoadedCount] = useState(CHAT_SESSIONS_PER_PAGE);
  const [hasMoreChatSessions, setHasMoreChatSessions] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // Enhanced tab management - FIXED: Include 'dashboard' type
  const currentActiveTab = useMemo(() => {
    const path = location.pathname.split('/')[1];
    switch (path) {
      case 'notes': return 'notes';
      case 'recordings': return 'recordings';
      case 'schedule': return 'schedule';
      case 'chat': return 'chat';
      case 'documents': return 'documents';
      case 'settings': return 'settings';
      default: return 'dashboard';
    }
  }, [location.pathname]) as 'dashboard' | 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings';

  useEffect(() => {
    // FIXED: Cast to the expected type
    setActiveTab(currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings');
  }, [currentActiveTab, setActiveTab]);

  // Smart data loading based on tab activation
  useEffect(() => {
    // Only trigger loading if we're past initial loading phase
    if (loadingPhase.phase === 'complete') {
      switch (currentActiveTab) {
        case 'dashboard':
          // Dashboard needs overview of all data
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
  }, [currentActiveTab, loadingPhase.phase, loadDataIfNeeded]);

  // Chat session loading
  const loadChatSessions = useCallback(async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .range(0, chatSessionsLoadedCount - 1);

      if (error) throw error;

      const formattedSessions: ChatSession[] = data.map(session => ({
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
        last_message_at: session.last_message_at,
        document_ids: session.document_ids || [],
      }));

      setChatSessions(formattedSessions);
      setHasMoreChatSessions(formattedSessions.length === chatSessionsLoadedCount);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      toast.error('Failed to load chat sessions.');
    }
  }, [user, chatSessionsLoadedCount]);

  const handleLoadMoreChatSessions = useCallback(() => {
    setChatSessionsLoadedCount(prevCount => prevCount + CHAT_SESSIONS_PER_PAGE);
  }, []);

  // Chat message filtering and loading
  const filteredChatMessages = useMemo(() => {
    if (!activeChatSessionId) return [];

    return allChatMessages
      .filter(msg => msg.session_id === activeChatSessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [allChatMessages, activeChatSessionId]);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!user) return;
    setIsLoadingSessionMessages(true);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(CHAT_MESSAGES_PER_PAGE);

      if (error) throw error;

      const fetchedMessages: Message[] = data.map((msg: any) => ({
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
      }));

      setChatMessages(prevAllMessages => {
        const newMessagesToAdd = fetchedMessages.filter(
          fm => !prevAllMessages.some(pm => pm.id === fm.id)
        );
        return [...prevAllMessages, ...newMessagesToAdd].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      setHasMoreMessages(data.length === CHAT_MESSAGES_PER_PAGE);

    } catch (error) {
      console.error('Error loading session messages:', error);
      toast.error('Failed to load chat messages for this session.');
    } finally {
      setIsLoadingSessionMessages(false);
    }
  }, [user, setChatMessages]);

  // Enhanced message loading with better UX
  const handleLoadOlderChatMessages = useCallback(async () => {
    if (!activeChatSessionId || !user || filteredChatMessages.length === 0) return;

    const oldestMessageTimestamp = filteredChatMessages[0].timestamp;

    try {
      setIsLoadingSessionMessages(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', activeChatSessionId)
        .lt('timestamp', oldestMessageTimestamp)
        .order('timestamp', { ascending: false })
        .limit(CHAT_MESSAGES_PER_PAGE);

      if (error) throw error;

      const olderMessages: Message[] = data.map((msg: any) => ({
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
        return [...prevAllMessages, ...newMessagesToAdd].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      setHasMoreMessages(data.length === CHAT_MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Error loading older messages:', error);
      toast.error('Failed to load older messages.');
    } finally {
      setIsLoadingSessionMessages(false);
    }
  }, [activeChatSessionId, user, filteredChatMessages, setChatMessages]);

  // Load data when conditions are met
  useEffect(() => {
    if (user && loadingPhase.phase === 'complete') {
      loadChatSessions();
    }
  }, [user, loadChatSessions, chatSessionsLoadedCount, loadingPhase.phase]);

  useEffect(() => {
    if (activeChatSessionId && loadingPhase.phase === 'complete') {
      loadSessionMessages(activeChatSessionId);
    } else if (!activeChatSessionId) {
      setHasMoreMessages(false);
    }
  }, [activeChatSessionId, user, loadSessionMessages, loadingPhase.phase]);

  // Chat session document management
  useEffect(() => {
    if (activeChatSessionId && chatSessions.length > 0) {
      const currentSession = chatSessions.find(s => s.id === activeChatSessionId);
      if (currentSession) {
        setSelectedDocumentIds(currentSession.document_ids || []);
      }
    } else if (!activeChatSessionId) {
      setSelectedDocumentIds([]);
    }
  }, [activeChatSessionId, chatSessions]);

  // Enhanced chat session creation
  const createNewChatSession = useCallback(async (): Promise<string | null> => {
    try {
      if (!user) {
        toast.error('Please sign in to create a new chat session.');
        return null;
      }

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: 'New Chat',
          document_ids: selectedDocumentIds,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data returned from session creation');

      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_message_at: data.last_message_at,
        document_ids: data.document_ids || [],
      };

      setChatSessions(prev => [...prev, newSession].sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
      setChatSessionsLoadedCount(CHAT_SESSIONS_PER_PAGE);
      await loadChatSessions();

      setActiveChatSessionId(newSession.id);
      setSelectedDocumentIds(newSession.document_ids || []);
      setHasMoreMessages(false);

      // Auto-update title based on first AI response
      const subscription = supabase
        .channel(`chat_messages:session:${newSession.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${newSession.id}` },
          async (payload) => {
            if (payload.new.role === 'assistant') {
              const firstSentence = extractFirstSentence(payload.new.content);
              try {
                const { error: updateError } = await supabase
                  .from('chat_sessions')
                  .update({ title: firstSentence })
                  .eq('id', newSession.id)
                  .eq('user_id', user.id);

                if (updateError) throw updateError;

                setChatSessions(prev =>
                  prev.map(s => (s.id === newSession.id ? { ...s, title: firstSentence } : s))
                );
              } catch (updateError) {
                console.error('Error updating session title:', updateError);
              }
              subscription.unsubscribe();
            }
          }
        )
        .subscribe();

      toast.success('New chat session created!');
      return newSession.id;
    } catch (error: any) {
      console.error('Error creating new session:', error);
      toast.error(`Failed to create new chat session: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [user, selectedDocumentIds, setChatSessions, setChatSessionsLoadedCount, loadChatSessions, setActiveChatSessionId, setSelectedDocumentIds]);

  // Enhanced session management
  const deleteChatSession = useCallback(async (sessionId: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setChatSessionsLoadedCount(CHAT_SESSIONS_PER_PAGE);
      await loadChatSessions();

      if (activeChatSessionId === sessionId) {
        if (chatSessions.length > 1) {
          const remainingSessions = chatSessions.filter(s => s.id !== sessionId);
          if (remainingSessions.length > 0) {
            const mostRecent = remainingSessions.sort((a, b) =>
              new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            )[0];
            setActiveChatSessionId(mostRecent.id);
          } else {
            setActiveChatSessionId(null);
            setHasMoreMessages(false);
          }
        } else {
          setActiveChatSessionId(null);
          setHasMoreMessages(false);
        }
      }

      toast.success('Chat session deleted.');
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(`Failed to delete chat session: ${error.message || 'Unknown error'}`);
    }
  }, [user, chatSessions, activeChatSessionId, setChatSessionsLoadedCount, loadChatSessions, setActiveChatSessionId]);

  const renameChatSession = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: newTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setChatSessions(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, title: newTitle } : s))
      );
      toast.success('Chat session renamed.');
    } catch (error) {
      console.error('Error renaming session:', error);
      toast.error('Failed to rename chat session');
    }
  }, [user, setChatSessions]);

  // Enhanced context building - REMOVED TRUNCATION LOGIC HERE
  const buildRichContext = useCallback((
    documentIdsToInclude: string[],
    noteIdsToInclude: string[],
    allDocuments: AppDocument[],
    allNotes: Note[]
  ) => {
    const selectedDocs = (allDocuments ?? []).filter(doc => (documentIdsToInclude ?? []).includes(doc.id));
    const selectedNotes = (allNotes ?? []).filter(note => (noteIdsToInclude ?? []).includes(note.id));

    let context = '';
    
    if (selectedDocs.length > 0) {
      context += 'ATTACHED DOCUMENTS:\n';
      for (const doc of selectedDocs) {
        const docInfo = `Title: ${doc.title}\nFile: ${doc.file_name}\nType: ${doc.type}\n`;
        if (doc.content_extracted) {
          context += docInfo + `Content: ${doc.content_extracted}\n\n`; // No truncation
        } else {
          context += docInfo + `Content: ${doc.processing_status === 'completed' ? 'No extractable content found' : `Processing status: ${doc.processing_status || 'pending'}`}\n\n`;
        }
      }
    }

    if (selectedNotes.length > 0) { // No size check here, as it's handled by overall context size
      context += 'ATTACHED NOTES:\n';
      selectedNotes.forEach(note => {
        const noteInfo = `Title: ${note.title}\nCategory: ${note.category}\n`;
        let noteContent = '';
        if (note.content) {
          noteContent = note.content; // No truncation
        }

        const noteBlock = noteInfo + (noteContent ? `Content: ${noteContent}\n` : '') +
          (note.aiSummary ? `Summary: ${note.aiSummary}\n` : '') + // No truncation for summary
          (note.tags?.length ? `Tags: ${note.tags.join(', ')}\n` : '') + '\n';

        context += noteBlock;
      });
    }

    return context;
  }, []);

  // Enhanced message submission with better progress tracking
  const handleSubmit = useCallback(async (
    messageContent: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    imageUrl?: string,
    imageMimeType?: string,
    imageDataBase64?: string, // This parameter is not used, remove if not needed
    aiMessageIdToUpdate: string | null = null,
    attachedFiles?: FileData[]
  ) => {
    const hasTextContent = messageContent?.trim();
    const hasAttachments = (attachedDocumentIds && attachedDocumentIds.length > 0) ||
      (attachedNoteIds && attachedNoteIds.length > 0) ||
      imageUrl ||
      (attachedFiles && attachedFiles.length > 0);

    if (!hasTextContent && !hasAttachments) {
      toast.warning('Please enter a message or attach files to send.');
      return;
    }

    if (isAILoading || isSubmittingUserMessage) {
      toast.info('Please wait for the current message to complete.');
      return;
    }

    setIsSubmittingUserMessage(true);
    setIsAILoading(true);
    let processedFiles: FileData[] = attachedFiles || [];

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error('You must be logged in to chat.');
        return;
      }

      let currentSessionId = activeChatSessionId;

      if (!currentSessionId) {
        currentSessionId = await createNewChatSession();
        if (!currentSessionId) {
          toast.error('Failed to create chat session. Please try again.');
          return;
        }
      }

      let finalAttachedDocumentIds = attachedDocumentIds || [];
      const finalAttachedNoteIds = attachedNoteIds || [];

      // Optimistically show the user's message in the chat UI (no DB write here)
      if (!aiMessageIdToUpdate && hasTextContent) {
        const optimisticUserId = 'optimistic-' + generateId();
        const optimisticUserMessage: Message = {
          id: optimisticUserId,
          content: messageContent,
          role: 'user',
          timestamp: new Date().toISOString(),
          isError: false,
          attachedDocumentIds: finalAttachedDocumentIds,
          attachedNoteIds: finalAttachedNoteIds,
          imageUrl,
          imageMimeType,
          session_id: currentSessionId || undefined,
          has_been_displayed: false,
        };
        setChatMessages(prev => [...prev, optimisticUserMessage]);
      }

      // Enhanced file processing progress
      if (attachedFiles && attachedFiles.length > 0) {
        setFileProcessingProgress({
          processing: true,
          completed: 0,
          total: attachedFiles.length,
          phase: 'validating'
        });
        toast.info(`Processing ${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''}...`);
      }

      // Build the parts for the *current* user message (text, documents, notes, files)
      const currentMessageParts: MessagePart[] = [];
      if (messageContent) {
        currentMessageParts.push({ text: messageContent }); // Ensure full message content
      }

      const currentAttachedContext = buildRichContext(finalAttachedDocumentIds, finalAttachedNoteIds, documents, notes);
      if (currentAttachedContext) {
        currentMessageParts.push({ text: `\n\nAttached Context:\n${currentAttachedContext}` });
      }

      if (imageUrl && imageMimeType) {
        // This handles cases where an image URL is directly provided (e.g., for regeneration)
        // If image data base64 is also present, prefer it for sending
        if (imageDataBase64) {
          currentMessageParts.push({
            inlineData: { mimeType: imageMimeType, data: imageDataBase64 }
          });
        } else {
          // If only URL is present, you might need a way to fetch its data or send the URL
          // For now, if no base64, we rely on the backend to handle the URL if it can.
          // Or, this part of the code needs to be smart enough to fetch the image data.
          // Given the prompt, we are removing truncation, not adding image fetching.
          // So for regeneration, if imageDataBase64 is not passed, the image won't be sent as inlineData.
        }
      }

      processedFiles.forEach(file => {
        if (file.content) {
          currentMessageParts.push({ text: `[File: ${file.name}]\n${file.content}` });
        } else if (file.data && file.type === 'image') {
          currentMessageParts.push({
            inlineData: { mimeType: file.mimeType, data: file.data }
          });
        }
      });
      
      const historicalMessagesForAI = allChatMessages
        .filter(msg => msg.session_id === currentSessionId)
        .filter(msg => !(aiMessageIdToUpdate && msg.id === aiMessageIdToUpdate))
        .slice(-MAX_HISTORY_MESSAGES);

      const chatHistoryForAI: Array<{ role: string; parts: MessagePart[] }> = [];

      // Reconstruct chat history for AI, ensuring full content of past messages
      historicalMessagesForAI.forEach(msg => {
        const msgParts: MessagePart[] = [{ text: msg.content }];
        // Add attached document/note context for historical messages if available and not too large
        if (msg.attachedDocumentIds && msg.attachedDocumentIds.length > 0 || msg.attachedNoteIds && msg.attachedNoteIds.length > 0) {
          const historicalContext = buildRichContext(
            msg.attachedDocumentIds || [],
            msg.attachedNoteIds || [],
            documents,
            notes
          );
          if (historicalContext && historicalContext.length < 50000) { // Still apply a limit to historical context additions
            msgParts.push({ text: `\n\nPrevious Context:\n${historicalContext}` });
          }
        }
        // If an old message had an image, include its reference if possible (or actual data if stored)
        if (msg.imageUrl && msg.imageMimeType) {
          // If you stored base64 data for past images, you'd use it here.
          // Otherwise, only the URL would be implied context unless the backend fetches it.
          // For now, assuming image data is handled by `processedFiles` for current input,
          // or that the backend is aware of past image URLs.
        }
        chatHistoryForAI.push({ role: msg.role, parts: msgParts });
      });


      const optimizedContent = optimizeContextForProcessing(
        chatHistoryForAI,
        currentMessageParts // Pass the built current message parts
      );

      // Update progress before sending
      if (fileProcessingProgress.processing) {
        setFileProcessingProgress(prev => ({ ...prev, phase: 'uploading' }));
      }

      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          userId: currentUser.id,
          sessionId: currentSessionId,
          learningStyle: userProfile?.learning_style || 'visual',
          learningPreferences: userProfile?.learning_preferences || {
            explanation_style: 'detailed',
            examples: false,
            difficulty: 'intermediate',
          },
          chatHistory: optimizedContent.slice(0, -1), // All messages EXCEPT the last one (current user input)
          message: optimizedContent[optimizedContent.length - 1].parts[0].text, // The primary text of the current user message
          // Send full files payload so backend can store and attach them (images, pdfs, docs, etc.)
          files: processedFiles,
          attachedDocumentIds: finalAttachedDocumentIds,
          attachedNoteIds: finalAttachedNoteIds,
          imageUrl: imageUrl, // Pass imageUrl if it's still relevant (e.g., for regeneration)
          imageMimeType: imageMimeType, // Pass imageMimeType if it's still relevant
          aiMessageIdToUpdate: aiMessageIdToUpdate,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(`AI service error: ${error.message || 'Unknown error'}`);
      }

      if (!data || !data.response) {
        throw new Error('Empty response from AI service');
      }

      // Immediately reflect AI response in UI to avoid waiting for realtime
      if (aiMessageIdToUpdate) {
        setChatMessages(prev => (prev || []).map(m =>
          m.id === aiMessageIdToUpdate
            ? { ...m, content: data.response, isUpdating: false, isError: false }
            : m
        ));
      } else {
        const optimisticAssistantId = 'optimistic-' + generateId();
        const optimisticAssistantMessage: Message = {
          id: optimisticAssistantId,
          content: data.response,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          isError: false,
          session_id: currentSessionId || undefined,
          has_been_displayed: false,
        };
        setChatMessages(prev => [...(prev || []), optimisticAssistantMessage]);
      }

      setChatSessions(prev => {
        const updated = prev.map(session =>
          session.id === currentSessionId
            ? {
              ...session,
              last_message_at: new Date().toISOString(),
              document_ids: [...new Set([...session.document_ids, ...finalAttachedDocumentIds])]
            }
            : session
        );
        return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      });

      // Enhanced success messaging
      if (processedFiles.length > 0) {
        const successful = processedFiles.filter(f => f.processing_status === 'completed').length;
        const failed = processedFiles.filter(f => f.processing_status === 'failed').length;

        if (successful > 0 && failed === 0) {
          toast.success(`✅ Successfully processed ${successful} file${successful > 1 ? 's' : ''}`);
        } else if (successful > 0 && failed > 0) {
          toast.warning(`⚠️ Processed ${successful} file${successful > 1 ? 's' : ''}, ${failed} failed`);
        } else if (failed > 0) {
          toast.error(`❌ Failed to process ${failed} file${failed > 1 ? 's' : ''}`);
        }
      }

    } catch (error: any) {
      console.error('Error in handleSubmit:', error);

      let errorMessage = 'Failed to send message';

      if (error.message?.includes('content size exceeds')) {
        errorMessage = 'Message too large. Please reduce file sizes or message length.';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Service is busy. Please try again in a moment.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      toast.error(errorMessage);

    } finally {
      setIsSubmittingUserMessage(false);
      setIsAILoading(false);
      setFileProcessingProgress({
        processing: false,
        completed: 0,
        total: 0,
        phase: 'complete'
      });
    }
  }, [
    isAILoading,
    isSubmittingUserMessage,
    activeChatSessionId,
    createNewChatSession,
    allChatMessages,
    documents,
    notes,
    buildRichContext,
    userProfile,
    setChatSessions,
    setIsAILoading,
  ]);

  // // Message handling
  // const handleNewMessage = useCallback((message: Message) => {
  //   // Handled by useAppData's listener
  // }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      if (!user || !activeChatSessionId) {
        toast.error('Authentication required or no active chat session.');
        return;
      }

      setChatMessages(prevMessages => (prevMessages || []).filter(msg => msg.id !== messageId));
      toast.info('Deleting message...');

      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('session_id', activeChatSessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting message from DB:', error);
        toast.error('Failed to delete message from database.');
        loadSessionMessages(activeChatSessionId);
      } else {
        toast.success('Message deleted successfully.');
      }
    } catch (error: any) {
      console.error('Error in handleDeleteMessage:', error);
      toast.error(`Error deleting message: ${error.message || 'Unknown error'}`);
      if (activeChatSessionId) {
        loadSessionMessages(activeChatSessionId);
      }
    }
  }, [user, activeChatSessionId, setChatMessages, loadSessionMessages]);

  const handleRegenerateResponse = useCallback(async (lastUserMessageContent: string) => {
    if (!user || !activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    const lastAssistantMessage = filteredChatMessages.slice().reverse().find(msg => msg.role === 'assistant');
    const lastUserMessage = filteredChatMessages.slice().reverse().find(msg => msg.role === 'user');

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
        msg.id === lastAssistantMessage.id ? { ...msg, isUpdating: true, isError: false } : msg
      )
    );

    toast.info('Regenerating response...');

    try {
      await handleSubmit(
        lastUserMessageContent,
        lastUserMessage.attachedDocumentIds,
        lastUserMessage.attachedNoteIds,
        lastUserMessage.imageUrl,
        lastUserMessage.imageMimeType,
        undefined, // imageDataBase64 is not passed for regeneration
        lastAssistantMessage.id
      );
    } catch (error) {
      console.error('Error regenerating response:', error);
      toast.error('Failed to regenerate response');

      setChatMessages(prevAllMessages =>
        (prevAllMessages || []).map(msg =>
          msg.id === lastAssistantMessage.id ? { ...msg, isUpdating: false, isError: true } : msg
        )
      );
    }
  }, [user, activeChatSessionId, filteredChatMessages, setChatMessages, handleSubmit]);

  const handleRetryFailedMessage = useCallback(async (originalUserMessageContent: string, failedAiMessageId: string) => {
    if (!user || !activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    const lastUserMessage = filteredChatMessages.slice().reverse().find(msg =>
      msg.role === 'user' && msg.content === originalUserMessageContent
    );

    if (!lastUserMessage) {
      toast.error('Could not find original user message to retry.');
      return;
    }

    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === failedAiMessageId ? { ...msg, isUpdating: true, isError: false } : msg
      )
    );

    toast.info('Retrying message...');

    try {
      await handleSubmit(
        originalUserMessageContent,
        lastUserMessage.attachedDocumentIds,
        lastUserMessage.attachedNoteIds,
        lastUserMessage.imageUrl,
        lastUserMessage.imageMimeType,
        undefined, // imageDataBase64 is not passed for retry
        failedAiMessageId
      );
    } catch (error) {
      console.error('Error retrying message:', error);
      toast.error('Failed to retry message');

      setChatMessages(prevAllMessages =>
        (prevAllMessages || []).map(msg =>
          msg.id === failedAiMessageId ? { ...msg, isUpdating: false, isError: true } : msg
        )
      );
    }
  }, [user, activeChatSessionId, filteredChatMessages, setChatMessages, handleSubmit]);

  const {
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
    handleDocumentUploaded,
    updateDocument,
    handleDocumentDeleted,
    handleProfileUpdate,
  } = useAppOperations({
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
    setUserProfile,
    setActiveNote,
    setActiveTab,
    setIsAILoading,
  });

  // FIXED: Add missing dashboard navigation handlers
  const handleNavigateToTab = useCallback((tab: string) => {
    navigate(`/${tab}`);
    setIsSidebarOpen(false);
  }, [navigate, setIsSidebarOpen]);

  const handleCreateNew = useCallback((type: 'note' | 'recording' | 'schedule' | 'document') => {
    switch (type) {
      case 'note':
        createNewNote();
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
  }, [createNewNote, handleNavigateToTab]);

  const memoizedOnToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), [setIsSidebarOpen]);
  const memoizedOnCategoryChange = useCallback((category: string) => setSelectedCategory(category), [setSelectedCategory]);

  const memoizedOnTabChange = useCallback((tab: string) => {
    navigate(`/${tab}`);
    setIsSidebarOpen(false);
  }, [navigate, setIsSidebarOpen]);

  const headerProps = useMemo(() => ({
    searchQuery,
    onSearchChange: setSearchQuery,
    onNewNote: createNewNote,
    isSidebarOpen,
    onToggleSidebar: memoizedOnToggleSidebar,
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings',
    fullName: userProfile?.full_name || '',
    avatarUrl: userProfile?.avatar_url || '',
  }), [searchQuery, setSearchQuery, createNewNote, isSidebarOpen, memoizedOnToggleSidebar, currentActiveTab, userProfile]);

  const sidebarProps = useMemo(() => ({
    isOpen: isSidebarOpen,
    onToggle: memoizedOnToggleSidebar,
    selectedCategory: selectedCategory,
    onCategoryChange: memoizedOnCategoryChange,
    noteCount: notes.length,
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings',
    onTabChange: memoizedOnTabChange,
    chatSessions,
    activeChatSessionId,
    onChatSessionSelect: setActiveChatSessionId,
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    hasMoreChatSessions,
    onLoadMoreChatSessions: handleLoadMoreChatSessions,
    currentTheme,
    onThemeChange: handleThemeChange,
  }), [
    isSidebarOpen,
    memoizedOnToggleSidebar,
    selectedCategory,
    memoizedOnCategoryChange,
    notes.length,
    currentActiveTab,
    memoizedOnTabChange,
    chatSessions,
    activeChatSessionId,
    setActiveChatSessionId,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    hasMoreChatSessions,
    handleLoadMoreChatSessions,
    currentTheme,
    handleThemeChange,
  ]);

  const tabContentProps = useMemo(() => ({
    activeTab: currentActiveTab,
    filteredNotes,
    activeNote,
    recordings: recordings ?? [],
    scheduleItems,
    chatMessages: filteredChatMessages,
    documents,
    userProfile,
    isAILoading,
    setIsAILoading,
    onNoteSelect: setActiveNote,
    onNoteUpdate: updateNote,
    onNoteDelete: deleteNote,
    onAddRecording: addRecording,
    onUpdateRecording: updateRecording,
    onGenerateQuiz: generateQuiz,
    onAddScheduleItem: addScheduleItem,
    onUpdateScheduleItem: updateScheduleItem,
    onDeleteScheduleItem: deleteScheduleItem,
    onSendMessage: handleSubmit,
    onDocumentUploaded: handleDocumentUploaded,
    onDocumentUpdated: updateDocument,
    onDocumentDeleted: handleDocumentDeleted,
    onProfileUpdate: handleProfileUpdate,
    chatSessions,
    activeChatSessionId,
    onChatSessionSelect: setActiveChatSessionId,
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    onSelectedDocumentIdsChange: setSelectedDocumentIds,
    selectedDocumentIds,
    // onNewMessage: handleNewMessage,
    isNotesHistoryOpen,
    onToggleNotesHistory: () => setIsNotesHistoryOpen(prev => !prev),
    onDeleteMessage: handleDeleteMessage,
    onRegenerateResponse: handleRegenerateResponse,
    isSubmittingUserMessage,
    onRetryFailedMessage: handleRetryFailedMessage,
    hasMoreMessages,
    onLoadOlderMessages: handleLoadOlderChatMessages,
    isLoadingSessionMessages,
    quizzes,
    onReprocessAudio: triggerAudioProcessing,
    onDeleteRecording: deleteRecording,
    onGenerateNote: handleGenerateNoteFromAudio,
    // Dashboard specific props
    onNavigateToTab: handleNavigateToTab,
    onCreateNew: handleCreateNew,
    // Infinite scroll controls
    hasMoreDocuments: dataPagination.documents.hasMore,
    isLoadingDocuments: specificDataLoading.documents,
    onLoadMoreDocuments: loadMoreDocuments,
    hasMoreRecordings: dataPagination.recordings.hasMore,
    isLoadingRecordings: specificDataLoading.recordings,
    onLoadMoreRecordings: loadMoreRecordings,
  }), [
    currentActiveTab,
    filteredNotes,
    activeNote,
    recordings,
    scheduleItems,
    filteredChatMessages,
    documents,
    userProfile,
    isAILoading,
    setIsAILoading,
    setActiveNote,
    updateNote,
    deleteNote,
    addRecording,
    updateRecording,
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    handleSubmit,
    handleDocumentUploaded,
    updateDocument,
    handleDocumentDeleted,
    handleProfileUpdate,
    chatSessions,
    activeChatSessionId,
    setActiveChatSessionId,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    setSelectedDocumentIds,
    selectedDocumentIds,
    // handleNewMessage,
    isNotesHistoryOpen,
    handleDeleteMessage,
    handleRegenerateResponse,
    isSubmittingUserMessage,
    handleRetryFailedMessage,
    hasMoreMessages,
    handleLoadOlderChatMessages,
    isLoadingSessionMessages,
    quizzes,
    triggerAudioProcessing,
    deleteRecording,
    handleGenerateNoteFromAudio,
    handleNavigateToTab,
    handleCreateNew,
  ]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Error signing out');
    }
  }, [signOut, navigate]);

  // Enhanced loading with progressive phases
  if (authLoading || dataLoading || loadingPhase.phase !== 'complete') {
    return (
      <LoadingScreen
        progress={loadingProgress}
        message={loadingMessage}
        phase={loadingPhase.phase}
      />
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
      transition-transform duration-300 ease-in-out`}
      >
        <Sidebar {...sidebarProps} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-gray-900">
        <div className="flex items-center justify-between p-0 sm:p-0 border-b-0 shadow-none bg-transparent border-b-0 border-l-0 border-r-0 border-gray-200 dark:border-gray-700">
          <Header {...headerProps} />
          <div className="hidden p-3 sm:flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="sm:hidden dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {fileProcessingProgress.processing && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-700 dark:text-blue-300">
                {fileProcessingProgress.phase === 'validating' && 'Validating files...'}
                {fileProcessingProgress.phase === 'processing' && 'Processing files...'}
                {fileProcessingProgress.phase === 'uploading' && 'Uploading files...'}
                {fileProcessingProgress.phase === 'complete' && 'Processing complete!'}
                {fileProcessingProgress.phase !== 'complete' &&
                  ` (${fileProcessingProgress.completed}/${fileProcessingProgress.total})`
                }
              </span>
              <div className="w-32 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(fileProcessingProgress.completed / fileProcessingProgress.total) * 100}%`
                  }}
                />
              </div>
            </div>
            {fileProcessingProgress.currentFile && fileProcessingProgress.phase !== 'complete' && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Processing: {fileProcessingProgress.currentFile}
              </p>
            )}
          </div>
        )}

        <Routes>
          <Route path="/dashboard" element={<TabContent {...tabContentProps} activeTab="dashboard" />} />
          <Route path="/notes" element={<TabContent {...tabContentProps} activeTab="notes" />} />
          <Route path="/recordings" element={<TabContent {...tabContentProps} activeTab="recordings" />} />
          <Route path="/schedule" element={<TabContent {...tabContentProps} activeTab="schedule" />} />
          <Route path="/chat" element={<TabContent {...tabContentProps} activeTab="chat" />} />
          <Route path="/documents" element={<TabContent {...tabContentProps} activeTab="documents" />} />
          <Route path="/settings" element={<TabContent {...tabContentProps} activeTab="settings" />} />
          <Route path="/" element={<TabContent {...tabContentProps} activeTab="dashboard" />} />
          <Route path="*" element={<TabContent {...tabContentProps} activeTab="dashboard" />} />
        </Routes>
      </div>
    </div>
  );
};

export default Index;
