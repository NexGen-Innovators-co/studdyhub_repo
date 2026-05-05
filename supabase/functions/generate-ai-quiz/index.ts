// supabase/functions/generate-ai-quiz/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth } from '../utils/subscription-validator.ts';
import { getEducationContext, formatEducationContextForPrompt } from '../_shared/educationContext.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      user_topics = ['General Knowledge'],
      focus_areas = [],
      num_questions = 8,
      difficulty = 'auto',
      recent_performance = [],
      learning_style = 'adaptive'
    } = await req.json();

    const questionCount = Math.max(1, Math.min(20, Number(num_questions) || 8));

    console.log('Generating AI Smart Quiz');
    console.log('User topics:', user_topics);
    console.log('Focus areas:', focus_areas);
    console.log('Requested questions:', questionCount);
    console.log('Requested difficulty:', difficulty);
    console.log('Recent performance samples:', recent_performance.length);
    console.log('Learning style:', learning_style);

    let educationBlock = '';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
        if (userId) {
          const eduCtx = await getEducationContext(supabaseAdmin, userId);
          if (eduCtx) {
            educationBlock = `\n${formatEducationContextForPrompt(eduCtx)}\nAlign questions to this student's curriculum, exam format, and subject focus where relevant.\n`;
          }
        }
      }
    } catch (_eduErr) {
      // Non-critical — continue without education context
    }

    const performanceAnalysis = analyzePerformance(recent_performance);
    if (difficulty !== 'auto') {
      performanceAnalysis.recommendedDifficulty = difficulty;
    }

    const questionTypes = getQuestionTypesForStyle(learning_style);
    const randomSeed = Math.random().toString(36).substring(2, 10);
    const timestamp = new Date().toISOString();

    const { callGeminiJSON } = await import('../utils/gemini.ts');

    console.log('Calling Gemini API for AI Smart Quiz...');

    // FIX: The previous maxOutputTokens of 4096 was too small. The quiz JSON
    // for 8–20 questions with explanations easily exceeds 4096 tokens, causing
    // Gemini to truncate mid-string → JSON_PARSE_ERROR → silent fallback to
    // the broken static quiz. 16384 gives ample room for any question count
    // within the allowed range (1–20).
    //
    // Strategy: try once at full question count. If the result comes back
    // truncated/invalid, retry once with a reduced count as a safety net.
    let quizData: any = null;
    let lastError = '';

    for (const attemptCount of [questionCount, Math.max(3, Math.floor(questionCount / 2))]) {
      const prompt = buildAIPrompt(
        user_topics,
        focus_areas,
        performanceAnalysis,
        questionTypes,
        educationBlock,
        attemptCount,
        randomSeed,
        timestamp
      );

      const aiResult = await callGeminiJSON<any>(prompt, {
        maxOutputTokens: 16384,
        temperature: 0.9,
      });

      if (aiResult.success && aiResult.data) {
        quizData = aiResult.data;
        console.log(`Generated AI quiz content received (attempt count: ${attemptCount})`);
        break;
      }

      lastError = aiResult.error ?? 'Unknown error';
      console.error(`Gemini attempt failed (count=${attemptCount}):`, lastError);

      // If it's a truncation/parse error, retry with fewer questions.
      // For other errors (auth, quota, network), retrying won't help.
      const isTruncation = lastError.includes('JSON_PARSE_ERROR') ||
                           lastError.includes('Unterminated') ||
                           lastError.includes('Unexpected end');
      if (!isTruncation) break;
    }

    if (!quizData) {
      throw new Error(
        lastError.includes('JSON_PARSE_ERROR') || lastError.includes('Unterminated')
          ? 'The AI response was cut off unexpectedly. Please try again with fewer questions.'
          : `AI generation failed: ${lastError || 'No data received from the model.'}`
      );
    }

    // Gemini sometimes wraps its response in markdown code fences even when
    // told not to. Strip them before further validation.
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
      if (!valid) console.warn(`Dropping invalid AI question at index ${index}`);
      return valid;
    });

    if (quizData.questions.length === 0) {
      throw new Error('All AI-generated questions were invalid. Please try again.');
    }

    console.log('AI Smart Quiz generated successfully:', quizData.title);
    console.log('Number of questions:', quizData.questions.length);

    return new Response(JSON.stringify(quizData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-ai-quiz function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Failed to generate AI Smart Quiz. Please check your configuration and try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function analyzePerformance(recentPerformance: any[]) {
  if (!recentPerformance || recentPerformance.length === 0) {
    return {
      averageScore: 75,
      recommendedDifficulty: 'intermediate',
      needsReview: false,
      strengthAreas: [],
      weakAreas: []
    };
  }

  const scores = recentPerformance.map(p => p.score || p.percentage || 50);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  let recommendedDifficulty = 'intermediate';
  if (averageScore >= 85) recommendedDifficulty = 'hard';
  if (averageScore <= 60) recommendedDifficulty = 'easy';

  return {
    averageScore,
    recommendedDifficulty,
    needsReview: averageScore < 70,
    strengthAreas: ['General Knowledge'],
    weakAreas: recentPerformance.filter(p => (p.score || p.percentage) < 70).length > 2
      ? ['Application Questions']
      : []
  };
}

function getQuestionTypesForStyle(learningStyle: string) {
  const styles: any = {
    visual: ['diagram_interpretation', 'pattern_recognition', 'spatial_reasoning'],
    auditory: ['verbal_reasoning', 'listening_comprehension', 'oral_traditions'],
    kinesthetic: ['practical_application', 'real_world_scenarios', 'hands_on_problems'],
    reading: ['text_analysis', 'vocabulary', 'comprehension_questions'],
    adaptive: ['mixed_formats', 'critical_thinking', 'problem_solving']
  };
  return styles[learningStyle] || styles.adaptive;
}

function buildAIPrompt(
  topics: string[],
  focusAreas: string[],
  performance: any,
  questionTypes: string[],
  educationBlock: string = '',
  questionCount: number = 8,
  randomSeed: string = '',
  timestamp: string = ''
) {
  const difficultyInstruction = performance.recommendedDifficulty === 'easy'
    ? 'All questions should be at an easy/introductory level.'
    : performance.recommendedDifficulty === 'hard'
    ? 'All questions should be at a hard/advanced level requiring deep understanding.'
    : 'Questions should gradually increase in complexity from easy to hard.';

  return `Create an adaptive, personalized quiz with exactly ${questionCount} multiple-choice questions on the following topics.

GENERATION ID: ${randomSeed} (${timestamp})
IMPORTANT: This is a unique quiz generation request. You MUST produce a completely different set of
questions from any previous generation — different question angles, different facts tested, different
wording, different correct answer positions. Do NOT repeat questions you may have generated before.

LEARNING CONTEXT:
- Topics to cover: ${topics.join(', ')}
- Focus areas: ${focusAreas.length > 0 ? focusAreas.join(', ') : 'general comprehension'}
- User's recent performance: ${performance.averageScore.toFixed(1)}% average
- Difficulty level: ${performance.recommendedDifficulty}
- Question styles: ${questionTypes.join(', ')}
${educationBlock}
QUIZ REQUIREMENTS:
1. Create exactly ${questionCount} questions. ${difficultyInstruction}
2. Each question MUST test real factual knowledge about the specified topics — not generic filler
3. Include questions that address identified focus areas
4. Questions should test both recall and application of knowledge
5. Make all 4 options plausible — avoid obviously wrong distractors
6. Each question must have exactly 4 options and one correct answer
7. Vary the position of the correct answer across questions (do not always make it option 0)
8. Cover a broad range of subtopics within the chosen topics — avoid clustering around one subtopic
9. Keep explanations concise (1–2 sentences max) to avoid bloating the response

You MUST respond with ONLY a valid JSON object (no markdown, no extra text) in this exact format:
{
  "title": "Quiz title here",
  "questions": [
    {
      "question": "A specific, factual question about the topic?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Concise explanation (1-2 sentences only).",
      "difficulty": "easy",
      "topic": "Topic name"
    }
  ],
  "personalization_notes": "Brief note about quiz personalization."
}

IMPORTANT: correctAnswer must be 0, 1, 2, or 3. Each question must have exactly 4 options. Return ONLY valid JSON.`;
}