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
import { assembleChunksFromStorage } from '../document-processor/storage.ts';
import { callEnhancedGeminiAPI } from '../document-processor/geminiApi.ts';
import { EXTRACTION_PROMPTS } from '../document-processor/prompts.ts';
import { mergeAudioTranscript } from './audioTranscriptMerger.ts';

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

  const meta: any = parseJsonMeta(doc.processing_metadata);

  // ── Round lock: optimistic, TTL-based ────────────────────────────────────
  // The web client drives rounds from two places at once (the global upload
  // activity poller and the per-document retry loop), and concurrent rounds
  // race on the same cursor: both transcribe the same part and append it
  // twice — seen in production logs as duplicate Files API uploads with
  // identical sha256 from two executions. A claim on updated_at alone cannot
  // exclude a round that starts while the first is mid-transcription (no
  // writes are visible yet, so it wins its own claim). Instead we stamp
  // round_locked_at into processing_metadata and hold it for the whole
  // round: rounds started within the TTL skip immediately, while an
  // updated_at compare-and-set still settles simultaneous starts (whoever
  // bumps the row first wins).
  const LOCK_TTL_MS = 4 * 60 * 1000; // > max round duration (110s budget + one part)
  const existingLock = Number(meta?.round_locked_at ?? 0);
  if (existingLock && Date.now() - existingLock < LOCK_TTL_MS) {
    return {
      documentId: doc.id,
      status: doc.processing_status,
      isComplete: false,
      skippedBusy: true,
      error: 'Another processing round is already running for this document',
      canResumeAgain: true,
    };
  }

  const lockedMeta = { ...(meta ?? {}), round_locked_at: Date.now() };
  const claimQuery = supabase
    .from('documents')
    .update({ processing_metadata: lockedMeta, updated_at: new Date().toISOString() })
    .eq('id', doc.id);
  const { data: claimed } = await (doc.updated_at
    ? claimQuery.eq('updated_at', doc.updated_at)
    : claimQuery
  ).select('id');
  if (!claimed || claimed.length === 0) {
    return {
      documentId: doc.id,
      status: doc.processing_status,
      isComplete: false,
      skippedBusy: true,
      error: 'Another round claimed this document first — retrying',
      canResumeAgain: true,
    };
  }

  // (lock released by every terminal metadata write below / in the audio path)

  // Audio never needs whole-file assembly: it is transcribed one stored part
  // at a time (memory stays ~one part regardless of total file size), so the
  // 100MB whole-file cap below does not apply to it.
  if (isAudioDoc(doc)) {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      await markDocumentFailed(doc.id, 'GEMINI_API_KEY is not configured');
      return { documentId: doc.id, status: 'failed', error: 'GEMINI_API_KEY not configured' };
    }
    return await resumeAudioTranscription(doc, lockedMeta, apiKey);
  }

  // Free-plan safety (non-audio): fetching/assembling a huge source blows the
  // edge isolate's memory limit (observed as repeated "Memory limit exceeded"
  // crashes + restarts). Refuse up front, before any download starts.
  const MAX_PROCESS_BYTES = 100 * 1024 * 1024;
  const declaredSize = Number(doc.file_size ?? 0);
  if (declaredSize > MAX_PROCESS_BYTES) {
    const sizeMB = Math.round(declaredSize / 1024 / 1024);
    const capMB = Math.round(MAX_PROCESS_BYTES / 1024 / 1024);
    const reason = `File is ${sizeMB}MB — above the ${capMB}MB processing limit for this plan. Processing was stopped to protect the service.`;
    await markDocumentFailed(doc.id, reason);
    return { documentId: doc.id, status: 'failed', error: reason };
  }

  const chunkPaths: string[] | null = Array.isArray(meta?.chunk_paths)
    ? meta.chunk_paths
    : null;

  let buffer: Uint8Array | null = null;

  if (chunkPaths && chunkPaths.length > 0) {
    // Chunked upload: the original file lives in the bucket as parts —
    // assemble them server-side (free plan cannot hold >50MB in one object).
    buffer = await assembleChunksFromStorage(chunkPaths);
    if (!buffer) {
      await markDocumentFailed(doc.id, 'Failed to assemble chunked file parts');
      return { documentId, status: 'failed', error: 'Failed to assemble chunked file' };
    }
  } else {
    if (!doc.file_url) {
      await markDocumentFailed(doc.id, 'No file_url for document');
      return { documentId, status: 'failed', error: 'Missing file_url' };
    }

    const fileResp = await fetch(doc.file_url);
    if (!fileResp.ok) {
      await markDocumentFailed(doc.id, `Failed to fetch file_url: ${fileResp.status}`);
      return { documentId, status: 'failed', error: `Failed to fetch file: ${fileResp.status}` };
    }

    buffer = new Uint8Array(await fileResp.arrayBuffer());
  }

  const options = await extractContentFromBuffer(doc, buffer);

  if (!options.success) {
    const attempt = (meta?.processing_attempts ?? 0) + 1;
    const nextStatus = attempt >= MAX_RESUME_ATTEMPTS ? 'failed' : 'partial';
    const failReason = options.error || 'Extraction failed';

    await supabase.from('documents').update({
      processing_status: nextStatus,
      processing_error: failReason,
      continuation_attempt: (doc.continuation_attempt ?? 0) + 1,
      processing_metadata: {
        ...withoutLock(meta),
        processing_attempts: attempt,
        lastResumedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', doc.id);

    return { documentId: doc.id, status: nextStatus, isComplete: false, error: failReason };
  }

  const existingContent = doc.content_extracted ?? '';
  const existingCursor = meta?.resume_cursor;
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
    ...withoutLock(meta),
    resume_cursor: resumeCursor,
    processing_attempts: (meta?.processing_attempts ?? 0) + 1,
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
    const cursor: any = parseJsonMeta(doc.processing_metadata)?.resume_cursor ?? {};
    let newContent = '';
    let isComplete = false;
    let updatedCursor = null;

    if (doc.file_type === 'application/pdf' || cursor.type === 'pdf_pages') {
      const startPage = cursor.lastPage ? cursor.lastPage + 1 : 1;
      const result = await extractPdfTextWithPdfjsChunked(buffer, {
        startPage,
        customInstruction: parseJsonMeta(doc.processing_metadata)?.customInstruction ?? null,
      });

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

// processing_metadata may be a jsonb object OR a JSON-encoded string
// depending on how the row was written/read — never assume the shape.
// ============================================================================
// AUDIO — per-part transcription (never assembles the whole file)
// ============================================================================

function isAudioDoc(doc: any): boolean {
  return doc.type === 'audio' || String(doc.file_type ?? '').startsWith('audio/');
}

// Free-plan edge functions cap at 150s wall clock — leave headroom per round.
const AUDIO_ROUND_BUDGET_MS = 110_000;
// A hung upload must fail (and be retried) instead of pinning the isolate
// until the runtime kills it — production logs showed executions that never
// returned because the upload fetch never resolved.
const AUDIO_UPLOAD_TIMEOUT_MS = 90_000;

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Transcribes audio a single stored part at a time (chunked uploads land as
 * ~20MB parts in the bucket), persisting `audio_cursor` after every part so
 * rounds are crash-safe and resumable. A 770MB file therefore never exists
 * in memory — only its current part does.
 */
async function resumeAudioTranscription(doc: any, meta: any, geminiApiKey: string): Promise<any> {
  const chunkPaths: string[] = Array.isArray(meta?.chunk_paths) ? meta.chunk_paths : [];
  const hasParts = chunkPaths.length > 0;

  if (!hasParts && !doc.file_url) {
    await markDocumentFailed(doc.id, 'No stored audio parts or file URL found');
    return { documentId: doc.id, status: 'failed', isComplete: false, error: 'No stored audio source', canResumeAgain: false };
  }

  const totalParts = hasParts ? chunkPaths.length : 1;
  const audioMeta = meta?.audio_cursor ?? {};
  let nextPart = Number(audioMeta.nextPart ?? 0);
  let partsTranscribed = Number(audioMeta.partsTranscribed ?? 0);
  const mime = String(doc.file_type || 'audio/mpeg');
  const roundStart = Date.now();

  // Live view of processing_metadata as parts persist. Per-part writes
  // spread it (keeping round_locked_at, so the lock is held for the whole
  // round); terminal writes spread withoutLock(outMeta) (releasing it)
  // without ever reverting the audio cursor.
  const outMeta: any = { ...(meta ?? {}) };

  while (nextPart < totalParts && Date.now() - roundStart < AUDIO_ROUND_BUDGET_MS) {
    try {
      // Download ONLY this part — memory stays ~part-size, never total size.
      let bytes: Uint8Array;
      if (hasParts) {
        const { data, error } = await supabase.storage.from('documents').download(chunkPaths[nextPart]);
        if (error || !data) throw new Error(`part ${nextPart + 1}/${totalParts}: ${error?.message ?? 'not found'}`);
        bytes = new Uint8Array(await data.arrayBuffer());
      } else {
        const partResp = await fetch(doc.file_url);
        if (!partResp.ok) throw new Error(`fetch audio: ${partResp.status}`);
        bytes = new Uint8Array(await partResp.arrayBuffer());
      }

      // WAV parts are raw byte slices of the original file: only part 0 has
      // the header. Rebuild a valid WAV header (and align to the sample frame
      // using bytes from the previous part) so every part transcribes cleanly.
      if (mime === 'audio/wav' || /\.wav$/i.test(String(doc.file_name ?? ''))) {
        bytes = await prepareWavPart(bytes, nextPart, hasParts ? chunkPaths : []);
      }

      const transcript = await transcribeAudioBytes(
        bytes,
        mime,
        doc.file_name ?? 'audio',
        geminiApiKey,
        meta?.customInstruction ?? null,
      );

      partsTranscribed += 1;
      nextPart += 1;
      const complete = nextPart >= totalParts;

      const prev = String(doc.content_extracted ?? '');
      const isPlaceholder = prev.startsWith('[Large file pending extraction') || prev.startsWith('[File:');
      const joined = isPlaceholder || !prev ? transcript : `${prev}\n\n${transcript}`;
      const content = joined.length > DB_CONTENT_CAP ? joined.slice(0, DB_CONTENT_CAP) + '\n\n[DB_TRUNCATED]' : joined;
      doc.content_extracted = content;

      // Persist progress after every part — resumable even if the isolate dies.
      await supabase.from('documents').update({
        content_extracted: content,
        processing_status: complete ? 'completed' : 'partial',
        processing_error: null,
        continuation_attempt: (doc.continuation_attempt ?? 0) + 1,
        extraction_model_used: 'gemini-files-api',
        processing_metadata: {
          ...outMeta,
          audio_cursor: { nextPart, partsTranscribed, totalParts },
          lastResumedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', doc.id);
      outMeta.audio_cursor = { nextPart, partsTranscribed, totalParts };
    } catch (err: any) {
      const attempts = (meta?.processing_attempts ?? 0) + 1;
      const reason = err?.message ?? String(err);
      const nextStatus = attempts >= MAX_RESUME_ATTEMPTS ? 'failed' : 'partial';
      await supabase.from('documents').update({
        processing_status: nextStatus,
        processing_error: `Audio part ${nextPart + 1}/${totalParts}: ${reason}`,
        continuation_attempt: (doc.continuation_attempt ?? 0) + 1,
        processing_metadata: {
          ...withoutLock(outMeta),
          processing_attempts: attempts,
          lastResumedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', doc.id);
      return { documentId: doc.id, status: nextStatus, isComplete: false, error: reason, canResumeAgain: nextStatus === 'partial' };
    }
  }

  const complete = nextPart >= totalParts;

  // Release the round lock so the client's next round can start immediately
  // (otherwise the TTL would gate all rounds for up to 4 minutes).
  await supabase.from('documents').update({
    processing_metadata: withoutLock(outMeta),
    updated_at: new Date().toISOString(),
  }).eq('id', doc.id);

  return {
    documentId: doc.id,
    status: complete ? 'completed' : 'partial',
    isComplete: complete,
    newContentLength: 0,
    totalContentLength: String(doc.content_extracted ?? '').length,
    canResumeAgain: !complete,
  };
}

/**
 * Transcribes one audio blob via the Gemini Files API — the part is uploaded
 * as a file (no 20MB inline-payload limit), referenced by URI during
 * generateContent, then deleted. Reuses callEnhancedGeminiAPI, so the model
 * chain, 429 backoff and OpenRouter fallback all apply.
 */
async function transcribeAudioBytes(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
  geminiApiKey: string,
  customInstruction?: string | null,
): Promise<string> {
  const safeName = `${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}.part`;

  // Upload to the Files API *upload* endpoint (/upload/v1beta/files), NOT the
  // JSON endpoint (/v1beta/files). Posting form data to the JSON endpoint is
  // treated as an empty files.create call: the API answers HTTP 200 with an
  // empty `{}` File resource and stores nothing — observed in production logs
  // as "Files API upload → HTTP 200: {}" followed by "Files API returned no
  // file reference", which made every audio round fail at the same part.
  // This mirrors uploadToGemini in gemini-audio-processor, proven to work.
  const uploadResp = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length),
        'X-Goog-Upload-File-Name': safeName,
        'Content-Type': mimeType,
      },
      body: new Blob([bytes], { type: mimeType }),
    },
    AUDIO_UPLOAD_TIMEOUT_MS,
  );
  const rawBody = await uploadResp.text().catch(() => '');
  console.log(`[audio] Files API upload → HTTP ${uploadResp.status}: ${rawBody.substring(0, 400)}`);

  if (!uploadResp.ok) {
    throw new Error(`Files API upload failed (${uploadResp.status}): ${rawBody.slice(0, 300)}`);
  }

  let uploadData: any = {};
  try { uploadData = JSON.parse(rawBody); } catch { /* keep {} */ }

  // Resumable-handshake fallback: if the API answered with an upload URL
  // header instead of the file resource, the bytes still have to be POSTed
  // to that URL to finalize the upload.
  const resumeUrl = uploadResp.headers.get('x-goog-upload-url');
  if (resumeUrl && typeof uploadData?.file?.uri !== 'string') {
    const finResp = await fetchWithTimeout(
      resumeUrl,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Command': 'upload, finalize',
          'X-Goog-Upload-Header-Content-Length': String(bytes.length),
          'Content-Type': mimeType,
        },
        body: new Blob([bytes], { type: mimeType }),
      },
      AUDIO_UPLOAD_TIMEOUT_MS,
    );
    const finBody = await finResp.text().catch(() => '');
    console.log(`[audio] Files API finalize → HTTP ${finResp.status}: ${finBody.substring(0, 400)}`);
    if (finResp.ok) {
      try { uploadData = JSON.parse(finBody); } catch { /* keep previous */ }
    }
  }

  const fileObj: any = uploadData?.file ?? uploadData;
  let fileUri: string | undefined = typeof fileObj?.uri === 'string' ? fileObj.uri : undefined;
  let fileRef: string | undefined = typeof fileObj?.name === 'string' ? fileObj.name : undefined;
  if (!fileUri && fileRef?.startsWith('files/')) {
    fileUri = `https://generativelanguage.googleapis.com/v1beta/${fileRef}`;
  }
  if (!fileRef && fileUri?.includes('/files/')) {
    fileRef = `files/${fileUri.split('/files/')[1].split('?')[0]}`;
  }
  if (!fileUri || !fileRef) {
    throw new Error(`Files API returned no file reference: ${rawBody.slice(0, 300) || '(empty body)'}`);
  }

  try {
    let state: string = uploadData?.file?.state ?? 'PROCESSING';
    for (let i = 0; i < 20 && state !== 'ACTIVE'; i++) {
      if (state === 'FAILED') throw new Error('Files API could not process this audio part');
      await new Promise((r) => setTimeout(r, 1000));
      const st = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileRef}?key=${geminiApiKey}`);
      const stData = await st.json().catch(() => ({}));
      if (stData?.error) throw new Error(`Files API state check: ${JSON.stringify(stData.error).slice(0, 200)}`);
      const stObj: any = stData?.file ?? stData;
      state = stObj?.state ?? 'PROCESSING';
    }
    if (state !== 'ACTIVE') throw new Error(`Audio part not ready for transcription (state=${state})`);

    const result = await callEnhancedGeminiAPI(
      [
        {
          role: 'user',
          parts: [
            {
              text: `${EXTRACTION_PROMPTS.audio}

LANGUAGE-RECOGNITION REQUIREMENT:
- Detect the spoken language separately for every speaker and transcribe the original words in that language.
- Never output <foreign spoken>, [Foreign speech], [foreign language], [non-English], or similar placeholders because a language is unfamiliar.
- If the language is uncertain, identify your best guess in a brief parenthetical language tag and still provide the closest phonetic transcription.
${customInstruction ? `
CUSTOM USER INSTRUCTION:
${customInstruction}
` : ''}`,
            },
            { fileData: { mimeType, fileUri } },
          ],
        },
      ],
      geminiApiKey,
    );
    if (!result.success || !result.content) {
      throw new Error(result.error ?? 'Transcription returned no content');
    }
    return result.content;
  } finally {
    // Best-effort cleanup (uploaded files also auto-expire server-side).
    try {
      await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileRef}?key=${geminiApiKey}`, { method: 'DELETE' });
    } catch { /* ignore */ }
  }
}

// ============================================================================
// WAV PART RECONSTRUCTION
//
// Chunked uploads slice files into fixed-size byte ranges. For WAV/PCM that
// means only part 000 contains the RIFF header — parts 001+ are headerless
// PCM byte-slices that start (potentially) mid-sample-frame. To make each
// part independently transcribable we: (1) parse fmt/data from part 000 via
// a Range read, (2) synthesize a correct 44-byte WAV header for this part's
// length, (3) fetch the few framing bytes missing before this part's start
// so playback/samples begin on a sample-frame boundary.
// ============================================================================

const PUBLIC_OBJECT_BASE = `${Deno.env.get('SUPABASE_URL') ?? ''}/storage/v1/object/public/documents`;

function startsWithRiff(b: Uint8Array): boolean {
  return b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46; // 'RIFF'
}

function parseWavHeader(
  b: Uint8Array,
): { channels: number; sampleRate: number; bits: number; blockAlign: number; dataOffset: number } | null {
  if (!startsWithRiff(b) || b.length < 44) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let off = 12;
  let fmt: { channels: number; sampleRate: number; bits: number } | null = null;
  let dataOffset = -1;
  while (off + 8 <= b.length) {
    const id = String.fromCharCode(b[off], b[off + 1], b[off + 2], b[off + 3]);
    const size = dv.getUint32(off + 4, true);
    if (id === 'fmt ' && off + 8 + 16 <= b.length) {
      fmt = {
        channels: dv.getUint16(off + 10, true),
        sampleRate: dv.getUint32(off + 12, true),
        bits: dv.getUint16(off + 22, true),
      };
    }
    if (id === 'data') { dataOffset = off + 8; break; }
    off += 8 + size + (size % 2);
  }
  if (!fmt || dataOffset < 0 || fmt.bits === 0 || fmt.bits % 8 !== 0 || fmt.channels === 0) return null;
  return { ...fmt, blockAlign: (fmt.bits / 8) * fmt.channels, dataOffset };
}

function buildWavHeader(p: { channels: number; sampleRate: number; bits: number; blockAlign: number }, dataLen: number): Uint8Array {
  const h = new Uint8Array(44);
  const dv = new DataView(h.buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < 4; i++) h[o + i] = s.charCodeAt(i); };
  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + dataLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, p.channels, true);
  dv.setUint32(24, p.sampleRate, true);
  dv.setUint32(28, p.sampleRate * p.blockAlign, true);
  dv.setUint16(32, p.blockAlign, true);
  dv.setUint16(34, p.bits, true);
  writeStr(36, 'data');
  dv.setUint32(40, dataLen, true);
  return h;
}

async function fetchPublicRange(path: string, start: number, end: number): Promise<Uint8Array | null> {
  try {
    const resp = await fetch(`${PUBLIC_OBJECT_BASE}/${path}`, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (!resp.ok && resp.status !== 206) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

async function prepareWavPart(raw: Uint8Array, index: number, chunkPaths: string[]): Promise<Uint8Array> {
  // Part 0 ships with the original header — pass through untouched.
  if (index === 0 && startsWithRiff(raw)) return raw;
  const hasParts = chunkPaths.length > 0;
  if (!hasParts) return raw; // whole-file source already carries its header

  // Read fmt/data layout from the first 64KB of part 000.
  const head = await fetchPublicRange(chunkPaths[0], 0, 65_535);
  const params = head ? parseWavHeader(head) : null;
  if (!params) return raw; // unknown layout — send as-is and let it surface honestly

  // Where this part starts inside the original stream → sample-frame skew.
  const partSize = raw.length; // all parts except the last are the same size
  const absStart = index * partSize;
  const skew = ((absStart - params.dataOffset) % params.blockAlign + params.blockAlign) % params.blockAlign;

  let filler = new Uint8Array(0);
  if (skew !== 0) {
    const need = params.blockAlign - skew; // bytes that precede this part in the stream
    const prev = index > 0 ? await fetchPublicRange(chunkPaths[index - 1], Math.max(0, partSize - need), partSize - 1) : null;
    if (prev && prev.length === need) filler = prev;
  }

  const dataLen = filler.length + raw.length;
  const header = buildWavHeader(params, dataLen);
  const out = new Uint8Array(header.length + dataLen);
  out.set(header, 0);
  out.set(filler, header.length);
  out.set(raw, header.length + filler.length);
  return out;
}

function parseJsonMeta(raw: unknown): any {
  if (raw && typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw ?? null;
}

/** Metadata object without the round-lock key (used by terminal writes). */
function withoutLock(m: any): any {
  if (!m || typeof m !== 'object') return {};
  const { round_locked_at: _ignored, ...rest } = m;
  return rest;
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
