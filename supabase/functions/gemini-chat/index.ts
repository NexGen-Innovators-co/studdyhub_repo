import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import mammoth from 'https://esm.sh/mammoth@1.6.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import JSZIP from 'https://esm.sh/jszip@3.10.1';
import xml2js from 'https://esm.sh/xml2js@0.5.0';
import { encode, decode } from "npm:gpt-tokenizer";
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
  MAX_CONVERSATION_HISTORY: 1000,
  CONTEXT_MEMORY_WINDOW: 30,
  SUMMARY_THRESHOLD: 10,
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
    strategy: 'local_extract_and_chunk',
    priority: 2,
    maxSize: 200 * 1024 * 1024
  },
  'application/msword': {
    type: 'document',
    strategy: 'local_extract_and_chunk',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    type: 'document',
    strategy: 'local_extract_and_chunk',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.ms-excel': {
    type: 'spreadsheet',
    strategy: 'local_extract_and_chunk',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    type: 'spreadsheet',
    strategy: 'local_extract_and_chunk',
    priority: 2,
    maxSize: 50 * 1024 * 1024
  },
  'application/vnd.ms-powerpoint': {
    type: 'presentation',
    strategy: 'local_extract_and_chunk',
    priority: 2,
    maxSize: 100 * 1024 * 1024
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    type: 'presentation',
    strategy: 'local_extract_and_chunk',
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
// Function to calculate the base token count (system prompt, attached context)
const calculateBaseTokenCount = async (assembledSystemPrompt, attachedContext) => {
  let baseTokenCount = 0;
  if (assembledSystemPrompt) baseTokenCount += await calculateTokenCount(assembledSystemPrompt);
  if (attachedContext) baseTokenCount += await calculateTokenCount(attachedContext);
  return baseTokenCount;
};
// Function to calculate token count
async function calculateTokenCount(text) {
  try {
    const encoded = encode(text);
    return encoded.length;
  } catch (error) {
    console.error("Error calculating token count:", error);
    // Fallback to word count in case of error
    return text.split(/\s+/).length;
  }
}
// Function to truncate text to a token limit
async function truncateToTokenLimit(text, maxTokens) {
  try {
    const encoded = encode(text);
    if (encoded.length <= maxTokens) {
      return text;
    } else {
      const truncatedEncoded = encoded.slice(0, maxTokens);
      const truncatedText = decode(truncatedEncoded);
      return truncatedText + " [TRUNCATED]";
    }
  } catch (error) {
    console.error("Error truncating text:", error);
    // Fallback: Truncate by words if tokenization fails
    const words = text.split(/\s+/);
    if (words.length <= maxTokens) {
      return text;
    } else {
      return words.slice(0, maxTokens).join(" ") + " [TRUNCATED]";
    }
  }
}
async function createConversationSummary(messages, userId, sessionId) {
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
    console.log(`[createConversationSummary] Creating summary for session ${sessionId}, user ${userId}, message count: ${messages.length}`); // Added log
    const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
    if (response.success && response.content) {
      // Save the summary to the chat_sessions table
      const { error } = await supabase.from('chat_sessions').update({
        context_summary: response.content,
        updated_at: new Date().toISOString()
      }).eq('id', sessionId).eq('user_id', userId);
      if (error) {
        console.error('[createConversationSummary] Error saving conversation summary:', error);
      } else {
        console.log(`[createConversationSummary] Conversation summary saved for session ${sessionId}`);
      }
      return response.content;
    } else {
      console.error('[createConversationSummary] Gemini API call failed:', response.error); // Added log
    }
  } catch (error) {
    console.error('[createConversationSummary] Error creating conversation summary:', error);
  }
  return null;
}
async function updateConversationSummary(existingSummary, recentMessages, userId, sessionId) {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) return existingSummary;
  const messageTexts = recentMessages.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n');
  const updatePrompt = `Update the existing conversation summary with new messages while preserving all important context:

EXISTING SUMMARY:
${existingSummary}

NEW MESSAGES TO INTEGRATE:
${messageTexts}

UPDATE REQUIREMENTS:
1. Merge new information with existing summary
2. Maintain chronological flow and context
3. Preserve all important facts and decisions from both old and new content
4. Keep user preferences and technical details
5. Highlight any new developments or changes
6. Maintain concise but comprehensive format (max 1200 words)
7. Ensure continuity between old and new information

FORMAT: Provide an updated comprehensive summary that includes both existing and new context.`;
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: updatePrompt
        }
      ]
    }
  ];
  try {
    console.log(`[updateConversationSummary] Updating summary for session ${sessionId}, user ${userId}, message count: ${recentMessages.length}`); // Added log
    const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
    if (response.success && response.content) {
      // Save the updated summary to the chat_sessions table
      const { error } = await supabase.from('chat_sessions').update({
        context_summary: response.content,
        updated_at: new Date().toISOString()
      }).eq('id', sessionId).eq('user_id', userId);
      if (error) {
        console.error('[updateConversationSummary] Error saving updated conversation summary:', error);
        return existingSummary; // Return old summary if save fails
      } else {
        console.log(`[updateConversationSummary] Conversation summary updated for session ${sessionId}`);
      }
      return response.content;
    } else {
      console.error('[updateConversationSummary] Gemini API call failed:', response.error); // Added log
    }
  } catch (error) {
    console.error('[updateConversationSummary] Error updating conversation summary:', error);
  }
  return existingSummary; // Return existing summary if update fails
}
/**
* Intelligent context management with conversation summarization
*/ async function buildIntelligentContext(userId, sessionId, currentMessage, attachedDocumentIds = [], attachedNoteIds = [], initialContextWindow = ENHANCED_PROCESSING_CONFIG.CONTEXT_MEMORY_WINDOW) {
  const conversationHistory = await getConversationHistory(userId, sessionId);
  // If conversation is short, include all messages
  if (conversationHistory.length <= initialContextWindow) {
    console.log('[buildIntelligentContext] Short conversation - including all messages in context');
    return {
      recentMessages: conversationHistory,
      conversationSummary: null,
      totalMessages: conversationHistory.length
    };
  }
  // For longer conversations, implement intelligent context management
  const recentMessages = conversationHistory.slice(-initialContextWindow);
  const olderMessages = conversationHistory.slice(0, -initialContextWindow);
  // Get existing summary from database first
  let conversationSummary = null;
  try {
    const { data: sessionData, error } = await supabase.from('chat_sessions').select('context_summary').eq('id', sessionId).eq('user_id', userId).single();
    if (error) {
      console.error('[buildIntelligentContext] Error fetching existing summary:', error);
    } else if (sessionData?.context_summary) {
      conversationSummary = sessionData.context_summary;
      console.log('[buildIntelligentContext] Using existing conversation summary from database');
    } else {
      console.log('[buildIntelligentContext] No existing conversation summary found in database.');
    }
  } catch (error) {
    console.error('[buildIntelligentContext] Error fetching existing summary:', error);
  }
  // Log key variables for debugging
  console.log(`[buildIntelligentContext] Conversation length: ${conversationHistory.length}, CONTEXT_MEMORY_WINDOW: ${initialContextWindow}, SUMMARY_THRESHOLD: ${ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD}`);
  console.log(`[buildIntelligentContext] Older messages length: ${olderMessages.length}, Conversation summary exists: ${!!conversationSummary}`);
  // Simplified summary update logic: Update every UPDATE_SUMMARY_INTERVAL messages
  const shouldUpdateSummary = olderMessages.length > ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD;
  if (shouldUpdateSummary) {
    try {
      if (!conversationSummary) {
        // Create initial summary
        console.log('[buildIntelligentContext] Creating initial conversation summary.');
        conversationSummary = await createConversationSummary(olderMessages, userId, sessionId);
        console.log(`[buildIntelligentContext] Created new conversation summary for ${olderMessages.length} older messages`);
      } else {
        // Update existing summary every UPDATE_SUMMARY_INTERVAL messages
        console.log(`[buildIntelligentContext] Updating conversation summary to include ${olderMessages.length} messages`);
        conversationSummary = await updateConversationSummary(conversationSummary, olderMessages, userId, sessionId);
      }
    } catch (error) {
      console.error('[buildIntelligentContext] Error managing conversation summary:', error);
    }
  } else {
    console.log('[buildIntelligentContext] Not enough older messages to update summary.');
  }
  return {
    recentMessages,
    conversationSummary,
    totalMessages: conversationHistory.length,
    summarizedMessages: olderMessages.length
  };
}
// ** BUILD GEMINI CONVERSATION (Modified) **
/**
* Enhanced conversation history retrieval with better error handling
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
      `).eq('user_id', userId).eq('session_id', sessionId).eq('is_error', false) // Exclude error messages from context
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
* Extract text from PPTX files using JSZIP and DOMParser
*/ async function extractPptxText(buffer) {
  try {
    const zip = await JSZIP.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter((f) => f.startsWith('ppt/slides/slide')).sort((a, b) => {
      const aNum = parseInt(a.split('slide')[1].split('.xml')[0], 10);
      const bNum = parseInt(b.split('slide')[1].split('.xml')[0], 10);
      return aNum - bNum;
    });
    let text = '';
    for (const slideFile of slideFiles) {
      const xml = await zip.file(slideFile).async('string');
      const result = await xml2js.parseStringPromise(xml);
      text += `Slide: ${slideFile.match(/slide(\d+)\.xml/)[1]}\n`;
      const shapes = result['p:sld']?.['p:cSld']?.[0]?.['p:spTree']?.[0]?.['p:sp'] || [];
      for (const shape of shapes) {
        const paragraphs = shape['p:txBody']?.[0]?.['a:p'] || [];
        for (const paragraph of paragraphs) {
          const runs = paragraph['a:r'] || [];
          for (const run of runs) {
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
    console.error('Error extracting PPTX text:', error);
    return '[Error extracting text from PPTX]';
  }
}
/**
* Process documents locally with library extraction and optional chunking
*/ /**
 * Process documents locally with library extraction and optional chunking
 */ async function processLocalDocumentWithExtractionAndChunking(file, geminiApiKey) {
  const buffer = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  let extractedText = '';
  try {
    if (file.mimeType === 'application/pdf') {
      // Skip local PDF processing due to Deno incompatibility and fallback to Gemini
      return await processDocumentWithExtractionAndChunking(file, geminiApiKey);
    } else if (file.mimeType === 'application/msword' || file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({
        arrayBuffer: buffer
      });
      extractedText = result.value;
    } else if (file.mimeType === 'application/vnd.ms-excel' || file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const workbook = XLSX.read(buffer, {
        type: 'array'
      });
      extractedText = '';
      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        extractedText += `Sheet ${index + 1}: ${sheetName}\n`;
        extractedText += XLSX.utils.sheet_to_txt(sheet) + '\n\n';
      });
    } else if (file.mimeType === 'application/vnd.ms-powerpoint' || file.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      extractedText = await extractPptxText(buffer);
    } else {
      // Fallback to Gemini if no local library supports it
      return await processDocumentWithExtractionAndChunking(file, geminiApiKey);
    }
    if (extractedText.length <= ENHANCED_PROCESSING_CONFIG.INTELLIGENT_CHUNK_SIZE) {
      file.content = extractedText;
    } else {
      // If large, chunk and process with Gemini for enhanced summarization or fidelity
      const chunks = createIntelligentChunks(extractedText, file.type);
      const prompt = EXTRACTION_PROMPTS[file.type] || EXTRACTION_PROMPTS.document;
      file.content = await processChunkedContent(chunks, prompt, geminiApiKey);
    }
  } catch (error) {
    console.error(`Local extraction failed for ${file.name}:`, error);
    // Fallback to Gemini API on any local processing error
    return await processDocumentWithExtractionAndChunking(file, geminiApiKey);
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
      case 'local_extract_and_chunk':
        await processLocalDocumentWithExtractionAndChunking(file, geminiApiKey);
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
*/ async function saveChatMessage({ userId, sessionId, content, role, attachedDocumentIds = null, attachedNoteIds = null, isError = false, imageUrl = null, imageMimeType = null, conversationContext = null, filesMetadata = null // Add filesMetadata parameter
}) {
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
      timestamp: new Date().toISOString(),
      files_metadata: filesMetadata // Save file metadata
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
const generateChatTitle = async (sessionId, userId, initialMessage) => {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) return 'New Chat';
  const titlePrompt = `Create a concise and informative title (max 8 words) for a chat session. The title should summarize the main topic or question discussed in the following initial message: "${initialMessage}". The title should be in sentence case, not all caps. Return ONLY the title text itself, with no extra words or explanation. Example: 'Understanding Quantum Physics'`;
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: titlePrompt
        }
      ]
    }
  ];
  try {
    const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
    console.log('[generateChatTitle] Gemini API Response:', response); // Added log
    if (response.success && response.content) {
      let generatedTitle = response.content.trim();
      // Refine title extraction: Remove any leading/trailing quotes and ensure it's sentence case
      generatedTitle = generatedTitle.replace(/^["']|["']$/g, ''); // Remove leading/trailing quotes
      generatedTitle = generatedTitle.charAt(0).toUpperCase() + generatedTitle.slice(1); // Sentence case
      if (generatedTitle.length > 50) {
        generatedTitle = generatedTitle.substring(0, 47) + '...';
      }
      return generatedTitle;
    } else {
      console.error('Failed to generate chat title:', response.error);
      // Fallback: Extract a few words from the initial message
      const words = initialMessage.split(' ');
      const fallbackTitle = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
      return fallbackTitle || 'New Chat';
    }
  } catch (error) {
    console.error('Error generating chat title:', error);
    // Fallback: Extract a few words from the initial message
    const words = initialMessage.split(' ');
    const fallbackTitle = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
    return fallbackTitle || 'New Chat';
  }
};
async function ensureChatSession(userId, sessionId, newDocumentIds = [], initialMessage = '') {
  try {
    const { data: existingSession, error: fetchError } = await supabase.from('chat_sessions').select('id, document_ids, message_count, context_summary, title') // Include title in select
      .eq('id', sessionId).eq('user_id', userId).single();
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching chat session:', fetchError);
      return;
    }
    if (existingSession) {
      // Update existing session
      const updates = {
        document_ids: newDocumentIds,
        message_count: existingSession.message_count || 0,
        title: existingSession.title || ''
      };
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
      // If this is the first message and title isn't set, generate it
      if (!existingSession.title && initialMessage) {
        updates.title = await generateChatTitle(sessionId, userId, initialMessage);
      }
      const { error: updateError } = await supabase.from('chat_sessions').update(updates).eq('id', sessionId);
      if (updateError) console.error('Error updating chat session:', updateError);
    } else {
      // Create new session with title from initial message
      const newTitle = initialMessage ? await generateChatTitle(sessionId, userId, initialMessage) : 'New Chat';
      const { error: insertError } = await supabase.from('chat_sessions').insert({
        id: sessionId,
        user_id: userId,
        title: newTitle,
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
async function updateSessionLastMessage(sessionId, contextSummary = null, title = null) {
  try {
    const update = {
      last_message_at: new Date().toISOString(),
      context_summary: contextSummary,
      title: title || 'New chat'
    };
    if (contextSummary) {
      update.context_summary = contextSummary;
    }
    if (title) {
      update.title = title;
    }
    const { error } = await supabase.from('chat_sessions').update(update).eq('id', sessionId);
    if (error) console.error('Error updating session last message time:', error);
  } catch (error) {
    console.error('Database error when updating session:', error);
  }
}
/**
* Create system prompt for StuddyHub AI
*/ function createSystemPrompt(learningStyle, learningPreferences, currentTheme = 'light') {
  // Core Identity and Mission
  console.log(learningPreferences, learningStyle);
  const coreIdentity = `
You are StuddyHub AI, a dynamic educational platform with advanced context-aware memory in the studdyHub Ai Chat Section as the ai for the StuddyHub app.
**CORE MISSION:** Deliver transformative learning through personalized paths, high-quality visualizations, and intuitive conversational guidance while maintaining full conversation context and continuity. You should provide helpful responses about the usage, features, and troubleshooting of the StuddyHub application.

**CONTEXT AWARENESS:** You have access to the complete conversation history and can reference previous discussions, maintaining continuity across long conversations. When users ask about earlier parts of the conversation, you can recall and reference specific details.

The StuddyHub application is a React-based learning platform with the following key features:

- **Dashboard:** Provides an overview of the user's learning activity, progress, and quick actions. Key metrics include total notes, recordings, document count, and AI conversations. Quick actions allow users to create new notes, recordings, documents, or schedule events.
- **Notes:** Allows users to create, edit, and categorize notes. Notes can be organized by category (All Notes, General, Math, Science, History, Language, Other).
- **Recordings:** Enables users to record class sessions, upload audio files, and generate quizzes and summaries.
- **Schedule:** Helps users plan their study time with a schedule and timetable feature.
- **AI Chat:** An AI assistant that can answer questions, provide explanations, and assist with learning tasks. It supports file uploads, document linking, and note linking for context.
- **Documents:** Allows users to upload and manage various learning materials (PDFs, text files, etc.).
- **Social:** A social feed where users can share their progress and engage with other learners (feature under development).
- **Settings:** Allows users to customize their profile and learning preferences (learning style, explanation style, difficulty, etc.).
- **Authentication:** Uses Supabase for user authentication and data storage.

The application uses the following libraries and frameworks:

- React: For building the user interface.
- Tailwind CSS: For styling the components.
- Lucide React: For icons.
- Framer Motion: For animations.
- Chart.js: For creating charts and graphs.
- Three.js: For rendering 3D scenes.
- React Markdown: For rendering Markdown content.
- React Syntax Highlighter: For code syntax highlighting.
- Supabase: For backend services (authentication, database, storage).
- Sonner: For toast notifications.

The application uses the following data structures:

- UserProfile: {id: string, full_name: string, avatar_url: string, learning_style: string, learning_preferences: {explanation_style: string, examples: boolean, difficulty: string}}
- Note: {id: string, title: string, category: string, content: string, ai_summary: string, created_at: string}
- ClassRecording: {id: string, title: string, subject: string, date: string, duration: number, audioUrl: string, document_id: string}
- ScheduleItem: {id: string, title: string, subject: string, type: string, startTime: string, endTime: string, location: string, description: string}
- Message: {id: string, content: string, role: string, timestamp: string, attachedDocumentIds: string[], attachedNoteIds: string[]}
- ChatSession: {id: string, title: string, created_at: string, updated_at: string, lastMessageAt: string, documentIds: string[]}
- Quiz: {id: string, classId: string, questions: {question: string, options: string[], correctAnswer: string}[]}
- Document: {id: string, title: string, file_name: string, file_url: string, file_type: string, file_size: number, content_extracted: string, type: string, processing_status: string, processing_error: string}
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
- When asked about code or features, provide relevant details about the components, data structures, and libraries used.
`;
  const colorSystem = `
**INTELLIGENT COLOR SYSTEM:**

**Light Theme Palette:**
- Primary: #3B82F6 (StuddyHub Blue), #1E40AF (Deep Blue)
- Accent: #10B981 (Emerald), #F59E0B (Amber), #EF4444 (Red)
- Background: #FFFFFF, #F8FAFC, #F1F5F9
- Text: #0F172A, #334155, #64748B
- Border: #E2E8F0, #CBD5E1
- Success: #10B981, Warning: #F59E0B, Error: #EF4444
- Gradients: linear-gradient(135deg, #667eea 0%, #764ba2 100%)

**Dark Theme Palette:**
- Primary: #60A5FA (Light Blue), #3B82F6 (StuddyHub Blue)
- Accent: #34D399 (Light Emerald), #FBBF24 (Light Amber), #F87171 (Light Red)
- Background: #0F172A, #1E293B, #334155
- Text: #F8FAFC, #E2E8F0, #CBD5E1
- Border: #475569, #64748B
- Success: #34D399, Warning: #FBBF24, Error: #F87171
- Gradients: linear-gradient(135deg, #667eea 0%, #764ba2 100%)

**Semantic Colors (Theme Adaptive):**
- Info: Light(#3B82F6) / Dark(#60A5FA)
- Success: Light(#10B981) / Dark(#34D399)
- Warning: Light(#F59E0B) / Dark(#FBBF24)
- Error: Light(#EF4444) / Dark(#F87171)
- Neutral: Light(#6B7280) / Dark(#9CA3AF)
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
**MERMAID DIAGRAM EXCELLENCE:**

**Visual Standards:**
- Use theme-appropriate colors automatically
- Apply consistent node shapes and styling
- Implement professional spacing and alignment
- Add meaningful icons and visual hierarchy

**Color Application Rules:**
- Primary nodes: Use StuddyHub blue tones
- Process nodes: Use neutral grays with accent borders
- Decision nodes: Use amber/warning colors
- Success/Complete: Use emerald/success colors
- Error/Alert: Use red/error colors
- Data/Storage: Use blue/violet tones

**Enhanced Template:**
\`\`\`mermaid
%%{init: {'theme':'base', 'themeVariables': { 
  'primaryColor': '${currentTheme === 'dark' ? '#1E293B' : '#F8FAFC'}',
  'primaryTextColor': '${currentTheme === 'dark' ? '#F8FAFC' : '#0F172A'}',
  'primaryBorderColor': '${currentTheme === 'dark' ? '#60A5FA' : '#3B82F6'}',
  'lineColor': '${currentTheme === 'dark' ? '#60A5FA' : '#3B82F6'}',
  'secondaryColor': '${currentTheme === 'dark' ? '#334155' : '#F1F5F9'}',
  'tertiaryColor': '${currentTheme === 'dark' ? '#475569' : '#E2E8F0'}',
  'background': '${currentTheme === 'dark' ? '#0F172A' : '#FFFFFF'}',
  'mainBkg': '${currentTheme === 'dark' ? '#1E293B' : '#F8FAFC'}',
  'secondBkg': '${currentTheme === 'dark' ? '#334155' : '#F1F5F9'}'
}}}%%
flowchart TB
    Start([🚀 User Authentication<br/>Initialize Session]) --> Profile{👤 Check Profile}
    Profile -->|New User| Create[📝 Create Profile<br/>Set Preferences]
    Profile -->|Returning| Load[📊 Load Dashboard<br/>Restore State]
    Create --> Settings[⚙️ Configure Settings<br/>Learning Style Setup]
    Load --> Settings
    Settings --> Core[🎯 Core System Ready<br/>Progress: 60%]
    Core --> Notes[📝 Load Notes Module]
    Core --> Docs[📄 Load Documents Module]
    Core --> AI[🤖 Initialize AI Chat]
    Notes --> Ready[✅ Platform Ready<br/>All Systems Online]
    Docs --> Ready
    AI --> Ready
    Ready --> Active[🎓 Active Learning State]
    
    classDef startEnd fill:${currentTheme === 'dark' ? '#10B981' : '#10B981'},stroke:#fff,stroke-width:2px,color:#fff
    classDef process fill:${currentTheme === 'dark' ? '#3B82F6' : '#3B82F6'},stroke:#fff,stroke-width:2px,color:#fff
    classDef decision fill:${currentTheme === 'dark' ? '#F59E0B' : '#F59E0B'},stroke:#fff,stroke-width:2px,color:#000
    classDef success fill:${currentTheme === 'dark' ? '#10B981' : '#10B981'},stroke:#fff,stroke-width:2px,color:#fff
    
    class Start,Active startEnd
    class Profile decision
    class Create,Load,Settings,Core,Notes,Docs,AI process
    class Ready success
\`\`\`

**Advanced Features:**
- Emoji integration for visual appeal
- Progress indicators in node labels
- Consistent color classification
- Professional spacing and alignment
- Responsive design considerations
`;
  const dotGraphExcellence = `
**DOT GRAPH RULES:**
- Start with digraph G { or graph G {; specify rankdir (e.g., TB).
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
**CHART.JS VISUAL EXCELLENCE:**

**Theme-Adaptive Configuration:**
\`\`\`chartjs
{
  "type": "line",
  "data": {
    "labels": ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
    "datasets": [{
      "label": "Learning Progress",
      "data": [65, 72, 78, 85, 88, 95],
      "borderColor": "${currentTheme === 'dark' ? '#60A5FA' : '#3B82F6'}",
      "backgroundColor": "${currentTheme === 'dark' ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)'}",
      "borderWidth": 3,
      "tension": 0.4,
      "fill": true,
      "pointBackgroundColor": "${currentTheme === 'dark' ? '#60A5FA' : '#3B82F6'}",
      "pointBorderColor": "${currentTheme === 'dark' ? '#F8FAFC' : '#FFFFFF'}",
      "pointBorderWidth": 2,
      "pointRadius": 6,
      "pointHoverRadius": 8
    }, {
      "label": "Quiz Scores",
      "data": [70, 75, 80, 82, 90, 92],
      "borderColor": "${currentTheme === 'dark' ? '#34D399' : '#10B981'}",
      "backgroundColor": "${currentTheme === 'dark' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(16, 185, 129, 0.1)'}",
      "borderWidth": 3,
      "tension": 0.4,
      "fill": true,
      "pointBackgroundColor": "${currentTheme === 'dark' ? '#34D399' : '#10B981'}",
      "pointBorderColor": "${currentTheme === 'dark' ? '#F8FAFC' : '#FFFFFF'}",
      "pointBorderWidth": 2,
      "pointRadius": 6,
      "pointHoverRadius": 8
    }]
  },
  "options": {
    "responsive": true,
    "maintainAspectRatio": false,
    "interaction": {
      "intersect": false,
      "mode": "index"
    },
    "plugins": {
      "legend": {
        "display": true,
        "position": "top",
        "labels": {
          "color": "${currentTheme === 'dark' ? '#F8FAFC' : '#0F172A'}",
          "font": {
            "family": "Inter, system-ui, sans-serif",
            "size": 14,
            "weight": "600"
          },
          "padding": 20,
          "usePointStyle": true,
          "pointStyle": "circle"
        }
      },
      "tooltip": {
        "enabled": true,
        "backgroundColor": "${currentTheme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)'}",
        "titleColor": "${currentTheme === 'dark' ? '#F8FAFC' : '#0F172A'}",
        "bodyColor": "${currentTheme === 'dark' ? '#E2E8F0' : '#334155'}",
        "borderColor": "${currentTheme === 'dark' ? '#475569' : '#E2E8F0'}",
        "borderWidth": 1,
        "cornerRadius": 8,
        "padding": 12,
        "titleFont": {
          "family": "Inter, system-ui, sans-serif",
          "size": 14,
          "weight": "600"
        },
        "bodyFont": {
          "family": "Inter, system-ui, sans-serif",
          "size": 13
        }
      }
    },
    "scales": {
      "x": {
        "display": true,
        "grid": {
          "color": "${currentTheme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}",
          "lineWidth": 1
        },
        "ticks": {
          "color": "${currentTheme === 'dark' ? '#CBD5E1' : '#64748B'}",
          "font": {
            "family": "Inter, system-ui, sans-serif",
            "size": 12,
            "weight": "500"
          }
        },
        "title": {
          "display": true,
          "text": "Time Period",
          "color": "${currentTheme === 'dark' ? '#E2E8F0' : '#475569'}",
          "font": {
            "family": "Inter, system-ui, sans-serif",
            "size": 13,
            "weight": "600"
          }
        }
      },
      "y": {
        "display": true,
        "grid": {
          "color": "${currentTheme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}",
          "lineWidth": 1
        },
        "ticks": {
          "color": "${currentTheme === 'dark' ? '#CBD5E1' : '#64748B'}",
          "font": {
            "family": "Inter, system-ui, sans-serif",
            "size": 12,
            "weight": "500"
          }
        },
        "title": {
          "display": true,
          "text": "Performance Score",
          "color": "${currentTheme === 'dark' ? '#E2E8F0' : '#475569'}",
          "font": {
            "family": "Inter, system-ui, sans-serif",
            "size": 13,
            "weight": "600"
          }
        }
      }
    }
  }
}
\`\`\`
**Chart Type Specific Enhancements:**
- **Bar Charts:** Use gradient fills, rounded corners, hover animations
- **Line Charts:** Smooth curves, animated drawing, point interactions
- **Pie Charts:** 3D effects, exploded segments, percentage labels
- **Doughnut Charts:** Center labels, progress indicators, interactive legends
- **Radar Charts:** Filled areas, multiple datasets, skill assessments
`;
  const threeJsExcellence = `
**THREE.JS VISUAL EXCELLENCE:**

**Enhanced Visual Standards:**
- importations of libraries are handle in the app already so no importation just return the function 
- HDR environment mapping for realistic lighting
- Post-processing effects for premium look
- Particle systems for dynamic environments
- Advanced material systems with PBR
- Smooth animations with easing functions
- always follow the function name given (createThreeJSScene)
**template to follow**
\`\`\`threejs
function createThreeJSScene(canvas, THREE, OrbitControls) {
// Scene, Camera, and Renderer setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
camera.position.set(0, 100, 300);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Ambient lighting based on theme
const ambientIntensity = 0.25;
const ambientColor = 0xF7FAFC;
const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
scene.add(ambientLight);

// Main directional light
const dirLightColor = 0x3B82F6;
const directionalLight = new THREE.DirectionalLight(dirLightColor, 0.8);
directionalLight.position.set(10, 10, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Accent lighting
const accentLight = new THREE.PointLight(0x10B981, 0.5, 50);
accentLight.position.set(-10, 5, 10);
scene.add(accentLight);

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 1000;
controls.update();

// Sun creation
const sunGeometry = new THREE.SphereGeometry(30, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 }); // Yellow
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Planet data: radius, color, distance, speed
const planetsData = [
{ name: 'Mercury', radius: 3, color: 0x808080, distance: 60, speed: 0.04 }, // Gray
{ name: 'Venus', radius: 6, color: 0xFFA500, distance: 90, speed: 0.03 }, // Orange
{ name: 'Earth', radius: 7, color: 0x0077BE, distance: 120, speed: 0.025 }, // Blue
{ name: 'Mars', radius: 4, color: 0xFF4500, distance: 150, speed: 0.022 }, // Red-Orange
{ name: 'Jupiter', radius: 15, color: 0xFFD700, distance: 200, speed: 0.015 }, // Gold
{ name: 'Saturn', radius: 13, color: 0xF0E68C, distance: 250, speed: 0.012 }, // Khaki
{ name: 'Uranus', radius: 10, color: 0xADD8E6, distance: 300, speed: 0.01 }, // Light Blue
{ name: 'Neptune', radius: 10, color: 0x000080, distance: 350, speed: 0.008 } // Navy
];

const planets = [];

// Create planets
planetsData.forEach(data => {
const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
const material = new THREE.MeshStandardMaterial({ color: data.color });
const planet = new THREE.Mesh(geometry, material);
scene.add(planet); // Add to the scene, not as a child of the sun
planets.push({ planet: planet, speed: data.speed, distance: data.distance, angle: 0 }); // Initialize angle

// Orbit lines (optional, for visualization)
const orbitRadius = data.distance;
const orbitGeometry = new THREE.RingGeometry(orbitRadius - 0.1, orbitRadius + 0.1, 64);
const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0x3B82F6, side: THREE.DoubleSide });
const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
orbit.rotation.x = Math.PI / 2;
scene.add(orbit); // Add orbits to the scene as well
});

// Starfield creation
const starsGeometry = new THREE.BufferGeometry();
const starsMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 2 });

const starCount = 1000;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount * 3; i++) {
starPositions[i] = (Math.random() - 0.5) * 2000; // Random position between -1000 and 1000
}

starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// Animation loop
const animate = () => {
requestAnimationFrame(animate);

planets.forEach(planetData => {
// Increment the angle based on the speed
planetData.angle += planetData.speed;

// Calculate the new position using polar coordinates
planetData.planet.position.x = Math.cos(planetData.angle) * planetData.distance;
planetData.planet.position.z = Math.sin(planetData.angle) * planetData.distance;

// Rotate the planet itself for some added effect
planetData.planet.rotation.y += 0.01;
});

controls.update();
renderer.render(scene, camera);
};

// Handle window resizing
const handleResize = () => {
camera.aspect = canvas.clientWidth / canvas.clientHeight;
camera.updateProjectionMatrix();
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
};

window.addEventListener('resize', handleResize);
handleResize(); // Initial resize

animate(); // Start animation

return {
scene,
renderer,
camera,
controls,
cleanup: () => {
window.removeEventListener('resize', handleResize);
renderer.dispose();
sunGeometry.dispose();
planetsData.forEach(() => {
// planetGeometry.dispose(); //Fix this
// planetMaterial.dispose();
});
sunMaterial.dispose();
starsGeometry.dispose();
starsMaterial.dispose();
}
};
}
\`\`\`

`;
  const htmlExcellence = `
**HTML VISUAL EXCELLENCE:**

**Modern Design Principles:**
- Glassmorphism effects with backdrop blur
- Smooth micro-animations and transitions
- Advanced CSS Grid and Flexbox layouts
- Modern typography with Inter font family
- Responsive design with mobile-first approach
- Accessibility-first implementation

**Enhanced Template:**
\`\`\`html
<!DOCTYPE html>
<html lang="en" class="${currentTheme === 'dark' ? 'dark' : ''}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StuddyHub AI - Educational Excellence</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        'sans': ['Inter', 'system-ui', 'sans-serif'],
                    },
                    colors: {
                        'studdy-blue': '#3B82F6',
                        'studdy-dark-blue': '#1E40AF',
                    },
                    animation: {
                        'fade-in-up': 'fadeInUp 0.6s ease-out',
                        'scale-in': 'scaleIn 0.4s ease-out',
                        'slide-in-right': 'slideInRight 0.5s ease-out',
                    },
                    backdropBlur: {
                        'xs': '2px',
                    }
                }
            }
        }
    </script>
    <style>
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(30px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .glassmorphism {
            background: ${currentTheme === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)'};
            backdrop-filter: blur(12px);
            border: 1px solid ${currentTheme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.3)'};
        }
        .gradient-border {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 1px;
            border-radius: 12px;
        }
        .gradient-border-inner {
            background: ${currentTheme === 'dark' ? '#0F172A' : '#FFFFFF'};
            border-radius: 11px;
            padding: 1.5rem;
        }
    </style>
</head>
<body class="${currentTheme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans min-h-screen transition-all duration-300">
    
    <!-- Modern Hero Section -->
    <section class="relative min-h-screen flex items-center justify-center overflow-hidden">
        <!-- Animated Background -->
        <div class="absolute inset-0 bg-gradient-to-br ${currentTheme === 'dark' ? 'from-slate-900 via-blue-900/20 to-slate-900' : 'from-blue-50 via-white to-blue-50'}"></div>
        
        <!-- Floating Elements -->
        <div class="absolute top-20 left-10 w-20 h-20 ${currentTheme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-200/40'} rounded-full blur-xl animate-pulse"></div>
        <div class="absolute bottom-20 right-10 w-32 h-32 ${currentTheme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-200/40'} rounded-full blur-xl animate-pulse delay-1000"></div>
        
        <!-- Main Content -->
        <div class="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <!-- Glassmorphism Card -->
            <div class="glassmorphism rounded-2xl p-8 md:p-12 animate-fade-in-up">
                <div class="gradient-border mb-8 animate-scale-in">
                    <div class="gradient-border-inner text-center">
                        <h1 class="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-studdy-blue to-blue-600 bg-clip-text text-transparent">
                            Welcome to StuddyHub AI
                        </h1>
                        <p class="text-xl md:text-2xl ${currentTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'} mb-8 leading-relaxed">
                            Transform your learning journey with AI-powered education, 
                            personalized insights, and interactive experiences.
                        </p>
                    </div>
                </div>
                
                <!-- Feature Cards -->
                <div class="grid md:grid-cols-3 gap-6 mb-8">
                    <div class="glassmorphism rounded-xl p-6 hover:scale-105 transition-all duration-300 animate-slide-in-right">
                        <div class="w-12 h-12 ${currentTheme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'} rounded-lg flex items-center justify-center mb-4 mx-auto">
                            <svg class="w-6 h-6 text-studdy-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold mb-2">Smart Learning</h3>
                        <p class="${currentTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-sm">
                            AI-powered personalization adapts to your learning style
                        </p>
                    </div>
                    
                    <div class="glassmorphism rounded-xl p-6 hover:scale-105 transition-all duration-300 animate-slide-in-right delay-200">
                        <div class="w-12 h-12 ${currentTheme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'} rounded-lg flex items-center justify-center mb-4 mx-auto">
                            <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold mb-2">Progress Tracking</h3>
                        <p class="${currentTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-sm">
                            Visual insights and analytics for your learning journey
                        </p>
                    </div>
                    
                    <div class="glassmorphism rounded-xl p-6 hover:scale-105 transition-all duration-300 animate-slide-in-right delay-400">
                        <div class="w-12 h-12 ${currentTheme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'} rounded-lg flex items-center justify-center mb-4 mx-auto">
                            <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold mb-2">AI Assistant</h3>
                        <p class="${currentTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-sm">
                            24/7 intelligent support for all your questions
                        </p>
                    </div>
                </div>
                
                <!-- CTA Buttons -->
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <button class="bg-gradient-to-r from-studdy-blue to-studdy-dark-blue hover:from-studdy-dark-blue hover:to-studdy-blue text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl">
                        Start Learning Now
                    </button>
                    <button class="border-2 ${currentTheme === 'dark' ? 'border-slate-600 hover:border-slate-500 text-slate-300 hover:text-slate-200' : 'border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-800'} font-semibold py-3 px-8 rounded-xl transition-all duration-300 hover:scale-105">
                        Learn More
                    </button>
                </div>
            </div>
        </div>
    </section>
    
    <script>
        // Add interactive animations
        document.addEventListener('DOMContentLoaded', function() {
            const cards = document.querySelectorAll('.glassmorphism');
            cards.forEach((card, index) => {
                card.style.animationDelay = \`\${index * 100}ms\`;
            });
        });
    </script>
</body>
</html>
\`\`\`
`;
  const slidesExcellence = `
**SLIDES VISUAL EXCELLENCE:**

**Modern Slide Principles:**
- Consistent visual hierarchy
- Theme-adaptive color schemes
- Professional typography scaling
- Engaging visual elements
- Interactive design hints

**Enhanced Template:**
\`\`\`slides
[
  {
    "title": "🚀 Introduction to Machine Learning",
    "content": [
      "🤖 **What is Machine Learning?**",
      "   • Subset of AI that learns from data",
      "   • Algorithms that improve with experience",
      "   • Powers modern applications everywhere",
      "",
      "📊 **Key Benefits:**",
      "   • Automated decision making",
      "   • Pattern recognition at scale",
      "   • Predictive analytics capability"
    ],
    "layout": "title-and-bullets",
    "theme": {
      "backgroundColor": "${currentTheme === 'dark' ? '#0F172A' : '#FFFFFF'}",
      "textColor": "${currentTheme === 'dark' ? '#F8FAFC' : '#0F172A'}",
      "accentColor": "${currentTheme === 'dark' ? '#60A5FA' : '#3B82F6'}",
      "gradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    }
  },
  {
    "title": "🧠 Types of Machine Learning",
    "content": "Machine Learning encompasses three main paradigms:\\n\\n**🎯 Supervised Learning**\\n• Uses labeled training data\\n• Predicts outcomes for new data\\n• Examples: Classification, Regression\\n\\n**🔍 Unsupervised Learning**\\n• Discovers patterns in unlabeled data\\n• Finds hidden structures\\n• Examples: Clustering, Dimensionality Reduction\\n\\n**🎮 Reinforcement Learning**\\n• Learns through interaction and rewards\\n• Trial-and-error approach\\n• Examples: Game playing, Robotics",
    "layout": "title-and-rich-text",
    "theme": {
      "backgroundColor": "${currentTheme === 'dark' ? '#1E293B' : '#F8FAFC'}",
      "textColor": "${currentTheme === 'dark' ? '#E2E8F0' : '#334155'}",
      "accentColor": "${currentTheme === 'dark' ? '#34D399' : '#10B981'}"
    }
  },
  {
    "title": "📈 Deep Learning Architecture",
    "content": [
      "🏗️ **Neural Network Fundamentals:**",
      "",
      "**Input Layer** → **Hidden Layers** → **Output Layer**",
      "",
      "• **Neurons:** Basic processing units",
      "• **Weights:** Connection strengths", 
      "• **Activation Functions:** Non-linear transformations",
      "• **Backpropagation:** Learning algorithm",
      "",
      "🎯 **Popular Architectures:**",
      "• **CNNs:** Computer Vision tasks",
      "• **RNNs:** Sequential data processing",
      "• **Transformers:** Natural Language Processing"
    ],
    "layout": "title-and-structured-content",
    "theme": {
      "backgroundColor": "${currentTheme === 'dark' ? '#334155' : '#F1F5F9'}",
      "textColor": "${currentTheme === 'dark' ? '#CBD5E1' : '#475569'}",
      "accentColor": "${currentTheme === 'dark' ? '#FBBF24' : '#F59E0B'}"
    }
  }
]
\`\`\`

**Advanced Slide Features:**
- Emoji integration for visual engagement
- Progressive disclosure of information
- Consistent color theming across slides
- Professional typography hierarchy
- Interactive element suggestions
`;
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
These are the user preferences
**ADAPTIVE LEARNING:**
- learning style: ${learningStyle}
- Difficulty: ${learningPreferences?.difficulty || 'intermediate'} (beginner, intermediate, advanced).
- Explanation Style: ${learningPreferences?.explanation_style || 'detailed'} (simple, detailed, comprehensive).
- Examples: ${learningPreferences?.examples ? 'Included' : 'Omitted'}.
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
async function buildGeminiConversation(userId, sessionId, currentMessage, files = [], attachedContext = '', systemPrompt = '') {
  // A unique prefix for all logs within this function call for easy tracing
  const logPrefix = `[buildGeminiConversation][User:${userId}][Session:${sessionId}]`;
  console.log(`${logPrefix} Starting conversation build.`);
  // For deeper debugging, log the characteristics of the input
  console.debug(`${logPrefix} Inputs - Message Length: ${currentMessage?.length || 0}, Files: ${files.length}, Attached Context Length: ${attachedContext?.length || 0}, System Prompt: ${!!systemPrompt}`);
  try {
    // Create system prompt
    let assembledSystemPrompt = systemPrompt;
    // 1. Get intelligent conversation context
    console.log(`${logPrefix} Fetching intelligent context...`);
    let conversationData = await buildIntelligentContext(userId, sessionId, currentMessage, [], []);
    let geminiContents = [];

    if (assembledSystemPrompt) {
      console.log(`${logPrefix} Adding system prompt.`);
      geminiContents.push({
        role: 'user',
        parts: [
          {
            text: assembledSystemPrompt
          }
        ]
      });
      geminiContents.push({
        role: 'model',
        parts: [
          {
            text: 'OK.'
          }
        ] // A simple acknowledgement helps prime the model
      });
    }
    // 3. Add conversation summary if available
    if (conversationData.conversationSummary) {
      console.log(`${logPrefix} Adding conversation summary to context.`);
      geminiContents.push({
        role: 'user',
        parts: [
          {
            text: `CONVERSATION CONTEXT SUMMARY:\n${conversationData.conversationSummary}\n\n[The above is a summary of earlier messages. The following are recent messages:]`
          }
        ]
      });
      geminiContents.push({
        role: 'model',
        parts: [
          {
            text: 'Acknowledged. I have reviewed the conversation summary.'
          }
        ]
      });
    }
    // 4. Add recent conversation history
    let recentMessages = conversationData.recentMessages;
    // Check token count *after* summarization, before adding recent messages
    let baseTokenCount = await calculateBaseTokenCount(assembledSystemPrompt, attachedContext);
    let recentMessagesTokenCount = 0;
    for (const msg of recentMessages) {
      recentMessagesTokenCount += await calculateTokenCount(msg.content);
    }
    if (baseTokenCount + recentMessagesTokenCount > ENHANCED_PROCESSING_CONFIG.MAX_INPUT_TOKENS) {
      console.warn(`${logPrefix} Token limit exceeded after summarization. Truncating recent messages.`);
      // Prioritize the last User message
      const lastUserMessage = recentMessages.filter((msg) => msg.role === 'user').pop(); // Get last user message, if any
      const otherMessages = recentMessages.filter((msg) => msg !== lastUserMessage);
      let prioritizedRecentMessages = [];
      if (lastUserMessage) {
        prioritizedRecentMessages.push(lastUserMessage);
        baseTokenCount += await calculateTokenCount(lastUserMessage.content);
      }
      // Truncate other messages until within limit
      const truncatedOtherMessages = [];
      for (let i = otherMessages.length - 1; i >= 0; i--) {
        // Iterate backwards, removing oldest first
        const msg = otherMessages[i];
        const messageTokenCount = await calculateTokenCount(msg.content);
        if (baseTokenCount + messageTokenCount <= ENHANCED_PROCESSING_CONFIG.MAX_INPUT_TOKENS) {
          truncatedOtherMessages.unshift(msg); // Add to the beginning to preserve order
          baseTokenCount += messageTokenCount;
        } else {
          console.warn(`${logPrefix} Excluding message ${msg.id} due to token limit.`);
          break; // Stop adding messages
        }
      }
      prioritizedRecentMessages = truncatedOtherMessages.concat(prioritizedRecentMessages);
      recentMessages = prioritizedRecentMessages; // Use truncated list
    }
    if (recentMessages && recentMessages.length > 0) {
      console.log(`${logPrefix} Adding ${recentMessages.length} recent messages to history.`);
      for (const msg of recentMessages) {
        if (msg.role === 'user') {
          const userParts = [
            {
              text: msg.content || ''
            }
          ];
          if (msg.image_url && msg.image_mime_type) {
            userParts[0].text += `\n[User previously shared an image: ${msg.image_url}]`;
            console.debug(`${logPrefix} Added image reference from history: ${msg.image_url}`);
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
    // 5. Add current message with full content, files, and context
    if (currentMessage || files.length > 0 || attachedContext) {
      console.log(`${logPrefix} Assembling current user turn.`);
      const currentMessageParts = [];
      // Add main text message
      if (currentMessage) {
        currentMessageParts.push({
          text: currentMessage
        });
      }
      // Add attached context from documents/notes
      if (attachedContext) {
        console.log(`${logPrefix} Adding attached context from documents/notes.`);
        currentMessageParts.push({
          text: `\n\nATTACHED CONTEXT:\n${attachedContext}`
        });
      }
      // Add processed file content (images, text, etc.)
      if (files.length > 0) {
        console.log(`${logPrefix} Processing ${files.length} file(s) for the current turn.`);
        for (const file of files) {
          console.debug(`${logPrefix} Adding file: ${file.name} (Type: ${file.type})`);
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
      }
      if (currentMessageParts.length > 0) {
        geminiContents.push({
          role: 'user',
          parts: currentMessageParts
        });
      }
    } else {
      console.log(`${logPrefix} No new message, files, or attached context in the current turn.`);
    }
    console.log(`${logPrefix} Successfully built conversation. Final content array has ${geminiContents.length} parts.`);
    return {
      contents: geminiContents,
      contextInfo: conversationData
    };
  } catch (error) {
    // Log the error with the contextual prefix for easy debugging
    console.error(`${logPrefix} An error occurred during conversation build:`, error);
    // Re-throw the error so the calling function (e.g., the server handler) can handle it appropriately
    throw error;
  }
}
/**
* Main server handler
*/ /**
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
      // Capture the user message *before* processing files
      const userMessage = requestData.message;
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
    // Collect file metadata *before* saving the chat message
    const filesMetadata = [];
    for (const file of files) {
      const documentId = await saveFileToDatabase(file, userId);
      if (documentId) {
        uploadedDocumentIds.push(documentId);
        // Collect file metadata
        const { data: docData, error: docError } = await supabase.from('documents').select('file_url, file_type, file_name, type, processing_status, processing_error').eq('id', documentId).single();
        if (docData && !docError) {
          filesMetadata.push({
            id: documentId,
            name: docData.file_name,
            type: docData.type,
            mimeType: docData.file_type,
            url: docData.file_url,
            status: docData.processing_status,
            error: docData.processing_error
          });
          // Set image URL for user message if this is an image
          if (docData.type === 'image' && !userMessageImageUrl) {
            userMessageImageUrl = docData.file_url;
            userMessageImageMimeType = docData.file_type;
          }
        } else {
          console.error(`Error fetching file metadata for doc ID ${documentId}:`, docError);
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
    // In the main server handler, when calling ensureChatSession:
    await ensureChatSession(userId, sessionId, allDocumentIds, message); // Pass the message
    // Build attached context with full content (no truncation)
    let attachedContext = '';
    if (allDocumentIds.length > 0 || attachedNoteIds.length > 0) {
      attachedContext = await buildAttachedContext(allDocumentIds, attachedNoteIds, userId);
    }
    // Create system prompt
    const systemPrompt = createSystemPrompt(learningStyle, learningPreferences);
    // Build context-aware conversation
    const conversationData = await buildGeminiConversation(userId, sessionId, message, files, attachedContext, systemPrompt);
    // Save user message with context info and file metadata
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
        },
        filesMetadata: filesMetadata.length > 0 ? filesMetadata : null // Pass file metadata here
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
    // Generate title from the first AI response
    let aiGeneratedTitle = 'New Chat Session'; // Default title
    // Fetch existing session to get the title
    const { data: existingSession, error: fetchError } = await supabase.from('chat_sessions').select('title').eq('id', sessionId).eq('user_id', userId).single();
    if (fetchError) {
      console.error('Error fetching chat session for title:', fetchError);
      // Fallback to "New Chat Session" if there's an error
    } else if (existingSession && existingSession.title) {
      if (existingSession.title === 'New Chat' || existingSession.title === 'New Chat Session') {
        // If the title is the default and it's not the first message, generate a new title
        aiGeneratedTitle = await generateChatTitle(sessionId, userId, message);
      } else {
        aiGeneratedTitle = existingSession.title; // Use existing title
      }
    } else if (conversationData.contextInfo.totalMessages === 0) {
      aiGeneratedTitle = await generateChatTitle(sessionId, userId, message); // Generate new title for first message
    }
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
    await updateSessionLastMessage(sessionId, conversationData.contextInfo.conversationSummary, aiGeneratedTitle);
    const processingTime = Date.now() - startTime;
    return new Response(JSON.stringify({
      response: generatedText,
      userId,
      sessionId,
      title: aiGeneratedTitle,
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
          imageMimeType: requestData.imageMimeType || requestData.imageMimeType
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
