// Supabase Edge Function for simple caption transcription (handling JSON + Base64)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Model fallback chain for quota/rate-limit resilience
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
  'gemini-3-pro-preview',
];

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    console.log(`[transcribe-caption] Received request. Content-Type: ${contentType}`);

    let audioBase64 = '';
    let mimeType = 'audio/webm';

    // Handle JSON body
    // Note: Deno/Supabase sometimes doesn't preserve exact content-types if using client.invoke w/ defaults
    // But checking for includes application/json is standard.
    if (contentType.includes('application/json')) {
        const body = await req.json();
        if (!body.audio_base64) {
             throw new Error('Missing audio_base64 in body');
        }
        audioBase64 = body.audio_base64;
        mimeType = body.mime_type || 'audio/webm';
        console.log(`[transcribe-caption] Body parsed. Audio length: ${audioBase64.length}, Mime: ${mimeType}`);
    } else {
        // Fallback for FormData if still sent, though client should be updated
        // Or strict error
        console.error(`[transcribe-caption] Invalid Content-Type: ${contentType}`);
        throw new Error(`Content-Type must be application/json. Got: ${contentType}`);
    }

    // Gemini API setup
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const promptText = `Transcribe the provided short audio chunk. Return ONLY the raw transcript text (no extra commentary). Keep it concise. If the audio is unintelligible or you cannot confidently transcribe, return an empty string.`;

    // Ensure we use a compatible mime type for Gemini
    const finalMime = mimeType.includes('video') ? 'audio/webm' : mimeType

    // Use a fast model for realtime captions — with model chain fallback
    const requestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            { inline_data: { mime_type: finalMime, data: audioBase64 } }
          ]
        }
      ],
      generationConfig: { temperature: 0.0, maxOutputTokens: 256 }
    }

    let text = '';
    let usedModel = '';

    for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
      const model = MODEL_CHAIN[attempt];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`[transcribe-caption] Attempt ${attempt + 1}/${MODEL_CHAIN.length} using model: ${model}, mime: ${finalMime}`);

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (resp.status === 429 || resp.status === 503) {
          console.warn(`[transcribe-caption] ${resp.status} from ${model}, switching to next model...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        if (!resp.ok) {
          const txt = await resp.text();
          console.error(`[transcribe-caption] Gemini error ${resp.status} from ${model}:`, txt.substring(0, 200));
          continue;
        }

        const data = await resp.json();
        console.log('[transcribe-caption] Gemini success. Candidates:', data?.candidates?.length);
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        usedModel = model;
        break;
      } catch (err) {
        console.error(`[transcribe-caption] Network error with ${model}:`, err);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!usedModel) {
      throw new Error('All Gemini models failed — quota or service issue');
    }

    console.log(`[transcribe-caption] Raw text (model: ${usedModel}):`, text);

    // Filter out hallucinations or refusals
    try {
      const lowered = (text || '').toLowerCase();
      if (/(i\'?m not sure|i am not sure|not sure what you said|unable to transcribe|i can'?t hear|i can'?t understand)/.test(lowered)) {
        text = '';
      }
    } catch (e) { }

    return new Response(JSON.stringify({ text: text.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'transcribe-caption',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[transcribe-caption] Error logging failed:', _logErr); }
    console.error('Error in transcribe-caption:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
