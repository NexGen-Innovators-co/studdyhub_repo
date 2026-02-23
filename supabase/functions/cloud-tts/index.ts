import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TtsRequest {
  text: string;
  // voice can be 'male'|'female' for legacy usage or a specific TTS voice name like 'en-US-Neural2-D'
  voice?: 'male' | 'female' | string;
  rate?: number;
  pitch?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    let body: TtsRequest;
    try {
      body = await req.json();
    } catch (e) {
      // console.error("[CloudTTS] JSON parse error:", e);
      throw new Error("Invalid request body - expected JSON");
    }

    const { text, voice = 'female', rate = 1.0, pitch = 0 } = body as TtsRequest;

    if (!text || text.trim().length === 0) {
      throw new Error("Text is required");
    }

    // console.log(`[CloudTTS] Generating audio for ${text.length} characters, voice: ${voice}`);

    // Map voice to Google TTS voice name. Accept explicit voice names (e.g. en-US-Neural2-D)
    let voiceName: string;
    if (typeof voice === 'string' && /^en-[a-zA-Z-0-9]+/.test(voice)) {
      voiceName = voice;
    } else {
      voiceName = (voice === 'male') ? 'en-US-Neural2-D' : 'en-US-Neural2-C';
    }

    const ttsResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: text },
          voice: {
            languageCode: "en-US",
            name: voiceName,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: rate,
            pitch: pitch,
          }
        })
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      // console.error(`[CloudTTS] TTS API error:`, ttsResponse.status, errorText);
      throw new Error(`TTS API failed: ${ttsResponse.status}`);
    }

    const ttsData = await ttsResponse.json();

    if (!ttsData.audioContent) {
      // console.error("[CloudTTS] No audioContent in response:", JSON.stringify(ttsData));
      throw new Error("TTS response missing audioContent");
    }

    // console.log(`[CloudTTS] Audio generated successfully, size: ${ttsData.audioContent.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        audioContent: ttsData.audioContent
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'cloud-tts',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[cloud-tts] Error logging failed:', _logErr); }
    // console.error("[CloudTTS] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

