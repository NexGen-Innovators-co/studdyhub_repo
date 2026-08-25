// sanitize.ts — Pure output-sanitization + ReAct-step helpers for the gemini-chat
// edge function. Kept dependency-free (no Deno / Supabase imports) so the
// regression tests in regression-tests.ts can import it directly under Node or
// Deno, and so index.ts can share one canonical implementation.

export interface BatchInfo {
  batch_number: number;
  has_more: boolean;
  total_batches?: number;
  remaining?: string;
}

export interface ReActStep {
  thought?: string;
  actions?: any[];
  finalResponse?: string;   // legacy field, parsed for back-compat but NEVER shown to the user
  actionNeeded?: boolean;   // preferred signal: false = no DB action required
  skills_needed?: any[];
  batch_info?: BatchInfo;
  // B2: the planner's final diagnostic statement before breaking the loop.
  lastDiagnosis?: string;
  // B4: assumptions the planner made that MUST be surfaced to the user as defaults.
  assumptions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZE ASSISTANT OUTPUT
// ─────────────────────────────────────────────────────────────────────────────
export const INTERNAL_PROMPT_LEAK_SIGNATURES = [
  'YOU ARE IN: REACT LOOP MODE',
  'SUPPORTED ACTIONS ONLY: DB_ACTION',
  'DATABASE SCHEMA:',
  'Respond with either actions or finalResponse',
  'CRITICAL INSTRUCTION: Respond strictly in direct, conversational natural language',
  // A1: the raw planner JSON leak { "action_needed": false } must never survive.
  '"action_needed"'
];

export function containsInternalPromptLeak(text: string | null | undefined): boolean {
  if (!text) return false;
  return INTERNAL_PROMPT_LEAK_SIGNATURES.some(sig => text.includes(sig));
}

export function sanitizeAssistantOutput(text: string | null | undefined): string {
  if (!text) return '';
  let out = text;

  // 1. Block internal prompt leaks
  if (containsInternalPromptLeak(out)) {
    console.warn('[HISTORY_DIAG] BLOCKED a response that leaked internal system-prompt text.');
    return '';
  }

  // 2. Remove all <thinking> tags and other known artifacts
  out = out.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  out = out.replace(/<!--\s*thinking[\s\S]*?-->/gi, '');

  // 3. Remove raw DB_ACTION plain-text command blocks (e.g. DB_ACTION: INSERT \n TABLE: notes ...)
  out = out.replace(/DB_ACTION:\s*(?:INSERT|UPDATE|DELETE|SELECT)[\s\S]*?(?=(?:\n\s*\n\s*[A-Z#*]|$))/gi, '');
  out = out.replace(/TABLE:\s*[a-z0-9_]+\s*\n\s*DATA:\s*\{[\s\S]*?\}/gi, '');

  // 4. Remove JSON blocks that look like action plans or finalResponse objects
  out = removeActionJsonBlocks(out);

  // 4. Clean up extra whitespace and empty braces/arrays
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  out = out.replace(/\(\s*\)/g, '');
  out = out.replace(/\[\s*\]/g, '');

  // 5. P1-1: wipe truncated JSON fragments — unbalanced closing braces with
  // residue tokens (e.g. `",\n "filters": ... }]}`) that survive the balanced-
  // block removal above and would otherwise leak into the visible answer.
  const opens = (out.match(/[\{\[]/g) || []).length;
  const closes = (out.match(/[\}\]]/g) || []).length;
  if (closes > opens) {
    const RESIDUE_TOKENS = ['"filters"', '"params"', '"operation"', '"table"', '"limit"', '"order_by"', '"select_fields"', '"proposedData"', '"possibleDuplicates"', '"needsConfirmation"', '"requestOrigin"', '"actions"', '"thought_process"', '"action_needed"', '"batch_info"', '"values"', '"columns"', '"query"', '"confirmed"'];
    if (RESIDUE_TOKENS.some(t => out.includes(t)) || /^[\s,:{}\[\]]/.test(out)) {
      console.warn('[HISTORY_DIAG] WIPED truncated JSON fragment from output.');
      return '';
    }
  }

  // 5. If only punctuation/braces remain, return empty
  if (/^\s*[{}\[\],:"'\s]*$/.test(out)) return '';

  return out;
}

/**
 * Removes any JSON object or array that contains action-related keys.
 * Uses a stack to correctly match balanced braces, even with nested structures.
 */
export function removeActionJsonBlocks(text: string): string {
  const result: string[] = [];
  let i = 0;
  const len = text.length;

  const isActionJson = (str: string): boolean => {
    // Try to parse the substring as JSON
    try {
      const parsed = JSON.parse(str);
      // Check if it's an object with actions, or an array of actions,
      // or contains a type field with DB_ACTION/GENERATE_IMAGE/ENGAGE_SOCIAL
      if (Array.isArray(parsed)) {
        return parsed.some(item => item.type && ['DB_ACTION', 'GENERATE_IMAGE', 'ENGAGE_SOCIAL'].includes(item.type));
      }
      if (typeof parsed === 'object' && parsed !== null) {
        if (parsed.actions && Array.isArray(parsed.actions)) return true;
        if (parsed.type && ['DB_ACTION', 'GENERATE_IMAGE', 'ENGAGE_SOCIAL'].includes(parsed.type)) return true;
        if (parsed.finalResponse) return true; // might be the JSON with finalResponse
        // A1: the "no action needed" planner signal is internal planner JSON too —
        // it must never leak into the visible answer as literal JSON.
        if (typeof parsed.action_needed === 'boolean') return true;
        // Check for any nested action objects
        const jsonStr = JSON.stringify(parsed);
        return /"type"\s*:\s*"(?:DB_ACTION|GENERATE_IMAGE|ENGAGE_SOCIAL)"/.test(jsonStr);
      }
    } catch (_) {
      // Not valid JSON
    }
    return false;
  };

  while (i < len) {
    // Look for the start of a JSON object or array
    if (text[i] === '{' || text[i] === '[') {
      const start = i;
      const openChar = text[i];
      const closeChar = openChar === '{' ? '}' : ']';
      let depth = 1;
      let inString = false;
      let escape = false;
      let j = i + 1;
      while (j < len && depth > 0) {
        const ch = text[j];
        if (!inString) {
          if (ch === '{' || ch === '[') depth++;
          else if (ch === '}' || ch === ']') depth--;
        }
        // Handle string literals to avoid false matches
        if (ch === '"' && !escape) {
          inString = !inString;
        }
        if (ch === '\\' && !escape) {
          escape = true;
        } else {
          escape = false;
        }
        j++;
      }
      if (depth === 0) {
        // We found a balanced JSON block
        const block = text.substring(start, j);
        if (isActionJson(block)) {
          // Skip this block entirely
          i = j;
          continue;
        } else {
          // Not an action block, keep it and continue
          result.push(text[i]);
          i++;
          continue;
        }
      } else {
        // Malformed; push the character and continue
        result.push(text[i]);
        i++;
        continue;
      }
    } else {
      result.push(text[i]);
      i++;
    }
  }

  return result.join('');
}

export function looksLikeActionResidue(text: string): boolean {
  if (!text || !text.trim()) return true;
  if (/^[\s,:{}\[\]]/.test(text)) return true;
  const lower = text.trim().toLowerCase();
  const indicators = [
    '"order_by"', '"select_fields"', '"filters"', '"limit"', '"query"', '"columns"',
    '"values"', '"operation"', '"table"', '"params"', '"select"', '"field"', '"direction"',
    '"total_questions"', '"xp_earned"', '"time_taken_seconds"', '"quiz_id"', '"percentage"', '"score"'
  ];
  if (indicators.some(i => lower.includes(i))) return true;
  const opens = (text.match(/[\{\[]/g) || []).length;
  const closes = (text.match(/[\}\]]/g) || []).length;
  return opens !== closes;
}

export function isUnsafeAssistantOutput(text: string): boolean {
  if (!text || !text.trim()) return true;
  if (/^[,:}\]]/.test(text)) return true;
  const opens = (text.match(/[\{\[]/g) || []).length;
  const closes = (text.match(/[\}\]]/g) || []).length;
  return opens !== closes;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION-DATA ENRICHMENT (A2)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Enriches a response with bullet-list action data as a SUPPLEMENT to real prose.
 *
 * A2: enrichment is never allowed to constitute the ENTIRE response. If the base
 * [response] is empty/whitespace, it is returned unchanged so callers hit their
 * "empty sanitized output" fallback path (which builds a message from action
 * success/failure counts) instead of silently surfacing a bullet list of raw IDs.
 */
export function enrichResponseWithActionData(response: string, executedActions: any[]): string {
  // A2: empty base → return empty so the caller's empty-output fallback runs.
  if (!response || !response.trim()) return response;

  const selectActions = executedActions.filter(a => a.type === 'DB_ACTION' && a.success && a.data?.data);
  if (selectActions.length === 0) return response;

  let enriched = response;
  for (const action of selectActions) {
    const records = Array.isArray(action.data.data) ? action.data.data : [action.data.data];
    if (records.length === 0) continue;

    // If the response already contains a list (bullet points or numbers), skip.
    if (/[-*•]|\d+\./.test(enriched)) continue;

    // Build a simple bullet list of titles (or first text field)
    const items = records.slice(0, 7).map((r: any) => {
      const title = r.title || r.name || r.goal_text;
      if (title) return `- ${title}`;
      // A2: quiz_attempts have no title/name — render a readable summary from the
      // attempt fields instead of falling back to a raw UUID.
      if (r.answers && r.score !== undefined && r.total_questions !== undefined) {
        return `- Quiz attempt: ${r.score}/${r.total_questions} (${r.percentage ?? '?'}%)`;
      }
      return `- Item ${r.id}`;
    }).join('\n');

    const preview = `\n\nHere are the most relevant items I found:\n${items}\n${records.length > 7 ? `... and ${records.length - 7} more.` : ''}`;
    // Insert before the last sentence or at the end.
    const sentences = enriched.match(/[^.!?]+[.!?]+/g) || [enriched];
    if (sentences.length > 1) {
      // Insert after the first sentence.
      const first = sentences[0];
      const rest = sentences.slice(1).join(' ');
      enriched = `${first}${preview} ${rest}`;
    } else {
      enriched = `${enriched}${preview}`;
    }
  }
  return enriched;
}

// ─────────────────────────────────────────────────────────────────────────────
// REACT STEP PARSING
// ─────────────────────────────────────────────────────────────────────────────
function sanitizePlannerJSON(raw: string): string {
  // Remove duplicate "filters" keys if present (keep the last one)
  // Also, if "filters" contains data fields and "data" is missing, rename "filters" to "data".
  let cleaned = raw;
  // Use a simple regex to find the params object and fix it.
  // Better: parse with a forgiving approach using a custom parser or use a library.
  // For simplicity, we'll use the following:
  // 1. Remove empty "filters": {} if another "filters" exists later.
  cleaned = cleaned.replace(/"filters"\s*:\s*\{\s*\},\s*"filters"\s*:\s*\{/g, '"filters": {');
  // 2. If "data" is missing but "filters" has a user_id, title, etc., rename "filters" to "data".
  // But that's tricky. Instead, in the executor we can detect.
  return cleaned;
}

export function extractAndParseJSON(rawContent: string): any {
  let text = rawContent.trim();
  text = sanitizePlannerJSON(text);

  // Remove markdown code fences and <thinking> tags
  text = text.replace(/```(?:json|action)?\s*/gi, '').replace(/```\s*$/g, '').trim();
  text = text.replace(/<(?:thinking|thought)>[\s\S]*?<\/(?:thinking|thought)>/gi, '').trim();

  // 1. Try to parse the whole cleaned text
  try {
    return JSON.parse(text);
  } catch (_) {}

  // 2. Fallback: extract a JSON object using a stack‑based approach (supports nesting)
  const stack: string[] = [];
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      if (start === -1) start = i;
      stack.push(ch);
    } else if (ch === '}' || ch === ']') {
      if (stack.length === 0) continue;
      const last = stack[stack.length - 1];
      if ((ch === '}' && last === '{') || (ch === ']' && last === '[')) {
        stack.pop();
        if (stack.length === 0) {
          const candidate = text.substring(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch (_) {}
          start = -1;
        }
      }
    }
  }

  // 3. Final attempt: parse the whole text (might work after cleaning)
  try {
    return JSON.parse(text);
  } catch (_) {}

  return null;
}

export function interpretParsedReActStep(parsed: any): ReActStep {
  const step: ReActStep = {};
  if (Array.isArray(parsed)) return { actions: parsed };
  if (parsed?.thought || parsed?.thought_process) step.thought = parsed.thought || parsed.thought_process;
  if (Array.isArray(parsed?.actions)) step.actions = parsed.actions;
  // Legacy field — parsed only so old-format responses don't error out.
  // Its CONTENT is intentionally never used as the user-facing answer.
  if (typeof parsed?.finalResponse === 'string') step.finalResponse = parsed.finalResponse;
  if (typeof parsed?.action_needed === 'boolean') step.actionNeeded = parsed.action_needed;
  if (Array.isArray(parsed?.skills_needed)) step.skills_needed = parsed.skills_needed;
  if (parsed?.batch_info) step.batch_info = parsed.batch_info;
  // B2: planner's explicit diagnostic (if the planner emits one).
  const diagnosis = parsed?.last_diagnosis || parsed?.diagnosis || parsed?.diagnostic;
  if (typeof diagnosis === 'string' && diagnosis.trim()) step.lastDiagnosis = diagnosis.trim();
  // B4: planner's stated assumptions.
  if (Array.isArray(parsed?.assumptions)) step.assumptions = parsed.assumptions.filter((a: any) => typeof a === 'string' && a.trim());
  return step;
}

export function parseReActStep(content: string): { step: ReActStep; parseError?: string } {
  const parsed = extractAndParseJSON(content);
  if (!parsed) return { step: {}, parseError: 'Could not parse JSON response.' };
  const step = interpretParsedReActStep(parsed);
  return { step };
}

// ─────────────────────────────────────────────────────────────────────────────
// B1: STRUCTURED CONSTRAINT-VIOLATION PARSING
// ─────────────────────────────────────────────────────────────────────────────
// B1: structured hint parsed from a Postgres constraint/enum error, so the ReAct
// retry loop can correct from evidence ("the schema says these are the only
// valid values") instead of guessing a new value blindly.
export interface ConstraintViolation {
  column: string;
  attemptedValue: string;
  hint: string;
  validValues?: string[]; // only populated for enum errors, when parseable
}

// Tables the planner can write to, used to strip the table prefix out of a
// Postgres constraint name ("<table>_<column>_check"). Column names can contain
// underscores (e.g. quizzes_source_type_check), so only a known table prefix is
// removed — never a guess about which underscore splits table vs column.
const KNOWN_CONSTRAINT_TABLES = [
  'notes', 'documents', 'document_folders', 'flashcards', 'quizzes', 'quiz_attempts',
  'schedule_items', 'schedule_reminders', 'social_posts', 'social_groups',
  'class_recordings', 'ai_podcasts', 'chat_sessions', 'chat_messages', 'user_learning_goals',
  'ai_user_memory', 'course_enrollments', 'courses', 'profiles', 'referrals',
  'live_quiz_sessions', 'live_quiz_questions', 'live_quiz_player_answers',
];

// Postgres constraint names follow "<table>_<column>_check" (or just
// "<table>_check"). Strip the _check suffix, then remove the leading known table
// name so multi-word columns survive intact (quizzes_source_type_check →
// source_type, NOT type).
function columnFromConstraintName(constraintName: string): string {
  const base = constraintName.replace(/_check$/i, '');
  for (const table of KNOWN_CONSTRAINT_TABLES) {
    if (base === table) return base; // table-level check, no column
    if (base.startsWith(`${table}_`)) {
      const rest = base.slice(table.length + 1);
      return rest || base;
    }
  }
  return base;
}

export function parseConstraintViolation(msg: string): ConstraintViolation | null {
  if (!msg) return null;

  // 1. CHECK constraint: new row for relation "quizzes" violates check constraint "quizzes_source_type_check"
  //    Often followed by: DETAIL: Failing row contains (..., ai_generated, ...)
  const checkMatch = msg.match(/violates check constraint "([^"]+)"/i);
  if (checkMatch) {
    const constraintName = checkMatch[1];
    const column = columnFromConstraintName(constraintName);
    // Pull the offending value from the DETAIL line: Failing row contains (..., value, ...)
    // Grab the LAST quoted-or-bare token instead of splitting on commas, so text
    // values containing commas (e.g. "Rome, Italy") don't break the extraction.
    const detail = msg.match(/Failing row contains \(([^)]*)\)/i);
    let attemptedValue = '';
    if (detail) {
      const lastQuoted = detail[1].match(/'([^']*)'\s*$/);
      if (lastQuoted) {
        attemptedValue = lastQuoted[1];
      } else {
        const lastBare = detail[1].trim().split(/\s*,\s*/).pop() || '';
        attemptedValue = lastBare.replace(/^['"]|['"]$/g, '');
      }
    }
    return {
      column,
      attemptedValue,
      hint: `The value you supplied for "${column}" violates a CHECK constraint. Use ONLY values explicitly listed in the DATABASE SCHEMA for this column — do not invent new ones.`
    };
  }

  // 2. ENUM: invalid input value for enum "quiz_source_type": "ai_generated"
  const enumMatch = msg.match(/invalid input value for enum "([^"]+)": "([^"]+)"/i);
  if (enumMatch) {
    const enumName = enumMatch[1];
    const attemptedValue = enumMatch[2];
    // Pull valid values from a companion line like "Valid values are: ..." if present,
    // otherwise the planner must consult the DATABASE SCHEMA section.
    const validMatch = msg.match(/Valid values are:?\s*([^\n]+)/i);
    const validValues = validMatch
      ? validMatch[1].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      : undefined;
    return {
      column: enumName,
      attemptedValue,
      validValues,
      hint: `"${attemptedValue}" is not a valid value for enum "${enumName}". Use ONLY values explicitly listed in the DATABASE SCHEMA for this column.` +
        (validValues?.length ? ` Valid values include: ${validValues.join(', ')}.` : '')
    };
  }

  // 3. Generic not-null / value-too-long — no value guessing, just evidence.
  const genericMatch = msg.match(/null value in column "([^"]+)"/i);
  if (genericMatch) {
    return {
      column: genericMatch[1],
      attemptedValue: '(missing)',
      hint: `Column "${genericMatch[1]}" is NOT NULL — you must supply a value. Check the DATABASE SCHEMA for the required columns.`
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// C3: INTENT-FILTERED SCHEMA SLICING
// ─────────────────────────────────────────────────────────────────────────────
// Maps intent keywords / entity types to the schema tables that actually matter
// for that request. The "core" set is always included (common cases).
const INTENT_TABLE_MAP: Record<string, string[]> = {
  note: ['notes'],
  notes: ['notes'],
  document: ['documents'],
  documents: ['documents'],
  folder: ['document_folders'],
  flashcard: ['flashcards'],
  flashcards: ['flashcards'],
  schedule: ['schedule_items'],
  calendar: ['schedule_items'],
  quiz: ['quizzes', 'quiz_attempts'],
  quizzes: ['quizzes', 'quiz_attempts'],
  attempt: ['quiz_attempts'],
  goal: ['user_learning_goals'],
  recording: ['class_recordings'],
  recordings: ['class_recordings'],
  podcast: ['ai_podcasts'],
  post: ['social_posts'],
  posts: ['social_posts'],
  social: ['social_posts', 'social_groups'],
  group: ['social_groups'],
  chat: ['chat_sessions', 'chat_messages'],
  message: ['chat_messages'],
  memory: ['ai_user_memory'],
  course: ['courses', 'course_enrollments'],
  profile: ['profiles'],
  stats: ['user_stats'],
  streak: ['user_stats'],
  xp: ['user_stats'],
};

const SCHEMA_CORE_TABLES = ['notes', 'documents', 'schedule_items'];

/**
 * C3: Returns a slimmed schema text containing only the tables relevant to the
 * detected intent (plus the core set). Falls back to the full schema when no
 * relevant tables were detected.
 */
export function buildFilteredSchemaForIntent(
  schemaText: string,
  intent: { primary?: string; secondary?: string[]; entities?: Array<{ type?: string; value?: string }> } | null | undefined,
  queryText?: string | null
): string {
  if (!schemaText) return '';
  if (!intent || !intent.primary) return schemaText;

  const wanted = new Set<string>(SCHEMA_CORE_TABLES);
  const intentTables = new Set<string>(); // tables beyond the core set
  const lowerPrimary = intent.primary.toLowerCase();
  const tokens = lowerPrimary.split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    const mapped = INTENT_TABLE_MAP[token];
    if (mapped) mapped.forEach(t => { wanted.add(t); if (!SCHEMA_CORE_TABLES.includes(t)) intentTables.add(t); });
  }
  // C7: also consider secondary intents (e.g. study_assistance on "check from
  // the quiz") and the raw query text itself — "quiz" in the message must pull
  // in the quizzes/quiz_attempts tables, otherwise the schema stays unfiltered
  // at ~31KB, the planner request blows past every Groq TPM cap, and the
  // planner dies with "all backends unavailable" even though a working model
  // (e.g. gpt-oss-20b) exists for the final response.
  for (const sec of intent.secondary || []) {
    for (const token of sec.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
      const mapped = INTENT_TABLE_MAP[token];
      if (mapped) mapped.forEach(t => { wanted.add(t); if (!SCHEMA_CORE_TABLES.includes(t)) intentTables.add(t); });
    }
  }
  if (queryText) {
    for (const token of queryText.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
      const mapped = INTENT_TABLE_MAP[token];
      if (mapped) mapped.forEach(t => { wanted.add(t); if (!SCHEMA_CORE_TABLES.includes(t)) intentTables.add(t); });
    }
  }
  for (const entity of intent.entities || []) {
    const et = (entity.type || '').toLowerCase();
    const ev = (entity.value || '').toLowerCase();
    const mapped = INTENT_TABLE_MAP[et] || INTENT_TABLE_MAP[ev] || INTENT_TABLE_MAP[ev.split(/[^a-z0-9]+/)[0]];
    if (mapped) mapped.forEach(t => { wanted.add(t); if (!SCHEMA_CORE_TABLES.includes(t)) intentTables.add(t); });
  }

  // Spec: fall back to the FULL schema when the detected intent mapped to no
  // tables beyond the always-on core set — a filtered schema would otherwise
  // hide tables the planner might legitimately need for an unrecognized intent.
  if (intentTables.size === 0) return schemaText;

  // Parse the numbered schema sections: "NN. tablename" followed by "- col: type" lines.
  const sections: Array<{ name: string; body: string }> = [];
  const lines = schemaText.split('\n');
  let current: { name: string; body: string[] } | null = null;
  const headerRe = /^\s*\d+\.\s+([a-z0-9_]+)\s*$/i;
  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      if (current) sections.push({ name: current.name, body: current.body.join('\n') });
      current = { name: m[1].toLowerCase(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push({ name: current.name, body: current.body.join('\n') });

  const selected = sections.filter(s => wanted.has(s.name));
  if (selected.length === 0) return schemaText; // fall back to full schema

  const header = 'DATABASE SCHEMA (filtered to tables relevant to this request):\n' +
    'If a table you need is not listed here, it may still exist — use the full schema knowledge you already have, but prefer listed tables.\n';
  // Render each section as "tablename" on its own line followed by its
  // indented column lines.
  const body = selected.map(s => `${s.name}\n${s.body.trimStart()}`).join('\n');
  return header + body.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// C4: PRE-FETCHED CONTEXT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * C4: Renders a compact summary of the context agenticCore.retrieveRelevantContext
 * already fetched, so the ReAct planner knows it can skip re-querying it.
 */
export function buildPrefetchedContextSummary(relevantContext: any[]): string {
  if (!Array.isArray(relevantContext) || relevantContext.length === 0) return '';
  const items = relevantContext.slice(0, 10).map((ctx: any) => {
    const type = (ctx.type || 'item').toUpperCase();
    const title = ctx.title || ctx.id || 'unknown';
    const score = typeof ctx.relevanceScore === 'number'
      ? ` (${(ctx.relevanceScore * 100).toFixed(0)}% relevant)`
      : '';
    return `- [${type}] ${title}${score}`;
  });
  return 'The following was already retrieved and does not need to be re-queried:\n' + items.join('\n');
}
