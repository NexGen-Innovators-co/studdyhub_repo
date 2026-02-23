import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';
import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Model fallback chain for quota/rate-limit resilience
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
  'gemini-3-pro-preview',
];

interface DiagramFixRequest {
  diagramType: 'mermaid' | 'html' | 'code';
  originalContent: string;
  errorMessage: string;
  userProfile: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      diagramType,
      originalContent,
      errorMessage,
      userProfile
    }: DiagramFixRequest = await req.json()

    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found')
    }

    const systemPrompt = `You are an expert diagram and code fixing assistant. Your task is to analyze and fix broken diagrams/code.

**Your Role:**
- Identify and fix syntax errors, rendering issues, and structural problems
- Provide clear explanations of what was wrong and how you fixed it
- Offer preventive suggestions for future use

**Diagram Types:**
- **Mermaid**: Fix syntax errors, node connections, special characters, diagram structure
- **HTML**: Fix security issues, broken tags, CSS problems, JavaScript errors
- **Code**: Fix syntax errors, missing brackets/semicolons, formatting issues

**Output Format:**
Respond with a JSON object containing:
{
  "fixedContent": "The corrected content",
  "explanation": "Clear explanation of what was fixed",
  "suggestions": ["Array of preventive suggestions"]
}

**Guidelines:**
- Preserve the original intent and structure as much as possible
- Make minimal necessary changes to fix the issue
- Provide educational explanations
- Suggest best practices for prevention
- If unable to fix, explain why and suggest alternatives`

    const userPrompt = `Please fix this ${diagramType} content that has an error:

**Error Message:** ${errorMessage}

**Original Content:**
\`\`\`${diagramType}
${originalContent}
\`\`\`

**User Learning Style:** ${userProfile?.learning_style || 'balanced'}

Please analyze the error and provide a fixed version with explanation and suggestions.`

    const fullPrompt = systemPrompt + '\n\n' + userPrompt;
    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096, topK: 40, topP: 0.95 },
    };

    let text = '';
    for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
      const currentModel = MODEL_CHAIN[attempt];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      console.log(`[fix-diagram] Attempt ${attempt + 1}/${MODEL_CHAIN.length} using model: ${currentModel}`);

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (resp.status === 429 || resp.status === 503) {
          console.warn(`[fix-diagram] ${resp.status} from ${currentModel}, switching to next model...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        if (!resp.ok) {
          console.error(`[fix-diagram] ${resp.status} from ${currentModel}`);
          continue;
        }

        const data = await resp.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          text = content;
          break;
        }
      } catch (err) {
        console.error(`[fix-diagram] Network error with ${currentModel}:`, err);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!text) {
      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'fix-diagram' });
      if (orResult.success && orResult.content) {
        text = orResult.content;
      } else {
        throw new Error('All AI models failed (Gemini + OpenRouter)');
      }
    }

    // Try to parse as JSON
    let fixResult;
    try {
      fixResult = JSON.parse(text)
    } catch (parseError) {
      // If not valid JSON, create a structured response
      fixResult = {
        fixedContent: originalContent, // Return original if we can't parse
        explanation: "I analyzed the content but had trouble providing a structured fix. Please try the manual suggestions below.",
        suggestions: [
          "Check for syntax errors and typos",
          "Ensure proper formatting and indentation",
          "Verify all brackets and quotes are balanced",
          "Test with simpler versions first"
        ]
      }
    }

    // Validate the response structure
    if (!fixResult.fixedContent) {
      fixResult.fixedContent = originalContent
    }
    if (!fixResult.explanation) {
      fixResult.explanation = "Unable to provide specific fix explanation"
    }
    if (!Array.isArray(fixResult.suggestions)) {
      fixResult.suggestions = ["Try checking the documentation for proper syntax"]
    }

    return new Response(
      JSON.stringify(fixResult),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'fix-diagram',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[fix-diagram] Error logging failed:', _logErr); }
    //console.error('Error in fix-diagram function:', error)

    return new Response(
      JSON.stringify({
        error: error.message,
        fixedContent: '',
        explanation: 'Unable to process fix request',
        suggestions: ['Please try again or check the content manually']
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})