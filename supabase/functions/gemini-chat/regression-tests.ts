// regression-tests.ts — Offline regression tests for the gemini-chat fix spec
// (Parts A–D that are testable without a deployed edge function).
//
// Run with Node (v22.6+ type-stripping) or Deno:
//   node --experimental-strip-types supabase/functions/gemini-chat/regression-tests.ts
//   deno run supabase/functions/gemini-chat/regression-tests.ts
//
// Items that require a live deployment + real chat traffic (1,2,3,4,5,6,7,8,9,10
// in the spec's test plan) are listed at the bottom as runtime checks to run
// after redeploying, with exact log greps.

import {
  sanitizeAssistantOutput,
  enrichResponseWithActionData,
  parseConstraintViolation,
  buildFilteredSchemaForIntent,
  buildPrefetchedContextSummary,
  parseReActStep,
  interpretParsedReActStep,
  INTERNAL_PROMPT_LEAK_SIGNATURES,
} from './sanitize.ts';
import {
  buildActionSignature,
  pendingSignatureVariants,
  extractPendingConfirmationInfo,
  confirmationMatchesPending,
  isExplicitConfirmationMessage,
  deriveRequestOrigin,
} from './actions_helper.ts';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — A1 regression: raw planner JSON must never survive sanitization.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T1] A1 — action_needed planner JSON stripped');
check(
  "sanitizeAssistantOutput('{ \"action_needed\": false }') → ''",
  sanitizeAssistantOutput('{ "action_needed": false }') === '',
  `got: ${JSON.stringify(sanitizeAssistantOutput('{ "action_needed": false }'))}`
);
check(
  "sanitizeAssistantOutput('{\"thought_process\":\"x\",\"action_needed\":true}') → ''",
  sanitizeAssistantOutput('{"thought_process":"x","action_needed":true}') === '',
  `got: ${JSON.stringify(sanitizeAssistantOutput('{"thought_process":"x","action_needed":true}'))}`
);
check(
  "'\"action_needed\"' in INTERNAL_PROMPT_LEAK_SIGNATURES",
  INTERNAL_PROMPT_LEAK_SIGNATURES.includes('"action_needed"')
);
check(
  'sanitizeAssistantOutput blocks any prose carrying the action_needed signature',
  sanitizeAssistantOutput('Here is your answer. {"action_needed": false}') === '',
  `got: ${JSON.stringify(sanitizeAssistantOutput('Here is your answer. {"action_needed": false}'))}`
);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — A2 regression: enrichment must never BE the whole response, and
// quiz_attempts records render readable summaries, not raw UUIDs.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T2] A2 — enrichment is a supplement, never the entire reply');
const quizActions = [{
  type: 'DB_ACTION',
  success: true,
  data: {
    data: [{
      id: 'e6a494d9-4c64-4c8d-8de6-dd9496f0b03b',
      quiz_id: 'q1',
      score: 3,
      total_questions: 5,
      percentage: 60,
      answers: [{ question: 'q1', selected: 'b', correct: 'a' }],
    }],
  },
}];
const enrichedEmpty = enrichResponseWithActionData('', quizActions);
check(
  'empty base response → stays empty (fallback path runs, no raw-ID list)',
  enrichedEmpty === '',
  `got: ${JSON.stringify(enrichedEmpty)}`
);
const enrichedWhitespace = enrichResponseWithActionData('   \n ', quizActions);
check(
  'whitespace base response → stays empty',
  enrichedWhitespace.trim() === '',
  `got: ${JSON.stringify(enrichedWhitespace)}`
);
const enrichedProse = enrichResponseWithActionData('I found your quiz data.', quizActions);
check(
  'quiz_attempts row renders "Quiz attempt: 3/5 (60%)" not "Item <uuid>"',
  enrichedProse.includes('Quiz attempt: 3/5 (60%)'),
  `got: ${JSON.stringify(enrichedProse)}`
);
check(
  'no raw UUID "Item e6a494d9" in the enriched text',
  !enrichedProse.includes('Item e6a494d9'),
  `got: ${JSON.stringify(enrichedProse)}`
);
check(
  'real prose with existing list → not re-enriched (no duplication)',
  !enrichResponseWithActionData('Results:\n- already listed', quizActions).includes('Here are the most relevant'),
);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — B1 regression: constraint/enum errors parse into structured hints.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T3] B1 — structured constraint violation parsing');
const checkErr = parseConstraintViolation(
  'new row for relation "quizzes" violates check constraint "quizzes_source_type_check" DETAIL: Failing row contains (123, 456, ai_generated)'
);
check('CHECK constraint → column source_type', checkErr?.column === 'source_type', `got: ${checkErr?.column}`);
check('CHECK constraint → attemptedValue ai_generated', checkErr?.attemptedValue === 'ai_generated', `got: ${checkErr?.attemptedValue}`);
check('CHECK constraint → hint mentions DATABASE SCHEMA', !!checkErr?.hint.includes('DATABASE SCHEMA'));

const enumErr = parseConstraintViolation(
  'invalid input value for enum "quiz_source_type": "note_overview" Valid values are: recording, notes, ai, live_custom'
);
check('ENUM error → column quiz_source_type', enumErr?.column === 'quiz_source_type', `got: ${enumErr?.column}`);
check('ENUM error → attemptedValue note_overview', enumErr?.attemptedValue === 'note_overview', `got: ${enumErr?.attemptedValue}`);
check('ENUM error → validValues parsed', JSON.stringify(enumErr?.validValues) === JSON.stringify(['recording', 'notes', 'ai', 'live_custom']), `got: ${JSON.stringify(enumErr?.validValues)}`);
check('ENUM error → hint lists valid values', !!enumErr?.hint.includes('recording, notes, ai, live_custom'));

const nullErr = parseConstraintViolation('null value in column "title" violates not-null constraint');
check('NOT NULL error → column title', nullErr?.column === 'title', `got: ${nullErr?.column}`);
check('unrelated error → null', parseConstraintViolation('connection reset') === null);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — C3 regression: intent-filtered schema keeps relevant tables + core.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T4] C3 — intent-filtered schema slicing');
const fakeSchema = [
  '1. notes', '    - id: uuid (pk)', '    - title: text',
  '2. documents', '    - id: uuid (pk)',
  '3. flashcards', '    - id: uuid (pk)',
  '4. quizzes', '    - id: uuid (pk)', '    - source_type: text',
  '5. quiz_attempts', '    - id: uuid (pk)',
  '6. schedule_items', '    - id: uuid (pk)',
  '7. social_posts', '    - id: uuid (pk)',
  '8. class_recordings', '    - id: uuid (pk)',
].join('\n');

const quizFiltered = buildFilteredSchemaForIntent(fakeSchema, { primary: 'quiz review', entities: [] });
check('quiz intent keeps notes (core)', quizFiltered.includes('notes\n'), '');
check('quiz intent keeps quizzes', quizFiltered.includes('quizzes\n'), '');
check('quiz intent keeps quiz_attempts', quizFiltered.includes('quiz_attempts\n'), '');
check('quiz intent drops flashcards', !quizFiltered.includes('flashcards'), '');
check('quiz intent drops social_posts', !quizFiltered.includes('social_posts'), '');
check('quiz intent keeps schedule_items (core)', quizFiltered.includes('schedule_items\n'), '');

const noIntent = buildFilteredSchemaForIntent(fakeSchema, null);
check('null intent → full schema returned', noIntent === fakeSchema, '');

const unknownIntent = buildFilteredSchemaForIntent(fakeSchema, { primary: 'zebra watching', entities: [] });
check('unknown intent → full schema fallback', unknownIntent === fakeSchema, '');

// Regression (2026-08-16 incident): intent 'information_retrieval' maps to no
// tables, but the raw message "check from the quiz" contains 'quiz' — the
// query text must pull in quizzes/quiz_attempts, otherwise the full ~31KB
// schema ships to the planner, blowing every Groq TPM cap and killing the
// planner even though a working model exists for the final response.
const msgFiltered = buildFilteredSchemaForIntent(
  fakeSchema,
  { primary: 'information_retrieval', entities: [] },
  'check from the quiz'
);
check('query text quiz → schema filtered (not full)', msgFiltered !== fakeSchema, '');
check('query text quiz → keeps quizzes', msgFiltered.includes('quizzes\n'), `got: ${msgFiltered}`);
check('query text quiz → keeps quiz_attempts', msgFiltered.includes('quiz_attempts\n'), '');
check('query text quiz → drops flashcards', !msgFiltered.includes('flashcards'), '');
const noMsg = buildFilteredSchemaForIntent(fakeSchema, { primary: 'information_retrieval', entities: [] });
check('no query text + unmapped intent → full schema fallback', noMsg === fakeSchema, '');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — C4 regression: prefetched context summary renders compactly.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T5] C4 — prefetched context summary');
const summary = buildPrefetchedContextSummary([
  { type: 'note', title: 'CV', relevanceScore: 0.9 },
  { type: 'document', title: 'Syllabus', relevanceScore: 0.4 },
]);
check('summary lists note title', summary.includes('[NOTE] CV'), `got: ${summary}`);
check('summary lists document title', summary.includes('[DOCUMENT] Syllabus'), `got: ${summary}`);
check('summary shows relevance %', summary.includes('90% relevant'), `got: ${summary}`);
check('empty context → empty string', buildPrefetchedContextSummary([]) === '');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — B2/B4 regression: assumptions + last_diagnosis parsed into ReActStep.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T6] B2/B4 — assumptions + diagnosis captured');
const parsed = parseReActStep(JSON.stringify({
  thought_process: 'checking',
  action_needed: false,
  assumptions: ['defaulted exam time to 9-11am since none was given', ''],
  last_diagnosis: 'content does not include diagram markup',
}));
check('parseReActStep has no parseError', !parsed.parseError, `got: ${parsed.parseError}`);
check('assumptions captured (blank filtered)', parsed.step.assumptions?.length === 1, `got: ${JSON.stringify(parsed.step.assumptions)}`);
check('assumptions[0] exact', parsed.step.assumptions?.[0] === 'defaulted exam time to 9-11am since none was given', '');
check('lastDiagnosis captured', parsed.step.lastDiagnosis === 'content does not include diagram markup', `got: ${parsed.step.lastDiagnosis}`);
check('actionNeeded false captured', parsed.step.actionNeeded === false, '');
check('interpretParsedReActStep handles diagnostics field too', interpretParsedReActStep({ diagnostic: 'found it' }).lastDiagnosis === 'found it', '');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — A3 regression: <thinking> tags stripped by sanitize (belt & braces
// on top of the removal of sendContentChunk(thought) in the ReAct loop).
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T7] A3 — thinking blocks never survive');
const thinkingMsg = '<thinking>\nI should look this up.\n</thinking>\n\nHere is the real answer.';
check('thinking tags removed from final output', !sanitizeAssistantOutput(thinkingMsg).includes('<thinking>'), `got: ${JSON.stringify(sanitizeAssistantOutput(thinkingMsg))}`);
check('real answer text preserved', sanitizeAssistantOutput(thinkingMsg).includes('Here is the real answer.'), '');
check('two thinking blocks with no prose → empty', sanitizeAssistantOutput('<thinking>a</thinking>\n<thinking>b</thinking>') === '', '');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — A1/A2 prompt-rule presence (static source checks).
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T8] Prompt rules present in index.ts');
import { readFileSync } from 'node:fs';
const indexSrc = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const requiredFragments: Array<[string, string]> = [
  ['B3 analytical-query rule', "name the specific fields/tables needed to compute the answer"],
  ['A2 wrong-answers rule (both SELECTs)', "SELECT both 'quizzes.questions'"],
  ['B5 broader-search rule', "retry with a broader filter"],
  ['B1 no-guess rule', "do not guess a new value"],
  ['C6 stop-heuristic rule', "Do not re-query the same table"],
  ['C1 boot stamp', "Tool-use gate decision"],
  ['C5 planner timeout', "PLANNER_CALL_TIMEOUT_MS"],
  ['A3 forced full context', "reactLoopExhaustedWithoutResult"],
  ['D2 bookkeeping strip', "stripReactBookkeepingTurns"],
  ['B2 findings block', "plannerFindingsBlock"],
];
for (const [name, frag] of requiredFragments) {
  check(`${name} present in index.ts`, indexSrc.includes(frag), `missing: ${frag}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — P1-1 regression: truncated JSON fragments are wiped, not leaked.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T7] P1-1 — truncated JSON fragment wipe');
const fragment = `",\n        \"filters\": \n      }\n    }\n  ]\n}`;
check(
  "sanitizeAssistantOutput(truncated JSON tail with 'filters') → ''",
  sanitizeAssistantOutput(fragment) === '',
  `got: ${JSON.stringify(sanitizeAssistantOutput(fragment))}`
);
check(
  'clean prose with balanced brackets survives',
  sanitizeAssistantOutput('Here is a [list] of items. {nested} fine.') !== '',
);
check(
  'a closing-brace-only tail with no residue tokens → wiped when leading punctuation',
  sanitizeAssistantOutput('\",\n      }') === '',
  `got: ${JSON.stringify(sanitizeAssistantOutput('\",\n      }'))}`
);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — P0 confirmation ledger: signature building, matching, intent.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[T8] P0 — confirmation ledger');

// Signature canonicalization (auth.uid normalized)
const sig1 = buildActionSignature('notes', 'INSERT', { title: 'A', user_id: 'auth.uid()' }, {});
const sig2 = buildActionSignature('Notes', 'insert', { user_id: 'auth.uid', title: 'A' }, {});
check('INSERT signatures equal despite key order / case / auth.uid spelling', sig1 === sig2, `sig1=${sig1} sig2=${sig2}`);
check('INSERT signature embeds normalized title', sig1.includes('title:A'), `got: ${sig1}`);
const delSig = buildActionSignature('notes', 'DELETE', {}, { title: 'test note A' });
check('DELETE signature based on filters', delSig === 'notes|DELETE|title:test note A', `got: ${delSig}`);

// Variants: title + id forms for UPDATE/DELETE
const delVariants = pendingSignatureVariants('notes', 'DELETE', {}, { title: 'test note A' }, ['abc-123']);
check(
  'DELETE variants include exact, id, and title forms',
  delVariants.includes('notes|DELETE|title:test note A') && delVariants.includes('notes|DELETE|id:abc-123'),
  `got: ${JSON.stringify(delVariants)}`
);
const insVariants = pendingSignatureVariants('notes', 'INSERT', { title: 'test note A', content: 'x' }, {});
check(
  'INSERT variants include exact and title forms',
  insVariants.includes('notes|INSERT|title:test note A'),
  `got: ${JSON.stringify(insVariants)}`
);

// extractPendingConfirmationInfo from a held-action conversation_context
const heldCtx = {
  awaitingConfirmation: true,
  pendingActions: [{
    type: 'DB_ACTION',
    success: false,
    data: {
      needsConfirmation: true,
      proposedData: { title: 'test note A', content: 'hello world', user_id: 'auth.uid()' },
      requestOrigin: 'inferred',
      table: 'notes',
      params: { table: 'notes', operation: 'INSERT', data: { title: 'test note A', content: 'hello world', user_id: 'auth.uid()' } }
    }
  }]
};
const pending = extractPendingConfirmationInfo([{ role: 'assistant', conversation_context: JSON.stringify(heldCtx) }]);
check('extractPendingConfirmationInfo detects pending state', pending.hasPending === true);
check(
  'pending INSERT title variant collected',
  pending.signatures.has('notes|INSERT|title:test note A'),
  `sigs: ${JSON.stringify([...pending.signatures])}`
);
check(
  'no pending state when history is empty',
  extractPendingConfirmationInfo([]).hasPending === false
);

// confirmationMatchesPending — all four conditions
const goodCtx = { pendingSignatures: pending.signatures, userConfirmationIntent: true };
check(
  'confirmed + explicit user confirmation + matching signature → legit',
  confirmationMatchesPending({ confirmed: true }, goodCtx, ['notes|INSERT|title:test note A']) === true
);
check(
  'confirmed but NO explicit user confirmation → held',
  confirmationMatchesPending({ confirmed: true }, { pendingSignatures: pending.signatures, userConfirmationIntent: false }, ['notes|INSERT|title:test note A']) === false
);
check(
  'confirmed but signature NOT pending → held (model self-attestation blocked)',
  confirmationMatchesPending({ confirmed: true }, goodCtx, ['notes|INSERT|title:other']) === false
);
check(
  'confirmed but no ledger context → held',
  confirmationMatchesPending({ confirmed: true }, undefined, ['notes|INSERT|title:test note A']) === false
);
// P0 fix (accept → re-ask loop): the ledger (scoped to the most recent assistant
// turn) plus the user's explicit confirmation THIS turn is itself the trust basis.
// The planner normally re-emits with `confirmed: true`, but models sometimes drop
// the flag — requiring it when the ledger already proves (pending + user said yes)
// would re-hold the confirmed action and loop the confirmation ask forever.
check(
  'no confirmed flag + ledger match + explicit confirmation → executed',
  confirmationMatchesPending({}, goodCtx, ['notes|INSERT|title:test note A']) === true
);
check(
  'no confirmed flag + ledger match + NO explicit confirmation → held',
  confirmationMatchesPending({}, { pendingSignatures: pending.signatures, userConfirmationIntent: false }, ['notes|INSERT|title:test note A']) === false
);

// isExplicitConfirmationMessage
check('"Yes, go ahead." → confirmation', isExplicitConfirmationMessage('Yes, go ahead.') === true);
check('"go ahead" → confirmation', isExplicitConfirmationMessage('go ahead') === true);
check('"sure" → confirmation', isExplicitConfirmationMessage('sure') === true);
check('"no" → NOT confirmation', isExplicitConfirmationMessage('no') === false);
check('"cancel" → NOT confirmation', isExplicitConfirmationMessage('cancel') === false);
check('"delete my note title test note a" → NOT confirmation (new request)', isExplicitConfirmationMessage('delete my note title test note a') === false);
check('"save a note with the title test note A" → NOT confirmation (new request)', isExplicitConfirmationMessage('save a note with the title test note A') === false);
check('"yes but change title to X" → confirmation', isExplicitConfirmationMessage('yes but change title to X') === true);

// deriveRequestOrigin (P0-3)
check('explicit save verb → explicit', deriveRequestOrigin('save a note titled photosynthesis overview') === 'explicit');
check('pasted content, no verb → inferred', deriveRequestOrigin('here is my heuristic evaluation template...') === 'inferred');
check('empty → inferred', deriveRequestOrigin('') === 'inferred');

// ── FIX 1: batch confirmation — heldInBatch stubs carry identity so one
//    "yes" confirms the WHOLE batch, not just the first item ──

// Old shape: stub with no identity → signature set contains no schedule_items sig.
const oldShapeMsgs = [{
  role: 'assistant',
  conversation_context: JSON.stringify({
    awaitingConfirmation: true,
    pendingActions: [
      { type: 'DB_ACTION', success: false, data: { needsConfirmation: true, heldInBatch: true } },
      { type: 'DB_ACTION', success: false, data: { needsConfirmation: true, heldInBatch: true } }
    ]
  })
}];
const oldShapeInfo = extractPendingConfirmationInfo(oldShapeMsgs);
check('OLD heldInBatch stubs (no identity) → no batch signatures rebuildable',
  oldShapeInfo.hasPending === true && ![...oldShapeInfo.signatures].some(s => s.includes('schedule_items')));

// New shape: stub carries table/operation/proposedData/params → signatures rebuild.
const newShapeMsgs = [{
  role: 'assistant',
  conversation_context: JSON.stringify({
    awaitingConfirmation: true,
    pendingActions: [
      {
        type: 'DB_ACTION', success: false,
        data: {
          needsConfirmation: true, heldInBatch: true,
          table: 'schedule_items', operation: 'INSERT',
          proposedData: { title: 'Programming with C# Exam' },
          params: { table: 'schedule_items', operation: 'INSERT', data: { title: 'Programming with C# Exam' } }
        }
      },
      {
        type: 'DB_ACTION', success: false,
        data: {
          needsConfirmation: true, heldInBatch: true,
          table: 'schedule_items', operation: 'INSERT',
          proposedData: { title: 'Research Methods and Ethics Exam' },
          params: { table: 'schedule_items', operation: 'INSERT', data: { title: 'Research Methods and Ethics Exam' } }
        }
      }
    ]
  })
}];
const newShapeInfo = extractPendingConfirmationInfo(newShapeMsgs);
check('NEW heldInBatch stubs → schedule_items signature rebuilt for stub #1',
  [...newShapeInfo.signatures].some(s => s.includes('schedule_items') && s.includes('Programming with C#')));
check('NEW heldInBatch stubs → schedule_items signature rebuilt for stub #2',
  [...newShapeInfo.signatures].some(s => s.includes('schedule_items') && s.includes('Research Methods and Ethics')));

// A re-proposed action must now match a stub's rebuilt signature (whole batch
// confirms). The planner re-proposes with the FULL payload (title, times,
// description…) — the title-variant signature is what must still match.
const reProposedFullData = { title: 'Programming with C# Exam', subject: 'CE 380', start_time: '2026-08-24T07:00:00Z', end_time: '2026-08-24T10:00:00Z', description: 'Lecturer: Dr I. Botchway; Invigilators: Dr I. Botchway, Dr Meteku B. Edem' };
const reProposedParams = { table: 'schedule_items', operation: 'INSERT', data: reProposedFullData, confirmed: true };
check('re-proposed action matches pending stub signature → confirmed honored',
  confirmationMatchesPending(reProposedParams, { pendingSignatures: newShapeInfo.signatures, userConfirmationIntent: true }, pendingSignatureVariants('schedule_items', 'INSERT', reProposedFullData, {}, [])) === true);

// P0 (custom refinements): a re-emitted INSERT on the same pending table with a
// different title is a "yes, but change X" — the user explicitly confirmed THIS
// turn and a schedule_items INSERT is genuinely pending, so it now EXECUTES
// instead of re-asking forever. UPDATE/DELETE still require an exact match.
const otherParams = { table: 'schedule_items', operation: 'INSERT', data: { title: 'Simulation & Modelling Exam' }, confirmed: true };
check('different-title INSERT + explicit confirmation + same pending table → executed (refinement)',
  confirmationMatchesPending(otherParams, { pendingSignatures: newShapeInfo.signatures, userConfirmationIntent: true }, pendingSignatureVariants('schedule_items', 'INSERT', { title: 'Simulation & Modelling Exam' }, {}, [])) === true);
check('different-title INSERT WITHOUT explicit confirmation → still held',
  confirmationMatchesPending(otherParams, { pendingSignatures: newShapeInfo.signatures, userConfirmationIntent: false }, pendingSignatureVariants('schedule_items', 'INSERT', { title: 'Simulation & Modelling Exam' }, {}, [])) === false);
check('different-table INSERT even WITH explicit confirmation → still held',
  confirmationMatchesPending({ table: 'flashcards', operation: 'INSERT', data: { title: 'Simulation & Modelling Exam' }, confirmed: true }, { pendingSignatures: newShapeInfo.signatures, userConfirmationIntent: true }, pendingSignatureVariants('flashcards', 'INSERT', { title: 'Simulation & Modelling Exam' }, {}, [])) === false);

// ─────────────────────────────────────────────────────────────────────────────
// FIX B: malformed (poisoned) pending batch — identity-less heldInBatch stubs
// ─────────────────────────────────────────────────────────────────────────────
const poisonedBatchMsgs = [{
  role: 'assistant',
  conversation_context: {
    awaitingConfirmation: true,
    pendingActions: [
      { type: 'DB_ACTION', success: false, data: { needsConfirmation: true, proposedData: { title: 'Programming with C# Exam' }, table: 'schedule_items', params: { table: 'schedule_items', operation: 'INSERT', data: { title: 'Programming with C# Exam' } } } },
      { type: 'DB_ACTION', success: false, data: { needsConfirmation: true, heldInBatch: true } },
      { type: 'DB_ACTION', success: false, data: { needsConfirmation: true, heldInBatch: true } }
    ]
  }
}];
const poisonedBatchInfo = extractPendingConfirmationInfo(poisonedBatchMsgs);
check('OLD bare heldInBatch stubs → malformed flagged (signatures unrecoverable)',
  poisonedBatchInfo.malformed === true);
check('OLD bare heldInBatch stubs → first action signature still rebuilt',
  [...poisonedBatchInfo.signatures].some(s => s.includes('schedule_items') && s.includes('Programming with C#')));

// Repair mode: malformed pending + explicit confirmation → an unmatched re-proposed
// action is accepted wholesale (one "yes" drains the whole poisoned batch).
const repairParams = { table: 'schedule_items', operation: 'INSERT', data: { title: 'Research Methods and Ethics Exam' }, confirmed: true };
check('malformed batch + explicit confirmation → unmatched re-proposed action accepted (repair)',
  confirmationMatchesPending(repairParams, { pendingSignatures: poisonedBatchInfo.signatures, userConfirmationIntent: true, malformed: true }, pendingSignatureVariants('schedule_items', 'INSERT', { title: 'Research Methods and Ethics Exam' }, {}, [])) === true);

// Safety: repair must NOT fire without an explicit confirmation message.
check('malformed batch WITHOUT explicit confirmation → still held',
  confirmationMatchesPending(repairParams, { pendingSignatures: poisonedBatchInfo.signatures, userConfirmationIntent: false, malformed: true }, pendingSignatureVariants('schedule_items', 'INSERT', { title: 'Research Methods and Ethics Exam' }, {}, [])) === false);

// Safety: repair is INSERT-only — an UPDATE re-proposed on a malformed-confirmation
// turn must still be held (it will self-heal via the normal flow).
const repairUpdateParams = { table: 'schedule_items', operation: 'UPDATE', data: { title: 'Research Methods and Ethics Exam' }, confirmed: true };
check('malformed batch + explicit confirmation → UPDATE still held (repair is INSERT-only)',
  confirmationMatchesPending(repairUpdateParams, { pendingSignatures: poisonedBatchInfo.signatures, userConfirmationIntent: true, malformed: true }, pendingSignatureVariants('schedule_items', 'UPDATE', {}, {}, [])) === false);

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('FAILED:');
  failures.forEach(f => console.log(`  - ${f}`));
}
console.log('='.repeat(60));

// Runtime checks that require a redeployed function + real traffic (spec test
// plan items 1-10). Printed for the operator, not asserted here.
console.log(`
RUNTIME CHECKS (after deploy — run these against the live function):
  1. [A1] grep saved chat_messages.content for '"action_needed"' → must never appear
  2. [A2] take a quiz, ask "what questions did I get wrong" → response cites question text,
         never a raw UUID; expect two SELECTs (quizzes.questions + quiz_attempts.answers)
  3. [A3] ask about a nonexistent note → visible response never contains literal <thinking>
  4. [B1] trigger quiz INSERT with bad source_type → retry uses schema value; succeeds ≤1 retry
  5. [B2/B4] update a note asking for diagrams it lacks → reply asks for the markup,
         and flags assumed defaults as changeable
  6. [B5] reference existing entity by slightly-wrong title → no duplicate INSERT
  7. [C1] send "hello" → log shows 'Tool-use gate decision: shouldPlanActions=false',
         zero 'ReAct step' thinking_steps
  8. [C2/C5] force quota state → no planner call exceeds ~20s; xAI dead key not retried
         per cooldown window (log: '[CIRCUIT_BREAKER] Marking xai/... exhausted')
  9. [C6] "what's on my schedule today" → ≤2 ReAct iterations, no duplicate schedule_items SELECT
  10. [E2E] 10 varied messages → p50 < 8s conversational / < 15s action turns, max < 30s
`);
