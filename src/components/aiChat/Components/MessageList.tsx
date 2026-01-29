import React, { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Copy, FileText, Image, RefreshCw, Trash2, Volume2, Pause, Square, X, Loader2, StickyNote, User, File, Download, Check, Paperclip, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Document } from '../../../types/Document';
import { Message } from '../../../types/Class';
import { cn } from '../utils/cn';
import BookPagesAnimation from '../../ui/bookloader';
import AIBot from '../../ui/aibot';
import { Note } from '@/types';
import { ThinkingStepsDisplay } from './ThinkingStepsDisplayModern';

interface AttachedFile {
    id?: string;
    name: string;
    mimeType: string;
    data?: string | null;
    url?: string;
    type: 'image' | 'document' | 'other';
    size?: number;
    content?: string | null;
    processing_status?: string;
    processing_error?: string | null;
    status?: string;
    error?: string | null;
}

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
    expandedMessages: string[];
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
    onDiagramCodeUpdate: (messageId: string, newCode: string) => Promise<void>;
    onEditClick?: (message: Message) => void;
}

const getFileIcon = (file: AttachedFile) => {
    switch (file.type) {
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

const parseAttachedFiles = (message: Message): AttachedFile[] => {
    let files: AttachedFile[] = [];
    if (message.files_metadata) {
        try {
            const metadata = typeof message.files_metadata === 'string'
                ? JSON.parse(message.files_metadata)
                : message.files_metadata;
            const metadataArray = Array.isArray(metadata) ? metadata : [metadata];
            files = metadataArray.map((file: any) => {
                return {
                    id: file.id,
                    name: file.name || 'Unknown file',
                    mimeType: file.mimeType || 'application/octet-stream',
                    url: file.url,
                    data: file.data,
                    type: file.type === 'image' || (file.mimeType && file.mimeType.startsWith('image/')) ? 'image' :
                        file.type === 'document' || (file.mimeType && (
                            file.mimeType.includes('text/') ||
                            file.mimeType.includes('application/pdf') ||
                            file.mimeType.includes('application/msword') ||
                            file.mimeType.includes('application/vnd.')
                        )) ? 'document' : 'other',
                    size: file.size,
                    content: file.content,
                    processing_status: file.processing_status,
                    processing_error: file.processing_error,
                    status: file.status,
                    error: file.error
                };
            });
        } catch (error) {
            //console.error('Error parsing files_metadata:', error);
            toast.error('Failed to parse file metadata.');
        }
    }
    if (files.length === 0 && message.attachedFiles) {
        try {
            const attachedFiles = typeof message.attachedFiles === 'string'
                ? JSON.parse(message.attachedFiles)
                : message.attachedFiles;
            files = Array.isArray(attachedFiles) ? attachedFiles : [attachedFiles];
        } catch (error) {
            //console.error('Error parsing attachedFiles:', error);
            toast.error('Failed to parse attached files.');
        }
    }
    if (files.length === 0 && message.image_url) {
        const imageName = message.image_url.split('/').pop() || 'image';
        files.push({
            name: imageName,
            mimeType: message.image_mime_type || 'image/jpeg',
            url: message.image_url,
            type: 'image',
            status: 'completed'
        });
    }

    return files;
};

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
    onDiagramCodeUpdate,
    onEditClick,
}: MessageListProps) => {
    const lastDateRef = useRef<string | null>(null);

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

    const handleViewAttachedFile = useCallback((type: 'documents' | 'notes' | 'image', ids: string[] | string) => {
        if (type === 'documents') {
            const docIds = Array.isArray(ids) ? ids : [ids];
            const docs = mergedDocuments.filter(doc => docIds.includes(doc.id));
            if (docs.length > 0) {
                const doc = docs[0];

                if (doc.processing_status === 'processing') {
                    toast.info('Document is still processing, please wait.');
                    return;
                }

                if (doc.processing_status === 'failed' || !doc.content_extracted) {
                    toast.error('No viewable content for this document or processing failed.');
                    return;
                }

                if (doc.type === 'image' && doc.file_url) {
                    onViewContent('image', undefined, undefined, doc.file_url);
                } else if (doc.content_extracted) {
                    const extension = doc.title.split('.').pop()?.toLowerCase();
                    const languageMap: { [key: string]: string } = {
                        'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
                        'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp',
                        'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'swift': 'swift',
                        'kt': 'kotlin', 'scala': 'scala', 'sql': 'sql', 'html': 'html', 'css': 'css',
                        'scss': 'scss', 'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
                        'md': 'markdown', 'txt': 'text', 'log': 'text'
                    };
                    const language = extension && languageMap[extension] ? languageMap[extension] : 'text';
                    onViewContent('document-text', doc.content_extracted, language);
                } else {
                    toast.error('No viewable content for this document.');
                }
            } else {
                toast.error('Document not found.');
            }
        } else if (type === 'notes') {
            const noteIds = Array.isArray(ids) ? ids : [ids];
            const note = mergedDocuments.find(doc => noteIds.includes(doc.id));
            if (note && note.content_extracted) {
                onViewContent('document-text', note.content_extracted, 'text');
            } else {
                toast.error('No viewable content for this note.');
            }
        } else if (type === 'image') {
            const imageUrl = typeof ids === 'string' ? ids : ids[0];
            if (imageUrl) {
                onViewContent('image', undefined, undefined, imageUrl);
            } else {
                toast.error('No image URL available.');
            }
        }
    }, [onViewContent, mergedDocuments]);

    const handleFilePreview = useCallback((file: AttachedFile) => {
        if (file.type === 'image') {
            const imageUrl = file.url || (file.data ? `data:${file.mimeType};base64,${file.data}` : null);
            if (imageUrl) {
                onViewContent('image', undefined, undefined, imageUrl);
            } else {
                toast.error('No image data available for preview.');
            }
        } else if (file.type === 'document' && file.content) {
            onViewContent('document-text', file.content, 'text');
        } else {
            const fileInfo = `File: ${file.name}\n${file.size ? `Size: ${formatFileSize(file.size)}\n` : ''}Type: ${file.mimeType}`;
            onViewContent('document-text', fileInfo, 'text');
        }
    }, [onViewContent]);

    const handleDiagramCodeUpdate = useCallback(async (messageId: string, newCode: string) => {
        try {
            await onDiagramCodeUpdate(messageId, newCode);
            toast.success('Diagram code updated successfully!');
        } catch (error: any) {
            //console.error('Error updating diagram code:', error);
            toast.error(`Failed to update diagram code: ${error.message || 'Unknown error'}`);
        }
    }, [onDiagramCodeUpdate]);

    // Memoize attachments for all messages up front
    const memoizedAttachments = useMemo(() => {
        return messages.map(message => {
            const attachedFiles = parseAttachedFiles(message);
            const attachedDocumentTitles = message.attachedDocumentIds?.map(id => {
                const doc = mergedDocuments.find(d => d.id === id);
                return { id, name: doc ? doc.title : 'loading document...', type: 'document' as const, doc, processing_status: doc?.processing_status, processing_error: doc?.processing_error };
            }) || [];
            const attachedNoteTitles = message.attachedNoteIds?.map(id => {
                const note = mergedDocuments.find(d => d.id === id);
                return { id, name: note ? note.title : 'loading Note...', type: 'note' as const };
            }) || [];
            return { attachedFiles, attachedDocumentTitles, attachedNoteTitles };
        });
    }, [messages, mergedDocuments]);

    const renderAttachments = useCallback((message: Message, attachments: { attachedFiles: any[]; attachedDocumentTitles: any[]; attachedNoteTitles: any[] }) => {
        const { attachedFiles, attachedDocumentTitles, attachedNoteTitles } = attachments;
        const hasAttachments = attachedFiles.length > 0 || attachedDocumentTitles.length > 0 || attachedNoteTitles.length > 0;
        if (!hasAttachments) return null;

        const allAttachments = [
            ...attachedFiles.map(file => ({
                id: file.id || `file-${file.name}`,
                name: file.name,
                type: 'file' as const,
                file,
                onClick: () => handleFilePreview(file),
                icon: getFileIcon(file),
                processing: file.processing_status === 'processing' || file.status === 'processing',
                error: file.processing_error || file.error
            })),
            ...attachedDocumentTitles.map(doc => ({
                id: doc.id,
                name: doc.name,
                type: 'document' as const,
                onClick: () => handleViewAttachedFile('documents', doc.id),
                icon: <FileText className="h-3 w-3" />,
                processing: doc.processing_status === 'processing' || false,
                error: doc.processing_error || false,
                doc
            })),
            ...attachedNoteTitles.map(note => ({
                id: note.id,
                name: note.name,
                type: 'note' as const,
                onClick: () => handleViewAttachedFile('notes', note.id),
                icon: <StickyNote className="h-3 w-3" />,
                processing: false,
                error: false
            }))
        ];

        return (
            <div className="min-w-0 max-w-sm overflow-scroll justify-end ">
                <div className="flex flex-row gap-3">
                    {allAttachments.map((attachment, idx) => {
                        const uniqueKey = `${message.id}-attachment-${attachment.id}-${idx}`;

                        if (attachment.type === 'file' && attachment.file?.type === 'image') {
                            const imageUrl = attachment.file.url ||
                                (attachment.file.data ? `data:${attachment.file.mimeType};base64,${attachment.file.data}` : null);

                            return (
                                <div
                                    key={uniqueKey}
                                    className="relative flex-shrink-0 cursor-pointer group"
                                    onClick={() => {
                                        if (attachment.processing) {
                                            toast.info('File is still processing, please wait.');
                                            return;
                                        }
                                        if (attachment.error) {
                                            toast.error('Cannot preview file due to processing error.');
                                            return;
                                        }
                                        attachment.onClick();
                                    }}
                                    title={attachment.name}
                                >
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-700 shadow-sm hover:shadow-md ">
                                        {imageUrl ? (
                                            <img
                                                src={imageUrl}
                                                alt={attachment.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = 'https://placehold.co/400x300/e0e0e0/555555?text=Error';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                {attachment.icon}
                                            </div>
                                        )}
                                    </div>

                                    {attachment.processing && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                            <Loader2 className="h-2 w-2 animate-spin text-white" />
                                        </div>
                                    )}
                                    {attachment.error && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                            <X className="h-2 w-2 text-white" />
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div
                                key={uniqueKey}
                                className="relative flex-shrink-0 cursor-pointer group"
                                onClick={() => {
                                    if (attachment.processing) {
                                        toast.info('File is still processing, please wait.');
                                        return;
                                    }
                                    attachment.onClick();
                                }}
                                title={attachment.name}
                            >
                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all duration-200 hover:scale-105 min-w-0">
                                    <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
                                        {attachment.icon}
                                    </div>
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate max-w-[80px]">
                                        {attachment.name.length > 12 ? `${attachment.name.substring(0, 12)}...` : attachment.name}
                                    </span>

                                    {attachment.type !== 'file' && (
                                        <div className="flex-shrink-0">
                                            <Badge
                                                variant="secondary"
                                                className="text-xs px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
                                            >
                                                {attachment.type === 'document' ? 'DOC' : 'NOTE'}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {attachment.processing && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                        <Loader2 className="h-2 w-2 animate-spin text-white" />
                                    </div>
                                )}

                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }, [mergedDocuments, handleFilePreview, handleViewAttachedFile, getFileIcon]);
 
    const renderMessage = useCallback((message: Message, index: number) => {
        const isUserMessage = message.role === 'user';
        const isLastMessage = index === messages.length - 1;
        const isMessageExpanded = expandedMessages.includes(message.content);
        const messageDate = formatDate(message.timestamp);
        const showDateHeader = lastDateRef.current !== messageDate;
        lastDateRef.current = messageDate;

        // Skip rendering loading states for non-last messages for performance
        if (message.isLoading && index !== messages.length - 1) {
            return null;
        }

        let contentToRender;

        if (isUserMessage) {
            // Find the memoized attachments for this message
            const attachments = memoizedAttachments[index] || { attachedFiles: [], attachedDocumentTitles: [], attachedNoteTitles: [] };
            contentToRender = (
                <>
                    <div className="flex flex-col gap-3 max-w-xs sm:max-w-lg overflow-x-auto items-end justify-items-end">
                        {renderAttachments(message, attachments)}
                        <div className=" text-md text-slate-700 right-0 dark:text-slate-300 bg-slate-500/10 dark:bg-slate-950/30 p-2 sm:p-3 rounded-lg border border-slate-200/5 dark:border-blue-800 max-w-xs font-claude leading-relaxed break-words whitespace-pre-wrap overflow-auto">

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
                    </div>

                </>
            );
        } else {
            contentToRender = (
                <>
                    {/* Show thinking steps during streaming, or loader for non-streaming */}
                    {message.thinking_steps && message.thinking_steps.length > 0 ? (
                        <div className="mb-4">
                            <ThinkingStepsDisplay
                                steps={message.thinking_steps}
                                isStreaming={message.isStreaming || false}
                            />
                        </div>
                    ) : (message.isLoading || (message.id.startsWith('optimistic-ai-') && !message.content)) ? (
                        <div className="flex items-center gap-3 my-4">
                            <BookPagesAnimation size="md" showText={true} text='Generating response' />
                        </div>
                    ) : null}

                    {/* Message content */}
                    {message.content && (
                        <>
                            {message.isError ? (
                                <div className="p-3 rounded-lg border border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-claude text-sm sm:text-base">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="font-semibold">Error:</span>
                                    </div>
                                    <p className="leading-relaxed">There was a problem generating this response</p>
                                    {isLastMessage && (
                                        <div className="mt-3 flex justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onRetryClick(messages[index - 1]?.content, message.content || '')}
                                                className="text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50"
                                            >
                                                Retry
                                            </Button>

                                        </div>)
                                    }
                                </div>
                            ) : (
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
                                    onDiagramCodeUpdate={handleDiagramCodeUpdate}
                                />
                            )}
                            {message.id.startsWith('optimistic-ai-') && message.content.length < 10 && (
                                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-claude">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Processing response...</span>
                                </div>
                            )}
                        </>
                    )}
                </>
            );
        }

        return (
            <React.Fragment key={message.id}>
                {showDateHeader && (
                    <div className="flex justify-center my-3 sm:my-4">
                        <Badge
                            variant="secondary"
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-slate-500 bg-slate-100 rounded-full shadow-sm dark:bg-gray-700 dark:text-gray-300 font-claude"
                            aria-label={`Date: ${messageDate}`}
                        >
                            {messageDate}
                        </Badge>
                    </div>
                )}
                <div
                    className={cn(
                        'flex gap-1 sm:gap-2 group',
                        isDiagramPanelOpen ? 'w-full' : 'max-w-full sm:max-w-4xl w-full mx-auto',
                        isUserMessage ? 'justify-end' : 'justify-start'
                    )}
                    aria-label={isUserMessage ? `User message: ${message.content}` : `Assistant message: ${message.content}`}
                >
                    {message.role === 'assistant' && isSpeaking && speakingMessageId === message.id ? (
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
                    ) : (message.role === 'assistant' && !isSpeaking && !message.isLoading && !(message.id.startsWith('optimistic-ai-') && !message.content) &&
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => speakMessage(message.id, message.content)}
                                className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                                title="Speak message"
                            >
                                <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                        </>
                    )}

                    <div className={cn('flex flex-col flex-1 min-w-0', isUserMessage ? 'items-end' : 'items-start')}>
                        {isUserMessage ? (
                            <div className="min-w-0 max-w-lg break-words whitespace-pre-wrap overflow-auto">
                                {contentToRender}
                            </div>
                        ) : (
                            <div className="min-w-0 max-w-full break-words whitespace-pre-wrap overflow-auto">
                                {contentToRender}
                            </div>
                        )}

                        {!message.isLoading && !(message.id.startsWith('optimistic-ai-') && !message.content) && (
                            <div className={cn('flex gap-1 px-2 sm:px-4 pb-2 sm:pb-3', isUserMessage ? 'justify-end' : 'justify-start')}>
                                <span className={cn('text-xs font-claude', isUserMessage ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400')}>
                                    {formatTime(message.timestamp)}
                                </span>
                                <div className="flex gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {message.role === 'user' && onEditClick && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEditClick(message)}
                                            className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                                            title="Edit and resend"
                                        >
                                            <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                                        </Button>
                                    )}
                                    {message.role === 'assistant' && (
                                        <>
                                            {isLastMessage && !isLoading && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onRegenerateClick(messages[index - 1]?.content || '')}
                                                        className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                                                        title="Regenerate response"
                                                    >
                                                        <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    </Button>

                                                </>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => copy(message.content)}
                                                className="h-5 w-5 sm:h-6 sm:w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                                                title="Copy message"
                                            >
                                                {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </React.Fragment>
        );
    }, [
        formatDate, formatTime, onToggleUserMessageExpansion, expandedMessages, onMermaidError, onSuggestAiCorrection,
        onViewContent, enableTypingAnimation, isLoading, onMarkMessageDisplayed, autoTypeInPanel, onBlockDetected,
        onBlockUpdate, onBlockEnd, isDiagramPanelOpen, handleDiagramCodeUpdate, onRegenerateClick, copy, onDeleteClick,
        onEditClick,
        isSpeaking, speakingMessageId, isPaused, resumeSpeech, pauseSpeech, stopSpeech, speakMessage, renderAttachments,
        messages
    ]);

// NOTE: For best performance, ensure expandedMessages is memoized in the parent:
// const expandedMessages = useMemo(() => new Set([...]), [/* dependencies */]);

    return (
        <div
            className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8 bg-transparent px-2 sm:px-4 md:px-0"
            style={{ position: 'relative', zIndex: 1 }}
            role="log"
            aria-live="polite"
        >
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
            {messages.map((message, index) => renderMessage(message, index))}
        </div>
    )
});
const arePropsEqual = (prevProps: MessageListProps, nextProps: MessageListProps) => {
    const documentsChanged = prevProps.mergedDocuments !== nextProps.mergedDocuments;

    const messagesChanged = prevProps.messages !== nextProps.messages;

    if (documentsChanged) {
    }
    if (messagesChanged) {
    }

    const isEqual = (
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.isLoadingSessionMessages === nextProps.isLoadingSessionMessages &&
        prevProps.isLoadingOlderMessages === nextProps.isLoadingOlderMessages &&
        prevProps.hasMoreMessages === nextProps.hasMoreMessages &&
        prevProps.messages === nextProps.messages &&
        prevProps.mergedDocuments === nextProps.mergedDocuments &&
        prevProps.expandedMessages === nextProps.expandedMessages &&
        prevProps.isSpeaking === nextProps.isSpeaking &&
        prevProps.speakingMessageId === nextProps.speakingMessageId &&
        prevProps.isPaused === nextProps.isPaused &&
        prevProps.isDiagramPanelOpen === nextProps.isDiagramPanelOpen &&
        prevProps.enableTypingAnimation === nextProps.enableTypingAnimation &&
        prevProps.autoTypeInPanel === nextProps.autoTypeInPanel
    );

    return isEqual;
};

export default memo(MessageList, arePropsEqual);