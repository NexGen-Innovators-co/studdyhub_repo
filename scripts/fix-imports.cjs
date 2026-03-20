#!/usr/bin/env node
/**
 * fix-imports.cjs  (v2)
 *
 * Rewrites stale  src/components/...  import paths to the new
 * src/modules/...  locations after the folder restructure.
 *
 * Key improvements over v1:
 *   • Skips imports that ALREADY resolve to an existing file on disk
 *     (no false positives for correct paths like ./feed/X, ./components/X
 *      that still exist in the new module tree).
 *   • Skips bare-directory imports such as  export * from './components'
 *     (those are valid barrel re-exports and need no changes).
 *   • Same-module priority: when QuizHistory / StatsPanel / BadgesPanel
 *     exist in BOTH quizzes/ and classRecordings/, the one that lives in
 *     the same module as the importing file wins decisively.
 *   • Handles the @/ alias correctly for both old and new trees.
 *
 * Usage (from the project root, beside the src/ folder):
 *
 *   node fix-imports.cjs              -- apply all fixes
 *   node fix-imports.cjs --dry-run    -- preview only, nothing written
 *   node fix-imports.cjs --verbose    -- show each individual rewrite
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN      = process.argv.includes('--dry-run');
const VERBOSE      = process.argv.includes('--verbose');
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const MODULES_DIR  = path.join(SRC_DIR, 'modules');
const SOURCE_EXTS  = ['.ts', '.tsx', '.js', '.jsx'];

// Bare folder names that are legitimate directory re-exports — never remap these
const SKIP_BASENAMES = new Set([
  'components', 'hooks', 'services', 'utils', 'config',
  'extensions', 'types', 'constants', 'feed', 'widgets',
  'steps', 'onboarding', 'institution', 'courses',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkDir(dir, exts = SOURCE_EXTS) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) out.push(...walkDir(full, exts));
    else if (exts.some(e => full.endsWith(e))) out.push(full);
  }
  return out;
}

function stripExt(p) {
  return p.replace(/\.(ts|tsx|js|jsx)$/, '');
}

function tryResolve(importPath, containingFile) {
  let base;
  if (importPath.startsWith('@/')) {
    base = path.join(SRC_DIR, importPath.slice(2));
  } else if (importPath.startsWith('.')) {
    base = path.join(path.dirname(containingFile), importPath);
  } else {
    return null;
  }
  for (const ext of [...SOURCE_EXTS, '']) {
    const c = base + ext;
    if (fs.existsSync(c)) return c;
  }
  for (const ext of SOURCE_EXTS) {
    const c = path.join(base, 'index' + ext);
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function moduleOf(absPath) {
  const rel = path.relative(MODULES_DIR, absPath).replace(/\\/g, '/');
  return rel.split('/')[0] ?? '';
}

// ── Index modules/ ────────────────────────────────────────────────────────────

const moduleIndex = {};
for (const absPath of walkDir(MODULES_DIR)) {
  const base = path.basename(absPath, path.extname(absPath));
  if (base === 'index') continue;
  (moduleIndex[base] = moduleIndex[base] ?? []).push(absPath);
}

// ── Candidate selection ───────────────────────────────────────────────────────

function scoreCandidate(cand, importPath, importingModule) {
  let score = 0;
  if (moduleOf(cand) === importingModule) score += 100;
  const relCand = path.relative(SRC_DIR, cand).replace(/\\/g, '/');
  const segs    = new Set(relCand.split('/'));
  for (const part of importPath.split('/')) {
    if (part && segs.has(part)) score++;
  }
  return score;
}

function pickBestCandidate(candidates, importPath, containingFile) {
  if (candidates.length === 1) return candidates[0];
  const importingModule = moduleOf(containingFile);
  let best = candidates[0];
  let bestScore = scoreCandidate(candidates[0], importPath, importingModule);
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreCandidate(candidates[i], importPath, importingModule);
    if (s > bestScore) { bestScore = s; best = candidates[i]; }
  }
  return best;
}

// ── Rewrite logic ─────────────────────────────────────────────────────────────

function computeNewImport(importPath, containingFile) {
  const isOldRef =
    importPath.includes('/components/') ||
    /^\.\.?\/?components(\/|$)/.test(importPath) ||
    importPath.startsWith('@/components/');
  if (!isOldRef) return null;

  const base = stripExt(path.basename(importPath));
  if (!base || SKIP_BASENAMES.has(base)) return null;

  // Already resolves on disk? Leave it alone.
  if (tryResolve(importPath, containingFile)) return null;

  const candidates = moduleIndex[base];
  if (!candidates?.length) return null;

  const chosen = pickBestCandidate(candidates, importPath, containingFile);

  if (importPath.startsWith('@/')) {
    const relToSrc = path.relative(SRC_DIR, chosen).replace(/\\/g, '/');
    return '@/' + stripExt(relToSrc);
  } else {
    let rel = path.relative(path.dirname(containingFile), chosen).replace(/\\/g, '/');
    rel = stripExt(rel);
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
  }
}

// ── File processor ────────────────────────────────────────────────────────────

const STATIC_RE  = /((?:import|export)[\s\S]*?\bfrom\s*['"])([^'"]+?)(['"])/g;
const DYNAMIC_RE = /(\bimport\s*\(\s*['"])([^'"]+?)(['"]\s*\))/g;
const warnings   = [];

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const rel      = path.relative(PROJECT_ROOT, filePath);
  let fileLogged = false;

  function replacer(match, prefix, importPath, suffix) {
    let newImport;
    try { newImport = computeNewImport(importPath, filePath); }
    catch { return match; }
    if (!newImport || newImport === importPath) return match;

    if (VERBOSE) {
      if (!fileLogged) { console.log(`\n  ${rel}`); fileLogged = true; }
      console.log(`    - ${importPath}`);
      console.log(`    + ${newImport}`);
    }
    return `${prefix}${newImport}${suffix}`;
  }

  let updated = original.replace(STATIC_RE,  replacer);
  updated     = updated .replace(DYNAMIC_RE, replacer);

  if (updated !== original) {
    if (!DRY_RUN) fs.writeFileSync(filePath, updated, 'utf8');
    if (!VERBOSE) console.log(`${DRY_RUN ? '[dry-run] ' : '✓ '}${rel}`);
    return true;
  }
  return false;
}

function collectUnresolved(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  for (const re of [STATIC_RE, DYNAMIC_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const importPath = m[2];
      const isOldRef =
        importPath.includes('/components/') ||
        /^\.\.?\/?components(\/|$)/.test(importPath) ||
        importPath.startsWith('@/components/');
      if (!isOldRef) continue;
      const base = stripExt(path.basename(importPath));
      if (!base || SKIP_BASENAMES.has(base)) continue;
      if (tryResolve(importPath, filePath)) continue;
      if (moduleIndex[base]?.length) continue;
      const rel = path.relative(PROJECT_ROOT, filePath);
      warnings.push(`  ⚠  "${base}"  not found in modules/   ← ${rel}`);
    }
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run – nothing will be written.' : '🔧  Fixing import paths…');
console.log(`    Project root : ${PROJECT_ROOT}`);
console.log(`    src/modules  : ${path.relative(PROJECT_ROOT, MODULES_DIR)}`);
console.log('');

if (!fs.existsSync(MODULES_DIR)) {
  console.error(`ERROR: src/modules/ not found at:\n  ${MODULES_DIR}`);
  process.exit(1);
}

const allSourceFiles = walkDir(SRC_DIR);
let changedCount = 0;

for (const f of allSourceFiles) {
  if (processFile(f)) changedCount++;
  collectUnresolved(f);
}

const uniqueWarnings = [...new Set(warnings)];

console.log('');
if (uniqueWarnings.length) {
  console.log('⚠  Needs manual attention (no match found in modules/):');
  uniqueWarnings.forEach(w => console.log(w));
  console.log('');
}

console.log(
  DRY_RUN
    ? `Would update ${changedCount} file(s).  Re-run without --dry-run to apply.`
    : `Done.  Updated ${changedCount} file(s).`
);
console.log('');
