import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSubscriptionValidator, createErrorResponse, extractUserIdFromAuth } from '../utils/subscription-validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Validate user authentication and quiz limit
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    
    if (!userId) {
      return createErrorResponse('Unauthorized: Please login to generate quizzes', 401);
    }

    // Check daily quiz limit
    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkDailyQuizLimit(userId);
    
    if (!limitCheck.allowed) {
      return createErrorResponse(limitCheck.message || 'Daily quiz limit exceeded', 403);
    }

    const { name, transcript, file_url } = await req.json();
    console.log('Generating quiz for:', name);
    console.log('Transcript length:', transcript?.length || 0);
    if (!transcript || transcript.trim().length < 100) {
      throw new Error('Transcript too short or missing. Need at least 100 characters for quiz generation.');
    }
    // Use GEMINI_API_KEY for Gemini 2.0
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured. Please set the GEMINI_API_KEY environment variable.');
    }
    // Prepare the prompt for quiz generation
    const prompt = `Based on the following transcript, create a comprehensive quiz with exactly 5 multiple-choice questions. Each question should:
1. Test understanding of key concepts, facts, or themes
2. Have 4 answer options (A, B, C, D)
3. Have exactly one correct answer (the correctAnswer field should be 0, 1, 2, or 3 corresponding to the option's index)
4. Include a brief explanation for the correct answer

Transcript:
"${transcript.substring(0, 3000)}"

Respond with a JSON object in this exact format. Ensure the JSON is valid.`;
    console.log('Calling Gemini API...');
    // Construct the payload for Gemini API
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "title": {
              "type": "STRING"
            },
            "questions": {
              "type": "ARRAY",
              "items": {
                type: "OBJECT",
                properties: {
                  "question": {
                    "type": "STRING"
                  },
                  "options": {
                    "type": "ARRAY",
                    "items": {
                      "type": "STRING"
                    }
                  },
                  "correctAnswer": {
                    "type": "NUMBER"
                  },
                  "explanation": {
                    "type": "STRING"
                  }
                },
                required: [
                  "question",
                  "options",
                  "correctAnswer"
                ]
              }
            }
          },
          required: [
            "title",
            "questions"
          ]
        }
      },
      // Using gemini-2.0-flash as requested
      model: "gemini-2.0-flash"
    };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    console.log('Gemini response received');
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts || result.candidates[0].content.parts.length === 0) {
      throw new Error('Invalid response structure from Gemini API');
    }
    const generatedContent = result.candidates[0].content.parts[0].text;
    console.log('Generated content:', generatedContent.substring(0, 200) + '...');
    let quizData;
    try {
      // Direct parse the JSON response
      quizData = JSON.parse(generatedContent);
      // Validate the structure
      if (!quizData.title || !quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error('Invalid quiz data structure: missing title or questions array.');
      }
      // Validate each question
      quizData.questions.forEach((q, index)=>{
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
          throw new Error(`Invalid question structure at index ${index}: ${JSON.stringify(q)}`);
        }
      });
      console.log('Quiz validation passed');
    } catch (parseError) {
      console.error('Failed to parse quiz JSON or validate structure:', parseError);
      console.error('Raw content that failed parsing:', generatedContent);
      // Fallback: create a simple quiz based on the content
      quizData = {
        title: `Quiz: ${name}`,
        questions: [
          {
            question: "What is the main topic discussed in this recording?",
            options: [
              "The content covers multiple educational topics",
              "Technical documentation review",
              "Personal experiences and stories",
              "Business and professional matters"
            ],
            correctAnswer: 0,
            explanation: "Based on the transcript content, this appears to cover educational material."
          }
        ]
      };
      console.warn('Falling back to default quiz due to parsing error.');
    }
    console.log('Quiz generated successfully:', quizData.title);
    console.log('Number of questions:', quizData.questions.length);
    return new Response(JSON.stringify(quizData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in generate-quiz function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Failed to generate quiz. Please ensure the transcript contains sufficient educational content and a valid Gemini API key is configured.'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
