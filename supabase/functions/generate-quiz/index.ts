import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSubscriptionValidator, createErrorResponse, extractUserIdFromAuth } from '../utils/subscription-validator.ts';
import { getEducationContext, formatEducationContextForPrompt } from '../_shared/educationContext.ts';
import { logSystemError } from '../_shared/errorLogger.ts';
import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  let supabaseAdmin: any = null;
  let logUserId: string | undefined;

  try {
    // Validate user authentication and quiz limit
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    
    if (!userId) {
      return createErrorResponse('Unauthorized: Please login to generate quizzes', 401);
    }
    logUserId = userId;

    // Check daily quiz limit
    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkDailyQuizLimit(userId);
    
    if (!limitCheck.allowed) {
      return createErrorResponse(limitCheck.message || 'Daily quiz limit exceeded', 403);
    }

    // Extract dynamic parameters, setting defaults if they aren't provided by the frontend
    const { 
      name, 
      transcript, 
      file_url, 
      num_questions = 5, 
      difficulty = 'intermediate' 
    } = await req.json();

    if (!transcript || transcript.trim().length < 100) {
      throw new Error('Transcript too short or missing. Need at least 100 characters for quiz generation.');
    }

    // Safety checks: Ensure num_questions is a valid number between 1 and 20
    const parsedNumQuestions = Math.min(Math.max(parseInt(num_questions) || 5, 1), 20);
    const safeDifficulty = String(difficulty).trim() || 'intermediate';

    // Fetch education context for curriculum-aligned quiz generation
    let educationBlock = '';
    try {
      const eduCtx = await getEducationContext(supabaseAdmin, userId);
      if (eduCtx) {
        educationBlock = `\n\n${formatEducationContextForPrompt(eduCtx)}\nAlign questions to this student's curriculum, exam format, and subject focus where relevant.\n`;
      }
    } catch (_eduErr) {
      // Non-critical — continue without education context
    }

    // Use shared Gemini helper which includes built-in model chaining/fallback
    const { callGeminiJSON } = await import('../utils/gemini.ts');

    const prompt = `Based on the following transcript, create a comprehensive quiz with exactly ${parsedNumQuestions} multiple-choice questions. 
The difficulty level of the questions should be: ${safeDifficulty}.

Each question should:
1. Test understanding of key concepts, facts, or themes appropriate for the requested difficulty level.
2. Have 4 answer options (A, B, C, D)
3. Have exactly one correct answer (the correctAnswer field should be 0, 1, 2, or 3 corresponding to the option's index)
4. Include a brief explanation for the correct answer
${educationBlock}
Transcript:
"${transcript.substring(0, 3000)}"

Respond with a JSON object in this exact format. Ensure the JSON is valid.`;

    // callGeminiJSON handles chain + OpenRouter fallback and returns parsed JSON
    const aiResult = await callGeminiJSON<any>(prompt, { maxOutputTokens: 2000 });

    let quizData: any;
    if (aiResult.success && aiResult.data) {
      quizData = aiResult.data;
    } else {
      // if ai call failed or produced no data, log and fall back
      logSystemError(supabaseAdmin, {
        severity: 'warning',
        source: 'generate-quiz',
        component: 'ai-call',
        error_code: 'GEMINI_FAILURE',
        message: `Gemini JSON call failed: ${aiResult.error || 'no data'}`,
        user_id: logUserId,
      });
    }

    // Validate structure; if invalid or missing questions, create fallback
    if (!quizData || !quizData.title || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      // fallback creation still uses required number of questions to avoid single-question issue
      quizData = {
        title: `Quiz: ${name}`,
        questions: Array(parsedNumQuestions).fill(null).map((_, idx) => ({
          question: `Fallback question #${idx+1}`,
          options: ['Option A','Option B','Option C','Option D'],
          correctAnswer: 0,
          explanation: 'Fallback content due to AI failure.'
        }))
      };
    }
    try {
      // Direct parse the JSON response
      quizData = JSON.parse(generatedContent);
      // Validate the structure
      if (!quizData.title || !quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error('Invalid quiz data structure: missing title or questions array.');
      }
      // Validate each question
      quizData.questions.forEach((q: any, index: number) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
          throw new Error(`Invalid question structure at index ${index}: ${JSON.stringify(q)}`);
        }
      });
    } catch (parseError) {
      logSystemError(supabaseAdmin, {
        severity: 'warning',
        source: 'generate-quiz',
        component: 'json-parse',
        error_code: 'QUIZ_JSON_PARSE_FAILED',
        message: `Quiz JSON parse/validation failed, using fallback quiz`,
        details: { error: String(parseError), rawContentLength: generatedContent?.length },
        user_id: logUserId,
      });
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

  } catch (error: any) {
    if (supabaseAdmin) {
      logSystemError(supabaseAdmin, {
        severity: 'error',
        source: 'generate-quiz',
        component: 'main',
        error_code: 'QUIZ_GENERATION_FAILED',
        message: `Quiz generation failed: ${error.message || String(error)}`,
        details: { stack: error.stack, error: String(error) },
        user_id: logUserId,
      });
    }
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