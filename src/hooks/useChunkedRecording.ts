import { useRef, useState, useCallback } from 'react';
import { createRecordingSession, uploadChunk as uploadChunkService, finalizeRecording } from '@/services/podcastLiveService';

type UseChunkedRecordingReturn = {
  start: (podcastId: string, options?: { mimeType?: string; stream?: MediaStream }) => Promise<void>;
  stop: () => Promise<void>;
  isRecording: boolean;
  lastError?: Error | null;
};

export function useChunkedRecording(): UseChunkedRecordingReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInternalStreamRef = useRef<boolean>(false);
  const sessionRef = useRef<{ podcastId: string; sessionId: string | null } | null>(null);
  const uploadQueueRef = useRef<Promise<any>[]>([]);
  const isCleaningUpRef = useRef<boolean>(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const start = useCallback(async (podcastId: string, options?: { mimeType?: string; stream?: MediaStream }) => {
    try {
      if (isRecording) return;
      isCleaningUpRef.current = false;
      uploadQueueRef.current = []; // Reset queue
      // create recording session on server
      const session = await createRecordingSession(podcastId);
      // session may include id; prefer explicit session_id column if present
      const sid = (session && (session.session_id || session.id)) || String(Date.now());
      sessionRef.current = { podcastId, sessionId: sid } as any;

      let stream = options?.stream;
      if (!stream) {
          // If no stream provided, we create one internally -> valid to clean up
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          isInternalStreamRef.current = true;
      } else {
          // If stream provided externally (e.g. from live host), we must DOES NOT close it
          isInternalStreamRef.current = false;
      }

      streamRef.current = stream;
      const mimeType = options?.mimeType || 'audio/webm;codecs=opus';
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      let chunkIndex = 0;
      mr.ondataavailable = (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return;
        const currentIdx = chunkIndex;
        chunkIndex++;
        
        const uploadPromise = (async () => {
            try {
                const s = sessionRef.current;
                if (!s) return;
                // upload chunk via service helper
                // console.log(`Uploading chunk ${currentIdx}, size: ${ev.data.size}`);
                await uploadChunkService(s.podcastId, s.sessionId || '', currentIdx, ev.data, { mimeType });
            } catch (e) {
                // console.error(`Chunk upload ${currentIdx} failed`, e);
                setLastError(e as Error);
            }
        })();
        
        uploadQueueRef.current.push(uploadPromise);
      };

      mr.onstart = () => setIsRecording(true);
      // mr.onstop = () => setIsRecording(false); // Handled in stop()
      mr.start(25000); // emit blobs every 25s (tune as needed to keep <50MB)
    } catch (e) {
      setLastError(e as Error);
      throw e;
    }
  }, [isRecording]);

  const stop = useCallback(async () => {
    // Prevent double cleanup
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    return new Promise<void>(async (resolve, reject) => {
        try {
            const mr = mediaRecorderRef.current;
            
            // Function to handle cleanup after recorder stops
            const performCleanup = async () => {
                try {
                    // console.log('Waiting for pending uploads:', uploadQueueRef.current.length);
                    await Promise.all(uploadQueueRef.current);
                    
                    const s = sessionRef.current;
                    if (s) {
                        // console.log('Finalizing recording session:', s.sessionId);
                        await finalizeRecording(s.podcastId, s.sessionId || '');
                    }
                } catch (err) {
                    // console.error('Error during finalize:', err);
                    setLastError(err as Error);
                } finally {
                    sessionRef.current = null;
                    mediaRecorderRef.current = null;
                    streamRef.current = null;
                    setIsRecording(false);
                    resolve();
                }
            };

            if (!mr || mr.state === 'inactive') {
                await performCleanup();
                return;
            }

            // Hook into onstop to run cleanup once the recorder has flushed data
            mr.onstop = () => {
                performCleanup();
            };

            mr.stop();
            
            // Modify: only stop tracks if they were created internally
            if (streamRef.current && isInternalStreamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }

        } catch (e) {
            setLastError(e as Error);
            reject(e);
        }
    });
  }, []);

  return { start, stop, isRecording, lastError };
}

