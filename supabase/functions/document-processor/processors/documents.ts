import mammoth from 'https://esm.sh/mammoth@1.6.0';
import * as XLSX  from 'https://esm.sh/xlsx@0.18.5';
import JSZIP      from 'https://esm.sh/jszip@3.10.1';
import xml2js     from 'https://esm.sh/xml2js@0.5.0';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.min.js';

import { ENHANCED_PROCESSING_CONFIG } from '../config.ts';
import { EXTRACTION_PROMPTS } from '../prompts.ts';
import { findOverlapLength } from '../utils.ts';
import { callEnhancedGeminiAPI } from '../geminiApi.ts';

// ============================================================================
// PDF (chunked, resumable)
// ============================================================================

export async function extractPdfTextWithPdfjsChunked(
  buffer: Uint8Array,
  options: { startPage?: number; endPage?: number | null; prevText?: string } = {},
) {
  const { startPage = 1, endPage = null, prevText = '' } = options;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';

  const pdf        = await pdfjsLib.getDocument({ data: buffer }).promise;
  const totalPages = pdf.numPages;
  const toPage     = Math.min(
    endPage ?? startPage + ENHANCED_PROCESSING_CONFIG.PDF_PAGES_PER_CHUNK - 1,
    totalPages,
  );

  // Use an array and join once — avoids repeated string concatenation in heap
  const pageTexts: string[] = prevText ? [prevText] : [];

  for (let pageNum = startPage; pageNum <= toPage; pageNum++) {
    try {
      const page        = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const lines: string[] = [`\n--- Page ${pageNum} ---`];

      const items = textContent.items.sort((a: any, b: any) => {
        const yDiff = Math.abs(a.transform[5] - b.transform[5]);
        if (yDiff > 5) return b.transform[5] - a.transform[5];
        return a.transform[4] - b.transform[4];
      });

      let currentY: number | null = null;
      let lineBuffer = '';
      for (const item of items) {
        if ('str' in item && 'transform' in item) {
          const y = Math.round(item.transform[5]);
          if (currentY !== null && Math.abs(currentY - y) > 5) {
            lines.push(lineBuffer);
            lineBuffer = '';
          }
          lineBuffer += item.str + ' ';
          currentY    = y;
        }
      }
      if (lineBuffer) lines.push(lineBuffer);

      pageTexts.push(lines.join('\n'));

      // Release page resources immediately — critical for large PDFs
      page.cleanup();
    } catch (err: any) {
      pageTexts.push(`\n[Error processing page ${pageNum}: ${err?.message ?? String(err)}]`);
    }
  }

  // Cleanup PDF document from memory
  pdf.cleanup();
  pdf.destroy?.();

  const fullText = pageTexts.join('\n');

  // Truncate total extracted text if it exceeds the configured cap
  const cap = ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT;
  const safeTruncated = fullText.length > cap
    ? fullText.slice(0, cap) + '\n\n[CONTENT TRUNCATED: document exceeded memory-safe extraction limit]'
    : fullText;

  return {
    fullText: safeTruncated.trim(),
    lastPageProcessed: toPage,
    isComplete: toPage >= totalPages,
    totalPages,
  };
}

// ============================================================================
// DOCX
// ============================================================================

export async function extractDocxTextEnhanced(buffer: Uint8Array): Promise<string> {
  try {
    const zip         = await JSZIP.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml').async('string');
    const result      = await xml2js.parseStringPromise(documentXml);
    const body        = result['w:document']['w:body'][0];
    let extractedText = '';

    for (const paragraph of (body['w:p'] ?? [])) {
      let paragraphText = '';
      for (const run of (paragraph['w:r'] ?? [])) {
        for (const textNode of (run['w:t'] ?? [])) {
          paragraphText += typeof textNode === 'string' ? textNode : (textNode._ ?? '');
        }
      }
      if (paragraphText.trim()) extractedText += paragraphText + '\n';
    }

    for (const table of (body['w:tbl'] ?? [])) {
      extractedText += '\n[TABLE]\n';
      for (const row of (table['w:tr'] ?? [])) {
        let rowText = '';
        for (const cell of (row['w:tc'] ?? [])) {
          let cellText = '';
          for (const cellPara of (cell['w:p'] ?? [])) {
            for (const cellRun of (cellPara['w:r'] ?? [])) {
              for (const cellTextNode of (cellRun['w:t'] ?? [])) {
                cellText += typeof cellTextNode === 'string' ? cellTextNode : (cellTextNode._ ?? '');
              }
            }
          }
          rowText += cellText + '\t';
        }
        extractedText += rowText.trim() + '\n';
      }
      extractedText += '[/TABLE]\n\n';
    }

    return extractedText;
  } catch {
    // Fallback to mammoth
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }
}

// ============================================================================
// XLSX
// ============================================================================

export function extractXlsxText(buffer: Uint8Array): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    let extractedText = '';

    workbook.SheetNames.forEach((sheetName: string, index: number) => {
      const sheet = workbook.Sheets[sheetName];
      extractedText += `\n--- Sheet ${index + 1}: ${sheetName} ---\n`;

      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (jsonData.length > 0) {
        jsonData.forEach((row, rowIndex) => {
          if (row.some((cell) => cell !== '')) {
            extractedText += `Row ${rowIndex + 1}: ${row.join('\t')}\n`;
          }
        });
      } else {
        extractedText += XLSX.utils.sheet_to_txt(sheet);
      }

      extractedText += '\n';
    });

    return extractedText;
  } catch {
    // Basic fallback
    const workbook = XLSX.read(buffer, { type: 'array' });
    let extractedText = '';
    workbook.SheetNames.forEach((sheetName: string, index: number) => {
      const sheet = workbook.Sheets[sheetName];
      extractedText += `Sheet ${index + 1}: ${sheetName}\n`;
      extractedText += XLSX.utils.sheet_to_txt(sheet) + '\n\n';
    });
    return extractedText;
  }
}

// ============================================================================
// PPTX
// ============================================================================

export async function extractPptxText(buffer: Uint8Array): Promise<string> {
  const zip = await JSZIP.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((f) => f.startsWith('ppt/slides/slide'))
    .sort((a, b) => {
      const aNum = parseInt(a.split('slide')[1].split('.xml')[0], 10);
      const bNum = parseInt(b.split('slide')[1].split('.xml')[0], 10);
      return aNum - bNum;
    });

  let text = '';

  for (const slideFile of slideFiles) {
    const xml    = await zip.file(slideFile).async('string');
    const result = await xml2js.parseStringPromise(xml);
    text += `Slide: ${slideFile.match(/slide(\d+)\.xml/)![1]}\n`;

    const shapes = result['p:sld']?.['p:cSld']?.[0]?.['p:spTree']?.[0]?.['p:sp'] ?? [];
    for (const shape of shapes) {
      const paragraphs = shape['p:txBody']?.[0]?.['a:p'] ?? [];
      for (const paragraph of paragraphs) {
        for (const run of (paragraph['a:r'] ?? [])) {
          text += run['a:t']?.[0] ?? '';
        }
        text += '\n';
      }
      text += '\n';
    }
    text += '\n---\n\n';
  }

  return text.trim();
}

// ============================================================================
// RTF
// ============================================================================

export function processRtfEnhanced(content: string): string {
  return content
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\[a-z]+\d*\s?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// DOCUMENT EXTRACTION WITH CONTINUATION (Gemini-based fallback)
// ============================================================================

/**
 * Extracts content from a document by sending it to Gemini.
 *
 * Continuation strategy:
 *  1. Send the full document (inline) with the extraction prompt.
 *  2. If Gemini returns finishReason = "MAX_TOKENS" we KNOW it was cut off
 *     → immediately continue, passing only the last ~300 chars as context.
 *  3. Loop until:
 *     - finishReason = "STOP"  (Gemini finished naturally)
 *     - Gemini writes [END OF DOCUMENT]
 *     - content cap reached
 *     - MAX_CONTINUATION_ATTEMPTS exhausted
 *
 * This correctly handles small files with dense content (e.g. a 1MB PDF with
 * hundreds of pages of text) where the file fits in memory but the AI output
 * spans many token windows.
 */
export async function processDocumentWithExtractionAndChunking(
  file: any,
  geminiApiKey: string,
): Promise<void> {
  const prompt     = EXTRACTION_PROMPTS[file.type] ?? EXTRACTION_PROMPTS.document;
  const contentCap = ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT;
  const maxContinuations = 20; // allow up to 20 continuation rounds regardless of config

  // ── Round 0: initial extraction ───────────────────────────────────────────
  const initResponse = await callEnhancedGeminiAPI(
    [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: file.mimeType, data: file.data } },
      ],
    }],
    geminiApiKey,
  );

  if (!initResponse.success || !initResponse.content) {
    throw new Error(initResponse.error ?? 'Failed to extract document content');
  }

  let extractedContent = initResponse.content;
  let lastFinishReason = initResponse.finishReason ?? 'STOP';

  // Hard cap check after first response
  if (extractedContent.length >= contentCap) {
    file.content = extractedContent.slice(0, contentCap) +
      '\n\n[CONTENT TRUNCATED: exceeded memory-safe extraction limit]';
    return;
  }

  // ── Continuation loop ─────────────────────────────────────────────────────
  let continuationCount = 0;

  while (continuationCount < maxContinuations) {
    // Determine whether we need to continue:
    //  PRIMARY signal  → finishReason is MAX_TOKENS (Gemini cut itself off)
    //  FALLBACK signal → heuristic checks for documents where finishReason
    //                    may be unreliable (e.g. OpenRouter fallback)
    const hitTokenLimit  = lastFinishReason === 'MAX_TOKENS';
    const seemsIncomplete = (
      extractedContent.endsWith('...') ||
      extractedContent.includes('[TRUNCATED') ||
      // for OpenRouter or unknown providers, fall back to size heuristic
      (lastFinishReason !== 'STOP' &&
       extractedContent.length < file.size * 1.5 &&   // rough chars-per-byte ratio
       extractedContent.length < 10_000 &&
       file.size > 50_000)
    );

    if (!hitTokenLimit && !seemsIncomplete) break; // Gemini said STOP and output looks complete

    continuationCount++;

    // Only send the tail as context — NOT the full accumulated text.
    // This keeps the continuation prompt small and prevents its own OOM.
    const tail = extractedContent.slice(-400);

    const continuationPrompt =
      `${prompt}

CONTINUATION (round ${continuationCount}):
The previous extraction was cut off. It ended with:
"""
${tail}
"""
Continue from EXACTLY where it ended. Do NOT repeat any prior content.
When you reach the true end of the document write: [END OF DOCUMENT]`;

    const contResponse = await callEnhancedGeminiAPI(
      [{
        role: 'user',
        parts: [
          { text: continuationPrompt },
          // Re-send the file so Gemini has full context to continue accurately
          { inlineData: { mimeType: file.mimeType, data: file.data } },
        ],
      }],
      geminiApiKey,
    );

    if (!contResponse.success || !contResponse.content) {
      console.warn(`[extraction] Continuation ${continuationCount} failed: ${contResponse.error}`);
      break;
    }

    const newChunk       = contResponse.content;
    lastFinishReason     = contResponse.finishReason ?? 'STOP';

    // Strip [END OF DOCUMENT] marker before appending
    const reachedEnd     = newChunk.includes('[END OF DOCUMENT]');
    const cleanChunk     = newChunk.replace('[END OF DOCUMENT]', '').trim();

    // Deduplicate overlap at the join boundary
    const overlapLen     = findOverlapLength(extractedContent.slice(-300), cleanChunk.slice(0, 300));
    const chunkToAppend  = overlapLen > 20 ? cleanChunk.slice(overlapLen) : cleanChunk;

    if (chunkToAppend.length < 50 && !reachedEnd) {
      // Nearly empty continuation — Gemini is done even if it didn't say so
      break;
    }

    extractedContent += '\n\n' + chunkToAppend;

    // Hard cap
    if (extractedContent.length >= contentCap) {
      extractedContent = extractedContent.slice(0, contentCap) +
        '\n\n[CONTENT TRUNCATED: exceeded memory-safe extraction limit]';
      break;
    }

    if (reachedEnd || lastFinishReason === 'STOP') break;

    await new Promise((r) => setTimeout(r, ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY));
  }

  file.content = extractedContent;
  file.processing_metadata = {
    ...(file.processing_metadata ?? {}),
    continuationRounds: continuationCount,
    finalFinishReason: lastFinishReason,
    contentLength: extractedContent.length,
  };
}

// ============================================================================
// MULTI-LIBRARY ORCHESTRATOR (PDF, DOCX, XLSX, PPTX, RTF, CSV, HTML)
// ============================================================================

export async function processWithMultipleLibraries(file: any, geminiApiKey: string): Promise<void> {
  // Decode base64 → binary once; free the base64 string as soon as possible
  const buffer = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  let extractedText  = '';
  let processingMethod = 'unknown';

  try {
    switch (file.mimeType) {
      case 'application/pdf': {
        const progress   = file.processing_metadata?.pdf_progress ?? {};
        const startPage  = progress.lastPageProcessed ? progress.lastPageProcessed + 1 : 1;
        // NOTE: We do NOT pass prevText from metadata — that was doubling RAM usage
        // by keeping a full copy of extracted content in both file.content AND metadata.
        // Instead, each chunk is self-contained; the caller concatenates via DB if resuming.

        if (file.pageCount && file.pageCount > ENHANCED_PROCESSING_CONFIG.LARGE_PDF_THRESHOLD) {
          const result = await extractPdfTextWithPdfjsChunked(buffer, { startPage });
          extractedText = result.fullText;
          file.processing_metadata = {
            ...file.processing_metadata,
            pdf_progress: {
              lastPageProcessed: result.lastPageProcessed,
              // ↓ Do NOT store partialText here — save RAM, use file.content instead
              totalPages: result.totalPages,
            },
          };
          if (!result.isComplete) {
            file.processing_status = 'processing';
            file.processing_error  = null;
            file.content = extractedText; // save what we have so far
            return;
          }
          processingMethod = 'pdfjs_chunked';
        } else {
          const result = await extractPdfTextWithPdfjsChunked(buffer, { startPage: 1 });
          extractedText = result.fullText;
          file.processing_metadata = {
            ...file.processing_metadata,
            pdf_progress: {
              lastPageProcessed: result.totalPages,
              totalPages: result.totalPages,
            },
          };
          processingMethod = 'pdfjs_chunked';
        }
        break;
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        try {
          extractedText    = await extractDocxTextEnhanced(buffer);
          processingMethod = 'enhanced_docx';
        } catch {
          try {
            const result  = await mammoth.extractRawText({ arrayBuffer: buffer });
            extractedText  = result.value;
            processingMethod = 'mammoth';
          } catch {
            return processDocumentWithExtractionAndChunking(file, geminiApiKey);
          }
        }
        break;

      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        extractedText    = extractXlsxText(buffer);
        processingMethod = 'xlsx_enhanced';
        break;

      case 'application/vnd.ms-powerpoint':
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        try {
          extractedText    = await extractPptxText(buffer);
          processingMethod = 'pptx_xml';
        } catch {
          return processDocumentWithExtractionAndChunking(file, geminiApiKey);
        }
        break;

      case 'application/rtf':
        extractedText    = processRtfEnhanced(new TextDecoder().decode(buffer));
        processingMethod = 'rtf_parser';
        break;

      default:
        return processDocumentWithExtractionAndChunking(file, geminiApiKey);
    }

    file.content = extractedText;
    file.processing_metadata = {
      ...file.processing_metadata,
      extractionMethod: processingMethod,
      libraryUsed: processingMethod,
      contentLength: file.content.length,
      originalContentLength: extractedText.length,
    };
  } catch {
    return processDocumentWithExtractionAndChunking(file, geminiApiKey);
  }
}