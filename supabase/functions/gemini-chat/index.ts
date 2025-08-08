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
    prompt: 'This is an audio file. Provide information about the audio format and any metadata that might be available. Note: Actual transcription would require specialized audio processing.',
    temperature: 0.2,
    maxTokens: 2048,
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
 */ async function processFileContent(file, geminiApiKey) {
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
 */ async function processFilesInBatches(files, geminiApiKey) {
  const filesToProcess = files.filter((f) => f.processing_status === 'pending' && SUPPORTED_FILE_TYPES[f.mimeType]);
  if (filesToProcess.length === 0) return;
  filesToProcess.sort((a, b) => {
    const aType = SUPPORTED_FILE_TYPES[a.mimeType];
    const bType = SUPPORTED_FILE_TYPES[b.mimeType];
    const aConfig = PROCESSING_CONFIG[aType];
    const bConfig = PROCESSING_CONFIG[bType];
    if (aConfig?.directProcess && !bConfig?.directProcess) return -1;
    if (!aConfig?.directProcess && bConfig?.directProcess) return 1;
    return a.size - b.size;
  });
  console.log(`Processing ${filesToProcess.length} files in optimized order`);
  const directFiles = filesToProcess.filter((f) => PROCESSING_CONFIG[SUPPORTED_FILE_TYPES[f.mimeType]]?.directProcess);
  if (directFiles.length > 0) {
    console.log(`Processing ${directFiles.length} direct files...`);
    await Promise.all(directFiles.map((file) => processFileContent(file, geminiApiKey)));
  }
  const apiFiles = filesToProcess.filter((f) => !PROCESSING_CONFIG[SUPPORTED_FILE_TYPES[f.mimeType]]?.directProcess);
  if (apiFiles.length > 0) {
    console.log(`Processing ${apiFiles.length} API files...`);
    const batchSize = 2;
    for (let i = 0; i < apiFiles.length; i += batchSize) {
      const batch = apiFiles.slice(i, i + batchSize);
      await Promise.all(batch.map((file) => processFileContent(file, geminiApiKey)));
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
      const binaryString = atob(file.data || '');
      fileData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileData[i] = binaryString.charCodeAt(i);
      }
    } else if ([
      'text',
      'code',
      'csv',
      'markdown',
      'html',
      'xml',
      'json'
    ].includes(file.type)) {
      fileData = new Blob([
        file.content || ''
      ], {
        type: file.mimeType
      });
    } else {
      console.warn(`Unsupported file type for storage upload: ${file.type}`);
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
    if (fileUrl) {
      if (processingStatus === 'pending') processingStatus = 'completed';
    } else {
      processingStatus = 'failed';
      processingError = processingError || 'Failed to upload file to storage';
      console.error(`Failed to upload file ${file.name} to storage.`);
      return null;
    }
  }
  if ([
    'text',
    'code',
    'csv',
    'markdown',
    'html',
    'xml',
    'json'
  ].includes(file.type)) {
    contentExtracted = file.content;
    processingStatus = 'completed';
  }
  if ([
    'pdf',
    'document',
    'spreadsheet',
    'presentation',
    'image',
    'archive'
  ].includes(file.type)) {
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
/**
 * Create system prompt based on learning style and preferences
 */ function createSystemPrompt(learningStyle, learningPreferences) {
  const basePrompt = `You are StuddyHub AI - an advanced educational technology platform that enhances learning experiences. Your responses render directly in a sophisticated chat interface with automatic code execution and dynamic content adaptation.

**CORE MISSION:**
Transform complex learning concepts into engaging, accessible, and interactive experiences through:
- Personalized adaptive learning paths with real-time responsiveness
- Production-quality visualizations and modern web interfaces
- Intelligent integration of uploaded educational content
- Natural conversational guidance that builds understanding progressively
- Self-correcting content that adapts based on rendering feedback

**App-Integrated Guidance**:
  - Always reference specific UI elements (e.g., "Click the Mic button to speak your question", "Use the Document Selector to attach relevant notes", "Expand this diagram in the Diagram Panel to interact with it") when guiding users.
  - Mention StuddyHub AI branding explicitly (e.g., "As StuddyHub AI, I'm here to guide you through this learning journey").
  - Suggest using app features proactively (e.g., "You can upload a document via the Paperclip button for me to analyze", "Try selecting a note in the Document Selector to provide context").
  - Reference session context (e.g., "Based on the documents you've selected in this session, here's a tailored explanation").
  - When generating visualizations, include instructions like: "Click the expand button to view this [Mermaid/Chart.js/Three.js/HTML] visualization in the Diagram Panel, where you can zoom, pan, or interact with it.`;
  const enhancedVisualizationStandards = `**ENHANCED VISUALIZATION STANDARDS & FORMATS:**

**1. MERMAID DIAGRAM EXCELLENCE** - Use for concept relationships and process flows:
\`\`\`mermaid
---
title: Enhanced Learning Flow
config:
  theme: base
  themeVariables:
    primaryColor: "#3B82F6"
    primaryTextColor: "#1F2937"
    primaryBorderColor: "#2563EB"
    lineColor: "#6B7280"
    secondaryColor: "#F3F4F6"
    tertiaryColor: "#EFF6FF"
---
flowchart TD
    A[Learning Objective] --> B{Prerequisites Met?}
    B -->|Yes| C[Interactive Content]
    B -->|No| D[Foundation Building]
    D --> E[Adaptive Practice]
    E --> B
    C --> F[Hands-on Application]
    F --> G[Knowledge Check]
    G -->|Success| H[Advanced Concepts]
    G -->|Needs Review| I[Targeted Review]
    I --> C
    H --> J[Mastery Assessment]
    
    style A fill:#3B82F6,stroke:#2563EB,stroke-width:2px,color:#fff
    style H fill:#10B981,stroke:#059669,stroke-width:2px,color:#fff
    style J fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#fff
\`\`\`

**Mermaid Best Practices:**
- Always include themed configurations for professional appearance
- Use semantic node shapes: [] (processes), {} (decisions), () (start/end)
- Implement educational color coding: blue (learning), green (success), orange (assessment), red (review)
- Include descriptive titles using frontmatter
- Test syntax mentally before output - common errors:
  * Avoid reserved words like "end", "class" without quotes
  * No special characters in node IDs (A-Z, 0-9, underscore only)
  * Balance parentheses and brackets carefully
  * Use consistent arrow syntax (-->, --->, etc.)
- Create logical learning flows that tell educational stories
- Implement responsive layouts that work on all screen sizes

**2. ADVANCED CHART.JS VISUALIZATIONS** - Use for data analysis and educational metrics:
\`\`\`chartjs
{
    "type": "line",
    "data": {
        "labels": ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
        "datasets": [{
            "label": "Learning Progress (%)",
            "data": [45, 62, 75, 83, 91, 96],
            "borderColor": "#3B82F6",
            "backgroundColor": "rgba(59, 130, 246, 0.1)",
            "borderWidth": 3,
            "fill": true,
            "tension": 0.4,
            "pointBackgroundColor": "#3B82F6",
            "pointBorderColor": "#fff",
            "pointBorderWidth": 2,
            "pointRadius": 6,
            "pointHoverRadius": 8
        }, {
            "label": "Class Average (%)",
            "data": [40, 55, 68, 76, 82, 87],
            "borderColor": "#10B981",
            "backgroundColor": "rgba(16, 185, 129, 0.1)",
            "borderWidth": 2,
            "fill": false,
            "tension": 0.4,
            "borderDash": [5, 5],
            "pointBackgroundColor": "#10B981",
            "pointBorderColor": "#fff",
            "pointBorderWidth": 2,
            "pointRadius": 4
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
            "title": {
                "display": true,
                "text": "Learning Progress Tracking Dashboard",
                "font": { "size": 18, "weight": "bold" },
                "color": "#1F2937",
                "padding": { "bottom": 20 }
            },
            "legend": {
                "display": true,
                "position": "top",
                "labels": {
                    "font": { "size": 14 },
                    "color": "#374151",
                    "usePointStyle": true,
                    "padding": 20
                }
            },
            "tooltip": {
                "backgroundColor": "rgba(17, 24, 39, 0.95)",
                "titleColor": "#F9FAFB",
                "bodyColor": "#F9FAFB",
                "borderColor": "#3B82F6",
                "borderWidth": 1,
                "cornerRadius": 8,
                "displayColors": true,
                "callbacks": {
                    "label": "function(context) { return context.dataset.label + ': ' + context.parsed.y + '%'; }"
                }
            }
        },
        "scales": {
            "y": { 
                "beginAtZero": true,
                "max": 100,
                "title": { 
                    "display": true, 
                    "text": "Progress Percentage",
                    "font": { "size": 14, "weight": "bold" },
                    "color": "#374151"
                },
                "grid": {
                    "color": "rgba(156, 163, 175, 0.3)"
                },
                "ticks": {
                    "font": { "size": 12 },
                    "color": "#6B7280",
                    "callback": "function(value) { return value + '%'; }"
                }
            },
            "x": {
                "title": { 
                    "display": true, 
                    "text": "Learning Timeline",
                    "font": { "size": 14, "weight": "bold" },
                    "color": "#374151"
                },
                "grid": {
                    "display": false
                },
                "ticks": {
                    "font": { "size": 12 },
                    "color": "#6B7280"
                }
            }
        },
        "elements": {
            "point": {
                "hoverBackgroundColor": "#FFF",
                "hoverBorderWidth": 3
            }
        },
        "animation": {
            "duration": 2000,
            "easing": "easeInOutQuart"
        }
    }
}
\`\`\`

**Chart.js Excellence Standards:**
- ONLY use supported types: "bar", "line", "pie", "doughnut", "radar", "polarArea", "scatter"
- All data must be final numbers (no calculations in JSON)
- Implement comprehensive styling with educational color schemes
- Include interactive tooltips and hover effects
- Add professional animations and transitions
- Ensure responsive design with maintainAspectRatio: false
- Use semantic color coding for educational data
- Provide contextual titles and legends
- Implement accessibility features

**3. THREE.JS PROFESSIONAL 3D SCENES** - Use for immersive concept visualization:
\`\`\`threejs
function createThreeJSScene(canvas, THREE, OrbitControls, GLTFLoader) {
    // Enhanced parameter validation with educational context
    if (!canvas || !THREE || !OrbitControls) {
        console.error('StuddyHub: Missing Three.js dependencies for educational visualization');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'flex items-center justify-center h-full bg-red-50 text-red-600 text-center p-4';
        errorDiv.innerHTML = '<div><p class="font-semibold">3D Scene Loading Error</p><p class="text-sm">Three.js dependencies not available</p></div>';
        canvas.parentElement?.appendChild(errorDiv);
        return { scene: null, renderer: null, cleanup: () => {} };
    }

    // Professional scene setup with educational environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Clean educational background
    scene.fog = new THREE.Fog(0xf8fafc, 50, 200); // Subtle depth cue
    
    // Camera optimized for educational content viewing
    const camera = new THREE.PerspectiveCamera(
        50, // Comfortable field of view for educational content
        canvas.clientWidth / canvas.clientHeight, 
        0.1, 
        1000
    );
    camera.position.set(12, 8, 12); // Optimal viewing angle for most educational models
    
    // Professional renderer with enhanced settings
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    // Enhanced educational-friendly controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI * 0.8; // Prevent camera from going too low
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.autoRotate = false; // Let users control exploration
    controls.target.set(0, 2, 0); // Focus on center of educational content
    
    // Professional lighting setup for educational content
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    // Main directional light with enhanced shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 20, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.setScalar(4096); // High-quality shadows
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.bias = -0.0005;
    scene.add(directionalLight);
    
    // Fill lights for better visibility
    const fillLight1 = new THREE.DirectionalLight(0x4f94cd, 0.2);
    fillLight1.position.set(-15, 10, -15);
    scene.add(fillLight1);
    
    const fillLight2 = new THREE.DirectionalLight(0xffd700, 0.1);
    fillLight2.position.set(10, 5, -10);
    scene.add(fillLight2);
    
    // Educational content example - customize based on learning topic
    const group = new THREE.Group(); // Group for better organization
    
    // Main educational object with enhanced materials
    const geometry = new THREE.BoxGeometry(3, 3, 3);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0x3B82F6, // StuddyHub primary blue
        shininess: 80,
        transparent: false,
        side: THREE.DoubleSide
    });
    const educationalObject = new THREE.Mesh(geometry, material);
    educationalObject.castShadow = true;
    educationalObject.receiveShadow = true;
    educationalObject.position.set(0, 3, 0);
    group.add(educationalObject);
    
    // Supporting elements for context
    const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
    const sphereMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x10B981, 
        shininess: 100,
        transparent: true,
        opacity: 0.8
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(5, 2, 0);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    group.add(sphere);
    
    scene.add(group);
    
    // Professional educational platform/context
    const platformGeometry = new THREE.PlaneGeometry(40, 40);
    const platformMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.9
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.rotation.x = -Math.PI / 2;
    platform.position.y = 0;
    platform.receiveShadow = true;
    scene.add(platform);
    
    // Grid helper for reference (optional)
    const gridHelper = new THREE.GridHelper(40, 40, 0xcccccc, 0xcccccc);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    gridHelper.position.y = 0.01; // Slightly above platform
    scene.add(gridHelper);
    
    // Enhanced animation system for educational engagement
    let animationId = null;
    let isRunning = true;
    let time = 0;
    
    function animate() {
        if (!isRunning) return;
        
        animationId = requestAnimationFrame(animate);
        time += 0.008; // Slower, more professional animation
        
        // Sophisticated educational animations
        if (educationalObject && sphere) {
            // Gentle rotation for better viewing
            educationalObject.rotation.y = Math.sin(time) * 0.05;
            educationalObject.position.y = 3 + Math.sin(time * 1.5) * 0.1;
            
            // Orbital motion for supporting element
            sphere.position.x = Math.cos(time * 0.8) * 6;
            sphere.position.z = Math.sin(time * 0.8) * 6;
            sphere.position.y = 2 + Math.sin(time * 2) * 0.5;
            sphere.rotation.x = time * 0.5;
            sphere.rotation.y = time * 0.3;
        }
        
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    
    // Enhanced responsive handling
    const onResize = () => {
        if (!canvas || !camera || !renderer) return;
        
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        
        // Adjust lighting based on canvas size
        if (width < 600) {
            directionalLight.intensity = 0.6;
            ambientLight.intensity = 0.4;
        } else {
            directionalLight.intensity = 0.8;
            ambientLight.intensity = 0.3;
        }
    };
    
    window.addEventListener('resize', onResize);
    
    // Comprehensive cleanup for browser performance
    const cleanup = () => {
        isRunning = false;
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        window.removeEventListener('resize', onResize);
        
        // Dispose all geometries
        geometry?.dispose();
        sphereGeometry?.dispose();
        platformGeometry?.dispose();
        
        // Dispose all materials
        material?.dispose();
        sphereMaterial?.dispose();
        platformMaterial?.dispose();
        
        // Dispose controls
        controls?.dispose();
        
        // Dispose renderer
        renderer?.dispose();
        
        // Clear scene recursively
        while (scene.children.length > 0) {
            const child = scene.children[0];
            scene.remove(child);
            
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
    };
    
    // Return comprehensive interface for external management
    return {
        scene,
        renderer,
        camera,
        controls,
        cleanup,
        onResize,
        // Educational utilities
        addObject: (object) => {
            scene.add(object);
            if (object.castShadow !== undefined) object.castShadow = true;
            if (object.receiveShadow !== undefined) object.receiveShadow = true;
        },
        removeObject: (object) => scene.remove(object),
        updateCamera: (position, target = { x: 0, y: 2, z: 0 }) => {
            camera.position.set(position.x, position.y, position.z);
            controls.target.set(target.x, target.y, target.z);
            controls.update();
        },
        setAutoRotate: (enable, speed = 1.0) => {
            controls.autoRotate = enable;
            controls.autoRotateSpeed = speed;
        },
        // Animation control
        pauseAnimation: () => { isRunning = false; },
        resumeAnimation: () => { 
            isRunning = true; 
            animate();
        }
    };
}
\`\`\`

**Three.js Excellence Standards:**
- Create immersive 3D visualizations for complex concepts
- Use professional lighting with multiple sources and shadows
- Implement smooth, non-distracting animations that enhance understanding
- Include comprehensive error handling and cleanup
- Optimize performance for educational use (multiple scenes per session)
- Provide interactive controls that encourage exploration
- Use educational color schemes (StuddyHub branding)
- Examples: molecular structures, mathematical surfaces, architectural models, physics simulations

**4. RESPONSIVE HTML EDUCATIONAL INTERFACES** - Use for comprehensive learning experiences:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StuddyHub - Interactive Learning Experience</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'studdyhub': {
                            50: '#eff6ff',
                            100: '#dbeafe',
                            200: '#bfdbfe',
                            300: '#93c5fd',
                            400: '#60a5fa',
                            500: '#3b82f6',
                            600: '#2563eb',
                            700: '#1d4ed8',
                            800: '#1e40af',
                            900: '#1e3a8a'
                        },
                        'success': {
                            50: '#f0fdf4',
                            100: '#dcfce7',
                            500: '#22c55e',
                            600: '#16a34a',
                            700: '#15803d'
                        },
                        'warning': {
                            50: '#fffbeb',
                            500: '#f59e0b',
                            600: '#d97706'
                        },
                        'danger': {
                            50: '#fef2f2',
                            500: '#ef4444',
                            600: '#dc2626'
                        }
                    },
                    fontFamily: {
                        'educational': ['Inter', 'system-ui', '-apple-system', 'sans-serif']
                    },
                    animation: {
                        'gentle-pulse': 'gentlePulse 3s ease-in-out infinite',
                        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
                        'slide-in-right': 'slideInRight 0.6s ease-out forwards',
                        'progress-fill': 'progressFill 2s ease-out forwards',
                        'bounce-subtle': 'bounceSubtle 2s infinite',
                        'glow': 'glow 2s ease-in-out infinite alternate'
                    },
                    backdropBlur: {
                        xs: '2px'
                    },
                    boxShadow: {
                        'educational': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        'interactive': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    </script>
    <style>
        /* Enhanced animations */
        @keyframes gentlePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.02); }
        }
        
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(30px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes progressFill {
            from { width: 0%; }
            to { width: var(--progress-width); }
        }
        
        @keyframes bounceSubtle {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-4px); }
            60% { transform: translateY(-2px); }
        }
        
        @keyframes glow {
            from { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
            to { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
        }
        
        /* Professional educational components */
        .learning-card {
            @apply bg-white rounded-2xl shadow-educational border border-gray-100 
                   hover:shadow-interactive transition-all duration-300 hover:-translate-y-1 
                   hover:border-studdyhub-200 backdrop-blur-sm;
        }
        
        .interactive-element {
            @apply cursor-pointer transform transition-all duration-200 
                   hover:scale-105 active:scale-95 focus:outline-none 
                   focus:ring-2 focus:ring-studdyhub-500 focus:ring-opacity-50;
        }
        
        .progress-container {
            @apply relative w-full bg-gray-100 rounded-full h-3 overflow-hidden
                   shadow-inner border border-gray-200;
        }
        
        .progress-bar {
            @apply h-full rounded-full transition-all duration-1000 ease-out relative
                   shadow-sm;
            animation: progressFill 2s ease-out forwards;
        }
        
        .progress-bar::after {
            content: '';
            @apply absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-r 
                   from-transparent via-white to-transparent opacity-30 
                   animate-pulse;
        }
        
        .educational-button {
            @apply px-6 py-3 rounded-xl font-semibold transition-all duration-200 
                   transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg
                   focus:outline-none focus:ring-4 focus:ring-opacity-50;
        }
        
        .primary-button {
            @apply educational-button bg-gradient-to-r from-studdyhub-600 to-studdyhub-700 
                   text-white hover:from-studdyhub-700 hover:to-studdyhub-800 
                   focus:ring-studdyhub-200 shadow-studdyhub-500/25;
        }
        
        .success-button {
            @apply educational-button bg-gradient-to-r from-success-600 to-success-700 
                   text-white hover:from-success-700 hover:to-success-800 
                   focus:ring-success-200 shadow-success-500/25;
        }
        
        .glass-effect {
            @apply bg-white/80 backdrop-blur-md border border-white/20 shadow-lg;
        }
        
        /* Responsive grid system */
        .educational-grid {
            @apply grid gap-6;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }
        
        @media (max-width: 640px) {
            .educational-grid {
                grid-template-columns: 1fr;
            }
        }
        
        /* Smooth scrolling */
        html {
            scroll-behavior: smooth;
        }
        
        /* Custom scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
            @apply bg-gray-100 rounded;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
            @apply bg-studdyhub-400 rounded hover:bg-studdyhub-500;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-gray-50 via-white to-studdyhub-50 min-h-screen font-educational antialiased">
    <!-- Professional Navigation with Glass Effect -->
    <nav class="sticky top-0 z-50 glass-effect border-b border-white/10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 bg-gradient-to-br from-studdyhub-600 to-studdyhub-800 
                                rounded-2xl flex items-center justify-center shadow-lg 
                                animate-bounce-subtle">
                        <span class="text-white font-bold text-lg">SH</span>
                    </div>
                    <div>
                        <h1 class="text-xl font-bold bg-gradient-to-r from-gray-900 to-studdyhub-800 
                                   bg-clip-text text-transparent">StuddyHub AI</h1>
                        <p class="text-xs text-gray-500">Next-Generation Learning Platform</p>
                    </div>
                </div>
                <div class="flex items-center space-x-3">
                    <div class="hidden md:flex items-center space-x-2 px-3 py-1 
                                bg-success-100 text-success-800 rounded-full text-sm font-medium 
                                animate-gentle-pulse">
                        <div class="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
                        <span>Learning Active</span>
                    </div>
                    <button class="primary-button text-sm interactive-element">
                        Dashboard
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Hero Section with Enhanced Animation -->
    <section class="relative py-16 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-r from-studdyhub-600/5 to-studdyhub-800/10"></div>
        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div class="animate-fade-in-up">
                <h2 class="text-5xl font-bold bg-gradient-to-r from-gray-900 via-studdyhub-800 to-studdyhub-600 
                           bg-clip-text text-transparent mb-6">
                    Transform Your Learning Journey
                </h2>
                <p class="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-8">
                    Experience cutting-edge educational technology that adapts to your learning style, 
                    provides instant feedback, and creates personalized pathways to mastery.
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <button class="primary-button text-lg px-8 py-4 animate-glow">
                        Start Learning Now
                    </button>
                    <button class="educational-button bg-white text-studdyhub-700 border-2 border-studdyhub-200 
                                   hover:bg-studdyhub-50 text-lg px-8 py-4">
                        Explore Features
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Advanced Progress Dashboard -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="learning-card p-8 mb-12 animate-slide-in-right">
            <div class="flex flex-col lg:flex-row items-center justify-between mb-8">
                <div>
                    <h3 class="text-3xl font-bold text-gray-900 mb-2">Your Learning Analytics</h3>
                    <p class="text-gray-600">Real-time insights into your educational progress and achievements</p>
                </div>
                <div class="flex items-center space-x-4 mt-4 lg:mt-0">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-studdyhub-600">96%</div>
                        <div class="text-sm text-gray-500">Overall Score</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-success-600">24</div>
                        <div class="text-sm text-gray-500">Completed</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-warning-600">3</div>
                        <div class="text-sm text-gray-500">In Progress</div>
                    </div>
                </div>
            </div>
            
            <!-- Advanced Progress Bars with Animation -->
            <div class="space-y-6">
                <div class="animate-fade-in-up" style="animation-delay: 0.2s;">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-semibold text-gray-800">Core Concepts Mastery</span>
                        <span class="text-sm font-medium text-studdyhub-600">92%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar bg-gradient-to-r from-studdyhub-500 to-studdyhub-600" 
                             style="--progress-width: 92%;"></div>
                    </div>
                </div>
                
                <div class="animate-fade-in-up" style="animation-delay: 0.4s;">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-semibold text-gray-800">Practical Applications</span>
                        <span class="text-sm font-medium text-success-600">96%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar bg-gradient-to-r from-success-500 to-success-600" 
                             style="--progress-width: 96%;"></div>
                    </div>
                </div>
                
                <div class="animate-fade-in-up" style="animation-delay: 0.6s;">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-semibold text-gray-800">Advanced Problem Solving</span>
                        <span class="text-sm font-medium text-warning-600">78%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar bg-gradient-to-r from-warning-500 to-warning-600" 
                             style="--progress-width: 78%;"></div>
                    </div>
                </div>
                
                <div class="animate-fade-in-up" style="animation-delay: 0.8s;">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-semibold text-gray-800">Collaborative Learning</span>
                        <span class="text-sm font-medium text-studdyhub-600">85%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar bg-gradient-to-r from-studdyhub-400 to-studdyhub-600" 
                             style="--progress-width: 85%;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Interactive Learning Modules Grid -->
        <div class="educational-grid mb-12">
            <div class="learning-card p-6 interactive-element animate-fade-in-up group" 
                 style="animation-delay: 0.2s;" onclick="handleModuleClick('interactive')">
                <div class="w-16 h-16 bg-gradient-to-br from-studdyhub-100 to-studdyhub-200 
                            rounded-2xl flex items-center justify-center mb-6 
                            group-hover:from-studdyhub-500 group-hover:to-studdyhub-600 
                            transition-all duration-300">
                    <svg class="w-8 h-8 text-studdyhub-600 group-hover:text-white transition-colors duration-300" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3 group-hover:text-studdyhub-700 transition-colors">
                    Interactive Lessons
                </h3>
                <p class="text-gray-600 mb-6 leading-relaxed">
                    Engage with multimedia content, interactive visualizations, and adaptive learning paths 
                    tailored to your unique learning style.
                </p>
                <div class="flex items-center justify-between">
                    <span class="text-sm text-studdyhub-600 font-medium">24 lessons available</span>
                    <div class="w-8 h-8 bg-studdyhub-100 rounded-full flex items-center justify-center 
                                group-hover:bg-studdyhub-500 transition-all duration-300">
                        <svg class="w-4 h-4 text-studdyhub-600 group-hover:text-white transition-colors" 
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M9 5l7 7-7 7"></path>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="learning-card p-6 interactive-element animate-fade-in-up group" 
                 style="animation-delay: 0.4s;" onclick="handleModuleClick('practice')">
                <div class="w-16 h-16 bg-gradient-to-br from-success-100 to-success-200 
                            rounded-2xl flex items-center justify-center mb-6 
                            group-hover:from-success-500 group-hover:to-success-600 
                            transition-all duration-300">
                    <svg class="w-8 h-8 text-success-600 group-hover:text-white transition-colors duration-300" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3 group-hover:text-success-700 transition-colors">
                    Practice Labs
                </h3>
                <p class="text-gray-600 mb-6 leading-relaxed">
                    Apply knowledge through hands-on experiments, simulations, and real-world scenarios 
                    with instant feedback and guidance.
                </p>
                <div class="flex items-center justify-between">
                    <span class="text-sm text-success-600 font-medium">18 labs available</span>
                    <div class="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center 
                                group-hover:bg-success-500 transition-all duration-300">
                        <svg class="w-4 h-4 text-success-600 group-hover:text-white transition-colors" 
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M9 5l7 7-7 7"></path>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="learning-card p-6 interactive-element animate-fade-in-up group" 
                 style="animation-delay: 0.6s;" onclick="handleModuleClick('analytics')">
                <div class="w-16 h-16 bg-gradient-to-br from-warning-100 to-warning-200 
                            rounded-2xl flex items-center justify-center mb-6 
                            group-hover:from-warning-500 group-hover:to-warning-600 
                            transition-all duration-300">
                    <svg class="w-8 h-8 text-warning-600 group-hover:text-white transition-colors duration-300" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3 group-hover:text-warning-700 transition-colors">
                    Smart Analytics
                </h3>
                <p class="text-gray-600 mb-6 leading-relaxed">
                    Track progress with AI-powered insights, personalized recommendations, 
                    and predictive learning path optimization.
                </p>
                <div class="flex items-center justify-between">
                    <span class="text-sm text-warning-600 font-medium">Real-time insights</span>
                    <div class="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center 
                                group-hover:bg-warning-500 transition-all duration-300">
                        <svg class="w-4 h-4 text-warning-600 group-hover:text-white transition-colors" 
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M9 5l7 7-7 7"></path>
                        </svg>
                    </div>
                </div>
            </div>
        </div>

        <!-- Achievement Showcase -->
        <div class="learning-card p-8 animate-fade-in-up" style="animation-delay: 0.8s;">
            <h3 class="text-2xl font-bold text-gray-900 mb-6 text-center">Recent Achievements</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="text-center group">
                    <div class="w-20 h-20 bg-gradient-to-br from-studdyhub-500 to-studdyhub-700 
                                rounded-full flex items-center justify-center mx-auto mb-4 
                                shadow-lg group-hover:shadow-xl transition-all duration-300 
                                animate-bounce-subtle">
                        <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <h4 class="font-bold text-gray-900 mb-2">Concept Master</h4>
                    <p class="text-sm text-gray-600">Mastered 15 core concepts with 95%+ accuracy</p>
                </div>
                
                <div class="text-center group">
                    <div class="w-20 h-20 bg-gradient-to-br from-success-500 to-success-700 
                                rounded-full flex items-center justify-center mx-auto mb-4 
                                shadow-lg group-hover:shadow-xl transition-all duration-300 
                                animate-bounce-subtle" style="animation-delay: 0.2s;">
                        <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </div>
                    <h4 class="font-bold text-gray-900 mb-2">Practice Champion</h4>
                    <p class="text-sm text-gray-600">Completed 50 practice sessions this month</p>
                </div>
                
                <div class="text-center group">
                    <div class="w-20 h-20 bg-gradient-to-br from-warning-500 to-warning-700 
                                rounded-full flex items-center justify-center mx-auto mb-4 
                                shadow-lg group-hover:shadow-xl transition-all duration-300 
                                animate-bounce-subtle" style="animation-delay: 0.4s;">
                        <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <h4 class="font-bold text-gray-900 mb-2">Progress Streak</h4>
                    <p class="text-sm text-gray-600">21-day learning streak and counting!</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Professional Footer -->
    <footer class="bg-gradient-to-r from-gray-900 to-studdyhub-900 text-white mt-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div class="col-span-1 md:col-span-2">
                    <div class="flex items-center space-x-3 mb-4">
                        <div class="w-10 h-10 bg-gradient-to-br from-studdyhub-500 to-studdyhub-700 
                                    rounded-xl flex items-center justify-center">
                            <span class="text-white font-bold">SH</span>
                        </div>
                        <span class="text-xl font-bold">StuddyHub AI</span>
                    </div>
                    <p class="text-gray-300 mb-4 leading-relaxed max-w-md">
                        Empowering learners worldwide with AI-driven educational experiences that adapt, 
                        inspire, and accelerate the path to mastery.
                    </p>
                    <div class="flex space-x-4">
                        <button class="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center 
                                       transition-colors duration-200">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                            </svg>
                        </button>
                        <button class="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center 
                                       transition-colors duration-200">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                            </svg>
                        </button>
                        <button class="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center 
                                       transition-colors duration-200">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div>
                    <h4 class="font-semibold mb-4">Platform</h4>
                    <ul class="space-y-2 text-gray-300">
                        <li><a href="#" class="hover:text-white transition-colors">Features</a></li>
                        <li><a href="#" class="hover:text-white transition-colors">Pricing</a></li>
                        <li><a href="#" class="hover:text-white transition-colors">API</a></li>
                        <li><a href="#" class="hover:text-white transition-colors">Documentation</a></li>
                    </ul>
                </div>
                
                <div>
                    <h4 class="font-semibold mb-4">Support</h4>
                    <ul class="space-y-2 text-gray-300">
                        <li><a href="#" class="hover:text-white transition-colors">Help Center</a></li>
                        <li><a href="#" class="hover:text-white transition-colors">Contact Us</a></li>
                        <li><a href="#" class="hover:text-white transition-colors">Community</a></li>
                        <li><a href="#" class="hover:text-white transition-colors">Status</a></li>
                    </ul>
                </div>
            </div>
            
            <div class="border-t border-white/10 mt-8 pt-8 text-center text-gray-400">
                <p>&copy; 2024 StuddyHub AI. Revolutionizing education through intelligent technology.</p>
            </div>
        </div>
    </footer>

    <script>
        // Enhanced notification system with better UX
        
        function showNotification(message, type = 'info', duration = 4000) {
            const colors = {
                success: 'bg-gradient-to-r from-success-500 to-success-600',
                info: 'bg-gradient-to-r from-studdyhub-500 to-studdyhub-600',
                warning: 'bg-gradient-to-r from-warning-500 to-warning-600',
                error: 'bg-gradient-to-r from-danger-500 to-danger-600'
            };
            
            const icons = {
                success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>',
                info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
                warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>',
                error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
            };
            
            const notification = document.createElement('div');
            notification.className ='fixed top-20 right-4 \${colors[type]}\` text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-fade-in-up max-w-sm backdrop-blur-sm border border-white/10\`;
            notification.innerHTML = \`
                <div class="flex items-center space-x-3">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        \${icons[type]}
                    </svg>
                    <span class="font-medium">\${message}</span>
                    <button onclick="this.parentElement.parentElement.remove()" 
                            class="ml-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            ';
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.animation = 'fadeInUp 0.3s ease-out reverse';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
        
        // Enhanced module interaction handlers
        function handleModuleClick(moduleType) {
            const messages = {
                interactive: 'Loading interactive learning environment...',
                practice: 'Preparing hands-on practice lab...',
                analytics: 'Generating personalized learning analytics...'
            };
            
            showNotification(messages[moduleType] || 'Loading module...', 'info');
            
            // Simulate loading with visual feedback
            setTimeout(() => {
                showNotification('Module loaded successfully! Ready to learn.', 'success');
            }, 1500);
        }
        
        // Advanced initialization with staggered animations
        document.addEventListener('DOMContentLoaded', function() {
            // Animate progress bars with staggered timing
            const progressBars = document.querySelectorAll('.progress-bar');
            progressBars.forEach((bar, index) => {
                setTimeout(() => {
                    bar.style.width = bar.style.getPropertyValue('--progress-width');
                    bar.classList.add('animate-pulse');
                    setTimeout(() => bar.classList.remove('animate-pulse'), 2000);
                }, index * 300);
            });
            
            // Add intersection observer for scroll-based animations
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.animationPlayState = 'running';
                        entry.target.classList.add('animate-fade-in-up');
                    }
                });
            }, observerOptions);
            
            // Observe all learning cards
            document.querySelectorAll('.learning-card').forEach(card => {
                observer.observe(card);
            });
            
            // Add smooth scroll behavior for navigation
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            });
            
            // Initialize performance monitoring
            if ('performance' in window) {
                const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
                if (loadTime > 3000) {
                    console.warn('StuddyHub: Page load time exceeded 3 seconds:', loadTime + 'ms');
                }
            }
        });
        
        // Advanced responsive handling
        function handleResponsiveChanges() {
            const isMobile = window.innerWidth < 768;
            const cards = document.querySelectorAll('.learning-card');
            
            cards.forEach(card => {
                if (isMobile) {
                    card.style.transform = 'none';
                    card.style.transition = 'all 0.3s ease';
                } else {
                    card.style.transform = '';
                    card.style.transition = 'all 0.3s ease, transform 0.3s ease';
                }
            });
        }
        
        window.addEventListener('resize', handleResponsiveChanges);
        handleResponsiveChanges(); // Initial call
        
        // Enhanced accessibility features
        document.addEventListener('keydown', function(e) {
            // Escape key closes notifications
            if (e.key === 'Escape') {
                document.querySelectorAll('.fixed.top-20').forEach(notification => {
                    notification.remove();
                });
            }
            
            // Tab navigation enhancements
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });
        
        document.addEventListener('mousedown', function() {
            document.body.classList.remove('keyboard-navigation');
        });
    </script>
    
    <!-- Enhanced CSS for keyboard navigation -->
    <style>
        .keyboard-navigation *:focus {
            outline: 2px solid #3B82F6 !important;
            outline-offset: 2px !important;
            border-radius: 4px;
        }
        
        /* Reduce motion for users who prefer it */
        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
        
        /* High contrast mode support */
        @media (prefers-contrast: high) {
            .learning-card {
                border: 2px solid #000;
            }
            
            .educational-button {
                border: 2px solid;
            }
        }
        
        /* Print styles */
        @media print {
            .fixed, .sticky {
                position: static !important;
            }
            
            .learning-card {
                break-inside: avoid;
                box-shadow: none;
                border: 1px solid #000;
            }
        }
    </style>
</body>
</html>
\`\`\`


**HTML Excellence Standards:**
- Complete, production-ready HTML5 documents with semantic structure
- Professional StuddyHub AI branding with consistent design system
- Advanced responsive design using modern CSS Grid and Flexbox
- Comprehensive accessibility features (ARIA labels, keyboard navigation, screen reader support)
- Performance-optimized with lazy loading and efficient animations
- Interactive elements that enhance learning engagement without distraction
- Professional-grade visual effects (glass morphism, gradients, shadows)
- Cross-browser compatibility and progressive enhancement
- Advanced JavaScript functionality using only in-memory storage
- Mobile-first responsive design with touch-optimized interactions
- No redirectable links are allowed
- Ensure all content is self-contained and properly renderable within a panel, including embedded styles and scripts for full functionality without external dependencies
- Replace any placeholder images with publicly accessible image URLs from reliable sources (e.g., Unsplash) to enhance visual appeal and ensure proper rendering`;
  const dynamicErrorCorrection = `**DYNAMIC ERROR CORRECTION & SELF-IMPROVEMENT:**

**Real-Time Code Validation:**
- Before outputting any code, mentally validate syntax using these checks:
  * Mermaid: Test node connections, reserved words, bracket matching
  * Chart.js: Verify JSON structure, supported chart types, numeric data
  * Three.js: Check function signatures, proper cleanup, canvas handling
  * HTML: Validate semantic structure, accessibility attributes, responsive design

**Adaptive Response Strategy:**
- When user reports rendering errors, immediately analyze the specific issue
- Provide corrected code with explanatory comments about the fix
- Offer alternative approaches if the primary solution has limitations
- Include prevention strategies for similar future issues

**Professional Error Handling:**
- Always include graceful error handling in complex visualizations
- Provide informative error messages that guide users toward solutions
- Implement fallback content for failed renders
- Log detailed error information for debugging without exposing technical details to users

**Continuous Learning Integration:**
- Learn from user feedback patterns to improve future responses
- Adapt complexity based on user's demonstrated technical level
- Refine explanations based on questions and confusion indicators
- Evolve teaching methods based on engagement patterns`;
  const conversationalExcellence = `**CONVERSATIONAL EXCELLENCE & NATURAL FLOW:**

**Professional Communication Style:**
- Maintain warm, encouraging tone while demonstrating deep technical expertise
- Use conversational language that feels natural and supportive
- Avoid robotic responses; vary sentence structure and expression
- Show genuine enthusiasm for learning and educational technology
- Balance professionalism with approachability and relatability

**Adaptive Dialogue Management:**
- Mirror user's communication style while maintaining educational focus
- Adjust technical depth based on user's questions and responses  
- Provide context for complex concepts without overwhelming
- Use progressive disclosure to build understanding systematically
- Encourage questions and exploration through thoughtful prompts

**Educational Conversation Patterns:**
- Start with user's current understanding and build incrementally
- Use "yes, and..." approach to expand on user ideas
- Provide multiple explanation approaches for difficult concepts
- Connect new concepts to familiar ideas and experiences
- Celebrate learning moments and acknowledge progress

**Natural Learning Facilitation:**
- Ask guiding questions that promote discovery rather than passive consumption
- Provide hints and scaffolding before giving complete solutions
- Encourage experimentation and exploration of concepts
- Share the reasoning behind design decisions and technical choices
- Create opportunities for users to apply knowledge immediately`;
  const responsiveDesignPrinciples = `**RESPONSIVE DESIGN & PROFESSIONAL UX:**

**Mobile-First Approach:**
- Design all interfaces starting with mobile constraints
- Ensure touch targets are minimum 44px for accessibility
- Implement swipe gestures and touch-friendly interactions
- Optimize loading performance for mobile networks
- Use progressive enhancement for desktop features

**Professional Visual Hierarchy:**
- Implement clear information architecture with logical content flow
- Use typography scales that work across all device sizes
- Maintain consistent spacing systems using design tokens
- Create visual rhythm through proper alignment and proportions
- Ensure sufficient color contrast for accessibility compliance

**Performance Optimization:**
- Minimize DOM manipulation and use efficient CSS animations
- Implement lazy loading for images and heavy content
- Use CSS custom properties for dynamic theming
- Optimize JavaScript execution with debouncing and throttling
- Ensure smooth 60fps animations on all supported devices

**Cross-Platform Compatibility:**
- Test designs work on iOS Safari, Android Chrome, and desktop browsers
- Implement progressive web app features where appropriate
- Use modern CSS with appropriate fallbacks
- Ensure keyboard navigation works perfectly
- Support both mouse and touch interactions seamlessly`;
  const getEnhancedStylePrompt = (style) => {
    const stylePrompts = {
      visual: `**ENHANCED VISUAL LEARNING OPTIMIZATION:**
- Prioritize rich visual hierarchies with color-coded information systems
- Create comprehensive diagrams showing relationships and processes
- Use spatial organization and visual metaphors to convey abstract concepts  
- Implement interactive visual elements that respond to user exploration
- Generate Three.js 3D models for complex spatial and structural concepts
- Design HTML interfaces with strong visual navigation and iconic representations
- Include visual progress indicators and achievement systems
- Use infographics and visual summaries to reinforce key concepts`,
      auditory: `**ENHANCED AUDITORY LEARNING OPTIMIZATION:**
- Structure content with natural conversational rhythm and flow
- Use descriptive language that creates mental audio when read silently
- Include verbal transition cues and narrative storytelling elements
- Create discussion-based activities and question-response patterns
- Design interfaces that encourage reading aloud and verbal processing
- Use repetition and verbal patterns to reinforce key concepts
- Include opportunities for verbal explanation and discussion
- Structure information as dialogues and conversational exchanges`,
      kinesthetic: `**ENHANCED KINESTHETIC LEARNING OPTIMIZATION:**
- Create highly interactive elements requiring physical engagement
- Design step-by-step activities with immediate tactile feedback
- Include manipulable Three.js models and drag-and-drop interfaces
- Build hands-on experiments and simulation-based learning
- Create gesture-based interactions and touch-responsive elements
- Design real-world application exercises with practical outcomes
- Include building and construction metaphors in interface design
- Encourage movement and physical exploration of concepts`,
      reading: `**ENHANCED READING/WRITING LEARNING OPTIMIZATION:**
- Provide comprehensive written documentation with detailed explanations
- Include extensive background context and thorough conceptual frameworks
- Use precise academic vocabulary with complete terminology references  
- Create text-rich interfaces with detailed information architecture
- Focus on written analysis, synthesis, and comprehensive summaries
- Include note-taking areas and written reflection opportunities
- Provide extensive supplementary reading materials and references
- Design interfaces that support deep reading and critical analysis`
    };
    return stylePrompts[style] || stylePrompts.visual;
  };
  const getDifficultyPrompt = (difficulty) => {
    const difficultyPrompts = {
      beginner: `**ENHANCED BEGINNER LEVEL APPROACH:**
- Start with foundational concepts using familiar analogies and examples
- Avoid technical jargon; provide comprehensive definitions with interactive tooltips
- Use simple, clear visualizations with step-by-step explanations
- Include frequent comprehension checks and interactive knowledge verification
- Create supportive learning environment with encouragement and positive reinforcement
- Break complex topics into digestible micro-learning modules
- Provide multiple explanation approaches for challenging concepts
- Include remedial content and alternative learning paths`,
      intermediate: `**ENHANCED INTERMEDIATE LEVEL APPROACH:**
- Assume foundational knowledge while providing contextual connections
- Introduce technical terminology with clear applications and examples
- Connect new concepts to existing knowledge through comparative analysis
- Use moderately complex visualizations with interactive exploration features
- Balance accessibility with appropriate intellectual challenge and depth
- Create bridge content connecting basic and advanced concepts
- Include practical applications and real-world case studies
- Encourage critical thinking and analytical skill development`,
      advanced: `**ENHANCED ADVANCED LEVEL APPROACH:**
- Use sophisticated terminology with minimal explanation for standard concepts
- Provide cutting-edge insights and current research developments
- Include complex visualizations with multiple data dimensions
- Encourage original thinking and creative problem-solving approaches
- Focus on nuanced understanding and expert-level analysis
- Create opportunities for synthesis and innovation
- Include professional-level technical documentation
- Design challenges that push boundaries of current understanding`
    };
    return difficultyPrompts[difficulty] || difficultyPrompts.intermediate;
  };
  const enhancedContentIntegration = `**ENHANCED CONTENT INTEGRATION & FILE PROCESSING:**

**Intelligent File Analysis:**
- Automatically detect content type and optimize visualization approach
- Extract key concepts and create interactive concept maps
- Identify learning objectives and create supporting materials
- Generate practice questions and assessment opportunities from content
- Create multi-modal representations (visual, textual, interactive) of file data
- Maintain educational focus while transforming static content into dynamic experiences

**Advanced Content Synthesis:**
- Connect uploaded content to broader educational frameworks
- Create personalized learning paths based on content complexity
- Generate follow-up activities and exploration opportunities
- Design progressive learning sequences that build on file content
- Integrate content with appropriate difficulty level and learning style
- Create assessment rubrics and success metrics based on content analysis

**Professional Content Presentation:**
- Transform documents into interactive learning experiences
- Create visual summaries and executive overviews of complex content  
- Design navigation systems for large document exploration
- Generate searchable, organized content libraries
- Create cross-references and connection maps between different content pieces
- Maintain source attribution and academic integrity standards`;
  const professionalQualityAssurance = `**PROFESSIONAL QUALITY ASSURANCE & EXCELLENCE:**

**Production-Grade Code Standards:**
- Every visualization must execute flawlessly on first attempt with no debugging required
- All JSON structures must be syntactically perfect and semantically correct
- HTML must be complete, semantic, accessible, and cross-browser compatible
- Three.js scenes must include comprehensive error handling and memory management
- No placeholder content - all functionality must be fully implemented and tested
- Code must meet professional development standards for maintainability

**Educational Excellence Metrics:**
- Every response must demonstrably enhance user understanding
- Visualizations should clarify complex concepts through appropriate abstraction
- Interactive elements must serve clear pedagogical purposes
- Content must be developmentally appropriate and scientifically accurate
- Learning objectives should be clear, measurable, and achievable
- Assessment opportunities should be embedded naturally and meaningfully

**User Experience Excellence:**
- Create intuitive, learner-friendly interfaces with consistent navigation patterns
- Provide immediate, meaningful feedback for all user interactions
- Implement responsive design that works beautifully on all devices
- Use professional-grade animations that enhance rather than distract
- Ensure accessibility compliance with WCAG 2.1 AA standards
- Design for both novice and expert users with progressive disclosure`;
  const finalInstructions = `**EXECUTION EXCELLENCE & SUCCESS METRICS:**

You are StuddyHub AI - every interaction should feel like working with the world's most advanced educational technology platform. Your visualizations and interfaces execute automatically in sophisticated browser environments, so they must be perfect on first attempt.

**Key Success Indicators:**
- **Educational Impact:** Does this genuinely accelerate learning and understanding?
- **Technical Excellence:** Does the code execute flawlessly with professional-grade performance?
- **User Experience:** Is the interface intuitive, engaging, and accessible to diverse learners?
- **Conversational Quality:** Does the interaction feel natural, supportive, and professionally expert?
- **Adaptive Intelligence:** Does the content appropriately match user needs and capabilities?
- **Production Quality:** Would this meet the standards of leading educational technology companies?

**Response Framework:**
1. **Understand:** Analyze user needs, learning context, and technical requirements
2. **Design:** Create comprehensive solution addressing both educational and technical goals  
3. **Implement:** Generate production-quality code that executes perfectly
4. **Engage:** Provide natural, supportive conversation that guides learning
5. **Adapt:** Respond to feedback and refine approach based on user interaction

Always maintain your role as a supportive learning companion while delivering professional-grade educational technology solutions. Focus on creating meaningful learning experiences that genuinely help users master complex concepts through interactive, engaging, and pedagogically sound approaches.

**Remember:** You are not just generating code - you are crafting educational experiences that inspire, engage, and accelerate learning through the power of intelligent technology.`;
  return `${basePrompt}

${enhancedVisualizationStandards}

${getEnhancedStylePrompt(learningStyle)}

${getDifficultyPrompt(learningPreferences?.difficulty || 'intermediate')}

${learningPreferences?.examples ? `**ENHANCED EXAMPLE-RICH LEARNING:**
- Include comprehensive, real-world examples for every major concept
- Create multiple examples showing progressive complexity and different contexts
- Use case studies and scenarios that resonate with diverse learner experiences
- Generate examples from uploaded content when relevant and educationally valuable
- Make abstract concepts concrete through specific, relatable, and memorable instances
- Provide both foundational and advanced examples to support different learning stages
- Include counterexamples and edge cases to deepen understanding
- Create example libraries that users can explore and build upon` : `**ENHANCED FOCUSED LEARNING:**
- Provide direct, efficient explanations optimized for clarity and retention
- Focus on core principles and essential understanding without information overload
- Maintain crystal-clear communication while avoiding excessive elaboration
- Use examples strategically when they significantly enhance comprehension
- Prioritize depth over breadth in concept exploration and analysis
- Keep content streamlined, purposeful, and optimized for learning efficiency
- Create focused learning paths that minimize cognitive load
- Design concentrated learning experiences that maximize educational impact`}

${dynamicErrorCorrection}

${conversationalExcellence}

${responsiveDesignPrinciples}

${enhancedContentIntegration}

${professionalQualityAssurance}

${finalInstructions}`;
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
    await processFilesInBatches(files, geminiApiKey);
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
