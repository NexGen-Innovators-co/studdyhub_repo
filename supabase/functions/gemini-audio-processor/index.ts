import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

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

const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
  'gemini-3-pro-preview'
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

      if (resp.ok) return await resp.json();
      const txt = await resp.text();
      // console.warn(`Gemini ${model} returned ${resp.status}: ${txt.substring(0,200)}`);
      if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 1000*(attempt+1)));
    } catch (err) {
      // console.error(`Error calling Gemini ${model}:`, err);
      if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 1000*(attempt+1)));
    }
  }
  throw new Error('All Gemini models failed');
}

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
  // console.log(`[Gemini] File uploaded successfully: ${fileUri}`);
  return fileUri;
}

async function processAudioBackground(recordingId: string, fileUrl: string, targetLanguage: string) {
  try {
    // console.log(`[Background] Starting processing for ${recordingId}`);
    
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

    // Detect MIME type from file URL extension, default to audio/webm for recordings
    const urlPath = fileUrl.split('?')[0].toLowerCase();
    const detectedMime = urlPath.endsWith('.mp3') ? 'audio/mp3'
      : urlPath.endsWith('.mp4') || urlPath.endsWith('.m4a') ? 'audio/mp4'
      : urlPath.endsWith('.ogg') || urlPath.endsWith('.opus') ? 'audio/ogg'
      : urlPath.endsWith('.wav') ? 'audio/wav'
      : 'audio/webm'; // Default for .webm and fallback

    try {
        // Attempt to upload to Gemini File API to avoid memory limits
        const fileUri = await uploadToGemini(fileUrl, detectedMime);
        contentPart = {
            fileData: {
                mimeType: detectedMime,
                fileUri: fileUri
            }
        };
    } catch (uploadError) {
        // console.warn("Gemini File Upload failed, falling back to legacy inline method (risky for memory)", uploadError);
        
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
          { text: `You are a professional lecture transcription assistant. Process this audio recording and return a JSON object with the following structure:

{
  "transcript": "...",
  "summary": "...",
  "duration": 0
}

Transcript guidelines:
- Clean up filler words (um, uh, like, you know, right) and false starts
- Organize into clear paragraphs by topic or speaker change
- If multiple speakers are detected, label them (e.g., "**Lecturer:**", "**Student:**", "**Speaker 1:**")
- Fix grammar and incomplete sentences while preserving the original meaning
- Use proper punctuation and capitalization
- Keep technical terms and proper nouns accurate
- Break long monologues into logical paragraphs

Summary guidelines:
- Provide a structured summary with key points and takeaways
- Use bullet points or numbered lists for main topics covered
- Include any action items, assignments, or important dates mentioned
- Keep it concise but comprehensive (aim for 150-300 words)

The "duration" should be the estimated length of the audio in seconds.` },
          contentPart
        ],
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const result = await callGeminiWithModelChain(transcriptionPayload, GEMINI_API_KEY);
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

    // console.log(`[Background] Completed ${recordingId}`);

  } catch (error: any) {
    // console.error(`[Background] Failed ${recordingId}:`, error);
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
        // console.log(`[Handler] Received background job for ${recording_id}`);
        
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

    // === Synchronous Path (Legacy Support – no recording_id) ===
    if (!file_url) throw new Error("File URL required for sync mode");
    
    // 1. Upload audio to Gemini File API (safer for memory than inline base64)
    const syncUrlPath = file_url.split('?')[0].toLowerCase();
    const syncMime = syncUrlPath.endsWith('.mp3') ? 'audio/mp3'
      : syncUrlPath.endsWith('.mp4') || syncUrlPath.endsWith('.m4a') ? 'audio/mp4'
      : syncUrlPath.endsWith('.ogg') || syncUrlPath.endsWith('.opus') ? 'audio/ogg'
      : syncUrlPath.endsWith('.wav') ? 'audio/wav'
      : 'audio/webm';

    let syncContentPart: any;
    try {
      const fileUri = await uploadToGemini(file_url, syncMime);
      syncContentPart = { fileData: { mimeType: syncMime, fileUri } };
    } catch {
      // Fallback: inline base64
      const audioResponse = await fetch(file_url);
      if (!audioResponse.ok) throw new Error(`Failed to fetch audio file: ${audioResponse.statusText}`);
      const audioBlob = await audioResponse.blob();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
          else reject(new Error('FileReader did not return a string result.'));
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      syncContentPart = { inlineData: { mimeType: audioBlob.type || syncMime, data: base64Audio } };
    }

    // 2. Transcribe Audio using Gemini model chain
    const transcriptionPayload = {
      contents: [{ role: 'user', parts: [
        { text: `You are a professional lecture transcription assistant. Transcribe this audio recording with the following guidelines:

- Clean up filler words (um, uh, like, you know, right) and false starts
- Organize into clear paragraphs by topic or speaker change  
- If multiple speakers are detected, label them (e.g., "Lecturer:", "Student:", "Speaker 1:")
- Fix grammar and incomplete sentences while preserving the original meaning
- Use proper punctuation and capitalization
- Keep technical terms and proper nouns accurate
- Break long monologues into logical paragraphs` },
        syncContentPart
      ]}],
    };
    const transcriptionResult = await callGeminiWithModelChain(transcriptionPayload, GEMINI_API_KEY);
    const transcript = transcriptionResult?.candidates?.[0]?.content?.parts?.[0]?.text || 'No transcription available.';

    // 3. Generate Summary from Transcript
    const summaryPayload = {
      contents: [{ role: 'user', parts: [
        { text: `Create a structured, comprehensive summary of the following lecture transcript. Include:

1. **Overview** - Brief description of the topic covered
2. **Key Points** - Main topics and concepts discussed (use bullet points)
3. **Important Details** - Technical terms, definitions, examples mentioned
4. **Action Items** - Any assignments, deadlines, or tasks mentioned
5. **Takeaways** - Key conclusions and lessons

Keep it concise but comprehensive (150-300 words).\n\nTranscript:\n${transcript}` }
      ]}],
    };
    const summaryResult = await callGeminiWithModelChain(summaryPayload, GEMINI_API_KEY);
    const summary = summaryResult?.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary available.';

    // 3.5. Estimate audio duration from transcript
    let estimatedDuration = 0;
    if (transcript && transcript !== 'No transcription available.') {
      const wordCount = transcript.split(/\s+/).filter((word: string) => word.length > 0).length;
      const estimatedMinutes = wordCount / 150;
      estimatedDuration = Math.floor(estimatedMinutes * 60);
    }

    // 4. Translate Transcript (if target_language is not English)
    let translatedContent = null;
    if (target_language && target_language.toLowerCase() !== 'en') {
      try {
        const translationPayload = {
          contents: [{ role: 'user', parts: [
            { text: `Translate the following text to ${target_language}:\n\n${transcript}` }
          ]}],
        };
        const translationResult = await callGeminiWithModelChain(translationPayload, GEMINI_API_KEY);
        translatedContent = translationResult?.candidates?.[0]?.content?.parts?.[0]?.text || 'No translation available.';
      } catch {
        // Translation failed, proceed without it
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
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'gemini-audio-processor',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[gemini-audio-processor] Error logging failed:', _logErr); }
    //console.error('Error processing audio:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unknown error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

