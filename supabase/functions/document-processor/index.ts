import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

import { processBase64File, enhancedBatchProcessing } from './processors/pipeline.ts';
import { saveFileToDatabase } from './storage.ts';

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
// SERVER
// ============================================================================

serve(async (req) => {
  const origin = req.headers.get('origin') ?? '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  const startTime           = Date.now();
  let files: any[]          = [];
  let userId: string | null = null;
  let uploadedDocumentIds: string[] = [];

  try {
    // ── Validate Content-Type ──────────────────────────────────────────────
    if (!req.headers.get('content-type')?.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Unsupported Content-Type. Please send application/json.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } },
      );
    }

    const requestData      = await req.json();
    userId                 = requestData.userId;
    const incomingFilesData: any[] = requestData.files;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } },
      );
    }

    if (!Array.isArray(incomingFilesData) || incomingFilesData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No files provided for processing.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } },
      );
    }

    // ── Intake files ───────────────────────────────────────────────────────
    for (const fileData of incomingFilesData) {
      const processedFile = await processBase64File(fileData);
      if (processedFile) files.push(processedFile);
    }

    // ── Persist initial records early so clients can poll during long processing ─
    for (const file of files) {
      // mark as processing so that the DB shows work in progress
      file.processing_status = file.processing_status || 'processing';
      file.processing_error = file.processing_error ?? null;
      const id = await saveFileToDatabase(file, userId);
      if (id) {
        uploadedDocumentIds.push(id);
      }
      // even if the early save failed we continue; final save will report failure
    }

    // ── AI processing ──────────────────────────────────────────────────────
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY environment variable is not configured.');

    await enhancedBatchProcessing(files, geminiApiKey, userId);

    // ── Persist final results to database ────────────────────────────────────
    const savedDocuments: any[] = [];

    for (const file of files) {
      const documentId = await saveFileToDatabase(file, userId); // will update existing record if id present

      if (documentId) {
        // make sure id is tracked even if it was already pushed earlier
        if (!uploadedDocumentIds.includes(documentId)) uploadedDocumentIds.push(documentId);
        savedDocuments.push(buildSavedDoc(file, userId));
      } else {
        savedDocuments.push({
          ...buildSavedDoc(file, userId),
          id: file.id ?? null,
          file_url: file.file_url ?? null,
          processing_status: 'failed',
          processing_error: file.processing_error ?? 'Failed to save to database',
        });
      }
    }

    // Identify any files that need resuming so the client knows to call /resume-processing
    const partialDocuments = savedDocuments
      .filter((d) => d.processing_status === 'partial' && d.id)
      .map((d) => ({
        documentId: d.id,
        fileName:   d.file_name,
        message:    'Partial extraction saved. POST {"userId","documentId"} to /resume-processing to continue.',
      }));

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        message:               'Files processed with enhanced zero-truncation system.',
        processingTime,
        filesProcessedCount:   files.length,
        uploadedDocumentIds,
        partialDocuments,        // ← files that need /resume-processing
        processingResults:     files.map(fileToResult),
        documents:             savedDocuments,
      }),
      { headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } },
    );
  } catch (error: any) {
    // ── Error logging ──────────────────────────────────────────────────────
    try {
      const logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(logClient, {
        severity: 'error',
        source:   'document-processor',
        message:  error?.message ?? String(error),
        details:  { stack: error?.stack },
      });
    } catch (logErr) {
      console.error('[document-processor] Error logging failed:', logErr);
    }

    return new Response(
      JSON.stringify({
        error:               error.message ?? 'Internal Server Error',
        processingTime:      Date.now() - startTime,
        filesProcessedCount: files.length,
        processingResults:   files.map((f) => ({
          ...fileToResult(f),
          status: f.processing_status ?? 'failed',
          error:  f.processing_error  ?? error.message,
        })),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) } },
    );
  }
});

// ============================================================================
// HELPERS
// ============================================================================

function buildSavedDoc(file: any, userId: string) {
  return {
    id:                file.id,
    title:             file.name,
    file_name:         file.name,
    file_url:          file.file_url,
    file_type:         file.mimeType,
    file_size:         file.size,
    content_extracted: file.content,
    type:              file.type,
    processing_status: file.processing_status,
    processing_error:  file.processing_error,
    processing_metadata: file.processing_metadata ?? null,
    created_at:        new Date().toISOString(),
    updated_at:        new Date().toISOString(),
    user_id:           userId,
  };
}

function fileToResult(f: any) {
  return {
    id:               f.id,
    name:             f.name,
    type:             f.type,
    mimeType:         f.mimeType,
    status:           f.processing_status,
    error:            f.processing_error,
    fileUrl:          f.file_url,
    contentExtracted: f.content,
    processingTimeMs: f.total_processing_time_ms,
    extractionModel:  f.extraction_model_used,
  };
}