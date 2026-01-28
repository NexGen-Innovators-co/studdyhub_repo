// streaming-handler.ts - Server-Sent Events streaming for agentic thinking

export interface StreamEvent {
  type: 'thinking_step' | 'content_chunk' | 'done' | 'error';
  data: any;
}

export class StreamingHandler {
  private encoder: TextEncoder;
  private controller: ReadableStreamDefaultController;

  constructor(controller: ReadableStreamDefaultController) {
    this.encoder = new TextEncoder();
    this.controller = controller;
  }

  sendEvent(event: StreamEvent) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(data));
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
    this.controller.close();
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
          try { controller.close(); } catch (_) {}
        } else {
          const onAbort = () => {
            try {
              handler.sendError('Client aborted the request');
            } catch (e) {
              // ignore
            }
            try { controller.close(); } catch (_) {}
          };
          signal.addEventListener('abort', onAbort, { once: true });
        }
      }
    }
  });

  return { stream, handler: handler! };
}

