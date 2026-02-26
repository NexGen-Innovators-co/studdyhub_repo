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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      console.error("[CloudTTS] GEMINI_API_KEY environment variable is not set");
      // Log critical config error so admin sees it in the dashboard
      const _cfgClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_cfgClient, {
        severity: 'critical',
        source: 'cloud-tts',
        error_code: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY environment variable is not set — Cloud TTS is non-functional',
        details: { hint: 'Set GEMINI_API_KEY in Supabase Edge Function secrets (must have Cloud TTS API enabled on GCP)' },
      });
      throw new Error("TTS service is not configured - missing API key");
    }

    let body: TtsRequest;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[CloudTTS] JSON parse error:", e);
      throw new Error("Invalid request body - expected JSON");
    }

    const { text, voice = 'female', rate = 1.0, pitch = 0 } = body as TtsRequest;

    if (!text || text.trim().length === 0) {
      throw new Error("Text is required");
    }

    console.log(`[CloudTTS] Generating audio for ${text.length} characters, voice: ${voice}`);

    // Map voice to Google TTS voice name. Accept explicit voice names (e.g. en-US-Neural2-D)
    let voiceName: string;
    if (typeof voice === 'string' && /^en-[a-zA-Z-0-9]+/.test(voice)) {
      voiceName = voice;
    } else {
      voiceName = (voice === 'male') ? 'en-US-Neural2-D' : 'en-US-Neural2-C';
    }

    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${geminiApiKey}`;
    console.log(`[CloudTTS] Calling TTS API with voice: ${voiceName}, rate: ${rate}, pitch: ${pitch}`);

    const ttsResponse = await fetch(
      ttsUrl,
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
      console.error(`[CloudTTS] TTS API error: status=${ttsResponse.status}`, errorText);

      // Determine error code for admin visibility
      let errorCode = 'TTS_API_ERROR';
      if (ttsResponse.status === 403) errorCode = 'TTS_API_FORBIDDEN';
      else if (ttsResponse.status === 429) errorCode = 'TTS_QUOTA_EXCEEDED';
      else if (ttsResponse.status === 401) errorCode = 'TTS_AUTH_FAILED';

      const _errClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_errClient, {
        severity: ttsResponse.status === 429 ? 'warning' : 'error',
        source: 'cloud-tts',
        component: 'google-tts-api',
        error_code: errorCode,
        message: `Google TTS API returned ${ttsResponse.status}: ${errorText.substring(0, 500)}`,
        details: {
          status: ttsResponse.status,
          voice: voiceName,
          text_length: text.length,
          response_body: errorText.substring(0, 1000),
        },
      });

      throw new Error(`TTS API failed (${ttsResponse.status}): ${errorText}`);
    }

    const ttsData = await ttsResponse.json();

    if (!ttsData.audioContent) {
      console.error("[CloudTTS] No audioContent in response:", JSON.stringify(ttsData).substring(0, 500));
      throw new Error("TTS response missing audioContent");
    }

    console.log(`[CloudTTS] Audio generated successfully, size: ${ttsData.audioContent.length}`);

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
    console.error("[CloudTTS] Error:", error?.message || error);
    // ── Log to system_error_logs for admin visibility ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'cloud-tts',
        error_code: 'TTS_RUNTIME_ERROR',
        message: error?.message || String(error),
        details: {
          stack: error?.stack,
          name: error?.name,
        },
      });
    } catch (_logErr) { console.error('[cloud-tts] Error logging failed:', _logErr); }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

