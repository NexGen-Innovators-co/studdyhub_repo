#!/usr/bin/env node
/**
 * fix-all-broken-imports.cjs
 *
 * The definitive import fixer. Unlike the previous scripts that matched
 * patterns like "/components/", this one works purely from the filesystem:
 *
 *  1. Indexes every source file that currently exists on disk (full path map)
 *  2. For every import in every file, tries to resolve it to a real file
 *  3. If resolution FAILS → broken import → looks up the target by basename
 *     in the full file index and computes the correct new path
 *  4. Rewrites only what is genuinely broken — never touches working imports
 *
 * This catches everything:
 *   - Old @/components/ paths not yet rewritten
 *   - Relative ../../../ paths broken by folder restructure
 *   - Cross-module imports pointing at wrong locations
 *   - Anything else that simply doesn't resolve on disk
 *
 * Usage (from the project root beside src/):
 *   node fix-all-broken-imports.cjs            ← apply all fixes
 *   node fix-all-broken-imports.cjs --dry-run  ← preview, write nothing
 *   node fix-all-broken-imports.cjs --verbose  ← show every rewrite detail
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN      = process.argv.includes('--dry-run');
const VERBOSE      = process.argv.includes('--verbose');
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const SOURCE_EXTS  = ['.ts', '.tsx', '.js', '.jsx'];

// Bare names that are directory re-exports — never treat as broken
const SKIP_BASENAMES = new Set([
  'components','hooks','services','utils','config','extensions',
  'types','constants','feed','widgets','steps','onboarding',
  'institution','courses','index',
]);

// ── Walk all source files ─────────────────────────────────────────────────────

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

function stripExt(p) {
  return p.replace(/\.(ts|tsx|js|jsx)$/, '');
}

function rel(absPath) {
  return path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');
}

// ── Build the full file index ─────────────────────────────────────────────────
// fileIndex['UserManagement'] = ['/abs/.../admin/components/UserManagement.tsx']
// Multiple files can share a basename (StatsPanel etc.) — all are stored.

const allFiles = walkDir(SRC_DIR);
const fileSet  = new Set(allFiles.map(f => path.normalize(f)));

const fileIndex = {}; // basename (no ext) → AbsPath[]
for (const f of allFiles) {
  const base = path.basename(f, path.extname(f));
  if (base === 'index') continue;
  (fileIndex[base] = fileIndex[base] ?? []).push(f);
}

// ── Resolution logic ──────────────────────────────────────────────────────────

/**
 * Try to resolve an import string to an absolute path that exists on disk.
 * Returns the resolved absolute path, or null if nothing matches.
 */
function tryResolve(importStr, containingFile) {
  let base;
  if (importStr.startsWith('@/')) {
    base = path.join(SRC_DIR, importStr.slice(2));
  } else if (importStr.startsWith('.')) {
    base = path.join(path.dirname(containingFile), importStr);
  } else {
    return null; // node_modules — skip
  }

  // 1. Exact match (already has extension)
  if (fileSet.has(path.normalize(base))) return base;

  // 2. Try adding each source extension
  for (const ext of SOURCE_EXTS) {
    const c = base + ext;
    if (fileSet.has(path.normalize(c))) return c;
  }

  // 3. Try as directory index
  for (const ext of SOURCE_EXTS) {
    const c = path.join(base, 'index' + ext);
    if (fileSet.has(path.normalize(c))) return c;
  }

  return null; // broken
}

/**
 * Is this import even an internal one we should care about?
 * Returns false for node_modules imports.
 */
function isInternal(importStr) {
  return importStr.startsWith('.') || importStr.startsWith('@/');
}

/**
 * Given a module-of-X absolute path, return the top-level module name
 * (e.g. "quizzes", "social").
 */
function moduleOf(absPath) {
  const modulesDir = path.join(SRC_DIR, 'modules');
  if (!absPath.startsWith(modulesDir)) return '';
  const rel2 = path.relative(modulesDir, absPath).replace(/\\/g, '/');
  return rel2.split('/')[0] ?? '';
}

/**
 * Score a candidate file against an original broken import string and the
 * containing file, for disambiguation when multiple files share a basename.
 */
function score(candidate, importStr, containingFile) {
  let s = 0;
  // Strong same-module bonus
  if (moduleOf(candidate) === moduleOf(containingFile)) s += 100;
  // Path segment overlap
  const relCand = path.relative(SRC_DIR, candidate).replace(/\\/g, '/');
  const segs    = new Set(relCand.split('/'));
  for (const part of importStr.split('/').concat(importStr.split('\\'))) {
    if (part && segs.has(part)) s++;
  }
  return s;
}

function pickBest(candidates, importStr, containingFile) {
  if (candidates.length === 1) return candidates[0];
  return candidates.reduce((best, c) =>
    score(c, importStr, containingFile) > score(best, importStr, containingFile) ? c : best
  );
}

/**
 * Build the correct new import string pointing from containingFile to targetAbs.
 * If the original import used @/, keep using @/.
 */
function buildNewImport(originalImport, targetAbs, containingFile) {
  if (originalImport.startsWith('@/')) {
    const relToSrc = path.relative(SRC_DIR, targetAbs).replace(/\\/g, '/');
    return '@/' + stripExt(relToSrc);
  } else {
    let r = path.relative(path.dirname(containingFile), targetAbs).replace(/\\/g, '/');
    r = stripExt(r);
    if (!r.startsWith('.')) r = './' + r;
    return r;
  }
}

// ── Process files ─────────────────────────────────────────────────────────────

const STATIC_RE  = /((?:import|export)[\s\S]*?\bfrom\s*['"])([^'"]+?)(['"])/g;
const DYNAMIC_RE = /(\bimport\s*\(\s*['"])([^'"]+?)(['"]\s*\))/g;

// Track everything for the summary
const allBroken   = []; // { file, importStr, newImport }  — fixed
const unresolved  = []; // { file, importStr }              — couldn't fix
let   filesChanged = 0;

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const fileRel  = rel(filePath);
  let   updated  = original;
  const fixes    = [];
  const cant     = [];

  function replacer(match, prefix, importStr, suffix) {
    if (!isInternal(importStr)) return match;

    // Already resolves fine → leave it alone
    if (tryResolve(importStr, filePath)) return match;

    // Get the target basename
    const base = stripExt(path.basename(importStr));
    if (!base || SKIP_BASENAMES.has(base)) return match; // directory re-export

    // Look up in file index
    const candidates = fileIndex[base];
    if (!candidates?.length) {
      cant.push(importStr);
      return match; // can't fix — will appear in unresolved report
    }

    const target    = pickBest(candidates, importStr, filePath);
    const newImport = buildNewImport(importStr, target, filePath);

    fixes.push({ importStr, newImport, target: rel(target) });
    return `${prefix}${newImport}${suffix}`;
  }

  updated = updated.replace(STATIC_RE,  replacer);
  updated = updated.replace(DYNAMIC_RE, replacer);

  // Collect for summary
  fixes.forEach(f => allBroken.push({ file: fileRel, ...f }));
  cant .forEach(s => unresolved.push({ file: fileRel, importStr: s }));

  if (updated !== original) {
    if (VERBOSE) {
      console.log(`\n  ${fileRel}`);
      fixes.forEach(f => {
        console.log(`    - ${f.importStr}`);
        console.log(`    + ${f.newImport}`);
      });
    }
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, updated, 'utf8');
    }
    console.log(`${DRY_RUN ? '[dry-run] ' : '✓ '}${fileRel}  (${fixes.length} fix${fixes.length>1?'es':''})`);
    filesChanged++;
    return true;
  }

  // Even if no content changed, report cant-fix items
  if (cant.length && VERBOSE) {
    console.log(`\n  ${fileRel}`);
    cant.forEach(s => console.log(`    ✗ unresolvable: ${s}`));
  }

  return false;
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run – nothing will be written.' : '🔧  Resolving all broken imports…');
console.log(`    Project root : ${PROJECT_ROOT}`);
console.log(`    Files indexed: ${allFiles.length}`);
console.log('');

if (!fs.existsSync(SRC_DIR)) {
  console.error('ERROR: src/ not found. Run from the project root.');
  process.exit(1);
}

for (const f of allFiles) processFile(f);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
console.log('═'.repeat(64));

if (allBroken.length) {
  console.log(`\n  Fixed ${allBroken.length} broken import(s) across ${filesChanged} file(s):\n`);
  // Group by file
  const byFile = {};
  allBroken.forEach(b => (byFile[b.file] = byFile[b.file] ?? []).push(b));
  for (const [file, fixes] of Object.entries(byFile)) {
    console.log(`  ${file}`);
    fixes.forEach(f => console.log(`    ${f.importStr}  →  ${f.newImport}`));
    console.log('');
  }
}

if (unresolved.length) {
  const unique = [...new Map(unresolved.map(u => [u.file+u.importStr, u])).values()];
  console.log(`  ⚠  ${unique.length} import(s) could NOT be auto-fixed (file not found anywhere in src/):\n`);
  unique.forEach(u => console.log(`  ${u.file}\n    ✗ ${u.importStr}\n`));
}

if (allBroken.length === 0 && unresolved.length === 0) {
  console.log('\n  ✓ No broken imports found — everything resolves correctly!\n');
}

console.log('═'.repeat(64));
console.log('');

if (!DRY_RUN && filesChanged > 0) {
  console.log('Next: run   npx tsc --noEmit   to confirm zero TypeScript errors.');
  console.log('');
}
