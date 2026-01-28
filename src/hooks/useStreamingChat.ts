import { useState, useCallback, useRef } from 'react';
import { Message, ThinkingStep } from '@/types/Class';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { supabaseUrl } from '@/integrations/supabase/client';

interface StreamingState {
  isStreaming: boolean;
  isPaused: boolean;
  error: string | null;
  currentMessageId: string | null;
}

interface StreamedData {
  thinkingSteps: ThinkingStep[];
  content: string;
  isDone: boolean;
}

interface StreamingChatHook {
  streamingState: StreamingState;
  startStreaming: (params: StreamingParams) => Promise<void>;
  stopStreaming: () => void;
  pauseStreaming: () => void;
  resumeStreaming: () => void;
  accumulatedDataRef: React.MutableRefObject<StreamedData>;
}

interface StreamingParams {
  userId: string;
  sessionId: string;
  learningStyle: string;
  learningPreferences: any;
  chatHistory: Array<{ role: string; parts: any[] }>;
  message: string;
  messageParts: any[];
  files?: any[];
  attachedDocumentIds?: string[];
  attachedNoteIds?: string[];
  imageUrl?: string;
  courseContext?: { id: string; code?: string; title?: string } | null;
  aiMessageIdToUpdate?: string | null;
  onThinkingStep: (step: ThinkingStep) => void;
  onContentChunk: (chunk: string) => void;
  onComplete: (finalMessage: any) => void; // Changed to any to match backend response
  onError: (error: string) => void;
  imageMimeType?: string;
}

/**
 * Hook for handling streaming chat responses from the Supabase Edge Function
 * Uses EventSource for Server-Sent Events (SSE) to receive real-time updates
 */
export const useStreamingChat = (): StreamingChatHook => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    isPaused: false,
    error: null,
    currentMessageId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const bufferRef = useRef<{ type: string; data: any }[]>([]);
  const accumulatedDataRef = useRef<StreamedData>({
    thinkingSteps: [],
    content: '',
    isDone: false,
  });

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamingState(prev => ({
      ...prev,
      isStreaming: false,
      isPaused: false,
      error: null,
      currentMessageId: null,
    }));
    isPausedRef.current = false;
    bufferRef.current = [];
    // Note: We don't reset accumulatedDataRef here because onComplete might need it
  }, []);

  const pauseStreaming = useCallback(() => {
    setStreamingState(prev => ({ ...prev, isPaused: true }));
    isPausedRef.current = true;
  }, []);

  const resumeStreaming = useCallback(() => {
    setStreamingState(prev => ({ ...prev, isPaused: false }));
    isPausedRef.current = false;

    // Process buffered data
    if (bufferRef.current.length > 0) {
      // We don't have direct access to the callbacks here easily without a complex setup
      // but the main loop in startStreaming will handle it if we check isPausedRef
    }
  }, []);

  const startStreaming = useCallback(async (params: StreamingParams) => {
    // Stop any existing stream
    stopStreaming();

    // Reset accumulated data
    accumulatedDataRef.current = {
      thinkingSteps: [],
      content: '',
      isDone: false,
    };

    abortControllerRef.current = new AbortController();
    isPausedRef.current = false;
    bufferRef.current = [];

    try {
      // Get the session for authentication
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Authentication required for streaming');
      }

      // Build the URL for the edge function with streaming enabled
      const functionUrl = `${supabaseUrl}/functions/v1/gemini-chat`;
      const url = new URL(functionUrl);

      const requestBody = {
        ...params,
        enableStreaming: true,
      };

      setStreamingState({
        isStreaming: true,
        isPaused: false,
        error: null,
        currentMessageId: params.aiMessageIdToUpdate || null,
      });

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Streaming failed (${response.status}): ${errorText || response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/event-stream')) {
        //console.warn('⚠️ [Streaming] Response is not SSE, falling back to regular mode');
        const data = await response.json();
        try { console.debug('[useStreamingChat] non-SSE fallback payload:', data); } catch (e) {}
        if (data.response) {
          params.onContentChunk(data.response);
          params.onComplete(data);
          stopStreaming();
          return;
        }
        throw new Error('Invalid response format');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastEventTime = Date.now();
      const STREAM_TIMEOUT = 60000;

      const timeoutCheck = setInterval(() => {
        const timeSinceLastEvent = Date.now() - lastEventTime;
        if (timeSinceLastEvent > STREAM_TIMEOUT) {
          //console.error('⏱️ [Streaming] Timeout - no events for 60s');
          if (abortControllerRef.current) abortControllerRef.current.abort();
        }
      }, 5000);

      try {
        while (true) {
          // Check for abortion
          if (abortControllerRef.current?.signal.aborted) break;

          const { done, value } = await reader.read();
          if (done) break;

          lastEventTime = Date.now();
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (!event.trim()) continue;

            const lines = event.split('\n');
            let eventType = '';
            let eventData = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                eventData = line.substring(6).trim();
              }
            }

            if (!eventType && eventData) {
              try {
                const parsed = JSON.parse(eventData);
                if (parsed.type) {
                  eventType = parsed.type;
                  eventData = JSON.stringify(parsed.data || parsed);
                }
              } catch { continue; }
            }

            if (!eventType || !eventData) continue;

            try {
              const data = JSON.parse(eventData);

              // PAUSE LOGIC: If paused, wait before proceeding
              while (isPausedRef.current) {
                await new Promise(r => setTimeout(r, 100));
                if (abortControllerRef.current?.signal.aborted) break;
              }

              if (abortControllerRef.current?.signal.aborted) break;

              switch (eventType) {
                case 'thinking_step':
                  accumulatedDataRef.current.thinkingSteps.push(data);
                  params.onThinkingStep(data);
                  break;
                case 'content':
                  accumulatedDataRef.current.content += data.chunk;
                  params.onContentChunk(data.chunk);
                  break;
                case 'done':
                  accumulatedDataRef.current.isDone = true;
                  // Log the final 'done' payload for debugging
                  try { console.debug('[useStreamingChat] done payload:', data); } catch (e) {}
                  params.onComplete(data);
                  clearInterval(timeoutCheck);
                  stopStreaming();
                  return; // Important: loop ends successfully
                case 'error':
                  throw new Error(`Backend error: ${data.message || 'Unknown streaming error'}`);
              }
            } catch (e) {
              //console.error('❌ [Streaming] Event processing error:', e);
            }
          }
        }
      } finally {
        clearInterval(timeoutCheck);
        reader.releaseLock();
      }

      // Handle cases where loop ends without 'done' event (like abortion or natural end)
      if (!accumulatedDataRef.current.isDone) {
        if (accumulatedDataRef.current.content || accumulatedDataRef.current.thinkingSteps.length > 0) {
          // INTERRUPTED but has data - act as if complete with what we have
          params.onComplete({
            response: accumulatedDataRef.current.content,
            thinkingSteps: accumulatedDataRef.current.thinkingSteps,
            interrupted: true
          });
        }
        stopStreaming();
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        //console.log('🛑 [Streaming] Stream aborted by user');
        return;
      }

      const errorMessage = error.message || 'Unknown streaming error';
      //console.error('❌ [Streaming] Fatal error:', error);

      setStreamingState({
        isStreaming: false,
        isPaused: false,
        error: errorMessage,
        currentMessageId: null,
      });

      params.onError(errorMessage);
      stopStreaming();
    }
  }, [stopStreaming]);

  return {
    streamingState,
    startStreaming,
    stopStreaming,
    pauseStreaming,
    resumeStreaming,
    accumulatedDataRef,
  };
};
