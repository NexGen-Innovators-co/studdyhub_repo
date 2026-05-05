import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';
import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, conversationHistory = [], platformData } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the system context with platform data
    const systemInstruction = `You are StuddyHub's AI Admin Assistant — an expert analyst helping administrators understand and improve their educational platform.

TODAY: ${new Date().toISOString().split('T')[0]}

${platformData ? `REAL-TIME PLATFORM DATA:
${platformData}` : 'No platform data available — answer based on general knowledge.'}

RESPONSE GUIDELINES:
- Be concise, specific, and data-driven
- Use markdown: headers (##), bullet points, **bold** for key metrics, tables where helpful
- Always reference specific numbers from the provided data
- Flag urgent issues with ⚠️ and positive trends with ✅
- End with 2-3 specific, actionable recommendations
- Be honest about limitations — if data is insufficient, say so
- For reports, use a structured professional format`;

    // Build conversation contents
    const contents: any[] = [];

    // Add conversation history
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Add the current message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Model chain for reliability
    const MODEL_CHAIN = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-pro',
    ];

    let lastError = '';
    for (const model of MODEL_CHAIN) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
              topP: 0.95,
            },
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return new Response(JSON.stringify({ response: text, model }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const errText = await resp.text();
        lastError = `${model}: ${resp.status} - ${errText.substring(0, 200)}`;
        if (resp.status === 429 || resp.status === 503) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err) {
        lastError = `${model}: ${String(err)}`;
      }
    }

    // OpenRouter fallback
    const orResult = await callOpenRouterFallback(contents, { source: 'admin-ai-insights', systemPrompt: systemInstruction });
    if (orResult.success && orResult.content) {
      return new Response(JSON.stringify({ response: orResult.content, model: 'openrouter/free' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      error: 'All AI models failed (Gemini + OpenRouter). Please try again.',
      details: lastError,
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'admin-ai-insights',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[admin-ai-insights] Error logging failed:', _logErr); }
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
