// confirmation-policy.ts
// Static classification of tools that require an explicit user confirmation
// round-trip before executing, replacing the affirmation-regex approach.
// Confirmation is decided by WHAT the model is about to call, not by how the
// user phrased the previous message.

export type NativeFcMode = 'off' | 'shadow' | 'readonly' | 'all';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMATION SETS
// Keys are tool names; db_action entries are qualified as "db_action:<OP>".
// NOTE: db_action itself is dispatched through the legacy executeParsedActions
// pipeline, which enforces its own holding rules (including the light-touch
// INSERT duplicate-check). The db_action:* entries here exist so the native
// loop logs an accurate confirmation verdict even before dispatch.
// ─────────────────────────────────────────────────────────────────────────────

export const REQUIRES_CONFIRMATION = new Set<string>([
  // §4 baseline from migration-plan.md
  'db_action:DELETE',
  'db_action:UPDATE',
  'fetch_and_save_web_resource',
  'create_course',

  // Dedicated destructive methods (mirror db_action:DELETE/UPDATE semantics)
  'delete_note',
  'delete_schedule_item',
  'update_note',
  'update_schedule_item',

  // Externally-visible / costly operations
  'create_social_post',
  'create_study_group',
  'schedule_group_event',
  'generate_podcast',
  'award_achievement'
]);

export const AUTO_APPROVE = new Set<string>([
  'search_web',
  'get_referral_code',
  'db_action:SELECT',
  'db_action:INSERT',
  'generate_image',
  'engage_social',
  'update_user_memory',
  'update_flashcard_review',
  'create_note',
  'create_flashcard',
  'create_flashcards_from_note',
  'create_quiz',
  'create_schedule_item',
  'create_document_folder',
  'create_learning_goal',
  'create_class_recording',
  'record_quiz_attempt'
]);

export function policyKeyFor(toolName: string, args: any): string {
  if (toolName === 'db_action') {
    const op = String(args?.operation || '').toUpperCase() || 'UNKNOWN';
    return `db_action:${op}`;
  }
  return toolName;
}

/**
 * True when the model is about to call something destructive, externally
 * visible, or costly enough to warrant pausing for explicit consent.
 */
export function needsConfirmation(toolName: string, args: any): boolean {
  return REQUIRES_CONFIRMATION.has(policyKeyFor(toolName, args));
}

// ─────────────────────────────────────────────────────────────────────────────
// CUTOVER GATES (Phases 4-5 of migration-plan.md)
// A tool is only ever EXECUTED by the native loop when the active mode allows
// it AND it has a dispatch path (legacy translation or direct executor).
// Anything not allowed here causes the whole turn to fall back to the legacy
// ReAct path — capabilities never silently vanish during migration.
// ─────────────────────────────────────────────────────────────────────────────

export const NATIVE_READONLY_KEYS = new Set<string>([
  'search_web',
  'get_referral_code',
  'db_action:SELECT'
]);

export const NATIVE_FULL_EXTRA_KEYS = new Set<string>([
  'db_action:INSERT',
  'db_action:UPDATE',
  'db_action:DELETE',
  'fetch_and_save_web_resource',
  'create_course',
  'create_note',
  'create_flashcard',
  'create_quiz',
  'create_schedule_item',
  'create_document_folder',
  'create_learning_goal',
  'create_class_recording',
  'generate_image',
  'engage_social',
  'create_social_post',
  'delete_note',
  'delete_schedule_item',
  'update_note',
  'update_schedule_item',
  'generate_podcast',
  'update_user_memory',
  'update_flashcard_review',
  'record_quiz_attempt'
]);

export function isNativeCutoverAllowed(
  mode: NativeFcMode,
  toolName: string,
  args: any
): boolean {
  if (mode !== 'readonly' && mode !== 'all') return false;
  const key = policyKeyFor(toolName, args);
  if (NATIVE_READONLY_KEYS.has(key)) return true;
  if (mode === 'all' && NATIVE_FULL_EXTRA_KEYS.has(key)) return true;
  return false;
}
