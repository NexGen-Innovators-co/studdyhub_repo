
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.92.0';
import { UserContextService } from './context-service.ts';
import { EnhancedPromptEngine } from './prompt-engine.ts';
import { StuddyHubActionsService } from './actions-service.ts';
import { AgenticCore, type UserIntent, type EntityMention } from './agentic-core.ts';
import { createStreamResponse, StreamingHandler } from './streaming-handler.ts';
import { createSubscriptionValidator, createErrorResponse } from '../utils/subscription-validator.ts';
import { callHfChat } from '../utils/huggingface.ts';
import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';
import { executeParsedActions, runAction, AI_ACTION_SCHEMA, getFriendlyActionLabel } from './actions_helper.ts';
import { DB_SCHEMA_DEFINITION } from './db_schema.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ─────────────────────────────────────────────────────────────────────────────
// QUOTA CIRCUIT-BREAKER
// Models that returned 429 in this instance lifetime are skipped immediately.
// Resets on cold-start (new Deno isolate). Per-model TTL: 60 seconds.
// ─────────────────────────────────────────────────────────────────────────────
const quotaExhaustedModels = new Map<string, number>(); // model → expiry timestamp
const QUOTA_COOLDOWN_MS = 60_000; // 60 s before retrying a 429'd model

function isQuotaExhausted(model: string): boolean {
  const expiry = quotaExhaustedModels.get(model);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) { quotaExhaustedModels.delete(model); return false; }
  return true;
}

function markQuotaExhausted(model: string): void {
  quotaExhaustedModels.set(model, Date.now() + QUOTA_COOLDOWN_MS);
  console.warn(`[QuotaCircuitBreaker] Model ${model} marked exhausted for ${QUOTA_COOLDOWN_MS / 1000}s`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const ENHANCED_PROCESSING_CONFIG = {
  MAX_INPUT_TOKENS: 2 * 1024 * 1024,
  MAX_OUTPUT_TOKENS: 8192,
  MAX_CONVERSATION_HISTORY: 500,
  SUMMARY_THRESHOLD: 30,
  RETRY_ATTEMPTS: 3,
  // Action planner uses fewer retries — if Gemini is quota-blown, fail fast
  ACTION_PLANNER_MAX_ATTEMPTS: 1,
  ACTION_FIX_ATTEMPTS: 3,
  ACTION_FIX_BACKOFF_MS: 1000
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE + SERVICES
// ─────────────────────────────────────────────────────────────────────────────
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const contextService = new UserContextService(supabaseUrl, supabaseServiceKey);
const promptEngine = new EnhancedPromptEngine();
const actionsService = new StuddyHubActionsService(supabaseUrl, supabaseServiceKey);

const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
if (!geminiApiKey) throw new Error('Missing GEMINI_API_KEY environment variable');

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY') || '';
const agenticCore = new AgenticCore(supabaseUrl, supabaseServiceKey, geminiApiKey);

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function estimateTokenCount(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

async function calculateTokenCount(text: string): Promise<number> {
  return estimateTokenCount(text);
}

function sleep(ms: number): Promise<void> {
  const jitter = Math.random() * 200; // reduced jitter
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENROUTER HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const OPENROUTER_MAX_CHARS = 800_000;
const OPENROUTER_MAX_MSG_CHARS = 30_000;

function convertGeminiToOpenRouterMessages(
  contents: any[],
  systemInstruction?: any
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (systemInstruction) {
    let sysText = '';
    if (typeof systemInstruction === 'string') {
      sysText = systemInstruction;
    } else if (systemInstruction.parts) {
      sysText = systemInstruction.parts.map((p: any) => p.text || '').join('\n');
    }
    if (sysText) {
      if (sysText.length > OPENROUTER_MAX_MSG_CHARS * 2) {
        sysText = sysText.substring(0, OPENROUTER_MAX_MSG_CHARS * 2) + '\n... [system prompt truncated]';
      }
      messages.push({ role: 'system', content: sysText });
    }
  }

  const allConverted: Array<{ role: string; content: string }> = [];
  for (const entry of contents) {
    const role = entry.role === 'model' ? 'assistant' : (entry.role || 'user');
    const textParts = (entry.parts || []).map((p: any) => p.text || '').filter(Boolean);
    if (textParts.length > 0) {
      let content = textParts.join('\n');
      if (content.length > OPENROUTER_MAX_MSG_CHARS) {
        content = content.substring(0, OPENROUTER_MAX_MSG_CHARS) + '\n... [truncated]';
      }
      allConverted.push({ role, content });
    }
  }

  const systemChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  let remainingBudget = OPENROUTER_MAX_CHARS - systemChars;
  const selectedFromEnd: Array<{ role: string; content: string }> = [];

  for (let i = allConverted.length - 1; i >= 0; i--) {
    const msgLen = allConverted[i].content.length;
    if (remainingBudget - msgLen < 0 && selectedFromEnd.length > 0) break;
    remainingBudget -= msgLen;
    selectedFromEnd.unshift(allConverted[i]);
  }

  const dropped = allConverted.length - selectedFromEnd.length;
  if (dropped > 0) {
    console.log(`[OpenRouter] Truncated conversation: dropped ${dropped} older messages`);
    messages.push({
      role: 'system',
      content: `[Note: ${dropped} earlier messages omitted to fit context window.]`
    });
  }

  messages.push(...selectedFromEnd);
  return messages;
}

function extractSystemInstructionText(systemInstruction: any): string {
  if (!systemInstruction) return '';
  if (typeof systemInstruction === 'string') return systemInstruction;
  if (Array.isArray(systemInstruction.parts)) {
    return systemInstruction.parts.map((p: any) => p.text || '').filter(Boolean).join('\n');
  }
  return '';
}

function serializeContentsForPlanner(contents: any[]): string {
  return contents
    .map((entry: any, index: number) => {
      const role = entry.role === 'model' ? 'ASSISTANT' : 'USER';
      const text = (entry.parts || [])
        .map((part: any) => part.text || '')
        .filter(Boolean)
        .join('\n')
        .trim();
      if (!text) return '';
      return `${role} ${index + 1}:\n${text}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API — CORE (with quota circuit-breaker + fast-fail)
// ─────────────────────────────────────────────────────────────────────────────
async function callGeminiOnce(
  model: string,
  requestBody: any,
  apiKey: string
): Promise<{ ok: boolean; content?: string; status?: number; error?: string }> {
  if (isQuotaExhausted(model)) {
    return { ok: false, status: 429, error: 'quota_circuit_breaker' };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return content ? { ok: true, content } : { ok: false, error: 'no_content' };
    }

    const status = response.status;
    const errorText = await response.text();
    if (status === 429 || status === 503) markQuotaExhausted(model);
    return { ok: false, status, error: errorText.substring(0, 300) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function callGeminiModelChainOnly(
  contents: any[],
  apiKey: string,
  configOverrides: any = {},
  tierModelChain?: string[]
): Promise<{ success: boolean; content?: string; error?: string; userMessage?: string; modelUsed?: string }> {
  const envChain = Deno.env.get('GEMINI_MODEL_CHAIN')?.split(',').map(s => s.trim()).filter(Boolean);
  const DEFAULT_CHAIN = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  const MODEL_CHAIN = tierModelChain || envChain || DEFAULT_CHAIN;

  const { systemInstruction, ...generationConfig } = configOverrides;
  const requestBody: any = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, topK: 40, topP: 0.95, ...generationConfig }
  };
  if (systemInstruction) requestBody.systemInstruction = systemInstruction;

  for (const model of MODEL_CHAIN) {
    console.log(`[GeminiAPI] Trying model: ${model}`);
    const result = await callGeminiOnce(model, requestBody, apiKey);
    if (result.ok && result.content) {
      return { success: true, content: result.content, modelUsed: model };
    }
    if (result.status === 400) {
      return { success: false, error: `BAD_REQUEST`, userMessage: "I couldn't process that request format." };
    }
    // On 429/503/network error: no sleep, just continue to next model
    console.warn(`[GeminiAPI] ${model} failed (${result.status ?? 'err'}): ${result.error?.substring(0, 100)}`);
    logSystemError(supabase, {
      severity: result.status === 429 ? 'warning' : 'error',
      source: 'gemini-chat', component: 'gemini-api',
      error_code: `GEMINI_HTTP_${result.status ?? 'ERR'}`,
      message: `Gemini ${model} failed`, details: { model, status: result.status, error: result.error }
    });
  }

  return { success: false, error: 'ALL_GEMINI_MODELS_FAILED', userMessage: 'Gemini quota exceeded on all models.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION PLANNER — parallel race between Gemini (best available) + OpenRouter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a SLIM context for the action planner.
 * We only need: the last 3 user/assistant turns + the current message.
 * Sending the full conversation wastes tokens and causes the model to
 * output a giant thought_process instead of clean JSON.
 */
function buildSlimActionPlannerContext(
  fullContents: any[],
  maxTurns = 6
): any[] {
  // Keep only user/model alternating turns (no context-recall injections)
  const conversational = fullContents.filter(
    (c: any) => c.role === 'user' || c.role === 'model'
  );
  // Take last N turns
  return conversational.slice(-maxTurns);
}

async function callOpenRouterForAction(
  prompt: string,
  systemPrompt: string,
  maxTokens = 2048
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (!openRouterApiKey) return { success: false, error: 'no_openrouter_key' };
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          { role: 'system', content: systemPrompt.substring(0, 8000) },
          { role: 'user', content: prompt.substring(0, 12000) }
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
        transforms: ['middle-out']
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, error: err.substring(0, 200) };
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    return content ? { success: true, content } : { success: false, error: 'no_content' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function callActionPlannerWithFallback(
  contents: any[],
  apiKey: string,
  configOverrides: any = {},
  tierModelChain?: string[]
): Promise<{ success: boolean; content?: string; error?: string; userMessage?: string; modelUsed?: string }> {
  const { systemInstruction } = configOverrides;
  const systemPromptText = extractSystemInstructionText(systemInstruction);

  // Use slim context for action planning
  const slimContents = buildSlimActionPlannerContext(contents, 6);
  const plannerPrompt = serializeContentsForPlanner(slimContents);

  const envChain = Deno.env.get('GEMINI_MODEL_CHAIN')?.split(',').map((s: string) => s.trim()).filter(Boolean);
  const DEFAULT_CHAIN = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  const MODEL_CHAIN = (tierModelChain || envChain || DEFAULT_CHAIN).filter((m: string) => !isQuotaExhausted(m));

  const requestBody: any = {
    contents: slimContents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      topK: 40,
      topP: 0.95,
      responseMimeType: 'application/json'
    }
  };
  if (systemInstruction) requestBody.systemInstruction = systemInstruction;

  // ── PRIORITIZE OPENROUTER + HF (since Gemini is quota unstable) ──
  console.log('[ActionPlanner] Trying OpenRouter + HF fallbacks first (Gemini secondary)');

  const promptForTextModels = [systemPromptText, plannerPrompt].filter(Boolean).join('\n\n');

  // Run fallbacks in parallel
  const [hfResult, orResult] = await Promise.allSettled([
    callHfChat(promptForTextModels, {
      parameters: { max_tokens: 2048, temperature: 0.2, top_p: 0.95 }
    }),
    callOpenRouterForAction(plannerPrompt, systemPromptText, 2048)
  ]);

  if (orResult.status === 'fulfilled' && orResult.value.success && orResult.value.content) {
    console.log('[ActionPlanner] ✅ OpenRouter succeeded');
    return { success: true, content: orResult.value.content, modelUsed: 'openrouter/free' };
  }

  if (hfResult.status === 'fulfilled' && hfResult.value.success && hfResult.value.text) {
    console.log(`[ActionPlanner] ✅ HuggingFace succeeded (${hfResult.value.model || 'hf'})`);
    return { success: true, content: hfResult.value.text, modelUsed: hfResult.value.model || 'huggingface' };
  }

  // Only try Gemini if fallbacks failed and it's available
  if (MODEL_CHAIN.length > 0) {
    const firstModel = MODEL_CHAIN[0];
    console.log(`[ActionPlanner] Fallback to Gemini: ${firstModel}`);
    const geminiResult = await callGeminiOnce(firstModel, requestBody, apiKey);

    if (geminiResult.ok && geminiResult.content) {
      return { success: true, content: geminiResult.content, modelUsed: firstModel };
    }
    if (geminiResult.status === 400) {
      return { success: false, error: 'BAD_REQUEST', userMessage: "Bad request to action planner." };
    }
  } else {
    console.log('[ActionPlanner] All Gemini models exhausted');
  }

  return {
    success: false,
    error: 'ACTION_PLANNER_ALL_MODELS_FAILED',
    userMessage: 'Could not generate action plan. All backends unavailable.'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API — MAIN (for conversation responses)
// ─────────────────────────────────────────────────────────────────────────────
async function callEnhancedGeminiAPI(
  contents: any[],
  apiKey: string,
  configOverrides: any = {},
  tierModelChain?: string[]
): Promise<{ success: boolean; content?: string; error?: string; userMessage?: string; modelUsed?: string }> {
  const envChain = Deno.env.get('GEMINI_MODEL_CHAIN')?.split(',').map(s => s.trim()).filter(Boolean);
  const DEFAULT_CHAIN = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  const MODEL_CHAIN = tierModelChain || envChain || DEFAULT_CHAIN;

  const { systemInstruction, ...generationConfig } = configOverrides;
  const requestBody: any = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, topK: 40, topP: 0.95, ...generationConfig }
  };
  if (systemInstruction) requestBody.systemInstruction = systemInstruction;

  for (const model of MODEL_CHAIN) {
    console.log(`[GeminiAPI] Trying model: ${model}`);
    const result = await callGeminiOnce(model, requestBody, apiKey);
    if (result.ok && result.content) return { success: true, content: result.content, modelUsed: model };
    if (result.status === 400) return { success: false, error: 'BAD_REQUEST', userMessage: "Couldn't process that request format." };
    console.warn(`[GeminiAPI] ${model} failed (${result.status ?? 'err'})`);
    logSystemError(supabase, {
      severity: result.status === 429 ? 'warning' : 'error',
      source: 'gemini-chat', component: 'gemini-api',
      error_code: `GEMINI_HTTP_${result.status ?? 'ERR'}`,
      message: `Gemini ${model} failed`, details: { model, status: result.status }
    });
  }

  // OpenRouter fallback
  if (openRouterApiKey) {
    console.log('[OpenRouter] All Gemini models failed, falling back...');
    try {
      const orMessages = convertGeminiToOpenRouterMessages(contents, systemInstruction);
      const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: orMessages,
          max_tokens: Math.min(generationConfig.maxOutputTokens || 4096, 4096),
          temperature: generationConfig.temperature ?? 0.7,
          transforms: ['middle-out']
        })
      });
      if (orResp.ok) {
        const data = await orResp.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return { success: true, content, modelUsed: 'openrouter/free' };
      } else {
        const err = await orResp.text();
        console.error('[OpenRouter] Error', orResp.status, err.substring(0, 200));
      }
    } catch (err) {
      console.error('[OpenRouter] Network error:', err);
    }
  }

  return { success: false, error: 'ALL_MODELS_FAILED', userMessage: 'All AI services are currently unavailable. Please try again shortly.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI STREAMING (with fast quota failover)
// ─────────────────────────────────────────────────────────────────────────────
async function callEnhancedGeminiAPIStream(
  contents: any[],
  apiKey: string,
  onChunk: (chunk: string) => Promise<void>,
  configOverrides: any = {},
  tierModelChain?: string[]
): Promise<{ success: boolean; content?: string; error?: string; modelUsed?: string }> {
  const envChain = Deno.env.get('GEMINI_MODEL_CHAIN')?.split(',').map(s => s.trim()).filter(Boolean);
  const DEFAULT_CHAIN = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  const MODEL_CHAIN = tierModelChain || envChain || DEFAULT_CHAIN;

  const { systemInstruction, ...generationConfig } = configOverrides;
  const requestBody: any = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, ...generationConfig }
  };
  if (systemInstruction) requestBody.systemInstruction = systemInstruction;

  for (const model of MODEL_CHAIN) {
    if (isQuotaExhausted(model)) {
      console.log(`[GeminiStream] Skipping quota-exhausted model: ${model}`);
      continue;
    }
    console.log(`[GeminiAPI-Stream] Using model: ${model}`);
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error('[GeminiAPI-Stream] HTTP error:', resp.status, txt.substring(0, 200));
        if (resp.status === 429 || resp.status === 503) markQuotaExhausted(model);
        logSystemError(supabase, {
          severity: resp.status === 429 ? 'warning' : 'error',
          source: 'gemini-chat', component: 'gemini-stream',
          error_code: `GEMINI_STREAM_HTTP_${resp.status}`,
          message: `Gemini streaming ${model} HTTP ${resp.status}`,
          details: { model, status: resp.status }
        });
        continue; // No sleep — move to next model immediately
      }

      const reader = resp.body?.getReader();
      if (!reader) {
        const data = await resp.json();
        const extracted = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (extracted) { await onChunk(extracted); return { success: true, content: extracted, modelUsed: model }; }
        continue;
      }

      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      while (!done) {
        const { value, done: rdone } = await reader.read();
        done = rdone;
        if (value) {
          const chunkText = decoder.decode(value, { stream: !done });
          try { await onChunk(chunkText); } catch (e) { console.warn('[GeminiAPI-Stream] onChunk error', e); }
          accumulated += chunkText;
        }
      }

      try {
        const parsed = JSON.parse(accumulated);
        const extracted = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (extracted) return { success: true, content: extracted, modelUsed: model };
      } catch (_) {
        if (accumulated) return { success: true, content: accumulated, modelUsed: model };
      }
    } catch (err) {
      console.error('[GeminiAPI-Stream] Network error:', err);
      logSystemError(supabase, {
        severity: 'error', source: 'gemini-chat', component: 'gemini-stream',
        error_code: 'GEMINI_STREAM_NETWORK_ERROR',
        message: `Gemini streaming error: ${String(err)}`, details: { model }
      });
    }
  }

  // ── OpenRouter Streaming Fallback ──
  if (openRouterApiKey) {
    console.log('[OpenRouter-Stream] All Gemini models failed. Falling back...');
    try {
      const orMessages = convertGeminiToOpenRouterMessages(contents, systemInstruction);
      const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: orMessages,
          max_tokens: Math.min(generationConfig.maxOutputTokens || 4096, 4096),
          temperature: generationConfig.temperature ?? 0.7,
          stream: true,
          transforms: ['middle-out']
        })
      });

      if (!orResp.ok) {
        const err = await orResp.text();
        console.error('[OpenRouter-Stream] Error', orResp.status, err.substring(0, 200));
      } else {
        const reader = orResp.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let accumulated = '';
          let done = false;
          let buffer = '';

          while (!done) {
            const { value, done: rdone } = await reader.read();
            done = rdone;
            if (value) {
              buffer += decoder.decode(value, { stream: !done });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                      accumulated += delta;
                      try { await onChunk(delta); } catch (e) { console.warn('[OpenRouter-Stream] onChunk error', e); }
                    }
                  } catch (_) { /* skip */ }
                }
              }
            }
          }

          if (accumulated) {
            console.log('[OpenRouter-Stream] Succeeded, chars:', accumulated.length);
            return { success: true, content: accumulated };
          }
        } else {
          const orData = await orResp.json();
          const orContent = orData.choices?.[0]?.message?.content;
          if (orContent) {
            await onChunk(orContent);
            return { success: true, content: orContent };
          }
        }
      }
    } catch (err) {
      console.error('[OpenRouter-Stream] Error:', err);
    }
  }

  return { success: false, error: 'ALL_STREAM_MODELS_FAILED' };
}

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZE ASSISTANT OUTPUT
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeAssistantOutput(text: string | null | undefined): string {
  if (!text) return '';
  let out = text;
  out = out.replace(/```(?:json|action)?\s*[\s\S]*?(?:DB_ACTION|GENERATE_IMAGE|ENGAGE_SOCIAL|"type"\s*:\s*"(?:DB_ACTION|GENERATE_IMAGE|ENGAGE_SOCIAL)")[\s\S]*?```/gi, '');
  out = out.replace(/\{[^}]*"type"\s*:\s*"(?:DB_ACTION|GENERATE_IMAGE|ENGAGE_SOCIAL)"[^}]*\}/gi, '');
  out = out.replace(/\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/gi, '');
  out = out.replace(/^ACTION:\s*.*$/gim, '');
  out = out.replace(/"thought_process"\s*:\s*"[^"]*"/gi, '');
  out = out.replace(/"params"\s*:\s*\{[\s\S]*?"table"\s*:[\s\S]*?\}/gi, '');
  out = out.replace(/^[{}\[\],]\s*$/gm, '');
  out = out.replace(/^\s*"(?:type|params|table|operation|data|filters)"\s*:.*$/gm, '');
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  out = out.replace(/\(\s*\)/g, '');
  out = out.replace(/\[\s*\]/g, '');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION RESULT TRIMMER
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_RESULT_MAX_RECORDS = 20;
const ACTION_RESULT_MAX_STR = 300;

function truncateActionResults(actions: any[]): any[] {
  return actions.map((action: any) => {
    const slim: any = { type: action.type, success: action.success };
    if (action.error) slim.error = action.error;
    if (action.data) {
      const rawData = action.data.data || action.data;
      if (Array.isArray(rawData)) {
        const total = rawData.length;
        const sliced = rawData.slice(0, ACTION_RESULT_MAX_RECORDS).map((row: any) => {
          if (typeof row !== 'object' || row === null) return row;
          const slimRow: any = {};
          for (const [key, val] of Object.entries(row)) {
            if (typeof val === 'string' && val.length > ACTION_RESULT_MAX_STR) {
              slimRow[key] = val.substring(0, ACTION_RESULT_MAX_STR) + `... [${val.length} chars]`;
            } else {
              slimRow[key] = val;
            }
          }
          return slimRow;
        });
        slim.data = { records: sliced, count: total };
        if (action.data.total_count) slim.data.total_count = action.data.total_count;
        if (action.data.note) slim.data.note = action.data.note;
        if (total > ACTION_RESULT_MAX_RECORDS) slim.data.truncated_note = `Showing ${ACTION_RESULT_MAX_RECORDS} of ${total} records.`;
      } else {
        slim.data = rawData;
      }
    }
    return slim;
  });
}

function isNeedsConfirmationAction(action: any): boolean {
  return !!(action?.data?.needsConfirmation || action?.data?.data?.needsConfirmation);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
async function executeAIActions(
  userId: string,
  sessionId: string,
  aiResponse: string
): Promise<{ executedActions: any[]; modifiedResponse: string }> {
  const executedActions: any[] = [];
  let modifiedResponse = aiResponse;

  const actionsRaw = actionsService.parseActionFromText(aiResponse);
  const actionList = Array.isArray(actionsRaw) ? actionsRaw : (actionsRaw ? [actionsRaw] : []);

  if (actionList.length > 0) {
    for (const action of actionList) {
      if (action.matchedString) {
        const escaped = action.matchedString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        modifiedResponse = modifiedResponse.replace(new RegExp(escaped, 'g'), '').trim();
      }
    }
    modifiedResponse = modifiedResponse.replace(/ACTION:\s*[A-Z_]+(?:\|.*)?(?:\n+|$)/g, '').trim();

    for (const action of actionList) {
      try {
        const result = await runAction(actionsService, userId, sessionId, action.action, action.params);
        executedActions.push({ type: action.action, success: result?.success || false, data: result, timestamp: new Date().toISOString() });
      } catch (err: any) {
        console.error(`[ActionExecution] Error executing ${action.action}:`, err);
        logSystemError(supabase, {
          severity: 'error', source: 'gemini-chat', component: 'action-execution',
          error_code: 'ACTION_EXEC_FAILED',
          message: `Action '${action.action}' failed: ${err.message}`,
          details: { action: action.action, error: String(err) }
        });
        executedActions.push({ type: action.action, success: false, error: err.message, timestamp: new Date().toISOString() });
      }
    }
  }

  return { executedActions, modifiedResponse };
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION / MESSAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function updateSessionTokenCount(
  sessionId: string,
  userId: string,
  messageContent: string,
  operation = 'add'
): Promise<{ success: boolean; tokenCount: number }> {
  try {
    const messageTokens = await calculateTokenCount(messageContent);
    if (operation === 'add') {
      const { data: sessionData, error: fetchError } = await supabase
        .from('chat_sessions').select('token_count')
        .eq('id', sessionId).eq('user_id', userId).maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') return { success: false, tokenCount: 0 };

      if (!sessionData) {
        await supabase.from('chat_sessions').upsert({
          id: sessionId, user_id: userId, token_count: messageTokens,
          last_message_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        return { success: true, tokenCount: messageTokens };
      }

      const newCount = (sessionData.token_count || 0) + messageTokens;
      await supabase.from('chat_sessions').update({ token_count: newCount, updated_at: new Date().toISOString() })
        .eq('id', sessionId).eq('user_id', userId);
      console.log(`[updateSessionTokenCount] ${sessionData.token_count} -> ${newCount}`);
      return { success: true, tokenCount: newCount };
    } else {
      await supabase.from('chat_sessions').update({ token_count: messageTokens, updated_at: new Date().toISOString() })
        .eq('id', sessionId).eq('user_id', userId);
      return { success: true, tokenCount: messageTokens };
    }
  } catch (error) {
    console.error('[updateSessionTokenCount] Exception:', error);
    return { success: false, tokenCount: 0 };
  }
}

async function getSessionTokenCount(sessionId: string, userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.from('chat_sessions').select('token_count')
      .eq('id', sessionId).eq('user_id', userId).maybeSingle();
    if (error && error.code !== 'PGRST116') return 0;
    return data?.token_count || 0;
  } catch { return 0; }
}

async function updateConversationSummary(sessionId: string, userId: string, recentMessages: any[]): Promise<string | null> {
  if (recentMessages.length < ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) return null;
  try {
    const conversationText = recentMessages.map((msg: any) =>
      `${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
    ).join('\n');
    const contents = [{ role: 'user', parts: [{ text: `Summarize this conversation in 2-3 sentences, focusing on main topics and user interests: ${conversationText}` }] }];
    const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
    if (response.success && response.content) {
      const summary = response.content.trim();
      await supabase.from('chat_sessions').update({ context_summary: summary, updated_at: new Date().toISOString() })
        .eq('id', sessionId).eq('user_id', userId);
      return summary;
    }
  } catch (error) { console.error('Error updating conversation summary:', error); }
  return null;
}

async function getConversationHistory(userId: string, sessionId: string, maxMessages = ENHANCED_PROCESSING_CONFIG.MAX_CONVERSATION_HISTORY): Promise<any[]> {
  try {
    const { data: messages, error } = await supabase.from('chat_messages')
      .select('id, content, role, timestamp')
      .eq('user_id', userId).eq('session_id', sessionId).eq('is_error', false)
      .order('timestamp', { ascending: true }).limit(maxMessages);
    if (error) { console.error('Error fetching history:', error); return []; }
    return messages || [];
  } catch { return []; }
}

async function buildIntelligentContext(
  userId: string, sessionId: string, currentMessage: string,
  attachedDocumentIds: string[] = [], attachedNoteIds: string[] = []
): Promise<{ recentMessages: any[]; relevantOlderMessages: any[]; conversationSummary: string | null; totalMessages: number; summarizedMessages: number; storedTokenCount: number }> {
  const storedTokenCount = await getSessionTokenCount(sessionId, userId);
  const conversationHistory = await getConversationHistory(userId, sessionId);

  let conversationSummary = null;
  try {
    const { data: sessionData } = await supabase.from('chat_sessions')
      .select('context_summary, title, last_message_at')
      .eq('id', sessionId).eq('user_id', userId).single();
    if (sessionData?.context_summary) {
      conversationSummary = `Session "${sessionData.title}" (last active: ${new Date(sessionData.last_message_at).toLocaleDateString()}): ${sessionData.context_summary}`;
    }
  } catch {}

  const MAX_HISTORY_TOKENS = ENHANCED_PROCESSING_CONFIG.MAX_INPUT_TOKENS - 8192;
  let currentTokens = conversationSummary ? estimateTokenCount(conversationSummary) : 0;
  const selectedMessages: any[] = [];

  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    const msgTokens = estimateTokenCount(msg.content) + 20;
    if (currentTokens + msgTokens > MAX_HISTORY_TOKENS) break;
    currentTokens += msgTokens;
    selectedMessages.unshift(msg);
  }

  console.log(`[buildIntelligentContext] ${selectedMessages.length} messages selected (~${currentTokens} tokens)`);
  return {
    recentMessages: selectedMessages, relevantOlderMessages: [], conversationSummary,
    totalMessages: conversationHistory.length,
    summarizedMessages: conversationHistory.length - selectedMessages.length,
    storedTokenCount
  };
}

async function buildAttachedContext(documentIds: string[], noteIds: string[], userId: string): Promise<string> {
  let context = '';
  const MAX_CONTENT_LENGTH = 300000;

  if (documentIds.length > 0) {
    const { data: documents } = await supabase.from('documents')
      .select('id, title, file_name, file_type, content_extracted, type, processing_status')
      .eq('user_id', userId).in('id', documentIds);
    if (documents) {
      context += 'DOCUMENTS:\n';
      for (const doc of documents) {
        context += `Title: ${doc.title}\nFile: ${doc.file_name}\nType: ${doc.type}\n`;
        if (doc.content_extracted) {
          const truncated = doc.content_extracted.length > MAX_CONTENT_LENGTH
            ? doc.content_extracted.substring(0, MAX_CONTENT_LENGTH) + '... [truncated]'
            : doc.content_extracted;
          context += `Content: ${truncated}\n`;
        }
        context += '\n';
      }
    }
  }

  if (noteIds.length > 0) {
    const { data: notes } = await supabase.from('notes')
      .select('id, title, category, content, ai_summary, tags')
      .eq('user_id', userId).in('id', noteIds);
    if (notes) {
      context += 'NOTES:\n';
      for (const note of notes) {
        context += `Title: ${note.title}\nCategory: ${note.category}\n`;
        if (note.content) {
          const truncated = note.content.length > MAX_CONTENT_LENGTH
            ? note.content.substring(0, MAX_CONTENT_LENGTH) + '... [truncated]'
            : note.content;
          context += `Content: ${truncated}\n`;
        }
        if (note.ai_summary) context += `AI Summary: ${note.ai_summary}\n`;
        if (note.tags?.length) context += `Tags: ${note.tags.join(', ')}\n`;
        context += '\n';
      }
    }
  }

  return context;
}

async function saveChatMessage(params: {
  userId: string; sessionId: string; content: string; role: string;
  attachedDocumentIds?: string[] | null; attachedNoteIds?: string[] | null;
  isError?: boolean; imageUrl?: string | null; imageMimeType?: string | null;
  conversationContext?: any; filesMetadata?: any[] | null;
  messageIdToUpdate?: string | null;
}): Promise<{ id: string; timestamp: string } | null> {
  try {
    const payload = {
      content: params.content,
      attached_document_ids: params.attachedDocumentIds,
      attached_note_ids: params.attachedNoteIds,
      is_error: params.isError || false,
      image_url: params.imageUrl,
      image_mime_type: params.imageMimeType,
      conversation_context: params.conversationContext,
      files_metadata: params.filesMetadata,
      has_been_displayed: params.role === 'user'
    };

    const query = params.messageIdToUpdate
      ? supabase.from('chat_messages').update(payload).eq('id', params.messageIdToUpdate).eq('user_id', params.userId).eq('session_id', params.sessionId)
      : supabase.from('chat_messages').insert({
          user_id: params.userId,
          session_id: params.sessionId,
          content: params.content,
          role: params.role,
          attached_document_ids: params.attachedDocumentIds,
          attached_note_ids: params.attachedNoteIds,
          is_error: params.isError || false,
          image_url: params.imageUrl,
          image_mime_type: params.imageMimeType,
          conversation_context: params.conversationContext,
          timestamp: new Date().toISOString(),
          files_metadata: params.filesMetadata,
          has_been_displayed: params.role === 'user'
        });

    const { data, error } = await query.select('id, timestamp').single();
    if (error) { console.error('Error saving chat message:', error); return null; }
    return { id: data.id, timestamp: data.timestamp };
  } catch (error) {
    console.error('Database error saving chat message:', error);
    return null;
  }
}

const generateChatTitle = async (sessionId: string, userId: string, initialMessage: string, messageCount = 1): Promise<string> => {
  try {
    let contextMessages = '';
    if (messageCount > 1) {
      const { data: recentMessages } = await supabase.from('chat_messages')
        .select('content, role').eq('session_id', sessionId).eq('user_id', userId)
        .order('timestamp', { ascending: false }).limit(6);
      if (recentMessages?.length) {
        contextMessages = recentMessages.reverse().map(m => `${m.role}: ${m.content.substring(0, 100)}`).join('\n');
      }
    }
    const contentToAnalyze = contextMessages || initialMessage.substring(0, 300);
    const contents = [{ role: 'user', parts: [{ text: `Create a concise title (4-6 words max) for this conversation:\n\n${contentToAnalyze}\n\nReturn ONLY the title, no quotes or explanation.` }] }];
    const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
    if (response.success && response.content) {
      let title = response.content.trim().replace(/^["'`]|["'`]$/g, '').replace(/^(Title:|Chat:|Session:)\s*/i, '');
      title = title.charAt(0).toUpperCase() + title.slice(1);
      return title.length > 50 ? title.substring(0, 47) + '...' : title;
    }
  } catch (error) { console.error('Error generating title:', error); }
  const words = initialMessage.split(' ');
  return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
};

const maybeUpdateSessionTitle = async (sessionId: string, userId: string, messageCount: number, latestMessage: string): Promise<void> => {
  if (![1, 4, 8].includes(messageCount)) return;
  try {
    const newTitle = await generateChatTitle(sessionId, userId, latestMessage, messageCount);
    await supabase.from('chat_sessions').update({ title: newTitle }).eq('id', sessionId).eq('user_id', userId);
    console.log(`✅ Session title updated: "${newTitle}"`);
  } catch (error) { console.error('Error updating session title:', error); }
};

async function ensureChatSession(userId: string, sessionId: string, newDocumentIds: string[] = [], initialMessage = '', incrementMessageCount = true): Promise<void> {
  try {
    const { data: existingSession, error: fetchError } = await supabase.from('chat_sessions')
      .select('id, document_ids, message_count, context_summary, title')
      .eq('id', sessionId).eq('user_id', userId).single();

    if (fetchError && fetchError.code !== 'PGRST116') { console.error('Error fetching session:', fetchError); return; }

    if (existingSession) {
      const newMessageCount = incrementMessageCount ? (existingSession.message_count || 0) + 1 : (existingSession.message_count || 0);
      const updates: any = incrementMessageCount ? { message_count: newMessageCount } : {};
      if (newDocumentIds.length > 0) {
        updates.document_ids = [...new Set([...(existingSession.document_ids || []), ...newDocumentIds])];
      }
      await supabase.from('chat_sessions').update(updates).eq('id', sessionId);
      if (initialMessage && incrementMessageCount) {
        maybeUpdateSessionTitle(sessionId, userId, newMessageCount, initialMessage).catch(console.error);
      }
    } else {
      const newTitle = initialMessage ? await generateChatTitle(sessionId, userId, initialMessage, 1) : 'New Chat';
      await supabase.from('chat_sessions').insert({
        id: sessionId, user_id: userId, title: newTitle,
        document_ids: newDocumentIds, message_count: 1, token_count: 0,
        last_message_at: new Date().toISOString()
      });
      console.log(`✅ New session created: "${newTitle}"`);
    }
  } catch (error) {
    console.error('Error ensuring session:', error);
    logSystemError(supabase, { severity: 'warning', source: 'gemini-chat', component: 'ensure-session', error_code: 'SESSION_ENSURE_FAILED', message: String(error), details: { sessionId } });
  }
}

async function updateSessionLastMessage(sessionId: string, contextSummary: string | null = null, title: string | null = null): Promise<void> {
  try {
    const update: any = { last_message_at: new Date().toISOString() };
    if (contextSummary) update.context_summary = contextSummary;
    if (title) update.title = title;
    await supabase.from('chat_sessions').update(update).eq('id', sessionId);
  } catch (error) { console.error('Error updating session:', error); }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────
function classifyUserQuery(message: string): string {
  if (!message || typeof message !== 'string') return 'general-knowledge';
  const lower = message.toLowerCase().trim();
  const appKeywords = ['studdyhub', 'dashboard', 'notes', 'recordings', 'schedule', 'upload', 'create note', 'document', 'settings', 'profile', 'ai chat'];
  const studyKeywords = ['help me understand', 'explain how to', 'study tips', 'learn about', 'homework', 'quiz me', 'summarize', 'solve this'];
  const appPatterns = [/how (do|can) i (create|make|add|upload|delete|edit)/, /where (is|can i find) the/, /how to (use|access|navigate)/];
  const studyPatterns = [/help me (with|understand|learn)/, /explain (this|how|what|why)/, /what (is|are|does|means?)/, /how (does|do|is|are)/];

  if (appKeywords.some(k => lower.includes(k)) || appPatterns.some(p => p.test(lower))) return 'app-specific';
  if (studyKeywords.some(k => lower.includes(k)) || studyPatterns.some(p => p.test(lower))) return 'study-help';
  return 'general-knowledge';
}

function buildUserMemoryContext(userContext: any): string | null {
  const sections: string[] = [];
  const interests = userContext.userMemory?.filter((f: any) => f.fact_type === 'interest' && f.confidence_score > 0.7);
  if (interests?.length) sections.push(`KNOWN INTERESTS: ${interests.map((i: any) => i.fact_value).join(', ')}`);
  const prefs = userContext.userMemory?.filter((f: any) => f.fact_type === 'learning_style' || f.fact_type === 'preference');
  if (prefs?.length) sections.push(`LEARNING PREFERENCES: ${prefs.map((p: any) => `${p.fact_key}: ${p.fact_value}`).join(', ')}`);
  return sections.length > 0 ? sections.join('\n') : null;
}

function buildActionableContextText(actionableContext: any): string {
  const sections: string[] = [];
  if (actionableContext.notes?.length) sections.push(`📝 Notes: ${actionableContext.notes.map((n: any) => n.title).join(', ')}`);
  if (actionableContext.documents?.length) sections.push(`📄 Documents: ${actionableContext.documents.map((d: any) => d.title).join(', ')}`);
  if (actionableContext.folders?.length) sections.push(`📁 Folders: ${actionableContext.folders.map((f: any) => f.name).join(', ')}`);
  if (actionableContext.goals?.length) sections.push(`🎯 Goals: ${actionableContext.goals.map((g: any) => g.goal_text).join(', ')}`);
  return sections.join('\n');
}

async function buildEnhancedGeminiConversation(
  userId: string, sessionId: string, currentMessage: string,
  files: any[], attachedContext: string, systemPrompt: string
): Promise<{ contents: any[]; systemInstruction: any; contextInfo: any; queryType: string }> {
  const userContext = await contextService.getUserContext(userId);
  const crossSessionContext = await contextService.getCrossSessionContext(userId, sessionId, currentMessage);
  const actionableContext = await contextService.getActionableContext(userId);
  const actionableContextText = buildActionableContextText(actionableContext);

  const uc = userContext;
  const userContextSummary = `\n\nUSER CONTEXT: Notes: ${uc.allNotes?.length ?? 0}, Documents: ${uc.allDocuments?.length ?? 0}, Goals: ${uc.learningGoals?.length ?? 0}, Flashcards: ${uc.flashcards?.length ?? 0}`;

  const userName = uc.profile?.full_name || 'User';
  const queryType = classifyUserQuery(currentMessage);
  const conversationData = await buildIntelligentContext(userId, sessionId, currentMessage, [], []);
  const geminiContents: any[] = [];

  const queryGuidance: Record<string, string> = {
    'general-knowledge': 'Provide accurate information. Only mention StuddyHub if directly relevant.',
    'study-help': 'Provide educational support tailored to user\'s learning patterns.',
    'app-specific': 'Focus on StuddyHub features and usage instructions.'
  };

  let crossSessionText = '';
  if (crossSessionContext) {
    crossSessionText = crossSessionContext.map((s: any) => {
      let info = `Previous session "${s.sessionTitle}" (${new Date(s.lastActive).toLocaleDateString()}): `;
      info += s.summary || (s.recentTopics?.length ? `Discussed: ${s.recentTopics.map((t: any) => t.content).join('; ')}` : '');
      return info;
    }).join('\n');
  }

  const dateTimeString = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short'
  });

  const systemInstruction = {
    parts: [{
      text: `${systemPrompt}\n\n**ACTIONABLE CONTEXT:**\n${actionableContextText}${userContextSummary}\n\nCURRENT DATE AND TIME: ${dateTimeString}\n\nQuery type: ${queryType}\n${queryGuidance[queryType]}\n\nCross-session context:\n${crossSessionText}\n\nYou are the AI Assistant for ${userName} on StuddyHub.`
    }]
  };

  if (conversationData.conversationSummary) {
    geminiContents.push({
      role: 'user',
      parts: [{ text: `CONTEXT RECALL: ${conversationData.conversationSummary}\nDo not acknowledge this block verbatim. Jump straight into answering.` }]
    });
  }

  for (const msg of conversationData.recentMessages) {
    if (msg.role === 'user') {
      geminiContents.push({ role: 'user', parts: [{ text: msg.content || '' }] });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      geminiContents.push({ role: 'model', parts: [{ text: msg.content || '' }] });
    }
  }

  if (currentMessage || files.length > 0 || attachedContext) {
    const currentParts: any[] = [];
    if (currentMessage) currentParts.push({ text: currentMessage });
    if (attachedContext) currentParts.push({ text: `\n\nAttached Context:\n${attachedContext}` });

    const memCtx = buildUserMemoryContext(userContext);
    if (memCtx) currentParts.push({ text: `\n\nUSER MEMORY:\n${memCtx}` });

    for (const file of files) {
      if (file.type === 'image' && file.data) {
        currentParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      } else if (file.content) {
        currentParts.push({ text: `\n\n[File: ${file.name}]\n${file.content}` });
      }
    }

    if (currentParts.length > 0) geminiContents.push({ role: 'user', parts: currentParts });
  }

  return { contents: geminiContents, systemInstruction, contextInfo: { ...conversationData, userContext, crossSessionContext }, queryType };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT USER FACTS
// ─────────────────────────────────────────────────────────────────────────────
async function extractUserFacts(userMessage: string, aiResponse: string, userId: string, sessionId: string): Promise<any[]> {
  const facts: any[] = [];
  const patterns = [
    { pattern: /(I prefer|I like|I enjoy|I love).*?(visual|auditory|kinesthetic|reading|writing|diagrams|examples|videos|hands.on)/gi, type: 'learning_style', key: 'learning_preference' },
    { pattern: /(I (?:struggle|have difficulty|need help|find it hard) (?:with|to)).*?([^.!?]+)/gi, type: 'skill_level', key: 'challenging_areas' },
    { pattern: /(My (?:favorite|preferred) (?:subject|topic|area) (?:is|are)).*?([^.!?]+)/gi, type: 'interest', key: 'favorite_subjects' }
  ];

  function extractFromText(text: string) {
    for (const { pattern, type, key } of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const value = match[2]?.trim();
        if (value && value.length > 3 && value.length < 100) {
          facts.push({ fact_type: type, fact_key: key, fact_value: value, confidence_score: 0.8, source_session_id: sessionId });
        }
      }
    }
    const topicMatch = userMessage.match(/(genetics|biology|aviation|flight|birds|science|math|history|literature|programming|technology)/gi) || [];
    for (const topic of topicMatch) {
      if (!facts.some(f => f.fact_value.toLowerCase() === topic.toLowerCase())) {
        facts.push({ fact_type: 'interest', fact_key: 'discussed_topics', fact_value: topic.toLowerCase(), confidence_score: 0.7, source_session_id: sessionId });
      }
    }
  }

  extractFromText(userMessage);
  return facts;
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING HANDLER
// ─────────────────────────────────────────────────────────────────────────────
async function handleStreamingResponse(
  userId: string, sessionId: string, message: string,
  allDocumentIds: string[], attachedNoteIds: string[],
  learningStyle: string, learningPreferences: any,
  userMessageImageUrl: string | null, imageMimeType: string | null,
  filesMetadata: any[], userMessageId: string | null, userMessageTimestamp: string | null,
  aiMessageIdToUpdate: string | null,
  courseMaterialsContext?: string,
  courseContext?: { id: string; code?: string; title?: string } | null
): Promise<Response> {
  const { stream, handler } = createStreamResponse();
  handler.startHeartbeat(15_000);

  const aiModelConfig = await (async () => {
    try {
      const validator = createSubscriptionValidator();
      return await validator.getAiModelConfig(userId);
    } catch {
      return { tier: 'free' as const, modelChain: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'], streamingChain: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'], displayLabel: 'Gemini Flash' };
    }
  })();

  (async () => {
    try {
      console.log('🚀 Starting streaming response');

      // ── Understanding Phase ──
      handler.sendThinkingStep('understanding', 'Analyzing your request', 'Interpreting message intent...', 'in-progress');

      const conversationHistory = await getConversationHistory(userId, sessionId);
      let userIntent: UserIntent;
      try {
        userIntent = await agenticCore.understandQuery(message, userId, conversationHistory);
      } catch {
        userIntent = { primary: 'general_query', secondary: [], entities: [], complexity: 'simple' as const, requiresContext: false, requiresAction: false, confidence: 0.5 };
      }

      const entitiesPreview = userIntent.entities?.length > 0 ? ` (Entities: ${userIntent.entities.map(e => e.value).join(', ')})` : '';
      handler.sendThinkingStep('understanding', 'Query understood', `Intent: ${userIntent.primary}${entitiesPreview}`, 'completed', { intent: userIntent.primary });

      // ── Retrieval Phase ──
      handler.sendThinkingStep('retrieval', 'Gathering relevant information', 'Searching notes, documents, past conversations...', 'in-progress');
      let relevantContext: any[] = [];
      try {
        relevantContext = await agenticCore.retrieveRelevantContext(userIntent, userId, sessionId);
      } catch { /* continue with empty context */ }
      handler.sendThinkingStep('retrieval', 'Context retrieved', `Found ${relevantContext.length} relevant items`, 'completed', { contextCount: relevantContext.length });

      // ── Reasoning Phase ──
      handler.sendThinkingStep('reasoning', 'Building reasoning chain', 'Analyzing and determining best approach...', 'in-progress');
      let reasoningChain: string[] = [];
      try {
        reasoningChain = await agenticCore.buildReasoningChain(userIntent, relevantContext, message);
      } catch { /* continue */ }
      handler.sendThinkingStep('reasoning', 'Reasoning complete', `Built ${reasoningChain.length} reasoning steps`, 'completed');

      // ── Memory Phase ──
      handler.sendThinkingStep('memory', 'Loading memory systems', 'Accessing working memory and past interactions...', 'in-progress');
      const [workingMemory, longTermMemory, episodicMemory] = await Promise.all([
        agenticCore.getWorkingMemory(sessionId, userId),
        agenticCore.getLongTermMemory(userId),
        agenticCore.getEpisodicMemory(userId, message)
      ]);
      handler.sendThinkingStep('memory', 'Memory loaded', `Loaded ${workingMemory.recentMessages?.length || 0} recent messages, ${longTermMemory.facts?.length || 0} facts`, 'completed');

      // ── Build Context ──
      let attachedContext = '';
      if (allDocumentIds.length > 0 || attachedNoteIds.length > 0) {
        attachedContext = await buildAttachedContext(allDocumentIds, attachedNoteIds, userId);
      }
      if (courseMaterialsContext) attachedContext = `${courseMaterialsContext}\n\n${attachedContext}`;

      if (relevantContext.length > 0) {
        attachedContext += '\n\n=== SEMANTICALLY RELEVANT CONTEXT ===\n';
        relevantContext.slice(0, 10).forEach(ctx => {
          attachedContext += `\n[${ctx.type.toUpperCase()}] ${ctx.title} (${(ctx.relevanceScore * 100).toFixed(0)}% relevant)\n`;
          if (ctx.content) attachedContext += `${ctx.content.substring(0, 500)}${ctx.content.length > 500 ? '...' : ''}\n`;
        });
      }

      attachedContext += '\n\n=== REASONING CHAIN ===\n' + (reasoningChain || []).join('\n');
      if (episodicMemory.relevantSessions?.length > 0) {
        attachedContext += '\n\n=== RELEVANT PAST DISCUSSIONS ===\n';
        episodicMemory.relevantSessions.forEach((s: any) => { attachedContext += `- ${s.title}: ${s.context_summary || 'No summary'}\n`; });
      }

      const userContext = await contextService.getUserContext(userId);
      let systemPrompt = promptEngine.createEnhancedSystemPrompt(learningStyle, learningPreferences, userContext, 'light');

      if (courseContext && (courseContext.title || courseContext.id)) {
        const label = courseContext.title ? `${courseContext.title}${courseContext.code ? ` (${courseContext.code})` : ''}` : courseContext.id;
        systemPrompt += `\n\nCOURSE CONTEXT: The user is studying ${label}. Prioritize educational explanations, step-by-step walkthroughs, and practice problems.`;
      }

      const conversationData = await buildEnhancedGeminiConversation(userId, sessionId, message, [], attachedContext, systemPrompt);

      // ── Action Planning Phase ──
      handler.sendThinkingStep('action', 'Planning actions', 'Determining necessary operations...', 'in-progress');

      const SUPPORTED_ACTION_TYPES = ['DB_ACTION', 'GENERATE_IMAGE', 'ENGAGE_SOCIAL'];
      const actionSystemPrompt = `
YOU ARE IN: ACTION PLANNING PHASE
Return ONLY valid JSON. No prose, no markdown, no code blocks.

SUPPORTED ACTIONS ONLY: DB_ACTION | GENERATE_IMAGE | ENGAGE_SOCIAL
Any other type is IGNORED.

FORMAT:
{
  "thought_process": "one sentence",
  "actions": [{ "type": "DB_ACTION", "params": { ... } }]
}

If no actions needed: { "thought_process": "No actions required", "actions": [] }

RULES:
- user_id = "auth.uid()"
- schedule_items.type MUST be: 'class' | 'study' | 'assignment' | 'exam' | 'other'
- schedule_items.subject is REQUIRED
- Date filters: { "start_time": { "gte": "...", "lte": "..." } }
- Arrays must be real JSON arrays: [1,2,3] not ["1","2"]

DATABASE SCHEMA:
${typeof DB_SCHEMA_DEFINITION === 'string' ? DB_SCHEMA_DEFINITION.substring(0, 3000) : JSON.stringify(DB_SCHEMA_DEFINITION, null, 2).substring(0, 3000)}

Return ONLY the JSON object:`;

      let executedActions: any[] = [];
      let planningAttempt = 0;

      try {
        while (planningAttempt < ENHANCED_PROCESSING_CONFIG.ACTION_FIX_ATTEMPTS) {
          console.log(`[ActionPlanningLoop] Attempt ${planningAttempt + 1}`);

          const actionResponse = await callActionPlannerWithFallback(
            conversationData.contents, geminiApiKey,
            { systemInstruction: { parts: [{ text: actionSystemPrompt }] } },
            aiModelConfig.modelChain
          );

          if (!actionResponse.success || !actionResponse.content) {
            handler.sendThinkingStep('action', 'Planning skipped', 'No action plan generated', 'completed');
            break;
          }

          // Parse JSON — more robust extraction
          let parsed: any = null;
          let rawContent = actionResponse.content.trim();

          // 1. Try to extract JSON object
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.warn('[ActionPlanningLoop] JSON parse failed on first match');
            }
          }

          // 2. Fallback: try full content
          if (!parsed) {
            try {
              parsed = JSON.parse(rawContent);
            } catch (e) {
              // Try cleaning common model wrappers
              const cleaned = rawContent
                .replace(/```(?:json)?/g, '')
                .replace(/```/g, '')
                .trim();
              try {
                parsed = JSON.parse(cleaned);
              } catch {}
            }
          }

          if (!parsed) {
            console.error('[ActionPlanningLoop] Failed to parse action plan JSON after cleaning');
            handler.sendThinkingStep('action', 'Action Planning Warning', 'Could not parse action plan (model output issue)', 'completed');
            break;
          }

          let actionsToExecute: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.actions) ? parsed.actions : (parsed.type ? [parsed] : []));

          if (!actionsToExecute.length) {
            handler.sendThinkingStep('action', 'No actions needed', 'Proceeding to response...', 'completed', { actionCount: 0 });
            break;
          }

          // Filter to supported types
          const filteredActions = actionsToExecute.filter(a => {
            if (SUPPORTED_ACTION_TYPES.includes(a.type)) return true;
            console.warn(`[ActionPlanningLoop] Skipping unsupported action: ${a.type}`);
            executedActions.push({ type: a.type, success: false, error: `Unsupported action type '${a.type}'`, timestamp: new Date().toISOString() });
            return false;
          });

          if (filteredActions.length > 0) {
            const execResults = await executeParsedActions(actionsService, userId, sessionId, filteredActions,
              (action: any, index: number, total: number) => {
                handler.sendThinkingStep('action', `Action ${index + 1}/${total}`, `${getFriendlyActionLabel(action.type, action.params)}...`, 'in-progress');
              }
            );
            executedActions = executedActions.concat(execResults);
          }

          const needsConfirmation = executedActions.filter(isNeedsConfirmationAction);
          if (needsConfirmation.length > 0) {
            handler.sendThinkingStep('action', 'Awaiting confirmation', 'Actions require user confirmation.', 'completed');
            break;
          }

          const failures = executedActions.filter(a => !a.success);
          if (failures.length === 0) {
            handler.sendThinkingStep('action', 'Actions executed', `Successfully executed ${executedActions.filter(a => a.success).length} actions.`, 'completed');
            break;
          }

          planningAttempt++;
          if (planningAttempt >= ENHANCED_PROCESSING_CONFIG.ACTION_FIX_ATTEMPTS) {
            handler.sendThinkingStep('action', 'Action Fix Failed', `Some actions failed after ${planningAttempt} attempts.`, 'completed');
            break;
          }

          const repairPrompt = `Previous actions failed. Results:\n${JSON.stringify(truncateActionResults(executedActions), null, 2)}\n\nFix ONLY the failed actions. Return corrected JSON only:`;
          conversationData.contents.push({ role: 'user', parts: [{ text: repairPrompt }] });
          await sleep(ENHANCED_PROCESSING_CONFIG.ACTION_FIX_BACKOFF_MS * planningAttempt);
        }
      } catch (actionError: any) {
        console.error('Error during action planning:', actionError);
        handler.sendThinkingStep('action', 'Action Planning Error', 'Continuing to response generation...', 'completed');
      }

      // ── Final Response Generation ──
      console.log('🏁 Generating Final Response...');
      const finalContents = [...conversationData.contents];

      if (executedActions.length > 0) {
        const successful = executedActions.filter(a => a.success && !isNeedsConfirmationAction(a));
        const pending = executedActions.filter(isNeedsConfirmationAction);
        const failed = executedActions.filter(a => !a.success && !isNeedsConfirmationAction(a));

        const imageUrls: string[] = executedActions
          .filter(a => a.type === 'GENERATE_IMAGE' && a.success && a.data)
          .map(a => a.data.imageUrl || a.data.image_url || a.data.url).filter(Boolean);

        const imageInstr = imageUrls.length > 0
          ? `\nInclude generated images using: ![description](url)\nURLs: ${imageUrls.map(u => `- ${u}`).join('\n')}`
          : '';

        finalContents.push({
          role: 'user',
          parts: [{
            text: `System: Actions complete. ${successful.length} succeeded, ${pending.length} awaiting confirmation, ${failed.length} failed.\nResults: ${JSON.stringify(truncateActionResults(executedActions))}\n\nDo NOT output raw JSON. Respond naturally to the user.${imageInstr}`
          }]
        });
      }

      let generatedText = '';
      let modelUsed = aiModelConfig.displayLabel;

      const streamResult = await callEnhancedGeminiAPIStream(
        finalContents, geminiApiKey,
        async (chunk) => { try { handler.sendContentChunk(chunk); } catch {} },
        { systemInstruction: conversationData.systemInstruction },
        aiModelConfig.streamingChain
      );

      if (!streamResult.success || !streamResult.content) {
        const fallback = await callEnhancedGeminiAPI(finalContents, geminiApiKey, { systemInstruction: conversationData.systemInstruction }, aiModelConfig.modelChain);
        if (!fallback.success || !fallback.content) throw new Error('Failed to generate final response');
        generatedText = fallback.content;
        if (fallback.modelUsed) modelUsed = fallback.modelUsed;
        handler.sendContentChunk(generatedText);
      } else {
        generatedText = streamResult.content;
        if (streamResult.modelUsed) modelUsed = streamResult.modelUsed;
      }

      handler.sendThinkingStep('action', 'Response generated', 'Successfully generated response', 'completed');

      // ── Extract & Save Images ──
      function extractImageBlocks(text: string): { cleaned: string; images: Array<{ url: string; alt?: string }> } {
        const images: Array<{ url: string; alt?: string }> = [];
        let cleaned = text;
        const imageRegex = /```image\s*\n([\s\S]*?)\n```/g;
        let match: RegExpExecArray | null;
        while ((match = imageRegex.exec(text)) !== null) {
          try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed?.url) {
              images.push({ url: parsed.url, alt: parsed.alt || '' });
              cleaned = cleaned.replace(match[0], `![${(parsed.alt || '').replace(/\]|\(/g, '')}](${parsed.url})`);
            }
          } catch {}
        }
        return { cleaned, images };
      }

      const { cleaned, images } = extractImageBlocks(generatedText);
      for (const ea of executedActions) {
        if (ea.type === 'GENERATE_IMAGE' && ea.success && ea.data) {
          const imgUrl = ea.data.imageUrl || ea.data.image_url || ea.data.url;
          if (imgUrl && !images.some(i => i.url === imgUrl)) images.push({ url: imgUrl, alt: ea.data.prompt || 'Generated image' });
        }
      }

      let finalText = sanitizeAssistantOutput(cleaned);
      if (images.length > 0 && !images.some(img => finalText.includes(img.url))) {
        finalText = finalText.trimEnd() + images.map(img => `\n\n![${(img.alt || 'Generated image').replace(/[[\]()]/g, '')}](${img.url})`).join('');
      }

      // Save AI message
      const savedAiMessage = await saveChatMessage({
        userId, sessionId, content: finalText, role: 'assistant',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        isError: false,
        filesMetadata: images.length > 0 ? images.map(img => ({ type: 'image', url: img.url, alt: img.alt })) : null,
        imageUrl: images.length > 0 ? images[0].url : null,
        imageMimeType: images.length > 0 ? (images[0].url.endsWith('.png') ? 'image/png' : 'image/jpeg') : null
      });

      if (generatedText) await updateSessionTokenCount(sessionId, userId, generatedText, 'add').catch(console.error);

      const successCount = executedActions.filter(a => a.success && !isNeedsConfirmationAction(a)).length;
      const confirmCount = executedActions.filter(isNeedsConfirmationAction).length;
      const failCount = executedActions.filter(a => !a.success && !isNeedsConfirmationAction(a)).length;

      handler.sendDone({
        response: finalText,
        aiMessageId: savedAiMessage?.id,
        aiMessageTimestamp: savedAiMessage?.timestamp,
        userMessageId, userMessageTimestamp, sessionId, userId,
        executedActions: truncateActionResults(executedActions),
        images: images.length > 0 ? images : null,
        imageUrl: images.length > 0 ? images[0].url : undefined,
        modelUsed, modelLabel: aiModelConfig.displayLabel, modelTier: aiModelConfig.tier
      });

      handler.close();
      console.log('✅✅✅ Streaming response completed successfully!');

      if (conversationData.contextInfo.recentMessages.length >= ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) {
        updateConversationSummary(sessionId, userId, conversationData.contextInfo.recentMessages).catch(console.error);
      }
    } catch (error: any) {
      console.error('❌ FATAL ERROR in streaming handler:', error.message, error.stack);
      logSystemError(supabase, {
        severity: 'critical', source: 'gemini-chat', component: 'streaming-handler',
        error_code: 'STREAMING_FATAL', message: `Fatal streaming error: ${error.message}`,
        details: { stack: error.stack, sessionId }, user_id: userId
      });
      if (!handler.isClosed) handler.sendError(error.message || 'An error occurred');
      handler.close();
    }
  })();

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...corsHeaders }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVER HANDLER
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  let requestData: any = null;
  const rawFiles: File[] = [];
  let jsonFiles: any[] = [];
  let uploadedDocumentIds: string[] = [];
  const userMessageImageUrl: string | null = null;
  const userMessageImageMimeType: string | null = null;
  let processingResults: any[] = [];

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      requestData = {
        userId: formData.get('userId'),
        sessionId: formData.get('sessionId'),
        learningStyle: formData.get('learningStyle'),
        learningPreferences: formData.get('learningPreferences') ? JSON.parse(formData.get('learningPreferences') as string) : {},
        message: formData.get('message') || '',
        attachedDocumentIds: formData.get('attachedDocumentIds') ? JSON.parse(formData.get('attachedDocumentIds') as string) : [],
        attachedNoteIds: formData.get('attachedNoteIds') ? JSON.parse(formData.get('attachedNoteIds') as string) : [],
        imageUrl: formData.get('imageUrl'), imageMimeType: formData.get('imageMimeType'),
        aiMessageIdToUpdate: formData.get('aiMessageIdToUpdate'),
        userMessageIdToUpdate: formData.get('userMessageIdToUpdate')
      };
      for (const [, value] of formData.entries()) {
        if (value instanceof File) rawFiles.push(value);
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.text();
      try {
        requestData = JSON.parse(body);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (requestData.files && Array.isArray(requestData.files)) jsonFiles = requestData.files;
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported content type' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const {
      userId, sessionId,
      learningStyle = 'visual',
      learningPreferences = {},
      message = '',
      attachedDocumentIds = [],
      attachedNoteIds = [],
      courseContext = null,
      imageUrl = null, imageMimeType = null,
      aiMessageIdToUpdate = null,
      userMessageIdToUpdate = null,
      enableStreaming = true
    } = requestData;

    if (!userId || !sessionId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: userId or sessionId' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkAiMessageLimit(userId);
    if (!limitCheck.allowed) return createErrorResponse(limitCheck.message || 'AI message limit exceeded', 403);

    const totalFiles = rawFiles.length + jsonFiles.length;
    if (totalFiles > 10) {
      return new Response(JSON.stringify({ error: `Too many files. Maximum is 10 per request. You attached ${totalFiles}.` }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    for (const file of rawFiles) {
      if (file.size > 20 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: `File too large: ${file.name}. Maximum is 20MB.` }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    let filesMetadata: any[] = [];
    let courseMaterialsContext = '';
    let attachedContext = '';

    // Fetch course materials
    if (courseContext?.id) {
      try {
        const { data: cmData } = await supabase.from('course_materials').select('document_id').eq('course_id', courseContext.id);
        if (Array.isArray(cmData) && cmData.length > 0) {
          const courseDocIds = cmData.map((r: any) => r.document_id).filter(Boolean);
          for (const id of courseDocIds) { if (!attachedDocumentIds.includes(id)) attachedDocumentIds.push(id); }
          const { data: docs } = await supabase.from('documents').select('id,title,file_name,content_extracted,processing_status').in('id', courseDocIds);
          if (Array.isArray(docs)) {
            courseMaterialsContext += `COURSE MATERIALS FOR ${courseContext.title || courseContext.id}:\n`;
            for (const d of docs) {
              courseMaterialsContext += `Title: ${d.title || d.file_name}\n`;
              courseMaterialsContext += d.content_extracted ? `Content: ${d.content_extracted}\n\n` : `Processing: ${d.processing_status || 'pending'}\n\n`;
            }
          }
        }
      } catch (err) {
        console.error('[gemini-chat] Error fetching course materials:', err);
      }
    }

    const hasFiles = rawFiles.length > 0 || jsonFiles.length > 0;
    let userMessageId: string | null = null;
    let userMessageTimestamp: string | null = null;

    // Process files
    if (hasFiles) {
      const processorUrl = Deno.env.get('DOCUMENT_PROCESSOR_URL');
      if (!processorUrl) throw new Error('DOCUMENT_PROCESSOR_URL not configured');

      let processorResponse: Response;
      if (contentType.includes('multipart/form-data')) {
        const formData = new FormData();
        formData.append('userId', userId);
        for (const file of rawFiles) formData.append('file', file);
        processorResponse = await fetch(processorUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey }, body: formData });
      } else {
        processorResponse = await fetch(processorUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey }, body: JSON.stringify({ userId, files: jsonFiles }) });
      }

      if (!processorResponse.ok) {
        const errorBody = await processorResponse.text();
        const errorMsg = await saveChatMessage({
          userId, sessionId,
          content: `❌ I encountered an issue processing your documents. Please try uploading smaller files or one at a time.\n\nError: ${errorBody}`,
          role: 'assistant', isError: true
        });
        return new Response(JSON.stringify({ error: 'Document processing failed', aiMessageId: errorMsg?.id, success: false }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const processedData = await processorResponse.json();
      uploadedDocumentIds = processedData.uploadedDocumentIds || [];
      filesMetadata = processedData.filesMetadata || [];
      processingResults = processedData.processingResults || [];

      const failedFiles = processingResults.filter((r: any) => r.status === 'failed');
      if (failedFiles.length === processingResults.length && failedFiles.length > 0) {
        const errorMsg = await saveChatMessage({
          userId, sessionId,
          content: `❌ All ${failedFiles.length} file(s) failed to process. Please check file formats and try again.`,
          role: 'assistant', isError: true
        });
        return new Response(JSON.stringify({ error: 'All documents failed to process', aiMessageId: errorMsg?.id, success: false }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    const allDocumentIds = [...new Set([...uploadedDocumentIds, ...attachedDocumentIds])];
    await ensureChatSession(userId, sessionId, allDocumentIds, message, !userMessageIdToUpdate);

    // Save user message
    if (message || hasFiles || attachedContext) {
      const saved = await saveChatMessage({
        userId, sessionId, content: message, role: 'user',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        imageUrl: userMessageImageUrl || imageUrl,
        imageMimeType: userMessageImageMimeType || imageMimeType,
        filesMetadata: filesMetadata.length > 0 ? filesMetadata : null,
        messageIdToUpdate: userMessageIdToUpdate
      });
      if (saved) {
        userMessageId = saved.id;
        userMessageTimestamp = saved.timestamp;
        if (message) updateSessionTokenCount(sessionId, userId, message, 'add').catch(console.error);
      }
    }

    // ── STREAMING PATH ──
    if (enableStreaming) {
      return handleStreamingResponse(
        userId, sessionId, message, allDocumentIds, attachedNoteIds,
        learningStyle, learningPreferences, userMessageImageUrl, imageMimeType,
        filesMetadata, userMessageId, userMessageTimestamp, aiMessageIdToUpdate,
        courseMaterialsContext, courseContext
      );
    }

    // ── NON-STREAMING PATH ──
    const aiModelConfig = await (async () => {
      try {
        const mv = createSubscriptionValidator();
        return await mv.getAiModelConfig(userId);
      } catch {
        return { tier: 'free' as const, modelChain: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'], streamingChain: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'], displayLabel: 'Gemini Flash' };
      }
    })();

    const conversationHistory = await getConversationHistory(userId, sessionId);
    const userIntent = await agenticCore.understandQuery(message, userId, conversationHistory);
    const relevantContext = await agenticCore.retrieveRelevantContext(userIntent, userId, sessionId);
    const reasoningChain = await agenticCore.buildReasoningChain(userIntent, relevantContext, message);
    const [workingMemory, longTermMemory, episodicMemory] = await Promise.all([
      agenticCore.getWorkingMemory(sessionId, userId),
      agenticCore.getLongTermMemory(userId),
      agenticCore.getEpisodicMemory(userId, message)
    ]);

    attachedContext = '';
    if (allDocumentIds.length > 0 || attachedNoteIds.length > 0) {
      attachedContext = await buildAttachedContext(allDocumentIds, attachedNoteIds, userId);
    }
    if (courseMaterialsContext) attachedContext = `${courseMaterialsContext}\n\n${attachedContext}`;

    if (relevantContext.length > 0) {
      attachedContext += '\n\n=== SEMANTICALLY RELEVANT CONTEXT ===\n';
      relevantContext.slice(0, 10).forEach(ctx => {
        attachedContext += `\n[${ctx.type.toUpperCase()}] ${ctx.title} (${(ctx.relevanceScore * 100).toFixed(0)}%)\n`;
        if (ctx.content) attachedContext += `${ctx.content.substring(0, 500)}${ctx.content.length > 500 ? '...' : ''}\n`;
      });
    }
    attachedContext += '\n\n=== REASONING CHAIN ===\n' + reasoningChain.join('\n');
    if (episodicMemory.relevantSessions?.length > 0) {
      attachedContext += '\n\n=== RELEVANT PAST DISCUSSIONS ===\n';
      episodicMemory.relevantSessions.forEach((s: any) => { attachedContext += `- ${s.title}: ${s.context_summary || 'No summary'}\n`; });
    }

    const userContext = await contextService.getUserContext(userId);
    const systemPrompt = promptEngine.createEnhancedSystemPrompt(learningStyle, learningPreferences, userContext, 'light');
    const conversationData = await buildEnhancedGeminiConversation(userId, sessionId, message, [], attachedContext, systemPrompt);

    if (aiMessageIdToUpdate) {
      await supabase.from('chat_messages').update({ is_updating: true, is_error: false })
        .eq('id', aiMessageIdToUpdate).eq('session_id', sessionId).eq('user_id', userId);
    }

    const finalResponse = await callEnhancedGeminiAPI(conversationData.contents, geminiApiKey, {
      systemInstruction: conversationData.systemInstruction,
      temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192
    }, aiModelConfig.modelChain);

    let generatedText = finalResponse.success && finalResponse.content
      ? finalResponse.content
      : (finalResponse.userMessage || 'I apologize, but I was unable to generate a response. Please try again.');

    const actionResult = await executeAIActions(userId, sessionId, generatedText);
    generatedText = sanitizeAssistantOutput(actionResult.modifiedResponse);

    const nonStreamImages: Array<{ url: string; alt?: string }> = [];
    for (const ea of actionResult.executedActions) {
      if (ea.type === 'GENERATE_IMAGE' && ea.success && ea.data) {
        const imgUrl = ea.data.imageUrl || ea.data.image_url || ea.data.url;
        if (imgUrl) nonStreamImages.push({ url: imgUrl, alt: ea.data.prompt || 'Generated image' });
      }
    }
    if (nonStreamImages.length > 0 && !nonStreamImages.some(img => generatedText.includes(img.url))) {
      generatedText = generatedText.trimEnd() + nonStreamImages.map(img => `\n\n![${(img.alt || 'Generated image').replace(/[[\]()]/g, '')}](${img.url})`).join('');
    }

    if (finalResponse.success && generatedText) {
      try {
        const facts = await extractUserFacts(message, generatedText, userId, sessionId);
        if (facts.length > 0) await contextService.updateUserMemory(userId, facts);
      } catch {}
    }

    const { data: existingSession } = await supabase.from('chat_sessions').select('title').eq('id', sessionId).eq('user_id', userId).single();
    const aiGeneratedTitle = existingSession?.title || 'New Chat Session';

    let aiMessageId: string | null = null;
    let aiMessageTimestamp: string | null = null;

    if (aiMessageIdToUpdate) {
      await supabase.from('chat_messages').update({
        content: generatedText, is_updating: false, is_error: !finalResponse.success,
        conversation_context: { totalMessages: (conversationData.contextInfo?.totalMessages || 0) + 1 }
      }).eq('id', aiMessageIdToUpdate).eq('session_id', sessionId).eq('user_id', userId);
      aiMessageId = aiMessageIdToUpdate;
      aiMessageTimestamp = new Date().toISOString();
    } else {
      const savedAiMessage = await saveChatMessage({
        userId, sessionId, content: generatedText, role: 'assistant',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        imageUrl: nonStreamImages.length > 0 ? nonStreamImages[0].url : (userMessageImageUrl || imageUrl),
        imageMimeType: nonStreamImages.length > 0 ? 'image/jpeg' : (userMessageImageMimeType || imageMimeType),
        filesMetadata: nonStreamImages.length > 0 ? nonStreamImages.map(img => ({ type: 'image', url: img.url, alt: img.alt })) : null,
        isError: !finalResponse.success
      });
      if (savedAiMessage) { aiMessageId = savedAiMessage.id; aiMessageTimestamp = savedAiMessage.timestamp; }
    }

    if (generatedText) await updateSessionTokenCount(sessionId, userId, generatedText, 'add').catch(console.error);
    await updateSessionLastMessage(sessionId, conversationData.contextInfo?.conversationSummary || null, aiGeneratedTitle);

    if ((conversationData.contextInfo?.recentMessages?.length || 0) >= ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) {
      updateConversationSummary(sessionId, userId, conversationData.contextInfo.recentMessages).catch(console.error);
    }

    return new Response(JSON.stringify({
      response: generatedText,
      userId, sessionId, title: aiGeneratedTitle,
      timestamp: new Date().toISOString(),
      userMessageId, userMessageTimestamp, aiMessageId, aiMessageTimestamp,
      processingTime: Date.now() - startTime,
      filesProcessed: hasFiles ? rawFiles.length || jsonFiles.length : 0,
      documentIds: allDocumentIds,
      contextInfo: {
        totalMessages: conversationData.contextInfo?.totalMessages || 0,
        recentMessages: conversationData.contextInfo?.recentMessages?.length || 0,
        summarizedMessages: conversationData.contextInfo?.summarizedMessages || 0,
        hasSummary: !!conversationData.contextInfo?.conversationSummary
      },
      processingResults,
      success: finalResponse.success,
      modelUsed: finalResponse.modelUsed || aiModelConfig.modelChain[0],
      modelLabel: aiModelConfig.displayLabel,
      modelTier: aiModelConfig.tier,
      executedActions: actionResult.executedActions.map(a => ({ type: a.type, success: a.success, timestamp: a.timestamp })),
      images: nonStreamImages.length > 0 ? nonStreamImages : null,
      imageUrl: nonStreamImages.length > 0 ? nonStreamImages[0].url : undefined
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Error in ai-chat function:', error);
    logSystemError(supabase, {
      severity: 'critical', source: 'gemini-chat', component: 'main-handler',
      error_code: 'CHAT_REQUEST_FAILED',
      message: `AI chat request failed: ${error.message}`,
      details: { stack: error.stack, processingTime, sessionId: requestData?.sessionId },
      user_id: requestData?.userId
    });

    let userFriendlyMessage = 'I apologize, but I encountered an unexpected error. Please try again.';
    if (error.message?.includes('GEMINI_API_KEY')) userFriendlyMessage = 'The AI service is not properly configured. Please contact support.';
    else if (error.message?.includes('network') || error.message?.includes('fetch')) userFriendlyMessage = "I'm having trouble connecting to the AI service. Please check your connection.";

    if (requestData?.userId && requestData?.sessionId) {
      try {
        await saveChatMessage({ userId: requestData.userId, sessionId: requestData.sessionId, content: userFriendlyMessage, role: 'assistant', isError: true });
      } catch {}
    }

    return new Response(JSON.stringify({ error: userFriendlyMessage, errorDetails: error.message, processingTime, success: false }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});