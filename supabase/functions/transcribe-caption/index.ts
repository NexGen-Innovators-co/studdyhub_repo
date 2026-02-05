// Supabase Edge Function for simple caption transcription (handling JSON + Base64)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Use a fast model for realtime captions
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

    const promptText = `Transcribe the provided short audio chunk. Return ONLY the raw transcript text (no extra commentary). Keep it concise. If the audio is unintelligible or you cannot confidently transcribe, return an empty string.`;

    // Ensure we use a compatible mime type for Gemini
    const finalMime = mimeType.includes('video') ? 'audio/webm' : mimeType

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

    console.log(`[transcribe-caption] Sending to Gemini model: ${model}, mime: ${finalMime}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!resp.ok) {
       const txt = await resp.text()
       console.error('[transcribe-caption] Gemini error:', txt)
       throw new Error(`Gemini responded with ${resp.status}: ${txt}`)
    }

    const data = await resp.json()
    console.log('[transcribe-caption] Gemini success. Candidates:', data?.candidates?.length);
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log('[transcribe-caption] Raw text:', text);

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
    console.error('Error in transcribe-caption:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
