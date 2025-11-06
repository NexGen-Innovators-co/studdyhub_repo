import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Copy, FileText, Image, RefreshCw, Trash2, Volume2, Pause, Square, X, Loader2, StickyNote, User, File, Download, Check, Paperclip, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { MemoizedMarkdownRenderer } from './MarkdownRenderer';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Document } from '../../../types/Document';
import { Message } from '../../../types/Class';
import { cn } from '../utils/cn';
import BookPagesAnimation from '../../ui/bookloader';
import AIBot from '../../ui/aibot';
import { Note } from '@/types';

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
    showLabel?: boolean;
}> = ({ file, onPreview, className, showLabel = true }) => {
    const isImage = file.type === 'image';
    const imageUrl = file.url || (file.data ? `data:${file.mimeType};base64,${file.data}` : 'https://placehold.co/400x300/e0e0e0/555555?text=Image+Load+Error');
    const hasError = file.processing_error || file.error;
    const isProcessing = file.processing_status === 'processing' || file.status === 'processing';

    return (
        <div
            className={cn(
                "relative group cursor-pointer transition-all duration-200 hover:scale-105",
                className
            )}
            onClick={() => {
                if (isProcessing) {
                    toast.info('File is still processing, please wait.');
                    return;
                }
                if (hasError) {
                    toast.error('Cannot preview file due to processing error.');
                    return;
                }
                onPreview(file);
            }}
            title={`${file.name} ${file.size ? `(${formatFileSize(file.size)})` : ''}`}
        >
            {isImage && imageUrl ? (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm">
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
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                    {getFileIcon(file)}
                </div>
            )}

            {/* Status indicators */}
            {isProcessing && (
                <div className="absolute top-1 right-1">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                </div>
            )}
            {hasError && (
                <div className="absolute top-1 right-1">
                    <X className="h-3 w-3 text-red-500" />
                </div>
            )}

            {/* File label */}
            {showLabel && (
                <div className="mt-2 text-center">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]" title={file.name}>
                        {file.name.length > 12 ? `${file.name.substring(0, 12)}...` : file.name}
                    </div>
                    {file.size && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {formatFileSize(file.size)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const AttachmentSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    count: number;
    className?: string;
}> = ({ title, icon, children, count, className }) => {
    return (
        <div className={cn("mb-3", className)}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {title} ({count})
                </span>
            </div>
            <div className="pl-6">
                {children}
            </div>
        </div>
    );
};

const AttachmentList: React.FC<{
    items: Array<{
        id: string;
        name: string;
        onClick: () => void;
    }>;
}> = ({ items }) => {
    return (
        <div className="space-y-1">
            {items.map((item, idx) => (
                <button
                    key={`${item.id}-${idx}`}
                    onClick={item.onClick}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2 py-1 rounded-md transition-colors w-full text-left"
                >
                    <span className="truncate">{item.name}</span>
                </button>
            ))}
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
            files = metadataArray.map((file: any) => {
                //console.log('Parsing file metadata:', file); // Add this line
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

    // 
    const handleFilePreview = useCallback((file: AttachedFile) => {
        if (file.type === 'image') {
            const imageUrl = file.url || (file.data ? `data:${file.mimeType};base64,${file.data}` : null);
            if (imageUrl) {
                onViewContent('image', undefined, undefined, imageUrl);
            } else {
                toast.error('No image data available for preview.');
            }
        } else if (file.type === 'document' && file.content) {
            onViewContent('document-text', file.content, 'text'); // Use document-text type
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

    const renderAttachments = useCallback((message: Message) => {
        const attachedFiles = parseAttachedFiles(message);
        const attachedDocumentTitles = message.attachedDocumentIds?.map(id => {
            const doc = mergedDocuments.find(d => d.id === id);
            return { id, name: doc ? doc.title : 'loading document...', type: 'document' as const, doc, processing_status: doc?.processing_status, processing_error: doc?.processing_error }; // Include the entire document object
        }) || [];
        const attachedNoteTitles = message.attachedNoteIds?.map(id => {
            const note = mergedDocuments.find(d => d.id === id);
            return { id, name: note ? note.title : 'loading Note...', type: 'note' as const };
        }) || [];

        const hasAttachments = attachedFiles.length > 0 || attachedDocumentTitles.length > 0 || attachedNoteTitles.length > 0;

        if (!hasAttachments) return null;

        // Combine all attachments into a single array
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
                processing: doc.processing_status === 'processing' || false, // Add processing status
                error: doc.processing_error || false,
                doc // Keep the document object
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
            <div className="mb-3 overflow-x-auto">
                <div className="flex gap-2 pb-2 min-w-max">
                    {allAttachments.map((attachment, idx) => {
                        // Special handling for image files
                        if (attachment.type === 'file' && attachment.file?.type === 'image') {
                            const imageUrl = attachment.file.url ||
                                (attachment.file.data ? `data:${attachment.file.mimeType};base64,${attachment.file.data}` : null);

                            return (
                                <div
                                    key={`${message.id}-attachment-${idx}`}
                                    className="relative flex-shrink-0 cursor-pointer group"
                                    onClick={() => {
                                        if (attachment.processing) {
                                            toast.info('File is still processing, please wait.');
                                            return;
                                        }
                                        if (!attachment.error) {
                                            //console.log(attachment.error);
                                            toast.error('Cannot preview file due to processing error.');
                                            return;
                                        }
                                        attachment.onClick();
                                    }}
                                    title={attachment.name}
                                >
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
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

                                    {/* Status indicators */}
                                    {attachment.processing && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                            <Loader2 className="h-2 w-2 animate-spin text-white" />
                                        </div>
                                    )}
                                    {!attachment.error && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                            <X className="h-2 w-2 text-white" />
                                        </div>
                                    )}

                                    {/* Tooltip on hover */}
                                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                        {attachment.name.length > 15 ? `${attachment.name.substring(0, 15)}...` : attachment.name}
                                    </div>
                                </div>
                            );
                        }

                        // Default container for documents, notes, and non-image files
                        return (
                            <div
                                key={`${message.id}-attachment-${idx}`}
                                className="relative flex-shrink-0 cursor-pointer group"
                                onClick={() => {
                                    if (attachment.processing) {
                                        toast.info('File is still processing, please wait.');
                                        return;
                                    } attachment.onClick();
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

                                    {/* Type badge */}
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

                                {/* Status indicators */}
                                {attachment.processing && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                        <Loader2 className="h-2 w-2 animate-spin text-white" />
                                    </div>
                                )}
                                {/* Full name tooltip on hover */}
                                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                    {attachment.name}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }, [mergedDocuments, handleFilePreview, handleViewAttachedFile, getFileIcon]);

    // MessageList.tsx
    const renderMessage = useCallback((message: Message, index: number) => {
        const isUserMessage = message.role === 'user';
        const isLastMessage = index === messages.length - 1;
        const isMessageExpanded = expandedMessages.has(message.content);
        const messageDate = formatDate(message.timestamp);
        const showDateHeader = lastDateRef.current !== messageDate;
        lastDateRef.current = messageDate;

        let contentToRender;

        if (isUserMessage) {
            contentToRender = (
                <>
                    {renderAttachments(message)}
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
            );
        } else {
            contentToRender = (
                <>
                    {message.isLoading || (message.id.startsWith('optimistic-ai-') && !message.content) ? (
                        <div className="flex items-center gap-3 my-4">
                            <BookPagesAnimation size="md" showText={true} text='Generating response' />
                        </div>
                    ) : (
                        <>
                            {/* **Conditional Error Display** */}
                            {message.isError ? (
                                <div className="p-3 rounded-lg border border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-claude text-sm sm:text-base">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="font-semibold">Error:</span>
                                    </div>
                                    <p className="leading-relaxed">There was a problem generating this response</p>
                                    {/* **Retry Button** */}
                                    {isLastMessage && (
                                        <div className="mt-3 flex justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onRetryClick(messages[index - 2]?.content, message.content || '')} // Replace with a retry function if available
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
                            <AIBot size="lg" isError={message.isError} className='hidden sm:block flex-shrink-0' />

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
                    ) : message.role === 'assistant' && !isSpeaking && !message.isLoading && !(message.id.startsWith('optimistic-ai-') && !message.content) ? (
                        <>
                            <AIBot size="lg" isError={message.isError} className='hidden sm:block flex-shrink-0' />

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
                    ) : (
                        message.role === 'assistant' && !message.isLoading && <AIBot size="lg" isError={message.isError} className='hidden sm:block flex-shrink-0' />
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

                        {/* Only show actions if not loading */}
                        {!message.isLoading && !(message.id.startsWith('optimistic-ai-') && !message.content) && (
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
                        )}
                    </div>
                </div>
            </React.Fragment>
        );
    }, [formatDate, formatTime, onToggleUserMessageExpansion, expandedMessages, onMermaidError, onSuggestAiCorrection, onViewContent, enableTypingAnimation, isLoading, onMarkMessageDisplayed, autoTypeInPanel, onBlockDetected, onBlockUpdate, onBlockEnd, isDiagramPanelOpen, handleDiagramCodeUpdate, onRegenerateClick, copy, onDeleteClick, isSpeaking, speakingMessageId, isPaused, resumeSpeech, pauseSpeech, stopSpeech, speakMessage, renderAttachments, messages]);
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
        //console.log('[MessageList] Props changed: mergedDocuments updated');
    }
    if (messagesChanged) {
        //console.log('[MessageList] Props changed: messages updated');
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

    if (isEqual) {
        //console.log('[MessageList] Props unchanged, skipping re-render');
    } else {
        //console.log('[MessageList] Props changed, re-rendering');
    }

    return isEqual;
};

export default memo(MessageList, arePropsEqual);