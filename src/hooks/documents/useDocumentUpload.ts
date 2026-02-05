import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { Document } from '../../types/Document'; // Update path if needed
import { User } from '@supabase/supabase-js';
import { overrideTsMimeType } from '../../components/documents/documentUtils'; // Update path if needed

interface AppOperations {
  addDocumentToFolder: (docId: string, folderId: string) => Promise<void | boolean>;
}

interface UseDocumentUploadProps {
  user: User | null;
  documents: Document[];
  subscriptionLimits: { maxDocUploads: number };
  canUploadDocuments: () => boolean;
  appOperations: AppOperations;
  forceRefreshDocuments: () => Promise<void>;
  onDocumentUpdated: (doc: Document) => void;
  uploadTargetFolderId: string | null;
  setUploadTargetFolderId: (id: string | null) => void;
}

export const useDocumentUpload = ({
  user,
  documents,
  subscriptionLimits,
  canUploadDocuments,
  appOperations,
  forceRefreshDocuments,
  onDocumentUpdated,
  uploadTargetFolderId,
  setUploadTargetFolderId
}: UseDocumentUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [dragLocked, setDragLocked] = useState(false);
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  const handleFileSelection = useCallback((file: File) => {
    file = overrideTsMimeType(file);
    const MAX_FILE_SIZE_MB = 200;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const forbiddenExtensions = [
      '.exe', '.bat', '.cmd', '.sh', '.msi', '.apk', '.com', '.scr', '.pif', '.cpl', '.jar', '.vb', '.vbs', '.wsf', '.ps1', '.gadget', '.reg', '.dll', '.sys', '.drv', '.asp', '.aspx', '.cgi', '.pl', '.php', '.pyc', '.pyo', '.so', '.dylib', '.bin', '.run', '.app', '.deb', '.rpm', '.pkg', '.service', '.lnk', '.inf', '.hta', '.msc', '.msp', '.mst', '.ocx', '.sct', '.shb', '.shs', '.url', '.js', '.jse', '.ws', '.wsf', '.wsh', '.hta', '.msu', '.msh', '.msh1', '.msh2', '.mshxml', '.msh1xml', '.msh2xml', '.scf', '.lnk', '.iso', '.img', '.vhd', '.vhdx', '.vmdk', '.ova', '.ovf', '.vdi', '.vbox', '.qcow', '.qcow2'
    ];
    const fileName = file.name.toLowerCase();
    if (forbiddenExtensions.some(ext => fileName.endsWith(ext))) {
      toast.error('This file type is not allowed for security reasons.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const forbiddenMimeTypes = [
      'application/x-msdownload', 'application/x-msdos-program', 'application/x-msinstaller', 'application/x-executable', 'application/x-sh', 'application/x-bat', 'application/x-cmd', 'application/x-dosexec', 'application/x-shellscript', 'application/x-elf', 'application/x-ms-shortcut'
    ];
    if (forbiddenMimeTypes.includes(file.type)) {
      toast.error('This file type is not allowed for security reasons.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isDocumentLimitReached = subscriptionLimits.maxDocUploads !== -1 && documents.length >= subscriptionLimits.maxDocUploads;
    const canUpload = canUploadDocuments() && !isDocumentLimitReached && !isUploading;
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(canUpload);
      setDragLocked(!canUpload); 
    } else if (e.type === "dragleave") {
      setDragActive(false);
      setDragLocked(false);
    }
  }, [subscriptionLimits.maxDocUploads, documents.length, canUploadDocuments, isUploading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragLocked(false);
    
    const isDocumentLimitReached = subscriptionLimits.maxDocUploads !== -1 && documents.length >= subscriptionLimits.maxDocUploads;
    if (!canUploadDocuments() || isDocumentLimitReached) {
      toast.error('Document upload is locked. Upgrade your plan to upload more documents.');
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }, [subscriptionLimits.maxDocUploads, documents.length, canUploadDocuments, handleFileSelection]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    } else {
      setSelectedFile(null);
    }
  }, [handleFileSelection]);


  const handleUpload = useCallback(async () => {
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

        if (uploadTargetFolderId) {
          await appOperations.addDocumentToFolder(uploadedDoc.id, uploadTargetFolderId);
        }

        if (user?.id && forceRefreshDocuments) {
          await forceRefreshDocuments();
        }

        toast.success(
          uploadTargetFolderId
            ? `Document uploaded and added to folder!`
            : `Successfully uploaded and processed "${selectedFile.name}"!`
        );

        setUploadTargetFolderId(null);
      } else {
        toast.warning('File processed but no documents were returned.');
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      toast.error(`Failed to process file: ${error.message}`);
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFile, user?.id, isUploading, uploadTargetFolderId, appOperations, forceRefreshDocuments, setUploadTargetFolderId, getBase64]);

  const triggerAnalysis = useCallback(async (doc: Document): Promise<void> => {
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
  }, [user?.id, processingDocuments, onDocumentUpdated]);

  return {
    selectedFile,
    setSelectedFile,
    isUploading,
    uploadProgress,
    dragActive,
    dragLocked,
    fileInputRef,
    processingDocuments,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleUpload,
    triggerAnalysis
  };
}
