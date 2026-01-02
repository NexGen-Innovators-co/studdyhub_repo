// Supabase Edge Function for podcast transcription
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_url, title, duration } = await req.json()

    if (!file_url) {
      throw new Error('file_url is required')
    }

    // Initialize Gemini API
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Download audio file
    const audioResponse = await fetch(file_url)
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`)
    }

    const audioBlob = await audioResponse.blob()
    const audioBuffer = await audioBlob.arrayBuffer()
    
    // Convert to base64 efficiently for large files
    const uint8Array = new Uint8Array(audioBuffer)
    let binaryString = ''
    const chunkSize = 8192
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize)
      binaryString += String.fromCharCode(...chunk)
    }
    
    const audioBase64 = btoa(binaryString)

    // Transcribe with Gemini
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Transcribe this podcast audio recording. Provide:
1. Complete transcript with speaker labels
2. Brief summary (2-3 sentences)
3. Key topics discussed

Format the transcript clearly with timestamps if possible.`
              },
              {
                inline_data: {
                  mime_type: 'audio/webm',
                  data: audioBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8000
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      throw new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`)
    }

    const geminiData = await geminiResponse.json()
    const transcript = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!transcript) {
      console.error('No transcript in response:', geminiData)
      throw new Error('No transcript received from Gemini')
    }

    // Extract summary from transcript (first paragraph usually)
    const lines = transcript.split('\n').filter(line => line.trim())
    const summaryLine = lines.find(line => 
      line.toLowerCase().includes('summary') || 
      line.toLowerCase().includes('overview')
    )
    
    let summary = 'Live podcast recording'
    if (summaryLine) {
      const summaryIndex = lines.indexOf(summaryLine)
      const nextLine = lines[summaryIndex + 1]?.trim()
      if (nextLine && nextLine.length > 10) {
        summary = nextLine
      }
    } else {
      // Use first substantial paragraph as summary
      const firstParagraph = lines.find(line => line.length > 50)
      if (firstParagraph) {
        summary = firstParagraph.substring(0, 200) + (firstParagraph.length > 200 ? '...' : '')
      }
    }

    const result = {
      success: true,
      transcript,
      summary,
      duration: duration || 0
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in podcast-transcribe:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
