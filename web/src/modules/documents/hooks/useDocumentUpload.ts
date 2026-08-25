import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../integrations/supabase/client';
import { Document } from '../../../types/Document'; // Update path if needed
import { User } from '@supabase/supabase-js';
import { overrideTsMimeType } from '../utils/documentUtils';
import { useUserActivityLogger } from '@/hooks/useUserActivityLogger';

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
  const { logUserActivity } = useUserActivityLogger();
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

    // Keep a reference so we can clear it in finally
    let progressInterval: number | null = null;
    progressInterval = window.setInterval(() => {
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

      // If the file is large, upload it to Storage and send a file_url
      const STORAGE_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5MB
      const payloadFiles: any[] = [];

      if (selectedFile.size > STORAGE_UPLOAD_THRESHOLD) {
        // Upload to storage to avoid sending huge base64 payloads
        const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${user.id}/uploads/${Date.now()}_${safeFileName}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, selectedFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(filePath) as any;
        const publicUrl = publicUrlData?.publicUrl || (publicUrlData && publicUrlData.publicUrl) || null;
        if (!publicUrl) throw new Error('Failed to obtain public URL for uploaded file');

        payloadFiles.push({ name: selectedFile.name, mimeType: selectedFile.type, file_url: publicUrl, size: selectedFile.size });
        setUploadProgress(60);
      } else {
        const base64Data = await getBase64(selectedFile);
        setUploadProgress(30);
        payloadFiles.push({ name: selectedFile.name, mimeType: selectedFile.type, data: base64Data, size: selectedFile.size });
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      const payload = { userId: user.id, files: payloadFiles };

      setUploadProgress(75);

      // warn if the file is in a size range that often triggers long AI work
      const LARGE_NOTIFY_THRESHOLD = 3 * 1024 * 1024; // 3MB
      if (selectedFile.size > LARGE_NOTIFY_THRESHOLD) {
        toast.info('This file is a bit large – processing may take over a minute. It will continue running in the background and appear in your documents when ready.');
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('document-processor', {
        body: payload,
      });

      setUploadProgress(90);

      if (fnError) {
        throw new Error(fnError.message || 'Function invocation failed');
      }
      setUploadProgress(100);

      if (result?.documents && result.documents.length > 0) {
        const uploadedDoc = result.documents[0];

        if (uploadTargetFolderId) {
          await appOperations.addDocumentToFolder(uploadedDoc.id, uploadTargetFolderId);
        }

        if (user?.id && forceRefreshDocuments) {
          await forceRefreshDocuments();
        }

        if (user?.id) {
          void logUserActivity(user.id, 'document', 20);
        }

        // If the document is still processing, poll until completion.
        if (uploadedDoc.processing_status === 'processing' || uploadedDoc.processing_status === 'partial') {
          toast.info("Large file detected, processing in background. We'll notify when complete.");
          const pollInterval = 5000;
          const maxAttempts = 60;
          let attempts = 0;
          const poller = setInterval(async () => {
            attempts++;
            try {
              const { data: docs, error: pollErr } = await supabase
                .from('documents')
                .select('processing_status,processing_metadata')
                .eq('id', uploadedDoc.id)
                .single();
              if (pollErr) throw pollErr;

              if (docs && docs.processing_status !== 'processing' && docs.processing_status !== 'partial') {
                clearInterval(poller);
                if (docs.processing_status === 'completed') {
                  toast.success(`"${selectedFile.name}" finished processing!`);
                  forceRefreshDocuments?.();
                } else {
                  toast.error(`Processing of "${selectedFile.name}" failed.`);
                }
              } else if (attempts >= maxAttempts) {
                clearInterval(poller);
                toast.warning('Processing is taking longer than expected. Please check back later.');
              }
            } catch {
              clearInterval(poller);
            }
          }, pollInterval);
        } else {
          toast.success(
            uploadTargetFolderId
              ? `Document uploaded and added to folder!`
              : `Successfully uploaded and processed "${selectedFile.name}"!`
          );
        }

        setUploadTargetFolderId(null);
      } else {
        toast.warning('File processed but no documents were returned.');
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      // network issues or gateway timeouts sometimes mean the function
      // actually succeeded but the client never received the response.
      console.error('[document upload] error', error);
      const msg = error?.message || '';

      const isTimeout = msg.includes('504') || msg.toLowerCase().includes('timeout') ||
                        msg.toLowerCase().includes('network');

      if (isTimeout) {
        toast.info(
          `Upload request timed out, but processing is likely still running on the server. ` +
          `Your document should appear shortly; please refresh the list if it doesn't.`
        );
      } else {
        toast.error(`Failed to process file: ${error.message}`);
      }

      // attempt to refresh documents regardless so any early-saved record shows up
      try {
        await forceRefreshDocuments();
      } catch (e) {
        console.error('[document upload] force refresh after error failed', e);
      }
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFile, user?.id, isUploading, uploadTargetFolderId, appOperations, forceRefreshDocuments, setUploadTargetFolderId, getBase64]);

  // ============================================================================
  // RESUME LARGE FILE PROCESSING
  // ============================================================================

  /**
   * Calls /resume-processing in a loop until the document is fully extracted
   * or a max-attempt limit is hit. Runs fire-and-forget (no await needed).
   */
  const resumeDocumentProcessing = useCallback(async (
    documentId: string,
    fileName: string,
    uid: string,
  ): Promise<void> => {
    const MAX_RESUME_ATTEMPTS = 50;   // up to 50 resume calls per document
    const RESUME_DELAY_MS     = 5000; // 5s between calls to avoid hammering

    let attempt = 0;

    let exitedCleanly = false;

    while (attempt < MAX_RESUME_ATTEMPTS) {
      attempt++;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error(`Session expired while extracting "${fileName}". Please retry from the document menu.`);
          break;
        }

        if (attempt % 5 === 1) {
          toast.info(`Extracting "${fileName}"… (round ${attempt}/${MAX_RESUME_ATTEMPTS})`, { duration: 4000 });
        }

        const resp = await fetch(
          'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/resume-processing',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ userId: uid, documentId }),
          },
        );

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          console.error('[resume] HTTP error', resp.status, err);
          toast.error(`Extraction of "${fileName}" failed (HTTP ${resp.status}). You can retry from the document menu.`);
          break;
        }

        const result = await resp.json();

        if (result.isComplete) {
          toast.success(`"${fileName}" has been fully extracted!`);
          exitedCleanly = true;
          forceRefreshDocuments?.();
          break;
        }

        if (!result.canResumeAgain) {
          // Server says it's done but not complete — surface a warning
          toast.warning(`"${fileName}" was partially extracted. Some content may be missing.`);
          exitedCleanly = true;
          forceRefreshDocuments?.();
          break;
        }

        // Not done yet — wait and loop
        await new Promise((r) => setTimeout(r, RESUME_DELAY_MS));

      } catch (err: any) {
        console.error('[resume] unexpected error:', err.message);
        toast.error(`Extraction of "${fileName}" hit an error. You can retry from the document menu.`);
        break;
      }
    }

    if (attempt >= MAX_RESUME_ATTEMPTS) {
      toast.warning(`"${fileName}" is very large. Extraction stopped after ${MAX_RESUME_ATTEMPTS} rounds — partial content is available.`);
    }

    // Always refresh so the user sees the latest status (partial, failed, etc.)
    if (!exitedCleanly) {
      forceRefreshDocuments?.();
    }
  }, [forceRefreshDocuments]);

  const triggerAnalysis = useCallback(async (doc: Document): Promise<void> => {
    if (!user?.id) {
      toast.error('User not authenticated.');
      return;
    }

    if (processingDocuments.has(doc.id) || (doc.processing_status as string) === 'pending') {
      toast.warning('Analysis is already in progress for this document.');
      return;
    }

    // For partial documents, resume extraction instead of re-processing from scratch
    if ((doc.processing_status as string) === 'partial') {
      toast.info(`Resuming extraction for "${doc.file_name}"…`);
      resumeDocumentProcessing(doc.id, doc.file_name || 'document', user.id);
      return;
    }

    setProcessingDocuments(prev => new Set(prev).add(doc.id));
    onDocumentUpdated({ ...doc, processing_status: 'pending', processing_error: null });

    const functionUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/document-processor';

    try {
      toast.info(`${doc.processing_status === 'failed' ? 'Retrying' : 'Starting'} analysis for "${doc.file_name}"...`);

      // If we have a file_url stored, prefer sending the URL to the function
      // so the function can fetch server-side (avoids large client-side transfers).
      const base64Data: string | null = null;
      let preferFileUrl = false;
      if (doc.file_url) {
        preferFileUrl = true;
      } else {
        throw new Error('No file URL available for re-analysis');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      const payload = {
        userId: user.id,
        files: [
          preferFileUrl
            ? { name: doc.file_name, mimeType: doc.file_type, file_url: doc.file_url, size: doc.file_size, idToUpdate: doc.id }
            : { name: doc.file_name, mimeType: doc.file_type, data: base64Data, size: doc.file_size, idToUpdate: doc.id }
        ]
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
  }, [user?.id, processingDocuments, onDocumentUpdated, resumeDocumentProcessing]);

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