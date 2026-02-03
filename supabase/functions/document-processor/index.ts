import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import mammoth from 'https://esm.sh/mammoth@1.6.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import JSZIP from 'https://esm.sh/jszip@3.10.1';
import xml2js from 'https://esm.sh/xml2js@0.5.0';
import Papa from 'https://esm.sh/papaparse@5.4.1';
import cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.min.js';

// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// ============================================================================
// STEP 1: UPDATE PROCESSING CONFIGURATION
// ============================================================================

const ENHANCED_PROCESSING_CONFIG = {
  // Gemini 2.0 Flash specifications - INCREASED OUTPUT TOKENS
  MAX_INPUT_TOKENS: 2 * 1024 * 1024,
  MAX_OUTPUT_TOKENS: 65536, // Increased from 8192 to maximum for Gemini 2.0
  CHUNK_OVERLAP: 500,
  
  // Enhanced chunking strategy
  INTELLIGENT_CHUNK_SIZE: 1.8 * 1024 * 1024,
  MIN_CHUNK_SIZE: 100 * 1024,
  
  // Processing priorities
  BATCH_SIZE: 3,
  RETRY_ATTEMPTS: 3,
  RATE_LIMIT_DELAY: 1000,
  
  // Continuation extraction settings
  MAX_CONTINUATION_ATTEMPTS: 5, // Increased from 3
  CONTINUATION_DELAY: 2500, // Delay between continuation attempts
  
  // Content management
  MAX_TOTAL_CONTEXT: 4 * 1024 * 1024,
  MAX_SINGLE_FILE_CONTENT: Infinity,
  
  // Context Memory Configuration
  MAX_CONVERSATION_HISTORY: 50,
  CONTEXT_MEMORY_WINDOW: 30,
  SUMMARY_THRESHOLD: 20,
  CONTEXT_RELEVANCE_SCORE: 0.7,
  
  // PDF-specific settings
  PDF_PAGES_PER_CHUNK: 50, // For page-by-page processing
  LARGE_PDF_THRESHOLD: 100 // Pages threshold for chunked processing
};
// Enhanced file type mappings with processing strategies
const ENHANCED_FILE_TYPES = {
  // Images - highest priority for visual processing
  'image/jpeg': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/jpg': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/png': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/gif': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/webp': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/bmp': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/svg+xml': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'image/tiff': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/tif': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/ico': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 5 * 1024 * 1024
  },
  'image/heic': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'image/heif': {
    type: 'image',
    strategy: 'vision_analysis',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  // Documents - structured processing with extraction and chunking
  'application/pdf': {
    type: 'pdf',
    strategy: 'enhanced_local_extract',
    priority: 2,
    maxSize: 200 * 1024 * 1024
  },
  'application/msword': {
    type: 'document',
    strategy: 'enhanced_local_extract',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    type: 'document',
    strategy: 'enhanced_local_extract',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.ms-excel': {
    type: 'spreadsheet',
    strategy: 'enhanced_local_extract',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    type: 'spreadsheet',
    strategy: 'enhanced_local_extract',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.ms-powerpoint': {
    type: 'presentation',
    strategy: 'enhanced_local_extract',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    type: 'presentation',
    strategy: 'enhanced_local_extract',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/rtf': {
    type: 'document',
    strategy: 'enhanced_local_extract',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.oasis.opendocument.text': {
    type: 'document',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.oasis.opendocument.spreadsheet': {
    type: 'spreadsheet',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.oasis.opendocument.presentation': {
    type: 'presentation',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  // Text files - direct processing with intelligent chunking
  'text/plain': {
    type: 'text',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 50 * 1024 * 1024
  },
  'text/csv': {
    type: 'csv',
    strategy: 'enhanced_structured',
    priority: 1,
    maxSize: 50 * 1024 * 1024
  },
  'text/markdown': {
    type: 'markdown',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'text/html': {
    type: 'html',
    strategy: 'enhanced_structured',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'text/xml': {
    type: 'xml',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'application/json': {
    type: 'json',
    strategy: 'enhanced_structured',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  'application/xml': {
    type: 'xml',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 20 * 1024 * 1024
  },
  // Code files - syntax-aware processing
  'text/javascript': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'application/javascript': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/typescript': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'application/typescript': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/css': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 5 * 1024 * 1024
  },
  'text/x-python': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-java': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-c': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-cpp': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-csharp': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-php': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-ruby': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-go': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-rust': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  'text/x-sql': {
    type: 'code',
    strategy: 'chunk_text',
    priority: 1,
    maxSize: 10 * 1024 * 1024
  },
  // Archives (for metadata extraction)
  'application/zip': {
    type: 'archive',
    strategy: 'metadata_only',
    priority: 5,
    maxSize: 100 * 1024 * 1024
  },
  'application/x-rar-compressed': {
    type: 'archive',
    strategy: 'metadata_only',
    priority: 5,
    maxSize: 100 * 1024 * 1024
  },
  'application/x-7z-compressed': {
    type: 'archive',
    strategy: 'metadata_only',
    priority: 5,
    maxSize: 100 * 1024 * 1024
  },
  'application/x-tar': {
    type: 'archive',
    strategy: 'metadata_only',
    priority: 5,
    maxSize: 100 * 1024 * 1024
  },
  'application/gzip': {
    type: 'archive',
    strategy: 'metadata_only',
    priority: 5,
    maxSize: 100 * 1024 * 1024
  },
  // Audio (for transcription)
  'audio/mpeg': {
    type: 'audio',
    strategy: 'transcription',
    priority: 3,
    maxSize: 200 * 1024 * 1024
  },
  'audio/wav': {
    type: 'audio',
    strategy: 'transcription',
    priority: 3,
    maxSize: 200 * 1024 * 1024
  },
  'audio/ogg': {
    type: 'audio',
    strategy: 'transcription',
    priority: 3,
    maxSize: 200 * 1024 * 1024
  },
  'audio/m4a': {
    type: 'audio',
    strategy: 'transcription',
    priority: 3,
    maxSize: 200 * 1024 * 1024
  },
  'audio/webm': {
    type: 'audio',
    strategy: 'transcription',
    priority: 3,
    maxSize: 200 * 1024 * 1024
  },
  'audio/flac': {
    type: 'audio',
    strategy: 'transcription',
    priority: 3,
    maxSize: 200 * 1024 * 1024
  },
  'audio/x-m4a': {
    type: 'audio',
    strategy: 'transcription',
    priority: 3,
    maxSize: 200 * 1024 * 1024
  },
  // Video (for frame analysis)
  'video/mp4': {
    type: 'video',
    strategy: 'frame_analysis',
    priority: 4,
    maxSize: 500 * 1024 * 1024
  },
  'video/avi': {
    type: 'video',
    strategy: 'frame_analysis',
    priority: 4,
    maxSize: 500 * 1024 * 1024
  },
  'video/mov': {
    type: 'video',
    strategy: 'frame_analysis',
    priority: 4,
    maxSize: 500 * 1024 * 1024
  },
  'video/wmv': {
    type: 'video',
    strategy: 'frame_analysis',
    priority: 4,
    maxSize: 500 * 1024 * 1024
  },
  'video/webm': {
    type: 'video',
    strategy: 'frame_analysis',
    priority: 4,
    maxSize: 500 * 1024 * 1024
  },
  'video/mkv': {
    type: 'video',
    strategy: 'frame_analysis',
    priority: 4,
    maxSize: 500 * 1024 * 1024
  }
};
// Enhanced extraction prompts for complete content extraction
const EXTRACTION_PROMPTS = {
  text: `Extract and preserve ALL text content from this document with complete fidelity:

REQUIREMENTS:
1. Extract every single character, word, and line
2. Preserve all formatting indicators (spacing, line breaks, special characters)
3. Maintain document structure and hierarchy
4. Include all metadata, headers, footers, and annotations
5. Preserve table structures and list formatting
6. Extract text from any embedded elements

QUALITY STANDARDS:
- Zero truncation - extract complete content
- Maintain readability and logical flow
- Preserve technical terms and specialized vocabulary
- Include all numbers, dates, and statistical data
- Capture all references, citations, and footnotes

OUTPUT FORMAT:
Provide the complete extracted text in a clean, structured format that preserves the original document's organization and meaning.`,
  pdf: `Perform comprehensive PDF content extraction with maximum fidelity:

EXTRACTION SCOPE:
1. ALL textual content from every page
2. Complete table data with proper structure
3. All headings, subheadings, and body text
4. Footnotes, references, and citations
5. Figure captions and annotations
6. Header and footer information
7. Text within images or charts (OCR)
8. Mathematical formulas and equations
9. Bullet points, numbered lists, and indentation
10. Special characters and symbols

STRUCTURAL PRESERVATION:
- Maintain page organization and flow
- Preserve hierarchical document structure
- Keep table formatting and data relationships
- Retain list structures and numbering
- Preserve paragraph breaks and sections

QUALITY ASSURANCE:
- Extract 100% of readable content
- Maintain technical accuracy
- Preserve document context and meaning
- Include all data points and statistics`,
  document: `Execute complete document content extraction:

COMPREHENSIVE EXTRACTION:
1. Every paragraph, sentence, and word
2. All formatting that affects meaning
3. Complete table contents and structures
4. All lists, bullets, and numbering
5. Headers, footers, and page elements
6. Comments, tracked changes, and annotations
7. Embedded objects and their text content
8. All metadata and document properties

CONTENT FIDELITY:
- Zero content loss or truncation
- Preserve technical terminology
- Maintain data accuracy and relationships
- Include all numerical data and statistics
- Preserve legal or formal language precision`,
  spreadsheet: `Extract complete spreadsheet data with full fidelity:

DATA EXTRACTION:
1. All cell contents across all sheets
2. Complete formulas and calculated values
3. All headers and column/row labels
4. Data validation rules and formats
5. Comments and cell annotations
6. Charts and graph data
7. Pivot table information
8. All worksheets and their relationships

STRUCTURE PRESERVATION:
- Maintain data relationships and dependencies
- Preserve calculation logic and formulas
- Keep data types and formatting context
- Maintain sheet organization and naming
- Preserve data validation and constraints`,
  presentation: `Extract comprehensive content from this presentation:

SLIDE CONTENT:
1. All slide titles and text content
2. Bullet points and lists
3. Speaker notes if accessible
4. Slide sequence and organization

VISUAL ELEMENTS:
- Charts, graphs, and their data
- Images and diagrams with descriptions
- Layout and design context

STRUCTURE:
- Presentation flow and logic
- Key themes and messages
- Conclusion and takeaways

Maintain the narrative flow of the presentation.`,
  image: `Analyze this image with comprehensive detail extraction:

VISUAL ANALYSIS:
1. Extract ALL visible text (printed, handwritten, signage)
2. Identify and describe all objects, people, and scenes
3. Analyze charts, graphs, and their complete data
4. Describe document layouts and structures
5. Extract mathematical equations and formulas
6. Identify all colors, styles, and formatting
7. Analyze spatial relationships and layouts
8. Describe technical diagrams and schematics

TEXT EXTRACTION:
- OCR all readable text with high accuracy
- Preserve text positioning and formatting
- Extract text in multiple languages
- Include partial or degraded text with notes
- Maintain text hierarchy and organization

CONTEXTUAL UNDERSTANDING:
- Interpret document purpose and type
- Analyze data patterns and trends
- Provide meaningful insights and relationships
- Explain technical content and diagrams`,
  audio: `Perform comprehensive audio transcription and analysis:

TRANSCRIPTION REQUIREMENTS:
1. Complete verbatim transcription of all speech
2. Include all speakers with identification
3. Preserve filler words and natural speech patterns
4. Note timestamps for key segments
5. Include background sounds and context
6. Transcribe multiple languages if present
7. Handle overlapping speech and interruptions
8. Maintain conversation flow and context

QUALITY STANDARDS:
- Maximum accuracy for all spoken content
- Preserve speaker intentions and meaning
- Include emotional context and tone
- Note technical terms and specialized vocabulary
- Maintain chronological flow of conversation

ANALYSIS OUTPUT:
- Complete transcript with speaker identification
- Summary of key topics and themes
- Metadata about audio quality and characteristics
- Technical analysis of speech patterns if relevant`,
  code: `Analyze this code file with complete preservation:

CODE ANALYSIS:
1. Extract all source code with exact formatting
2. Preserve indentation and code structure
3. Include all comments and documentation
4. Maintain syntax highlighting context
5. Extract embedded documentation
6. Preserve import/export statements
7. Include all variable and function definitions

STRUCTURAL PRESERVATION:
- Maintain file organization and hierarchy
- Preserve code blocks and functions
- Keep syntax and formatting intact
- Include all metadata and headers`,
  archive: `Analyze this archive file and extract available metadata:

METADATA EXTRACTION:
1. Archive type and compression method
2. File structure and directory listings
3. Individual file information if accessible
4. Compression ratios and technical details
5. Creation dates and modification times

Note: This is an archive file. Extract any readable metadata, file structure information, or accessible text content. Describe what type of archive this is and what it might contain.`,
  video: `Analyze this video file for available content:

VIDEO ANALYSIS:
1. Extract any available metadata
2. Analyze accessible frames or thumbnails
3. Describe video format and technical specifications
4. Extract any embedded text or captions
5. Identify visual content if frames are available

Note: This is a video file. Analyze any extractable frames or metadata. Describe the video format and any available information. Note: Full video analysis would require specialized video processing.`
};
// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);
/**
 * Optimized base64 conversion with chunking for large files
 */ function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768;
  for(let i = 0; i < bytes.length; i += chunkSize){
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
/**
 * Enhanced intelligent text chunking that preserves context and completeness
 */ function createIntelligentChunks(content, fileType, maxChunkSize = ENHANCED_PROCESSING_CONFIG.INTELLIGENT_CHUNK_SIZE) {
  if (content.length <= maxChunkSize) {
    return [
      content
    ];
  }
  const chunks = [];
  const overlap = ENHANCED_PROCESSING_CONFIG.CHUNK_OVERLAP;
  // Define natural break points based on file type
  const breakPatterns = {
    text: [
      /\n\n\n+/,
      /\n\n/,
      /\.\s+/,
      /\!\s+/,
      /\?\s+/
    ],
    pdf: [
      /\n\n\n+/,
      /\n\n/,
      /\.\s+/,
      /Page \d+/,
      /Chapter \d+/
    ],
    document: [
      /\n\n\n+/,
      /\n\n/,
      /\.\s+/,
      /^#+ /,
      /^\d+\./
    ],
    csv: [
      /\n(?=\d+,)/,
      /\n(?=[A-Za-z]+,)/,
      /\n/
    ],
    json: [
      /\},\s*\{/,
      /\],\s*\[/,
      /\n\s*\{/,
      /\n\s*\[/
    ],
    markdown: [
      /\n#{1,6} /,
      /\n\n/,
      /\.\s+/
    ],
    html: [
      /<\/div>/,
      /<\/section>/,
      /<\/p>/,
      /<\/h[1-6]>/
    ],
    code: [
      /\n\n/,
      /\n\/\//,
      /\n\/\*/,
      /\n#/,
      /\nfunction/,
      /\nclass/
    ]
  };
  const patterns = breakPatterns[fileType] || breakPatterns.text;
  let currentPos = 0;
  while(currentPos < content.length){
    let chunkEnd = Math.min(currentPos + maxChunkSize, content.length);
    // Find the best break point within the chunk
    if (chunkEnd < content.length) {
      let bestBreak = chunkEnd;
      // Try each pattern in order of preference
      for (const pattern of patterns){
        const searchStart = Math.max(currentPos + maxChunkSize * 0.7, currentPos + ENHANCED_PROCESSING_CONFIG.MIN_CHUNK_SIZE);
        const searchText = content.slice(searchStart, chunkEnd + 200);
        const match = searchText.search(pattern);
        if (match !== -1) {
          bestBreak = searchStart + match + searchText.match(pattern)[0].length;
          break;
        }
      }
      chunkEnd = bestBreak;
    }
    // Extract chunk with overlap from previous chunk (except for first chunk)
    const chunkStart = currentPos === 0 ? 0 : Math.max(currentPos - overlap, 0);
    const chunk = content.slice(chunkStart, chunkEnd);
    // Add chunk metadata for context preservation
    const chunkInfo = currentPos === 0 ? '' : `[CONTINUATION FROM PREVIOUS CHUNK]\n\n`;
    const chunkEndInfo = chunkEnd < content.length ? `\n\n[CONTINUES IN NEXT CHUNK]` : '';
    chunks.push(chunkInfo + chunk + chunkEndInfo);
    currentPos = chunkEnd;
  }
  // console.log(`Created ${chunks.length} intelligent chunks for ${fileType} content (${content.length} chars)`);
  return chunks;
}
/**
 * Find overlap length between two text segments
 */ function findOverlapLength(text1, text2) {
  let maxOverlap = 0;
  const maxSearch = Math.min(text1.length, text2.length, 300);
  for(let i = 20; i <= maxSearch; i++){
    const suffix = text1.slice(-i);
    const prefix = text2.slice(0, i);
    if (suffix === prefix) {
      maxOverlap = i;
    }
  }
  return maxOverlap;
}
/**
 * Intelligent merging of processed chunks to create coherent final content
 */ function mergeProcessedChunks(chunks) {
  if (chunks.length === 1) return chunks[0];
  let mergedContent = '';
  for(let i = 0; i < chunks.length; i++){
    let chunk = chunks[i];
    // Remove chunk metadata markers
    chunk = chunk.replace(/^\[CONTINUATION FROM PREVIOUS CHUNK\]\s*\n\n/, '').replace(/\n\n\[CONTINUES IN NEXT CHUNK\]\s*$/, '');
    // Handle overlaps between chunks
    if (i > 0 && mergedContent.length > 0) {
      // Find potential overlap
      const prevEnd = mergedContent.slice(-500);
      const currentStart = chunk.slice(0, 500);
      // Simple overlap detection and removal
      const overlapLength = findOverlapLength(prevEnd, currentStart);
      if (overlapLength > 50) {
        chunk = chunk.slice(overlapLength);
      }
      // Add appropriate separator
      if (!mergedContent.endsWith('\n\n') && !chunk.startsWith('\n')) {
        mergedContent += '\n\n';
      }
    }
    mergedContent += chunk;
  }
  return mergedContent;
}
/**
 * Enhanced Gemini API caller with better error handling and retries
 */ async function callEnhancedGeminiAPI(contents, geminiApiKey) {
  const apiUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
  apiUrl.searchParams.append('key', geminiApiKey);
  const requestBody = {
    contents,
    generationConfig: {
      temperature: 0.05,
      maxOutputTokens: ENHANCED_PROCESSING_CONFIG.MAX_OUTPUT_TOKENS,
      topK: 20,
      topP: 0.8
    }
  };
  for(let attempt = 0; attempt < ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS; attempt++){
    try {
      const response = await fetch(apiUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      if (response.ok) {
        const data = await response.json();
        const extractedContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (extractedContent) {
          return {
            success: true,
            content: extractedContent
          };
        } else {
          return {
            success: false,
            error: 'No content returned from Gemini'
          };
        }
      } else {
        const errorText = await response.text();
        if (response.status === 429 && attempt < ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS - 1) {
          const delay = Math.pow(2, attempt) * ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY + Math.random() * 1000;
          // console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise((resolve)=>setTimeout(resolve, delay));
          continue;
        }
        return {
          success: false,
          error: `API error ${response.status}: ${errorText}`
        };
      }
    } catch (error) {
      if (attempt === ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS - 1) {
        return {
          success: false,
          error: `Network error: ${error.message}`
        };
      }
      await new Promise((resolve)=>setTimeout(resolve, (attempt + 1) * 1000));
    }
  }
  return {
    success: false,
    error: 'Max retries exceeded'
  };
}
/**
 * Process chunks with Gemini API and merge results intelligently
 */ async function processChunkedContent(chunks, prompt, geminiApiKey) {
  const processedChunks = [];
  for(let i = 0; i < chunks.length; i++){
    const chunk = chunks[i];
    const chunkPrompt = `${prompt}

CHUNK PROCESSING INSTRUCTIONS:
- This is chunk ${i + 1} of ${chunks.length} total chunks
- Extract ALL content from this chunk with complete fidelity
- Maintain continuity with previous chunks if applicable
- Preserve all formatting, structure, and meaning
${i === 0 ? '- This is the first chunk of the document' : '- Continue from previous chunk context'}
${i === chunks.length - 1 ? '- This is the final chunk of the document' : '- More chunks will follow'}

CHUNK CONTENT:
${chunk}`;
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: chunkPrompt
          }
        ]
      }
    ];
    try {
      const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
      if (response.success && response.content) {
        processedChunks.push(response.content);
        // Rate limiting between chunks
        if (i < chunks.length - 1) {
          await new Promise((resolve)=>setTimeout(resolve, ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY));
        }
      } else {
        // console.error(`Failed to process chunk ${i + 1}:`, response.error);
        processedChunks.push(`[ERROR PROCESSING CHUNK ${i + 1}: ${response.error}]`);
      }
    } catch (error) {
      // console.error(`Error processing chunk ${i + 1}:`, error);
      processedChunks.push(`[ERROR PROCESSING CHUNK ${i + 1}: ${error.message}]`);
    }
  }
  // Merge processed chunks intelligently
  return mergeProcessedChunks(processedChunks);
}
/**
 * Enhanced PDF processing with PDF.js for complete text extraction
 */async function extractPdfTextWithPdfjs(buffer: Uint8Array) {
  try {
    // FIX: Use CDN worker URL directly instead of fetching and creating blob
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';

    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    const totalPages = pdf.numPages;
    
    // console.log(`Processing PDF with ${totalPages} pages using PDF.js`);

    if (totalPages > 500) {
      // console.warn(`Very large PDF (${totalPages} pages). Processing may be slow.`);
    }

    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        let pageText = `\n--- Page ${pageNum} ---\n`;

        // Sort items by position to maintain reading order
        const items = textContent.items.sort((a: any, b: any) => {
          const yDiff = Math.abs(a.transform[5] - b.transform[5]);
          if (yDiff > 5) {
            return b.transform[5] - a.transform[5]; // Higher Y first
          }
          return a.transform[4] - b.transform[4]; // Left to right
        });

        let currentY: number | null = null;
        for (const item of items) {
          if ('str' in item && 'transform' in item) {
            const y = Math.round(item.transform[5]);
            if (currentY !== null && Math.abs(currentY - y) > 5) {
              pageText += '\n';
            }
            pageText += item.str + ' ';
            currentY = y;
          }
        }

        fullText += pageText + '\n';
        page.cleanup();
      } catch (pageError: any) {
        // console.error(`Error processing page ${pageNum}:`, pageError);
        fullText += `\n[Error processing page ${pageNum}: ${pageError?.message || String(pageError)}]\n`;
      }
    }

    pdf.cleanup();
    return fullText.trim();
  } catch (error: any) {
    // console.error('PDF.js extraction failed:', error);
    throw new Error(`PDF.js extraction failed: ${error?.message || String(error)}`);
  }
}
/**
 * Enhanced DOCX processing with better structure preservation
 */ async function extractDocxTextEnhanced(buffer) {
  try {
    const zip = await JSZIP.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml').async('string');
    // Parse XML structure
    const result = await xml2js.parseStringPromise(documentXml);
    const body = result['w:document']['w:body'][0];
    let extractedText = '';
    // Process paragraphs and preserve structure
    if (body['w:p']) {
      for (const paragraph of body['w:p']){
        let paragraphText = '';
        // Extract text runs
        if (paragraph['w:r']) {
          for (const run of paragraph['w:r']){
            if (run['w:t']) {
              for (const textNode of run['w:t']){
                if (typeof textNode === 'string') {
                  paragraphText += textNode;
                } else if (textNode._) {
                  paragraphText += textNode._;
                }
              }
            }
          }
        }
        if (paragraphText.trim()) {
          extractedText += paragraphText + '\n';
        }
      }
    }
    // Process tables
    if (body['w:tbl']) {
      for (const table of body['w:tbl']){
        extractedText += '\n[TABLE]\n';
        if (table['w:tr']) {
          for (const row of table['w:tr']){
            let rowText = '';
            if (row['w:tc']) {
              for (const cell of row['w:tc']){
                let cellText = '';
                if (cell['w:p']) {
                  for (const cellPara of cell['w:p']){
                    if (cellPara['w:r']) {
                      for (const cellRun of cellPara['w:r']){
                        if (cellRun['w:t']) {
                          for (const cellTextNode of cellRun['w:t']){
                            if (typeof cellTextNode === 'string') {
                              cellText += cellTextNode;
                            } else if (cellTextNode._) {
                              cellText += cellTextNode._;
                            }
                          }
                        }
                      }
                    }
                  }
                }
                rowText += cellText + '\t';
              }
            }
            extractedText += rowText.trim() + '\n';
          }
        }
        extractedText += '[/TABLE]\n\n';
      }
    }
    return extractedText;
  } catch (error) {
    // console.error('Enhanced DOCX extraction failed:', error);
    // Fallback to mammoth
    const result = await mammoth.extractRawText({
      arrayBuffer: buffer
    });
    return result.value;
  }
}
/**
 * Enhanced CSV processing with structure preservation
 */ async function processCsvEnhanced(content) {
  try {
    const results = Papa.parse(content, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header)=>header.trim(),
      transform: (value, field)=>{
        if (typeof value === 'string') {
          return value.trim();
        }
        return value;
      }
    });
    if (results.errors.length > 0) {
      // console.warn('CSV parsing warnings:', results.errors);
    }
    let structuredText = `[CSV DATA - ${results.data.length} rows]\n\n`;
    // Add headers
    if (results.meta.fields && results.meta.fields.length > 0) {
      structuredText += 'HEADERS: ' + results.meta.fields.join(' | ') + '\n\n';
    }
    // Add data with structure preservation
    for(let i = 0; i < results.data.length; i++){
      const row = results.data[i];
      structuredText += `Row ${i + 1}:\n`;
      for (const [key, value] of Object.entries(row)){
        if (value !== null && value !== undefined && value !== '') {
          structuredText += `  ${key}: ${value}\n`;
        }
      }
      structuredText += '\n';
    }
    return structuredText;
  } catch (error) {
    // console.error('Enhanced CSV processing failed:', error);
    return content; // Return original content as fallback
  }
}
/**
 * Enhanced HTML processing
 */ async function processHtmlEnhanced(content) {
  try {
    const $ = cheerio.load(content);
    // Remove script and style tags
    $('script, style, noscript').remove();
    let extractedText = '';
    // Extract title
    const title = $('title').text().trim();
    if (title) {
      extractedText += `TITLE: ${title}\n\n`;
    }
    // Extract meta descriptions
    const description = $('meta[name="description"]').attr('content');
    if (description) {
      extractedText += `DESCRIPTION: ${description}\n\n`;
    }
    // Extract main content with structure
    const body = $('body').length > 0 ? $('body') : $.root();
    body.find('*').each((i, element)=>{
      const tagName = element.tagName;
      const $element = $(element);
      const text = $element.text().trim();
      if (text && !$element.children().length) {
        switch(tagName){
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            extractedText += `\n${tagName.toUpperCase()}: ${text}\n`;
            break;
          case 'p':
            extractedText += `${text}\n\n`;
            break;
          case 'li':
            extractedText += `• ${text}\n`;
            break;
          case 'td':
          case 'th':
            extractedText += `${text}\t`;
            break;
          default:
            if (text.length > 10) {
              extractedText += `${text} `;
            }
        }
      }
    });
    return extractedText.trim();
  } catch (error) {
    // console.error('Enhanced HTML processing failed:', error);
    // Fallback to simple text extraction
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
/**
 * RTF processing with simple fallback
 */ async function processRtfEnhanced(content) {
  try {
    // Simple RTF processing since rtf-parser may not be available
    // Strip RTF codes and clean up
    return content.replace(/\{[^}]*\}/g, '') // Remove RTF control groups
    .replace(/\\[a-z]+\d*\s?/gi, '') // Remove RTF control words
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  } catch (error) {
    // console.error('RTF processing failed:', error);
    return content;
  }
}
/**
 * Extract text from PPTX files using JSZIP and xml2js
 */ async function extractPptxText(buffer) {
  try {
    const zip = await JSZIP.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter((f)=>f.startsWith('ppt/slides/slide')).sort((a, b)=>{
      const aNum = parseInt(a.split('slide')[1].split('.xml')[0], 10);
      const bNum = parseInt(b.split('slide')[1].split('.xml')[0], 10);
      return aNum - bNum;
    });
    let text = '';
    for (const slideFile of slideFiles){
      const xml = await zip.file(slideFile).async('string');
      const result = await xml2js.parseStringPromise(xml);
      text += `Slide: ${slideFile.match(/slide(\d+)\.xml/)[1]}\n`;
      const shapes = result['p:sld']?.['p:cSld']?.[0]?.['p:spTree']?.[0]?.['p:sp'] || [];
      for (const shape of shapes){
        const paragraphs = shape['p:txBody']?.[0]?.['a:p'] || [];
        for (const paragraph of paragraphs){
          const runs = paragraph['a:r'] || [];
          for (const run of runs){
            const textContent = run['a:t']?.[0] || '';
            text += textContent;
          }
          text += '\n';
        }
        text += '\n';
      }
      text += '\n---\n\n';
    }
    return text.trim();
  } catch (error) {
    // console.error('Error extracting PPTX text:', error);
    return '[Error extracting text from PPTX]';
  }
}
/**
 * Enhanced file processing with multiple library attempts
 */ 
async function processWithMultipleLibraries(file: any, geminiApiKey: string) {
  const buffer = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  let extractedText = '';
  let processingMethod = 'unknown';

  try {
    switch (file.mimeType) {
      case 'application/pdf':
        try {
          // Try PDF.js first
          extractedText = await extractPdfTextWithPdfjs(buffer);
          processingMethod = 'pdfjs';
          // console.log(`PDF processed with PDF.js: ${extractedText.length} characters`);
          
          // If PDF.js extraction seems too short, also try Gemini
          if (extractedText.length < file.size * 0.5 && file.size > 50000) {
            // console.log('PDF.js extraction seems incomplete, augmenting with Gemini API...');
            await processDocumentWithExtractionAndChunking(file, geminiApiKey);
            
            // If Gemini got more content, use it; otherwise keep PDF.js result
            if (file.content && file.content.length > extractedText.length) {
              // console.log(`Gemini extraction got more content: ${file.content.length} vs ${extractedText.length}`);
              return; // Use Gemini's result
            }
          }
        } catch (pdfError) {
          // console.log('PDF.js failed, falling back to Gemini API:', pdfError);
          return await processDocumentWithExtractionAndChunking(file, geminiApiKey);
        }
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        try {
          // Try enhanced DOCX extraction first
          extractedText = await extractDocxTextEnhanced(buffer);
          processingMethod = 'enhanced_docx';
        } catch (docxError) {
          // console.log('Enhanced DOCX failed, trying mammoth');
          try {
            const result = await mammoth.extractRawText({
              arrayBuffer: buffer
            });
            extractedText = result.value;
            processingMethod = 'mammoth';
          } catch (mammothError) {
            // console.log('Mammoth failed, falling back to Gemini API');
            return await processDocumentWithExtractionAndChunking(file, geminiApiKey);
          }
        }
        break;
      case 'text/csv':
        try {
          const csvContent = new TextDecoder().decode(buffer);
          extractedText = await processCsvEnhanced(csvContent);
          processingMethod = 'papaparse';
        } catch (csvError) {
          // console.log('Enhanced CSV processing failed, using raw content');
          extractedText = new TextDecoder().decode(buffer);
          processingMethod = 'raw_text';
        }
        break;
      case 'text/html':
        try {
          const htmlContent = new TextDecoder().decode(buffer);
          extractedText = await processHtmlEnhanced(htmlContent);
          processingMethod = 'cheerio';
        } catch (htmlError) {
          // console.log('Enhanced HTML processing failed, using raw content');
          extractedText = new TextDecoder().decode(buffer);
          processingMethod = 'raw_text';
        }
        break;
      case 'application/rtf':
        try {
          const rtfContent = new TextDecoder().decode(buffer);
          extractedText = await processRtfEnhanced(rtfContent);
          processingMethod = 'rtf_parser';
        } catch (rtfError) {
          // console.log('RTF processing failed, using simple cleanup');
          const rtfContent = new TextDecoder().decode(buffer);
          extractedText = rtfContent.replace(/\{[^}]*\}/g, '').replace(/\\[a-z]+\d*\s?/gi, '').trim();
          processingMethod = 'simple_rtf_cleanup';
        }
        break;
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        try {
          const workbook = XLSX.read(buffer, {
            type: 'array'
          });
          extractedText = '';
          workbook.SheetNames.forEach((sheetName, index)=>{
            const sheet = workbook.Sheets[sheetName];
            extractedText += `\n--- Sheet ${index + 1}: ${sheetName} ---\n`;
            // Try to get rich data first
            const jsonData = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: ''
            });
            if (jsonData.length > 0) {
              jsonData.forEach((row, rowIndex)=>{
                if (row.some((cell)=>cell !== '')) {
                  extractedText += `Row ${rowIndex + 1}: ${row.join('\t')}\n`;
                }
              });
            } else {
              // Fallback to plain text
              extractedText += XLSX.utils.sheet_to_txt(sheet);
            }
            extractedText += '\n';
          });
          processingMethod = 'xlsx_enhanced';
        } catch (xlsxError) {
          // console.log('Enhanced XLSX processing failed, falling back to basic');
          const workbook = XLSX.read(buffer, {
            type: 'array'
          });
          extractedText = '';
          workbook.SheetNames.forEach((sheetName, index)=>{
            const sheet = workbook.Sheets[sheetName];
            extractedText += `Sheet ${index + 1}: ${sheetName}\n`;
            extractedText += XLSX.utils.sheet_to_txt(sheet) + '\n\n';
          });
          processingMethod = 'xlsx_basic';
        }
        break;
      case 'application/vnd.ms-powerpoint':
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        try {
          extractedText = await extractPptxText(buffer);
          processingMethod = 'pptx_xml';
        } catch (pptxError) {
          // console.log('PPTX processing failed, falling back to Gemini API');
          return await processDocumentWithExtractionAndChunking(file, geminiApiKey);
        }
        break;
      default:
        return await processDocumentWithExtractionAndChunking(file, geminiApiKey);
    }

    file.content = extractedText;
    file.processing_metadata = {
      ...file.processing_metadata,
      extractionMethod: processingMethod,
      libraryUsed: processingMethod,
      contentLength: file.content.length,
      originalContentLength: extractedText.length
    };

    // console.log(`Successfully processed ${file.name} using ${processingMethod}: ${file.content.length} characters`);
  } catch (error: any) {
    // console.error(`All library processing failed for ${file.name}:`, error);
    return await processDocumentWithExtractionAndChunking(file, geminiApiKey);
  }
}
/**
 * Enhanced file validation with detailed feedback
 */ function validateFile(file, fileType) {
  const config = ENHANCED_FILE_TYPES[file.mimeType];
  if (!config) {
    return {
      valid: false,
      error: `Unsupported file type: ${fileType}`
    };
  }
  const warnings = [];
  if (file.size > config.maxSize) {
    return {
      valid: false,
      error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds limit for ${fileType} files (${Math.round(config.maxSize / 1024 / 1024)}MB)`
    };
  }
  if (file.size > config.maxSize * 0.7) {
    warnings.push('Large file may take longer to process');
  }
  return {
    valid: true,
    warnings
  };
}
/**
 * Process text files with intelligent chunking and zero truncation
 */ async function processTextFileWithChunking(file, geminiApiKey) {
  const decodedContent = atob(file.data || '');
  if (decodedContent.length <= ENHANCED_PROCESSING_CONFIG.INTELLIGENT_CHUNK_SIZE) {
    // Small file - process directly with full content preservation
    if (file.type === 'code') {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      file.content = `[${extension.toUpperCase()} Code File: ${file.name}]\n\`\`\`${extension}\n${decodedContent}\n\`\`\``;
    } else {
      file.content = decodedContent;
    }
    return;
  }
  // Large file - use intelligent chunking with zero truncation
  const chunks = createIntelligentChunks(decodedContent, file.type);
  const prompt = EXTRACTION_PROMPTS[file.type] || EXTRACTION_PROMPTS.text;
  file.content = await processChunkedContent(chunks, prompt, geminiApiKey);
}
/**
 * Process structured files (JSON, CSV) with preservation of structure
 */ async function processStructuredFileWithChunking(file, geminiApiKey) {
  const decodedContent = atob(file.data || '');
  // For structured files, try to preserve structure even when chunking
  if (file.type === 'csv') {
    // For CSV, ensure we don't break in the middle of rows
    if (decodedContent.length <= ENHANCED_PROCESSING_CONFIG.INTELLIGENT_CHUNK_SIZE) {
      file.content = await processCsvEnhanced(decodedContent);
      return;
    }
    const chunks = createIntelligentChunks(decodedContent, 'csv');
    const enhancedPrompt = `${EXTRACTION_PROMPTS.text}

SPECIAL CSV INSTRUCTIONS:
- Preserve all data rows and columns
- Maintain header information in context
- Keep data types and formatting
- Extract all numerical and text data completely

CSV CONTENT TO PROCESS:`;
    file.content = await processChunkedContent(chunks, enhancedPrompt, geminiApiKey);
  } else if (file.type === 'html') {
    // For HTML, use enhanced processing
    file.content = await processHtmlEnhanced(decodedContent);
  } else if (file.type === 'json') {
    // For JSON, try to maintain structure
    try {
      const parsed = JSON.parse(decodedContent);
      const prettyJson = JSON.stringify(parsed, null, 2);
      if (prettyJson.length <= ENHANCED_PROCESSING_CONFIG.INTELLIGENT_CHUNK_SIZE) {
        file.content = `[JSON Structure]\n${prettyJson}`;
      } else {
        const chunks = createIntelligentChunks(prettyJson, 'json');
        file.content = await processChunkedContent(chunks, EXTRACTION_PROMPTS.text, geminiApiKey);
      }
    } catch  {
      // Invalid JSON - process as text
      await processTextFileWithChunking(file, geminiApiKey);
    }
  }
}
/**
 * Enhanced document processing with progressive extraction for large files
 */
async function processDocumentWithExtractionAndChunking(file: any, geminiApiKey: string) {
  const prompt = EXTRACTION_PROMPTS[file.type] || EXTRACTION_PROMPTS.document;
  
  // First attempt - full extraction
  const contents = [
    { 
      role: 'user', 
      parts: [
        { text: prompt }, 
        { inlineData: { mimeType: file.mimeType, data: file.data } }
      ] 
    }
  ];

  const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
  
  if (!response.success || !response.content) {
    throw new Error(response.error || 'Failed to extract document content');
  }

  let extractedContent = response.content;
  const estimatedTotalChars = file.size * 2; // Rough estimate
  
  // Check if extraction seems incomplete
  const isIncomplete = 
    extractedContent.includes('[TRUNCATED') ||
    extractedContent.includes('...') && extractedContent.length < estimatedTotalChars * 0.3 ||
    extractedContent.endsWith('...') ||
    extractedContent.length < 5000 && file.size > 100000;

  if (isIncomplete) {
    // console.log(`Initial extraction incomplete for ${file.name}. Attempting continuation extraction...`);
    
    // Try up to 3 continuation passes
    let attemptCount = 0;
    const maxAttempts = 3;
    
    while (attemptCount < maxAttempts && extractedContent.length < estimatedTotalChars * 0.7) {
      attemptCount++;
      
      // Get last 500 chars to understand where we stopped
      const lastChars = extractedContent.slice(-500);
      
      const continuationPrompt = `${prompt}

CONTINUATION EXTRACTION - ATTEMPT ${attemptCount}:
The previous extraction stopped here:
"""
${lastChars}
"""

CRITICAL INSTRUCTIONS:
1. Continue extracting from EXACTLY where the previous extraction ended
2. Do NOT repeat content from the previous extraction
3. Extract ALL remaining content until the absolute end of the document
4. If you reach the end, explicitly state: [END OF DOCUMENT]
5. Maintain the same formatting and structure as before

Continue the extraction now:`;

      const continuationContents = [
        { 
          role: 'user', 
          parts: [
            { text: continuationPrompt }, 
            { inlineData: { mimeType: file.mimeType, data: file.data } }
          ] 
        }
      ];

      try {
        const continuationResponse = await callEnhancedGeminiAPI(continuationContents, geminiApiKey);
        
        if (continuationResponse.success && continuationResponse.content) {
          const newContent = continuationResponse.content;
          
          // Check if we got meaningful new content
          if (newContent.length < 100 || newContent.includes('[END OF DOCUMENT]')) {
            // console.log(`Reached end of document at attempt ${attemptCount}`);
            if (newContent.includes('[END OF DOCUMENT]')) {
              // Remove the marker before appending
              extractedContent += '\n\n' + newContent.replace('[END OF DOCUMENT]', '').trim();
            }
            break;
          }
          
          // Find overlap and merge
          const overlap = findOverlapLength(extractedContent.slice(-500), newContent.slice(0, 500));
          const contentToAdd = overlap > 50 ? newContent.slice(overlap) : newContent;
          
          extractedContent += '\n\n' + contentToAdd;
          
          // console.log(`Continuation ${attemptCount}: Added ${contentToAdd.length} chars. Total: ${extractedContent.length}`);
          
          // Add delay between continuation attempts
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // console.error(`Continuation attempt ${attemptCount} failed:`, continuationResponse.error);
          break;
        }
      } catch (error: any) {
        // console.error(`Error in continuation attempt ${attemptCount}:`, error);
        break;
      }
    }
    
    if (extractedContent.length < estimatedTotalChars * 0.5) {
      extractedContent += '\n\n[WARNING: Extraction may be incomplete. The document is very large. Consider splitting it into smaller parts for complete extraction.]';
    }
  }

  file.content = extractedContent;
  
  // console.log(`Final extraction for ${file.name}: ${extractedContent.length} characters`);
}

/**
 * Process images with comprehensive vision analysis
 */ async function processImageWithVision(file, geminiApiKey) {
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: EXTRACTION_PROMPTS.image
        },
        {
          inlineData: {
            mimeType: file.mimeType,
            data: file.data
          }
        }
      ]
    }
  ];
  const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
  if (response.success && response.content) {
    file.content = response.content;
  } else {
    throw new Error(response.error || 'Failed to analyze image');
  }
}
/**
 * Process audio with transcription
 */ async function processAudioWithTranscription(file, geminiApiKey) {
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: EXTRACTION_PROMPTS.audio
        },
        {
          inlineData: {
            mimeType: file.mimeType,
            data: file.data
          }
        }
      ]
    }
  ];
  const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
  if (response.success && response.content) {
    file.content = response.content;
  } else {
    throw new Error(response.error || 'Failed to transcribe audio');
  }
}
/**
 * Process video files with frame analysis
 */ async function processVideoWithFrameAnalysis(file, geminiApiKey) {
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: EXTRACTION_PROMPTS.video
        },
        {
          inlineData: {
            mimeType: file.mimeType,
            data: file.data
          }
        }
      ]
    }
  ];
  const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
  if (response.success && response.content) {
    file.content = response.content;
  } else {
    throw new Error(response.error || 'Failed to analyze video');
  }
}

/**
 * Process archive files with metadata extraction
 */ async function processArchiveWithMetadata(file, geminiApiKey) {
  file.content = `[Archive File: ${file.name}]
Type: ${file.type.toUpperCase()}
Size: ${Math.round(file.size / 1024 / 1024 * 100) / 100} MB
MIME Type: ${file.mimeType}

This is an archive file that contains compressed data. Without extraction capabilities, only basic metadata can be provided. The archive may contain multiple files and directories that would need to be extracted to analyze their individual contents.`;
}
/**
 * Enhanced file processing with complete content extraction
 */ async function enhancedFileProcessing(file, geminiApiKey) {
  const fileConfig = ENHANCED_FILE_TYPES[file.mimeType];
  if (!fileConfig) {
    file.processing_status = 'failed';
    file.processing_error = `Unsupported file type: ${file.mimeType}`;
    return;
  }
  let startTime;
  try {
    file.processing_status = 'processing';
    file.processing_started_at = new Date().toISOString();
    startTime = Date.now();
    file.extraction_model_used = 'gemini-2.0-flash';
    switch(fileConfig.strategy){
      case 'chunk_text':
        await processTextFileWithChunking(file, geminiApiKey);
        break;
      case 'enhanced_structured':
        await processStructuredFileWithChunking(file, geminiApiKey);
        break;
      case 'extract_and_chunk':
        await processDocumentWithExtractionAndChunking(file, geminiApiKey);
        break;
      case 'enhanced_local_extract':
        await processWithMultipleLibraries(file, geminiApiKey);
        break;
      case 'vision_analysis':
        await processImageWithVision(file, geminiApiKey);
        break;
      case 'transcription':
        await processAudioWithTranscription(file, geminiApiKey);
        break;
      case 'frame_analysis':
        await processVideoWithFrameAnalysis(file, geminiApiKey);
        break;
      case 'metadata_only':
        await processArchiveWithMetadata(file, geminiApiKey);
        break;
      default:
        throw new Error(`Unknown processing strategy: ${fileConfig.strategy}`);
    }
    file.processing_status = 'completed';
    file.processing_completed_at = new Date().toISOString();
    file.total_processing_time_ms = Date.now() - startTime;
    file.processing_metadata = {
      chunkCount: Array.isArray(file.chunks) ? file.chunks.length : 0,
      geminiApiCalls: 1,
      contentLength: file.content?.length || 0
    };
    // console.log(`Successfully processed ${file.name}: ${file.content?.length || 0} characters extracted`);
  } catch (error) {
    file.processing_View_status = 'failed';
    file.processing_error = `Processing error: ${error.message}`;
    file.processing_completed_at = new Date().toISOString();
    file.total_processing_time_ms = Date.now() - startTime;
    // console.error(`Error processing file ${file.name}:`, error);
  }
}
/**
* Enhanced batch processing with priority-based ordering
*/ async function enhancedBatchProcessing(files, geminiApiKey, userId) {
  const filesToProcess = files.filter((f)=>f.processing_status === 'pending' && ENHANCED_FILE_TYPES[f.mimeType]);
  if (filesToProcess.length === 0) return;
  // Sort by processing priority and size
  filesToProcess.sort((a, b)=>{
    const aConfig = ENHANCED_FILE_TYPES[a.mimeType];
    const bConfig = ENHANCED_FILE_TYPES[b.mimeType];
    if (aConfig.priority !== bConfig.priority) {
      return aConfig.priority - bConfig.priority;
    }
    return a.size - b.size; // Smaller files first within same priority
  });
  // console.log(`Processing ${filesToProcess.length} files with enhanced zero-truncation system`);
  // Process files in batches to manage API rate limits
  for(let i = 0; i < filesToProcess.length; i += ENHANCED_PROCESSING_CONFIG.BATCH_SIZE){
    const batch = filesToProcess.slice(i, i + ENHANCED_PROCESSING_CONFIG.BATCH_SIZE);
    await Promise.all(batch.map((file)=>enhancedFileProcessing(file, geminiApiKey)));
    // Rate limiting between batches
    if (i + ENHANCED_PROCESSING_CONFIG.BATCH_SIZE < filesToProcess.length) {
      await new Promise((resolve)=>setTimeout(resolve, ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY * 2));
    }
  }
  // console.log('Enhanced file processing completed with zero truncation');
}
/**
* Process file from multipart/form-data (if needed)
*/ async function processFile(file) {
  const mimeType = file.type;
  const fileConfig = ENHANCED_FILE_TYPES[mimeType];
  if (!fileConfig) {
    // console.warn(`Unsupported file type: ${mimeType}`);
    return null;
  }
  try {
    const validation = validateFile(file, fileConfig.type);
    if (!validation.valid) {
      // console.warn(`File validation failed for ${file.name}: ${validation.error}`);
      return {
        name: file.name,
        type: fileConfig.type,
        mimeType,
        data: null,
        content: null,
        size: file.size,
        processing_status: 'failed',
        processing_error: validation.error,
        processing_started_at: null,
        processing_completed_at: null,
        extraction_model_used: null,
        total_processing_time_ms: null,
        processing_metadata: null
      };
    }
    if ([
      'text',
      'code',
      'csv',
      'markdown',
      'html',
      'xml',
      'json'
    ].includes(fileConfig.type)) {
      const textContent = await file.text();
      return {
        name: file.name,
        type: fileConfig.type,
        mimeType,
        content: textContent,
        data: btoa(textContent),
        size: file.size,
        processing_status: 'completed',
        processing_error: null,
        processing_started_at: null,
        processing_completed_at: null,
        extraction_model_used: null,
        total_processing_time_ms: null,
        processing_metadata: null
      };
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuffer);
      return {
        name: file.name,
        type: fileConfig.type,
        mimeType,
        data: base64Data,
        content: `[File: ${file.name} - ${file.size} bytes. Processing ${fileConfig.type} content...]`,
        size: file.size,
        processing_status: 'pending',
        processing_error: null,
        processing_started_at: null,
        processing_completed_at: null,
        extraction_model_used: null,
        total_processing_time_ms: null,
        processing_metadata: null
      };
    }
  } catch (error) {
    // console.error(`Error processing file ${file.name}:`, error);
    return {
      name: file.name,
      type: fileConfig.type,
      mimeType,
      data: null,
      content: null,
      size: file.size,
      processing_status: 'failed',
      processing_error: `Error processing file: ${error.message}`,
      processing_started_at: null,
      processing_completed_at: null,
      extraction_model_used: null,
      total_processing_time_ms: null,
      processing_metadata: null
    };
  }
}
/**
* Process file from JSON payload
*/ async function processBase64File(fileData) {
  if (!fileData.name || !fileData.mimeType) {
    // console.warn('Invalid file data structure');
    return null;
  }
  const fileConfig = ENHANCED_FILE_TYPES[fileData.mimeType];
  if (!fileConfig) {
    // console.warn(`Unsupported file type: ${fileData.mimeType}`);
    return null;
  }
  const validation = validateFile(fileData, fileConfig.type);
  if (!validation.valid) {
    // console.warn(`File validation failed for ${fileData.name}: ${validation.error}`);
    return {
      name: fileData.name,
      type: fileConfig.type,
      mimeType: fileData.mimeType,
      data: fileData.data,
      content: null,
      size: fileData.size || 0,
      processing_status: 'failed',
      processing_error: validation.error,
      processing_started_at: null,
      processing_completed_at: null,
      extraction_model_used: null,
      total_processing_time_ms: null,
      processing_metadata: null
    };
  }
  let decodedContent = fileData.content;
  if ([
    'text',
    'code',
    'csv',
    'markdown',
    'html',
    'xml',
    'json'
  ].includes(fileConfig.type) && fileData.data && !decodedContent) {
    try {
      decodedContent = atob(fileData.data);
    } catch (error) {
      // console.warn(`Failed to decode base64 data for ${fileData.name}`);
    }
  }
  return {
    name: fileData.name,
    type: fileConfig.type,
    mimeType: fileData.mimeType,
    data: fileData.data || (decodedContent ? btoa(decodedContent) : null),
    content: decodedContent || `[File: ${fileData.name}. Processing ${fileConfig.type} content...]`,
    size: fileData.size || (decodedContent ? decodedContent.length : 0),
    processing_status: fileData.processing_status || ([
      'text',
      'code',
      'csv',
      'markdown',
      'html',
      'xml',
      'json'
    ].includes(fileConfig.type) ? 'completed' : 'pending'),
    processing_error: fileData.processing_error || null,
    processing_started_at: null,
    processing_completed_at: null,
    extraction_model_used: null,
    total_processing_time_ms: null,
    processing_metadata: null
  };
}

// Utility to sanitize filenames for storage keys
function sanitizeFileName(name) {
  // Remove or replace characters not allowed in storage keys
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Only allow safe chars
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, '') // Trim underscores
    .substring(0, 128); // Limit length for safety
}

 async function uploadFileToStorage(file, userId) {
  try {
    const bucketName = 'chat-documents';
    const safeFileName = sanitizeFileName(file.name);
    const filePath = `${userId}/${crypto.randomUUID()}-${safeFileName}`;
    let fileDataToUpload;
    if (file.data) {
      const binaryString = atob(file.data);
      fileDataToUpload = new Uint8Array(binaryString.length);
      for(let i = 0; i < binaryString.length; i++){
        fileDataToUpload[i] = binaryString.charCodeAt(i);
      }
    } else if (file.content) {
      fileDataToUpload = new Blob([
        file.content
      ], {
        type: file.mimeType
      });
    } else {
      // console.warn(`No data or content to upload for file: ${file.name}`);
      return null;
    }
    const { data, error } = await supabase.storage.from(bucketName).upload(filePath, fileDataToUpload, {
      contentType: file.mimeType,
      upsert: false
    });
    if (error) {
      // console.error('Error uploading file to Supabase Storage:', error);
      return null;
    }
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return publicUrlData?.publicUrl || null;
  } catch (error) {
    // console.error('Error in uploadFileToStorage:', error);
    return null;
  }
}
/**
* Save file metadata and extracted content to the database
*/ async function saveFileToDatabase(file, userId) {
  let fileUrl = null;
  let contentExtracted = file.content;
  let processingStatus = file.processing_status;
  let processingError = file.processing_error;
  // Only upload to storage if it's a binary file or explicitly requires URL
  if ([
    'image',
    'pdf',
    'document',
    'spreadsheet',
    'presentation',
    'archive',
    'audio',
    'video'
  ].includes(file.type)) {
    fileUrl = await uploadFileToStorage(file, userId);
    if (!fileUrl) {
      processingStatus = 'failed';
      processingError = processingError || 'Failed to upload file to storage';
      // console.error(`Failed to upload file ${file.name} to storage.`);
      return null;
    }
  }
  try {
    const { data, error } = await supabase.from('documents').insert({
      user_id: userId,
      title: file.name,
      file_name: file.name,
      file_url: fileUrl || '',
      file_type: file.mimeType,
      file_size: file.size,
      content_extracted: contentExtracted,
      type: file.type,
      processing_status: processingStatus,
      processing_error: processingError
    }).select('id').single();
    if (error) {
      // console.error('Error saving file metadata to database:', error);
      return null;
    }
    file.id = data.id;
    file.file_url = fileUrl || '';
    return data.id;
  } catch (error) {
    // console.error('Database error when saving file:', error);
    return null;
  }
}
/**
* Main server handler
*/ serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const startTime = Date.now();
  let files = [];
  let userId = null;
  let uploadedDocumentIds = [];
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        error: 'Unsupported Content-Type. Please send application/json.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    const requestData = await req.json();
    userId = requestData.userId;
    const incomingFilesData = requestData.files;
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Missing required parameter: userId'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    if (!incomingFilesData || !Array.isArray(incomingFilesData) || incomingFilesData.length === 0) {
      return new Response(JSON.stringify({
        error: 'No files provided for processing.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    // Process incoming base64 file data
    for (const fileData of incomingFilesData){
      const processedFile = await processBase64File(fileData);
      if (processedFile) {
        files.push(processedFile);
      }
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    // console.log(`Starting enhanced processing of ${files.length} files for user ${userId}...`);
    // Use enhanced batch processing with zero truncation
    await enhancedBatchProcessing(files, geminiApiKey, userId);
    // Save all files to database
    const savedDocuments = [];
    for (const file of files){
      const documentId = await saveFileToDatabase(file, userId);
      if (documentId) {
        uploadedDocumentIds.push(documentId);
        savedDocuments.push({
          id: file.id,
          title: file.name,
          file_name: file.name,
          file_url: file.file_url,
          file_type: file.mimeType,
          file_size: file.size,
          content_extracted: file.content,
          type: file.type,
          processing_status: file.processing_status,
          processing_error: file.processing_error,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: userId
        });
      } else {
        savedDocuments.push({
          id: null,
          title: file.name,
          file_name: file.name,
          file_url: null,
          file_type: file.mimeType,
          file_size: file.size,
          content_extracted: file.content,
          type: file.type,
          processing_status: 'failed',
          processing_error: file.processing_error || 'Failed to save to database',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: userId
        });
      }
    }
    const processingTime = Date.now() - startTime;
    // console.log(`Enhanced document processing for user ${userId} completed in ${processingTime}ms.`);
    return new Response(JSON.stringify({
      message: 'Files processed with enhanced zero-truncation system.',
      processingTime,
      filesProcessedCount: files.length,
      uploadedDocumentIds: uploadedDocumentIds,
      processingResults: files.map((f)=>({
          id: f.id,
          name: f.name,
          type: f.type,
          mimeType: f.mimeType,
          status: f.processing_status,
          error: f.processing_error,
          fileUrl: f.file_url,
          contentExtracted: f.content,
          processingTimeMs: f.total_processing_time_ms,
          extractionModel: f.extraction_model_used
        })),
      documents: savedDocuments
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    // console.error('Error in enhanced document-processor function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal Server Error',
      processingTime,
      filesProcessedCount: files.length,
      processingResults: files.map((f)=>({
          id: f.id,
          name: f.name,
          type: f.type,
          mimeType: f.mimeType,
          status: f.processing_status || 'failed',
          error: f.processing_error || error.message,
          fileUrl: f.file_url,
          contentExtracted: f.content
        }))
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

