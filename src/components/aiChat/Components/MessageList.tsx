import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Copy, FileText, Image, RefreshCw, Trash2, Volume2, Pause, Square, X, Loader2, StickyNote, User, File, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Document } from '../../../types/Document';
import { Message } from '../../../types/Class';
import { cn } from '../utils/cn';
import BookPagesAnimation from '../../bookloader';
import AIBot from '../../ui/aibot';

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
    onDiagramCodeUpdate: (messageId: string, newCode: string) => Promise<void>;
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

const FilePreview: React.FC<{
    file: AttachedFile;
    onPreview: (file: AttachedFile) => void;
    className?: string;
}> = ({ file, onPreview, className }) => {
    const isImage = file.type === 'image';
    const imageUrl = file.url || (file.data ? `data:${file.mimeType};base64,${file.data}` : 'https://placehold.co/400x300/e0e0e0/555555?text=Image+Load+Error');

    return (
        <div
            className={cn(
                "relative group cursor-pointer transition-all duration-200 hover:scale-105",
                className
            )}
            onClick={() => {
                if (file.processing_status === 'processing' || file.status === 'processing') {
                    toast.info('File is still processing, please wait.');
                    return;
                }
                if (file.processing_error || file.error) {
                    toast.error('Cannot preview file due to processing error.');
                    return;
                }
                onPreview(file);
            }}
            title={`${file.name} ${file.size ? `(${formatFileSize(file.size)})` : ''}`}
        >
            {isImage && imageUrl ? (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm">
                    <img
                        src={imageUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://placehold.co/400x300/e0e0e0/555555?text=Image+Load+Error';
                        }}
                    />
                </div>
            ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                    {getFileIcon(file)}
                </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="truncate">
                    {file.name.length > 12 ? `${file.name.substring(0, 12)}...` : file.name}
                </div>
            </div>
            {(file.processing_status === 'processing' || file.status === 'processing') && (
                <div className="absolute top-1 right-1">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                </div>
            )}
            {(file.processing_error || file.error) && (
                <div className="absolute top-1 right-1">
                    <X className="h-3 w-3 text-red-500" />
                </div>
            )}
        </div>
    );
};

const parseAttachedFiles = (message: Message): AttachedFile[] => {
    let files: AttachedFile[] = [];
    if (message.files_metadata) {
        try {
            const metadata = typeof message.files_metadata === 'string'
                ? JSON.parse(message.files_metadata)
                : message.files_metadata;
            const metadataArray = Array.isArray(metadata) ? metadata : [metadata];
            files = metadataArray.map((file: any) => ({
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
            }));
        } catch (error) {
            console.error('Error parsing files_metadata:', error);
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
            console.error('Error parsing attachedFiles:', error);
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
                const doc = docs[0]; // Show first document for simplicity
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
            const extension = file.name.split('.').pop()?.toLowerCase();
            const languageMap: { [key: string]: string } = {
                'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
                'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp',
                'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'swift': 'swift',
                'kt': 'kotlin', 'scala': 'scala', 'sql': 'sql', 'html': 'html', 'css': 'css',
                'scss': 'scss', 'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
                'md': 'markdown', 'txt': 'text', 'log': 'text'
            };
            const language = extension && languageMap[extension] ? languageMap[extension] : 'text';
            onViewContent('code', file.content, language);
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
            console.error('Error updating diagram code:', error);
            toast.error(`Failed to update diagram code: ${error.message || 'Unknown error'}`);
        }
    }, [onDiagramCodeUpdate]);

    const renderMessage = useCallback((message: Message, index: number) => {
        const isUserMessage = message.role === 'user';
        const isLastMessage = index === messages.length - 1;
        const isMessageExpanded = expandedMessages.has(message.content);
        const messageDate = formatDate(message.timestamp);
        const showDateHeader = lastDateRef.current !== messageDate;
        lastDateRef.current = messageDate;

        const attachedFiles = parseAttachedFiles(message);
        const attachedDocumentTitles = message.attachedDocumentIds?.map(id => {
            const doc = mergedDocuments.find(d => d.id === id);
            return doc ? doc.title : 'Unknown Document';
        }) || [];
        const attachedNoteTitles = message.attachedNoteIds?.map(id => {
            const note = mergedDocuments.find(d => d.id === id);
            return note ? note.title : 'Unknown Note';
        }) || [];

        const contentToRender = isUserMessage ? (
            <>
                {(attachedFiles.length > 0 || attachedDocumentTitles.length > 0 || attachedNoteTitles.length > 0) && (
                    <div className="mb-2 flex flex-wrap items-center gap-1 sm:gap-2">
                        {attachedFiles.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-claude">
                                {attachedFiles.map((file, idx) => (
                                    <FilePreview
                                        key={`${message.id}-file-${idx}`}
                                        file={file}
                                        onPreview={handleFilePreview}
                                    />
                                ))}
                            </div>
                        )}
                        {attachedDocumentTitles.length > 0 && (
                            <div
                                className="flex items-center gap-1 text-xs text-blue-500 font-claude hover:text-blue-600 cursor-pointer transition-colors"
                                onClick={() => handleViewAttachedFile('documents', message.attachedDocumentIds)}
                            >
                                <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                <span className="text-xs">{attachedDocumentTitles.length} doc{attachedDocumentTitles.length > 1 ? 's' : ''}</span>
                            </div>
                        )}
                        {attachedNoteTitles.length > 0 && (
                            <div
                                className="flex items-center gap-1 text-xs text-slate-500 font-claude hover:text-blue-500 cursor-pointer transition-colors"
                                onClick={() => handleViewAttachedFile('notes', message.attachedNoteIds)}
                            >
                                <StickyNote className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                <span className="text-xs">{attachedNoteTitles.length} note{attachedNoteTitles.length > 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>
                )}
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
                    onDiagramCodeUpdate={handleDiagramCodeUpdate}
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
                                            {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
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
                            </div>
                        </div>
                    </div>
                </div>
            </React.Fragment>
        );
    }, [formatDate, formatTime, onToggleUserMessageExpansion, expandedMessages, onMermaidError, onSuggestAiCorrection, onViewContent, enableTypingAnimation, isLoading, onMarkMessageDisplayed, autoTypeInPanel, onBlockDetected, onBlockUpdate, onBlockEnd, isDiagramPanelOpen, handleDiagramCodeUpdate, onRegenerateClick, copy, onDeleteClick, isSpeaking, speakingMessageId, isPaused, resumeSpeech, pauseSpeech, stopSpeech, speakMessage, handleFilePreview, mergedDocuments]);

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

export default memo(MessageList);
