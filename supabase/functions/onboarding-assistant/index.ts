import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, systemInstruction } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the first available Gemini API key
    const geminiKeys: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const k = Deno.env.get(`GEMINI_API_KEY_${i}`);
      if (k) geminiKeys.push(k);
    }
    const fallback = Deno.env.get("GEMINI_API_KEY");
    if (fallback) geminiKeys.unshift(fallback);

    if (geminiKeys.length === 0) {
      return new Response(JSON.stringify({ error: "No Gemini API key configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = "gemini-2.5-flash";

    // Build Gemini API request
    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    // Try each key
    let lastError = "";
    for (const apiKey of geminiKeys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (text) {
            return new Response(JSON.stringify({ response: text }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          lastError = `${res.status}: ${await res.text()}`;
        }
      } catch (e) {
        lastError = String(e);
      }
    }

    return new Response(JSON.stringify({ error: `All Gemini attempts failed: ${lastError}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
