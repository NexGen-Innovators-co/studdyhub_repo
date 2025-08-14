import React, { memo, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { AlertTriangle, Copy, FileText, Image, RefreshCw, Trash2, Volume2, Pause, Square, X, Loader2, StickyNote, User } from 'lucide-react';
import { toast } from 'sonner';
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Document } from '../types/Document';
import { Message } from '../types/Class';
import { cn } from '../lib/utils';
import BookPagesAnimation from './bookloader';
import AIBot from './aibot';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isLoadingSessionMessages: boolean;
  isLoadingOlderMessages: boolean;
  hasMoreMessages: boolean;
  mergedDocuments: Document[];
  onDeleteClick: (messageId: string) => void;
  onRegenerateClick: (lastUserMessageContent: string) => void;
  onRetryClick: (originalUserMessageContent: string, failedAiMessageId: string) => void;
  onViewContent: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text' | 'html', content?: string, language?: string, imageUrl?: string) => void;
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
  enableTypingAnimation?: boolean;
  onMarkMessageDisplayed: (messageId: string) => void;
}

export const MessageList = memo(({
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
  enableTypingAnimation = true,
  onMarkMessageDisplayed,
}: MessageListProps) => {
  let lastDate: string | null = null;

  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today.setDate(today.getDate() - 1));

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const formatTime = useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, []);

  const { copied, copy } = useCopyToClipboard();

  const handleViewAttachedFile = useCallback((doc: Document) => {
    const fileExtension = doc.file_name.split('.').pop()?.toLowerCase();
    const isTextFile = doc.file_type && [
      'text/plain', 'application/json', 'text/markdown', 'text/csv', 'application/xml', 'text/html',
    ].includes(doc.file_type) || fileExtension && [
      'js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json', 'xml', 'sql', 'sh', 'bash',
    ].includes(fileExtension);

    if (doc.file_type?.startsWith('image/')) {
      onViewContent('image', undefined, undefined, doc.file_url);
    } else if (isTextFile) {
      onViewContent(doc.file_type === 'text/html' || fileExtension === 'html' ? 'html' : 'document-text', doc.content_extracted || `Cannot display content for ${doc.file_name}. Try downloading.`, fileExtension || 'txt');
    } else if (doc.file_url) {
      window.open(doc.file_url, '_blank');
      toast.info(`Opening ${doc.file_name} in a new tab.`);
    }
  }, [onViewContent]);

  return (
    <div className="flex flex-col gap-4 mb-8 bg-transparent" style={{ position: 'relative', zIndex: 1 }}>
      {/* {messages.length === 0 && !isLoading && !isLoadingSessionMessages && !isLoadingOlderMessages && (
        <div className="text-center py-8 flex-grow flex flex-col justify-center items-center text-slate-400 dark:text-gray-500">
          <BookPagesAnimation size="xl" showText={false} className="mb-6" />
          <h3 className="text-lg md:text-2xl font-medium text-slate-700 mb-2 dark:text-gray-200 font-claude">Welcome to your AI Study Assistant!</h3>
          <p className="text-base md:text-lg text-slate-500 max-w-md mx-auto dark:text-gray-400 font-claude leading-relaxed">
            I can help with questions about your notes, create study guides, explain concepts, and assist with academic work. Select documents and start chatting or use the microphone!
          </p>
        </div>
      )} */}

      {messages.length === 0 && isLoadingSessionMessages && (
        <div className="flex flex-col items-center justify-center py-8">
          <BookPagesAnimation size="lg" text="Loading messages..." />
        </div>
      )}

      {isLoadingOlderMessages && (
        <div className="flex justify-center py-4">
          <BookPagesAnimation size="sm" text="Loading older messages..." />
        </div>
      )}

      {messages.map((message, index) => {
        const messageDate = formatDate(message.timestamp);
        const showDateHeader = messageDate !== lastDate;
        lastDate = messageDate;

        const isUserMessage = message.role === 'user';
        const isLastMessage = index === messages.length - 1;

        const contentToRender = isUserMessage ? (
          <>
            <div className="flex items-center gap-2 mb-2 justify-end">
              {message.attachedDocumentIds && message.attachedDocumentIds.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-500 font-claude">
                  <FileText className="h-3 w-3" />
                  <span>{message.attachedDocumentIds.length} doc{message.attachedDocumentIds.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {message.attachedNoteIds && message.attachedNoteIds.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-500 font-claude">
                  <StickyNote className="h-3 w-3" />
                  <span>{message.attachedNoteIds.length} note{message.attachedNoteIds.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {message.imageUrl && (
                <div className="flex items-center gap-1 text-xs text-slate-500 font-claude">
                  <Image className="h-3 w-3" />
                  <span>Image</span>
                </div>
              )}
            </div>
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl font-claude leading-relaxed">
              {message.content.length > 200 ? (
                <>
                  <span>{message.content.substring(0, 200)}...</span>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onToggleUserMessageExpansion(message.content)}
                    className="text-blue-600 p-0 h-auto mt-1 flex justify-end dark:text-blue-400 font-claude underline"
                  >
                    View More
                  </Button>
                </>
              ) : (
                message.content
              )}
              {/* Show loading indicator for optimistic messages only if they don't have content */}
              {message.id.startsWith('optimistic-') && !message.content && (
                <div className="flex items-center gap-2 mt-2 text-xs text-blue-600 dark:text-blue-400 font-claude">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Sending...</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <MemoizedMarkdownRenderer
              content={message.content}
              messageId={message.id}
              isUserMessage={false}
              onMermaidError={onMermaidError}
              onSuggestAiCorrection={onSuggestAiCorrection}
              onViewDiagram={onViewContent}
              onToggleUserMessageExpansion={onToggleUserMessageExpansion}
              expandedMessages={expandedMessages}
              enableTyping={enableTypingAnimation && !isLoading}
              isLastMessage={isLastMessage}
              onTypingComplete={onMarkMessageDisplayed}
              isAlreadyTyped={message.has_been_displayed}
            />
            {/* Show loading indicator for optimistic AI messages only if they have minimal content */}
            {message.id.startsWith('optimistic-ai-') && message.content.length < 10 && (
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-claude">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Processing response...</span>
              </div>
            )}
          </>
        );

        return (
          <React.Fragment key={message.id}>
            {showDateHeader && (
              <div className="flex justify-center my-4">
                <Badge variant="secondary" className="px-3 py-1 text-sm text-slate-500 bg-slate-100 rounded-full shadow-sm dark:bg-gray-700 dark:text-gray-300 font-claude">
                  {messageDate}
                </Badge>
              </div>
            )}
            <div className={cn('flex gap-1 group', isDiagramPanelOpen ? 'w-full' : 'max-w-4xl w-full mx-auto', isUserMessage ? 'justify-end' : 'justify-start')}>
      {message.role === 'assistant' && (
        <AIBot size="lg" isError={message.isError} className='hidden sm:block' />
      )}
      {message.role === 'user' && (
        <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 order-2">
          <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
      )}
              <div className={cn('flex flex-col flex-1 min-w-0', isUserMessage ? 'items-end' : 'items-start')}>
                {isUserMessage ? (
                  <div className="max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl">
                    {contentToRender}
                  </div>
                ) : (
                  <div className="w-full">
                    {contentToRender}
                  </div>
                )}
                <div className={cn('flex gap-1 px-4 pb-3', isUserMessage ? 'justify-end' : 'justify-start')}>
                  <span className={cn('text-xs font-claude', isUserMessage ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400')}>
                    {formatTime(message.timestamp)}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {message.role === 'assistant' && (
                      <>
                        {isLastMessage && !isLoading && (
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
                          onClick={() => copy(message.content)}
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
                    {isUserMessage && (
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
                          if (prevUserMessage) onRetryClick(prevUserMessage.content, message.id);
                        }}
                        className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                        title="Retry failed message"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
});