import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { createSubscriptionValidator, createErrorResponse } from '../utils/subscription-validator.ts';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const createFlashcardPrompt = (content, userProfile, numberOfCards = 10, difficulty = 'medium', focusAreas)=>{
  const focusSection = focusAreas && focusAreas.length > 0 ? `\n\nFOCUS AREAS: Prioritize creating flashcards about: ${focusAreas.join(', ')}` : '';
  return `You are an expert educational content creator specializing in creating effective flashcards for learning and retention.

TASK: Create ${numberOfCards} high-quality flashcards from the provided note content.

STUDENT PROFILE:
- Learning Style: ${userProfile.learning_style || 'balanced'}
- Preferred Explanation Style: ${userProfile.learning_preferences?.explanation_style || 'balanced'}
- Difficulty Level: ${difficulty}

FLASHCARD CREATION GUIDELINES:

1. **Question Quality**:
- Clear, specific, and unambiguous questions
- Test understanding, not just memorization
- Use active recall principles
- Vary question types:
* Definition questions: "What is...?"
* Application questions: "How would you...?"
* Comparison questions: "What's the difference between...?"
* Analysis questions: "Why does...?"
* Example questions: "Give an example of..."

2. **Answer Quality**:
- Concise but complete (2-4 sentences ideal)
- Include key details and context
- Use examples when helpful
- Maintain accuracy
- Adapt to student's learning style

3. **Difficulty Levels**:
- Easy: Basic definitions, simple facts, terminology
- Medium: Application, understanding relationships, explanations
- Hard: Analysis, synthesis, evaluation, complex connections

4. **Best Practices**:
- One concept per card (atomic principle)
- Use mnemonic devices when appropriate
- Include context when needed
- Progressive difficulty throughout the set
- Avoid ambiguous or trick questions
- Make questions self-contained (don't require external context)

5. **Categories**:
- Assign relevant categories based on content themes
- Examples: "Key Concepts", "Definitions", "Formulas", "Examples", "Applications"

${focusSection}

NOTE CONTENT:
\`\`\`
${content.slice(0, 15000)}
\`\`\`

OUTPUT FORMAT (Return ONLY valid JSON, no markdown code blocks):
{
"flashcards": [
{
"front": "Clear, specific question here",
"back": "Comprehensive answer here (2-4 sentences)",
"category": "Category name",
"difficulty": "easy|medium|hard",
"hint": "Optional helpful hint (only if really needed)"
}
],
"metadata": {
"totalCards": ${numberOfCards},
"coverageAreas": ["list", "of", "main", "topics", "covered"],
"suggestedStudyOrder": "Description of recommended order to study these cards"
}
}

Generate exactly ${numberOfCards} diverse, high-quality flashcards covering the key concepts from the note. Ensure variety in question types and progressive difficulty.`;
};
// In-memory cache (for demonstration purposes only - use a more robust caching solution in production)
const flashcardCache = new Map();
async function generateFlashcardsWithRetry(prompt, maxRetries = 3, initialDelay = 2000, maxDelay = 30000) {
  let delay = initialDelay;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.8,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192
    }
  });
  for(let i = 0; i < maxRetries; i++){
    try {
      // console.log(`Generating flashcards (attempt ${i + 1}/${maxRetries}), delay: ${delay}ms`);
      const result = await model.generateContent(prompt);
      // console.log(`Flashcard generation successful on attempt ${i + 1}`);
      return result;
    } catch (error) {
      // console.error(`Attempt ${i + 1} failed:`, error);
      // console.error('Full error object:', error);
      if (error?.status === 429) {
        // console.warn(`Rate limit exceeded. Retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise((resolve)=>setTimeout(resolve, Math.min(delay, maxDelay)));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Re-throw non-429 errors
      }
    }
  }
  throw new Error('Max retries reached. Failed to generate flashcards.');
}
serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: CORS_HEADERS
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || ''
        }
      }
    });
    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        details: 'Valid authentication required'
      }), {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
    }

    // Check AI message/generation limit (flashcards use AI)
    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkAiMessageLimit(user.id);
    
    if (!limitCheck.allowed) {
      return createErrorResponse(limitCheck.message || 'AI generation limit exceeded', 403);
    }

    // Parse request body
    const body = await req.json();
    const { noteContent, noteId, userProfile, numberOfCards = 10, difficulty = 'medium', focusAreas } = body;
    // Validate inputs
    if (!noteContent?.trim()) {
      return new Response(JSON.stringify({
        error: 'Note content is required',
        details: 'Cannot generate flashcards from empty content'
      }), {
        status: 400,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
    }
    if (numberOfCards < 1 || numberOfCards > 50) {
      return new Response(JSON.stringify({
        error: 'Invalid number of cards',
        details: 'Number of cards must be between 1 and 50'
      }), {
        status: 400,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
    }
    const cacheKey = `${noteId}-${user.id}-${numberOfCards}-${difficulty}-${focusAreas?.join(',') || ''}`;
    if (flashcardCache.has(cacheKey)) {
      // console.log('Returning flashcards from cache');
      const cachedData = flashcardCache.get(cacheKey);
      return new Response(JSON.stringify({
        success: true,
        flashcards: cachedData.flashcards,
        metadata: cachedData.metadata,
        count: cachedData.flashcards.length,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
    }
    // Generate flashcards with AI (using retry mechanism)
    try {
      const prompt = createFlashcardPrompt(noteContent, userProfile, numberOfCards, difficulty, focusAreas);
      // console.log(`Generating ${numberOfCards} flashcards for user ${user.id}`);
      const result = await generateFlashcardsWithRetry(prompt);
      const response = await result.response;
      let aiContent = response.text();
      // Clean up the response
      aiContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      // Parse AI response
      let flashcardsData;
      try {
        flashcardsData = JSON.parse(aiContent);
      } catch (parseError) {
        // console.error('JSON parse error:', parseError);
        // console.error('AI Response:', aiContent.slice(0, 500));
        return new Response(JSON.stringify({
          error: 'Failed to parse AI response',
          details: 'The AI generated invalid JSON. Please try again.'
        }), {
          status: 500,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json'
          }
        });
      }
      // Validate flashcards structure
      if (!flashcardsData.flashcards || !Array.isArray(flashcardsData.flashcards)) {
        return new Response(JSON.stringify({
          error: 'Invalid flashcards format',
          details: 'AI response did not contain valid flashcards array'
        }), {
          status: 500,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json'
          }
        });
      }
      // Add unique IDs and timestamps to flashcards
      const timestamp = Date.now();
      const flashcardsWithIds = flashcardsData.flashcards.map((card, index)=>({
          id: `${timestamp}-${index}`,
          front: card.front || '',
          back: card.back || '',
          category: card.category || null,
          difficulty: card.difficulty || difficulty,
          hint: card.hint || null,
          created_at: new Date().toISOString()
        }));
      // Store flashcards in database (if flashcards table exists)
      if (noteId) {
        try {
          const flashcardsToInsert = flashcardsWithIds.map((card)=>({
              user_id: user.id,
              note_id: noteId,
              front: card.front,
              back: card.back,
              category: card.category,
              difficulty: card.difficulty,
              hint: card.hint,
              created_at: card.created_at
            }));
          const { error: dbError } = await supabaseClient.from('flashcards').insert(flashcardsToInsert);
          if (dbError) {
            // console.warn('Could not store flashcards in database:', dbError.message);
          // Non-critical error - continue without storing
          } else {
            // console.log(`Successfully stored ${flashcardsWithIds.length} flashcards in database`);
          }
        } catch (dbError) {
          // console.warn('Database error (non-critical):', dbError);
        // Continue without storing
        }
      }
      const responseData = {
        success: true,
        flashcards: flashcardsWithIds,
        metadata: flashcardsData.metadata || {
          totalCards: flashcardsWithIds.length,
          coverageAreas: [],
          suggestedStudyOrder: 'Study in the order presented for progressive difficulty'
        },
        count: flashcardsWithIds.length,
        timestamp: new Date().toISOString()
      };
      // Store result in cache
      flashcardCache.set(cacheKey, responseData);
      // Return success response
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
    } catch (aiError) {
      // console.error('AI generation failed after retries:', aiError);
      return new Response(JSON.stringify({
        error: 'AI generation failed',
        details: aiError.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // console.error('Flashcard generation error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate flashcards',
      details: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      }
    });
  }
});

