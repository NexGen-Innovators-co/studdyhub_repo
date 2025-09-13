// src/components/DocumentUpload.tsx
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  UploadCloud, FileText, Image, Loader2, Check, XCircle, AlertTriangle,
  RefreshCw, Eye, Download, Calendar, HardDrive, Search, Filter,
  FileVideo, FileAudio, Archive, Code, Play, Pause, Volume2, FileBarChart,
  ChevronDown, ChevronRight, Grid, List, SortAsc, SortDesc,
  Maximize2, X, Copy, Share, Edit, Trash2, MoreHorizontal,
  FileSpreadsheet, File, Zap, Clock, Users
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { Document } from '../../types/Document';
import { useAuth } from '../../hooks/useAuth';
import { useAppContext } from '../../contexts/AppContext';

interface DocumentUploadProps {
  documents: Document[];
  onDocumentUploaded: (document: Document) => void;
  onDocumentDeleted: (documentId: string) => void;
  onDocumentUpdated: (document: Document) => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documents,
  onDocumentUploaded,
  onDocumentDeleted,
  onDocumentUpdated
}) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set());

  // Enhanced UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadMoreDocuments, dataPagination } = useAppContext();
  const lastDocumentRef = useRef<HTMLDivElement>(null);

  // Utility functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileCategory = (fileType: string): string => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('audio/')) return 'audio';
    if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('word') || fileType.includes('text') || fileType.includes('slides')) return 'document';
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'spreadsheet';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return 'presentation';
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar') || fileType.includes('gz')) return 'archive';
    if (fileType.includes('javascript') || fileType.includes('python') || fileType.includes('java') || fileType.includes('css')) return 'code';
    return 'other';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'image': return Image;
      case 'video': return FileVideo;
      case 'audio': return FileAudio;
      case 'document': return FileText;
      case 'spreadsheet': return FileBarChart;
      case 'presentation': return FileBarChart; // Changed to FileBarChart
      case 'archive': return Archive;
      case 'code': return Code;
      default: return File;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'image': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-500/20 border-green-200 dark:border-green-500/20';
      case 'video': return 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/20';
      case 'audio': return 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-500/20 border-pink-200 dark:border-pink-500/20';
      case 'document': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/20';
      case 'spreadsheet': return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/20';
      case 'presentation': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/20'; // Changed to FileBarChart
      case 'archive': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/20';
      case 'code': return 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/20';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/20 border-gray-200 dark:border-gray-500/20';
    }
  };

  // Document statistics
  const documentStats = useMemo(() => {
    const stats = {
      all: documents.length,
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      spreadsheet: 0,
      presentation: 0,
      archive: 0,
      code: 0,
      other: 0,
      completed: 0,
      pending: 0,
      failed: 0
    };

    documents.forEach(doc => {
      const category = getFileCategory(doc.file_type);
      stats[category as keyof typeof stats]++;
      stats[doc.processing_status as keyof typeof stats]++;
    });

    return stats;
  }, [documents]);

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content_extracted?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || getFileCategory(doc.file_type) === selectedCategory;

      const matchesStatus = selectedStatus === 'all' || doc.processing_status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort documents
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'size':
          aValue = a.file_size;
          bValue = b.file_size;
          break;
        case 'type':
          aValue = a.file_type;
          bValue = b.file_type;
          break;
        case 'date':
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [documents, searchQuery, selectedCategory, selectedStatus, sortBy, sortOrder]);

  const handleFileSelection = useCallback((file: File) => {
    const MAX_FILE_SIZE_MB = 200;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml', 'image/tiff', 'image/tif', 'image/ico', 'image/heic', 'image/heif',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.presentation',
      'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/xml', 'application/json', 'application/xml',
      'text/javascript', 'application/javascript', 'text/typescript', 'application/typescript', 'text/css', 'text/x-python', 'text/x-java', 'text/x-c', 'text/x-cpp', 'text/x-csharp', 'text/x-php', 'text/x-ruby', 'text/x-go', 'text/x-rust', 'text/x-sql',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm', 'audio/flac',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/mkv'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please check the allowed file types.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    } else {
      setSelectedFile(null);
    }
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) {
      toast.error('Please select a file and ensure you are logged in.');
      return;
    }

    if (isUploading) {
      toast.warning('Upload already in progress. Please wait...');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 200);

    const functionUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/document-processor';

    try {
      toast.info(`Uploading and processing "${selectedFile.name}"...`, {
        duration: 5000,
      });

      const base64Data = await getBase64(selectedFile);
      setUploadProgress(30);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      const payload = {
        userId: user.id,
        files: [{
          name: selectedFile.name,
          mimeType: selectedFile.type,
          data: base64Data,
          size: selectedFile.size
        }]
      };

      setUploadProgress(60);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload),
      });

      setUploadProgress(90);

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Processing failed: ${errorBody.error || 'Unknown error'}`);
      }

      const result = await response.json();
      setUploadProgress(100);

      if (result.documents && result.documents.length > 0) {
        result.documents.forEach((doc: Document) => {
          onDocumentUploaded(doc);
        });
        toast.success(`Successfully uploaded and processed "${selectedFile.name}"!`, {
          action: {
            label: 'View',
            onClick: () => {
              const uploadedDoc = result.documents[0];
              openPreview(uploadedDoc);
            }
          }
        });
      } else {
        toast.warning('File processed but no documents were returned.');
      }

      // Reset form
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      console.error('Processing error:', error);
      toast.error(`Failed to process file: ${error.message}`);
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const triggerAnalysis = async (doc: Document): Promise<void> => {
    if (!user?.id) {
      toast.error('User not authenticated.');
      return;
    }

    if (processingDocuments.has(doc.id) || (doc.processing_status as string) === 'pending') {
      toast.warning('Analysis is already in progress for this document.');
      return;
    }

    setProcessingDocuments(prev => new Set(prev).add(doc.id));
    onDocumentUpdated({ ...doc, processing_status: 'pending', processing_error: null });

    const functionUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/document-processor';

    try {
      toast.info(`${doc.processing_status === 'failed' ? 'Retrying' : 'Starting'} analysis for "${doc.file_name}"...`);

      let base64Data: string | null = null;
      try {
        const response = await fetch(doc.file_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file from URL: ${doc.file_url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const binary = String.fromCharCode(...new Uint8Array(arrayBuffer));
        base64Data = btoa(binary);
      } catch (fetchError: any) {
        throw new Error(`Error fetching file for re-analysis: ${fetchError.message}`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      const payload = {
        userId: user.id,
        files: [{
          name: doc.file_name,
          mimeType: doc.file_type,
          data: base64Data,
          size: doc.file_size,
          idToUpdate: doc.id
        }]
      };

      const fetchResponse = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload),
      });

      if (!fetchResponse.ok) {
        const errorBody = await fetchResponse.json();
        throw new Error(`Analysis failed: ${errorBody.error || fetchResponse.statusText}`);
      }

      const result = await fetchResponse.json();
      if (result.documents && result.documents.length > 0) {
        const updatedDoc = result.documents.find((d: Document) => d.id === doc.id) || result.documents[0];
        onDocumentUpdated(updatedDoc);
        toast.success('Document analysis completed successfully!');
      } else {
        toast.warning('Analysis request sent, but no updated document data received.');
      }

    } catch (error: any) {
      toast.error(`Failed to initiate analysis: ${error.message}`);
      onDocumentUpdated({
        ...doc,
        processing_status: 'failed',
        processing_error: error.message
      });
    } finally {
      setProcessingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  const handleDeleteDocument = async (documentId: string, fileUrl: string) => {
    if (processingDocuments.has(documentId)) {
      toast.error('Cannot delete document while analysis is in progress.');
      return;
    }

    toast.info('Deleting document...', {
      action: {
        label: 'Confirm Delete',
        onClick: async () => {
          try {
            let storagePath: string | null = null;
            try {
              const url = new URL(fileUrl);
              const pathSegments = url.pathname.split('/chat-documents/');
              if (pathSegments.length > 1) {
                storagePath = pathSegments[1];
              } else {
                const oldPathSegments = url.pathname.split('/documents/');
                if (oldPathSegments.length > 1) {
                  storagePath = oldPathSegments[1];
                } else {
                  const match = fileUrl.match(/\/user_uploads\/[^/]+\/[^/]+$/);
                  if (match) {
                    storagePath = `user_uploads${match[0].split('/user_uploads')[1]}`;
                  }
                }
              }
            } catch (urlError) {
              console.warn('Invalid file URL format:', fileUrl, urlError);
            }

            if (storagePath) {
              const { error: storageError } = await supabase.storage
                .from('chat-documents')
                .remove([storagePath]);

              if (storageError) {
                console.warn('Failed to delete file from storage:', storageError.message);
                toast.warning(`File might not have been removed from storage. Error: ${storageError.message}`);
              }
            } else {
              console.warn('Could not derive storage path from file URL:', fileUrl);
              toast.warning('Could not derive storage path from file URL. File will not be deleted from storage.');
            }

            const { error: dbError } = await supabase
              .from('documents')
              .delete()
              .eq('id', documentId);

            if (dbError) {
              throw new Error(`Database deletion failed: ${dbError.message}`);
            }

            toast.success('Document deleted successfully!');
            onDocumentDeleted(documentId);
          } catch (error: any) {
            console.error('Error deleting document:', error);
            toast.error(`Failed to delete document: ${error.message}`);
          }
        }
      },
      duration: 5000,
    });
  };

  const getStatusColor = (status: string | null) => {
    const s = status as string;
    switch (s) {
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10';
      case 'pending':
        return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string | null) => {
    const s = status as string;
    switch (s) {
      case 'completed':
        return <Check className="h-4 w-4" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const isDocumentProcessing = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    return processingDocuments.has(docId) || (doc?.processing_status as string) === 'pending';
  };

  const openPreview = (document: Document) => {
    setSelectedDocument(document);
    setPreviewOpen(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Content copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy content');
    }
  };

  const observer = useRef<IntersectionObserver | null>(null);

  const lastDocumentElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (dataPagination.documents.isLoading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && dataPagination.documents.hasMore) {
          loadMoreDocuments();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loadMoreDocuments, dataPagination.documents.isLoading, dataPagination.documents.hasMore]
  );

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-blue-100 dark:bg-blue-500/20 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium">
            <Zap className="h-4 w-4" />
            AI-Powered Document Processing
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Smart Document Upload
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Upload, analyze, and organize your documents with AI-powered content extraction and intelligent categorization
          </p>

          {/* Stats Bar */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 rounded-full shadow-sm">
              <File className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">{documentStats.all} Files</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 rounded-full shadow-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">{documentStats.completed} Processed</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 rounded-full shadow-sm">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">{documentStats.pending} Pending</span>
            </div>
          </div>
        </div>

        {/* Enhanced Upload Area */}
        <Card className="overflow-hidden border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm mb-8">
          <CardContent className="p-0">
            <div
              className={`relative border-2 border-dashed rounded-lg transition-all duration-500 ${dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 scale-[1.02] shadow-lg'
                : selectedFile
                  ? 'border-green-400 bg-green-50 dark:bg-green-500/10 shadow-lg'
                  : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                } cursor-pointer p-8 md:p-12 ${isUploading ? 'pointer-events-none opacity-75' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".txt,.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.ico,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.odt,.ods,.odp,.csv,.md,.html,.xml,.json,.js,.ts,.css,.py,.java,.c,.cpp,.cs,.php,.rb,.go,.rs,.sql,.zip,.rar,.7z,.tar,.gz,.mp3,.wav,.ogg,.m4a,.webm,.flac,.mp4,.avi,.mov,.wmv,.webm,.mkv"
                disabled={isUploading}
              />

              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full ${selectedFile
                  ? 'bg-green-100 dark:bg-green-500/20 animate-pulse'
                  : 'bg-blue-100 dark:bg-blue-500/20'
                  } mb-4 transition-all duration-300 ${isUploading ? 'animate-bounce' : ''}`}>
                  {isUploading ? (
                    <Loader2 className="h-8 w-8 md:h-10 md:w-10 text-blue-600 dark:text-blue-400 animate-spin" />
                  ) : selectedFile ? (
                    React.createElement(getCategoryIcon(getFileCategory(selectedFile.type)), {
                      className: "h-8 w-8 md:h-10 md:w-10 text-green-600 dark:text-green-400"
                    })
                  ) : (
                    <UploadCloud className="h-8 w-8 md:h-10 md:w-10 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                {isUploading ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                        Processing your file...
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        AI is analyzing and extracting content from "{selectedFile?.name}"
                      </p>
                    </div>
                    <div className="w-full max-w-md mx-auto bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{Math.round(uploadProgress)}% complete</p>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 text-green-700 dark:text-green-300">
                      {React.createElement(getCategoryIcon(getFileCategory(selectedFile.type)), {
                        className: "h-6 w-6"
                      })}
                      <span className="text-lg font-semibold">{selectedFile.name}</span>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(getFileCategory(selectedFile.type))}`}>
                      {getFileCategory(selectedFile.type).toUpperCase()}
                    </div>
                    <div className="flex items-center justify-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-4 w-4" />
                        {formatFileSize(selectedFile.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {selectedFile.type.split('/')[1]?.toUpperCase()}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      disabled={isUploading}
                      className="mt-4 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:border-red-300"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Remove File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h3 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-200">
                      Drop your files here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                      Supports documents, images, videos, audio files, and code up to 200MB
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                      {[
                        { category: 'document', label: 'Documents', icon: FileText },
                        { category: 'image', label: 'Images', icon: Image },
                        { category: 'video', label: 'Videos', icon: FileVideo },
                        { category: 'code', label: 'Code', icon: Code }
                      ].map(({ category, label, icon: Icon }) => (
                        <div key={category} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-700/50">
                          <Icon className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedFile && !isUploading && (
              <div className="p-6 bg-slate-50 dark:bg-slate-700/50 border-t">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading || !user?.id}
                  className="w-full py-3 text-base font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadCloud className="h-5 w-5 mr-2" />
                  Upload & Analyze with AI
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Controls and Filters */}
        <div className="mb-8">
          <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search files by name or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white dark:bg-slate-700"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="image">Images ({documentStats.image})</option>
                    <option value="document">Documents ({documentStats.document})</option>
                    <option value="video">Videos ({documentStats.video})</option>
                    <option value="audio">Audio ({documentStats.audio})</option>
                    <option value="code">Code ({documentStats.code})</option>
                    <option value="archive">Archives ({documentStats.archive})</option>
                  </select>

                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed ({documentStats.completed})</option>
                    <option value="pending">Pending ({documentStats.pending})</option>
                    <option value="failed">Failed ({documentStats.failed})</option>
                  </select>

                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [newSortBy, newSortOrder] = e.target.value.split('-');
                      setSortBy(newSortBy);
                      setSortOrder(newSortOrder);
                    }}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm"
                  >
                    <option value="date-desc">Latest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="size-desc">Largest First</option>
                    <option value="size-asc">Smallest First</option>
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="px-3"
                  >
                    {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents Display */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-200">
              Your Files ({filteredAndSortedDocuments.length})
            </h2>
          </div>

          {filteredAndSortedDocuments.length === 0 ? (
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' ? (
                    <Search className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <FileText className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                    ? 'No files match your filters'
                    : 'No files uploaded yet'
                  }
                </h3>
                <p className="text-slate-500 dark:text-slate-500 mb-4">
                  {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                    ? 'Try adjusting your search terms or filters'
                    : 'Upload your first document or image to get started with AI analysis'
                  }
                </p>
                {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSelectedStatus('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className={viewMode === 'grid'
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              : "space-y-4"
            }>
              {filteredAndSortedDocuments.map((doc, index) => {
                const isLastDocument = index === filteredAndSortedDocuments.length - 1;
                return (
                  <Card
                    key={doc.id}
                    ref={isLastDocument ? lastDocumentElementRef : null}
                    className={`group border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:scale-[1.02] overflow-hidden ${viewMode === 'list' ? 'flex' : ''
                      }`}
                  >
                    <CardContent className="p-0">
                      {viewMode === 'grid' ? (
                        <>
                          {/* Grid View */}
                          <div className="relative h-48 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                            {doc.type === 'image' && doc.file_url ? (
                              <img
                                src={doc.file_url}
                                alt={doc.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://placehold.co/400x300/e0e0e0/666666?text=Image+Error';
                                  e.currentTarget.alt = 'Image failed to load';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {React.createElement(getCategoryIcon(getFileCategory(doc.file_type)), {
                                  className: "h-16 w-16 text-slate-400 dark:text-slate-500"
                                })}
                              </div>
                            )}

                            {/* Status Badge */}
                            <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(doc.processing_status as string)}`}>
                              {getStatusIcon(doc.processing_status as string)}
                              <span className="capitalize">{(doc.processing_status as string) || 'unknown'}</span>
                            </div>

                            {/* Category Badge */}
                            <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(getFileCategory(doc.file_type))}`}>
                              {getFileCategory(doc.file_type).toUpperCase()}
                            </div>

                            {/* Processing Overlay */}
                            {isDocumentProcessing(doc.id) && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    Processing...
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="p-6 space-y-4">
                            <div>
                              <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2 line-clamp-2">
                                {doc.title}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(doc.created_at)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <HardDrive className="h-4 w-4" />
                                  {formatFileSize(doc.file_size)}
                                </span>
                              </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 min-h-[80px]">
                              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4">
                                {doc.content_extracted || 'No content extracted yet...'}
                              </p>
                            </div>

                            {doc.processing_status === 'failed' && doc.processing_error && (
                              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
                                <p className="text-sm text-red-600 dark:text-red-400">
                                  <span className="font-medium">Error:</span> {(doc.processing_error as string)}
                                </p>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              {doc.processing_status === 'failed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => triggerAnalysis(doc)}
                                  disabled={isUploading || isDocumentProcessing(doc.id)}
                                  className="flex-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
                                >
                                  {isDocumentProcessing(doc.id) ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Retry
                                    </>
                                  )}
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPreview(doc)}
                                className="flex-1 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-500/10"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                                disabled={isUploading || isDocumentProcessing(doc.id)}
                                className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* List View */}
                          <div className="flex items-center p-6 gap-4">
                            <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-lg flex items-center justify-center relative">
                              {doc.type === 'image' && doc.file_url ? (
                                <img
                                  src={doc.file_url}
                                  alt={doc.title}
                                  className="w-full h-full object-cover rounded-lg"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                React.createElement(getCategoryIcon(getFileCategory(doc.file_type)), {
                                  className: "h-8 w-8 text-slate-400 dark:text-slate-500"
                                })
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {doc.title}
                                  </h3>
                                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(getFileCategory(doc.file_type))}`}>
                                      {getFileCategory(doc.file_type).toUpperCase()}
                                    </div>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(doc.created_at)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <HardDrive className="h-3 w-3" />
                                      {formatFileSize(doc.file_size)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                                    {doc.content_extracted || 'No content extracted yet...'}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(doc.processing_status as string)}`}>
                                    {getStatusIcon(doc.processing_status as string)}
                                    <span className="capitalize">{(doc.processing_status as string) || 'unknown'}</span>
                                  </div>

                                  <div className="flex gap-1">
                                    {doc.processing_status === 'failed' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => triggerAnalysis(doc)}
                                        disabled={isUploading || isDocumentProcessing(doc.id)}
                                        className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                                      >
                                        <RefreshCw className="h-4 w-4" />
                                      </Button>
                                    )}

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openPreview(doc)}
                                      className="text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-500/10"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                                      disabled={isUploading || isDocumentProcessing(doc.id)}
                                      className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {dataPagination.documents.isLoading && (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400 mr-3" />
              <p className="text-slate-600 dark:text-slate-400">Loading more documents...</p>
            </div>
          )}
          {dataPagination.documents.hasMore ? null : (
            <div className="flex justify-center items-center py-4 text-slate-500 dark:text-slate-400">
              No more documents to load.
            </div>
          )}
        </div>

        {/* Enhanced Preview Dialog */}
        {previewOpen && selectedDocument && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {selectedDocument.title}
                  </h2>
                  <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(getFileCategory(selectedDocument.file_type))}`}>
                      {React.createElement(getCategoryIcon(getFileCategory(selectedDocument.file_type)), {
                        className: "h-3 w-3"
                      })}
                      {getFileCategory(selectedDocument.file_type).toUpperCase()}
                    </div>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-4 w-4" />
                      {formatFileSize(selectedDocument.file_size)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(selectedDocument.created_at)}
                    </span>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(selectedDocument.processing_status as string)}`}>
                      {getStatusIcon(selectedDocument.processing_status as string)}
                      <span className="capitalize">{(selectedDocument.processing_status as string)}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(false)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
                {/* File Preview */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    File Preview
                  </h3>
                  <div className="aspect-video bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                    {selectedDocument.type === 'image' && selectedDocument.file_url ? (
                      <img
                        src={selectedDocument.file_url}
                        alt={selectedDocument.title}
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="text-center space-y-3">
                        {React.createElement(getCategoryIcon(getFileCategory(selectedDocument.file_type)), {
                          className: "h-20 w-20 mx-auto text-slate-400 dark:text-slate-500"
                        })}
                        <div>
                          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
                            {selectedDocument.title}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-500">
                            Preview not available for this file type
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(selectedDocument.file_url, '_blank')}
                          className="mt-3"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Open File
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracted Content */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      AI-Extracted Content
                    </h3>
                    {selectedDocument.content_extracted && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(selectedDocument.content_extracted!)}
                        className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    )}
                  </div>
                  <div className="bg-white dark:bg-slate-700 rounded-lg p-4 min-h-[120px] max-h-60 overflow-y-auto">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedDocument.content_extracted || 'No content has been extracted from this file yet.'}
                    </p>
                  </div>
                </div>

                {/* Error Information */}
                {selectedDocument.processing_status === 'failed' && selectedDocument.processing_error && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-6">
                    <h3 className="font-semibold text-red-800 dark:text-red-200 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Processing Error
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      {selectedDocument.processing_error as string}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPreviewOpen(false);
                        triggerAnalysis(selectedDocument);
                      }}
                      disabled={isDocumentProcessing(selectedDocument.id)}
                      className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 border-red-300"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Analysis
                    </Button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedDocument.file_url, '_blank')}
                    className="flex-1 sm:flex-none"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: selectedDocument.title,
                          url: selectedDocument.file_url
                        });
                      } else {
                        copyToClipboard(selectedDocument.file_url);
                      }
                    }}
                    className="flex-1 sm:flex-none"
                  >
                    <Share className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  {selectedDocument.content_extracted && (
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(selectedDocument.content_extracted!)}
                      className="flex-1 sm:flex-none"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Content
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewOpen(false);
                      handleDeleteDocument(selectedDocument.id, selectedDocument.file_url);
                    }}
                    disabled={isUploading || isDocumentProcessing(selectedDocument.id)}
                    className="flex-1 sm:flex-none text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {dataPagination.documents.isLoading && (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400 mr-3" />
            <p className="text-slate-600 dark:text-slate-400">Loading more documents...</p>
          </div>
        )}
        {dataPagination.documents.hasMore ? null : (
          <div className="flex justify-center items-center py-4 text-slate-500 dark:text-slate-400">
            No more documents to load.
          </div>
        )}
      </div>
    </div>
  );
};