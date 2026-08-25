#!/usr/bin/env node
/**
 * Import Data from Old Project
 *
 * Reads exported JSON files from scripts/export/ and imports them
 * into the new Supabase project via the REST API.
 *
 * Usage:
 *   node scripts/import-data.js              # import all
 *   node scripts/import-data.js --dry-run    # preview only
 *   node scripts/import-data.js profiles     # import specific table
 *   node scripts/import-data.js notes,schedule_items  # multiple tables
 *
 * Prerequisites:
 *   1. Run export-old-data.sql in old project SQL Editor
 *   2. Save results as scripts/export/<table>.json
 *   3. Set NEW_SUPABASE_URL and NEW_SERVICE_ROLE_KEY in .env
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_TABLES = process.argv.filter(a => !a.startsWith('-') && a !== 'node' && a !== __filename.split('/').pop() && a !== __filename.split('\\').pop());

// ── Load .env ───────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnv();

const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SERVICE_ROLE_KEY;

if (!NEW_URL || !NEW_KEY) {
  console.error('❌ Missing NEW_SUPABASE_URL or NEW_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const EXPORT_DIR = path.join(__dirname, 'export');

// ── Table definitions ───────────────────────────────────────────────────

const TABLES = [
  {
    name: 'profiles',
    file: 'profiles.json',
    extract: (d) => d.profiles || d,
    idField: 'id',
    description: 'User profiles (names, schools, avatars)',
    sanitize: (row) => ({
      id: row.id,
      full_name: row.full_name || 'Scholar',
      email: row.email,
      avatar_url: row.avatar_url || null,
      school: row.school || null,
      points_balance: row.points_balance || 0,
      academic_tier: row.academic_tier || null,
      academic_level: row.academic_level || null,
      onboarding_completed: row.onboarding_completed || false,
      referral_code: row.referral_code || null,
      referred_by: row.referred_by || null,
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
    }),
  },
  {
    name: 'social_users',
    file: 'social_users.json',
    extract: (d) => d.social_users || d,
    idField: 'id',
    description: 'Social user profiles',
    sanitize: (row) => ({
      id: row.id,
      username: row.username || row.id?.slice(0, 8) || 'user',
      display_name: row.display_name || 'Scholar',
      avatar_url: row.avatar_url || null,
      bio: row.bio || 'New to the community!',
      interests: row.interests || ['learning'],
      is_verified: row.is_verified || false,
      is_contributor: row.is_contributor || false,
      followers_count: row.followers_count || 0,
      following_count: row.following_count || 0,
      posts_count: row.posts_count || 0,
      last_active: row.last_active || row.created_at || new Date().toISOString(),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      email: row.email,
      is_public: row.is_public !== false,
      status: row.status || 'active',
      last_login_at: row.last_login_at || null,
      last_logout_at: row.last_logout_at || null,
    }),
  },
  {
    name: 'notes',
    file: 'notes.json',
    extract: (d) => d.notes || d,
    idField: 'id',
    description: 'User notes',
    sanitize: (row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title || 'Untitled',
      content: row.content || '',
      category: row.category || 'General',
      tags: row.tags || [],
      document_id: row.document_id || null,
      ai_summary: row.ai_summary || null,
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
    }),
  },
  {
    name: 'documents',
    file: 'documents.json',
    extract: (d) => d.documents || d,
    idField: 'id',
    description: 'Uploaded documents',
    sanitize: (row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title || 'Untitled',
      file_name: row.file_name || '',
      type: row.type || 'unknown',
      file_size: row.file_size || 0,
      processing_status: row.processing_status || 'completed',
      content_extracted: row.content_extracted || null,
      folder_id: row.folder_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
    }),
  },
  {
    name: 'quizzes',
    file: 'quizzes.json',
    extract: (d) => d.quizzes || d,
    idField: 'id',
    description: 'Quizzes',
    sanitize: (row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title || 'Quiz',
      source_type: row.source_type || 'ai',
      questions: row.questions || [],
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
    }),
  },
  {
    name: 'quiz_attempts',
    file: 'quiz_attempts.json',
    extract: (d) => d.quiz_attempts || d,
    idField: 'id',
    description: 'Quiz attempts',
    sanitize: (row) => ({
      id: row.id,
      quiz_id: row.quiz_id,
      user_id: row.user_id,
      score: row.score || 0,
      total_questions: row.total_questions || 1,
      percentage: row.percentage || 0,
      time_taken_seconds: row.time_taken_seconds || 0,
      answers: row.answers || [],
      xp_earned: row.xp_earned || 0,
      created_at: row.created_at,
    }),
  },
  {
    name: 'schedule_items',
    file: 'schedule_items.json',
    extract: (d) => d.schedule_items || d,
    idField: 'id',
    description: 'Schedule items',
    sanitize: (row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title || 'Event',
      description: row.description || null,
      start_time: row.start_time,
      end_time: row.end_time,
      color: row.color || '#3b82f6',
      recurrence: row.recurrence || null,
      created_at: row.created_at,
    }),
  },
  {
    name: 'chat_sessions',
    file: 'chat_sessions.json',
    extract: (d) => d.chat_sessions || d,
    idField: 'id',
    description: 'Chat sessions',
    sanitize: (row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title || 'Chat',
      document_ids: row.document_ids || [],
      message_count: row.message_count || 0,
      last_message_at: row.last_message_at || row.created_at,
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
    }),
  },
  {
    name: 'user_stats',
    file: 'user_stats.json',
    extract: (d) => d.user_stats || d,
    idField: 'user_id',
    description: 'User stats (XP, levels, streaks)',
    sanitize: (row) => ({
      user_id: row.user_id,
      total_xp: row.total_xp || 0,
      level: row.level || 1,
      quizzes_taken: row.quizzes_taken || 0,
      avg_score: row.avg_score || 0,
      current_streak: row.current_streak || 0,
      longest_streak: row.longest_streak || 0,
      credits_balance: row.credits_balance || 0,
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
    }),
  },
  {
    name: 'class_recordings',
    file: 'class_recordings.json',
    extract: (d) => d.class_recordings || d,
    idField: 'id',
    description: 'Class recordings',
  },
  {
    name: 'ai_podcasts',
    file: 'ai_podcasts.json',
    extract: (d) => d.ai_podcasts || d,
    idField: 'id',
    description: 'AI podcasts',
  },
  {
    name: 'flashcards',
    file: 'flashcards.json',
    extract: (d) => d.flashcards || d,
    idField: 'id',
    description: 'Flashcards',
  },
  {
    name: 'user_subscriptions',
    file: 'subscriptions.json',
    extract: (d) => d.subscriptions || d,
    idField: 'id',
    description: 'User subscriptions',
  },
  {
    name: 'achievements',
    file: 'achievements.json',
    extract: (d) => d.achievements || d,
    idField: 'id',
    description: 'User achievements/badges',
  },
];

// ── Supabase REST helper ────────────────────────────────────────────────

async function insertBatch(table, rows) {
  const res = await fetch(`${NEW_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': NEW_KEY,
      'Authorization': `Bearer ${NEW_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return rows.length;
}

// ── Load JSON file ──────────────────────────────────────────────────────

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Handle SQL editor format: [{ "table_name": [...] }]
  if (Array.isArray(raw) && raw.length > 0) {
    const firstKey = Object.keys(raw[0])[0];
    if (firstKey && Array.isArray(raw[0][firstKey])) {
      return raw[0][firstKey];
    }
  }
  // Handle { "table_name": [...] } format
  if (!Array.isArray(raw)) {
    const key = Object.keys(raw)[0];
    if (Array.isArray(raw[key])) return raw[key];
  }
  // Already an array
  return raw;
}

// ── Import a single table ───────────────────────────────────────────────

async function importTable(tableDef) {
  const filePath = path.join(EXPORT_DIR, tableDef.file);
  const rows = loadJson(filePath);

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    console.log(`   ⏭️  ${tableDef.name} — no data (${tableDef.file} missing or empty)`);
    return { imported: 0, skipped: 0, failed: 0 };
  }

  // Sanitize rows: remove null values to avoid overwriting with null
  const sanitizedRows = tableDef.sanitize ? rows.map(tableDef.sanitize) : rows;

  console.log(`   📥 ${tableDef.name} — ${sanitizedRows.length} rows (${tableDef.description})`);

  if (DRY_RUN) {
    console.log(`      Preview: ${sanitizedRows.length} rows would be imported`);
    return { imported: sanitizedRows.length, skipped: 0, failed: 0 };
  }

  // Batch insert (Supabase supports up to 1000 rows per request)
  const BATCH_SIZE = 500;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < sanitizedRows.length; i += BATCH_SIZE) {
    const batch = sanitizedRows.slice(i, i + BATCH_SIZE);
    try {
      await insertBatch(tableDef.name, batch);
      imported += batch.length;
      process.stdout.write(`      Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows ✅\n`);
    } catch (error) {
      console.error(`      Batch ${Math.floor(i / BATCH_SIZE) + 1}: ❌ ${error.message}`);
      failed += batch.length;
    }

    // Rate limit
    if (i + BATCH_SIZE < rows.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return { imported, skipped: 0, failed };
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Import Data from Old Project                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Target: ${NEW_URL}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Export dir: ${EXPORT_DIR}`);
  console.log('');

  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    console.log('📁 Created scripts/export/ directory');
    console.log('   Run the SQL queries from export-old-data.sql in the old project');
    console.log('   and save each result as scripts/export/<table>.json');
    console.log('');
    process.exit(0);
  }

  // Filter tables if specific ones requested
  const tablesToImport = SPECIFIC_TABLES.length > 0
    ? TABLES.filter(t => SPECIFIC_TABLES.includes(t.name))
    : TABLES;

  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const table of tablesToImport) {
    const result = await importTable(table);
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Import Complete!');
  console.log('═'.repeat(60));
  console.log(`   ✅ Imported: ${totalImported} rows`);
  console.log(`   ⏭️  Skipped:  ${totalSkipped}`);
  console.log(`   ❌ Failed:   ${totalFailed}`);
  console.log('');
}

main().catch(err => {
  console.error('💥 Import failed:', err);
  process.exit(1);
});
