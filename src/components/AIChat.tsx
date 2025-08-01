import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, FileText, X, RefreshCw, AlertTriangle, Copy, Check, Maximize2, Minimize2, Trash2, Download, ChevronDown, ChevronUp, Image, Upload, XCircle, BookOpen, StickyNote, Camera, Volume2, Pause, Square, Mic, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { UserProfile, Document } from '../types/Document';
import { Note } from '../types/Note';
import { supabase } from '@/integrations/supabase/client';
import { DocumentSelector } from './DocumentSelector';
import { toast } from 'sonner';
import { DiagramPanel } from './DiagramPanel';
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { generateId } from '@/utils/helpers';

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

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  isError?: boolean;
  originalUserMessageContent?: string;
  imageUrl?: string;
  imageMimeType?: string;
  attachedDocumentIds?: string[];
  attachedNoteIds?: string[];
  session_id?: string;
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

interface MemoizedMessageListProps {
  messages: Message[];
  isLoading: boolean;
  isLoadingSessionMessages: boolean;
  isLoadingOlderMessages: boolean;
  hasMoreMessages: boolean;
  mergedDocuments: Document[];
  onDeleteClick: (messageId: string) => void;
  onRegenerateClick: (lastUserMessageContent: string) => void;
  onRetryClick: (originalUserMessageContent: string, failedAiMessageId: string) => void;
  onViewContent: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text', content?: string, language?: string, imageUrl?: string) => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  onToggleUserMessageExpansion: (messageContent: string) => void;
  expandedMessages: Set<string>;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  isPaused: boolean;
  speakMessage: (messageId: string, content: string) => void;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  stopSpeech: () => void;
  isDiagramPanelOpen: boolean;
}

const MemoizedMessageList = memo(({
  messages,
  isLoading,
  isLoadingSessionMessages,
  isLoadingOlderMessages,
  hasMoreMessages,
  mergedDocuments,
  onDeleteClick,
  onRegenerateClick,
  onRetryClick,
  onViewContent,
  onMermaidError,
  onSuggestAiCorrection,
  onToggleUserMessageExpansion,
  expandedMessages,
  isSpeaking,
  speakingMessageId,
  isPaused,
  speakMessage,
  pauseSpeech,
  resumeSpeech,
  stopSpeech,
  isDiagramPanelOpen,
}: MemoizedMessageListProps) => {
  let lastDate: string | null = null;

  const formatDate = useCallback((dateString: string): string => {
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
  }, []);

  const formatTime = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, []);
  const { copied, copy } = useCopyToClipboard();

  const handleViewAttachedFile = useCallback((doc: Document) => {
    const fileExtension = doc.file_name.split('.').pop()?.toLowerCase();
    const textMimeTypes = [
      'text/plain',
      'application/json',
      'text/markdown',
      'text/csv',
      'application/xml',
    ];
    const codeExtensions = [
      'js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json', 'xml', 'sql', 'sh', 'bash'
    ];

    if (doc.file_type && doc.file_type.startsWith('image/')) {
      onViewContent('image', undefined, undefined, doc.file_url);
    } else if ((doc.file_type && textMimeTypes.includes(doc.file_type)) || (fileExtension && codeExtensions.includes(fileExtension))) {
      onViewContent('document-text', doc.content_extracted || `Cannot display content for ${doc.file_name} directly. Try downloading.`, fileExtension || 'txt');
    } else if (doc.file_url) {
      window.open(doc.file_url, '_blank');
      toast.info(`Opening ${doc.file_name} in a new tab.`);
    } else {
      toast.error(`Cannot preview or open ${doc.file_name}. No URL available.`);
    }
  }, [onViewContent]);

  const MAX_USER_MESSAGE_LENGTH = 100;

  return (
    <>
      {(messages ?? []).length === 0 && !isLoadingSessionMessages && !isLoading && (
        <div className="text-center py-8 text-slate-400 flex-grow flex flex-col justify-center items-center dark:text-gray-500">
          <Bot className="h-12 w-12 mx-auto text-slate-300 mb-4 dark:text-gray-600" />
          <h3 className="text-lg md:text-2xl font-medium text-slate-700 mb-2 dark:text-gray-200">Welcome to your AI Study Assistant!</h3>
          <p className="text-base md:text-lg text-slate-500 max-w-md mx-auto dark:text-gray-400">
            I can help you with questions about your notes, create study guides, explain concepts,
            and assist with your academic work. Select some documents and start chatting or use the microphone to speak!
          </p>
        </div>
      )}
      {isLoadingSessionMessages && (
        <div className="flex gap-3 justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="text-base md:text-lg text-slate-500 dark:text-gray-400">Loading session...</span>
        </div>
      )}
      {messages.length === 0 && !isLoadingSessionMessages && isLoading && (
        <div className="flex gap-3 justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="text-base md:text-lg text-slate-500 dark:text-gray-400">Loading messages...</span>
        </div>
      )}
      {isLoadingOlderMessages && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
          <span className="text-base md:text-lg text-slate-500 dark:text-gray-400">Loading older messages...</span>
        </div>
      )}
      {messages.map((message, index) => {
        const messageDate = formatDate(message.timestamp);
        const showDateHeader = messageDate !== lastDate;
        lastDate = messageDate;

        let cardClasses = '';
        let contentToRender;
        const isLastMessage = index === messages.length - 1;

        if (message.role === 'user') {
          cardClasses = 'bg-white text00 shadow-md rounded-xl border border-slate-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600';
          const isExpanded = expandedMessages.has(message.content);
          const needsExpansion = message.content.length > MAX_USER_MESSAGE_LENGTH;
          const displayedContent = needsExpansion && !isExpanded ? message.content.substring(0, MAX_USER_MESSAGE_LENGTH) + '...' : message.content;

          contentToRender = (
            <>
              {message.imageUrl && (
                <div className="mb-3">
                  <img
                    src={message.imageUrl}
                    alt="Uploaded by user"
                    className="max-w-full h-auto rounded-lg shadow-md cursor-pointer border border-slate-200 dark:border-gray-600"
                    onClick={() => onViewContent('image', undefined, undefined, message.imageUrl!)}
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
                  onClick={() => onToggleUserMessageExpansion(message.content)}
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
              {(message.attachedDocumentIds && message.attachedDocumentIds.length > 0 || message.attachedNoteIds && message.attachedNoteIds.length > 0 || message.imageUrl) && (
                <div className="flex flex-wrap gap-1 mt-2 justify-end">
                  {message.imageUrl && (
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
        } else {
          if (message.isError) {
            cardClasses = ' text-red-800 dark:text-red-300';
            contentToRender = <MemoizedMarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} onViewDiagram={onViewContent} onToggleUserMessageExpansion={onToggleUserMessageExpansion} expandedMessages={expandedMessages} />;
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
                      onClick={() => onViewContent('image', undefined, undefined, message.imageUrl!)}
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/150x100/e0e0e0/666666?text=Image+Error';
                        e.currentTarget.alt = 'Image failed to load';
                      }}
                    />
                  </div>
                )}
                <MemoizedMarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} onViewDiagram={onViewContent} onToggleUserMessageExpansion={onToggleUserMessageExpansion} expandedMessages={expandedMessages} />
              </>
            );
          }
        }

        const isLastAIMessage = message.role === 'assistant' && index === messages.length - 1;

        return (
          <React.Fragment key={message.id}>
            {showDateHeader && (
              <div className="flex justify-center my-4 font-sans">
                <Badge variant="secondary" className="px-3 py-1 text-sm md:text-base text-slate-500 bg-slate-100 rounded-full shadow-sm dark:bg-gray-700 dark:text-gray-300">
                  {messageDate}
                </Badge>
              </div>
            )}
            <div className="flex justify-center font-sans">
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
                <div className={`flex flex-col flex-1 min-w-0 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <Card className={`flex flex-col max-w-full overflow-hidden rounded-lg ${message.role === 'assistant' ? 'border-none shadow-none bg-transparent dark:bg-transparent' : 'dark:bg-gray-800 dark:border-gray-700'} ${cardClasses}`}>
                    <CardContent className={`p-2 prose prose-lg border-none !max-w-full leading-relaxed dark:prose-invert overflow-x-auto`}>
                      {contentToRender}
                      {message.attachedDocumentIds && message.attachedDocumentIds.length > 0 && (
                        <div className={`mt-3 pt-3 border-t border-dashed ${message.role === 'user' ? 'border-blue-300/50' : 'border-gray-300'} dark:border-gray-600/50`}>
                          <p className={`text-base md:text-lg font-semibold mb-2 ${message.role === 'user' ? 'text-slate-700' : 'text-slate-700'} dark:text-gray-100`}>Attached Files:</p>
                          <div className="flex flex-wrap gap-2">
                            {message.attachedDocumentIds.map(docId => {
                              const doc = mergedDocuments.find(d => d.id === docId);
                              return doc ? (
                                <Badge
                                  key={doc.id}
                                  variant="secondary"
                                  className={`cursor-pointer hover:opacity-80 transition-opacity text-sm md:text-base font-sans ${doc.processing_status === 'pending' ? 'bg-yellow-500/30 text-yellow-800 border-yellow-400 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700' : doc.processing_status === 'failed' ? 'bg-red-500/30 text-red-800 border-red-400 dark:bg-red-950 dark:text-red-300 dark:border-red-700' : (message.role === 'user' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700' : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600')}`}
                                  onClick={() => handleViewAttachedFile(doc)}
                                >
                                  {doc.processing_status === 'pending' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : doc.processing_status === 'failed' ? <AlertTriangle className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                                  {doc.file_name}
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
                                onClick={() => onRegenerateClick(messages[index - 1]?.content || '')}
                                className="h-6 w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                                title="Regenerate response"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copy(message.content)} // Assuming 'copy' is a function from useCopyToClipboard
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                              title="Copy message"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteClick(message.id)}
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
                              title="Delete message"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {isSpeaking && speakingMessageId === message.id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={isPaused ? resumeSpeech : pauseSpeech}
                                  className="h-6 w-6 rounded-full text-slate-400 hover:text-yellow-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-yellow-400 dark:hover:bg-gray-700"
                                  title={isPaused ? "Resume speech" : "Pause speech"}
                                >
                                  {isPaused ? <Volume2 className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={stopSpeech}
                                  className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
                                  title="Stop speech"
                                >
                                  <Square className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => speakMessage(message.id, message.content)}
                                className="h-6 w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                                title="Read aloud"
                                disabled={isLoading}
                              >
                                <Volume2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {message.role === 'user' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteClick(message.id)}
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
                                onRetryClick(prevUserMessage.content, message.id);
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
    </>
  );
});

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
    return saved ? parseFloat(saved) : 65; // Default 65% of viewport
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Detect if the device is a phone
  const isPhone = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /mobile|android|iphone|ipad|tablet/i.test(userAgent) && window.innerWidth <= 768;
  }, []);

  // Initialize SpeechRecognition
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

  const { copied, copy } = useCopyToClipboard();

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

  // Auto-speak new assistant message on phones
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

  const handleToggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
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
      if (cameraInputRef.current) {
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
  }, [inputMessage, selectedImageFile, selectedImagePreview, userProfile, selectedDocumentIds, onSendMessageToBackend, onSelectionChange]);

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
  }, []);

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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      stopRecognition();
    };
  }, [stopSpeech, stopRecognition]);

  // Cleanup on session change
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
      if (selectedDocumentIds.length > 0) {
        onSelectionChange([]);
      }
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  }, [activeChatSessionId, onSelectionChange, selectedDocumentIds, stopSpeech, stopRecognition]);

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
          .modern-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          .modern-scrollbar::-webkit-scrollbar-track {
            background: transparent;
            border-radius: 10px;
          }

          .modern-scrollbar::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 10px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }

          .modern-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #94a3b8;
          }

          .dark .modern-scrollbar::-webkit-scrollbar-thumb {
            background-color: #4b5563;
          }

          .dark .modern-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #6b7280;
          }

          .modern-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 transparent;
          }

          .dark .modern-scrollbar {
            scrollbar-color: #4b5563 transparent;
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
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col modern-scrollbar pb-32 md:pb-6">
            <MemoizedMessageList
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
          <div className={`fixed bottom-0 left-0 right-0 p-4 sm:p-6 pb-8 bg-slate-50 shadow-lg md:shadow-none md:static md:p-0 rounded-t-lg md:rounded-lg dark:bg-gray-950 md:dark:bg-transparent font-sans z-10 ${isDiagramPanelOpen ? 'md:pr-[calc(1.5rem+' + panelWidth + '%*1px)]' : ''}`}>
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
                placeholder="Ask a question about your notes or study topics, or use the microphone..."
                className="flex-1 text-base md:text-lg focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[48px] bg-transparent px-2 dark:text-gray-200 dark:placeholder-gray-400"
                disabled={isLoading || isSubmittingUserMessage || isGeneratingImage}
                rows={1}
              />
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={isRecognizing ? stopRecognition : startRecognition}
                  className={`h-10 w-10 flex-shrink-0 rounded-lg p-0 ${isRecognizing ? 'mic-active text-red-600 dark:text-red-400' : 'text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                  title={isRecognizing ? 'Stop Speaking' : 'Speak Message'}
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || !recognitionRef.current}
                >
                  <Mic className="h-5 w-5" />
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  ref={cameraInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />
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
              onDocumentUpdated={onDocumentUpdated}
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

export default memo(AIChat);