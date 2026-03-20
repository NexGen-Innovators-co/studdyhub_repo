#!/usr/bin/env node
/**
 * fix-unused-imports.cjs
 *
 * Removes unused imports from every .ts / .tsx file in src/.
 *
 * Handles all import forms:
 *   import React from 'react'
 *   import { useState, useEffect } from 'react'
 *   import type { Foo } from './types'
 *   import * as Bar from 'bar'
 *   import DefaultExport, { named1, named2 } from 'module'
 *
 * Strategy (pure text analysis — no AST, no install needed):
 *   1. Parse every import statement to extract the local names it binds
 *   2. Remove the import statement from the file text
 *   3. Check whether each bound name still appears in the remaining text
 *   4. If ALL names from an import are unused → remove the whole line
 *   5. If SOME named imports are unused → remove only those names
 *   6. Keep any import that has side-effect-only form: import 'module'
 *   7. Keep type-only imports that are used in type position (best-effort)
 *
 * Safe guards:
 *   - Never removes  import React from 'react'  (JSX transform may need it)
 *   - Never removes  import '...'  (side-effect imports)
 *   - Never removes  import type  declarations used inline as  : Type
 *   - Prints every change so you can review before applying
 *
 * Usage:
 *   node fix-unused-imports.cjs --dry-run    preview all changes
 *   node fix-unused-imports.cjs              apply
 *   node fix-unused-imports.cjs --verbose    show kept imports too
 *   node fix-unused-imports.cjs --file src/modules/notes/components/NoteEditor.tsx
 *                                            single file
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN    = process.argv.includes('--dry-run');
const VERBOSE    = process.argv.includes('--verbose');
const FILE_ARG   = (() => {
  const i = process.argv.indexOf('--file');
  return i !== -1 ? process.argv[i + 1] : null;
})();

const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const SOURCE_EXTS  = ['.ts', '.tsx'];

// Names we never remove even if they look unused
// (used implicitly by JSX transform, decorators, etc.)
const NEVER_REMOVE = new Set([
  'React', 'h', 'Fragment',   // JSX factories
  'styled',                    // styled-components
  'css',                       // emotion
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function rel(p) { return path.relative(PROJECT_ROOT, p).replace(/\\/g, '/'); }

function walkDir(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules','dist','.git','build','coverage'].includes(e)) continue;
      out.push(...walkDir(full));
    } else if (SOURCE_EXTS.some(x => full.endsWith(x))) {
      out.push(full);
    }
  }
  return out;
}

// ── Import parser ─────────────────────────────────────────────────────────────

/**
 * Parse all import declarations in a source file.
 * Returns array of:
 * {
 *   fullMatch  : string  — the entire import statement text
 *   isSideEffect: bool   — import 'foo' with no bindings
 *   isTypeOnly : bool    — import type { ... }
 *   defaultName: string|null
 *   namespaceName: string|null   — import * as X
 *   namedImports: [{ name, alias }]   — alias is the local name
 *   source     : string  — the module specifier
 * }
 */
function parseImports(src) {
  const results = [];

  // Match full import statements (including multiline)
  // We handle:  import ... from '...'
  const IMPORT_RE = /^[ \t]*import\s+([\s\S]*?)\s+from\s+(['"`][^'"`]+['"`])\s*;?[ \t]*$/gm;

  // Side-effect only:  import 'foo'
  const SIDE_EFFECT_RE = /^[ \t]*import\s+(['"`][^'"`]+['"`])\s*;?[ \t]*$/gm;

  let m;

  // Side-effect imports first
  SIDE_EFFECT_RE.lastIndex = 0;
  while ((m = SIDE_EFFECT_RE.exec(src)) !== null) {
    results.push({
      fullMatch: m[0],
      isSideEffect: true,
      isTypeOnly: false,
      defaultName: null,
      namespaceName: null,
      namedImports: [],
      source: m[1].slice(1, -1),
    });
  }

  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const specPart = m[1].trim();
    const source   = m[2].slice(1, -1);
    const fullMatch = m[0];

    const isTypeOnly = /^type\s+/.test(specPart);
    const inner      = isTypeOnly ? specPart.replace(/^type\s+/, '') : specPart;

    let defaultName    = null;
    let namespaceName  = null;
    const namedImports = [];

    // namespace:  * as X
    const nsMatch = inner.match(/^\*\s+as\s+(\w+)/);
    if (nsMatch) {
      namespaceName = nsMatch[1];
    } else {
      // Split:  DefaultName, { named1, named2 as alias }
      const braceIdx = inner.indexOf('{');
      let preStr  = braceIdx === -1 ? inner : inner.slice(0, braceIdx);
      let postStr = braceIdx === -1 ? ''    : inner.slice(braceIdx);

      preStr = preStr.replace(/,\s*$/, '').trim();
      if (preStr && preStr !== 'type') defaultName = preStr || null;

      if (postStr) {
        const inside = postStr.replace(/^\{/, '').replace(/\}.*$/, '');
        for (const part of inside.split(',')) {
          const t = part.trim();
          if (!t) continue;
          // handle:  name as alias   or  type name   or  type name as alias
          const isTypeSpec = /^type\s+/.test(t);
          const cleanT = t.replace(/^type\s+/, '');
          const asMatch = cleanT.match(/^(\w+)\s+as\s+(\w+)$/);
          if (asMatch) {
            namedImports.push({ name: asMatch[1], alias: asMatch[2], isType: isTypeSpec });
          } else if (/^\w+$/.test(cleanT)) {
            namedImports.push({ name: cleanT, alias: cleanT, isType: isTypeSpec });
          }
        }
      }
    }

    results.push({
      fullMatch,
      isSideEffect: false,
      isTypeOnly,
      defaultName,
      namespaceName,
      namedImports,
      source,
    });
  }

  return results;
}

// ── Usage checker ─────────────────────────────────────────────────────────────

/**
 * Check if `name` is used anywhere in `bodyText`
 * (the source file with the import statement itself removed).
 * Matches as a whole word — not as a substring of another identifier.
 */
function isUsed(name, bodyText) {
  // Whole-word match, case-sensitive
  const re = new RegExp(`(?<![\\w$])${escapeRe(name)}(?![\\w$])`, '');
  return re.test(bodyText);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Process one file ──────────────────────────────────────────────────────────

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const imports  = parseImports(original);

  if (imports.length === 0) return false;

  const removedImports = [];  // whole lines removed
  const prunedImports  = [];  // individual names removed from a line
  let   updated        = original;

  for (const imp of imports) {
    // Never touch side-effect imports
    if (imp.isSideEffect) continue;

    // The "body" is the file text with this import removed
    const body = original.replace(imp.fullMatch, '');

    // ── Check default import ──────────────────────────────────────────────
    let defaultUsed = true;
    if (imp.defaultName && !NEVER_REMOVE.has(imp.defaultName)) {
      defaultUsed = isUsed(imp.defaultName, body);
    }

    // ── Check namespace import ────────────────────────────────────────────
    let namespaceUsed = true;
    if (imp.namespaceName && !NEVER_REMOVE.has(imp.namespaceName)) {
      namespaceUsed = isUsed(imp.namespaceName, body);
    }

    // ── Check named imports ───────────────────────────────────────────────
    const unusedNamed = [];
    const usedNamed   = [];
    for (const ni of imp.namedImports) {
      if (NEVER_REMOVE.has(ni.alias)) { usedNamed.push(ni); continue; }
      if (isUsed(ni.alias, body)) {
        usedNamed.push(ni);
      } else {
        unusedNamed.push(ni);
      }
    }

    // ── Decide what to do ─────────────────────────────────────────────────

    const noDefault    = !imp.defaultName   || !defaultUsed;
    const noNamespace  = !imp.namespaceName || !namespaceUsed;
    const allNamedGone = usedNamed.length === 0 && imp.namedImports.length > 0;
    const hasNothingLeft =
      (noDefault || imp.defaultName === null) &&
      (noNamespace || imp.namespaceName === null) &&
      (allNamedGone || imp.namedImports.length === 0);

    if (hasNothingLeft && (unusedNamed.length > 0 || !defaultUsed || !namespaceUsed)) {
      // Remove the entire import line
      updated = updated.replace(imp.fullMatch, '');
      removedImports.push(imp.fullMatch.trim());

    } else if (unusedNamed.length > 0 && defaultUsed !== false) {
      // Remove only the unused named imports, keep the rest
      let newLine = imp.fullMatch;
      for (const ni of unusedNamed) {
        // Remove:  name as alias,   or  name,   or  , name   etc.
        newLine = newLine
          // name as alias followed by comma
          .replace(new RegExp(`,?\\s*\\btype\\s+${escapeRe(ni.name)}\\s+as\\s+${escapeRe(ni.alias)}\\b`, 'g'), '')
          .replace(new RegExp(`,?\\s*\\b${escapeRe(ni.name)}\\s+as\\s+${escapeRe(ni.alias)}\\b`, 'g'), '')
          // bare name followed by comma
          .replace(new RegExp(`,?\\s*\\btype\\s+${escapeRe(ni.name)}\\b`, 'g'), '')
          .replace(new RegExp(`,?\\s*\\b${escapeRe(ni.name)}\\b`, 'g'), '');
      }
      // Clean up empty braces or leading/trailing commas inside braces
      newLine = newLine
        .replace(/\{\s*,\s*/g, '{ ')
        .replace(/,\s*\}/g, ' }')
        .replace(/\{\s*\}/g, '')
        .replace(/,\s*,/g, ',')
        .replace(/import\s+(type\s+)?(,\s*)?from/, 'import $1from')
        .replace(/import\s+(type\s+)?\s*from/, 'import $1from');

      // If the import is now empty (no bindings left), remove it
      if (/import\s+(type\s+)?from\s+['"`]/.test(newLine) ||
          /import\s+(type\s+)?\{\s*\}\s+from/.test(newLine)) {
        updated = updated.replace(imp.fullMatch, '');
        removedImports.push(imp.fullMatch.trim());
      } else if (newLine !== imp.fullMatch) {
        updated = updated.replace(imp.fullMatch, newLine);
        prunedImports.push({
          before: imp.fullMatch.trim(),
          after:  newLine.trim(),
          removed: unusedNamed.map(n => n.alias),
        });
      }
    } else if (!defaultUsed && imp.defaultName && imp.namedImports.length > 0 && usedNamed.length > 0) {
      // Default unused but some named are used — remove just the default
      const newLine = imp.fullMatch
        .replace(new RegExp(`\\b${escapeRe(imp.defaultName)}\\s*,\\s*`), '')
        .replace(new RegExp(`\\b${escapeRe(imp.defaultName)}\\s*`), '');
      if (newLine !== imp.fullMatch) {
        updated = updated.replace(imp.fullMatch, newLine);
        prunedImports.push({
          before: imp.fullMatch.trim(),
          after:  newLine.trim(),
          removed: [imp.defaultName],
        });
      }
    }
  }

  // Clean up excessive blank lines left by removed imports (max 1 consecutive)
  updated = updated.replace(/\n{3,}/g, '\n\n');

  if (updated === original) return false;

  const fileRel = rel(filePath);
  console.log(`\n  ${DRY_RUN ? '[dry] ' : '✓ '}${fileRel}`);

  if (removedImports.length) {
    console.log('    Removed entire imports:');
    removedImports.forEach(l => console.log(`      - ${l}`));
  }
  if (prunedImports.length) {
    console.log('    Pruned unused names:');
    prunedImports.forEach(p => {
      console.log(`      removed: ${p.removed.join(', ')}`);
      console.log(`      before:  ${p.before.substring(0, 100)}`);
      console.log(`      after:   ${p.after.substring(0, 100)}`);
    });
  }

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }

  return true;
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run — nothing written.' : '🔧  Removing unused imports…');
console.log('');

const filesToProcess = FILE_ARG
  ? [path.resolve(FILE_ARG)]
  : walkDir(SRC_DIR);

let changed = 0;
for (const f of filesToProcess) {
  if (processFile(f)) changed++;
}

console.log('\n' + '═'.repeat(64));
console.log(DRY_RUN
  ? `\n  Dry-run: ${changed} file(s) would be updated.\n`
  : `\n  Done: ${changed} file(s) cleaned up.\n`);
console.log('  Next:');
console.log('    npx tsc --noEmit    ← confirm no new type errors');
console.log('    npm run dev         ← smoke test');
console.log('═'.repeat(64));
console.log('');
