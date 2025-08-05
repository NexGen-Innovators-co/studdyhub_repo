import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// File type mappings for MIME types
const SUPPORTED_FILE_TYPES = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/svg+xml': 'image',
  'application/pdf': 'pdf',
  'text/plain': 'text',
  'text/csv': 'text',
  'text/markdown': 'text',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document'
};
// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);
/**
 * Helper function to convert ArrayBuffer to base64 string safely for large files.
 * @param buffer The ArrayBuffer to convert.
 * @returns The base64 encoded string.
 */ function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
// Main server handler for incoming requests
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  let requestData = null;
  let files = [];
  let uploadedDocumentIds = [];
  let userMessageImageUrl = null;
  let userMessageImageMimeType = null;
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const userId = formData.get('userId');
      const sessionId = formData.get('sessionId');
      const learningStyle = formData.get('learningStyle');
      const learningPreferences = formData.get('learningPreferences') ? JSON.parse(formData.get('learningPreferences')) : {};
      const chatHistory = formData.get('chatHistory') ? JSON.parse(formData.get('chatHistory')) : [];
      const message = formData.get('message') || '';
      requestData = {
        userId,
        sessionId,
        learningStyle,
        learningPreferences,
        chatHistory,
        message
      };
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const processedFile = await processFile(value);
          if (processedFile) files.push(processedFile);
        }
      }
    } else {
      const body = await req.json();
      requestData = body;
      const userId = body.userId;
      if (body.files && Array.isArray(body.files)) {
        for (const fileData of body.files) {
          const processedFile = await processBase64File(fileData);
          if (processedFile) files.push(processedFile);
        }
      }
    }
    const { userId, sessionId, learningStyle, learningPreferences, chatHistory, message } = requestData;
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
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY environment variable not configured.');
    // Process files with Gemini for content extraction
    for (const file of files) {
      if ((file.type === 'image' || file.type === 'pdf' || file.type === 'document') && file.data && file.processing_status === 'pending') {
        console.log(`Attempting to extract content from ${file.name} using Gemini.`);
        try {
          const extractionPrompt = `Extract all readable text content from the provided document. Focus on the main body of text, ignoring headers, footers, page numbers, or any non-essential formatting unless explicitly part of the content. If the document contains structured data like tables, present it clearly. Return only the extracted text.`;
          const extractionContents = [
            {
              role: 'user',
              parts: [
                {
                  text: extractionPrompt
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
          const extractionApiUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`);
          extractionApiUrl.searchParams.append('key', geminiApiKey);
          const extractionResponse = await fetch(extractionApiUrl.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: extractionContents,
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 678987
              }
            })
          });
          if (extractionResponse.ok) {
            const extractionData = await extractionResponse.json();
            const extractedText = extractionData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (extractedText) {
              file.content = extractedText;
              file.processing_status = 'completed';
              file.processing_error = null;
              console.log(`Successfully extracted content from ${file.name}. Length: ${extractedText.length}`);
            } else {
              file.processing_status = 'failed';
              file.processing_error = 'Gemini did not return extracted text.';
              console.warn(`Gemini failed to extract content from ${file.name}.`);
            }
          } else {
            const errorBody = await extractionResponse.text();
            file.processing_status = 'failed';
            file.processing_error = `Gemini extraction API error: ${extractionResponse.status} - ${errorBody}`;
            console.error(`Gemini extraction API error for ${file.name}: ${errorBody}`);
          }
        } catch (extractionError) {
          file.processing_status = 'failed';
          file.processing_error = `Error during Gemini extraction: ${extractionError.message}`;
          console.error(`Error during Gemini extraction for ${file.name}:`, extractionError);
        }
      }
    }
    // Save files to database and get document IDs
    for (const file of files) {
      const documentId = await saveFileToDatabase(file, userId);
      if (documentId) {
        uploadedDocumentIds.push(documentId);
        if (file.type === 'image' && !userMessageImageUrl) {
          const { data: docData, error: docError } = await supabase.from('documents').select('file_url, file_type').eq('id', documentId).single();
          if (docData && !docError) {
            userMessageImageUrl = docData.file_url;
            userMessageImageMimeType = docData.file_type;
          } else {
            console.error('Error fetching document URL:', docError);
          }
        }
      }
    }
    // Ensure chat session exists
    await ensureChatSession(userId, sessionId, uploadedDocumentIds);
    // Build Gemini conversation
    const systemPrompt = createSystemPrompt(learningStyle, learningPreferences);
    const geminiContents = [
      {
        role: 'user',
        parts: [
          {
            text: systemPrompt
          }
        ]
      },
      {
        role: 'model',
        parts: [
          {
            text: "I understand! I'm your AI study assistant for StuddyHub, ready to help students learn through personalized explanations and interactive visualizations. I'll generate clean, working code for diagrams and 3D visualizations that render properly in your chat interface. I'm here to make learning engaging and effective!"
          }
        ]
      }
    ];
    // Add chat history
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
                text: msg.content || msg.parts?.[0]?.text || ''
              }
            ]
          });
        }
      }
    }
    // Add current message and files
    if (message || files.length > 0) {
      const currentMessageParts = [];
      if (message) currentMessageParts.push({
        text: message
      });
      for (const file of files) {
        if (file.type === 'image') {
          currentMessageParts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.data
            }
          });
        } else if (file.type === 'text' || file.type === 'pdf' || file.type === 'document') {
          currentMessageParts.push({
            text: `[File: ${file.name} (${file.type.toUpperCase()}) Content Start]\n${file.content}\n[File Content End]`
          });
        }
      }
      if (currentMessageParts.length > 0) {
        geminiContents.push({
          role: 'user',
          parts: currentMessageParts
        });
      }
      // Save user message to database
      if (message || files.length > 0) {
        await saveChatMessage({
          userId,
          sessionId,
          content: message,
          role: 'user',
          attachedDocumentIds: uploadedDocumentIds.length > 0 ? uploadedDocumentIds : null,
          imageUrl: userMessageImageUrl,
          imageMimeType: userMessageImageMimeType
        });
      }
    }
    // Call Gemini API
    const geminiApiUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`);
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
          maxOutputTokens: 678987
        }
      })
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorBody}`);
      await saveChatMessage({
        userId,
        sessionId,
        content: `Error: Failed to get response from Gemini API: ${response.statusText}`,
        role: 'assistant',
        isError: true
      });
      throw new Error(`Failed to get response from Gemini API: ${response.statusText}. Details: ${errorBody}`);
    }
    const data = await response.json();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    // Clean up response text
    generatedText = generatedText.split('\n').map((line) => {
      let cleanedLine = line.replace(/[^\x20-\x7E\n\r]/g, ' ');
      cleanedLine = cleanedLine.replace(/\s+/g, ' ').trim();
      return cleanedLine;
    }).filter((line) => line.length > 0 || line.trim().length === 0).join('\n');
    // Save assistant response
    await saveChatMessage({
      userId,
      sessionId,
      content: generatedText,
      role: 'assistant'
    });
    // Update session timestamp
    await updateSessionLastMessage(sessionId);
    return new Response(JSON.stringify({
      response: generatedText,
      userId: userId,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      filesProcessed: files.length,
      documentIds: uploadedDocumentIds
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in gemini-chat function:', error);
    if (requestData?.userId && requestData?.sessionId) {
      try {
        await saveChatMessage({
          userId: requestData.userId,
          sessionId: requestData.sessionId,
          content: `System Error: ${error.message || 'Internal Server Error'}`,
          role: 'assistant',
          isError: true
        });
      } catch (dbError) {
        console.error('Failed to save error message to database:', dbError);
      }
    }
    return new Response(JSON.stringify({
      error: error.message || 'Internal Server Error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
/**
 * Uploads a file to Supabase Storage.
 * @param file - The processed file object.
 * @param userId - The ID of the user uploading the file.
 * @returns The public URL of the uploaded file, or null if upload fails.
 */ async function uploadFileToStorage(file, userId) {
  try {
    const bucketName = 'chat-documents';
    const filePath = `${userId}/${crypto.randomUUID()}-${file.name}`;
    let fileData;
    if (file.type === 'image' || file.type === 'pdf' || file.type === 'document') {
      const binaryString = atob(file.data);
      fileData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileData[i] = binaryString.charCodeAt(i);
      }
    } else if (file.type === 'text') {
      fileData = new Blob([
        file.content
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
 * Save processed file to the documents table
 * @param file - The processed file object.
 * @param userId - The ID of the user.
 * @returns The ID of the saved document, or null if saving fails.
 */ async function saveFileToDatabase(file, userId) {
  let fileUrl = null;
  let contentExtracted = null;
  let processingStatus = file.processing_status || 'pending';
  let processingError = file.processing_error || null;
  if (file.type === 'image' || file.type === 'pdf' || file.type === 'document') {
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
  if (file.type === 'text') {
    contentExtracted = file.content;
    processingStatus = 'completed';
  }
  if (file.type === 'pdf' || file.type === 'document' || file.type === 'image') {
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
 * Save chat message to the database
 * @param messageData - Object containing message details.
 */ async function saveChatMessage({ userId, sessionId, content, role, attachedDocumentIds = null, isError = false, imageUrl = null, imageMimeType = null }) {
  try {
    const { error } = await supabase.from('chat_messages').insert({
      user_id: userId,
      session_id: sessionId,
      content: content,
      role: role,
      attached_document_ids: attachedDocumentIds,
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
 * Ensure chat session exists and update document_ids if new files were uploaded
 * @param userId - The ID of the user.
 * @param sessionId - The ID of the chat session.
 * @param newDocumentIds - An array of new document IDs to associate with the session.
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
 * Update session's last message timestamp
 * @param sessionId - The ID of the chat session.
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
 * Process uploaded File object from FormData.
 * @param file - File object from FormData.
 * @returns Processed file data or null if unsupported.
 */ async function processFile(file) {
  const mimeType = file.type;
  const fileType = SUPPORTED_FILE_TYPES[mimeType];
  if (!fileType) {
    console.warn(`Unsupported file type: ${mimeType}`);
    return null;
  }
  try {
    if (fileType === 'image') {
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuffer);
      return {
        name: file.name,
        type: 'image',
        mimeType: mimeType,
        data: base64Data,
        size: file.size,
        content: null,
        processing_status: 'pending',
        processing_error: null
      };
    } else if (fileType === 'text') {
      const textContent = await file.text();
      return {
        name: file.name,
        type: 'text',
        mimeType: mimeType,
        content: textContent,
        data: btoa(textContent),
        size: file.size,
        processing_status: 'completed',
        processing_error: null
      };
    } else if (fileType === 'pdf' || fileType === 'document') {
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuffer);
      return {
        name: file.name,
        type: fileType,
        mimeType: mimeType,
        data: base64Data,
        content: `[File: ${file.name} - ${file.size} bytes. Attempting text extraction...]`,
        size: file.size,
        processing_status: 'pending',
        processing_error: null
      };
    }
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    return null;
  }
  return null;
}
/**
 * Process base64 encoded file data from JSON request.
 * @param fileData - Object containing file information and base64 data.
 * @returns Processed file data or null if invalid.
 */ async function processBase64File(fileData) {
  if (!fileData.name || !fileData.mimeType || !fileData.data) {
    console.warn('Invalid file data structure');
    return null;
  }
  const fileType = SUPPORTED_FILE_TYPES[fileData.mimeType];
  if (!fileType) {
    console.warn(`Unsupported file type: ${fileData.mimeType}`);
    return null;
  }
  try {
    if (fileType === 'image') {
      return {
        name: fileData.name,
        type: 'image',
        mimeType: fileData.mimeType,
        data: fileData.data,
        size: fileData.size || 0,
        content: null,
        processing_status: 'pending',
        processing_error: null
      };
    } else if (fileType === 'text') {
      const decodedContent = atob(fileData.data);
      return {
        name: fileData.name,
        type: 'text',
        mimeType: fileData.mimeType,
        content: decodedContent,
        data: fileData.data,
        size: fileData.size || decodedContent.length,
        processing_status: 'completed',
        processing_error: null
      };
    } else if (fileType === 'pdf' || fileType === 'document') {
      return {
        name: fileData.name,
        type: fileType,
        mimeType: fileData.mimeType,
        data: fileData.data,
        content: `[File: ${fileData.name}. Attempting text extraction...]`,
        size: fileData.size || 0,
        processing_status: 'pending',
        processing_error: null
      };
    }
  } catch (error) {
    console.error(`Error processing base64 file ${fileData.name}:`, error);
    return null;
  }
  return null;
}
/**
 * Creates a dynamic system prompt for the AI based on user's learning style and preferences.
 * @param learningStyle - The user's preferred learning style.
 * @param preferences - Additional learning preferences.
 * @returns A string containing the comprehensive system prompt.
 */ function createSystemPrompt(learningStyle, preferences) {
  const basePrompt = `You are StuddyHub AI - an advanced learning assistant that generates production-ready educational content and interactive visualizations. Your responses render directly in a chat interface with automatic code execution.

**CORE MISSION:**
Transform complex learning concepts into engaging, accessible, and interactive experiences through:
- Personalized adaptive learning paths
- Working visualizations and modern web interfaces
- Meaningful integration of uploaded educational content
- Conversational guidance that builds understanding progressively

**EXECUTION CONTEXT:**
- ALL code executes automatically in browser environment
- Code MUST be syntactically perfect and error-free on first execution
- NO placeholder content - everything must be fully functional
- Focus on educational value with production-quality presentation
- Maintain supportive, conversational tone throughout interactions`;
  const visualizationStandards = `**VISUALIZATION STANDARDS & FORMATS:**

**1. MERMAID DIAGRAMS** - Use for concept relationships, processes, and hierarchies:
\`\`\`mermaid
graph TD
    A[Concept Introduction] --> B{Understanding Check}
    B -->|Clear| C[Advanced Topics]
    B -->|Unclear| D[Review & Practice]
    C --> E[Application]
    D --> B
    E --> F[Mastery Assessment]
\`\`\`

**Mermaid Requirements:**
- Direction indicators: TD (top-down), LR (left-right), TB, RL
- Node shapes: [] (rectangles), {} (diamonds), () (circles), [[ ]] (subroutines)
- Simple, educational node IDs (A-Z, 0-9, underscore only)
- Clear, learning-focused labels that tell a story
- Test complex flows incrementally

**2. CHART.JS VISUALIZATIONS** - Use for data analysis and educational metrics:
\`\`\`chartjs
{
    "type": "bar",
    "data": {
        "labels": ["Week 1", "Week 2", "Week 3", "Week 4"],
        "datasets": [{
            "label": "Learning Progress (%)",
            "data": [65, 78, 85, 92],
            "backgroundColor": ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"],
            "borderColor": "#1F2937",
            "borderWidth": 2
        }]
    },
    "options": {
        "responsive": true,
        "maintainAspectRatio": false,
        "plugins": {
            "title": {
                "display": true,
                "text": "Weekly Learning Progress Tracking",
                "font": { "size": 18, "weight": "bold" }
            },
            "legend": {
                "display": true,
                "position": "top"
            }
        },
        "scales": {
            "y": { 
                "beginAtZero": true,
                "max": 100,
                "title": { "display": true, "text": "Progress Percentage" }
            },
            "x": {
                "title": { "display": true, "text": "Time Period" }
            }
        }
    }
}
\`\`\`

**Chart.js Critical Rules:**
- ONLY supported types: "bar", "line", "pie", "doughnut", "radar", "polarArea", "scatter"
- All data values must be final numbers: [65, 78, 85, 92] (NO calculations or expressions)
- Double quotes for ALL JSON keys and string values
- Include complete options with responsive: true and maintainAspectRatio: false
- Educational focus: progress tracking, grade distributions, concept comparisons, study analytics
- Color schemes that enhance learning visualization

**3. THREE.JS EDUCATIONAL SCENES** - Use for 3D concept visualization:
\`\`\`threejs
function createThreeJSScene(canvas, THREE, OrbitControls, GLTFLoader) {
    // Parameter validation with educational context
    if (!canvas || !THREE || !OrbitControls) {
        console.error('StuddyHub: Missing Three.js dependencies for educational visualization');
        return null;
    }

    // Scene setup with educational environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Light educational background
    
    // Camera optimized for learning content
    const camera = new THREE.PerspectiveCamera(
        60, // Comfortable field of view for educational content
        canvas.clientWidth / canvas.clientHeight, 
        0.1, 
        1000
    );
    camera.position.set(8, 6, 8); // Optimal viewing angle for most educational models
    
    // Renderer with educational-focused settings
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
    
    // Educational-friendly controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.autoRotate = false; // Let users control exploration
    
    // Professional lighting setup for educational content
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(15, 15, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.setScalar(2048);
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);
    
    // Secondary light for better visibility
    const fillLight = new THREE.DirectionalLight(0x4f94cd, 0.3);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);
    
    // Educational content example - customize based on learning topic
    const geometry = new THREE.BoxGeometry(3, 3, 3);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0x3B82F6, // StuddyHub primary blue
        transparent: false,
        shininess: 50
    });
    const educationalObject = new THREE.Mesh(geometry, material);
    educationalObject.castShadow = true;
    educationalObject.receiveShadow = true;
    educationalObject.position.set(0, 1.5, 0);
    scene.add(educationalObject);
    
    // Educational platform/context
    const platformGeometry = new THREE.PlaneGeometry(25, 25);
    const platformMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.8
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.rotation.x = -Math.PI / 2;
    platform.position.y = 0;
    platform.receiveShadow = true;
    scene.add(platform);
    
    // Animation system for educational engagement
    let animationId = null;
    let isRunning = true;
    let time = 0;
    
    function animate() {
        if (!isRunning) return;
        
        animationId = requestAnimationFrame(animate);
        time += 0.01;
        
        // Subtle educational animation - gentle rotation for better viewing
        educationalObject.rotation.y = Math.sin(time) * 0.1;
        educationalObject.position.y = 1.5 + Math.sin(time * 2) * 0.1;
        
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    
    // Responsive handling for educational interface
    const onResize = () => {
        if (!canvas || !camera || !renderer) return;
        
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    };
    
    // Comprehensive cleanup for browser performance
    const cleanup = () => {
        isRunning = false;
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // Dispose all geometries
        geometry?.dispose();
        platformGeometry?.dispose();
        
        // Dispose all materials
        material?.dispose();
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
    
    // Return interface for external management
    return {
        scene,
        renderer,
        cleanup,
        onResize,
        // Additional educational utilities
        addObject: (object) => scene.add(object),
        removeObject: (object) => scene.remove(object),
        updateCamera: (position) => {
            camera.position.set(position.x, position.y, position.z);
            camera.lookAt(0, 0, 0);
        }
    };
}
\`\`\`

**Three.js Educational Focus:**
- Create 3D visualizations for abstract concepts: molecular structures, geometric principles, physics simulations
- Use educational color schemes (StuddyHub branding)
- Implement smooth, non-distracting animations
- Include interactive elements that enhance understanding
- Optimize performance for educational use (multiple scenes per session)
- Examples: chemistry molecules, mathematical surfaces, architectural models, anatomical structures

**4. HTML EDUCATIONAL INTERFACES** - Use for comprehensive learning experiences:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StuddyHub - Interactive Learning Interface</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'studdyhub': {
                            50: '#eff6ff',
                            100: '#dbeafe',
                            500: '#3b82f6',
                            600: '#2563eb',
                            700: '#1d4ed8',
                            900: '#1e3a8a'
                        },
                        'success': {
                            50: '#f0fdf4',
                            500: '#22c55e',
                            600: '#16a34a'
                        },
                        'warning': {
                            50: '#fffbeb',
                            500: '#f59e0b'
                        },
                        'danger': {
                            50: '#fef2f2',
                            500: '#ef4444'
                        }
                    },
                    fontFamily: {
                        'educational': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
                    },
                    animation: {
                        'gentle-bounce': 'gentleBounce 2s infinite',
                        'fade-in-up': 'fadeInUp 0.6s ease-out',
                        'progress-fill': 'progressFill 1.5s ease-out'
                    }
                }
            }
        }
    </script>
    <style>
        @keyframes gentleBounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-8px); }
            60% { transform: translateY(-4px); }
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressFill {
            from { width: 0%; }
            to { width: var(--progress-width); }
        }
        
        /* Educational UI enhancements */
        .learning-card {
            @apply bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1;
        }
        .progress-bar {
            @apply w-full bg-gray-200 rounded-full h-3 overflow-hidden;
        }
        .progress-fill {
            @apply h-full rounded-full transition-all duration-1000 ease-out;
            animation: progressFill 1.5s ease-out;
        }
        .interactive-button {
            @apply px-6 py-3 rounded-lg font-medium transition-all duration-200 focus:ring-4 focus:ring-opacity-50;
        }
        .primary-button {
            @apply interactive-button bg-studdyhub-600 text-white hover:bg-studdyhub-700 focus:ring-studdyhub-200;
        }
        .success-button {
            @apply interactive-button bg-success-600 text-white hover:bg-success-700 focus:ring-success-200;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-gray-50 to-studdyhub-50 min-h-screen font-educational antialiased">
    <!-- StuddyHub Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 bg-studdyhub-600 rounded-xl flex items-center justify-center shadow-md">
                        <span class="text-white font-bold text-lg">SH</span>
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900">StuddyHub AI</h1>
                        <p class="text-xs text-gray-500">Interactive Learning Platform</p>
                    </div>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="hidden md:block px-3 py-1 bg-success-100 text-success-800 rounded-full text-sm font-medium">
                        Learning Active
                    </span>
                    <button class="primary-button text-sm">
                        Dashboard
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Main Educational Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Learning Progress Header -->
        <div class="text-center mb-12 animate-fade-in-up">
            <h2 class="text-4xl font-bold text-gray-900 mb-4">
                Your Learning Journey
            </h2>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Explore concepts through interactive visualizations, hands-on activities, and personalized learning paths designed for your success.
            </p>
        </div>

        <!-- Progress Dashboard -->
        <div class="learning-card mb-8">
            <h3 class="text-2xl font-semibold text-gray-900 mb-6">Learning Progress Overview</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="text-center">
                    <div class="w-16 h-16 bg-studdyhub-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span class="text-2xl font-bold text-studdyhub-600">85%</span>
                    </div>
                    <h4 class="font-semibold text-gray-900">Concept Mastery</h4>
                    <p class="text-sm text-gray-600">Core understanding achieved</p>
                </div>
                <div class="text-center">
                    <div class="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span class="text-2xl font-bold text-success-600">92%</span>
                    </div>
                    <h4 class="font-semibold text-gray-900">Practice Completion</h4>
                    <p class="text-sm text-gray-600">Hands-on activities done</p>
                </div>
                <div class="text-center">
                    <div class="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span class="text-2xl font-bold text-warning-600">78%</span>
                    </div>
                    <h4 class="font-semibold text-gray-900">Assessment Score</h4>
                    <p class="text-sm text-gray-600">Overall performance</p>
                </div>
            </div>
        </div>

        <!-- Interactive Learning Modules -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div class="learning-card">
                <div class="w-12 h-12 bg-studdyhub-100 rounded-lg flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-studdyhub-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Interactive Lessons</h3>
                <p class="text-gray-600 mb-4">Engage with multimedia content and interactive explanations.</p>
                <button class="primary-button w-full" onclick="showNotification('Starting interactive lesson!', 'success')">
                    Start Learning
                </button>
            </div>

            <div class="learning-card">
                <div class="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Practice Labs</h3>
                <p class="text-gray-600 mb-4">Apply knowledge through hands-on experiments and simulations.</p>
                <button class="success-button w-full" onclick="showNotification('Opening practice lab!', 'info')">
                    Practice Now
                </button>
            </div>

            <div class="learning-card">
                <div class="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Progress Analytics</h3>
                <p class="text-gray-600 mb-4">Track your learning with detailed insights and recommendations.</p>
                <button class="interactive-button bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-200 w-full" onclick="showNotification('Loading analytics dashboard!', 'info')">
                    View Analytics
                </button>
            </div>
        </div>

        <!-- Detailed Progress Section -->
        <div class="learning-card">
            <h3 class="text-xl font-semibold text-gray-900 mb-6">Detailed Learning Progress</h3>
            <div class="space-y-6">
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-medium text-gray-700">Fundamental Concepts</span>
                        <span class="text-sm text-gray-500">85% Complete</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill bg-studdyhub-600" style="--progress-width: 85%;"></div>
                    </div>
                </div>
                
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-medium text-gray-700">Practical Applications</span>
                        <span class="text-sm text-gray-500">92% Complete</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill bg-success-600" style="--progress-width: 92%;"></div>
                    </div>
                </div>
                
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-medium text-gray-700">Advanced Topics</span>
                        <span class="text-sm text-gray-500">68% Complete</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill bg-warning-600" style="--progress-width: 68%;"></div>
                    </div>
                </div>
                
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-medium text-gray-700">Assessment Mastery</span>
                        <span class="text-sm text-gray-500">78% Complete</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill bg-danger-600" style="--progress-width: 78%;"></div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Educational Footer -->
    <footer class="bg-white border-t border-gray-200 mt-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="text-center">
                <p class="text-gray-600">&copy; 2024 StuddyHub AI. Empowering learning through interactive technology.</p>
                <p class="text-sm text-gray-500 mt-2">Designed for educational excellence and student success.</p>
            </div>
        </div>
    </footer>

    <script>
        // Educational notification system
        function showNotification(message, type = 'info') {
            const colors = {
                success: 'bg-success-600',
                info: 'bg-studdyhub-600',
                warning: 'bg-warning-600',
                error: 'bg-danger-600'
            };
            
            const notification = document.createElement('div');
            notification.className = \`fixed top-20 right-4 \${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-fade-in-up max-w-sm\`;
            notification.innerHTML = \`
                <div class="flex items-center space-x-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>\${message}</span>
                </div>
            \`;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 4000);
        }
        
        // Initialize educational interface
        document.addEventListener('DOMContentLoaded', function() {
            // Animate progress bars sequentially
            const progressBars = document.querySelectorAll('.progress-fill');
            progressBars.forEach((bar, index) => {
                setTimeout(() => {
                    bar.style.width = bar.style.getPropertyValue('--progress-width');
                }, index * 200);
            });
            
            // Add gentle animations to cards
            const cards = document.querySelectorAll('.learning-card');
            cards.forEach((card, index) => {
                card.style.animationDelay = \`\${index * 0.1}s\`;
                card.classList.add('animate-fade-in-up');
            });
        });
    </script>
</body>
</html>
\`\`\`

**HTML Educational Interface Standards:**
- Complete, self-contained HTML5 documents optimized for iframe execution
- StuddyHub AI branding with consistent color scheme and typography
- Responsive design using Tailwind CSS utility classes
- Interactive elements that enhance learning engagement
- Progress tracking visualizations and educational metrics
- Accessibility features with proper ARIA labels and semantic HTML
- No external dependencies beyond Tailwind CDN (iframe-safe)
- JavaScript functionality using in-memory storage only (no localStorage/sessionStorage)
- Mobile-optimized touch targets and responsive layouts
- Educational content structure with clear information hierarchy`;
  const learningStyleAdaptations = {
    visual: `**VISUAL LEARNING OPTIMIZATION:**
- Prioritize diagrams, charts, and visual hierarchies in all content
- Use color coding and spatial relationships to convey information
- Create visual step-by-step breakdowns with flowcharts and process diagrams
- Implement clear visual navigation and content organization
- Generate Three.js 3D models for complex spatial concepts
- Use HTML interfaces with strong visual design patterns and iconography`,
    auditory: `**AUDITORY LEARNING OPTIMIZATION:**
- Write in conversational, narrative language with natural flow
- Include verbal cues and transition phrases in content
- Structure information as stories or dialogues within interfaces
- Use repetition and rhythm in explanations naturally
- Create discussion prompts and question sequences in HTML content
- Focus on descriptive language that "sounds" engaging when read`,
    kinesthetic: `**KINESTHETIC LEARNING OPTIMIZATION:**
- Provide interactive elements requiring user action (buttons, forms, sliders)
- Include step-by-step activities and hands-on experiments in HTML
- Create manipulable Three.js models and interactive visualizations
- Break learning into actionable tasks with immediate feedback
- Include real-world applications and practical exercises
- Design interfaces that encourage exploration and discovery`,
    reading: `**READING/WRITING LEARNING OPTIMIZATION:**
- Provide comprehensive written explanations and detailed documentation
- Include extensive background context and thorough definitions
- Use precise vocabulary with clear terminology explanations
- Create text-rich interfaces with detailed information architecture
- Focus on written analysis, summaries, and comprehensive content
- Supplement visualizations with detailed written descriptions`
  };
  const difficultyAdaptations = {
    beginner: `**BEGINNER LEVEL APPROACH:**
- Start with fundamental concepts and build incrementally
- Avoid technical jargon; define all necessary terms with tooltips or explanations
- Use familiar analogies and everyday examples in content
- Create simple, clear visualizations (basic flowcharts, simple charts)
- Include frequent comprehension checks and interactive elements
- Focus on core concepts without overwhelming detail or complexity`,
    intermediate: `**INTERMEDIATE LEVEL APPROACH:**
- Assume foundational knowledge while providing brief context
- Introduce technical terms with clear definitions and applications
- Connect new concepts to existing knowledge systematically
- Use moderately complex visualizations and multi-step processes
- Balance accessibility with intellectual challenge appropriately
- Bridge basic and advanced concepts with clear progression paths`,
    advanced: `**ADVANCED LEVEL APPROACH:**
- Use sophisticated terminology appropriately with minimal explanation
- Provide in-depth technical explanations and comprehensive analysis
- Include cutting-edge developments, research findings, and expert insights
- Create complex visualizations and advanced interactive components
- Encourage critical analysis, synthesis, and original thinking
- Focus on nuanced understanding and professional-level expertise`
  };
  const contentIntegrationPrompt = `**CONTENT INTEGRATION & FILE PROCESSING:**

**Uploaded File Handling:**
- Always acknowledge uploaded files and describe their educational relevance
- Seamlessly integrate file content into visualizations and HTML interfaces
- Extract key concepts and create visual representations of file data
- Use uploaded content as source material for examples and case studies
- Create interactive interfaces that allow exploration of file-based information
- Maintain educational focus while incorporating user-provided materials

**Content Analysis & Synthesis:**
- Identify core learning objectives from uploaded materials
- Break complex documents into digestible educational components
- Create visual summaries and concept maps from textual content
- Generate practice questions and interactive exercises based on file content
- Establish connections between uploaded content and broader learning goals
- Adapt content complexity to match user's demonstrated knowledge level

**Educational Value Enhancement:**
- Transform static content into interactive learning experiences
- Create multiple representations of the same concept (visual, textual, interactive)
- Generate follow-up questions and exploration paths from uploaded content
- Suggest practical applications and real-world connections
- Design progressive learning sequences based on file complexity
- Maintain educational context while making content engaging and accessible`;
  const productionQualityStandards = `**PRODUCTION QUALITY ASSURANCE:**

**Code Execution Standards:**
- Every visualization must execute flawlessly on first attempt
- All JSON structures must be valid and parseable (use online validators mentally)
- HTML must be complete, semantic, and iframe-compatible
- Three.js scenes must include proper cleanup and error handling
- No placeholder content - all functionality must be fully implemented
- Test complex code with simpler versions before outputting final solution

**Educational Effectiveness Requirements:**
- Every response must enhance understanding of the subject matter
- Visualizations should clarify concepts, not just look impressive  
- Interactive elements must serve educational purposes, not just engagement
- Content must be age-appropriate and pedagogically sound
- Learning objectives should be clear and measurable
- Assessment opportunities should be embedded naturally

**Performance & Accessibility:**
- Optimize for smooth performance across devices and browsers
- Ensure accessibility with proper ARIA labels and semantic markup
- Use responsive design principles for various screen sizes
- Implement efficient rendering and memory management
- Include proper error handling and graceful degradation
- Test compatibility with iframe sandbox environment

**User Experience Excellence:**
- Create intuitive, learner-friendly interfaces with clear navigation
- Provide immediate feedback for user interactions
- Use consistent design patterns and visual hierarchy
- Implement smooth animations that enhance rather than distract
- Ensure fast loading times and responsive interactions
- Design for both novice and experienced learners`;
  const conversationalGuidelines = `**CONVERSATIONAL & PEDAGOGICAL APPROACH:**

**Communication Style:**
- Maintain warm, encouraging, and supportive tone throughout interactions
- Use conversational language while remaining educationally focused
- Acknowledge user questions and concerns with empathy and understanding
- Provide constructive feedback that builds confidence and understanding
- Encourage curiosity and exploration through thoughtful questioning
- Adapt communication style to user's demonstrated knowledge level

**Learning Facilitation:**
- Guide users toward independent thinking and problem-solving
- Ask clarifying questions when requests are ambiguous or unclear
- Provide context and background for complex concepts naturally
- Suggest logical next steps and areas for further exploration
- Create supportive environment for questions and experimentation
- Balance guidance with opportunities for self-discovery

**Adaptive Response Strategies:**
- Monitor user understanding through interaction patterns and feedback
- Adjust complexity and pacing based on user responses and engagement
- Provide multiple explanation approaches for difficult concepts
- Offer remediation and review when understanding gaps are identified
- Celebrate learning achievements and progress milestones
- Maintain patience and positivity throughout the learning process`;
  // Construct the complete system prompt
  const getStylePrompt = (style) => learningStyleAdaptations[style] || learningStyleAdaptations.visual;
  const getDifficultyPrompt = (difficulty) => difficultyAdaptations[difficulty] || difficultyAdaptations.intermediate;
  const examplePreference = preferences?.examples ? `**EXAMPLE-RICH LEARNING APPROACH:**
- Include practical, real-world examples for every major concept
- Create multiple examples showing concept application in different contexts
- Use case studies and scenarios that resonate with learner experience
- Generate examples from uploaded content when relevant and appropriate
- Make abstract concepts concrete through specific, relatable instances
- Provide both simple and complex examples to support different learning stages` : `**FOCUSED LEARNING APPROACH:**
- Provide direct, efficient explanations without excessive elaboration
- Focus on core principles and essential understanding
- Maintain clarity while avoiding information overload
- Use examples selectively when they significantly enhance comprehension
- Prioritize depth over breadth in concept exploration
- Keep content streamlined and purposeful`;
  return `${basePrompt}

${visualizationStandards}

${getStylePrompt(learningStyle)}

${getDifficultyPrompt(preferences?.difficulty)}

${examplePreference}

${contentIntegrationPrompt}

${productionQualityStandards}

${conversationalGuidelines}

**FINAL EXECUTION REMINDERS:**
You are StuddyHub AI - every interaction should feel like working with an expert educational technology platform. Your visualizations and interfaces will execute automatically in the browser, so they must be perfect on first attempt. Focus on creating meaningful learning experiences that genuinely help users understand complex concepts through interactive, engaging, and pedagogically sound approaches.

**Key Success Metrics:**
- Educational value: Does this genuinely help the user learn?
- Technical excellence: Does the code execute flawlessly?
- User experience: Is the interface intuitive and engaging?
- Accessibility: Can learners with different needs access the content?
- Production quality: Would this meet professional educational software standards?

Always maintain your role as a supportive learning companion while delivering production-quality educational technology solutions.`;
}
