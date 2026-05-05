#!/usr/bin/env node
/**
 * dependency-map.cjs
 *
 * Scans every .ts/.tsx/.js/.jsx file under src/ and builds a full
 * internal dependency graph — showing exactly which project file
 * imports which other project file.
 *
 * Outputs:
 *   1. dependency-map.txt   — human-readable tree (what each file imports)
 *   2. dependents-map.txt   — reverse view  (what each file is imported BY)
 *   3. dependency-graph.json — raw JSON for further tooling
 *
 * Usage (run from the project root beside src/):
 *   node dependency-map.cjs
 *   node dependency-map.cjs --only src/modules/quizzes   ← filter to a subtree
 *   node dependency-map.cjs --find QuizModal             ← focus on one file
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const SOURCE_EXTS  = ['.ts', '.tsx', '.js', '.jsx'];
const OUT_DEPS     = path.join(PROJECT_ROOT, 'dependency-map.txt');
const OUT_REVDEPS  = path.join(PROJECT_ROOT, 'dependents-map.txt');
const OUT_JSON     = path.join(PROJECT_ROOT, 'dependency-graph.json');

const FILTER_PATH  = (process.argv.indexOf('--only') !== -1)
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;

const FIND_FILE    = (process.argv.indexOf('--find') !== -1)
  ? process.argv[process.argv.indexOf('--find') + 1]
  : null;
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkDir(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      // skip node_modules / dist / .git
      if (['node_modules', 'dist', '.git', 'build', 'coverage'].includes(entry)) continue;
      out.push(...walkDir(full));
    } else if (SOURCE_EXTS.some(e => full.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

/** Resolve an import string to the absolute path of the file it points to.
 *  Returns null if it resolves to node_modules or cannot be found. */
function resolveImport(importStr, containingFile) {
  // Skip node_modules (no leading . or @/)
  if (!importStr.startsWith('.') && !importStr.startsWith('@/')) return null;

  let base;
  if (importStr.startsWith('@/')) {
    base = path.join(SRC_DIR, importStr.slice(2));
  } else {
    base = path.join(path.dirname(containingFile), importStr);
  }

  // Try: exact, then +ext, then /index+ext
  const candidates = [
    base,
    ...SOURCE_EXTS.map(e => base + e),
    ...SOURCE_EXTS.map(e => path.join(base, 'index' + e)),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** Extract every import/export/dynamic-import string from source text. */
function extractImportStrings(src) {
  const results = [];
  const patterns = [
    // static:  import … from 'x'  |  export … from 'x'
    /((?:import|export)[\s\S]*?\bfrom\s*['"])([^'"]+?)(['"]\s*)/g,
    // dynamic: import('x')
    /\bimport\s*\(\s*['"]([^'"]+?)['"]\s*\)/g,
  ];

  // pattern 0 & 1 have capture group differences
  let m;
  patterns[0].lastIndex = 0;
  while ((m = patterns[0].exec(src)) !== null) results.push(m[2]);

  patterns[1].lastIndex = 0;
  while ((m = patterns[1].exec(src)) !== null) results.push(m[1]);

  return results;
}

/** Make a path relative to PROJECT_ROOT and normalise slashes. */
function rel(absPath) {
  return path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');
}

// ── Build the graph ───────────────────────────────────────────────────────────
// graph[fileA] = Set of absolute paths that fileA imports

console.log('\n🔍  Scanning source files…');

const allFiles  = walkDir(SRC_DIR);
const fileSet   = new Set(allFiles);            // fast lookup
const graph     = {};                           // file → Set<file>
const revGraph  = {};                           // file → Set<file>  (reverse)
let   edgeCount = 0;

// Initialise every file (so isolated files still appear in output)
for (const f of allFiles) { graph[f] = new Set(); revGraph[f] = new Set(); }

for (const file of allFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const importStrings = extractImportStrings(src);

  for (const imp of importStrings) {
    const resolved = resolveImport(imp, file);
    if (!resolved) continue;                    // library or unresolvable
    if (!fileSet.has(resolved)) continue;       // outside src/
    if (resolved === file) continue;            // self-import (rare)

    graph[file].add(resolved);
    revGraph[resolved].add(file);
    edgeCount++;
  }
}

console.log(`    Found ${allFiles.length} source files, ${edgeCount} internal import edges.\n`);

// ── Filter helpers ────────────────────────────────────────────────────────────

function applyFilter(files) {
  if (FIND_FILE) {
    return files.filter(f =>
      path.basename(f, path.extname(f)).toLowerCase() === FIND_FILE.toLowerCase() ||
      rel(f).toLowerCase().includes(FIND_FILE.toLowerCase())
    );
  }
  if (FILTER_PATH) {
    const abs = path.resolve(PROJECT_ROOT, FILTER_PATH);
    return files.filter(f => f.startsWith(abs));
  }
  return files;
}

// ── Build output text ─────────────────────────────────────────────────────────

function buildDependencyMap(files) {
  const lines = [];
  lines.push('═'.repeat(80));
  lines.push('  DEPENDENCY MAP  —  what each file imports from other project files');
  lines.push('═'.repeat(80));
  lines.push('');

  // Group by top-level folder under src/
  const byFolder = {};
  for (const f of files) {
    const relPath = path.relative(SRC_DIR, f).replace(/\\/g, '/');
    const folder  = relPath.split('/')[0];
    (byFolder[folder] = byFolder[folder] ?? []).push(f);
  }

  for (const folder of Object.keys(byFolder).sort()) {
    lines.push('┌─ ' + folder + '/');
    const folderFiles = byFolder[folder].sort();

    for (const file of folderFiles) {
      const deps = [...graph[file]].sort();
      const fileRel = rel(file);

      if (deps.length === 0) {
        lines.push('│  ○  ' + fileRel + '  (no internal imports)');
      } else {
        lines.push('│');
        lines.push('│  ● ' + fileRel);
        for (let i = 0; i < deps.length; i++) {
          const isLast   = i === deps.length - 1;
          const prefix   = isLast ? '│       └─ ' : '│       ├─ ';
          lines.push(prefix + rel(deps[i]));
        }
      }
    }
    lines.push('│');
    lines.push('');
  }

  lines.push('─'.repeat(80));
  lines.push(`  Total: ${files.length} files  |  ${
    files.reduce((s, f) => s + graph[f].size, 0)
  } import edges shown`);
  lines.push('─'.repeat(80));
  return lines.join('\n');
}

function buildDependentsMap(files) {
  const lines = [];
  lines.push('═'.repeat(80));
  lines.push('  DEPENDENTS MAP  —  which files import each file  (reverse graph)');
  lines.push('═'.repeat(80));
  lines.push('');

  const byFolder = {};
  for (const f of files) {
    const relPath = path.relative(SRC_DIR, f).replace(/\\/g, '/');
    const folder  = relPath.split('/')[0];
    (byFolder[folder] = byFolder[folder] ?? []).push(f);
  }

  for (const folder of Object.keys(byFolder).sort()) {
    lines.push('┌─ ' + folder + '/');
    const folderFiles = byFolder[folder].sort();

    for (const file of folderFiles) {
      const importedBy = [...revGraph[file]].sort();
      const fileRel    = rel(file);

      if (importedBy.length === 0) {
        lines.push('│  ◌  ' + fileRel + '  ← not imported by any file');
      } else {
        lines.push('│');
        lines.push('│  ◉ ' + fileRel + '  ← imported by ' + importedBy.length + ' file(s)');
        for (let i = 0; i < importedBy.length; i++) {
          const isLast = i === importedBy.length - 1;
          const prefix = isLast ? '│       └─ ' : '│       ├─ ';
          lines.push(prefix + rel(importedBy[i]));
        }
      }
    }
    lines.push('│');
    lines.push('');
  }

  lines.push('─'.repeat(80));

  // Most-imported files (hot spots)
  const sorted = files
    .map(f => ({ file: f, count: revGraph[f].size }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  lines.push('');
  lines.push('  TOP 20 MOST-IMPORTED FILES:');
  for (const { file, count } of sorted) {
    lines.push(`  ${String(count).padStart(4)} ×  ${rel(file)}`);
  }
  lines.push('─'.repeat(80));
  return lines.join('\n');
}

function buildJSON(files) {
  const out = {};
  for (const f of files) {
    out[rel(f)] = {
      imports:     [...graph[f]].map(rel).sort(),
      importedBy:  [...revGraph[f]].map(rel).sort(),
    };
  }
  return out;
}

// ── Write output ──────────────────────────────────────────────────────────────

const targetFiles = applyFilter(allFiles).sort();

const depsText    = buildDependencyMap(targetFiles);
const revDepsText = buildDependentsMap(targetFiles);
const jsonData    = buildJSON(targetFiles);

fs.writeFileSync(OUT_DEPS,   depsText,                   'utf8');
fs.writeFileSync(OUT_REVDEPS, revDepsText,                'utf8');
fs.writeFileSync(OUT_JSON,   JSON.stringify(jsonData, null, 2), 'utf8');

console.log(`✓  dependency-map.txt     — who each file imports`);
console.log(`✓  dependents-map.txt     — who imports each file`);
console.log(`✓  dependency-graph.json  — raw graph (for tooling)`);
console.log('');

// ── Quick terminal summary ────────────────────────────────────────────────────

// Files with most outbound deps
const topImporters = [...targetFiles]
  .map(f => ({ file: f, count: graph[f].size }))
  .filter(x => x.count > 0)
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);

// Files with most inbound deps (most reused)
const topImported = [...targetFiles]
  .map(f => ({ file: f, count: revGraph[f].size }))
  .filter(x => x.count > 0)
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);

// Files imported by nobody (potential dead code)
const orphans = targetFiles.filter(f =>
  revGraph[f].size === 0 &&
  !rel(f).includes('main.') &&
  !rel(f).includes('App.') &&
  !rel(f).includes('index.')
);

console.log('── TOP 10 FILES WITH MOST IMPORTS (high coupling) ─────────────────');
for (const { file, count } of topImporters) {
  console.log(`  ${String(count).padStart(3)} imports  →  ${rel(file)}`);
}

console.log('\n── TOP 10 MOST RE-USED FILES (imported most often) ─────────────────');
for (const { file, count } of topImported) {
  console.log(`  ${String(count).padStart(3)} ×  ${rel(file)}`);
}

if (orphans.length) {
  console.log('\n── FILES NOT IMPORTED BY ANYTHING (possible dead code) ─────────────');
  for (const f of orphans.slice(0, 30)) {
    console.log('  ' + rel(f));
  }
  if (orphans.length > 30) console.log(`  … and ${orphans.length - 30} more (see dependency-graph.json)`);
}

console.log('\nDone.\n');
