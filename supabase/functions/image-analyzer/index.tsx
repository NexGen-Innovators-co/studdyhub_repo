// supabase/functions/image-analyzer/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.24.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Helper function to convert ArrayBuffer to Base64 string in chunks
// This avoids "Maximum call stack size exceeded" for large files
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const { documentId, fileUrl, userId } = await req.json();

    if (!documentId || !fileUrl || !userId) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: documentId, fileUrl, or userId'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase URL or Service Role Key not configured');
    }

    const supabaseServiceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash'
    });

    const imageResponse = await fetch(fileUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageMimeType = imageBlob.type;

    // Validate MIME type
    if (!imageMimeType.startsWith('image/')) {
      throw new Error(`Invalid file type: ${imageMimeType}. Only image files are supported.`);
    }

    const arrayBuffer = await imageBlob.arrayBuffer();
    // Use the custom arrayBufferToBase64 helper function
    const imageDataBase64 = arrayBufferToBase64(arrayBuffer);

    const imagePart = {
      inlineData: {
        mimeType: imageMimeType,
        data: imageDataBase64
      }
    };

    // UPDATED PROMPT: Focus only on extraction, not analysis or note generation
    const prompt = `Describe the visual content of this image and transcribe any text present within it.
If the image contains a diagram or chart, identify its type (e.g., "flowchart", "bar chart", "graph") and briefly describe its main visual components.
Do NOT interpret the meaning, provide educational context, highlight key concepts, or generate study notes. Your output should be a factual description of the image's raw content.`;

    const result = await model.generateContent([
      { text: prompt },
      imagePart
    ]);

    const response = result.response;
    let imageDescription = response.text();

    if (!imageDescription || imageDescription.trim().length === 0) {
      throw new Error('Empty response from Gemini API');
    }

    // Clean the description - remove non-printable characters but preserve formatting
    imageDescription = imageDescription.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters but keep \n, \r, \t
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n') // Convert remaining \r to \n
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to max 2
      .trim();

    const { data, error } = await supabaseServiceRoleClient.from('documents').update({
      content_extracted: imageDescription,
      processing_status: 'completed',
      processing_error: null,
      updated_at: new Date().toISOString()
    }).eq('id', documentId).eq('user_id', userId).select().single();

    if (error) {
      console.error('Error updating document with image description:', error);
      await supabaseServiceRoleClient.from('documents').update({
        processing_status: 'failed',
        processing_error: error.message,
        updated_at: new Date().toISOString()
      }).eq('id', documentId).eq('user_id', userId);
      throw new Error(`Failed to save image description: ${error.message}`);
    }

    return new Response(JSON.stringify({
      status: 'success',
      document: data,
      description: imageDescription,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in image-analyzer function:', error);
    let errorResponse = {
      error: error.message || 'Internal Server Error',
      timestamp: new Date().toISOString()
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
