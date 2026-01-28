import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.92.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { file_url, title, duration, inline_base64, mime_type } = body

    console.log('podcast-transcribe received payload:', { 
      file_url: !!file_url, 
      has_inline: !!inline_base64, 
      mime_type, 
      title 
    })

    if (!file_url && !inline_base64) {
      throw new Error('file_url or inline_base64 is required')
    }

    // ────────────────────────────────────────────────────────────────
    // Initialize Supabase with SERVICE ROLE KEY (bypasses RLS)
    // ────────────────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase credentials not configured in environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    })

    // ────────────────────────────────────────────────────────────────
    // Gemini API Key
    // ────────────────────────────────────────────────────────────────
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const MODEL_CHAIN = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash'
    ]

    async function callGeminiWithModelChain(requestBody: any, apiKey: string, maxAttempts = 3) {
      for (let attempt = 0; attempt < Math.min(maxAttempts, MODEL_CHAIN.length); attempt++) {
        const model = MODEL_CHAIN[attempt]
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })
          if (resp.ok) return await resp.json()
          const txt = await resp.text()
          console.warn(`Gemini ${model} failed (${resp.status}): ${txt.substring(0, 200)}`)
          if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        } catch (err) {
          console.error(`Gemini ${model} network error:`, err)
        }
      }
      throw new Error('All Gemini model attempts failed')
    }

    let audioBase64: string | null = null
    let detectedMime = mime_type || 'audio/webm'

    if (inline_base64) {
      // ────────────────────────────────────────────────────────────────
      // Handle inline base64 (fallback)
      // ────────────────────────────────────────────────────────────────
      let cleaned = inline_base64
      const patterns = [
        /^data:[^,]*,/,
        /^[^;]+;base64,/,
        /^[^,]*;codecs=[^,]*,/,
        /^opus;base64,/
      ]
      for (const pattern of patterns) cleaned = cleaned.replace(pattern, '')

      const lastComma = cleaned.lastIndexOf(',')
      if (lastComma !== -1) cleaned = cleaned.slice(lastComma + 1)

      audioBase64 = cleaned.trim()
      detectedMime = (detectedMime || 'audio/webm').split(';')[0].trim()
      console.log(`Using inline_base64 (length: ${audioBase64.length}, mime: ${detectedMime})`)
    } else {
      // ────────────────────────────────────────────────────────────────
      // Parse Supabase storage path from public URL
      // ────────────────────────────────────────────────────────────────
      console.log('Attempting internal download for:', file_url)
      const urlObj = new URL(file_url)
      const pathPrefix = '/storage/v1/object/public/podcasts/'
      if (!urlObj.pathname.startsWith(pathPrefix)) {
        throw new Error('Invalid file_url - expected Supabase public storage URL')
      }
      const storagePath = urlObj.pathname.slice(pathPrefix.length)

      // ────────────────────────────────────────────────────────────────
      // Download using authenticated service role client
      // ────────────────────────────────────────────────────────────────
      const { data: audioBlob, error: downloadError } = await supabase.storage
        .from('podcasts')
        .download(storagePath)

      if (downloadError) {
        console.error('Internal download failed:', downloadError)
        throw new Error(`Failed to download audio: ${downloadError.message}`)
      }

      if (!audioBlob) {
        throw new Error('No audio data returned from storage')
      }

      detectedMime = audioBlob.type || detectedMime
      console.log(`Internal download succeeded - size: ${audioBlob.size} bytes, type: ${detectedMime}`)

      // Convert Blob → Base64
      const arrayBuffer = await audioBlob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize)
        binary += String.fromCharCode(...chunk)
      }
      audioBase64 = btoa(binary)
    }

    // ────────────────────────────────────────────────────────────────
    // Call Gemini for transcription
    // ────────────────────────────────────────────────────────────────
    const normalizedMime = detectedMime.split(';')[0].trim()
    const finalMime = normalizedMime.includes('video') ? 'audio/webm' : normalizedMime

    const geminiData = await callGeminiWithModelChain({
      contents: [{
        parts: [
          { 
            text: `Transcribe this podcast audio recording. Provide:
1. Complete transcript with speaker labels
2. Brief summary (2-3 sentences)
3. Key topics discussed

Format the transcript clearly with timestamps if possible.` 
          },
          { inline_data: { mime_type: finalMime, data: audioBase64 } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8000 }
    }, GEMINI_API_KEY)

    const transcript = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!transcript) {
      console.error('No transcript returned:', geminiData)
      throw new Error('No transcript received from Gemini')
    }

    // Extract summary (simple heuristic)
    const lines = transcript.split('\n').filter(l => l.trim())
    let summary = 'Live podcast recording'
    const summaryIndex = lines.findIndex(l => l.toLowerCase().includes('summary') || l.toLowerCase().includes('overview'))
    if (summaryIndex !== -1 && lines[summaryIndex + 1]) {
      summary = lines[summaryIndex + 1].trim()
    } else if (lines.length > 0) {
      summary = lines[0].substring(0, 200) + (lines[0].length > 200 ? '...' : '')
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        summary,
        duration: duration || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: any) {
    console.error('Error in podcast-transcribe:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})