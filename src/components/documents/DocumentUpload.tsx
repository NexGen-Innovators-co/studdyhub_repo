
// src/components/DocumentUpload.tsx
import React, { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import {
  UploadCloud, FileText, Image, Loader2, Check, XCircle, AlertTriangle,
  RefreshCw, Eye, Download, Calendar, HardDrive, Search, Filter,
  FileVideo, FileAudio, Archive, Code, Play, Pause, Volume2, FileBarChart,
  ChevronDown, ChevronRight, Grid, List, SortAsc, SortDesc,
  Maximize2, X, Copy, Share, Edit, Trash2, MoreHorizontal,
  FileSpreadsheet, File, Zap, Clock, Users, Folder, Plus, CheckSquare, Square, Lock
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { Document } from '../../types/Document';
import { useAuth } from '../../hooks/useAuth';
import { useAppContext } from '../../hooks/useAppContext';
import { DocumentFolder, CreateFolderInput, UpdateFolderInput } from '../../types/Folder';
import { Skeleton } from '../ui/skeleton';
import DocumentMarkdownRenderer from '../aiChat/Components/DocumentMarkdownRenderer';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { PodcastButton } from '../dashboard/PodcastButton';
import { Checkbox } from '../ui/checkbox';
import { useLocation, useNavigate } from 'react-router-dom';
import { a } from 'node_modules/framer-motion/dist/types.d-Cjd591yU';

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

/* -------------------------------------------------------------------------- */
/* Skeletons (shown while lazy chunks load) */
/* -------------------------------------------------------------------------- */
const DocumentCardSkeleton = () => (
  <Card className="animate-pulse">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </CardContent>
  </Card>
);

const FolderTreeSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-32" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 pl-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const DocumentGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <DocumentCardSkeleton key={i} />
    ))}
  </div>
);

const DocumentListSkeleton = () => (
  <div className="space-y-4">
    {[...Array(6)].map((_, i) => (
      <DocumentCardSkeleton key={i} />
    ))}
  </div>
);

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [dragLocked, setDragLocked] = useState(false); // Lock drag when not allowed
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set());

  // Enhanced UI State
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Podcast selection state
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [showSelection, setShowSelection] = useState(false);

  const effectiveSearch = externalSearchQuery ?? internalSearch;

  const handleSearchChange = (value: string) => {
    setInternalSearch(value);
    onSearchChange?.(value);
  };

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
        console.error('Error fetching preview document:', error);
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
// Utility to override .ts file MIME type to text/typescript (fixes browser misclassification)
function overrideTsMimeType(file: File): File {
  if (file && file.name.toLowerCase().endsWith('.ts') && file.type === 'video/vnd.dlna.mpeg-tts') {
    try {
      // Use a Blob to create a new File with the correct MIME type
      const blob = file.slice(0, file.size, 'text/typescript');
      return new (window.File as { new(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag): File })([blob], file.name, { type: 'text/typescript', lastModified: file.lastModified });
    } catch {
      // If File constructor fails, fallback to original file
      return file;
    }
  }
  return file;
}
  const fileInputRef = useRef<HTMLInputElement>(null);


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

  // Folder state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<DocumentFolder | null>(null);
  const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null);
  const [uploadFolderSelectorOpen, setUploadFolderSelectorOpen] = useState(false);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string | null>(null);

  // 2. Lazy load folder dialogs
  const LazyMoveDocumentDialog = lazy(() =>
    import('./MoveDocumentDialog').then((m) => ({ default: m.MoveDocumentDialog }))
  );

  const LazyMoveFolderDialog = lazy(() =>
    import('./MoveFolderDialog').then((m) => ({ default: m.MoveFolderDialog }))
  );

  // 3. Add state for move operations in DocumentUpload component:
  const [moveDocumentDialogOpen, setMoveDocumentDialogOpen] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<Document | null>(null);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [folderToMove, setFolderToMove] = useState<DocumentFolder | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 4. Add handler to open move dialog for documents:
  const handleMoveDocument = useCallback((document: Document) => {
    setDocumentToMove(document);
    setMoveDocumentDialogOpen(true);
  }, []);

  // 5. Add handler to move document to folder:
  const handleMoveDocumentSubmit = useCallback(async (documentId: string, targetFolderId: string | null) => {
    try {
      if (!user?.id) return;

      // Get current folder_ids
      const document = documents.find(d => d.id === documentId);
      if (!document) return;

      let newFolderIds: string[] = [];

      if (targetFolderId) {
        // Moving to a folder - replace all folder associations with just this one
        newFolderIds = [targetFolderId];
      } else {
        // Moving to root - clear all folder associations
        newFolderIds = [];
      }

      // Insert new folder relationship
      if (targetFolderId) {
        const { error } = await supabase.from('document_folder_items').insert([
          { folder_id: targetFolderId, document_id: documentId, }
        ]);
        if (error) {
          toast.error('Failed to move document');
          return;
        }
      }

      // Update local state
      const updatedDocument = { ...document, folder_ids: newFolderIds };
      onDocumentUpdated(updatedDocument);

      toast.success('Document moved successfully!');
    } catch (error: any) {
      toast.error(`Failed to move document: ${error.message}`);
    }
  }, [documents, user, onDocumentUpdated, loadDataIfNeeded]);

  // 6. Add handler to add document to folder (without removing from others):
  const handleAddDocumentToFolder = useCallback(async (documentId: string, folderId: string) => {
    try {
      if (!user?.id) return;

      const document = documents.find(d => d.id === documentId);
      if (!document) return;

      const currentFolderIds = document.folder_ids || [];

      // Check if already in folder
      if (currentFolderIds.includes(folderId)) {
        toast.info('Document is already in this folder');
        return;
      }

      // Add folder to existing folders
      const newFolderIds = [...currentFolderIds, folderId];

      const { error } = await supabase
        .from('documents')
        .update({ folder_ids: newFolderIds })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) {
        toast.error('Failed to add document to folder');
        return;
      }

      const updatedDocument = { ...document, folder_ids: newFolderIds };
      onDocumentUpdated(updatedDocument);

      await loadDataIfNeeded('documents');

      toast.success('Document added to folder!');
    } catch (error: any) {
      toast.error(`Failed to add document to folder: ${error.message}`);
    }
  }, [documents, user, onDocumentUpdated, loadDataIfNeeded]);

  // 7. Add handler to remove document from folder:
  const handleRemoveDocumentFromFolder = useCallback(async (documentId: string, folderId: string) => {
    try {
      if (!user?.id) return;

      const document = documents.find(d => d.id === documentId);
      if (!document) return;

      const currentFolderIds = document.folder_ids || [];
      const newFolderIds = currentFolderIds.filter(id => id !== folderId);

      const { error } = await supabase
        .from('documents')
        .update({ folder_ids: newFolderIds })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) {
        toast.error('Failed to remove document from folder');
        return;
      }

      const updatedDocument = { ...document, folder_ids: newFolderIds };
      onDocumentUpdated(updatedDocument);

      await loadDataIfNeeded('documents');

      toast.success('Document removed from folder!');
    } catch (error: any) {
      toast.error(`Failed to remove document from folder: ${error.message}`);
    }
  }, [documents, user, onDocumentUpdated, loadDataIfNeeded]);

  // 8. Update handleMoveFolder implementation:
  const handleMoveFolder = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setFolderToMove(folder);
      setMoveFolderDialogOpen(true);
    }
  }, [folders]);

  // 9. Add handler to move folder to another folder:
  const handleMoveFolderSubmit = useCallback(async (folderId: string, targetParentId: string | null) => {
    try {
      if (!user?.id) return;

      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;

      // Prevent moving folder into itself or its descendants
      const isDescendant = (checkId: string, ancestorId: string): boolean => {
        const descendants = folders.filter(f => f.parent_folder_id === ancestorId);
        if (descendants.some(d => d.id === checkId)) return true;
        return descendants.some(d => isDescendant(checkId, d.id));
      };

      if (targetParentId && (targetParentId === folderId || isDescendant(targetParentId, folderId))) {
        toast.error('Cannot move folder into itself or its descendants');
        return;
      }

      // Update database
      const { error } = await supabase
        .from('document_folders')
        .update({ parent_folder_id: targetParentId })
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) {
        toast.error('Failed to move folder');
        return;
      }

      // Refresh folders
      await loadDataIfNeeded('folders');

      toast.success('Folder moved successfully!');
    } catch (error: any) {
      toast.error(`Failed to move folder: ${error.message}`);
    }
  }, [folders, user, loadDataIfNeeded]);

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
      case 'presentation': return FileBarChart;
      case 'archive': return Archive;
      case 'code': return Code;
      default: return File;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'image': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-500/20 border-green-200 dark:border-green-500/20';
      case 'video': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/20';
      case 'audio': return 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-500/20 border-pink-200 dark:border-pink-500/20';
      case 'document': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/20';
      case 'spreadsheet': return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/20';
      case 'presentation': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/20';
      case 'archive': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/20';
      case 'code': return 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/20';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/20 border-gray-200 dark:border-gray-500/20';
    }
  };

  // Document statistics
  const documentStats = useMemo(() => {
    const stats = {
      all: allDocuments.length,
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

    allDocuments.forEach(doc => { 
    const category = getFileCategory(doc.file_type);
    stats[category as keyof typeof stats]++;
    stats[doc.processing_status as keyof typeof stats]++;
  });

    return stats;
  }, [allDocuments]);

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
     let filtered = allDocuments.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      doc.content_extracted?.toLowerCase().includes(effectiveSearch.toLowerCase());

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
          aValue = a.created_at;
          bValue = b.created_at;
          break;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [allDocuments, effectiveSearch, selectedCategory, selectedStatus, sortBy, sortOrder]);

  const handleFileSelection = useCallback((file: File) => {
    // Fix .ts files being misclassified as video
    file = overrideTsMimeType(file);
    const MAX_FILE_SIZE_MB = 200;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Block only clearly unsafe types (executables, scripts, etc.)
    const forbiddenExtensions = [
      '.exe', '.bat', '.cmd', '.sh', '.msi', '.apk', '.com', '.scr', '.pif', '.cpl', '.jar', '.vb', '.vbs', '.wsf', '.ps1', '.gadget', '.reg', '.dll', '.sys', '.drv', '.asp', '.aspx', '.cgi', '.pl', '.php', '.pyc', '.pyo', '.so', '.dylib', '.bin', '.run', '.app', '.deb', '.rpm', '.pkg', '.service', '.lnk', '.inf', '.hta', '.msc', '.msp', '.mst', '.ocx', '.sct', '.shb', '.shs', '.url', '.js', '.jse', '.ws', '.wsf', '.wsh', '.hta', '.msu', '.msh', '.msh1', '.msh2', '.mshxml', '.msh1xml', '.msh2xml', '.scf', '.lnk', '.iso', '.img', '.vhd', '.vhdx', '.vmdk', '.ova', '.ovf', '.vdi', '.vbox', '.qcow', '.qcow2', '.vhd', '.vhdx', '.vmdk', '.ova', '.ovf', '.vdi', '.vbox', '.qcow', '.qcow2'
    ];
    const fileName = file.name.toLowerCase();
    if (forbiddenExtensions.some(ext => fileName.endsWith(ext))) {
      toast.error('This file type is not allowed for security reasons.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Optionally, block files with MIME types that are known to be dangerous
    const forbiddenMimeTypes = [
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-msinstaller',
      'application/x-executable',
      'application/x-sh',
      'application/x-bat',
      'application/x-cmd',
      'application/x-dosexec',
      'application/x-shellscript',
      'application/x-elf',
      'application/x-dosexec',
      'application/x-msi',
      'application/x-ms-shortcut',
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-msinstaller',
      'application/x-executable',
      'application/x-sh',
      'application/x-bat',
      'application/x-cmd',
      'application/x-dosexec',
      'application/x-shellscript',
      'application/x-elf',
      'application/x-msi',
      'application/x-ms-shortcut',
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-msinstaller',
      'application/x-executable',
      'application/x-sh',
      'application/x-bat',
      'application/x-cmd',
      'application/x-dosexec',
      'application/x-shellscript',
      'application/x-elf',
      'application/x-msi',
      'application/x-ms-shortcut',
    ];
    if (forbiddenMimeTypes.includes(file.type)) {
      toast.error('This file type is not allowed for security reasons.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Allow all other files; backend will handle unsupported types
    setSelectedFile(file);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Use subscription gating for drag/drop
    const isDocumentLimitReached = subscriptionLimits.maxDocUploads !== -1 && documents.length >= subscriptionLimits.maxDocUploads;
    const canUpload = canUploadDocuments() && !isDocumentLimitReached && !isUploading;
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(canUpload);
      setDragLocked(!canUpload); // Lock if cannot upload
    } else if (e.type === "dragleave") {
      setDragActive(false);
      setDragLocked(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragLocked(false);
    // Check if user has permission to upload
    const isDocumentLimitReached = subscriptionLimits.maxDocUploads !== -1 && documents.length >= subscriptionLimits.maxDocUploads;
    if (!canUploadDocuments() || isDocumentLimitReached) {
      toast.error('Document upload is locked. Upgrade your plan to upload more documents.');
      return;
    }
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
        const uploadedDoc = result.documents[0];

        // Add document to folder if selected
        if (uploadTargetFolderId) {
          await appOperations.addDocumentToFolder(uploadedDoc.id, uploadTargetFolderId);
        }

        // IMPORTANT: Refresh documents to get the latest data with folder_ids
        // This ensures the document count is updated correctly

        if (user?.id && forceRefreshDocuments) {
          await forceRefreshDocuments();
        }

        toast.success(
          uploadTargetFolderId
            ? `Document uploaded and added to folder!`
            : `Successfully uploaded and processed "${selectedFile.name}"!`
        );

        // Reset upload target folder
        setUploadTargetFolderId(null);
      } else {
        toast.warning('File processed but no documents were returned.');
      }

      // Reset form
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
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

            }

            if (storagePath) {
              const { error: storageError } = await supabase.storage
                .from('chat-documents')
                .remove([storagePath]);

              if (storageError) {
                toast.warning(`File might not have been removed from storage. Error: ${storageError.message}`);
              }
            } else {
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
          // console.log('Load more triggered'); 
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
                          <div className="flex gap-3 justify-center mt-4">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpload();
                              }}
                              disabled={isUploading}
                              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                            >
                              {isUploading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <UploadCloud className="h-4 w-4 mr-2" />
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
                              className="text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:border-red-300"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
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
                        value={effectiveSearch}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10 bg-white dark:bg-slate-700"
                      />
                    </div>

                    {/* Refresh Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="gap-2"
                      title="Refresh documents"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>

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
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                      // Create a unique key that includes the index to prevent duplicates
                      const uniqueKey = `${doc.id}-${idx}`;
                      return (
                        <Card
                          key={uniqueKey}
                          ref={isLast ? lastDocumentElementRef : null}
                          className={`group overflow-hidden hover:shadow-2xl transition-all duration-300 border-blue-200/50 dark:border-blue-900/50 h-full flex flex-col relative rounded-2xl cursor-pointer animate-in slide-in-from-top-2 fade-in duration-500 ${viewMode === 'list' ? 'flex' : ''}`}
                        >
                          <CardContent className="p-0">
                            {viewMode === 'grid' ? (
                              <div className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden">
                                {/* Document Preview or Icon */}

                                <div
                                  className="absolute inset-0 bg-slate-200 dark:bg-slate-800 text-slate-900 flex items-center justify-center"
                                  style={{
                                    backgroundImage: getFileCategory(doc.file_type) === 'image' && doc.file_url ? `url(${doc.file_url})` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                  }}
                                >
                                  {getFileCategory(doc.file_type) !== 'image' && (
                                    <div className="w-full h-full flex items-center justify-center">
                                      {React.createElement(getCategoryIcon(getFileCategory(doc.file_type)), {
                                        className: "h-16 w-16 text-blue-600 dark:text-blue-300 opacity-70"
                                      })}
                                    </div>
                                  )}
                                </div>
                                {/* Gradient Overlay */}
                                <div className="absolute border inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent dark:from-slate-900/90 dark:via-slate-900/60 dark:to-transparent" />

                               

                                {/* Selection checkbox */}
                                {showSelection && (
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDocumentIds(prev => 
                                        prev.includes(doc.id) 
                                          ? prev.filter(id => id !== doc.id)
                                          : [...prev, doc.id]
                                      );
                                    }}
                                    className="absolute top-12 left-2 bg-white dark:bg-slate-800 rounded-md p-1.5 shadow-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 z-10"
                                  >
                                    <Checkbox 
                                      checked={selectedDocumentIds.includes(doc.id)}
                                      onCheckedChange={() => {
                                        setSelectedDocumentIds(prev => 
                                          prev.includes(doc.id) 
                                            ? prev.filter(id => id !== doc.id)
                                            : [...prev, doc.id]
                                        );
                                      }}
                                      className="h-5 w-5"
                                    />
                                  </div>
                                )}

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

                                {/* Bottom Overlay: Title, Author, Stats, Actions */}
                                <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-3 sm:p-4">
                                  {/* Title & Author */}
                                  <div className="space-y-1.5 sm:space-y-2 mb-2">
                                    <h3 className="text-white dark:text-slate-100 font-bold text-sm sm:text-base line-clamp-2 leading-tight">
                                      {doc.title}
                                    </h3>
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                      <Folder className="h-5 w-5 sm:h-6 sm:w-6 ring-2 ring-white/20 dark:ring-slate-700/40" />
                                      <span className="text-white/90 dark:text-slate-200 text-xs sm:text-sm font-medium truncate">
                                        {folders.find(f => f.id === doc.folder_ids?.[0])?.name || 'No Folder'}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Stats */}
                                  <div className="flex items-center gap-2 sm:gap-3 text-xs text-white/80 dark:text-slate-300 mb-2">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      <span>{doc.created_at ? (new Date(doc.created_at)).toLocaleDateString() : 'Unknown Date'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <HardDrive className="h-3 w-3" />
                                      <span>{formatFileSize(doc.file_size)}</span>
                                    </div>
                                  </div>
                                  {/* Action Buttons - hover/focus overlay */}
                                  <div className={`transition-all duration-300 flex gap-1.5 sm:gap-2 ${isDocumentProcessing(doc.id) ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}> 
                                    {doc.processing_status === 'failed' && (
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={(e) => { e.stopPropagation(); triggerAnalysis(doc); }}
                                        disabled={isUploading || isDocumentProcessing(doc.id)}
                                        className="border-white/30 dark:border-slate-700/40 bg-white/10 dark:bg-slate-900/30 hover:bg-white/20 dark:hover:bg-slate-900/50 text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm h-8 w-8 sm:h-9 sm:w-9 backdrop-blur-sm"
                                        title="Retry"
                                      >
                                        {isDocumentProcessing(doc.id) ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => { e.stopPropagation(); openPreview(doc); }}
                                      className="border-white/30 dark:border-slate-700/40 bg-white/10 dark:bg-slate-900/30 hover:bg-white/20 dark:hover:bg-slate-900/50 text-white dark:text-slate-200 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                                      title="Preview"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id, doc.file_url); }}
                                      disabled={isUploading}
                                      className="border-white/30 dark:border-slate-700/40 bg-white/10 dark:bg-slate-900/30 hover:bg-white/20 dark:hover:bg-slate-900/50 text-red-400 dark:text-red-300 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => { e.stopPropagation(); handleMoveDocument(doc); }}
                                      className="border-white/30 dark:border-slate-700/40 bg-white/10 dark:bg-slate-900/30 hover:bg-white/20 dark:hover:bg-slate-900/50 text-white dark:text-slate-200 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                                      title="Move"
                                    >
                                      <Folder className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* List View */}
                                <div className="flex items-center p-6 gap-4">
                                  <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-lg flex items-center justify-center relative">
                                    {getFileCategory(doc.file_type) === 'image' && doc.file_url ? (
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
                                            {formatDate(new Date(doc.created_at).toLocaleDateString() || 'Unknown Date')}
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
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleMoveDocument(doc)}
                                            className="text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-500/10"
                                          >
                                            <Folder className="h-4 w-4 mr-2" />
                                            Move
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Add this in the document info section */}
                            {doc.folder_ids && doc.folder_ids.length > 0 && (
                              <div className="px-6 pb-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-slate-500 dark:text-slate-400">In:</span>
                                  {doc.folder_ids.map(folderId => {
                                    const folder = folders.find(f => f.id === folderId);
                                    return folder ? (
                                      <div
                                        key={folderId}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-700 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                                        onClick={() => setSelectedFolderId(folderId)}
                                      >
                                        <Folder className="h-3 w-3" style={{ color: folder.color }} />
                                        {folder.name}
                                      </div>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
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
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0">
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
                        {formatDate(new Date(selectedDocument.created_at).toISOString() || 'Unknown Date')}
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
                    onClick={handleClosePreview}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-160px)] space-y-6">
                  {/* File Preview */}
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      File Preview
                    </h3>
                    <div className="aspect-video bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                      {getFileCategory(selectedDocument.file_type) === 'image' && selectedDocument.file_url ? (
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
                      {selectedDocument.content_extracted ? (
                        (/^(#{1,6}\s)|(^```)|(^-\s)|(^\*\s)|(^>\s)/m.test(selectedDocument.content_extracted)) ? (
                          <DocumentMarkdownRenderer content={selectedDocument.content_extracted} />
                        ) : (
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {selectedDocument.content_extracted}
                          </p>
                        )
                      ) : (
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">No content has been extracted from this file yet.</p>
                      )}
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
                          handleClosePreview();
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
                  <div className="flex flex-col xs:flex-row flex-wrap gap-2 xs:gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 w-full">
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
                        handleClosePreview();
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
          </Suspense>
        )}
        
      </div>
  );
};