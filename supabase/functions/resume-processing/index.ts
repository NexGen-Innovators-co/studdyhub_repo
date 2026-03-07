/**
 * resume-processing/index.ts
 *
 * Resumes extraction for documents with processing_status = 'partial'.
 *
 * POST body:
 *   { "userId": "...", "documentId": "..." }
 *
 * Flow:
 *   1. Load the document record from the DB
 *   2. Re-fetch the original file from Supabase Storage
 *   3. Read the resume_cursor from processing_metadata
 *   4. Continue extraction from where it stopped
 *   5. Append new content to existing content_extracted
 *   6. Update the DB record (status → completed | partial)
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

import { extractPdfTextWithPdfjsChunked } from '../document-processor/processors/documents.ts';

// ============================================================================
// CORS
// ============================================================================

const getCorsHeaders = (origin = '*') => ({
  'Access-Control-Allow-Origin':      origin,
  'Access-Control-Allow-Headers':     'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':     'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Vary':                             'Origin',
});

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase           = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// SERVER
// ============================================================================

serve(async (req) => {
  const origin = req.headers.get('origin') ?? '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  const startTime = Date.now();

  try {
    const { userId, documentId } = await req.json();

    if (!userId || !documentId) {
      return jsonError('Missing required fields: userId and documentId', 400, origin);
    }

    // ── 1. Load document from DB ─────────────────────────────────────────────
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (docError || !doc) {
      return jsonError(`Document not found: ${docError?.message}`, 404, origin);
    }

    if (doc.processing_status === 'completed') {
      return jsonOk({ message: 'Document already fully processed.', documentId }, origin);
    }

    if (!['partial', 'processing', 'failed'].includes(doc.processing_status)) {
      return jsonError(
        `Document status '${doc.processing_status}' cannot be resumed.`,
        400, origin,
      );
    }

    // ── 2. Re-fetch original file from Storage ───────────────────────────────
    if (!doc.file_url) {
      return jsonError('No file_url on document — cannot resume without original file.', 400, origin);
    }

    const fileResp = await fetch(doc.file_url);
    if (!fileResp.ok) {
      return jsonError(`Failed to fetch file from storage: ${fileResp.status}`, 502, origin);
    }

    // Use binary buffer directly — avoid the wasteful base64 round-trip
    // (ArrayBuffer → string → base64 → atob → Uint8Array costs ~3x the file size in memory)
    const buffer = new Uint8Array(await fileResp.arrayBuffer());

    // ── 3. Read resume cursor ─────────────────────────────────────────────────
    const cursor: any = doc.processing_metadata?.resume_cursor ?? {};

    let newContent = '';
    let isComplete = false;
    let updatedCursor: any = null;

    // ── 4. Continue extraction (local only, no LLM) ──────────────────────────

    if (cursor.type === 'pdf_pages' || doc.file_type === 'application/pdf') {
      // PDF: resume page-by-page using local pdf.js
      const startPage = cursor.lastPage ? cursor.lastPage + 1 : 1;

      const result = await extractPdfTextWithPdfjsChunked(buffer, { startPage });
      newContent   = result.fullText;
      isComplete   = result.isComplete;

      if (!isComplete) {
        updatedCursor = {
          type: 'pdf_pages',
          lastPage: result.lastPageProcessed,
          totalPages: result.totalPages,
          windowsProcessed: (cursor.windowsProcessed ?? 0) + 1,
        };
      }

    } else {
      // Non-PDF or unknown cursor: use local ZIP-based extraction
      const { extractTextFromZip } = await import('../document-processor/processors/documents.ts');

      newContent = await extractTextFromZip(buffer, doc.file_name ?? 'unknown');
      isComplete = true;
    }

    // ── 5. Append + update DB ─────────────────────────────────────────────────
    const DB_CAP     = 1 * 1024 * 1024;
    const combined   = [doc.content_extracted, newContent].filter(Boolean).join('\n\n---RESUMED---\n\n');
    const forDb      = combined.length > DB_CAP
      ? combined.slice(0, DB_CAP) + '\n\n[DB_TRUNCATED]'
      : combined;

    const newStatus  = isComplete ? 'completed' : 'partial';
    const newError   = isComplete
      ? null
      : `Partial: further resume required. Call /resume-processing again with documentId ${documentId}.`;

    const updatedMetadata = {
      ...(doc.processing_metadata ?? {}),
      resume_cursor: updatedCursor ?? null,
      lastResumedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        content_extracted:  forDb,
        processing_status:  newStatus,
        processing_error:   newError,
        processing_metadata: updatedMetadata,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      return jsonError(`Failed to update document: ${updateError.message}`, 500, origin);
    }

    return jsonOk({
      documentId,
      processing_status: newStatus,
      isComplete,
      newContentLength: newContent.length,
      totalContentLength: forDb.length,
      processingTimeMs: Date.now() - startTime,
      canResumeAgain: !isComplete,
    }, origin);

  } catch (err: any) {
    try {
      const logClient = createClient(supabaseUrl, supabaseServiceKey);
      await logSystemError(logClient, {
        severity: 'error',
        source:   'resume-processing',
        message:  err?.message ?? String(err),
        details:  { stack: err?.stack },
      });
    } catch { /* ignore logging failure */ }

    return jsonError(err.message ?? 'Internal Server Error', 500, origin);
  }
});

// ============================================================================
// HELPERS
// ============================================================================

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