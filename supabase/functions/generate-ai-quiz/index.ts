// supabase/functions/generate-ai-quiz/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      recent_performance = [],
      learning_style = 'adaptive'
    } = await req.json();
    
    console.log('Generating AI Smart Quiz');
    console.log('User topics:', user_topics);
    console.log('Focus areas:', focus_areas);
    console.log('Recent performance samples:', recent_performance.length);
    console.log('Learning style:', learning_style);

    // Analyze performance to personalize the quiz
    const performanceAnalysis = analyzePerformance(recent_performance);
    
    // Determine question types based on learning style
    const questionTypes = getQuestionTypesForStyle(learning_style);
    
    // Build personalized prompt
    const prompt = buildAIPrompt(user_topics, focus_areas, performanceAnalysis, questionTypes);

    console.log('Calling Gemini API for AI Smart Quiz...');

    // call shared helper which handles model chain and OpenRouter fallback
    const { callGeminiJSON } = await import('../utils/gemini.ts');
    const aiResult = await callGeminiJSON<any>(prompt, { maxOutputTokens: 2000 });

    let quizData: any;
    if (aiResult.success && aiResult.data) {
      quizData = aiResult.data;
      console.log('Generated AI quiz content received');
    } else {
      console.error('Gemini API error or no data:', aiResult.error);
    }

    // validate result
    if (!quizData || !quizData.title || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      // fallback quiz using default 8‑question adaptive template
      quizData = createAdaptiveFallbackQuiz(user_topics, focus_areas, performanceAnalysis, 8);
      console.warn('Falling back to adaptive quiz due to invalid AI output.');
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
function buildAIPrompt(topics: string[], focusAreas: string[], performance: any, questionTypes: string[]) {
  return `Create an adaptive, personalized quiz with 8 questions that:

LEARNING CONTEXT:
- Topics to cover: ${topics.join(', ')}
- Focus areas: ${focusAreas.length > 0 ? focusAreas.join(', ') : 'general comprehension'}
- User's recent performance: ${performance.averageScore.toFixed(1)}% average
- Recommended difficulty: ${performance.recommendedDifficulty}
- Question styles: ${questionTypes.join(', ')}

QUIZ REQUIREMENTS:
1. Create 8 questions that gradually increase in complexity
2. Mix question types to engage different learning styles
3. Include 2-3 questions that address identified focus areas
4. Ensure questions test both recall and application of knowledge
5. Each question must have:
   - Clear, unambiguous question text
   - 4 plausible answer options
   - One correct answer (correctAnswer: 0-3)
   - Detailed explanation
   - Difficulty level (easy/medium/hard)
   - Topic classification

PERSONALIZATION GOALS:
- Start with confidence-building questions
- Include challenging questions to promote growth
- Balance between familiar topics and new applications
- Provide explanations that enhance learning

Respond with a JSON object containing the quiz title, questions array, and personalization notes.`;
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