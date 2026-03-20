#!/usr/bin/env node
/**
 * fix-aichat-casing.cjs
 *
 * Fixes the TypeScript TS1261 error:
 * "Already included file ... differs from file name ... only in casing"
 *
 * Root cause:
 *   - All actual files live in  src/modules/aiChat/Components/  (capital C)
 *   - A ghost  src/modules/aiChat/components/index.ts  (lowercase) also exists
 *   - TypeScript treats them as different files; on case-insensitive Windows
 *     they map to the same inode, causing the conflict
 *
 * Fix (3 steps):
 *   1. Rewrite every import string that says "aiChat/Components" (capital C)
 *      to "aiChat/components" (lowercase) — aligns with every other module
 *   2. On-disk: rename Components/ → Components_tmp/ → components/
 *      (two-step required on Windows for a case-only rename)
 *   3. Delete the ghost lowercase index.ts if it is a duplicate
 *
 * Usage (from project root):
 *   node fix-aichat-casing.cjs --dry-run    preview
 *   node fix-aichat-casing.cjs              apply
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN      = process.argv.includes('--dry-run');
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const SOURCE_EXTS  = ['.ts', '.tsx', '.js', '.jsx'];

function rel(p)     { return path.relative(PROJECT_ROOT, p).replace(/\\/g, '/'); }
function exists(p)  { return fs.existsSync(p); }
function read(p)    { return fs.readFileSync(p, 'utf8'); }
function write(p,c) { if (!DRY_RUN) fs.writeFileSync(p, c, 'utf8'); }

function walkDir(dir) {
  const out = [];
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules','dist','.git','build'].includes(e)) continue;
      out.push(...walkDir(full));
    } else if (SOURCE_EXTS.some(x => full.endsWith(x))) {
      out.push(full);
    }
  }
  return out;
}

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run — nothing written.' : '🔧  Fixing aiChat Components/ casing…');
console.log('');

const UPPER_DIR = path.join(SRC_DIR, 'modules', 'aiChat', 'Components');
const LOWER_DIR = path.join(SRC_DIR, 'modules', 'aiChat', 'components');
const TMP_DIR   = path.join(SRC_DIR, 'modules', 'aiChat', 'Components_tmp');

// ── Step 1: Rewrite all import strings before touching the filesystem ─────────

console.log('── Step 1: rewriting import strings (Components → components)\n');

const allFiles = walkDir(SRC_DIR);
let patched = 0;

// Patterns to replace (covers relative and @/ alias forms):
//   ../aiChat/Components/X   → ../aiChat/components/X
//   @/modules/aiChat/Components/X  → @/modules/aiChat/components/X
//   ./Components/X   (inside aiChat itself)  → ./components/X
//   from './Components'  → from './components'
const REPLACEMENTS = [
  // @/ alias
  [/@\/modules\/aiChat\/Components\//g,  '@/modules/aiChat/components/'],
  [/@\/modules\/aiChat\/Components(['"])/g,'@/modules/aiChat/components$1'],
  // relative paths ending with /Components/
  [/(\.\.?\/(?:[^'"]*\/)?)aiChat\/Components\//g, '$1aiChat/components/'],
  // ./Components/ inside aiChat folder itself
  [/(['"])\.\/Components\//g, "$1./components/"],
  [/(['"])\.\/Components(['"])/g,"$1./components$2"],
  // ../Components/ one level up inside aiChat
  [/(['"])\.\.\/Components\//g,"$1../components/"],
  [/(['"])\.\.\/Components(['"])/g,"$1../components$2"],
];

for (const file of allFiles) {
  const original = read(file);
  let updated = original;

  for (const [pattern, replacement] of REPLACEMENTS) {
    updated = updated.replace(pattern, replacement);
  }

  if (updated !== original) {
    write(file, updated);
    console.log(`   ${DRY_RUN ? '[dry] ' : '✓ '}patched: ${rel(file)}`);
    patched++;
  }
}

console.log(`\n   ${DRY_RUN ? 'Would patch' : 'Patched'} ${patched} file(s).\n`);

// ── Step 2: Rename the folder on disk (two-step for Windows case rename) ──────

console.log('── Step 2: renaming folder on disk\n');

if (exists(UPPER_DIR)) {
  // Check if lowercase already exists as a DIFFERENT physical directory
  // On Windows they are the same; on Linux/Mac they can be different
  const upperReal = fs.realpathSync(UPPER_DIR);
  let lowerReal   = null;
  try { lowerReal = exists(LOWER_DIR) ? fs.realpathSync(LOWER_DIR) : null; } catch(e){}

  const areSameDir = lowerReal && (upperReal.toLowerCase() === lowerReal.toLowerCase());

  if (areSameDir || !lowerReal) {
    // Same physical dir (Windows) or lowercase doesn't exist yet
    // Use two-step rename: Components → Components_tmp → components
    if (!DRY_RUN) {
      fs.renameSync(UPPER_DIR, TMP_DIR);   // step A: Capital → tmp
      fs.renameSync(TMP_DIR,   LOWER_DIR); // step B: tmp → lowercase
      console.log('   ✓ Components/ → Components_tmp/ → components/ (two-step)');
    } else {
      console.log('   [dry] would rename: Components/ → components/ (via tmp)');
    }
  } else {
    // Two different physical directories — merge lower into upper files,
    // then rename upper to lower after deleting the ghost lower dir
    console.log('   ⚠  Two physically distinct directories exist. Merging…');
    const lowerFiles = fs.readdirSync(LOWER_DIR);
    for (const f of lowerFiles) {
      const src = path.join(LOWER_DIR, f);
      const dst = path.join(UPPER_DIR, f);
      if (!exists(dst)) {
        if (!DRY_RUN) fs.renameSync(src, dst);
        console.log(`   ${DRY_RUN ? '[dry] move' : '✓ moved'}: ${f} → Components/${f}`);
      } else {
        console.log(`   skip (exists in both): ${f}`);
      }
    }
    // Remove now-empty lowercase dir
    if (!DRY_RUN) {
      try { fs.rmdirSync(LOWER_DIR); } catch(e){}
    }
    // Now do the two-step rename
    if (!DRY_RUN) {
      fs.renameSync(UPPER_DIR, TMP_DIR);
      fs.renameSync(TMP_DIR,   LOWER_DIR);
      console.log('   ✓ Merged and renamed to components/');
    } else {
      console.log('   [dry] would merge and rename to components/');
    }
  }
} else if (exists(LOWER_DIR)) {
  console.log('   ✓ components/ (lowercase) already exists — no rename needed.');
} else {
  console.log('   ✗ Neither Components/ nor components/ found — check path.');
}

// ── Step 3: Remove ghost index.ts if it is a bare duplicate ──────────────────

console.log('\n── Step 3: checking for ghost index.ts\n');

// After rename, components/ is canonical. Check if there's a stale
// ghost index.ts that duplicates the real one.
const ghostIndex = path.join(LOWER_DIR, 'index.ts');
const realIndex  = ghostIndex; // same path after rename — nothing to do

// The ghost was only a problem when it lived at a DIFFERENT path.
// If fix-module-structure.cjs had created a second index.ts somewhere, list it.
const possibleGhosts = [
  path.join(SRC_DIR, 'modules', 'aiChat', 'components', 'index.ts'),
];

for (const g of possibleGhosts) {
  if (exists(g)) {
    const content = read(g);
    // If it's an auto-generated barrel that just re-exports everything, it's fine
    console.log(`   Found: ${rel(g)}`);
    console.log(`   Content preview:\n   ${content.slice(0,200).replace(/\n/g,'\n   ')}`);
    console.log('   → Keep this file — it is the module barrel.');
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(64));
console.log(DRY_RUN
  ? `\n  Dry-run: would patch ${patched} import(s) and rename the folder.\n`
  : `\n  Done. Patched ${patched} import(s). Folder renamed to components/.\n`);
console.log('  Next: run   npx tsc --noEmit   — the casing error should be gone.');
console.log('═'.repeat(64));
console.log('');
