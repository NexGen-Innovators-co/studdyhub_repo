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
  const sessionRef = useRef<{ podcastId: string; sessionId: string | null } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const start = useCallback(async (podcastId: string, options?: { mimeType?: string; stream?: MediaStream }) => {
    try {
      if (isRecording) return;
      // create recording session on server
      const session = await createRecordingSession(podcastId);
      // session may include id; prefer explicit session_id column if present
      const sid = (session && (session.session_id || session.id)) || String(Date.now());
      sessionRef.current = { podcastId, sessionId: sid } as any;

      const stream = options?.stream || await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const mimeType = options?.mimeType || 'audio/webm;codecs=opus';
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      let chunkIndex = 0;
      mr.ondataavailable = async (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return;
        try {
          const s = sessionRef.current;
          if (!s) return;
          // upload chunk via service helper
          await uploadChunkService(s.podcastId, s.sessionId || '', chunkIndex, ev.data);
          chunkIndex += 1;
        } catch (e) {
          // // console.warn('chunk upload failed', e);
          setLastError(e as Error);
        }
      };

      mr.onstart = () => setIsRecording(true);
      mr.onstop = () => setIsRecording(false);
      mr.start(25000); // emit blobs every 25s (tune as needed to keep <50MB)
    } catch (e) {
      setLastError(e as Error);
      throw e;
    }
  }, [isRecording]);

  const stop = useCallback(async () => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') mr.stop();
      // stop tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const s = sessionRef.current;
      if (s) {
        await finalizeRecording(s.podcastId, s.sessionId || '');
      }
      sessionRef.current = null;
      mediaRecorderRef.current = null;
      streamRef.current = null;
      setIsRecording(false);
    } catch (e) {
      setLastError(e as Error);
      throw e;
    }
  }, []);

  return { start, stop, isRecording, lastError };
}

