import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Define a type for the Gemini API content structure to resolve 'never' type issues
interface GeminiContentPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const { message, userId, sessionId, learningStyle, learningPreferences, context, chatHistory } = await req.json();

    if (!userId || !sessionId || !message) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: userId, sessionId, or message'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const systemPrompt = createSystemPrompt(learningStyle, learningPreferences);

    // Explicitly type geminiContents as an array of GeminiContent
    const geminiContents: GeminiContent[] = [];

    // Add system prompt and context as the first user turn
    geminiContents.push({
      role: 'user',
      parts: [
        {
          text: `${systemPrompt}\n\nContext: ${context || 'No additional context provided'}`
        }
      ]
    });

    // Add previous chat history messages
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: any) => { // Use 'any' for msg as its exact type isn't defined here
        if (msg.role === 'user') {
          geminiContents.push({
            role: 'user',
            parts: [
              {
                text: msg.content
              }
            ]
          });
        } else if (msg.role === 'assistant') {
          geminiContents.push({
            role: 'model', // Gemini's role for assistant is 'model'
            parts: [
              {
                text: msg.content
              }
            ]
          });
        }
      });
    }

    // Add the current user message as the last turn
    geminiContents.push({
      role: 'user',
      parts: [
        {
          text: message
        }
      ]
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    // --- START: Robust cleaning for generatedText from AI ---
    generatedText = generatedText
      .split('\n') // Split into lines
      .map(line => {
        // Replace any character that is NOT a printable ASCII character (0x20-0x7E),
        // a newline (0x0A), or a carriage return (0x0D) with a standard space.
        let cleanedLine = line.replace(/[^\x20-\x7E\n\r]/g, ' ');
        // Normalize multiple spaces to single spaces and trim each line
        cleanedLine = cleanedLine.replace(/\s+/g, ' ').trim();
        return cleanedLine;
      })
      .filter(line => line.length > 0 || line.trim().length === 0) // Keep lines that were originally empty or just whitespace
      .join('\n');
    // --- END: Robust cleaning for generatedText from AI ---

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // The 'Deno' global is now recognized due to the reference directive
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!); // Use non-null assertion as Deno.env.get can return undefined

    const { error: userMessageError } = await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      content: message,
      role: 'user',
      timestamp: new Date().toISOString()
    });
    if (userMessageError) {
      console.error('Error inserting user message:', userMessageError);
    }

    const { error: aiMessageError } = await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      content: generatedText, // Save the cleaned text
      role: 'assistant',
      timestamp: new Date().toISOString()
    });
    if (aiMessageError) {
      console.error('Error inserting AI message:', aiMessageError);
    }

    return new Response(JSON.stringify({
      response: generatedText
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) { // Explicitly type error as 'any' for broader compatibility
    console.error('Error in gemini-chat function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal Server Error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

function createSystemPrompt(learningStyle: string, preferences: any) {
  const basePrompt = "You are an AI study assistant that helps students understand their notes and materials better.";
  let stylePrompt = "";
  switch (learningStyle) {
    case 'visual':
      stylePrompt = `Provide visual explanations using analogies, diagrams descriptions, and structured formatting. Use bullet points, numbered lists, and clear organization.
      
      When providing a diagram or chart, always use Mermaid syntax within a code block. The Mermaid code MUST be valid for one of the following types: 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'gitGraph', 'journey', 'timeline', 'quadrantChart', 'xychart', 'requirementDiagram'.
      
      The Mermaid code MUST start with the diagram type on the first line (e.g., 'flowchart TD', 'sequenceDiagram', 'classDiagram'). Each node, link, or element definition MUST be on its own line. Ensure there are NO trailing spaces at the end of any line within the Mermaid code block.
      
      Example of a perfect Mermaid flowchart:
      \`\`\`mermaid
      flowchart TD
          A[Start] --> B{Process Step};
          B -- Yes --> C[Outcome 1];
          B -- No --> D[Outcome 2];
      \`\`\`
      
      Example of a perfect Mermaid sequence diagram:
      \`\`\`mermaid
      sequenceDiagram
          Alice->>Bob: Hello Bob, how are you?
          Bob-->>Alice: I am good thanks!
      \`\`\`.`;
      break;
    case 'auditory':
      stylePrompt = "Explain concepts as if speaking aloud. Use conversational tone, repetition for emphasis, and step-by-step verbal explanations.";
      break;
    case 'kinesthetic':
      stylePrompt = "Focus on practical applications, hands-on examples, and real-world scenarios. Suggest activities and interactive ways to learn.";
      break;
    case 'reading':
      stylePrompt = "Provide detailed written explanations with comprehensive text, definitions, and thorough descriptions.";
      break;
    default:
      stylePrompt = "Adapt your explanation style to be clear and comprehensive.";
  }

  let difficultyPrompt = "";
  switch (preferences?.difficulty) {
    case 'beginner':
      difficultyPrompt = "Keep explanations simple and basic. Avoid jargon and complex terminology.";
      break;
    case 'intermediate':
      difficultyPrompt = "Provide moderately detailed explanations with some technical terms explained.";
      break;
    case 'advanced':
      difficultyPrompt = "Use advanced terminology and provide in-depth technical explanations.";
      break;
    default:
      difficultyPrompt = "Adjust complexity based on the question's context.";
  }

  const examplePrompt = preferences?.examples ? "Always include relevant examples and practical applications." : "Focus on direct explanations without extensive examples.";

  return `${basePrompt} ${stylePrompt} ${difficultyPrompt} ${examplePrompt}`;
}
