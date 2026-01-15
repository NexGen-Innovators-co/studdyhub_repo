import { useState, useCallback, useRef } from 'react';
import { Message, ThinkingStep } from '@/types/Class';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { supabaseUrl } from '@/integrations/supabase/client';

interface StreamingState {
  isStreaming: boolean;
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
  imageMimeType?: string;
  aiMessageIdToUpdate?: string | null;
  onThinkingStep: (step: ThinkingStep) => void;
  onContentChunk: (chunk: string) => void;
  onComplete: (finalMessage: Message) => void;
  onError: (error: string) => void;
}

/**
 * Hook for handling streaming chat responses from the Supabase Edge Function
 * Uses EventSource for Server-Sent Events (SSE) to receive real-time updates
 */
export const useStreamingChat = (): StreamingChatHook => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    error: null,
    currentMessageId: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const accumulatedDataRef = useRef<StreamedData>({
    thinkingSteps: [],
    content: '',
    isDone: false,
  });

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreamingState({
      isStreaming: false,
      error: null,
      currentMessageId: null,
    });
    accumulatedDataRef.current = {
      thinkingSteps: [],
      content: '',
      isDone: false,
    };
  }, []);

  const startStreaming = useCallback(async (params: StreamingParams) => {
    // Reset accumulated data
    accumulatedDataRef.current = {
      thinkingSteps: [],
      content: '',
      isDone: false,
    };
    try {
      // Get the session for authentication
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Authentication required for streaming');
      }

      // Build the URL for the edge function with streaming enabled
      const functionUrl = `${supabaseUrl}/functions/v1/gemini-chat`;
      
      // Create URL with query parameters for authentication
      const url = new URL(functionUrl);
      
      // Prepare the request body
      const requestBody = {
        ...params,
        enableStreaming: true,
      };

      setStreamingState({
        isStreaming: true,
        error: null,
        currentMessageId: params.aiMessageIdToUpdate || null,
      });

      // Use fetch with streaming instead of EventSource (EventSource doesn't support POST)
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Streaming] Request failed:', response.status, errorText);
        throw new Error(`Streaming failed (${response.status}): ${errorText || response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      
      // Check if this is actually a streaming response
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/event-stream')) {
        console.warn('⚠️ [Streaming] Response is not SSE, falling back to regular mode');
        toast.info('Streaming not available - using fast mode', {
          description: 'The edge function may need to be updated for streaming support'
        });
        // Response is not SSE, treat as regular JSON
        const data = await response.json();
        if (data.response) {
          // Simulate immediate completion
          params.onContentChunk(data.response);
          const finalMessage: Message = {
            id: data.aiMessageId || uuidv4(),
            content: data.response,
            role: 'assistant',
            timestamp: data.timestamp || new Date().toISOString(),
            isError: false,
            attachedDocumentIds: [],
            attachedNoteIds: [],
            session_id: params.sessionId,
            has_been_displayed: false,
            thinking_steps: [],
            isStreaming: false,
          };
          params.onComplete(finalMessage);
          stopStreaming();
          return;
        }
        throw new Error('Invalid response format');
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;
      let lastEventTime = Date.now();
      const STREAM_TIMEOUT = 60000; // 60 seconds

      // Set up timeout watcher
      const timeoutCheck = setInterval(() => {
        const timeSinceLastEvent = Date.now() - lastEventTime;
        if (timeSinceLastEvent > STREAM_TIMEOUT) {
          console.error('⏱️ [Streaming] Timeout - no events for 60s');
          reader.cancel();
        }
      }, 5000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          lastEventTime = Date.now();

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete SSE events (separated by double newlines)
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep incomplete event in buffer

          for (const event of events) {
            if (!event.trim()) continue;
            eventCount++;

            // Parse SSE format - handle both formats:
            // Format 1: "event: type\ndata: json"
            // Format 2: "data: {"type":"...","data":{...}}"
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

            // If no explicit event type, try parsing the data to get type
            if (!eventType && eventData) {
              try {
                const parsed = JSON.parse(eventData);
                if (parsed.type) {
                  eventType = parsed.type;
                  eventData = JSON.stringify(parsed.data || parsed);
                }
              } catch {
                // Not JSON, skip
                continue;
              }
            }

            if (!eventType || !eventData) continue;

            try {
              const data = JSON.parse(eventData);

              switch (eventType) {
                case 'thinking_step':
                  // New thinking step received
                  const thinkingStep = data as ThinkingStep;
                  accumulatedDataRef.current.thinkingSteps.push(thinkingStep);
                  params.onThinkingStep(thinkingStep);
                  break;

                case 'content':
                  // Content chunk received
                  accumulatedDataRef.current.content += data.chunk;
                  params.onContentChunk(data.chunk);
                  break;

                case 'done':
                  // Stream complete
                  accumulatedDataRef.current.isDone = true;
                  // Pass the raw backend data which includes userMessageId, aiMessageId, etc.
                  params.onComplete(data);
                  clearInterval(timeoutCheck);
                  stopStreaming();
                  return;

                case 'error':
                  // Error received from backend
                  console.error('❌ [Streaming] Backend error:', data);
                  const errorMsg = data.message || data.error || JSON.stringify(data) || 'Unknown streaming error';
                  throw new Error(`Backend error: ${errorMsg}`);
              }
            } catch (parseError) {
              console.error('❌ [Streaming] Error parsing SSE event:', parseError, 'Event data:', eventData);
            }
          }
        }
      } finally {
        clearInterval(timeoutCheck);
      }

      // If we reach here without a 'done' event, handle gracefully
      if (!accumulatedDataRef.current.isDone) {
        console.warn('⚠️ [Streaming] Stream ended without done event');

        // If we have content, treat as success (graceful degradation)
        if (accumulatedDataRef.current.content || accumulatedDataRef.current.thinkingSteps.length > 0) {
          const messageId = uuidv4();
          const finalMessage: Message = {
            id: messageId,
            content: accumulatedDataRef.current.content || 'Response generation was interrupted.',
            role: 'assistant',
            timestamp: new Date().toISOString(),
            isError: false,
            attachedDocumentIds: [],
            attachedNoteIds: [],
            session_id: params.sessionId,
            has_been_displayed: false,
            thinking_steps: accumulatedDataRef.current.thinkingSteps,
            isStreaming: false,
          };
          params.onComplete(finalMessage);
          stopStreaming();
          return;
        }

        throw new Error('Stream ended unexpectedly without any data. The edge function may not be configured for streaming.');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error';
      console.error('❌ [Streaming] Fatal error:', error);
      
      setStreamingState({
        isStreaming: false,
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
    accumulatedDataRef,
  };
};
