import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, FileText, XCircle, BookOpen, StickyNote, Camera, Paperclip, Image, Mic, ChevronDown, File, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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
import { throttle } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionResultEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
}

interface AttachedFile {
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
  onLoadMoreDocuments: () => void; // Add this prop
  hasMoreDocuments: boolean; // Add this prop
  isLoadingDocuments: boolean; // Add this prop
}

const getFileType = (file: File): 'image' | 'document' | 'other' => {
  const imageTypes = [
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    'image/tiff',
    'image/tif',
    'image/ico',
    'image/heic',
    'image/heif',
  ];
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript'
  ];

  if (imageTypes.includes(file.type)) {
    return 'image';
  } else if (documentTypes.includes(file.type)) {
    return 'document';
  } else {
    return 'other';
  }
};

const getFileIcon = (file: File) => {
  const type = getFileType(file);
  switch (type) {
    case 'image':
      return <Image className="h-4 w-4" />;
    case 'document':
      return <FileText className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const validateFile = (file: File): { isValid: boolean; error?: string } => {
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 25MB limit. Please choose a smaller file.`
    };
  }

  const problematicExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

  if (problematicExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: 'This file type is not supported for security reasons.'
    };
  }

  return { isValid: true };
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

}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activeDiagram, setActiveDiagram] = useState<{ content?: string; type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text' | 'html' | 'slides'; language?: string; imageUrl?: string } | null>(null);
  const isDiagramPanelOpen = !!activeDiagram;
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [mergedDocuments, setMergedDocuments] = useState<Document[]>(documents);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const speechSynthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastSpokenChunkRef = useRef<string>('');
  const blockAutoSpeakRef = useRef<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastInterimTranscriptRef = useRef<string>('');
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const storedWidth = localStorage.getItem('diagramPanelWidth');
    return storedWidth ? parseFloat(storedWidth) : 65;
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isUpdatingDocuments, setIsUpdatingDocuments] = useState(false);
  const prevSessionIdRef = useRef<string | null>(null);
  const [autoTypeInPanel, setAutoTypeInPanel] = useState(false);
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const generateOptimisticId = () => `optimistic-ai-${uuidv4()}`;
  const [isAiTyping, setIsAiTyping] = useState(false);
  // **New State Variables for Drag and Drop:**
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // **New State Variable:**
  const [isLastAiMessageDisplayed, setIsLastAiMessageDisplayed] = useState(true);

  // NEW: State to track if a message is currently being sent
  const [isCurrentlySending, setIsCurrentlySending] = useState(false);

  // Throttled textarea resize
  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);


  // const throttledResizeTextarea = useCallback(throttle(() => {
  //   if (textareaRef.current) {
  //     textareaRef.current.style.height = 'auto';
  //     textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  //   }
  // }, 100), []); // Adjust the interval as needed
  // useEffect(() => {
  //   throttledResizeTextarea();
  // }, [inputMessage, throttledResizeTextarea]);

  // **Drag and Drop Event Handlers:**
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);

    if (e.dataTransfer?.items) {
      const hasFiles = Array.from(e.dataTransfer.items).some(item => item.kind === 'file');
      if (hasFiles) {
        setIsDragging(true);
      }
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    if (!e.dataTransfer?.files) return;

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  // **Process files function (extracted for reuse):**
  const processFiles = useCallback((files: File[]) => {
    files.forEach(file => {
      const validation = validateFile(file);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }

      const fileId = generateId();
      const fileType = getFileType(file);
      const attachedFile: AttachedFile = {
        file,
        type: fileType,
        id: fileId
      };

      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onloadend = () => {
          attachedFile.preview = reader.result as string;
          setAttachedFiles(prev => [...prev, attachedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachedFiles(prev => [...prev, attachedFile]);
      }
    });
  }, []);

  // **Set up drag and drop event listeners:**
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      dropZone.removeEventListener('dragenter', handleDragEnter);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAiTyping(true);
    // Prevent multiple sends
    if (isCurrentlySending) {
      //console.log('[AiChat] Already sending, preventing duplicate send');
      return;
    }

    // Check if there are any optimistic messages still pending
    const hasPendingOptimistic = messages.some(msg => msg.id.startsWith('optimistic-'));
    if (hasPendingOptimistic) {
      //console.log('[AiChat] Waiting for previous message to complete');
      toast.info('Please wait for the previous message to complete');
      return;
    }

    setIsCurrentlySending(true);
    setIsLoading(true);

    if (!inputMessage.trim() && attachedFiles.length === 0 && selectedDocumentIds.length === 0) {
      toast.error('Please enter a message, attach files, or select documents/notes.');
      setIsLoading(false);
      setIsCurrentlySending(false);
      return;
    }

    try {
      const userId = userProfile?.id;
      if (!userId) {
        toast.error("User ID is missing. Please ensure you are logged in.");
        setIsLoading(false);
        setIsCurrentlySending(false); // Clear sending flag
        return;
      }

      if (activeChatSessionId) {
        await supabase
          .from('chat_sessions')
          .update({ document_ids: selectedDocumentIds })
          .eq('id', activeChatSessionId)
          .eq('user_id', userId);
      }

      const documentIds = selectedDocumentIds.filter(id => documents.some(doc => doc.id === id));
      const noteIds = selectedDocumentIds.filter(id => notes.some(note => note.id === id));

      const filesForBackend = await Promise.all(
        attachedFiles.map(async (attachedFile) => {
          const fileType = getFileType(attachedFile.file);
          let data: string | null = null;
          let content: string | null = null;

          try {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('Failed to read file'));
              reader.readAsDataURL(attachedFile.file);
            });

            const base64Result = await base64Promise;
            data = base64Result.split(',')[1];

            if (fileType === 'document' || attachedFile.file.type.startsWith('text/')) {
              try {
                const textReader = new FileReader();
                const textPromise = new Promise<string>((resolve, reject) => {
                  textReader.onloadend = () => resolve(textReader.result as string);
                  textReader.onerror = () => reject(new Error('Failed to read text content'));
                  textReader.readAsText(attachedFile.file);
                });
                content = await textPromise;
              } catch (textError) {
                console.warn('Could not extract text content from file:', textError);
              }
            }
          } catch (error) {
            console.error('Error processing file:', attachedFile.file.name, error);
            toast.error(`Failed to process file: ${attachedFile.file.name}`);
            throw error;
          }

          return {
            name: attachedFile.file.name,
            mimeType: attachedFile.file.type,
            data,
            type: fileType,
            size: attachedFile.file.size,
            content,
            processing_status: 'pending',
            processing_error: null,
          };
        })
      );

      const optimisticAiMessageId = generateOptimisticId();
      const optimisticAiMessage: Message = {
        id: optimisticAiMessageId,
        content: 'Generating response...',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        isError: false,
        attachedDocumentIds: [],
        attachedNoteIds: [],
        session_id: activeChatSessionId,
        has_been_displayed: false,
      };

      onSendMessageToBackend(inputMessage.trim(), documentIds, noteIds, filesForBackend);


      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';


      // **Disable the send button after sending the message:**
      setIsLastAiMessageDisplayed(false);
      setInputMessage('');
      setAttachedFiles([]);
      setExpandedMessages(new Set());
    } catch (error: any) {
      console.error("Error sending message:", error);
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
      }
      else if (error.message.includes('Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details')) {
        errorMessage = 'Resource exhausted: The service is currently overloaded. Please try again later.';
      }
      toast.error(`Error: ${errorMessage}`);
      setInputMessage('');
      setAttachedFiles([]);
      setExpandedMessages(new Set());
      setIsCurrentlySending(false);
      setIsAiTyping(false);
      isSubmittingUserMessage = false;

    } finally {
      setIsLoading(false);
      setIsCurrentlySending(false); // Always clear the sending flag
    }
  }, [inputMessage, attachedFiles, userProfile?.id, activeChatSessionId, selectedDocumentIds, onSendMessageToBackend, isCurrentlySending]);

  const isPhone = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /mobile|android|iphone|ipad|tablet/i.test(userAgent) && window.innerWidth <= 768;
  }, []);

  const handleMarkMessageDisplayed = useCallback(async (messageId: string) => {
    if (!userProfile?.id || !activeChatSessionId) {
      console.warn("User or session ID missing, cannot mark message as displayed.");
      return;
    }

    // Skip marking optimistic messages as displayed
    if (messageId.startsWith('optimistic-')) {
      //console.log('[AiChat] Skipping display marking for optimistic message:', messageId);
      return;
    }

    console.log('[AiChat] Marking message as displayed:', messageId);

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ has_been_displayed: true })
        .eq('id', messageId)
        .eq('session_id', activeChatSessionId)
        .eq('user_id', userProfile.id);

      if (error) {
        console.error('Error marking message as displayed:', error);
        // Don't show toast for this error - it's not critical for UX
        return;
      }

      //console.log('[AiChat] Successfully marked message as displayed:', messageId);

      // Update local state
      onMessageUpdate({
        ...messages.find(msg => msg.id === messageId)!,
        has_been_displayed: true
      });

      // **Check if the message is the last AI message and enable the send button:**
      if (messages.length > 0 &&
        messages[messages.length - 1].id === messageId &&
        messages[messages.length - 1].role === 'assistant') {
        setIsLastAiMessageDisplayed(true);
      }
      setMergedDocuments(mergedDocuments => {
        return mergedDocuments.map(doc => {
          if (selectedDocumentIds.includes(doc.id)) {
            return { ...doc, last_used_at: new Date().toISOString() };
          }
          return doc;
        })
      })
      setExpandedMessages(new Set());
      setIsLoading(false);
      isSubmittingUserMessage = false;
      setIsAiTyping(false);
      setAttachedFiles([]);
      setInputMessage('');
    } catch (error) {
      console.error('Unexpected error marking message as displayed:', error);
      // Don't show toast - not critical for UX
    }
  }, [userProfile?.id, activeChatSessionId, messages, onMessageUpdate]);


  const handleBlockDetected = useCallback((blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => {
    if (autoTypeInPanel && isFirstBlock) {
      setActiveDiagram(prev => {
        if (prev && prev.type === blockType && prev.content === content && prev.language === language) {
          return prev;
        }
        return { type: blockType, content, language };
      });
    }
  }, [autoTypeInPanel]);

  const handleBlockUpdate = useCallback((blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => {
    if (autoTypeInPanel && isFirstBlock) {
      setActiveDiagram(prev => {
        if (prev && prev.type === blockType && prev.content === content && prev.language === language) {
          return prev;
        }
        return { type: blockType, content, language };
      });
    }
  }, [autoTypeInPanel]);

  const handleBlockEnd = useCallback((blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => {
    if (autoTypeInPanel && isFirstBlock) {
    }
  }, [autoTypeInPanel]);

  const handleViewContent = useCallback((type, content, language, imageUrl) => {
    setActiveDiagram(null);
    setTimeout(() => {
      setActiveDiagram({ type, content, language, imageUrl });
    }, 0);
  }, []);

  const memoizedOnMermaidError = useCallback((code: string | null, errorType: 'syntax' | 'rendering' | 'timeout' | 'network') => {
    console.error("Mermaid error in DiagramPanel:", code, errorType);
    toast.error(`Mermaid rendering issue: ${errorType}${code ? ` - Code: ${code.substring(0, 50)}...` : ''}`);
  }, []);

  const memoizedOnSuggestAiCorrection = useCallback((prompt: string) => {
    setInputMessage(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    toast.info("AI correction prepared in input. Review and send to apply.");
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      console.warn("Notification API not supported in this browser.");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, []);

  const showNotification = useCallback((title: string, options: NotificationOptions) => {
    if (Notification.permission === "granted") {
      new Notification(title, options);
    }
  }, []);

  const [micPermissionStatus, setMicPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'checking'>('unknown');

  const checkMicrophonePermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return permissionStatus.state as 'granted' | 'denied' | 'prompt';
      }
      return 'unknown';
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return 'unknown';
    }
  }, []);

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    const currentStatus = await checkMicrophonePermission();
    if (currentStatus === 'granted') {
      setMicPermissionStatus('granted');
      return true;
    }

    setMicPermissionStatus('checking');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionStatus('granted');

      if (currentStatus === 'prompt' || currentStatus === 'unknown') {
        showNotification("Microphone Access Granted", {
          body: "You can now use speech recognition.",
          icon: "/microphone-icon.png",
        });
      }

      return true;
    } catch (error: any) {
      console.error('Error requesting microphone permission:', error);
      setMicPermissionStatus('denied');
      toast.error(`Failed to access microphone: ${error.message || 'Unknown error'}`);
      return false;
    }
  }, [showNotification, checkMicrophonePermission]);

  const throttledSetSpeechInput = useCallback(
    throttle((newMessage: string) => {
      setInputMessage(newMessage);
      resizeTextarea();
    }, 200),
    [resizeTextarea]
  );

  useEffect(() => {
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    recognitionRef.current = new SpeechRecognitionConstructor() as SpeechRecognition;
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';
    (recognitionRef.current as any).maxAlternatives = 1;

    recognitionRef.current.onresult = (event: SpeechRecognitionResultEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript = transcript;
        }
      }

      const baseMessage = inputMessage.replace(lastInterimTranscriptRef.current, '').trim();
      if (finalTranscript) {
        const newMessage = baseMessage + (baseMessage ? ' ' : '') + finalTranscript.trim();
        lastInterimTranscriptRef.current = '';
        setInputMessage(newMessage);
        resizeTextarea();
      } else if (interimTranscript) {
        const newMessage = baseMessage + (baseMessage ? ' ' : '') + interimTranscript;
        lastInterimTranscriptRef.current = interimTranscript;
        throttledSetSpeechInput(newMessage);
      }
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);
      setIsRecognizing(false);
      toast.error(`Speech recognition failed: ${event.error}`);
    };

    recognitionRef.current.onend = () => {
      setIsRecognizing(false);
      lastInterimTranscriptRef.current = '';
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [inputMessage, throttledSetSpeechInput, resizeTextarea]);

  useEffect(() => {
    checkMicrophonePermission().then(status => {
      setMicPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
    });
  }, [checkMicrophonePermission]);

  const startRecognition = useCallback(async () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecognizing) return;

    if (micPermissionStatus !== 'granted') {
      const hasNotificationPermission = await requestNotificationPermission();
      if (!hasNotificationPermission) {
        console.warn("Notification permission not granted, proceeding without notifications.");
      }

      const hasMicrophonePermission = await requestMicrophonePermission();
      if (!hasMicrophonePermission) {
        setIsRecognizing(false);
        return;
      }
    }

    try {
      lastInterimTranscriptRef.current = '';
      recognitionRef.current.start();
      setIsRecognizing(true);
      toast.info('Listening... Click the mic button again to stop.');
    } catch (error: any) {
      console.error('Error starting speech recognition:', error);
      toast.error(`Failed to start speech recognition: ${error.message || 'Unknown error'}`);
      setIsRecognizing(false);
    }
  }, [isRecognizing, micPermissionStatus, requestMicrophonePermission, requestNotificationPermission]);

  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isRecognizing) {
      recognitionRef.current.stop();
      setIsRecognizing(false);
      lastInterimTranscriptRef.current = '';
      toast.success('Speech recognition stopped.');
    }
  }, [isRecognizing]);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScroll = useCallback(async () => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;
    const { scrollTop } = chatContainer;

    const scrollThreshold = 100; // Adjust as needed
    if (scrollTop <= scrollThreshold && hasMoreMessages && !isLoadingOlderMessages && !isLoading && !isLoadingSessionMessages) {
      setIsLoadingOlderMessages(true);
      try {
        const oldScrollHeight = chatContainer.scrollHeight;
        await onLoadOlderMessages();

        // Wait for the new messages to render
        setTimeout(() => {
          if (chatContainerRef.current) {
            const newScrollHeight = chatContainerRef.current.scrollHeight;
            // Restore the scroll position to maintain the user's view
            chatContainerRef.current.scrollTop = newScrollHeight - oldScrollHeight;
          }
          setIsLoadingOlderMessages(false);
        }, 0);
      } catch (error) {
        console.error("Error loading older messages:", error);
        toast.error("Failed to load older messages.");
        setIsLoadingOlderMessages(false);
      }
    }
  }, [hasMoreMessages, isLoadingOlderMessages, isLoading, onLoadOlderMessages, isLoadingSessionMessages]);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
      return () => {
        chatContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);
  useEffect(() => {
    // This effect will run whenever attachedFiles, selectedDocumentIds, or mergedDocuments change
    // console.log('Context changed, re-rendering badges');
    // No need to explicitly set state here, just ensure a re-render is triggered
    }, [attachedFiles, selectedDocumentIds, mergedDocuments]);
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const isSessionChange = prevSessionIdRef.current !== activeChatSessionId;
    if (isSessionChange) {
      if (!isLoadingSessionMessages && messages.length > 0) {
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
          prevSessionIdRef.current = activeChatSessionId;
        }, 0);
      }
      setInputMessage('');
      setAttachedFiles([]);
      setExpandedMessages(new Set());
      setIsCurrentlySending(false);
      setIsAiTyping(false);
      isSubmittingUserMessage = false;
      scrollToBottom('auto');
    }
    // else {
    //   const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    //   const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;
    //   if (isNearBottom) {
    //     scrollToBottom('smooth');
    //   }
    // }
  }, [messages, isLoadingSessionMessages, activeChatSessionId, scrollToBottom]);

  const stripCodeBlocks = useCallback((content: string): string => {
    let cleanedContent = content;
    cleanedContent = cleanedContent.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
    cleanedContent = cleanedContent.replace(/`[^`]+`/g, '');
    cleanedContent = cleanedContent.replace(/(\*\*\*|\*\*|\*|_|==)/g, '');
    cleanedContent = cleanedContent.replace(/(\n|^)(\*\*\*|---+)\s*\n/g, '');
    cleanedContent = cleanedContent.replace(/\n\s*\n/g, '\n').replace(/\s+/g, ' ').trim();
    return cleanedContent;
  }, []);
  // useEffect(() => {
  //   //console.log('[AiChat] documents prop updated, syncing mergedDocuments', documents.length);
  //   setMergedDocuments(mergedDocuments);
  // }, [mergedDocuments]);
  useEffect(() => {
    if (
      !isPhone() ||
      isLoading ||
      isLoadingSessionMessages ||
      !speechSynthesisRef.current ||
      blockAutoSpeakRef.current ||
      !messages.length
    ) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === 'assistant' &&
      !lastMessage.isError &&
      lastMessage.id !== lastProcessedMessageIdRef.current &&
      !isSpeaking &&
      !isPaused
    ) {
      const cleanedContent = stripCodeBlocks(lastMessage.content);
      if (cleanedContent) {
        const utterance = new SpeechSynthesisUtterance(cleanedContent);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setIsPaused(false);
          currentUtteranceRef.current = null;
          lastSpokenChunkRef.current = '';
          lastProcessedMessageIdRef.current = lastMessage.id;
          blockAutoSpeakRef.current = true;
        };

        utterance.onerror = (event) => {
          if (event.error === 'interrupted') return;
          console.error('Speech synthesis error:', event.error);
          toast.error(`Speech synthesis failed: ${event.error}`);
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setIsPaused(false);
          currentUtteranceRef.current = null;
          lastSpokenChunkRef.current = '';
          lastProcessedMessageIdRef.current = lastMessage.id;
          blockAutoSpeakRef.current = true;
        };

        speechSynthesisRef.current.cancel();
        currentUtteranceRef.current = utterance;
        speechSynthesisRef.current.speak(utterance);
        setIsSpeaking(true);
        setSpeakingMessageId(lastMessage.id);
        lastSpokenChunkRef.current = cleanedContent;
        lastProcessedMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages, isLoading, isLoadingSessionMessages, isPhone, isSpeaking, isPaused, stripCodeBlocks]);

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
      const newSet = new Set(prev);
      if (newSet.has(messageContent)) {
        newSet.delete(messageContent);
      } else {
        newSet.add(messageContent);
      }
      return newSet;
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

  const handleRemoveAllFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);


  // In handleDocumentUpdatedLocally:
  const handleDocumentUpdatedLocally = useCallback((updatedDoc: Document) => {
    setMergedDocuments(prevDocs => {
      const existingIndex = prevDocs.findIndex(doc => doc.id === updatedDoc.id);
      if (existingIndex > -1) {
        const newDocs = [...prevDocs];
        newDocs[existingIndex] = updatedDoc;
        return newDocs;
      } else {
        return [...prevDocs, updatedDoc];
      }
    });
    onDocumentUpdated(updatedDoc);
  }, [onDocumentUpdated]);

  const stopSpeech = useCallback(() => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setIsPaused(false);
      currentUtteranceRef.current = null;
      lastSpokenChunkRef.current = '';
      blockAutoSpeakRef.current = true;
    }
  }, []);

  const pauseSpeech = useCallback(() => {
    if (speechSynthesisRef.current && isSpeaking && !isPaused) {
      speechSynthesisRef.current.pause();
      setIsPaused(true);
    }
  }, [isSpeaking, isPaused]);

  const resumeSpeech = useCallback(() => {
    if (speechSynthesisRef.current && isSpeaking && isPaused) {
      speechSynthesisRef.current.resume();
      setIsPaused(false);
    }
  }, [isSpeaking, isPaused]);

  const speakMessage = useCallback((messageId: string, content: string) => {
    if (!speechSynthesisRef.current) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }

    stopSpeech();

    const cleanedContent = stripCodeBlocks(content);
    if (!cleanedContent) {
      toast.info('No readable text found after sanitization.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanedContent);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setIsPaused(false);
      currentUtteranceRef.current = null;
      lastSpokenChunkRef.current = '';
      lastProcessedMessageIdRef.current = messageId;
      blockAutoSpeakRef.current = true;
    };

    utterance.onerror = (event) => {
      if (event.error === 'interrupted') return;
      console.error('Speech synthesis error:', event.error);
      toast.error(`Speech synthesis failed: ${event.error}`);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setIsPaused(false);
      currentUtteranceRef.current = null;
      lastSpokenChunkRef.current = '';
      lastProcessedMessageIdRef.current = messageId;
      blockAutoSpeakRef.current = true;
    };

    speechSynthesisRef.current.cancel();
    currentUtteranceRef.current = utterance;
    speechSynthesisRef.current.speak(utterance);
    setIsSpeaking(true);
    setSpeakingMessageId(messageId);
    setIsPaused(false);
    lastSpokenChunkRef.current = cleanedContent;
    lastProcessedMessageIdRef.current = messageId;
  }, [stopSpeech, stripCodeBlocks]);

  useEffect(() => {
    return () => {
      stopSpeech();
      stopRecognition();
    };
  }, [stopSpeech, stopRecognition]);

  useEffect(() => {
    if (activeChatSessionId !== null) {
      stopSpeech();
      setInputMessage('');
      setAttachedFiles([]);
      setActiveDiagram(null);
      setIsFullScreen(false);
      setExpandedMessages(new Set());
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }, [activeChatSessionId, stopSpeech]);

  const selectedDocumentTitles = useMemo(() => {
    return mergedDocuments
      .filter(doc => selectedDocumentIds.includes(doc.id) && doc.type === 'text')
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

  const contextBadges = useMemo(() => (
    <div className="mb-3 p-3 bg-slate-100 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2 dark:bg-gray-800 dark:border-gray-700">
      <span className="text-base md:text-lg font-medium text-slate-700 dark:text-gray-200 font-claude">Context:</span>
      {attachedFiles.length > 0 && (
        <Badge
          variant="secondary"
          className="bg-orange-500/20 text-orange-800 border-orange-400 flex items-center gap-1 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700 text-sm md:text-base font-sans"
        >
          <Paperclip className="h-3 w-3" />
          {attachedFiles.length} File{attachedFiles.length > 1 ? 's' : ''}
          <XCircle
            className="h-3 w-3 ml-1 cursor-pointer text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
            onClick={handleRemoveAllFiles}
          />
        </Badge>
      )}
      {selectedImageDocuments.length > 0 && (
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-800 border-blue-400 flex items-center gap-1 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700 text-sm md:text-base font-sans">
          <Image className="h-3 w-3" /> {selectedImageDocuments.length} Image Doc{selectedImageDocuments.length > 1 ? 's' : ''}
          <XCircle className="h-3 w-3 ml-1 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !selectedImageDocuments.map(imgDoc => imgDoc.id).includes(id)))} />
        </Badge>
      )}
      {selectedDocumentTitles.length > 0 && (
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-800 border-blue-400 flex items-center gap-1 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700 text-sm md:text-base font-sans">
          <BookOpen className="h-3 w-3 mr-1" /> {selectedDocumentTitles.length} Text Doc{selectedDocumentTitles.length > 1 ? 's' : ''}
          <XCircle className="h-3 w-3 ml-1 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !documents.filter(doc => doc.type === 'text').map(d => d.id).includes(id)))} />
        </Badge>
      )}
      {selectedNoteTitles.length > 0 && (
        <Badge variant="secondary" className="bg-green-500/20 text-green-800 border-green-400 flex items-center gap-1 dark:bg-green-950 dark:text-green-300 dark:border-green-700 text-sm md:text-base font-sans">
          <StickyNote className="h-3 w-3 mr-1" /> {selectedNoteTitles.length} Note{selectedNoteTitles.length > 1 ? 's' : ''}
          <XCircle className="h-3 w-3 ml-1 cursor-pointer text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !notes.map(n => n.id).includes(id)))} />
        </Badge>
      )}
    </div>
  ), [attachedFiles, selectedImageDocuments, selectedDocumentTitles, selectedNoteTitles, handleRemoveAllFiles, onSelectionChange, documents, notes, selectedDocumentIds]);

  // const displayMessages = useMemo(() => messages, [messages]);

  function handleDiagramCodeUpdate(messageId: string, newCode: string): Promise<void> {
    toast.info('Diagram code updated. You can regenerate the response to see changes.');
    return Promise.resolve();
  }

  return (
    <>
      <div
        ref={dropZoneRef}
        className={`flex flex-col h-[93vh] border-none relative justify-center bg-transparent dark:bg-transparent overflow-hidden md:flex-row md:gap-0 font-sans ${isDragging ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
      >
        {/* **Drag and Drop Overlay:** */}
        {isDragging && (
          <div className="fixed inset-0 bg-blue-500/20 dark:bg-blue-500/30 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border-2 border-dashed border-blue-500 shadow-lg">
              <div className="flex flex-col items-center gap-4">
                <Upload className="h-16 w-16 text-blue-500" />
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Drop files here to attach
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Images, documents, and other files are supported
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <motion.div className={`relative flex flex-col h-full rounded-lg panel-transition
  ${isDiagramPanelOpen
            ? (isPhone()
              ? 'hidden'
              : `md:w-[calc(100% - ${panelWidth}%)] flex-shrink-0`)
            : 'w-full flex-1'
          } bg-transparent dark:bg-transparent`}
          initial={{ width: '100%' }}
          animate={{
            width: isDiagramPanelOpen
              ? (isPhone() ? '0%' : `calc(100% - ${panelWidth}%)`)
              : '100%'
          }}
          transition={{ duration: 0.1, ease: 'easeInOut' }}
        >
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 dark:bg-transparent flex flex-col modern-scrollbar pb-36 md:pb-6">
            {messages.length === 0 && !isLoading && !isLoadingSessionMessages && !isLoadingOlderMessages && !isSubmittingUserMessage && (
              <div className="text-center py-8 flex-grow flex flex-col justify-center items-center text-slate-400 dark:text-gray-500">
                <BookPagesAnimation size="xl" showText={false} className="mb-6" />
                <h3 className="text-lg md:text-2xl font-medium text-slate-700 mb-2 dark:text-gray-200 font-claude">Welcome to your AI Study Assistant!</h3>
                <p className="text-base md:text-lg text-slate-500 max-w-md mx-auto dark:text-gray-400 font-claude leading-relaxed">
                  I can help with questions about your notes, create study guides, explain concepts, and assist with academic work. Select documents and start chatting, use the microphone, or drag and drop files!
                </p>
              </div>
            )}
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
              onViewContent={handleViewContent}
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
              onBlockDetected={handleBlockDetected}
              onBlockUpdate={handleBlockUpdate}
              onBlockEnd={handleBlockEnd}
              onDiagramCodeUpdate={handleDiagramCodeUpdate}
            />
            {isGeneratingImage && (
              <div className="flex justify-center font-sans">
                <div className="w-full max-w-4xl flex gap-3 items-center justify-start">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-pink-500 to-red-500 flex items-center justify-center">
                    <img src="https://placehold.co/64x64/FF69B4/FFFFFF/png?text=AI" alt="Loading..." className="w-16 h-16 animate-spin" />
                  </div>
                  <div className="w-fit p-3 rounded-lg bg-white shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex gap-1">
                      <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                      <span className="text-base md:text-lg text-slate-500 dark:text-gray-400">Generating image...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={`fixed bottom-0 left-0 right-0 sm:pb-8 md:shadow-none md:static rounded-t-lg md:rounded-lg bg-transparent dark:bg-transparent dark:border-gray-700 font-sans z-10
${isDiagramPanelOpen
              ? (isPhone() ? 'hidden' : `md:pr-[calc(${panelWidth}%+1.5rem)]`)
              : ''
            }`}>
            <div className="w-full max-w-4xl mx-auto dark:bg-gray-800 border border-slate-200 bg-white rounded-lg shadow-md dark:border-gray-700 p-2">
              {isRecognizing && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 dark:bg-red-900/20 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                    <Mic className="h-4 w-4 text-red-600 dark:text-red-300 animate-pulse" />
                    <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                      Listening... Click mic button to stop
                    </span>
                  </div>
                </div>
              )}
              {(attachedFiles.length > 0 || selectedDocumentIds.length > 0) && contextBadges}
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => {
                  e.preventDefault();
                  setInputMessage(e.target.value);
                  // throttledResizeTextarea();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="What do you want to know? (You can also drag and drop files here)"
                className="w-full overflow-y-scroll modern-scrollbar text-base md:text-lg focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[48px] bg-gray-700 placeholder-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-400 bg-white text-gray-800 placeholder-gray-600 px-3 py-2 rounded-sm transition-colors duration-300 font-claude"
                disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping} // Added isAiTyping
                rows={1}
              />
              <div className="flex items-center gap-2 mt-2 justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={isRecognizing ? stopRecognition : startRecognition}
                    className={`h-10 w-10 flex-shrink-0 rounded-lg p-0 relative transition-all duration-200 ${isRecognizing
                      ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 scale-105'
                      : micPermissionStatus === 'denied'
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    title={
                      isRecognizing
                        ? 'Stop Speech Recognition'
                        : micPermissionStatus === 'denied'
                          ? 'Microphone access denied - check browser settings'
                          : micPermissionStatus === 'checking'
                            ? 'Checking microphone permissions...'
                            : 'Start Speech Recognition'
                    }
                    disabled={
                      isLoading ||
                      isSubmittingUserMessage ||
                      isGeneratingImage ||
                      isUpdatingDocuments ||
                      !recognitionRef.current ||
                      micPermissionStatus === 'checking' ||
                      isAiTyping
                    }
                  >
                    <Mic className={`h-5 w-5 ${isRecognizing ? 'animate-pulse' : ''}`} />
                    {isRecognizing && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse">
                        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
                      </div>
                    )}
                    {micPermissionStatus === 'checking' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => cameraInputRef.current?.click()}
                    className="text-gray-400 dark:text-gray-400 text-gray-600 hover:bg-gray-600 dark:hover:bg-gray-600 hover:bg-gray-300 h-10 w-10 flex-shrink-0 rounded-lg p-0"
                    title="Take Picture"
                    disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
                  <input
                    type="file"
                    accept="*/*"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-400 dark:text-gray-400 text-gray-600 hover:bg-gray-600 dark:hover:bg-gray-600 hover:bg-gray-300 h-10 w-10 flex-shrink-0 rounded-lg p-0"
                    title="Upload Files"
                    disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDocumentSelector(true)}
                    className="text-slate-600 hover:bg-slate-100 h-10 w-10 flex-shrink-0 rounded-lg p-0 dark:text-gray-300 dark:hover:bg-gray-700"
                    title="Select Documents/Notes for Context"
                    disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}
                  >
                    {isUpdatingDocuments ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                  </Button>
                  <Button
                    onClick={() => setAutoTypeInPanel(prev => !prev)}
                    variant="outline"
                    className="text-sm text-gray-400 dark:text-gray-400 bg-transparent text-gray-600 hover:bg-gray-600 dark:hover:bg-gray-600 hover:bg-gray-300 flex-shrink-0"
                    title="Toggle code typing in panel"
                  >
                    {autoTypeInPanel ? 'Panel On' : 'Panel Off'}
                  </Button>
                </div>
                <Button
                  type="submit"
                  onClick={handleSendMessage}
                  disabled={
                    isLoading ||
                    isSubmittingUserMessage ||
                    isGeneratingImage ||
                    isUpdatingDocuments ||
                    (!inputMessage.trim() && attachedFiles.length === 0 && selectedDocumentIds.length === 0) ||
                    !isLastAiMessageDisplayed ||
                    isCurrentlySending ||
                    isAiTyping || // Added isAiTyping
                    messages.some(msg => msg.id.startsWith('optimistic-'))
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md h-10 w-10 flex-shrink-0 rounded-lg p-0"
                  title={
                    isAiTyping
                      ? 'AI is typing...'
                      : messages.some(msg => msg.id.startsWith('optimistic-'))
                        ? 'Waiting for response...'
                        : 'Send Message'
                  }
                >
                  {isSubmittingUserMessage || isCurrentlySending || isAiTyping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
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
              onDocumentUpdated={handleDocumentUpdatedLocally}
              activeChatSessionId={activeChatSessionId}

            />
          )}
          <ConfirmationModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleConfirmDelete}
            title="Delete Message"
            message="Are you sure you want to delete this message? This action cannot be undone."
          />
        </motion.div>

        {isDiagramPanelOpen && (
          <DiagramPanel
            key={activeDiagram ? `${activeDiagram.type}-${activeDiagram.content?.substring(0, 50) || ''}-${activeDiagram.language || ''}` : 'no-diagram'}
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
          />
        )}
        {showScrollToBottomButton && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => scrollToBottom('smooth')}
            className={`fixed bottom-28 right-6 md:bottom-8 bg-white rounded-full shadow-lg p-2 z-20 transition-all duration-300 hover:scale-105 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 font-sans
${isDiagramPanelOpen ? `md:right-[calc(${panelWidth}%+1.5rem)]` : 'md:right-8'}
`}
            title="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5 text-slate-600 dark:text-gray-300" />
          </Button>
        )}
      </div>
    </>
  );
};

// Custom equality function for React.memo
const arePropsEqual = (prevProps: AIChatProps, nextProps: AIChatProps) => {
  if (prevProps.isLoading === nextProps.isLoading &&
    prevProps.isSubmittingUserMessage === nextProps.isSubmittingUserMessage &&
    prevProps.isLoadingSessionMessages === nextProps.isLoadingSessionMessages &&
    prevProps.activeChatSessionId === nextProps.activeChatSessionId &&
    prevProps.messages === nextProps.messages &&
    prevProps.selectedDocumentIds === nextProps.selectedDocumentIds &&
    prevProps.documents === nextProps.documents) {
    //console.log('AIChat props unchanged, skipping re-render');
  }
  else {
    //console.log('AIChat props changed, re-rendering');
  }
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isSubmittingUserMessage === nextProps.isSubmittingUserMessage &&
    prevProps.isLoadingSessionMessages === nextProps.isLoadingSessionMessages &&
    prevProps.activeChatSessionId === nextProps.activeChatSessionId &&
    prevProps.messages === nextProps.messages &&
    prevProps.selectedDocumentIds === nextProps.selectedDocumentIds &&
    prevProps.documents === nextProps.documents

  );
};

export default React.memo(AIChat, arePropsEqual);