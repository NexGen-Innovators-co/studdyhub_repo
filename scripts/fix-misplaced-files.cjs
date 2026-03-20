#!/usr/bin/env node
/**
 * fix-misplaced-files.cjs
 *
 * Fixes the 4 structural issues found in the dependency analysis:
 *
 *  1. admin/hooks/UserManagement.tsx        → admin/components/UserManagement.tsx
 *  2. userSettings/hooks/UserSettings.tsx   → userSettings/components/UserSettings.tsx
 *  3. subscription/services/PodcastCreditStore.tsx → subscription/components/PodcastCreditStore.tsx
 *  4. userSettings/components.tsx/LearningGoals.tsx → userSettings/components/LearningGoals.tsx
 *     (the folder was literally named "components.tsx" — renames it to "components")
 *
 * For every move it:
 *   a) Physically moves the file to the correct folder
 *   b) Scans ALL source files and rewrites any import that pointed to the old path
 *
 * Usage (run from the project root, next to src/):
 *   node fix-misplaced-files.cjs            ← apply all fixes
 *   node fix-misplaced-files.cjs --dry-run  ← preview, nothing written/moved
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN      = process.argv.includes('--dry-run');
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const SOURCE_EXTS  = ['.ts', '.tsx', '.js', '.jsx'];

// ── Moves to perform ──────────────────────────────────────────────────────────
// Each entry: { from: relative-to-src, to: relative-to-src }

const MOVES = [
  {
    from: 'modules/admin/hooks/UserManagement.tsx',
    to:   'modules/admin/components/UserManagement.tsx',
    note: 'React component was misplaced inside hooks/',
  },
  {
    from: 'modules/userSettings/hooks/UserSettings.tsx',
    to:   'modules/userSettings/components/UserSettings.tsx',
    note: 'React component was misplaced inside hooks/',
  },
  {
    from: 'modules/subscription/services/PodcastCreditStore.tsx',
    to:   'modules/subscription/components/PodcastCreditStore.tsx',
    note: 'React component was misplaced inside services/',
  },
  {
    from: 'modules/userSettings/components.tsx/LearningGoals.tsx',
    to:   'modules/userSettings/components/LearningGoals.tsx',
    note: 'Folder was named "components.tsx" (with extension) — fixed to "components"',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkDir(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules','dist','.git','build','coverage'].includes(entry)) continue;
      out.push(...walkDir(full));
    } else if (SOURCE_EXTS.some(e => full.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function rel(absPath) {
  return path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');
}

function stripExt(p) {
  return p.replace(/\.(ts|tsx|js|jsx)$/, '');
}

/**
 * Given two absolute paths (old location → new location) rewrite every
 * import/export in `fileContent` that resolves to `oldAbs` so it now
 * points to `newAbs`, computing the correct relative path from `containingFile`.
 */
function rewriteImportsInFile(fileContent, containingFile, oldAbs, newAbs) {
  const STATIC_RE  = /((?:import|export)[\s\S]*?\bfrom\s*['"])([^'"]+?)(['"])/g;
  const DYNAMIC_RE = /(\bimport\s*\(\s*['"])([^'"]+?)(['"]\s*\))/g;

  let changed = false;

  function replacer(match, prefix, importStr, suffix) {
    // Resolve the import to an absolute path
    let base;
    if (importStr.startsWith('@/')) {
      base = path.join(SRC_DIR, importStr.slice(2));
    } else if (importStr.startsWith('.')) {
      base = path.join(path.dirname(containingFile), importStr);
    } else {
      return match; // node_modules
    }

    // Try with and without extensions, and as index file
    const candidates = [
      base,
      ...SOURCE_EXTS.map(e => base + e),
      ...SOURCE_EXTS.map(e => path.join(base, 'index' + e)),
    ];

    const resolved = candidates.find(c => {
      // normalise both sides before comparing
      return path.normalize(c) === path.normalize(oldAbs);
    });

    if (!resolved) return match; // this import doesn't point to the moved file

    // Build the new import string
    let newImport;
    if (importStr.startsWith('@/')) {
      newImport = '@/' + stripExt(path.relative(SRC_DIR, newAbs).replace(/\\/g, '/'));
    } else {
      let r = path.relative(path.dirname(containingFile), newAbs).replace(/\\/g, '/');
      r = stripExt(r);
      if (!r.startsWith('.')) r = './' + r;
      newImport = r;
    }

    changed = true;
    return `${prefix}${newImport}${suffix}`;
  }

  let updated = fileContent.replace(STATIC_RE,  replacer);
  updated     = updated    .replace(DYNAMIC_RE, replacer);
  return { updated, changed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run – nothing will be written or moved.' : '🔧  Fixing misplaced files…');
console.log('');

// Validate: check which source files actually exist before doing anything
const validated = [];
const missing   = [];

for (const move of MOVES) {
  const fromAbs = path.join(SRC_DIR, move.from);
  const toAbs   = path.join(SRC_DIR, move.to);
  if (fs.existsSync(fromAbs)) {
    validated.push({ ...move, fromAbs, toAbs });
  } else if (fs.existsSync(toAbs)) {
    console.log(`✓ Already in place: ${move.to}`);
  } else {
    missing.push(move.from);
  }
}

if (missing.length) {
  console.log('\n⚠  Could not find these files (already moved, or path is different):');
  missing.forEach(m => console.log('   ' + m));
  console.log('');
}

if (validated.length === 0) {
  console.log('Nothing to do — all files are already in the correct location.\n');
  process.exit(0);
}

console.log('Files to move:');
validated.forEach(m => {
  console.log(`  ${m.from}`);
  console.log(`  → ${m.to}`);
  console.log(`  (${m.note})`);
  console.log('');
});

// ── Step 1: Update all imports BEFORE moving (paths resolve while files still exist) ──

const allSourceFiles = walkDir(SRC_DIR);
let totalFilesPatched = 0;

for (const move of validated) {
  const { fromAbs, toAbs } = move;
  let patchedForThisMove   = 0;

  console.log(`── Updating imports: ${path.basename(move.from)}`);

  for (const sourceFile of allSourceFiles) {
    const content = fs.readFileSync(sourceFile, 'utf8');
    const { updated, changed } = rewriteImportsInFile(content, sourceFile, fromAbs, toAbs);

    if (changed) {
      patchedForThisMove++;
      const display = rel(sourceFile);
      if (!DRY_RUN) {
        fs.writeFileSync(sourceFile, updated, 'utf8');
        console.log(`   ✓ patched: ${display}`);
      } else {
        console.log(`   [dry-run] would patch: ${display}`);
      }
    }
  }

  if (patchedForThisMove === 0) {
    console.log('   (no files import this — still moving it to the correct folder)');
  }
  totalFilesPatched += patchedForThisMove;
  console.log('');
}

// ── Step 2: Physically move the files ─────────────────────────────────────────

console.log('── Moving files');

for (const { from, fromAbs, toAbs, note } of validated) {
  // Ensure the destination folder exists
  const destDir = path.dirname(toAbs);

  if (!DRY_RUN) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.renameSync(fromAbs, toAbs);
    console.log(`   ✓ moved: ${from} → ${path.relative(SRC_DIR, toAbs).replace(/\\/g, '/')}`);
  } else {
    console.log(`   [dry-run] would move: ${from}`);
    console.log(`             → ${path.relative(SRC_DIR, toAbs).replace(/\\/g, '/')}`);
  }
}

// ── Step 3: Clean up the empty "components.tsx" folder if it exists ────────────

const badFolder = path.join(SRC_DIR, 'modules/userSettings/components.tsx');
if (fs.existsSync(badFolder)) {
  let empty = true;
  try {
    const remaining = fs.readdirSync(badFolder);
    if (remaining.length > 0) {
      console.log(`\n⚠  "components.tsx" folder still has files after move: ${remaining.join(', ')}`);
      console.log('   Check and remove manually if needed.');
      empty = false;
    }
  } catch (e) { /* ignore */ }

  if (empty) {
    if (!DRY_RUN) {
      fs.rmdirSync(badFolder);
      console.log('\n   ✓ removed empty folder: modules/userSettings/components.tsx');
    } else {
      console.log('\n   [dry-run] would remove empty folder: modules/userSettings/components.tsx');
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
console.log('─'.repeat(60));
console.log(DRY_RUN
  ? `Dry-run complete.  ${validated.length} file(s) would be moved, ${totalFilesPatched} import(s) updated.`
  : `Done.  ${validated.length} file(s) moved, ${totalFilesPatched} import reference(s) updated.`);
console.log('─'.repeat(60));
console.log('');

if (!DRY_RUN) {
  console.log('Next steps:');
  console.log('  1. Run:  npx tsc --noEmit   to verify no remaining type errors');
  console.log('  2. Check each module\'s index.ts barrel file exports are still correct');
  console.log('  3. Run your dev server to confirm nothing is broken');
  console.log('');
}
