import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, Loader2, FileText, XCircle, BookOpen, StickyNote, Camera, Upload, Image, Mic, ChevronDown, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { UserProfile, Document } from '../types/Document';
import { Note } from '../types/Note';
import { supabase } from '@/integrations/supabase/client';
import { DocumentSelector } from './DocumentSelector';
import { toast } from 'sonner';
import { DiagramPanel } from './DiagramPanel';
import { generateId } from '@/utils/helpers';
import { MessageList } from './MessageList';
import { ConfirmationModal } from './ConfirmationModal';
import { Message } from '../types/Class';
import { TypingAnimation } from './TypingAnimation';

// Declare Web Speech API types for TypeScript
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

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
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
  onNewMessage: (message: Message) => void;
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
    imageUrl?: string,
    imageMimeType?: string,
    imageDataBase64?: string
  ) => Promise<void>;
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
  onNewMessage,
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
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activeDiagram, setActiveDiagram] = useState<{ content?: string; type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text'; language?: string; imageUrl?: string } | null>(null);
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
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const blockAutoSpeakRef = useRef<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('diagramPanelWidth');
    return saved ? parseFloat(saved) : 65;
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isUpdatingDocuments, setIsUpdatingDocuments] = useState(false);

  const isPhone = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /mobile|android|iphone|ipad|tablet/i.test(userAgent) && window.innerWidth <= 768;
  }, []);

  useEffect(() => {
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionConstructor) {
      recognitionRef.current = new SpeechRecognitionConstructor() as SpeechRecognition;
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: SpeechRecognitionResultEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setInputMessage((prev) => prev + finalTranscript);
        if (interimTranscript) {
          setInputMessage((prev) => prev + interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsRecognizing(false);
        if (event.error === 'no-speech') {
          toast.info('No speech detected. Please try again.');
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast.error('Microphone access denied. Please allow microphone permissions.');
        } else {
          toast.error(`Speech recognition failed: ${event.error}`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsRecognizing(false);
      };
    } else {
      console.warn('SpeechRecognition API not supported in this browser.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startRecognition = useCallback(() => {
    if (recognitionRef.current && !isRecognizing) {
      try {
        recognitionRef.current.start();
        setIsRecognizing(true);
        toast.info('Speech recognition started. Speak now.');
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        toast.error('Failed to start speech recognition.');
      }
    }
  }, [isRecognizing]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current && isRecognizing) {
      recognitionRef.current.stop();
      setIsRecognizing(false);
      toast.info('Speech recognition stopped.');
    }
  }, [isRecognizing]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(async () => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollToBottomButton(!isAtBottom && scrollHeight > clientHeight);

      const scrollThreshold = 100;
      if (scrollTop < scrollThreshold && hasMoreMessages && !isLoadingOlderMessages && !isLoading) {
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
  }, [hasMoreMessages, isLoadingOlderMessages, isLoading, onLoadOlderMessages]);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
      handleScroll();
    }
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;
      const lastMessage = messages[messages.length - 1];
      const isNewAIMessageFinished = lastMessage?.role === 'assistant' && !isLoading;
      if (isNewAIMessageFinished || isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages, isLoading, scrollToBottom]);

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
  }, [inputMessage, selectedImageFile]);

  const handleDeleteClick = useCallback((messageId: string) => {
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

  const handleRegenerateClick = useCallback((lastUserMessageContent: string) => {
    onRegenerateResponse(lastUserMessageContent);
  }, [onRegenerateResponse]);

  const handleRetryClick = useCallback((originalUserMessageContent: string, failedAiMessageId: string) => {
    onRetryFailedMessage(originalUserMessageContent, failedAiMessageId);
  }, [onRetryFailedMessage]);

  const handleMermaidError = useCallback((code: string, errorType: 'syntax' | 'rendering') => {
    toast.info(`Mermaid diagram error (${errorType}): ${code}. Click 'AI Fix' to get help.`);
  }, []);

  const handleSuggestAiCorrection = useCallback((prompt: string) => {
    setInputMessage(prompt);
    textareaRef.current?.focus();
  }, []);

  const handleViewContent = useCallback((type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text', content?: string, language?: string, imageUrl?: string) => {
    setActiveDiagram({ content, type, language, imageUrl });
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleCloseDiagramPanel = useCallback(() => {
    setActiveDiagram(null);
    setIsFullScreen(false);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // const handleToggleFullScreen = useCallback(() => {
  //   setIsFullScreen(prev => !prev);
  // }, []);

  // const handleZoomIn = useCallback(() => {
  //   setZoomLevel(prev => Math.min(prev + 0.1, 2));
  // }, []);

  // const handleZoomOut = useCallback(() => {
  //   setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  // }, []);

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

  const handleImageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file.');
        setSelectedImageFile(null);
        setSelectedImagePreview(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size exceeds 5MB limit.');
        setSelectedImageFile(null);
        setSelectedImagePreview(null);
        return;
      }
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImageFile(null);
      setSelectedImagePreview(null);
    }
  }, []);

  const handleRemoveImage = useCallback(() => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }, []);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() && !selectedImageFile && selectedDocumentIds.length === 0) {
      toast.error('Please enter a message, attach an image, or select documents/notes.');
      return;
    }

    try {
      const userId = userProfile?.id;

      if (!userId) {
        toast.error("User ID is missing. Please ensure you are logged in.");
        setIsLoading(false);
        return;
      }

      // if (activeChatSessionId) {
      //   await supabase
      //     .from('chat_sessions')
      //     .update({ document_ids: selectedDocumentIds })
      //     .eq('id', activeChatSessionId)
      //     .eq('user_id', userId);
      // }

      // Separate document IDs and note IDs properly
      const documentIds = selectedDocumentIds.filter(id =>
        documents.some(doc => doc.id === id)
      );

      const noteIds = selectedDocumentIds.filter(id =>
        notes.some(note => note.id === id)
      );

      // Handle image data properly
      let imageUrl: string | undefined;
      let imageMimeType: string | undefined;
      let imageDataBase64: string | undefined;

      if (selectedImageFile && selectedImagePreview) {
        imageUrl = selectedImagePreview; // This should be the display URL
        imageMimeType = selectedImageFile.type;

        // Convert file to base64 for backend processing
        const reader = new FileReader();
        imageDataBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedImageFile);
        });
      }

      await onSendMessageToBackend(
        inputMessage.trim(),
        documentIds,        // Only actual document IDs
        noteIds,           // Only actual note IDs  
        imageUrl,
        imageMimeType,
        imageDataBase64,   // Proper base64 data for backend
      );

      // Clear form
      setInputMessage('');
      setSelectedImageFile(null);
      setSelectedImagePreview(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error("Error sending message:", error);

      let errorMessage = 'Failed to send message.';

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
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
    selectedImageFile,
    selectedImagePreview,
    userProfile,
    selectedDocumentIds,
    documents,
    notes,
    activeChatSessionId,
    onSendMessageToBackend
  ]);

  const handleGenerateImageFromText = useCallback(async () => {
    if (!imagePrompt.trim()) {
      toast.error('Please enter a prompt for image generation.');
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);
    toast.info('Generating image...', { id: 'image-gen' });

    try {
      const payload = { instances: { prompt: imagePrompt }, parameters: { "sampleCount": 1 } };
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
        const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        setGeneratedImageUrl(imageUrl);
        toast.success('Image generated successfully!', { id: 'image-gen' });
        onNewMessage({
          id: generateId(),
          content: `Here is an image generated from your prompt: "${imagePrompt}"`,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          imageUrl: imageUrl,
          imageMimeType: 'image/png',
          has_been_displayed: false,
          isError: false,
        });
        setImagePrompt('');
      } else {
        throw new Error('No image data received from API.');
      }
    } catch (error: Error | any) {
      console.error('Error generating image:', error);
      toast.error(`Failed to generate image: ${error.message}`, { id: 'image-gen' });
    } finally {
      setIsGeneratingImage(false);
    }
  }, [imagePrompt, onNewMessage]);

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
      stopRecognition();
      setInputMessage('');
      setSelectedImageFile(null);
      setSelectedImagePreview(null);
      setActiveDiagram(null);
      setIsFullScreen(false);
      setExpandedMessages(new Set());
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  }, [activeChatSessionId, stopSpeech, stopRecognition]);

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
      <style>
        {`

                @keyframes typewriter {
            from { width: 0; }
            to { width: 100%; }
          }

          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }

          .typing-cursor {
            animation: blink 1s infinite;
          }

          .message-appear {
            animation: slideInUp 0.3s ease-out;
          }

          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .bot-thinking {
            animation: pulse 2s ease-in-out infinite;
          }

          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }

          .message-typing {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
            transition: box-shadow 0.3s ease;
          }
          .mic-active {
            background-color: #fef2f2;
            animation: pulse 1.5s infinite;
          }

          .dark .mic-active {
            background-color: #7f1d1d;
          }

          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }

          .resize-handle {
            width: 8px;
            background: #e2e8f0;
            cursor: col-resize;
            transition: background 0.2s;
          }

          .resize-handle:hover {
            background: #94a3b8;
          }

          .dark .resize-handle {
            background: #4b5563;
          }

          .dark .resize-handle:hover {
            background: #6b7280;
          }

          .panel-transition {
            transition: all 0.3s ease-in-out;
          }

          .fullscreen-panel {
            width: 100% !important;
            right: 0;
            transform: translateX(0);
          }

          .chat-input {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 1rem;
            font-weight: 400;
            line-height: 1.5;
            color: #1f2937;
            background-color: transparent;
          }

          .dark .chat-input {
            color: #d1d5db;
          }

          .input-container {
            max-height: 300px;
            overflow-y: auto;
          }
        `}
      </style>
      <div className="flex flex-col h-full border-none relative justify-center overflow-hidden md:flex-row md:gap-0 font-sans">
        <motion.div
          className={`relative flex flex-col h-full rounded-lg panel-transition
            ${isDiagramPanelOpen ? `md:w-[${100 - panelWidth}%] flex-shrink-0` : 'w-full flex-1'}
            dark:bg-gray-900
          `}
          initial={{ width: '100%' }}
          animate={{ width: isDiagramPanelOpen ? `${100 - panelWidth}%` : '100%' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col modern-scrollbar pb-36 md:pb-6">
            <MessageList
              messages={displayMessages}
              isLoading={isLoading}
              isLoadingSessionMessages={isLoadingSessionMessages}
              isLoadingOlderMessages={isLoadingOlderMessages}
              hasMoreMessages={hasMoreMessages}
              mergedDocuments={mergedDocuments}
              onDeleteClick={handleDeleteClick}
              onRegenerateClick={handleRegenerateClick}
              onRetryClick={handleRetryClick}
              onViewContent={handleViewContent}
              onMermaidError={handleMermaidError}
              onSuggestAiCorrection={handleSuggestAiCorrection}
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
            />
            {isLoading && isSubmittingUserMessage && (
              <div className="flex justify-center font-sans">
                <div className="w-full max-w-4xl flex gap-3 items-center justify-start">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center animate-pulse">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="w-fit p-3 rounded-lg bg-white shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex gap-1">
                      <TypingAnimation
                        text="Thinking..."
                        speed={150}
                        className="text-slate-400 dark:text-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
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
          {/* <div className={`fixed  left-0 right-0 p-4 sm:p-6 pb-8 bg-slate-50 shadow-lg md:shadow-none md:static md:p-0 rounded-t-lg md:rounded-lg dark:bg-gray-950 md:dark:bg-transparent font-sans z-10 ${isDiagramPanelOpen ? 'md:pr-[calc(1.5rem+' + panelWidth + '%*1px)]' : ''}`}> */}
            
          <div className={`fixed bottom-0 left-0 right-0 p-4 sm:p-6 pb-8 bg-slate-50  md:shadow-none md:static md:pb-4 rounded-t-lg md:rounded-lg dark:bg-gray-950 md:dark:bg-transparent font-sans z-10 ${isDiagramPanelOpen ? 'md:pr-[calc(1.5rem+' + panelWidth + '%*1px)]' : ''}`}>
            {(selectedDocumentIds.length > 0 || selectedImagePreview) && (
              <div className={`mb-3 p-3 bg-slate-100 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2 dark:bg-gray-800 dark:border-gray-700
                ${isDiagramPanelOpen ? 'w-full mx-auto' : 'max-w-4xl w-full mx-auto'}
              `}>
                <span className="text-base md:text-lg font-medium text-slate-700 dark:text-gray-200">Context:</span>
                {selectedImagePreview && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-800 border-blue-400 flex items-center gap-1 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700 text-sm md:text-base font-sans">
                    <Image className="h-3 w-3" /> Preview
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200" onClick={handleRemoveImage} />
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
              
              
              <div className="max-w-4xl w-full mx-auto flex flex-col gap-2 p-3 rounded-lg border border-gray-700 dark:bg-gray-800 bg-white transition-colors duration-300">
              {selectedImagePreview && (
                <div className="relative w-1/6 h-24 rounded-lg overflow-hidden flex-shrink-0 mb-2">
                  <img src={selectedImagePreview} alt="Selected preview" className="w-full h-full object-fit" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveImage}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white hover:bg-black/70 p-0"
                    title="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="What do you want to know?"
                className="w-full text-base md:text-lg focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[48px] bg-gray-700 placeholder-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-400 bg-white text-gray-800 placeholder-gray-600 px-3 py-2 rounded-sm transition-colors duration-300"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments}
                  rows={1}
                />
                <div className="flex items-center gap-2 mt-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={isRecognizing ? stopRecognition : startRecognition}
                      className={`h-10 w-10 flex-shrink-0 rounded-lg p-0 ${isRecognizing ? 'bg-red-900 text-red-300 dark:bg-red-900 dark:text-red-300 bg-red-200 text-red-600' : 'text-gray-400 dark:text-gray-400 text-gray-600 hover:bg-gray-600 dark:hover:bg-gray-600 hover:bg-gray-300'}`}
                      title={isRecognizing ? 'Stop Speaking' : 'Speak Message'}
                      disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || !recognitionRef.current}
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={cameraInputRef}
                      onChange={handleImageChange}
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
                      accept="image/*"
                      ref={imageInputRef}
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => imageInputRef.current?.click()}
                      className="text-gray-400 dark:text-gray-400 text-gray-600 hover:bg-gray-600 dark:hover:bg-gray-600 hover:bg-gray-300 h-10 w-10 flex-shrink-0 rounded-lg p-0"
                      title="Upload Image"
                      disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments}
                    >
                      <Upload className="h-5 w-5" />
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
                  </div>
                  <Button
                    type="submit"
                    onClick={handleSendMessage}
                    disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || isUpdatingDocuments || (!inputMessage.trim() && !selectedImageFile && selectedDocumentIds.length === 0)}
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
            {/* </div> */}
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
            key={`${activeDiagram?.content || ''}-${activeDiagram?.type || ''}-${activeDiagram?.language || ''}-${activeDiagram?.imageUrl || ''}`}
            diagramContent={activeDiagram?.content}
            diagramType={activeDiagram?.type || 'unknown'}
            onClose={handleCloseDiagramPanel}
            onMermaidError={handleMermaidError}
            onSuggestAiCorrection={handleSuggestAiCorrection}
            isOpen={isDiagramPanelOpen}
            language={activeDiagram?.language}
            imageUrl={activeDiagram?.imageUrl}
            initialWidthPercentage={panelWidth}
          />
        )}
        {showScrollToBottomButton && (
          <Button
            variant="outline"
            size="icon"
            onClick={scrollToBottom}
            className={`fixed bottom-28 right-6 md:bottom-8 bg-white rounded-full shadow-lg p-2 z-20 transition-all duration-300 hover:scale-105 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 font-sans
              ${isDiagramPanelOpen ? 'md:right-[calc(' + panelWidth + '%+1.5rem)]' : 'md:right-8'}
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