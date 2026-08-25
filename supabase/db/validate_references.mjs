// Validate ALL table/RPC references (Android app + edge functions) against the REAL remote schema.
// Usage: node validate_references.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // .../supabase/db
const supabase = path.resolve(__dirname, '..');
const repoRoot = path.resolve(supabase, '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/^\uFEFF/, ''));
}

// ── Real surface ──
const tables = new Set(readJson('real_rlstables.json').map((r) => r.table_name));
const funcs = new Set(readJson('real_functions.json').map((r) => r.name));
const realCols = {};
for (const r of readJson('real_tables.json')) {
  if (!realCols[r.table_name]) realCols[r.table_name] = new Set();
  realCols[r.table_name].add(r.column_name);
}

// Known non-table entities referenced via .from(): storage buckets + auth schema
const KNOWN_NON_TABLES = new Set([
  'generatedimages', 'podcasts', 'documents', 'avatars', 'recordings', 'chunks', 'audio',
  'users', // auth.users (reached through schema-qualified client in some functions)
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.temp') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|kt)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// ── Extract .from('table') and .rpc('fn') from a file ──
function extractReferences(text) {
  const refs = { tables: new Set(), rpcs: new Set(), storage: new Set() };
  for (const m of text.matchAll(/\.from\(\s*['"]([a-z0-9_]+)['"]/g)) refs.tables.add(m[1]);
  for (const m of text.matchAll(/\.rpc\(\s*['"]([a-z0-9_]+)['"]/g)) refs.rpcs.add(m[1]);
  for (const m of text.matchAll(/storage\.from\(\s*['"]([a-z0-9_]+)['"]/g)) refs.storage.add(m[1]);
  return refs;
}

const results = {
  android: { tables: [], rpcs: [], storage: [] },
  edge: { tables: [], rpcs: [], storage: [] },
};

// ── Android app ──
const androidFiles = walk(path.join(repoRoot, 'app/src/main/java'));
const kotlinRefs = { tables: new Set(), rpcs: new Set(), storage: new Set() };
for (const f of androidFiles) {
  const refs = extractReferences(fs.readFileSync(f, 'utf8'));
  for (const t of refs.tables) kotlinRefs.tables.add(t);
  for (const r of refs.rpcs) kotlinRefs.rpcs.add(r);
  for (const s of refs.storage) kotlinRefs.storage.add(s);
}
// Room entities + DAO tables
const roomText = fs.readFileSync(path.join(repoRoot, 'app/src/main/java/com/example/data/local/entities/Entities.kt'), 'utf8');
for (const m of roomText.matchAll(/tableName\s*=\s*"([a-z0-9_]+)"/g)) kotlinRefs.tables.add(m[1]);
const daoText = fs.readFileSync(path.join(repoRoot, 'app/src/main/java/com/example/data/local/dao/StuddyHubDaos.kt'), 'utf8');
for (const m of daoText.matchAll(/FROM\s+([a-z0-9_]+)/gi)) kotlinRefs.tables.add(m[1]);
for (const m of daoText.matchAll(/INTO\s+([a-z0-9_]+)/gi)) kotlinRefs.tables.add(m[1]);
// REST endpoints built as strings: executeRestX("table?...") and "rest/v1/table"
const restText = fs.readFileSync(path.join(repoRoot, 'app/src/main/java/com/example/data/remote/BackendApiService.kt'), 'utf8');
for (const m of restText.matchAll(/executeRest(?:Get|Post|Patch|Delete)\(\s*"([a-z_]+)/g)) kotlinRefs.tables.add(m[1]);
for (const m of restText.matchAll(/rest\/v1\/([a-z_]+)/g)) kotlinRefs.tables.add(m[1]);
for (const m of restText.matchAll(/rpc\/([a-z_]+)/g)) kotlinRefs.rpcs.add(m[1]);

for (const t of kotlinRefs.tables) {
  if (!tables.has(t) && !KNOWN_NON_TABLES.has(t)) results.android.tables.push(t);
}
for (const r of kotlinRefs.rpcs) {
  if (!funcs.has(r)) results.android.rpcs.push(r);
}
results.android.storage = [...kotlinRefs.storage];

// ── Edge functions ──
const edgeFiles = walk(path.join(supabase, 'functions'));
const edgeRefs = { tables: new Set(), rpcs: new Set(), storage: new Set() };
for (const f of edgeFiles) {
  const refs = extractReferences(fs.readFileSync(f, 'utf8'));
  for (const t of refs.tables) edgeRefs.tables.add(t);
  for (const r of refs.rpcs) edgeRefs.rpcs.add(r);
  for (const s of refs.storage) edgeRefs.storage.add(s);
}
// rpc/ prefixed REST calls
for (const f of edgeFiles) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/rpc\/([a-z_]+)/g)) edgeRefs.rpcs.add(m[1]);
}
for (const t of edgeRefs.tables) {
  if (!tables.has(t) && !KNOWN_NON_TABLES.has(t)) results.edge.tables.push(t);
}
for (const r of edgeRefs.rpcs) {
  if (!funcs.has(r)) results.edge.rpcs.push(r);
}
results.edge.storage = [...edgeRefs.storage];

// ── Report ──
console.log('═══════════════ VALIDATION REPORT ═══════════════');
console.log(`Real DB: ${tables.size} tables, ${funcs.size} functions`);

console.log('\n── ANDROID APP ──');
console.log(`Tables referenced: ${kotlinRefs.tables.size} unique`);
console.log(`  MISSING FROM DB (${results.android.tables.length}):`, results.android.tables.sort().join(', ') || '(none)');
console.log(`RPCs referenced: ${kotlinRefs.rpcs.size} unique`);
console.log(`  MISSING FROM DB (${results.android.rpcs.length}):`, results.android.rpcs.sort().join(', ') || '(none)');

console.log('\n── EDGE FUNCTIONS ──');
console.log(`Tables referenced: ${edgeRefs.tables.size} unique`);
console.log(`  MISSING FROM DB (${results.edge.tables.length}):`, results.edge.tables.sort().join(', ') || '(none)');
console.log(`RPCs referenced: ${edgeRefs.rpcs.size} unique`);
console.log(`  MISSING FROM DB (${results.edge.rpcs.length}):`, results.edge.rpcs.sort().join(', ') || '(none)');
console.log(`Storage buckets used:`, [...edgeRefs.storage].sort().join(', '));

// ── Column spot-check for Android payloads (key tables) ──
// Anchors on the executeRest call line, then walks BACKWARD to the nearest preceding
// `val <name> = JSONObject().apply {` block, collecting its put() keys.
console.log('\n── ANDROID PAYLOAD COLUMN SPOT-CHECK (BackendApiService) ──');
const ktText = fs.readFileSync(path.join(repoRoot, 'app/src/main/java/com/example/data/remote/BackendApiService.kt'), 'utf8');
const ktLines = ktText.split(/\r?\n/);
const keyTables = ['profiles', 'notes', 'documents', 'schedule_items', 'quiz_attempts', 'quizzes', 'flashcards', 'class_recordings', 'ai_podcasts', 'courses', 'social_posts', 'chat_sessions', 'chat_messages', 'document_folders', 'live_quiz_sessions', 'course_enrollments', 'social_users', 'social_likes', 'social_bookmarks', 'social_comments', 'social_groups', 'social_group_members', 'social_chat_messages', 'course_materials', 'social_events', 'social_follows'];

function nearestPayloadKeys(callLine) {
  // Map each builder var to its block start line + keys (handles nested braces)
  const builders = [];
  for (let i = 0; i < ktLines.length; i++) {
    const bm = ktLines[i].match(/val\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*JSONObject\(\)\.apply\s*\{/);
    if (bm) {
      const keys = [];
      let j = i + 1;
      let depth = 1;
      while (j < ktLines.length && depth > 0) {
        const line = ktLines[j];
        depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        for (const pm of line.matchAll(/put\(\s*"([a-zA-Z0-9_]+)"/g)) keys.push(pm[1]);
        j++;
      }
      builders.push({ name: bm[1], line: i, endLine: j, keys });
    }
  }
  // nearest builder whose block ENDS at or before the call line
  let best = null;
  for (const b of builders) {
    if (b.endLine <= callLine) {
      if (!best || b.endLine > best.endLine) best = b;
    }
  }
  return best ? best.keys : [];
}

let checked = 0;
for (const tbl of keyTables) {
  const colSet = realCols[tbl];
  if (!colSet) continue;
  const putKeys = new Set();
  const re = new RegExp('executeRest(?:Post|Patch)\\(\\s*["\']' + tbl + '[^\"]*["\']\\s*,');
  for (let i = 0; i < ktLines.length; i++) {
    if (re.test(ktLines[i])) {
      for (const k of nearestPayloadKeys(i)) putKeys.add(k);
    }
  }
  if (putKeys.size) {
    // Keys that are legitimately NOT DB columns: camelCase edge-function params
    // (userId, documentId, files, is_liked, is_bookmarked, action, target_user_id,
    // postId, groupId, fileType, fileSize, uploadedBy, sessionId, enableStreaming,
    // aiMessageIdToUpdate, ...), storage/upload metadata (name, mimeType, size, data),
    // and intentionally-non-column keys (email/password/auth payloads, sync metadata).
    const NON_COLUMN = new Set([
      'id', 'email', 'password', 'data', 'full_name', 'school',
      'userId', 'documentId', 'files', 'name', 'mimeType', 'size', 'idToUpdate',
      'url', 'color', 'description', 'parent_folder_id', 'folderIds',
      'is_liked', 'is_bookmarked', 'action', 'target_user_id', 'postId', 'groupId',
      'fileType', 'fileSize', 'uploadedBy', 'sessionId', 'enableStreaming',
      'aiMessageIdToUpdate', 'userMessageIdToUpdate', 'systemPromptOverride',
      'attachedNoteIds', 'attachedDocumentIds', 'message', 'title', 'content_extracted',
      'topic', 'duration_seconds', 'color_hex', 'thinking_steps', 'role', 'content',
      'is_error', 'session_id', 'image_url', 'question', 'options', 'subject', 'type',
      'start_time', 'end_time', 'location', 'color_hex_local', 'recurrence_pattern',
      'recurrence_end_date', 'recurrence_days', 'course_id', 'category', 'answers',
      'xp_earned', 'live_results', 'quiz_id', 'score', 'total_questions', 'percentage',
      'time_taken_seconds', 'source_type', 'questions', 'user_id', 'front', 'back',
      'difficulty', 'hint', 'review_count', 'next_review_at', 'duration', 'audio_url',
      'transcript', 'summary', 'processing_status', 'script', 'style', 'duration_minutes',
      'status', 'group_id', 'sender_id', 'privacy', 'ai_categories', 'metadata',
      'author_id', 'post_id', 'follower_id', 'following_id', 'organizer_id', 'start_date',
      'end_date', 'is_online', 'max_attendees', 'created_by', 'interests', 'avatar_url',
      'display_name', 'username', 'bio', 'document_id', 'tags', 'ai_summary', 'is_pinned',
      'is_favorite', 'translated_text', 'translated_language', 'localFilePath', 'isSynced',
      'syncStatus', 'fileUrl', 'fileSizeKb', 'contentExtracted', 'createdAt', 'updatedAt',
      'folderId', 'onboarding_completed', 'personal_context', 'learning_style',
      'user_role', 'points_balance', 'bonus_ai_credits', 'is_logged_in', 'access_token',
      'refresh_token', 'token_expires_at', 'supabase_user_id', 'host_user_id', 'join_code',
      'quiz_mode', 'config', 'advance_mode', 'allow_late_join', 'scheduled_start_time',
      'host_role', 'enrolled_at', 'progress_percent', 'last_accessed_at',
    ]);
    const missing = [...putKeys].filter((k) => !colSet.has(k) && !NON_COLUMN.has(k));
    if (missing.length) {
      checked++;
      console.log(`  ${tbl}: keys NOT in real schema: ${missing.join(', ')}`);
    }
  }
}
if (!checked) console.log('  (all payload keys verified present)');
console.log('\nDONE');
