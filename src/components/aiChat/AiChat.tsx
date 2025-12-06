import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, FileText, BookOpen, StickyNote, Camera, Paperclip, Mic, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
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
import { getFileType, validateFile, stripCodeBlocks, generateOptimisticId } from './utils/helpers';
import { ContextBadges } from './Components/ContextBadges';
import { DragOverlay } from './Components/DragOverlay';
import { state } from 'mermaid/dist/rendering-util/rendering-elements/shapes/state.js';
import { AppContext } from '@/contexts/AppContext';
import { initialAppState } from '@/contexts/appReducer';

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
}

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

  // Enhanced document synchronization
  const [mergedDocuments, setMergedDocuments] = useState<Document[]>([]);
  const prevSessionIdRef = useRef<string | null>(null);
  const prevDocumentsRef = useRef<Document[]>([]);
  const prevNotesRef = useRef<Note[]>([]);

  const [autoTypeInPanel, setAutoTypeInPanel] = useState(false);
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isLastAiMessageDisplayed, setIsLastAiMessageDisplayed] = useState(true);
  const [isCurrentlySending, setIsCurrentlySending] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const storedWidth = localStorage.getItem('diagramPanelWidth');
    return storedWidth ? parseFloat(storedWidth) : 65;
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isUpdatingDocuments, setIsUpdatingDocuments] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const isCurrentlySendingRef = useRef(false);

  useEffect(() => {
    const documentsChanged = documents !== prevDocumentsRef.current;
    const notesChanged = notes !== prevNotesRef.current;

    if (documentsChanged || notesChanged) {
      console.log('🔄 Documents or notes changed, updating merged documents');

      const timer = setTimeout(() => {
        const allDocuments: Document[] = [
          ...documents,
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

        setMergedDocuments(allDocuments);
        prevDocumentsRef.current = documents;
        prevNotesRef.current = notes;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [documents, notes]);

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
        console.error('Error loading session documents:', error);
        return;
      }

      if (sessionData?.document_ids) {
        console.log('📄 Loaded session documents:', sessionData.document_ids);
        onSelectionChange(sessionData.document_ids);
      }
    } catch (error) {
      console.error('Error loading session documents:', error);
    }
  }, [userProfile?.id, onSelectionChange]);

  const processFiles = useCallback((files: File[]) => {
    const validFiles: AttachedFile[] = [];

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
        reader.onerror = () => {
          toast.error(`Failed to load image: ${file.name}`);
        };
        reader.readAsDataURL(file);
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

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

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
          console.error('Error updating session documents:', error);
        } else {
          console.log('💾 Session documents updated:', selectedDocumentIds);
        }
      }

      const documentIds = selectedDocumentIds.filter(id =>
        documents.some(doc => doc.id === id)
      );
      const noteIds = selectedDocumentIds.filter(id =>
        notes.some(note => note.id === id)
      );

      console.log('📤 Sending message with context:', {
        documents: documentIds.length,
        notes: noteIds.length,
        files: attachedFiles.length
      });

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
      setInputMessage('');

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
      } else if (error.message.includes('Resource exhausted')) {
        errorMessage = 'Resource exhausted: The service is currently overloaded. Please try again later.';
      }

      toast.error(`Error: ${errorMessage}`);
      setInputMessage('');
      setAttachedFiles([]);
      setExpandedMessages(new Set());
    } finally {
      setIsLoading(false);
      setIsCurrentlySending(false);
      setIsAiTyping(false);
      isCurrentlySendingRef.current = false;
    }
  }, [
    inputMessage,
    attachedFiles,
    userProfile?.id,
    activeChatSessionId,
    selectedDocumentIds,
    documents,
    notes,
    onSendMessageToBackend,
    isCurrentlySending,
    messages
  ]);

  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [inputMessage, resizeTextarea]);

  const handleMarkMessageDisplayed = useCallback(async (messageId: string) => {
    if (!userProfile?.id || !activeChatSessionId) {
      console.warn("User or session ID missing, cannot mark message as displayed.");
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
        console.error('Error marking message as displayed:', error);
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

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth', force = false) => {
    if (!isAutoScrolling && !force) return;

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior,
        block: 'end',
        inline: 'nearest'
      });
    });
  }, [isAutoScrolling]);

  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const isNewMessage = lastMessage.id !== lastProcessedMessageIdRef.current;

    if (isNewMessage) {
      lastProcessedMessageIdRef.current = lastMessage.id;

      if (lastMessage.role === 'assistant') {
        setIsAiTyping(true);
        scrollToBottom('smooth', true);
      } else if (lastMessage.role === 'user') {
        scrollToBottom('smooth', true);
      }
    }

    if (lastMessage.role === 'assistant' && !lastMessage.content.includes('█') && !isLoading) {
      setIsAiTyping(false);
    }
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    const isSessionChange = prevSessionIdRef.current !== activeChatSessionId;

    if (isSessionChange && activeChatSessionId && !isLoadingSessionMessages && !isLoadingSession) {
      setIsLoadingSession(true);

      setTimeout(() => {
        scrollToBottom('auto', true);
        prevSessionIdRef.current = activeChatSessionId;
        setIsLoadingSession(false);
      }, 100);

      setInputMessage('');
      setAttachedFiles([]);
      setExpandedMessages(new Set());
      setIsCurrentlySending(false);
      setIsAiTyping(false);
    }
  }, [messages, isLoadingSessionMessages, activeChatSessionId, scrollToBottom, isLoadingSession]);

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

  const { isRecognizing, startRecognition, stopRecognition, micPermissionStatus } = useSpeechRecognition({
    setInputMessage,
    resizeTextarea: useCallback(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, []),
    inputMessage,
    requestNotificationPermission: useCallback(async (): Promise<boolean> => {
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
    }, []),
    requestMicrophonePermission: useCallback(async (): Promise<boolean> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error: any) {
        console.error('Error requesting microphone permission:', error);
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
        console.error('Error checking microphone permission:', error);
        return 'unknown';
      }
    }, []),
  });

  const { isSpeaking, speakingMessageId, isPaused, speakMessage, pauseSpeech, resumeSpeech, stopSpeech } = useTextToSpeech({
    messages,
    isLoading,
    isLoadingSessionMessages,
    isPhone,
    stripCodeBlocks,
  });

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

  useEffect(() => {
    const isSessionChange = prevSessionIdRef.current !== activeChatSessionId;

    if (isSessionChange && activeChatSessionId) {
      console.log('🔄 Chat session changed, loading session documents');
      loadSessionDocuments(activeChatSessionId);
      prevSessionIdRef.current = activeChatSessionId;
    }

    if (isSessionChange) {
      setInputMessage('');
      setAttachedFiles([]);
      setExpandedMessages(new Set());
      setIsCurrentlySending(false);
      setIsAiTyping(false);
      setActiveDiagram(null);
      setIsFullScreen(false);
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      stopSpeech()

      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      stopSpeech();
    }
  }, [activeChatSessionId, stopSpeech]);

  function handleDiagramCodeUpdate(messageId: string, newCode: string): Promise<void> {
    toast.info('Diagram code updated. You can regenerate the response to see changes.');
    return Promise.resolve();
  }

  return (
    <>
      <div
        ref={dropZoneRef}
        className={`flex flex-col h-[90vh] lg:h-screen ${isDiagramPanelOpen ? `` : 'max-w-3xl mx-auto'} border-none relative justify-center bg-transparent dark:bg-transparent overflow-hidden md:flex-row md:gap-0 font-sans ${isDragging ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
      >
        <DragOverlay isDragging={isDragging} />

        {/* Chat Panel - Remove motion animation and use inline style for width */}
        <div
          className={`relative flex flex-col h-full rounded-lg panel-transition
            ${isDiagramPanelOpen
              ? (isPhone()
                ? 'hidden'
                : `flex-shrink-0`)
              : 'w-full flex-1'
            } bg-transparent dark:bg-transparent`}
          style={{
            width: isDiagramPanelOpen && !isPhone()
              ? `calc(100% - ${panelWidth}%)`
              : '100%',
            transition: 'width 0.1s ease-in-out'
          }}
        >
          {/* Chat content */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 dark:bg-transparent flex flex-col modern-scrollbar pb-36 md:pb-6">
            {isLoadingSessionMessages && (
              <div className="flex justify-center items-center w-full py-10">
                <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
              </div>
            )}
            {!hasMoreMessages && messages.length === 0 && !isLoadingSessionMessages && !activeChatSessionId && (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-20 font-claude">
                <BookPagesAnimation className="mx-auto mb-4 h-16 w-16 text-pink-500" showText={false} />
                <p className="text-lg md:text-xl">Start the conversation by sending a message!</p>
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

          {/* Input area */}
          <div className={`fixed bottom-0 left-0 right-0 sm:pb-8 md:shadow-none md:static rounded-t-lg rounded-lg md:rounded-lg bg-transparent dark:bg-transparent dark:border-gray-700 font-sans z-10
          ${isDiagramPanelOpen
              ? (isPhone() ? 'hidden' : `md:pr-[calc(${panelWidth}%+1.5rem)]`)
              : ''
            }`}>
            <div className="w-full max-w-4xl mx-auto dark:bg-gray-800 border border-slate-200 bg-white rounded-lg shadow-md dark:border-gray-700 p-2">
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
                    documents={documents}
                    notes={notes}
                  />
                </div>
              ) : null}
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => {
                  e.preventDefault();
                  setInputMessage(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="What do you want to know? (You can also drag and drop files here)"
                className="w-full overflow-y-scroll modern-scrollbar text-base md:text-lg focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[48px] bg-gray-700 placeholder-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-400 bg-white text-gray-800 placeholder-gray-600 px-3 py-2 transition-colors duration-300 font-claude"
                disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || isAiTyping}
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
                    isAiTyping ||
                    messages.some(msg => msg.id.startsWith('optimistic-'))
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md h-10 w-10 flex-shrink-0 rounded-lg p-0"
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
        </div>

        {/* Diagram Panel */}
        {isDiagramPanelOpen && (
          <DiagramPanel
            key={`diagram-panel-${panelWidth}`}
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
    </>
  );
};

const arePropsEqual = (prevProps: AIChatProps, nextProps: AIChatProps) => {
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