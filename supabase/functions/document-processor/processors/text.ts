import Papa from 'https://esm.sh/papaparse@5.4.1';
import cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';

import { ENHANCED_PROCESSING_CONFIG } from '../config.ts';

// ============================================================================
// TEXT / CODE FILES
// ============================================================================

export async function processTextFileWithChunking(file: any, _geminiApiKey: string): Promise<void> {
  const decodedContent = atob(file.data ?? '');
  const cap            = ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT;

  // Hard cap on raw content to prevent OOM on huge text files
  const safeContent = decodedContent.length > cap
    ? decodedContent.slice(0, cap) + '\n\n[CONTENT TRUNCATED: file exceeded memory-safe limit]'
    : decodedContent;

  // Text/code content is already extracted — no LLM needed.
  if (file.type === 'code') {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'unknown';
    file.content = `[${ext.toUpperCase()} Code File: ${file.name}]\n\`\`\`${ext}\n${safeContent}\n\`\`\``;
  } else {
    file.content = safeContent;
  }
}

// ============================================================================
// CSV
// ============================================================================

export async function processCsvEnhanced(content: string): Promise<string> {
  try {
    const results = Papa.parse(content, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      transform: (v: any) => (typeof v === 'string' ? v.trim() : v),
    });

    let structuredText = `[CSV DATA - ${results.data.length} rows]\n\n`;

    if (results.meta.fields?.length) {
      structuredText += 'HEADERS: ' + results.meta.fields.join(' | ') + '\n\n';
    }

    results.data.forEach((row: any, i: number) => {
      structuredText += `Row ${i + 1}:\n`;
      for (const [key, value] of Object.entries(row)) {
        if (value !== null && value !== undefined && value !== '') {
          structuredText += `  ${key}: ${value}\n`;
        }
      }
      structuredText += '\n';
    });

    return structuredText;
  } catch {
    return content;
  }
}

// ============================================================================
// HTML
// ============================================================================

export async function processHtmlEnhanced(content: string): Promise<string> {
  try {
    const $ = cheerio.load(content);
    $('script, style, noscript').remove();

    let extractedText = '';

    const title = $('title').text().trim();
    if (title) extractedText += `TITLE: ${title}\n\n`;

    const description = $('meta[name="description"]').attr('content');
    if (description) extractedText += `DESCRIPTION: ${description}\n\n`;

    const body = $('body').length > 0 ? $('body') : $.root();
    body.find('*').each((_: any, element: any) => {
      const tag  = element.tagName;
      const $el  = $(element);
      const text = $el.text().trim();

      if (text && !$el.children().length) {
        switch (tag) {
          case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
            extractedText += `\n${tag.toUpperCase()}: ${text}\n`;
            break;
          case 'p':
            extractedText += `${text}\n\n`;
            break;
          case 'li':
            extractedText += `• ${text}\n`;
            break;
          case 'td': case 'th':
            extractedText += `${text}\t`;
            break;
          default:
            if (text.length > 10) extractedText += `${text} `;
        }
      }
    });

    return extractedText.trim();
  } catch {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

// ============================================================================
// STRUCTURED FILE ORCHESTRATOR (CSV / HTML / JSON)
// ============================================================================

export async function processStructuredFileWithChunking(file: any, _geminiApiKey: string): Promise<void> {
  const decodedContent = atob(file.data ?? '');
  const cap = ENHANCED_PROCESSING_CONFIG.MAX_SINGLE_FILE_CONTENT;

  if (file.type === 'csv') {
    // PapaParse handles CSV locally — no LLM needed regardless of size
    const parsed = await processCsvEnhanced(
      decodedContent.length > cap ? decodedContent.slice(0, cap) : decodedContent,
    );
    file.content = parsed;

  } else if (file.type === 'html') {
    file.content = await processHtmlEnhanced(decodedContent);

  } else if (file.type === 'json') {
    try {
      const prettyJson = JSON.stringify(JSON.parse(decodedContent), null, 2);
      file.content = prettyJson.length > cap
        ? `[JSON Structure]\n${prettyJson.slice(0, cap)}\n\n[CONTENT TRUNCATED]`
        : `[JSON Structure]\n${prettyJson}`;
    } catch {
      // Invalid JSON – save as plain text
      file.content = decodedContent.length > cap
        ? decodedContent.slice(0, cap) + '\n\n[CONTENT TRUNCATED]'
        : decodedContent;
    }
  }
}