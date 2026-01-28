// Supabase Edge Function for low-latency partial transcription (realtime captions)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { file_url, inline_base64, mime_type } = body

    // Debug: incoming payload summary
    try {
      const preview = { file_url: !!file_url, has_inline: !!inline_base64, mime_type }
      console.log('realtime-transcribe received payload:', JSON.stringify(preview))
    } catch (e) { }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    let audioBase64: string | null = null

    if (inline_base64) {
      let cleaned = inline_base64

      // Remove common data URL and mime prefixes (robust handling for many recorder outputs)
      const patterns = [
        /^data:[^,]*,/,           // data:type,
        /^[^;]+;base64,/,         // type;base64,
        /^[^,]*;codecs=[^,]*,/,   // type;codecs=list,
        /^opus;base64,/,          // specific case
        /^video\/webm;codecs=[^,]*,/, // video/webm;codecs=...
      ]

      for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, '')
      }

      // Fallback: strip everything up to the last comma (if present)
      const lastCommaIndex = cleaned.lastIndexOf(',')
      if (lastCommaIndex !== -1) cleaned = cleaned.slice(lastCommaIndex + 1)

      // Remove any non-base64 prefix characters
      cleaned = cleaned.replace(/^[^A-Za-z0-9+/=]+/, '')

      // Estimate decoded size and reject overly large inputs to avoid edge OOM
      const estimatedBytes = Math.round(cleaned.length * 0.75)
      const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
      if (estimatedBytes > MAX_SIZE_BYTES) {
        throw new Error(`Audio too large (${Math.round(estimatedBytes / 1024 / 1024)}MB). Maximum size is ${Math.round(MAX_SIZE_BYTES / 1024 / 1024)}MB.`)
      }

      audioBase64 = cleaned
      console.log('realtime-transcribe: cleaned inline_base64 length=', (audioBase64 || '').length)
    } else if (file_url) {
      console.log('realtime-transcribe: fetching file_url', file_url)
      console.log('realtime-transcribe: downloading from URL')

      // Basic URL validation
      if (!file_url.startsWith('http')) {
        throw new Error('Invalid file URL')
      }

      const audioResp = await fetch(file_url, { headers: { 'Accept': 'audio/*,video/*,*/*' } })
      if (!audioResp.ok) {
        const errTxt = await audioResp.text().catch(() => '')
        console.error('Download failed:', audioResp.status, errTxt.substring ? errTxt.substring(0, 200) : errTxt)
        if (audioResp.status === 404) throw new Error('Audio file not found')
        if (audioResp.status === 403) throw new Error('Access denied to audio file')
        throw new Error(`Failed to fetch audio: ${audioResp.status} ${audioResp.statusText}`)
      }

      const contentType = audioResp.headers.get('content-type') || ''
      const audioBlob = await audioResp.blob()
      console.log('realtime-transcribe: fetched blob type=', contentType, 'size=', (audioBlob as any).size)

      const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
      if ((audioBlob as any).size > MAX_SIZE_BYTES) {
        throw new Error(`Audio file too large (${Math.round(((audioBlob as any).size / 1024 / 1024) * 100) / 100}MB). Max is ${Math.round(MAX_SIZE_BYTES / 1024 / 1024)}MB.`)
      }

      const arrayBuffer = await audioBlob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const chunkSize = 8192
      const parts: string[] = []
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize)
        parts.push(String.fromCharCode(...chunk))
      }
      const binary = parts.join('')
      audioBase64 = btoa(binary)
    } else {
      throw new Error('file_url or inline_base64 is required')
    }

    // Construct a minimal request to Gemini to transcribe a short audio chunk.
    // We expect small chunks (<= ~10s) for low latency. The function returns a short partial transcript.
    const model = 'gemini-2.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

    const promptText = `Transcribe the provided short audio chunk. Return ONLY the raw transcript text (no extra commentary). Keep it concise. If the audio is unintelligible or you cannot confidently transcribe, return an empty string (not an apology or explanation).`

    // Normalize mime_type to remove codec parameters before sending to Gemini
    const normalizedMime = (mime_type || 'audio/webm').split(';')[0].trim()
    // If the client provided a video mime for an audio-only transcription path,
    // coerce to an audio mime to avoid Gemini rejecting video content for audio tasks.
    const finalMime = normalizedMime.includes('video') ? 'audio/webm' : normalizedMime

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

    // Debug: log request summary (don't print full base64)
    try {
      console.log('realtime-transcribe: sending to Gemini model=', model, 'mime=', mime_type || 'audio/webm', 'base64_len=', (audioBase64 || '').length)
    } catch (e) { }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error('Gemini error:', resp.status, txt)
      throw new Error(`Gemini responded with ${resp.status}`)
    }

    const data = await resp.json()
    try {
      console.log('realtime-transcribe: Gemini raw response candidates=', JSON.stringify((data?.candidates || []).slice(0,2)))
    } catch (e) { }
    let partial = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Filter out common uncertain responses from the model — prefer empty string instead
    try {
      const lowered = (partial || '').toLowerCase();
      if (/(i\'?m not sure|i am not sure|not sure what you said|unable to transcribe|i can'?t hear|i can'?t understand)/.test(lowered)) {
        partial = '';
      }
    } catch (e) { }

    console.log('realtime-transcribe: final partial=', (partial || '').trim())
    return new Response(JSON.stringify({ success: true, partial: (partial || '').trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error in realtime-transcribe:', err)
    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
