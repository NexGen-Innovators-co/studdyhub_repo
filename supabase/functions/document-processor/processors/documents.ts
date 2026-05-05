import mammoth from 'https://esm.sh/mammoth@1.6.0';
import * as XLSX  from 'https://esm.sh/xlsx@0.18.5';
import JSZIP      from 'https://esm.sh/jszip@3.10.1';
import xml2js     from 'https://esm.sh/xml2js@0.5.0';

import { ENHANCED_PROCESSING_CONFIG } from '../config.ts';

// ============================================================================
// PDF (chunked, resumable) — pdf.js primary, Gemini fallback
// ============================================================================

let _pdfGetDocument: any = null;

async function getPdfGetDocument() {
  if (!_pdfGetDocument) {
    const mod = await import('https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs');
    mod.GlobalWorkerOptions.workerSrc = '';
    _pdfGetDocument = mod.getDocument;
  }
  return _pdfGetDocument;
}

/**
 * Gemini-based PDF text extraction — used as a fallback when pdf.js fails
 * in the Deno Deploy runtime.
 */
async function extractPdfTextWithGemini(
  buffer: Uint8Array,
  options: { startPage?: number; prevText?: string } = {},
): Promise<{ fullText: string; lastPageProcessed: number; isComplete: boolean; totalPages: number }> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY not set — cannot fall back to Gemini for PDF extraction');

  const { prevText = '' } = options;

  // Convert buffer to base64 for the Gemini API
  const base64 = btoa(String.fromCharCode(...buffer));

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

  const prompt = `Extract ALL text content from this PDF document. Preserve the original structure, headings, paragraphs, lists, and formatting as much as possible. Output ONLY the extracted text — no commentary, no summaries, no markdown formatting beyond what exists in the document. If there are code blocks, preserve them. If there are tables, format them readably.`;

  for (const model of models) {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: base64 } },
              { text: prompt },
            ],
          }],
          generationConfig: {
            temperature: 0.05,
            maxOutputTokens: 65536,
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.warn(`[pdf-gemini] ${model} returned ${resp.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.warn(`[pdf-gemini] ${model} returned no text content`);
        continue;
      }

      const combined = prevText ? prevText + '\n\n---GEMINI EXTRACTED---\n\n' + text : text;
      const cap = ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT;
      const safeTruncated = combined.length > cap
        ? combined.slice(0, cap) + '\n\n[CONTENT TRUNCATED]'
        : combined;

      console.log(`[pdf-gemini] ${model} extracted ${text.length} chars`);
      return {
        fullText: safeTruncated.trim(),
        lastPageProcessed: 9999,
        isComplete: true,
        totalPages: 0,
      };
    } catch (err: any) {
      console.warn(`[pdf-gemini] ${model} error: ${err.message}`);
      continue;
    }
  }

  throw new Error('All Gemini models failed for PDF extraction');
}

export async function extractPdfTextWithPdfjsChunked(
  buffer: Uint8Array,
  options: { startPage?: number; endPage?: number | null; prevText?: string } = {},
) {
  // Try pdf.js first
  try {
    return await _extractPdfTextWithPdfjs(buffer, options);
  } catch (err: any) {
    console.warn(`[pdf] pdf.js failed (${err.message}), falling back to Gemini…`);
  }

  // Fallback: Gemini
  return await extractPdfTextWithGemini(buffer, {
    startPage: options.startPage,
    prevText: options.prevText,
  });
}

async function _extractPdfTextWithPdfjs(
  buffer: Uint8Array,
  options: { startPage?: number; endPage?: number | null; prevText?: string } = {},
) {
  const { startPage = 1, endPage = null, prevText = '' } = options;

  const getDocument = await getPdfGetDocument();
  const pdf = await getDocument({ data: buffer }).promise;
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
// ZIP-BASED TEXT EXTRACTION (ODT, ODS, ODP, and other ZIP-containing formats)
// ============================================================================

/**
 * Extracts text from ZIP-based documents by looking for known XML entry paths.
 * Works for ODT (content.xml), ODS, ODP, and similar formats.
 * No LLM dependency — pure local extraction.
 */
export async function extractTextFromZip(buffer: Uint8Array, fileName: string): Promise<string> {
  try {
    const zip = await JSZIP.loadAsync(buffer);
    const texts: string[] = [];

    // OpenDocument formats store content in content.xml
    const contentXml = zip.file('content.xml');
    if (contentXml) {
      const xml = await contentXml.async('string');
      const result = await xml2js.parseStringPromise(xml);
      const extracted = extractTextFromXmlNode(result);
      if (extracted.trim()) texts.push(extracted);
    }

    // Also check for styles.xml metadata
    const stylesXml = zip.file('styles.xml');
    if (stylesXml) {
      try {
        const xml = await stylesXml.async('string');
        const result = await xml2js.parseStringPromise(xml);
        const headerFooter = extractTextFromXmlNode(result);
        if (headerFooter.trim() && headerFooter.length < 5000) {
          texts.unshift(`[Document metadata/styles]\n${headerFooter}`);
        }
      } catch { /* ignore styles errors */ }
    }

    // Fallback: scan all XML files in the ZIP for text content
    if (texts.length === 0) {
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || !path.endsWith('.xml')) continue;
        try {
          const xml = await entry.async('string');
          // Strip all XML tags to get raw text
          const rawText = xml
            .replace(/<[^>]+>/g, ' ')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
          if (rawText.length > 50) texts.push(rawText);
        } catch { /* skip unreadable entries */ }
      }
    }

    if (texts.length === 0) {
      return `[No extractable text found in ZIP-based file: ${fileName}]`;
    }

    const combined = texts.join('\n\n');
    const cap = ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT;
    return combined.length > cap
      ? combined.slice(0, cap) + '\n\n[CONTENT TRUNCATED]'
      : combined;
  } catch {
    return `[Failed to read ZIP-based file: ${fileName}]`;
  }
}

/**
 * Recursively extract text content from a parsed XML node tree.
 */
function extractTextFromXmlNode(node: any): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractTextFromXmlNode).join('');

  let text = '';
  if (node && typeof node === 'object') {
    // Direct text content (xml2js stores text in '_')
    if (node._) text += node._ + ' ';

    for (const key of Object.keys(node)) {
      if (key === '_' || key === '$') continue; // skip text-already-read and attributes
      text += extractTextFromXmlNode(node[key]);

      // Add line breaks after paragraph-level elements
      if (key.includes(':p') || key.includes(':h') || key.includes(':table-row')) {
        text += '\n';
      }
    }
  }
  return text;
}

// ============================================================================
// DOCUMENT EXTRACTION (local-first, no LLM)
// ============================================================================

/**
 * Extracts content from a document using local libraries.
 * Used as the `extract_and_chunk` strategy for ODT/ODS/ODP and similar formats.
 * Falls back to ZIP-based text extraction for unsupported types.
 */
export async function processDocumentWithExtractionAndChunking(
  file: any,
  _geminiApiKey: string,
): Promise<void> {
  const buffer = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  file.data = null; // Free base64 immediately

  const extractedContent = await extractTextFromZip(buffer, file.name);

  const contentCap = ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT;
  file.content = extractedContent.length > contentCap
    ? extractedContent.slice(0, contentCap) + '\n\n[CONTENT TRUNCATED]'
    : extractedContent;
  file.processing_metadata = {
    ...(file.processing_metadata ?? {}),
    extractionMethod: 'local_zip_extract',
    contentLength: file.content.length,
  };
}

// ============================================================================
// MULTI-LIBRARY ORCHESTRATOR (PDF, DOCX, XLSX, PPTX, RTF, CSV, HTML)
// ============================================================================

export async function processWithMultipleLibraries(file: any, _geminiApiKey: string): Promise<void> {
  // Decode base64 → binary once
  const buffer = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  let extractedText  = '';
  let processingMethod = 'unknown';

  try {
    switch (file.mimeType) {
      case 'application/pdf': {
        // Free base64 immediately — we have the buffer, don't need it anymore
        file.data = null;

        // Loop through ALL pages in chunks of PDF_PAGES_PER_CHUNK.
        let currentStart = 1;
        const allTexts: string[] = [];
        let lastPage = 0;
        let totalPages = 0;

        while (true) {
          const result = await extractPdfTextWithPdfjsChunked(buffer, { startPage: currentStart });
          allTexts.push(result.fullText);
          lastPage = result.lastPageProcessed;
          totalPages = result.totalPages;

          if (result.isComplete) break;

          // Content cap: stop extracting if we've already hit the limit
          const currentLen = allTexts.reduce((s, t) => s + t.length, 0);
          if (currentLen >= ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT) break;

          currentStart = result.lastPageProcessed + 1;
        }

        extractedText = allTexts.join('\n');
        file.processing_metadata = {
          ...file.processing_metadata,
          pdf_progress: {
            lastPageProcessed: lastPage,
            totalPages,
          },
        };
        processingMethod = 'pdfjs_chunked';
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
          } catch (e: any) {
            extractedText = `[DOCX extraction failed: ${e?.message ?? 'unknown error'}. File: ${file.name}]`;
            processingMethod = 'failed_local';
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
        } catch (e: any) {
          extractedText = `[PPTX extraction failed: ${e?.message ?? 'unknown error'}. File: ${file.name}]`;
          processingMethod = 'failed_local';
        }
        break;

      case 'application/rtf':
        extractedText    = processRtfEnhanced(new TextDecoder().decode(buffer));
        processingMethod = 'rtf_parser';
        break;

      default:
        // For formats without a local extractor (e.g. ODT), try ZIP-based text extraction
        extractedText = await extractTextFromZip(buffer, file.name);
        processingMethod = extractedText ? 'zip_text_extract' : 'unsupported';
        break;
    }

    // Free base64 string to reclaim memory
    file.data = null;

    file.content = extractedText || `[No extractable text content found in ${file.name}]`;
    file.processing_metadata = {
      ...file.processing_metadata,
      extractionMethod: processingMethod,
      libraryUsed: processingMethod,
      contentLength: file.content.length,
      originalContentLength: extractedText.length,
    };
  } catch (err: any) {
    file.data = null;
    file.content = `[Extraction error for ${file.name}: ${err?.message ?? 'unknown'}]`;
    file.processing_metadata = {
      ...file.processing_metadata,
      extractionMethod: 'error',
      error: err?.message,
    };
  }
}