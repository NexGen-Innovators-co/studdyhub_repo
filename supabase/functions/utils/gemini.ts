import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';
import { callHfChat } from './huggingface.ts';
// supabase/functions/utils/gemini.ts
// Shared Gemini AI helper for all edge functions

const AI_PROVIDER_MODE = (Deno.env.get('AI_PROVIDER_MODE') || 'hf_only').toLowerCase();
const USE_PAID_MODELS = AI_PROVIDER_MODE === 'paid';

const MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro'
];

const MAX_RETRIES = 5;

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

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-PROVIDER FALLBACK CHAIN (mirrors gemini-chat's cascade)
// Provider order: xAI → Groq → SambaNova → OpenRouter.
// (Hugging Face is attempted first by callHfChat in hf_only mode; this chain
// is the resilient escape hatch when that router is down / rate-limited.)
// ─────────────────────────────────────────────────────────────────────────────
function buildFallbackProviders(): Array<{ name: string; url: string; key: string; models: string[] }> {
  const rawGroq = Deno.env.get('GROQ_API_KEY') || '';
  const rawXai = Deno.env.get('XAI_API_KEY') || Deno.env.get('GROK_API_KEY') || Deno.env.get('GROK_API_TOKEN') || '';
  // Detect key formats: Groq keys start with 'gsk_', xAI keys start with 'xai-'
  const groqApiKey = rawGroq.startsWith('gsk_') ? rawGroq : (rawXai.startsWith('gsk_') ? rawXai : rawGroq);
  const xaiApiKey = rawXai.startsWith('xai-') ? rawXai : (rawGroq.startsWith('xai-') ? rawGroq : rawXai);
  const sambaNovaApiKey = Deno.env.get('SAMBANOVA_API_KEY') || '';
  const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY') || '';

  const providers: Array<{ name: string; url: string; key: string; models: string[] }> = [];

  if (xaiApiKey) {
    providers.push({
      name: 'xAI',
      url: 'https://api.x.ai/v1/chat/completions',
      key: xaiApiKey,
      models: ['grok-3', 'grok-3-mini'],
    });
  }

  if (groqApiKey) {
    providers.push({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqApiKey,
      // Separate per-model daily buckets — worth trying even when one is TPD-exhausted.
      models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'qwen/qwen3.6-27b', 'groq/compound', 'llama-3.1-8b-instant'],
    });
  }

  if (sambaNovaApiKey) {
    providers.push({
      name: 'SambaNova',
      url: 'https://api.sambanova.ai/v1/chat/completions',
      key: sambaNovaApiKey,
      // Free tier: 200K tokens/day PER MODEL, no card required — separate quota from Groq.
      models: ['Meta-Llama-3.3-70B-Instruct', 'DeepSeek-V3.1', 'gpt-oss-120b'],
    });
  }

  if (openRouterApiKey) {
    providers.push({
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: openRouterApiKey,
      // Free catalog rotates — verified 2026-08-06 against openrouter.ai/models?max_price=0
      models: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'inclusionai/ling-3.0-flash:free', 'google/gemma-4-31b-it:free', 'poolside/laguna-s-2.1:free', 'openrouter/free'],
    });
  }

  return providers;
}

async function callOpenAIStyleFallback(
  prompt: string,
  systemInstruction: string | undefined,
  maxTokens: number,
  temperature: number,
): Promise<{ success: boolean; content?: string; modelUsed?: string; error?: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const providers = buildFallbackProviders();
  if (providers.length === 0) {
    return { success: false, error: 'NO_FALLBACK_PROVIDERS_CONFIGURED' };
  }

  for (const p of providers) {
    for (const model of p.models) {
      try {
        console.log(`[MultiFallback:utils-gemini] [${p.name}] Trying model: ${model}`);
        const start = Date.now();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (p.key) headers['Authorization'] = `Bearer ${p.key}`;

        const body: any = {
          model,
          messages,
          max_tokens: Math.min(maxTokens, 4096),
          temperature,
        };
        if (p.name === 'OpenRouter') {
          body.transforms = ['middle-out'];
        }

        const resp = await fetch(p.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        const duration = Date.now() - start;
        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log(`[MultiFallback:utils-gemini] [${p.name}_SUCCESS] Succeeded with model=${model} in ${duration}ms. Content length: ${content.length}`);
            return { success: true, content, modelUsed: `${p.name.toLowerCase()}/${model}` };
          }
        } else {
          const err = await resp.text();
          console.warn(`[MultiFallback:utils-gemini] [${p.name}_FAILURE] ${model} status=${resp.status} in ${duration}ms: ${err.substring(0, 200)}`);
        }
      } catch (err) {
        console.error(`[MultiFallback:utils-gemini] [${p.name}_EXCEPTION] Exception with model=${model}:`, err);
      }
    }
  }

  return { success: false, error: 'ALL_FALLBACK_PROVIDERS_FAILED' };
}

/**
 * Call Gemini API with automatic model fallback chain.
 * Retries on 429/503, switches models on failure.
 */
export async function callGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<GeminiResult> {
  const {
    temperature = 0.3,
    maxOutputTokens = 4096,
    topK = 40,
    topP = 0.95,
    systemInstruction,
  } = options;

  if (!USE_PAID_MODELS) {
    const hfResult = await callHfChat(prompt, {
      model: Deno.env.get('HF_FALLBACK_MODEL') || Deno.env.get('HF_DEFAULT_MODEL') || 'openai/gpt-oss-120b:fastest',
      parameters: { max_tokens: maxOutputTokens, temperature, top_p: topP },
    });

    if (hfResult.success && hfResult.text) {
      return { success: true, text: hfResult.text, model: hfResult.model || 'huggingface' };
    }

    // Hugging Face router failed (rate limit / outage / ALL_HF_MODELS_FAILED).
    // Cascade to the multi-provider chain instead of giving up — mirrors gemini-chat.
    console.warn(`[utils-gemini] HF-only attempt failed (${hfResult.error || 'HF_ONLY_FAILED'}). Cascading to xAI → Groq → SambaNova → OpenRouter...`);
    const fallback = await callOpenAIStyleFallback(prompt, systemInstruction, maxOutputTokens, temperature);
    if (fallback.success && fallback.content) {
      return { success: true, text: fallback.content, model: fallback.modelUsed || 'fallback-provider' };
    }

    return { success: false, error: hfResult.error || 'HF_ONLY_FAILED' };
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX');
  if (!apiKey) {
    const hfResult = await callHfChat(prompt, { model: Deno.env.get('HF_FALLBACK_MODEL') || Deno.env.get('HF_DEFAULT_MODEL') || 'gpt2', parameters: { max_new_tokens: maxOutputTokens, temperature } });
    if (hfResult.success && hfResult.text) {
      return { success: true, text: hfResult.text, model: hfResult.model || 'huggingface' };
    }

    const orResult = await callOpenRouterFallback(prompt, {
      source: 'utils-gemini',
      systemPrompt: systemInstruction,
      maxTokens: maxOutputTokens,
    });
    if (orResult.success && orResult.content) {
      return { success: true, text: orResult.content, model: 'openrouter/free' };
    }

    return { success: false, error: 'GEMINI_API_KEY not configured' };
  }

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

  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(prompt, { source: 'utils-gemini', systemPrompt: systemInstruction });
  if (orResult.success && orResult.content) {
    return { success: true, text: orResult.content, model: 'openrouter/free' };
  }

  // Hugging Face fallback if available
  const hfResult = await callHfChat(prompt, { model: Deno.env.get('HF_FALLBACK_MODEL') || Deno.env.get('HF_DEFAULT_MODEL') || 'gpt2', parameters: { max_new_tokens: maxOutputTokens, temperature } });
  if (hfResult.success && hfResult.text) {
    return { success: true, text: hfResult.text, model: hfResult.model || 'huggingface' };
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
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '').trim();

    // Sometimes the model wraps JSON in prose — try to extract the JSON object
    if (!jsonText.startsWith('{') && !jsonText.startsWith('[')) {
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
      }
    }

    const data = JSON.parse(jsonText) as T;
    return { success: true, data, model: result.model };
  } catch (err) {
    return { success: false, error: `JSON_PARSE_ERROR: ${err instanceof Error ? err.message : String(err)}` };
  }
}
