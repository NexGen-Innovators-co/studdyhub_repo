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
    const MODEL_CHAIN = [
      'gemini-2.5-flash',
      'gemini-3-pro-preview',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-pro',
      'gemini-1.5-pro'
    ];

    async function callGeminiWithModelChain(requestBody: any, apiKey: string, maxAttempts = 3): Promise<any> {
      for (let attempt = 0; attempt < Math.min(maxAttempts, MODEL_CHAIN.length); attempt++) {
        const model = MODEL_CHAIN[attempt % MODEL_CHAIN.length];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          if (resp.ok) return await resp.json();
          const txt = await resp.text();
          // console.warn(`Gemini ${model} returned ${resp.status}: ${txt.substring(0,200)}`);
          if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 1000*(attempt+1)));
        } catch (err) {
          // console.error(`Error calling Gemini ${model}:`, err);
          if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 1000*(attempt+1)));
        }
      }
      throw new Error('All Gemini models failed');
    }

    const result = await callGeminiWithModelChain(payload, geminiApiKey);
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts || result.candidates[0].content.parts.length === 0) {
      throw new Error('Invalid response structure from Gemini API');
    }
    const generatedContent = result.candidates[0].content.parts[0].text;
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
    } catch (parseError) {
      // console.error('Failed to parse quiz JSON or validate structure:', parseError);
      // console.error('Raw content that failed parsing:', generatedContent);
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
      // console.warn('Falling back to default quiz due to parsing error.');
    }
    return new Response(JSON.stringify(quizData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // console.error('Error in generate-quiz function:', error);
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

