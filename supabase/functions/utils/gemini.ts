// supabase/functions/utils/gemini.ts
// Shared Gemini AI helper for all edge functions

const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-pro',
  'gemini-1.5-pro',
];

const MAX_RETRIES = 3;

interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  systemInstruction?: string;
}

interface GeminiResult {
  success: boolean;
  text?: string;
  error?: string;
  model?: string;
}

/**
 * Call Gemini API with automatic model fallback chain.
 * Retries on 429/503, switches models on failure.
 */
export async function callGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<GeminiResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX');
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY not configured' };
  }

  const {
    temperature = 0.3,
    maxOutputTokens = 4096,
    topK = 40,
    topP = 0.95,
    systemInstruction,
  } = options;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const model = MODEL_CHAIN[attempt % MODEL_CHAIN.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens, topK, topP },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 429 || response.status === 503) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (response.status === 400) {
        const errorText = await response.text();
        return { success: false, error: `BAD_REQUEST: ${errorText}` };
      }

      if (!response.ok) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        continue;
      }

      return { success: true, text, model };
    } catch (err) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
  }

  return { success: false, error: 'ALL_MODELS_FAILED' };
}

/**
 * Call Gemini and parse JSON response.
 * Strips markdown code fences and parses JSON.
 */
export async function callGeminiJSON<T = any>(
  prompt: string,
  options: GeminiOptions = {}
): Promise<{ success: boolean; data?: T; error?: string; model?: string }> {
  const result = await callGemini(prompt, options);

  if (!result.success || !result.text) {
    return { success: false, error: result.error || 'No response' };
  }

  try {
    let jsonText = result.text.trim();
    // Strip markdown code fences
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    const data = JSON.parse(jsonText) as T;
    return { success: true, data, model: result.model };
  } catch (err) {
    return { success: false, error: `JSON_PARSE_ERROR: ${err.message}` };
  }
}
