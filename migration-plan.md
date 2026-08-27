# Migration Plan: Regex Action-Gate → Native Gemini Function Calling

**Target codebase:** `gemini-chat-build` (index.ts, agentic-core.ts, actions-service.ts, context-service.ts, prompt-engine.ts, sanitize.ts, streaming-handler.ts)
**Goal:** Replace the hand-written regex intent/action gate with Gemini's native function-calling, so tool use is decided by the model reasoning over a real tool schema instead of pattern matching on phrasing.
**How to use this doc:** Feed each phase to your OpenCode agent as a separate task. Each phase is scoped to compile/deploy independently, so you can ship incrementally and roll back a single phase if something breaks.

---

## 0. Diagnosis recap (why we're doing this)

Three places currently decide "should a tool run," and they don't agree with each other:

| Layer             | File                                        | Logic                                                                                                               |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Intent classifier | `agentic-core.ts` → `classifyIntent()`      | Regex → labels like `information_retrieval`, `content_creation`                                                     |
| Action flag       | `agentic-core.ts` → `detectsAction()`       | Regex on `create\|make\|add\|delete\|remove\|update\|change\|schedule\|plan\|generate` — **no search/lookup verbs** |
| Action gate       | `index.ts` → `shouldTriggerActionPlanner()` | Separate regex, checks `intent.primary`, `intent.requiresAction`, plus its own `explicitActionPattern`              |

A phrase that isn't anticipated by all three (e.g. "web search" instead of "search the web") silently falls through to `conversational_or_tutoring` and the ReAct planner (and therefore `actions-service.ts` — including the already-implemented `searchWeb()`, `executeDbAction()`, `fetchAndSaveWebResource()`, etc.) never runs.

The fix isn't "better regex" — regex will always have a next edge case. The fix is to stop pre-deciding with string matching and let the model decide, the way Claude/OpenAI/Gemini tool-use is designed to work: **the full tool list is given to the model every turn, and the model emits a structured function call when it judges one is warranted.**

---

## 1. Target architecture

### Before (current)

```
user message
  → understandQuery() [regex intent/entity/action classification]
  → shouldTriggerActionPlanner() [regex gate]
       ├─ false → plain Gemini text completion (no tools available at all)
       └─ true  → ReAct planner loop (free-text JSON action plan,
                   parsed by parsePlannerResponseRobust(),
                   executed via actions-service.ts)
```

### After (target)

```
user message
  → build tool schema (once, static — see §3)
  → single Gemini call with `tools: [...]` attached, EVERY turn
       ├─ model returns plain text            → stream to user, done
       └─ model returns one or more functionCall parts
              → run lightweight confirmation policy (see §4)
                    ├─ needs confirmation → sendConfirmationRequired(), pause
                    └─ auto-approved      → execute via actions-service.ts,
                                             feed functionResponse back to
                                             Gemini, loop until model
                                             returns plain text (max N turns)
```

Key differences:

- No `classifyIntent`/`detectsAction`/`shouldTriggerActionPlanner` regex layer deciding _whether_ tools are visible. Tools are **always** visible; the model decides whether to use them.
- The ReAct free-text JSON planner (parsed by regex/JSON-repair in `parsePlannerResponseRobust`) is replaced by Gemini's native `functionCall` response part — no more hand-parsing model text to find an action.
- `actions-service.ts` stays almost entirely as-is — it's already a clean set of executable action methods. It becomes the _function implementation layer_ behind the schema instead of the _ReAct step executor_.
- Confirmation-required actions (destructive/high-stakes ones) keep working, but the decision of _which_ actions require confirmation moves to a static config list, not a regex on the user's message.

---

## 2. What gets deleted vs. kept vs. added

**Delete (or stop calling):**

- `agentic-core.ts`: `classifyIntent()`, `detectsAction()` — no longer used to gate tool visibility. (`understandQuery()` can stay for _context retrieval_ ranking if you still want it — see §6 — but strip its action-gating role.)
- `index.ts`: `shouldTriggerActionPlanner()`, `explicitActionPattern`, the affirmation-phrase regex block.
- `index.ts`: `parsePlannerResponseRobust()` and any ReAct step-loop code that parses free-text JSON action plans out of model output.

**Keep as-is:**

- `actions-service.ts` — every method (`executeDbAction`, `searchWeb`, `fetchAndSaveWebResource`, `createCourse`, `getReferralCode`, etc.) becomes a function-call target. No business logic changes needed.
- `sanitize.ts`, `context-service.ts`, `prompt-engine.ts` — unchanged; system prompt still gets built the same way, just without needing to also explain "how to format a DB_ACTION JSON block" (the model does this natively now via schema-typed args).
- `streaming-handler.ts` — unchanged; `sendConfirmationRequired`/`sendConfirmationBatchRequired`/`sendThinkingStep` events map naturally onto function-call turns.

**Add:**

- `tool-schemas.ts` — static declaration of every callable tool (§3).
- `tool-executor.ts` — thin dispatch table mapping a function name → the matching `actions-service.ts` method (§5).
- `confirmation-policy.ts` — static allow/confirm list replacing the affirmation regex (§4).
- A revised agent loop in `index.ts` (§6) that replaces the ReAct step loop with Gemini's native multi-turn function-calling loop.

---

## 3. Define the tool schema (`tool-schemas.ts`)

This is the single source of truth for "what the model is allowed to do." Every entry needs a name, description, and JSON-schema `parameters` — Gemini uses the description text heavily to decide _when_ to call it, so be specific.

```ts
// tool-schemas.ts
export const TOOL_SCHEMAS = [
  {
    name: "search_web",
    description:
      "Search the public internet for current information not available in the user's own notes/documents. Use this whenever the user asks to search, look up, google, browse, or find something online — regardless of exact phrasing (e.g. 'web search', 'search the web', 'look that up', 'check online').",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        maxResults: {
          type: "integer",
          description: "Max results to return",
          default: 4,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_and_save_web_resource",
    description:
      "Fetch a specific URL the user gave you and save it into their documents.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        title: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "db_action",
    description:
      "Create, update, delete, or query the user's own data (notes, documents, flashcards, quizzes, schedule items, learning goals, class recordings, podcasts). Use for any request to save, remember, schedule, edit, remove, or retrieve the user's stored content.",
    parameters: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description:
            "Logical entity: note, document, flashcard, quiz, schedule_item, goal, class_recording, ai_podcast, user_memory",
        },
        operation: {
          type: "string",
          enum: ["INSERT", "UPDATE", "DELETE", "SELECT"],
        },
        data: { type: "object", description: "Row fields for INSERT/UPDATE" },
        filters: {
          type: "object",
          description: "WHERE-clause-like filters for UPDATE/DELETE/SELECT",
        },
      },
      required: ["table", "operation"],
    },
  },
  {
    name: "create_course",
    description: "Register a new course the user is studying.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
      },
      required: ["code", "title"],
    },
  },
  {
    name: "get_referral_code",
    description: "Look up (or generate if missing) the user's referral code.",
    parameters: { type: "object", properties: {} },
  },
  // Add more entries here as actions-service.ts grows — this list should be
  // a 1:1 mirror of the public methods you want the model to be able to call.
] as const;
```

Give this schema to your OpenCode agent as a task: _"Read actions-service.ts fully and generate one TOOL_SCHEMAS entry per public method, following the pattern above."_ — that guarantees nothing in the existing service gets left unreachable.

---

## 4. Confirmation policy (`confirmation-policy.ts`)

This is what actually replaces your affirmation-regex block (`isAffirmation`, `actionOfferPattern`) — but as a **static classification of tool names**, not a regex on user text.

```ts
// confirmation-policy.ts
// Tools in this set always require an explicit confirmation round-trip
// before executing, regardless of how the model phrases its intent to call them.
export const REQUIRES_CONFIRMATION = new Set([
  "db_action:DELETE", // any delete
  "db_action:UPDATE", // edits to existing data
  "fetch_and_save_web_resource", // writes external content into their docs
  "create_course",
]);

// Tools that are safe to auto-execute without a round trip (read-only / additive)
export const AUTO_APPROVE = new Set([
  "search_web",
  "db_action:SELECT",
  "db_action:INSERT",
  "get_referral_code",
]);

export function needsConfirmation(toolName: string, args: any): boolean {
  const key =
    toolName === "db_action" ? `db_action:${args.operation}` : toolName;
  return REQUIRES_CONFIRMATION.has(key);
}
```

Why this is more robust than the old affirmation regex: confirmation is now decided by **what the model is about to do** (a DELETE, a paid/irreversible write) rather than **how the user phrased the previous message**. The old system had to scan back through chat history looking for an "offer" pattern and match "yes"/"go ahead" against it — that whole mechanism disappears. When Gemini wants to call `db_action` with `operation: "DELETE"`, you pause and ask the user directly ("Delete the note titled X — confirm?"), then on the next turn feed the result back as a `functionResponse` (approved or rejected) — no regex needed to detect "yes" in either language or phrasing.

---

## 5. Tool executor (`tool-executor.ts`)

Thin dispatch layer. This is the _only_ place that touches `actions-service.ts` from the new pipeline.

```ts
// tool-executor.ts
import { StuddyHubActionsService } from "./actions-service.ts";

export async function executeTool(
  toolName: string,
  args: any,
  userId: string,
  actions: StuddyHubActionsService,
): Promise<any> {
  switch (toolName) {
    case "search_web":
      return actions.searchWeb(args.query, args.maxResults ?? 4);
    case "fetch_and_save_web_resource":
      return actions.fetchAndSaveWebResource(userId, args);
    case "db_action":
      return actions.executeDbAction(
        userId,
        args.table,
        args.operation,
        args.data ?? {},
        args.filters ?? {},
      );
    case "create_course":
      return actions.createCourse(userId, args);
    case "get_referral_code":
      return actions.getReferralCode(userId);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
```

---

## 6. The new agent loop (replaces the ReAct step loop in `index.ts`)

This is the core rewrite. Pseudocode — hand this whole section to OpenCode as the implementation spec for the streaming handler section around your current `plannerTriggerCheck` block:

```ts
async function runAgentTurn(
  userId: string,
  sessionId: string,
  message: string,
  systemPrompt: string,
  conversationContents: any[], // existing buildEnhancedGeminiConversation() output
  streamHandler: StreamingHandler,
  actions: StuddyHubActionsService,
) {
  let contents = [...conversationContents];
  const MAX_TOOL_TURNS = 5; // hard cap, replaces "exhausted loop" ReAct guard

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await callGemini({
      systemInstruction: systemPrompt,
      contents,
      tools: [{ functionDeclarations: TOOL_SCHEMAS }],
    });

    const functionCalls = response.candidates[0].content.parts.filter(
      (p) => p.functionCall,
    );

    if (functionCalls.length === 0) {
      // Model chose to respond in plain text — stream it and we're done.
      const text = response.candidates[0].content.parts
        .map((p) => p.text)
        .join("");
      streamHandler.sendContentChunk(text);
      streamHandler.sendDone({ text });
      return;
    }

    // Model wants to call one or more tools.
    const functionResponses = [];
    for (const part of functionCalls) {
      const { name, args } = part.functionCall;

      if (needsConfirmation(name, args)) {
        streamHandler.sendConfirmationRequired({ toolName: name, args });
        return; // pause the whole turn — resume next user message with the
        // approval, which becomes a functionResponse with the result
      }

      streamHandler.sendThinkingStep(
        "action",
        `Running ${name}`,
        JSON.stringify(args),
        "in-progress",
      );
      const result = await executeTool(name, args, userId, actions);
      streamHandler.sendThinkingStep(
        "action",
        `Ran ${name}`,
        JSON.stringify(result),
        "completed",
      );

      functionResponses.push({
        functionResponse: { name, response: result },
      });
    }

    // Feed results back to Gemini and loop — this is what lets the model
    // chain multiple tool calls (e.g. search_web then db_action to save notes)
    // without you hand-writing a ReAct step planner.
    contents.push({ role: "model", parts: functionCalls });
    contents.push({ role: "user", parts: functionResponses });
  }

  streamHandler.sendError(
    "Tool loop exceeded max turns without a final answer.",
  );
}
```

Notes for whoever (OpenCode) implements this against your real `callEnhancedGeminiAPIStream`:

- Your existing model-chain fallback logic (`gemini-3.6-flash` → `gemini-3.5-flash`) can wrap the `callGemini(...)` call unchanged — function calling is orthogonal to model fallback.
- Streaming + function calling together means you'll get partial text chunks _and_ function call parts in the same response stream — buffer until the part is complete before deciding it's a `functionCall` vs `text`, same as your current `[PARSED_SUCCESS]` accumulation logic already does.
- The confirmation pause-and-resume needs the pending `functionCall` (name + args) persisted somewhere retrievable next turn — you already have a ledger concept (`buildConfirmationContext`, `isAwaitingConfirmationReply`); repoint it to store `{name, args}` instead of a parsed free-text action.

---

## 7. Migration phases (feed each to OpenCode as its own task)

**Phase 1 — Schema extraction (no behavior change yet)**

- Read `actions-service.ts` end to end, generate `tool-schemas.ts` with one entry per public method.
- Deploy behind a feature flag, unused. Confirms the schema compiles and matches Gemini's function-declaration format.

**Phase 2 — Parallel-run the new loop, don't cut over**

- Implement `tool-executor.ts` and the new agent loop from §6 as a _new_ code path, gated by an env var (`USE_NATIVE_FUNCTION_CALLING=true`).
- Log both the old gate's decision (`ACTION_GATE`) and what the new loop _would have_ done, side by side, without acting on the new one yet. This gives you a diff log to sanity-check before cutover — specifically re-run your two failing log examples ("can you do a web search", "search the documents again") and confirm the new loop calls `search_web`/`db_action` where the old one said `conversational_or_tutoring`.

**Phase 3 — Cutover for read-only/auto-approved tools first**

- Flip `USE_NATIVE_FUNCTION_CALLING=true` for `search_web`, `db_action:SELECT`, `get_referral_code` only (lowest risk — nothing destructive).
- Leave writes/deletes still routed through the old ReAct+regex path temporarily.

**Phase 4 — Cutover confirmation-gated tools**

- Wire `confirmation-policy.ts` and the pause/resume flow (§6) fully.
- Cut `db_action:INSERT/UPDATE/DELETE`, `fetch_and_save_web_resource`, `create_course` over.
- Test the full confirm → approve → execute → functionResponse loop manually for at least one delete and one update.

**Phase 5 — Delete the old gate**

- Remove `shouldTriggerActionPlanner`, `explicitActionPattern`, the affirmation regex, `parsePlannerResponseRobust`, and the now-unused parts of `classifyIntent`/`detectsAction` in `agentic-core.ts`.
- Keep `understandQuery()` only if you still want it for context-retrieval ranking (`retrieveRelevantContext`) — just strip the `requiresAction` field and its callers.

**Phase 6 — Regression pass**

- Re-run every phrasing variant from your logs plus adversarial paraphrases ("pull something up from the internet", "can u check online for me", "delete that note yesterday", "no wait undo that") and confirm the model — not a regex — is making the right call every time.

---

## 8. What to hand OpenCode, task by task

Copy these as separate prompts/tasks in your OpenCode session, in order:

1. _"Read `/actions-service.ts` fully and generate `tool-schemas.ts` with one Gemini function-declaration entry per public async method, following the style in this reference file: [paste §3]. Include the ones already sketched, and add any I missed."_
2. _"Create `tool-executor.ts` that dispatches a function name + args to the matching `actions-service.ts` method, per the pattern in [paste §5]."_
3. _"Create `confirmation-policy.ts` per [paste §4], and inspect `actions-service.ts` for any other DELETE/UPDATE-style or externally-writing methods I should add to `REQUIRES_CONFIRMATION`."_
4. _"In `index.ts`, replace the block that builds `plannerTriggerCheck` and the ReAct step loop with the agent loop in [paste §6], wired to `callEnhancedGeminiAPIStream`, `tool-schemas.ts`, `tool-executor.ts`, and `confirmation-policy.ts`. Keep `streaming-handler.ts` events unchanged — map function-call turns onto `sendThinkingStep('action', ...)` and confirmation pauses onto `sendConfirmationRequired`."_
5. _"Add an env-flag gate (`USE_NATIVE_FUNCTION_CALLING`) so the old and new code paths can run side by side per Phase 2, logging both decisions without double-executing."_
6. _"Once I've validated Phase 2 logs, remove `shouldTriggerActionPlanner`, `explicitActionPattern`, the affirmation regex block, and `parsePlannerResponseRobust` from `index.ts`, and strip `detectsAction`/the action-gating parts of `classifyIntent` from `agentic-core.ts`."_

---

## 9. Rollback plan

Because Phases 2–4 are flag-gated, rollback at any point is just flipping `USE_NATIVE_FUNCTION_CALLING` back to `false` — the old regex path stays intact and untouched until Phase 5, which is the only irreversible step. Don't run Phase 5 until you've had the new path live in production for at least a few days of real traffic with no confirmation-flow regressions.
