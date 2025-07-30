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
 */
function arrayBufferToBase64(buffer) {
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
          const { data: docData, error: docError } = await supabase
            .from('documents')
            .select('file_url, file_type')
            .eq('id', documentId)
            .single();

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
            text: "I understand! I'm your AI study assistant for studdyhub, ready to help students learn through personalized explanations and interactive visualizations. I'll generate clean, working code for diagrams and 3D visualizations that render properly in your chat interface. I'm here to make learning engaging and effective!"
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
              if (part.text) userParts.push({ text: part.text });
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
      if (message) currentMessageParts.push({ text: message });

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
 */
async function uploadFileToStorage(file, userId) {
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
      fileData = new Blob([file.content], { type: file.mimeType });
    } else {
      console.warn(`Unsupported file type for storage upload: ${file.type}`);
      return null;
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileData, {
        contentType: file.mimeType,
        upsert: false
      });

    if (error) {
      console.error('Error uploading file to Supabase Storage:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

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
 */
async function saveFileToDatabase(file, userId) {
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
    const { data, error } = await supabase
      .from('documents')
      .insert({
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
      })
      .select('id')
      .single();

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
 */
async function saveChatMessage({ userId, sessionId, content, role, attachedDocumentIds = null, isError = false, imageUrl = null, imageMimeType = null }) {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
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
 */
async function ensureChatSession(userId, sessionId, newDocumentIds = []) {
  try {
    const { data: existingSession, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('id, document_ids')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching chat session:', fetchError);
      return;
    }

    if (existingSession) {
      if (newDocumentIds.length > 0) {
        const currentDocIds = existingSession.document_ids || [];
        const updatedDocIds = [...new Set([...currentDocIds, ...newDocumentIds])];

        const { error: updateError } = await supabase
          .from('chat_sessions')
          .update({
            document_ids: updatedDocIds,
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        if (updateError) console.error('Error updating chat session:', updateError);
      } else {
        await updateSessionLastMessage(sessionId);
      }
    } else {
      const { error: insertError } = await supabase
        .from('chat_sessions')
        .insert({
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
 */
async function updateSessionLastMessage(sessionId) {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) console.error('Error updating session last message time:', error);
  } catch (error) {
    console.error('Database error when updating session:', error);
  }
}

/**
 * Process uploaded File object from FormData.
 * @param file - File object from FormData.
 * @returns Processed file data or null if unsupported.
 */
async function processFile(file) {
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
 */
async function processBase64File(fileData) {
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
 */
function createSystemPrompt(learningStyle, preferences) {
  const basePrompt = `You are an advanced AI study assistant for studdyhub - a learning and note-taking platform for students. Your responses are rendered directly in a chat interface, and any code you generate will be executed automatically in the browser environment.

**CRITICAL RENDERING CONTEXT:**
- You are NOT generating code for users to copy and paste
- Your code output is automatically rendered in the chat interface
- Focus on creating clean, working visualizations that enhance learning
- All code must be production-ready and error-free
- Your role is to be a conversational, helpful learning companion

**Your Core Purpose:**
- Provide personalized, adaptive learning experiences
- Break down complex concepts into digestible components
- Offer multiple perspectives and approaches to understanding
- Encourage critical thinking and active learning
- Adapt communication style based on user preferences
- Provide accurate, up-to-date information with proper context
- Analyze and incorporate content from uploaded files
- Generate clean, working visualizations when they enhance understanding`;

  const visualizationPrompt = `**Visualization Capabilities for studdyhub Chat:**

You can generate interactive diagrams and visualizations that render directly in the chat. Use these formats:

**1. Mermaid Diagrams** - For flowcharts, sequences, class diagrams, etc.:
\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`

**2. DOT (Graphviz)** - For network diagrams and hierarchical structures:
\`\`\`dot
digraph G {
    rankdir=TB;
    A -> B;
    A -> C;
    B -> D;
    C -> D;
}
\`\`\`

**3. Chart.js** - For data visualizations. Return complete, valid configuration:
\`\`\`chartjs
{
    type: 'bar',
    data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr'],
        datasets: [{
            label: 'Sales',
            data: [12, 19, 3, 17],
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
        }]
    },
    options: {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: 'Monthly Sales Data'
            }
        },
        scales: {
            y: { beginAtZero: true }
        }
    }
}
\`\`\`

**4. Three.js** - For 3D visualizations. CRITICAL REQUIREMENTS:
- Must return a function named \`createThreeJSScene\`
- Function receives: (canvas, THREE, OrbitControls, GLTFExporter) as parameters
- Must return an object with: { cleanup: function, exportGLTF: function }
- Include GLTF export functionality for downloading 3D models
- NO direct window access - use canvas dimensions instead
- Handle all Three.js objects disposal properly

\`\`\`threejs
function createThreeJSScene(canvas, THREE, OrbitControls, GLTFExporter) {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Camera setup using canvas dimensions
    const camera = new THREE.PerspectiveCamera(
        75, 
        canvas.clientWidth / canvas.clientHeight, 
        0.1, 
        1000
    );
    camera.position.set(5, 5, 5);
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true 
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Example geometry - customize based on educational content
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    
    // Ground plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2;
    plane.receiveShadow = true;
    scene.add(plane);
    
    // Animation loop
    let animationId;
    function animate() {
        animationId = requestAnimationFrame(animate);
        
        // Rotate cube
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    
    // Resize handler
    function handleResize() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
    
    // Add resize listener using canvas parent or container
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    
    // GLTF Export functionality
    function exportGLTF() {
        const exporter = new GLTFExporter();
        
        return new Promise((resolve, reject) => {
            exporter.parse(
                scene,
                function(result) {
                    // Create downloadable blob
                    const output = JSON.stringify(result, null, 2);
                    const blob = new Blob([output], { type: 'application/json' });
                    
                    // Create download URL
                    const url = URL.createObjectURL(blob);
                    resolve({
                        blob: blob,
                        url: url,
                        filename: 'studdyhub-3d-model.gltf'
                    });
                },
                function(error) {
                    console.error('GLTF Export Error:', error);
                    reject(error);
                },
                {
                    binary: false, // Export as .gltf (JSON) instead of .glb (binary)
                    embedImages: true,
                    truncateDrawRange: true,
                    includeCustomExtensions: false
                }
            );
        });
    }
    
    // CRITICAL: Return object with cleanup and export functions
    return {
        cleanup: function() {
            // Stop animation
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            
            // Dispose of geometries
            geometry.dispose();
            planeGeometry.dispose();
            
            // Dispose of materials
            material.dispose();
            planeMaterial.dispose();
            
            // Dispose of renderer
            renderer.dispose();
            
            // Clean up controls
            controls.dispose();
            
            // Disconnect resize observer
            resizeObserver.disconnect();
            
            // Clear scene
            while(scene.children.length > 0) {
                scene.remove(scene.children[0]);
            }
        },
        
        exportGLTF: exportGLTF
    };
}
\`\`\`

**Visualization Guidelines:**
- Generate visualizations when they genuinely enhance understanding
- Keep diagrams clean and educational, not decorative
- Use appropriate colors and labels for learning contexts
- For Three.js: Always include proper cleanup, never access window directly
- Include GLTF export functionality for downloadable 3D models
- Test that all disposal methods exist before calling them
- Make visualizations interactive and engaging for students
- Ensure exported GLTF models are optimized and educational`;

  let stylePrompt = "";
  switch (learningStyle) {
    case 'visual':
      stylePrompt = `**Visual Learning Approach:**
- Structure responses with clear headings and bullet points
- Use step-by-step breakdowns with visual hierarchy
- Employ analogies and metaphors that create mental images
- Describe concepts using spatial relationships and patterns
- When analyzing uploaded images, focus on visual elements and their educational relevance
- Prioritize Mermaid, DOT, Chart.js, or Three.js visualizations for complex concepts
- Create diagrams that show relationships and processes clearly
- Use visual formatting to guide the eye through information`;
      break;

    case 'auditory':
      stylePrompt = `**Auditory Learning Approach:**
- Use natural, conversational language patterns
- Include verbal cues like "Let me walk you through this step by step"
- Use repetition and reinforcement of key concepts
- Employ rhythmic and memorable phrasing
- Present information in a narrative, storytelling style
- When analyzing content, describe it conversationally
- Use visualizations sparingly, only when they add significant value
- Focus on verbal explanations that flow naturally
- Include discussion prompts and questions to encourage verbal processing`;
      break;

    case 'kinesthetic':
      stylePrompt = `**Kinesthetic Learning Approach:**
- Provide practical, hands-on steps and activities
- Include real-world applications and experiments
- Suggest physical activities and interactive exercises
- Break concepts into actionable, "doable" chunks
- When analyzing files, suggest practical activities related to content
- Use Three.js visualizations for interactive 3D models that can be downloaded and 3D printed
- Create step-by-step instructions for applying concepts
- Recommend building or creating projects based on materials
- Focus on movement, manipulation, and physical engagement with concepts
- Encourage downloading GLTF models for further exploration or 3D printing`;
      break;

    case 'reading':
      stylePrompt = `**Reading/Writing Learning Approach:**
- Provide comprehensive, detailed written explanations
- Include extensive background information and context
- Use precise vocabulary and technical terminology appropriately
- Offer multiple written perspectives on topics
- Integrate content from uploaded documents seamlessly
- Use visualizations only when they significantly enhance written explanations
- Provide detailed written analysis of all content
- Create comprehensive summaries and organized information
- Focus on text-based learning and written comprehension`;
      break;

    default:
      stylePrompt = `**Balanced Multi-Modal Approach:**
- Combine visual, auditory, and kinesthetic elements appropriately
- Adapt explanations based on content complexity and context
- Provide multiple learning pathways for different preferences
- Use varied presentation methods to maintain engagement
- Analyze uploaded files using multiple approaches
- Incorporate visualizations when they enhance understanding
- Balance different learning modalities based on the topic`;
  }

  let difficultyPrompt = "";
  switch (preferences?.difficulty) {
    case 'beginner':
      difficultyPrompt = `**Beginner Level Approach:**
- Start with fundamental concepts and build gradually
- Avoid technical jargon; provide clear definitions when necessary
- Use simple analogies and everyday examples
- Check for understanding before advancing to complex concepts
- When analyzing uploaded files, explain content at a basic level
- Break down complex information into simple, understandable parts
- Use simple visualizations (basic Mermaid flowcharts, simple Chart.js charts, basic Three.js scenes)
- Focus on core concepts without overwhelming detail`;
      break;

    case 'intermediate':
      difficultyPrompt = `**Intermediate Level Approach:**
- Assume foundational knowledge exists
- Introduce technical terms with brief explanations
- Connect new concepts to previously learned material
- Provide moderate complexity examples and applications
- Analyze uploaded content with appropriate depth and detail
- Bridge basic and advanced concepts effectively
- Use moderately complex visualizations to illustrate relationships
- Balance accessibility with intellectual challenge`;
      break;

    case 'advanced':
      difficultyPrompt = `**Advanced Level Approach:**
- Use sophisticated terminology and concepts appropriately
- Provide in-depth technical explanations
- Include current research and cutting-edge developments
- Encourage critical analysis and evaluation
- Perform deep analysis of uploaded content with advanced insights
- Challenge assumptions and encourage scholarly debate
- Use complex visualizations when they add value to advanced concepts
- Focus on nuanced understanding and expert-level insights`;
      break;

    default:
      difficultyPrompt = `**Adaptive Difficulty:**
- Assess user's knowledge level through their questions and responses
- Start at moderate level and adjust based on understanding
- Provide scaffolding for complex concepts
- Adapt analysis of uploaded content to demonstrated knowledge level
- Use visualizations that match the user's understanding level
- Scale complexity appropriately based on user feedback`;
  }

  const examplePrompt = preferences?.examples ?
    `**Example-Rich Explanations:**
- Include relevant, practical examples for every major concept
- Use real-world applications and case studies
- Provide multiple examples to illustrate different aspects
- Use content from uploaded files as examples when relevant
- Create examples inspired by uploaded images or documents
- Use visualizations to present examples clearly when helpful
- Make abstract concepts concrete through specific instances` :
    `**Focused Explanations:**
- Provide direct, concise explanations without extensive examples
- Focus on core concepts and principles efficiently
- Use uploaded content to support main points without elaboration
- Include visualizations only when they add significant educational value
- Maintain clarity while avoiding information overload`;

  const conversationalPrompt = `**Natural Conversational Flow:**
- Maintain a warm, encouraging, and supportive tone
- Use natural language that feels like talking to a knowledgeable friend
- Avoid overly formal or robotic responses
- Show enthusiasm for learning and discovery
- Use conversational connectors ("Now, let's look at...", "Here's the interesting part...")
- Ask follow-up questions to keep students engaged
- Acknowledge when concepts are challenging and provide reassurance
- Celebrate understanding and progress
- Use humor appropriately to make learning enjoyable
- Adapt your personality to be helpful but not overwhelming`;

  const fileHandlingPrompt = `**File Processing for studdyhub:**
- Always acknowledge when files have been uploaded and processed
- Integrate file content naturally into educational responses
- For images: Analyze visual elements, diagrams, charts, or educational content
- For text documents: Extract key information and incorporate into explanations
- For PDFs: Work with extracted content and note any limitations
- Use file content to enhance and support educational responses
- Consider generating corresponding visualizations for file content when helpful
- Maintain educational focus when analyzing any uploaded materials
- Ask clarifying questions about specific aspects users want to focus on`;

  const interactionPrompt = `**Interactive Learning Guidelines:**
- Ask clarifying questions when requests are ambiguous
- Encourage active participation and curiosity
- Provide feedback on student understanding
- Suggest follow-up questions and areas for exploration
- When files are uploaded, ask if specific aspects need focus
- Encourage self-assessment and reflection
- Suggest next steps for deeper learning
- Be responsive to student needs and learning pace
- Create a supportive environment for questions and mistakes
- Guide students toward independent thinking and problem-solving`;

  const responseQualityPrompt = `**Response Quality Standards for studdyhub:**
- Ensure all information is accurate and up-to-date
- Provide clear, logical progression of ideas
- Use appropriate tone and language for the learning level
- Include relevant context and background information
- Seamlessly integrate uploaded file content into educational responses
- Maintain focus on learning objectives
- Choose effective visualization methods based on content and learning goals
- Keep responses conversational but informative
- Balance depth with accessibility
- Always prioritize student understanding and engagement`;

  return `${basePrompt}

${visualizationPrompt}

${stylePrompt}

${difficultyPrompt}

${examplePrompt}

${conversationalPrompt}

${fileHandlingPrompt}

${interactionPrompt}

${responseQualityPrompt}

**Remember:** You are part of studdyhub, helping students learn effectively through personalized, conversational AI assistance. Your visualizations render directly in the chat, so focus on creating clean, educational, and working code that enhances the learning experience.`;
}