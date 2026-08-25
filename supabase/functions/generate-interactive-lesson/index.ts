// supabase/functions/generate-interactive-lesson/index.ts
// Dedicated Edge Function for generating structured interactive lessons
// for "Today's Mission" / "Learn It" screen without conversational chat state,
// session bloat, or token truncation issues.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth } from '../utils/subscription-validator.ts';
import { getEducationContext, formatEducationContextForPrompt } from '../_shared/educationContext.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface LessonCheckQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface InteractiveLessonResponse {
  paragraphs: string[];
  tips: string[];
  vocabWords: string[];
  questions: LessonCheckQuestion[];
}

/** Best-effort robust JSON parser / repairer for model responses */
function repairJson(raw: string): any {
  const text = String(raw || '').trim();
  if (!text) return null;

  // 1. Direct parse or stripped code fences
  const clean = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  for (const candidate of [clean, text]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  // 2. Fenced content inside a larger response
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 3. Scan for outer JSON object bounds
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      return JSON.parse(text.substring(startIdx, endIdx + 1));
    } catch {
      // continue
    }
  }

  return null;
}

/** Normalise + validate interactive lesson schema */
function validateLesson(data: any): InteractiveLessonResponse | null {
  if (!data || typeof data !== 'object') return null;

  const rawParagraphs = Array.isArray(data.paragraphs) ? data.paragraphs : [];
  const paragraphs: string[] = rawParagraphs
    .map((p: any) => String(p || '').trim())
    .filter((p: string) => p.length > 0);

  const rawTips = Array.isArray(data.tips) ? data.tips : [];
  const tips: string[] = rawTips
    .map((t: any) => String(t || '').trim())
    .filter((t: string) => t.length > 0);

  const rawVocab = Array.isArray(data.vocabWords) ? data.vocabWords : (Array.isArray(data.vocab_words) ? data.vocab_words : []);
  const vocabWords: string[] = rawVocab
    .map((v: any) => String(v || '').trim())
    .filter((v: string) => v.length > 0);

  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  const questions: LessonCheckQuestion[] = [];

  for (const q of rawQuestions) {
    if (!q || typeof q !== 'object') continue;
    const questionText = String(q.question || q.title || '').trim();
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const options: string[] = rawOptions.map((o: any) => String(o || '').trim()).filter((o: string) => o.length > 0);

    if (!questionText || options.length < 2) continue;

    let correct = Number(q.correct);
    if (isNaN(correct) || correct < 0 || correct >= options.length) {
      if (typeof q.correctAnswer === 'string' && options.includes(q.correctAnswer)) {
        correct = options.indexOf(q.correctAnswer);
      } else {
        correct = 0;
      }
    }

    const explanation = String(q.explanation || 'Great job understanding this lesson!').trim();

    questions.push({
      question: questionText,
      options,
      correct,
      explanation,
    });
  }

  if (paragraphs.length === 0 || questions.length === 0) {
    return null;
  }

  return {
    paragraphs,
    tips,
    vocabWords,
    questions,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const {
      topic = '',
      title = '',
      subject_name = '',
      subject_code = '',
      grade_level = '',
      country = '',
      curriculum = '',
      learning_style = '',
      step_id = '',
      force_regenerate = false,
    } = body;

    const resolvedTopic = String(topic || title || '').trim();
    const resolvedSubject = String(subject_name || subject_code || 'General Studies').trim();
    const resolvedStepId = String(step_id || '').trim();

    console.log(`[generate-interactive-lesson] Request received: subject="${resolvedSubject}", topic="${resolvedTopic}", stepId="${resolvedStepId}", forceRegenerate=${force_regenerate}`);

    if (!resolvedTopic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Topic or title is required for generating an interactive lesson.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve user context & check cached lesson in Supabase
    let resolvedCountry = String(country || '').trim();
    let resolvedGrade = String(grade_level || '').trim();
    let resolvedCurriculum = String(curriculum || '').trim();
    let educationBlock = '';

    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    let supabaseAdmin: any = null;

    if (authHeader && supabaseUrl && supabaseServiceKey) {
      const userId = await extractUserIdFromAuth(authHeader);
      if (userId) {
        supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        // 1. Check if lesson is already cached in kid_roadmap_steps
        if (resolvedStepId && !force_regenerate) {
          try {
            const { data: stepRow, error: stepErr } = await supabaseAdmin
              .from('kid_roadmap_steps')
              .select('lesson_json')
              .eq('id', resolvedStepId)
              .maybeSingle();

            if (!stepErr && stepRow?.lesson_json) {
              const parsedCached = repairJson(stepRow.lesson_json);
              const validCached = validateLesson(parsedCached);
              if (validCached) {
                const elapsedMs = Date.now() - startTime;
                console.log(`[generate-interactive-lesson] [CACHE HIT] Returning cached lesson for step ${resolvedStepId} in ${elapsedMs}ms`);
                return new Response(
                  JSON.stringify({
                    success: true,
                    data: validCached,
                    cached: true,
                    elapsed_ms: elapsedMs,
                  }),
                  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          } catch (cacheLookupErr) {
            console.warn(`[generate-interactive-lesson] Cache lookup error:`, cacheLookupErr);
          }
        }

        const eduCtx = await getEducationContext(supabaseAdmin, userId);
        if (eduCtx) {
          educationBlock = `\n${formatEducationContextForPrompt(eduCtx)}\n`;
          if (!resolvedCountry && eduCtx.country) resolvedCountry = eduCtx.country;
          if (!resolvedGrade && eduCtx.yearOrGrade) resolvedGrade = eduCtx.yearOrGrade;
          if (!resolvedCurriculum && eduCtx.curriculum) resolvedCurriculum = eduCtx.curriculum;
        }
      }
    }

    if (!resolvedCountry) resolvedCountry = 'Ghana';
    if (!resolvedGrade) resolvedGrade = 'Primary / Basic School';

    console.log(`[generate-interactive-lesson] Building prompt for ${resolvedSubject} - "${resolvedTopic}" (${resolvedCountry}, ${resolvedGrade})`);

    const prompt = `You are Ollie, a friendly, lively, and encouraging AI tutor for elementary and basic school scholars.
Generate a high-quality, engaging, and age-appropriate interactive lesson.

Context & Specifications:
- Subject: ${resolvedSubject} (${subject_code || ''})
- Lesson Topic / Title: "${resolvedTopic}"
- Target Class/Grade Level: ${resolvedGrade}
- Country & Curriculum: ${resolvedCountry}${resolvedCurriculum ? ` (${resolvedCurriculum})` : ''}
${learning_style ? `- Preferred Learning Style: ${learning_style}` : ''}
${educationBlock ? `- Education Profile Details: ${educationBlock}` : ''}

Output strictly and ONLY a valid JSON object matching this schema:
{
  "paragraphs": [
    "2 to 3 engaging, clear explanatory paragraphs teaching the concept with simple everyday analogies and lively tone."
  ],
  "tips": [
    "2 to 3 actionable, encouraging study tips from Ollie"
  ],
  "vocabWords": [
    "3 to 5 key vocabulary words introduced in the lesson"
  ],
  "questions": [
    {
      "question": "Clear multiple choice check question testing this specific topic",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "A friendly 1-sentence explanation why this answer is right."
    }
  ]
}

Strict Rules:
1. Generate exactly 3 multiple-choice check questions testing different key parts of the lesson.
2. In "questions", vary the "correct" index (0, 1, 2, 3) across the questions so the correct answer is not always in the same position.
3. Every option must be unique, educational, and free of typos.
4. Output ONLY valid JSON. No conversational chatter, no reasoning tags, no markdown block syntax.`;

    const { callGeminiJSON } = await import('../utils/gemini.ts');
    console.log(`[generate-interactive-lesson] Dispatching AI call to multi-provider cascade...`);

    const aiResult = await callGeminiJSON<any>(prompt, {
      maxOutputTokens: 4096,
      temperature: 0.5,
    });

    if (!aiResult.success) {
      console.error(`[generate-interactive-lesson] AI cascade failure: ${aiResult.error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: aiResult.error || 'All AI models failed to generate the lesson. Please check API quota and try again.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedData = aiResult.data;
    if (typeof parsedData === 'string') {
      parsedData = repairJson(parsedData);
    }

    const validatedLesson = validateLesson(parsedData);
    if (!validatedLesson) {
      console.error(`[generate-interactive-lesson] Schema validation failed for model response. Model used: ${aiResult.model}. Raw preview: ${JSON.stringify(parsedData).slice(0, 300)}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI generated an incomplete or malformed lesson structure. Please try again.',
          model: aiResult.model,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[generate-interactive-lesson] [SUCCESS] Lesson generated successfully in ${elapsedMs}ms via model ${aiResult.model}. Paragraphs: ${validatedLesson.paragraphs.length}, Questions: ${validatedLesson.questions.length}`);

    // Persist to kid_roadmap_steps if step_id was provided
    if (resolvedStepId && supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('kid_roadmap_steps')
          .update({
            lesson_json: JSON.stringify(validatedLesson),
            updated_at: new Date().toISOString()
          })
          .eq('id', resolvedStepId);
        console.log(`[generate-interactive-lesson] Persisted lesson_json to kid_roadmap_steps for step ${resolvedStepId}`);
      } catch (saveErr) {
        console.warn(`[generate-interactive-lesson] Failed to persist lesson_json to cloud step:`, saveErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: validatedLesson,
        model: aiResult.model,
        elapsed_ms: elapsedMs,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    const elapsedMs = Date.now() - startTime;
    console.error(`[generate-interactive-lesson] [EXCEPTION] Unhandled error after ${elapsedMs}ms:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'An unexpected server error occurred while generating the lesson.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
