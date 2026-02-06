import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { Send, Loader2, FileText, BookOpen, StickyNote, Camera, Paperclip, Mic, ChevronDown, Podcast, MenuIcon, Layout, ArrowUp, ArrowDown, Image, Square, Pause, Play, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem
} from '../ui/menubar';
import { UserProfile, Document } from '../../types/Document';
import { Note } from '../../types/Note';
import { supabase } from '../../integrations/supabase/client';
import { DocumentSelector } from './Components/DocumentSelector';
import { toast } from 'sonner';
import { DiagramPanel } from './Components/DiagramPanel';
import { generateId } from '@/components/classRecordings/utils/helpers';
import { MessageList } from './Components/MessageList';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { Message } from '../../types/Class';
import BookPagesAnimation from '../ui/bookloader';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import { getFileType, validateFile, stripCodeBlocks, generateOptimisticId, overrideTsMimeType } from './utils/helpers';
import { ContextBadges } from './Components/ContextBadges';
import { DragOverlay } from './Components/DragOverlay';
import { AppContext } from '@/contexts/AppContext';
import { initialAppState } from '@/contexts/appReducer';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { useAiMessageTracker } from '@/hooks/useAiMessageTracker';
import { PodcastGenerator, type PodcastData } from '../podcasts/PodcastGenerator';
import { PodcastPanel } from '../podcasts/PodcastPanel';
import { ImageGenerator } from './Components/ImageGenerator';
import { useImageGenerationDetector } from '@/hooks/useImageGenerationDetector';

export interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'other';
  id: string;
}

interface AIChatProps {
  messages: Message[];
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  userProfile: UserProfile | null;
  documents: Document[];
  notes: Note[];
  selectedDocumentIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeChatSessionId: string | null;
  onNewChatSession: () => Promise<string | null>;
  onDeleteChatSession: (sessionId: string) => void;
  onRenameChatSession: (sessionId: string, newTitle: string) => void;
  onChatSessionSelect: (sessionId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerateResponse: (lastUserMessageContent: string) => Promise<void>;
  onRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>;
  isSubmittingUserMessage: boolean;
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
  onDocumentUpdated: (updatedDocument: Document) => void;
  isLoadingSessionMessages: boolean;
  learningStyle: string;
  learningPreferences: any;
  onSendMessageToBackend: (
    messageContent: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    processedFiles?: Array<{
      name: string;
      mimeType: string;
      data: string | null;
      type: 'image' | 'document' | 'other';
      size: number;
      content: string | null;
      processing_status: string;
      processing_error: string | null;
    }>
  ) => Promise<void>;
  onMessageUpdate: (message: Message) => void;
  onReplaceOptimisticMessage: (optimisticId: string, newMessage: Message) => void;
  onLoadMoreDocuments: () => void;
  hasMoreDocuments: boolean;
  isLoadingDocuments: boolean;
  onInterruptMessage?: () => void;
  onPauseGeneration?: () => void;
  onResumeGeneration?: (lastUserMessageContent: string, lastAssistantMessageId: string) => Promise<void>;
  onEditAndResendMessage?: (
    editedUserMessageContent: string,
    originalUserMessageId: string,
    originalAssistantMessageId: string | null,
    attachedDocumentIds: string[],
    attachedNoteIds: string[],
    imageUrl: string | null,
    imageMimeType: string | null
  ) => Promise<void>;
  streamingState?: any;
  onSuggestAiCorrection?: (prompt: string) => Promise<void>;
}

// ── Extracted outside AIChat to keep stable references across re-renders ──
const MessageSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-3">
        <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const ChatLoadingIndicator: React.FC<{ isLoadingSession: boolean; messageCount: number }> = ({ isLoadingSession, messageCount }) => {
  if (!isLoadingSession) return null;

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <BookPagesAnimation className="h-16 w-16 text-pink-500" showText={false} />
      <div className="space-y-2 text-center">
        <p className="text-base text-gray-600 dark:text-gray-300 animate-pulse">
          Loading conversation...
        </p>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

const AIChat: React.FC<AIChatProps> = ({
  messages,
  isLoading,
  setIsLoading,
  userProfile,
  documents,
  notes,
  selectedDocumentIds,
  onSelectionChange,
  activeChatSessionId,
  onNewChatSession,
  onDeleteMessage,
  onRegenerateResponse,
  onRetryFailedMessage,
  isSubmittingUserMessage,
  hasMoreMessages,
  onLoadOlderMessages,
  onDocumentUpdated,
  isLoadingSessionMessages,
  learningStyle,
  learningPreferences,
  onSendMessageToBackend,
  onMessageUpdate,
  onReplaceOptimisticMessage,
  onLoadMoreDocuments,
  hasMoreDocuments,
  isLoadingDocuments,
  onInterruptMessage,
  onPauseGeneration,
  onResumeGeneration,
  onEditAndResendMessage,
  streamingState,
  onSuggestAiCorrection,
}) => {
  // ── Perf: keep input text in a ref (uncontrolled textarea) to avoid
  //    re-rendering the entire 1400+ line component on every keystroke.
  //    Only `hasInput` (boolean) is state – it toggles the send/mic icon.
  const inputMessageRef = useRef('');
  const [hasInput, setHasInput] = useState(false);

  /** Programmatically update the textarea value (for edit, speech-rec, clear, etc.) */
  const setInputValue = useCallback((value: string) => {
    inputMessageRef.current = value;
    setHasInput(value.trim().length > 0);
    if (textareaRef.current) {
      textareaRef.current.value = value;
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  const [showPodcastGenerator, setShowPodcastGenerator] = useState(false);
  const [activePodcast, setActivePodcast] = useState<PodcastData | null>(null);
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [showImageGenerator, setShowImageGenerator] = useState(false);
  const [detectedImagePrompt, setDetectedImagePrompt] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  // NEW: Enable streaming by default, persist to localStorage
  const [enableStreamingMode, setEnableStreamingMode] = useState(() => {
    const stored = localStorage.getItem('ai-streaming-mode');
    return stored !== null ? stored === 'true' : true;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedMessages, setExpandedMessages] = useState<string[]>([]);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  // NEW: State for editing message
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    originalAssistantId: string | null;
    attachedDocumentIds: string[];
    attachedNoteIds: string[];
    imageUrl: string | null;
    imageMimeType: string | null;
  } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activeDiagram, setActiveDiagram] = useState<{ content?: string; type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text' | 'html' | 'slides'; language?: string; imageUrl?: string } | null>(null);
  const isDiagramPanelOpen = !!activeDiagram;
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');

  // NEW: State for documents fetched specifically for this session/messages
  const [extraDocuments, setExtraDocuments] = useState<Document[]>([]);
  const [missingDocsCheckAttempted, setMissingDocsCheckAttempted] = useState<Set<string>>(new Set());

  // Use useMemo for merged documents instead of state
  const mergedDocuments = useMemo(() => {
    // Combine main documents and extra fetched documents
    const allDocs = [...documents, ...extraDocuments];
    // Deduplicate by ID
    const uniqueDocsMap = new Map();
    allDocs.forEach(doc => uniqueDocsMap.set(doc.id, doc));
    const uniqueDocs = Array.from(uniqueDocsMap.values());

    return [
      ...uniqueDocs,
      ...notes.map(note => ({
        id: note.id,
        title: note.title || 'Untitled Note',
        file_name: note.title || 'Untitled Note',
        file_type: 'text/plain',
        file_size: new Blob([note.content]).size,
        file_url: '',
        content_extracted: note.content,
        user_id: note.user_id,
        type: 'text' as const,
        processing_status: 'completed' as const,
        processing_error: null,
        created_at: note.created_at,
        processing_started_at: null,
        processing_completed_at: null,
        processing_metadata: null,
        extraction_model_used: null,
        updated_at: note.created_at,
        folder_ids: [],
        total_processing_time_ms: 0,
        page_count: 0,
        vector_store_id: null,
      }))
    ];
  }, [documents, notes, extraDocuments]);

  // Effect to fetch missing documents referenced in messages
  useEffect(() => {
    if (messages.length === 0) return;

    const idsInMessages = messages.flatMap(m => m.attachedDocumentIds || []);
    // add selected ids too
    const allIdsToCheck = [...idsInMessages, ...selectedDocumentIds];
    const uniqueIds = Array.from(new Set(allIdsToCheck));

    const missingIds = uniqueIds.filter(id => {
      // check if present in mergedDocuments (docs or notes)
      const found = mergedDocuments.some(d => d.id === id);
      // check if we already tried fetching it to avoid loops
      const alreadyChecked = missingDocsCheckAttempted.has(id);
      return !found && !alreadyChecked;
    });

    if (missingIds.length === 0) return;

    // Mark as attempted immediately
    setMissingDocsCheckAttempted(prev => {
      const next = new Set(prev);
      missingIds.forEach(id => next.add(id));
      return next;
    });

    const fetchMissing = async () => {
      try {
        const { data } = await supabase
          .from('documents')
          .select('*')
          .in('id', missingIds);

        const fetchedDocs = (data as Document[]) || [];
        const foundIds = new Set(fetchedDocs.map(d => d.id));

        // Create placeholders for documents that truly don't exist (deleted)
        const notFoundDocs = missingIds
          .filter(id => !foundIds.has(id))
          .map(id => ({
            id,
            title: 'Document Unavailable',
            file_name: 'Unavailable',
            file_type: 'unknown',
            file_size: 0,
            file_url: '',
            content_extracted: null,
            user_id: userProfile?.id || '',
            type: 'text' as const,
            processing_status: 'error' as const, // This will show error icon in UI
            processing_error: 'Document may have been deleted or access denied',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            processing_started_at: null,
            processing_completed_at: null,
            processing_metadata: null,
            extraction_model_used: null,
            folder_ids: [],
            total_processing_time_ms: 0,
            page_count: 0,
            vector_store_id: null,
          } as Document));

        if (fetchedDocs.length > 0 || notFoundDocs.length > 0) {
          setExtraDocuments(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = [...fetchedDocs, ...notFoundDocs].filter(d => !existingIds.has(d.id));
            return [...prev, ...newItems];
          });
        }
      } catch (err) {
        // console.error("Failed to fetch missing documents", err);
      }
    };

    fetchMissing();
  }, [messages, selectedDocumentIds, mergedDocuments, missingDocsCheckAttempted]);


  const [autoTypeInPanel, setAutoTypeInPanel] = useState(false);
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isLastAiMessageDisplayed, setIsLastAiMessageDisplayed] = useState(true);
  const [isCurrentlySending, setIsCurrentlySending] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const storedWidth = localStorage.getItem('diagramPanelWidth');
    return storedWidth ? parseFloat(storedWidth) : 65;
  });
  const [podcastPanelWidth, setPodcastPanelWidth] = useState<number>(() => {
    const storedWidth = localStorage.getItem('podcastPanelWidth');
    return storedWidth ? parseFloat(storedWidth) : 65;
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isUpdatingDocuments, setIsUpdatingDocuments] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const isCurrentlySendingRef = useRef(false);
  const prevSessionIdRef = useRef<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<{
    isLoading: boolean;
    message: string;
    progress: number;
  }>({
    isLoading: false,
    message: '',
    progress: 0
  });

  const loadSessionDocuments = useCallback(async (sessionId: string) => {
    if (!userProfile?.id) return;

    try {
      const { data: sessionData, error } = await supabase
        .from('chat_sessions')
        .select('document_ids')
        .eq('id', sessionId)
        .eq('user_id', userProfile.id)
        .single();

      if (error) {

        return;
      }

      if (sessionData?.document_ids) {
        onSelectionChange(sessionData.document_ids);
      }
    } catch (error) {

    }
  }, [userProfile?.id, onSelectionChange]);

  const processFiles = useCallback((files: File[]) => {
    const validFiles: AttachedFile[] = [];

    files.forEach(file => {
      // Always override .ts file MIME type if needed
      const safeFile = overrideTsMimeType(file);
      const validation = validateFile(safeFile);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }

      const fileId = generateId();
      const fileType = getFileType(safeFile);
      const attachedFile: AttachedFile = {
        file: safeFile,
        type: fileType,
        id: fileId
      };

      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onloadend = () => {
          attachedFile.preview = reader.result as string;
          setAttachedFiles(prev => [...prev, attachedFile]);
        };
        reader.onerror = () => {
          toast.error(`Failed to load image: ${safeFile.name}`);
        };
        reader.readAsDataURL(safeFile);
      } else {
        validFiles.push(attachedFile);
      }
    });

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
  }, []);

  const isDragging = useDragAndDrop(dropZoneRef, processFiles);

  const isPhone = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /mobile|android|iphone|ipad|tablet/i.test(userAgent) && window.innerWidth <= 768;
  }, []);
  const userMessagesToday = useAiMessageTracker().messagesToday;
  const { checkAiMessageLimit } = useAiMessageTracker();
  const { detectImageGenerationRequest } = useImageGenerationDetector();

  // Persist streaming mode preference
  useEffect(() => {
    localStorage.setItem('ai-streaming-mode', String(enableStreamingMode));
  }, [enableStreamingMode]);
  const { isRecognizing, startRecognition, stopRecognition, micPermissionStatus } = useSpeechRecognition({
    setInputMessage: setInputValue,
    resizeTextarea: useCallback(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, []),
    inputMessageRef,
    requestNotificationPermission: useCallback(async (): Promise<boolean> => {
      if (!("Notification" in window)) {
        //console.warn("Notification API not supported in this browser.");
        return false;
      }
      try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      } catch (error) {
        //console.error("Error requesting notification permission:", error);
        return false;
      }
    }, []),
    requestMicrophonePermission: useCallback(async (): Promise<boolean> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error: any) {
        //console.error('Error requesting microphone permission:', error);
        toast.error(`Failed to access microphone: ${error.message || 'Unknown error'}`);
        return false;
      }
    }, []),
    checkMicrophonePermission: useCallback(async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          return permissionStatus.state as 'granted' | 'denied' | 'prompt';
        }
        return 'unknown';
      } catch (error) {
        //console.error('Error checking microphone permission:', error);
        return 'unknown';
      }
    }, []),
  });

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRecognizing) {
      stopRecognition();
    }

    // Read text from the ref (uncontrolled textarea)
    const inputMessage = inputMessageRef.current;

    // Check if this is an image generation request
    const imageDetection = detectImageGenerationRequest(inputMessage);
    if (imageDetection.isImageRequest && imageDetection.extractedPrompt) {
      // Open image generator with the detected prompt
      setDetectedImagePrompt(imageDetection.extractedPrompt);
      setShowImageGenerator(true);
      setInputValue(''); // Clear the input
      return;
    }

    // Check limit BEFORE attempting to send
    if (!checkAiMessageLimit()) {
      return;
    }

    if (isCurrentlySendingRef.current) {
      return;
    }

    isCurrentlySendingRef.current = true;

    if (isCurrentlySending) {
      return;
    }

    const hasPendingOptimistic = messages.some(msg => msg.id.startsWith('optimistic-'));
    if (hasPendingOptimistic) {
      toast.info('Please wait for the previous message to complete');
      return;
    }

    setIsCurrentlySending(true);
    setIsLoading(true);
    setIsAiTyping(true);

    if (!inputMessage.trim() && attachedFiles.length === 0 && selectedDocumentIds.length === 0) {
      toast.error('Please enter a message, attach files, or select documents/notes.');
      setIsLoading(false);
      setIsCurrentlySending(false);
      setIsAiTyping(false);
      return;
    }

    try {
      const userId = userProfile?.id;
      if (!userId) {
        toast.error("User ID is missing. Please ensure you are logged in.");
        setIsLoading(false);
        setIsCurrentlySending(false);
        setIsAiTyping(false);
        return;
      }

      if (activeChatSessionId) {
        const { error } = await supabase
          .from('chat_sessions')
          .update({
            document_ids: selectedDocumentIds,
            updated_at: new Date().toISOString()
          })
          .eq('id', activeChatSessionId)
          .eq('user_id', userId);

        if (error) {

        }
      }

      const documentIds = selectedDocumentIds.filter(id =>
        documents.some(doc => doc.id === id)
      );
      const noteIds = selectedDocumentIds.filter(id =>
        notes.some(note => note.id === id)
      );

      const filesForBackend = await Promise.all(
        attachedFiles.map(async (attachedFile) => {
          // Always override .ts file MIME type if needed before sending
          const safeFile = overrideTsMimeType(attachedFile.file);
          const fileType = getFileType(safeFile);
          let data: string | null = null;
          let content: string | null = null;

          try {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('Failed to read file'));
              reader.readAsDataURL(safeFile);
            });

            const base64Result = await base64Promise;
            data = base64Result.split(',')[1];

            if (fileType === 'document' || safeFile.type.startsWith('text/')) {
              try {
                const textReader = new FileReader();
                const textPromise = new Promise<string>((resolve, reject) => {
                  textReader.onloadend = () => resolve(textReader.result as string);
                  textReader.onerror = () => reject(new Error('Failed to read text content'));
                  textReader.readAsText(safeFile);
                });
                content = await textPromise;
              } catch (textError) {

              }
            }
          } catch (error) {

            toast.error(`Failed to process file: ${safeFile.name}`);
            throw error;
          }

          return {
            name: safeFile.name,
            mimeType: safeFile.type,
            data,
            type: fileType,
            size: safeFile.size,
            content,
            processing_status: 'pending',
            processing_error: null,
          };
        })
      );
      setInputValue('');

      // Note: Message count updates automatically via realtime subscription when AI responds
      await onSendMessageToBackend(
        inputMessage.trim(),
        documentIds,
        noteIds,
        filesForBackend
      );

      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';

      setIsLastAiMessageDisplayed(false);
      setAttachedFiles([]);
      setExpandedMessages([]);

    } catch (error: any) {
      // No need to decrement - we don't increment on send anymore
      // Message count now updates automatically via realtime


      let errorMessage = 'Failed to send message.';

      if (error.message.includes('Too Many Requests')) {
        errorMessage = 'Message or context too large. Some older messages or document content was truncated.';
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to the server. Please check your internet connection.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please try logging in again.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Please check your permissions.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.message.includes('Resource exhausted')) {
        errorMessage = 'Resource exhausted: The service is currently overloaded. Please try again later.';
      }

      toast.error(`Error: ${errorMessage}`);
      setInputValue('');
      setAttachedFiles([]);
      setExpandedMessages([]);
    } finally {
      setIsLoading(false);
      setIsCurrentlySending(false);
      setIsAiTyping(false);
      isCurrentlySendingRef.current = false;
    }
  }, [
    attachedFiles,
    userProfile?.id,
    activeChatSessionId,
    selectedDocumentIds,
    documents,
    notes,
    onSendMessageToBackend,
    isCurrentlySending,
    checkAiMessageLimit,
    messages,
    isRecognizing,
    stopRecognition,
    detectImageGenerationRequest,
    setInputValue,
  ]);
  const handleMarkMessageDisplayed = useCallback(async (messageId: string) => {
    if (!userProfile?.id || !activeChatSessionId) {

      return;
    }

    if (messageId.startsWith('optimistic-')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ has_been_displayed: true })
        .eq('id', messageId)
        .eq('session_id', activeChatSessionId)
        .eq('user_id', userProfile.id);

      if (error) {

        return;
      }

      onMessageUpdate({
        ...messages.find(msg => msg.id === messageId)!,
        has_been_displayed: true
      });

      if (messages.length > 0 &&
        messages[messages.length - 1].id === messageId &&
        messages[messages.length - 1].role === 'assistant') {
        setIsLastAiMessageDisplayed(true);
      }
    } catch (error) {
      //console.error('Unexpected error marking message as displayed:', error);
    }
  }, [userProfile?.id, activeChatSessionId, messages, onMessageUpdate]);

  // Memoized handlers for better performance
  const memoizedHandleBlockDetected = useCallback((blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => {
    if (autoTypeInPanel && isFirstBlock) {
      // useTypingAnimation classifies all fenced code blocks as 'code', but
      // diagram-specific languages need their own type so DiagramPanel renders
      // the correct renderer (ThreeJsRenderer, ChartJsRenderer, DotRenderer, etc.)
      const DIAGRAM_LANGUAGES = ['threejs', 'chartjs', 'dot'] as const;
      const resolvedType = (blockType === 'code' && language && (DIAGRAM_LANGUAGES as readonly string[]).includes(language))
        ? language as typeof activeDiagram extends { type: infer T } ? T : string
        : blockType;

      // useTypingAnimation accumulates raw markdown words including ```fences.
      // Strip them so renderers receive clean inner content.
      const cleanContent = content
        .replace(/^```\w*\n?/, '')   // opening fence
        .replace(/\n?```\s*$/, '');  // closing fence

      // console.log('[AiChat] BlockDetected (auto-type):', { blockType, resolvedType, language, contentSnippet: cleanContent?.slice(0, 150) });
      requestAnimationFrame(() => {
        setActiveDiagram(prev => {
          if (prev && prev.type === resolvedType && prev.content === cleanContent && prev.language === language) {
            return prev;
          }
          return { type: resolvedType as any, content: cleanContent, language };
        });
      });
    }
  }, [autoTypeInPanel]);

  const memoizedHandleViewContent = useCallback((type, content, language, imageUrl) => {
    // console.log('[AiChat] ViewContent (manual click):', { type, language, contentSnippet: content?.slice(0, 150) });
    setActiveDiagram(null);
    requestAnimationFrame(() => {
      setActiveDiagram({ type, content, language, imageUrl });
    });
  }, []);

  // Combined scroll and typing effect for better performance
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const isNewMessage = lastMessage.id !== lastProcessedMessageIdRef.current;

    if (isNewMessage) {
      lastProcessedMessageIdRef.current = lastMessage.id;

      if (lastMessage.role === 'assistant') {
        setIsAiTyping(true);
      }

      // Smooth scroll to bottom
      if (isAutoScrolling) {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
            inline: 'nearest'
          });
        });
      }
    }

    if (lastMessage.role === 'assistant' && !lastMessage.content.includes('█') && !isLoading) {
      setIsAiTyping(false);
    }
  }, [messages, isLoading, isAutoScrolling]);

  // Session change effect - optimized
  useEffect(() => {
    const isSessionChange = prevSessionIdRef.current !== activeChatSessionId;

    if (isSessionChange && activeChatSessionId) {
      // Batch state updates
      setInputValue('');
      setAttachedFiles([]);
      setExpandedMessages([]);
      setIsCurrentlySending(false);
      setIsAiTyping(false);
      setActiveDiagram(null);
      setIsFullScreen(false);
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });

      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';

      // Load session documents
      loadSessionDocuments(activeChatSessionId);

      prevSessionIdRef.current = activeChatSessionId;
    }
  }, [activeChatSessionId, loadSessionDocuments]);

  const handleMessageDeleteClick = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (messageToDelete) {
      onDeleteMessage(messageToDelete);
      setShowDeleteConfirm(false);
      setMessageToDelete(null);
    }
  }, [messageToDelete, onDeleteMessage]);

  const handleCloseDiagramPanel = useCallback(() => {
    setActiveDiagram(null);
    setIsFullScreen(false);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleToggleUserMessageExpansion = useCallback((messageContent: string) => {
    setExpandedMessages(prev => {
      if (prev.includes(messageContent)) {
        return prev.filter(msg => msg !== messageContent);
      } else {
        return [...prev, messageContent];
      }
    });
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
    event.target.value = '';
  }, [processFiles]);

  const handleRemoveFile = useCallback((fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const handleImageGenerated = useCallback((imageUrl: string, prompt: string) => {
    // Create a file object from the generated image URL
    fetch(imageUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `generated-${Date.now()}.png`, { type: 'image/png' });
        const fileId = generateId();
        const attachedFile: AttachedFile = {
          file,
          preview: imageUrl,
          type: 'image',
          id: fileId
        };
        setAttachedFiles(prev => [...prev, attachedFile]);
        // Optionally add the prompt to the input message
        if (prompt && !inputMessageRef.current.trim()) {
          setInputValue(`Generated image: ${prompt}`);
        }
      })
      .catch(error => {
        // console.error('Error adding generated image:', error);
        toast.error('Failed to add generated image to chat.');
      });
  }, []);

  const handleRemoveAllFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  const handleEditClick = useCallback((message: Message) => {
      // LOG: AiChat received message
      // console.log('[AiChat] handleEditClick message:', message);
    if (message.role !== 'user') return;

    setInputValue(message.content);
    // Find the following assistant message if it exists
    const index = messages.findIndex(msg => msg.id === message.id);
    const nextMsg = index !== -1 ? messages[index + 1] : null;
    const assistantId = nextMsg?.role === 'assistant' ? nextMsg.id : null;

    setEditingMessage({
      id: message.id,
      originalAssistantId: assistantId,
      attachedDocumentIds: message.attachedDocumentIds || [],
      attachedNoteIds: message.attachedNoteIds || [],
      imageUrl: message.image_url || null,
      imageMimeType: message.image_mime_type || null,
    });

    // Scroll to input
    textareaRef.current?.focus();
  }, [messages]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInputValue('');
  }, [setInputValue]);

  const selectedDocumentTitles = useMemo(() => {
    return mergedDocuments
      .filter(doc => selectedDocumentIds.includes(doc.id) && doc.type !== 'image')
      .map(doc => doc.title);
  }, [mergedDocuments, selectedDocumentIds]);

  const selectedNoteTitles = useMemo(() => {
    return notes
      .filter(note => selectedDocumentIds.includes(note.id))
      .map(note => note.title);
  }, [notes, selectedDocumentIds]);

  const selectedImageDocuments = useMemo(() => {
    return mergedDocuments
      .filter(doc => selectedDocumentIds.includes(doc.id) && doc.type === 'image');
  }, [mergedDocuments, selectedDocumentIds]);

  const { isSpeaking, speakingMessageId, isPaused, speakMessage, pauseSpeech, resumeSpeech, stopSpeech } = useTextToSpeech({
    messages,
    isLoading,
    isLoadingSessionMessages,
    isPhone,
    stripCodeBlocks,
  });

  const handleDocumentUpdatedLocally = useCallback((updatedDoc: Document) => {
    onDocumentUpdated(updatedDoc);
  }, [onDocumentUpdated]);

  const handleDiagramCodeUpdate = useCallback((messageId: string, newCode: string): Promise<void> => {
    toast.info('Diagram code updated. You can regenerate the response to see changes.');
    return Promise.resolve();
  }, []);

  const memoizedOnMermaidError = useCallback((code: string | null, errorType: 'syntax' | 'rendering' | 'timeout' | 'network') => {
    //console.error("Mermaid error in DiagramPanel:", code, errorType);
    toast.error(`Mermaid rendering issue: ${errorType}${code ? ` - Code: ${code.substring(0, 50)}...` : ''}`);
  }, []);

  const memoizedOnSuggestAiCorrection = useCallback((prompt: string) => {
    if (onSuggestAiCorrection) {
      onSuggestAiCorrection(prompt);
      return;
    }
    setInputValue(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    toast.info("AI correction prepared in input. Review and send to apply.");
  }, [onSuggestAiCorrection, setInputValue]);

  const handleScrollToTop = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleScrollToBottom = () => {
    // specific logic: if auto-scroll is disabled, this button forces it
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = useCallback(async () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;

    // Show/hide scroll navigation buttons based on position
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollDown(distanceFromBottom > 200);
    setShowScrollUp(scrollTop > 200);

    // Load older messages when scrolling to top
    if (scrollTop < 50 && hasMoreMessages && !isLoadingOlderMessages) {
      setIsLoadingOlderMessages(true);
      try {
        await onLoadOlderMessages();
      } finally {
        setIsLoadingOlderMessages(false);
      }
    }
  }, [hasMoreMessages, isLoadingOlderMessages, onLoadOlderMessages]);

  return (
    <>
      {/* Main Chat Container */}
      <div
        ref={dropZoneRef}
        className={`flex h-[100dvh] lg:h-screen pt-0 lg:pt-0 border-none relative bg-transparent dark:bg-transparent overflow-hidden font-sans ${isDragging ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
      >
        <DragOverlay isDragging={isDragging} />

        {/* Chat Panel */}
        <div
          className={`flex flex-col h-full rounded-lg panel-transition bg-transparent dark:bg-transparent transition-all duration-300 relative ${isDiagramPanelOpen ? 'flex-shrink-0' : 'flex-1'} ${isPhone() ? 'fixed inset-0 z-30 rounded-none h-[100dvh] w-screen ' : ''} ${(!isDiagramPanelOpen && !activePodcast && !isPhone()) ? 'max-w-3xl mx-auto' : ''}`}
          style={isDiagramPanelOpen && !isPhone() ? { width: `calc(${100 - panelWidth}% - 1px)` } : isPhone() ? { width: '100vw', height: '100dvh', left: 0, top: 0 } : { flex: 1 }}
        >
          {/* Enhanced Loading States */}
          {isLoadingSessionMessages && messages.length === 0 ? (
            <ChatLoadingIndicator
              isLoadingSession={true}
              messageCount={0}
            />
          ) : isLoadingSessionMessages && messages.length > 0 ? (
            <div className="flex justify-center items-center py-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                <span>Loading older messages...</span>
              </div>
            </div>
          ) : activeChatSessionId && messages.length === 0 && !isCurrentlySending && !isSubmittingUserMessage && !isLoadingSessionMessages && !streamingState?.isStreaming && !isCurrentlySendingRef.current && !messages.some(m => m.id?.startsWith?.('optimistic-')) ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-10 md:mt-20 font-claude">
              <BookPagesAnimation className="mx-auto mb-4 h-16 w-16 text-pink-500" showText={false} />
              <p className="text-lg md:text-xl">Start the conversation by sending a message!</p>
            </div>
          ) : null}

          {/* Messages */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 pb-4 dark:bg-transparent flex flex-col modern-scrollbar"
          >
            {/* Show skeleton only when loading first messages */}
            {isLoadingSessionMessages && messages.length === 0 && (
              <MessageSkeleton />
            )}
            {messages.length > 0 && (
              <MessageList
                messages={messages}
                isLoading={isLoading}
                isLoadingSessionMessages={isLoadingSessionMessages}
                isLoadingOlderMessages={isLoadingOlderMessages}
                hasMoreMessages={hasMoreMessages}
                mergedDocuments={mergedDocuments}
                onDeleteClick={handleMessageDeleteClick}
                onRegenerateClick={onRegenerateResponse}
                onRetryClick={onRetryFailedMessage}
                onViewContent={memoizedHandleViewContent}
                onMermaidError={memoizedOnMermaidError}
                onSuggestAiCorrection={memoizedOnSuggestAiCorrection}
                onToggleUserMessageExpansion={handleToggleUserMessageExpansion}
                expandedMessages={expandedMessages}
                isSpeaking={isSpeaking}
                speakingMessageId={speakingMessageId}
                isPaused={isPaused}
                speakMessage={speakMessage}
                pauseSpeech={pauseSpeech}
                resumeSpeech={resumeSpeech}
                stopSpeech={stopSpeech}
                isDiagramPanelOpen={isDiagramPanelOpen}
                enableTypingAnimation={true}
                onMarkMessageDisplayed={handleMarkMessageDisplayed}
                autoTypeInPanel={autoTypeInPanel}
                onBlockDetected={memoizedHandleBlockDetected}
                onBlockUpdate={memoizedHandleBlockDetected}
                onBlockEnd={memoizedHandleBlockDetected}
                onDiagramCodeUpdate={handleDiagramCodeUpdate}
                onEditClick={handleEditClick}
              />
            )}
            {isCurrentlySending && isAiTyping && messages.length > 0 && (
              <div className="flex justify-center font-sans">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">sending...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Scroll Navigation Buttons — only visible when scrolled away from top/bottom */}
          <div className="absolute bottom-20 right-3 sm:right-4 flex flex-col gap-2 z-20 pointer-events-auto">
            {showScrollUp && (
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full shadow-md bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all duration-200 opacity-70 hover:opacity-100"
                onClick={handleScrollToTop}
                title="Scroll to Top"
              >
                <ArrowUp className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </Button>
            )}
            {showScrollDown && (
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full shadow-md bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all duration-200 opacity-70 hover:opacity-100"
                onClick={handleScrollToBottom}
                title="Scroll to Bottom"
              >
                <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </Button>
            )}
          </div>

          {/* Input area */}
          <div className={`shrink-0 pb-[env(safe-area-inset-bottom)] bg-transparent dark:bg-transparent dark:border-gray-700 font-sans z-10
            ${isDiagramPanelOpen ? `md:pr-[calc(${panelWidth}%+1.5rem)]` : ''}`}>
            <div className={`w-full ${(!isDiagramPanelOpen && !activePodcast) ? 'max-w-3xl' : 'max-w-4xl'} mx-auto dark:bg-gray-800 border border-slate-200 bg-white rounded-lg shadow-md dark:border-gray-700 p-2`}>
              <SubscriptionGuard
                feature="AI Chat"
                limitFeature="maxAiMessages"
                currentCount={userMessagesToday}
                message="You've reached your daily AI message limit."
              >
                {editingMessage && (
                  <div className="mb-2 flex items-center justify-between px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Editing Message</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-800"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {attachedFiles.length > 0 || selectedDocumentIds.length > 0 ? (
                  <div className="mb-2">
                    <ContextBadges
                      attachedFiles={attachedFiles}
                      selectedImageDocuments={selectedImageDocuments}
                      selectedDocumentTitles={selectedDocumentTitles}
                      selectedNoteTitles={selectedNoteTitles}
                      handleRemoveAllFiles={handleRemoveAllFiles}
                      onSelectionChange={onSelectionChange}
                      selectedDocumentIds={selectedDocumentIds}
                      documents={mergedDocuments}
                      notes={notes}
                      handleRemoveFile={handleRemoveFile}
                      onViewContent={memoizedHandleViewContent}
                    />
                  </div>
                ) : null}
                <div className="flex flex-row gap-2 mt-0 sm:mt-2 w-full items-end">
                  <Menubar className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg">
                    <MenubarMenu>
                      <MenubarTrigger className="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
                        <MenuIcon className="h-5 w-5" />
                      </MenubarTrigger>
                      <MenubarContent align="end" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <MenubarItem onClick={() => setEnableStreamingMode(!enableStreamingMode)} className="flex items-center gap-2">
                          <motion.div
                            animate={enableStreamingMode ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                            transition={{ duration: 0.5, repeat: enableStreamingMode ? Infinity : 0, repeatDelay: 1 }}
                            whileHover={{ scale: 1.25 }}
                            className={enableStreamingMode ? 'text-pink-500' : 'text-blue-500'}
                          >
                            {enableStreamingMode ? '🧠' : '💬'}
                          </motion.div>
                          <span className="text-xs font-medium hidden sm:inline">
                            {enableStreamingMode ? 'Thinking Mode' : 'Fast Mode'}
                          </span>
                        </MenubarItem>
                        <MenubarItem onClick={isRecognizing ? stopRecognition : startRecognition} disabled={micPermissionStatus === 'checking' || isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}>
                          <span className="flex items-center">
                            <motion.span whileHover={{ scale: 1.25 }} className={isRecognizing ? 'text-green-500' : 'text-gray-500'}>
                              <Mic className="h-5 w-5 mr-2" />
                            </motion.span>
                            {isRecognizing ? 'Stop Speech Recognition' : 'Start Speech Recognition'}
                          </span>
                        </MenubarItem>
                        <MenubarItem onClick={() => cameraInputRef.current?.click()} disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}>
                          <span className="flex items-center">
                            <motion.span whileHover={{ scale: 1.25 }} className="text-yellow-500">
                              <Camera className="h-5 w-5 mr-2" />
                            </motion.span>
                            Take Picture
                          </span>
                        </MenubarItem>
                        <MenubarItem onClick={() => fileInputRef.current?.click()} disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}>
                          <span className="flex items-center">
                            <motion.span whileHover={{ scale: 1.25 }} className="text-purple-500">
                              <Paperclip className="h-5 w-5 mr-2" />
                            </motion.span>
                            Upload Files
                          </span>
                        </MenubarItem>
                        <MenubarItem onClick={() => setShowDocumentSelector(true)} disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}>
                          <span className="flex items-center">
                            <motion.span whileHover={{ scale: 1.25 }} className="text-blue-500">
                              <FileText className="h-5 w-5 mr-2" />
                            </motion.span>
                            {isUpdatingDocuments ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Select Documents/Notes'}
                          </span>
                        </MenubarItem>
                        <MenubarItem onClick={() => setShowPodcastGenerator(true)} disabled={selectedDocumentIds.length === 0}>
                          <span className="flex items-center">
                            <motion.span whileHover={{ scale: 1.25 }} className="text-pink-500">
                              <Podcast className="h-5 w-5 mr-2" />
                            </motion.span>
                            Generate AI Podcast
                          </span>
                        </MenubarItem>
                        <MenubarItem onClick={() => setShowImageGenerator(true)} disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}>
                          <span className="flex items-center">
                            <motion.span whileHover={{ scale: 1.25 }} className="text-purple-500">
                              <Image className="h-5 w-5 mr-2" />
                            </motion.span>
                            Generate AI Image
                          </span>
                        </MenubarItem>
                        <MenubarItem onClick={() => setAutoTypeInPanel(prev => !prev)}>
                          <span className="flex items-center">
                            <motion.span whileHover={{ scale: 1.25 }} className={autoTypeInPanel ? 'text-green-500' : 'text-gray-500'}>
                              <Layout className="h-5 w-5 mr-2" />
                            </motion.span>
                            {autoTypeInPanel ? 'Panel On' : 'Panel Off'}
                          </span>
                        </MenubarItem>
                      </MenubarContent>
                    </MenubarMenu>
                  </Menubar>
                  <textarea
                    ref={textareaRef}
                    defaultValue=""
                    onChange={(e) => {
                      const newValue = e.target.value;
                      inputMessageRef.current = newValue;
                      // Only trigger a re-render when empty↔non-empty changes (for button icon)
                      const nowHasInput = newValue.trim().length > 0;
                      if (nowHasInput !== hasInput) setHasInput(nowHasInput);
                      // Resize textarea (DOM-only, no state)
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="What do you want to know? (Type '/image' or 'generate image' for AI image generation)"
                    className="w-full overflow-y-scroll modern-scrollbar text-base md:text-lg focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[82px] dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-400 bg-white text-gray-800 placeholder-gray-600 px-3 py-2 transition-colors duration-300 font-claude"
                    disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}
                    rows={1}
                  />
                  {streamingState?.isStreaming ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          if (streamingState.isPaused) {
                            const lastUserMsg = messages.slice().reverse().find(m => m.role === 'user');
                            const lastAiMsg = messages.slice().reverse().find(m => m.role === 'assistant');
                            if (lastUserMsg && lastAiMsg) {
                              onResumeGeneration?.(lastUserMsg.content, lastAiMsg.id);
                            }
                          } else {
                            onPauseGeneration?.();
                          }
                        }}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white shadow-md h-10 w-10 flex-shrink-0 rounded-lg p-0 transition-all duration-300"
                        title={streamingState.isPaused ? "Resume Generation" : "Pause Generation"}
                      >
                        {streamingState.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        onClick={onInterruptMessage}
                        className="bg-red-500 hover:bg-red-600 text-white shadow-md h-10 w-10 flex-shrink-0 rounded-lg p-0 transition-all duration-300"
                        title="Stop Generation"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={(e) => {
                        if (editingMessage) {
                          onEditAndResendMessage?.(
                            inputMessageRef.current,
                            editingMessage.id,
                            editingMessage.originalAssistantId,
                            editingMessage.attachedDocumentIds,
                            editingMessage.attachedNoteIds,
                            editingMessage.imageUrl,
                            editingMessage.imageMimeType
                          );
                          setEditingMessage(null);
                          setInputValue('');
                        } else if (inputMessageRef.current.trim() || attachedFiles.length > 0) {
                          handleSendMessage(e);
                        } else {
                          if (isRecognizing) {
                            stopRecognition();
                          } else {
                            startRecognition();
                          }
                        }
                      }}
                      disabled={
                        (isLoading ||
                          isSubmittingUserMessage ||
                          isGeneratingImage ||
                          isUpdatingDocuments ||
                          isCurrentlySending ||
                          isAiTyping ||
                          !isLastAiMessageDisplayed ||
                          messages.some(msg => msg.id.startsWith('optimistic-'))) && !isRecognizing
                      }
                      className={`${isRecognizing ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
                        } text-white shadow-md h-10 w-10 flex-shrink-0 rounded-lg p-0 transition-all duration-300`}
                    >
                      {isSubmittingUserMessage || isCurrentlySending || isAiTyping ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (hasInput || attachedFiles.length > 0 || editingMessage) ? (
                        <Send className="h-4 w-4" />
                      ) : (
                        <motion.div
                          animate={isRecognizing ? {
                            scale: [1, 1.2, 1],
                            opacity: [1, 0.8, 1]
                          } : { scale: 1 }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        >
                          <Mic className="h-4 w-4" />
                        </motion.div>
                      )}
                    </Button>
                  )}
                  {/* Hidden file inputs for menu actions */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <input
                    type="file"
                    // Accept all types except dangerous ones (UI hint only, backend will check too)
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.html,.css,.js,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.tif,.ico,.heic,.heif,.mp3,.wav,.mp4,.mov,.avi,.zip,.rar,.7z,.tar,.gz,.md,.rtf,.odt,.ods,.odp,.pages,.numbers,.key,.c,.cpp,.h,.hpp,.py,.java,.rb,.go,.php,.ts,.tsx,.m,.sh,.bat,.ps1,.yml,.yaml,.ini,.log,.tex,.epub,.mobi,.azw,.ibooks,.cbz,.cbr,.mpg,.mpeg,.ogg,.oga,.ogv,.webm,.flac,.aac,.m4a,.wav,.aiff,.alac,.opus,.amr,.mid,.midi,.3gp,.3g2,.mkv,.wmv,.flv,.swf,.asf,.vob,.rm,.ram,.mov,.qt,.f4v,.f4p,.f4a,.f4b,.ts,.m2ts,.mts,.mxf,.gpx,.geojson,.kml,.kmz,.gml,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg,.sqlite,.db,.sql,.bak,.dmp,.accdb,.mdb,.sqlite3,.db3,.s3db,.sl3,.dbf,.csv,.tsv,.xls,.xlsx,.ods,.xml,.json,.geojson,.gml,.kml,.kmz,.shp,.dbf,.prj,.sbn,.sbx,.shx,.cpg,.qgs,.qgz,.gpkg"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </SubscriptionGuard>
            </div>
          </div>

          {/* Document selector and other modals */}
          {showDocumentSelector && (
            <DocumentSelector
              documents={mergedDocuments}
              notes={notes}
              selectedDocumentIds={selectedDocumentIds}
              onSelectionChange={onSelectionChange}
              isOpen={showDocumentSelector}
              onClose={() => {
                setShowDocumentSelector(false);
                setIsUpdatingDocuments(false);
              }}
              onLoadMoreDocuments={onLoadMoreDocuments}
              hasMoreDocuments={hasMoreDocuments}
              isLoadingDocuments={isLoadingDocuments}
              activeChatSessionId={activeChatSessionId}
            />
          )}
          {showPodcastGenerator && (
            <PodcastGenerator
              selectedNoteIds={selectedDocumentIds.filter(id => notes.some(n => n.id === id))}
              selectedDocumentIds={selectedDocumentIds.filter(id => documents.some(d => d.id === id))}
              onClose={() => setShowPodcastGenerator(false)}
              onPodcastGenerated={(podcast) => {
                setActivePodcast(podcast);
                setShowPodcastGenerator(false);
              }}
            />
          )}
          {showImageGenerator && userProfile?.id && (
            <ImageGenerator
              isOpen={showImageGenerator}
              onClose={() => {
                setShowImageGenerator(false);
                setDetectedImagePrompt('');
              }}
              userId={userProfile.id}
              onImageGenerated={handleImageGenerated}
              initialPrompt={detectedImagePrompt}
            />
          )}
          <ConfirmationModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleConfirmDelete}
            title="Delete Message"
            message="Are you sure you want to delete this message? This action cannot be undone."
          />
        </div>

        {/* Podcast Panel */}
        {activePodcast && (
          <PodcastPanel
            podcast={activePodcast}
            onClose={() => setActivePodcast(null)}
            isOpen={!!activePodcast}
            panelWidth={podcastPanelWidth}
            setPanelWidth={setPodcastPanelWidth}
          />
        )}

        {/* Diagram Panel - Desktop only (side by side) */}
        {isDiagramPanelOpen && !isPhone() && (
          <DiagramPanel
            key="diagram-panel"
            diagramContent={activeDiagram?.content}
            diagramType={activeDiagram?.type || 'unknown'}
            onClose={handleCloseDiagramPanel}
            onMermaidError={memoizedOnMermaidError}
            onSuggestAiCorrection={memoizedOnSuggestAiCorrection}
            isOpen={isDiagramPanelOpen}
            language={activeDiagram?.language}
            imageUrl={activeDiagram?.imageUrl}
            initialWidthPercentage={panelWidth}
            liveContent={activeDiagram?.content}
            isPhone={isPhone}
            currentTheme={initialAppState.currentTheme}
            panelWidth={panelWidth}
            setPanelWidth={setPanelWidth}
          />
        )}
      </div>

      {/* Diagram Panel - Mobile only (fixed overlay, portal) */}
      {isDiagramPanelOpen && isPhone() && typeof window !== 'undefined' && (
        ReactDOM.createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, width: '100vw', height: '100vh', background: 'white' }}>
            <DiagramPanel
              key="diagram-panel-mobile"
              diagramContent={activeDiagram?.content}
              diagramType={activeDiagram?.type || 'unknown'}
              onClose={handleCloseDiagramPanel}
              onMermaidError={memoizedOnMermaidError}
              onSuggestAiCorrection={memoizedOnSuggestAiCorrection}
              isOpen={isDiagramPanelOpen}
              language={activeDiagram?.language}
              imageUrl={activeDiagram?.imageUrl}
              initialWidthPercentage={100}
              liveContent={activeDiagram?.content}
              isPhone={isPhone}
              currentTheme={initialAppState.currentTheme}
              panelWidth={100}
              setPanelWidth={setPanelWidth}
            />
          </div>,
          document.body
        )
      )}
    </>
  );
  // End of AIChat component
}

const arePropsEqual = (prevProps: AIChatProps, nextProps: AIChatProps) => {
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isSubmittingUserMessage === nextProps.isSubmittingUserMessage &&
    prevProps.isLoadingSessionMessages === nextProps.isLoadingSessionMessages &&
    prevProps.activeChatSessionId === nextProps.activeChatSessionId &&
    prevProps.messages === nextProps.messages &&
    prevProps.selectedDocumentIds === nextProps.selectedDocumentIds &&
    prevProps.onSuggestAiCorrection === nextProps.onSuggestAiCorrection &&
    prevProps.documents === nextProps.documents
  );
};

export default React.memo(AIChat, arePropsEqual);
