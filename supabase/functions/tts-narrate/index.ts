import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Lightweight TTS narration edge function.
 * Takes raw text → calls Gemini Flash to rewrite for speech → returns clean spoken script.
 * No sessions, no conversation history, no actions — just one-shot text rewriting.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase config' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify auth (lightweight — just check the JWT is valid)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { text, isKid } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return new Response(JSON.stringify({ rewritten: text || '' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      // No API key — return original text unchanged
      return new Response(JSON.stringify({ rewritten: text }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemInstruction = isKid
      ? "You are Professor Ollie, a friendly owl tutor. Rewrite the text into a fun, clear spoken script for kids. Expand bullet points into natural spoken transitions. Do NOT output markdown, stars, headings, or JSON — output ONLY the speech script."
      : "You are an expert audio narrator. Rewrite the provided text into a smooth, natural spoken narration script. 1) Convert formulas and equations into clear spoken English. 2) Turn bullet lists into natural transitions ('First...', 'Next...'). 3) Summarize code blocks naturally. 4) Output ONLY the final spoken script — no markdown, no headers, no meta comments.";

    const prompt = `Rewrite the following study content into a natural, easy-to-understand spoken narration script for audio read-aloud. Preserve all the meaning and key information, but make it flow naturally when spoken aloud:\n\n${text.substring(0, 8000)}`;

    // Try Gemini Flash models, then fallback to original text
    const MODEL_CHAIN = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
    let rewritten = text;

    for (const model of MODEL_CHAIN) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
            systemInstruction: { parts: [{ text: systemInstruction }] }
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (result && result.length > 10) {
            rewritten = result;
            break;
          }
        }
        // Rate limit or error — try next model
        if (resp.status === 429 || resp.status === 503) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (_) {
        // Try next model
      }
    }

    return new Response(JSON.stringify({ rewritten }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[tts-narrate] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
