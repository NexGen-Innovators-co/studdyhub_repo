import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../integrations/supabase/client';
import { Document } from '../../../types/Document'; // Update path if needed
import { User } from '@supabase/supabase-js';
import { overrideTsMimeType } from '../utils/documentUtils';
import { useUserActivityLogger } from '@/hooks/useUserActivityLogger';
import { useUploadActivity } from '@/contexts/UploadActivityContext';

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

// Supabase Free allows at most 50MB per storage request — larger uploads are
// split into parts client-side and assembled server-side by the edge functions.
const CHUNK_SIZE = 20 * 1024 * 1024;
// Above this size, files go to storage in parts instead of one base64 payload
// (also keeps every single storage request comfortably under the 50MB cap).
const STORAGE_UPLOAD_THRESHOLD_FOR_JOB = 5 * 1024 * 1024;

/**
 * processing_metadata may reach the client as a jsonb object OR as a
 * JSON-encoded string, depending on how the row was fetched.
 */
const parseDocMetadata = (raw: unknown): any => {
  if (raw && typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw ?? null;
};

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
  const [customInstruction, setCustomInstruction] = useState('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [dragLocked, setDragLocked] = useState(false);
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stage/progress for the current upload lives in the global activity
  // provider so it survives navigating away; the screen keeps the job id.
  const { createJob, updateJob } = useUploadActivity();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

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
    const MAX_FILE_SIZE_MB = 1024;
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


  /**
   * Splits the file into ≤20MB parts and uploads them one at a time, with
   * per-part retry and real progress. Each request stays far below the
   * free-plan 50MB single-upload cap, so big files no longer fail/reject.
   */
  const uploadInChunks = useCallback(async (
    file: File,
    uid: string,
    onChunkDone: (done: number, total: number) => void,
  ): Promise<string[]> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const basePath = `${uid}/uploads/${Date.now()}_${safeName}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const paths: string[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const partType = file.type || 'application/octet-stream';
      const part = file.slice(start, end, partType);
      const path = `${basePath}/part_${String(i).padStart(3, '0')}`;

      let uploadError: { message: string } | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error } = await supabase.storage.from('documents').upload(path, part, {
          upsert: true,
          contentType: partType,
        });
        if (!error) { uploadError = null; break; }
        uploadError = error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }

      if (uploadError) {
        // Best-effort cleanup of the parts we already stored
        if (paths.length > 0) {
          try { await supabase.storage.from('documents').remove(paths); } catch { /* ignore */ }
        }
        throw new Error(`Upload failed on part ${i + 1}/${totalChunks}: ${uploadError.message}`);
      }

      paths.push(path);
      onChunkDone(i + 1, totalChunks);
    }

    return paths;
  }, []);

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

    // Real, byte-accurate job in the global activity provider — every percent
    // now maps to actual work (the old simulated progress interval is gone).
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
    const jobId = createJob({
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      userId: user.id,
      partsTotal: selectedFile.size > STORAGE_UPLOAD_THRESHOLD_FOR_JOB ? totalChunks : 1,
    });
    setActiveJobId(jobId);

    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-processor`;

    try {
      toast.info(`Uploading and processing "${selectedFile.name}"...`, {
        duration: 5000,
      });

      const payloadFiles: any[] = [];

      if (selectedFile.size > STORAGE_UPLOAD_THRESHOLD_FOR_JOB) {
        // Supabase Free caps a single storage request at 50MB — upload in
        // parts with real byte progress; the edge functions extract
        // server-side round by round (the parts stay as the stored form).
        const chunkPaths = await uploadInChunks(selectedFile, user.id, (done, total) => {
          updateJob(jobId, {
            partsDone: done,
            partsTotal: total,
            uploadedBytes: Math.min(done * CHUNK_SIZE, selectedFile.size),
            percent: Math.round((done / total) * 100),
          });
        });
        payloadFiles.push({
          name: selectedFile.name,
          mimeType: selectedFile.type,
          size: selectedFile.size,
          chunkPaths,
          customInstruction: customInstruction.trim() || undefined,
        });
      } else {
        const base64Data = await getBase64(selectedFile);
        updateJob(jobId, {
          uploadedBytes: selectedFile.size,
          partsDone: 1,
          percent: 100,
          detail: 'Encoded — sending to the processor…',
        });
        payloadFiles.push({
          name: selectedFile.name,
          mimeType: selectedFile.type,
          data: base64Data,
          size: selectedFile.size,
          customInstruction: customInstruction.trim() || undefined,
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      const payload = { userId: user.id, files: payloadFiles };

      updateJob(jobId, { stage: 'registering', percent: 100 });

      // warn if the file is in a size range that often triggers long AI work
      const LARGE_NOTIFY_THRESHOLD = 3 * 1024 * 1024; // 3MB
      if (selectedFile.size > LARGE_NOTIFY_THRESHOLD) {
        toast.info('This file is a bit large – processing may take over a minute. It will continue running in the background and appear in your documents when ready.');
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('document-processor', {
        body: payload,
      });

      if (fnError) {
        throw new Error(fnError.message || 'Function invocation failed');
      }

      if (result?.documents && result.documents.length > 0) {
        const uploadedDoc = result.documents[0];

        // Hand the job over to the global activity provider: it will poll the
        // document row and drive/observe every extraction round from here,
        // including after the user navigates away.
        const docStatus = String(uploadedDoc.processing_status ?? '');
        updateJob(jobId, {
          docId: uploadedDoc.id,
          stage:
            docStatus === 'completed'
              ? 'completed'
              : docStatus === 'partial' || docStatus === 'processing'
                ? 'extracting'
                : 'failed',
          percent: docStatus === 'completed' ? 100 : 0,
          detail:
            docStatus === 'processing'
              ? 'AI analysis running…'
              : docStatus === 'partial'
                ? 'Queued for background analysis…'
                : null,
          error: docStatus === 'failed' ? (uploadedDoc.processing_error ?? 'Processing failed') : null,
        });

        if (uploadTargetFolderId) {
          await appOperations.addDocumentToFolder(uploadedDoc.id, uploadTargetFolderId);
        }

        if (user?.id && forceRefreshDocuments) {
          await forceRefreshDocuments();
        }

        if (user?.id) {
          void logUserActivity(user.id, 'document', 20);
        }

        // Handoff: extraction rounds continue server-side, observed AND
        // driven by the global activity provider — on this screen and after
        // navigating away.
        if (docStatus === 'partial' || docStatus === 'processing') {
          // The global UploadActivityProvider observes AND drives these
          // extraction rounds — on this screen and after you navigate away.
          toast.info('Processing continues in the background — see the activity tray at the bottom right.');
        } else if (docStatus === 'failed') {
          toast.error(`Processing failed: ${uploadedDoc.processing_error ?? 'unknown error'}`);
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
      setCustomInstruction('');
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

      updateJob(jobId, {
        stage: 'failed',
        error: isTimeout
          ? 'Upload timed out — processing may still be running; check the activity tray or refresh later.'
          : msg || 'Upload failed',
      });

      // attempt to refresh documents regardless so any early-saved record shows up
      try {
        await forceRefreshDocuments();
      } catch (e) {
        console.error('[document upload] force refresh after error failed', e);
      }
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, customInstruction, user?.id, isUploading, uploadTargetFolderId, appOperations, forceRefreshDocuments, setUploadTargetFolderId, getBase64, uploadInChunks, createJob, updateJob]);

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
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-processing`,
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
        // Server nests the round result inside `documents[]` — reading the
        // top-level object would always look "done" after round 1.
        const round: any = Array.isArray(result.documents) ? result.documents[0] : result;

        if (round.isComplete) {
          toast.success(`"${fileName}" has been fully extracted!`);
          exitedCleanly = true;
          forceRefreshDocuments?.();
          break;
        }

        if (!round.canResumeAgain) {
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
      const retryJobId = createJob({
        fileName: doc.file_name || 'document',
        fileSize: doc.file_size ?? 0,
        userId: user.id,
      });
      updateJob(retryJobId, {
        docId: doc.id,
        stage: 'extracting',
        percent: 0,
        detail: 'Queued for background analysis…',
      });
      setActiveJobId(retryJobId);
      resumeDocumentProcessing(doc.id, doc.file_name || 'document', user.id);
      return;
    }

    setProcessingDocuments(prev => new Set(prev).add(doc.id));
    onDocumentUpdated({ ...doc, processing_status: 'pending', processing_error: null });

    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-processor`;

    try {
      toast.info(`${doc.processing_status === 'failed' ? 'Retrying' : 'Starting'} analysis for "${doc.file_name}"...`);

      // Resolve the stored source: single file_url, chunk parts (large
      // uploads), or nothing at all. Oversized files fail fast with an honest
      // plan-limit message instead of a cryptic "No file URL" error.
      const meta = parseDocMetadata((doc as any).processing_metadata);
      const rawParts = Array.isArray(meta?.chunk_paths) ? meta.chunk_paths : [];
      const chunkPaths: string[] = rawParts.filter((p: unknown): p is string => typeof p === 'string');

      const MAX_PROCESS_BYTES = 100 * 1024 * 1024;
      const fileBytes = Number(doc.file_size ?? 0);
      // The whole-file cap applies to PDFs/office (assembled in memory);
      // audio is transcribed part-by-part and is exempt.
      const isAudio = String((doc as any).file_type ?? '').startsWith('audio/');
      if (fileBytes > MAX_PROCESS_BYTES && !isAudio) {
        throw new Error(
          `"${doc.file_name}" is ${Math.round(fileBytes / 1024 / 1024)}MB — above the 100MB processing limit for this plan. Split or trim the file, then re-upload it.`,
        );
      }

      const source = doc.file_url ? 'url' : chunkPaths.length > 0 ? 'chunks' : null;
      if (!source) {
        throw new Error('No stored file found for this document — re-upload it to analyze it again.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      const baseFile = { name: doc.file_name, mimeType: doc.file_type, size: doc.file_size, idToUpdate: doc.id };
      const payload = {
        userId: user.id,
        files: [
          source === 'url'
            ? { ...baseFile, file_url: doc.file_url }
            : { ...baseFile, chunkPaths },
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
        const st = String(updatedDoc.processing_status ?? '');
        if (st === 'partial' || st === 'processing') {
          // Hand off to the global activity provider, which observes AND
          // drives the extraction rounds from here on.
          const retryJobId = createJob({
            fileName: doc.file_name || 'document',
            fileSize: doc.file_size ?? 0,
            userId: user.id,
          });
          updateJob(retryJobId, {
            docId: updatedDoc.id,
            stage: 'extracting',
            percent: 0,
            detail: 'Queued for background analysis…',
          });
          setActiveJobId(retryJobId);
          toast.info('Analysis continues in the background — see the activity tray.');
        } else if (st === 'failed') {
          toast.error(`Analysis failed: ${updatedDoc.processing_error ?? 'unknown error'}`);
        } else {
          toast.success('Document analysis completed successfully!');
        }
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
  }, [user?.id, processingDocuments, onDocumentUpdated, resumeDocumentProcessing, createJob, updateJob]);

  return {
    selectedFile,
    setSelectedFile,
    customInstruction,
    setCustomInstruction,
    isUploading,
    dragActive,
    dragLocked,
    fileInputRef,
    processingDocuments,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleUpload,
    triggerAnalysis,
    activeJobId
  };
}