import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { Send, Loader2, FileText, Camera, Paperclip, Mic, Podcast, MenuIcon, Layout, ArrowUp, ArrowDown, Image, Square, Pause, Play, X, BookOpen, Check, Plus, Sparkles, MessageCircle, Search, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, MoreVertical, ExternalLink, Eye, Unlink } from 'lucide-react';
import { Button } from '../../ui/components/button';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem
} from '../../ui/components/menubar';
import { UserProfile, Document } from '../../../types/Document';
import { Note } from '../../../types/Note';
import { apiClient } from '@/services/apiClient';
import { DocumentSelector } from './DocumentSelector';
import { toast } from 'sonner';
import { DiagramPanel } from './DiagramPanel';
import { generateId } from '@/modules/classRecordings/utils/helpers';
import { MessageList } from './MessageList';
import { ConfirmationModal } from '../../ui/components/ConfirmationModal';
import { ClassRecording, Message } from '../../../types/Class';
import BookPagesAnimation from '../../ui/components/bookloader';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { getFileType, validateFile, stripCodeBlocks, overrideTsMimeType } from '../utils/helpers';
import { ContextBadges } from './ContextBadges';
import { EducationContextBadge } from './EducationContextBadge';
import { DragOverlay } from './DragOverlay';

import { initialAppState } from '@/contexts/appReducer';
import { SubscriptionGuard } from '../../subscription/components/SubscriptionGuard';
import { useAiMessageTracker } from '@/modules/aiChat/hooks/useAiMessageTracker';
import { PodcastGenerator, type PodcastData } from '../../podcasts/components/PodcastGenerator';
import { PodcastPanel } from '../../podcasts/components/PodcastPanel';
import { ImageGenerator } from './ImageGenerator';
import { useImageGenerationDetector } from '@/modules/aiChat/hooks/useImageGenerationDetector';
import { useUserActivityLogger } from '@/hooks/useUserActivityLogger';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/modules/ui/components/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/modules/ui/components/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/modules/ui/components/dropdown-menu';

export interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'other';
  id: string;
}

interface WorkspaceSource {
  id: string;
  title: string;
  kind: 'Note' | 'Document' | 'Recording';
  detail: string;
  icon: React.ElementType;
  sourceKind: 'note' | 'document' | 'recording';
  content: string | null;
  fileUrl?: string | null;
  imageUrl?: string | null;
  audioUrl?: string | null;
}

interface AIChatProps {
  messages: Message[];
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  userProfile: UserProfile | null;
  documents: Document[];
  recordings: ClassRecording[];
  notes: Note[];
  chatSessionTitle?: string;
  onNavigateToTab: (tab: string) => void;
  onOpenSource: (sourceKind: WorkspaceSource['sourceKind'], sourceId: string) => void;
  selectedDocumentIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeChatSessionId: string | null;
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
  ) => Promise<boolean | void>;
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
  recordings,
  notes,
  chatSessionTitle,
  onNavigateToTab,
  onOpenSource,
  selectedDocumentIds,
  onSelectionChange,
  activeChatSessionId,
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
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [draftSourceIds, setDraftSourceIds] = useState<string[]>([]);
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
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(true);
  const [isStudioPanelOpen, setIsStudioPanelOpen] = useState(true);
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
        const results = await Promise.allSettled(
          missingIds.map(id => apiClient.get<Document>(`documents/${id}`))
        );
        const fetchedDocs = results
          .filter((r): r is PromiseFulfilledResult<Document> => r.status === 'fulfilled')
          .map(r => r.value);
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
  const { logUserActivity } = useUserActivityLogger();
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
      const sessions = await apiClient.get<any[]>('chat/sessions');
      const sessionData = sessions?.find((s: any) => s.id === sessionId);

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

  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (isRecognizing) {
      stopRecognition();
    }

    // Read text from the ref (uncontrolled textarea)
    const inputMessage = inputMessageRef.current;

    // Check if this is an image generation request (currently suspended)
    const imageDetection = detectImageGenerationRequest(inputMessage);
    if (imageDetection.isImageRequest && imageDetection.extractedPrompt) {
      toast.info('AI Image generation is temporarily suspended. We\'re working on improvements — stay tuned!', { duration: 5000 });
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
        try { await apiClient.patch(`chat/sessions/${activeChatSessionId}`, { document_ids: selectedDocumentIds, updated_at: new Date().toISOString() }); } catch { }
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

            const textMimeTypes = [
              'application/json',
              'application/javascript',
              'application/typescript',
              'application/xml',
            ];
            if (safeFile.type.startsWith('text/') || textMimeTypes.includes(safeFile.type)) {
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
            mimeType: safeFile.type || (safeFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
            data,
            type: fileType,
            size: safeFile.size,
            content,
            processing_status: 'pending',
            processing_error: null,
          };
        })
      );
      const recordingContextFiles = recordings
        .filter(recording => selectedDocumentIds.includes(recording.id))
        .map(recording => {
          const content = [
            `Class recording: ${recording.title || 'Untitled recording'}`,
            recording.subject ? `Subject: ${recording.subject}` : '',
            recording.summary ? `Summary: ${recording.summary}` : '',
            recording.transcript ? `Transcript:\n${recording.transcript}` : 'Transcript is not available yet.',
          ].filter(Boolean).join('\n\n');

          return {
            name: `${recording.title || 'Class recording'} transcript.txt`,
            mimeType: 'text/plain',
            data: null,
            type: 'document' as const,
            size: new Blob([content]).size,
            content,
            processing_status: 'completed',
            processing_error: null,
          };
        });
      // Note: Message count updates automatically via realtime subscription when AI responds
      const sendSucceeded = await onSendMessageToBackend(
        inputMessage.trim(),
        documentIds,
        noteIds,
        [...filesForBackend, ...recordingContextFiles]
      );
      if (sendSucceeded === false) return;
      setInputValue('');
      void logUserActivity(userProfile?.id, 'chat', 10);

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
    recordings,
    notes,
    onSendMessageToBackend,
    isCurrentlySending,
    checkAiMessageLimit,
    messages,
    isRecognizing,
    stopRecognition,
    detectImageGenerationRequest,
    setInputValue,
    logUserActivity,
  ]);
  const handleMarkMessageDisplayed = useCallback(async (messageId: string) => {
    if (!userProfile?.id || !activeChatSessionId) {

      return;
    }

    if (messageId.startsWith('optimistic-')) {
      return;
    }

    // The typing callback is only wired to the last assistant message. Unlock
    // the composer immediately instead of relying on the callback's possibly
    // stale messages snapshot to identify that message as last.
    setIsLastAiMessageDisplayed(true);

    try {
      await apiClient.patch(
        `chat/messages/${messageId}?session_id=${encodeURIComponent(activeChatSessionId)}`,
        { has_been_displayed: true },
      );

      const displayedMessage = messages.find(msg => msg.id === messageId);
      if (displayedMessage) {
        onMessageUpdate({
          ...displayedMessage,
          has_been_displayed: true
        });
      }

      if (displayedMessage?.role === 'assistant') {
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

  const handleSourceSelectionChange = useCallback((ids: string[]) => {
    onSelectionChange(ids);
    if (!activeChatSessionId || activeChatSessionId.startsWith('offline-') || !navigator.onLine) return;

    void apiClient.patch(`chat/sessions/${activeChatSessionId}`, {
      document_ids: ids,
      updated_at: new Date().toISOString(),
    }).catch((error) => {
      console.error('Failed to save chat sources:', error);
      toast.error('Your source selection could not be saved. Try again.');
    });
  }, [activeChatSessionId, onSelectionChange]);

  const sourceItems = useMemo<WorkspaceSource[]>(() => [
    ...notes.map(note => ({
      id: note.id,
      title: note.title || 'Untitled note',
      kind: 'Note' as const,
      sourceKind: 'note' as const,
      detail: 'Written note',
      icon: BookOpen,
      content: note.content,
    })),
    ...mergedDocuments.filter(document => !notes.some(note => note.id === document.id)).map(document => ({
      id: document.id,
      title: document.title || document.file_name || 'Untitled document',
      kind: 'Document' as const,
      sourceKind: 'document' as const,
      detail: document.processing_status === 'completed' ? 'Ready to study' : 'Document',
      icon: FileText,
      content: document.content_extracted,
      fileUrl: document.file_url,
      imageUrl: document.type === 'image' ? document.file_url : null,
    })),
    ...recordings.map(recording => ({
      id: recording.id,
      title: recording.title || 'Untitled recording',
      kind: 'Recording' as const,
      sourceKind: 'recording' as const,
      detail: recording.transcript?.trim() ? 'Transcript ready' : 'Recording',
      icon: Mic,
      content: [
        recording.subject ? `Subject: ${recording.subject}` : '',
        recording.summary ? `Summary:\n${recording.summary}` : '',
        recording.transcript ? `Transcript:\n${recording.transcript}` : '',
      ].filter(Boolean).join('\n\n') || null,
      audioUrl: recording.audio_url || recording.audioUrl,
    })),
  ], [mergedDocuments, notes, recordings]);

  const toggleSource = useCallback((id: string) => {
    handleSourceSelectionChange(selectedDocumentIds.includes(id)
      ? selectedDocumentIds.filter(selectedId => selectedId !== id)
      : [...selectedDocumentIds, id]);
  }, [handleSourceSelectionChange, selectedDocumentIds]);

  const attachedSources = sourceItems.filter(source => selectedDocumentIds.includes(source.id));
  const handleSourcePreview = useCallback((source: WorkspaceSource) => {
    if (source.imageUrl) {
      memoizedHandleViewContent('image', null, undefined, source.imageUrl);
      return;
    }
    if (source.content) {
      memoizedHandleViewContent('document-text', source.content, 'markdown', undefined);
      return;
    }
    const originalUrl = source.audioUrl || source.fileUrl;
    if (originalUrl) {
      window.open(originalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    toast.info('There is no content available to preview for this source yet.');
  }, [memoizedHandleViewContent]);
  const filteredSourceItems = sourceItems.filter(source =>
    `${source.title} ${source.kind} ${source.detail}`.toLowerCase().includes(sourceSearch.trim().toLowerCase())
  );
  const studioTools = [
    { label: 'Flashcards', action: 'flashcards', icon: BookOpen, prompt: 'Create a concise set of study flashcards from my attached sources. Use question-and-answer pairs, cover the most important concepts, and avoid duplicate cards.' },
    { label: 'Quiz', action: 'quiz', icon: Check, prompt: 'Create a 10-question practice quiz based on my attached sources. Use multiple-choice questions, mark the correct answer, and briefly explain why it is correct.' },
    { label: 'Study guide', action: 'study-guide', icon: FileText, prompt: 'Create a clear, well-organized study guide from my attached sources. Include key ideas, definitions, and a short review checklist.' },
    { label: 'Summary', action: 'summary', icon: MessageCircle, prompt: 'Summarize my attached sources, highlighting the central ideas, important details, and how the ideas connect.' },
    { label: 'Practice', action: 'practice', icon: Sparkles, prompt: 'Create a short active-recall practice session from my attached sources. Ask one question at a time and wait for my answer before revealing the explanation.' },
    { label: 'Podcast', action: 'podcast', icon: Podcast, prompt: '' },
  ];

  const openSourcePicker = useCallback(() => {
    setDraftSourceIds(selectedDocumentIds);
    setSourceSearch('');
    setShowSourcePicker(true);
  }, [selectedDocumentIds]);

  const toggleDraftSource = (id: string) => {
    setDraftSourceIds(current => current.includes(id)
      ? current.filter(sourceId => sourceId !== id)
      : [...current, id]);
  };

  const attachDraftSources = () => {
    handleSourceSelectionChange(draftSourceIds);
    setShowSourcePicker(false);
  };

  const runStudioAction = useCallback((action: string, prompt: string) => {
    if (selectedDocumentIds.length === 0) {
      setIsStudioPanelOpen(true);
      openSourcePicker();
      toast.info('Attach a source first to create something grounded in your material.');
      return;
    }

    if (action === 'podcast') {
      const podcastSourceIds = selectedDocumentIds.filter(id =>
        notes.some(note => note.id === id) || documents.some(document => document.id === id)
      );
      if (podcastSourceIds.length === 0) {
        toast.info('The podcast generator needs an attached note or document. Add one to get started.');
        openSourcePicker();
        return;
      }
      setShowPodcastGenerator(true);
      return;
    }

    setInputValue(prompt);
    void handleSendMessage();
  }, [documents, handleSendMessage, notes, openSourcePicker, selectedDocumentIds, setInputValue]);

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
        className={`flex h-full min-h-0 border-none relative bg-slate-50 text-foreground dark:bg-slate-950 dark:text-gray-100 overflow-hidden font-sans ${isDragging ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
      >
        <DragOverlay isDragging={isDragging} />

        <aside className={`m-2 hidden shrink-0 flex-col rounded-2xl bg-white p-3 text-foreground shadow-sm transition-[width] duration-200 dark:bg-slate-900 dark:text-gray-200 dark:shadow-none lg:flex ${isSourcesPanelOpen ? 'w-[270px]' : 'w-14'}`}>
          <div className={`mb-4 flex items-center ${isSourcesPanelOpen ? 'justify-between' : 'justify-center'}`}>
            {isSourcesPanelOpen && (
              <div>
                <h2 className="text-sm font-semibold">Sources</h2>
                <p className="mt-1 text-xs text-muted-foreground">{attachedSources.length} attached</p>
              </div>
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsSourcesPanelOpen(open => !open)}
                    className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={isSourcesPanelOpen ? 'Hide sources panel' : 'Show sources panel'}
                    aria-expanded={isSourcesPanelOpen}
                  >
                    {isSourcesPanelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="border-border bg-popover text-popover-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {isSourcesPanelOpen ? 'Hide sources' : 'Show sources'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {isSourcesPanelOpen && <>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {attachedSources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-7 text-center dark:border-gray-700">
                <BookOpen className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No sources attached</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose material from your library when you need it.</p>
                <Button type="button" onClick={openSourcePicker} size="sm" className="mt-4 rounded-full bg-muted text-foreground hover:bg-muted/80 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
                  <Plus className="mr-1.5 h-4 w-4" /> Add sources
                </Button>
              </div>
            ) : attachedSources.map(source => {
              const Icon = source.icon;
              return (
                <div
                  key={`${source.kind}-${source.id}`}
                  className="flex w-full items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-700/40 dark:bg-blue-900/20 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                >
                  <button
                    type="button"
                    aria-label={`Preview ${source.title}`}
                    onClick={() => handleSourcePreview(source)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground dark:text-gray-100">{source.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground dark:text-gray-400">{source.kind} · {source.detail}</span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`More actions for ${source.title}`}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right" className="w-56 border-border bg-popover text-popover-foreground dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100">
                      <DropdownMenuItem
                        onSelect={() => onOpenSource(source.sourceKind, source.id)}
                        className="gap-2 text-popover-foreground hover:text-foreground dark:text-gray-100 dark:hover:text-white"
                      >
                        <ExternalLink className="h-4 w-4 text-blue-400" />
                        Open detailed source
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleSourcePreview(source)}
                        className="gap-2 text-popover-foreground hover:text-foreground dark:text-gray-100 dark:hover:text-white"
                      >
                        <Eye className="h-4 w-4 text-blue-400" />
                        Preview in workspace
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setInputValue(`Help me understand "${source.title}". Explain its key ideas and answer any questions I have about it.`);
                          requestAnimationFrame(() => textareaRef.current?.focus());
                        }}
                        className="gap-2 text-popover-foreground hover:text-foreground dark:text-gray-100 dark:hover:text-white"
                      >
                        <MessageCircle className="h-4 w-4 text-blue-400" />
                        Ask Chat about this
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => toggleSource(source.id)}
                        className="gap-2 text-red-300 hover:text-red-200"
                      >
                        <Unlink className="h-4 w-4" />
                        Remove from workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
          {attachedSources.length > 0 && (
            <Button type="button" variant="outline" onClick={openSourcePicker} className="mt-3 w-full rounded-full border-border bg-transparent text-xs text-muted-foreground hover:bg-muted hover:text-foreground dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white">
              <Plus className="mr-1.5 h-4 w-4" /> Add sources
            </Button>
          )}
          </>}
          {!isSourcesPanelOpen && (
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {attachedSources.map(source => {
                const Icon = source.icon;
                return (
                  <TooltipProvider key={`${source.kind}-${source.id}`} delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setIsSourcesPanelOpen(true)}
                          aria-label={`Show sources: ${source.title}`}
                          className="flex h-9 w-full items-center justify-center rounded-lg text-blue-600 transition hover:bg-muted hover:text-blue-700 dark:text-blue-400 dark:hover:bg-gray-800 dark:hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="border-border bg-popover text-popover-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">{source.title}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={openSourcePicker}
                      aria-label="Add sources"
                      className="flex h-9 w-full items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="border-border bg-popover text-popover-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">Add sources</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </aside>

        <div className="flex h-full min-h-0 min-w-0 flex-1">
        {/* Chat Panel */}
        <div
          className={`relative flex h-full min-h-0 min-w-0 flex-col bg-slate-50 text-foreground dark:bg-slate-950 dark:text-gray-100 ${isDiagramPanelOpen && !isPhone() ? 'flex-none' : 'flex-1'}`}
          style={isDiagramPanelOpen && !isPhone() ? { width: `${100 - panelWidth}%` } : { flex: 1 }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-3">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Sparkles className="h-4 w-4" /></span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold sm:text-base">{chatSessionTitle || 'Study workspace'}</h1>
                <p className="truncate text-xs text-muted-foreground dark:text-gray-400">
                  {attachedSources.length
                    ? `Chat grounded in ${attachedSources.length} ${attachedSources.length === 1 ? 'source' : 'sources'}`
                    : 'Ask anything, or add sources for grounded answers'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={openSourcePicker} className="h-9 rounded-full border-border bg-transparent px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white lg:hidden">
                <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Sources <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 dark:bg-gray-800">{attachedSources.length}</span>
              </Button>
              <div className="hidden sm:block"><EducationContextBadge /></div>
            </div>
          </div>

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
          ) : null}

          {/* Messages */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 pb-4 dark:bg-transparent flex flex-col modern-scrollbar"
          >
            {/* Show skeleton only when loading first messages */}
            {isLoadingSessionMessages && messages.length === 0 && (
              <MessageSkeleton />
            )}
            {activeChatSessionId && messages.length === 0 && !isCurrentlySending && !isSubmittingUserMessage && !isLoadingSessionMessages && !streamingState?.isStreaming && !isCurrentlySendingRef.current && !messages.some(m => m.id?.startsWith?.('optimistic-')) && (
              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-12 text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-blue-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-blue-400">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">Study workspace</p>
                <h2 className="mt-3 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">What are you working on?</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  {attachedSources.length
                    ? `Ask a question about your ${attachedSources.length === 1 ? 'attached source' : `${attachedSources.length} attached sources`}, or start with a fresh question.`
                    : 'Start with a question, or attach notes, documents, and recordings to give the conversation context.'}
                </p>
                {attachedSources.length === 0 && (
                  <Button type="button" variant="outline" onClick={openSourcePicker} className="mt-6 rounded-full border-border bg-muted text-foreground hover:bg-muted/80 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white">
                    <Plus className="mr-2 h-4 w-4" /> Attach existing sources
                  </Button>
                )}
              </div>
            )}
            {messages.length > 0 && (
              <div className="mx-auto w-full max-w-5xl">
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
              </div>
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
          <div className="z-10 shrink-0 bg-transparent pb-[env(safe-area-inset-bottom)] font-sans">
            <div className={`mx-auto w-full ${(!isDiagramPanelOpen && !activePodcast) ? 'max-w-3xl' : 'max-w-4xl'} rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900`}>
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
                      onSelectionChange={handleSourceSelectionChange}
                      selectedDocumentIds={selectedDocumentIds}
                      documents={mergedDocuments}
                      recordings={recordings}
                      notes={notes}
                      handleRemoveFile={handleRemoveFile}
                      onViewContent={memoizedHandleViewContent}
                    />
                  </div>
                ) : null}
                <div className="mt-0 flex w-full min-w-0 flex-row items-end gap-2 sm:mt-2">
                  <Menubar className="flex-shrink-0 rounded-lg border-border bg-muted text-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                    <MenubarMenu>
                      <MenubarTrigger className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground hover:bg-muted/80 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
                        <MenuIcon className="h-5 w-5" />
                      </MenubarTrigger>
                      <MenubarContent align="end" className="rounded-lg border border-border bg-popover text-popover-foreground shadow-lg dark:border-gray-700 dark:bg-gray-800">
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
                        <MenubarItem
                          onClick={() => {
                            toast.info('AI Image generation is temporarily suspended. We\'re working on improvements — stay tuned!', { duration: 5000 });
                          }}
                        >
                          <span className="flex items-center opacity-50">
                            <motion.span whileHover={{ scale: 1.25 }} className="text-purple-500">
                              <Image className="h-5 w-5 mr-2" />
                            </motion.span>
                            Generate AI Image
                            <span className="ml-2 text-[10px] text-amber-500 font-medium">(Suspended)</span>
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
                    className="min-h-[56px] max-h-32 min-w-0 flex-1 resize-none overflow-y-auto modern-scrollbar rounded-xl bg-background px-3 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400 transition-colors duration-300 font-claude sm:min-h-[82px] sm:max-h-40 sm:px-4 md:text-lg"
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
              onSelectionChange={handleSourceSelectionChange}
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
          <Dialog open={showSourcePicker} onOpenChange={setShowSourcePicker}>
            <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden border-border bg-background p-0 text-foreground dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100 sm:max-w-xl">
              <DialogHeader className="border-b border-border px-5 py-5 dark:border-slate-800 sm:px-6">
                <DialogTitle className="text-lg text-foreground dark:text-gray-100">Add sources to this workspace</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
                  Choose notes, documents, or recordings to use as context in this chat.
                </DialogDescription>
              </DialogHeader>
              <div className="border-b border-border px-5 py-4 dark:border-slate-800 sm:px-6">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={sourceSearch}
                    onChange={event => setSourceSearch(event.target.value)}
                    placeholder="Search your library"
                    aria-label="Search sources"
                    className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
                  />
                </label>
                <p className="mt-3 text-xs text-muted-foreground dark:text-gray-400">{draftSourceIds.length} selected</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
                {filteredSourceItems.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <BookOpen className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground dark:text-gray-200">
                      {sourceItems.length ? 'No sources match your search' : 'Your library is empty'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground dark:text-gray-400">
                      {sourceItems.length
                        ? 'Try a different title or source type.'
                        : 'Create or upload a note, document, or recording first.'}
                    </p>
                    {!sourceItems.length && (
                      <div className="mt-4 flex justify-center gap-2">
                        {[
                          { label: 'Documents', tab: 'documents' },
                          { label: 'Notes', tab: 'notes' },
                          { label: 'Recordings', tab: 'recordings' },
                        ].map(item => (
                          <Button key={item.tab} type="button" variant="outline" size="sm" onClick={() => { setShowSourcePicker(false); onNavigateToTab(item.tab); }} className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white">
                            {item.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : filteredSourceItems.map(source => {
                  const Icon = source.icon;
                  const selected = draftSourceIds.includes(source.id);
                  return (
                    <button
                      key={`${source.kind}-${source.id}`}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleDraftSource(source.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-muted dark:hover:bg-gray-800'}`}
                    >
                      <span className={`rounded-lg p-2 ${selected ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-muted text-muted-foreground dark:bg-gray-800 dark:text-gray-400'}`}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground dark:text-gray-100">{source.title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground dark:text-gray-400">{source.kind} · {source.detail}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-blue-400" />}
                    </button>
                  );
                })}
              </div>
              <DialogFooter className="border-t border-border px-5 py-4 dark:border-slate-800 sm:px-6">
                <Button type="button" variant="ghost" onClick={() => setShowSourcePicker(false)} className="text-muted-foreground hover:bg-muted hover:text-foreground dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white">Cancel</Button>
                <Button type="button" onClick={attachDraftSources} className="rounded-full bg-blue-600 text-white hover:bg-blue-700">Attach {draftSourceIds.length ? `${draftSourceIds.length} source${draftSourceIds.length === 1 ? '' : 's'}` : 'sources'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {!isDiagramPanelOpen && <aside className={`m-2 hidden shrink-0 flex-col rounded-2xl bg-white p-3 text-foreground shadow-sm transition-[width] duration-200 dark:bg-slate-900 dark:text-gray-200 dark:shadow-none xl:flex ${isStudioPanelOpen ? 'w-[250px]' : 'w-14'}`}>
          <div className={`flex items-center ${isStudioPanelOpen ? 'justify-between' : 'justify-center'}`}>
            {isStudioPanelOpen && <h2 className="text-sm font-semibold">Studio</h2>}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsStudioPanelOpen(open => !open)}
                    className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={isStudioPanelOpen ? 'Hide Studio panel' : 'Show Studio panel'}
                    aria-expanded={isStudioPanelOpen}
                  >
                    {isStudioPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="border-border bg-popover text-popover-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {isStudioPanelOpen ? 'Hide Studio' : 'Show Studio'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {isStudioPanelOpen && <>
          <p className="mt-1 text-xs leading-5 text-muted-foreground dark:text-gray-400">Create study materials using the sources attached to this workspace.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {studioTools.map(({ label, action, prompt, icon: Icon }) => (
              <button key={action} type="button" onClick={() => runStudioAction(action, prompt)} className="flex min-h-[64px] flex-col items-start justify-between rounded-xl border border-border bg-muted p-3 text-left text-xs font-medium text-foreground transition hover:bg-muted/80 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <Icon className="h-4 w-4 text-blue-400" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/70">
            <Sparkles className="mb-3 h-5 w-5 text-blue-400" />
            <p className="text-sm font-medium">Made for this workspace</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground dark:text-gray-400">Generated results are added to the conversation.</p>
          </div>
          </>}
          {!isStudioPanelOpen && (
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pt-2">
              {studioTools.map(({ label, action, prompt, icon: Icon }) => (
                <TooltipProvider key={action} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => runStudioAction(action, prompt)}
                        aria-label={label}
                        className="flex h-9 w-full items-center justify-center rounded-lg text-blue-600 transition hover:bg-muted hover:text-blue-700 dark:text-blue-400 dark:hover:bg-gray-800 dark:hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="border-border bg-popover text-popover-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">{label}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}
        </aside>}

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
    && prevProps.recordings === nextProps.recordings
    && prevProps.notes === nextProps.notes
    && prevProps.chatSessionTitle === nextProps.chatSessionTitle
    && prevProps.onNavigateToTab === nextProps.onNavigateToTab
  );
};

export default React.memo(AIChat, arePropsEqual);
