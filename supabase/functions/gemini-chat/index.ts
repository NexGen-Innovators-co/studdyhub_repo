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
  // Images
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/svg+xml': 'image',
  // Documents
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
 * This avoids the "Maximum call stack size exceeded" error with String.fromCharCode.
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
  // Handle OPTIONS requests (pre-flight CORS checks)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  let requestData = null;
  let files = [];
  let uploadedDocumentIds = [];
  let userMessageImageUrl = null; // To store the URL of the first image in the user's message
  let userMessageImageMimeType = null; // To store the MIME type of the first image
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
      // Process uploaded files from FormData
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const processedFile = await processFile(value);
          if (processedFile) {
            files.push(processedFile);
          }
        }
      }
    } else {
      // Handle regular JSON requests (files are base64 encoded)
      const body = await req.json();
      requestData = body;
      // userId is needed here for file processing and saving
      const userId = body.userId;
      if (body.files && Array.isArray(body.files)) {
        for (const fileData of body.files) {
          const processedFile = await processBase64File(fileData);
          if (processedFile) {
            files.push(processedFile);
          }
        }
      }
    }
    const { userId, sessionId, learningStyle, learningPreferences, chatHistory, message } = requestData;
    // Validate required parameters
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
    // Retrieve Gemini API key from environment variables
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable not configured.');
    }
    // --- Reinstated: Content Extraction for PDF/Document files using Gemini ---
    for (const file of files) {
      // Only attempt Gemini extraction for image, pdf, or document types that have data and are not yet completed
      // Text files are already 'completed' in processFile/processBase64File
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
                maxOutputTokens: 678987 // Generous token limit for extraction
              }
            })
          });
          if (extractionResponse.ok) {
            const extractionData = await extractionResponse.json();
            const extractedText = extractionData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (extractedText) {
              file.content = extractedText; // Update the file object with extracted content
              file.processing_status = 'completed';
              file.processing_error = null;
              console.log(`Successfully extracted content from ${file.name} using Gemini. Extracted text length: ${extractedText.length}`);
              // Log first 200 characters of extracted text for verification
              console.log(`Extracted content preview: "${extractedText.substring(0, 200)}..."`);
            } else {
              file.processing_status = 'failed';
              file.processing_error = 'Gemini did not return extracted text.';
              console.warn(`Gemini failed to extract content from ${file.name}. Response data: ${JSON.stringify(extractionData)}`);
            }
          } else {
            const errorBody = await extractionResponse.text();
            file.processing_status = 'failed';
            file.processing_error = `Gemini extraction API error: ${extractionResponse.status} - ${errorBody}`;
            console.error(`Gemini extraction API error for ${file.name}: ${extractionResponse.status} - ${errorBody}`);
          }
        } catch (extractionError) {
          file.processing_status = 'failed';
          file.processing_error = `Error during Gemini extraction: ${extractionError.message}`;
          console.error(`Error during Gemini extraction for ${file.name}:`, extractionError);
        }
      }
    }
    // --- END Reinstated: Content Extraction ---
    // --- Save files to database *after* potential content extraction ---
    for (const file of files) {
      // Log the content that will be passed to saveFileToDatabase
      console.log(`Preparing to save file ${file.name}. Content to be saved length: ${file.content ? file.content.length : 0}`);
      console.log(`Content to be saved preview (first 200 chars): "${file.content ? file.content.substring(0, 200) : 'N/A'}"`);
      const documentId = await saveFileToDatabase(file, userId);
      if (documentId) {
        uploadedDocumentIds.push(documentId);
        // If it's an image, store its URL and mime type for the chat message
        if (file.type === 'image' && !userMessageImageUrl) {
          // Fetch the public URL from the 'documents' table after saving
          const { data: docData, error: docError } = await supabase.from('documents').select('file_url, file_type').eq('id', documentId).single();
          if (docData && !docError) {
            userMessageImageUrl = docData.file_url;
            userMessageImageMimeType = docData.file_type;
          } else {
            console.error('Error fetching document URL after save:', docError);
          }
        }
      }
    }
    // --- END Save files ---
    // Ensure chat session exists and update it if files were uploaded
    await ensureChatSession(userId, sessionId, uploadedDocumentIds);
    // Generate the system prompt based on learning style and preferences
    const systemPrompt = createSystemPrompt(learningStyle, learningPreferences);
    // Initialize the array to hold Gemini API content (chat history + current message)
    const geminiContents = [];
    // Add system prompt as the very first instruction
    geminiContents.push({
      role: 'user',
      parts: [
        {
          text: systemPrompt
        }
      ]
    });
    // The AI's initial response to the system prompt
    geminiContents.push({
      role: 'model',
      parts: [
        {
          text: "Okay, I understand. I'm ready to assist you."
        }
      ]
    });
    // Add previous chat history messages to `geminiContents`
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        if (msg.role === 'user') {
          const userParts = [];
          if (msg.parts && Array.isArray(msg.parts)) {
            for (const part of msg.parts) {
              if (part.text) {
                userParts.push({
                  text: part.text
                });
              }
              // If chat history contains inlineData (base64 image data), re-add it for Gemini
              // This is crucial for Gemini to "see" the images from past turns.
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
    // Add current message with files (if any)
    if (message || files.length > 0) {
      const currentMessageParts = [];
      if (message) {
        currentMessageParts.push({
          text: message
        });
      }
      for (const file of files) {
        if (file.type === 'image') {
          currentMessageParts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.data // This is the base64 data for Gemini
            }
          });
        } else if (file.type === 'text' || file.type === 'pdf' || file.type === 'document') {
          // Send extracted content to Gemini
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
      // Only save if there's actual text content or files attached to the message
      if (message || files.length > 0) {
        await saveChatMessage({
          userId,
          sessionId,
          content: message,
          role: 'user',
          attachedDocumentIds: uploadedDocumentIds.length > 0 ? uploadedDocumentIds : null,
          imageUrl: userMessageImageUrl,
          imageMimeType: userMessageImageMimeType // Pass the MIME type of the first image
        });
      }
    }
    // Construct the Gemini API request URL
    const geminiApiUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`);
    geminiApiUrl.searchParams.append('key', geminiApiKey);
    // Make the request to the Gemini API
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
          maxOutputTokens: 678987 // Adjusted to a more common max output token value for Gemini-Flash
        }
      })
    });
    // Handle non-OK responses from the Gemini API
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorBody}`);
      // Save error message to database
      await saveChatMessage({
        userId,
        sessionId,
        content: `Error: Failed to get response from Gemini API: ${response.statusText}`,
        role: 'assistant',
        isError: true
      });
      throw new Error(`Failed to get response from Gemini API: ${response.statusText}. Details: ${errorBody}`);
    }
    // Parse the Gemini API response
    const data = await response.json();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    // Robust cleaning for generatedText from AI
    generatedText = generatedText.split('\n').map((line) => {
      let cleanedLine = line.replace(/[^\x20-\x7E\n\r]/g, ' ');
      cleanedLine = cleanedLine.replace(/\s+/g, ' ').trim();
      return cleanedLine;
    }).filter((line) => line.length > 0 || line.trim().length === 0).join('\n');
    // Save AI response to database
    await saveChatMessage({
      userId,
      sessionId,
      content: generatedText,
      role: 'assistant'
    });
    // Update session's last message timestamp
    await updateSessionLastMessage(sessionId);
    // Return the AI's response
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
    // Try to save error to database if we have the required data
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
 * @param file - The processed file object (from processFile or processBase64File).
 * @param userId - The ID of the user uploading the file.
 * @returns The public URL of the uploaded file, or null if upload fails.
 */ async function uploadFileToStorage(file, userId) {
  try {
    const bucketName = 'chat-documents'; // Ensure this bucket exists in Supabase Storage
    const filePath = `${userId}/${crypto.randomUUID()}-${file.name}`; // Unique path for each file
    let fileData;
    if (file.type === 'image' || file.type === 'pdf' || file.type === 'document') {
      // For images, PDFs, and general documents, the 'data' field holds base64. Convert to Uint8Array.
      const binaryString = atob(file.data);
      fileData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileData[i] = binaryString.charCodeAt(i);
      }
    } else if (file.type === 'text') {
      // For text files, the 'content' field holds the text. Convert to Blob.
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
    // Get the public URL
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    if (publicUrlData) {
      return publicUrlData.publicUrl;
    }
    return null;
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
  let processingStatus = file.processing_status || 'pending'; // Use status from extraction if available
  let processingError = file.processing_error || null; // Use error from extraction if available
  // Upload file to storage if it's an image, PDF, or general document
  if (file.type === 'image' || file.type === 'pdf' || file.type === 'document') {
    fileUrl = await uploadFileToStorage(file, userId);
    if (fileUrl) {
      // If storage upload was successful, and content extraction was already done, keep its status
      if (processingStatus === 'pending') {
        processingStatus = 'completed';
      }
    } else {
      processingStatus = 'failed';
      processingError = processingError || 'Failed to upload file to storage';
      console.error(`Failed to upload file ${file.name} to storage. Document entry will not be created.`);
      return null; // Do not create document entry if storage upload fails
    }
  }
  // For text files, content is already extracted
  if (file.type === 'text') {
    contentExtracted = file.content;
    processingStatus = 'completed'; // Text content is directly available
  }
  // For PDFs and general documents, the 'content' field should now hold extracted text from Gemini
  if (file.type === 'pdf' || file.type === 'document' || file.type === 'image') {
    contentExtracted = file.content; // This will be the extracted text or the placeholder/error
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
    if (error) {
      console.error('Error saving chat message:', error);
    }
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
    // Check if session exists
    const { data: existingSession, error: fetchError } = await supabase.from('chat_sessions').select('id, document_ids').eq('id', sessionId).eq('user_id', userId).single();
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching chat session:', fetchError);
      return;
    }
    if (existingSession) {
      // Session exists, update document_ids if new documents were uploaded
      if (newDocumentIds.length > 0) {
        const currentDocIds = existingSession.document_ids || [];
        // Ensure document_ids are strings for the array type in Supabase
        const updatedDocIds = [
          ...new Set([
            ...currentDocIds,
            ...newDocumentIds
          ])
        ]; // Remove duplicates
        const { error: updateError } = await supabase.from('chat_sessions').update({
          document_ids: updatedDocIds,
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString() // Also update last_message_at when session is updated with docs
        }).eq('id', sessionId);
        if (updateError) {
          console.error('Error updating chat session:', updateError);
        }
      } else {
        // If no new documents, just update last_message_at
        await updateSessionLastMessage(sessionId);
      }
    } else {
      // Session doesn't exist, create it
      const { error: insertError } = await supabase.from('chat_sessions').insert({
        id: sessionId,
        user_id: userId,
        title: 'New Chat',
        document_ids: newDocumentIds,
        last_message_at: new Date().toISOString()
      });
      if (insertError) {
        console.error('Error creating chat session:', insertError);
      }
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
    if (error) {
      console.error('Error updating session last message time:', error);
    }
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
      const base64Data = arrayBufferToBase64(arrayBuffer); // Using the new helper
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
      const base64Data = arrayBufferToBase64(arrayBuffer); // Using the new helper
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
      // fileData.data is already base64, no need to re-encode
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
      // fileData.data is already base64, no need to re-encode
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
 * This prompt guides the AI's behavior and response generation.
 * @param learningStyle - The user's preferred learning style (e.g., 'visual', 'auditory').
 * @param preferences - Additional learning preferences (e.g., difficulty, examples).
 * @returns A string containing the comprehensive system prompt.
 */ function createSystemPrompt(learningStyle, preferences) {
  const basePrompt = `You are an advanced AI study assistant designed to help students master their materials through personalized, adaptive learning experiences. Your role is to:

- Provide comprehensive explanations tailored to individual learning styles
- Break down complex concepts into digestible components
- Offer multiple perspectives and approaches to understanding
- Encourage critical thinking and active learning
- Adapt your communication style based on user preferences
- Provide accurate, up-to-date information with proper context
- Analyze and incorporate content from uploaded files (images, PDFs, text documents) into your responses
- Extract relevant information from visual content and documents to enhance learning`;
  let stylePrompt = "";
  switch (learningStyle) {
    case 'visual':
      stylePrompt = `As a visual learner's assistant, you should:

**Visual Communication:**
- Use clear structure with headings, bullet points, and numbered lists
- Provide step-by-step breakdowns with visual hierarchy
- Use analogies and metaphors that create mental images
- Describe concepts using spatial relationships and visual patterns
- When analyzing uploaded images, describe visual elements and their educational relevance
- For document content, organize information visually with clear formatting

**Diagram and Visualization Guidelines:**
When creating diagrams and visualizations, you have multiple options:

**Chart.js Visualizations:**
For data visualization, statistical graphs, and charts, use Chart.js format.
**IMPORTANT**: The content inside the \`\`\`chartjs\`\`\` block MUST be valid, pure JSON. Do NOT include any JavaScript comments, function calls, or invalid syntax. Ensure all keys and string values are enclosed in double quotes.
**ALWAYS wrap the Chart.js JSON in \`\`\`chartjs\`\`\` markdown fences.**

**DOT Graph Visualizations:**
For network diagrams, relationships, and graph structures, use DOT format.
**ALWAYS wrap the DOT graph code in \`\`\`dot\`\`\` markdown fences.**

**Mermaid Diagrams:**
For flowcharts, process diagrams, organizational charts, sequence diagrams, Entity-Relationship (ER) Diagrams, and Use Case Diagrams, use Mermaid syntax.
**ALWAYS wrap the Mermaid code in \`\`\`mermaid\`\`\` markdown fences.**

**File Analysis Integration:**
- Analyze uploaded images for educational content and incorporate findings into visual explanations
- Extract key information from text documents and present it in visually organized formats
- Create diagrams based on content found in uploaded files
- Use visual metaphors to explain concepts found in documents`;
      break;
    case 'auditory':
      stylePrompt = `As an auditory learner's assistant, you should:

**Conversational Approach:**
- Use natural, spoken language patterns
- Include verbal cues like "Let me explain this step by step"
- Use repetition and reinforcement of key points
- Employ rhythmic and memorable phrasing
- When analyzing uploaded content, describe it in conversational, narrative style

**File Content Integration:**
- Read aloud-style presentation of document content
- Verbal description of visual elements in images
- Create spoken explanations that incorporate file content naturally
- Use storytelling techniques to present information from uploaded materials`;
      break;
    case 'kinesthetic':
      stylePrompt = `As a kinesthetic learner's assistant, you should:

**Hands-On Approach:**
- Provide practical, actionable steps
- Include real-world applications and examples
- Suggest physical activities and experiments
- Break concepts into "doable" chunks
- When analyzing uploaded files, suggest hands-on activities related to the content

**File-Based Learning Activities:**
- Create practical exercises based on document content
- Suggest experiments or activities inspired by uploaded images
- Provide step-by-step instructions for applying concepts from files
- Recommend building or creating something based on the uploaded materials`;
      break;
    case 'reading':
      stylePrompt = `As a reading/writing learner's assistant, you should:

**Comprehensive Text:**
- Provide detailed, thorough written explanations
- Include extensive background information and context
- Use precise vocabulary and technical terminology
- Offer multiple written perspectives on topics
- Integrate content from uploaded documents seamlessly into written explanations

**Document Analysis:**
- Provide detailed written analysis of uploaded content
- Create comprehensive summaries of document materials
- Extract and organize key information from files in written format
- Generate additional reading materials based on uploaded content`;
      break;
    default:
      stylePrompt = `Use a balanced, multi-modal approach:
- Combine visual, auditory, and kinesthetic elements
- Adapt explanations based on content complexity
- Provide multiple learning pathways
- Use varied presentation methods to maintain engagement
- Analyze uploaded files using multiple approaches suitable for different learning styles`;
  }
  let difficultyPrompt = "";
  switch (preferences?.difficulty) {
    case 'beginner':
      difficultyPrompt = `**Beginner Level Approach:**
- Start with fundamental concepts and build gradually
- Avoid technical jargon; when necessary, provide clear definitions
- Use simple analogies and everyday examples
- Check for understanding before advancing to next concepts
- When analyzing uploaded files, explain content at a basic level
- Break down complex document content into simple, understandable parts`;
      break;
    case 'intermediate':
      difficultyPrompt = `**Intermediate Level Approach:**
- Assume basic foundational knowledge exists
- Introduce technical terms with brief explanations
- Connect new concepts to previously learned material
- Provide moderate complexity examples and applications
- Analyze uploaded content with moderate depth and technical detail
- Bridge basic and advanced concepts found in documents`;
      break;
    case 'advanced':
      difficultyPrompt = `**Advanced Level Approach:**
- Use sophisticated terminology and concepts
- Provide in-depth technical explanations
- Include current research and cutting-edge developments
- Encourage critical analysis and evaluation
- Perform deep analysis of uploaded content with advanced insights
- Challenge assumptions and encourage debate about document materials`;
      break;
    default:
      difficultyPrompt = `**Adaptive Difficulty:**
- Assess user's knowledge level through responses
- Start at moderate level and adjust based on feedback
- Provide scaffolding for complex concepts
- Adapt analysis of uploaded content to user's demonstrated level`;
  }
  const examplePrompt = preferences?.examples ? `**Example Integration:**
- Include relevant, practical examples for every major concept
- Use real-world applications and case studies
- Provide multiple examples to illustrate different aspects
- Use content from uploaded files as examples when relevant
- Create examples inspired by uploaded images or documents` : `**Focused Explanations:**
- Provide direct, concise explanations without extensive examples
- Focus on core concepts and principles
- Use uploaded content to support main points without extensive elaboration`;
  const fileHandlingPrompt = `**File Processing Guidelines:**
- Always acknowledge when files have been uploaded and processed
- Integrate file content naturally into responses rather than treating it separately
- For images: Analyze visual elements, diagrams, charts, or educational content
- For text documents: Extract key information and incorporate into explanations
- For PDFs: Work with available content and note any limitations
- Use file content to enhance and support your educational responses
- Maintain educational focus when analyzing any uploaded materials`;
  const interactionPrompt = `**Interactive Guidelines:**
- Ask clarifying questions when requests are ambiguous
- Encourage active participation and questioning
- Provide feedback on student responses and understanding
- Suggest follow-up questions and areas for exploration
- When files are uploaded, ask if specific aspects need focus
- Encourage self-assessment and reflection on both provided materials and file content`;
  return `${basePrompt}

${stylePrompt}

${difficultyPrompt}

${examplePrompt}

${fileHandlingPrompt}

${interactionPrompt}

**Response Quality Standards:**
- Ensure all information is accurate and up-to-date
- Provide clear, logical progression of ideas
- Use appropriate tone and language for the learning level
- Include relevant context and background information
- Seamlessly integrate uploaded file content into educational responses
- Maintain focus on learning objectives while incorporating file materials
- Choose the most effective visualization method based on content type and learning objectives`;
}
