import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { text, style } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ rewritten: '' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ rewritten: text }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const stylePrompt = style === 'social'
      ? "Rewrite this student community post to make it highly engaging, polite, and grammatically perfect, keeping it concise and social."
      : "Rewrite the following text to improve clarity, grammar, and flow while preserving the original meaning.";
    const prompt = `${stylePrompt}\n\n${text.substring(0, 4000)}`;
    const systemInstruction = "You are a professional text editor. Rewrite content to be clear, engaging, and well-written. Output ONLY the rewritten text — no meta comments.";
    const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    let rewritten = text;
    for (const model of models) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
          const r = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (r && r.length > 10) { rewritten = r; break; }
        }
        if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 500));
      } catch (_) {}
    }
    return new Response(JSON.stringify({ rewritten }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
