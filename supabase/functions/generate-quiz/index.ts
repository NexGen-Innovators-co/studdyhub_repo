import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, transcript, file_url } = await req.json();

    console.log('Generating quiz for:', name);
    console.log('Transcript length:', transcript?.length || 0);

    if (!transcript || transcript.trim().length < 100) {
      throw new Error('Transcript too short or missing. Need at least 100 characters for quiz generation.');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare the prompt for quiz generation
    const prompt = `Based on the following transcript, create a comprehensive quiz with exactly 5 multiple-choice questions. Each question should:
1. Test understanding of key concepts, facts, or themes
2. Have 4 answer options (A, B, C, D)
3. Have exactly one correct answer
4. Include a brief explanation for the correct answer

Transcript:
"${transcript.substring(0, 3000)}"

Respond with a JSON object in this exact format:
{
  "title": "Quiz: [brief title based on content]",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Make sure the JSON is valid and follows the exact structure above.`;

    console.log('Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an educational expert that creates high-quality quiz questions based on content. Always respond with valid JSON in the exact format requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    const generatedContent = data.choices[0].message.content;
    console.log('Generated content:', generatedContent.substring(0, 200) + '...');

    // Parse the JSON response
    let quizData: QuizData;
    try {
      // Clean the response to extract JSON
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      quizData = JSON.parse(jsonMatch[0]);
      
      // Validate the structure
      if (!quizData.title || !quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error('Invalid quiz data structure');
      }

      // Validate each question
      quizData.questions.forEach((q, index) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
            typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
          throw new Error(`Invalid question structure at index ${index}`);
        }
      });

      console.log('Quiz validation passed');

    } catch (parseError) {
      console.error('Failed to parse quiz JSON:', parseError);
      console.error('Raw content:', generatedContent);
      
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
    }

    console.log('Quiz generated successfully:', quizData.title);
    console.log('Number of questions:', quizData.questions.length);

    return new Response(JSON.stringify(quizData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-quiz function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to generate quiz. Please ensure the transcript contains sufficient educational content.'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});