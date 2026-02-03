import { createClient } from 'jsr:@supabase/supabase-js@2.44.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSubscriptionValidator, createErrorResponse } from '../utils/subscription-validator.ts';

// Define the expected request body structure
interface RequestBody {
  file_url: string;
  target_language?: string; // Optional target language for translation
  user_id: string; // Added user_id to the request body interface
  document_id?: string; // Added document_id to the request body interface
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
  },
});

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

// Model chain retry helper for reliability across models
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-3-pro-preview',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-pro',
  'gemini-1.5-pro'
];

async function callGeminiWithModelChain(requestBody: any, apiKey: string, maxAttempts = 3): Promise<any> {
  for (let attempt = 0; attempt < Math.min(maxAttempts, MODEL_CHAIN.length); attempt++) {
    const model = MODEL_CHAIN[attempt % MODEL_CHAIN.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (resp.ok) {
        const data = await resp.json();
        return data;
      }

      const text = await resp.text();
      // console.warn(`Gemini ${model} returned ${resp.status}: ${text.substring(0, 200)}`);
      // retry on transient errors
      if (resp.status === 429 || resp.status === 503) {
        await sleep(1000 * (attempt + 1));
        continue;
      } else {
        // For other statuses, try next model once
        continue;
      }
    } catch (err) {
      // console.error(`Network/model error with ${model}:`, err);
      if (attempt < maxAttempts - 1) await sleep(1000 * (attempt + 1));
    }
  }
  throw new Error('All Gemini model attempts failed');
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract audio duration using ffprobe-like approach
async function extractAudioDuration(audioBlob: Blob): Promise<number | null> {
  try {
    // Use Web Audio API to decode and get duration
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Try to extract duration from audio headers
    // For WebM, MP3, M4A formats
    if (audioBlob.type.includes('webm') || audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp4')) {
      // Create a data view to read the audio file
      const view = new DataView(arrayBuffer);
      
      // Simple duration extraction (this is a basic implementation)
      // For production, you'd want more robust parsing
      
      // For now, return null and let it be calculated on client side
      // or use AI to estimate from transcript length
      return null;
    }
    
    return null;
  } catch (error) {
    // console.error('Error extracting audio duration:', error);
    return null;
  }
}

// Process the audio in the background
async function processAudioInBackground(file_url: string, target_language: string = 'en', user_id: string) {
  try {
    // 1. Fetch the audio file
    const audioResponse = await fetch(file_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio file: ${audioResponse.statusText}`);
    }

    // Get audio as blob
    const audioBlob = await audioResponse.blob();

    // Extract audio duration
    const audioDuration = await extractAudioDuration(audioBlob);

    // 2. Convert to base64 more efficiently
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = bufferToBase64(arrayBuffer);

    // 3. Transcribe Audio using Gemini
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

    const transcriptionResult = await callGeminiWithModelChain(transcriptionPayload, GEMINI_API_KEY);
    let transcript = extractTextFromGeminiResponse(transcriptionResult, 'No transcription available.');

    // 5. Generate Summary from Transcript (in parallel with translation if needed)
    const summaryPromise = generateSummary(transcript);

    // 6. Translate Transcript if needed (in parallel with summary)
    const translationPromise = target_language.toLowerCase() !== 'en'
      ? translateContent(transcript, target_language)
      : Promise.resolve(null);

    // Wait for both operations to complete
    const [summary, translatedContent] = await Promise.all([summaryPromise, translationPromise]);

  // Estimate duration from transcript if not available
  // Average speaking rate is ~150 words per minute
  let estimatedDuration = audioDuration;
  if (!estimatedDuration && transcript) {
    const wordCount = transcript.split(/\s+/).length;
    const estimatedMinutes = wordCount / 150;
    estimatedDuration = estimatedMinutes * 60; // Convert to seconds
  }

    // Return all results for the main serve function to update the database
    return { 
      transcript, 
      summary, 
      translated_content: translatedContent, 
      duration: estimatedDuration,
      status: 'completed' 
    };

  } catch (error) {
    // console.error('Background processing error:', error);
    // Return error status for the caller to handle and update the database
    return { transcript: null, summary: null, translated_content: null, status: 'error', error_message: error.message };
  }
}

// Helper function to convert ArrayBuffer to Base64 more efficiently
function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  let binary = '';

  // Process in chunks to avoid stack overflow
  const CHUNK_SIZE = 65536; // 64KB chunks
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk)); // Use Array.from for better compatibility
  }

  return btoa(binary);
}

// Helper function to extract text from Gemini API response
function extractTextFromGeminiResponse(result: any, defaultMessage: string) {
  if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return result.candidates[0].content.parts[0].text;
  }
  // console.error('Unexpected Gemini response structure:', JSON.stringify(result));
  return defaultMessage;
}

// Helper function to generate summary
async function generateSummary(transcript: string) {
  try {
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

    try {
      const summaryResult = await callGeminiWithModelChain(summaryPayload, GEMINI_API_KEY);
      return extractTextFromGeminiResponse(summaryResult, 'No summary available.');
    } catch (err) {
      // console.error('Summary generation error:', err);
      return 'Failed to generate summary due to an error.';
    }
  } catch (error: any) {
    // console.error('Summary generation error:', error);
    return 'Failed to generate summary due to an error.';
  }
}

// Helper function to translate content
async function translateContent(transcript: string, targetLanguage: string) {
  try {
    const translationPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `Translate the following text to ${targetLanguage}:\n\n${transcript}` },
          ],
        },
      ],
    };

    try {
      const translationResult = await callGeminiWithModelChain(translationPayload, GEMINI_API_KEY);
      return extractTextFromGeminiResponse(translationResult, 'No translation available.');
    } catch (err) {
      // console.error('Translation error:', err);
      return 'Failed to translate due to an error.';
    }
  } catch (error: any) {
    // console.error('Translation error:', error);
    return 'Failed to translate due to an error.';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Destructure user_id and document_id from the request body
    const { file_url, target_language = 'en', user_id, document_id }: RequestBody = await req.json();

    if (!file_url || !user_id) { // Ensure user_id is present
      return new Response(JSON.stringify({ error: 'file_url and user_id are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate recordings limit before processing
    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkRecordingsLimit(user_id);
    
    if (!limitCheck.allowed) {
      return createErrorResponse(limitCheck.message || 'Recording limit exceeded', 403);
    }

    // Create an initial record in the database with user_id and document_id
    const { data, error } = await supabase
      .from('audio_processing_results')
      .insert({
        file_url,
        status: 'processing',
        target_language,
        user_id, // Include user_id in the initial insert
        document_id // Include document_id in the initial insert
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create processing record: ${error.message}`);
    }

    const jobId = data.id;

    // Start background processing using EdgeRuntime.waitUntil
    // Pass user_id to the background processing function
    EdgeRuntime.waitUntil(
      (async () => {
        const results = await processAudioInBackground(file_url, target_language, user_id);

        // Update the database with the results from background processing
        if (results.status === 'completed') {
          await supabase
            .from('audio_processing_results')
            .update({
              transcript: results.transcript,
              summary: results.summary,
              translated_content: results.translated_content,
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
        } else {
          await supabase
            .from('audio_processing_results')
            .update({
              status: 'error',
              error_message: results.error_message,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
        }
      })()
    );

    // Return immediately with the job ID
    return new Response(JSON.stringify({
      message: 'Audio processing started',
      job_id: jobId,
      status: 'processing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202, // Accepted
    });

  } catch (error: any) {
    // console.error('Error initiating audio processing:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

