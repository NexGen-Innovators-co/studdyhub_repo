import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, Loader2, FileText, XCircle, BookOpen, StickyNote, Camera, Upload, Image, Mic, ChevronDown, X, File, Paperclip } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { UserProfile, Document } from '../../../types/Document';
import { Note } from '../../../types/Note';
import { supabase } from '../../../integrations/supabase/client';
import { DocumentSelector } from '../../DocumentSelector';
import { toast } from 'sonner';
import { DiagramPanel } from './DiagramPanel';
import { generateId } from '@/utils/helpers';
import { MessageList } from '../MessageList';
import { ConfirmationModal } from '../../ConfirmationModal';
import { Message, ChatSession } from '../../../types/Class';
import BookPagesAnimation from '../../bookloader';

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
  chatSessions: ChatSession[];
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
    attachedFiles?: Array<{
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
  onDiagramCodeUpdate: (messageId: string, newCode: string) => Promise<void>; // Add this line
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
  const type = getFileType(file);

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
  onDiagramCodeUpdate
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
    // Initialize panelWidth with a default value or retrieve it from localStorage
    const storedWidth = localStorage.getItem('diagramPanelWidth');
    return storedWidth ? parseFloat(storedWidth) : 65; // Default to 65 if not in localStorage
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isUpdatingDocuments, setIsUpdatingDocuments] = useState(false);
  const prevSessionIdRef = useRef<string | null>(null);
  const [autoTypeInPanel, setAutoTypeInPanel] = useState(false);
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  const isPhone = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /mobile|android|iphone|ipad|tablet/i.test(userAgent) && window.innerWidth <= 768;
  }, []);

  const handleMarkMessageDisplayed = useCallback(async (messageId: string) => {
    if (!userProfile?.id || !activeChatSessionId) {
      console.warn("User or session ID missing, cannot mark message as displayed.");
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
        console.error('Error marking message as displayed:', error);
        toast.error(`Failed to mark message as displayed: ${error.message}`);
      } else {
        onMessageUpdate({ ...messages.find(msg => msg.id === messageId)!, has_been_displayed: true });
      }
    } catch (error) {
      console.error('Unexpected error marking message as displayed:', error);
      toast.error('An unexpected error occurred while updating message status.');
    }
  }, [userProfile, activeChatSessionId, messages, onMessageUpdate]);

  const handleBlockDetected = useCallback((blockType: 'code' | 'mermaid' | 'html', content: string, language?: string, isFirstBlock?: boolean) => {
    if (autoTypeInPanel && isFirstBlock) {
      setActiveDiagram(prev => {
        if (prev && prev.type === blockType && prev.content === content && prev.language === language) {
          return prev;
        }
        return { type: blockType, content, language };
      });
    }
  }, [autoTypeInPanel]);

  const handleBlockUpdate = useCallback((blockType: 'code' | 'mermaid' | 'html', content: string, language?: string, isFirstBlock?: boolean) => {
    if (autoTypeInPanel && isFirstBlock) {
      setActiveDiagram(prev => {
        if (prev && prev.type === blockType && prev.content === content && prev.language === language) {
          return prev;
        }
        return { type: blockType, content, language };
      });
    }
  }, [autoTypeInPanel]);

  const handleBlockEnd = useCallback((blockType: 'code' | 'mermaid' | 'html', content: string, language?: string, isFirstBlock?: boolean) => {
    if (autoTypeInPanel && isFirstBlock) {
      // Optionally keep panel open
    }
  }, [autoTypeInPanel]);

  const handleViewContent = useCallback((type, content, language, imageUrl) => {
    setActiveDiagram(null); // Clear first
    setTimeout(() => {
      setActiveDiagram({ type, content, language, imageUrl });
    }, 0); // Set on next tick
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

  // Request Notification Permission
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

  // Show Browser Notification
  const showNotification = useCallback((title: string, options: NotificationOptions) => {
    if (Notification.permission === "granted") {
      new Notification(title, options);
    }
  }, []);

  // Add permission status tracking
  const [micPermissionStatus, setMicPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'checking'>('unknown');

  // Check if microphone permission is already granted
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

  // FIXED: Improved microphone permission request with status tracking
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    // First check if permission is already granted
    const currentStatus = await checkMicrophonePermission();
    if (currentStatus === 'granted') {
      setMicPermissionStatus('granted');
      return true;
    }

    setMicPermissionStatus('checking');

    try {
      // Request media stream - this will prompt for permission if needed
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // If successful, stop all tracks immediately (we just needed permission)
      stream.getTracks().forEach(track => track.stop());

      setMicPermissionStatus('granted');

      // Show success notification only for first-time grants
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

      // Handle different types of permission errors
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access was denied. Please click the microphone icon in your browser address bar to allow access, then try again.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please check that a microphone is connected to your device.');
      } else if (error.name === 'NotReadableError') {
        toast.error('Microphone is already in use by another application. Please close other apps using the microphone and try again.');
      } else if (error.name === 'OverconstrainedError') {
        toast.error('Microphone constraints could not be satisfied. Please try again.');
      } else if (error.name === 'SecurityError') {
        toast.error('Microphone access blocked due to security restrictions. Please ensure you are using HTTPS.');
      } else {
        toast.error(`Failed to access microphone: ${error.message || 'Unknown error'}`);
      }

      return false;
    }
  }, [showNotification, checkMicrophonePermission]);

  // FIXED: Enhanced speech recognition setup with better duplicate prevention
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

    // Add maxAlternatives for better recognition
    (recognitionRef.current as any).maxAlternatives = 1;

    recognitionRef.current.onresult = (event: SpeechRecognitionResultEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      // Only process new results from the last result index
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript = transcript;
        }
      }

      setInputMessage((prev) => {
        // Remove the previous interim transcript completely
        let baseMessage = prev.replace(lastInterimTranscriptRef.current, '').trim();

        // Add final transcript if we have it
        if (finalTranscript) {
          const newMessage = baseMessage + (baseMessage ? ' ' : '') + finalTranscript.trim();
          lastInterimTranscriptRef.current = ''; // Clear interim since we added final
          return newMessage;
        }

        // Otherwise, add interim transcript
        if (interimTranscript) {
          const newMessage = baseMessage + (baseMessage ? ' ' : '') + interimTranscript;
          lastInterimTranscriptRef.current = interimTranscript;
          return newMessage;
        }

        return prev;
      });
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);
      setIsRecognizing(false);

      switch (event.error) {
        case 'no-speech':
          toast.info('No speech detected. Please try again.');
          break;
        case 'not-allowed':
          setMicPermissionStatus('denied');
          toast.error('Microphone access denied. Please allow microphone permissions and try again.');
          break;
        case 'service-not-allowed':
          toast.error('Speech recognition service not allowed. Please check your browser settings.');
          break;
        case 'network':
          toast.error('Network error occurred during speech recognition.');
          break;
        case 'audio-capture':
          toast.error('Audio capture failed. Please check your microphone connection.');
          break;
        case 'aborted':
          // Don't show error for user-initiated stops
          break;
        default:
          toast.error(`Speech recognition failed: ${event.error}`);
      }
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
  }, []);

  // Check microphone permission on component mount
  useEffect(() => {
    checkMicrophonePermission().then(status => {
      setMicPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
    });
  }, [checkMicrophonePermission]);

  // FIXED: Better speech recognition start function with permission caching
  const startRecognition = useCallback(async () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecognizing) {
      return;
    }

    // Only request permission if we don't already have it
    if (micPermissionStatus !== 'granted') {
      // Request notification permission first (optional)
      const hasNotificationPermission = await requestNotificationPermission();
      if (!hasNotificationPermission) {
        console.warn("Notification permission not granted, proceeding without notifications.");
      }

      // Request microphone permission
      const hasMicrophonePermission = await requestMicrophonePermission();
      if (!hasMicrophonePermission) {
        setIsRecognizing(false);
        return;
      }
    }

    try {
      // Clear any previous interim results
      lastInterimTranscriptRef.current = '';

      // Start speech recognition
      recognitionRef.current.start();
      setIsRecognizing(true);
      toast.info(' Listening... Click the mic button again to stop.');

    } catch (error: any) {
      console.error('Error starting speech recognition:', error);

      // Handle speech recognition specific errors
      if (error.name === 'InvalidStateError') {
        toast.error('Speech recognition is already running. Please wait a moment and try again.');
      } else {
        toast.error(`Failed to start speech recognition: ${error.message || 'Unknown error'}`);
      }

      setIsRecognizing(false);
    }
  }, [isRecognizing, micPermissionStatus, requestMicrophonePermission, requestNotificationPermission]);

  const stopRecognition = useCallback(async () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    };
    if (recognitionRef.current && isRecognizing) {
      recognitionRef.current.stop();
      setIsRecognizing(false);
      lastInterimTranscriptRef.current = '';
      toast.success(' Speech recognition stopped.');
    }
  }, [isRecognizing]);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScroll = useCallback(async () => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer === null) return;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollToBottomButton(!isAtBottom && scrollHeight > clientHeight);

      const scrollThreshold = 100;
      if (scrollTop < scrollThreshold && hasMoreMessages && !isLoadingOlderMessages && !isLoading && !isLoadingSessionMessages) {
        setIsLoadingOlderMessages(true);
        const oldScrollHeight = scrollHeight;
        await onLoadOlderMessages();
        setTimeout(() => {
          if (chatContainerRef.current) {
            const newScrollHeight = chatContainerRef.current.scrollHeight;
            chatContainerRef.current.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 0);
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
    } else {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;
      if (isNearBottom) {
        scrollToBottom('smooth');
      }
    }
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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputMessage, attachedFiles]);

  const handleMessageDeleteClick = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (messageToDelete) {
      onDeleteMessage(messageToDelete);
      toast.success('Message deleted.');
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

    event.target.value = '';
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const handleRemoveAllFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    setIsLoading(true);
    e.preventDefault();
    if (!inputMessage.trim() && attachedFiles.length === 0 && selectedDocumentIds.length === 0) {
      toast.error('Please enter a message, attach files, or select documents/notes.');
      return;
    }

    try {
      const userId = userProfile?.id;

      if (!userId) {
        toast.error("User ID is missing. Please ensure you are logged in.");
        setIsLoading(false);
        return;
      }

      if (activeChatSessionId) {
        await supabase
          .from('chat_sessions')
          .update({ document_ids: selectedDocumentIds })
          .eq('id', activeChatSessionId)
          .eq('user_id', userId);
      }

      const documentIds = selectedDocumentIds.filter(id =>
        documents.some(doc => doc.id === id)
      );

      const noteIds = selectedDocumentIds.filter(id => notes.some(note => note.id === id)
      );

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

      await onSendMessageToBackend(
        inputMessage.trim(),
        documentIds,
        noteIds,
        filesForBackend
      );

      setInputMessage('');
      setAttachedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error("Error sending message:", error);

      let errorMessage = 'Failed to send message.';

      if (error.message.includes('Content size exceeds limit')) {
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

      toast.error(`Error: ${errorMessage}`);

    } finally {
      setIsLoading(false);
    }
  }, [
    inputMessage,
    attachedFiles,
    userProfile,
    selectedDocumentIds,
    documents,
    notes,
    activeChatSessionId,
    onSendMessageToBackend
  ]);

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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  }, [activeChatSessionId, stopSpeech,]);

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

  const displayMessages = useMemo(() => messages, [messages]);

  return (
    <>
      <div className="flex flex-col h-full border-none relative justify-center bg-transparent dark:bg-transparent overflow-hidden md:flex-row md:gap-0 font-sans">
        <motion.div
          className={`relative flex flex-col h-full rounded-lg panel-transition
          ${isDiagramPanelOpen
              ? (isPhone()
                ? 'hidden' // Hide chat completely on mobile when panel is open
                : `md:w-[calc(100% - ${panelWidth}%)] flex-shrink-0`
              )
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
            {messages.length === 0 && !isLoading && !isLoadingSessionMessages && !isLoadingOlderMessages && (
              <div className="text-center py-8 flex-grow flex flex-col justify-center items-center text-slate-400 dark:text-gray-500">
                <BookPagesAnimation size="xl" showText={false} className="mb-6" />
                <h3 className="text-lg md:text-2xl font-medium text-slate-700 mb-2 dark:text-gray-200 font-claude">Welcome to your AI Study Assistant!</h3>
                <p className="text-base md:text-lg text-slate-500 max-w-md mx-auto dark:text-gray-400 font-claude leading-relaxed">
                  I can help with questions about your notes, create study guides, explain concepts, and assist with academic work. Select documents and start chatting or use the microphone!
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
              onDiagramCodeUpdate={onDiagramCodeUpdate}

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

          <div className={`fixed bottom-0 left-0 right-0  sm:pb-8 md:shadow-none md:static rounded-t-lg md:rounded-lg bg-transparent  dark:bg-transparent dark:border-gray-700 font-sans z-10 
          ${isDiagramPanelOpen
              ? (isPhone()
                ? 'hidden' // Hide input on mobile when panel is open
                : `md:pr-[calc(${panelWidth}%+1.5rem)]`
              )
              : ''
            }`}><div className="w-full max-w-4xl mx-auto dark:bg-gray-800 border border-slate-200 bg-white rounded-lg shadow-md  dark:border-gray-700 p-2">
              {/* FIXED: Speech recognition status indicator */}
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
              {(attachedFiles.length > 0 || selectedDocumentIds.length > 0) && (
                <div className={`mb-3 p-3 bg-slate-100 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2 dark:bg-gray-800 dark:border-gray-700`}>
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
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-800 border-purple-400 flex items-center gap-1 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700 text-sm md:text-base font-sans">
                      <BookOpen className="h-3 w-3 mr-1" /> {selectedDocumentTitles.length} Text Doc{selectedDocumentTitles.length > 1 ? 's' : ''}
                      <XCircle className="h-3 w-3 ml-1 cursor-pointer text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !documents.filter(doc => doc.type === 'text').map(d => d.id).includes(id)))} />
                    </Badge>
                  )}
                  {selectedNoteTitles.length > 0 && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-800 border-green-400 flex items-center gap-1 dark:bg-green-950 dark:text-green-300 dark:border-green-700 text-sm md:text-base font-sans">
                      <StickyNote className="h-3 w-3 mr-1" /> {selectedNoteTitles.length} Note{selectedNoteTitles.length > 1 ? 's' : ''}
                      <XCircle className="h-3 w-3 ml-1 cursor-pointer text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !notes.map(n => n.id).includes(id)))} />
                    </Badge>
                  )}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="What do you want to know?"
                className="w-full overflow-y-scroll modern-scrollbar text-base md:text-lg focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[48px] bg-gray-700 placeholder-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-400 bg-white text-gray-800 placeholder-gray-600 px-3 py-2 rounded-sm transition-colors duration-300 font-claude"
                disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments}
                rows={1}
              />
              <div className="flex items-center gap-2 mt-2 justify-between">
                <div className="flex items-center gap-2">
                  {/* FIXED: Enhanced microphone button with better visual feedback */}
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
                      micPermissionStatus === 'checking'
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
                    disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments}
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
                    disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments}
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
                    disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments}
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
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || (!inputMessage.trim() && attachedFiles.length === 0 && selectedDocumentIds.length === 0)}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md h-10 w-10 flex-shrink-0 rounded-lg p-0"
                  title="Send Message"
                >
                  {isSubmittingUserMessage ? (
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

export default React.memo(AIChat);