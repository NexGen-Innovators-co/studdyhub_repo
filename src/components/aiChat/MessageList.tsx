import React, { memo, useCallback, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Copy, FileText, Image, RefreshCw, Trash2, Volume2, Pause, Square, X, Loader2, StickyNote, User } from 'lucide-react';
import { toast } from 'sonner';
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';
import { EnhancedMarkdownRenderer } from '../EnhancedMarkdownRenderer';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { Document } from '../../types/Document';
import { Message } from '../../types/Class';
import { cn } from '../../lib/utils';
import BookPagesAnimation from '../bookloader';
import AIBot from '../ui/aibot';

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
  onViewContent: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text' | 'html' | 'slides', content?: string, language?: string, imageUrl?: string) => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering' | 'timeout' | 'network') => void;
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
  autoTypeInPanel?: boolean;
  onBlockDetected?: (blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => void;
  onBlockUpdate?: (blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => void;
  onBlockEnd?: (blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => void;
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
  autoTypeInPanel,
  onBlockDetected,
  onBlockUpdate,
  onBlockEnd,
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

  const [documentsToView, setDocumentsToView] = useState<string[]>([]);
  const [notesToView, setNotesToView] = useState<string[]>([]);
  const [imageToView, setImageToView] = useState<string | null>(null);

  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isNoteViewerOpen, setIsNoteViewerOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const handleViewAttachedFile = (type: 'documents' | 'notes' | 'image', ids: string[] | string) => {
    switch (type) {
      case 'documents':
        setDocumentsToView(Array.isArray(ids) ? ids : [ids]);
        setIsDocumentViewerOpen(true);
        break;
      case 'notes':
        setNotesToView(Array.isArray(ids) ? ids : [ids]);
        setIsNoteViewerOpen(true);
        break;
      case 'image':
        setImageToView(typeof ids === 'string' ? ids : (ids[0] ?? null));
        setIsImageViewerOpen(true);
        break;
      default:
        console.warn('Unknown attachment type', type);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8 bg-transparent px-2 sm:px-4 md:px-0" style={{ position: 'relative', zIndex: 1 }}>
      {messages.length === 0 && isLoadingSessionMessages && (
        <div className="flex flex-col items-center justify-center py-6 sm:py-8">
          <BookPagesAnimation size="lg" text="Loading messages..." />
        </div>
      )}

      {isLoadingOlderMessages && (
        <div className="flex justify-center py-3 sm:py-4">
          <BookPagesAnimation size="sm" text="Loading older messages..." />
        </div>
      )}

      {messages.map((message, index) => {
        const messageDate = formatDate(message.timestamp);
        const showDateHeader = messageDate !== lastDate;
        lastDate = messageDate;

        const isUserMessage = message.role === 'user';
        const isLastMessage = index === messages.length - 1;
        const isMessageExpanded = expandedMessages.has(message.content);

        const contentToRender = isUserMessage ? (
          <>
            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 justify-end">
              {message.attachedDocumentIds && message.attachedDocumentIds.length > 0 && (
                <div
                  className="flex items-center gap-1 text-xs text-slate-500 font-claude hover:text-blue-500 cursor-pointer transition-colors"
                  onClick={() => handleViewAttachedFile('documents', message.attachedDocumentIds)}
                >
                  <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                  <span className="text-xs">{message.attachedDocumentIds.length} doc{message.attachedDocumentIds.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {message.attachedNoteIds && message.attachedNoteIds.length > 0 && (
                <div
                  className="flex items-center gap-1 text-xs text-slate-500 font-claude hover:text-blue-500 cursor-pointer transition-colors"
                  onClick={() => handleViewAttachedFile('notes', message.attachedNoteIds)}
                >
                  <StickyNote className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                  <span className="text-xs">{message.attachedNoteIds.length} note{message.attachedNoteIds.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {message.imageUrl && (
                <div
                  className="flex items-center gap-1 text-xs text-slate-500 font-claude hover:text-blue-500 cursor-pointer transition-colors"
                  onClick={() => handleViewAttachedFile('image', message.imageUrl)}
                >
                  <Image className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                  <span className="text-xs">Image</span>
                </div>
              )}
            </div>
            <div className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 p-2 sm:p-3 rounded-lg border border-blue-200 dark:border-blue-800 max-w-full font-claude leading-relaxed break-words whitespace-pre-wrap overflow-auto">
              {message.content.length > 200 && !isMessageExpanded ? (
                <>
                  <span>{message.content.substring(0, 200)}...</span>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onToggleUserMessageExpansion(message.content)}
                    className="text-blue-600 p-0 h-auto mt-1 flex justify-end dark:text-blue-400 font-claude underline text-xs sm:text-sm"
                  >
                    View More
                  </Button>
                </>
              ) : (
                <>
                  {message.content}
                  {message.content.length > 200 && isMessageExpanded && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => onToggleUserMessageExpansion(message.content)}
                      className="text-blue-600 p-0 h-auto mt-1 flex justify-end dark:text-blue-400 font-claude underline text-xs sm:text-sm"
                    >
                      View Less
                    </Button>
                  )}
                </>
              )}
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
              autoTypeInPanel={autoTypeInPanel}
              onBlockDetected={onBlockDetected}
              onBlockUpdate={onBlockUpdate}
              onBlockEnd={onBlockEnd}
              isDiagramPanelOpen={isDiagramPanelOpen}

            />
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
              <div className="flex justify-center my-3 sm:my-4">
                <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-slate-500 bg-slate-100 rounded-full shadow-sm dark:bg-gray-700 dark:text-gray-300 font-claude">
                  {messageDate}
                </Badge>
              </div>
            )}
            <div className={cn(
              'flex gap-1 sm:gap-2 group',
              isDiagramPanelOpen ? 'w-full' : 'max-w-full sm:max-w-4xl w-full mx-auto',
              isUserMessage ? 'justify-end' : 'justify-start'
            )}>
              {message.role === 'assistant' && (
                <AIBot size="lg" isError={message.isError} className='hidden sm:block flex-shrink-0' />
              )}
              {message.role === 'user' && (
                <div className="hidden sm:flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 order-2 flex-shrink-0">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div className={cn('flex flex-col flex-1 min-w-0', isUserMessage ? 'items-end' : 'items-start')}>
                {isUserMessage ? (
                  <div className="max-w-[280px] xs:max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl">
                    {contentToRender}
                  </div>
                ) : (
                  <div className="min-w-0 max-w-full break-words whitespace-pre-wrap overflow-auto">
                    {contentToRender}
                  </div>
                )}
                <div className={cn('flex gap-1 px-2 sm:px-4 pb-2 sm:pb-3', isUserMessage ? 'justify-end' : 'justify-start')}>
                  <span className={cn('text-xs font-claude', isUserMessage ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400')}>
                    {formatTime(message.timestamp)}
                  </span>
                  <div className="flex gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {message.role === 'assistant' && (
                      <>
                        {isLastMessage && !isLoading && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRegenerateClick(messages[index - 1]?.content || '')}
                            className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                            title="Regenerate response"
                          >
                            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copy(message.content)}
                          className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                          title="Copy message"
                        >
                          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteClick(message.id)}
                          className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
                          title="Delete message"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        {isSpeaking && speakingMessageId === message.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={isPaused ? resumeSpeech : pauseSpeech}
                              className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-yellow-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-yellow-400 dark:hover:bg-gray-700"
                              title={isPaused ? "Resume speech" : "Pause speech"}
                            >
                              {isPaused ? <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" /> : <Pause className="h-3 w-3 sm:h-4 sm:w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={stopSpeech}
                              className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
                              title="Stop speech"
                            >
                              <Square className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => speakMessage(message.id, message.content)}
                            className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                            title="Read aloud"
                            disabled={isLoading}
                          >
                            <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        )}
                      </>
                    )}
                    {isUserMessage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteClick(message.id)}
                        className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
                        title="Delete message"
                      >
                        <X className="h-3 w-3 sm:h-4 sm:w-4" />
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
                        className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                        title="Retry failed message"
                      >
                        <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
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