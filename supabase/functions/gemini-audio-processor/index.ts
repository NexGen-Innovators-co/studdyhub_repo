import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Define the expected request body structure
interface RequestBody {
  file_url?: string;
  recording_id?: string; // If provided, uses async background processing
  target_language?: string; 
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
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

async function processAudioBackground(recordingId: string, fileUrl: string, targetLanguage: string) {
  try {
    console.log(`[Background] Starting processing for ${recordingId}`);
    
    // 1. Mark as processing
    await supabase
      .from('class_recordings')
      .update({ processing_status: 'processing' })
      .eq('id', recordingId);

    // 2. Fetch Audio
    const audioResponse = await fetch(fileUrl);
    if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
    const audioBlob = await audioResponse.blob();

    // 3. Convert to Base64 (Chunking/Streaming needed for very large files, but keeping simple for now)
    // NOTE: For files > 20MB, we should implement Gemini File API Upload
    const base64Audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error("FileReader did not return a string result."));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    // 4. Call Gemini
    const transcriptionPayload = {
      contents: [{
        role: "user",
        parts: [
          { text: "Transcribe the following audio into text. Provide a summary as well in JSON format: { \"transcript\": \"...\", \"summary\": \"...\", \"duration\": 0 }." },
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio,
            },
          },
        ],
      }],
      generationConfig: { responseMimeType: "application/json" }
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

    const result = await transcriptionResponse.json();
    const jsonContent = JSON.parse(result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');

    // 5. Update DB
    const { error: updateError } = await supabase
      .from('class_recordings')
      .update({
        transcript: jsonContent.transcript || '',
        summary: jsonContent.summary || '',
        duration: jsonContent.duration || 0,
        processing_status: 'completed',
        processing_error: null
      })
      .eq('id', recordingId);

    if (updateError) throw updateError;
    console.log(`[Background] Completed ${recordingId}`);

  } catch (error: any) {
    console.error(`[Background] Failed ${recordingId}:`, error);
    await supabase
      .from('class_recordings')
      .update({ 
        processing_status: 'failed',
        processing_error: error.message 
      })
      .eq('id', recordingId);
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { file_url, recording_id, target_language = 'en' }: RequestBody = await req.json();

    if (!file_url && !recording_id) {
       return new Response(JSON.stringify({ error: 'file_url OR recording_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // === NEW: Background Processing Path ===
    if (recording_id && file_url) {
        console.log(`[Handler] Received background job for ${recording_id}`);
        
        // Return 202 Accepted immediately
        const promise = processAudioBackground(recording_id, file_url, target_language);
        if (typeof EdgeRuntime !== 'undefined') {
            EdgeRuntime.waitUntil(promise);
        } else {
             // Fallback for dev: await but warn
             processAudioBackground(recording_id, file_url, target_language); // Fire and forget in local
        }

        return new Response(JSON.stringify({ 
            message: 'Processing started in background', 
            status: 'pending',
            id: recording_id 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 202 
        });
    }

    // === OLD: Synchronous Path (Legacy Support) ===
    if (!file_url) throw new Error("File URL required for sync mode");
    
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

    // 3.5. Estimate audio duration from transcript
    // Average speaking rate is ~150 words per minute
    let estimatedDuration = 0;
    if (transcript && transcript !== 'No transcription available.') {
      const wordCount = transcript.split(/\s+/).filter(word => word.length > 0).length;
      const estimatedMinutes = wordCount / 150;
      estimatedDuration = Math.floor(estimatedMinutes * 60); // Convert to seconds
    }

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
        //console.error(`Gemini translation failed: ${translationResponse.status} - ${errorText}`);
        // Don't throw, just log and proceed without translation
      } else {
        const translationResult = await translationResponse.json();
        translatedContent = translationResult?.candidates?.[0]?.content?.parts?.[0]?.text || 'No translation available.';
      }
    }

    // Return all processed data directly including estimated duration
    return new Response(JSON.stringify({ 
      transcript, 
      summary, 
      translated_content: translatedContent,
      duration: estimatedDuration 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) { // Explicitly type error as 'any' for easier access to .message
    //console.error('Error processing audio:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unknown error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
