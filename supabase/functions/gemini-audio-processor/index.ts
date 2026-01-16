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

// Helper to upload large files to Gemini via File API
async function uploadToGemini(url: string, mimeType: string): Promise<string> {
  // 1. Fetch file as stream/buffer
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch file for upload: ${response.statusText}`);
  const data = await response.blob(); 
  
  // NOTE: For true streaming without loading into memory, we'd pipe headers, 
  // but Deno 'fetch' + Supabase Storage URLs behave better with Blob in this environment for now.
  // The 'Memory Limit' usually comes from Base64 conversion + JSON stringifying.
  // By uploading raw bytes, we avoid the Base64 overhead (33% larger) and the massive JSON string.

  // 2. Initial Resumable Upload Request (if larger than 5MB usually, but straightforward to just use media upload for now)
  // Using Simple Upload for simplicity in this context (up to 200MB usually fine via this endpoint)
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-Header-Content-Length': data.size.toString(),
      'X-Goog-Upload-File-Name': 'audio_recording', // Optional
      'Content-Type': mimeType,
    },
    body: data 
  });

  if (!uploadResponse.ok) {
    const err = await uploadResponse.text();
    throw new Error(`Gemini File Upload failed: ${err}`);
  }

  const uploadResult = await uploadResponse.json();
  const fileUri = uploadResult.file.uri;
  console.log(`[Gemini] File uploaded successfully: ${fileUri}`);
  return fileUri;
}

async function processAudioBackground(recordingId: string, fileUrl: string, targetLanguage: string) {
  try {
    console.log(`[Background] Starting processing for ${recordingId}`);
    
    // 1. Mark as processing and fetch current duration to preserve it
    const { data: currentRec } = await supabase
      .from('class_recordings')
      .update({ processing_status: 'processing' })
      .eq('id', recordingId)
      .select('duration, document_id') // Fetch document_id too
      .single();

    // 2. Decide Strategy based on file size (optimistic guess) or default to File API for safety
    // Using File API is safer for memory limits on Edge Functions
    let contentPart = {};

    try {
        // Attempt to upload to Gemini File API to avoid memory limits
        const fileUri = await uploadToGemini(fileUrl, 'audio/mp3'); // Defaulting/Detecting mime type is better
        contentPart = {
            fileData: {
                mimeType: 'audio/mp3', // Gemini handles most audio
                fileUri: fileUri
            }
        };
    } catch (uploadError) {
        console.warn("Gemini File Upload failed, falling back to legacy inline method (risky for memory)", uploadError);
        
        // Fallback: Legacy Inline Method
        const audioResponse = await fetch(fileUrl);
        if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
        const audioBlob = await audioResponse.blob();
        
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
        
        contentPart = {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio,
            },
        };
    }

    // 4. Call Gemini
    const transcriptionPayload = {
      contents: [{
        role: "user",
        parts: [
          { text: "Transcribe the following audio into text. Provide a summary as well in JSON format: { \"transcript\": \"...\", \"summary\": \"...\", \"duration\": 0 }. The duration should be the estimated length of the audio in seconds." },
          contentPart
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

    // Calculate final duration logic
    // 1. Start with existing duration from DB (trust frontend calculation if available)
    let finalDuration = currentRec?.duration || 0;
    
    // 2. If no existing duration, try the AI-provided duration
    if (!finalDuration || finalDuration === 0) {
        // Parse AI duration safely (handle "120s" or string numbers)
        const rawAiDuration = jsonContent.duration;
        if (rawAiDuration) {
           const parsed = parseInt(String(rawAiDuration).replace(/[^0-9]/g, ''), 10);
           if (!isNaN(parsed) && parsed > 0) {
               finalDuration = parsed;
           }
        }
    }
    
    // 3. Last resort: Estimate from word count
    if ((!finalDuration || finalDuration === 0) && jsonContent.transcript) {
         // Approx 150 words per minute => 2.5 words per second
         const wordCount = jsonContent.transcript.split(/\s+/).length;
         finalDuration = Math.ceil((wordCount / 150) * 60);
    }

    // 5. Update DB
    const { error: updateError } = await supabase
      .from('class_recordings')
      .update({
        transcript: jsonContent.transcript || '',
        summary: jsonContent.summary || '',
        duration: finalDuration,
        processing_status: 'completed',
        processing_error: null
      })
      .eq('id', recordingId);

    if (updateError) throw updateError;

    // 6. Also update the linked Document if it exists
    if (currentRec?.document_id) {
       await supabase.from('documents').update({
          content_extracted: jsonContent.transcript || '',
          processing_status: 'completed',
          processing_error: null,
          updated_at: new Date().toISOString()
       }).eq('id', currentRec.document_id);
    }

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
