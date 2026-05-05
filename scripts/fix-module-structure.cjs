#!/usr/bin/env node
/**
 * fix-module-structure.cjs
 *
 * Completes the modular monolith architecture by:
 *  1. Scanning every file inside src/modules/ subfolders
 *  2. Detecting its type: component | hook | service | util | type | config
 *  3. Checking if it lives in the correct subfolder for its type
 *  4. Moving misplaced files to the right subfolder
 *  5. Rewriting every import across the entire codebase to match the new paths
 *
 * Classification rules:
 *  hook        → filename starts with "use"  → belongs in  module/hooks/
 *  component   → .tsx file with JSX content  → belongs in  module/components/
 *  type file   → only type/interface exports → belongs in  module/types/
 *  service     → .ts, no "use" prefix, has service patterns (async fn, supabase) → module/services/
 *  util/helper → .ts, no "use" prefix, pure helpers  → module/utils/
 *  config      → constants / config exports  → module/config/
 *
 * Usage (from project root beside src/):
 *   node fix-module-structure.cjs --dry-run   ← preview only
 *   node fix-module-structure.cjs             ← apply all moves + rewrites
 *   node fix-module-structure.cjs --verbose   ← show every import rewrite
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

// Valid subfolder names per the architecture
const VALID_SUBFOLDERS = new Set([
  'components', 'hooks', 'services', 'utils', 'types',
  'config', 'extensions', 'constants', 'widgets', 'steps',
  // module-specific named subfolders (keep as-is)
  'courses', 'institution', 'onboarding', 'feed',
]);

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

function stripExt(p) { return p.replace(/\.(ts|tsx|js|jsx)$/, ''); }
function rel(p)       { return path.relative(PROJECT_ROOT, p).replace(/\\/g, '/'); }
function relSrc(p)    { return path.relative(SRC_DIR, p).replace(/\\/g, '/'); }

// ── File classifier ───────────────────────────────────────────────────────────

/**
 * Reads a file and returns its canonical type:
 *   'component' | 'hook' | 'service' | 'util' | 'type' | 'config' | 'unknown'
 */
function classifyFile(absPath) {
  const base = path.basename(absPath, path.extname(absPath));
  const ext  = path.extname(absPath);
  const src  = fs.readFileSync(absPath, 'utf8');

  // 1. Hook: starts with "use" (React convention)
  if (/^use[A-Z]/.test(base)) return 'hook';

  // 2. React component: .tsx with JSX return or React.FC signature
  if (ext === '.tsx') {
    if (
      /return\s*\(/.test(src) ||
      /:\s*React\.FC/.test(src) ||
      /:\s*JSX\.Element/.test(src) ||
      /export\s+default\s+function\s+[A-Z]/.test(src) ||
      /export\s+(const|function)\s+[A-Z][A-Za-z]+\s*[=:(]/.test(src)
    ) return 'component';
  }

  // 3. Pure type file: only type/interface/enum exports, no logic
  if (ext === '.ts') {
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const hasOnlyTypes =
      !/\bfunction\b/.test(noComments) &&
      !/\bconst\s+\w+\s*=\s*(async\s*)?\(/.test(noComments) &&
      !/\bclass\s+/.test(noComments) &&
      /export\s+(type|interface|enum)/.test(noComments);
    if (hasOnlyTypes) return 'type';
  }

  // 4. Service: async functions + supabase/fetch/axios
  if (ext === '.ts') {
    if (
      /\basync\s+function\b/.test(src) ||
      /supabase\.(from|auth|storage|rpc|functions)/.test(src) ||
      /\bfetch\s*\(/.test(src)
    ) return 'service';
  }

  // 5. Config / constants: only constant exports
  if (ext === '.ts') {
    if (
      /^export\s+const\s+[A-Z_]+\s*=/m.test(src) &&
      !/\basync\b/.test(src) &&
      !/\bfunction\b/.test(src)
    ) return 'config';
  }

  // 6. Util: .ts with exported helper functions, no hooks/components/services
  if (ext === '.ts') {
    if (/export\s+(const|function)/.test(src)) return 'util';
  }

  return 'unknown';
}

/**
 * Given a file type, return the canonical subfolder name it belongs in.
 */
function canonicalFolder(fileType) {
  return {
    component: 'components',
    hook:      'hooks',
    service:   'services',
    util:      'utils',
    type:      'types',
    config:    'config',
    unknown:   null,  // don't move unknowns
  }[fileType] ?? null;
}

// ── Detect misplaced files ────────────────────────────────────────────────────

/**
 * For a file inside src/modules/, work out:
 *   - which module it belongs to (e.g. "quizzes")
 *   - which subfolder it is currently in
 *   - which subfolder it SHOULD be in
 *
 * Returns null if the file is already in the right place or shouldn't be moved.
 */
function getMoveNeeded(absPath) {
  const relToModules = path.relative(MODULES_DIR, absPath).replace(/\\/g, '/');
  const parts        = relToModules.split('/');

  // parts[0] = module name (e.g. "quizzes")
  // parts[1] = current subfolder (e.g. "hooks") OR filename if directly in module root
  // parts[2+] = deeper path

  if (parts.length < 2) return null; // directly in modules root — skip

  const moduleName   = parts[0];
  const currentSub   = parts.length >= 3 ? parts[1] : null; // null = file is at module root level
  const base         = path.basename(absPath, path.extname(absPath));

  // Skip barrel index files
  if (base === 'index') return null;

  // Skip files already at the module root that are intentional (README, index.ts)
  if (currentSub === null) return null;

  // If the current subfolder is not a recognised architecture folder, flag it
  // (e.g. "components.tsx" — the malformed folder)
  const isMalformedFolder = currentSub.includes('.') || currentSub.includes(' ');

  const fileType     = classifyFile(absPath);
  const correctSub   = canonicalFolder(fileType);

  // Can't classify — don't move
  if (!correctSub) return null;

  // Already in a named sub-sub-folder (e.g. educator/courses/...) → 
  // Only flag if the immediate parent folder is clearly wrong type-wise
  if (parts.length > 3 && VALID_SUBFOLDERS.has(parts[1])) return null;

  // Already correct
  if (currentSub === correctSub && !isMalformedFolder) return null;

  // If the current subfolder is a valid non-matching one (e.g. hook in utils/),
  // or a malformed name, we have a misplacement
  const fromAbs = absPath;
  const toRel   = path.join(moduleName, correctSub, ...parts.slice(2)).replace(/\\/g, '/');
  const toAbs   = path.join(MODULES_DIR, toRel);

  // Don't move if destination already exists (already been fixed)
  if (fs.existsSync(toAbs)) return null;

  return {
    moduleName,
    base,
    fileType,
    currentSub,
    correctSub,
    fromAbs,
    toAbs,
    fromRel: rel(fromAbs),
    toRel:   rel(toAbs),
  };
}

// ── Import rewriting ──────────────────────────────────────────────────────────

const fileIndex = {}; // basename → [absPath, ...]
function buildIndex(files) {
  for (const f of files) {
    const base = path.basename(f, path.extname(f));
    if (base === 'index') continue;
    (fileIndex[base] = fileIndex[base] ?? []).push(f);
  }
}

function tryResolve(importStr, containingFile) {
  let base;
  if (importStr.startsWith('@/'))      base = path.join(SRC_DIR, importStr.slice(2));
  else if (importStr.startsWith('.'))  base = path.join(path.dirname(containingFile), importStr);
  else return null;

  const allFiles = walkDir(SRC_DIR); // use live filesystem
  const fileSet  = new Set(allFiles.map(f => path.normalize(f)));

  for (const c of [base, ...SOURCE_EXTS.map(e => base+e), ...SOURCE_EXTS.map(e => path.join(base,'index'+e))]) {
    if (fileSet.has(path.normalize(c))) return c;
  }
  return null;
}

function buildNewImport(originalImport, targetAbs, containingFile) {
  if (originalImport.startsWith('@/')) {
    return '@/' + stripExt(path.relative(SRC_DIR, targetAbs).replace(/\\/g, '/'));
  }
  let r = path.relative(path.dirname(containingFile), targetAbs).replace(/\\/g, '/');
  r = stripExt(r);
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

const STATIC_RE  = /((?:import|export)[\s\S]*?\bfrom\s*['"])([^'"]+?)(['"])/g;
const DYNAMIC_RE = /(\bimport\s*\(\s*['"])([^'"]+?)(['"]\s*\))/g;

function rewriteImportsForMove(allSourceFiles, oldAbs, newAbs) {
  let total = 0;
  for (const f of allSourceFiles) {
    const original = fs.readFileSync(f, 'utf8');
    let   changed  = false;

    function replacer(match, prefix, importStr, suffix) {
      if (!importStr.startsWith('.') && !importStr.startsWith('@/')) return match;
      let base;
      if (importStr.startsWith('@/')) base = path.join(SRC_DIR, importStr.slice(2));
      else base = path.join(path.dirname(f), importStr);

      const candidates = [base, ...SOURCE_EXTS.map(e=>base+e), ...SOURCE_EXTS.map(e=>path.join(base,'index'+e))];
      const hit = candidates.find(c => path.normalize(c) === path.normalize(oldAbs));
      if (!hit) return match;

      const newImp = buildNewImport(importStr, newAbs, f);
      if (VERBOSE) console.log(`      ${importStr}  →  ${newImp}   [${rel(f)}]`);
      changed = true;
      return `${prefix}${newImp}${suffix}`;
    }

    let updated = original.replace(STATIC_RE, replacer);
    updated     = updated .replace(DYNAMIC_RE, replacer);

    if (changed) {
      total++;
      if (!DRY_RUN) fs.writeFileSync(f, updated, 'utf8');
      if (!VERBOSE) console.log(`      ${DRY_RUN?'[dry] ':''}patched: ${rel(f)}`);
    }
  }
  return total;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run — nothing will be written or moved.' : '🔧  Completing modular monolith structure…');
console.log('');

if (!fs.existsSync(MODULES_DIR)) {
  console.error('ERROR: src/modules/ not found. Run from the project root.');
  process.exit(1);
}

// ── Phase 1: Detect all misplacements ────────────────────────────────────────

const modulesFiles = walkDir(MODULES_DIR);
const moves        = [];

for (const f of modulesFiles) {
  const move = getMoveNeeded(f);
  if (move) moves.push(move);
}

if (moves.length === 0) {
  console.log('✓  All files are already in the correct subfolders.\n');
  process.exit(0);
}

// Group by module for display
const byModule = {};
for (const m of moves) {
  (byModule[m.moduleName] = byModule[m.moduleName] ?? []).push(m);
}

console.log(`Found ${moves.length} misplaced file(s) across ${Object.keys(byModule).length} module(s):\n`);

for (const [mod, list] of Object.entries(byModule).sort()) {
  console.log(`  📦 ${mod}/`);
  for (const m of list) {
    const arrow = `${m.currentSub}/  →  ${m.correctSub}/`;
    console.log(`      ${m.base}  [${m.fileType}]   ${arrow}`);
  }
  console.log('');
}

// ── Phase 2: Execute moves + rewrite imports ──────────────────────────────────

const allSourceFiles = walkDir(SRC_DIR); // snapshot before any moves
let totalImportsFix  = 0;

for (const move of moves) {
  console.log(`── Moving ${move.base} (${move.fileType})`);
  console.log(`   from: ${move.fromRel}`);
  console.log(`     to: ${move.toRel}`);

  // Update all imports pointing to the OLD path BEFORE moving
  const fixed = rewriteImportsForMove(allSourceFiles, move.fromAbs, move.toAbs);
  totalImportsFix += fixed;
  if (fixed === 0) console.log('      (no files import this)');

  if (!DRY_RUN) {
    // Ensure destination folder exists
    fs.mkdirSync(path.dirname(move.toAbs), { recursive: true });
    fs.renameSync(move.fromAbs, move.toAbs);
  }
  console.log('');
}

// ── Phase 3: Clean up malformed / empty folders ───────────────────────────────

function removeDirIfEmpty(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) {
      if (!DRY_RUN) fs.rmdirSync(dirPath);
      console.log(`   🗑  removed empty folder: ${rel(dirPath)}`);
    } else {
      // Check for malformed folder names
      if (path.basename(dirPath).includes('.')) {
        console.log(`   ⚠  folder still has files: ${rel(dirPath)} — check manually`);
      }
    }
  } catch(e) {}
}

// Collect parent folders of moved files and clean them up
const dirsToCheck = new Set(moves.map(m => path.dirname(m.fromAbs)));
if (!DRY_RUN) {
  dirsToCheck.forEach(d => removeDirIfEmpty(d));
} else {
  dirsToCheck.forEach(d => {
    if (fs.existsSync(d)) {
      const leftover = fs.readdirSync(d).filter(e => SOURCE_EXTS.some(x => e.endsWith(x)));
      if (leftover.length === 0) {
        console.log(`   [dry] would remove empty folder: ${rel(d)}`);
      }
    }
  });
}

// ── Phase 4: Update barrel index.ts files ────────────────────────────────────

console.log('\n── Checking module index.ts barrel files…\n');

for (const [mod, list] of Object.entries(byModule)) {
  const indexPath = path.join(MODULES_DIR, mod, 'index.ts');
  if (!fs.existsSync(indexPath)) continue;

  let indexSrc = fs.readFileSync(indexPath, 'utf8');
  let changed   = false;

  for (const move of list) {
    // Replace old export path with new one in index.ts
    const oldFragment = `./${move.currentSub}/${move.base}`;
    const newFragment = `./${move.correctSub}/${move.base}`;

    if (indexSrc.includes(oldFragment)) {
      indexSrc = indexSrc.split(oldFragment).join(newFragment);
      changed  = true;
      console.log(`   ${mod}/index.ts:  ${oldFragment}  →  ${newFragment}`);
    }
  }

  if (changed) {
    if (!DRY_RUN) fs.writeFileSync(indexPath, indexSrc, 'utf8');
    else console.log(`   [dry] would update: ${rel(indexPath)}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(64));
console.log(DRY_RUN
  ? `\n  Dry-run complete.\n  Would move ${moves.length} file(s) and fix ${totalImportsFix} import reference(s).\n`
  : `\n  Done.\n  Moved ${moves.length} file(s).  Fixed ${totalImportsFix} import reference(s).\n`
);

// Print the final expected structure
console.log('  Expected module structure after fix:\n');
const modNames = [...new Set(moves.map(m=>m.moduleName))].sort();
for (const mod of modNames) {
  console.log(`  src/modules/${mod}/`);
  const subs = [...new Set(moves.filter(m=>m.moduleName===mod).map(m=>m.correctSub))].sort();
  for (const s of subs) {
    const files = moves.filter(m=>m.moduleName===mod && m.correctSub===s);
    console.log(`    ${s}/`);
    files.forEach(f => console.log(`      ${f.base}.tsx|ts`));
  }
  console.log('');
}

console.log('═'.repeat(64));
if (!DRY_RUN) {
  console.log('\nNext steps:');
  console.log('  1.  npx tsc --noEmit          ← confirm zero type errors');
  console.log('  2.  npm run dev               ← smoke test in browser');
  console.log('  3.  node dependency-map.cjs   ← regenerate the map to confirm');
  console.log('');
}
