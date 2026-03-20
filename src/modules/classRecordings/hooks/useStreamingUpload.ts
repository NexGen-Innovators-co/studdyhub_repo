// hooks/useStreamingUpload.ts
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
}

interface UploadState {
  isUploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  uploadId: string | null;
}

interface UseStreamingUploadOptions {
  bucket?: string;
  chunkSize?: number;
  maxRetries?: number;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (url: string) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

export function useStreamingUpload(options: UseStreamingUploadOptions = {}) {
  const {
    bucket = 'recordings',
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxRetries = MAX_RETRIES,
    onProgress,
    onComplete,
    onError
  } = options;

  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: null,
    error: null,
    uploadId: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const uploadedBytesRef = useRef<number>(0);

  // Calculate upload speed and ETA
  const calculateProgress = useCallback((loaded: number, total: number): UploadProgress => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const speed = elapsed > 0 ? loaded / elapsed : 0;
    const remaining = total - loaded;
    const estimatedTimeRemaining = speed > 0 ? remaining / speed : 0;

    return {
      loaded,
      total,
      percentage: Math.round((loaded / total) * 100),
      speed,
      estimatedTimeRemaining
    };
  }, []);

  // Retry with exponential backoff
  const withRetry = useCallback(async <T>(
    fn: () => Promise<T>,
    retries = maxRetries,
    delay = INITIAL_RETRY_DELAY
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }, [maxRetries]);

  // Upload a file with streaming progress
  const uploadFile = useCallback(async (
    file: Blob,
    fileName: string,
    userId: string
  ): Promise<string> => {
    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();
    uploadedBytesRef.current = 0;

    const uploadId = `${userId}/${Date.now()}_${fileName}`;

    setState({
      isUploading: true,
      progress: calculateProgress(0, file.size),
      error: null,
      uploadId
    });

    try {
      // For small files, use simple upload
      if (file.size <= chunkSize) {
        const { data, error } = await withRetry(() =>
          supabase.storage.from(bucket).upload(uploadId, file, {
            cacheControl: '3600',
            upsert: false
          })
        );

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uploadId);

        const progress = calculateProgress(file.size, file.size);
        setState(prev => ({ ...prev, progress }));
        onProgress?.(progress);
        onComplete?.(urlData.publicUrl);

        setState(prev => ({
          ...prev,
          isUploading: false,
          progress: calculateProgress(file.size, file.size)
        }));

        return urlData.publicUrl;
      }

      // For large files, upload in chunks with progress tracking
      const totalChunks = Math.ceil(file.size / chunkSize);
      let uploadedChunks = 0;

      for (let i = 0; i < totalChunks; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        await withRetry(async () => {
          const chunkFileName = totalChunks === 1 
            ? uploadId 
            : `${uploadId}_chunk_${i}`;

          const { error } = await supabase.storage
            .from(bucket)
            .upload(chunkFileName, chunk, {
              cacheControl: '3600',
              upsert: true
            });

          if (error) throw error;
        });

        uploadedChunks++;
        uploadedBytesRef.current = end;

        const progress = calculateProgress(end, file.size);
        setState(prev => ({ ...prev, progress }));
        onProgress?.(progress);
      }

      // If file was chunked, we need to combine (for now, just use the file directly)
      const { error: finalError } = await withRetry(() =>
        supabase.storage.from(bucket).upload(uploadId, file, {
          cacheControl: '3600',
          upsert: true
        })
      );

      if (finalError) throw finalError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(uploadId);

      const finalProgress = calculateProgress(file.size, file.size);
      setState(prev => ({
        ...prev,
        isUploading: false,
        progress: finalProgress
      }));

      onComplete?.(urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Upload failed');
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: err.message
      }));
      onError?.(err);
      throw error;
    }
  }, [bucket, chunkSize, calculateProgress, withRetry, onProgress, onComplete, onError]);

  // Cancel ongoing upload
  const cancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      isUploading: false,
      progress: null,
      error: 'Upload cancelled',
      uploadId: null
    });
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: null,
      error: null,
      uploadId: null
    });
  }, []);

  return {
    ...state,
    uploadFile,
    cancelUpload,
    reset
  };
}

// Format helpers
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
