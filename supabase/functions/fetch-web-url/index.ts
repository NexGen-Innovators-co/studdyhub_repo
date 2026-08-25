/**
 * fetch-web-url/index.ts
 *
 * Turns a pasted link (PDF, image, video, Office file, or webpage) into a processed
 * StuddyHub document.
 *
 * POST body: { userId: string, url: string, title?: string }
 *
 * Behavior:
 * 1. Safety-validates the URL: http/https only, no embedded credentials, no
 *    localhost / private / link-local IPs (SSRF guard, includes DNS resolution),
 *    no known video-platform pages (YouTube etc. need a direct file link).
 * 2. Downloads the content with a redirect cap, timeout and streaming size cap.
 * 3. Sniffs the real content type (Content-Type header + URL extension) and only
 *    accepts types the document-processor pipeline can actually parse (this is
 *    also the safety allowlist — executables, scripts, etc. are rejected).
 * 4. Feeds the bytes through the SAME cloud pipeline as a normal upload:
 *    processBase64File → enhancedBatchProcessing → saveFileToDatabase.
 *
 * Returns the same shape as document-processor: { documents: [...] }.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

import { ENHANCED_FILE_TYPES } from '../document-processor/config.ts';
import {
  processBase64File,
  enhancedBatchProcessing,
} from '../document-processor/processors/pipeline.ts';
import { processHtmlEnhanced } from '../document-processor/processors/text.ts';
import { saveFileToDatabase } from '../document-processor/storage.ts';
import { arrayBufferToBase64, sanitizeFileName } from '../document-processor/utils.ts';

// ============================================================================
// LIMITS
// ============================================================================

// Hard cap on anything we pull into edge-function memory. PDFs up to this size are
// handed to resume-processing via a storage URL; non-PDF binaries above the inline
// threshold can't be chunked by the pipeline, so they are rejected with guidance.
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
// processBase64File skips fetching file_urls above 7MB (marks partial → resume).
// Below that everything is processed inline in one shot, so inline is the reliable
// path for non-PDF binaries (images/videos).
const MAX_INLINE_BYTES = 7 * 1024 * 1024; // 7 MB
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 60_000;

// Known video platforms whose watch pages are HTML, not the video file itself.
const VIDEO_PLATFORM_HOSTS = [
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'vimeo.com', 'player.vimeo.com', 'dailymotion.com', 'tiktok.com',
  'vm.tiktok.com', 'twitch.tv', 'v.qq.com', 'bilibili.com',
];

const CORS = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin',
});

const jsonOk = (body: unknown, origin: string) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...CORS(origin) },
  });

const jsonError = (message: string, status: number, origin: string) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS(origin) },
  });

// ============================================================================
// SAFETY / VALIDATION
// ============================================================================

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  return [
    a === 0,                         // "this" network
    a === 10,                        // RFC1918
    a === 100 && b >= 64 && b <= 127, // CGNAT
    a === 127,                       // loopback
    a === 169 && b === 254,          // link-local (incl. cloud metadata 169.254.169.254)
    a === 172 && b >= 16 && b <= 31, // RFC1918
    a === 192 && b === 168,          // RFC1918
    a === 198 && (b === 18 || b === 19), // benchmarking (RFC 2544)
    a >= 224,                        // multicast + reserved
  ].some(Boolean);
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') || // unique local fc00::/7
    lower.startsWith('fd') ||
    lower.startsWith('fe80') || // link-local
    lower.startsWith('ff')      // multicast
  );
}

async function hostnameResolvesToPrivate(hostname: string): Promise<boolean> {
  try {
    const records = await Deno.resolveDns(hostname, 'A');
    for (const ip of records) {
      if (isPrivateIpv4(ip)) return true;
    }
  } catch {
    // Resolution failure is handled by the fetch itself; don't fail on DNS here.
  }
  try {
    const records = await Deno.resolveDns(hostname, 'AAAA');
    for (const ip of records) {
      if (isPrivateIpv6(ip)) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/** Validates the URL for safety. Returns an error message or null if OK. */
async function validateUrl(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'That link is not a valid URL.';
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'Only http:// and https:// links are supported.';
  }

  // Credentials in the URL are almost always malicious phishing patterns.
  if (url.username || url.password) {
    return 'Links with embedded usernames or passwords are not allowed.';
  }

  const host = url.hostname.toLowerCase();
  if (!host) return 'That link has no host.';

  // Direct private-IP / loopback literals.
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') {
    return 'Links to local or private addresses are not allowed.';
  }
  if (host.startsWith('[')) {
    // IPv6 literal inside brackets
    const ipv6 = host.replace(/[\[\]]/g, '');
    if (isPrivateIpv6(ipv6)) return 'Links to local or private addresses are not allowed.';
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIpv4(host)) return 'Links to local or private addresses are not allowed.';
  } else if (await hostnameResolvesToPrivate(host)) {
    return 'This link resolves to a private or internal address and was blocked.';
  }

  // Video-platform watch pages are HTML wrappers, not the media file. The user
  // needs to paste a direct link to a downloadable file instead.
  if (VIDEO_PLATFORM_HOSTS.includes(host)) {
    const path = url.pathname.toLowerCase();
    const ext = path.split('.').pop() || '';
    const mediaExt = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'ogg'].includes(ext);
    if (!mediaExt) {
      return 'That looks like a video platform page, not a direct media file. Paste a direct link (ending in .mp4, .webm, etc.) instead.';
    }
  }

  return null;
}

// ============================================================================
// CONTENT TYPE DETECTION
// ============================================================================

/** Resolves a MIME that document-processor's ENHANCED_FILE_TYPES recognises. */
function mimeTypeForContent(fileName: string, contentType: string | null): string | null {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    rtf: 'application/rtf',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
    csv: 'text/csv',
    md: 'text/markdown',
    markdown: 'text/markdown',
    html: 'text/html',
    htm: 'text/html',
    json: 'application/json',
    xml: 'text/xml',
    txt: 'text/plain',
    log: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    heic: 'image/heic',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/mov',
    mkv: 'video/mkv',
    avi: 'video/avi',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/m4a',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  };

  // A recognised file extension takes precedence over the header — some CDNs
  // serve PDFs/images as application/octet-stream or text/plain.
  const byExtMime = byExt[ext];
  if (byExtMime && ENHANCED_FILE_TYPES[byExtMime]) return byExtMime;

  // Fall back to the server-provided Content-Type.
  if (contentType) {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    if (mime && ENHANCED_FILE_TYPES[mime]) return mime;
    // text/html pages are processable via the pipeline's enhanced_structured strategy.
    if (mime === 'text/html' || mime === 'application/xhtml+xml') return 'text/html';
    // Unknown binary — refuse rather than guess.
    return null;
  }

  return null;
}

// ============================================================================
// DOWNLOAD
// ============================================================================

interface DownloadResult {
  bytes: Uint8Array;
  finalUrl: string;
  contentType: string | null;
  contentDisposition: string | null;
}

async function downloadWithChecks(url: string): Promise<DownloadResult> {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validationError = await validateUrl(currentUrl);
    if (validationError) throw new HttpError(400, validationError);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let resp: Response;
    try {
      resp = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StuddyHub-DocumentImporter/1.0)',
          'Accept': '*/*',
        },
      });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') throw new HttpError(408, 'The link took too long to respond. Please try again.');
      throw new HttpError(502, `Could not reach that link (${err?.message ?? 'network error'}).`);
    }
    clearTimeout(timeout);

    // Follow redirects manually so every hop is re-validated for safety.
    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      const location = resp.headers.get('location');
      await resp.body?.cancel();
      if (!location) throw new HttpError(400, 'The link redirected to an invalid location.');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!resp.ok) {
      await resp.body?.cancel();
      throw new HttpError(400, `The link is not accessible (HTTP ${resp.status}).`);
    }

    const contentType = resp.headers.get('content-type');
    const contentDisposition = resp.headers.get('content-disposition');
    const finalUrl = resp.url || currentUrl;

    // Stream with a hard cap so a rogue endpoint can't OOM the function.
    const reader = resp.body?.getReader();
    if (!reader) {
      throw new HttpError(502, 'The link returned no downloadable content.');
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_DOWNLOAD_BYTES) {
        await reader.cancel();
        throw new HttpError(413, `That file is larger than the ${Math.round(MAX_DOWNLOAD_BYTES / 1024 / 1024)}MB URL-import limit. Download it and upload the file directly instead.`);
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { bytes, finalUrl, contentType, contentDisposition };
  }

  throw new HttpError(400, 'Too many redirects. The link could not be fetched.');
}

// ============================================================================
// HELPERS
// ============================================================================

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// String.prototype.substringAfterLastDot shim (avoids a global prototype patch).
function fileNameFromUrlAndHeaders(url: string, contentDisposition: string | null): string {
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (match?.[1]) return sanitizeFileName(match[1].trim());
  }
  try {
    const path = new URL(url).pathname;
    const segment = decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
    if (segment && segment.includes('.')) return sanitizeFileName(segment);
    if (segment) return sanitizeFileName(segment) + '.html';
  } catch { /* fall through */ }
  return 'web_document.pdf';
}

// ============================================================================
// MAIN
// ============================================================================

serve(async (req) => {
  const origin = req.headers.get('origin') ?? '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS(origin) });
  }

  const startTime = Date.now();

  try {
    if (!req.headers.get('content-type')?.includes('application/json')) {
      return jsonError('Unsupported Content-Type. Please send application/json.', 400, origin);
    }

    const requestData = await req.json();
    const userId = requestData.userId;
    const url = requestData.url;
    const customTitle = typeof requestData.title === 'string' ? requestData.title.trim() : '';

    if (!userId) {
      return jsonError('Missing required parameter: userId', 400, origin);
    }
    if (!url || typeof url !== 'string' || !url.trim()) {
      return jsonError('Missing required parameter: url', 400, origin);
    }

    // ── 1. Validate + download ─────────────────────────────────────────────
    const downloaded = await downloadWithChecks(url.trim());

    // ── 2. Determine file name + MIME ──────────────────────────────────────
    const fileName = fileNameFromUrlAndHeaders(downloaded.finalUrl, downloaded.contentDisposition);
    const mimeType = mimeTypeForContent(fileName, downloaded.contentType);

    if (!mimeType) {
      throw new HttpError(
        415,
        `That link points to an unsupported or unsafe file type${downloaded.contentType ? ` (${downloaded.contentType.split(';')[0].trim()})` : ''}. We accept PDFs, Office documents, images, audio, video and web pages.`,
      );
    }

    // ── 3. Size routing ────────────────────────────────────────────────────
    // Non-PDF binaries can't be chunk-resumed by the pipeline, so they must fit
    // the inline path to be processed reliably. HTML pages are extracted to
    // readable text instead of being sent through binary processing, so they are
    // exempt from the inline cap (subject only to the download cap).
    const isPdf = mimeType === 'application/pdf';
    const isHtml = mimeType === 'text/html';
    if (!isHtml && !isPdf && downloaded.bytes.byteLength > MAX_INLINE_BYTES) {
      throw new HttpError(
        413,
        `That ${mimeType.split('/')[0]} is larger than the ${Math.round(MAX_INLINE_BYTES / 1024 / 1024)}MB inline limit for URL imports. Download it and upload the file directly instead.`,
      );
    }

    // Webpages: strip to readable text cloud-side (cheerio) so the saved document
    // is clean study text rather than raw HTML markup.
    let preExtractedHtml: string | undefined;
    let pageTitle: string | undefined;
    if (isHtml) {
      const rawHtml = new TextDecoder().decode(downloaded.bytes);
      preExtractedHtml = (await processHtmlEnhanced(rawHtml)).trim();
      if (!preExtractedHtml) {
        preExtractedHtml = rawHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      const cap = 2 * 1024 * 1024; // keep the DB column + client sane
      if (preExtractedHtml.length > cap) {
        preExtractedHtml = preExtractedHtml.slice(0, cap) + '\n\n[CONTENT TRUNCATED]';
      }
      const titleMatch = preExtractedHtml.match(/^TITLE:\s*(.+)$/m);
      if (titleMatch?.[1]) pageTitle = titleMatch[1].trim();
    }

    // ── 4. Build the file payload for the shared pipeline ──────────────────
    const fileData: any = {
      name: fileName,
      mimeType,
      size: downloaded.bytes.byteLength,
      ...(preExtractedHtml ? { content: preExtractedHtml } : {}),
    };

    if (isHtml || downloaded.bytes.byteLength <= MAX_INLINE_BYTES) {
      // Small file (or a webpage): inline base64 → processed fully in one call.
      fileData.data = arrayBufferToBase64(downloaded.bytes.buffer);
    } else {
      // Large PDF: upload to Storage and hand over a URL so the pipeline marks
      // it partial and resume-processing continues it chunk-by-chunk.
      const storageClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const safeName = sanitizeFileName(fileName);
      const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await storageClient.storage
        .from('documents')
        .upload(path, downloaded.bytes, { contentType: mimeType, upsert: false });
      if (uploadError) {
        throw new HttpError(500, `Failed to stage the downloaded file: ${uploadError.message}`);
      }
      const { data: publicUrlData } = storageClient.storage.from('documents').getPublicUrl(path);
      fileData.file_url = publicUrlData?.publicUrl;
    }

    // ── 5. Run through the exact same cloud pipeline as a normal upload ─────
    const processed = await processBase64File(fileData);
    if (!processed) {
      throw new HttpError(415, `That file type (${mimeType}) is not supported by the document parser.`);
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY environment variable is not configured.');

    await enhancedBatchProcessing([processed], geminiApiKey, userId);

    const savedId = await saveFileToDatabase(processed, userId);
    if (savedId) {
      processed.id = savedId;
    } else {
      throw new HttpError(500, 'The document could not be saved. Please try again.');
    }

    const doc = {
      id: processed.id,
      title: customTitle || pageTitle || processed.name,
      file_name: processed.name,
      file_url: processed.file_url ?? null,
      file_type: processed.mimeType,
      file_size: processed.size,
      content_extracted: processed.content,
      type: processed.type,
      processing_status: processed.processing_status,
      processing_error: processed.processing_error ?? null,
      processing_metadata: processed.processing_metadata ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: userId,
      source_url: url.trim(),
    };

    return jsonOk({
      message: 'Link fetched, verified and processed.',
      processingTime: Date.now() - startTime,
      filesProcessedCount: 1,
      sourceUrl: url.trim(),
      documents: [doc],
      partialDocuments:
        processed.processing_status === 'partial' && doc.id
          ? [{ documentId: doc.id, fileName: processed.name, message: 'Partial extraction saved. POST {userId, documentId} to /resume-processing to continue.' }]
          : [],
    }, origin);
  } catch (error: any) {
    // Log server-side faults (not user-facing validation errors).
    if (!(error instanceof HttpError)) {
      try {
        const logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await logSystemError(logClient, {
          severity: 'error',
          source: 'fetch-web-url',
          message: error?.message ?? String(error),
          details: { stack: error?.stack },
        });
      } catch (logErr) {
        console.error('[fetch-web-url] Error logging failed:', logErr);
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError
      ? error.message
      : (error?.message ?? 'Internal Server Error');
    return jsonError(message, status, origin);
  }
});
