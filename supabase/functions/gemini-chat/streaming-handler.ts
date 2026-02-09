// streaming-handler.ts - Server-Sent Events streaming for agentic thinking

export interface StreamEvent {
  type: 'thinking_step' | 'content_chunk' | 'done' | 'error' | 'heartbeat';
  data: any;
}

export class StreamingHandler {
  private encoder: TextEncoder;
  private controller: ReadableStreamDefaultController;
  private closed = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(controller: ReadableStreamDefaultController) {
    this.encoder = new TextEncoder();
    this.controller = controller;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  sendEvent(event: StreamEvent) {
    if (this.closed) return;
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      this.controller.enqueue(this.encoder.encode(data));
    } catch (e) {
      // Stream was closed by the client disconnecting
      this.closed = true;
      this.stopHeartbeat();
    }
  }

  /** Send a lightweight keep-alive ping so the client doesn't time out */
  sendHeartbeat() {
    this.sendEvent({ type: 'heartbeat', data: { ts: Date.now() } });
  }

  /** Start an automatic heartbeat every `intervalMs` (default 15s) */
  startHeartbeat(intervalMs = 15_000) {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.closed) {
        this.stopHeartbeat();
        return;
      }
      this.sendHeartbeat();
    }, intervalMs);
  }

  /** Stop the automatic heartbeat */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  sendThinkingStep(
    type: 'understanding' | 'retrieval' | 'reasoning' | 'memory' | 'verification' | 'action',
    title: string,
    detail: string,
    status: 'pending' | 'in-progress' | 'completed' | 'failed' = 'completed',
    metadata?: any
  ) {
    this.sendEvent({
      type: 'thinking_step',
      data: {
        id: crypto.randomUUID(),
        type,
        title,
        detail,
        status,
        timestamp: new Date().toISOString(),
        metadata
      }
    });
  }

  sendContentChunk(content: string) {
    this.sendEvent({
      type: 'content_chunk',
      data: { content }
    });
  }

  sendDone(finalData: any) {
    this.sendEvent({
      type: 'done',
      data: finalData
    });
  }

  sendError(error: string) {
    this.sendEvent({
      type: 'error',
      data: { error }
    });
  }

  close() {
    if (this.closed) return;
    this.stopHeartbeat();
    this.closed = true;
    try {
      this.controller.close();
    } catch (_) {
      // Already closed
    }
  }
}

export function createStreamResponse(signal?: AbortSignal): {
  stream: ReadableStream;
  handler: StreamingHandler;
} {
  let handler: StreamingHandler;

  const stream = new ReadableStream({
    start(controller) {
      handler = new StreamingHandler(controller);

      if (signal) {
        if (signal.aborted) {
          handler.close();
        } else {
          const onAbort = () => {
            try {
              handler.sendError('Client aborted the request');
            } catch (e) {
              // ignore
            }
            handler.close();
          };
          signal.addEventListener('abort', onAbort, { once: true });
        }
      }
    }
  });

  return { stream, handler: handler! };
}

