// src/components/AIChat.tsx
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Send, Bot, User, Loader2, FileText, History, X, RefreshCw, AlertTriangle, Copy, Check, Maximize2, Minimize2, Trash2, Download, ChevronDown, ChevronUp, Image, Upload, XCircle, BookOpen, StickyNote, Sparkles, GripVertical, Camera } from 'lucide-react'; // Added Camera icon
import { Button } from './ui/button';
import { Input } from './ui/input'; // Keep Input for other uses if any, but will replace for message input
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { UserProfile, Document } from '../types/Document';
import { Note } from '../types/Note';
import { supabase } from '@/integrations/supabase/client';
import { DocumentSelector } from './DocumentSelector';
import { toast } from 'sonner';

// Import the new DiagramPanel component
import { DiagramPanel } from './DiagramPanel'; // <--- NEW IMPORT

// NEW: Import MemoizedMarkdownRenderer from the new file
// Removed CodeBlockErrorBoundary from this import as it's used internally by MarkdownRenderer
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';

import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { generateId } from '@/utils/helpers';


interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 font-sans">
      <Card className="bg-white rounded-lg shadow-xl max-w-sm w-full dark:bg-gray-800">
        <CardContent className="p-6">
          <h3 className="text-lg md:text-xl font-semibold text-slate-800 mb-3 dark:text-gray-100">{title}</h3>
          <p className="text-slate-600 text-base md:text-lg mb-6 dark:text-gray-300">{message}</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 font-sans">
              Cancel
            </Button>
            <Button onClick={onConfirm} className="bg-red-600 text-white shadow-md hover:bg-red-700 font-sans">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

// Updated Message interface to include image and context IDs and imageMimeType
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string; // ISO string
  isError?: boolean;
  originalUserMessageContent?: string; // For retry functionality
  imageUrl?: string; // URL of an uploaded image (e.g., from Supabase Storage)
  imageMimeType?: string; // New: Mime type of the uploaded image (e.g., 'image/png')
  attachedDocumentIds?: string[]; // New: IDs of documents attached to this message
  attachedNoteIds?: string[]; // New: IDs of notes attached to this message
  session_id?: string; // Added session_id to Message interface
}

interface AIChatProps {
  messages: Message[];
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  userProfile: UserProfile | null;
  documents: Document[]; // Ensure Document type is imported
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
  onDocumentUpdated: (updatedDocument: Document) => void; // NEW PROP
  isLoadingSessionMessages: boolean; // NEW PROP
  // NEW PROPS for learning style and preferences required by the Edge Function
  learningStyle: string;
  learningPreferences: any; // Use a more specific type if known
  // Add a prop for the actual send message function from Index.tsx
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
  documents, // Use documents prop
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
  onDocumentUpdated, // Destructure new prop
  isLoadingSessionMessages, // NEW: Destructure new prop
  learningStyle, // NEW: Destructure new prop
  learningPreferences, // NEW: Destructure new prop
  onSendMessageToBackend, // Destructure the new prop
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [showDeleteConfirm] = useState(false); // Removed setter as it's not used directly here
  const [messageToDelete] = useState<string | null>(null); // Removed setter as it's not used directly here
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable chat container
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for the textarea input
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set()); // State to track expanded messages
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false); // State for scroll button visibility
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false); // New state for older message loading
  // Image upload states (for UI preview only, not directly sent to AI anymore)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null); // Ref for file input (for both upload and camera)
  const cameraInputRef = useRef<HTMLInputElement>(null); // Ref for camera input
  // Corrected type for activeDiagram to align with DiagramPanelProps and MarkdownRendererProps
  const [activeDiagram, setActiveDiagram] = useState<{ content?: string; type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text'; language?: string; imageUrl?: string } | null>(null);
  const isDiagramPanelOpen = !!activeDiagram; // Derived state
  // State for image generation
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState(''); // Local state to merge documents from prop and newly uploaded/updated documents
  const [mergedDocuments, setMergedDocuments] = useState<Document[]>(documents);

  // Sync mergedDocuments with the prop whenever the prop changes (e.g., parent fetches new data)
  useEffect(() => {
    setMergedDocuments(documents);
  }, [documents]);

  // Local handler to update mergedDocuments when an image is processed
  const handleDocumentUpdatedLocally = useCallback((updatedDoc: Document) => {
    setMergedDocuments(prevDocs => {
      const existingIndex = prevDocs.findIndex(doc => doc.id === updatedDoc.id);
      if (existingIndex > -1) {
        // Update existing document
        const newDocs = [...prevDocs];
        newDocs[existingIndex] = updatedDoc;
        return newDocs;
      } else {
        // Add new document (for newly created image documents)
        return [...prevDocs, updatedDoc];
      }
    });
  }, []);

  // Initialize useCopyToClipboard hook once at the top level of the component
  const { copied, copy } = useCopyToClipboard();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll event for infinite loading and scroll to bottom button
  const handleScroll = useCallback(async () => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      // Logic for "Scroll to Bottom" button visibility
      // Show button if not at the very bottom (with a 100px threshold)
      // Also ensure scrollHeight is greater than clientHeight (i.e., there's actually something to scroll)
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollToBottomButton(!isAtBottom && scrollHeight > clientHeight);

      // Logic for loading older messages (infinite scroll)
      const scrollThreshold = 100; // Load when within 100px of the top
      if (scrollTop < scrollThreshold && hasMoreMessages && !isLoadingOlderMessages && !isLoading) {
        setIsLoadingOlderMessages(true);
        const oldScrollHeight = scrollHeight; // Capture current scrollHeight before loading more
        await onLoadOlderMessages(); // After messages load, adjust scroll position to maintain user's view
        // Use a timeout to ensure new messages have rendered and updated scrollHeight
        setTimeout(() => {
          if (chatContainerRef.current) {
            const newScrollHeight = chatContainerRef.current.scrollHeight;
            chatContainerRef.current.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 0); // Small timeout to allow DOM to update
        setIsLoadingOlderMessages(false);
      }
    }
  }, [hasMoreMessages, isLoadingOlderMessages, isLoading, onLoadOlderMessages]);

  // Attach and detach scroll listener
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll); // Initial check on mount
      handleScroll();
    }
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  // Scroll to bottom when new messages are added, or when isLoading changes (for new AI response)
  // Modified to only auto-scroll if the user is near the bottom or if it's a new AI message finishing loading.
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200; // 200px threshold
      const lastMessage = messages[messages.length - 1];
      const isNewAIMessageFinished = lastMessage?.role === 'assistant' && !isLoading; // A new AI message has just appeared and loading is done
      // Check if it's a new AI message finishing or if the user is near bottom and a new message comes
      if (isNewAIMessageFinished || isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages, isLoading]); // Only trigger on messages or isLoading changes

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputMessage, selectedImageFile]); // Re-evaluate height when image is added/removed


  const handleDeleteClick = (messageId: string) => {
    onDeleteMessage(messageId);
    toast.success('Message deleted.');
  };

  const handleConfirmDelete = () => {
    if (messageToDelete) {
      onDeleteMessage(messageToDelete);
    }
  };

  const handleRegenerateClick = (lastUserMessageContent: string) => {
    onRegenerateResponse(lastUserMessageContent);
  };

  const handleRetryClick = (originalUserMessageContent: string, failedAiMessageId: string) => {
    onRetryFailedMessage(originalUserMessageContent, failedAiMessageId);
  };

  const handleMermaidError = useCallback((error: string) => { // Simplified error signature
    toast.info(`Mermaid diagram encountered an error: ${error}. Click 'AI Fix' to get help.`);
  }, []); // Memoize this callback

  const handleSuggestAiCorrection = useCallback((prompt?: string) => { // Made prompt optional
    if (prompt) {
      setInputMessage(prompt);
      textareaRef.current?.focus();
    } else {
      toast.info("AI correction feature for diagrams is coming soon!");
    }
  }, []);

  // New callback to handle viewing a diagram, code, or image in the side panel
  // Corrected type to include 'unknown' and 'document-text', and removed 'text/markdown'
  const handleViewContent = useCallback((type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text', content?: string, language?: string, imageUrl?: string) => {
    setActiveDiagram({ content, type, language, imageUrl });
  }, []);

  const handleCloseDiagramPanel = useCallback(() => {
    setActiveDiagram(null);
  }, []);

  // Function to toggle user message expansion
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

  // Helper function to format date for display (e.g., "Today", "Yesterday", "July 13, 2025")
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  // Helper function to format time for display (e.g., "10:30 AM")
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const displayMessages = messages;

  const MAX_USER_MESSAGE_LENGTH = 100; // Define a threshold for collapsing

  let lastDate = ''; // To keep track of the last message's date for grouping

  // Image handling logic
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file.');
        setSelectedImageFile(null);
        setSelectedImagePreview(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
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
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = ''; // Clear file input
    }
    if (cameraInputRef.current) { // Clear camera input as well
      cameraInputRef.current.value = '';
    }
  };

const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!inputMessage.trim() && !selectedImageFile) return;

  setIsLoading(true);

  try {
    const userId = userProfile?.id;

    if (!userId) {
      toast.error("User ID is missing. Please ensure you are logged in.");
      setIsLoading(false);
      return;
    }

    await onSendMessageToBackend(
      inputMessage.trim(),
      selectedDocumentIds,
      [],
      selectedImagePreview || undefined,
      selectedImageFile?.type || undefined,
      selectedImagePreview || undefined
    );

    setInputMessage('');
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    if (cameraInputRef.current) { // Clear camera input as well
      cameraInputRef.current.value = '';
    }
    onSelectionChange([]);

    toast.success("Message sent successfully!");

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
};
  // Function to handle image generation
  const handleGenerateImageFromText = async () => {
    if (!imagePrompt.trim()) {
      toast.error('Please enter a prompt for image generation.');
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);
    toast.info('Generating image...', { id: 'image-gen' });

    try {
      const payload = { instances: { prompt: imagePrompt }, parameters: { "sampleCount": 1 } };
      const apiKey = "" // If you want to use models other than imagen-3.0-generate-002, provide an API key here. Otherwise, leave this as-is.
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
        // Corrected base66 to base64 here
        const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        setGeneratedImageUrl(imageUrl);
        toast.success('Image generated successfully!', { id: 'image-gen' });
        // Optionally, add the generated image to the chat as an AI message
        onNewMessage({
          id: generateId(),
          content: `Here is an image generated from your prompt: "${imagePrompt}"`,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          imageUrl: imageUrl,
          imageMimeType: 'image/png',
        });
        setImagePrompt(''); // Clear prompt after generation
      } else {
        throw new Error('No image data received from API.');
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast.error(`Failed to generate image: ${error.message}`, { id: 'image-gen' });
    } finally {
      setIsGeneratingImage(false);
    }
  };


  // Filter documents and notes that are currently selected to display their titles
  const selectedDocumentTitles = mergedDocuments // Use mergedDocuments
    .filter(doc => selectedDocumentIds.includes(doc.id) && doc.type === 'text')
    .map(doc => doc.title);

  const selectedNoteTitles = notes
    .filter(note => selectedDocumentIds.includes(note.id)) // Notes are also documents in a sense, but separate type
    .map(note => note.title);

  const selectedImageDocuments = mergedDocuments // Use mergedDocuments
    .filter(doc => selectedDocumentIds.includes(doc.id) && doc.type === 'image');


  // NEW: Handle viewing attached files
  const handleViewAttachedFile = useCallback((doc: Document) => {
    const fileExtension = doc.file_name.split('.').pop()?.toLowerCase(); // Use file_name
    const textMimeTypes = [
      'text/plain',
      'application/json',
      'text/markdown',
      'text/csv',
      'application/xml',
      // Add more text-based MIME types as needed
    ];
    const codeExtensions = [
      'js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json', 'xml', 'sql', 'sh', 'bash'
    ];

    // Check if it's an image
    if (doc.file_type && doc.file_type.startsWith('image/')) { // Use file_type
      handleViewContent('image', undefined, undefined, doc.file_url); // Use file_url
    }
    // Check if it's a text-based file that can be displayed as code/text
    else if ((doc.file_type && textMimeTypes.includes(doc.file_type)) || (fileExtension && codeExtensions.includes(fileExtension))) { // Use file_type
      // Use content_extracted for the document's text content
      handleViewContent('document-text', doc.content_extracted || `Cannot display content for ${doc.file_name} directly. Try downloading.`, fileExtension || 'txt'); // Corrected type to 'document-text'
    }
    // For other file types, offer download or open in new tab
    else if (doc.file_url) { // Use file_url
      window.open(doc.file_url, '_blank'); // Open in new tab
      toast.info(`Opening ${doc.file_name} in a new tab.`); // Use file_name
    } else {
      toast.error(`Cannot preview or open ${doc.file_name}. No URL available.`); // Use file_name
    }
  }, [handleViewContent]);

  // Effect to clear context when activeChatSessionId changes
  // This useEffect is likely the cause of "reloading" if it fires too often.
  // We want it to fire ONLY when the activeChatSessionId actually changes to a different session.
  const prevActiveChatSessionId = useRef(activeChatSessionId);

  useEffect(() => {
    // Only clear if the session ID has actually changed AND it's not null (meaning a session is active)
    // This prevents clearing when the component first mounts with a null session, or when the session ID remains the same.
    if (activeChatSessionId !== null && activeChatSessionId !== prevActiveChatSessionId.current) {
      if (selectedDocumentIds.length > 0) {
        onSelectionChange([]); // Clear selected documents
      }
      handleRemoveImage(); // Clear selected image and its preview
      setInputMessage(''); // Clear input message
      handleCloseDiagramPanel(); // Close diagram panel when session changes
      setExpandedMessages(new Set()); // Clear expanded messages
    }
    // Update the ref for the next render
    prevActiveChatSessionId.current = activeChatSessionId;
  }, [activeChatSessionId, onSelectionChange, handleRemoveImage, handleCloseDiagramPanel, selectedDocumentIds.length]); // Add selectedDocumentIds.length to dependencies

  return (
    <>
      {/* Custom scrollbar styles */}
      <style>
        {`
          /* Custom scrollbar for modern browsers */
          .modern-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          .modern-scrollbar::-webkit-scrollbar-track {
            background: transparent; /* Make track transparent */
            border-radius: 10px;
          }

          .modern-scrollbar::-webkit-scrollbar-thumb {
            background-color: #cbd5e1; /* Light gray thumb */
            border-radius: 10px;
            border: 2px solid transparent; /* Border for spacing */
            background-clip: padding-box; /* Ensures border doesn't cover thumb color */
          }

          .modern-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #94a3b8; /* Darker on hover */
          }

          /* Dark mode scrollbar */
          .dark .modern-scrollbar::-webkit-scrollbar-thumb {
            background-color: #4b5563; /* Darker gray thumb in dark mode */
          }

          .dark .modern-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #6b7280; /* Even darker on hover in dark mode */
          }

          /* Firefox scrollbar (less customizable) */
          .modern-scrollbar {
            scrollbar-width: thin; /* "auto" or "thin" */
            scrollbar-color: #cbd5e1 transparent; /* thumb and track color */
          }

          .dark .modern-scrollbar {
            scrollbar-color: #4b5563 transparent;
          }
        `}
      </style>
      {/* Main container for chat and diagram panel */}
      <div className="flex flex-col h-full border-none relative justify-center overflow-hidden md:flex-row md:gap-6 font-sans">
        {/* Main Chat Area */}
        <div className={`relative flex flex-col h-full rounded-lg transition-all duration-300 ease-in-out
          ${isDiagramPanelOpen ? 'md:w-[35%] flex-shrink-0' : 'w-full flex-1'}
          dark:bg-gray-900
        `}>
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col modern-scrollbar pb-32 md:pb-6">
            {(displayMessages ?? []).length === 0 && (activeChatSessionId === null) && (
              <div className="text-center py-8 text-slate-400 flex-grow flex flex-col justify-center items-center dark:text-gray-500">
                <Bot className="h-12 w-12 mx-auto text-slate-300 mb-4 dark:text-gray-600" />
                <h3 className="text-lg md:text-2xl font-medium text-slate-700 mb-2 dark:text-gray-200">Welcome to your AI Study Assistant!</h3>
                <p className="text-base md:text-lg text-slate-500 max-w-md mx-auto dark:text-gray-400">
                  I can help you with questions about your notes, create study guides, explain concepts,
                  and assist with your academic work. Select some documents and start chatting!
                </p>
              </div>
            )}
            {/* NEW: Session Loading Indicator */}
            {isLoadingSessionMessages && (
              <div className="flex gap-3 justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-base md:text-lg text-slate-500 dark:text-gray-400">Loading session...</span>
              </div>
            )}
            {activeChatSessionId !== null && messages.length === 0 && !isLoadingSessionMessages && isLoading && (
              <div className="flex gap-3 justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-base md:text-lg text-slate-500 dark:text-gray-400">Loading messages...</span>
              </div>
            )}

            {/* Loading Indicator for Older Messages */}
            {isLoadingOlderMessages && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
                <span className="text-base md:text-lg text-slate-500 dark:text-gray-400">Loading older messages...</span>
              </div>
            )}

            {!isLoadingSessionMessages && (displayMessages ?? []).map((message, index) => {
              const messageDate = formatDate(message.timestamp);
              const showDateHeader = messageDate !== lastDate;
              lastDate = messageDate;

              let cardClasses = '';
              let contentToRender;
              const isLastMessage = index === displayMessages.length - 1;

              if (message.role === 'user') {
                cardClasses = 'bg-white text00 shadow-md rounded-xl border border-slate-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600';
                const isExpanded = expandedMessages.has(message.content);
                const needsExpansion = message.content.length > MAX_USER_MESSAGE_LENGTH;
                const displayedContent = needsExpansion && !isExpanded ? message.content.substring(0, MAX_USER_MESSAGE_LENGTH) + '...' : message.content;

                contentToRender = (
                  <>
                    {/* Display image if present in message history */}
                    {message.imageUrl && (
                      <div className="mb-3">
                        <img
                          src={message.imageUrl}
                          alt="Uploaded by user"
                          className="max-w-full h-auto rounded-lg shadow-md cursor-pointer border border-slate-200 dark:border-gray-600"
                          onClick={() => handleViewContent('image', undefined, undefined, message.imageUrl!)}
                          onError={(e) => {
                            e.currentTarget.src = 'https://placehold.co/150x100/e0e0e0/666666?text=Image+Error';
                            e.currentTarget.alt = 'Image failed to load';
                          }}
                        />
                      </div>
                    )}
                    <p className="mb-2 text-base md:text-lg text-slate-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap font-sans">
                      {displayedContent}
                    </p>
                    {needsExpansion && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleToggleUserMessageExpansion(message.content)}
                        className="text-blue-600 text-base md:text-base p-0 h-auto mt-1 flex items-center justify-end dark:text-blue-400 font-sans"
                      >
                        {isExpanded ? (
                          <>
                            Show Less <ChevronUp className="h-3 w-3 ml-1" />
                          </>
                        ) : (
                          <>
                            Show More <ChevronDown className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    )}
                    {/* Context Indicators for User Message */}
                    {(message.attachedDocumentIds && message.attachedDocumentIds.length > 0 || message.attachedNoteIds && message.attachedNoteIds.length > 0 || message.imageUrl) && (
                      <div className="flex flex-wrap gap-1 mt-2 justify-end">
                        {/* Image indicator for historical images that were part of the message */}
                        {message.imageUrl && ( // Only show if an image was part of this specific message
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700 flex items-center gap-1 text-base md:text-base font-sans">
                            <Image className="h-3 w-3" /> Image
                          </Badge>
                        )}
                        {message.attachedDocumentIds && message.attachedDocumentIds.length > 0 && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700 text-base md:text-base font-sans">
                            <BookOpen className="h-3 w-3 mr-1" /> {message.attachedDocumentIds.length} Docs
                          </Badge>
                        )}
                        {message.attachedNoteIds && message.attachedNoteIds.length > 0 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700 text-base md:text-base font-sans">
                            <StickyNote className="h-3 w-3 mr-1" /> {message.attachedNoteIds.length} Notes
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                );
              } else { // message.role === 'assistant'
                if (message.isError) {
                  cardClasses = ' text-red-800 dark:text-red-300';
                  contentToRender = <MemoizedMarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={handleMermaidError} onSuggestAiCorrection={handleSuggestAiCorrection} onViewDiagram={handleViewContent} onToggleUserMessageExpansion={handleToggleUserMessageExpansion} expandedMessages={expandedMessages} />;
                } else {
                  cardClasses = 'bg-white border border-slate-200 dark:bg-gray-800 dark:border-gray-700';
                  contentToRender = (
                    <>
                      {message.imageUrl && (
                        <div className="mb-3">
                          <img
                            src={message.imageUrl}
                            alt="Generated by AI"
                            className="max-w-full h-auto rounded-lg shadow-md cursor-pointer"
                            onClick={() => handleViewContent('image', undefined, undefined, message.imageUrl!)}
                            onError={(e) => {
                              e.currentTarget.src = 'https://placehold.co/150x100/e0e0e0/666666?text=Image+Error';
                              e.currentTarget.alt = 'Image failed to load';
                            }}
                          />
                        </div>
                      )}
                      <MemoizedMarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={handleMermaidError} onSuggestAiCorrection={handleSuggestAiCorrection} onViewDiagram={handleViewContent} onToggleUserMessageExpansion={handleToggleUserMessageExpansion} expandedMessages={expandedMessages} />
                    </>
                  );
                }
              }

              const isLastAIMessage = message.role === 'assistant' && index === displayMessages.length - 1;

              return (
                <React.Fragment key={message.id}>
                  {showDateHeader && (
                    <div className="flex justify-center my-4 font-sans">
                      <Badge variant="secondary" className="px-3 py-1 text-sm md:text-base text-slate-500 bg-slate-100 rounded-full shadow-sm dark:bg-gray-700 dark:text-gray-300">
                        {messageDate}
                      </Badge>
                    </div>
                  )}
                  {/* The outer div that controls the max width of the entire message row */}
                  <div className="flex justify-center font-sans">
                    {/* Apply max-w-4xl mx-auto to this div to center the entire message row */}
                    <div className={`
                      flex gap-3 group
                      ${message.role === 'user' ? 'justify-end' : 'justify-start'}
                      ${isDiagramPanelOpen ? 'w-full' : 'max-w-4xl w-full mx-auto'}
                    `}>
                      {message.role === 'assistant' && (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.isError ? 'bg-red-500' : 'bg-transparent'} hidden sm:flex dark:bg-gray-700`}>
                          {message.isError ? <AlertTriangle className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                        </div>
                      )}
                      {/* Removed sm:max-w-4xl from Card to allow it to be max-w-full of its parent */}
                      <div className={`flex flex-col flex-1 min-w-0 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <Card className={`flex flex-col max-w-full overflow-hidden rounded-lg ${message.role === 'assistant' ? 'border-none shadow-none bg-transparent dark:bg-transparent' : 'dark:bg-gray-800 dark:border-gray-700'} ${cardClasses}`}>
                          {/* Added !max-w-full to CardContent to ensure prose respects parent width */}
                          <CardContent className={`p-2 prose prose-lg border-none !max-w-full leading-relaxed dark:prose-invert overflow-x-auto`}>
                            {contentToRender}

                            {/* Render attached files if attachedDocumentIds exist */}
                            {message.attachedDocumentIds && message.attachedDocumentIds.length > 0 && (
                              <div className={`mt-3 pt-3 border-t border-dashed ${message.role === 'user' ? 'border-blue-300/50' : 'border-gray-300'} dark:border-gray-600/50`}>
                                <p className={`text-base md:text-lg font-semibold mb-2 ${message.role === 'user' ? 'text-slate-700' : 'text-slate-700'} dark:text-gray-100`}>Attached Files:</p>
                                <div className="flex flex-wrap gap-2">
                                  {message.attachedDocumentIds.map(docId => {
                                    // Use mergedDocuments for finding the document
                                    const doc = mergedDocuments.find(d => d.id === docId);
                                    return doc ? (
                                      <Badge
                                        key={doc.id}
                                        variant="secondary"
                                        className={`cursor-pointer hover:opacity-80 transition-opacity text-sm md:text-base font-sans ${doc.processing_status === 'pending' ? 'bg-yellow-500/30 text-yellow-800 border-yellow-400 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700' : doc.processing_status === 'failed' ? 'bg-red-500/30 text-red-800 border-red-400 dark:bg-red-950 dark:text-red-300 dark:border-red-700' : (message.role === 'user' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700' : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600')}`}
                                        onClick={() => handleViewAttachedFile(doc)}
                                      >
                                        {doc.processing_status === 'pending' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : doc.processing_status === 'failed' ? <AlertTriangle className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                                        {doc.file_name} {/* Use file_name here */}
                                      </Badge>
                                    ) : (
                                      <Badge key={docId} variant="destructive" className="text-sm md:text-base text-red-600 dark:text-red-400 font-sans">
                                        File Not Found: {docId}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                          {/* Moved timestamp and action buttons inside the Card */}
                          <div className={`flex gap-1 px-4 pb-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full font-sans`}>
                            <span className={`text-xs md:text-sm text-slate-500 ${message.role === 'user' ? 'text-gray-600 dark:text-gray-300' : 'text-slate-500 dark:text-gray-400'}`}>
                              {formatTime(message.timestamp)}
                            </span>
                            <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                              {message.role === 'assistant' && (
                                <>
                                  {isLastAIMessage && !isLoading && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRegenerateClick(messages[index - 1]?.content || '')} // Pass previous user message content
                                      className="h-6 w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                                      title="Regenerate response"
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copy(message.content)}
                                    className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                                    title="Copy message"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteClick(message.id)}
                                    className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
                                    title="Delete message"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {message.role === 'user' && ( // Keep delete for user messages
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(message.id)}
                                  className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
                                  title="Delete message"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              {message.role === 'assistant' && message.isError && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const prevUserMessage = messages.slice(0, index).reverse().find(msg => msg.role === 'user');
                                    if (prevUserMessage) {
                                      handleRetryClick(prevUserMessage.content, message.id);
                                    }
                                  }}
                                  className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                                  title="Retry failed message"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {isLoading && !isLoadingSessionMessages && (
              <div className="flex justify-center font-sans">
                <div className="w-full max-w-4xl flex gap-3 items-center justify-start">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="w-fit p-3 rounded-lg bg-white shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse dark:bg-gray-500"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-75 dark:bg-gray-500"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150 dark:bg-gray-500"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {isGeneratingImage && (
              <div className="flex justify-center font-sans">
                <div className="w-full max-w-4xl flex gap-3 items-center justify-start">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-pink-500 to-red-500 flex items-center justify-center">
                  {/* Replaced local image path with a placeholder and fixed animation class */}
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
          {/* Input area - now absolutely positioned within the main chat area */}
          <div className={`fixed bottom-0 left-0 right-0 p-4 sm:p-6 pb-8 bg-slate-50 shadow-lg md:shadow-none md:static md:p-0 rounded-t-lg md:rounded-lg dark:bg-gray-950 md:dark:bg-transparent font-sans z-10`}>
            {/* Display selected documents/notes/image */}
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

            <form onSubmit={handleSendMessage} className={`flex items-end gap-2 p-3 rounded-lg bg-white border border-slate-200 shadow-lg dark:bg-gray-800 dark:border-gray-700 font-sans
              ${isDiagramPanelOpen ? 'w-full mx-auto' : 'max-w-4xl w-full mx-auto'}
            `}>
              {/* Image Preview in Input Area */}
              {selectedImagePreview && (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 mr-2 mb-2">
                  <img src={selectedImagePreview} alt="Selected preview" className="w-full h-full object-cover" />
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
                onChange={(e) => {
                  setInputMessage(e.target.value);
                }}
                placeholder="Ask a question about your notes or study topics..."
                className="flex-1 text-base md:text-lg focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[48px] bg-transparent px-2 dark:text-gray-200 dark:placeholder-gray-400"
                disabled={isLoading || isSubmittingUserMessage || isGeneratingImage}
                rows={1}
              />
              <div className="flex items-end gap-2">
                {/* Hidden input for camera capture */}
                <input
                  type="file"
                  accept="image/*"
                  capture="user" // 'user' for front camera, 'environment' for rear camera
                  ref={cameraInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />
                {/* Take Picture Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => cameraInputRef.current?.click()}
                  className="text-slate-600 hover:bg-slate-100 h-10 w-10 flex-shrink-0 rounded-lg p-0 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Take Picture"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage}
                >
                  <Camera className="h-5 w-5" />
                </Button>

                {/* Image Upload Button */}
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
                  className="text-slate-600 hover:bg-slate-100 h-10 w-10 flex-shrink-0 rounded-lg p-0 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Upload Image"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage}
                >
                  <Upload className="h-5 w-5" />
                </Button>

                {/* Document/Note Selector Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDocumentSelector(true)}
                  className="text-slate-600 hover:bg-slate-100 h-10 w-10 flex-shrink-0 rounded-lg p-0 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Select Documents/Notes for Context"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage}
                >
                  <FileText className="h-5 w-5" />
                </Button>
                {/* Image Generation Button */}
                {/* <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleGenerateImageFromText}
                  className="text-pink-600 hover:bg-pink-100 h-10 w-10 flex-shrink-0 rounded-lg p-0 dark:text-pink-400 dark:hover:bg-pink-900"
                  title="Generate Image from Text"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || !inputMessage.trim()}
                >
                  <Sparkles className="h-5 w-5" />
                </Button> */}
                <Button
                  type="submit"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || (!inputMessage.trim() && !selectedImageFile)}
                  className="bg-blue-600 hover:bg-blue-900 text-white shadow-md disabled:opacity-50 h-10 w-10 flex-shrink-0 rounded-lg p-0 font-sans"
                  title="Send Message"
                >
                  {isLoading || isSubmittingUserMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </div>
          {showDocumentSelector && (
            <DocumentSelector
              documents={mergedDocuments}
              notes={notes}
              selectedDocumentIds={selectedDocumentIds}
              onSelectionChange={onSelectionChange}
              isOpen={showDocumentSelector}
              onClose={() => setShowDocumentSelector(false)}
            />
          )}
          <ConfirmationModal
            isOpen={showDeleteConfirm}
            onClose={() => {
              // setShowDeleteConfirm(false);
            }}
            onConfirm={handleConfirmDelete}
            title="Delete Message"
            message="Are you sure you want to delete this message? This action cannot be undone."
          />
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollToBottomButton && (
          <Button
            variant="outline"
            size="icon"
            onClick={scrollToBottom}
            // Adjusted bottom position for mobile (bottom-28 = 112px)
            // Dynamic right position based on panel open state
            className={`fixed bottom-28 right-6 md:bottom-8 bg-white rounded-full shadow-lg p-2 z-20 transition-all duration-300 hover:scale-105 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 font-sans
              ${isDiagramPanelOpen ? 'md:right-[calc(65%+1.5rem)]' : 'md:right-8'}
            `}
            title="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5 text-slate-600 dark:text-gray-300" />
          </Button>
        )}

        {/* Diagram/Image Panel - Conditionally rendered and responsive */}
        {isDiagramPanelOpen && (
          <div className="md:w-[65%] h-full flex-shrink-0"> {/* Wrapper div to control 60% width and full height */}
            <DiagramPanel
              key={`${activeDiagram?.content || ''}-${activeDiagram?.type || ''}-${activeDiagram?.language || ''}-${activeDiagram?.imageUrl || ''}`} // Add all relevant props to key
              diagramContent={activeDiagram?.content}
              diagramType={activeDiagram?.type || 'unknown'}
              onClose={handleCloseDiagramPanel}
              onMermaidError={handleMermaidError}
              onSuggestAiCorrection={handleSuggestAiCorrection}
              isOpen={isDiagramPanelOpen}
              language={activeDiagram?.language}
              imageUrl={activeDiagram?.imageUrl} // Pass imageUrl
              initialWidthPercentage={60} // NEW PROP: Pass initial width percentage
            />
          </div>
        )}
      </div>
    </>
  );
};

export default memo(AIChat);
