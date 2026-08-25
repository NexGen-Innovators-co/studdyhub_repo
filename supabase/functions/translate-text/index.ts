import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { text, targetLanguage } = await req.json();
    if (!text || !targetLanguage) {
      return new Response(JSON.stringify({ translated: text || '' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ translated: text }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const prompt = `Translate the following study content into ${targetLanguage} cleanly. Preserve all formatting, bullet points, and structure. Output ONLY the translated text:\n\n${text.substring(0, 8000)}`;
    const systemInstruction = "You are an expert academic translator. Translate study content accurately while preserving formatting and educational meaning. Output ONLY the translated text.";
    const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    let translated = text;
    for (const model of models) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
            systemInstruction: { parts: [{ text: systemInstruction }] }
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (result && result.length > 10) { translated = result; break; }
        }
        if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 500));
      } catch (_) {}
    }
    return new Response(JSON.stringify({ translated }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
