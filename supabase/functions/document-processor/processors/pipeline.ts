import { ENHANCED_FILE_TYPES, ENHANCED_PROCESSING_CONFIG, TEXT_MIME_TYPES } from '../config.ts';
import { arrayBufferToBase64 } from '../utils.ts';
import { processTextFileWithChunking, processStructuredFileWithChunking } from './text.ts';
import {
  processWithMultipleLibraries,
  processDocumentWithExtractionAndChunking,
} from './documents.ts';
import {
  processImageWithVision,
  processAudioWithTranscription,
  processVideoWithFrameAnalysis,
  processArchiveWithMetadata,
} from './media.ts';

// ============================================================================
// VALIDATION
// ============================================================================

export function validateFile(
  file: any,
  fileType: string,
): { valid: boolean; error?: string; warnings?: string[] } {
  const config = ENHANCED_FILE_TYPES[file.mimeType];
  if (!config) return { valid: false, error: `Unsupported file type: ${fileType}` };

  if (file.size > config.maxSize) {
    return {
      valid: false,
      error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds limit for ${fileType} files (${Math.round(config.maxSize / 1024 / 1024)}MB)`,
    };
  }

  const warnings: string[] = [];
  if (file.size > config.maxSize * 0.7) warnings.push('Large file may take longer to process');

  return { valid: true, warnings };
}

// ============================================================================
// SINGLE FILE PROCESSING
// ============================================================================

export async function enhancedFileProcessing(file: any, geminiApiKey: string): Promise<void> {
  const fileConfig = ENHANCED_FILE_TYPES[file.mimeType];
  if (!fileConfig) {
    file.processing_status = 'failed';
    file.processing_error  = `Unsupported file type: ${file.mimeType}`;
    return;
  }

  const startTime = Date.now();

  try {
    file.processing_status     = 'processing';
    file.processing_started_at = new Date().toISOString();
    file.extraction_model_used = fileConfig.strategy === 'vision_analysis' || fileConfig.strategy === 'transcription' || fileConfig.strategy === 'frame_analysis'
      ? 'gemini-2.0-flash'
      : 'local';

    switch (fileConfig.strategy) {
      case 'chunk_text':            await processTextFileWithChunking(file, geminiApiKey);            break;
      case 'enhanced_structured':   await processStructuredFileWithChunking(file, geminiApiKey);      break;
      case 'extract_and_chunk':     await processDocumentWithExtractionAndChunking(file, geminiApiKey); break;
      case 'enhanced_local_extract': await processWithMultipleLibraries(file, geminiApiKey);           break;
      case 'vision_analysis':       await processImageWithVision(file, geminiApiKey);                 break;
      case 'transcription':         await processAudioWithTranscription(file, geminiApiKey);          break;
      case 'frame_analysis':        await processVideoWithFrameAnalysis(file, geminiApiKey);          break;
      case 'metadata_only':         processArchiveWithMetadata(file);                                 break;
      default:
        throw new Error(`Unknown processing strategy: ${fileConfig.strategy}`);
    }

    // If chunked processing set status to 'processing', leave it alone
    if (file.processing_status !== 'processing') file.processing_status = 'completed';

    file.processing_completed_at  = new Date().toISOString();
    file.total_processing_time_ms = Date.now() - startTime;
    file.processing_metadata = {
      ...(file.processing_metadata ?? {}),
      chunkCount:    Array.isArray(file.chunks) ? file.chunks.length : 0,
      geminiApiCalls: 1,
      contentLength: file.content?.length ?? 0,
    };
  } catch (error: any) {
    file.processing_status        = 'failed';
    file.processing_error         = `Processing error: ${error.message}`;
    file.processing_completed_at  = new Date().toISOString();
    file.total_processing_time_ms = Date.now() - startTime;
  }
}

// ============================================================================
// FILE SIZE TIER
// ============================================================================

export type FileTier = 'small' | 'medium' | 'large';

export function getFileTier(file: any): FileTier {
  const b64len = file.data?.length ?? 0;
  if (b64len <= ENHANCED_PROCESSING_CONFIG.TIER_SMALL_MAX)  return 'small';
  if (b64len <= ENHANCED_PROCESSING_CONFIG.TIER_MEDIUM_MAX) return 'medium';
  return 'large';
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export async function enhancedBatchProcessing(
  files: any[],
  geminiApiKey: string,
  _userId: string,
): Promise<void> {
  const filesToProcess = files.filter(
    (f) => f.processing_status === 'pending' && ENHANCED_FILE_TYPES[f.mimeType],
  );

  if (filesToProcess.length === 0) return;

  // Sort by priority then size — process smallest + highest priority first
  filesToProcess.sort((a, b) => {
    const aP = ENHANCED_FILE_TYPES[a.mimeType].priority;
    const bP = ENHANCED_FILE_TYPES[b.mimeType].priority;
    return aP !== bP ? aP - bP : a.size - b.size;
  });

  // MIME types whose content can be fully extracted by local libraries.
  // Window-slicing base64 of ZIP-based binary formats (DOCX, XLSX, PPTX)
  // produces invalid data that Gemini cannot parse — always use local extraction.
  const LOCAL_EXTRACT_MIMES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/rtf',
  ]);

  // Sequential — one file at a time to avoid memory spikes
  for (const file of filesToProcess) {
    const tier = getFileTier(file);

    if (LOCAL_EXTRACT_MIMES.has(file.mimeType)) {
      // ── Structured Office formats: always local extraction ────────────────
      // Binary window-slicing corrupts ZIP-based formats; local libs handle any size.
      await enhancedFileProcessing(file, geminiApiKey);

    } else if (tier === 'small') {
      // ── Normal full processing ────────────────────────────────────────────
      await enhancedFileProcessing(file, geminiApiKey);

    } else if (tier === 'medium') {
      // ── Chunked: process first window, mark partial, queue rest ──────────
      await processLargeFileTiered(file, geminiApiKey, false);

    } else {
      // ── Very large: first window only, flag for external resume ──────────
      await processLargeFileTiered(file, geminiApiKey, true);
    }

    // Free base64 immediately after processing regardless of tier
    file.data = null;

    await new Promise((r) => setTimeout(r, ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY));
  }
}

// ============================================================================
// LARGE FILE TIERED PROCESSOR
// ============================================================================

/**
 * Processes a large file in safe-sized windows — PDF only.
 *
 * Non-PDF binary formats (DOCX, XLSX, PPTX) are routed through local
 * library extraction in enhancedBatchProcessing regardless of size,
 * so this function only handles PDFs via page-chunked extraction.
 *
 * @param firstWindowOnly  When true (LARGE tier), stop after one chunk
 *                         and let the client call /resume-processing.
 */
async function processLargeFileTiered(
  file: any,
  _geminiApiKey: string,
  firstWindowOnly: boolean,
): Promise<void> {
  const startTime = Date.now();
  file.processing_started_at = new Date().toISOString();
  file.extraction_model_used = 'local_pdfjs';

  const b64         = file.data as string;
  const totalB64Len = b64.length;
  const fileSizeMB  = Math.round((totalB64Len / 1024 / 1024) * 10) / 10;

  console.log(
    `[large-file] ${file.name} is ${fileSizeMB}MB base64, firstWindowOnly=${firstWindowOnly}`,
  );

  const allExtracted: string[] = [];
  let windowsProcessed = 0;
  let isComplete = false;

  if (file.mimeType === 'application/pdf') {
    // Decode the entire buffer once (PDF.js needs the whole file)
    // but process only PDF_PAGES_PER_CHUNK pages at a time
    let buffer: Uint8Array | null = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    // Free base64 now that we have the buffer
    file.data = null;
    const { extractPdfTextWithPdfjsChunked } = await import('./documents.ts');

    const resumeCursor = file.processing_metadata?.resume_cursor;
    let startPage = resumeCursor?.lastPage ? resumeCursor.lastPage + 1 : 1;

    while (true) {
      const result = await extractPdfTextWithPdfjsChunked(buffer, { startPage });
      allExtracted.push(result.fullText);
      windowsProcessed++;
      startPage = result.lastPageProcessed + 1;

      if (result.isComplete) { isComplete = true; break; }

      // After one chunk in firstWindowOnly mode — stop and queue rest
      if (firstWindowOnly && windowsProcessed === 1) {
        file.processing_metadata = {
          ...(file.processing_metadata ?? {}),
          resume_cursor: {
            type: 'pdf_pages',
            lastPage: result.lastPageProcessed,
            totalPages: result.totalPages,
            windowsProcessed,
          },
        };
        break;
      }

      // Safety: stop if we've already hit the content cap
      const currentLen = allExtracted.reduce((s, c) => s + c.length, 0);
      if (currentLen >= ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT) {
        isComplete = false;
        file.processing_metadata = {
          ...(file.processing_metadata ?? {}),
          resume_cursor: {
            type: 'pdf_pages',
            lastPage: result.lastPageProcessed,
            totalPages: result.totalPages,
            windowsProcessed,
          },
        };
        break;
      }
    }

    // Explicitly release the buffer
    buffer = null;

  } else {
    // Non-PDF large files: decode to buffer and use local extraction.
    // This handles text-based large files that somehow bypass the local extract set.
    const { extractTextFromZip } = await import('./documents.ts');
    const buffer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    file.data = null;

    const text = await extractTextFromZip(buffer, file.name);
    allExtracted.push(text);
    windowsProcessed = 1;
    isComplete = true;
  }

  // ── Assemble result ────────────────────────────────────────────────────────
  const cap = ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT;
  let combined = allExtracted.join('\n\n');
  if (combined.length > cap) {
    combined = combined.slice(0, cap) + '\n\n[CONTENT CAP REACHED]';
    isComplete = false;
  }

  file.content              = combined;
  file.processing_status    = isComplete ? 'completed' : 'partial';
  file.processing_error     = isComplete
    ? null
    : `Partial extraction: ${windowsProcessed} chunk(s) processed. ` +
      `Call /resume-processing with document_id to continue.`;
  file.processing_completed_at  = new Date().toISOString();
  file.total_processing_time_ms = Date.now() - startTime;
  file.processing_metadata = {
    ...(file.processing_metadata ?? {}),
    fileSizeMB,
    windowsProcessed,
    isComplete,
    contentLength: combined.length,
  };
}

// ============================================================================
// FILE INTAKE HELPERS
// ============================================================================

/** Build a processed file object from a multipart File */
export async function processFile(file: any): Promise<any | null> {
  const mimeType  = file.type;
  const fileConfig = ENHANCED_FILE_TYPES[mimeType];
  if (!fileConfig) return null;

  const validation = validateFile(file, fileConfig.type);
  if (!validation.valid) {
    return makeFailedFile(file.name, fileConfig.type, mimeType, file.size, validation.error!);
  }

  try {
    if (TEXT_MIME_TYPES.includes(fileConfig.type)) {
      const textContent = await file.text();
      return {
        name: file.name, type: fileConfig.type, mimeType,
        content: textContent, data: btoa(textContent), size: file.size,
        processing_status: 'completed', ...nullTimings(),
      };
    } else {
      const base64Data = arrayBufferToBase64(await file.arrayBuffer());
      return {
        name: file.name, type: fileConfig.type, mimeType,
        data: base64Data, content: `[File: ${file.name} - ${file.size} bytes. Processing ${fileConfig.type} content...]`,
        size: file.size, processing_status: 'pending', ...nullTimings(),
      };
    }
  } catch (error: any) {
    return makeFailedFile(file.name, fileConfig.type, mimeType, file.size, `Error processing file: ${error.message}`);
  }
}

/** Build a processed file object from a JSON payload */
export async function processBase64File(fileData: any): Promise<any | null> {
  if (!fileData.name || !fileData.mimeType) return null;

  // For files with a URL that are large, skip fetching into memory entirely.
  // Create a partial record so resume-processing handles extraction in smaller chunks.
  // This avoids OOM: a 14MB file becomes ~18MB base64 + ~14MB decoded buffer + pdf.js overhead.
  const SKIP_FETCH_THRESHOLD = 7 * 1024 * 1024; // 7MB binary
  if (fileData.file_url && typeof fileData.file_url === 'string') {
    if (fileData.size > SKIP_FETCH_THRESHOLD) {
      const fileConfig = ENHANCED_FILE_TYPES[fileData.mimeType];
      if (fileConfig) {
        console.log(`[intake] Skipping fetch for large file ${fileData.name} (${Math.round(fileData.size / 1024 / 1024)}MB) — will use resume-processing`);
        return {
          name: fileData.name,
          type: fileConfig.type,
          mimeType: fileData.mimeType,
          data: null,
          content: `[Large file pending extraction: ${fileData.name} (${Math.round(fileData.size / 1024 / 1024)}MB)]`,
          size: fileData.size,
          processing_status: 'partial',
          file_url: fileData.file_url,
          ...(fileData.idToUpdate ? { id: fileData.idToUpdate } : {}),
          processing_metadata: {
            resume_cursor: fileData.mimeType === 'application/pdf'
              ? { type: 'pdf_pages', lastPage: 0, totalPages: null, windowsProcessed: 0 }
              : null,
            needsResumeProcessing: true,
            fileSizeMB: Math.round((fileData.size / 1024 / 1024) * 10) / 10,
          },
          ...nullTimings(),
        };
      }
    }

    // Small-to-medium file with URL — fetch into memory for in-process extraction
    try {
      const controller = new AbortController();
      const to         = setTimeout(() => controller.abort(), 120_000);
      const resp       = await fetch(fileData.file_url, { signal: controller.signal });
      clearTimeout(to);

      if (resp.ok) {
        const ab      = await resp.arrayBuffer();
        const bytes   = new Uint8Array(ab);
        let binary    = '';
        const chunk   = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
        }
        fileData.data = btoa(binary);
        fileData.size = ab.byteLength;
      } else {
        return makeFailedFile(fileData.name, 'unknown', fileData.mimeType, 0,
          `Failed to fetch file_url: ${resp.status} ${resp.statusText}`);
      }
    } catch (err) {
      return makeFailedFile(fileData.name, 'unknown', fileData.mimeType, 0, `Error fetching file_url: ${String(err)}`);
    }
  }

  const fileConfig = ENHANCED_FILE_TYPES[fileData.mimeType];
  if (!fileConfig) return null;

  const validation = validateFile(fileData, fileConfig.type);
  if (!validation.valid) {
    return { ...makeFailedFile(fileData.name, fileConfig.type, fileData.mimeType, fileData.size ?? 0, validation.error!), data: fileData.data };
  }

  let decodedContent = fileData.content;
  if (TEXT_MIME_TYPES.includes(fileConfig.type) && fileData.data && !decodedContent) {
    try { decodedContent = atob(fileData.data); } catch { /* ignore */ }
  }

  return {
    name: fileData.name,
    type: fileConfig.type,
    mimeType: fileData.mimeType,
    data: fileData.data ?? (decodedContent ? btoa(decodedContent) : null),
    content: decodedContent ?? `[File: ${fileData.name}. Processing ${fileConfig.type} content...]`,
    size: fileData.size ?? (decodedContent ? decodedContent.length : 0),
    processing_status: fileData.processing_status ?? (TEXT_MIME_TYPES.includes(fileConfig.type) ? 'completed' : 'pending'),
    ...(fileData.idToUpdate ? { id: fileData.idToUpdate } : {}),
    file_url: fileData.file_url ?? null,
    ...nullTimings(),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function nullTimings() {
  return {
    processing_error: null,
    processing_started_at: null,
    processing_completed_at: null,
    extraction_model_used: null,
    total_processing_time_ms: null,
    processing_metadata: null,
  };
}

function makeFailedFile(name: string, type: string, mimeType: string, size: number, error: string): any {
  return {
    name, type, mimeType, data: null, content: null, size,
    processing_status: 'failed', processing_error: error,
    processing_started_at: null, processing_completed_at: null,
    extraction_model_used: null, total_processing_time_ms: null,
    processing_metadata: null,
  };
}