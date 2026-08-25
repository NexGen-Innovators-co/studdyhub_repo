// supabase/functions/generate-spelling-words/index.ts
// Dedicated Spelling Bee word generator for the Explorer (kids) tier.
// Returns `{ words: [{ word, definition, sentence }] }` with kid-friendly English
// words scaled to the game level (1 = very easy 3-letter words … 4+ = 6–8 letters).
// Uses the shared utils/gemini.ts chain (Hugging Face → xAI → Groq → SambaNova →
// OpenRouter) so it is resilient exactly like the other generate-* functions.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const level = Math.max(1, Math.min(8, Number(body.level) || 1));
    const requestedCount = Math.max(1, Math.min(12, Number(body.count) || 5));
    const classLevel = (body.class_level as string) || '';

    console.log('Generating Spelling Bee words');
    console.log('Level:', level);
    console.log('Requested count:', requestedCount);
    console.log('Class level:', classLevel || '(from level)');

    const { callGeminiJSON } = await import('../utils/gemini.ts');
    const prompt = buildWordPrompt(level, requestedCount, classLevel);

    const aiResult = await callGeminiJSON<Array<{ word?: string; definition?: string; sentence?: string }>>(
      prompt,
      {
        maxOutputTokens: 4096,
        temperature: 0.9,
      }
    );

    if (!aiResult.success || !aiResult.data) {
      throw new Error(
        aiResult.error?.includes('JSON_PARSE_ERROR') || aiResult.error?.includes('Unterminated')
          ? 'The AI response was cut off unexpectedly. Please try again.'
          : `AI generation failed: ${aiResult.error || 'No data received from the model.'}`
      );
    }

    // Validate + sanitize: letters only, 2–9 chars, dedupe, keep definition/sentence.
    const seen = new Set<string>();
    const words: Array<{ word: string; definition: string; sentence: string }> = [];
    for (const item of aiResult.data) {
      if (!item || typeof item !== 'object') continue;
      const rawWord = String(item.word ?? '').trim();
      const word = rawWord.toLowerCase();
      if (word.length < 2 || word.length > 9) continue;
      if (!/^[a-z]+$/.test(word)) continue;
      if (seen.has(word)) continue;
      seen.add(word);
      words.push({
        word,
        definition: String(item.definition ?? '').trim() || 'A word we can spell!',
        sentence: String(item.sentence ?? '').trim() || `Can you spell "${word}"?`
      });
    }

    if (words.length === 0) {
      throw new Error('All AI-generated words were invalid. Please try again.');
    }

    console.log('Spelling Bee words generated successfully:', words.length);
    return new Response(JSON.stringify({ words }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in generate-spelling-words function:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to generate spelling words. Please check your configuration and try again.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function buildWordPrompt(level: number, count: number, classLevel: string): string {
  const difficultyRule =
    level === 1
      ? 'level 1 = very easy 3-letter words'
      : level === 2
      ? 'level 2 = easy 4-letter words'
      : level === 3
      ? 'level 3 = 5-letter words'
      : 'level 4+ = 6-8 letter words';
  const classContext = classLevel
    ? ` The student is in ${classLevel}.`
    : '';

  return `You are Ollie, a friendly AI tutor for Basic & JHS students in Ghana. Generate exactly ${count}
simple English spelling words for Spelling Bee level ${level}. Difficulty by level:
${difficultyRule}. Use common everyday words a Ghanaian primary student knows.${classContext}
For every word include a kid-friendly definition and an example sentence (max 8 words).
Output ONLY a valid raw JSON array, no markdown, no extra text, exactly this shape:
[
  {"word": "cat", "definition": "A small furry animal that says meow", "sentence": "The cat sat on the mat."}
]
Every word MUST be a real, correctly-spelled English word with no spaces, hyphens or numbers.`;
}
