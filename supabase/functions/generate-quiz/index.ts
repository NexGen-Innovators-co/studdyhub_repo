// supabase/functions/generate-quiz/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSubscriptionValidator, createErrorResponse, extractUserIdFromAuth } from '../utils/subscription-validator.ts';
import { getEducationContext, formatEducationContextForPrompt } from '../_shared/educationContext.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let supabaseAdmin: any = null;
  let logUserId: string | undefined;

  try {
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

    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkDailyQuizLimit(userId);
    if (!limitCheck.allowed) {
      return createErrorResponse(limitCheck.message || 'Daily quiz limit exceeded', 403);
    }

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

    const parsedNumQuestions = Math.min(Math.max(parseInt(num_questions) || 5, 1), 20);
    const safeDifficulty = String(difficulty).trim() || 'intermediate';

    let educationBlock = '';
    try {
      const eduCtx = await getEducationContext(supabaseAdmin, userId);
      if (eduCtx) {
        educationBlock = `\n\n${formatEducationContextForPrompt(eduCtx)}\nAlign questions to this student's curriculum, exam format, and subject focus where relevant.\n`;
      }
    } catch (_eduErr) {
      // Non-critical — continue without education context
    }

    const { callGeminiJSON } = await import('../utils/gemini.ts');

    const buildPrompt = (count: number) => `Based on the following transcript, create a comprehensive quiz with exactly ${count} multiple-choice questions.
The difficulty level of the questions should be: ${safeDifficulty}.

Each question should:
1. Test understanding of key concepts, facts, or themes appropriate for the requested difficulty level.
2. Have 4 answer options (A, B, C, D)
3. Have exactly one correct answer (the correctAnswer field should be 0, 1, 2, or 3 corresponding to the option's index)
4. Include a brief explanation for the correct answer (1-2 sentences max)
${educationBlock}
Transcript:
"${transcript.substring(0, 6000)}"

You MUST respond with ONLY a valid JSON object (no markdown, no extra text) in this exact format:
{
  "title": "Quiz title here",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this answer is correct (1-2 sentences)."
    }
  ]
}

IMPORTANT: Return exactly ${count} questions. The correctAnswer must be 0, 1, 2, or 3. Each question must have exactly 4 options. Return ONLY valid JSON.`;

    // FIX: maxOutputTokens was 4096 — too small for multi-question quizzes with
    // explanations, causing Gemini to truncate mid-string → JSON_PARSE_ERROR →
    // broken output. 16384 gives safe headroom for up to 20 questions.
    // Retry once with half the count if a truncation error is detected.
    let quizData: any = null;
    let lastError = '';

    for (const attemptCount of [parsedNumQuestions, Math.max(3, Math.floor(parsedNumQuestions / 2))]) {
      const aiResult = await callGeminiJSON<any>(buildPrompt(attemptCount), {
        maxOutputTokens: 16384,
      });

      if (aiResult.success && aiResult.data) {
        quizData = aiResult.data;
        console.log(`Quiz content received (attempt count: ${attemptCount})`);
        break;
      }

      lastError = aiResult.error ?? 'Unknown error';
      console.error(`Gemini attempt failed (count=${attemptCount}):`, lastError);

      logSystemError(supabaseAdmin, {
        severity: 'warning',
        source: 'generate-quiz',
        component: 'ai-call',
        error_code: 'GEMINI_FAILURE',
        message: `Gemini JSON call failed (count=${attemptCount}): ${lastError}`,
        user_id: logUserId,
      });

      // Only retry on truncation errors — other errors won't improve with fewer questions
      const isTruncation = lastError.includes('JSON_PARSE_ERROR') ||
                           lastError.includes('Unterminated') ||
                           lastError.includes('Unexpected end');
      if (!isTruncation) break;
    }

    if (!quizData) {
      throw new Error(
        lastError.includes('JSON_PARSE_ERROR') || lastError.includes('Unterminated')
          ? 'The AI response was cut off. Please try again with fewer questions.'
          : `AI generation failed: ${lastError || 'No data received from the model.'}`
      );
    }

    // Gemini sometimes wraps its response in markdown code fences — strip them
    if (typeof quizData === 'string') {
      const cleaned = (quizData as string)
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      try {
        quizData = JSON.parse(cleaned);
      } catch (_parseErr) {
        throw new Error('AI returned malformed JSON. Please try again.');
      }
    }

    if (!quizData?.title || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error('AI returned an empty or invalid quiz structure. Please try again.');
    }

    // Filter out structurally invalid questions
    quizData.questions = quizData.questions.filter((q: any, index: number) => {
      const valid =
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctAnswer === 'number' &&
        q.correctAnswer >= 0 &&
        q.correctAnswer <= 3;
      if (!valid) console.warn(`Dropping invalid question at index ${index}`);
      return valid;
    });

    if (quizData.questions.length === 0) {
      throw new Error('All generated questions were invalid. Please try again.');
    }

    console.log(`Quiz generated successfully: "${quizData.title}" (${quizData.questions.length} questions)`);

    return new Response(JSON.stringify(quizData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});