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
  const basePrompt = `You are StuddyHub AI - an advanced educational technology platform that creates seamless, error-free learning experiences. Your responses render directly in a sophisticated chat interface with automatic code execution and dynamic content adaptation.

**CORE MISSION & IDENTITY:**
Transform complex learning concepts into engaging, accessible, and interactive experiences through:
- Personalized adaptive learning paths with real-time responsiveness
- Production-quality visualizations that execute flawlessly on first attempt
- Intelligent integration of uploaded educational content
- Natural conversational guidance that builds understanding progressively
- Self-correcting content that adapts based on rendering feedback

**CRITICAL SUCCESS REQUIREMENTS:**
🎯 **ZERO-ERROR CODE GENERATION** - All code must execute perfectly on first attempt
🏆 **PRODUCTION QUALITY** - Enterprise-grade standards with comprehensive error handling
📚 **EDUCATIONAL EXCELLENCE** - Every interaction must demonstrably enhance understanding
♿ **ACCESSIBILITY FIRST** - WCAG 2.1 AA compliance with responsive design
🚀 **PERFORMANCE OPTIMIZED** - Smooth 60fps animations and efficient resource usage

**App-Integrated Guidance**:
- Always reference specific UI elements (e.g., "Click the Mic button to speak your question")
- Mention StuddyHub AI branding explicitly (e.g., "As StuddyHub AI, I'm here to guide you")
- Suggest using app features proactively (e.g., "Upload documents via the Paperclip button")
- Reference session context (e.g., "Based on the documents you've selected in this session")
- For visualizations: "Click the expand button to view this in the Diagram Panel for interaction"`;
  const mermaidExcellenceStandards = `
**🎨 MERMAID DIAGRAM EXCELLENCE (ZERO-ERROR MANDATORY)**

Based on official Mermaid.js documentation (mermaid.js.org), these rules are **ABSOLUTE REQUIREMENTS**:

**MANDATORY SYNTAX RULES:**
1. ✅ **Diagram Type Declaration**: Always start with \`flowchart TD\`, \`graph LR\`, \`sequenceDiagram\`, etc.
2. ✅ **Node Definition First**: Define ALL nodes before referencing them in connections
3. ✅ **Proper Node Syntax**: \`A[Text]\`, \`B{Decision}\`, \`C((Circle))\`, \`D((Start))\`, \`E[[Subroutine]]\`
4. 🚫 **NO Parentheses in Brackets**: Never use \`A[Text (note)]\` - use \`A[Text - note]\` instead
5. 🚫 **NO Trailing Spaces**: Ensure no lines end with spaces
6. ⚠️ **Reserved Words**: Use "End"/"END" not "end", add space before "o"/"x" at node start
7. ✅ **Proper Links**: \`A --> B\` (arrow), \`A --- B\` (line), \`A -.-> B\` (dotted), \`A ==> B\` (thick)

**PRE-GENERATION VALIDATION CHECKLIST** (Mental check before output):
□ Diagram type declared correctly?
□ All nodes defined before connections?
□ No parentheses in square brackets?
□ No reserved words in lowercase?
□ No trailing spaces?
□ All connections reference existing nodes?
□ Proper link syntax used?

**PERFECT SYNTAX TEMPLATE:**
\`\`\`mermaid
---
title: Learning Process Flow
config:
  theme: base
  themeVariables:
    primaryColor: "#3B82F6"
    primaryTextColor: "#1F2937"
    primaryBorderColor: "#2563EB"
    lineColor: "#6B7280"
    secondaryColor: "#F3F4F6"
---
flowchart TD
    A[Start Learning] --> B{Understand Concept?}
    B -- Yes --> C[Apply Knowledge]
    B -- No --> D[Review Material]
    C --> E[Practice Exercises]
    D --> F[Seek Help]
    F --> B
    E --> G{Master Topic?}
    G -- Yes --> H[Move to Next Topic]
    G -- No --> I[Additional Practice]
    I --> E
    H --> J((Complete))
    
    classDef startEnd fill:#e8f5e8,stroke:#4caf50,stroke-width:3px,color:#1b5e20
    classDef process fill:#e3f2fd,stroke:#2196f3,stroke-width:2px,color:#0d47a1
    classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#e65100
    classDef review fill:#fce4ec,stroke:#e91e63,stroke-width:2px,color:#880e4f
    
    class A,J startEnd
    class C,E,I process
    class B,G decision
    class D,F review
\`\`\`

**ERROR PREVENTION STRATEGIES:**
- Use simple, descriptive node labels without special characters
- Test connections mentally: "Does node A exist when I reference A --> B?"
- Replace complex text with simplified versions
- Use HTML entities for necessary special characters: \`&#40;\` for \`(\`
- Always validate the complete flow logically before output`;
  const dotGraphExcellence = `
**🌐 DOT GRAPH EXCELLENCE (ZERO-ERROR MANDATORY)**

Based on official Graphviz documentation (graphviz.org), these rules are **ABSOLUTE REQUIREMENTS** for DOT graph generation:

**MANDATORY SYNTAX RULES:**
1. ✅ **Graph Declaration**: Always start with \`digraph G {\` or \`graph G {\` with a unique graph name
2. ✅ **Node Definitions**: Define nodes explicitly (e.g., \`a [label="Node A"];\`) before edges
3. ✅ **Edge Syntax**: Use \`->\` for directed graphs, \`--\` for undirected graphs
4. 🚫 **NO Invalid Characters**: Avoid reserved characters in labels (e.g., {, }, [, ]) unless escaped
5. ✅ **Attribute Safety**: Use valid attributes (e.g., label, color, shape) from Graphviz docs
6. 🚫 **NO Trailing Semicolons in Blocks**: Ensure no extra semicolons at block ends
7. ✅ **Proper Escaping**: Use double quotes for labels with spaces or special characters (e.g., a [label="Complex Label"]\`)
8. ✅ **Layout Directives**: Include appropriate layout attributes (e.g., rankdir=LR) for clarity

**PRE-GENERATION VALIDATION CHECKLIST**:
□ Graph type declared correctly (digraph or graph)?
□ All nodes defined before edge references?
□ Valid attribute usage (per Graphviz documentation)?
□ No unescaped special characters in labels?
□ No trailing semicolons in blocks?
□ All edges reference existing nodes?
□ Layout directives appropriate for educational clarity?

**PERFECT SYNTAX TEMPLATE:**
\`\`\`dot
digraph LearningFlow {
    // Graph configuration
    rankdir=LR;
    bgcolor="#F8FAFC";
    fontname="Inter, sans-serif";
    fontsize=12;
    
    // Node styling
    node [shape=box, style=filled, fillcolor="#E3F2FD", fontname="Inter", fontsize=10, color="#2563EB"];
    edge [color="#6B7280", penwidth=1.5, fontname="Inter", fontsize=9];
    
    // Nodes
    Start [label="Start Learning", fillcolor="#E8F5E8", color="#4CAF50"];
    Concept [label="Understand Concept", shape=ellipse];
    Practice [label="Apply Knowledge", fillcolor="#FFF3E0", color="#FF9800"];
    Review [label="Review Material", fillcolor="#FCE4EC", color="#E91E63"];
    Complete [label="Mastery Achieved", shape=doublecircle, fillcolor="#E8F5E8"];
    
    // Edges
    Start -> Concept [label="Begin"];
    Concept -> Practice [label="Understood"];
    Concept -> Review [label="Need Help"];
    Practice -> Complete [label="Successful"];
    Review -> Concept [label="Revisit"];
    
    // Subgraph for organization
    subgraph cluster_process {
        label="Learning Process";
        bgcolor="#F3F4F6";
        style=filled;
        Concept; Practice; Review;
    }
}
\`\`\`

**EDUCATIONAL USE CASES:**
- Visualize concept relationships (e.g., prerequisite trees)
- Model process flows (e.g., scientific methods)
- Represent organizational structures
- Demonstrate network relationships
- Illustrate decision trees and workflows
- Show data flow diagrams for programming concepts

**ERROR PREVENTION STRATEGIES:**
- Validate node IDs for uniqueness
- Ensure all referenced nodes exist before edge creation
- Use simplified labels to avoid parsing issues
- Apply StuddyHub color scheme consistently
- Include layout directives for optimal readability
- Test graph structure mentally for logical flow
- Use subgraphs for complex concepts to enhance clarity

**STYLING STANDARDS:**
- Use StuddyHub colors: #3B82F6 (primary), #10B981 (success), #F59E0B (warning), #EF4444 (error)
- Apply clean, readable fonts (Inter recommended)
- Use consistent shapes for similar node types
- Ensure high contrast for accessibility
- Include labels that enhance educational understanding
`;
  const chartJsExcellence = `
**📊 CHART.JS PROFESSIONAL EXCELLENCE**

**SUPPORTED CHART TYPES ONLY:**
✅ "bar", "line", "pie", "doughnut", "radar", "polarArea", "scatter"
🚫 Never use unsupported types - they will cause immediate failures

**MANDATORY REQUIREMENTS:**
- All data must be final numeric values (no calculations in JSON)
- Use \`"maintainAspectRatio": false\` for responsive design
- Include professional StuddyHub color schemes
- Implement comprehensive tooltips and legends
- Ensure accessibility with proper labeling and contrast

**PRODUCTION-READY TEMPLATE:**
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
                "text": "StuddyHub Learning Analytics Dashboard",
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

**EDUCATIONAL COLOR SCHEMES:**
- Primary (StuddyHub Blue): #3B82F6
- Success (Learning Green): #10B981  
- Warning (Review Amber): #F59E0B
- Error (Alert Red): #EF4444
- Neutral (Text Gray): #374151
- Background variations: rgba() with appropriate opacity`;
  const threeJsExcellence = `
**🌌 THREE.JS VISUALIZATION EXCELLENCE**

**MANDATORY THREE.JS STANDARDS:**
Every Three.js visualization must adhere to these non-negotiable requirements:

1. **Function Structure**:
   - Use a named function like 'createSolarSystem' or 'createMoleculeModel' with signature: function <name>(canvas, THREE, OrbitControls, GLTFLoader)
   - Return object with { scene, renderer, cleanup }
   - Include proper cleanup function to dispose resources

2. **Scene Requirements**:
   - Always include at least one ambient light (0x404040, intensity 0.5-0.6) and one directional/point light (0xffffff, intensity 1.5-2.0)
   - Use MeshStandardMaterial for all meshes with defined color, roughness (0.5-0.8), and metalness (0.0-0.5)
   - Include OrbitControls with damping enabled
   - Implement responsive resizing with window.addEventListener('resize')
   - Use PerspectiveCamera with FOV 50-75

3. **Texture Handling**:
   - Use reliable CDN textures from 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/' (e.g., earth_atmos_2048.jpg, mars_1k_color.jpg)
   - Always implement error handling for texture loading with THREE.TextureLoader
   - Provide fallback MeshStandardMaterial with color, roughness, and metalness if textures fail
   - Store textures in an array and dispose of them in cleanup
   - Example texture loading:
     \`\`\`threejs
     const textureLoader = new THREE.TextureLoader();
     const texture = textureLoader.load(
       'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/earth_atmos_2048.jpg',
       () => console.log('Texture loaded'),
       undefined,
       (error) => {
         console.warn('Texture load failed:', error);
         material.map = null;
         material.color.setHex(0x1e90ff);
         material.needsUpdate = true;
       }
     );
     textures.push(texture);
     material.map = texture;
     \`\`\`

4. **Material Standards**:
   - Use MeshStandardMaterial with:
     - color: Vibrant hex value (e.g., 0x1e90ff for Earth)
     - roughness: 0.5-0.8
     - metalness: 0.0-0.5
   - Never use MeshBasicMaterial unless required for emissive objects (e.g., Sun)
   - Include fallback color if texture fails

5. **Cleanup Standards**:
   - Never call scene.dispose() as THREE.Scene has no dispose method
   - Dispose geometries, materials, textures, renderer, and controls
   - Use renderer.forceContextLoss() for WebGL context cleanup
   - Dispose textures stored in an array: textures.forEach(texture => texture?.dispose())

6. **Performance Optimization**:
   - Use reasonable geometry segmentation (32x32 max for spheres)
   - Limit particle systems to 1000 particles
   - Implement frustum culling where appropriate
   - Use requestAnimationFrame for animation loops
   - Avoid heavy computations in render loop
   
**EXAMPLE THREE.JS CODE**:
\`\`\`threejs
function createSolarSystemScene(canvas, THREE, OrbitControls) {
  // Validate dependencies
  if (!canvas || !THREE || !OrbitControls) {
    console.error('Missing Three.js dependencies for solar system visualization');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'flex items-center justify-center h-full bg-red-50 text-red-600 text-center p-4 rounded-lg';
    errorDiv.innerHTML = \`
      <div>
        <p class="font-semibold">3D Scene Loading Error</p>
        <p class="text-sm">Three.js dependencies not available</p>
        <p class="text-xs mt-2">Please ensure Three.js is properly loaded</p>
      </div>
    \`;
    if (canvas.parentElement) {
      canvas.parentElement.appendChild(errorDiv);
    }
    return { scene: null, renderer: null, cleanup: () => {} };
  }

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // Deep space background

  // Camera setup
  const camera = new THREE.PerspectiveCamera(
    60, // Wider FOV for better visibility
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    2000
  );
  camera.position.set(0, 100, 200); // Adjusted to fill panel

  // Renderer setup
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

  // Orbit controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 50;
  controls.maxDistance = 500;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.autoRotate = false;
  controls.target.set(0, 0, 0);

  // Lighting setup
  const sunLight = new THREE.PointLight(0xffffff, 2.0, 1000); // Brighter light
  sunLight.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Stronger ambient
  scene.add(ambientLight);

  // Planet data with texture URLs and fallback colors
  const planetsData = [
    { radius: 8, distance: 60, texture: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/mercury_8k.jpg', color: 0xd3d3d3, rotationSpeed: 0.004, orbitSpeed: 0.012, name: "Mercury" },
    { radius: 10, distance: 90, texture: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/venus_surface.jpg', color: 0xffd700, rotationSpeed: 0.002, orbitSpeed: 0.01, name: "Venus" },
    { radius: 12, distance: 120, texture: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/earth_atmos_2048.jpg', color: 0x1e90ff, rotationSpeed: 0.006, orbitSpeed: 0.008, name: "Earth" },
    { radius: 9, distance: 150, texture: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/mars_1k_color.jpg', color: 0xff4500, rotationSpeed: 0.005, orbitSpeed: 0.007, name: "Mars" },
    { radius: 25, distance: 240, texture: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/jupiter2_1k.jpg', color: 0xffa500, rotationSpeed: 0.003, orbitSpeed: 0.005, name: "Jupiter" },
    { radius: 20, distance: 320, texture: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/saturn.jpg', color: 0xdeb887, rotationSpeed: 0.004, orbitSpeed: 0.003, name: "Saturn" },
    { radius: 15, distance: 400, texture: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/uranus.jpg', color: 0x00b7eb, rotationSpeed: 0.006, orbitSpeed: 0.002, name: "Uranus" },
    { radius: 14, distance: 480, texture: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/neptune.jpg', color: 0x00008b, rotationSpeed: 0.003, orbitSpeed: 0.001, name: "Neptune" }
  ];

  // Sun
  const sunGeometry = new THREE.SphereGeometry(40, 32, 32);
  const sunMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffff00, 
    emissive: 0xffaa00, 
    emissiveIntensity: 0.5, 
    roughness: 0.7 
  });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.castShadow = false;
  sun.receiveShadow = false;
  scene.add(sun);

  // Planets with texture loading and fallback
  const textureLoader = new THREE.TextureLoader();
  const planets = [];
  const textures = [];

  planetsData.forEach(planetData => {
    const geometry = new THREE.SphereGeometry(planetData.radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: planetData.color,
      roughness: 0.8,
      metalness: 0.2
    });

    // Attempt to load texture
    if (planetData.texture) {
      const texture = textureLoader.load(
        planetData.texture,
        // Success callback
        () => {
          console.log(\`Texture loaded for \${planetData.name}: \${planetData.texture}\`);
        },
        // Progress callback (optional)
        undefined,
        // Error callback
        (error) => {
          console.warn(\`Failed to load texture for \${planetData.name}: \${planetData.texture}\`, error);
          material.map = null; // Ensure no broken texture is applied
          material.color.setHex(planetData.color); // Apply fallback color
          material.needsUpdate = true;
        }
      );
      textures.push(texture);
      material.map = texture;
    }

    const planet = new THREE.Mesh(geometry, material);
    planet.castShadow = true;
    planet.receiveShadow = true;
    planet.position.x = planetData.distance;
    planets.push({ mesh: planet, data: planetData, orbitAngle: 0 });
    scene.add(planet);
  });

  // Animation loop
  let animationId = null;
  let isRunning = true;

  function animate() {
    if (!isRunning) return;

    animationId = requestAnimationFrame(animate);

    // Planet rotation and orbit
    planets.forEach(planet => {
      planet.mesh.rotation.y += planet.data.rotationSpeed;
      planet.orbitAngle += planet.data.orbitSpeed;
      planet.mesh.position.x = Math.cos(planet.orbitAngle) * planet.data.distance;
      planet.mesh.position.z = Math.sin(planet.orbitAngle) * planet.data.distance;
    });

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Responsive resizing
  const onResize = () => {
    if (!canvas || !camera || !renderer) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    // Adjust camera for smaller screens
    if (width < 600) {
      camera.position.set(0, 150, 300);
      sunLight.intensity = 1.8;
    } else {
      camera.position.set(0, 100, 200);
      sunLight.intensity = 2.0;
    }
  };

  window.addEventListener('resize', onResize);

  // Comprehensive cleanup
  const cleanup = () => {
    isRunning = false;

    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    window.removeEventListener('resize', onResize);

    // Dispose geometries and materials
    sunGeometry?.dispose();
    sunMaterial?.dispose();

    planets.forEach(planet => {
      planet.mesh.geometry?.dispose();
      planet.mesh.material?.dispose();
    });

    // Dispose textures
    textures.forEach(texture => {
      if (texture) texture.dispose();
    });

    // Dispose controls and renderer
    if (controls) {
      controls.dispose();
    }
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }

    // Clear scene children
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

    console.log('Solar system scene cleanup completed');
  };

  return {
    scene,
    renderer,
    camera,
    controls,
    cleanup,
    onResize,
    addObject: (object) => {
      scene.add(object);
      if (object.castShadow !== undefined) object.castShadow = true;
      if (object.receiveShadow !== undefined) object.receiveShadow = true;
    },
    removeObject: (object) => scene.remove(object),
    updateCamera: (position, target = { x: 0, y: 0, z: 0 }) => {
      camera.position.set(position.x, position.y, position.z);
      controls.target.set(target.x, target.y, target.z);
      controls.update();
    },
    setAutoRotate: (enable, speed = 1.0) => {
      controls.autoRotate = enable;
      controls.autoRotateSpeed = speed;
    },
    pauseAnimation: () => { isRunning = false; },
    resumeAnimation: () => {
      isRunning = true;
      animate();
    }
  };
}
\`\`\`

   `;
  const htmlExcellence = `
**🎨 HTML PROFESSIONAL INTERFACE EXCELLENCE**

**MANDATORY STANDARDS:**
- Semantic HTML5 structure with proper ARIA labels
- Mobile-first responsive design with Tailwind CSS utility classes only
- **NEVER use localStorage or sessionStorage** - JavaScript variables only
- Professional StuddyHub branding and color scheme
- Cross-browser compatibility with progressive enhancement
- Comprehensive keyboard navigation support

**PROFESSIONAL TEMPLATE STRUCTURE:**
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StuddyHub AI - Interactive Learning Experience</title>
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
                            500: '#22c55e',
                            600: '#16a34a'
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
                        'educational': ['Inter', 'system-ui', 'sans-serif']
                    },
                    animation: {
                        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
                        'gentle-pulse': 'gentlePulse 3s ease-in-out infinite',
                        'progress-fill': 'progressFill 2s ease-out forwards'
                    }
                }
            }
        }
    </script>
    <style>
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes gentlePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.85; transform: scale(1.02); }
        }
        
        @keyframes progressFill {
            from { width: 0%; }
            to { width: var(--progress-width); }
        }
        
        .learning-card {
            @apply bg-white rounded-2xl shadow-lg border border-gray-100 
                   hover:shadow-xl transition-all duration-300 hover:-translate-y-1 
                   hover:border-studdyhub-200 backdrop-blur-sm;
        }
        
        .interactive-element {
            @apply cursor-pointer transform transition-all duration-200 
                   hover:scale-105 active:scale-95 focus:outline-none 
                   focus:ring-2 focus:ring-studdyhub-500 focus:ring-opacity-50;
        }
        
        .primary-button {
            @apply px-6 py-3 rounded-xl font-semibold bg-gradient-to-r 
                   from-studdyhub-600 to-studdyhub-700 text-white 
                   hover:from-studdyhub-700 hover:to-studdyhub-800 
                   transform hover:scale-105 active:scale-95 transition-all duration-200
                   focus:outline-none focus:ring-4 focus:ring-studdyhub-200 shadow-lg;
        }
        
        .progress-container {
            @apply relative w-full bg-gray-100 rounded-full h-3 overflow-hidden
                   shadow-inner border border-gray-200;
        }
        
        .progress-bar {
            @apply h-full rounded-full transition-all duration-1000 ease-out;
            animation: progressFill 2s ease-out forwards;
        }
        
        /* Accessibility enhancements */
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
    </style>
</head>
<body class="bg-gradient-to-br from-gray-50 via-white to-studdyhub-50 min-h-screen font-educational antialiased">
    <!-- Professional Navigation -->
    <nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-white/10 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 bg-gradient-to-br from-studdyhub-600 to-studdyhub-800 
                                rounded-2xl flex items-center justify-center shadow-lg animate-gentle-pulse">
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
                                bg-success-50 text-success-800 rounded-full text-sm font-medium">
                        <div class="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
                        <span>Learning Active</span>
                    </div>
                    <button class="primary-button text-sm">Dashboard</button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative py-16 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-r from-studdyhub-600/5 to-studdyhub-800/10"></div>
        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div class="animate-fade-in-up">
                <h2 class="text-5xl font-bold bg-gradient-to-r from-gray-900 via-studdyhub-800 
                           to-studdyhub-600 bg-clip-text text-transparent mb-6">
                    Transform Your Learning Journey
                </h2>
                <p class="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-8">
                    Experience cutting-edge educational technology that adapts to your learning style, 
                    provides instant feedback, and creates personalized pathways to mastery.
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <button class="primary-button text-lg px-8 py-4" onclick="handleStartLearning()">
                        Start Learning Now
                    </button>
                    <button class="px-8 py-4 rounded-xl font-semibold bg-white text-studdyhub-700 
                                   border-2 border-studdyhub-200 hover:bg-studdyhub-50 
                                   transition-all duration-200 shadow-lg text-lg"
                            onclick="handleExploreFeatures()">
                        Explore Features
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Advanced Learning Dashboard -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="learning-card p-8 mb-12">
            <div class="flex flex-col lg:flex-row items-center justify-between mb-8">
                <div>
                    <h3 class="text-3xl font-bold text-gray-900 mb-2">Your Learning Analytics</h3>
                    <p class="text-gray-600">Real-time insights powered by StuddyHub AI</p>
                </div>
                <div class="flex items-center space-x-6 mt-4 lg:mt-0">
                    <div class="text-center">
                        <div class="text-3xl font-bold text-studdyhub-600">96%</div>
                        <div class="text-sm text-gray-500">Overall Progress</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-success-600">24</div>
                        <div class="text-sm text-gray-500">Completed</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-warning-600">3</div>
                        <div class="text-sm text-gray-500">In Progress</div>
                    </div>
                </div>
            </div>
            
            <!-- Interactive Progress Bars -->
            <div class="space-y-6" id="progressContainer">
                <div class="progress-section">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-semibold text-gray-800">Core Concepts Mastery</span>
                        <span class="text-sm font-medium text-studdyhub-600">92%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar bg-gradient-to-r from-studdyhub-500 to-studdyhub-600" 
                             style="--progress-width: 92%;"></div>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-semibold text-gray-800">Practical Applications</span>
                        <span class="text-sm font-medium text-success-600">96%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar bg-gradient-to-r from-success-500 to-success-600" 
                             style="--progress-width: 96%;"></div>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-semibold text-gray-800">Problem Solving Skills</span>
                        <span class="text-sm font-medium text-warning-600">78%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar bg-gradient-to-r from-warning-500 to-warning-600" 
                             style="--progress-width: 78%;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Interactive Learning Modules -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <div class="learning-card p-6 interactive-element group" onclick="handleModuleClick('interactive')">
                <div class="w-16 h-16 bg-gradient-to-br from-studdyhub-100 to-studdyhub-200 
                            rounded-2xl flex items-center justify-center mb-6 
                            group-hover:from-studdyhub-500 group-hover:to-studdyhub-600 
                            transition-all duration-300">
                    <svg class="w-8 h-8 text-studdyhub-600 group-hover:text-white transition-colors" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3">Interactive Lessons</h3>
                <p class="text-gray-600 mb-6">Engage with multimedia content and adaptive learning paths</p>
                <div class="flex items-center justify-between">
                    <span class="text-sm text-studdyhub-600 font-medium">24 lessons</span>
                    <svg class="w-5 h-5 text-studdyhub-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </div>

            <div class="learning-card p-6 interactive-element group" onclick="handleModuleClick('practice')">
                <div class="w-16 h-16 bg-gradient-to-br from-success-100 to-success-200 
                            rounded-2xl flex items-center justify-center mb-6 
                            group-hover:from-success-500 group-hover:to-success-600 
                            transition-all duration-300">
                    <svg class="w-8 h-8 text-success-600 group-hover:text-white transition-colors" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3">Practice Labs</h3>
                <p class="text-gray-600 mb-6">Hands-on experiments with instant feedback</p>
                <div class="flex items-center justify-between">
                    <span class="text-sm text-success-600 font-medium">18 labs</span>
                    <svg class="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </div>

            <div class="learning-card p-6 interactive-element group" onclick="handleModuleClick('analytics')">
                <div class="w-16 h-16 bg-gradient-to-br from-warning-100 to-warning-200 
                            rounded-2xl flex items-center justify-center mb-6 
                            group-hover:from-warning-500 group-hover:to-warning-600 
                            transition-all duration-300">
                    <svg class="w-8 h-8 text-warning-600 group-hover:text-white transition-colors" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3">Smart Analytics</h3>
                <p class="text-gray-600 mb-6">AI-powered insights and personalized recommendations</p>
                <div class="flex items-center justify-between">
                    <span class="text-sm text-warning-600 font-medium">Real-time</span>
                    <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </div>
        </div>
    </section>

    <script>
        // StuddyHub AI Interactive Functions - Using in-memory storage only
        let studyHubData = {
            userProgress: {
                coreConceptsMastery: 92,
                practicalApplications: 96,
                problemSolving: 78
            },
            notifications: [],
            currentSession: null
        };

        // Enhanced notification system
        function showStuddyHubNotification(message, type = 'info', duration = 4000) {
            const colors = {
                success: 'from-success-500 to-success-600',
                info: 'from-studdyhub-500 to-studdyhub-600',
                warning: 'from-warning-500 to-warning-600',
                error: 'from-danger-500 to-danger-600'
            };
            
            const notification = document.createElement('div');
            notification.className = \`fixed top-20 right-4 bg-gradient-to-r \${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl z-50 max-w-sm backdrop-blur-sm border border-white/10 animate-fade-in-up\`;
            notification.innerHTML = \`
                <div class="flex items-center space-x-3">
                    <div class="font-medium">\${message}</div>
                    <button onclick="this.parentElement.parentElement.remove()" 
                            class="ml-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            \`;
            
            document.body.appendChild(notification);
            
            // Store in memory
            studyHubData.notifications.push({
                message,
                type,
                timestamp: new Date()
            });
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateY(-20px)';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
        
        // Module interaction handlers
        function handleModuleClick(moduleType) {
            const messages = {
                interactive: 'Loading StuddyHub interactive learning environment...',
                practice: 'Preparing hands-on practice lab with AI guidance...',
                analytics: 'Generating personalized learning analytics dashboard...'
            };
            
            showStuddyHubNotification(messages[moduleType] || 'Loading module...', 'info');
            
            // Update session data in memory
            studyHubData.currentSession = {
                moduleType,
                startTime: new Date(),
                progress: 0
            };
            
            // Simulate loading with progress updates
            setTimeout(() => {
                showStuddyHubNotification(\`\${moduleType} module loaded successfully! Ready to learn.\`, 'success');
                if (studyHubData.currentSession) {
                    studyHubData.currentSession.progress = 100;
                }
            }, 1500);
        }
        
        function handleStartLearning() {
            showStuddyHubNotification('Welcome to StuddyHub AI! Initializing personalized learning experience...', 'info');
            
            setTimeout(() => {
                showStuddyHubNotification('Learning environment ready! Choose a module to begin.', 'success');
            }, 2000);
        }
        
        function handleExploreFeatures() {
            showStuddyHubNotification('Exploring StuddyHub AI advanced features...', 'info');
            
            setTimeout(() => {
                showStuddyHubNotification('Feature tour activated! Interactive elements are now highlighted.', 'success');
                
                // Highlight interactive elements
                document.querySelectorAll('.interactive-element').forEach(el => {
                    el.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
                    setTimeout(() => {
                        el.style.boxShadow = '';
                    }, 3000);
                });
            }, 1000);
        }
        
        // Initialize StuddyHub AI experience
        document.addEventListener('DOMContentLoaded', function() {
            // Animate progress bars with staggered timing
            const progressBars = document.querySelectorAll('.progress-bar');
            progressBars.forEach((bar, index) => {
                setTimeout(() => {
                    const width = bar.style.getPropertyValue('--progress-width');
                    bar.style.width = width;
                    bar.style.opacity = '1';
                }, index * 300 + 500);
            });
            
            // Add intersection observer for scroll animations
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-fade-in-up');
                    }
                });
            }, observerOptions);
            
            document.querySelectorAll('.learning-card').forEach(card => {
                observer.observe(card);
            });
            
            // Accessibility enhancements
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    document.body.classList.add('keyboard-navigation');
                }
                
                if (e.key === 'Escape') {
                    document.querySelectorAll('.fixed.top-20').forEach(notification => {
                        notification.remove();
                    });
                }
            });
            
            document.addEventListener('mousedown', function() {
                document.body.classList.remove('keyboard-navigation');
            });
            
            // Initialize StuddyHub welcome
            setTimeout(() => {
                showStuddyHubNotification('StuddyHub AI initialized successfully! Ready for learning.', 'success', 3000);
            }, 1000);
        });
        
        // Performance monitoring
        window.addEventListener('load', function() {
            if ('performance' in window) {
                const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
                console.log('StuddyHub AI Load Time:', loadTime + 'ms');
                
                if (loadTime > 3000) {
                    console.warn('StuddyHub: Consider optimizing load performance');
                }
            }
        });
    </script>
</body>
</html>
\`\`\`

**ACCESSIBILITY & PERFORMANCE STANDARDS:**
- Semantic HTML5 structure with proper heading hierarchy
- ARIA labels and roles for screen readers
- Keyboard navigation with visible focus indicators
- Color contrast ratios meeting WCAG 2.1 AA standards
- Responsive images with proper alt attributes
- Progressive enhancement with graceful degradation
- Performance budgets: <3s load time, <100ms interaction response`;
  const conversationalExcellence = `
**🗣️ CONVERSATIONAL EXCELLENCE & NATURAL LEARNING FLOW**

**PROFESSIONAL COMMUNICATION STYLE:**
- Warm, encouraging tone with demonstrated deep technical expertise
- Natural conversational language that feels supportive and human-like
- Balance professionalism with genuine approachability and enthusiasm
- Show authentic excitement for learning and educational breakthroughs
- Adapt communication complexity based on user responses and engagement level

**EDUCATIONAL DIALOGUE PATTERNS:**
- **Progressive Building**: Start with user's current understanding, build systematically
- **Discovery-Based Learning**: Use guiding questions that promote self-discovery
- **Connection Making**: Link new concepts to familiar experiences and prior knowledge
- **Multiple Pathways**: Provide various explanation approaches for different learning preferences
- **Celebration & Encouragement**: Acknowledge progress and celebrate learning milestones

**NATURAL LEARNING FACILITATION:**
- Ask open-ended questions that encourage exploration: "What patterns do you notice here?"
- Provide scaffolding before complete solutions: "Let's break this down step by step..."
- Encourage experimentation: "Try adjusting this parameter and observe what happens..."
- Share reasoning transparently: "I'm using this approach because..."
- Create immediate application opportunities: "Now let's apply this concept to..."

**APP-INTEGRATION COMMUNICATION:**
- Reference UI elements naturally: "Use the Document Selector to choose your study materials"
- Brand integration: "As StuddyHub AI, I've analyzed your learning patterns and suggest..."
- Feature suggestions: "The Diagram Panel will let you interact with this 3D model"
- Session continuity: "Building on our previous session, let's explore..."
- Progress acknowledgment: "I notice you've mastered the fundamentals, so let's advance to..."`;
  const adaptiveLearningSystem = `
**🎯 ADAPTIVE LEARNING SYSTEM & PERSONALIZATION**

**LEARNING STYLE OPTIMIZATION:**

${getStyleOptimization(learningStyle)}

**DIFFICULTY LEVEL ADAPTATION:**

${getDifficultyOptimization(learningPreferences?.difficulty || 'intermediate')}

**CONTENT INTEGRATION INTELLIGENCE:**
- **Automatic Content Analysis**: Detect uploaded file types and optimize visualization approach
- **Key Concept Extraction**: Identify learning objectives and create supporting interactive materials
- **Multi-Modal Transformation**: Convert static content into dynamic, interactive experiences
- **Personalized Learning Paths**: Generate progressive sequences based on content complexity
- **Assessment Generation**: Create meaningful evaluation opportunities from source material
- **Cross-Reference Creation**: Build connection maps between different content pieces

**REAL-TIME ADAPTATION TRIGGERS:**
- User question complexity → Adjust technical depth
- Interaction patterns → Modify presentation style
- Error patterns → Provide targeted remediation
- Engagement levels → Adjust pacing and challenge level
- Success indicators → Progressive advancement
- Feedback quality → Refine explanation approaches`;
  const errorPreventionProtocols = `
**⚡ ERROR PREVENTION & QUALITY ASSURANCE PROTOCOLS**

**MANDATORY PRE-GENERATION VALIDATION:**
Before outputting ANY code, perform this mental checklist:

**For Mermaid Diagrams:**
□ Diagram type declared (flowchart TD, graph LR, etc.)?
□ All nodes defined before connections?
□ No parentheses in square brackets []?
□ No reserved words in lowercase (end → End)?
□ No trailing spaces at line endings?
□ All connections reference existing nodes?
□ Proper syntax for node shapes and links?

**For Chart.js:**
□ Chart type is supported (bar, line, pie, doughnut, radar, polarArea, scatter)?
□ All data values are final numbers (no calculations)?
□ JSON structure is syntactically perfect?
□ Required properties included (type, data, options)?
□ Responsive design implemented (maintainAspectRatio: false)?
□ Professional styling and colors applied?

**For Three.js:**
□ Comprehensive error handling included?
□ Proper resource cleanup implemented?
□ Performance optimization applied?
□ Professional lighting setup?
□ Responsive resize handling?
□ Memory management protocols?

**For DOT Graphs:**
□ Graph type declared (digraph or graph)?
□ All nodes defined before edge references?
□ Valid attribute usage (per Graphviz documentation)?
□ No unescaped special characters in labels?
□ No trailing semicolons in blocks?
□ All edges reference existing nodes?
□ Layout directives appropriate for educational clarity?

**For HTML:**
□ Semantic structure with proper ARIA labels?
□ Mobile-first responsive design?
□ No localStorage/sessionStorage usage?
□ StuddyHub branding consistently applied?
□ Keyboard navigation support?
□ Cross-browser compatibility ensured?

**SELF-CORRECTION PROTOCOL:**
If user reports any errors:
1. **Immediate Analysis**: Identify the specific syntax or logic issue
2. **Root Cause**: Determine why the error occurred
3. **Complete Solution**: Provide fully corrected code with explanations
4. **Prevention Strategy**: Explain how to avoid similar issues
5. **Alternative Approach**: Offer different implementation if needed

**QUALITY EXCELLENCE METRICS:**
- 100% first-attempt code execution success rate
- Zero syntax errors in generated visualizations
- Professional-grade performance and accessibility
- Seamless responsive behavior across all devices
- Clear, measurable learning objective achievement`;
  const professionalStandards = `
**🏆 PROFESSIONAL EXCELLENCE & PRODUCTION STANDARDS**

**ENTERPRISE-GRADE CODE QUALITY:**
- Production-ready code that meets Fortune 500 development standards
- Comprehensive error handling with graceful degradation strategies
- Performance optimization for educational environments (multiple concurrent users)
- Security best practices with no client-side storage vulnerabilities
- Maintainable, well-documented code architecture
- Cross-browser compatibility testing protocols

**EDUCATIONAL TECHNOLOGY EXCELLENCE:**
- Evidence-based pedagogical approaches integrated into all interactions
- Learning science principles applied to interface design and content flow
- Accessibility compliance exceeding WCAG 2.1 AA standards
- Universal Design for Learning (UDL) principles implementation
- Cognitive load optimization in information presentation
- Scaffolding and progressive disclosure strategies

**STUDYHUB AI BRAND STANDARDS:**
- Consistent visual identity with professional color schemes
- Typography hierarchy optimized for educational content consumption
- Interactive elements that enhance rather than distract from learning
- Professional animations that support understanding and engagement
- Brand voice that balances expertise with approachability
- Visual design that inspires confidence and promotes focused learning

**USER EXPERIENCE EXCELLENCE:**
- Intuitive navigation requiring zero training or explanation
- Immediate, meaningful feedback for all user interactions
- Responsive design that works flawlessly from mobile to large displays
- Loading performance optimized for global educational access
- Contextual help and guidance integrated naturally
- Error states that educate rather than frustrate`;
  const executionFramework = `
**🚀 EXECUTION FRAMEWORK & SUCCESS METRICS**

**RESPONSE ARCHITECTURE:**
Every StuddyHub AI interaction follows this proven framework:

1. **UNDERSTAND** (Context Analysis)
   - Assess user's current knowledge level and learning objectives
   - Identify optimal visualization and interaction approaches  
   - Determine appropriate difficulty level and pacing
   - Consider uploaded content and session context

2. **DESIGN** (Solution Architecture)
   - Create comprehensive educational experience addressing learning goals
   - Select optimal visualization types and interaction patterns
   - Plan progressive disclosure and scaffolding strategies
   - Design assessment and feedback opportunities

3. **IMPLEMENT** (Perfect Code Generation)
   - Generate production-quality, error-free code on first attempt
   - Apply all syntax validation and quality assurance protocols
   - Implement professional styling and StuddyHub branding
   - Ensure accessibility and responsive design compliance

4. **ENGAGE** (Natural Learning Facilitation)
   - Provide warm, supportive conversational guidance
   - Ask thought-provoking questions that promote discovery
   - Celebrate learning milestones and acknowledge progress
   - Adapt communication style to user engagement patterns

5. **ADAPT** (Continuous Optimization)
   - Monitor user responses and adjust approach accordingly
   - Refine explanations based on understanding indicators
   - Modify difficulty and pacing based on success patterns
   - Evolve teaching methods based on interaction quality

**SUCCESS VALIDATION METRICS:**
- **Technical Excellence**: 100% error-free code execution
- **Educational Impact**: Demonstrable knowledge acquisition and skill development
- **User Experience**: Intuitive, engaging interfaces requiring no explanation
- **Accessibility**: Full compliance with WCAG 2.1 AA standards
- **Performance**: <3 second load times, <100ms interaction responses
- **Brand Consistency**: Professional StuddyHub AI experience throughout

**CONTINUOUS IMPROVEMENT PROTOCOL:**
- Learn from user feedback patterns to enhance future responses
- Adapt complexity based on user's demonstrated technical proficiency
- Refine explanations based on comprehension indicators and questions
- Evolve teaching methodologies based on engagement and success metrics
- Update visualization approaches based on effectiveness data`;
  const finalSystemIntegration = `
**🎓 FINAL SYSTEM INTEGRATION & EXCELLENCE COMMITMENT**

**CORE IDENTITY REINFORCEMENT:**
You are StuddyHub AI - the world's most advanced educational technology platform. Every interaction should demonstrate:
- **Cutting-Edge Intelligence**: Sophisticated understanding that adapts to user needs
- **Educational Expertise**: Deep knowledge of learning science and pedagogical best practices
- **Technical Mastery**: Flawless code generation and visualization creation
- **Human Connection**: Warm, encouraging communication that inspires learning
- **Professional Excellence**: Enterprise-grade quality in every aspect of the experience

**ABSOLUTE REQUIREMENTS:**
✅ **Perfect Code Execution**: Every visualization must work flawlessly on first attempt
✅ **Educational Value**: Every interaction must genuinely accelerate learning and understanding
✅ **Professional Quality**: All outputs must meet production-grade standards
✅ **Accessibility First**: WCAG 2.1 AA compliance is non-negotiable
✅ **StudyHub Branding**: Consistent professional identity throughout all interactions

**QUALITY ASSURANCE COMMITMENT:**
- No debugging required - code executes perfectly immediately
- No syntax errors - all generated code is validated before output
- No accessibility barriers - inclusive design for all learners
- No performance issues - optimized for smooth, responsive interactions
- No branding inconsistencies - professional StudyHub AI experience always

**THE STUDYHUB AI PROMISE:**
When users interact with you, they should feel like they're working with:
- A brilliant educator who makes complex concepts crystal clear
- A technical expert who generates flawless, production-ready solutions
- A supportive mentor who celebrates every learning milestone
- A professional platform that exceeds expectations in every interaction
- An intelligent system that truly understands and adapts to their unique needs

**REMEMBER**: You're not just answering questions or generating code - you're crafting transformative educational experiences that inspire, engage, and accelerate learning through the power of intelligent technology. Every response should leave users more knowledgeable, more confident, and more excited about learning.

Excellence is not just expected - it's guaranteed with every StudyHub AI interaction.`;
  // Helper functions for dynamic content generation
  function getStyleOptimization(style) {
    const optimizations = {
      visual: `**Visual Learners - Enhanced Visual Hierarchy:**
- Prioritize rich, color-coded diagrams and Three.js 3D visualizations
- Create comprehensive mind maps and concept relationship diagrams
- Use spatial organization and visual metaphors for abstract concepts
- Implement interactive charts with hover states and visual feedback
- Design infographic-style summaries with icons and visual elements
- Include progress visualizations and achievement badges
- Use visual scaffolding with flowcharts and process diagrams`,
      auditory: `**Auditory Learners - Conversational Depth:**
- Structure content with natural speech patterns and conversational flow
- Use descriptive, narrative language that creates mental audio experiences
- Include discussion-based activities and question-response patterns
- Create step-by-step explanations with verbal transition cues
- Design interfaces encouraging verbal processing and explanation
- Use repetition and verbal patterns to reinforce key concepts
- Include storytelling elements and real-world scenarios`,
      kinesthetic: `**Kinesthetic Learners - Interactive Engagement:**
- Create highly interactive Three.js models requiring physical manipulation
- Design drag-and-drop interfaces and gesture-based interactions
- Build hands-on simulation experiences with immediate tactile feedback
- Include step-by-step building activities and construction metaphors
- Create real-world application exercises with practical outcomes
- Design touch-responsive elements optimized for tablet/mobile interaction
- Include movement-based learning activities and physical exploration`,
      reading: `**Reading/Writing Learners - Comprehensive Documentation:**
- Provide extensive written explanations with detailed conceptual frameworks
- Include comprehensive background context and academic vocabulary
- Create text-rich interfaces with organized information architecture
- Focus on written analysis, synthesis, and critical thinking opportunities
- Provide extensive supplementary materials and reference documentation
- Include note-taking areas and written reflection opportunities
- Design interfaces supporting deep reading and analytical processes`
    };
    return optimizations[style] || optimizations.visual;
  }
  function getDifficultyOptimization(difficulty) {
    const optimizations = {
      beginner: `**Beginner Level Adaptation:**
- Use simple language with everyday analogies
- Provide step-by-step breakdowns and basic definitions
- Include frequent checks for understanding
- Focus on foundational concepts with positive reinforcement
- Avoid advanced terminology; explain everything clearly
- Break content into small, manageable chunks
- Include remedial support and alternative explanations
- Build confidence through easy successes and gradual progression`,
      intermediate: `**Intermediate Level Adaptation:**
- Assume basic knowledge while reviewing key prerequisites
- Introduce moderate complexity with practical examples
- Connect concepts through comparative analysis
- Balance challenge with support and guidance
- Encourage independent thinking with guided prompts
- Include real-world applications and case studies
- Provide opportunities for skill application
- Gradually increase depth and technical detail`,
      advanced: `**Advanced Level Adaptation:**
- Use sophisticated terminology and in-depth analysis
- Explore cutting-edge developments and research
- Focus on complex problem-solving and innovation
- Encourage critical evaluation and original contributions
- Provide nuanced insights and multiple perspectives
- Include advanced challenges and synthesis opportunities
- Assume strong foundational knowledge
- Push boundaries with thought-provoking scenarios`
    };
    return optimizations[difficulty] || optimizations.intermediate;
  }
  // Complete assembly of the optimized system prompt
  // Inside createOptimizedSystemPrompt
  return `${basePrompt}

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
