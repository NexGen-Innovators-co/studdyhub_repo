#!/usr/bin/env node
/**
 * fix-barrels.cjs
 *
 * Inspects every index.ts barrel file in src/ and auto-fixes:
 *
 *  ① BROKEN PATH     — export points to a file that no longer exists on disk
 *  ② MISSING EXPORT  — a file exists in the folder but is not in the barrel
 *  ③ DUPLICATE NAME  — two exports expose the same member name (e.g. Toaster)
 *  ④ WRONG CASING    — export path casing differs from the real filename
 *  ⑤ WRONG SUBFOLDER — barrel re-exports from a wrong relative path
 *
 * For each issue it either:
 *   AUTO-FIX  — safe to apply automatically
 *   WARN      — needs a human decision (printed clearly)
 *
 * Usage (from project root):
 *   node fix-barrels.cjs --dry-run    preview all changes
 *   node fix-barrels.cjs              apply all auto-fixes
 *   node fix-barrels.cjs --verbose    show every barrel checked
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN  = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose');
const ROOT     = __dirname;
const SRC      = path.join(ROOT, 'src');
const SOURCE_EXTS = ['.ts', '.tsx'];

// Files that are intentionally NOT re-exported from their folder barrel
// (they are internal implementation details)
const BARREL_EXCLUDES = new Set([
  'index',                // barrels themselves
  'PodcastPanel.original',// backup file
]);

// Known duplicate export resolutions
// When two files export the same name, this decides which wins
// and how to alias the other.
// Format: { loser: string (filename without ext), alias: string }
const DUPLICATE_RESOLUTIONS = {
  'Toaster': { loser: 'sonner', alias: 'SonnerToaster' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function rel(p)    { return path.relative(ROOT, p).replace(/\\/g, '/'); }
function exists(p) { return fs.existsSync(p); }
function read(p)   { return fs.readFileSync(p, 'utf8'); }
function write(p, c) {
  if (!DRY_RUN) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); }
}

function walkDir(dir, exts = SOURCE_EXTS) {
  const out = [];
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules','dist','.git','build','coverage'].includes(e)) continue;
      out.push(...walkDir(full, exts));
    } else if (exts.some(x => full.endsWith(x))) {
      out.push(full);
    }
  }
  return out;
}

// Find all barrel index.ts files
function findBarrels(dir) {
  const out = [];
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules','dist','.git','build','coverage'].includes(e.name)) continue;
      out.push(...findBarrels(full));
    } else if (e.name === 'index.ts' || e.name === 'index.tsx') {
      out.push(full);
    }
  }
  return out;
}

// Parse all export lines from a barrel
function parseBarrelExports(src) {
  const exports = [];
  // export * from './foo'
  // export { Foo } from './foo'
  // export { Foo as Bar } from './foo'
  // export type { Foo } from './foo'
  const RE = /^[ \t]*(export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"])\s*;?/gm;
  let m;
  while ((m = RE.exec(src)) !== null) {
    const full    = m[1];
    const specifier = m[2];
    const isStar  = full.includes('export *') || full.includes('export type *');
    // Extract named members if { } form
    const names   = [];
    const namedMatch = full.match(/\{([^}]+)\}/);
    if (namedMatch) {
      for (const part of namedMatch[1].split(',')) {
        const t = part.trim().replace(/^type\s+/, '');
        const asPart = t.match(/^(\w+)\s+as\s+(\w+)$/);
        if (asPart) names.push({ exported: asPart[1], as: asPart[2] });
        else if (/^\w+$/.test(t)) names.push({ exported: t, as: t });
      }
    }
    exports.push({ line: m[0].trimEnd(), full, specifier, isStar, names });
  }
  return exports;
}

// Get all exported names from a source file (best-effort)
function getExportedNames(filePath) {
  if (!exists(filePath)) return [];
  const src   = read(filePath);
  const names = [];
  // export const/function/class/type/interface/enum Foo
  const RE1 = /^export\s+(?:default\s+)?(?:const|function|class|type|interface|enum|abstract\s+class)\s+(\w+)/gm;
  let m;
  while ((m = RE1.exec(src)) !== null) names.push(m[1]);
  // export { Foo, Bar }
  const RE2 = /^export\s+(?:type\s+)?\{([^}]+)\}/gm;
  while ((m = RE2.exec(src)) !== null) {
    for (const part of m[1].split(',')) {
      const t = part.trim().replace(/^type\s+/, '');
      const asPart = t.match(/(\w+)\s+as\s+(\w+)/);
      if (asPart) names.push(asPart[2]);
      else if (/^\w+$/.test(t)) names.push(t);
    }
  }
  // export default function/class Foo
  const RE3 = /^export\s+default\s+(?:function|class)\s+(\w+)/gm;
  while ((m = RE3.exec(src)) !== null) names.push(m[1]);
  return [...new Set(names)];
}

// Resolve specifier to an absolute path
function resolveSpecifier(specifier, barrelDir) {
  const base = path.join(barrelDir, specifier);
  // Try exact, then +ext, then /index+ext
  const tries = [
    base,
    ...SOURCE_EXTS.map(e => base + e),
    ...SOURCE_EXTS.map(e => path.join(base, 'index' + e)),
  ];
  return tries.find(t => exists(t) && fs.statSync(t).isFile()) || null;
}

// Build the correct export line for a file
function buildExportLine(relativeSpec) {
  return `export * from '${relativeSpec}';`;
}

// ── Main inspector ────────────────────────────────────────────────────────────

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run — nothing written.' : '🔧  Inspecting and fixing barrel files…');
console.log('');

const allBarrels = findBarrels(SRC);
let totalIssues  = 0;
let totalFixed   = 0;
const manualReview = [];

for (const barrelPath of allBarrels) {
  const barrelDir = path.dirname(barrelPath);
  const barrelRel = rel(barrelPath);
  const src       = read(barrelPath);
  const exports   = parseBarrelExports(src);

  const issues  = [];
  const changes = []; // { type, description, oldLine?, newLine? }

  // ── ① Check for BROKEN PATHS ──────────────────────────────────────────────
  for (const exp of exports) {
    const resolved = resolveSpecifier(exp.specifier, barrelDir);
    if (!resolved) {
      issues.push({ type: 'broken', exp, resolved: null });
    }
  }

  // ── ② Check for MISSING EXPORTS ──────────────────────────────────────────
  // Get all source files directly in this barrel's directory (not subdirs)
  // that aren't already exported
  const exportedSpecifiers = new Set(
    exports.map(e => resolveSpecifier(e.specifier, barrelDir)).filter(Boolean).map(p => path.normalize(p))
  );

  const siblingFiles = fs.existsSync(barrelDir)
    ? fs.readdirSync(barrelDir)
        .filter(e => SOURCE_EXTS.some(x => e.endsWith(x)) && e !== 'index.ts' && e !== 'index.tsx')
        .map(e => path.join(barrelDir, e))
    : [];

  for (const sibling of siblingFiles) {
    const base = path.basename(sibling, path.extname(sibling));
    if (BARREL_EXCLUDES.has(base)) continue;
    if (!exportedSpecifiers.has(path.normalize(sibling))) {
      issues.push({ type: 'missing', file: sibling, base });
    }
  }

  // ── ③ Check for DUPLICATE EXPORT NAMES ───────────────────────────────────
  // Collect all names exposed by this barrel
  const nameToSources = {}; // name → [{ exp, file }]
  for (const exp of exports) {
    const resolved = resolveSpecifier(exp.specifier, barrelDir);
    if (!resolved) continue;
    let names;
    if (exp.isStar) {
      names = getExportedNames(resolved);
    } else {
      names = exp.names.map(n => n.as);
    }
    for (const name of names) {
      (nameToSources[name] = nameToSources[name] ?? []).push({ exp, file: resolved });
    }
  }
  for (const [name, sources] of Object.entries(nameToSources)) {
    if (sources.length > 1) {
      issues.push({ type: 'duplicate', name, sources });
    }
  }

  // ── ④ Check for WRONG CASING ─────────────────────────────────────────────
  for (const exp of exports) {
    const resolved = resolveSpecifier(exp.specifier, barrelDir);
    if (!resolved) continue;
    // Get actual filename from disk
    const actualName = path.basename(resolved);
    const specName   = path.basename(exp.specifier) + (exp.specifier.includes('.') ? '' : '');
    // Check just the last segment casing
    const expectedBase = path.basename(exp.specifier.replace(/\/$/, ''));
    const actualBase   = path.basename(resolved, path.extname(resolved));
    if (expectedBase !== actualBase && expectedBase.toLowerCase() === actualBase.toLowerCase()) {
      issues.push({ type: 'casing', exp, actual: actualBase });
    }
  }

  if (issues.length === 0) {
    if (VERBOSE) console.log(`  ✓  ${barrelRel}`);
    continue;
  }

  totalIssues += issues.length;
  console.log(`\n  📋 ${barrelRel}  (${issues.length} issue${issues.length > 1 ? 's' : ''})`);

  let updatedSrc = src;

  for (const issue of issues) {
    switch (issue.type) {

      case 'broken': {
        console.log(`     ① BROKEN: '${issue.exp.specifier}' — file not found`);
        // Auto-fix: remove the broken line
        updatedSrc = updatedSrc.replace(issue.exp.line + '\n', '')
                               .replace(issue.exp.line, '');
        console.log(`        → auto-removed`);
        changes.push({ type: 'removed', line: issue.exp.line });
        totalFixed++;
        break;
      }

      case 'missing': {
        const relSpec = './' + path.basename(issue.file, path.extname(issue.file));
        console.log(`     ② MISSING: '${issue.base}' exists on disk but not in barrel`);
        // Auto-fix: append the export line
        const newLine = buildExportLine(relSpec);
        updatedSrc = updatedSrc.trimEnd() + '\n' + newLine + '\n';
        console.log(`        → added: ${newLine}`);
        changes.push({ type: 'added', line: newLine });
        totalFixed++;
        break;
      }

      case 'duplicate': {
        console.log(`     ③ DUPLICATE: '${issue.name}' exported by ${issue.sources.length} files:`);
        issue.sources.forEach(s => console.log(`        - ${rel(s.file)}`));

        const resolution = DUPLICATE_RESOLUTIONS[issue.name];
        if (resolution) {
          // Find which export line to change
          const loserSource = issue.sources.find(s =>
            path.basename(s.file, path.extname(s.file)) === resolution.loser
          );
          if (loserSource) {
            const oldLine = loserSource.exp.line;
            const newLine = oldLine
              .replace('export * from', `export { ${issue.name} as ${resolution.alias} } from`)
              .replace(/export\s+\*\s+from/, `export { ${issue.name} as ${resolution.alias} } from`);
            updatedSrc = updatedSrc.replace(oldLine, newLine);
            console.log(`        → auto-aliased: ${issue.name} → ${resolution.alias} (from ${resolution.loser})`);
            changes.push({ type: 'aliased', old: oldLine, new: newLine });
            totalFixed++;
          } else {
            manualReview.push({ barrel: barrelRel, issue });
            console.log(`        → ⚠  needs manual resolution`);
          }
        } else {
          manualReview.push({ barrel: barrelRel, issue });
          console.log(`        → ⚠  no auto-resolution defined — add to DUPLICATE_RESOLUTIONS`);
        }
        break;
      }

      case 'casing': {
        const corrected = issue.exp.specifier.replace(
          path.basename(issue.exp.specifier),
          issue.actual
        );
        const oldLine = issue.exp.line;
        const newLine = oldLine.replace(issue.exp.specifier, corrected);
        console.log(`     ④ CASING: '${issue.exp.specifier}' → '${corrected}'`);
        updatedSrc = updatedSrc.replace(oldLine, newLine);
        console.log(`        → auto-corrected`);
        changes.push({ type: 'casing', old: oldLine, new: newLine });
        totalFixed++;
        break;
      }
    }
  }

  // Write the updated barrel
  if (updatedSrc !== src && changes.length > 0) {
    write(barrelPath, updatedSrc);
    console.log(`     ${DRY_RUN ? '[dry] would write' : '✓ written'}: ${barrelRel}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(64));
console.log(`\n  Found ${totalIssues} issue(s) across ${allBarrels.length} barrel files.`);
console.log(`  ${DRY_RUN ? 'Would fix' : 'Fixed'} ${totalFixed} automatically.\n`);

if (manualReview.length) {
  console.log(`  ⚠  ${manualReview.length} item(s) need manual review:\n`);
  for (const item of manualReview) {
    console.log(`  ${item.barrel}`);
    if (item.issue.type === 'duplicate') {
      console.log(`    Duplicate export '${item.issue.name}' from:`);
      item.issue.sources.forEach(s => console.log(`      ${rel(s.file)}`));
      console.log(`    Fix: add an entry to DUPLICATE_RESOLUTIONS in this script,`);
      console.log(`         OR use explicit named exports in the barrel instead of export *.`);
    }
    console.log('');
  }
}

console.log('  Next steps:');
console.log('    npx tsc --noEmit    ← should be zero barrel-related errors');
console.log('    npm run dev         ← smoke test');
console.log('═'.repeat(64));
console.log('');
