
// src/components/DocumentUpload.tsx
import React, { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { trackCourseResourceAccess } from '../../services/courseProgressService';
import {
  UploadCloud, FileText, Image, Loader2, Check, XCircle, AlertTriangle,
  RefreshCw, Eye, Download, Calendar, HardDrive, Search, Filter,
  FileVideo, FileAudio, Archive, Code, Play, Pause, Volume2, FileBarChart,
  ChevronDown, ChevronRight, Grid, List, SortAsc, SortDesc,
  Maximize2, X, Copy, Share, Edit, Trash2, MoreHorizontal,
  FileSpreadsheet, File, Zap, Clock, Users, Folder, Plus, CheckSquare, Square, Lock
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { Document } from '../../types/Document';
import { useAuth } from '../../hooks/useAuth';
import { useAppContext } from '../../hooks/useAppContext';
import { DocumentFolder, CreateFolderInput, UpdateFolderInput } from '../../types/Folder';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '../../services/globalSearchService';
import { Skeleton } from '../ui/skeleton';
import DocumentMarkdownRenderer from '../aiChat/Components/DocumentMarkdownRenderer';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { PodcastButton } from '../dashboard/PodcastButton';
import { Checkbox } from '../ui/checkbox';
import { useLocation, useNavigate } from 'react-router-dom';
import { a } from 'node_modules/framer-motion/dist/types.d-Cjd591yU';
import { DocumentCardItem } from './DocumentCardItem';
import { DocumentFilters } from './DocumentFilters';
import { DocumentGridSkeleton, DocumentListSkeleton, FolderTreeSkeleton } from './DocumentSkeletons';
import { useDocumentFiltering } from '../../hooks/documents/useDocumentFiltering';
import { useDocumentOperations } from '../../hooks/documents/useDocumentOperations';
import { useDocumentUpload } from '../../hooks/documents/useDocumentUpload';
import { 
  formatFileSize,  
  formatDate, 
  getFileCategory, 
  getCategoryIcon, 
  getCategoryColor, 
  getStatusColor, 
  getStatusIcon 
} from './documentUtils';

interface DocumentUploadProps {
  documents: Document[];
  onDocumentDeleted: (documentId: string) => void;
  onDocumentUpdated: (document: Document) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}
/* -------------------------------------------------------------------------- */
/* Lazy-loaded heavy components (code-splitted) */
/* -------------------------------------------------------------------------- */
const LazyFolderTree = lazy(() =>
  import('./FolderTree').then((m) => ({ default: m.FolderTree }))
);
const LazyCreateFolderDialog = lazy(() =>
  import('./FolderDialog').then((m) => ({ default: m.CreateFolderDialog }))
);
const LazyRenameFolderDialog = lazy(() =>
  import('./FolderDialog').then((m) => ({ default: m.RenameFolderDialog }))
);
const LazyFolderSelector = lazy(() =>
  import('./FolderSelector').then((m) => ({ default: m.FolderSelector }))
);

// Skeletons moved to ./DocumentSkeletons.tsx

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documents,
  onDocumentDeleted,
  onDocumentUpdated,
  searchQuery: externalSearchQuery,
  onSearchChange,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { subscriptionLimits, forceRefreshDocuments } = useAppContext();
  const { canUploadDocuments } = useFeatureAccess();

  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [docUserId, setDocUserId] = useState<string | null>(null);

  // Initialize global search hook for documents
  const { search, results: searchResults, isSearching: isSearchingDocs } = useGlobalSearch(
    SEARCH_CONFIGS.documents,
    docUserId,
    { debounceMs: 500 }
  );

  // Get user ID on mount
  useEffect(() => {
    if (!user?.id) return;
    setDocUserId(user.id);
  }, [user?.id]);
  
  // Podcast selection state
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [showSelection, setShowSelection] = useState(false);



  const [previewOpen, setPreviewOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
 // Inside DocumentUpload component
const { 
  documents: contextDocuments, // <--- Add this
  loadMoreDocuments, 
  dataPagination, 
  folders, 
  folderTree, 
  appOperations, 
  loadDataIfNeeded, 
  dataLoading 
} = useAppContext();
const isLoading = dataLoading?.documents || false; 
// Create a merged source of truth. Prefer Context, fallback to props.
const allDocuments = contextDocuments || documents;

    // Folder state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<DocumentFolder | null>(null);
  const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null);
  const [uploadFolderSelectorOpen, setUploadFolderSelectorOpen] = useState(false);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Hook Integration
  const {
    selectedFile, setSelectedFile,
    isUploading, uploadProgress,
    dragActive, dragLocked,
    fileInputRef, processingDocuments,
    handleDrag, handleDrop, handleFileChange, handleUpload, triggerAnalysis
  } = useDocumentUpload({
    user,
    documents,
    subscriptionLimits,
    canUploadDocuments,
    appOperations,
    forceRefreshDocuments: forceRefreshDocuments as () => Promise<void>,
    onDocumentUpdated,
    uploadTargetFolderId,
    setUploadTargetFolderId
  });

  const {
    internalSearch, hasSearched, effectiveSearch: hookEffectiveSearch,
    selectedCategory, setSelectedCategory,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    viewMode, setViewMode,
    handleSearchChange,
    documentStats,
    filteredAndSortedDocuments
  } = useDocumentFiltering({
    documents: allDocuments,
    searchResults: searchResults as Document[],
    externalSearchQuery,
    onSearchChange,
    search
  });

  const {
    moveDocumentDialogOpen, setMoveDocumentDialogOpen,
    documentToMove, setDocumentToMove,
    moveFolderDialogOpen, setMoveFolderDialogOpen,
    folderToMove, setFolderToMove,
    handleMoveDocument,
    handleMoveDocumentSubmit,
    handleAddDocumentToFolder,
    handleRemoveDocumentFromFolder,
    handleMoveFolder,
    handleMoveFolderSubmit,
    handleDeleteDocument
  } = useDocumentOperations({
    user,
    documents,
    folders,
    onDocumentUpdated,
    onDocumentDeleted,
    loadDataIfNeeded,
    processingDocuments
  });
  
  const effectiveSearch = hookEffectiveSearch;

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('preview')) {
      searchParams.delete('preview');
      navigate({ search: searchParams.toString() }, { replace: true });
    }
  }, [location.search, navigate]);

  // Handle preview from URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const previewId = searchParams.get('preview');
    
    const fetchAndOpenPreview = async (id: string) => {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', id)
          .single();
        
        if (data) {
          setSelectedDocument(data as Document);
          setPreviewOpen(true);
        }
      } catch (error) {
        // // console.error('Error fetching preview document:', error);
        toast.error('Failed to load document preview');
      }
    };

    if (previewId) {
      const doc = documents.find(d => d.id === previewId);
      if (doc) {
        setSelectedDocument(doc);
        setPreviewOpen(true);
      } else {
        // Document not in current list (e.g. from library), fetch it
        fetchAndOpenPreview(previewId);
      }
    }
  }, [location.search, documents]);



  const handleDownload = async (doc: Document) => {
    try {
      if (doc.file_url) {
        // Attempt to fetch blob for a proper download 
        const response = await fetch(doc.file_url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Prefer file_name if available, preserving extension
        a.download = doc.file_name || doc.title || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Downloading ${doc.title}...`);
      } else if (doc.content_extracted) {
        // Use the original file mimetype if known, otherwise plain text
        const mimeType = doc.file_type || 'text/plain';
        const blob = new Blob([doc.content_extracted], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Smart filename: respect file_name (which usually has extension) or title
        let filename = doc.file_name || doc.title || 'document';
        
        // If filename lacks extension, attempt to add one based on mimetype
        if (!filename.includes('.')) {
             if (mimeType.includes('json')) filename += '.json';
             else if (mimeType.includes('javascript') || mimeType.includes('js')) filename += '.js';
             else if (mimeType.includes('typescript') || mimeType.includes('ts')) filename += '.ts';
             else if (mimeType.includes('markdown')) filename += '.md';
             else if (mimeType.includes('html')) filename += '.html';
             else if (mimeType.includes('css')) filename += '.css';
             else if (mimeType.includes('csv')) filename += '.csv';
             else filename += '.txt';
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Downloading content as ${filename}...`);
      } else {
        toast.error("No file URL or extracted content available for download");
      }
    } catch (e) {
      // console.error("Download failed, falling back to window.open", e);
      if (doc.file_url) {
        window.open(doc.file_url, '_blank');
      } else {
        toast.error("Failed to download document");
      }
    }
  };

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing || !user?.id) return;
    
    setIsRefreshing(true);
    try {
      // Refresh both documents and folders with optimized parallel fetching
      await Promise.all([
        loadDataIfNeeded('documents'), // Force refresh
        loadDataIfNeeded('folders')
      ]);
      toast.success('Documents refreshed successfully!');
    } catch (error: any) {

      toast.error(`Failed to refresh: ${error.message || 'Unknown error'}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, user, loadDataIfNeeded]);

  // Listen for trigger-document-upload event from header
  useEffect(() => {
    const handleTriggerUpload = () => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    };

    window.addEventListener('trigger-document-upload', handleTriggerUpload);
    return () => window.removeEventListener('trigger-document-upload', handleTriggerUpload);
  }, []);



  // 2. Lazy load folder dialogs
  const LazyMoveDocumentDialog = lazy(() =>
    import('./MoveDocumentDialog').then((m) => ({ default: m.MoveDocumentDialog }))
  );

  const LazyMoveFolderDialog = lazy(() =>
    import('./MoveFolderDialog').then((m) => ({ default: m.MoveFolderDialog }))
  );
  

  










  const isDocumentProcessing = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    // If document has extracted content, treat as completed
    if (doc && doc.content_extracted && doc.content_extracted.trim().length > 0) {
      return false;
    }
    return processingDocuments.has(docId) || (doc?.processing_status as string) === 'pending';
  };

  const openPreview = (document: Document) => {
    setSelectedDocument(document);
    setPreviewOpen(true);

    // Track course progress when user views a document
    if (docUserId && document.id) {
      trackCourseResourceAccess(docUserId, 'document', document.id);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Content copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy content');
    }
  };

  // Replace your existing observer logic with this:
const observer = useRef<IntersectionObserver | null>(null);
const lastDocumentElementRef = useCallback(
  (node: HTMLDivElement | null) => {
    // FIX: Check the boolean 'isLoading', not the object 'dataLoading'
    if (isLoading) return; 

    if (observer.current) {
      observer.current.disconnect();
    }

    observer.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          dataPagination.documents.hasMore
        ) {
          // // console.log('Load more triggered'); 
          loadMoreDocuments();
        }
      },
      { 
        root: scrollContainerRef.current,
        threshold: 0.1,
        rootMargin: "100px"
      }
    );

    if (node) {
      observer.current.observe(node);
    }
  },
  [loadMoreDocuments, dataPagination.documents.hasMore, isLoading] // FIX: Dependency
);
  // Calculate document counts per folder
  const documentCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    documents.forEach(doc => {
      if (doc.folder_ids) {
        doc.folder_ids.forEach(folderId => {
          counts[folderId] = (counts[folderId] || 0) + 1;
        });
      }
    });

    return counts;
  }, [documents]);

  // Toggle folder expansion
  const handleToggleExpand = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Folder CRUD operations
  const handleCreateFolder = useCallback(async (parentId: string | null) => {
    setParentFolderForNew(parentId);
    setCreateFolderDialogOpen(true);
  }, []);

  const handleCreateFolderSubmit = useCallback(async (input: CreateFolderInput) => {
    const result = await appOperations.createFolder(input);
    if (result) {
      if (user?.id) {
        await loadDataIfNeeded('folders');
      }
    }
  }, [appOperations, user, loadDataIfNeeded]);

  const handleRenameFolder = useCallback((folder: DocumentFolder) => {
    setFolderToRename(folder);
    setRenameFolderDialogOpen(true);
  }, []);

  const handleRenameFolderSubmit = useCallback(async (folderId: string, input: UpdateFolderInput) => {
    const success = await appOperations.updateFolder(folderId, input);
    if (success && user?.id) {
      await loadDataIfNeeded('folders');
    }
  }, [appOperations, user, loadDataIfNeeded]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    if (!window.confirm('Are you sure you want to delete this folder? Documents will not be deleted.')) {
      return;
    }

    const success = await appOperations.deleteFolder(folderId);
    if (success) {
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      if (user?.id) {
        await loadDataIfNeeded('folders');
      }
    }
  }, [appOperations, selectedFolderId, user, loadDataIfNeeded]);

  // Optimized initial data load with error handling
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      if (!user?.id || dataLoading) return;
      
      try {
        // Load documents and folders in parallel for better performance
        await Promise.allSettled([
          loadDataIfNeeded('documents'),
          loadDataIfNeeded('folders')
        ]);
      } catch (error) {

        // Don't show toast on initial load, user can manually refresh
      }
    };

    if (isMounted) {
      loadInitialData();
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id]); // Only run on mount and user change

  // Enhanced document synchronization and duplicate prevention
  useEffect(() => {
    // Log for debugging


    // Check for duplicates
    const documentIds = allDocuments.map(doc => doc.id);
    const uniqueIds = new Set(documentIds);

    if (documentIds.length !== uniqueIds.size) {
      // Remove duplicates if found
      const uniqueDocuments = allDocuments.filter((doc, index) =>
        allDocuments.findIndex(d => d.id === doc.id) === index
      );

      if (uniqueDocuments.length !== allDocuments.length) {
        // You might want to update the parent state here
        // or handle this in your data loading logic
      }
    }
  }, [allDocuments]);

  // Filter documents by selected folder with deduplication
  const filteredDocumentsByFolder = useMemo(() => {
    if (!selectedFolderId) {
      // Remove duplicates from filteredAndSortedDocuments
      const uniqueDocuments = filteredAndSortedDocuments.filter((doc, index, self) =>
        index === self.findIndex(d => d.id === doc.id)
      );
      return uniqueDocuments;
    }

    // Get all documents in this folder and subfolders
    const getFolderAndSubfolderIds = (folderId: string): string[] => {
      const ids = [folderId];
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        const children = folders.filter(f => f.parent_folder_id === folderId);
        children.forEach(child => {
          ids.push(...getFolderAndSubfolderIds(child.id));
        });
      }
      return ids;
    };

    const relevantFolderIds = getFolderAndSubfolderIds(selectedFolderId);
    const folderDocuments = filteredAndSortedDocuments.filter(doc =>
      doc.folder_ids?.some(id => relevantFolderIds.includes(id))
    );

    // Remove duplicates
    return folderDocuments.filter((doc, index, self) =>
      index === self.findIndex(d => d.id === doc.id)
    );
  }, [selectedFolderId, filteredAndSortedDocuments, folders]);

  return (
    <div className="min-h-[50vh] max-w-7xl max-h-[90vh] overflow-auto mx-auto p-4 md:p-6 lg:p-8 shadow-sm">
        {/* Enhanced Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-blue-100 dark:bg-blue-500/20 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium">
            <Zap className="h-4 w-4" />
            AI-Powered Document Processing
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-blue-300 bg-clip-text text-transparent mb-4">
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

        {/* Main Content Area */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Folder Tree (Sticky) */}
          <div className="col-span-12 lg:col-span-3">
            <div className="lg:sticky lg:top-6 h-fit">
              <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Folders</CardTitle>
                    <SubscriptionGuard
                      feature="Folders"
                      limitFeature="maxFolders"
                      currentCount={folders.length}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCreateFolder(null)}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </SubscriptionGuard>
                  </div>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<FolderTreeSkeleton />}>
                    <LazyFolderTree
                      folderTree={folderTree}
                      selectedFolderId={selectedFolderId}
                      onFolderSelect={setSelectedFolderId}
                      onCreateFolder={handleCreateFolder}
                      onRenameFolder={handleRenameFolder}
                      onDeleteFolder={handleDeleteFolder}
                      onMoveFolder={handleMoveFolder}
                      expandedFolders={expandedFolders}
                      onToggleExpand={handleToggleExpand}
                      documentCounts={documentCounts}
                    />
                  </Suspense>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content - Documents */}
          <div className="col-span-12 lg:col-span-9 flex flex-col ">
            {/* Enhanced Upload Area - SubscriptionGuard wraps Card */}
            <SubscriptionGuard
              feature="Documents"
              limitFeature="maxDocUploads"
              currentCount={documents.length}
            >
              <Card className="overflow-hidden border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm mb-8">
                <CardContent className="p-0">
                  <div
                    className={`relative border-2 border-dashed rounded-lg transition-all duration-500 ${
                      dragLocked
                        ? 'border-red-400 bg-red-50 dark:bg-red-500/10 scale-[1.02] shadow-lg cursor-not-allowed opacity-60'
                        : dragActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 scale-[1.02] shadow-lg'
                          : selectedFile
                            ? 'border-green-400 bg-green-50 dark:bg-green-500/10 shadow-lg'
                            : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      } cursor-pointer p-8 md:p-12 ${isUploading || dragLocked ? 'pointer-events-none opacity-75' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !isUploading && !dragLocked && fileInputRef.current?.click()}
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
                      {dragLocked && !selectedFile && (
                        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center justify-center gap-3">
                          <Lock/>
                          <div className="text-left">
                            <p className="font-semibold text-red-800 dark:text-red-300">Upload limit reached</p>
                            <p className="text-sm text-red-700 dark:text-red-400">Upgrade to upload more documents</p>
                          </div>
                        </div>
                      )}
                      <div className={`inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full ${
                        dragLocked
                          ? 'bg-red-100 dark:bg-red-500/20'
                          : selectedFile
                            ? 'bg-green-100 dark:bg-green-500/20 animate-pulse'
                            : 'bg-blue-100 dark:bg-blue-500/20'
                        } mb-4 transition-all duration-300 ${isUploading ? 'animate-bounce' : ''}`}>
                        {isUploading ? (
                          <Loader2 className="h-8 w-8 md:h-10 md:w-10 text-blue-600 dark:text-blue-400 animate-spin" />
                        ) : dragLocked && !selectedFile ? (
                          <Lock/>
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
                              className="bg-gradient-to-r from-blue-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{Math.round(uploadProgress)}% complete</p>
                        </div>
                      ) : selectedFile ? (
                        <div className="w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-200">
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
                            <div className="flex flex-col items-center text-center">
                              {/* Icon Preview */}
                              <div className={`h-20 w-20 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:scale-105 shadow-sm border border-slate-200 dark:border-slate-700 ${
                                getFileCategory(selectedFile.type) === 'image'
                                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300'
                                  : 'bg-white text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                                {React.createElement(getCategoryIcon(getFileCategory(selectedFile.type)), {
                                  className: "h-10 w-10"
                                })}
                              </div>

                              {/* Filename */}
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 break-all line-clamp-2 px-2">
                                {selectedFile.name}
                              </h3>

                              {/* Details Badges */}
                              <div className="flex items-center justify-center gap-3 mb-6 text-sm text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-md font-medium text-xs">
                                  <HardDrive className="h-3.5 w-3.5" />
                                  {formatFileSize(selectedFile.size)}
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-md font-medium text-xs uppercase">
                                  <FileText className="h-3.5 w-3.5" />
                                  {selectedFile.type.split('/')[1] || 'FILE'}
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpload();
                                  }}
                                  disabled={isUploading}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                                  size="lg"
                                >
                                  {isUploading ? (
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                  ) : (
                                    <UploadCloud className="h-5 w-5 mr-2" />
                                  )}
                                  Upload
                                </Button>

                                <Button
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                  }}
                                  disabled={isUploading}
                                  className="w-full border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/10 dark:hover:text-red-400 transition-colors"
                                  size="lg"
                                >
                                  <XCircle className="h-5 w-5 mr-2" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
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
                </CardContent>
              </Card>
              {/* Add Folder Selection for Upload */}
              {selectedFile && !isUploading && (
                <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm mb-8">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Folder className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Save to folder (optional)
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {uploadTargetFolderId
                              ? folders.find((f) => f.id === uploadTargetFolderId)?.name || 'Root'
                              : 'Root / No folder'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUploadFolderSelectorOpen(true)}
                      >
                        Choose Folder
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </SubscriptionGuard>

            {/* Enhanced Controls and Filters */}
            <DocumentFilters
              searchQuery={effectiveSearch}
              onSearchChange={handleSearchChange}
              onRefresh={handleManualRefresh}
              isRefreshing={isRefreshing}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(sb, so) => {
                setSortBy(sb);
                setSortOrder(so);
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              documentStats={documentStats}
            >
                      {/* Selection toggle */}
                      <Button
                        variant={showSelection ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setShowSelection(!showSelection);
                          if (showSelection) {
                            setSelectedDocumentIds([]); // Clear selections
                          }
                        }}
                        className="px-3 gap-2"
                      >
                        {showSelection ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        {showSelection ? `Selected (${selectedDocumentIds.length})` : 'Select'}
                      </Button>
                      
                      {/* Podcast button */}
                      {showSelection && selectedDocumentIds.length > 0 && (
                        <PodcastButton 
                          selectedDocumentIds={selectedDocumentIds}
                          variant="default"
                          size="sm"
                        />
                      )}
            </DocumentFilters>

            {/* Documents Display */}
            <div ref={scrollContainerRef} className="space-y-6 max-h-[80vh] overflow-auto pb-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-200">
                  {selectedFolderId
                    ? `${folders.find(f => f.id === selectedFolderId)?.name || 'Folder'} (${filteredDocumentsByFolder.length})`
                    : `Your Files (${filteredDocumentsByFolder.length})`}
                </h2>
              </div>

              {/* Initial loading skeletons */}
              {dataLoading && filteredDocumentsByFolder.length === 0 ? (
                viewMode === 'grid' ? <DocumentGridSkeleton /> : <DocumentListSkeleton />
              ) : filteredDocumentsByFolder.length === 0 ? (
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-12 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                      {selectedFolderId ? (
                        <Folder className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                      ) : effectiveSearch || selectedCategory !== 'all' || selectedStatus !== 'all' ? (
                        <Search className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                      ) : (
                        <FileText className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      {selectedFolderId
                        ? 'No files in this folder'
                        : effectiveSearch || selectedCategory !== 'all' || selectedStatus !== 'all'
                          ? 'No files match your filters'
                          : 'No files uploaded yet'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-500 mb-4">
                      {selectedFolderId
                        ? 'Upload files or move existing files to this folder'
                        : effectiveSearch || selectedCategory !== 'all' || selectedStatus !== 'all'
                          ? 'Try adjusting your search terms or filters'
                          : 'Upload your first document or image to get started with AI analysis'}
                    </p>
                    <SubscriptionGuard
                      feature="Documents"
                      limitFeature="maxDocUploads"
                      currentCount={documents.length}
                    >
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <UploadCloud className="h-4 w-4 mr-2" />
                        Upload First Document
                      </Button>
                    </SubscriptionGuard>
                  </CardContent>
                </Card>
              ) : (
                <Suspense
                  fallback={
                    viewMode === 'grid' ? <DocumentGridSkeleton /> : <DocumentListSkeleton />
                  }
                >
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6'
                        : 'space-y-4'
                    }
                  >
                    {filteredDocumentsByFolder.map((doc, idx) => {
                      const isLast = idx === filteredDocumentsByFolder.length - 1;
                      const uniqueKey = `${doc.id}-${idx}`;
                      const isProcessing = isDocumentProcessing(doc.id);
                      
                      return (
                        <DocumentCardItem
                          key={uniqueKey}
                          ref={isLast ? lastDocumentElementRef : null}
                          doc={doc}
                          viewMode={viewMode}
                          isSelected={selectedDocumentIds.includes(doc.id)}
                          isProcessing={isProcessing}
                          isUploading={isUploading}
                          showSelection={showSelection}
                          onToggleSelect = {(id) => {
                              setSelectedDocumentIds(prev => 
                                prev.includes(id) 
                                  ? prev.filter(i => i !== id)
                                  : [...prev, id]
                              );
                          }}
                          onPreview={openPreview}
                          onDelete={handleDeleteDocument}
                          onMove={handleMoveDocument}
                          onRetry={triggerAnalysis}
                          onSelectFolder={setSelectedFolderId}
                          folders={folders}
                        />
                      );
                    })}
                  </div>
                </Suspense>
              )}
            {/* Loading More / No More Indicator */}
            {(dataPagination?.documents?.hasMore || isLoading) && (
              <div
                key="loading-indicator"
                className={`w-full flex flex-col justify-center items-center py-8 ${viewMode === 'grid' ? 'col-span-full' : ''}`}
              >
                {isLoading ? ( // FIX: Use isLoading boolean
                  /* CASE 1: Actually Loading - Show Spinner */
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="font-medium">Fetching more documents...</span>
                  </div>
                ) : (
                  /* CASE 2: Idle but has more - Show Scroll Hint or Manual Button */
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm text-slate-400 dark:text-gray-500">
                      Scroll to load more
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadMoreDocuments()}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      Click here if not loading
                    </Button>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        <Suspense fallback={null}>
          <LazyCreateFolderDialog
            open={createFolderDialogOpen}
            onOpenChange={setCreateFolderDialogOpen}
            onCreateFolder={handleCreateFolderSubmit}
            parentFolderId={parentFolderForNew}
            parentFolderName={
              parentFolderForNew
                ? folders.find((f) => f.id === parentFolderForNew)?.name
                : undefined
            }
          />
        </Suspense>

        <Suspense fallback={null}>
          <LazyRenameFolderDialog
            open={renameFolderDialogOpen}
            onOpenChange={setRenameFolderDialogOpen}
            folder={folderToRename}
            onRenameFolder={handleRenameFolderSubmit}
          />
        </Suspense>

        <Suspense fallback={null}>
          <LazyFolderSelector
            open={uploadFolderSelectorOpen}
            onOpenChange={setUploadFolderSelectorOpen}
            folderTree={folderTree}
            selectedFolderId={uploadTargetFolderId}
            onSelect={setUploadTargetFolderId}
            title="Select Folder for Upload"
            description="Choose where to save this document"
            allowRoot
          />
        </Suspense>
        <Suspense fallback={null}>
          <LazyMoveDocumentDialog
            open={moveDocumentDialogOpen}
            onOpenChange={setMoveDocumentDialogOpen}
            document={documentToMove}
            folderTree={folderTree}
            onMoveDocument={handleMoveDocumentSubmit}
          />
        </Suspense>

        {/* Move Folder Dialog */}
        <Suspense fallback={null}>
          <LazyMoveFolderDialog
            open={moveFolderDialogOpen}
            onOpenChange={setMoveFolderDialogOpen}
            folder={folderToMove}
            folderTree={folderTree}
            onMoveFolder={handleMoveFolderSubmit}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={handleRenameFolder}
            expandedFolders={expandedFolders}
            onToggleExpand={handleToggleExpand}
          />
        </Suspense>

        {/* Enhanced Preview Dialog */}
        {previewOpen && selectedDocument && (
          <Suspense fallback={null}>
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-[90vh] sm:max-w-6xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                
                {/* Modern Header */}
                <div className="flex-none px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`flex-none h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center border shadow-sm transition-colors ${
                      getFileCategory(selectedDocument.file_type) === 'image'
                        ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border-purple-100 dark:border-purple-500/20'
                        : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100 dark:border-blue-500/20'
                    }`}>
                      {getFileCategory(selectedDocument.file_type) === 'image' && selectedDocument.file_url ? (
                        <img src={selectedDocument.file_url} alt="" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        React.createElement(getCategoryIcon(getFileCategory(selectedDocument.file_type)), {
                          className: "h-5 w-5 md:h-6 md:w-6"
                        })
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 truncate pr-4">
                        {selectedDocument.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          <HardDrive className="h-3 w-3" />
                          {formatFileSize(selectedDocument.file_size)}
                        </span>
                        <span className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          <Calendar className="h-3 w-3" />
                          {formatDate(selectedDocument.created_at)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md flex items-center gap-1 font-medium text-[10px] uppercase tracking-wider border ${
                          getStatusColor(selectedDocument.processing_status as string)
                        }`}>
                          {selectedDocument.processing_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 md:gap-2">
                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center gap-2 mr-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(selectedDocument)}
                        className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedDocument.content_extracted) {
                           copyToClipboard(selectedDocument.content_extracted);
                          } else {
                           toast.error("No content to copy");
                          }
                        }}
                        className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                         title="Copy Content"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this document?')) {
                            handleClosePreview();
                            handleDeleteDocument(selectedDocument.id, selectedDocument.file_url);
                          }
                        }}
                        disabled={isUploading || isDocumentProcessing(selectedDocument.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClosePreview}
                      className="rounded-full h-9 w-9 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Responsive Content Area */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
                  
                  {/* Left Panel: Preview */}
                  <div className="flex-none lg:flex-1 lg:basis-[45%] lg:max-h-full min-h-[250px] lg:min-h-0 relative flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-black/20">
                     <div className="absolute inset-4 md:inset-8 flex items-center justify-center">
                        <div className="w-full h-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex items-center justify-center relative group">
                          {getFileCategory(selectedDocument.file_type) === 'image' && selectedDocument.file_url ? (
                            <>
                              <img
                                src={selectedDocument.file_url}
                                alt={selectedDocument.title}
                                className="max-w-full max-h-full object-contain p-2"
                              />
                              <a 
                                href={selectedDocument.file_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg backdrop-blur-sm"
                              >
                                <Maximize2 className="h-4 w-4" />
                              </a>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                              <div className="h-24 w-24 rounded-full bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center">
                                {React.createElement(getCategoryIcon(getFileCategory(selectedDocument.file_type)), {
                                  className: "h-10 w-10 text-slate-400"
                                })}
                              </div>
                              <div>
                                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-1">
                                  Preview Unavailable
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">
                                  This file type cannot be previewed directly in the browser.
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(selectedDocument)}
                                className="bg-white dark:bg-slate-800"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download File
                              </Button>
                            </div>
                          )}
                        </div>
                     </div>
                  </div>

                  {/* Right Panel: Content & Metadata */}
                  <div className="flex-1 lg:basis-[55%] flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
                    {/* Panel Title */}
                    <div className="flex-none px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Zap className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Extracted Content</span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-normal">
                         AI Analysis
                      </Badge>
                    </div>

                    {/* Scrollable Text Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                       {selectedDocument.processing_status === 'failed' && (
                        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex flex-col gap-3">
                           <div className="flex items-start gap-3">
                              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-red-900 dark:text-red-200">Processing Failed</h4>
                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                  {selectedDocument.processing_error || 'An unknown error occurred during AI processing.'}
                                </p>
                              </div>
                           </div>
                           <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleClosePreview();
                              triggerAnalysis(selectedDocument);
                            }}
                            className="bg-white dark:bg-transparent border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 w-fit ml-auto"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-2" />
                            Retry
                          </Button>
                        </div>
                       )}

                       {selectedDocument.content_extracted ? (
                         <div className="prose prose-sm dark:prose-invert max-w-none prose-slate">
                            {/* Simple markdown check and render */}
                            {/^(#{1,6}\s)|(^```)|(^-\s)|(^\*\s)|(^>\s)/m.test(selectedDocument.content_extracted) ? (
                              <DocumentMarkdownRenderer content={selectedDocument.content_extracted} />
                            ) : (
                              <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed font-sans text-sm">
                                {selectedDocument.content_extracted}
                              </p>
                            )}
                         </div>
                       ) : (
                         <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600">
                            {selectedDocument.processing_status === 'processing' ? (
                                <>
                                  <Loader2 className="h-8 w-8 animate-spin mb-3 text-blue-500" />
                                  <p className="text-sm">AI is analyzing this document...</p>
                                </>
                            ) : (
                                <>
                                  <FileText className="h-10 w-10 mb-3 opacity-20" />
                                  <p className="text-sm">No content extracted yet.</p>
                                </>
                            )}
                         </div>
                       )}
                    </div>

                    {/* Mobile Only Sticky Actions Footer */}
                    <div className="md:hidden flex-none p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 gap-3 shadow-lg z-20">
                      <Button variant="outline" size="sm" onClick={() => handleDownload(selectedDocument)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button 
                         variant="outline"
                         size="sm" 
                         onClick={() => {
                          if (selectedDocument.content_extracted) copyToClipboard(selectedDocument.content_extracted);
                         }}
                         disabled={!selectedDocument.content_extracted}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        className="col-span-2"
                        onClick={() => {
                          if (confirm('Delete this document?')) {
                            handleClosePreview();
                            handleDeleteDocument(selectedDocument.id, selectedDocument.file_url);
                          }
                        }}
                      >
                         <Trash2 className="h-4 w-4 mr-2" />
                         Delete Document
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </Suspense>
        )}
        
      </div>
  );
};
