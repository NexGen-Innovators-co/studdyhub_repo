
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// Enhanced Processing Configuration with Context Management
const ENHANCED_PROCESSING_CONFIG = {
  // Gemini 2.0 Flash specifications
  MAX_INPUT_TOKENS: 2 * 1024 * 1024,
  MAX_OUTPUT_TOKENS: 8192,
  CHUNK_OVERLAP: 500,
  // Enhanced chunking strategy
  INTELLIGENT_CHUNK_SIZE: 1.8 * 1024 * 1024,
  MIN_CHUNK_SIZE: 100 * 1024,
  // Processing priorities
  BATCH_SIZE: 3,
  RETRY_ATTEMPTS: 3,
  RATE_LIMIT_DELAY: 1000,
  // Content management
  MAX_TOTAL_CONTEXT: 4 * 1024 * 1024,
  MAX_SINGLE_FILE_CONTENT: 2 * 1024 * 1024,
  // Context Memory Configuration
  MAX_CONVERSATION_HISTORY: 50,
  CONTEXT_MEMORY_WINDOW: 30,
  SUMMARY_THRESHOLD: 20,
  CONTEXT_RELEVANCE_SCORE: 0.7 // Minimum relevance score for including older messages
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
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 200 * 1024 * 1024
  },
  'application/msword': {
    type: 'document',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    type: 'document',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.ms-excel': {
    type: 'spreadsheet',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    type: 'spreadsheet',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.ms-powerpoint': {
    type: 'presentation',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    type: 'presentation',
    strategy: 'extract_and_chunk',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/rtf': {
    type: 'document',
    strategy: 'extract_and_chunk',
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
    strategy: 'chunk_structured',
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
    strategy: 'chunk_text',
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
    strategy: 'chunk_structured',
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
const updates = {
  updated_at: new Date().toISOString(),
  last_message_at: new Date().toISOString()
};
/**
* Context-aware conversation memory retrieval
*/ /**
* Context-aware conversation memory retrieval
*/ async function getConversationHistory(userId, sessionId, maxMessages = ENHANCED_PROCESSING_CONFIG.MAX_CONVERSATION_HISTORY) {
  try {
    console.log(`Retrieving conversation history for session ${sessionId}, user ${userId}`);
    const { data: messages, error } = await supabase.from('chat_messages').select(`
id,
content,
role,
attached_document_ids,
attached_note_ids,
image_url,
image_mime_type,
timestamp,
is_error
`) // Corrected: Added closing parenthesis here
      .eq('user_id', userId).eq('session_id', sessionId).eq('is_error', false) // Exclude error messages from context
      .order('timestamp', {
        ascending: true
      }).limit(maxMessages);
    if (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
    if (!messages || messages.length === 0) {
      console.log('No conversation history found');
      return [];
    }
    console.log(`Retrieved ${messages.length} messages from conversation history`);
    return messages;
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return [];
  }
}
/**
* Intelligent context management with conversation summarization
*/ async function buildIntelligentContext(userId, sessionId, currentMessage, attachedDocumentIds = [], attachedNoteIds = []) {
  const conversationHistory = await getConversationHistory(userId, sessionId);
  // If conversation is short, include all messages
  if (conversationHistory.length <= ENHANCED_PROCESSING_CONFIG.CONTEXT_MEMORY_WINDOW) {
    console.log('Short conversation - including all messages in context');
    return {
      recentMessages: conversationHistory,
      conversationSummary: null,
      totalMessages: conversationHistory.length
    };
  }
  // For longer conversations, implement intelligent context management
  const recentMessages = conversationHistory.slice(-ENHANCED_PROCESSING_CONFIG.CONTEXT_MEMORY_WINDOW);
  const olderMessages = conversationHistory.slice(0, -ENHANCED_PROCESSING_CONFIG.CONTEXT_MEMORY_WINDOW);
  // Create a summary of older messages if there are many
  let conversationSummary = null;
  if (olderMessages.length > ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) {
    try {
      conversationSummary = await createConversationSummary(olderMessages, userId);
      console.log(`Created conversation summary for ${olderMessages.length} older messages`);
    } catch (error) {
      console.error('Error creating conversation summary:', error);
    }
  }
  return {
    recentMessages,
    conversationSummary,
    totalMessages: conversationHistory.length,
    summarizedMessages: olderMessages.length
  };
}
/**
* Create intelligent conversation summary using Gemini
*/ async function createConversationSummary(messages, userId) {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) return null;
  // Extract key information from messages
  const messageTexts = messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n');
  const summaryPrompt = `Create a comprehensive summary of this conversation that preserves important context:

CONVERSATION TO SUMMARIZE:
${messageTexts}

SUMMARY REQUIREMENTS:
1. Capture key topics and themes discussed
2. Preserve important facts, decisions, and conclusions
3. Note any specific user preferences or requirements mentioned
4. Include relevant technical details or code discussed
5. Maintain chronological flow of important developments
6. Highlight any ongoing tasks or projects
7. Note any documents or files that were referenced
8. Keep the summary concise but comprehensive (max 1000 words)

FORMAT: Provide a structured summary that can be used as context for continuing the conversation.`;
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: summaryPrompt
        }
      ]
    }
  ];
  try {
    const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
    if (response.success && response.content) {
      return response.content;
    }
  } catch (error) {
    console.error('Error creating conversation summary:', error);
  }
  return null;
}
/**
* Optimized base64 conversion with chunking for large files
*/ function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768; // Larger chunks for better performance
  for (let i = 0; i < bytes.length; i += chunkSize) {
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
  while (currentPos < content.length) {
    let chunkEnd = Math.min(currentPos + maxChunkSize, content.length);
    // Find the best break point within the chunk
    if (chunkEnd < content.length) {
      let bestBreak = chunkEnd;
      // Try each pattern in order of preference
      for (const pattern of patterns) {
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
  console.log(`Created ${chunks.length} intelligent chunks for ${fileType} content (${content.length} chars)`);
  return chunks;
}
/**
* Find overlap length between two text segments
*/ function findOverlapLength(text1, text2) {
  let maxOverlap = 0;
  const maxSearch = Math.min(text1.length, text2.length, 300);
  for (let i = 20; i <= maxSearch; i++) {
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
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    // Remove chunk metadata markers
    chunk = chunk.replace(/^\[CONTINUATION FROM PREVIOUS CHUNK\]\s*\n\n/, '').replace(/\n\n\[CONTINUES IN NEXT CHUNK\]\s*$/, '');
    // Handle overlaps between chunks
    if (i > 0 && mergedContent.length > 0) {
      // Find potential overlap
      const prevEnd = mergedContent.slice(-500); // Last 500 chars of previous
      const currentStart = chunk.slice(0, 500); // First 500 chars of current
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
  for (let attempt = 0; attempt < ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS; attempt++) {
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
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
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
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
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
  for (let i = 0; i < chunks.length; i++) {
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
          await new Promise((resolve) => setTimeout(resolve, ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY));
        }
      } else {
        console.error(`Failed to process chunk ${i + 1}:`, response.error);
        processedChunks.push(`[ERROR PROCESSING CHUNK ${i + 1}: ${response.error}]`);
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      processedChunks.push(`[ERROR PROCESSING CHUNK ${i + 1}: ${error.message}]`);
    }
  }
  // Merge processed chunks intelligently
  return mergeProcessedChunks(processedChunks);
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
* Process text files with intelligent chunking
*/ async function processTextFileWithChunking(file, geminiApiKey) {
  const decodedContent = atob(file.data || '');
  if (decodedContent.length <= ENHANCED_PROCESSING_CONFIG.INTELLIGENT_CHUNK_SIZE) {
    // Small file - process directly
    if (file.type === 'code') {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      file.content = `[${extension.toUpperCase()} Code File: ${file.name}]\n\`\`\`${extension}\n${decodedContent}\n\`\`\``;
    } else {
      file.content = decodedContent;
    }
    return;
  }
  // Large file - use intelligent chunking
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
      file.content = `[CSV Data Structure]\n${decodedContent}`;
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
    } catch {
      // Invalid JSON - process as text
      await processTextFileWithChunking(file, geminiApiKey);
    }
  }
}
/**
* Process documents with Gemini extraction and intelligent chunking
*/ async function processDocumentWithExtractionAndChunking(file, geminiApiKey) {
  const prompt = EXTRACTION_PROMPTS[file.type] || EXTRACTION_PROMPTS.document;
  // First attempt: try to process the entire file
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: prompt
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
    // Check if we got complete extraction or if it was truncated
    if (response.content.includes('[TRUNCATED') || response.content.length < file.size * 0.001) {
      console.log(`Initial extraction may be incomplete for ${file.name}, attempting advanced processing...`);
      // For now, use the extracted content as is
      // In a production system, you might implement document splitting or OCR chunking here
      file.content = response.content;
    } else {
      file.content = response.content;
    }
  } else {
    throw new Error(response.error || 'Failed to extract document content');
  }
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
  let startTime; // Declare startTime outside the try block
  try {
    file.processing_status = 'processing';
    file.processing_started_at = new Date().toISOString(); // Set start time
    startTime = Date.now(); // Capture start time in milliseconds
    // Set a default model name (replace with your actual logic)
    file.extraction_model_used = 'gemini-2.0-flash';
    switch (fileConfig.strategy) {
      case 'chunk_text':
        await processTextFileWithChunking(file, geminiApiKey);
        break;
      case 'chunk_structured':
        await processStructuredFileWithChunking(file, geminiApiKey);
        break;
      case 'extract_and_chunk':
        await processDocumentWithExtractionAndChunking(file, geminiApiKey);
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
    file.processing_completed_at = new Date().toISOString(); // Set completed timestamp
    file.total_processing_time_ms = Date.now() - startTime; // Calculate processing time
    // Example metadata (replace with actual metadata)
    file.processing_metadata = {
      chunkCount: Array.isArray(file.chunks) ? file.chunks.length : 0,
      geminiApiCalls: 1,
      contentLength: file.content?.length || 0
    };
    console.log(`Successfully processed ${file.name}: ${file.content?.length || 0} characters extracted`);
  } catch (error) {
    file.processing_status = 'failed';
    file.processing_error = `Processing error: ${error.message}`;
    file.processing_completed_at = new Date().toISOString(); // Set completed timestamp even on error
    file.total_processing_time_ms = Date.now() - startTime; // Calculate processing time even on error
    console.error(`Error processing file ${file.name}:`, error);
  }
}
/**
* Enhanced batch processing with priority-based ordering
*/ async function enhancedBatchProcessing(files, geminiApiKey, userId) {
  const filesToProcess = files.filter((f) => f.processing_status === 'pending' && ENHANCED_FILE_TYPES[f.mimeType]);
  if (filesToProcess.length === 0) return;
  // Sort by processing priority and size
  filesToProcess.sort((a, b) => {
    const aConfig = ENHANCED_FILE_TYPES[a.mimeType];
    const bConfig = ENHANCED_FILE_TYPES[b.mimeType];
    if (aConfig.priority !== bConfig.priority) {
      return aConfig.priority - bConfig.priority;
    }
    return a.size - b.size; // Smaller files first within same priority
  });
  console.log(`Processing ${filesToProcess.length} files with enhanced zero-truncation system`);
  // Process files in batches to manage API rate limits
  for (let i = 0; i < filesToProcess.length; i += ENHANCED_PROCESSING_CONFIG.BATCH_SIZE) {
    const batch = filesToProcess.slice(i, i + ENHANCED_PROCESSING_CONFIG.BATCH_SIZE);
    await Promise.all(batch.map((file) => enhancedFileProcessing(file, geminiApiKey)));
    // Rate limiting between batches
    if (i + ENHANCED_PROCESSING_CONFIG.BATCH_SIZE < filesToProcess.length) {
      await new Promise((resolve) => setTimeout(resolve, ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY * 2));
    }
  }
  console.log('Enhanced file processing completed with zero truncation');
}
/**
* Process file from multipart/form-data
*/ async function processFile(file) {
  const mimeType = file.type;
  const fileConfig = ENHANCED_FILE_TYPES[mimeType];
  if (!fileConfig) {
    console.warn(`Unsupported file type: ${mimeType}`);
    return null;
  }
  try {
    const validation = validateFile(file, fileConfig.type);
    if (!validation.valid) {
      console.warn(`File validation failed for ${file.name}: ${validation.error}`);
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
    console.error(`Error processing file ${file.name}:`, error);
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
    console.warn('Invalid file data structure');
    return null;
  }
  const fileConfig = ENHANCED_FILE_TYPES[fileData.mimeType];
  if (!fileConfig) {
    console.warn(`Unsupported file type: ${fileData.mimeType}`);
    return null;
  }
  const validation = validateFile(fileData, fileConfig.type);
  if (!validation.valid) {
    console.warn(`File validation failed for ${fileData.name}: ${validation.error}`);
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
      console.warn(`Failed to decode base64 data for ${fileData.name}`);
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
/**
* Build attached context for documents and notes
*/ async function buildAttachedContext(documentIds, noteIds, userId) {
  let context = '';
  if (documentIds.length > 0) {
    const { data: documents, error } = await supabase.from('documents').select('id, title, file_name, file_type, content_extracted, type, processing_status').eq('user_id', userId).in('id', documentIds);
    if (error) {
      console.error('Error fetching documents:', error);
    } else if (documents) {
      context += 'DOCUMENTS:\n';
      for (const doc of documents) {
        context += `Title: ${doc.title}\n`;
        context += `File: ${doc.file_name}\n`;
        context += `Type: ${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}\n`;
        if (doc.content_extracted) {
          // Don't truncate here - let the enhanced system handle all content
          context += `Content: ${doc.content_extracted}\n`;
        } else {
          if (doc.type === 'image' && doc.processing_status !== 'completed') {
            context += `Content: Image processing ${doc.processing_status || 'pending'}. No extracted text yet.\n`;
          } else if (doc.type === 'image' && doc.processing_status === 'completed' && !doc.content_extracted) {
            context += `Content: Image analysis completed, but no text or detailed description was extracted.\n`;
          } else {
            context += `Content: No content extracted or available.\n`;
          }
        }
        context += '\n';
      }
    }
  }
  if (noteIds.length > 0) {
    const { data: notes, error } = await supabase.from('notes').select('id, title, category, content, ai_summary, tags').eq('user_id', userId).in('id', noteIds);
    if (error) {
      console.error('Error fetching notes:', error);
    } else if (notes) {
      context += 'NOTES:\n';
      for (const note of notes) {
        context += `Title: ${note.title}\n`;
        context += `Category: ${note.category}\n`;
        if (note.content) {
          // Don't truncate here - let the enhanced system handle all content
          context += `Content: ${note.content}\n`;
        }
        if (note.ai_summary) {
          context += `AI Summary: ${note.ai_summary}\n`;
        }
        if (note.tags && note.tags.length > 0) {
          context += `Tags: ${note.tags.join(', ')}\n`;
        }
        context += '\n';
      }
    }
  }
  return context;
}
/**
* Upload file to Supabase storage
*/ async function uploadFileToStorage(file, userId) {
  try {
    const bucketName = 'chat-documents';
    const filePath = `${userId}/${crypto.randomUUID()}-${file.name}`;
    let fileData;
    if (file.data) {
      const binaryString = atob(file.data);
      fileData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileData[i] = binaryString.charCodeAt(i);
      }
    } else if (file.content) {
      fileData = new Blob([
        file.content
      ], {
        type: file.mimeType
      });
    } else {
      console.warn(`No data to upload for file: ${file.name}`);
      return null;
    }
    const { data, error } = await supabase.storage.from(bucketName).upload(filePath, fileData, {
      contentType: file.mimeType,
      upsert: false
    });
    if (error) {
      console.error('Error uploading file to Supabase Storage:', error);
      return null;
    }
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return publicUrlData?.publicUrl || null;
  } catch (error) {
    console.error('Error in uploadFileToStorage:', error);
    return null;
  }
}
/**
* Save file metadata to database
*/ async function saveFileToDatabase(file, userId) {
  let fileUrl = null;
  let contentExtracted = null;
  let processingStatus = file.processing_status || 'pending';
  let processingError = file.processing_error || null;
  const isDirectProcessType = [
    'text',
    'code',
    'csv',
    'markdown',
    'html',
    'xml',
    'json'
  ].includes(file.type);
  if (!isDirectProcessType) {
    fileUrl = await uploadFileToStorage(file, userId);
    if (!fileUrl) {
      processingStatus = 'failed';
      processingError = processingError || 'Failed to upload file to storage';
      console.error(`Failed to upload file ${file.name} to storage.`);
    }
  }
  // Content is now available for all processed types
  if (file.content && file.processing_status === 'completed') {
    contentExtracted = file.content;
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
      processing_error: processingError,
      processing_started_at: file.processing_started_at,
      processing_completed_at: file.processing_completed_at,
      extraction_model_used: file.extraction_model_used,
      total_processing_time_ms: file.total_processing_time_ms,
      processing_metadata: file.processing_metadata
    }).select('id').single();
    if (error) {
      console.error('Error saving file to database:', error);
      return null;
    }
    return data.id;
  } catch (error) {
    console.error('Database error when saving file:', error);
    return null;
  }
}
/**
* Save chat message to database with enhanced context tracking
*/ async function saveChatMessage({ userId, sessionId, content, role, attachedDocumentIds = null, attachedNoteIds = null, isError = false, imageUrl = null, imageMimeType = null, conversationContext = null }) {
  try {
    const { data, error } = await supabase.from('chat_messages').insert({
      user_id: userId,
      session_id: sessionId,
      content,
      role,
      attached_document_ids: attachedDocumentIds,
      attached_note_ids: attachedNoteIds,
      is_error: isError,
      image_url: imageUrl,
      image_mime_type: imageMimeType,
      conversation_context: conversationContext,
      timestamp: new Date().toISOString()
    }).select('id').single();
    if (error) {
      console.error('Error saving chat message:', error);
      return null;
    }
    return data.id;
  } catch (error) {
    console.error('Database error when saving chat message:', error);
    return null;
  }
}
async function ensureChatSession(userId, sessionId, newDocumentIds = []) {
  try {
    const { data: existingSession, error: fetchError } = await supabase.from('chat_sessions').select('id, document_ids, message_count, context_summary').eq('id', sessionId).eq('user_id', userId).single();
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching chat session:', fetchError);
      return;
    }
    if (existingSession) {
      // Update existing session
      if (newDocumentIds.length > 0) {
        const currentDocIds = existingSession.document_ids || [];
        const updatedDocIds = [
          ...new Set([
            ...currentDocIds,
            ...newDocumentIds
          ])
        ];
        updates.document_ids = updatedDocIds;
      }
      // Increment message count
      updates.message_count = (existingSession.message_count || 0) + 1;
      const { error: updateError } = await supabase.from('chat_sessions').update(updates).eq('id', sessionId);
      if (updateError) console.error('Error updating chat session:', updateError);
    } else {
      // Create new session
      const { error: insertError } = await supabase.from('chat_sessions').insert({
        id: sessionId,
        user_id: userId,
        title: 'New Chat',
        document_ids: newDocumentIds,
        message_count: 1,
        last_message_at: new Date().toISOString()
      }).select('id').single();
      if (insertError) console.error('Error creating chat session:', insertError);
    }
  } catch (error) {
    console.error('Database error when ensuring chat session:', error);
  }
}
/**
* Update session last message timestamp and context
*/ async function updateSessionLastMessage(sessionId, contextSummary = null) {
  try {
    if (contextSummary) {
      updates.context_summary = contextSummary;
    }
    const { error } = await supabase.from('chat_sessions').update(updates).eq('id', sessionId);
    if (error) console.error('Error updating session last message time:', error);
  } catch (error) {
    console.error('Database error when updating session:', error);
  }
}
/**
* Create system prompt for StuddyHub AI
*/ function createSystemPrompt(learningStyle, learningPreferences) {
  // Core Identity and Mission
  const coreIdentity = `
You are StuddyHub AI, a dynamic educational platform with advanced context-aware memory.
**CORE MISSION:** Deliver transformative learning through personalized paths, high-quality visualizations, and intuitive conversational guidance while maintaining full conversation context and continuity.

**CONTEXT AWARENESS:** You have access to the complete conversation history and can reference previous discussions, maintaining continuity across long conversations. When users ask about earlier parts of the conversation, you can recall and reference specific details.
`;
  // General Requirements
  const generalRequirements = `
**GENERAL REQUIREMENTS:**
- Production-quality, zero-error code with robust error handling.
- Educational clarity and excellence.
- WCAG 2.1 AA accessibility standards.
- Optimized performance and responsiveness.
- Consistent StuddyHub AI branding.
- Full conversation context awareness and continuity.
`;
  // UI Guidance
  const uiGuidance = `
**UI GUIDANCE:**
- Reference UI elements (e.g., "Click the Mic icon").
- Highlight features (e.g., "Upload files via the Paperclip button").
- Provide context-aware suggestions.
`;
  // Diagram Excellence Standards
  const diagramExcellence = `
**DIAGRAM EXCELLENCE:**
- Prioritize clear, accurate, and engaging visualizations.
- Use the appropriate diagram type for the data being presented.
- Ensure diagrams are accessible and responsive.
- All diagrams are going to be rendered in a diagram panel for codes blocks like listed below(threejs,dot,mermaids,html) using the expand button in your response rendered by the markdown codemrender so make sure to return correct codes without errors.
`;
  // Audio Excellence
  const audioExcellence = `
**FILE PROCESSING - AUDIO:**
- Transcribe accurately (spoken content, punctuation, speaker changes).
- Summarize key topics and metadata (audio type, language).
- Handle audio inputs (audio/mpeg, audio/wav) via base64-encoded data.
- Note unclear sections and provide partial transcription.
`;
  const mermaidExcellenceStandards = `
Strictly Adhere to Mermaid Diagram Rules:
**MERMAID DIAGRAM RULES:**
- Graph type declared? Nodes defined before connections? Valid syntax?
- Avoid parentheses in square brackets or in other parenthesis: This is a strict rule. Do not use parentheses within square brackets or nested within other parentheses in node labels. For example, use A[Start - User Auth] instead of A[Start (User Auth)] or A[Start (User: Auth)]. If parentheses are absolutely necessary for clarity, explore alternative label phrasing to avoid them altogether
- Use proper link styles: -->, ---, -.->, ==>.
**TEMPLATE:**
\`\`\`mermaid
flowchart TD
A[Start - User Authenticated] --> B{Check User Profile}
B -->|New User| C[Initialize Profile]
B -->|Returning User| D[Load Existing Data]
C --> E[Load Settings - Priority 1]
D --> E
E --> F[Phase Core - Progress 40%]
F --> G[Load Notes - Priority 2]
F --> H[Load Documents - Priority 3]
G --> I[Phase Secondary - Progress 80%]
H --> I
I --> J[UI Ready]
J --> K[Load Tab-Specific Content]
K -->|Notes Tab| L[Display Notes]
K -->|Quizzes Tab| M[Load Quizzes]
\`\`\``;
  const dotGraphExcellence = `
**DOT GRAPH RULES:**
- Start with digraph G { or graph G {; specify rankdir (e.g., LR, TB).
- Define nodes with labels: a [label="Node A"].
- Use edge syntax: -> (directed) or -- (undirected).
- Escape special characters in labels: "Node \\"A\\"".
**TEMPLATE:**
\`\`\`dot
digraph G {
rankdir=LR;
node [shape=rectangle, style=filled, fillcolor=lightblue];
A [label="Start"];
B [label="Process"];
A -> B [label="Next"];
}
\`\`\``;
  const chartJsExcellence = `
**CHART.JS RULES:**
- Supported chart types: bar, line, pie, doughnut, radar, polarArea, scatter.
- Numeric data in datasets.
- Set "maintainAspectRatio": false. Responsive design, tooltips, and legends.
**TEMPLATE:**
\`\`\`chartjs
{
"type": "bar",
"data": {
"labels": ["Q1", "Q2", "Q3"],
"datasets": [{
"label": "Progress",
"data": [75, 85, 95],
"backgroundColor": ["#3b82f6"]
}]
},
"options": {
"responsive": true,
"maintainAspectRatio": false,
"plugins": {
"legend": {"display": true},
"tooltip": {"enabled": true}
}
}
}
\`\`\``;
  const threeJsExcellence = `
**THREE.JS RULES:**
- Always name the function as createThreeJSScene
- Generate a complete JavaScript function named createThreeJSScene(canvas, THREE, OrbitControls, GLTLoader) that takes canvas, THREE, OrbitControls, and GLTLoader as parameters.
- Inside the function, define scene, camera, renderer, controls, and necessary lights (e.g., ambient and directional lights).
- Use MeshStandardMaterial for all materials to ensure consistent lighting.
- Do NOT define or call an animate function or include requestAnimationFrame within the function the caller (e.g., a React component) will handle starting and managing the animation loop.
- Apply per-frame updates (e.g., object rotation, position changes) directly to objects in the scene if needed, to be rendered by the caller's animation loop.
- Load textures from a public CDN (e.g., https://cdn.jsdelivr.net) if needed, with fallback solid colors if texture loading fails. Handle texture loading errors gracefully (e.g., log errors and apply fallback).
- Implement a cleanup function to dispose of geometries, materials, textures, and the renderer to prevent memory leaks.
- Return exactly { scene, renderer, camera, controls, cleanup } at the end of the function.
- Ensure the code is production-quality, syntactically correct, and compatible with execution via new Function in a React component.
- Do not include any external file I/O or network calls beyond texture loading from a CDN.
- Avoid duplicate animation loops or any self-calling animation logic within the function.

**TEMPLATE:**
\`\`\`threejs
function createThreeJSScene(canvas, THREE, OrbitControls, GLTLoader) {
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvas.clientWidth / canvas.clientHeight);
renderer.setClearColor(0x282c34);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

const geometry = new THREE.BoxGeometry(1, 1, 1);
let material;
try {
const texture = new THREE.TextureLoader().load(
'https://threejs.org/examples/textures/uv_grid_opengl.jpg',
undefined,
undefined,
(error) => {
console.error('Texture loading failed:', error);
}
);
material = new THREE.MeshStandardMaterial({ map: texture, color: 0x00ff00 });
} catch (error) {
console.error('Texture loading error:', error);
material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
}
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Apply per-frame updates for the caller's animation loop
cube.rotation.x += 0.01;
cube.rotation.y += 0.01;

const cleanup = () => {
scene.traverse((obj) => {
if (obj.isMesh) {
if (obj.geometry) obj.geometry.dispose();
if (obj.material) {
if (Array.isArray(obj.material)) {
obj.material.forEach(mat => {
if (mat.map) mat.map.dispose();
mat.dispose();
});
} else {
if (obj.material.map) obj.material.map.dispose();
obj.material.dispose();
}
}
}
});
renderer.dispose();
};

return { scene, renderer, camera, controls, cleanup };
}
\`\`\`
`;
  const htmlExcellence = `
**HTML RULES:**
- Semantic HTML5, ARIA labels, mobile-first design (Tailwind CSS: blue-500, gray-100).
- Avoid local storage. Cross-browser compatibility.
**TEMPLATE:**
\`\`\`html
<section class="bg-blue-500 text-white p-6 rounded-lg" role="region" aria-label="Study Content">
<h2 class="text-xl font-bold">Welcome to StuddyHub AI</h2>
<p>Click the Mic icon to ask a question or uploada question or upload notes via the Paperclip button.</p>
</section>
\`\`\``;
  const slidesExcellence = `
**SLIDE GENERATION RULES:**
- JSON format: [{title: string, content: string | string[], layout?: string}].
- Concise content.
**TEMPLATE (JSON):**
\`\`\`slides
[
{
"title": "Introduction to AI",
"content": ["What is AI?", "History of AI", "Key Concepts"],
"layout": "title-and-bullets"
},
{
"title": "Machine Learning Basics",
"content": "Machine Learning is a subset of AI that enables systems to learn from data. It involves algorithms that build a model from example data.",
"layout": "title-and-text"
},
{
"title": "Deep Learning Architectures",
"content": "- Neural Networks\\n- Convolutional Neural Networks (CNNs)\\n- Recurrent Neural Networks (RNNs)",
"layout": "title-and-markdown-bullets"
}
]
\`\`\``;
  const conversationalExcellence = `
**CONVERSATIONAL STYLE:**
- Warm, encouraging, professional tone (mentoring).
- Discovery questions ("Have you worked with async functions before?").
- Progressive concept building (real-world examples).
- Encourage experimentation ("Try tweaking this code in the StuddyHub Code Editor!").
- Reference previous conversation parts when relevant.
- Maintain context awareness throughout long conversations.
`;
  const adaptiveLearningSystem = `
**ADAPTIVE LEARNING:**
- Tailor content to ${learningStyle}:
- Visual: Prioritize diagrams (Mermaid, Chart.js), visual examples.
- Auditory: Narrative explanations, voice interactions ("Use the Mic icon").
- Kinesthetic: Interactive tasks ("Modify this code in the Code Editor").
- Reading/Writing: Text explanations and references.
- Difficulty: ${learningPreferences?.difficulty || 'intermediate'} (beginner, intermediate, advanced).
- Analyze user input, extract key concepts, deliver multi-modal content.
- Suggest next steps ("Explore the Quizzes Tab").
- Remember user preferences and adapt based on conversation history.
`;
  const errorPreventionProtocols = `
**ERROR PREVENTION:**
- Validate code/visualizations (Mermaid Live Editor, browser dev tools).
- Implement error handling (try-catch, fallback data).
- Self-correct errors conversationally ("I noticed a syntax issue...").
- Test responsiveness and accessibility.
`;
  const professionalStandards = `
**STANDARDS:**
- Enterprise-grade code (clear comments, modular).
- Accurate, concise, engaging educational content.
- StuddyHub AI branding (blue-500). Intuitive UX (clear feedback).
`;
  const executionFramework = `
**RESPONSE FRAMEWORK:**
1. Analyze user context and knowledge.
2. Design tailored solution.
3. Generate validated, error-free code/visuals.
4. Engage conversationally with context awareness.
5. Adapt based on feedback and conversation history.
`;
  const finalSystemIntegration = `
**COMMITMENT:**
- Cutting-edge, intelligent responses.
- Educational and technical excellence.
- Human connection with full context awareness.
- High-quality, error-free deliverables.
- Perfect conversation continuity and memory.
`;
  return `
${coreIdentity}
${generalRequirements}
${uiGuidance}
${diagramExcellence}
${audioExcellence}
${mermaidExcellenceStandards}
${dotGraphExcellence}
${chartJsExcellence}
${threeJsExcellence}
${htmlExcellence}
${slidesExcellence}
${conversationalExcellence}
${adaptiveLearningSystem}
${errorPreventionProtocols}
${professionalStandards}
${executionFramework}
${finalSystemIntegration}
`;
}
/**
* Build context-aware conversation for Gemini API
*/ async function buildGeminiConversation(userId, sessionId, currentMessage, files = [], attachedContext = '', systemPrompt = '') {
  // Get intelligent conversation context
  const contextData = await buildIntelligentContext(userId, sessionId, currentMessage);
  // Start with system prompt
  const geminiContents = [
    {
      role: 'user',
      parts: [
        {
          text: systemPrompt
        }
      ]
    }
  ];
  // Add conversation summary if available
  if (contextData.conversationSummary) {
    geminiContents.push({
      role: 'user',
      parts: [
        {
          text: `CONVERSATION CONTEXT SUMMARY:\n${contextData.conversationSummary}\n\n[The above is a summary of earlier messages. The following are recent messages:]`
        }
      ]
    });
  }
  // Add recent conversation history
  if (contextData.recentMessages && contextData.recentMessages.length > 0) {
    for (const msg of contextData.recentMessages) {
      if (msg.role === 'user') {
        const userParts = [
          {
            text: msg.content || ''
          }
        ];
        // Add image if present
        if (msg.image_url && msg.image_mime_type) {
          // Note: We can't directly add images from URLs to Gemini,
          // so we include a reference in the text
          userParts[0].text += `\n[User shared an image: ${msg.image_url}]`;
        }
        geminiContents.push({
          role: 'user',
          parts: userParts
        });
      } else if (msg.role === 'assistant' || msg.role === 'model') {
        geminiContents.push({
          role: 'model',
          parts: [
            {
              text: msg.content || ''
            }
          ]
        });
      }
    }
  }
  // Add current message with full content
  if (currentMessage || files.length > 0 || attachedContext) {
    const currentMessageParts = [];
    if (currentMessage) {
      currentMessageParts.push({
        text: currentMessage
      });
    }
    if (attachedContext) {
      currentMessageParts.push({
        text: `\n\nATTACHED CONTEXT:\n${attachedContext}`
      });
    }
    // Add processed file content
    for (const file of files) {
      if (file.type === 'image' && file.data) {
        currentMessageParts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.data
          }
        });
      } else if (file.content) {
        const fileTypeLabel = file.type.toUpperCase();
        currentMessageParts.push({
          text: `\n\n[File: ${file.name} (${fileTypeLabel}) Content Start]\n${file.content}\n[File Content End]`
        });
      }
    }
    if (currentMessageParts.length > 0) {
      geminiContents.push({
        role: 'user',
        parts: currentMessageParts
      });
    }
  }
  console.log(`Built conversation context with ${contextData.totalMessages} total messages (${contextData.recentMessages?.length || 0} recent, ${contextData.summarizedMessages || 0} summarized)`);
  return {
    contents: geminiContents,
    contextInfo: contextData
  };
}
/**
* Main server handler
*/ serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const startTime = Date.now();
  let requestData = null;
  let files = [];
  let uploadedDocumentIds = [];
  let userMessageImageUrl = null;
  let userMessageImageMimeType = null;
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      requestData = {
        userId: formData.get('userId'),
        sessionId: formData.get('sessionId'),
        learningStyle: formData.get('learningStyle'),
        learningPreferences: formData.get('learningPreferences') ? JSON.parse(formData.get('learningPreferences')) : {},
        chatHistory: formData.get('chatHistory') ? JSON.parse(formData.get('chatHistory')) : [],
        message: formData.get('message') || '',
        files: [],
        attachedDocumentIds: formData.get('attachedDocumentIds') ? JSON.parse(formData.get('attachedDocumentIds')) : [],
        attachedNoteIds: formData.get('attachedNoteIds') ? JSON.parse(formData.get('attachedNoteIds')) : [],
        imageUrl: formData.get('imageUrl'),
        imageMimeType: formData.get('imageMimeType'),
        aiMessageIdToUpdate: formData.get('aiMessageIdToUpdate')
      };
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const processedFile = await processFile(value);
          if (processedFile) files.push(processedFile);
        }
      }
    } else if (contentType.includes('application/json')) {
      const responseBody = await req.text();
      try {
        requestData = JSON.parse(responseBody);
      } catch (e) {
        console.error("Failed to parse JSON", e);
        return new Response(JSON.stringify({
          error: 'Invalid JSON in request body'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      if (requestData.files && Array.isArray(requestData.files)) {
        for (const fileData of requestData.files) {
          const processedFile = await processBase64File(fileData);
          if (processedFile) files.push(processedFile);
        }
      }
    } else {
      return new Response(JSON.stringify({
        error: 'Unsupported content type'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    const { userId, sessionId, learningStyle = 'visual', learningPreferences = {}, message = '', attachedDocumentIds = [], attachedNoteIds = [], imageUrl = null, imageMimeType = null, aiMessageIdToUpdate = null } = requestData;
    if (!userId || !sessionId) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: userId or sessionId'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
    console.log(`Starting processing of ${files.length} files with context-aware memory...`);
    // Use enhanced batch processing with zero truncation
    await enhancedBatchProcessing(files, geminiApiKey, userId);
    // Save processed files to database
    for (const file of files) {
      const documentId = await saveFileToDatabase(file, userId);
      if (documentId) {
        uploadedDocumentIds.push(documentId);
        // Set image URL for user message if this is an image
        if (file.type === 'image' && !userMessageImageUrl) {
          const { data: docData, error: docError } = await supabase.from('documents').select('file_url, file_type').eq('id', documentId).single();
          if (docData && !docError) {
            userMessageImageUrl = docData.file_url;
            userMessageImageMimeType = docData.file_type;
          }
        }
      }
    }
    // Combine all document IDs
    const allDocumentIds = [
      ...new Set([
        ...uploadedDocumentIds,
        ...attachedDocumentIds
      ])
    ];
    // Ensure chat session exists with enhanced context management
    await ensureChatSession(userId, sessionId, allDocumentIds);
    // Build attached context with full content (no truncation)
    let attachedContext = '';
    if (allDocumentIds.length > 0 || attachedNoteIds.length > 0) {
      attachedContext = await buildAttachedContext(allDocumentIds, attachedNoteIds, userId);
    }
    // Create system prompt
    const systemPrompt = createSystemPrompt(learningStyle, learningPreferences);
    // Build context-aware conversation
    const conversationData = await buildGeminiConversation(userId, sessionId, message, files, attachedContext, systemPrompt);
    // Save user message with context info
    if (message || files.length > 0 || attachedContext) {
      const userMessageData = {
        userId,
        sessionId,
        content: message,
        role: 'user',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        imageUrl: userMessageImageUrl || imageUrl,
        imageMimeType: userMessageImageMimeType || imageMimeType,
        conversationContext: {
          totalMessages: conversationData.contextInfo.totalMessages,
          recentMessages: conversationData.contextInfo.recentMessages?.length || 0,
          summarizedMessages: conversationData.contextInfo.summarizedMessages || 0,
          hasSummary: !!conversationData.contextInfo.conversationSummary
        }
      };
      await saveChatMessage(userMessageData);
    }
    // Mark AI message as updating if specified
    if (aiMessageIdToUpdate) {
      await supabase.from('chat_messages').update({
        is_updating: true,
        is_error: false
      }).eq('id', aiMessageIdToUpdate).eq('session_id', sessionId).eq('user_id', userId);
    }
    // Call Gemini API with context-aware conversation
    const geminiApiUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    geminiApiUrl.searchParams.append('key', geminiApiKey);
    const response = await fetch(geminiApiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: conversationData.contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: ENHANCED_PROCESSING_CONFIG.MAX_OUTPUT_TOKENS
        }
      })
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorBody}`);
      const errorMessageData = {
        userId,
        sessionId,
        content: `Error: Failed to get response from Gemini API: ${response.statusText}`,
        role: 'assistant',
        isError: true,
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        imageUrl: userMessageImageUrl || imageUrl,
        imageMimeType: userMessageImageMimeType || imageMimeType
      };
      if (aiMessageIdToUpdate) {
        await supabase.from('chat_messages').update({
          content: errorMessageData.content,
          is_error: true,
          is_updating: false
        }).eq('id', aiMessageIdToUpdate).eq('session_id', sessionId).eq('user_id', userId);
      } else {
        await saveChatMessage(errorMessageData);
      }
      throw new Error(`Failed to get response from Gemini API: ${response.statusText}. Details: ${errorBody}`);
    }
    const data = await response.json();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    // Clean up the generated text
    generatedText = generatedText.split('\n').map((line) => line.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ').trim()).filter((line) => line.length > 0 || line.trim().length === 0).join('\n');
    // Save assistant message with context info
    const assistantMessageData = {
      userId,
      sessionId,
      content: generatedText,
      role: 'assistant',
      attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
      attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
      imageUrl: userMessageImageUrl || imageUrl,
      imageMimeType: userMessageImageMimeType || imageMimeType,
      conversationContext: {
        totalMessages: conversationData.contextInfo.totalMessages + 1,
        recentMessages: conversationData.contextInfo.recentMessages?.length || 0,
        summarizedMessages: conversationData.contextInfo.summarizedMessages || 0,
        hasSummary: !!conversationData.contextInfo.conversationSummary
      }
    };
    if (aiMessageIdToUpdate) {
      await supabase.from('chat_messages').update({
        content: generatedText,
        is_updating: false,
        is_error: false,
        conversation_context: assistantMessageData.conversationContext
      }).eq('id', aiMessageIdToUpdate).eq('session_id', sessionId).eq('user_id', userId);
    } else {
      await saveChatMessage(assistantMessageData);
    }
    // Update session timestamp with context summary if available
    await updateSessionLastMessage(sessionId, conversationData.contextInfo.conversationSummary);
    const processingTime = Date.now() - startTime;
    return new Response(JSON.stringify({
      response: generatedText,
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      processingTime,
      filesProcessed: files.length,
      documentIds: allDocumentIds,
      contextInfo: {
        totalMessages: conversationData.contextInfo.totalMessages,
        recentMessages: conversationData.contextInfo.recentMessages?.length || 0,
        summarizedMessages: conversationData.contextInfo.summarizedMessages || 0,
        hasSummary: !!conversationData.contextInfo.conversationSummary
      },
      processingResults: files.map((f) => ({
        name: f.name,
        type: f.type,
        status: f.processing_status,
        error: f.processing_error
      }))
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Error in gemini-chat function:', error);
    // Save error message to database if possible
    if (requestData?.userId && requestData?.sessionId) {
      try {
        await saveChatMessage({
          userId: requestData.userId,
          sessionId: requestData.sessionId,
          content: `System Error: ${error.message || 'Internal Server Error'}`,
          role: 'assistant',
          isError: true,
          attachedDocumentIds: uploadedDocumentIds.length > 0 ? uploadedDocumentIds : null,
          attachedNoteIds: requestData.attachedNoteIds?.length > 0 ? requestData.attachedNoteIds : null,
          imageUrl: userMessageImageUrl || requestData.imageUrl,
          imageMimeType: userMessageImageMimeType || requestData.imageMimeType
        });
      } catch (dbError) {
        console.error('Failed to save error message to database:', dbError);
      }
    }
    return new Response(JSON.stringify({
      error: error.message || 'Internal Server Error',
      processingTime,
      filesProcessed: files.length
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
