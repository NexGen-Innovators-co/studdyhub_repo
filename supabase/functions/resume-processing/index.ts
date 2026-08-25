/**
 * resume-processing/index.ts
 *
 * Resumes extraction for documents in partial/processing state with safe retry.
 *
 * POST body: { userId: string, documentId?: string, limit?: number }
 *
 * Behavior:
 * 1) If documentId provided, resume exactly that row.
 * 2) If no documentId, auto-resume stale docs (processing/partial/failed older than 5m).
 * 3) On success update document row with completed/partial.
 * 4) On error increment processing_attempts and mark failed after 5 attempts.
 */

declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';
import { extractPdfTextWithPdfjsChunked, extractTextFromZip } from '../document-processor/processors/documents.ts';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const MAX_RESUME_ATTEMPTS = 5;
const MAX_BATCH = 15;
const DB_CONTENT_CAP = 1 * 1024 * 1024; // 1MB

const getCorsHeaders = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  Vary: 'Origin',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: any) => {
  const origin = req.headers.get('origin') ?? '*';
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const userId = body?.userId;
    const documentId = body?.documentId as string | undefined;
    const limit = Math.min(Number(body?.limit) || MAX_BATCH, MAX_BATCH);

    if (!userId) {
      return jsonError('Missing required parameter: userId', 400, origin);
    }

    if (documentId) {
      const data = await resumeOneDocument(userId, documentId);
      return jsonOk({ documentCount: data ? 1 : 0, documents: data ? [data] : [] }, origin);
    }

    const documents = await loadStaleDocuments(userId, limit);
    if (!documents.length) {
      return jsonOk({ documentCount: 0, documents: [] }, origin);
    }

    const results = [];
    for (const doc of documents) {
      const rr = await resumeOneDocument(userId, doc.id, doc);
      results.push(rr);
    }

    return jsonOk({ documentCount: results.length, processingTimeMs: Date.now() - startTime, documents: results }, origin);
  } catch (err: any) {
    await logError('resume-processing', err);
    return jsonError(err?.message ?? 'Internal Server Error', 500, origin);
  }
});

async function loadStaleDocuments(userId: string, limit: number) {
  const staleTime = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .in('processing_status', ['processing', 'partial', 'failed'])
    .lt('updated_at', staleTime)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as any[];
}

async function resumeOneDocument(userId: string, documentId: string, docRecord?: any) {
  let doc = docRecord;
  if (!doc) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { documentId, status: 'failed', error: `Document not found: ${error?.message || 'unknown'}` };
    }
    doc = data;
  }

  if (doc.processing_status === 'completed') {
    return { documentId, status: 'completed', isComplete: true };
  }

  if (!['pending', 'processing', 'partial', 'failed'].includes(doc.processing_status)) {
    return { documentId, status: 'failed', error: `Cannot resume status ${doc.processing_status}` };
  }

  if (!doc.file_url) {
    await markDocumentFailed(doc.id, 'No file_url for document');
    return { documentId, status: 'failed', error: 'Missing file_url' };
  }

  const fileResp = await fetch(doc.file_url);
  if (!fileResp.ok) {
    await markDocumentFailed(doc.id, `Failed to fetch file_url: ${fileResp.status}`);
    return { documentId, status: 'failed', error: `Failed to fetch file: ${fileResp.status}` };
  }

  const buffer = new Uint8Array(await fileResp.arrayBuffer());
  const options = await extractContentFromBuffer(doc, buffer);

  if (!options.success) {
    const attempt = (doc.processing_metadata?.processing_attempts ?? 0) + 1;
    const nextStatus = attempt >= MAX_RESUME_ATTEMPTS ? 'failed' : 'partial';
    const failReason = options.error || 'Extraction failed';

    await supabase.from('documents').update({
      processing_status: nextStatus,
      processing_error: failReason,
      continuation_attempt: (doc.continuation_attempt ?? 0) + 1,
      processing_metadata: {
        ...(doc.processing_metadata ?? {}),
        processing_attempts: attempt,
        lastResumedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', doc.id);

    return { documentId: doc.id, status: nextStatus, isComplete: false, error: failReason };
  }

  const existingContent = doc.content_extracted ?? '';
  const existingCursor = doc.processing_metadata?.resume_cursor;
  const resumedFromStart = !existingCursor || existingCursor.lastPage === 0;

  const combinedRaw = resumedFromStart
    ? options.newContent ?? ''
    : [existingContent, options.newContent ?? ''].filter(Boolean).join('\n\n---RESUMED---\n\n');

  const finalContent = sanitizeContentForDb(combinedRaw, '');

  const resumeCursor = options.updatedCursor || null;
  const isComplete = options.isComplete;
  const newStatus = isComplete ? 'completed' : 'partial';

  await supabase.from('documents').update({
    content_extracted: finalContent,
    processing_status: newStatus,
    processing_error: isComplete ? null : null,
    continuation_attempt: (doc.continuation_attempt ?? 0) + 1,
    processing_metadata: {
      ...(doc.processing_metadata ?? {}),
      resume_cursor: resumeCursor,
      processing_attempts: (doc.processing_metadata?.processing_attempts ?? 0) + 1,
      lastResumedAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }).eq('id', doc.id);

  return {
    documentId: doc.id,
    status: newStatus,
    isComplete,
    newContentLength: options.newContent?.length ?? 0,
    totalContentLength: finalContent.length,
    canResumeAgain: newStatus === 'partial',
  };
}

async function extractContentFromBuffer(doc: any, buffer: Uint8Array) {
  try {
    const cursor: any = doc.processing_metadata?.resume_cursor ?? {};
    let newContent = '';
    let isComplete = false;
    let updatedCursor = null;

    if (doc.mime_type === 'application/pdf' || cursor.type === 'pdf_pages') {
      const startPage = cursor.lastPage ? cursor.lastPage + 1 : 1;
      const result = await extractPdfTextWithPdfjsChunked(buffer, { startPage });

      newContent = result.fullText ?? '';
      isComplete = result.isComplete;

      if (!isComplete) {
        updatedCursor = {
          type: 'pdf_pages',
          lastPage: result.lastPageProcessed,
          totalPages: result.totalPages,
          windowsProcessed: (cursor.windowsProcessed ?? 0) + 1,
        };
      }
    } else {
      newContent = await extractTextFromZip(buffer, doc.file_name || 'unknown');
      isComplete = true;
      updatedCursor = null;
    }

    return { success: true, newContent, updatedCursor, isComplete };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

function sanitizeContentForDb(existing: string, incoming: string) {
  const merged = [existing || '', incoming || ''].filter(Boolean).join('\n\n---RESUMED---\n\n');
  return merged.length > DB_CONTENT_CAP ? merged.slice(0, DB_CONTENT_CAP) + '\n\n[DB_TRUNCATED]' : merged;
}

async function markDocumentFailed(docId: string, reason: string) {
  await supabase.from('documents').update({
    processing_status: 'failed',
    processing_error: reason,
    updated_at: new Date().toISOString(),
  }).eq('id', docId);
}

async function logError(source: string, error: any) {
  try {
    await logSystemError(supabase, {
      severity: 'error',
      source,
      message: error?.message ?? String(error),
      details: { stack: error?.stack ?? null },
    });
  } catch {
    // ignore
  }
}

function jsonOk(body: unknown, origin: string) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function jsonError(message: string, status: number, origin: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}
