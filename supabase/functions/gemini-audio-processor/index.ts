import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Define the expected request body structure
interface RequestBody {
  file_url: string;
  target_language?: string; // Optional target language for translation
  // Removed user_id and document_id as they are no longer needed for job tracking within the function
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Using service role key for secure operations if needed

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
  },
});

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';


serve(async (req) => {
  // Define CORS headers directly within the function
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { file_url, target_language = 'en' }: RequestBody = await req.json();

    if (!file_url) {
      return new Response(JSON.stringify({ error: 'file_url is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 1. Fetch the audio file
    const audioResponse = await fetch(file_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio file from ${file_url}: ${audioResponse.statusText}`);
    }
    const audioBlob = await audioResponse.blob();

    // Convert Blob to Base64 efficiently for large files
    const base64Audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]); // Get only the base64 part
        } else {
          reject(new Error("FileReader did not return a string result."));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    // 2. Transcribe Audio using Gemini
    const transcriptionPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe the following audio into text." },
            {
              inlineData: {
                mimeType: audioBlob.type,
                data: base64Audio,
              },
            },
          ],
        },
      ],
    };

    const transcriptionResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transcriptionPayload),
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      throw new Error(`Gemini transcription failed: ${transcriptionResponse.status} - ${errorText}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcript = transcriptionResult?.candidates?.[0]?.content?.parts?.[0]?.text || 'No transcription available.';

    // 3. Generate Summary from Transcript
    const summaryPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `Summarize the following text:\n\n${transcript}` },
          ],
        },
      ],
    };

    const summaryResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summaryPayload),
    });

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      throw new Error(`Gemini summary generation failed: ${summaryResponse.status} - ${errorText}`);
    }

    const summaryResult = await summaryResponse.json();
    const summary = summaryResult?.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary available.';

    // 4. Translate Transcript (if target_language is not English)
    let translatedContent = null;
    if (target_language && target_language.toLowerCase() !== 'en') {
      const translationPayload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: `Translate the following text to ${target_language}:\n\n${transcript}` },
            ],
          },
        ],
      };

      const translationResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(translationPayload),
      });

      if (!translationResponse.ok) {
        const errorText = await translationResponse.text();
        console.error(`Gemini translation failed: ${translationResponse.status} - ${errorText}`);
        // Don't throw, just log and proceed without translation
      } else {
        const translationResult = await translationResponse.json();
        translatedContent = translationResult?.candidates?.[0]?.content?.parts?.[0]?.text || 'No translation available.';
      }
    }

    // Return all processed data directly
    return new Response(JSON.stringify({ transcript, summary, translated_content: translatedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) { // Explicitly type error as 'any' for easier access to .message
    console.error('Error processing audio:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unknown error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
