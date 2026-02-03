import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSubscriptionValidator, createErrorResponse, extractUserIdFromAuth } from '../utils/subscription-validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    
    if (!userId) {
      return createErrorResponse('Unauthorized: Please login to generate summaries', 401);
    }

    // Check AI generation limit
    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkAiMessageLimit(userId);
    
    if (!limitCheck.allowed) {
      return createErrorResponse(limitCheck.message || 'AI generation limit exceeded', 403);
    }

    const { content, title, category } = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const MODEL_CHAIN = [
      'gemini-2.5-flash',
      'gemini-3-pro-preview',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-pro',
      'gemini-1.5-pro'
    ];

    async function callGeminiWithModelChain(requestBody: any, apiKey: string, maxAttempts = 3): Promise<any> {
      for (let attempt = 0; attempt < Math.min(maxAttempts, MODEL_CHAIN.length); attempt++) {
        const model = MODEL_CHAIN[attempt % MODEL_CHAIN.length];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (resp.ok) return await resp.json();
          const txt = await resp.text();
          // console.warn(`Gemini ${model} returned ${resp.status}: ${txt.substring(0,200)}`);
          if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 1000*(attempt+1)));
        } catch (err) {
          // console.error(`Error calling Gemini ${model}:`, err);
          if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 1000*(attempt+1)));
        }
      }
      throw new Error('All Gemini models failed');
    }

    const prompt = `Please create a concise, informative summary of the following note content. Focus on key concepts, main points, and important details that would be useful for studying and review.

Title: ${title}
Category: ${category}
Content: ${content}

Please provide a summary that highlights the most important information and learning points.`;

    const data = await callGeminiWithModelChain({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 256 }
    }, geminiApiKey);

    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate summary.';

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // console.error('Error in generate-summary function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
