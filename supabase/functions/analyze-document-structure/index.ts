import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';
import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';

// Model fallback chain for quota/rate-limit resilience
const MODEL_CHAIN = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-pro',
    'gemini-3-pro-preview',
];
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const createAnalysisPrompt = (textContent) => {
    return `
Analyze the following document text to identify its structure. Your goal is to find chapters, sections, or a table of contents.

**Instructions:**
1.  Read through the entire text.
2.  Identify the main sections or chapters. Look for patterns like "Chapter 1", "Section A", or titles in all caps.
3.  If you find a clear structure, return a JSON object with a single key, "sections", which is an array of strings. Each string should be the title of a section or chapter.
4.  If the document is short or has no discernible structure, return a JSON object with \`sections: null\`.
5.  Only return the JSON object, with no other text or explanation.

**Example Output (Structured):**
\`\`\`json
{
  "sections": [
    "Chapter 1: The Beginning",
    "Chapter 2: The Middle",
    "Chapter 3: The End"
  ]
}
\`\`\`

**Example Output (Unstructured):**
\`\`\`json
{
  "sections": null
}
\`\`\`

--- DOCUMENT TEXT ---
${textContent}
--- END OF TEXT ---
`;
};
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders
        });
    }
    try {
        const { documentContent } = await req.json();
        if (!documentContent) {
            return new Response(JSON.stringify({
                error: 'Missing documentContent'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX');
        if (!geminiApiKey) {
            throw new Error("GEMINI_API_KEY is not set.");
        }

        const prompt = createAnalysisPrompt(documentContent);
        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096, topK: 40, topP: 0.95 },
        };

        let text = '';
        for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
            const currentModel = MODEL_CHAIN[attempt];
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`;
            console.log(`[analyze-document-structure] Attempt ${attempt + 1}/${MODEL_CHAIN.length} using model: ${currentModel}`);

            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });

                if (resp.status === 429 || resp.status === 503) {
                    console.warn(`[analyze-document-structure] ${resp.status} from ${currentModel}, switching...`);
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                    continue;
                }

                if (!resp.ok) {
                    console.error(`[analyze-document-structure] ${resp.status} from ${currentModel}`);
                    continue;
                }

                const data = await resp.json();
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                    text = content;
                    break;
                }
            } catch (err) {
                console.error(`[analyze-document-structure] Network error with ${currentModel}:`, err);
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }

        if (!text) {
            // OpenRouter fallback
            const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'analyze-document-structure' });
            if (orResult.success && orResult.content) {
                text = orResult.content;
            } else {
                throw new Error('All AI models failed (Gemini + OpenRouter)');
            }
        }

        text = text.replace(/```json|```/g, '').trim();
        let structure;
        try {
            structure = JSON.parse(text);
        } catch (jsonError) {
            //console.error('Error parsing AI response as JSON:', jsonError);
            // Attempt to find JSON within the text if it's not pure JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    structure = JSON.parse(jsonMatch[0]);
                } catch (innerJsonError) {
                    //console.error('Error parsing extracted JSON:', innerJsonError);
                    return new Response(JSON.stringify({
                        error: 'AI response was not valid JSON and could not be parsed.'
                    }), {
                        status: 500,
                        headers: {
                            ...corsHeaders,
                            'Content-Type': 'application/json'
                        }
                    });
                }
            } else {
                return new Response(JSON.stringify({
                    error: 'AI response was not valid JSON and no JSON object could be extracted.'
                }), {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }
        }
        return new Response(JSON.stringify(structure), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
      // ── Log to system_error_logs ──
      try {
        const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await logSystemError(_logClient, {
          severity: 'error',
          source: 'analyze-document-structure',
          message: error?.message || String(error),
          details: { stack: error?.stack },
        });
      } catch (_logErr) { console.error('[analyze-document-structure] Error logging failed:', _logErr); }
        //console.error('Error analyzing document structure:', error.message);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
});
