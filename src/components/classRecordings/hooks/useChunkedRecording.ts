// hooks/useChunkedRecording.ts
import { useState, useRef, useCallback, useEffect } from 'react';

interface RecordingChunk {
  index: number;
  blob: Blob;
  timestamp: number;
  duration: number;
}

interface ChunkedRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  chunks: RecordingChunk[];
  currentChunkIndex: number;
  totalDuration: number;
  error: string | null;
}

interface UseChunkedRecordingOptions {
  chunkDurationMs?: number; // Default 5 minutes
  onChunkComplete?: (chunk: RecordingChunk) => void;
  onError?: (error: Error) => void;
  enableLocalBackup?: boolean;
}

const CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const LOCAL_STORAGE_KEY = 'recording_backup';

export function useChunkedRecording(options: UseChunkedRecordingOptions = {}) {
  const {
    chunkDurationMs = CHUNK_DURATION_MS,
    onChunkComplete,
    onError,
    enableLocalBackup = true
  } = options;

  const [state, setState] = useState<ChunkedRecordingState>({
    isRecording: false,
    isPaused: false,
    chunks: [],
    currentChunkIndex: 0,
    totalDuration: 0,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentChunkDataRef = useRef<Blob[]>([]);
  const chunkStartTimeRef = useRef<number>(0);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pausedAtRef = useRef<number | null>(null);

  // Save chunks to local storage for backup
  const saveToLocalStorage = useCallback(async (chunks: RecordingChunk[]) => {
    if (!enableLocalBackup) return;
    
    try {
      const serializedChunks = await Promise.all(
        chunks.map(async (chunk) => ({
          ...chunk,
          blobData: await blobToBase64(chunk.blob)
        }))
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializedChunks));
    } catch (err) {

    }
  }, [enableLocalBackup]);

  // Restore chunks from local storage
  const restoreFromLocalStorage = useCallback(async (): Promise<RecordingChunk[] | null> => {
    if (!enableLocalBackup) return null;
    
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!saved) return null;

      const parsed = JSON.parse(saved);
      const chunks = await Promise.all(
        parsed.map(async (item: any) => ({
          index: item.index,
          blob: base64ToBlob(item.blobData, 'audio/webm'),
          timestamp: item.timestamp,
          duration: item.duration
        }))
      );
      return chunks;
    } catch (err) {

      return null;
    }
  }, [enableLocalBackup]);

  // Clear local storage backup
  const clearLocalBackup = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, []);

  // Get supported MIME type. Optionally prefer a provided list (e.g. video-capable types).
  const getSupportedMimeType = useCallback((preferred?: string[]) => {
    const defaultTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    const mimeTypes = Array.isArray(preferred) && preferred.length ? [...preferred, ...defaultTypes] : defaultTypes;
    for (const mimeType of mimeTypes) {
      try {
        if (MediaRecorder.isTypeSupported?.(mimeType)) {
          return mimeType;
        }
      } catch (e) {
        // ignore
      }
    }
    return undefined;
  }, []);

  // Finalize current chunk
  const finalizeCurrentChunk = useCallback(() => {
    if (currentChunkDataRef.current.length === 0) return;

    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(currentChunkDataRef.current, { type: mimeType });
    const duration = Date.now() - chunkStartTimeRef.current;

    const chunk: RecordingChunk = {
      index: state.currentChunkIndex,
      blob,
      timestamp: chunkStartTimeRef.current,
      duration
    };

    setState(prev => {
      const newChunks = [...prev.chunks, chunk];
      saveToLocalStorage(newChunks);
      return {
        ...prev,
        chunks: newChunks,
        currentChunkIndex: prev.currentChunkIndex + 1
      };
    });

    onChunkComplete?.(chunk);
    currentChunkDataRef.current = [];
    chunkStartTimeRef.current = Date.now();
  }, [state.currentChunkIndex, onChunkComplete, saveToLocalStorage]);

  // Start a new chunk timer
  const startChunkTimer = useCallback(() => {
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
    }

    chunkTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        // Request data before rotating
        mediaRecorderRef.current.requestData();
        
        // Give time for data to be collected
        setTimeout(() => {
          finalizeCurrentChunk();
          startChunkTimer(); // Start next chunk timer
        }, 100);
      }
    }, chunkDurationMs);
  }, [chunkDurationMs, finalizeCurrentChunk]);

  // Start recording. Accept an optional incoming MediaStream to record (supports audio+video).
  // This allows callers to pass an existing `localStream` (e.g. from a WebRTC session)
  // so video tracks are preserved instead of requesting audio-only getUserMedia.
  const startRecording = useCallback(async (...args: any[]) => {
    // Flexible signature for backward compatibility:
    // - startRecording()
    // - startRecording(stream: MediaStream)
    // - startRecording(podcastId: string, { stream })
    let incoming: MediaStream | undefined;
    if (args.length === 1) {
      if (args[0] instanceof MediaStream) incoming = args[0];
      else if (args[0] && typeof args[0] === 'object' && args[0].stream instanceof MediaStream) incoming = args[0].stream;
    } else if (args.length >= 2) {
      // support start(podcastId, { stream })
      const maybeOpts = args[1];
      if (maybeOpts && typeof maybeOpts === 'object' && maybeOpts.stream instanceof MediaStream) incoming = maybeOpts.stream;
    }
    try {
      setState(prev => ({ ...prev, error: null }));

      // Determine stream to use: prefer provided incoming stream, otherwise request audio-only.
      let stream: MediaStream | null = null;
      if (incoming) {
        // support calling with either MediaStream or an options object { stream }
        if ((incoming as any).stream && (incoming as any).stream instanceof MediaStream) {
          stream = (incoming as any).stream as MediaStream;
        } else if (incoming instanceof MediaStream) {
          stream = incoming;
        }
      }

      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        });
      }

      streamRef.current = stream;
      // Choose a mime type that supports video when the stream contains video tracks
      const hasVideo = stream.getVideoTracks && stream.getVideoTracks().length > 0;
      const preferredMimeTypes = hasVideo
        ? [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm',
            'audio/webm;codecs=opus'
          ]
        : undefined;

      const mimeType = getSupportedMimeType(preferredMimeTypes);
      let mediaRecorder: MediaRecorder | null = null;
      let usedAudioOnlyFallback = false;

      const tryCreateRecorder = (targetStream: MediaStream, options?: MediaRecorderOptions) => {
        try {
          return new MediaRecorder(targetStream, options);
        } catch (e) {
          // console.warn('[useChunkedRecording] MediaRecorder creation failed with options', options, e);
          return null;
        }
      };

      // Try preferred mimeType first, then without options, then fall back to audio-only stream
      if (mimeType) {
        mediaRecorder = tryCreateRecorder(stream, { mimeType });
      }
      if (!mediaRecorder) {
        mediaRecorder = tryCreateRecorder(stream);
      }
      if (!mediaRecorder) {
        // Try audio-only fallback if available
        const audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
        if (audioTracks && audioTracks.length) {
          const audioOnly = new MediaStream(audioTracks.map(t => t.clone()));
          mediaRecorder = tryCreateRecorder(audioOnly, { mimeType: getSupportedMimeType() });
          if (mediaRecorder) {
            usedAudioOnlyFallback = true;
            streamRef.current = audioOnly;
            // console.warn('[useChunkedRecording] Falling back to audio-only recording due to MediaRecorder limitations');
          }
        }
      } else {
        streamRef.current = stream;
      }

      if (!mediaRecorder) {
        throw new Error('Unable to create MediaRecorder for the provided stream');
      }

      mediaRecorderRef.current = mediaRecorder;

      currentChunkDataRef.current = [];
      chunkStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          currentChunkDataRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        const error = new Error('Recording error occurred');
        setState(prev => ({ ...prev, error: error.message, isRecording: false }));
        onError?.(error);
      };

      // Start recording with timeslice for regular data events, with guarded start
      try {
        mediaRecorder.start(1000);
        // console.log('[useChunkedRecording] MediaRecorder started', { mimeType: mediaRecorder.mimeType, usedAudioOnlyFallback });
      } catch (startErr) {
        // console.warn('[useChunkedRecording] MediaRecorder.start failed, attempting audio-only fallback', startErr);
        // If start failed and we haven't tried audio-only fallback yet, attempt it
        if (!usedAudioOnlyFallback) {
          const audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
          if (audioTracks && audioTracks.length) {
            const audioOnly = new MediaStream(audioTracks.map(t => t.clone()));
            const fallbackRecorder = tryCreateRecorder(audioOnly, { mimeType: getSupportedMimeType() });
            if (fallbackRecorder) {
              mediaRecorder = fallbackRecorder;
              mediaRecorderRef.current = fallbackRecorder;
              streamRef.current = audioOnly;
              mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  currentChunkDataRef.current.push(event.data);
                }
              };
              mediaRecorder.onerror = (event) => {
                const error = new Error('Recording error occurred');
                setState(prev => ({ ...prev, error: error.message, isRecording: false }));
                onError?.(error);
              };
              mediaRecorder.start(1000);
              // console.log('[useChunkedRecording] MediaRecorder started (audio-only fallback)', { mimeType: mediaRecorder.mimeType, usedAudioOnlyFallback });
              usedAudioOnlyFallback = true;
            } else {
              throw startErr;
            }
          } else {
            throw startErr;
          }
        } else {
          throw startErr;
        }
      }
      
      // Start chunk timer
      startChunkTimer();

      // Start duration tracking
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          totalDuration: prev.totalDuration + 1
        }));
      }, 1000);

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        chunks: [],
        currentChunkIndex: 0,
        totalDuration: 0
      }));

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
    }
  }, [getSupportedMimeType, startChunkTimer, onError]);


  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      pausedAtRef.current = Date.now();
      
      if (chunkTimerRef.current) {
        clearTimeout(chunkTimerRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      pausedAtRef.current = null;

      // Resume chunk timer with remaining time
      startChunkTimer();

      // Resume duration tracking
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          totalDuration: prev.totalDuration + 1
        }));
      }, 1000);

      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [startChunkTimer]);

  // Stop recording
  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error('No active recording'));
        return;
      }

      // Clear timers
      if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

      mediaRecorderRef.current.onstop = () => {
        // Finalize any remaining data
        if (currentChunkDataRef.current.length > 0) {
          finalizeCurrentChunk();
        }

        // Stop all tracks
        streamRef.current?.getTracks().forEach(track => track.stop());

        // Combine all chunks into final blob
        setState(prev => {
          const allChunks = prev.chunks;
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const finalBlob = new Blob(
            allChunks.map(c => c.blob),
            { type: mimeType }
          );

          // Clear local backup on successful stop
          clearLocalBackup();

          return {
            ...prev,
            isRecording: false,
            isPaused: false
          };
        });

        // Return combined blob
        const allBlobs = [...state.chunks.map(c => c.blob), ...currentChunkDataRef.current];
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        resolve(new Blob(allBlobs, { type: mimeType }));
      };

      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
    });
  }, [state.chunks, finalizeCurrentChunk, clearLocalBackup]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach(track => track.stop());
    clearLocalBackup();

    setState({
      isRecording: false,
      isPaused: false,
      chunks: [],
      currentChunkIndex: 0,
      totalDuration: 0,
      error: null
    });
  }, [clearLocalBackup]);

  // Check for interrupted recording on mount
  useEffect(() => {
    const checkForBackup = async () => {
      const backup = await restoreFromLocalStorage();
      if (backup && backup.length > 0) {
        setState(prev => ({
          ...prev,
          chunks: backup,
          currentChunkIndex: backup.length
        }));
      }
    };

    checkForBackup();

    return () => {
      if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [restoreFromLocalStorage]);

  return {
    ...state,
    // primary API names
    startRecording,
    stopRecording,
    // convenience aliases for older callers (e.g. chunked.start/stop)
    start: startRecording,
    stop: stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    hasBackup: state.chunks.length > 0 && !state.isRecording,
    clearBackup: clearLocalBackup,
    restoreBackup: restoreFromLocalStorage
  };

}

// Helper functions
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}
