import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.92.0';
import { UserContextService } from './context-service.ts';
import { EnhancedPromptEngine } from './prompt-engine.ts';
import { StuddyHubActionsService } from './actions-service.ts';
import { AgenticCore, type UserIntent } from './agentic-core.ts';
import { createStreamResponse, StreamingHandler } from './streaming-handler.ts';
import { createSubscriptionValidator, createErrorResponse } from '../utils/subscription-validator.ts';
import { executeParsedActions, runAction, getFriendlyActionLabel, extractPendingConfirmationInfo, isExplicitConfirmationMessage, isConfirmationDeclineMessage } from './actions_helper.ts';
import { DB_SCHEMA_DEFINITION } from './db_schema.ts';
import { logSystemError } from '../_shared/errorLogger.ts';
import {
  sanitizeAssistantOutput,
  containsInternalPromptLeak,
  enrichResponseWithActionData,
  looksLikeActionResidue,
  isUnsafeAssistantOutput,
  parseReActStep,
  buildFilteredSchemaForIntent,
  buildPrefetchedContextSummary,
  type ReActStep,
  type BatchInfo
} from './sanitize.ts';

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ─────────────────────────────────────────────────────────────────────────────
// QUOTA CIRCUIT-BREAKER & MODEL CACHING
// Models that returned 429 in this instance lifetime are skipped immediately.
// Resets on cold-start (new Deno isolate). Per-model TTL: 60 seconds.
// Also remembers the last successful model to bypass trying broken ones.
// ─────────────────────────────────────────────────────────────────────────────
const quotaExhaustedModels = new Map<string, number>(); // model → expiry timestamp
const lastSuccessfulModels = new Map<string, string>(); // userId → model
const QUOTA_COOLDOWN_MS = 60_000; // 60 s before retrying a 429'd model
// C2: plan-level quota exhaustion ("check your plan and billing") is NOT a
// transient per-minute rate limit — retrying every 60s just re-fails each time.
// Use a long cooldown so the model is skipped for the rest of the turn + margin.
const QUOTA_LONG_COOLDOWN_MS = 12 * 60_000; // 12 min

// C2: distinguishes Gemini's plan/billing-level 429 from a true per-minute
// rate limit. The plan-level body literally says "You exceeded your current
// quota... check your plan and billing".
function isPlanLevelQuotaError(errorText: string): boolean {
  const t = (errorText || '').toLowerCase();
  return t.includes('your current quota') &&
    (t.includes('plan') || t.includes('billing') || t.includes('billing account'));
}

// Known Groq per-model TPM caps, taken from live 413 error bodies (verified
// 2026-08-06 against Groq's own free-plan table). qwen/qwen3.6-27b and
// groq/compound are newer additions to Groq's free lineup — no observed TPM
// error yet, so they're intentionally left out of this map. isRequestTooLarge()
// below treats an absent entry as "don't skip", so those two are always
// attempted; add their real limit here once a 413 body reveals it.
const GROQ_MODEL_TPM_LIMITS: Record<string, number> = {
  'llama-3.1-8b-instant': 6000,
  'openai/gpt-oss-120b': 8000,
  'openai/gpt-oss-20b': 8000,
  'llama-3.3-70b-versatile': 12000,
};

function isQuotaExhausted(model: string): boolean {
  const expiry = quotaExhaustedModels.get(model);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) { quotaExhaustedModels.delete(model); return false; }
  return true;
}
// C2: plan-level quota 429 gets the LONG cooldown; ordinary rate limits 60s.
function markQuotaExhausted(model: string, errorText?: string): void {
  const cooldown = (errorText && isPlanLevelQuotaError(errorText)) ? QUOTA_LONG_COOLDOWN_MS : QUOTA_COOLDOWN_MS;
  quotaExhaustedModels.set(model, Date.now() + cooldown);
  for (const [uId, preferred] of lastSuccessfulModels.entries()) {
    if (preferred === model) {
      lastSuccessfulModels.delete(uId);
    }
  }
  console.warn(`[QuotaCircuitBreaker] Model ${model} marked exhausted for ${cooldown / 1000}s (${isPlanLevelQuotaError(errorText || '') ? 'plan-level quota' : 'rate limit'})`);
}

// C2: xAI 403 "no credits" — dead credential, not transient. Cooldown keyed
// separately (xai/<model>) so it can't collide with Gemini model names, and
// honored by callOpenAIStyleFallback before attempting the provider.
function markXaiNoCredits(model: string): void {
  quotaExhaustedModels.set(`xai/${model}`, Date.now() + QUOTA_LONG_COOLDOWN_MS);
  console.warn(`[QuotaCircuitBreaker] xAI ${model} marked exhausted (no credits) for ${QUOTA_LONG_COOLDOWN_MS / 1000}s`);
}
function isXaiNoCredits(model: string): boolean {
  const expiry = quotaExhaustedModels.get(`xai/${model}`);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) { quotaExhaustedModels.delete(`xai/${model}`); return false; }
  return true;
}

async function savePreferredModel(userId: string, model: string): Promise<void> {
  try {
    const { data: profile, error: getError } = await supabase
      .from('profiles')
      .select('learning_preferences')
      .eq('id', userId)
      .single();

    if (getError) {
      console.error('[PreferredModel] Error loading profile:', getError);
      return;
    }

    const currentPrefs = profile?.learning_preferences || {};
    const updatedPrefs = { ...currentPrefs, preferred_model: model };

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ learning_preferences: updatedPrefs })
      .eq('id', userId);

    if (updateError) {
      console.error('[PreferredModel] Error updating profile preferred_model:', updateError);
    } else {
      console.log(`[PreferredModel] Saved preference for ${userId}: ${model}`);
    }
  } catch (e) {
    console.error('[PreferredModel] Exception saving preferred model:', e);
  }
}

function getPreferredModel(userId: string, userContext?: any): string | null {
  // 1. Try warm in-memory cache first
  const inMemory = lastSuccessfulModels.get(userId);
  if (inMemory) return inMemory;

  // 2. Try database userContext/profile next
  const dbModel = userContext?.profile?.learning_preferences?.preferred_model;
  if (dbModel && typeof dbModel === 'string') return dbModel;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const ENHANCED_PROCESSING_CONFIG = {
  MAX_INPUT_TOKENS: 2 * 1024 * 1024,
  MAX_OUTPUT_TOKENS: 8192,
  MAX_CONVERSATION_HISTORY: 500,
  SUMMARY_THRESHOLD: 10,
  RETRY_ATTEMPTS: 3,
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
const rawGroq = Deno.env.get('GROQ_API_KEY') || '';
const rawXai = Deno.env.get('XAI_API_KEY') || Deno.env.get('GROK_API_KEY') || Deno.env.get('GROK_API_TOKEN') || '';

// Detect key formats: Groq keys start with 'gsk_', xAI keys start with 'xai-'
const groqApiKey = rawGroq.startsWith('gsk_') ? rawGroq : (rawXai.startsWith('gsk_') ? rawXai : rawGroq);
const xaiApiKey = rawXai.startsWith('xai-') ? rawXai : (rawGroq.startsWith('xai-') ? rawGroq : rawXai);
const hfApiKey = Deno.env.get('HF_API_TOKEN') || Deno.env.get('HUGGINGFACE_API_KEY') || Deno.env.get('HF_API_KEY') || Deno.env.get('HUGGING_FACE_API_KEY') || '';
// SambaNova Cloud — separate free daily quota (200K tokens/day PER MODEL, not
// shared across models like Groq's org-wide TPD). No card required for the
// free tier; it only converts to paid once a payment method is linked. Get a
// key at https://cloud.sambanova.ai
const sambaNovaApiKey = Deno.env.get('SAMBANOVA_API_KEY') || '';

const agenticCore = new AgenticCore(supabaseUrl, supabaseServiceKey, geminiApiKey);

// C1: boot-time build stamp. Every cold start logs a unique hash + timestamp so
// we can verify in production logs that this exact build (with smart intent gating,
// confirmation affirmation tracking, robust fallback parsing, and token pruning) is running.
const BUILD_STAMP = `gemini-chat-build-${Math.random().toString(36).slice(2, 10)}`;
console.log(`[BOOT] ${BUILD_STAMP} | started at ${new Date().toISOString()} | placeholder-assistant-skip & confirmation-ledger-fix active`);

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
  const jitter = Math.random() * 200;
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW DIAGNOSTIC LOGGING
// ─────────────────────────────────────────────────────────────────────────────
const FLOW_LOG_MAX_CHARS = 600;

function safeStringify(value: any): string {
  try {
    if (typeof value === 'string') return value;
    if (value === undefined || value === null) return '';
    const seen = new WeakSet<any>();
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return val.toString() + 'n';
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    }) ?? '';
  } catch {
    return String(value);
  }
}

function flowPreview(value: any, max = FLOW_LOG_MAX_CHARS): string {
  if (value === undefined || value === null) return '';
  const text = safeStringify(value);
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > max ? compact.substring(0, max) + `… [${text.length} chars total]` : compact;
}

function flowLog(scope: string, message: string, details?: any): void {
  const suffix = details === undefined ? '' : ` | ${safeStringify(details)}`;
  console.log(`[FlowDiag:${scope}] ${message}${suffix}`);
}

function flowWarn(scope: string, message: string, details?: any): void {
  const suffix = details === undefined ? '' : ` | ${safeStringify(details)}`;
  console.warn(`[FlowDiag:${scope}] ${message}${suffix}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART TOOL-USE & CONFIRMATION GATING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if the user's message or context warrants running the heavy ReAct Action Planner.
 * Evaluates:
 * 1. Direct explicit action keywords in the query (create, update, delete, search DB, etc.)
 * 2. Pending confirmation / ledger state from the previous turn
 * 3. Affirmation replies ("yes", "go ahead", "do it", "sure") responding to an action proposal in the previous assistant message.
 */
function shouldTriggerActionPlanner(
  userQuery: string,
  userIntent: UserIntent,
  isAwaitingConfirmation: boolean,
  recentMessages?: any[]
): { trigger: boolean; reason: string; lastAssistantProposal?: string } {
  // 1. If awaiting formal confirmation or ledger exists, ALWAYS trigger
  if (isAwaitingConfirmation) {
    return { trigger: true, reason: 'awaiting_confirmation_state' };
  }

  // 2. Direct intent flags from understandQuery
  if (userIntent.requiresAction || userIntent.primary === 'content_creation' || userIntent.primary === 'content_modification' || userIntent.primary === 'planning_organization') {
    return { trigger: true, reason: `intent_detected_${userIntent.primary}` };
  }

  // 3. Regex check for explicit action commands
  const explicitActionPattern = /\b(create|make|generate|save|store|keep|delete|remove|update|change|modify|schedule|reschedule|add to my|search my|look up my|find in my|check my|query|fetch|search the web|search web|browse the web|google|find online|search online|look up online|download link|import url|import link)\b/i;
  if (explicitActionPattern.test(userQuery)) {
    return { trigger: true, reason: 'explicit_action_keywords' };
  }

  // 4. Affirmation & Go-Ahead Detection (Solution for "Yes", "Go ahead", "Do it")
  const isAffirmation = /^(yes|yeah|yep|yup|sure|go ahead|do it|ok|okay|please|proceed|sounds good|create it|save it|generate it|make it|do that|let's do it|please do)\b/i.test(userQuery.trim());
  
  if (isAffirmation && recentMessages && recentMessages.length > 0) {
    // Scan back through recent assistant messages (not just the immediate first one)
    const assistantMessages = recentMessages.filter((m: any) => m && (m.role === 'assistant' || m.role === 'model') && typeof m.content === 'string' && m.content.trim().length > 0).slice(0, 5);
    for (const lastAssistantMsg of assistantMessages) {
      const content = lastAssistantMsg.content;
      // Check if previous assistant message offered or asked to perform an action
      const actionOfferPattern = /(should i|would you like me to|shall i|do you want me to|i can (create|generate|save|schedule|add|make|quiz|deck)|let me know if you want me to (create|save|make|generate)|want me to go ahead|ready to save)/i;
      if (actionOfferPattern.test(content)) {
        return { 
          trigger: true, 
          reason: 'affirmation_of_assistant_proposal',
          lastAssistantProposal: content.substring(0, 150)
        };
      }
    }
  }

  return { trigger: false, reason: 'conversational_or_tutoring' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER WITH ROBUST FALLBACK (Handles JSON, markdown code blocks, & plain text)
// ─────────────────────────────────────────────────────────────────────────────
function parsePlannerResponseRobust(rawContent: string): { step: ReActStep; parseError?: string; wasDirectText?: boolean } {
  const trimmed = rawContent.trim();
  
  // Try standard parseReActStep first
  const parsed = parseReActStep(trimmed);
  if (!parsed.parseError && (parsed.step.actions?.length || parsed.step.actionNeeded !== undefined || parsed.step.thought)) {
    return parsed;
  }

  // If JSON parse failed, try extracting JSON from markdown or anywhere in string
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const extracted = JSON.parse(jsonMatch[0]);
      if (extracted && typeof extracted === 'object') {
        const step: ReActStep = {
          thought: extracted.thought_process || extracted.thought || '',
          actions: extracted.actions || [],
          actionNeeded: extracted.action_needed !== undefined ? extracted.action_needed : (extracted.actions?.length > 0 ? true : undefined)
        };
        return { step };
      }
    } catch (_) {
      // JSON inside match was malformed
    }
  }

  // Fallback: If model returned pure text without JSON schema (e.g. Nemotron/OpenRouter conversational text),
  // treat as action_needed: false with the text as thought/diagnosis so we do not fail with a ReAct parser error!
  console.log('[PlannerParser] Model returned plain conversational text instead of JSON schema. Gracefully treating as action_needed: false.');
  return {
    step: {
      thought: trimmed.substring(0, 300),
      actionNeeded: false
    },
    wasDirectText: true
  };
}
function isMeaningfulAssistantMessage(msg: any): boolean {
  if (!msg || (msg.role !== 'assistant' && msg.role !== 'model')) return false;
  // If it has conversation_context with pending confirmation or actions, it is meaningful!
  if (msg.conversation_context) {
    const rawCtx = typeof msg.conversation_context === 'string' ? msg.conversation_context : JSON.stringify(msg.conversation_context);
    if (rawCtx.includes('awaitingConfirmation') || rawCtx.includes('pendingActions')) {
      return true;
    }
  }
  // If it has non-empty content (excluding pure whitespace)
  if (typeof msg.content === 'string' && msg.content.trim().length > 0) {
    return true;
  }
  return false;
}

function isAwaitingConfirmationReply(recentMessages?: any[]): boolean {
  if (!recentMessages || recentMessages.length === 0) return false;
  // Scan through up to 5 recent meaningful assistant messages (in reverse chronological order)
  let scannedAssistantCount = 0;
  for (const msg of recentMessages) {
    if (!isMeaningfulAssistantMessage(msg)) continue;
    scannedAssistantCount++;
    let ctx = msg.conversation_context;
    while (typeof ctx === 'string') {
      try {
        const parsed = JSON.parse(ctx);
        if (parsed === ctx) break;
        ctx = parsed;
      } catch (_) {
        break;
      }
    }
    const rawCtxStr = typeof msg.conversation_context === 'string' ? msg.conversation_context : JSON.stringify(msg.conversation_context || '');
    if ((ctx && typeof ctx === 'object' && (ctx.awaitingConfirmation === true || (ctx.pendingActions && ctx.pendingActions.length > 0))) || rawCtxStr.includes('"awaitingConfirmation":true') || rawCtxStr.includes('"awaitingConfirmation": true')) {
      return true;
    }
    if (scannedAssistantCount >= 5) break;
  }
  return false;
}

/**
 * Builds the confirmation ledger for the CURRENT turn: the signature variants of
 * every action held on the most recent assistant turn (the confirmation ask) plus
 * whether the user's own message is an explicit confirmation. This is passed to
 * executeParsedActions so a `confirmed: true` re-emission from the planner is
 * honored ONLY when it matches a genuinely pending action AND the user confirmed
 * this turn. Without it, confirmationMatchesPending() sees no ledger context and
 * re-holds the confirmed action — the accept → re-ask loop.
 */
function buildConfirmationContext(recentMessages: any[], userMessage: string): {
  pendingSignatures: Set<string>;
  userConfirmationIntent: boolean;
  userMessage: string;
  malformed: boolean;
} {
  // Scope to the most recent meaningful assistant message that contains confirmation state or pending actions
  const scoped: any[] = [];
  let fallbackMsg: any = null;
  for (const msg of recentMessages) {
    if (isMeaningfulAssistantMessage(msg)) {
      if (!fallbackMsg) fallbackMsg = msg;
      let ctx = msg.conversation_context;
      while (typeof ctx === 'string') {
        try {
          const parsed = JSON.parse(ctx);
          if (parsed === ctx) break;
          ctx = parsed;
        } catch (_) {
          break;
        }
      }
      const rawCtxStr = typeof msg.conversation_context === 'string' ? msg.conversation_context : JSON.stringify(msg.conversation_context || '');
      if ((ctx && typeof ctx === 'object' && (ctx.awaitingConfirmation || ctx.pendingActions)) || rawCtxStr.includes('awaitingConfirmation') || rawCtxStr.includes('pendingActions')) {
        scoped.push(msg);
        break;
      }
    }
  }
  if (scoped.length === 0 && fallbackMsg) {
    scoped.push(fallbackMsg);
  }
  const info = extractPendingConfirmationInfo(scoped);
  return {
    pendingSignatures: info.signatures,
    userConfirmationIntent: isExplicitConfirmationMessage(userMessage),
    userMessage,
    malformed: info.malformed
  };
}

/**
 * True when the user's message is a BARE acceptance of the pending confirmation
 * — the exact button reply from the app ("Yes, go ahead.") with no extra
 * instructions. Anything longer (e.g. the modal's custom field:
 * "Yes, go ahead. Change the title to X") is a custom instruction and must be
 * routed to the AI path for interpretation.
 */
const BARE_ACCEPTANCE_PHRASES = new Set([
  'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'proceed',
  'go ahead', 'do it', 'correct', 'confirm', 'yes please',
  'sounds good', 'yes go ahead', 'yes, go ahead', 'please proceed',
  'yes proceed', 'okay sure', 'go ahead please', 'yes please do it'
]);

function isBareAcceptance(message: string): boolean {
  if (!message) return false;
  const t = message.trim().replace(/[.!?]+$/g, '').trim().toLowerCase();
  return BARE_ACCEPTANCE_PHRASES.has(t);
}

/**
 * Rebuilds the executable action list from the most recent assistant turn's held
 * pendingActions (the confirmation ask). Returns `{ actions, incomplete }`:
 * fully-specified held actions are returned in `actions` (deterministically
 * executable), while batch stubs / legacy shapes that carry only identity (full
 * params can't be rebuilt) are returned in `incomplete` so the caller can still
 * execute what it can and hand the rest to the AI planner. Never silently drops
 * an unreconstructable item.
 */
function extractHeldActions(recentMessages: any[]): { actions: any[]; incomplete: any[] } {
  for (const msg of recentMessages) {
    if (!isMeaningfulAssistantMessage(msg)) continue;
    let ctx = msg.conversation_context;
    while (typeof ctx === 'string') {
      try {
        const p = JSON.parse(ctx);
        if (p === ctx) break;
        ctx = p;
      } catch (_) {
        break;
      }
    }
    if (!ctx || typeof ctx !== 'object' || !Array.isArray(ctx.pendingActions)) continue;

    const actions: any[] = [];
    const incomplete: any[] = [];
    for (const a of ctx.pendingActions) {
      if (!a || a.success !== false || !a.data || typeof a.data !== 'object') continue;
      const d = a.data;
      if (!d.needsConfirmation) continue;
      // If full params exist on the held item, reconstruct the action for immediate execution
      if (d.params && d.params.table && d.params.operation && d.params.data) {
        actions.push({ type: a.type || 'DB_ACTION', params: JSON.parse(JSON.stringify(d.params)) });
        continue;
      }
      // Legacy or stripped shape fallback:
      if (d.table && d.operation && d.proposedData && Object.keys(d.proposedData).length > 0) {
        actions.push({
          type: a.type || 'DB_ACTION',
          params: {
            table: d.table,
            operation: d.operation,
            data: JSON.parse(JSON.stringify(d.proposedData)),
            confirmed: true
          }
        });
        continue;
      }
      // If completely unrecoverable, mark as incomplete
      incomplete.push(a);
    }
    if (actions.length > 0 || incomplete.length > 0) return { actions, incomplete };
  }
  return { actions: [], incomplete: [] };
}

/**
 * Summarizes the pending (held) actions from the most recent confirmation ask for
 * injection into the planner prompt, so a confirmation reply ("yes") causes the
 * planner to re-emit ALL pending items together with `confirmed: true` — not just
 * the first one. Returns '' when nothing is pending.
 */
function summarizePendingActionsForPrompt(recentMessages: any[]): string {
  for (const msg of recentMessages) {
    if (!isMeaningfulAssistantMessage(msg)) continue;
    let ctx = msg.conversation_context;
    while (typeof ctx === 'string') {
      try { const p = JSON.parse(ctx); if (p === ctx) break; ctx = p; } catch { break; }
    }
    if (!ctx?.pendingActions?.length) continue;
    const lines = ctx.pendingActions.map((a: any, i: number) => {
      const d = a.data || {};
      const table = d.params?.table || d.table;
      const op = d.params?.operation || d.operation || 'INSERT';
      const identity = d.proposedData?.title || d.proposedData?.front
        || d.params?.data?.title || d.params?.data?.front || '(full data already in conversation above)';
      return `${i + 1}. ${op} into ${table}: "${identity}"`;
    });
    return `PENDING ACTIONS FROM YOUR LAST CONFIRMATION ASK (${lines.length} total — regenerate full content for EACH and re-emit ALL of them together in one "actions" array, each with confirmed:true, matching these exact identities):\n${lines.join('\n')}`;
  }
  return '';
}

/**
 * Builds the `pendingActions` array persisted on a confirmation ask's
 * conversation_context. Held actions (success:false + needsConfirmation) keep
 * their FULL params so the deterministic confirm path can re-execute them
 * faithfully — truncating them would re-save cut-off content. Everything else is
 * slimmed via truncateActionResults to keep the JSONB small. conversation_context
 * is never sent to the model, so full held payloads cost no tokens.
 */
function buildPendingActionsForContext(actions: any[]): any[] {
  const held: any[] = [];
  const others: any[] = [];
  for (const a of actions || []) {
    if (!a || typeof a !== 'object') continue;
    // Discard undefined action errors so they do not pollute conversation context
    if (a.error && (typeof a.error === 'string' && a.error.includes("'undefined'"))) continue;
    if (!a.type || a.type === 'undefined') continue;

    if (a.success === false && a.data && a.data.needsConfirmation) held.push(a);
    else others.push(a);
  }
  const heldFull = held.map(a => ({
    ...a,
    data: {
      ...a.data,
      params: a.data.params && typeof a.data.params === 'object'
        ? JSON.parse(JSON.stringify(a.data.params))
        : a.data.params
    }
  }));
  return [...heldFull, ...truncateActionResults(others)];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT STEPS (non-streaming)
// ─────────────────────────────────────────────────────────────────────────────
type AgentStep = { phase: string; label: string; detail: string; status: string };

function buildNonStreamingSteps(opts: {
  intent: string;
  entityCount: number;
  contextCount: number;
  reasoningSteps: number;
  factsCount: number;
  actions: any[];
  composed: boolean;
}): AgentStep[] {
  const steps: AgentStep[] = [];
  steps.push({ phase: 'understanding', label: 'Understanding your request', detail: `Intent: ${opts.intent}`, status: 'completed' });
  if (opts.entityCount > 0) steps.push({ phase: 'retrieval', label: 'Spotting key items', detail: `${opts.entityCount} key item(s) identified`, status: 'completed' });
  steps.push({ phase: 'context', label: 'Gathering your context', detail: opts.contextCount > 0 ? `${opts.contextCount} related item(s) found` : 'Scanned your workspace', status: 'completed' });
  if (opts.reasoningSteps > 0) steps.push({ phase: 'reasoning', label: 'Reasoning through it', detail: `${opts.reasoningSteps} reasoning step(s)`, status: 'completed' });
  if (opts.factsCount > 0) steps.push({ phase: 'memory', label: 'Recalling your progress', detail: `${opts.factsCount} memory fact(s) loaded`, status: 'completed' });
  for (const a of opts.actions) {
    steps.push({
      phase: 'action',
      label: `Action: ${a.type}`,
      detail: a.success ? 'Completed' : 'Could not complete',
      status: a.success ? 'completed' : 'failed'
    });
  }
  if (opts.composed) steps.push({ phase: 'compose', label: 'Composing your answer', detail: 'Writing your personalized reply', status: 'completed' });
  return steps;
}

function renderThinkingStepsBlock(steps: AgentStep[]): string {
  if (!steps.length) return '';
  const emoji: Record<string, string> = {
    understanding: '🎯', retrieval: '🔎', context: '📚', reasoning: '💭',
    memory: '🧠', action: '⚙️', compose: '✍️'
  };
  const lines = steps.map((s, i) => {
    const mark = s.status === 'completed' ? '✓' : '⚠️';
    return `${emoji[s.phase] || '•'} Step ${i + 1}: ${s.label}\n   ${mark} ${s.detail}`;
  });
  return `<thinking>\n${lines.join('\n')}\n</thinking>`;
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

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE TOKEN ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────
function estimateMessagesTokens(messages: any[]): number {
  if (!messages || messages.length === 0) return 0;
  let total = 0;
  for (const msg of messages) {
    total += 4;
    if (msg.role) total += estimateTokenCount(msg.role);
    if (msg.name) total += estimateTokenCount(msg.name);
    if (msg.content) total += estimateTokenCount(msg.content);
    if (msg.parts) {
      for (const part of msg.parts) {
        if (part.text) total += estimateTokenCount(part.text);
      }
    }
  }
  return total;
}

/**
 * Fits a chat request under Groq's per-request TPM ceiling (Groq free tier
 * rejects a request outright when prompt + max_tokens exceeds the cap — see
 * production 413 bodies like "Limit 8000, Requested 8965"). Two levers, applied
 * in order:
 *   1. Drop the OLDEST non-system turns (keep system prompt + newest turns).
 *   2. Shrink the OUTPUT allowance. A large system prompt (the ReAct planner
 *      prompt with schema + pending batch can be ~4-5K tokens alone) plus a
 *      4096-token output allowance can exceed the cap even at minimum context —
 *      observed as "~8968 tokens > 8000 TPM even at minimum context". The
 *      planner's JSON output rarely needs 4096 tokens, so shrinking the
 *      allowance (down to a 1024 floor) is a legitimate second lever.
 * Returns null when even minimum context + minimum allowance still exceeds.
 */
function fitMessagesToTpmBudget(
  messages: any[],
  tpmLimit: number,
  outputAllowance: number
): { messages: any[]; requestTokens: number; outputAllowance: number } | null {
  const systemMsgs = messages.filter(m => m.role === 'system');
  const rest = messages.filter(m => m.role !== 'system');
  // Keep at least the newest user turn (plus one preceding turn when available).
  const minTurns = Math.min(rest.length, 2);
  // Try progressively smaller output allowances: full → 3072 → 2048 → 1024.
  const allowanceSteps = [...new Set(
    [outputAllowance, 3072, 2048, 1024].filter(a => a <= outputAllowance)
  )];
  for (const allowance of allowanceSteps) {
    let attempt = rest;
    for (;;) {
      const candidate = [...systemMsgs, ...attempt];
      const requestTokens = estimateMessagesTokens(candidate) + allowance;
      if (requestTokens <= tpmLimit) return { messages: candidate, requestTokens, outputAllowance: allowance };
      if (attempt.length <= minTurns) break;
      attempt = attempt.slice(1); // drop the oldest non-system turn
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-PROVIDER FALLBACK HELPERS
// Provider order: xAI → Groq → SambaNova → HuggingFace → OpenRouter.
// SambaNova sits right after Groq because it serves the SAME open-weight
// models (Llama-3.3-70B, gpt-oss-120b, DeepSeek-V3.1) on a COMPLETELY
// SEPARATE free quota (200K tokens/day PER MODEL, no card required) — so when
// Groq's shared org-wide daily cap is blown (as seen in production logs:
// llama-3.3-70b-versatile hitting 98,813/100,000 TPD), SambaNova is very
// likely to still have room on the same model family.
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenAIStyleFallback(
  contents: any[],
  systemInstruction?: any,
  maxTokens = 4096,
  temperature = 0.7,
  preferredModel?: string   // <-- new parameter
): Promise<{ success: boolean; content?: string; modelUsed?: string; error?: string }> {
  let messages = convertGeminiToOpenRouterMessages(contents, systemInstruction);

  // Truncate to 8 turns for free-tier backends
  const systemMsgs = messages.filter(m => m.role === 'system');
  const rest = messages.filter(m => m.role !== 'system');
  if (rest.length > 8) {
    console.log(`[Fallback] Truncating conversation from ${rest.length} → 8 turns for free-tier backends`);
    messages = [...systemMsgs, ...rest.slice(-8)];
  }

  // Estimate tokens to avoid 413 errors. `let`: fitMessagesToTpmBudget may
  // trim history below (and shrink the output allowance), which shrinks this.
  const estPromptTokens = estimateMessagesTokens(messages);
  let requestTokens = estPromptTokens + Math.min(maxTokens, 4096);
  let outputAllowance = Math.min(maxTokens, 4096);

  // Provider order: Groq → OpenRouter. xAI (403 no credits), SambaNova (402 no
  // payment method) and HuggingFace (402 depleted) were purged 2026-08-16 after
  // production logs showed every attempt failing with a dead-credential error —
  // they only added guaranteed-failure latency (~2-3s) to every degraded
  // request. Re-add a provider here once its account actually has credits.
  const providers: Array<{ name: string; url: string; key: string; models: string[] }> = [];

  if (groqApiKey) {
    providers.push({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqApiKey,
      // IMPORTANT: this list must stay in PARITY with the streaming chain
      // (callOpenAIStyleStreamingFallback). The planner was silently skipping
      // even when a working model existed: llama-3.3-70b-versatile and
      // llama-3.1-8b-instant both get TPM-skipped on large requests, and groq/
      // compound 429s on TPD — while the final-response stream then succeeded on
      // openai/gpt-oss-20b, a model the planner's chain never tried. gpt-oss
      // models share separate per-model daily buckets from llama-3.3-70b, so
      // they're worth trying even when that model is TPD-exhausted.
      models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'qwen/qwen3.6-27b', 'groq/compound', 'llama-3.1-8b-instant']
    });
  }

  if (openRouterApiKey) {
    providers.push({
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: openRouterApiKey,
      // Refreshed 2026-08-06 against OpenRouter's live :free catalog. The
      // previous list (openai/gpt-oss-20b:free, meta-llama/llama-3.3-70b-
      // instruct:free, nvidia/nemotron-3-nano-30b-a3b:free) had gone stale —
      // meta-llama/llama-3.3-70b-instruct:free was consistently 404'ing
      // ("This model is unavailable for free"). OpenRouter's free catalog
      // rotates, so re-verify this list periodically against
      // https://openrouter.ai/models?max_price=0
      models: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'inclusionai/ling-3.0-flash:free', 'google/gemma-4-31b-it:free', 'poolside/laguna-s-2.1:free', 'openrouter/free']
    });
  }

  // Helper to try one model
  const tryModel = async (p: typeof providers[0], model: string) => {
    // C2: skip xAI while its credential is marked dead (403 no credits) so we
    // don't burn a request on every single turn/iteration against a
    // permanently-unfunded key.
    if (p.name === 'xAI' && isXaiNoCredits(model)) {
      console.log(`[Fallback] [xAI] Skipping ${model} — no-credits cooldown active.`);
      return { success: false, skipped: true };
    }
    if (p.name === 'Groq') {
      const limit = GROQ_MODEL_TPM_LIMITS[model];
      if (limit && requestTokens > limit) {
        // Don't hard-skip: Groq free tier rejects a request outright when
        // prompt + max_tokens exceeds the TPM cap (observed: qwen 413 "Limit
        // 8000, Requested 8965"), but the same model serves fine on a slightly
        // smaller payload. Trim the oldest turns until the request fits.
        const fitted = fitMessagesToTpmBudget(messages, limit, Math.min(maxTokens, 4096));
        if (fitted) {
          console.log(`[Fallback] Groq ${model}: fitted to ${limit} TPM (request now ~${fitted.requestTokens} tokens incl. output allowance ${fitted.outputAllowance}, was ~${requestTokens})`);
          messages = fitted.messages;
          requestTokens = fitted.requestTokens;
          outputAllowance = fitted.outputAllowance;
        } else {
          console.log(`[Fallback] Skipping Groq ${model}: ~${requestTokens} tokens > ${limit} TPM even at minimum context`);
          return { success: false, skipped: true };
        }
      }
    }

    try {
      console.log(`[Fallback] [${p.name}] Trying model: ${model}`);
      const start = Date.now();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (p.key) headers['Authorization'] = `Bearer ${p.key}`;

      const body: any = {
        model,
        messages,
        max_tokens: outputAllowance,
        temperature
      };
      if (p.name === 'OpenRouter') {
        body.transforms = ['middle-out'];
      }

      const resp = await fetch(p.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const duration = Date.now() - start;
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`[Fallback] [${p.name}_SUCCESS] Succeeded with model=${model} in ${duration}ms. Content length: ${content.length}`);
          return { success: true, content, modelUsed: `${p.name.toLowerCase()}/${model}` };
        }
      } else {
        const err = await resp.text();
        console.warn(`[Fallback] [${p.name}_FAILURE] ${model} status=${resp.status} in ${duration}ms: ${err.substring(0, 200)}`);
        // C2: xAI 403 "no credits" is a dead credential — cooldown it so it
        // isn't retried on every request while the account stays unfunded.
        if (p.name === 'xAI' && resp.status === 403 && /no credits|insufficient credits|billing|quota/i.test(err)) {
          markXaiNoCredits(model);
        }
      }
    } catch (err) {
      console.error(`[Fallback] [${p.name}_EXCEPTION] Exception with model=${model}:`, err);
    }
    return { success: false };
  };

  // 1. Try preferred model if given
  if (preferredModel) {
    for (const p of providers) {
      if (p.models.includes(preferredModel)) {
        console.log(`[Fallback] Trying preferred model: ${preferredModel}`);
        const result = await tryModel(p, preferredModel);
        if (result.success) return result;
        break; // only try the preferred once
      }
    }
  }

  // 2. Try all other models in order
  for (const p of providers) {
    for (const model of p.models) {
      if (preferredModel && model === preferredModel) continue;
      const result = await tryModel(p, model);
      if (result.success) return result;
    }
  }

  return { success: false, error: 'ALL_FALLBACK_PROVIDERS_FAILED' };
}
async function callOpenAIStyleStreamingFallback(
  contents: any[],
  systemInstruction: any,
  onChunk: (text: string) => Promise<void> | void,
  maxTokens = 4096,
  temperature = 0.7
): Promise<{ success: boolean; content?: string; modelUsed?: string; error?: string }> {
  let messages = convertGeminiToOpenRouterMessages(contents, systemInstruction);

  const systemMsgs = messages.filter(m => m.role === 'system');
  const rest = messages.filter(m => m.role !== 'system');
  if (rest.length > 8) {
    console.log(`[StreamFallback] Truncating conversation from ${rest.length} → 8 turns for free-tier backends`);
    messages = [...systemMsgs, ...rest.slice(-8)];
  }

  // Provider order: Groq → OpenRouter. xAI (403 no credits), SambaNova (402 no
  // payment method) and HuggingFace (402 depleted) were purged 2026-08-16 — see
  // callOpenAIStyleFallback for the reasoning. Re-add once accounts are funded.
  const providers: Array<{ name: string; url: string; key: string; models: string[] }> = [];

  if (groqApiKey) {
    providers.push({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqApiKey,
      // See callOpenAIStyleFallback above for why qwen3.6-27b / compound were added.
      // llama-3.1-70b-versatile is NOT listed — Groq decommissioned it (HTTP 400).
      models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'qwen/qwen3.6-27b', 'groq/compound', 'llama-3.1-8b-instant']
    });
  }

  if (openRouterApiKey) {
    providers.push({
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: openRouterApiKey,
      // See callOpenAIStyleFallback above — refreshed 2026-08-06 free catalog.
      models: [
        'nvidia/nemotron-3-ultra-550b-a55b:free',
        'inclusionai/ling-3.0-flash:free',
        'google/gemma-4-31b-it:free',
        'poolside/laguna-s-2.1:free',
        'openrouter/free'
      ]
    });
  }

  const estPromptTokens = estimateMessagesTokens(messages);
  let requestTokens = estPromptTokens + Math.min(maxTokens, 4096);
  let outputAllowance = Math.min(maxTokens, 4096);

  for (const p of providers) {
    for (const model of p.models) {
      if (p.name === 'Groq') {
        const limit = GROQ_MODEL_TPM_LIMITS[model];
        if (limit && requestTokens > limit) {
          // Same trim-to-fit as callOpenAIStyleFallback: Groq free tier rejects
          // requests over the TPM cap outright (413), but serves the model fine
          // on a smaller payload. Drop oldest turns until the request fits.
          const fitted = fitMessagesToTpmBudget(messages, limit, Math.min(maxTokens, 4096));
          if (fitted) {
            console.log(`[StreamFallback] Groq ${model}: fitted to ${limit} TPM (request now ~${fitted.requestTokens} tokens incl. output allowance ${fitted.outputAllowance}, was ~${requestTokens})`);
            messages = fitted.messages;
            requestTokens = fitted.requestTokens;
            outputAllowance = fitted.outputAllowance;
          } else {
            console.log(`[StreamFallback] Skipping Groq ${model}: ~${requestTokens} tokens > ${limit} TPM even at minimum context`);
            continue;
          }
        }
      }

      try {
        console.log(`[StreamFallback] [${p.name}] Trying streaming model: ${model}`);
        const start = Date.now();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (p.key) headers['Authorization'] = `Bearer ${p.key}`;

        const body: any = {
          model,
          messages,
          max_tokens: outputAllowance,
          temperature,
          stream: true
        };
        if (p.name === 'OpenRouter') {
          body.transforms = ['middle-out'];
        }

        const resp = await fetch(p.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        const duration = Date.now() - start;
        if (!resp.ok) {
          const err = await resp.text();
          console.warn(`[StreamFallback] [${p.name}_FAILURE] ${model} status=${resp.status} in ${duration}ms: ${err.substring(0, 200)}`);
          // C2: xAI 403 "no credits" — cooldown the dead credential here too.
          if (p.name === 'xAI' && resp.status === 403 && /no credits|insufficient credits|billing|quota/i.test(err)) {
            markXaiNoCredits(model);
          }
          continue;
        }

        console.log(`[StreamFallback] [${p.name}_CONNECTED] Stream open for model=${model} in ${duration}ms.`);
        const reader = resp.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let accumulated = '';
          let done = false;
          let buffer = '';
          let chunkCount = 0;

          const processLine = async (line: string) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') return;
            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  accumulated += delta;
                  try {
                    await onChunk(delta);
                  } catch (e) {
                    console.warn(`[StreamFallback] [ONCHUNK_ERROR] Error in onChunk:`, e);
                  }
                }
              } catch (e) {
                // ignore parse error on partial lines
              }
            }
          };

          while (!done) {
            const { value, done: rdone } = await reader.read();
            done = rdone;
            if (value) {
              chunkCount++;
              buffer += decoder.decode(value, { stream: !done });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                await processLine(line);
              }
            }
          }

          if (buffer) {
            await processLine(buffer);
          }

          if (accumulated) {
            console.log(`[StreamFallback] [${p.name}_SUCCESS] Model=${model} succeeded. Chunks: ${chunkCount}, Total chars: ${accumulated.length}`);
            return { success: true, content: accumulated, modelUsed: `${p.name.toLowerCase()}/${model}` };
          }
        } else {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            await onChunk(content);
            return { success: true, content, modelUsed: `${p.name.toLowerCase()}/${model}` };
          }
        }
      } catch (err) {
        console.error(`[StreamFallback] [${p.name}_EXCEPTION] Exception with streaming model=${model}:`, err);
      }
    }
  }

  return { success: false, error: 'ALL_STREAMING_FALLBACK_PROVIDERS_FAILED' };
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
// GEMINI API — CORE (with quota circuit-breaker)
// ─────────────────────────────────────────────────────────────────────────────
async function callGeminiOnce(
  model: string,
  requestBody: any,
  apiKey: string
): Promise<{ ok: boolean; content?: string; status?: number; error?: string }> {
  if (isQuotaExhausted(model)) {
    console.log(`[callGeminiOnce] [CIRCUIT_BREAKER] Skipping model ${model} - quota is marked as exhausted.`);
    return { ok: false, status: 429, error: 'quota_circuit_breaker' };
  }

  const start = Date.now();
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  console.log(`[callGeminiOnce] [START] Requesting model=${model}`);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const duration = Date.now() - start;
    if (response.ok) {
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) {
        console.log(`[callGeminiOnce] [SUCCESS] model=${model} succeeded in ${duration}ms. Response length: ${content.length} chars.`);
        return { ok: true, content };
      } else {
        console.warn(`[callGeminiOnce] [EMPTY] model=${model} returned 200 OK but no content parts. Duration: ${duration}ms. Keys: ${Object.keys(data)}`);
        return { ok: false, error: 'no_content' };
      }
    }

    const status = response.status;
    const errorText = await response.text();
    console.warn(`[callGeminiOnce] [HTTP_FAILURE] model=${model} failed with status=${status} in ${duration}ms. Error: ${errorText.substring(0, 300)}`);
    if (status === 429 || status === 503) markQuotaExhausted(model, errorText);
    return { ok: false, status, error: errorText.substring(0, 300) };
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[callGeminiOnce] [EXCEPTION] Network/Exception for model=${model} after ${duration}ms. Error: ${err}`);
    return { ok: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API — WITHOUT CIRCUIT BREAKER (for the action planner)
// ─────────────────────────────────────────────────────────────────────────────
async function callGeminiOnceWithoutCircuitBreaker(
  model: string,
  requestBody: any,
  apiKey: string
): Promise<{ ok: boolean; content?: string; status?: number; error?: string }> {
  // No quota check here – the planner must be able to try all models
  const start = Date.now();
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  console.log(`[callGeminiOnceNoCB] [START] Requesting model=${model}`);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const duration = Date.now() - start;
    if (response.ok) {
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) {
        console.log(`[callGeminiOnceNoCB] [SUCCESS] model=${model} succeeded in ${duration}ms. Response length: ${content.length} chars.`);
        return { ok: true, content };
      } else {
        console.warn(`[callGeminiOnceNoCB] [EMPTY] model=${model} returned 200 OK but no content parts.`);
        return { ok: false, error: 'no_content' };
      }
    }

    const status = response.status;
    const errorText = await response.text();
    console.warn(`[callGeminiOnceNoCB] [HTTP_FAILURE] model=${model} failed with status=${status} in ${duration}ms. Error: ${errorText.substring(0, 300)}`);
    // Do NOT mark quota exhausted here – the circuit breaker is for the main response
    return { ok: false, status, error: errorText.substring(0, 300) };
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[callGeminiOnceNoCB] [EXCEPTION] Network/Exception for model=${model} after ${duration}ms. Error: ${err}`);
    return { ok: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION PLANNER (uses the no-circuit-breaker version)
// ─────────────────────────────────────────────────────────────────────────────
function buildSlimActionPlannerContext(
  fullContents: any[],
  maxTurns = 8
): any[] {
  const conversational = fullContents.filter(
    (c: any) => c.role === 'user' || c.role === 'model'
  );
  const summaryBlock = conversational[0]?.parts?.[0]?.text?.startsWith('CONTEXT RECALL:')
    ? conversational[0]
    : null;
  const recentTurns = conversational.slice(-maxTurns);
  if (summaryBlock && !recentTurns.includes(summaryBlock)) {
    return [summaryBlock, ...recentTurns];
  }
  return recentTurns;
}

async function callOpenRouterForAction(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 8124
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
        messages,
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

  const slimContents = buildSlimActionPlannerContext(contents, 20);

  const envChain = Deno.env.get('GEMINI_MODEL_CHAIN')?.split(',').map((s: string) => s.trim()).filter(Boolean);
  // C9: the planner's chain must NEVER be narrower than the response chain. In
  // production, the scholar tier chain omitted gemini-3-flash-preview — the one
  // model that was actually serving responses — so the planner died with
  // ACTION_PLANNER_ALL_MODELS_FAILED while the final response succeeded on it.
  // This DEFAULT_CHAIN mirrors callEnhancedGeminiAPI's, and the merge below
  // makes it a SUPERSET of any tier/env chain (tier models keep priority, then
  // every known-good model is appended so nothing is missing).
  const DEFAULT_CHAIN = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];
  // Merge tier/env chain with DEFAULT_CHAIN as a superset — no model gaps.
  const fullChain = [...new Set([...(tierModelChain || []), ...(envChain || []), ...DEFAULT_CHAIN])];
  // Use the full chain without filtering – the planner will attempt all models even if marked exhausted
  const MODEL_CHAIN = fullChain;

  const requestBody: any = {
    contents: slimContents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8124,
      topK: 40,
      topP: 0.95,
      responseMimeType: 'application/json'
    }
  };
  if (systemInstruction) requestBody.systemInstruction = systemInstruction;

  // 1. Try Gemini models first using the non-circuit-breaker version
  for (const model of MODEL_CHAIN) {
    console.log(`[ActionPlanner] Trying Gemini model: ${model}`);
    const geminiResult = await callGeminiOnceWithoutCircuitBreaker(model, requestBody, apiKey);
    if (geminiResult.ok && geminiResult.content) {
      console.log(`[ActionPlanner] ✅ Gemini ${model} succeeded`);
      return { success: true, content: geminiResult.content, modelUsed: model };
    }
  }

  // 2. Fallback to multi-provider backends
  console.log('[ActionPlanner] Gemini failed/exhausted. Falling back to multi-provider backends...');
  const fallbackResult = await callOpenAIStyleFallback(slimContents, systemInstruction, 8124, 0.2);
  if (fallbackResult.success && fallbackResult.content) {
    console.log(`[ActionPlanner] ✅ Multi-provider fallback succeeded with model: ${fallbackResult.modelUsed}`);
    return { success: true, content: fallbackResult.content, modelUsed: fallbackResult.modelUsed };
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
  tierModelChain?: string[],
  preferredModel?: string | null
): Promise<{ success: boolean; content?: string; error?: string; userMessage?: string; modelUsed?: string }> {
  const envChain = Deno.env.get('GEMINI_MODEL_CHAIN')?.split(',').map(s => s.trim()).filter(Boolean);
  const DEFAULT_CHAIN = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];
  let MODEL_CHAIN = tierModelChain || envChain || DEFAULT_CHAIN;

  console.log(`[callEnhancedGeminiAPI] [INIT] Base chain: [${MODEL_CHAIN.join(', ')}]. Preferred model: ${preferredModel || 'none'}`);

  if (preferredModel && MODEL_CHAIN.includes(preferredModel)) {
    console.log(`[callEnhancedGeminiAPI] [PRIORITIZE] Prioritizing preferred model: ${preferredModel}`);
    MODEL_CHAIN = [preferredModel, ...MODEL_CHAIN.filter(m => m !== preferredModel)];
  }

  console.log(`[callEnhancedGeminiAPI] [EXECUTE] Resolved chain order: [${MODEL_CHAIN.join(', ')}]`);

  const { systemInstruction, ...generationConfig } = configOverrides;
  const requestBody: any = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, topK: 40, topP: 0.95, ...generationConfig }
  };
  if (systemInstruction) requestBody.systemInstruction = systemInstruction;

  const allExhausted = MODEL_CHAIN.every(isQuotaExhausted);
  for (const model of MODEL_CHAIN) {
    if (!allExhausted && isQuotaExhausted(model)) {
      console.log(`[callEnhancedGeminiAPI] [SKIP] Skipping quota-exhausted model: ${model}`);
      continue;
    }
    console.log(`[callEnhancedGeminiAPI] [ATTEMPT] Trying model: ${model}`);
    const result = await callGeminiOnce(model, requestBody, apiKey);
    if (result.ok && result.content) {
      console.log(`[callEnhancedGeminiAPI] [SUCCESS] Model ${model} generated content. Length: ${result.content.length} chars.`);
      return { success: true, content: result.content, modelUsed: model };
    }
    if (result.status === 400) {
      console.warn(`[callEnhancedGeminiAPI] [BAD_REQUEST] ${model} returned 400: ${result.error?.substring(0, 150)}. Continuing...`);
    } else {
      console.warn(`[callEnhancedGeminiAPI] [FAILURE] ${model} failed (status=${result.status ?? 'err'})`);
    }
    logSystemError(supabase, {
      severity: result.status === 429 ? 'warning' : 'error',
      source: 'gemini-chat', component: 'gemini-api',
      error_code: `GEMINI_HTTP_${result.status ?? 'ERR'}`,
      message: `Gemini ${model} failed`, details: { model, status: result.status }
    });
  }

  console.log('[callEnhancedGeminiAPI] All Gemini models failed, falling back to multi-provider backends...');
  const fallbackRes = await callOpenAIStyleFallback(
    contents,
    systemInstruction,
    generationConfig.maxOutputTokens || 4096,
    generationConfig.temperature ?? 0.7
  );
  if (fallbackRes.success && fallbackRes.content) {
    return { success: true, content: fallbackRes.content, modelUsed: fallbackRes.modelUsed };
  }

  console.error('[callEnhancedGeminiAPI] [FATAL] All Gemini and multi-provider fallback models failed.');
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
  tierModelChain?: string[],
  preferredModel?: string | null
): Promise<{ success: boolean; content?: string; error?: string; modelUsed?: string }> {
  const envChain = Deno.env.get('GEMINI_MODEL_CHAIN')?.split(',').map(s => s.trim()).filter(Boolean);
  const DEFAULT_CHAIN = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];
  let MODEL_CHAIN = tierModelChain || envChain || DEFAULT_CHAIN;

  console.log(`[callEnhancedGeminiAPIStream] [INIT] Base chain: [${MODEL_CHAIN.join(', ')}]. Preferred model: ${preferredModel || 'none'}`);

  if (preferredModel && MODEL_CHAIN.includes(preferredModel)) {
    console.log(`[callEnhancedGeminiAPIStream] [PRIORITIZE] Prioritizing preferred model: ${preferredModel}`);
    MODEL_CHAIN = [preferredModel, ...MODEL_CHAIN.filter(m => m !== preferredModel)];
  }

  console.log(`[callEnhancedGeminiAPIStream] [EXECUTE] Resolved chain order: [${MODEL_CHAIN.join(', ')}]`);

  const { systemInstruction, ...generationConfig } = configOverrides;
  const requestBody: any = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, ...generationConfig }
  };
  if (systemInstruction) requestBody.systemInstruction = systemInstruction;

  const allExhausted = MODEL_CHAIN.every(isQuotaExhausted);
  for (const model of MODEL_CHAIN) {
    if (!allExhausted && isQuotaExhausted(model)) {
      console.log(`[callEnhancedGeminiAPIStream] [SKIP] Skipping quota-exhausted model: ${model}`);
      continue;
    }
    console.log(`[callEnhancedGeminiAPIStream] [ATTEMPT] Requesting stream from model: ${model}`);
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const start = Date.now();
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const duration = Date.now() - start;
      if (!resp.ok) {
        const txt = await resp.text();
        console.error(`[callEnhancedGeminiAPIStream] [HTTP_FAILURE] model=${model} returned status=${resp.status} in ${duration}ms. Error:`, txt.substring(0, 200));
        if (resp.status === 429 || resp.status === 503) markQuotaExhausted(model, txt);
        logSystemError(supabase, {
          severity: resp.status === 429 ? 'warning' : 'error',
          source: 'gemini-chat', component: 'gemini-stream',
          error_code: `GEMINI_STREAM_HTTP_${resp.status}`,
          message: `Gemini streaming ${model} HTTP ${resp.status}`,
          details: { model, status: resp.status }
        });
        continue;
      }

      console.log(`[callEnhancedGeminiAPIStream] [STREAM_OPEN] Successfully connected to model=${model} in ${duration}ms. Reading chunks...`);
      const reader = resp.body?.getReader();
      if (!reader) {
        console.warn(`[callEnhancedGeminiAPIStream] [NO_READER] model=${model} body reader unavailable. Reading as JSON...`);
        const data = await resp.json();
        const extracted = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (extracted) {
          console.log(`[callEnhancedGeminiAPIStream] [JSON_SUCCESS] model=${model} JSON response read. Characters: ${extracted.length}`);
          await onChunk(extracted);
          return { success: true, content: extracted, modelUsed: model };
        }
        continue;
      }

      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';
      let chunkCount = 0;

      while (!done) {
        const { value, done: rdone } = await reader.read();
        done = rdone;
        if (value) {
          chunkCount++;
          const chunkText = decoder.decode(value, { stream: !done });
          try {
            await onChunk(chunkText);
          } catch (e) {
            console.warn(`[callEnhancedGeminiAPIStream] [ONCHUNK_ERROR] Error in onChunk at chunk #${chunkCount}:`, e);
          }
          accumulated += chunkText;
        }
      }

      console.log(`[callEnhancedGeminiAPIStream] [STREAM_COMPLETE] model=${model} finished streaming. Chunks: ${chunkCount}, Total chars: ${accumulated.length}`);

      try {
        const parsed = JSON.parse(accumulated);
        const extracted = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (extracted) {
          console.log(`[callEnhancedGeminiAPIStream] [PARSED_SUCCESS] Successfully parsed final response from accumulated JSON: ${extracted.length} chars.`);
          return { success: true, content: extracted, modelUsed: model };
        }
      } catch (_) {
        if (accumulated) {
          console.log(`[callEnhancedGeminiAPIStream] [ACCUMULATED_TEXT] Fallback parsed accumulated stream directly. Chars: ${accumulated.length}`);
          return { success: true, content: accumulated, modelUsed: model };
        }
      }
    } catch (err) {
      const duration = Date.now() - start;
      console.error(`[callEnhancedGeminiAPIStream] [EXCEPTION] Exception for model=${model} after ${duration}ms:`, err);
      logSystemError(supabase, {
        severity: 'error', source: 'gemini-chat', component: 'gemini-stream',
        error_code: 'GEMINI_STREAM_NETWORK_ERROR',
        message: `Gemini streaming error: ${String(err)}`, details: { model }
      });
    }
  }

  console.log('[callEnhancedGeminiAPIStream] All Gemini models failed. Falling back to multi-provider streaming backends...');
  const fallbackStreamRes = await callOpenAIStyleStreamingFallback(
    contents,
    systemInstruction,
    onChunk,
    generationConfig.maxOutputTokens || 4096,
    generationConfig.temperature ?? 0.7
  );

  if (!fallbackStreamRes.success) {
    console.error('[callEnhancedGeminiAPIStream] [FATAL] All stream models and fallbacks failed.');
    return {
      success: false,
      error: 'ALL_QUOTAS_EXHAUSTED',
      modelUsed: 'none'
    };
  }

  return {
    success: true,
    content: fallbackStreamRes.content,
    modelUsed: fallbackStreamRes.modelUsed
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION RESULT TRIMMER
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_RESULT_MAX_RECORDS = 20;
const ACTION_RESULT_MAX_STR = 300;

// D2: internal ReAct bookkeeping turns ("Actions executed successfully. Results:",
// "Previous actions failed", "Batch N executed", planner-invalid retries) are pushed
// into conversationData.contents during the CURRENT turn only. They must NEVER be
// treated as prior user/model dialogue: on a later turn where nothing was executed,
// a stale "Your X has been saved successfully" preamble could be repeated verbatim
// because the model reads those bookkeeping turns as if an action just happened.
// "Batch N executed." turns — anchored to the digits so a genuine user message
// that merely starts with the word "Batch" is never dropped.
const REACT_BOOKKEEPING_PREFIXES = [
  'Actions executed successfully. Results:',
  'Previous actions failed. Results:',
  'The planner response was invalid.',
];
const REACT_BOOKKEEPING_RE = /^Batch\s+\d+\s+executed\./;

function stripReactBookkeepingTurns(contents: any[]): any[] {
  return (contents || []).filter((turn: any) => {
    const text = turn?.parts?.[0]?.text || '';
    if (typeof text !== 'string') return true;
    const trimmed = text.trim();
    return !REACT_BOOKKEEPING_PREFIXES.some(p => trimmed.startsWith(p)) && !REACT_BOOKKEEPING_RE.test(trimmed);
  });
}
function summarizeActionResults(actions: any[]): string {
  const lines: string[] = [];
  for (const action of actions) {
    if (action.type === 'DB_ACTION' && action.success) {
      const data = action.data?.data || action.data;
      if (Array.isArray(data)) {
        const count = data.length;
        const preview = data.slice(0, 5).map((item: any) => item.title || item.name || item.id || 'item').join(', ');
        lines.push(`✅ Found ${count} record(s): ${preview}${count > 5 ? ' …' : ''}`);
      } else if (data) {
        lines.push(`✅ Operation succeeded: ${JSON.stringify(data).substring(0, 100)}`);
      } else {
        lines.push(`✅ Action completed successfully.`);
      }
    } else if (action.type === 'DB_ACTION' && !action.success) {
      lines.push(`❌ DB operation failed: ${action.error || 'unknown error'}`);
    } else {
      lines.push(`${action.type}: ${action.success ? 'success' : 'failed'}`);
    }
  }
  return lines.join('\n');
}
/** Converts raw DB/SQL errors into user-friendly messages the AI can relay without exposing internals. */
function sanitizeDbError(rawError: string): string {
  if (!rawError) return rawError;
  // Check constraint violations
  if (rawError.includes('check constraint') || rawError.includes('violates check')) {
    const match = rawError.match(/violates check constraint "([^"]+)"/);
    const constraint = match?.[1] || '';
    if (constraint.includes('source_type')) return 'The quiz type you chose is not supported. Please try a standard quiz type.';
    if (constraint.includes('status')) return 'The status value is not valid.';
    return 'Some of the data you provided doesn\'t match the expected format. Please try again.';
  }
  // Not-null violations
  if (rawError.includes('not-null constraint') || rawError.includes('null value in column')) {
    const colMatch = rawError.match(/null value in column "([^"]+)"/);
    const col = colMatch?.[1] || 'a required field';
    return `Missing required information: ${col.replace(/_/g, ' ')}. Please fill in all required fields.`;
  }
  // Unique constraint
  if (rawError.includes('unique constraint') || rawError.includes('duplicate key')) {
    return 'An item with that name already exists. Please choose a different name.';
  }
  // FK violation
  if (rawError.includes('foreign key') || rawError.includes('referenced')) {
    return 'This item is linked to other data that no longer exists. Please try again.';
  }
  // Generic DB error
  if (rawError.includes('SQLSTATE') || rawError.includes('relation "') || rawError.includes('column "')) {
    return 'Something went wrong saving your data. Please try again.';
  }
  return rawError;
}

function truncateActionResults(actions: any[]): any[] {
  return actions.map((action: any) => {
    const slim: any = { type: action.type, success: action.success };
    if (action.error) slim.error = sanitizeDbError(action.error);
    // B1: keep the structured constraint hint so the ReAct retry prompt can
    // tell the planner exactly which column/value was rejected — evidence, not guess.
    // (runAction stores the service result under .data, so check both spots.)
    const cv = action.constraintViolation || action.data?.constraintViolation;
    if (cv) slim.constraintViolation = cv;
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

// ── Context-aware Phase-2 confirmation guidance ─────────────────────────────────────
// Generates a GUIDANCE fragment that replaces the generic "Decide next step."
// The model uses it to know exactly HOW to phrase the confirmation ask.
function buildConfirmationGuidance(execResults: any[]): string | null {
  const confirmResult = execResults.find((a: any) => a?.data?.needsConfirmation);
  if (!confirmResult) return null;

  const d = confirmResult.data || {};
  const requestOrigin: string = d.requestOrigin || 'inferred';
  const possibleDuplicates: any[] = Array.isArray(d.possibleDuplicates) ? d.possibleDuplicates : [];
  const proposedTitle: string = d.proposedData?.title || d.proposedData?.name || d.proposedData?.front || '';
  const existingTitle: string = possibleDuplicates[0]?.title || '';
  const batchSize: number | undefined = d.batchSize;
  const table: string = d.table || d.params?.table || 'items';
  // UPDATE/DELETE confirmations have no requestOrigin (inferred from preflightIds)
  const rowCount: number | undefined = d.rowCount;
  const isDestructive = d.preflightIds !== undefined || rowCount !== undefined;

  if (isDestructive) {
    const n = rowCount ?? 'some';
    return `\n\nGUIDANCE FOR YOUR RESPONSE: A destructive operation was held for confirmation. Tell the user it will affect ${n} record(s) and ask if they want to proceed. Be specific about what will change.`;
  }

  // Batch INSERT (e.g. 10 flashcards generated at once)
  if (batchSize && batchSize > 1) {
    if (existingTitle) {
      return `\n\nGUIDANCE FOR YOUR RESPONSE: Ask the user ONCE for the whole batch — do NOT ask ${batchSize} times. Say something like: "I have ${batchSize} ${table} ready to save. I noticed you already have some similar ones (e.g. '${existingTitle}'). Want me to go ahead and add all ${batchSize}?"`;
    }
    return `\n\nGUIDANCE FOR YOUR RESPONSE: Ask the user ONCE for the whole batch. Say something like: "I have ${batchSize} ${table} ready to save — want me to go ahead?"`;
  }

  // Single INSERT — user explicitly asked to save
  if (requestOrigin === 'explicit') {
    if (existingTitle) {
      return `\n\nGUIDANCE FOR YOUR RESPONSE: The user explicitly asked to save content, but there is already a similar item called "${existingTitle}". Ask: "You already have something called '${existingTitle}' — want me to save this as a new separate item, or were you thinking of that one?"`;
    }
    const label = proposedTitle ? `'${proposedTitle}'` : 'this';
    return `\n\nGUIDANCE FOR YOUR RESPONSE: Give a light-touch confirmation. Say something like: "Ready to save ${label} — should I go ahead?"`;
  }

  // Single INSERT — inferred from shared/pasted content (no explicit save language)
  if (existingTitle) {
    return `\n\nGUIDANCE FOR YOUR RESPONSE: The user shared content without explicitly asking to save it. There is already a note called "${existingTitle}". Ask: "I noticed you shared this. You already have something called '${existingTitle}' — want me to update that, start a new note, or keep this just in our chat?"`;
  }
  return `\n\nGUIDANCE FOR YOUR RESPONSE: The user shared content without explicitly asking to save it. Ask plainly: "Want me to save this to your notes, or is it just for our conversation?"`;
}

/**
 * Builds the structured payload sent to the client via the `confirmation_required` SSE
 * event so the app can pop an Accept / Decline / Custom dialog tailored to the action.
 */
function buildConfirmationPayload(action: any): any {
  const data = action?.data || {};
  const params = data?.params || {};
  const table = typeof params?.table === 'string' ? params.table : 'record';
  const operation = (typeof params?.operation === 'string' ? params.operation : 'MODIFY').toUpperCase();
  const rowCount = typeof data?.rowCount === 'number' ? data.rowCount : 1;
  const filters = params?.filters || {};
  const rawLabel =
    (typeof filters?.title === 'string' && filters.title) ||
    (typeof filters?.content === 'string' && filters.content) ||
    (typeof filters?.id === 'string' && filters.id) ||
    null;
  // Keep the dialog label short — a content filter can hold a full note/document body.
  const targetLabel = rawLabel ? (rawLabel.length > 60 ? `${rawLabel.slice(0, 60)}…` : rawLabel) : null;

  const summary =
    `${operation} ${rowCount} record(s) in ${table}` +
    (targetLabel ? `: "${targetLabel}"` : '');

  let customPrompt: string;
  if (operation === 'INSERT') {
    customPrompt = 'Anything to add or change first? e.g. a different title or details';
  } else if (operation === 'DELETE') {
    customPrompt = 'Want to narrow it down? e.g. a different filter or specific item';
  } else {
    customPrompt = 'Anything to change first? e.g. a new title or content';
  }

  return {
    actionType: action?.type || 'DB_ACTION',
    table,
    operation,
    rowCount,
    targetLabel,
    summary,
    customPrompt,
    confirmLabel: `Yes, ${operation === 'DELETE' ? 'delete' : operation === 'UPDATE' ? 'update' : 'proceed'}`,
    declineLabel: 'No, cancel'
  };
}

/**
 * Builds the batched confirmation payload for MULTIPLE pending actions. Replaces N
 * per-action `confirmation_required` events with ONE `confirmation_batch_required`
 * event so the client shows a single truthful ask ("N items") and one reply resolves
 * the whole batch. `buildConfirmationPayload` (singular) is reused per-item inside
 * `items` and stays unchanged for backward compatibility.
 */
function buildBatchConfirmationPayload(actions: any[]): any {
  const items = actions.map(buildConfirmationPayload);
  const tables = [...new Set(items.map(i => i.table))];
  return {
    count: items.length,
    summary: items.length === 1
      ? items[0].summary
      : `${items.length} items ready across ${tables.join(', ')}`,
    items,
    confirmLabel: `Yes, proceed with all ${items.length}`,
    declineLabel: 'No, cancel'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
async function executeAIActions(
  userId: string,
  sessionId: string,
  aiResponse: string
): Promise<{ executedActions: any[]; modifiedResponse: string; forceCompose: boolean }> {
  const executedActions: any[] = [];
  let modifiedResponse = aiResponse;

  const actionsRaw = actionsService.parseActionFromText(aiResponse);
  const actionList = Array.isArray(actionsRaw) ? actionsRaw : (actionsRaw ? [actionsRaw] : []);

  flowLog('executeAIActions', `Parsed ${actionList.length} action(s) from ${aiResponse.length}-char model response.`, {
    types: actionList.map(a => a.action),
    params: actionList.map(a => flowPreview(a?.params, 300))
  });

  let reactActions: any[] = [];
  if (actionList.length === 0) {
    const parsedStep = parseReActStep(aiResponse);
    reactActions = parsedStep.step.actions || [];
    if (reactActions.length > 0) {
      flowLog('executeAIActions', `Pipe parser found 0 — ReAct JSON fallback parsed ${reactActions.length} action(s).`, {
        types: reactActions.map(a => a.type),
        params: reactActions.map(a => flowPreview(a?.params, 300))
      });
    }
  }

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
        flowLog('executeAIActions', `Action '${action.action}' ${result?.success ? 'SUCCEEDED' : 'FAILED'}.`, {
          result: flowPreview(result, 500)
        });
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

  if (reactActions.length > 0) {
    const execResults = await executeParsedActions(actionsService, userId, sessionId, reactActions);
    executedActions.push(...execResults);
    for (const r of execResults) {
      flowLog('executeAIActions', `JSON action '${r.type}' ${r.success ? 'SUCCEEDED' : 'FAILED'}.`, {
        result: flowPreview(r, 500)
      });
    }
    modifiedResponse = modifiedResponse
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/\{[^{}]*"actions"\s*:\s*\[[\s\S]*?\]\s*\}/gi, '')
      .replace(/```(?:json|action)?\s*[\s\S]*?```/gi, '')
      .trim();
  }

  return { executedActions, modifiedResponse, forceCompose: reactActions.length > 0 };
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
  const diagTag = '[HISTORY_DIAG]';
  try {
    const { data: messages, error } = await supabase.from('chat_messages')
      .select('id, content, role, timestamp, conversation_context')
      .eq('user_id', userId).eq('session_id', sessionId).eq('is_error', false)
      .order('timestamp', { ascending: true }).limit(maxMessages);

    if (error) {
      console.error(`${diagTag} Error fetching history:`, { userId, sessionId, error });
      return [];
    }

    const msgs = messages || [];

    const leakedRows = msgs.filter(m => containsInternalPromptLeak(m.content));
    const cleanMsgs = leakedRows.length > 0 ? msgs.filter(m => !containsInternalPromptLeak(m.content)) : msgs;
    if (leakedRows.length > 0) {
      console.warn(`${diagTag} Filtered ${leakedRows.length} corrupted historical row(s) containing leaked system-prompt text out of this session's context.`, {
        userId, sessionId,
        corruptedMessageIds: leakedRows.map(m => m.id),
        corruptedTimestamps: leakedRows.map(m => m.timestamp)
      });
    }

    let totalRowsIncludingErrors = -1;
    try {
      const { count } = await supabase.from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('session_id', sessionId);
      totalRowsIncludingErrors = count ?? -1;
    } catch (countErr) {
      console.warn(`${diagTag} count query failed`, countErr);
    }

    const roleBreakdown = cleanMsgs.reduce((acc: Record<string, number>, m: any) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});

    console.log(`${diagTag} getConversationHistory`, {
      userId,
      sessionId,
      returnedCount: cleanMsgs.length,
      filteredCorruptedRows: leakedRows.length,
      totalRowsForSessionIncludingErrors: totalRowsIncludingErrors,
      roleBreakdown,
      oldestTimestamp: cleanMsgs[0]?.timestamp ?? null,
      newestTimestamp: cleanMsgs[cleanMsgs.length - 1]?.timestamp ?? null,
      maxMessagesLimit: maxMessages
    });

    if (totalRowsIncludingErrors > 0 && cleanMsgs.length === 0) {
      console.warn(`${diagTag} MISMATCH: ${totalRowsIncludingErrors} row(s) exist for this session/user but 0 passed the is_error/role/leak filter.`);
    }
    if (totalRowsIncludingErrors === 0) {
      console.warn(`${diagTag} NO ROWS AT ALL for userId=${userId} sessionId=${sessionId}. Likely a session-id mismatch.`);
    }

    return cleanMsgs;
  } catch (err) {
    console.error(`${diagTag} Unexpected exception fetching history`, { userId, sessionId, err });
    return [];
  }
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

  console.log('[HISTORY_DIAG] buildIntelligentContext', {
    sessionId,
    userId,
    fetchedFromDb: conversationHistory.length,
    selectedAfterTokenBudget: selectedMessages.length,
    droppedForTokenBudget: conversationHistory.length - selectedMessages.length,
    approxTokensUsed: currentTokens,
    maxHistoryTokens: MAX_HISTORY_TOKENS,
    hasStoredSummary: !!conversationSummary
  });
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
  thinkingSteps?: any[] | null; // <-- NEW
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
      has_been_displayed: params.role === 'user',
      thinking_steps: params.thinkingSteps || null // <-- NEW
    };
    // ... rest of function (the query building is unchanged)

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
      console.log('[HISTORY_DIAG] ensureChatSession: REUSED existing session', {
        sessionId, userId, priorMessageCount: existingSession.message_count || 0, newMessageCount
      });
    } else {
      const newTitle = initialMessage ? await generateChatTitle(sessionId, userId, initialMessage, 1) : 'New Chat';
      await supabase.from('chat_sessions').insert({
        id: sessionId, user_id: userId, title: newTitle,
        document_ids: newDocumentIds, message_count: 1, token_count: 0,
        last_message_at: new Date().toISOString()
      });
      console.warn('[HISTORY_DIAG] ensureChatSession: CREATED NEW session (no prior row found for this sessionId)', {
        sessionId, userId, newTitle, incomingInitialMessage: initialMessage?.slice(0, 80) || null
      });
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
      text: `${systemPrompt}\n\n**ACTIONABLE CONTEXT:**\n${actionableContextText}${userContextSummary}\n\nCURRENT DATE AND TIME: ${dateTimeString}\n\nQuery type: ${queryType}\n${queryGuidance[queryType]}\n\nCross-session context:\n${crossSessionText}\n\nYou are Professor Ollie, the AI tutor for ${userName} on StuddyHub.`
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

  const historyTurns = geminiContents.filter(c => c !== geminiContents[geminiContents.length - 1]);
  console.log('[HISTORY_DIAG] buildEnhancedGeminiConversation: final contents sent to Gemini', {
    sessionId,
    userId,
    totalTurnsInContents: geminiContents.length,
    priorHistoryTurns: historyTurns.length,
    hasConversationSummaryBlock: !!conversationData.conversationSummary,
    dbTotalMessages: conversationData.totalMessages,
    dbSummarizedAway: conversationData.summarizedMessages,
    roleSequencePreview: geminiContents.slice(0, 6).map(c => c.role)
  });

  if (conversationData.totalMessages > 0 && historyTurns.length === 0) {
    console.warn('[HISTORY_DIAG] MISMATCH: DB reports totalMessages > 0 but 0 history turns were added to the Gemini request.', {
      sessionId, userId, dbTotalMessages: conversationData.totalMessages
    });
  }

  return { contents: geminiContents, systemInstruction, contextInfo: { ...conversationData, userContext, crossSessionContext }, queryType };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT USER FACTS
// ─────────────────────────────────────────────────────────────────────────────
function formatSecondBrainContext(uc: any): string {
  if (!uc) return '';
  const notesCount = uc.allNotes?.length ?? 0;
  const docsCount = uc.allDocuments?.length ?? 0;
  const goalsCount = uc.learningGoals?.length ?? 0;
  const flashcardsCount = uc.flashcards?.length ?? 0;
  const quizzesCount = uc.recentQuizzes?.length ?? 0;

  let summary = `\n\nUSER RESOURCE INVENTORY: Notes: ${notesCount}, Documents: ${docsCount}, Goals: ${goalsCount}, Flashcards: ${flashcardsCount}, Quizzes Taken: ${quizzesCount}`;

  if (Array.isArray(uc.crossCorrelations) && uc.crossCorrelations.length > 0) {
    summary += `\n\nCROSS-TABLE SECOND BRAIN SYNTHESIS & INSIGHTS:\n`;
    uc.crossCorrelations.forEach((item: any, idx: number) => {
      summary += `${idx + 1}. [${item.category.toUpperCase()}] ${item.title} (Urgency: ${item.urgency}): ${item.insight}\n`;
    });
  }

  if (Array.isArray(uc.userMemory) && uc.userMemory.length > 0) {
    const topFacts = uc.userMemory.slice(0, 5).map((m: any) => `- ${m.fact_key}: ${m.fact_value} (confidence: ${m.confidence_score})`).join('\n');
    summary += `\n\nLEGIBLE USER KNOWLEDGE & MEMORY:\n${topFacts}`;
  }

  summary += `\n\nSECOND BRAIN INTERACTION PRINCIPLES:
1. CONNECT THE DOTS: Actively cross-reference the user's notes, quiz results, and schedule items. If an upcoming exam or weak subject matches their query, explicitly point out the correlation.
2. COMPOUND CONVERSATIONS: At the end of helpful explanations or study reviews, suggest logical next steps (e.g., "Would you like me to turn these key concepts into flashcards, generate a practice quiz, or save this summary to a note?").
3. GROUNDED SOURCE CITATIONS: When referencing specific user notes, documents, or quiz scores, explicitly cite them with title references (e.g., [Note: "HCI Overview"] or [Quiz: "Genetics Review"]).
4. TRANSPARENT MEMORY: If asked about the user's learning style, strengths, or study habits, reflect back what you know from their stored memory and cross-correlations clearly.`;

  return summary;
}

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
/**
 * Builds a human-readable "current date and time" line so the AI can answer
 * date-aware questions (e.g. "what's today", "schedule it for tomorrow")
 * accurately. Edge Functions run in UTC, so the label says so explicitly.
 */
function buildCurrentDateTimeLine(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC', hour12: false
  });
  return `CURRENT DATE AND TIME (always trust this over your own assumptions; times are UTC):\nToday is ${dateStr}.\nCurrent time: ${timeStr} UTC.`;
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
  // --- Accumulate thinking steps for saving ---
  const thinkingSteps: any[] = [];

  function recordThinkingStep(type: string, title: string, detail: string, status: string, metadata?: any) {
    const step = {
      id: crypto.randomUUID(),
      type,
      title,
      detail,
      status,
      timestamp: new Date().toISOString(),
      metadata
    };
    thinkingSteps.push(step);
    handler.sendThinkingStep(type, title, detail, status, metadata);
  }

  const aiModelConfig = await (async () => {
    try {
      const validator = createSubscriptionValidator();
      return await validator.getAiModelConfig(userId);
    } catch {
      return {
        tier: 'free' as const,
        modelChain: ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
        streamingChain: ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
        displayLabel: 'Gemini 3.5 Flash'
      };
    }
  })();

  const backgroundWork = (async () => {
    try {
      console.log('🚀 Starting streaming response');

      recordThinkingStep('understanding', 'Analyzing your request', 'Interpreting message intent...', 'in-progress');

      const conversationHistory = await getConversationHistory(userId, sessionId);
      let userIntent: UserIntent;
      try {
        userIntent = await agenticCore.understandQuery(message, userId, conversationHistory);
      } catch (intentErr) {
        console.error('[HISTORY_DIAG] understandQuery threw, falling back to default intent', {
          sessionId, userId, conversationHistoryLength: conversationHistory.length, intentErr
        });
        userIntent = { primary: 'general_query', secondary: [], entities: [], complexity: 'simple' as const, requiresContext: false, requiresAction: false, confidence: 0.5 };
      }

      console.log('[HISTORY_DIAG] Understanding phase result', {
        sessionId, userId,
        conversationHistoryLengthPassedIn: conversationHistory.length,
        intent: userIntent.primary,
        requiresContext: userIntent.requiresContext,
        confidence: userIntent.confidence
      });

      const entitiesPreview = userIntent.entities?.length > 0 ? ` (Entities: ${userIntent.entities.map(e => e.value).join(', ')})` : '';
      recordThinkingStep('understanding', 'Query understood', `Intent: ${userIntent.primary}${entitiesPreview}`, 'completed', { intent: userIntent.primary });

      recordThinkingStep('retrieval', 'Gathering relevant information', 'Searching notes, documents, past conversations...', 'in-progress');
      let relevantContext: any[] = [];
      try {
        relevantContext = await agenticCore.retrieveRelevantContext(userIntent, userId, sessionId);
      } catch { /* continue */ }
      recordThinkingStep('retrieval', 'Context retrieved', `Found ${relevantContext.length} relevant items`, 'completed', { contextCount: relevantContext.length });

      recordThinkingStep('reasoning', 'Building reasoning chain', 'Analyzing and determining best approach...', 'in-progress');
      let reasoningChain: string[] = [];
      try {
        reasoningChain = await agenticCore.buildReasoningChain(userIntent, relevantContext, message);
      } catch { /* continue */ }
      recordThinkingStep('reasoning', 'Reasoning complete', `Built ${reasoningChain.length} reasoning steps`, 'completed');

      recordThinkingStep('memory', 'Loading memory systems', 'Accessing working memory and past interactions...', 'in-progress');
      const [workingMemory, longTermMemory, episodicMemory] = await Promise.all([
        agenticCore.getWorkingMemory(sessionId, userId),
        agenticCore.getLongTermMemory(userId),
        agenticCore.getEpisodicMemory(userId, message)
      ]);
      recordThinkingStep('memory', 'Memory loaded', `Loaded ${workingMemory.recentMessages?.length || 0} recent messages, ${longTermMemory.facts?.length || 0} facts`, 'completed');

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

      // ── ReAct Loop Decision: Smart Tool-Use & Confirmation Gating ──
      const isAwaitingConfirmation = isAwaitingConfirmationReply(workingMemory.recentMessages || []);
      // Wire the pending-action ledger into execution.
      const confirmationContext = isAwaitingConfirmation
        ? buildConfirmationContext(workingMemory.recentMessages || [], message)
        : undefined;

      const plannerTriggerCheck = shouldTriggerActionPlanner(
        message,
        userIntent,
        isAwaitingConfirmation,
        workingMemory.recentMessages || []
      );

      console.log(`[ACTION_GATE] Decision: triggerReAct=${plannerTriggerCheck.trigger}, reason=${plannerTriggerCheck.reason}`, {
        isAwaitingConfirmation,
        userIntent: userIntent.primary,
        requiresAction: userIntent.requiresAction,
        affirmationProposal: plannerTriggerCheck.lastAssistantProposal || null
      });

      flowLog('streaming', `Action gate check: triggerReAct=${plannerTriggerCheck.trigger} (reason: ${plannerTriggerCheck.reason})`, {
        message: flowPreview(message, 150),
        confirmationLedger: confirmationContext ? { pendingSignatures: confirmationContext.pendingSignatures.size, userConfirmationIntent: confirmationContext.userConfirmationIntent } : null
      });

      if (plannerTriggerCheck.trigger) {
        recordThinkingStep('action', 'Planning', 'Determining action plan...', 'completed', { triggerReason: plannerTriggerCheck.reason });
      } else {
        recordThinkingStep('reasoning', 'Direct response', 'Tutoring/discussion mode (skipping DB action planning to optimize speed)', 'completed');
      }

      const SUPPORTED_ACTION_TYPES = ['DB_ACTION', 'GENERATE_IMAGE', 'ENGAGE_SOCIAL', 'WEB_SEARCH', 'FETCH_WEB_RESOURCE'];

      const schemaFullText = typeof DB_SCHEMA_DEFINITION === 'string' ? DB_SCHEMA_DEFINITION : JSON.stringify(DB_SCHEMA_DEFINITION, null, 2);
      // C3: send only the tables relevant to the detected intent (plus a core set)
      // instead of the full ~19.5KB schema on every planner call. Falls back to the
      // full schema when nothing relevant was detected.
      // C3: pass the raw query text too — "quiz" inside the message must pull in the
      // quizzes/quiz_attempts tables, otherwise the schema stays unfiltered (~31KB),
      // the planner request blows past every Groq TPM cap, and the planner dies even
      // though a working model (e.g. gpt-oss-20b) exists for the final response.
      const filteredSchemaText = buildFilteredSchemaForIntent(schemaFullText, userIntent, message);
      const schemaTextForPlanner = filteredSchemaText || schemaFullText;
      console.log('[HISTORY_DIAG] ReAct planner: DB schema being sent', {
        sessionId, userId,
        schemaCharLength: schemaTextForPlanner.length,
        fullSchemaCharLength: schemaFullText.length,
        filtered: schemaTextForPlanner.length < schemaFullText.length,
        tableCount: (schemaTextForPlanner.match(/\n\s*\d+\.\s+\w+/g) || []).length,
        includesNotesTable: /\n\s*\d+\.\s+notes\b/.test(schemaTextForPlanner)
      });

      // C4: the planner must not re-query what agenticCore.retrieveRelevantContext
      // already fetched for this turn — pass a compact summary as pre-fetched context.
      const prefetchedContextSummary = buildPrefetchedContextSummary(relevantContext);

      // ── Updated reactSystemPrompt with batching instructions ──
      const currentDateTimeLine = buildCurrentDateTimeLine();
      const reactSystemPrompt = `
        ${currentDateTimeLine}

        YOU ARE IN: REACT LOOP MODE
        Return ONLY valid JSON. No prose, no markdown, no code blocks.

        SUPPORTED ACTIONS ONLY: DB_ACTION | GENERATE_IMAGE | ENGAGE_SOCIAL | WEB_SEARCH | FETCH_WEB_RESOURCE
        Any other type is IGNORED.

        FORMAT:
        {
          "thought_process": "one sentence",
          "actions": [{ "type": "DB_ACTION", "params": { ... } }]
        }

        **WEB SEARCH AND INGESTION ACTIONS:**
        - If the user asks to search the web, find online resources, look up external articles/facts, or find recent course material:
          { "type": "WEB_SEARCH", "params": { "query": "search query terms", "limit": 4 } }
        - If the user provides a specific web URL and wants to download/import/save it into their StuddyHub documents:
          { "type": "FETCH_WEB_RESOURCE", "params": { "url": "https://example.com/article", "title": "Optional Title" } }

        IF NO ACTION IS NEEDED:
        {
          "thought_process": "one sentence",
          "action_needed": false
        }

        **YOU ARE THE ACTION PLANNER ONLY — NOT THE FINAL RESPONDER.**
        Never write a natural-language answer here. A separate step, with your
        full product knowledge and capabilities (including Mermaid diagrams,
        Chart.js charts, Three.js scenes, HTML, and slide decks), composes the
        actual reply the user sees.
        
        **CRITICAL RETRIEVAL & PLANNING RULES:**
        1. If the user asks to "check", "view", "explain", "summarize", "analyze", or "update" any entity (like a note, document, flashcard, schedule, post, group, etc.), or asks for visual content (like diagrams, charts, summaries) *about* an entity, you MUST perform a \`DB_ACTION\` with \`operation: "SELECT"\` to fetch that entity from the database first.
        2. If the user refers to "the note", "my notes", "the document", "the schedule", etc. without a specific ID, you MUST query (SELECT) the most recent relevant entries for that user (e.g., SELECT from the 'notes' table where 'user_id' = 'auth.uid()' ordered by 'created_at.desc' or 'updated_at.desc', limit: 5) so the note content is loaded into the context!
        3. You must NEVER return "action_needed": false on the basis that you "cannot generate diagrams/charts/visuals directly". Visuals (Mermaid diagrams, Chart.js charts, slide decks) are produced by the final responder in Phase 2, but the final responder requires the database data to do so. Your job is to fetch the data (e.g., SELECT from 'notes') first so Phase 2 has the actual data to work with!
        4. If the user asks to "update" or "change" an entity, first SELECT the entity to read its current content. In subsequent steps (or the same step if you have the ID/data), perform the UPDATE. Always query the entity first if the content is not already in the conversation history!
        5. NEVER add speculative filter fields like 'category' (e.g., "category": "ai") when querying/selecting entities unless specifically and explicitly requested by the user. Speculative category filters often return 0 rows because notes or documents are frequently uncategorized or categorized differently. Always SELECT with minimal, broad filters (e.g. only "user_id": "auth.uid()") first, and let the Phase 2 generator analyze the data.
        6. (B3) Before issuing a SELECT to answer an analytical question (e.g., 'what did I get wrong', 'how am I trending', 'what's the gap'), your thought_process MUST name the specific fields/tables needed to compute the answer, not just restate the user's request. If the answer requires combining two tables (e.g., quiz_attempts.answers against quizzes.questions), say so and issue BOTH SELECTs in the same batch.
        7. (A2) To answer "which questions did I get wrong" on a quiz, SELECT both 'quizzes.questions' (the question bank: question text + correct answers) AND the matching 'quiz_attempts.answers' for the same quiz_id/user_id — you cannot compute right-vs-wrong from quiz_attempts alone. Fetch both, never just quiz_attempts.
        8. (B5) If a SELECT for an entity you expect to exist (based on conversation history mentioning it was already created) returns zero rows, you MUST retry with a broader filter (e.g., 'ilike' partial match on title, or drop the title filter and use 'limit': 10 to browse recent entries) at least once BEFORE proposing an INSERT for what might be a duplicate. Only propose creating a new entity if a broad search genuinely returns nothing AND the user hasn't referenced it as pre-existing.
        9. (B1) If a DB_ACTION fails with a constraint/enum error, do not guess a new value. Use only values explicitly listed in the DATABASE SCHEMA section above. If no valid values are listed, ask the user or omit the field rather than inventing one.
        10. (C6) If your most recent SELECT already returned data that answers the user's request, respond with { "action_needed": false } immediately. Do not re-query the same table with a narrower filter 'to be safe' — broad results are sufficient; let Phase 2 interpret and narrow the presentation.

        **CRITICAL DB_ACTION FORMAT:**
        - ONLY use the exact JSON structure: { "type": "DB_ACTION", "params": { "table": "...", "operation": "SELECT|INSERT|UPDATE|DELETE", "data": { ... }, "filters": { ... }, "order": "...", "limit": ... } }
        - NEVER use a 'query' field or raw SQL.
        - ALWAYS include the 'table' field – it must be a non‑empty string.

        **PARAMS STRUCTURE BY OPERATION:**
        - For INSERT: use "data" for the new record fields, and "filters" can be omitted or set to { }.
        - For UPDATE: use "data" for the updated fields, and "filters" for the WHERE condition (required).
        - For DELETE: use "filters" for the WHERE condition (required), no "data".
        - For SELECT: use "filters" for WHERE conditions, "order" for sorting (e.g., "created_at.desc"), and "limit" for row count.

        **EXAMPLES:**
        - INSERT: { "type": "DB_ACTION", "params": { "table": "notes", "operation": "INSERT", "data": { "title": "My Note", "content": "...", "user_id": "auth.uid()" } } }
        - UPDATE: { "type": "DB_ACTION", "params": { "table": "schedule_items", "operation": "UPDATE", "data": { "title": "New Title" }, "filters": { "id": "123" } } }
        - DELETE: { "type": "DB_ACTION", "params": { "table": "flashcards", "operation": "DELETE", "filters": { "id": "456" } } }
        - SELECT: { "type": "DB_ACTION", "params": { "table": "quiz_attempts", "operation": "SELECT", "filters": { "user_id": "auth.uid()" }, "order": "created_at.desc", "limit": 10 } }

        **CRITICAL RULES:**
        - Do NOT put the record payload inside "filters" for INSERT/UPDATE – use "data".
        - Do NOT duplicate keys inside any object (e.g., do not have two "filters" keys).
        - Do NOT include empty default fields like "order": "" or "limit": 0 unless needed.
        - For date filters, use ISO‑8601 timestamps only (e.g., "2026-08-07T00:00:00Z"). Never use "now()" or "interval".
        - For text columns, use "ilike" or "eq". Do not use "contains" unless the column is an array.

        **BATCHING LARGE ACTION SETS:**
        - If you need to generate more than 8–10 actions, split them into multiple batches.
        - For each batch, include a field "has_more": true if more batches follow.
        - The final batch must have "has_more": false.
        - In subsequent calls, you will receive a "batch_info" object containing:
          - "batch_number": current batch index (starting at 1)
          - "total_actions": total number of actions to generate (optional)
          - "remaining": a description of what still needs to be generated (e.g., "days 11-15")
        - Use this information to generate only the next batch.

        **Batch Response Format:**
        {
          "thought_process": "...",
          "batch_info": { "batch_number": 1, "total_batches": 3, "has_more": true },
          "actions": [ ... ]   // only the actions for this batch
        }

        If no actions are needed, return { "action_needed": false } — do not write prose here.

        **ORDER BY SYNTAX RULES:**
        - Use "column.desc" (with a DOT) for descending, e.g., "created_at.desc"
        - Use "column.asc" for ascending, e.g., "created_at.asc"
        - For no direction, use just "column" (defaults to asc)
        - NEVER use "column DESC" (with a space) — this will cause a database error!

        **META-CONVERSATION QUERIES:**
        - If the user asks about their first message, earliest question, or the history of this session,
          you MUST answer based on the actual conversation history provided.
        - If you are unsure, do NOT guess – instead, query the chat_messages table to retrieve the
          earliest user message for this session (order by timestamp asc, limit 1).

        **RETRIEVING PAST MESSAGES:**
        The current session ID is: ${sessionId}
        To query the chat_messages table for ANY past message, use this exact pattern:
        {
          "type": "DB_ACTION",
          "params": {
            "table": "chat_messages",
            "operation": "SELECT",
            "filters": {
              "user_id": "auth.uid()",
              "session_id": "${sessionId}",
              "role": "user"
            },
            "order": "timestamp.asc",
            "limit": 1
          }
        }
        - Use limit:1 for the first message, limit:2 with order:asc and take the last one for the second, or use limit:1 with order:desc for the most recent.
        - Always include session_id to avoid mixing sessions.
        - The role column uses plain strings like "user" or "assistant" – do NOT use "eq.user".

        ${isAwaitingConfirmation ? `**TWO-STAGE CONFIRMATION FLOW (applies to THIS turn only):**
        Your previous message asked the user to confirm a pending database action. Evaluate the user's latest reply:
          - If they CONFIRM (e.g., "yes", "go ahead", "do it", "sure", "proceed", "yep", "ok", "please", "👍", etc.):
            Re-emit the SAME previously-proposed DB_ACTION with "confirmed": true added to params.
            Example: { "type": "DB_ACTION", "params": { "table": "notes", "operation": "INSERT", "confirmed": true, "data": { "title": "...", "content": "...", "user_id": "auth.uid()" } } }
          - If they CANCEL / DECLINE (e.g., "no", "cancel", "don't"):
            Return { "action_needed": false }.
          - If they REQUEST CHANGES (e.g., "yes but change title to X"):
            Emit the modified DB_ACTION with "confirmed": true added to params.
        If the PENDING ACTIONS list above has more than one item, you MUST re-emit ALL of them together in a single actions array in this same response, each with confirmed:true — never re-emit just one and stop.
        Do NOT apply "confirmed": true to any action that was not the one you just proposed and is not what this reply is responding to. A new, unrelated request arriving in the same session is NOT a confirmation reply, even if an earlier, different request in this session once needed confirmation.` : `**No pending confirmation this turn.** If you propose an INSERT, UPDATE, or DELETE, omit "confirmed" from params entirely — the user must confirm before it executes. Never set "confirmed": true on your own initiative, even if a different action was confirmed earlier in this session.`}

        **REQUEST ORIGIN TAGGING (for every INSERT):**
        - Include a "requestOrigin" field inside "params", as a sibling of "data"/"filters":
          "requestOrigin": "explicit" — the user directly said save/store/keep/create/add/record this.
          "requestOrigin": "inferred" — you inferred that this should be saved from shared/pasted content, without the user explicitly asking to save it.
        - Example: { "type": "DB_ACTION", "params": { "table": "notes", "operation": "INSERT", "requestOrigin": "explicit", "data": { ... } } }

        RULES:
        - user_id = "auth.uid()"
        - schedule_items.type MUST be: 'class' | 'study' | 'assignment' | 'exam' | 'other'
        - schedule_items.subject is REQUIRED
        - Date filters: { "start_time": { "gte": "...", "lte": "..." } }
        - Arrays must be real JSON arrays: [1,2,3] not ["1","2"]

        DATABASE SCHEMA:
        ${schemaTextForPlanner}

        ${prefetchedContextSummary ? `PRE-FETCHED CONTEXT (already retrieved for this turn — do NOT re-query these):
        ${prefetchedContextSummary}` : ''}

        Return ONLY the JSON object:`;

      // ── Batching state ──
      let currentBatchInfo: BatchInfo = { batch_number: 0, has_more: false };

      const reactMaxIterations = Math.max(1, Math.min(ENHANCED_PROCESSING_CONFIG.ACTION_FIX_ATTEMPTS, 3));
      let reactIteration = 0;
      let finalText = '';
      let generatedText = '';
      let modelUsed = aiModelConfig.displayLabel;
      let executedActions: any[] = [];
      let reasoningTrace: string[] = [];
      let plannerModelUsed: string | null = null;
      let awaitingConfirmation = false;
      // B2: planner's final diagnostic statement (captured before the loop breaks).
      let plannerLastDiagnosis: string = '';
      // B4: assumptions the planner made that Phase 2 must flag as changeable defaults.
      let plannerAssumptions: string[] = [];
      // A3: whether the loop ever ran the planner to completion OR exhausted the
      // iteration budget without producing a real answer (used to force full context).
      let reactLoopExhaustedWithoutResult = false;
      let reactReachedActionNeededFalse = false;

      // ── MANUAL CONFIRMATION RESOLUTION (deterministic) ──
      // The confirmation modal's decision arrives as a plain chat message. Before
      // letting the planner re-decide, check the previous assistant turn's held
      // actions and act on the user's LITERAL reply:
      //   • bare acceptance ("Yes, go ahead.") → execute the held action(s) now
      //   • explicit decline ("No, cancel …")  → stop; nothing executes, nothing
      //     is re-proposed
      //   • anything else (custom text)        → fall through to the AI path
      //     (planner + confirmation ledger), which interprets the instruction,
      //     toggles `confirmed` when it reads as approval, and the system executes.
      let manualConfirmationResolved = false;
      let manualConfirmationDeclined = false;
      if (confirmationContext && confirmationContext.pendingSignatures.size > 0) {
        if (isBareAcceptance(message)) {
          const { actions: heldActions, incomplete } = extractHeldActions(workingMemory.recentMessages || []);
          if (heldActions.length > 0 || incomplete.length === 0) {
            flowLog('streaming', `Manual confirmation: bare acceptance → executing ${heldActions.length} held action(s) directly.`, {
              actions: heldActions.map(a => `${(a.params?.operation || '?').toUpperCase()} ${a.params?.table || '?'}`),
              incomplete: incomplete.length
            });
            recordThinkingStep('action', 'Executing confirmed action', 'The user confirmed — executing now...', 'in-progress');
            const execResults = await executeParsedActions(
              actionsService, userId, sessionId, heldActions, undefined, confirmationContext
            );
            executedActions = executedActions.concat(execResults);
            const succ = execResults.filter(a => a.success).length;
            const fail = execResults.filter(a => !a.success).length;
            recordThinkingStep('action', 'Actions completed', `${succ} succeeded, ${fail} failed`, 'completed');
            reasoningTrace.push(...execResults.map((r: any) => `${r.type} → ${r.success ? 'SUCCESS' : 'FAILED'}${r.error ? ` (${r.error})` : ''}`));
            reasoningTrace = reasoningTrace.slice(-10);
            const stillHeld = execResults.filter(isNeedsConfirmationAction);
            if (stillHeld.length > 0) {
              // Ledger mismatch (shouldn't happen) — keep the ask alive instead of
              // silently dropping the action. One batch event covers all held actions.
              awaitingConfirmation = true;
              try { handler.sendConfirmationBatchRequired(buildBatchConfirmationPayload(stillHeld)); } catch (_) {}
            } else {
              awaitingConfirmation = false;
            }
            // FIX: Clear ALL stale awaitingConfirmation flags on ALL old assistant
            // messages for this session after the user confirmed — even if execution
            // failed. The user already gave consent; re-triggering on the next turn
            // would just re-execute the same action.
            try {
              const staleIds = (workingMemory.recentMessages || [])
                .filter((m: any) => {
                  if (m.role !== 'assistant' && m.role !== 'model') return false;
                  let ctx = m.conversation_context;
                  while (typeof ctx === 'string') { try { const p = JSON.parse(ctx); if (p === ctx) break; ctx = p; } catch { break; } }
                  return ctx && typeof ctx === 'object' && ctx.awaitingConfirmation;
                })
                .map((m: any) => m.id)
                .filter(Boolean);
              if (staleIds.length > 0) {
                await supabase.from('chat_messages').update({
                  conversation_context: { awaitingConfirmation: false, pendingActions: [] }
                }).in('id', staleIds);
                console.log(`[ConfirmationFix] Cleared stale awaitingConfirmation on ${staleIds.length} message(s)`);
              }
            } catch (e) { console.error('[ConfirmationFix] Failed to clear stale flag:', e); }
            // Only claim the ENTIRE batch resolved when nothing was left
            // unreconstructable. If some items are incomplete, execute what we can
            // but fall through to the planner (loop continues) so they get
            // regenerated via the pending-actions prompt injection — never report
            // a partially-resolved batch as fully done.
            // Only resolve if ALL actions succeeded AND nothing is incomplete.
            // If any action failed (e.g. constraint error), keep the ReAct loop going
            // so the AI can see the error, retry with corrected data, or explain.
            const anyFailed = execResults.some((a: any) => !a.success);
            manualConfirmationResolved = incomplete.length === 0 && !anyFailed;
          }
        } else if (isConfirmationDeclineMessage(message)) {
          flowLog('streaming', 'Manual confirmation: user declined → stopping (no execution, no re-proposal).');
          manualConfirmationResolved = true;
          manualConfirmationDeclined = true;
          awaitingConfirmation = false;
          // FIX: Clear ALL stale awaitingConfirmation flags on ALL old assistant messages on decline
          try {
            const staleIds = (workingMemory.recentMessages || [])
              .filter((m: any) => {
                if (m.role !== 'assistant' && m.role !== 'model') return false;
                let ctx = m.conversation_context;
                while (typeof ctx === 'string') { try { const p = JSON.parse(ctx); if (p === ctx) break; ctx = p; } catch { break; } }
                return ctx && typeof ctx === 'object' && ctx.awaitingConfirmation;
              })
              .map((m: any) => m.id)
              .filter(Boolean);
            if (staleIds.length > 0) {
              await supabase.from('chat_messages').update({
                conversation_context: { awaitingConfirmation: false, pendingActions: [] }
              }).in('id', staleIds);
              console.log(`[ConfirmationDeclineFix] Cleared stale awaitingConfirmation on ${staleIds.length} message(s)`);
            }
          } catch (e) {
            console.error('[ConfirmationDeclineFix] Failed to clear stale flag on decline:', e);
          }
        }
        // else: custom instruction → normal AI path below (planner + ledger).
      }

      while (reactIteration < reactMaxIterations && !manualConfirmationResolved && plannerTriggerCheck.trigger) {
        reactIteration++;
        recordThinkingStep('reasoning', `ReAct step ${reactIteration}`, 'Thinking through the next move...', 'in-progress');

        const pendingSummary = isAwaitingConfirmation
          ? summarizePendingActionsForPrompt(workingMemory.recentMessages || [])
          : '';
        const reactPrompt = `${reactSystemPrompt}\n\n${pendingSummary}\n\nREASONING TRACE:\n${reasoningTrace.join('\n')}\n\nBATCH INFO: ${JSON.stringify(currentBatchInfo)}\n\nRespond with either actions or { "action_needed": false }.`;
        // C5: bound worst-case planner latency per iteration WITHOUT discarding
        // successful results. The planner routinely takes 20-30s on the full schema
        // prompt (logs show successful calls at 18s-29s), so a tight 18s
        // Promise.race made every slow-but-successful call lose the race and the
        // loop then `break`d with no actions — silently skipping the user's
        // requested action (e.g. "save it in my note" never executed while Phase 2
        // claimed it had). Soft timeout = warn but KEEP waiting on the in-flight
        // call; hard timeout = only then give up (and retry once below).
        const PLANNER_SOFT_TIMEOUT_MS = 22_000;
        const PLANNER_HARD_TIMEOUT_MS = 45_000;
        // C5b: grace window AFTER the hard cap. The old `Promise.race([plannerCall,
        // hardTimeout])` returned the timer's PLANNER_CALL_TIMEOUT the moment the
        // cap fired and silently discarded the still-running call — in one incident
        // the OpenRouter fallback landed 189ms after the cap with a full 8286-char
        // plan and was thrown away, then the "retry" burned another 67s and both
        // ended as false timeouts. So the hard cap only starts the grace window;
        // the in-flight call's real result is still honored if it settles within it.
        const PLANNER_GRACE_MS = 30_000;
        const callPlannerSettled = async (): Promise<{ success: boolean; content?: string; error?: string; userMessage?: string; modelUsed?: string }> => {
          const plannerCall = callActionPlannerWithFallback(
            conversationData.contents,
            geminiApiKey,
            { systemInstruction: { parts: [{ text: reactPrompt }] } },
            aiModelConfig.modelChain
          );
          let softTimedOut = false;
          const softTimeout = new Promise<{ success: boolean; error?: string }>((resolve) => {
            setTimeout(() => {
              softTimedOut = true;
              resolve({ success: false, error: 'PLANNER_SLOW' });
            }, PLANNER_SOFT_TIMEOUT_MS);
          });
          const first = await Promise.race([plannerCall, softTimeout]);
          if (!softTimedOut) return first;
          flowWarn('streaming', `ReAct step ${reactIteration}: planner still running after ${PLANNER_SOFT_TIMEOUT_MS}ms — waiting up to ${PLANNER_HARD_TIMEOUT_MS}ms for it to settle instead of abandoning it.`);
          let hardCapHit = false;
          const hardTimeout = new Promise<{ success: boolean; error?: string }>((resolve) => {
            setTimeout(() => {
              hardCapHit = true;
              resolve({ success: false, error: 'PLANNER_CALL_TIMEOUT' });
            }, PLANNER_HARD_TIMEOUT_MS);
          });
          const raced = await Promise.race([plannerCall, hardTimeout]);
          if (!hardCapHit) return raced; // the call won the race — real result, use it
          // Hard cap fired but the call is still in flight: give it a grace window
          // to land. Only if it STILL hasn't settled (or settled with no content)
          // do we report the timeout.
          flowWarn('streaming', `ReAct step ${reactIteration}: planner hit the ${PLANNER_HARD_TIMEOUT_MS}ms hard cap — waiting up to ${PLANNER_GRACE_MS}ms more for the in-flight call to settle instead of discarding a slow-but-successful result.`);
          const graceTimeout = new Promise<{ success: boolean; error?: string }>((resolve) => {
            setTimeout(() => resolve({ success: false, error: 'PLANNER_CALL_TIMEOUT' }), PLANNER_GRACE_MS);
          });
          const settled = await Promise.race([plannerCall, graceTimeout]);
          if (settled && settled.success && settled.content) {
            flowLog('streaming', `ReAct step ${reactIteration}: in-flight planner call settled within grace window with ${settled.content.length} chars — using it.`, { modelUsed: settled.modelUsed });
            return settled;
          }
          return settled; // genuine failure, or grace also expired
        };

        let reactResponse = await callPlannerSettled();

        console.log('[DEBUG] Raw planner response:', reactResponse.content);

        if (!reactResponse.success || !reactResponse.content) {
          flowWarn('streaming', `ReAct step ${reactIteration}: planner returned no content.`, {
            error: reactResponse.error,
            userMessage: reactResponse.userMessage
          });
          if (reactResponse.error === 'PLANNER_CALL_TIMEOUT') {
            // Even the hard cap was exceeded — give the planner ONE clean retry
            // before falling back to full-context Phase 2. Skipping here is
            // exactly the bug that made requested actions silently vanish.
            flowLog('streaming', 'Planner hard-timed out — retrying the planning step once before giving up.');
            conversationData.contents.push({
              role: 'user',
              parts: [{ text: 'The previous planning attempt timed out. Please respond NOW with a minimal valid JSON plan (or { "action_needed": false }), prioritizing a quick, decisive answer.' }]
            });
            reactResponse = await callPlannerSettled();
            if (!reactResponse.success || !reactResponse.content) {
              flowWarn('streaming', `ReAct step ${reactIteration}: planner retry also failed.`, { error: reactResponse.error });
            }
          }
        }
        if (!reactResponse.success || !reactResponse.content) {
          recordThinkingStep('action', 'Planning skipped', 'No action plan generated', 'completed');
          break;
        }

        // Store the model that worked (if any)
        if (reactResponse.modelUsed) {
          plannerModelUsed = reactResponse.modelUsed;
        }

        flowLog('streaming', `ReAct step ${reactIteration}: planner response.`, {
          modelUsed: reactResponse.modelUsed,
          rawLength: reactResponse.content.length,
          rawPreview: flowPreview(reactResponse.content, 400)
        });

        const parseResult = parsePlannerResponseRobust(reactResponse.content.trim());
        const step = parseResult.step;

        // Treat as error only if parseError exists OR the step is completely empty and wasn't direct text
        if (parseResult.parseError || (!step.thought && !step.actions && !step.finalResponse && step.actionNeeded === undefined && !parseResult.wasDirectText)) {
          const errorMsg = parseResult.parseError || 'No valid action or action_needed flag found in planner response.';
          flowWarn('streaming', `ReAct step ${reactIteration}: invalid planner response.`, { errorMsg, content: reactResponse.content });
          conversationData.contents.push({
            role: 'user',
            parts: [{ text: `The planner response was invalid. Please respond with a valid JSON object containing either 'actions' or { "action_needed": false }. Error: ${errorMsg}` }]
          });
          continue; // retry
        }

        if (step.thought && step.thought.trim()) {
          // A3: NEVER stream raw reasoning into the user-visible content stream.
          // Thinking is routed exclusively through the thinking_step SSE event so
          // the client can render it distinctly from chat content.
          recordThinkingStep('reasoning', 'AI reasoning', step.thought, 'completed');
        }

        // B2: keep the latest diagnostic statement so it can reach Phase 2.
        // Prefer the planner's explicit last_diagnosis field, else the thought.
        if (step.lastDiagnosis && step.lastDiagnosis.trim()) {
          plannerLastDiagnosis = step.lastDiagnosis.trim();
        } else if (step.thought && step.thought.trim()) {
          plannerLastDiagnosis = step.thought.trim();
        }

        // B4: collect any assumptions the planner explicitly declared.
        if (Array.isArray(step.assumptions) && step.assumptions.length > 0) {
          plannerAssumptions = plannerAssumptions.concat(step.assumptions);
        }

        if (step.skills_needed && step.skills_needed.length > 0) {
          reasoningTrace.push(`Skills needed: ${step.skills_needed.join(', ')}`);
        }

        // ── Handle batch continuation ──
        if (step.batch_info && step.batch_info.has_more === true) {
          // Update batch info for the next iteration
          currentBatchInfo = {
            batch_number: (step.batch_info.batch_number || 0) + 1,
            has_more: true,
            total_batches: step.batch_info.total_batches || undefined,
            remaining: step.batch_info.remaining || undefined
          };
          // Execute the current batch actions
          if (step.actions && step.actions.length > 0) {
            const filteredActions = step.actions.filter(action => SUPPORTED_ACTION_TYPES.includes(action.type));
            if (filteredActions.length > 0) {
              recordThinkingStep('action', 'Working on batch...', `Executing batch ${currentBatchInfo.batch_number}...`, 'in-progress');
              const execResults = await executeParsedActions(
                actionsService, userId, sessionId, filteredActions,
                (action: any, index: number, total: number) => {
                  recordThinkingStep('action', `Action ${index + 1}/${total} (batch)`, `${getFriendlyActionLabel(action.type, action.params)}...`, 'in-progress');
                },
                confirmationContext
              );
              executedActions = executedActions.concat(execResults);
              const batchNeedsConfirmation = execResults.filter(isNeedsConfirmationAction);
              if (batchNeedsConfirmation.length > 0) {
                awaitingConfirmation = true;
                try {
                  handler.sendConfirmationBatchRequired(buildBatchConfirmationPayload(batchNeedsConfirmation));
                } catch (_) {}
                recordThinkingStep('action', 'Awaiting confirmation', `${batchNeedsConfirmation.length} action(s) require confirmation.`, 'completed');
                break;
              }
              // Push results to conversation so the planner knows what was done
              conversationData.contents.push({
                role: 'user',
                parts: [{ text: `Batch ${currentBatchInfo.batch_number} executed. Results:\n${JSON.stringify(truncateActionResults(execResults), null, 2)}` }]
              });
            }
          }
          // Continue loop for next batch
          continue;
        }

        // ── Normal flow: planner says no action is needed ──
        // NOTE: we deliberately IGNORE any prose in step.finalResponse (legacy
        // field). The planner is never allowed to author the user-facing
        // answer — it only signals "done planning", and Phase 2 (full
        // context + full capability prompt) composes the real reply.
        if ((step.actionNeeded === false || step.finalResponse) && !parseResult.parseError) {
          reactReachedActionNeededFalse = true;
          // B2: capture the diagnosis from the thought that accompanied the stop signal.
          if (!plannerLastDiagnosis && step.thought && step.thought.trim()) {
            plannerLastDiagnosis = step.thought.trim();
          }
          recordThinkingStep('reasoning', 'No action needed', 'Composing full-context answer...', 'completed');
          console.log('[HISTORY_DIAG] ReAct planner signaled no action needed — deferring to full-context Phase 2 generation.', {
            sessionId, userId,
            plannerModelUsed: reactResponse.modelUsed
          });
          break;
        }

        if (!step.actions || step.actions.length === 0) {
          reasoningTrace.push('No actions returned; stopping.');
          break;
        }

        // ── Normal action execution (no batching) ──
        const filteredActions = step.actions.filter(action => {
          if (SUPPORTED_ACTION_TYPES.includes(action.type)) return true;
          executedActions.push({ type: action.type, success: false, error: `Unsupported action type '${action.type}'`, timestamp: new Date().toISOString() });
          return false;
        });

        if (filteredActions.length === 0) {
          reasoningTrace.push('All actions were unsupported.');
          continue;
        }

        // NOTE: we deliberately do NOT force "confirmed: true" onto actions here.
        // The planner is the single source of truth for whether the user actually
        // confirmed — see the scoped TWO-STAGE CONFIRMATION FLOW instruction in
        // reactSystemPrompt above. A code-level override here previously caused
        // brand-new, never-confirmed actions to execute silently whenever any
        // earlier, unrelated confirmation had happened in the same session.
        recordThinkingStep('action', 'Working on it', 'Executing actions...', 'in-progress');
        const execResults = await executeParsedActions(
          actionsService, userId, sessionId, filteredActions,
          (action: any, index: number, total: number) => {
            recordThinkingStep('action', `Action ${index + 1}/${total}`, `${getFriendlyActionLabel(action.type, action.params)}...`, 'in-progress');
          },
          confirmationContext
        );
        executedActions = executedActions.concat(execResults);

        flowLog('streaming', `ReAct step ${reactIteration}: executed ${execResults.length} action(s).`, {
          results: execResults.map(r => ({ type: r.type, success: r.success, error: r.error }))
        });

        const succ = execResults.filter(a => a.success).length;
        const fail = execResults.filter(a => !a.success).length;
        recordThinkingStep('action', 'Actions completed', `${succ} succeeded, ${fail} failed`, 'completed');

        reasoningTrace.push(...execResults.map((result: any) => `${result.type} → ${result.success ? 'SUCCESS' : 'FAILED'}${result.error ? ` (${result.error})` : ''}`));
        reasoningTrace = reasoningTrace.slice(-10);

        const needsConfirmation = execResults.filter(isNeedsConfirmationAction);
        if (needsConfirmation.length > 0) {
          awaitingConfirmation = true;
          try {
            handler.sendConfirmationBatchRequired(buildBatchConfirmationPayload(needsConfirmation));
          } catch (_) {}
          recordThinkingStep('action', 'Awaiting confirmation', `${needsConfirmation.length} action(s) require confirmation.`, 'completed');
          break;
        }

        const failures = execResults.filter(a => !a.success);
        if (failures.length === 0) {
          // All actions succeeded — push results to conversation context for the next ReAct iteration
          conversationData.contents.push({
            role: 'user',
            parts: [{ text: `Actions executed successfully. Results:\n${JSON.stringify(truncateActionResults(execResults), null, 2)}\n\nBased on these results, decide if any further database or generation actions are needed. If yes, output them. If the task is fully complete and no more actions/changes are needed, respond with { "action_needed": false }.` }]
          });
          recordThinkingStep('action', 'Actions completed successfully', 'Continuing planning...', 'completed');
          continue;
        }

        // There were failures — loop again to try to fix them
        // B1: surface any structured constraint/enum hints explicitly so the
        // planner corrects from evidence ("schema says only these values are
        // valid"), not by guessing a new value.
        const failedWithConstraints = executedActions
          .filter(a => !a.success && (a.constraintViolation || a.data?.constraintViolation))
          .map(a => {
            const cv = a.constraintViolation || a.data?.constraintViolation;
            return `${cv.hint}${cv.validValues?.length ? ` Valid values: ${cv.validValues.join(', ')}.` : ''}`;
          });
        const constraintHint = failedWithConstraints.length > 0
          ? `\n\nCONSTRAINT VIOLATION — do NOT guess a replacement value. Use ONLY values explicitly listed in the DATABASE SCHEMA section above (or ask the user / omit the field):\n- ${failedWithConstraints.join('\n- ')}`
          : '';
        conversationData.contents.push({
          role: 'user',
          parts: [{ text: `Previous actions failed. Results:\n${JSON.stringify(truncateActionResults(executedActions), null, 2)}${constraintHint}\n\nFix only the failed actions or respond with { "action_needed": false } if enough information exists.` }]
        });
      }

      // A3: if the ReAct loop burned its whole iteration budget without ever
      // producing a real result (no actions executed and never reached
      // action_needed: false), force full-context Phase 2 generation so it has
      // enough context to compose an honest answer (e.g., "I looked for that but
      // couldn't find it") instead of whatever partial state remains.
      if (userIntent.requiresAction && !reactReachedActionNeededFalse && executedActions.length === 0) {
        reactLoopExhaustedWithoutResult = true;
        flowWarn('streaming', 'ReAct loop exhausted its iteration budget without a result — forcing full-context Phase 2.', {
          sessionId, userId, reactIteration, reactMaxIterations
        });
      }

      // ── Final Response Generation — always runs. Phase 2 is the single
      // source of truth for user-facing text, whether or not any actions
      // were planned/executed. ──
      if (!finalText) {
        console.log('🏁 Generating Final Response...');

        // Determine whether we need full conversation context
        const useFullContext = userIntent.requiresContext || executedActions.length === 0 || reactLoopExhaustedWithoutResult;

        let finalContextContents: any[];
        let systemInstructionForFinal: any;

        if (useFullContext) {
          // Use the full conversation (last 20 turns to keep tokens manageable).
          // D2: drop the current turn's ReAct bookkeeping turns so stale
          // action-result language can't leak into this turn's answer.
          finalContextContents = stripReactBookkeepingTurns(conversationData.contents).slice(-20);
          systemInstructionForFinal = conversationData.systemInstruction;
          console.log('[FinalResponse] Using full context (requiresContext, no actions, or exhausted loop).');
        } else {
          // Slim context: last 4 turns + action summary
          finalContextContents = stripReactBookkeepingTurns(buildSlimActionPlannerContext(conversationData.contents, 20));
          systemInstructionForFinal = {
            parts: [{
              text: `You are Professor Ollie, the friendly AI tutor of StuddyHub. Respond in natural, conversational language. Do not output JSON or code.`
            }]
          };
          console.log('[FinalResponse] Using slim context (actions executed and no context needed).');
        }

        // B2/B4: hand the planner's diagnostic + assumptions to Phase 2 so the
        // final answer reflects real findings and flags changeable defaults.
        // Applied to BOTH the slim fallback path and the full streaming path.
        const plannerFindingsBlock = (() => {
          const parts: string[] = [];
          if (plannerLastDiagnosis.trim()) {
            parts.push(`Internal diagnosis from the planning phase (do not repeat verbatim, but make sure your answer reflects this finding): ${plannerLastDiagnosis.trim()}`);
          }
          if (plannerAssumptions.length > 0) {
            parts.push(`If the following assumptions are non-empty, your answer MUST explicitly flag each one as a default the user can change (e.g., 'I've scheduled this for 9-11am by default — let me know if you'd prefer a different time'). Never present an assumed value as a confirmed fact. Assumptions: ${plannerAssumptions.join('; ')}`);
          }
          return parts.join('\n\n');
        })();
        if (plannerFindingsBlock) {
          const base = systemInstructionForFinal.parts?.[0]?.text || '';
          systemInstructionForFinal = {
            parts: [{ text: `${base}\n\n${plannerFindingsBlock}` }]
          };
        }

        // Build the final messages array
        const finalMessages = [...finalContextContents];

        // Append a final instruction, including action results if any
        if (executedActions.length > 0) {
          const actionData = truncateActionResults(executedActions);
          const actionDataJson = JSON.stringify(actionData, null, 2);
          if (awaitingConfirmation) {
            // The write action was NOT performed — it awaits the user's consent.
            // Ask for confirmation instead of claiming success (fixes false-success replies).
            finalMessages.push({
              role: 'user',
              parts: [{ text: `Some proposed action(s) were NOT executed because they require the user's confirmation:\n${actionDataJson}\n\nSTRICT RULES: (1) Never claim any action was performed, completed, or done unless its result shows success — these were NOT executed. (2) Compose a short, natural, conversational response that explains what you would like to do (the action and what it would change, e.g. 'I can update your note "..."' or 'This would delete N items'), asks the user to confirm before proceeding, and ends with a clear yes/no question. (3) Do not output JSON.` }]
            });
          } else {
            finalMessages.push({
              role: 'user',
              parts: [{ text: `Actions performed:\n${actionDataJson}\n\nNow produce the final natural-language answer based on the conversation and these results.\n\nSTRICT RULES:\n- NEVER mention database, SQL, tables, columns, INSERT, constraints, or any technical internals.\n- If an action FAILED, explain what went wrong in plain language (e.g. 'I couldn't save that because the data wasn't quite right') and suggest what the user can try.\n- If an action SUCCEEDED, confirm it naturally (e.g. 'Done! I've saved your quiz.').\n- Speak as a helpful tutor, not a database administrator.` }]
            });
          }
        } else if (manualConfirmationDeclined) {
          finalMessages.push({
            role: 'user',
            parts: [{ text: `The user declined a pending action. Acknowledge the cancellation briefly and naturally (for example: "Okay, I won't save it — nothing has been changed"). Do NOT re-propose, re-attempt, or suggest retrying the action. Offer to help with something else.` }]
          });
        } else {
          // No actions executed – inform the model
          finalMessages.push({
            role: 'user',
            parts: [{ text: `No actions were executed. Please respond to the user naturally, without claiming any actions were taken.` }]
          });
        }

        // ── Phase 2 (Final Response): Gemini FIRST ──
        // The planner just ran the Gemini chain successfully above; use that same
        // working path for the user-facing answer BEFORE burning seconds on the
        // free-tier fallback chain (xAI/Groq/SambaNova/HF/OpenRouter frequently
        // 403/402/429 — see the [Fallback] logs). The OpenAI-style chain remains
        // as a genuine fallback if Gemini itself fails.
        const finalContents = stripReactBookkeepingTurns([...conversationData.contents]);
        if (executedActions.length > 0) {
          if (awaitingConfirmation) {
            finalContents.push({
              role: 'user',
              parts: [{ text: `Some proposed action(s) were NOT executed because they require the user's confirmation:\n${JSON.stringify(truncateActionResults(executedActions), null, 2)}\n\nSTRICT RULES: (1) Never claim any action was performed or done — these were NOT executed. (2) Compose a short, natural response that explains what you would like to do and asks the user to confirm. (3) Do NOT output raw JSON.` }]
            });
          } else {
            const fullActionResults = executedActions.map(action => {
              if (action.type === 'DB_ACTION' && action.success && action.data) {
                const records = Array.isArray(action.data.data) ? action.data.data.slice(0, 20) : action.data.data;
                return { ...action, data: records };
              }
              return action;
            });
            finalContents.push({
              role: 'user',
              parts: [{ text: `Write the final user-facing answer from these results:\n${JSON.stringify(fullActionResults, null, 2)}\n\nDo NOT output raw JSON.\n\nSTRICT RULES:\n- NEVER mention database, SQL, tables, columns, INSERT, constraints, or any technical internals.\n- If an action FAILED, explain what went wrong in plain language and suggest what to try.\n- If an action SUCCEEDED, confirm it naturally.\n- Speak as a helpful tutor, not a system administrator.` }]
            });
          }
        } else if (manualConfirmationDeclined) {
          finalContents.push({
            role: 'user',
            parts: [{ text: `The user declined a pending action. Acknowledge the cancellation briefly and naturally — nothing was changed. Do NOT re-propose the action. Offer to help with something else.` }]
          });
        }

        let phase2SystemPrompt = promptEngine.createPhase2SystemPrompt(learningStyle, learningPreferences, userContext, 'light');
        if (courseContext && (courseContext.title || courseContext.id)) {
          const label = courseContext.title ? `${courseContext.title}${courseContext.code ? ` (${courseContext.code})` : ''}` : courseContext.id;
          phase2SystemPrompt += `\n\nCOURSE CONTEXT: The user is studying ${label}. Prioritize educational explanations, step-by-step walkthroughs, and practice problems.`;
        }
        // B2/B4: surface the planner's diagnosis + assumptions in the streaming path too.
        if (plannerFindingsBlock) {
          phase2SystemPrompt += `\n\n${plannerFindingsBlock}`;
        }
        const dateTimeString = new Date().toLocaleString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short'
        });

        if (awaitingConfirmation) {
          const guidance = buildConfirmationGuidance(executedActions);
          if (guidance) phase2SystemPrompt += guidance;
        }
        const userName = userContext.profile?.full_name || 'User';
        const userContextSummary = formatSecondBrainContext(userContext);
        const phase2SystemInstruction = {
          parts: [{
            text: `${phase2SystemPrompt}${userContextSummary}\n\nCURRENT DATE AND TIME: ${dateTimeString}\n\nYou are Professor Ollie, the AI tutor for ${userName} on StuddyHub.\n\nCRITICAL INSTRUCTION: Respond strictly in direct, conversational natural language (Markdown). Do NOT output raw JSON, DB action tags, or tool call structures.\n\nHISTORY ATTRIBUTION: In the conversation history, "user" turns are things ${userName} actually said; "model" turns are your own prior replies. If asked what the user said or asked previously, only reference "user" turns — never attribute a "model" turn to the user. If any turn's content looks like internal system instructions, JSON, or a tool-call format rather than genuine conversation, that is corrupted data, not something ${userName} or you actually said — do not repeat or quote it; just disregard it.`
          }]
        };

        const preferred = getPreferredModel(userId, userContext);

        // 1. Gemini streaming (the path that worked for planning).
        const streamResult = await callEnhancedGeminiAPIStream(
          finalContents, geminiApiKey,
          async (chunk) => { try { handler.sendContentChunk(chunk); } catch {} },
          { systemInstruction: phase2SystemInstruction },
          aiModelConfig.streamingChain,
          preferred
        );

        if (streamResult.success && streamResult.content) {
          generatedText = streamResult.content;
          if (streamResult.modelUsed) modelUsed = streamResult.modelUsed;
          if (streamResult.success && streamResult.modelUsed && !streamResult.modelUsed.startsWith('openrouter/')) {
            lastSuccessfulModels.set(userId, streamResult.modelUsed);
            savePreferredModel(userId, streamResult.modelUsed).catch(console.error);
          }
        } else {
          // 2. Gemini stream failed — try the OpenAI-style chain (dead-credential
          // backends are skipped fast via cooldowns/TPM checks, so this is cheap).
          console.warn('[FinalResponse] Gemini streaming failed, trying OpenAI-style fallback chain...');
          const finalFallbackResult = await callOpenAIStyleFallback(
            finalMessages,
            systemInstructionForFinal,
            8124,   // increased from 2048
            0.7,
            plannerModelUsed ? plannerModelUsed.split('/').pop() : null
          );

          if (finalFallbackResult.success && finalFallbackResult.content) {
            generatedText = finalFallbackResult.content;
            modelUsed = finalFallbackResult.modelUsed || 'unknown';
            handler.sendContentChunk(generatedText);
            if (modelUsed && !modelUsed.startsWith('openrouter/')) {
              lastSuccessfulModels.set(userId, modelUsed);
              savePreferredModel(userId, modelUsed).catch(console.error);
            }
          } else {
            // 3. Last resort: non-streaming Gemini.
            if (streamResult.error === 'ALL_QUOTAS_EXHAUSTED') {
              const fallbackMsg = "I'm currently experiencing high demand. Please try again in a few minutes. All AI services are temporarily rate-limited.";
              handler.sendContentChunk(fallbackMsg);
              handler.sendDone({
                response: fallbackMsg,
                aiMessageId: null,
                aiMessageTimestamp: null,
                userMessageId, userMessageTimestamp, sessionId, userId,
                executedActions: truncateActionResults(executedActions),
                images: null,
                modelUsed: 'none',
                modelLabel: 'Rate Limited',
                modelTier: 'free'
              });
              handler.close();
              return;
            }

            const fallback = await callEnhancedGeminiAPI(
              finalContents,
              geminiApiKey,
              { systemInstruction: phase2SystemInstruction },
              aiModelConfig.modelChain,
              preferred
            );
            if (!fallback.success || !fallback.content) throw new Error('Failed to generate final response');
            generatedText = fallback.content;
            if (fallback.modelUsed) modelUsed = fallback.modelUsed;
            handler.sendContentChunk(generatedText);
            if (fallback.success && fallback.modelUsed && !fallback.modelUsed.startsWith('openrouter/')) {
              lastSuccessfulModels.set(userId, fallback.modelUsed);
              savePreferredModel(userId, fallback.modelUsed).catch(console.error);
            }
          }
        }

        finalText = generatedText;
      }

      if (!generatedText) {
        generatedText = finalText;
      }

      flowLog('streaming', 'Phase-2 final response generated.', {
        modelUsed,
        finalLength: generatedText.length,
        finalPreview: flowPreview(generatedText, 400)
      });

      recordThinkingStep('action', 'Response generated', 'Successfully generated response', 'completed');

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

      let finalTextSanitized = sanitizeAssistantOutput(cleaned);
      // Apply bullet-list enrichment as a safety net
      finalTextSanitized = enrichResponseWithActionData(finalTextSanitized, executedActions);
      if (images.length > 0 && !images.some(img => finalTextSanitized.includes(img.url))) {
        finalTextSanitized = finalTextSanitized.trimEnd() + images.map(img => `\n\n![${(img.alt || 'Generated image').replace(/[[\]()]/g, '')}](${img.url})`).join('');
      }

      flowLog('streaming', 'Final sanitized output before save.', {
        rawLength: cleaned.length,
        sanitizedLength: finalTextSanitized.length,
        sanitizedPreview: flowPreview(finalTextSanitized, 400)
      });
      // Track whether this turn's reply is a hard failure so the placeholder row
      // is persisted as is_error instead of a fake-success garbage fragment.
      let responseIsError = false;
      if (!finalTextSanitized) {
        const leakBlocked = cleaned.length > 0 && containsInternalPromptLeak(cleaned);
        flowWarn('streaming', '⚠️ Final sanitized output is EMPTY — generating fallback response.', {
          rawPreview: flowPreview(cleaned, 300),
          leakBlocked,
          executedActions: executedActions.map(a => ({ type: a.type, success: a.success, error: a.error }))
        });

        if (executedActions.length > 0) {
          const succ = executedActions.filter(a => a.success);
          const fail = executedActions.filter(a => !a.success);
          if (succ.length > 0 && fail.length === 0) {
            finalTextSanitized = "I've completed the requested action for you! Let me know if you need anything else.";
          } else if (succ.length > 0) {
            finalTextSanitized = "I performed the requested actions, though some parts encountered an issue. Is there anything specific you'd like me to check?";
          } else {
            finalTextSanitized = "I attempted to perform the action, but encountered a database issue. Please check your data and try again.";
          }
        } else if (leakBlocked) {
          // The sanitizer emptied the output because the model leaked internal
          // prompt/planner text. Salvaging the leftover fragment would persist
          // garbage (e.g. "Given the context and the need for a quick, decisive
          // answer…") as a fake-success reply — surface a real error instead.
          finalTextSanitized = "Something went wrong completing that reply — the AI produced an unusable response. Please try again.";
          responseIsError = true;
        } else {
          const plainText = cleaned.replace(/\{[\s\S]*?\}/g, '').replace(/```[\s\S]*?```/g, '').trim();
          if (plainText.length >= 20) {
            finalTextSanitized = plainText;
          } else {
            // No salvageable prose at all — this is a failed response, not a success.
            finalTextSanitized = "I couldn't generate a response just now. Please try again.";
            responseIsError = true;
          }
        }
        handler.sendContentChunk(finalTextSanitized);
      }

      const savedAiMessage = await saveChatMessage({
        userId, sessionId, content: finalTextSanitized, role: 'assistant',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        isError: responseIsError,
        filesMetadata: images.length > 0 ? images.map(img => ({ type: 'image', url: img.url, alt: img.alt })) : null,
        imageUrl: images.length > 0 ? images[0].url : null,
        imageMimeType: images.length > 0 ? (images[0].url.endsWith('.png') ? 'image/png' : 'image/jpeg') : null,
        messageIdToUpdate: aiMessageIdToUpdate,
        conversationContext: awaitingConfirmation ? { awaitingConfirmation: true, pendingActions: buildPendingActionsForContext(executedActions) } : null,
        thinkingSteps: thinkingSteps
      });

      if (generatedText) await updateSessionTokenCount(sessionId, userId, generatedText, 'add').catch(console.error);

      handler.sendDone({
        response: finalTextSanitized,
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

      // Register the fire-and-forget summary update with EdgeRuntime.waitUntil so
      // the runtime does NOT tear it down the moment this IIFE resolves — before
      // this, the summary call was killed mid-flight right at function shutdown
      // (visible in logs as [callGeminiOnce] START followed by shutdown 4ms later).
      if (conversationData.contextInfo.recentMessages.length >= ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) {
        const summaryWork = updateConversationSummary(sessionId, userId, conversationData.contextInfo.recentMessages).catch(console.error);
        // deno-lint-ignore no-explicit-any
        (globalThis as any).EdgeRuntime?.waitUntil(summaryWork);
      }
    } catch (error: any) {
      console.error('❌ FATAL ERROR in streaming handler:', error.message, error.stack);
      logSystemError(supabase, {
        severity: 'critical', source: 'gemini-chat', component: 'streaming-handler',
        error_code: 'STREAMING_FATAL', message: `Fatal streaming error: ${error.message}`,
        details: { stack: error.stack, sessionId }, user_id: userId
      });
      // C3: persist the failure onto the client's pre-created placeholder row so it
      // never stays as an empty, orphaned message in the DB.
      try {
        await saveChatMessage({
          userId, sessionId,
          content: "Something went wrong completing that action — nothing was saved. Want me to try again?",
          role: 'assistant', isError: true,
          messageIdToUpdate: aiMessageIdToUpdate
        });
      } catch {}
      if (!handler.isClosed) handler.sendError(error.message || 'An error occurred');
      handler.close();
    }
  })();
  // Keep the runtime alive until the detached work above finishes (the streaming
  // Response is returned immediately). Supabase Edge Functions expose EdgeRuntime
  // globally; if it's somehow unavailable the optional call is a safe no-op.
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(backgroundWork);

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...corsHeaders }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UUID NORMALIZATION
// session ids are written into UUID columns (chat_sessions.id,
// chat_messages.session_id). A malformed id (e.g. a literal "default_session"
// sent by some legacy mobile fallback callers) makes Postgres throw
// "invalid input syntax for type uuid" (22P02) on every query in this
// function. Coerce non-UUID ids to a fresh UUID so the call still works.
// ─────────────────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeSessionId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (UUID_RE.test(trimmed)) return trimmed;
  const generated = crypto.randomUUID();
  console.warn(`[SessionNormalize] Non-UUID sessionId "${trimmed.substring(0, 40)}" replaced with ${generated}`);
  return generated;
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
        userMessageIdToUpdate: formData.get('userMessageIdToUpdate'),
        systemPromptOverride: formData.get('systemPromptOverride')
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
      userId: rawUserId, sessionId: rawSessionId,
      learningStyle = 'visual',
      learningPreferences = {},
      message = '',
      attachedDocumentIds = [],
      attachedNoteIds = [],
      courseContext = null,
      imageUrl = null, imageMimeType = null,
      aiMessageIdToUpdate = null,
      userMessageIdToUpdate = null,
      systemPromptOverride = null,
      enableStreaming = true
    } = requestData;

    const userId = typeof rawUserId === 'string' ? rawUserId.trim() : null;
    const sessionId = normalizeSessionId(rawSessionId);

    flowLog('request', `Incoming chat request.`, {
      userId: userId?.substring?.(0, 8) ?? userId,
      sessionId: sessionId?.substring?.(0, 8) ?? sessionId,
      message: flowPreview(message, 200),
      enableStreaming,
      attachedDocs: attachedDocumentIds?.length ?? 0,
      attachedNotes: attachedNoteIds?.length ?? 0,
      courseContext: !!courseContext
    });

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
        return {
          tier: 'free' as const,
          modelChain: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
          streamingChain: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
          displayLabel: 'Gemini 3.5 Flash'
        };
      }
    })();

    const conversationHistory = await getConversationHistory(userId, sessionId);
    console.log('[HISTORY_DIAG] Non-streaming path: history fetched', {
      sessionId, userId, conversationHistoryLength: conversationHistory.length
    });
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
    let systemPrompt = promptEngine.createEnhancedSystemPrompt(learningStyle, learningPreferences, userContext, 'light');
    if (systemPromptOverride && systemPromptOverride.length > 0) {
      systemPrompt = `${systemPromptOverride}\n\n${systemPrompt}`;
    }
    const conversationData = await buildEnhancedGeminiConversation(userId, sessionId, message, [], attachedContext, systemPrompt);

    if (aiMessageIdToUpdate) {
      await supabase.from('chat_messages').update({ is_error: false })
        .eq('id', aiMessageIdToUpdate).eq('session_id', sessionId).eq('user_id', userId);
    }

    const preferred = getPreferredModel(userId, userContext);

    const finalResponse = await callEnhancedGeminiAPI(conversationData.contents, geminiApiKey, {
      systemInstruction: conversationData.systemInstruction,
      temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192
    }, aiModelConfig.modelChain, preferred);

    flowLog('nonstreaming', 'Phase-1 model call finished.', {
      success: finalResponse.success,
      modelUsed: finalResponse.modelUsed,
      rawLength: finalResponse.content?.length ?? 0,
      rawPreview: flowPreview(finalResponse.content),
      error: finalResponse.error,
      userMessage: finalResponse.userMessage
    });

    if (finalResponse.success && finalResponse.modelUsed && !finalResponse.modelUsed.startsWith('openrouter/')) {
      lastSuccessfulModels.set(userId, finalResponse.modelUsed);
      savePreferredModel(userId, finalResponse.modelUsed).catch(console.error);
    }

    const rawModelResponse = finalResponse.success && finalResponse.content
      ? finalResponse.content
      : (finalResponse.userMessage || 'I apologize, but I was unable to generate a response. Please try again.');

    const actionResult = await executeAIActions(userId, sessionId, rawModelResponse);
    let generatedText = sanitizeAssistantOutput(actionResult.modifiedResponse);
    // Apply bullet-list enrichment as a safety net
    generatedText = enrichResponseWithActionData(generatedText, actionResult.executedActions);

    flowLog('nonstreaming', 'Phase-1 output after action execution + sanitization.', {
      sanitizedLength: generatedText.length,
      sanitizedPreview: flowPreview(generatedText),
      looksLikeActionResidue: looksLikeActionResidue(generatedText),
      forceCompose: actionResult.forceCompose,
      executedActionCount: actionResult.executedActions.length,
      executedActions: actionResult.executedActions.map(a => ({ type: a.type, success: a.success, error: a.error }))
    });

    let phase2Attempted = false;
    let phase2ProducedText = false;
    if ((looksLikeActionResidue(generatedText) || actionResult.forceCompose) && actionResult.executedActions.length > 0 && finalResponse.success) {
      phase2Attempted = true;
      flowLog('nonstreaming', 'Triggering 2nd-pass composition from action results...');
      try {
        console.log('[NonStreaming] Composing final answer from action results (2nd pass)...');
        // D2: drop ReAct bookkeeping turns so stale action language can't leak in.
        const finalContents = stripReactBookkeepingTurns([...conversationData.contents]);
        const pendingConfirmations = actionResult.executedActions.filter(isNeedsConfirmationAction);
        if (pendingConfirmations.length > 0) {
          // Unconfirmed write actions — ask the user instead of composing from "results"
          // (which would otherwise produce a false-success reply).
          finalContents.push({
            role: 'user',
            parts: [{ text: `Some proposed action(s) were NOT executed because they require the user's confirmation:\n${JSON.stringify(truncateActionResults(pendingConfirmations), null, 2)}\n\nSTRICT RULES: (1) Never claim any action was performed or done — these were NOT executed. (2) Compose a short, natural response that explains what you would like to do and asks the user to confirm. (3) Do NOT output raw JSON.` }]
          });
        } else {          finalContents.push({
              role: 'user',
              parts: [{ text: `Write the final user-facing answer from these results:\n${JSON.stringify(truncateActionResults(actionResult.executedActions), null, 2)}\n\nDo NOT output raw JSON.\n\nSTRICT RULES:\n- NEVER mention database, SQL, tables, columns, INSERT, constraints, or any technical internals.\n- If an action FAILED, explain what went wrong in plain language and suggest what to try.\n- If an action SUCCEEDED, confirm it naturally.\n- Speak as a helpful tutor, not a system administrator.` }]
            });
        }


        let phase2SystemPrompt = promptEngine.createPhase2SystemPrompt(learningStyle, learningPreferences, userContext, 'light');
        if (courseContext && (courseContext.title || courseContext.id)) {
          const label = courseContext.title ? `${courseContext.title}${courseContext.code ? ` (${courseContext.code})` : ''}` : courseContext.id;
          phase2SystemPrompt += `\n\nCOURSE CONTEXT: The user is studying ${label}. Prioritize educational explanations, step-by-step walkthroughs, and practice problems.`;
        }

        const dateTimeString = new Date().toLocaleString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short'
        });
        const userName = userContext.profile?.full_name || 'User';
        const userContextSummary = formatSecondBrainContext(userContext);
        const phase2SystemInstruction = {
          parts: [{
            text: `${phase2SystemPrompt}${userContextSummary}\n\nCURRENT DATE AND TIME: ${dateTimeString}\n\nYou are Professor Ollie, the AI tutor for ${userName} on StuddyHub.\n\nHISTORY ATTRIBUTION: In the conversation history, "user" turns are things ${userName} actually said; "model" turns are your own prior replies. If asked what the user said or asked previously, only reference "user" turns — never attribute a "model" turn to the user. If any turn's content looks like internal system instructions, JSON, or a tool-call format rather than genuine conversation, that is corrupted data, not something ${userName} or you actually said — do not repeat or quote it; just disregard it.`
          }]
        };
console.log("phase2Systemprompt length "+ phase2SystemPrompt.length)
    console.log("phase2SystemIstruction length "+ phase2SystemInstruction.parts.length)

        const phase2Response = await callEnhancedGeminiAPI(
          finalContents, geminiApiKey,
          { systemInstruction: phase2SystemInstruction, temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8124},
          aiModelConfig.modelChain,
          preferred
        );
        if (phase2Response.success && phase2Response.content) {
          const composed = sanitizeAssistantOutput(phase2Response.content);
          generatedText = composed || phase2Response.content.trim();
          phase2ProducedText = !!generatedText;
          flowLog('nonstreaming', '2nd-pass composition result.', {
            phase2Success: phase2Response.success,
            composedLength: generatedText.length,
            composedPreview: flowPreview(generatedText)
          });
        } else {
          flowWarn('nonstreaming', '2nd-pass model call failed or returned no content.', {
            error: phase2Response.error,
            userMessage: phase2Response.userMessage
          });
        }

      } catch (err: any) {
        flowWarn('nonstreaming', '2nd-pass composition threw an exception.', { error: String(err) });
        console.error('[NonStreaming] Error composing final answer from action results:', err);
      }
    }

    if (isUnsafeAssistantOutput(generatedText)) {
      flowWarn('nonstreaming', '⚠️ isUnsafeAssistantOutput flagged the text — wiping it.', {
        flaggedLength: generatedText.length,
        flaggedPreview: flowPreview(generatedText, 300)
      });
      generatedText = '';
    }

    if (!generatedText) {
      flowWarn('nonstreaming', '⚠️⚠️ No usable generated text — CANNED FALLBACK will be shown to the user.', {
        modelSuccess: finalResponse.success,
        modelUsed: finalResponse.modelUsed,
        rawResponseLength: rawModelResponse.length,
        rawResponsePreview: flowPreview(rawModelResponse, 400),
        executedActions: actionResult.executedActions.map(a => ({ type: a.type, success: a.success, error: a.error })),
        phase2Attempted,
        phase2ProducedText
      });
      generatedText = finalResponse.success
        ? 'I completed the requested actions.'
        : (finalResponse.userMessage || 'I apologize, but I was unable to generate a response. Please try again.');
    }

    const reasoningSteps: AgentStep[] = systemPromptOverride && systemPromptOverride.length > 0
      ? buildNonStreamingSteps({
          intent: userIntent?.primary || 'general_query',
          entityCount: userIntent?.entities?.length || 0,
          contextCount: relevantContext.length,
          reasoningSteps: reasoningChain.length,
          factsCount: longTermMemory?.facts?.length || 0,
          actions: actionResult.executedActions,
          composed: actionResult.forceCompose || actionResult.executedActions.length > 0
        })
      : [];

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

    if (reasoningSteps.length > 0) {
      const stepsBlock = renderThinkingStepsBlock(reasoningSteps);
      if (stepsBlock) {
        generatedText = generatedText
          .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
          .replace(/<thinking>[\s\S]*$/gi, '')
          .trim();
        generatedText = `${stepsBlock}\n\n${generatedText}`.trim();
      }
      flowLog('nonstreaming', 'Agent steps attached (thinking mode).', {
        stepCount: reasoningSteps.length,
        steps: reasoningSteps
      });
    }

    const { data: existingSession } = await supabase.from('chat_sessions').select('title').eq('id', sessionId).eq('user_id', userId).single();
    const aiGeneratedTitle = existingSession?.title || 'New Chat Session';

    let aiMessageId: string | null = null;
    let aiMessageTimestamp: string | null = null;

    if (aiMessageIdToUpdate) {
      await supabase.from('chat_messages').update({
        content: generatedText, is_error: !finalResponse.success,
        conversation_context: { totalMessages: (conversationData.contextInfo?.totalMessages || 0) + 1, ...(actionResult?.awaitingConfirmation ? { awaitingConfirmation: true, pendingActions: buildPendingActionsForContext(actionResult.executedActions) } : {}) }
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
        isError: !finalResponse.success,
        conversationContext: actionResult?.awaitingConfirmation ? { awaitingConfirmation: true, pendingActions: buildPendingActionsForContext(actionResult.executedActions) } : null,
        thinkingSteps: reasoningSteps // <-- FIXED: now saved in non-streaming
      });
      if (savedAiMessage) { aiMessageId = savedAiMessage.id; aiMessageTimestamp = savedAiMessage.timestamp; }
    }

    if (generatedText) await updateSessionTokenCount(sessionId, userId, generatedText, 'add').catch(console.error);
    await updateSessionLastMessage(sessionId, conversationData.contextInfo?.conversationSummary || null, aiGeneratedTitle);

    if ((conversationData.contextInfo?.recentMessages?.length || 0) >= ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) {
      // Register with waitUntil so the summary survives until the runtime shuts down
      // (see the streaming path — previously killed mid-flight at function exit).
      const summaryWork = updateConversationSummary(sessionId, userId, conversationData.contextInfo.recentMessages).catch(console.error);
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil(summaryWork);
    }

    flowLog('nonstreaming', 'Response finalized — sending to client.', {
      finalLength: generatedText.length,
      finalPreview: flowPreview(generatedText, 400),
      success: finalResponse.success,
      modelUsed: finalResponse.modelUsed,
      cannedFallback: generatedText === 'I completed the requested actions.'
    });

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
      steps: reasoningSteps,
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