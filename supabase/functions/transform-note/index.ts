import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { content, operation, customInstruction } = await req.json();
    if (!content || !operation) {
      return new Response(JSON.stringify({ result: content || '' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ result: content }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const prompts: Record<string, string> = {
      simplify: `Explain the following study note content in simple terms for a beginner, with bullet points:\n\n${content.substring(0, 6000)}`,
      questions: `Generate 5 high-yield active recall review questions with short answers based on this note:\n\n${content.substring(0, 6000)}`,
      fix: `Fix grammar, improve conciseness, and organize the formatting (with Markdown headers) of this note:\n\n${content.substring(0, 6000)}`,
      custom: `Follow this instruction: "${customInstruction || 'Enhance this note'}" on the following note content:\n\n${content.substring(0, 6000)}`,
    };
    const prompt = prompts[operation] || prompts.custom;
    const systemInstruction = "You are StuddyHub's AI Academic Processor. Transform study notes as requested. Output ONLY the transformed content — no meta comments.";
    const models = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
    let result = content;
    for (const model of models) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
            systemInstruction: { parts: [{ text: systemInstruction }] }
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          const r = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (r && r.length > 10) { result = r; break; }
        }
        if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 500));
      } catch (_) {}
    }
    return new Response(JSON.stringify({ result }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
