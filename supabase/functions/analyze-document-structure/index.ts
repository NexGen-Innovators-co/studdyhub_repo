import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.14.1';
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
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error("GEMINI_API_KEY is not set.");
        }
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash'
        });
        const prompt = createAnalysisPrompt(documentContent);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json|```/g, '').trim();
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
