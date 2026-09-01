import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Free TTS via SpeechSter (no API key, 580+ voices) ───────────────────────
// https://ahm7xmakki.com/speech  — POST /api/tts returns raw audio/mpeg.
// Replaces the paid Google Cloud TTS API. The web client expects
// { success: true, audioContent: "<base64-mp3>" } so we base64-encode the bytes.
const SPEECHSTER_URL = "https://ahm7xmakki.com/api/tts";
const SPEECHSTER_CHUNK = 1950; // max chars per SpeechSter call
const SPEECHSTER_VOICE_MALE = 1;   // Thomas — Male English
const SPEECHSTER_VOICE_FEMALE = 2; // Default — Female English

function splitTextIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf(". ", maxLen - 1);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf(" ", maxLen - 1);
    if (splitAt <= 0) splitAt = maxLen;
    else splitAt += 1;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt);
  }
  return chunks;
}

async function speechSterTTS(text: string, voiceIndex: number): Promise<string> {
  const chunks = splitTextIntoChunks(text, SPEECHSTER_CHUNK);
  const audioBuffers = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await fetch(SPEECHSTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceIndex, text: chunk }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`SpeechSter TTS failed: HTTP ${res.status} — ${errText.substring(0, 300)}`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    })
  );
  // Concatenate all chunks then base64-encode
  const totalLen = audioBuffers.reduce((sum, b) => sum + b.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const buf of audioBuffers) {
    merged.set(buf, offset);
    offset += buf.length;
  }
  let binary = "";
  for (let i = 0; i < merged.length; i++) {
    binary += String.fromCharCode(merged[i]);
  }
  return btoa(binary);
}

interface TtsRequest {
  text: string;
  voice?: 'male' | 'female' | string;
  rate?: number;
  pitch?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: TtsRequest;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[CloudTTS] JSON parse error:", e);
      throw new Error("Invalid request body - expected JSON");
    }

    const { text, voice = 'female' } = body as TtsRequest;

    if (!text || text.trim().length === 0) {
      throw new Error("Text is required");
    }

    console.log(`[CloudTTS] Generating audio for ${text.length} characters, voice: ${voice}`);

    // Map voice to SpeechSter voice index
    let voiceIndex: number;
    if (typeof voice === 'string' && /^\d+$/.test(voice)) {
      voiceIndex = parseInt(voice, 10);
    } else {
      voiceIndex = (voice === 'male') ? SPEECHSTER_VOICE_MALE : SPEECHSTER_VOICE_FEMALE;
    }

    const audioBase64 = await speechSterTTS(text, voiceIndex);

    if (!audioBase64) {
      throw new Error("TTS response missing audio content");
    }

    console.log(`[CloudTTS] Audio generated successfully, base64 size: ${audioBase64.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        audioContent: audioBase64
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[CloudTTS] Error:", error?.message || error);
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
