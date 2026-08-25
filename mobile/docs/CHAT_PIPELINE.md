# AI Tutor Pipeline (`gemini-chat`)

`supabase/functions/gemini-chat/` is the AI tutor. It's not a single "prompt → answer" call — it's a multi-phase **agentic pipeline**:

```
user message
   │
   ▼
① Understanding  ── intent classification + entity extraction + ambiguity/confirmation detection
   │
   ▼
② Retrieval      ── semantic search across the user's notes/documents/sessions/schedule (vector-lite scoring)
   │
   ▼
③ ReAct planner  ── a Gemini call that decides whether DB actions are needed (action_needed / DB_ACTION…)
   │
   ▼
④ Execution      ── tool actions run against Supabase (SELECT/INSERT/UPDATE/DELETE)
   │
   ▼
⑤ Confirmation?  ── if an action needs user sign-off, the pipeline stops and asks (awaitingConfirmation)
   │
   ▼
⑥ Phase 2 (Final Response) ── a fresh Gemini call with full context + action results → streamed answer
```

Files: `index.ts` (orchestrator + HTTP/SSE), `agentic-core.ts` (understanding/retrieval/memory), `actions_service.ts` + `actions_helper.ts` (tool execution), `context-service.ts` (context building), `prompt-engine.ts` (system prompts), `streaming-handler.ts` (SSE), `sanitize.ts`, `db_schema.ts` (schema snapshot for the planner).

## ① Understanding (`agenticCore.understandQuery`)

- Multi-label **intent classification** (e.g. `general_query`, `content_analysis`, `creation`, `retrieval`, `modification`, `planning`, `study_assistance`).
- **Entity extraction** — resolves references to notes, documents, quizzes, schedules, goals, topics, dates (title matching).
- **Ambiguity detection** — flags pronoun-heavy requests with no resolvable entity so the system asks for clarification.
- **Confirmation awareness** — if the previous assistant turn left `awaitingConfirmation`, the pipeline short-circuits to validate the user's yes/no instead of re-planning.

## ② Retrieval (`agenticCore.retrieveRelevantContext`)

- Entity-based (exact content fetch), topic-based (semantic search across content), temporal (date ranges), and cross-session retrieval.
- Results ranked by a hybrid score: relevance 60% + recency 30% + intent match 10%.
- The mobile client also sends **attached** note/document IDs directly; those are fetched regardless of the search.

## ③ ReAct planner

- Runs **unconditionally** each turn (a design choice: `Planner will run unconditionally this turn`), with a compacted context (slim context builder, last 20 messages) plus the DB schema snapshot.
- Returns JSON like `{ "thought_process": "...", "action_needed": false }` or `DB_ACTION`s (`SELECT notes`, `INSERT …`, etc.).
- Has an iteration budget — if it keeps signaling actions, the loop terminates and forces full-context Phase 2.
- Prompt guardrails (`index.ts` ~L2210): never re-query the same table with narrower filters "to be safe", don't invent speculative category filters, always fetch data Phase 2 needs, and hand over the planner's diagnostics/assumptions for Phase 2 to use.

## ④ Execution (`executeAIActions`)

- Parses `DB_ACTION` blocks from the planner response (pipe parser with a JSON fallback), executes them against Supabase with the service role, and records success/failure per action.
- Results are summarized and truncated before being handed to Phase 2 (so huge SELECTs don't blow the token budget).

## ⑤ Confirmation gating

- Mutating/irreversible actions return `awaitingConfirmation: true` with the pending action payload.
- The stream emits a confirmation prompt; the next user turn goes through a lighter path (`isAwaitingConfirmationReply`) that only validates yes/no.
- The user's yes → executes the pending actions and generates the final response; no → drops them.

## ⑥ Phase 2 — Final Response

- Builds the full conversation (`buildEnhancedGeminiConversation`) — working memory, recent history, retrieved context, action results, system prompt.
- Model order (reordered 2026-08-13 so a healthy Gemini isn't blocked behind dead fallbacks):
  1. **`callEnhancedGeminiAPIStream`** — Gemini first (the planner already proved the key works this session).
  2. **`callOpenAIStyleFallback`** — xAI → Groq → SambaNova → HuggingFace → OpenRouter, only if Gemini failed.
  3. Non-streaming Gemini path as a last resort.
- Successful models are remembered per user (`lastSuccessfulModels`, `savePreferredModel`) and used as the first choice next turn; exhausted/quota models are cooldown-marked and skipped.
- Response is **streamed** over SSE (chunks + `thinking_steps` events) and saved to `chat_messages` with `thinking_steps` persisted separately (so the mobile Reasoning Process panel replays from history without polluting content).

## Provider fallback chain

```
Gemini (primary, streaming)
  └─ xAI (grok-3 / grok-3-mini)
       └─ Groq (gpt-oss-120b/20b, llama-3.3-70b, qwen3.6-27b, compound, llama-3.1-8b)
            └─ SambaNova (Meta-Llama-3.3-70B, DeepSeek-V3.1, gpt-oss-120b)
                 └─ HuggingFace (Qwen2.5-7B, Qwen2.5-Coder-32B, Llama-3.3-70B, DeepSeek-R1)
                      └─ OpenRouter (nemotron, gemma-4, ling, etc.)
```

Each backend failure is classified (402 = no credits, 403 = permission, 429 = rate limit, 413 = too large) and the model is cooldown-marked so subsequent turns skip it. **Operational note:** several of these fallback keys are currently unfunded (xAI team has no credits, SambaNova needs a payment method, HuggingFace monthly credits depleted) — Gemini is effectively the primary; fund one of the fallbacks for genuine redundancy.

## Streaming protocol (mobile client)

SSE events include: `thinking_step` (reasoning-process steps), `content`/token deltas, and terminal events. The mobile app (`AIChatViewModel`) throttles token updates (~50 ms) and renders plain-text paragraphs during streaming, swapping to full rich markdown once persisted.

## Configuration

- `ENHANCED_PROCESSING_CONFIG` (in `index.ts`) controls max history, token budgets, iteration limits.
- Per-user AI tier/model chain comes from `createSubscriptionValidator()` (`utils/subscription-validator.ts`) — free tier uses a Gemini Flash chain.
- `AGENTIC_SYSTEM_README.md` (in the function folder) documents the intent/retrieval/memory design in more depth.
