import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { createSubscriptionValidator, createErrorResponse as createSubErrorResponse } from '../utils/subscription-validator.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Helper function to construct the dynamic AI prompt.
const createPrompt = (userProfile, document, selectedSection = null) => {
    let sectionInstruction = '';
    if (selectedSection) {
        sectionInstruction = `
**Focus Area:** The user has specifically requested notes on the section titled: "${selectedSection}".
Please extract and synthesize information primarily from this section. If the section content is insufficient, you may draw from other relevant parts of the document, but prioritize the selected section.
`;
    }

    return `
**You are studdyhub, an expert AI learning assistant.** Your primary goal is to generate a high-quality, structured, and visually appealing note from the provided document text, tailored to the student's learning profile. The output must be in **Markdown format** and follow the specified structure precisely.

**Student's Learning Profile:**
- Learning Style: ${userProfile.learning_style}
- Desired Explanation Style: ${userProfile.learning_preferences.explanation_style}
- Needs Examples: ${userProfile.learning_preferences.examples ? 'Yes' : 'No'}
- Desired Difficulty: ${userProfile.learning_preferences.difficulty}
${userProfile.personal_context ? `\n**Personal Context (provided by the student — use to tailor the note):**\n${userProfile.personal_context}` : ''}

**Crucial Instructions for AI Output Tailoring:**
* **Explanation Style:** Adapt your explanations to be "${userProfile.learning_preferences.explanation_style}". For example:
    * If "simple and direct", use straightforward language.
    * If "detailed and comprehensive", provide more in-depth explanations.
    * If "conceptual and abstract", focus on underlying principles.
    * If "practical and application-focused", emphasize real-world use.
* **Examples:** If "Needs Examples" is "Yes", ensure each key concept has a clear, concise, and relevant example. If "No", omit examples.
* **Difficulty:** Adjust the complexity of the language and concepts to be "${userProfile.learning_preferences.difficulty}". For example:
    * "Beginner": Use very simple terms, avoid jargon.
    * "Intermediate": Use standard terminology, explain complex terms.
    * "Advanced": Assume familiarity with domain-specific jargon, delve into nuances.

${sectionInstruction}

**Instructions for Note Generation (Strict Markdown Format Required):**

Generate the note with the following sections, using Markdown headings and lists as specified. Use horizontal rules (---) to clearly separate each main section for visual clarity.

---

### 1. Summary

A concise, one-paragraph summary of the entire document text. Focus on the main topic and core message. Ensure it's easy to understand and captures the essence of the document.

---

### 2. Key Concepts

A bulleted list of the **3-5 most important concepts** from the document. For each concept:
-   Use **bold text** for the concept name.
-   Provide a clear, concise definition tailored to the student's desired explanation style and difficulty.
-   If the student needs examples (Learning Preferences: Needs Examples: Yes), provide **one relevant example** for each concept, clearly labeled as "Example:".

---

### 3. Potential Quiz Questions

A numbered list of **3-5 thought-provoking questions** based on the document content. These questions should help the student with active recall and self-testing. Include a mix of question types (e.g., multiple choice, short answer, true/false, fill-in-the-blank). Ensure questions are clear and directly test understanding of the key concepts.

---

### 4. Connections/Analogies

(Optional, but highly encouraged for kinesthetic/visual learners) Provide **one or two simple, relatable analogies or real-world connections** that link the core ideas of the document to concepts the student might already understand. Clearly label each analogy (e.g., "Analogy 1:", "Connection:").

---

### 5. Visual Aids (Tables & Diagrams)

When applicable, use the following tools to create visual aids:

* **Tables:** If the content involves comparisons or structured data, present it in a Markdown table.
* **Diagrams (Mermaid Syntax):** To illustrate processes, hierarchies, or connections, generate a diagram using **Mermaid.js syntax** inside a \`\`\`mermaid code block. **CRITICAL: Mermaid code MUST NOT contain semicolons at the end of lines. Ensure each line ends without a semicolon.** For example:
    \`\`\`mermaid
    graph TD
        A[Concept A] --> B(Concept B)
        A --> C{Decision}
        C -->|Yes| D[Outcome 1]
        C -->|No| E[Outcome 2]
    \`\`\`
* **Graphs (DOT Syntax):** To represent directed graphs, flowcharts, or hierarchies, generate a graph using **DOT language syntax** inside a \`\`\`dot code block. For example:
    \`\`\`dot
    digraph G {
        main -> parse -> execute;
        main -> init;
        main -> cleanup;
        execute -> make_string;
        execute -> printf;
        init -> make_string;
    }
    \`\`\`
* **Charts (Chart.js JSON):** For data visualization (e.g., bar charts, line charts, pie charts), generate a JSON configuration object compatible with Chart.js inside a \`\`\`chartjs code block. **Only include the JSON object.** For example:
    \`\`\`chartjs
    {
      "type": "bar",
      "data": {
        "labels": ["Red", "Blue", "Yellow", "Green", "blue", "Orange"],
        "datasets": [{
          "label": "# of Votes",
          "data": [12, 19, 3, 5, 2, 3],
          "backgroundColor": [
            "rgba(255, 99, 132, 0.2)",
            "rgba(54, 162, 235, 0.2)",
            "rgba(255, 206, 86, 0.2)",
            "rgba(75, 192, 192, 0.2)",
            "rgba(153, 102, 255, 0.2)",
            "rgba(255, 159, 64, 0.2)"
          ],
          "borderColor": [
            "rgba(255, 99, 132, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(75, 192, 192, 1)",
            "rgba(153, 102, 255, 1)",
            "rgba(255, 159, 64, 1)"
          ],
          "borderWidth": 1
        }]
      },
      "options": {
        "scales": {
          "y": {
            "beginAtZero": true
          }
        }
      }
    }
    \`\`\`
* **Images:** You cannot generate images, but you can suggest them. If an image would be helpful, describe it and use placeholder syntax like: \`![A diagram of the human brain's lobes](placeholder:diagram-of-brain-lobes)\`.

---

**Important:** Ensure the entire response is well-formatted Markdown, easy to read, and directly addresses the student's learning profile. Maintain a clear, concise, and easy-to-understand language throughout.

--- DOCUMENT TEXT ---
${document.content_extracted}
--- END OF TEXT ---
`;
};

// Helper function to extract the summary from the AI's markdown response.
const extractSummary = (markdown) => {
    try {
        const summaryMatch = markdown.match(/### 1. Summary\s*([\s\S]*?)\s*---/);
        if (summaryMatch && summaryMatch[1]) {
            return summaryMatch[1].trim();
        }
        const summaryMatch2 = markdown.match(/\*\*Summary:\*\*\s*([\s\S]*?)\s*(\*\*Key Concepts:\*\*|\*\*Potential Quiz Questions:\*\*)/);
        if (summaryMatch2 && summaryMatch2[1]) {
            return summaryMatch2[1].trim();
        }
        // Fallback if the structure is slightly different
        const lines = markdown.split('\n');
        let summary = '';
        let inSummary = false;
        for (const line of lines) {
            if (line.includes('**Summary:**') || line.includes('### 1. Summary')) {
                inSummary = true;
                summary += line.replace('**Summary:**', '').replace('### 1. Summary', '').trim() + ' ';
                continue;
            }
            if (line.includes('**Key Concepts:**') || line.includes('### 2. Key Concepts') || line.startsWith('---')) {
                if (inSummary) break;
            }
            if (inSummary && line.trim() !== '') {
                summary += line.trim() + ' ';
            }
        }
        return summary.trim() || 'No summary could be extracted.';
    } catch (e) {
        //console.error('Error extracting summary:', e);
        return 'No summary could be extracted.';
    }
};

// NEW HELPER FUNCTION FOR IMAGE PROCESSING
const processImagePlaceholders = async (content, userId, supabaseServiceRoleClient) => {
    const imagePlaceholderRegex = /!\[(.*?)\]\(placeholder:(.*?)\)/g;
    let updatedContent = content;
    let match;
    // Reset regex lastIndex for multiple executions
    imagePlaceholderRegex.lastIndex = 0;
    // Use a loop to find all matches
    while ((match = imagePlaceholderRegex.exec(content)) !== null) {
        const fullMatch = match[0]; // e.g., ![A diagram of the human brain's lobes](placeholder:diagram-of-brain-lobes)
        const description = match[1]; // e.g., A diagram of the human brain's lobes
        // const imageName = match[2]; // Not directly used for URL, but good for debugging
        try {
            // Call the new generate-image-from-text function
            const { data: imageData, error: imageError } = await supabaseServiceRoleClient.functions.invoke('generate-image-from-text', {
                body: {
                    description: description,
                    userId: userId
                }
            });
            if (imageError) {
                //console.error(`Error generating image for "${description}":`, imageError.message);
                // If image generation fails, replace with a broken image or a message
                updatedContent = updatedContent.replace(fullMatch, `![${description} - Image Generation Failed](broken-image.png)`); // Use a generic broken image
            } else if (imageData && imageData.imageUrl) {
                // Replace the placeholder with the actual image URL
                updatedContent = updatedContent.replace(fullMatch, `![${description}](${imageData.imageUrl})`);
            } else {
                // Fallback if no image URL is returned
                updatedContent = updatedContent.replace(fullMatch, `![${description} - No Image URL Returned](no-image-url.png)`); // Use a generic no-image-url
            }
        } catch (e) {
            //console.error(`Unexpected error during image generation for "${description}":`, e.message);
            updatedContent = updatedContent.replace(fullMatch, `![${description} - Unexpected Error](unexpected-error.png)`); // Use a generic error image
        }
    }
    return updatedContent;
};

serve(async (req) => {
    // 1. Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders
        });
    }

    try {
        // 2. Initialize Supabase client with user's auth token
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
            global: {
                headers: {
                    Authorization: req.headers.get('Authorization')
                }
            }
        });

        // Initialize Supabase client with service role key for internal function calls and storage access
        const supabaseServiceRoleClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

        // 3. Get authenticated user
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            return new Response(JSON.stringify({
                error: 'Unauthorized'
            }), {
                status: 401,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Check AI generation limit
        const validator = createSubscriptionValidator();
        const limitCheck = await validator.checkAiMessageLimit(user.id);
        
        if (!limitCheck.allowed) {
            return createSubErrorResponse(limitCheck.message || 'AI generation limit exceeded', 403);
        }

        // 4. Parse request body
        const { documentId, userProfile, selectedSection, noteId } = await req.json(); // Destructure selectedSection and noteId
        if (!documentId || !userProfile) {
            return new Response(JSON.stringify({
                error: 'Missing documentId or userProfile'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // 5. Fetch document content securely
        const { data: document, error: docError } = await supabaseClient.from('documents').select('title, content_extracted').eq('id', documentId).eq('user_id', user.id).single();
        if (docError || !document) {
            //console.error('Document fetch error:', docError?.message);
            return new Response(JSON.stringify({
                error: 'Document not found or access denied'
            }), {
                status: 404,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // 6. Construct the AI prompt, passing selectedSection
        const prompt = createPrompt(userProfile, document, selectedSection);

        // 7. Call the Gemini API
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error("GEMINI_API_KEY is not set in Supabase secrets.");
        }
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash'
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let aiContent = response.text(); // Use 'let' because we will modify it

        // 7.5. Process image placeholders in the AI-generated content
        aiContent = await processImagePlaceholders(aiContent, user.id, supabaseServiceRoleClient);

        // 8. Save the new note to the database (or update existing if noteId provided)
        const notePayload = {
            user_id: user.id,
            document_id: documentId,
            title: `${document.title}${selectedSection ? ` - ${selectedSection}` : ''}`, // Add section to title
            content: aiContent,
            category: 'general',
            tags: [
                'ai',
                'summary',
                document.title.toLowerCase().replace(/\s+/g, '-'),
                ...(selectedSection ? [selectedSection.toLowerCase().replace(/\s+/g, '-')] : []) // Add selected section as tag
            ],
            ai_summary: extractSummary(aiContent),
            updated_at: new Date().toISOString()
        };

        let resultData;
        
        if (noteId) {
             // Update existing note
             const { data: updatedNote, error: updateError } = await supabaseClient
                .from('notes')
                .update(notePayload)
                .eq('id', noteId)
                .eq('user_id', user.id)
                .select()
                .single();
                
             if (updateError) {
                 throw new Error('Failed to update the existing note. ' + updateError.message);
             }
             resultData = updatedNote;
        } else {
             // Insert new note
             const { data: newNote, error: insertError } = await supabaseClient
                .from('notes')
                .insert(notePayload)
                .select()
                .single();
                
             if (insertError) {
                //console.error('Note insert error:', insertError.message);
                throw new Error('Failed to save the generated note. Check database constraints.');
             }
             resultData = newNote;
        }

        // 9. Return the note to the client
        return new Response(JSON.stringify(resultData), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        //console.error('Edge function error:', error.message);
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
