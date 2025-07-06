import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.14.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to construct the dynamic AI prompt.
const createPrompt = (userProfile, document) => {
    return `
You are NoteMind, an expert AI learning assistant. Your goal is to generate a high-quality, structured note from the provided text to help a student learn efficiently.

**Student's Learning Profile:**
- Learning Style: ${userProfile.learning_style}
- Desired Explanation Style: ${userProfile.learning_preferences.explanation_style}
- Needs Examples: ${userProfile.learning_preferences.examples ? 'Yes' : 'No'}
- Desired Difficulty: ${userProfile.learning_preferences.difficulty}

**Instructions:**
Based on the student's profile and the document text below, please generate notes in Markdown format with the following sections:
1.  **Summary:** A concise, one-paragraph summary of the entire text.
2.  **Key Concepts:** A bulleted list of the 3-5 most important concepts. For each concept, provide a clear definition tailored to the student's desired explanation style and difficulty. If the student wants examples, provide one for each concept.
3.  **Potential Quiz Questions:** A list of 3-5 questions to help the student with active recall and self-testing.
4.  **Connections/Analogies:** (Optional, but good for kinesthetic/visual learners) Create one or two simple analogies to connect the core ideas to real-world concepts.

--- DOCUMENT TEXT ---
${document.content_extracted}
--- END OF TEXT ---
`;
};

// Helper function to extract the summary from the AI's markdown response.
const extractSummary = (markdown) => {
    try {
        const summaryMatch = markdown.match(/\*\*Summary:\*\*\s*([\s\S]*?)\s*(\*\*Key Concepts:\*\*|\*\*Potential Quiz Questions:\*\*)/);
        if (summaryMatch && summaryMatch[1]) {
            return summaryMatch[1].trim();
        }
        // Fallback if the structure is slightly different
        const lines = markdown.split('\n');
        let summary = '';
        let inSummary = false;
        for (const line of lines) {
            if (line.includes('**Summary:**')) {
                inSummary = true;
                summary += line.replace('**Summary:**', '').trim() + ' ';
                continue;
            }
            if (line.includes('**Key Concepts:**') || line.includes('**Potential Quiz Questions:**')) {
                break;
            }
            if (inSummary && line.trim() !== '') {
                summary += line.trim() + ' ';
            }
        }
        return summary.trim() || 'No summary could be extracted.';
    } catch (e) {
        console.error('Error extracting summary:', e);
        return 'No summary could be extracted.';
    }
};

serve(async (req) => {
    // 1. Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 2. Initialize Supabase client with user's auth token
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
            global: {
                headers: { Authorization: req.headers.get('Authorization')! },
            },
        });

        // 3. Get authenticated user
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 4. Validate request body
        const { documentId, userProfile } = await req.json();
        if (!documentId || !userProfile) {
            return new Response(JSON.stringify({ error: 'Missing documentId or userProfile' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 5. Fetch document content securely
        const { data: document, error: docError } = await supabaseClient.from('documents').select('title, content_extracted').eq('id', documentId).eq('user_id', user.id).single();
        if (docError || !document) {
            console.error('Document fetch error:', docError?.message);
            return new Response(JSON.stringify({ error: 'Document not found or access denied' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 6. Construct the AI prompt
        const prompt = createPrompt(userProfile, document);

        // 7. Call the Gemini API
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error("GEMINI_API_KEY is not set in Supabase secrets.");
        }
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // Corrected model name
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiContent = response.text();

        // 8. Save the new note to the database
        const newNotePayload = {
            user_id: user.id,
            document_id: documentId, // Link note to the source document
            title: `AI Notes for: ${document.title}`,
            content: aiContent,
            category: 'general', // Use a valid category from your ENUM
            tags: ['ai', 'summary', document.title.toLowerCase().replace(/\s+/g, '-')],
            ai_summary: extractSummary(aiContent),
        };

        const { data: newNote, error: insertError } = await supabaseClient.from('notes').insert(newNotePayload).select().single();
        if (insertError) {
            console.error('Note insert error:', insertError.message);
            throw new Error('Failed to save the generated note. Check database constraints.');
        }

        // 9. Return the new note to the client
        return new Response(JSON.stringify(newNote), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Edge function error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});