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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
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

    // Clamp question count to safe range
    const questionCount = Math.max(1, Math.min(20, Number(num_questions) || 8));
    
    console.log('Generating AI Smart Quiz');
    console.log('User topics:', user_topics);
    console.log('Focus areas:', focus_areas);
    console.log('Requested questions:', questionCount);
    console.log('Requested difficulty:', difficulty);
    console.log('Recent performance samples:', recent_performance.length);
    console.log('Learning style:', learning_style);

    // Fetch education context for curriculum-aligned questions
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

    // Analyze performance to personalize the quiz
    const performanceAnalysis = analyzePerformance(recent_performance);

    // Override difficulty if user selected a specific one
    if (difficulty !== 'auto') {
      performanceAnalysis.recommendedDifficulty = difficulty;
    }
    
    // Determine question types based on learning style
    const questionTypes = getQuestionTypesForStyle(learning_style);
    
    // Build personalized prompt
    const prompt = buildAIPrompt(user_topics, focus_areas, performanceAnalysis, questionTypes, educationBlock, questionCount);

    console.log('Calling Gemini API for AI Smart Quiz...');

    // call shared helper which handles model chain and OpenRouter fallback
    const { callGeminiJSON } = await import('../utils/gemini.ts');
    const aiResult = await callGeminiJSON<any>(prompt, { maxOutputTokens: 4096 });

    let quizData: any;
    if (aiResult.success && aiResult.data) {
      quizData = aiResult.data;
      console.log('Generated AI quiz content received');
    } else {
      console.error('Gemini API error or no data:', aiResult.error);
    }

    // validate result
    if (!quizData || !quizData.title || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      // fallback quiz using adaptive template
      quizData = createAdaptiveFallbackQuiz(user_topics, focus_areas, performanceAnalysis, questionCount);
      console.warn('Falling back to adaptive quiz due to invalid AI output.');
    }

    // Validate each question's structure and filter out bad ones
    quizData.questions = quizData.questions.filter((q: any, index: number) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 ||
          typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
        console.warn(`Dropping invalid AI question at index ${index}`);
        return false;
      }
      return true;
    });

    // If all questions filtered out, use fallback
    if (quizData.questions.length === 0) {
      quizData = createAdaptiveFallbackQuiz(user_topics, focus_areas, performanceAnalysis, questionCount);
    }

    console.log('AI Smart Quiz generated successfully:', quizData.title);
    console.log('Number of questions:', quizData.questions.length);

    return new Response(JSON.stringify(quizData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in generate-ai-quiz function:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Failed to generate AI Smart Quiz. Please check your configuration and try again.'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

// Helper function to analyze user performance
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
    strengthAreas: ['General Knowledge'], // This would be enhanced with topic analysis
    weakAreas: recentPerformance.filter(p => (p.score || p.percentage) < 70).length > 2 ? ['Application Questions'] : []
  };
}

// Helper function to determine question types based on learning style
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

// Helper function to build the AI prompt
function buildAIPrompt(topics: string[], focusAreas: string[], performance: any, questionTypes: string[], educationBlock: string = '', questionCount: number = 8) {
  const difficultyInstruction = performance.recommendedDifficulty === 'easy'
    ? 'All questions should be at an easy/introductory level.'
    : performance.recommendedDifficulty === 'hard'
    ? 'All questions should be at a hard/advanced level requiring deep understanding.'
    : 'Questions should gradually increase in complexity from easy to hard.';

  return `Create an adaptive, personalized quiz with exactly ${questionCount} multiple-choice questions on the following topics.

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

You MUST respond with ONLY a valid JSON object (no markdown, no extra text) in this exact format:
{
  "title": "Quiz title here",
  "questions": [
    {
      "question": "A specific, factual question about the topic?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Clear explanation of why this is correct.",
      "difficulty": "easy",
      "topic": "Topic name"
    }
  ],
  "personalization_notes": "Brief note about quiz personalization."
}

IMPORTANT: correctAnswer must be 0, 1, 2, or 3. Each question must have exactly 4 options. Return ONLY valid JSON.`;
}

// Fallback function for adaptive quiz generation
function createAdaptiveFallbackQuiz(topics: string[], focusAreas: string[], performance: any, count = 8) {
  const mainTopic = topics[0] || 'General Knowledge';
  const questions: any[] = [];
  for (let i = 0; i < count; i++) {
    const difficulty = i < 2 ? 'easy' : i < 5 ? 'medium' : 'hard';
    questions.push({
      question: i === 0
        ? `What is a fundamental concept in ${mainTopic}?`
        : i === 1
        ? `How would you apply ${mainTopic} knowledge to solve a real-world problem?`
        : i === 2
        ? `What distinguishes expert understanding from basic knowledge in ${mainTopic}?`
        : `Practice question ${i + 1} related to ${mainTopic}`,
      options: [
        "Understanding basic principles and foundations",
        "Memorizing advanced technical details",
        "Focusing only on practical applications",
        "Ignoring theoretical background"
      ],
      correctAnswer: 0,
      explanation: `This question is designed to reinforce key ideas in ${mainTopic}.`,
      difficulty,
      topic: mainTopic
    });
  }

  return {
    title: `Adaptive Quiz: ${mainTopic}`,
    questions,
    personalization_notes: `This adaptive quiz focuses on ${mainTopic} with questions tailored to promote learning growth.`
  };
}