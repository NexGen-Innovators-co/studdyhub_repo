import React, { memo, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { AlertTriangle, Bot, Copy, FileText, Image, RefreshCw, Trash2, Volume2, Pause, Square, BookOpen, StickyNote, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Document } from '../types/Document';
import { Message } from '../types/Class';

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
          <Loader2
           className="h-6 w-6 animate-spin text-blue-500" />
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
                    <Badge 
                      variant="secondary" 
                      className="cursor-pointer hover:opacity-80 transition-opacity bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700 flex items-center gap-1 text-base md:text-base font-sans"
                      onClick={() => onViewContent('image', undefined, undefined, message.imageUrl!)}
                    >
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