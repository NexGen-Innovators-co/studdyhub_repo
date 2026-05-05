/**
 * Shared OpenRouter fallback helper.
 *
 * When all Gemini models are exhausted (429 / 503 / etc.), call OpenRouter's
 * free tier as a last resort so the user still gets a response.
 *
 * Usage:
 *   import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';
 *
 *   // After Gemini model chain fails:
 *   const orResult = await callOpenRouterFallback(geminiContents, { maxTokens: 4096 });
 *   if (orResult.success) { /* use orResult.content * / }
 */

// ── Types ──────────────────────────────────────────────────────────────────────
export interface OpenRouterResult {
  success: boolean;
  content?: string;
  error?: string;
}

interface OpenRouterOptions {
  /** System prompt to prepend as a system message */
  systemPrompt?: string;
  /** Max tokens to generate (capped at 4096 for free tier) */
  maxTokens?: number;
  /** Sampling temperature */
  temperature?: number;
  /** Optional source label for logging */
  source?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const OPENROUTER_MAX_MSG_CHARS = 30_000;   // Truncate individual messages
const OPENROUTER_MAX_TOTAL_CHARS = 800_000; // ~200k tokens budget

// ── Converter: Gemini contents → OpenRouter (OpenAI) messages ──────────────────
function convertGeminiContentsToMessages(
  contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: any }> }>,
  systemPrompt?: string,
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // System prompt
  if (systemPrompt) {
    const capped =
      systemPrompt.length > OPENROUTER_MAX_MSG_CHARS * 2
        ? systemPrompt.substring(0, OPENROUTER_MAX_MSG_CHARS * 2) + '\n... [system prompt truncated]'
        : systemPrompt;
    messages.push({ role: 'system', content: capped });
  }

  // Convert contents (skip binary/inlineData parts)
  const converted: Array<{ role: string; content: string }> = [];
  for (const entry of contents) {
    const role = entry.role === 'model' ? 'assistant' : (entry.role || 'user');
    const textParts = (entry.parts || [])
      .map((p: any) => p.text || '')
      .filter(Boolean);
    if (textParts.length > 0) {
      let content = textParts.join('\n');
      if (content.length > OPENROUTER_MAX_MSG_CHARS) {
        content = content.substring(0, OPENROUTER_MAX_MSG_CHARS) + '\n... [truncated]';
      }
      converted.push({ role, content });
    }
  }

  // Budget: keep system message, fill from the end (recent messages first)
  const sysChars = messages.reduce((s, m) => s + m.content.length, 0);
  let budget = OPENROUTER_MAX_TOTAL_CHARS - sysChars;
  const selected: Array<{ role: string; content: string }> = [];
  for (let i = converted.length - 1; i >= 0; i--) {
    const len = converted[i].content.length;
    if (budget - len < 0 && selected.length > 0) break;
    budget -= len;
    selected.unshift(converted[i]);
  }

  messages.push(...selected);
  return messages;
}

// ── Public helper ──────────────────────────────────────────────────────────────
/**
 * Call OpenRouter free tier as fallback after Gemini model chain exhaustion.
 *
 * Accepts either:
 *  • Gemini `contents` array (auto-converted to OpenRouter messages)
 *  • A plain prompt string
 */
export async function callOpenRouterFallback(
  input: string | Array<{ role: string; parts: Array<{ text?: string; inlineData?: any }> }>,
  options: OpenRouterOptions = {},
): Promise<OpenRouterResult> {
  const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openRouterApiKey) {
    return { success: false, error: 'No OPENROUTER_API_KEY configured' };
  }

  const tag = options.source ? `[OpenRouter:${options.source}]` : '[OpenRouter]';

  // Build messages
  let messages: Array<{ role: string; content: string }>;
  if (typeof input === 'string') {
    messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: input });
  } else {
    messages = convertGeminiContentsToMessages(input, options.systemPrompt);
  }

  if (messages.length === 0) {
    return { success: false, error: 'No text content to send to OpenRouter' };
  }

  console.log(`${tag} All Gemini models failed. Falling back to OpenRouter (${messages.length} messages)...`);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages,
        max_tokens: Math.min(options.maxTokens || 4096, 4096),
        temperature: options.temperature ?? 0.7,
        transforms: ['middle-out'],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        console.log(`${tag} Fallback succeeded (${content.length} chars)`);
        return { success: true, content };
      }
      console.warn(`${tag} Response had no content`);
      return { success: false, error: 'OpenRouter returned empty content' };
    } else {
      const errText = await response.text();
      console.error(`${tag} HTTP ${response.status}: ${errText.substring(0, 300)}`);
      return { success: false, error: `OpenRouter HTTP ${response.status}` };
    }
  } catch (err) {
    console.error(`${tag} Network error:`, err);
    return { success: false, error: `OpenRouter network error: ${String(err)}` };
  }
}
