import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { content, diagramType } = await req.json();
    if (!content) {
      return new Response(JSON.stringify({ diagram: '' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ diagram: '' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const systemInstructions: Record<string, string> = {
      mermaid: "Create a clear Mermaid flowchart diagram. Output ONLY raw ```mermaid graph TD ... ```.",
      chartjs_bar: "Create a Chart.js Bar Chart configuration. Return JSON with keys: title, labels, datasetLabel, data, backgroundColor.",
      chartjs_pie: "Create a Chart.js Pie Chart configuration. Return JSON with keys: title, labels, datasetLabel, data, backgroundColor.",
      dot_graph: "Create a Graphviz DOT digraph. Output ONLY raw ```dot digraph G { ... } ```.",
    };
    const systemInstruction = systemInstructions[diagramType] || systemInstructions.mermaid;
    const prompt = `${systemInstruction}\n\nContent to visualize:\n${content.substring(0, 6000)}`;
    const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    let diagram = '';
    for (const model of models) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
            systemInstruction: { parts: [{ text: systemInstruction }] }
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          const r = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (r && r.length > 10) { diagram = r; break; }
        }
        if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 500));
      } catch (_) {}
    }
    return new Response(JSON.stringify({ diagram }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
