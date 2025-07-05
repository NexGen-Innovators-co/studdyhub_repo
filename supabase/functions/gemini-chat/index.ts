import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, learningStyle, learningPreferences, context } = await req.json();
    
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Create system prompt based on learning style and preferences
    const systemPrompt = createSystemPrompt(learningStyle, learningPreferences);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\nContext: ${context || 'No additional context provided'}\n\nUser question: ${message}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates[0]?.content?.parts[0]?.text || 'Sorry, I could not generate a response.';

    // Save the conversation to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Save user message
    await supabase.from('chat_messages').insert({
      user_id: userId,
      content: message,
      role: 'user'
    });

    // Save AI response
    await supabase.from('chat_messages').insert({
      user_id: userId,
      content: generatedText,
      role: 'assistant'
    });

    return new Response(JSON.stringify({ response: generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in gemini-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createSystemPrompt(learningStyle: string, preferences: any): string {
  const basePrompt = "You are an AI study assistant that helps students understand their notes and materials better.";
  
  let stylePrompt = "";
  switch (learningStyle) {
    case 'visual':
      stylePrompt = "Provide visual explanations using analogies, diagrams descriptions, and structured formatting. Use bullet points, numbered lists, and clear organization.";
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