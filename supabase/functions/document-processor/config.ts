// ============================================================================
// PROCESSING CONFIGURATION
// ============================================================================

export const ENHANCED_PROCESSING_CONFIG = {
  MAX_INPUT_TOKENS: 1 * 1024 * 1024,
  MAX_OUTPUT_TOKENS: 8192,
  CHUNK_OVERLAP: 200,

  INTELLIGENT_CHUNK_SIZE: 512 * 1024,
  MIN_CHUNK_SIZE: 50 * 1024,

  BATCH_SIZE: 1,
  RETRY_ATTEMPTS: 2,
  RATE_LIMIT_DELAY: 1000,

  MAX_CONTINUATION_ATTEMPTS: 2,
  CONTINUATION_DELAY: 2000,

  MAX_TOTAL_CONTEXT: 1 * 1024 * 1024,
  MAX_SINGLE_FILE_CONTENT: 2 * 1024 * 1024,

  MAX_CONVERSATION_HISTORY: 50,
  CONTEXT_MEMORY_WINDOW: 30,
  SUMMARY_THRESHOLD: 20,
  CONTEXT_RELEVANCE_SCORE: 0.7,

  PDF_PAGES_PER_CHUNK: 5,
  LARGE_PDF_THRESHOLD: 30,

  // ── Tiered memory thresholds (base64 string size) ─────────────────────────
  // SMALL  : full in-memory processing
  // MEDIUM : process first window, save partial, auto-queue continuation
  // LARGE  : first window only, flag for resume via separate call
  TIER_SMALL_MAX:  10 * 1024 * 1024,  // ≤ 10 MB  → full processing
  TIER_MEDIUM_MAX: 40 * 1024 * 1024,  // ≤ 40 MB  → chunked + partial save
  // anything above TIER_MEDIUM_MAX → first chunk + resume flag

  // How many base64 chars to process per window for medium/large files
  // ~7.5MB base64 ≈ ~5.6MB binary — safe to decode and process at once
  LARGE_FILE_WINDOW: 7.5 * 1024 * 1024,

  // Legacy alias kept for backwards compat
  MAX_BASE64_IN_MEMORY: 10 * 1024 * 1024,
};

// ============================================================================
// FILE TYPE MAPPINGS
// ============================================================================

export const ENHANCED_FILE_TYPES: Record<string, { type: string; strategy: string; priority: number; maxSize: number }> = {
  // Images
  'image/jpeg':    { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/jpg':     { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/png':     { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/gif':     { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/webp':    { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/bmp':     { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/svg+xml': { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 10 * 1024 * 1024 },
  'image/tiff':    { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/tif':     { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/ico':     { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize:  5 * 1024 * 1024 },
  'image/heic':    { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },
  'image/heif':    { type: 'image', strategy: 'vision_analysis',        priority: 1, maxSize: 20 * 1024 * 1024 },

  // Documents
  'application/pdf': { type: 'pdf', strategy: 'enhanced_local_extract', priority: 2, maxSize: 200 * 1024 * 1024 },
  'application/msword':                                                              { type: 'document',     strategy: 'enhanced_local_extract', priority: 2, maxSize: 100 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':        { type: 'document',     strategy: 'enhanced_local_extract', priority: 2, maxSize: 100 * 1024 * 1024 },
  'application/vnd.ms-excel':                                                        { type: 'spreadsheet',  strategy: 'enhanced_local_extract', priority: 2, maxSize:  50 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':              { type: 'spreadsheet',  strategy: 'enhanced_local_extract', priority: 2, maxSize:  50 * 1024 * 1024 },
  'application/vnd.ms-powerpoint':                                                  { type: 'presentation', strategy: 'enhanced_local_extract', priority: 2, maxSize: 100 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':      { type: 'presentation', strategy: 'enhanced_local_extract', priority: 2, maxSize: 100 * 1024 * 1024 },
  'application/rtf':                                                                 { type: 'document',     strategy: 'enhanced_local_extract', priority: 2, maxSize:  50 * 1024 * 1024 },
  'application/vnd.oasis.opendocument.text':         { type: 'document',     strategy: 'extract_and_chunk', priority: 2, maxSize: 50 * 1024 * 1024 },
  'application/vnd.oasis.opendocument.spreadsheet':  { type: 'spreadsheet',  strategy: 'extract_and_chunk', priority: 2, maxSize: 50 * 1024 * 1024 },
  'application/vnd.oasis.opendocument.presentation': { type: 'presentation', strategy: 'extract_and_chunk', priority: 2, maxSize: 50 * 1024 * 1024 },

  // Text / Code
  'text/plain':       { type: 'text',     strategy: 'chunk_text',         priority: 1, maxSize: 50 * 1024 * 1024 },
  'text/csv':         { type: 'csv',      strategy: 'enhanced_structured', priority: 1, maxSize: 50 * 1024 * 1024 },
  'text/markdown':    { type: 'markdown', strategy: 'chunk_text',         priority: 1, maxSize: 20 * 1024 * 1024 },
  'text/html':        { type: 'html',     strategy: 'enhanced_structured', priority: 1, maxSize: 20 * 1024 * 1024 },
  'text/xml':         { type: 'xml',      strategy: 'chunk_text',         priority: 1, maxSize: 20 * 1024 * 1024 },
  'application/json': { type: 'json',     strategy: 'enhanced_structured', priority: 1, maxSize: 20 * 1024 * 1024 },
  'application/xml':  { type: 'xml',      strategy: 'chunk_text',         priority: 1, maxSize: 20 * 1024 * 1024 },
  'text/javascript':        { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'application/javascript': { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/typescript':        { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'application/typescript': { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/css':      { type: 'code', strategy: 'chunk_text', priority: 1, maxSize:  5 * 1024 * 1024 },
  'text/x-python': { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-java':   { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-c':      { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-cpp':    { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-csharp': { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-php':    { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-ruby':   { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-go':     { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-rust':   { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },
  'text/x-sql':    { type: 'code', strategy: 'chunk_text', priority: 1, maxSize: 10 * 1024 * 1024 },

  // Archives
  'application/zip':              { type: 'archive', strategy: 'metadata_only', priority: 5, maxSize: 100 * 1024 * 1024 },
  'application/x-rar-compressed': { type: 'archive', strategy: 'metadata_only', priority: 5, maxSize: 100 * 1024 * 1024 },
  'application/x-7z-compressed':  { type: 'archive', strategy: 'metadata_only', priority: 5, maxSize: 100 * 1024 * 1024 },
  'application/x-tar':            { type: 'archive', strategy: 'metadata_only', priority: 5, maxSize: 100 * 1024 * 1024 },
  'application/gzip':             { type: 'archive', strategy: 'metadata_only', priority: 5, maxSize: 100 * 1024 * 1024 },

  // Audio
  'audio/mpeg':  { type: 'audio', strategy: 'transcription', priority: 3, maxSize: 200 * 1024 * 1024 },
  'audio/wav':   { type: 'audio', strategy: 'transcription', priority: 3, maxSize: 200 * 1024 * 1024 },
  'audio/ogg':   { type: 'audio', strategy: 'transcription', priority: 3, maxSize: 200 * 1024 * 1024 },
  'audio/m4a':   { type: 'audio', strategy: 'transcription', priority: 3, maxSize: 200 * 1024 * 1024 },
  'audio/webm':  { type: 'audio', strategy: 'transcription', priority: 3, maxSize: 200 * 1024 * 1024 },
  'audio/flac':  { type: 'audio', strategy: 'transcription', priority: 3, maxSize: 200 * 1024 * 1024 },
  'audio/x-m4a': { type: 'audio', strategy: 'transcription', priority: 3, maxSize: 200 * 1024 * 1024 },

  // Video
  'video/mp4':  { type: 'video', strategy: 'frame_analysis', priority: 4, maxSize: 500 * 1024 * 1024 },
  'video/avi':  { type: 'video', strategy: 'frame_analysis', priority: 4, maxSize: 500 * 1024 * 1024 },
  'video/mov':  { type: 'video', strategy: 'frame_analysis', priority: 4, maxSize: 500 * 1024 * 1024 },
  'video/wmv':  { type: 'video', strategy: 'frame_analysis', priority: 4, maxSize: 500 * 1024 * 1024 },
  'video/webm': { type: 'video', strategy: 'frame_analysis', priority: 4, maxSize: 500 * 1024 * 1024 },
  'video/mkv':  { type: 'video', strategy: 'frame_analysis', priority: 4, maxSize: 500 * 1024 * 1024 },
};

// MIME types treated as plain text (decoded directly, no AI needed initially)
export const TEXT_MIME_TYPES = ['text', 'code', 'csv', 'markdown', 'html', 'xml', 'json'];