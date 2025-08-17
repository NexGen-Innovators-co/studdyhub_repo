// index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Expanded file type mappings for MIME types
const SUPPORTED_FILE_TYPES = {
  // Images - highest priority for visual processing
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/svg+xml': 'image',
  'image/tiff': 'image',
  'image/tif': 'image',
  'image/ico': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  // Documents - structured processing
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  'application/rtf': 'document',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',
  'application/vnd.oasis.opendocument.presentation': 'presentation',
  // Text files - direct processing
  'text/plain': 'text',
  'text/csv': 'csv',
  'text/markdown': 'markdown',
  'text/html': 'html',
  'text/xml': 'xml',
  'application/json': 'json',
  'application/xml': 'xml',
  // Code files - syntax-aware processing
  'text/javascript': 'code',
  'application/javascript': 'code',
  'text/typescript': 'code',
  'application/typescript': 'code',
  'text/css': 'code',
  'text/x-python': 'code',
  'text/x-java': 'code',
  'text/x-c': 'code',
  'text/x-cpp': 'code',
  'text/x-csharp': 'code',
  'text/x-php': 'code',
  'text/x-ruby': 'code',
  'text/x-go': 'code',
  'text/x-rust': 'code',
  'text/x-sql': 'code',
  // Archives (for metadata extraction)
  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  // Audio (for transcription potential)
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/m4a': 'audio',
  'audio/x-m4a': 'audio',
  'audio/webm': 'audio',
  'audio/flac': 'audio',
  // Video (for frame extraction potential)
  'video/mp4': 'video',
  'video/avi': 'video',
  'video/mov': 'video',
  'video/wmv': 'video',
  'video/webm': 'video',
  'video/mkv': 'video'
};

// Optimized processing configuration with smart chunking
const PROCESSING_CONFIG = {
  image: {
    maxSize: 20 * 1024 * 1024,
    prompt: `Analyze this image comprehensively and extract ALL visible information:
    
    1. TEXT EXTRACTION: Extract every piece of visible text including:
       - Main headings and titles
       - Body text and paragraphs  
       - Labels, captions, and annotations
       - Text in charts, diagrams, or graphs
       - Handwritten text if legible
       - Text in different languages
    
    2. VISUAL CONTENT: Describe in detail:
       - Objects, people, scenes
       - Charts, graphs, diagrams, and their data
       - Document structure and layout
       - Colors, styling, and formatting
    
    3. CONTEXT: Provide meaningful interpretation of:
       - Document type and purpose
       - Key information and insights
       - Relationships between elements
    
    Format your response clearly with sections for extracted text and visual description.`,
    temperature: 0.1,
    maxTokens: 32768,
    useChunking: false
  },
  pdf: {
    maxSize: 100 * 1024 * 1024,
    prompt: `Extract and structure ALL content from this PDF document:
    
    1. COMPLETE TEXT EXTRACTION:
       - All headings, subheadings, and body text
       - Table contents with proper structure
       - List items and bullet points
       - Footnotes and references
       - Page numbers and headers/footers if relevant
    
    2. DOCUMENT STRUCTURE:
       - Maintain hierarchical organization
       - Preserve formatting context
       - Identify sections and chapters
    
    3. SPECIAL ELEMENTS:
       - Extract text from images/charts within PDF
       - Describe non-text elements (diagrams, charts)
       - Note any forms or interactive elements
    
    Provide comprehensive extraction maintaining document logic and flow.`,
    temperature: 0.05,
    maxTokens: 65536,
    useChunking: true,
    chunkSize: 4 * 1024 * 1024
  },
  document: {
    maxSize: 50 * 1024 * 1024,
    prompt: `Extract ALL content from this document with full fidelity:
    
    1. TEXT CONTENT:
       - Complete text including headers and footers
       - All paragraphs, lists, and sections
       - Table data with structure preserved
       - Comments and tracked changes if visible
    
    2. FORMATTING CONTEXT:
       - Document structure and organization
       - Important styling that affects meaning
       - Section breaks and page layouts
    
    3. METADATA:
       - Document type and apparent purpose
       - Key topics and themes identified
    
    Maintain logical flow and completeness of extraction.`,
    temperature: 0.05,
    maxTokens: 65536,
    useChunking: true,
    chunkSize: 3 * 1024 * 1024
  },
  spreadsheet: {
    maxSize: 30 * 1024 * 1024,
    prompt: `Extract and organize ALL data from this spreadsheet:
    
    1. DATA EXTRACTION:
       - All cell contents including headers
       - Sheet names and organization
       - Formulas and calculated values
       - Data relationships and structure
    
    2. TABLE STRUCTURE:
       - Column headers and meanings
       - Row organization and groupings
       - Data types and formats
    
    3. INSIGHTS:
       - Key data patterns or trends
       - Purpose and context of data
       - Important calculations or summaries
    
    Present data in a clear, structured format.`,
    temperature: 0.05,
    maxTokens: 32768,
    useChunking: true,
    chunkSize: 2 * 1024 * 1024
  },
  presentation: {
    maxSize: 40 * 1024 * 1024,
    prompt: `Extract comprehensive content from this presentation:
    
    1. SLIDE CONTENT:
       - All slide titles and text content
       - Bullet points and lists
       - Speaker notes if accessible
       - Slide sequence and organization
    
    2. VISUAL ELEMENTS:
       - Charts, graphs, and their data
       - Images and diagrams with descriptions
       - Layout and design context
    
    3. STRUCTURE:
       - Presentation flow and logic
       - Key themes and messages
       - Conclusion and takeaways
    
    Maintain the narrative flow of the presentation.`,
    temperature: 0.1,
    maxTokens: 32768,
    useChunking: true,
    chunkSize: 2 * 1024 * 1024
  },
  text: {
    maxSize: 10 * 1024 * 1024,
    directProcess: true
  },
  csv: {
    maxSize: 20 * 1024 * 1024,
    directProcess: true,
    structured: true
  },
  markdown: {
    maxSize: 5 * 1024 * 1024,
    directProcess: true
  },
  html: {
    maxSize: 5 * 1024 * 1024,
    directProcess: true
  },
  xml: {
    maxSize: 5 * 1024 * 1024,
    directProcess: true
  },
  json: {
    maxSize: 5 * 1024 * 1024,
    directProcess: true,
    structured: true
  },
  code: {
    maxSize: 2 * 1024 * 1024,
    directProcess: true,
    preserveFormat: true
  },
  archive: {
    maxSize: 100 * 1024 * 1024,
    prompt: 'This is an archive file. Extract any readable metadata, file structure information, or accessible text content. Describe what type of archive this is and what it might contain.',
    temperature: 0.2,
    maxTokens: 4096,
    useChunking: false
  },
  audio: {
    maxSize: 100 * 1024 * 1024,
    prompt: `Transcribe the audio file comprehensively and structure the output as follows:
    
    1. FULL TRANSCRIPTION:
       - Extract all spoken content verbatim, including filler words (e.g., "um," "uh").
       - Preserve punctuation and sentence structure for readability.
       - Identify speaker changes if multiple speakers are present (e.g., "Speaker 1: ...").
       - Note timestamps for key segments if possible (e.g., "[00:01:23]").
    
    2. SUMMARY:
       - Provide a concise summary of the audio content.
       - Highlight key topics, themes, or insights.
    
    3. METADATA:
       - Describe the audio type (e.g., lecture, conversation, podcast).
       - Note audio quality, background noise, or clarity issues.
       - Identify the primary language and any accents if detectable.
    
    Format the response with clear sections:
    - [Transcription]
    - [Summary]
    - [Metadata]
    
    Format the response with clear sections. Ensure accuracy and completeness. If the audio is unclear, note problematic sections.`,
    temperature: 0.05,
    maxTokens: 32768,
    useChunking: false
  },
  video: {
    maxSize: 200 * 1024 * 1024,
    prompt: 'This is a video file. Analyze any extractable frames or metadata. Describe the video format and any available information. Note: Full video analysis would require specialized video processing.',
    temperature: 0.2,
    maxTokens: 4096,
    useChunking: false
  }
};

// Content size management constants
const MAX_TOTAL_CONTEXT = 2 * 1024 * 1024; // 2MB total context limit
const MAX_SINGLE_FILE_CONTENT = 500 * 1024; // 500KB per file in context
const MAX_GEMINI_INPUT_TOKENS = 2 * 1024 * 1024; // Gemini 2.0 Flash limit

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
  const chunkSize = 32768; // Larger chunks for better performance
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Smart content truncation that preserves structure
 */ function intelligentTruncate(content, maxLength, fileType) {
  if (content.length <= maxLength) return content;
  const truncated = content.substring(0, maxLength - 100); // Leave room for suffix
  let cutPoint = truncated.length;
  if ([
    'document',
    'pdf',
    'text'
  ].includes(fileType)) {
    const lastParagraph = truncated.lastIndexOf('\n\n');
    const lastSentence = truncated.lastIndexOf('. ');
    cutPoint = Math.max(lastParagraph, lastSentence);
  } else if ([
    'json',
    'xml'
  ].includes(fileType)) {
    const lastBrace = Math.max(truncated.lastIndexOf('}'), truncated.lastIndexOf('>'));
    if (lastBrace > truncated.length * 0.8) cutPoint = lastBrace + 1;
  } else if (fileType === 'csv') {
    const lastLine = truncated.lastIndexOf('\n');
    if (lastLine > truncated.length * 0.9) cutPoint = lastLine;
  }
  if (cutPoint < truncated.length * 0.7) cutPoint = truncated.length;
  const result = content.substring(0, cutPoint);
  const remainingChars = content.length - cutPoint;
  return result + `\n\n[TRUNCATED: ${remainingChars.toLocaleString()} more characters not shown for processing efficiency]`;
}

/**
 * Enhanced file validation with detailed feedback
 */ function validateFile(file, fileType) {
  const config = PROCESSING_CONFIG[fileType];
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
 * Process file content with chunking support for large files
 */ async function processFileContent(file, geminiApiKey, userId) {
  const fileType = SUPPORTED_FILE_TYPES[file.mimeType];
  const config = PROCESSING_CONFIG[fileType];
  if (!config) {
    file.processing_status = 'failed';
    file.processing_error = `Unsupported file type: ${fileType}`;
    return;
  }
  const validation = validateFile(file, fileType);
  if (!validation.valid) {
    file.processing_status = 'failed';
    file.processing_error = validation.error;
    return;
  }
  try {
    if (config.directProcess) {
      await processDirectContent(file, fileType, config);
      return;
    }
    if (config.useChunking && file.size > (config.chunkSize || 1024 * 1024)) {
      await processWithChunking(file, config, geminiApiKey);
    } else {
      await processWithGemini(file, config, geminiApiKey);
    }
  } catch (error) {
    file.processing_status = 'failed';
    file.processing_error = `Processing error: ${error.message}`;
    console.error(`Error processing file ${file.name}:`, error);
  }
}

/**
 * Direct processing for text-based files
 */ async function processDirectContent(file, fileType, config) {
  try {
    const decodedContent = atob(file.data || '');
    let processedContent = decodedContent;
    if (fileType === 'csv' && config.structured) {
      processedContent = `[CSV Data Structure]\n${processedContent}`;
    } else if (fileType === 'json' && config.structured) {
      try {
        const parsed = JSON.parse(decodedContent);
        processedContent = `[JSON Structure]\n${JSON.stringify(parsed, null, 2)}`;
      } catch {
        processedContent = `[JSON File - Raw Content]\n${decodedContent}`;
      }
    } else if (fileType === 'code' && config.preserveFormat) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      processedContent = `[${extension.toUpperCase()} Code File: ${file.name}]\n\`\`\`${extension}\n${decodedContent}\n\`\`\``;
    }
    if (processedContent.length > MAX_SINGLE_FILE_CONTENT) {
      processedContent = intelligentTruncate(processedContent, MAX_SINGLE_FILE_CONTENT, fileType);
    }
    file.content = processedContent;
    file.processing_status = 'completed';
    file.processing_error = null;
    console.log(`Successfully processed ${fileType} file: ${file.name} (${processedContent.length} chars)`);
  } catch (error) {
    file.processing_status = 'failed';
    file.processing_error = `Direct processing failed: ${error.message}`;
  }
}

/**
 * Process with Gemini API using optimized prompts
 */ async function processWithGemini(file, config, geminiApiKey) {
  if (!file.data) {
    file.processing_status = 'failed';
    file.processing_error = 'No file data available for processing';
    return;
  }
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: config.prompt
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
  const response = await callGeminiAPI(contents, config, geminiApiKey);
  if (response.success && response.content) {
    let processedContent = response.content;
    if (processedContent.length > MAX_SINGLE_FILE_CONTENT) {
      processedContent = intelligentTruncate(processedContent, MAX_SINGLE_FILE_CONTENT, SUPPORTED_FILE_TYPES[file.mimeType]);
    }
    file.content = processedContent;
    file.processing_status = 'completed';
    file.processing_error = null;
    console.log(`Successfully processed ${SUPPORTED_FILE_TYPES[file.mimeType]} file: ${file.name} (${processedContent.length} chars)`);
  } else {
    file.processing_status = 'failed';
    file.processing_error = response.error || 'Failed to process with Gemini';
  }
}

/**
 * Process large files with intelligent chunking
 */ async function processWithChunking(file, config, geminiApiKey) {
  console.log(`Large file detected: ${file.name}. Processing with size optimization.`);
  const optimizedConfig = {
    ...config,
    maxTokens: Math.min(config.maxTokens, 32768),
    prompt: config.prompt + '\n\nNote: Focus on extracting the most important and relevant content due to file size constraints.'
  };
  await processWithGemini(file, optimizedConfig, geminiApiKey);
}

/**
 * Optimized Gemini API call with retry logic
 */ async function callGeminiAPI(contents, config, geminiApiKey, retries = 2) {
  const apiUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
  apiUrl.searchParams.append('key', geminiApiKey);
  const requestBody = {
    contents,
    generationConfig: {
      temperature: config.temperature || 0.1,
      maxOutputTokens: config.maxTokens || 8192,
      topK: 40,
      topP: 0.95
    }
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
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
        if (response.status === 429 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
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
      if (attempt === retries) {
        return {
          success: false,
          error: `Network error: ${error.message}`
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  return {
    success: false,
    error: 'Max retries exceeded'
  };
}

/**
 * Process multiple files with optimized concurrency and rate limiting
 */ async function processFilesInBatches(files, geminiApiKey, userId) {
  const filesToProcess = files.filter((f) => f.processing_status === 'pending' && SUPPORTED_FILE_TYPES[f.mimeType]);
  if (filesToProcess.length === 0) return;
  filesToProcess.sort((a, b) => {
    const aType = SUPPORTED_FILE_TYPES[a.mimeType];
    const bType = SUPPORTED_FILE_TYPES[b.mimeType];
    const aConfig = PROCESSING_CONFIG[aType];
    const bConfig = PROCESSING_CONFIG[bType];
    const aPriority = aConfig?.directProcess ? -1 : 0;
    const bPriority = bConfig?.directProcess ? -1 : 0;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.size - b.size;
  });
  console.log(`Processing ${filesToProcess.length} files in optimized order`);

  const directFiles = filesToProcess.filter((f) => PROCESSING_CONFIG[SUPPORTED_FILE_TYPES[f.mimeType]]?.directProcess);
  if (directFiles.length > 0) {
    console.log(`Processing ${directFiles.length} direct files...`);
    await Promise.all(directFiles.map((file) => processFileContent(file, geminiApiKey, userId)));
  }

  const apiFiles = filesToProcess.filter((f) =>
    !PROCESSING_CONFIG[SUPPORTED_FILE_TYPES[f.mimeType]]?.directProcess
  );
  if (apiFiles.length > 0) {
    console.log(`Processing ${apiFiles.length} API files...`);
    const batchSize = 2;
    for (let i = 0; i < apiFiles.length; i += batchSize) {
      const batch = apiFiles.slice(i, i + batchSize);
      await Promise.all(batch.map((file) => processFileContent(file, geminiApiKey, userId)));
      if (i + batchSize < apiFiles.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  console.log('File processing completed');
}

/**
 * Process file from multipart/form-data
 */ async function processFile(file) {
  const mimeType = file.type;
  const fileType = SUPPORTED_FILE_TYPES[mimeType];
  if (!fileType) {
    console.warn(`Unsupported file type: ${mimeType}`);
    return null;
  }
  try {
    const validation = validateFile(file, fileType);
    if (!validation.valid) {
      console.warn(`File validation failed for ${file.name}: ${validation.error}`);
      return {
        name: file.name,
        type: fileType,
        mimeType,
        data: null,
        content: null,
        size: file.size,
        processing_status: 'failed',
        processing_error: validation.error
      };
    }
    if ([
      'text',
      'code'
    ].includes(fileType)) {
      const textContent = await file.text();
      return {
        name: file.name,
        type: fileType,
        mimeType,
        content: textContent,
        data: btoa(textContent),
        size: file.size,
        processing_status: 'completed',
        processing_error: null
      };
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuffer);
      return {
        name: file.name,
        type: fileType,
        mimeType,
        data: base64Data,
        content: `[File: ${file.name} - ${file.size} bytes. Processing ${fileType} content...]`,
        size: file.size,
        processing_status: 'pending',
        processing_error: null
      };
    }
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    return {
      name: file.name,
      type: fileType,
      mimeType,
      data: null,
      content: null,
      size: file.size,
      processing_status: 'failed',
      processing_error: `Error processing file: ${error.message}`
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
  const fileType = SUPPORTED_FILE_TYPES[fileData.mimeType];
  if (!fileType) {
    console.warn(`Unsupported file type: ${fileData.mimeType}`);
    return null;
  }
  const validation = validateFile(fileData, fileType);
  if (!validation.valid) {
    console.warn(`File validation failed for ${fileData.name}: ${validation.error}`);
    return {
      name: fileData.name,
      type: fileType,
      mimeType: fileData.mimeType,
      data: fileData.data,
      content: null,
      size: fileData.size || 0,
      processing_status: 'failed',
      processing_error: validation.error
    };
  }
  let decodedContent = fileData.content;
  if ([
    'text',
    'code'
  ].includes(fileType) && fileData.data && !decodedContent) {
    try {
      decodedContent = atob(fileData.data);
    } catch (error) {
      console.warn(`Failed to decode base64 data for ${fileData.name}`);
    }
  }
  return {
    name: fileData.name,
    type: fileType,
    mimeType: fileData.mimeType,
    data: fileData.data || (decodedContent ? btoa(decodedContent) : null),
    content: decodedContent || `[File: ${fileData.name}. Processing ${fileType} content...]`,
    size: fileData.size || (decodedContent ? decodedContent.length : 0),
    processing_status: fileData.processing_status || ([
      'text',
      'code'
    ].includes(fileType) ? 'completed' : 'pending'),
    processing_error: fileData.processing_error || null
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
          const content = doc.content_extracted.length > MAX_SINGLE_FILE_CONTENT ? intelligentTruncate(doc.content_extracted, MAX_SINGLE_FILE_CONTENT, doc.type) : doc.content_extracted;
          context += `Content: ${content}\n`;
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
          const content = note.content.length > MAX_SINGLE_FILE_CONTENT ? intelligentTruncate(note.content, MAX_SINGLE_FILE_CONTENT, 'text') : note.content;
          context += `Content: ${content}\n`;
        }
        if (note.ai_summary) {
          const summary = note.ai_summary.length > MAX_SINGLE_FILE_CONTENT ? intelligentTruncate(note.ai_summary, MAX_SINGLE_FILE_CONTENT, 'text') : note.ai_summary;
          context += `AI Summary: ${summary}\n`;
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
    } else if (file.content) { // Fallback for text-based types
      fileData = new Blob([file.content], { type: file.mimeType });
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

  const isDirectProcessType = ['text', 'code', 'csv', 'markdown', 'html', 'xml', 'json'].includes(file.type);

  if (!isDirectProcessType) {
    fileUrl = await uploadFileToStorage(file, userId);
    if (!fileUrl) {
      processingStatus = 'failed';
      processingError = processingError || 'Failed to upload file to storage';
      console.error(`Failed to upload file ${file.name} to storage.`);
      // Don't return null yet, still want to save a failed record
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
      processing_error: processingError
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
 * Save chat message to database
 */ async function saveChatMessage({ userId, sessionId, content, role, attachedDocumentIds = null, attachedNoteIds = null, isError = false, imageUrl = null, imageMimeType = null }) {
  try {
    const { error } = await supabase.from('chat_messages').insert({
      user_id: userId,
      session_id: sessionId,
      content,
      role,
      attached_document_ids: attachedDocumentIds,
      attached_note_ids: attachedNoteIds,
      is_error: isError,
      image_url: imageUrl,
      image_mime_type: imageMimeType,
      timestamp: new Date().toISOString()
    });
    if (error) console.error('Error saving chat message:', error);
  } catch (error) {
    console.error('Database error when saving chat message:', error);
  }
}
/**
 * Ensure chat session exists
 */ async function ensureChatSession(userId, sessionId, newDocumentIds = []) {
  try {
    const { data: existingSession, error: fetchError } = await supabase.from('chat_sessions').select('id, document_ids').eq('id', sessionId).eq('user_id', userId).single();
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching chat session:', fetchError);
      return;
    }
    if (existingSession) {
      if (newDocumentIds.length > 0) {
        const currentDocIds = existingSession.document_ids || [];
        const updatedDocIds = [
          ...new Set([
            ...currentDocIds,
            ...newDocumentIds
          ])
        ];
        const { error: updateError } = await supabase.from('chat_sessions').update({
          document_ids: updatedDocIds,
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        }).eq('id', sessionId);
        if (updateError) console.error('Error updating chat session:', updateError);
      } else {
        await updateSessionLastMessage(sessionId);
      }
    } else {
      const { error: insertError } = await supabase.from('chat_sessions').insert({
        id: sessionId,
        user_id: userId,
        title: 'New Chat',
        document_ids: newDocumentIds,
        last_message_at: new Date().toISOString()
      });
      if (insertError) console.error('Error creating chat session:', insertError);
    }
  } catch (error) {
    console.error('Database error when ensuring chat session:', error);
  }
}
/**
 * Update session last message timestamp
 */ async function updateSessionLastMessage(sessionId) {
  try {
    const { error } = await supabase.from('chat_sessions').update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', sessionId);
    if (error) console.error('Error updating session last message time:', error);
  } catch (error) {
    console.error('Database error when updating session:', error);
  }
}
function createSystemPrompt(learningStyle, learningPreferences) {
  const basePrompt = `You are StuddyHub AI, a dynamic educational platform designed for personalized, engaging learning experiences. Your responses must be clear, interactive,  ensuring error-free code and vibrant visualizations. all diagrams are goiing to be rendered in a diagram panel for codes blocks like listed below(threejs,dot,mermaids,html) using the expand button in your response rendered ny the markdown codemrender so make sure to return correct codes without eroors
**CORE MISSION:**
Deliver transformative learning by creating personalized paths, high-quality visualizations, and conversational guidance that feels intuitive and inspiring.
**REQUIREMENTS:**
- Deliver production-quality, zero-error code with robust error handling.
- Ensure educational clarity and excellence.
- Adhere to WCAG 2.1 AA accessibility standards.
- Optimize for performance and responsiveness.
- Maintain StuddyHub AI branding consistency.
**UI GUIDANCE:**
- Reference specific UI elements (e.g., "Click the Mic icon to record your question").
- Highlight features like "Upload files via the Paperclip button" or "Explore quizzes in the Study Tab".
- Provide context-aware suggestions to enhance user interaction.`;
  const mermaidExcellenceStandards = `
**MERMAID DIAGRAM RULES:**
- Begin with a clear graph type (e.g., flowchart TD, graph LR).
- Define all nodes before connections: A[Label] --> B.
- Avoid parentheses in square bracket labels to prevent parser errors (e.g., use A[Start - User Auth] instead of A[Start (User Auth)]).
- Use proper link styles: -->, ---, -.->, ==>.
- Validate syntax using Mermaid Live Editor before output.
**VALIDATION CHECKLIST:**
- Is graph type declared?
- Are nodes defined before connections?
- Is syntax free of reserved words or trailing spaces?
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
- Start with digraph G { or graph G { and specify rankdir (e.g., LR, TB).
- Define nodes with clear labels: a [label="Node A"].
- Use valid edge syntax: -> (directed) or -- (undirected).
- Escape special characters in labels (e.g., "Node \"A\"").
- Validate attributes and syntax before output.
**VALIDATION CHECKLIST:**
- Is graph type declared?
- Are nodes defined before edges?
- Are attributes valid and properly formatted?
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
- Use supported chart types: bar, line, pie, doughnut, radar, polarArea, scatter.
- Provide numeric data in datasets.
- Set "maintainAspectRatio": false for flexible sizing.
- Include responsive design, tooltips, and legends for clarity.
- Validate data structure before output.
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
- Create scenes with function createScene(canvas, THREE, OrbitControls).
- Return object with {scene, renderer, cleanup} for proper resource management.
- Include ambient and directional lighting, use MeshStandardMaterial.
- Load textures from CDN with fallback solid colors.
- Implement cleanup for geometries, materials, and textures.
- Validate scene rendering before output.
**TEMPLATE:**
\`\`\`threejs
function createScene(canvas, THREE, OrbitControls) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({canvas});
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const controls = new OrbitControls(camera, renderer.domElement);
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
  const cleanup = () => {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    renderer.dispose();
  };
  return {scene, renderer, cleanup};
}
\`\`\``;
  const htmlExcellence = `
**HTML RULES:**
- Use semantic HTML5 with ARIA labels for accessibility.
- Apply mobile-first design with Tailwind CSS (StuddyHub colors: blue-500, gray-100).
- Avoid local storage references.
- Ensure cross-browser compatibility.
- Validate HTML structure before output.
**TEMPLATE:**
\`\`\`html
<section class="bg-blue-500 text-white p-6 rounded-lg" role="region" aria-label="Study Content">
  <h2 class="text-xl font-bold">Welcome to StuddyHub AI</h2>
  <p>Click the Mic icon to ask a question or upload notes via the Paperclip button.</p>
</section>
\`\`\``;
  const conversationalExcellence = `
**CONVERSATIONAL STYLE:**
- Adopt a warm, encouraging, and professional tone, as if mentoring a curious programmer.
- Use discovery questions to gauge understanding (e.g., "Have you worked with async functions before?").
- Build concepts progressively, linking to prior knowledge or real-world examples.
- Encourage experimentation with phrases like "Try tweaking this code in the StuddyHub Code Editor!".`;
  const adaptiveLearningSystem = `
**ADAPTIVE LEARNING:**
- Tailor content to ${learningStyle}:
  - Visual: Prioritize diagrams (Mermaid, Chart.js) and visual examples.
  - Auditory: Use narrative explanations and suggest voice interactions ("Use the Mic icon").
  - Kinesthetic: Include interactive tasks (e.g., "Modify this code in the Code Editor").
  - Reading/Writing: Provide detailed text explanations and references.
- Adjust difficulty to ${learningPreferences?.difficulty || 'intermediate'} (beginner, intermediate, advanced).
- Analyze user input, extract key concepts, and deliver multi-modal content (text, code, visuals).
- Suggest next steps based on user progress (e.g., "Explore the Quizzes Tab for practice").`;
  const errorPreventionProtocols = `
**ERROR PREVENTION:**
- Validate all code and visualizations before output using tools like Mermaid Live Editor or browser dev tools.
- Implement error handling in code (e.g., try-catch blocks, fallback data).
- If errors are detected, self-correct and explain fixes conversationally (e.g., "I noticed a syntax issue; here's the corrected version...").
- Test responsiveness and accessibility compliance before delivery.`;
  const professionalStandards = `
**STANDARDS:**
- Deliver enterprise-grade code quality with clear comments and modular structure.
- Ensure educational content is accurate, concise, and engaging.
- Maintain StuddyHub AI branding (e.g., use blue-500 for primary elements).
- Prioritize intuitive UX with clear feedback (e.g., "Loading complete! Check the Notes Tab.").`;
  const executionFramework = `
**RESPONSE FRAMEWORK:**
1. Analyze user context and programming knowledge level.
2. Design a solution tailored to the user's learning style and preferences.
3. Generate error-free code and visualizations, validated for accuracy.
4. Engage conversationally, using clear explanations and interactive suggestions.
5. Adapt responses based on user feedback or interaction history.`;
  const finalSystemIntegration = `
**COMMITMENT:**
- Provide cutting-edge, intelligent responses that inspire learning.
- Uphold educational and technical excellence.
- Foster a human connection through clear, engaging, and supportive interactions.
- Guarantee high-quality, error-free deliverables every time.`;
  const audioExcellence = `
**FILE PROCESSING - AUDIO:**
- Transcribe audio files accurately, preserving spoken content, punctuation, and speaker changes.
- Provide a summary of key topics and metadata (e.g., audio type, language).
- Handle audio inputs (e.g., audio/mpeg, audio/wav) via base64-encoded data, similar to images.
- If audio is unclear, note problematic sections and provide partial transcription.`;
  return `${basePrompt}
${audioExcellence}
${mermaidExcellenceStandards}
${dotGraphExcellence}
${chartJsExcellence}
${threeJsExcellence}
${htmlExcellence}
${conversationalExcellence}
${adaptiveLearningSystem}
${errorPreventionProtocols}
${professionalStandards}
${executionFramework}
${finalSystemIntegration}`;
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
      requestData = await req.json();
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
    const { userId, sessionId, learningStyle = 'visual', learningPreferences = {}, chatHistory = [], message = '', attachedDocumentIds = [], attachedNoteIds = [], imageUrl = null, imageMimeType = null, aiMessageIdToUpdate = null } = requestData;
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

    console.log(`Starting processing of ${files.length} files...`);
    await processFilesInBatches(files, geminiApiKey, userId);

    for (const file of files) {
      const documentId = await saveFileToDatabase(file, userId);
      if (documentId) {
        uploadedDocumentIds.push(documentId);
        if (file.type === 'image' && !userMessageImageUrl) {
          const { data: docData, error: docError } = await supabase.from('documents').select('file_url, file_type').eq('id', documentId).single();
          if (docData && !docError) {
            userMessageImageUrl = docData.file_url;
            userMessageImageMimeType = docData.file_type;
          }
        }
      }
    }
    const allDocumentIds = [
      ...new Set([
        ...uploadedDocumentIds,
        ...attachedDocumentIds
      ])
    ];
    await ensureChatSession(userId, sessionId, allDocumentIds);
    let attachedContext = '';
    if (allDocumentIds.length > 0 || attachedNoteIds.length > 0) {
      attachedContext = await buildAttachedContext(allDocumentIds, attachedNoteIds, userId);
    }
    const systemPrompt = createSystemPrompt(learningStyle, learningPreferences);
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
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        if (msg.role === 'user') {
          const userParts = [];
          if (msg.parts && Array.isArray(msg.parts)) {
            for (const part of msg.parts) {
              if (part.text) userParts.push({
                text: part.text
              });
              if (part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
                userParts.push({
                  inlineData: {
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data
                  }
                });
              }
            }
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
                text: msg.parts?.[0]?.text || msg.content || ''
              }
            ]
          });
        }
      }
    }
    if (message || files.length > 0 || attachedContext) {
      const currentMessageParts = [];
      if (message) currentMessageParts.push({
        text: message
      });
      if (attachedContext) currentMessageParts.push({
        text: attachedContext
      });
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
            text: `[File: ${file.name} (${fileTypeLabel}) Content Start]\n${file.content}\n[File Content End]`
          });
        }
      }
      if (currentMessageParts.length > 0) {
        geminiContents.push({
          role: 'user',
          parts: currentMessageParts
        });
      }
      const userMessageData = {
        userId,
        sessionId,
        content: message,
        role: 'user',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        imageUrl: userMessageImageUrl || imageUrl,
        imageMimeType: userMessageImageMimeType || imageMimeType
      };
      await saveChatMessage(userMessageData);
    }
    if (aiMessageIdToUpdate) {
      await supabase.from('chat_messages').update({
        is_updating: true,
        is_error: false
      }).eq('id', aiMessageIdToUpdate).eq('session_id', sessionId).eq('user_id', userId);
    }
    const geminiApiUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    geminiApiUrl.searchParams.append('key', geminiApiKey);
    const response = await fetch(geminiApiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: Math.min(678987, MAX_GEMINI_INPUT_TOKENS)
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
    generatedText = generatedText.split('\n').map((line) => line.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ').trim()).filter((line) => line.length > 0 || line.trim().length === 0).join('\n');
    const assistantMessageData = {
      userId,
      sessionId,
      content: generatedText,
      role: 'assistant',
      attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
      attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
      imageUrl: userMessageImageUrl || imageUrl,
      imageMimeType: userMessageImageMimeType || imageMimeType
    };
    if (aiMessageIdToUpdate) {
      await supabase.from('chat_messages').update({
        content: generatedText,
        is_updating: false,
        is_error: false
      }).eq('id', aiMessageIdToUpdate).eq('session_id', sessionId).eq('user_id', userId);
    } else {
      await saveChatMessage(assistantMessageData);
    }
    await updateSessionLastMessage(sessionId);
    const processingTime = Date.now() - startTime;
    return new Response(JSON.stringify({
      response: generatedText,
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      processingTime,
      filesProcessed: files.length,
      documentIds: allDocumentIds,
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