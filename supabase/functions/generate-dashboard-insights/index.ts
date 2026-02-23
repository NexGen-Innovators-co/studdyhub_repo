import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getEducationContext, formatEducationContextForPrompt } from '../_shared/educationContext.ts';
import { logSystemError } from '../_shared/errorLogger.ts';
import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';

// CORS headers for browser access
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Model fallback chain for quota/rate-limit resilience
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
  'gemini-3-pro-preview',
];

async function callGeminiWithModelChain(prompt: string, apiKey: string, config: any = {}): Promise<{ text: string; model: string }> {
  const { temperature = 0.7, maxOutputTokens = 4096, topK = 40, topP = 0.95, systemInstruction } = config;

  const requestBody: any = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens, topK, topP },
  };
  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
    const model = MODEL_CHAIN[attempt];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`[dashboard-insights] Attempt ${attempt + 1}/${MODEL_CHAIN.length} using model: ${model}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429 || response.status === 503) {
        console.warn(`[dashboard-insights] ${response.status} from ${model}, switching to next model...`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (response.status === 400) {
        const errorText = await response.text();
        console.error(`[dashboard-insights] 400 from ${model}: ${errorText.substring(0, 200)}`);
        continue;
      }

      if (!response.ok) {
        console.error(`[dashboard-insights] ${response.status} from ${model}`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.warn(`[dashboard-insights] No content from ${model}`);
        continue;
      }

      return { text, model };
    } catch (err) {
      console.error(`[dashboard-insights] Network error with ${model}:`, err);
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'dashboard-insights' });
  if (orResult.success && orResult.content) {
    return { text: orResult.content, model: 'openrouter/free' };
  }
  throw new Error('All AI models failed (Gemini + OpenRouter)');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { stats, userProfile } = await req.json();

    if (!stats) {
      throw new Error('Missing stats data');
    }

    // Fetch education context if auth is available
    let educationBlock = '';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const authHeader = req.headers.get('Authorization');
      if (supabaseUrl && supabaseServiceKey && authHeader) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const eduCtx = await getEducationContext(supabase, user.id);
          if (eduCtx) {
            educationBlock = `\n\n${formatEducationContextForPrompt(eduCtx)}\nUse this education context to make insights curriculum-specific and exam-relevant.\n`;
          }
        }
      }
    } catch (_eduErr) {
      // Non-critical — continue without education context
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX');
    if (!geminiApiKey) {
      throw new Error('Server configuration error: GEMINI_API_KEY not set');
    }

    const prompt = `
      You are an AI study coach analyzing a student's dashboard statistics.
      Based on the provided metrics, generate 3-5 personalized, actionable, and encouraging insights.
      
      USER STATS:
      ${JSON.stringify(stats, null, 2)}
      
      USER PROFILE:
      ${JSON.stringify(userProfile || {}, null, 2)}
      ${educationBlock}
      
      OUTPUT REQUIREMENTS:
      - Return ONLY a valid JSON array.
      - Each item in the array must be an object with the following fields:
        - "title": Short, catchy headline (e.g., "Morning Momentum", "Streak Risk").
        - "message": A 1-2 sentence friendly observation or tip.
        - "type": One of "success", "achievement" (green), "warning", "wellness" (yellow), "error", "risk" (red), "tip", "strategy" (purple), or "productivity" (blue).
        - "iconName": A suggested Lucid React icon name (e.g., "Flame", "Clock", "Trophy", "Brain", "Coffee", "Zap", "Target", "TrendingUp", "Lightbulb", "RefreshCw").
        - "action": Optional. A short text action button. To function correctly, it MUST contain one of these keywords based on the intended action:
            - To create a new schedule item: Use "Schedule" (e.g., "Schedule Session")
            - To create a note: Use "Note" or "Write" (e.g., "Write new note")
            - To start recording: Use "Recording" (e.g., "Start Recording")
            - To upload a document: Use "Upload" or "Document" (e.g., "Upload PDF")
            - To view notes: Use "Review" or "Read" (e.g., "Review Notes")
            - To go to quizzes: Use "Quiz" or "Test" (e.g., "Take a Quiz")
        
      TONE:
      - Supportive, slight gamification flavor, concise.
      - If stats are low or empty, be encouraging about starting.
      - If streak is broken, suggest restarting.
    `;

    const { text } = await callGeminiWithModelChain(prompt, geminiApiKey);

    // Clean up markdown code blocks if Gemini returns them
    const cleanJson = text.replace(/```json|```/g, '').trim();
    
    let insights = [];
    try {
        insights = JSON.parse(cleanJson);
    } catch (e) {
        console.error("Failed to parse JSON:", cleanJson);
        // Fallback to a single error insight if parsing fails
        insights = [{
            title: "Analysis Update",
            message: "We're calibrating your personalized insights. Check back after your next study session!",
            type: "info",
            iconName: "Bot"
        }];
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'generate-dashboard-insights',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[generate-dashboard-insights] Error logging failed:', _logErr); }
    console.error('Error in generate-dashboard-insights:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }
    );
  }
});
