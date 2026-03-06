import { ENHANCED_PROCESSING_CONFIG } from './config.ts';

// ============================================================================
// BASE64
// ============================================================================

/** Optimized base64 conversion with chunking for large files */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// ============================================================================
// CHUNKING
// ============================================================================

const BREAK_PATTERNS: Record<string, RegExp[]> = {
  text:     [/\n\n\n+/, /\n\n/, /\.\s+/, /!\s+/, /\?\s+/],
  pdf:      [/\n\n\n+/, /\n\n/, /\.\s+/, /Page \d+/, /Chapter \d+/],
  document: [/\n\n\n+/, /\n\n/, /\.\s+/, /^#+ /, /^\d+\./],
  csv:      [/\n(?=\d+,)/, /\n(?=[A-Za-z]+,)/, /\n/],
  json:     [/\},\s*\{/, /\],\s*\[/, /\n\s*\{/, /\n\s*\[/],
  markdown: [/\n#{1,6} /, /\n\n/, /\.\s+/],
  html:     [/<\/div>/, /<\/section>/, /<\/p>/, /<\/h[1-6]>/],
  code:     [/\n\n/, /\n\/\//, /\n\/\*/, /\n#/, /\nfunction/, /\nclass/],
};

/** Intelligent text chunking that preserves context and completeness */
export function createIntelligentChunks(
  content: string,
  fileType: string,
  maxChunkSize = ENHANCED_PROCESSING_CONFIG.INTELLIGENT_CHUNK_SIZE,
): string[] {
  if (content.length <= maxChunkSize) return [content];

  const chunks: string[] = [];
  const overlap = ENHANCED_PROCESSING_CONFIG.CHUNK_OVERLAP;
  const patterns = BREAK_PATTERNS[fileType] ?? BREAK_PATTERNS.text;

  let currentPos = 0;

  while (currentPos < content.length) {
    let chunkEnd = Math.min(currentPos + maxChunkSize, content.length);

    if (chunkEnd < content.length) {
      let bestBreak = chunkEnd;
      for (const pattern of patterns) {
        const searchStart = Math.max(
          currentPos + maxChunkSize * 0.7,
          currentPos + ENHANCED_PROCESSING_CONFIG.MIN_CHUNK_SIZE,
        );
        const searchText = content.slice(searchStart, chunkEnd + 200);
        const match = searchText.search(pattern);
        if (match !== -1) {
          bestBreak = searchStart + match + (searchText.match(pattern)?.[0].length ?? 0);
          break;
        }
      }
      chunkEnd = bestBreak;
    }

    const chunkStart = currentPos === 0 ? 0 : Math.max(currentPos - overlap, 0);
    const chunk = content.slice(chunkStart, chunkEnd);

    const chunkInfo    = currentPos === 0 ? '' : '[CONTINUATION FROM PREVIOUS CHUNK]\n\n';
    const chunkEndInfo = chunkEnd < content.length ? '\n\n[CONTINUES IN NEXT CHUNK]' : '';

    chunks.push(chunkInfo + chunk + chunkEndInfo);
    currentPos = chunkEnd;
  }

  return chunks;
}

// ============================================================================
// MERGING
// ============================================================================

/** Find overlap length between two text segments */
export function findOverlapLength(text1: string, text2: string): number {
  let maxOverlap = 0;
  const maxSearch = Math.min(text1.length, text2.length, 300);
  for (let i = 20; i <= maxSearch; i++) {
    if (text1.slice(-i) === text2.slice(0, i)) maxOverlap = i;
  }
  return maxOverlap;
}

/** Intelligent merging of processed chunks to create coherent final content */
export function mergeProcessedChunks(chunks: string[]): string {
  if (chunks.length === 1) return chunks[0];

  let mergedContent = '';

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i]
      .replace(/^\[CONTINUATION FROM PREVIOUS CHUNK\]\s*\n\n/, '')
      .replace(/\n\n\[CONTINUES IN NEXT CHUNK\]\s*$/, '');

    if (i > 0 && mergedContent.length > 0) {
      const overlapLength = findOverlapLength(mergedContent.slice(-500), chunk.slice(0, 500));
      if (overlapLength > 50) chunk = chunk.slice(overlapLength);
      if (!mergedContent.endsWith('\n\n') && !chunk.startsWith('\n')) mergedContent += '\n\n';
    }

    mergedContent += chunk;
  }

  return mergedContent;
}

// ============================================================================
// MISC
// ============================================================================

/** Sanitize filenames for storage keys */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 128);
}