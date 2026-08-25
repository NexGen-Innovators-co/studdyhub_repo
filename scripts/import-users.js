#!/usr/bin/env node
/**
 * Import Users from SQL Editor Export
 *
 * Reads old_users.json and old_profiles.json (exported from SQL Editor)
 * and creates users in the new Supabase project.
 *
 * Usage:
 *   node scripts/import-users.js
 *   node scripts/import-users.js --dry-run
 *
 * Prerequisites:
 *   1. Run the SQL queries in old project's SQL Editor
 *   2. Save the JSON output as scripts/old_users.json
 *   3. Save the profiles JSON as scripts/old_profiles.json (optional)
 *   4. Set env vars in .env (NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY)
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Load Config ─────────────────────────────────────────────────────────

// Load .env file manually
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

// ── API Helper ──────────────────────────────────────────────────────────

async function createUser(user) {
  const payload = {
    email: user.email,
    email_confirm: !!user.email_confirmed_at,
    phone_confirm: !!user.phone_confirmed_at,
    password: 'TempPassword2026!',
    password_confirm: 'TempPassword2026!',
    app_metadata: user.raw_app_meta_data || {},
    user_metadata: user.raw_user_meta_data || {},
    banned: false,
    role: user.role || 'authenticated',
  };

  const res = await fetch(`${NEW_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': NEW_KEY,
      'Authorization': `Bearer ${NEW_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }
  return data;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     User Import from SQL Editor Export                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Load users
  const usersPath = path.join(__dirname, 'old_users.json');
  if (!fs.existsSync(usersPath)) {
    console.error('❌ File not found: scripts/old_users.json');
    console.error('');
    console.error('Instructions:');
    console.error('  1. Go to old project SQL Editor');
    console.error('  2. Run the export SQL query');
    console.error('  3. Copy the JSON output');
    console.error('  4. Save as scripts/old_users.json');
    process.exit(1);
  }

  let rawData = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

  // SQL Editor returns: [{ "users": [...] }]
  // Handle all possible formats
  let users;
  if (Array.isArray(rawData) && rawData.length > 0 && rawData[0].users) {
    // Format: [{ users: [...] }]  (from SQL editor JSON Agg)
    users = rawData[0].users;
  } else if (Array.isArray(rawData)) {
    users = rawData;
  } else if (rawData.users) {
    users = rawData.users;
  } else {
    console.error('❌ Unexpected JSON format. Expected [{"users": [...]}]');
    console.error('   Got:', typeof rawData, Object.keys(rawData));
    process.exit(1);
  }

  // Ensure users is an array
  if (!Array.isArray(users)) {
    console.error('❌ Users data is not an array:', typeof users);
    process.exit(1);
  }

  console.log(`📥 Loaded ${users.length} users from old_users.json`);

  // Load profiles (optional)
  let profiles = [];
  const profilesPath = path.join(__dirname, 'old_profiles.json');
  if (fs.existsSync(profilesPath)) {
    let profileData = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
    if (Array.isArray(profileData) && profileData.length > 0 && profileData[0].profiles) {
      profiles = profileData[0].profiles;
    } else if (Array.isArray(profileData)) {
      profiles = profileData;
    } else if (profileData.profiles) {
      profiles = profileData.profiles;
    }
    console.log(`📥 Loaded ${profiles.length} profiles from old_profiles.json`);
  } else {
    console.log('ℹ️  No old_profiles.json found (optional)');
  }

  // Build profile lookup
  const profileMap = {};
  for (const p of profiles) {
    profileMap[p.id] = p;
  }

  // Filter valid users
  const validUsers = users.filter(u => u.email);
  console.log(`\n📊 Summary:`);
  console.log(`   Total in export: ${users.length}`);
  console.log(`   With email: ${validUsers.length}`);
  console.log(`   Without email (skipped): ${users.length - validUsers.length}`);
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN — Preview of first 10 users:');
    console.log('─'.repeat(70));
    for (const u of validUsers.slice(0, 10)) {
      const profile = profileMap[u.id];
      const name = profile?.full_name || u.raw_user_meta_data?.full_name || '';
      const provider = u.raw_app_meta_data?.provider || 'email';
      console.log(`   ${u.email} | ${name} | ${provider} | confirmed: ${!!u.email_confirmed_at}`);
    }
    if (validUsers.length > 10) console.log(`   ... and ${validUsers.length - 10} more`);
    console.log('');
    console.log('Run without --dry-run to import.');
    return;
  }

  // Import users
  console.log('🚀 Starting import...\n');

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < validUsers.length; i++) {
    const user = validUsers[i];
    const progress = `[${i + 1}/${validUsers.length}]`;
    const profile = profileMap[user.id];
    const name = profile?.full_name || user.raw_user_meta_data?.full_name || '';

    try {
      const result = await createUser(user);
      console.log(`   ${progress} ✅ ${user.email} ${name ? '(' + name + ')' : ''}`);
      created++;
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('already') || msg.includes('already_exists')) {
        console.log(`   ${progress} ⏭️  ${user.email} (already exists)`);
        skipped++;
      } else {
        console.log(`   ${progress} ❌ ${user.email} — ${msg}`);
        failed++;
        errors.push({ email: user.email, error: msg });
      }
    }

    // Rate limit: 100ms between requests
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Import Complete!');
  console.log('═'.repeat(60));
  console.log(`   ✅ Created:  ${created}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   ❌ Failed:   ${failed}`);

  if (errors.length > 0) {
    console.log('\n❌ Failed users:');
    for (const e of errors) {
      console.log(`   ${e.email}: ${e.error}`);
    }
  }

  console.log('\n⚠️  Next steps:');
  console.log('   1. Users will need to reset passwords via "Forgot Password"');
  console.log('   2. Update web/.env.local and mobile/.env to new project URL');
  console.log('   3. Redeploy web app on Vercel');
  console.log('');
}

main().catch(err => {
  console.error('💥 Import failed:', err);
  process.exit(1);
});
