import React, { memo, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { AlertTriangle, Bot, Copy, FileText, Image, RefreshCw, Trash2, Volume2, Pause, Square, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Document } from '../types/Document';
import { Message } from '../types/Class';
import { cn } from '../lib/utils'; // Assuming a utility like `cn` exists for class name management

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
    } else {
      toast.error(`Cannot preview or open ${doc.file_name}. No URL available.`);
    }
  }, [onViewContent]);

  const MAX_USER_MESSAGE_LENGTH = 50;

  return (
    <div className="flex flex-col gap-4 mb-8 bg-transparent" style={{ position: 'relative', zIndex: 1 }}>
      {messages.length === 0 && !isLoading && !isLoadingSessionMessages && !isLoadingOlderMessages && (
        <div className="text-center py-8 flex-grow flex flex-col justify-center items-center text-slate-400 dark:text-gray-500">
          <Bot className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-gray-600" />
          <h3 className="text-lg md:text-2xl font-medium text-slate-700 mb-2 dark:text-gray-200">Welcome to your AI Study Assistant!</h3>
          <p className="text-base md:text-lg text-slate-500 max-w-md mx-auto dark:text-gray-400">
            I can help with questions about your notes, create study guides, explain concepts, and assist with academic work. Select documents and start chatting or use the microphone!
          </p>
        </div>
      )}
      {messages.length === 0 && isLoadingSessionMessages && (
        <div className="flex gap-3 justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="text-base md:text-lg text-slate-500 dark:text-gray-400">Loading messages...</span>
        </div>
      )}
      {isLoadingOlderMessages && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
          <span className="text-base text-slate-500 dark:text-gray-400">Loading older messages...</span>
        </div>
      )}
      {messages.map((message, index) => {
        const messageDate = formatDate(message.timestamp);
        const showDateHeader = messageDate !== lastDate;
        lastDate = messageDate;

        const isUserMessage = message.role === 'user';
        const isLastMessage = index === messages.length - 1;
        const isExpanded = expandedMessages.has(message.content);
        const needsExpansion = isUserMessage && message.content.length > MAX_USER_MESSAGE_LENGTH;

        const cardClasses = cn(
          'flex flex-col max-w-full overflow-hidden ',
          isUserMessage
            ? 'shadow-none border-none bg-transparent  dark:text-gray-100 '
            : message.isError
              ? 'text-red-800 dark:text-red-300'
              : 'bg-transparent border-none dark:bg-transparent'
        );

        const contentToRender = isUserMessage ? (
          <>
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Generated by AI"
                className=" rounded-lg w-10 h-10"
                onClick={() => onViewContent('image', undefined, undefined, message.imageUrl!)}
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/150x100/e0e0e0/666666?text=Image+Error';
                  e.currentTarget.alt = 'Image failed to load';
                }}
              />
            )}
            <div className="bg-blue-100 text-blue-800 shadow-md border rounded-lg p-2 mt-2 border-slate-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <p className="mb-2 text-base leading-relaxed whitespace-pre-wrap font-sans text-slate-800 dark:text-gray-100">
                {needsExpansion && !isExpanded ? `${message.content.substring(0, MAX_USER_MESSAGE_LENGTH)}...` : message.content}
              </p>
              {needsExpansion && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => onToggleUserMessageExpansion(message.content)}
                  className="text-blue-600 p-0 h-auto mt-1 flex justify-end dark:text-blue-400 font-sans"
                >
                  {isExpanded ? 'Show Less' : 'Show More'}
                </Button>
              )}
              {(message.attachedDocumentIds?.length > 0 || message.attachedNoteIds?.length > 0 || message.imageUrl) && (
                <div className="flex flex-wrap gap-1 mt-2 justify-end">
                  {message.imageUrl && (
                    <Badge
                      variant="secondary"
                      className="cursor-pointer bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700 flex items-center gap-1 font-sans"
                      onClick={() => onViewContent('image', undefined, undefined, message.imageUrl!)}
                    >
                      <Image className="h-3 w-3" /> Image
                    </Badge>
                  )}
                  {message.attachedDocumentIds?.length > 0 && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700 font-sans">
                      <FileText className="h-3 w-3 mr-1" /> {message.attachedDocumentIds.length} Docs
                    </Badge>
                  )}
                  {message.attachedNoteIds?.length > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700 font-sans">
                      <FileText className="h-3 w-3 mr-1" /> {message.attachedNoteIds.length} Notes
                    </Badge>
                  )}
                </div>

              )}
            </div>
          </>
        ) : (
          <>

            <MemoizedMarkdownRenderer
              content={message.content}
              isUserMessage={false}
              onMermaidError={onMermaidError}
              onSuggestAiCorrection={onSuggestAiCorrection}
              onViewDiagram={onViewContent}
              onToggleUserMessageExpansion={onToggleUserMessageExpansion}
              expandedMessages={expandedMessages}
            />
          </>
        );

        return (
          <React.Fragment key={message.id}>
            {showDateHeader && (
              <div className="flex justify-center my-4">
                <Badge variant="secondary" className="px-3 py-1 text-sm text-slate-500 bg-slate-100 rounded-full shadow-sm dark:bg-gray-700 dark:text-gray-300">
                  {messageDate}
                </Badge>
              </div>
            )}
            <div className={cn('flex gap-3 group', isDiagramPanelOpen ? 'w-full' : 'max-w-4xl w-full mx-auto', isUserMessage ? 'justify-end' : 'justify-start')}>
              {message.role === 'assistant' && (
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 hidden sm:flex', message.isError ? 'bg-red-500' : 'bg-transparent dark:bg-gray-700')}>
                  {message.isError ? <AlertTriangle className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                </div>
              )}
              <div className={cn('flex flex-col flex-1 min-w-0', isUserMessage ? 'items-end' : 'items-start')}>
                <Card className={cardClasses}>
                  <CardContent className="p-2 prose prose-lg !max-w-full leading-relaxed dark:prose-invert overflow-x-auto">
                    {contentToRender}

                  </CardContent>
                  <div className={cn('flex gap-1 px-4 pb-2', isUserMessage ? 'justify-end' : 'justify-start')}>
                    <span className={cn('text-xs text-slate-500', isUserMessage ? 'text-gray-600 dark:text-gray-300' : 'text-slate-500 dark:text-gray-400')}>
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
                </Card>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
});