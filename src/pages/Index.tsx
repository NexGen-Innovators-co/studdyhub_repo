// Index.tsx - Optimized for reliable file processing and error handling
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
// In Index.tsx, near the top
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
// Optimized constants for better performance and reliability
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max per file
const MAX_FILES_PER_MESSAGE = 10; // Reasonable limit for concurrent processing
const MAX_TOTAL_CONTEXT_SIZE = 2 * 1024 * 1024; // 2MB total context
const MAX_SINGLE_FILE_CONTEXT = 500 * 1024; // 500KB per file in context
const MAX_HISTORY_MESSAGES = 30; // Reduced for better performance
const CHAT_SESSIONS_PER_PAGE = 15;
const CHAT_MESSAGES_PER_PAGE = 25;

// File type validation and processing configuration
const SUPPORTED_FILE_TYPES = {
  // Images
  'image/jpeg': { type: 'image', maxSize: 20 * 1024 * 1024, priority: 'high' },
  'image/png': { type: 'image', maxSize: 20 * 1024 * 1024, priority: 'high' },
  'image/gif': { type: 'image', maxSize: 10 * 1024 * 1024, priority: 'medium' },
  'image/webp': { type: 'image', maxSize: 15 * 1024 * 1024, priority: 'high' },
  'image/svg+xml': { type: 'image', maxSize: 5 * 1024 * 1024, priority: 'medium' },

  // Documents
  'application/pdf': { type: 'document', maxSize: 50 * 1024 * 1024, priority: 'high' },
  'application/msword': { type: 'document', maxSize: 25 * 1024 * 1024, priority: 'medium' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'document', maxSize: 25 * 1024 * 1024, priority: 'high' },
  'application/vnd.ms-excel': { type: 'spreadsheet', maxSize: 20 * 1024 * 1024, priority: 'medium' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { type: 'spreadsheet', maxSize: 20 * 1024 * 1024, priority: 'high' },

  // Text files (fast processing)
  'text/plain': { type: 'text', maxSize: 10 * 1024 * 1024, priority: 'high', fastProcess: true },
  'text/csv': { type: 'csv', maxSize: 15 * 1024 * 1024, priority: 'high', fastProcess: true },
  'text/markdown': { type: 'text', maxSize: 5 * 1024 * 1024, priority: 'high', fastProcess: true },
  'application/json': { type: 'json', maxSize: 5 * 1024 * 1024, priority: 'medium', fastProcess: true },

  // Code files
  'text/javascript': { type: 'code', maxSize: 2 * 1024 * 1024, priority: 'medium', fastProcess: true },
  'text/typescript': { type: 'code', maxSize: 2 * 1024 * 1024, priority: 'medium', fastProcess: true },
  'text/css': { type: 'code', maxSize: 2 * 1024 * 1024, priority: 'low', fastProcess: true },
  'text/html': { type: 'code', maxSize: 5 * 1024 * 1024, priority: 'medium', fastProcess: true }
};

/**
 * Optimized file validation with detailed error reporting
 */
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

  // Add warnings for large files
  if (file.size > config.maxSize * 0.7) {
    warnings.push('Large file may take longer to process');
  }

  // Add warnings for complex file types
  if (['spreadsheet', 'document'].includes(config.type) && file.size > 10 * 1024 * 1024) {
    warnings.push('Complex document structure may require additional processing time');
  }

  return { valid: true, warnings, config };
};

/**
 * Optimized file processing with progress tracking
 */
const processFileForUpload = async (file: File): Promise<{
  name: string;
  mimeType: string;
  data: string;
  type: string;
  size: number;
  content: string | null;
  processing_status: string;
  processing_error: string | null;
}> => {
  const validation = validateFileForProcessing(file);

  if (!validation.valid) {
    return {
      name: file.name,
      mimeType: file.type,
      data: '',
      type: 'unknown',
      size: file.size,
      content: null,
      processing_status: 'failed',
      processing_error: validation.error!
    };
  }

  try {
    // For text files, process directly for better performance
    if (validation.config?.fastProcess) {
      const textContent = await file.text();
      return {
        name: file.name,
        mimeType: file.type,
        data: btoa(textContent),
        type: validation.config.type,
        size: file.size,
        content: textContent.length > MAX_SINGLE_FILE_CONTEXT
          ? textContent.substring(0, MAX_SINGLE_FILE_CONTEXT - 100) + '\n[Content truncated for processing efficiency]'
          : textContent,
        processing_status: 'completed',
        processing_error: null
      };
    }

    // For binary files, convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    return {
      name: file.name,
      mimeType: file.type,
      data: base64Data,
      type: validation.config.type,
      size: file.size,
      content: null, // Will be processed by edge function
      processing_status: 'pending',
      processing_error: null
    };
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    return {
      name: file.name,
      mimeType: file.type,
      data: '',
      type: validation.config?.type || 'unknown',
      size: file.size,
      content: null,
      processing_status: 'failed',
      processing_error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Smart content size estimation and management
 */
const estimateContextSize = (content: any[]): number => {
  return JSON.stringify(content).length;
};

// Update the optimizeContextForProcessing function signature
const optimizeContextForProcessing = (
  chatHistory: Array<{ role: string; parts: MessagePart[] }>,
  currentContext: string,
  files: any[]
): Array<{ role: string; parts: MessagePart[] }> => {
  let totalSize = 0;
  const optimizedHistory: Array<{ role: string; parts: MessagePart[] }> = [];

  // Add current context and files first (highest priority)
  const currentContent: Array<{ role: string; parts: MessagePart[] }> = [
    { role: 'user', parts: [{ text: currentContext }] }
  ];

  // Add file content
  files.forEach(file => {
    if (file.content) {
      currentContent[0].parts.push({ text: `[File: ${file.name}]\n${file.content}` });
    } else if (file.data && file.type === 'image') {
      currentContent[0].parts.push({
        inlineData: { mimeType: file.mimeType, data: file.data }
      });
    }
  });

  totalSize = estimateContextSize(currentContent);

  // Add history messages from most recent, staying within limits
  for (let i = chatHistory.length - 1; i >= 0 && totalSize < MAX_TOTAL_CONTEXT_SIZE; i--) {
    const messageSize = estimateContextSize([chatHistory[i]]);

    if (totalSize + messageSize <= MAX_TOTAL_CONTEXT_SIZE) {
      optimizedHistory.unshift(chatHistory[i]);
      totalSize += messageSize;
    } else {
      break;
    }
  }

  return [...optimizedHistory, ...currentContent];
};

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = new URL(window.location.href);

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

  // Get audio processing handlers from useAudioProcessing hook
  const {
    handleGenerateNoteFromAudio,
    triggerAudioProcessing,
  } = useAudioProcessing({
    onAddRecording: (rec) => setRecordings(prev => [...prev, rec]),
    onUpdateRecording: (rec) => setRecordings(prev => prev.map(r => r.id === rec.id ? rec : r))
  });

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isNotesHistoryOpen, setIsNotesHistoryOpen] = useState(false);
  const [isSubmittingUserMessage, setIsSubmittingUserMessage] = useState(false);
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false);
  const [fileProcessingProgress, setFileProcessingProgress] = useState<{
    processing: boolean;
    completed: number;
    total: number;
    currentFile?: string;
  }>({ processing: false, completed: 0, total: 0 });

  const [chatSessionsLoadedCount, setChatSessionsLoadedCount] = useState(CHAT_SESSIONS_PER_PAGE);
  const [hasMoreChatSessions, setHasMoreChatSessions] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const currentActiveTab = useMemo(() => {
    const path = location.pathname.split('/')[1];
    switch (path) {
      case 'notes': return 'notes';
      case 'recordings': return 'recordings';
      case 'schedule': return 'schedule';
      case 'chat': return 'chat';
      case 'documents': return 'documents';
      case 'settings': return 'settings';
      default: return 'notes';
    }
  }, [location.pathname]);

  useEffect(() => {
    setActiveTab(currentActiveTab);
  }, [currentActiveTab, setActiveTab]);

  // Auto-load data when switching tabs
  useEffect(() => {
    switch (currentActiveTab) {
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
      default:
        loadDataIfNeeded('notes');
        break;
    }
  }, [currentActiveTab, loadDataIfNeeded]);

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
  }, [user, setChatSessions, chatSessionsLoadedCount]);

  const handleLoadMoreChatSessions = useCallback(() => {
    setChatSessionsLoadedCount(prevCount => prevCount + CHAT_SESSIONS_PER_PAGE);
  }, []);

  const filteredChatMessages = useMemo(() => {
    if (!activeChatSessionId) {
      return [];
    }

    const filtered = allChatMessages
      .filter(msg => msg.session_id === activeChatSessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return filtered;
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

  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user, loadChatSessions, chatSessionsLoadedCount]);

  useEffect(() => {
    if (activeChatSessionId) {
      loadSessionMessages(activeChatSessionId);
    } else {
      setHasMoreMessages(false);
    }
  }, [activeChatSessionId, user, loadSessionMessages]);

  useEffect(() => {
    if (activeChatSessionId && chatSessions.length > 0) {
      const currentSession = chatSessions.find(s => s.id === activeChatSessionId);
      if (currentSession) {
        setSelectedDocumentIds(currentSession.document_ids || []);
      }
    } else if (!activeChatSessionId) {
      setSelectedDocumentIds([]);
    }
  }, [activeChatSessionId, chatSessions, setSelectedDocumentIds]);

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

      toast.success('New chat session created with selected documents.');
      return newSession.id;
    } catch (error: any) {
      console.error('Error creating new session:', error);
      toast.error(`Failed to create new chat session: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [user, selectedDocumentIds, setChatSessions, setChatSessionsLoadedCount, loadChatSessions, setActiveChatSessionId, setSelectedDocumentIds]);

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

  const buildRichContext = useCallback((
    documentIdsToInclude: string[],
    noteIdsToInclude: string[],
    allDocuments: AppDocument[],
    allNotes: Note[]
  ) => {
    const selectedDocs = (allDocuments ?? []).filter(doc => (documentIdsToInclude ?? []).includes(doc.id));
    const selectedNotes = (allNotes ?? []).filter(note => (noteIdsToInclude ?? []).includes(note.id));

    let context = '';
    let totalSize = 0;

    // In buildRichContext function
    if (selectedDocs.length > 0) {
      context += 'ATTACHED DOCUMENTS:\n';
      for (const doc of selectedDocs) {
        const docInfo = `Title: ${doc.title}\nFile: ${doc.file_name}\nType: ${doc.type}\n`;

        if (doc.content_extracted) {
          const availableSpace = MAX_SINGLE_FILE_CONTEXT - docInfo.length;
          let content = doc.content_extracted;

          if (content.length > availableSpace) {
            content = content.substring(0, availableSpace - 50) + '\n[Content truncated for processing efficiency]';
          }

          context += docInfo + `Content: ${content}\n\n`;
        } else {
          context += docInfo + `Content: ${doc.processing_status === 'completed' ? 'No extractable content found' : `Processing status: ${doc.processing_status || 'pending'}`}\n\n`;
        }

        totalSize = context.length;
        if (totalSize > MAX_TOTAL_CONTEXT_SIZE / 2) break; // Reserve space for notes and messages
      }
    }

    if (selectedNotes.length > 0 && totalSize < MAX_TOTAL_CONTEXT_SIZE / 2) {
      context += 'ATTACHED NOTES:\n';
      selectedNotes.forEach(note => {
        if (totalSize > MAX_TOTAL_CONTEXT_SIZE / 2) return;

        const noteInfo = `Title: ${note.title}\nCategory: ${note.category}\n`;
        const availableSpace = Math.min(MAX_SINGLE_FILE_CONTEXT, MAX_TOTAL_CONTEXT_SIZE / 2 - totalSize) - noteInfo.length;

        let noteContent = '';
        if (note.content) {
          noteContent = note.content.length > availableSpace ?
            note.content.substring(0, availableSpace - 50) + '\n[Content truncated]' :
            note.content;
        }

        const noteBlock = noteInfo + (noteContent ? `Content: ${noteContent}\n` : '') +
          (note.aiSummary ? `Summary: ${note.aiSummary.substring(0, 200)}...\n` : '') +
          (note.tags?.length ? `Tags: ${note.tags.join(', ')}\n` : '') + '\n';

        context += noteBlock;
        totalSize += noteBlock.length;
      });
    }

    return context;
  }, []);

  // Optimized handleSubmit with better file processing and error handling
  const handleSubmit = useCallback(async (
    messageContent: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    imageUrl?: string,
    imageMimeType?: string,
    imageDataBase64?: string,
    aiMessageIdToUpdate: string | null = null,
    attachedFiles?: FileData[] // Changed from File[]
  ) => {
    // Enhanced validation
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
  
    // Remove file validation since files are already validated in AIChat.tsx
    /*
    if (attachedFiles && attachedFiles.length > 0) {
      if (attachedFiles.length > MAX_FILES_PER_MESSAGE) {
        toast.error(`Too many files. Maximum ${MAX_FILES_PER_MESSAGE} files per message.`);
        return;
      }
  
      for (const file of attachedFiles) {
        const validation = validateFileForProcessing(file);
        if (!validation.valid) {
          toast.error(validation.error);
          return;
        }
      }
    }
    */
  
    setIsSubmittingUserMessage(true);
    setIsAILoading(true);
    let processedFiles: FileData[] = attachedFiles || []; // Use attachedFiles directly
  
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
        toast.info('New chat session created.');
      }
  
      let finalAttachedDocumentIds = attachedDocumentIds || [];
      const finalAttachedNoteIds = attachedNoteIds || [];
  
      // Remove file processing logic since it's handled in AIChat.tsx
      /*
      if (attachedFiles && attachedFiles.length > 0) {
        setFileProcessingProgress({
          processing: true,
          completed: 0,
          total: attachedFiles.length
        });
  
        toast.info(`Processing ${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''}...`);
  
        for (let i = 0; i < attachedFiles.length; i++) {
          const file = attachedFiles[i];
          setFileProcessingProgress(prev => ({
            ...prev,
            currentFile: file.name
          }));
  
          try {
            const processedFile = await processFileForUpload(file);
            processedFiles.push(processedFile);
            
            setFileProcessingProgress(prev => ({
              ...prev,
              completed: prev.completed + 1
            }));
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            toast.error(`Failed to process file: ${file.name}`);
          }
        }
  
        setFileProcessingProgress({ processing: false, completed: 0, total: 0 });
      }
      */
  
      // Build context with size optimization
      const historicalMessagesForAI = allChatMessages
        .filter(msg => msg.session_id === currentSessionId)
        .filter(msg => !(aiMessageIdToUpdate && msg.id === aiMessageIdToUpdate))
        .slice(-MAX_HISTORY_MESSAGES);
  
      const chatHistoryForAI: Array<{ role: string; parts: MessagePart[] }> = [];
  
      historicalMessagesForAI.forEach(msg => {
        if (msg.role === 'user') {
          const userParts: MessagePart[] = [{ text: msg.content }];
          
          if (msg.attachedDocumentIds && msg.attachedDocumentIds.length > 0 || msg.attachedNoteIds && msg.attachedNoteIds.length > 0) {
            const historicalContext = buildRichContext(
              msg.attachedDocumentIds || [], 
              msg.attachedNoteIds || [], 
              documents, 
              notes
            );
            if (historicalContext && historicalContext.length < 50000) {
              userParts.push({ text: `\n\nPrevious Context:\n${historicalContext}` });
            }
          }
          
          chatHistoryForAI.push({ role: 'user', parts: userParts });
        } else if (msg.role === 'assistant') {
          const content = msg.content.length > 10000 ? 
            msg.content.substring(0, 10000) + '\n[Previous response truncated for context efficiency]' : 
            msg.content;
          chatHistoryForAI.push({ role: 'model', parts: [{ text: content }] });
        }
      });
  
      let finalUserMessageContent = messageContent || "";
      
      const currentAttachedContext = buildRichContext(finalAttachedDocumentIds, finalAttachedNoteIds, documents, notes);
      if (currentAttachedContext) {
        finalUserMessageContent += `\n\nAttached Context:\n${currentAttachedContext}`;
      }
  
      if (processedFiles.length > 0) {
        const fileDescriptions = processedFiles.map(f => 
          `${f.name} (${f.type}, ${f.processing_status})`
        ).join(', ');
        
        if (!finalUserMessageContent.trim()) {
          finalUserMessageContent = `I'm sharing ${processedFiles.length} file${processedFiles.length > 1 ? 's' : ''} with you: ${fileDescriptions}`;
        } else {
          finalUserMessageContent += `\n\nAttached Files: ${fileDescriptions}`;
        }
      }
  
      const optimizedContent = optimizeContextForProcessing(
        chatHistoryForAI,
        finalUserMessageContent,
        processedFiles
      );
  
      console.log(`Sending optimized content: ${JSON.stringify(optimizedContent).length} characters`);
  
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
          chatHistory: optimizedContent.slice(0, -1),
          message: finalUserMessageContent,
          files: processedFiles,
          attachedDocumentIds: finalAttachedDocumentIds,
          attachedNoteIds: finalAttachedNoteIds,
          imageUrl: imageUrl,
          imageMimeType: imageMimeType,
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
  
      if (processedFiles.length > 0) {
        const successful = processedFiles.filter(f => f.processing_status === 'completed').length;
        const failed = processedFiles.filter(f => f.processing_status === 'failed').length;
        
        if (successful > 0 && failed === 0) {
          toast.success(`Successfully processed ${successful} file${successful > 1 ? 's' : ''}`);
        } else if (successful > 0 && failed > 0) {
          toast.warning(`Processed ${successful} file${successful > 1 ? 's' : ''}, ${failed} failed`);
        } else if (failed > 0) {
          toast.error(`Failed to process ${failed} file${failed > 1 ? 's' : ''}`);
        }
      }
  
      console.log('Message sent successfully:', {
        response: data.response.substring(0, 100) + '...',
        filesProcessed: data.filesProcessed || 0,
        processingResults: data.processingResults || []
      });
  
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
      
      if (processedFiles.length > 0) {
        console.log('Cleaning up processed files due to error...');
        // Additional cleanup logic could go here
      }
    } finally {
      setIsSubmittingUserMessage(false);
      setIsAILoading(false);
      setFileProcessingProgress({ processing: false, completed: 0, total: 0 });
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

  const handleNewMessage = useCallback((message: Message) => {
    // This function is handled by useAppData's listener
  }, []);

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
        // Revert optimistic update
        loadSessionMessages(activeChatSessionId);
      } else {
        toast.success('Message deleted successfully.');
      }
    } catch (error: any) {
      console.error('Error in handleDeleteMessage:', error);
      toast.error(`Error deleting message: ${error.message || 'Unknown error'}`);
      // Revert optimistic update
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

    // Mark message as updating
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
        undefined,
        lastAssistantMessage.id
      );
    } catch (error) {
      console.error('Error regenerating response:', error);
      toast.error('Failed to regenerate response');

      // Revert updating state
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

    // Mark message as retrying
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
        undefined,
        failedAiMessageId
      );
    } catch (error) {
      console.error('Error retrying message:', error);
      toast.error('Failed to retry message');

      // Revert updating state
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
    chatSessions: chatSessions,
    activeChatSessionId: activeChatSessionId,
    onChatSessionSelect: setActiveChatSessionId,
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    hasMoreChatSessions: hasMoreChatSessions,
    onLoadMoreChatSessions: handleLoadMoreChatSessions,
    currentTheme: currentTheme,
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
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings',
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
    selectedDocumentIds: selectedDocumentIds,
    onNewMessage: handleNewMessage,
    isNotesHistoryOpen: isNotesHistoryOpen,
    onToggleNotesHistory: () => setIsNotesHistoryOpen(prev => !prev),
    onDeleteMessage: handleDeleteMessage,
    onRegenerateResponse: handleRegenerateResponse,
    isSubmittingUserMessage: isSubmittingUserMessage,
    onRetryFailedMessage: handleRetryFailedMessage,
    hasMoreMessages: hasMoreMessages,
    onLoadOlderMessages: handleLoadOlderChatMessages,
    isLoadingSessionMessages: isLoadingSessionMessages,
    quizzes: quizzes,
    onReprocessAudio: triggerAudioProcessing,
    onDeleteRecording: deleteRecording,
    onGenerateNote: handleGenerateNoteFromAudio,
    // Enhanced props for file processing
    fileProcessingProgress: fileProcessingProgress,
    supportedFileTypes: Object.keys(SUPPORTED_FILE_TYPES),
    validateFileForProcessing: validateFileForProcessing,
    // Pagination props
    dataLoading: specificDataLoading,
    dataPagination: dataPagination,
    onLoadMoreNotes: loadMoreNotes,
    onLoadMoreRecordings: loadMoreRecordings,
    onLoadMoreDocuments: loadMoreDocuments,
    onLoadMoreSchedule: loadMoreSchedule,
    onLoadMoreQuizzes: loadMoreQuizzes,
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
    handleNewMessage,
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
    fileProcessingProgress,
    specificDataLoading,
    dataPagination,
    loadMoreNotes,
    loadMoreRecordings,
    loadMoreDocuments,
    loadMoreSchedule,
    loadMoreQuizzes,
  ]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Error signing out');
    }
  }, [signOut, navigate]);

  // Enhanced loading state with file processing progress
  if (loading || dataLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <img src='/siteimage.png' className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-slate-600 dark:text-gray-300">Loading your data...</p>
          {fileProcessingProgress.processing && (
            <div className="mt-4">
              <p className="text-sm text-slate-500 dark:text-gray-400">
                Processing files: {fileProcessingProgress.completed}/{fileProcessingProgress.total}
              </p>
              {fileProcessingProgress.currentFile && (
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                  Current: {fileProcessingProgress.currentFile}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
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

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0 bg-slate-50 dark:bg-gray-900">
        <div className="flex items-center justify-between p-3 sm:p-2 border-b-0 shadow-none bg-transparent border-b-0 border-l-0 border-r-0 border-gray-200 dark:border-gray-700">
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

        {/* File processing progress indicator */}
        {fileProcessingProgress.processing && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-700 dark:text-blue-300">
                Processing files: {fileProcessingProgress.completed}/{fileProcessingProgress.total}
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
            {fileProcessingProgress.currentFile && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Processing: {fileProcessingProgress.currentFile}
              </p>
            )}
          </div>
        )}

        <Routes>
          <Route path="/notes" element={<TabContent {...tabContentProps} activeTab="notes" />} />
          <Route path="/recordings" element={<TabContent {...tabContentProps} activeTab="recordings" />} />
          <Route path="/schedule" element={<TabContent {...tabContentProps} activeTab="schedule" />} />
          <Route path="/chat" element={<TabContent {...tabContentProps} activeTab="chat" />} />
          <Route path="/documents" element={<TabContent {...tabContentProps} activeTab="documents" />} />
          <Route path="/settings" element={<TabContent {...tabContentProps} activeTab="settings" />} />
          <Route path="/" element={<TabContent {...tabContentProps} activeTab="notes" />} />
          <Route path="*" element={<TabContent {...tabContentProps} activeTab="notes" />} />
        </Routes>
      </div>
    </div>
  );
};

export default Index;