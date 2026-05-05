#!/usr/bin/env node
/**
 * fix-duplicate-exports.cjs
 *
 * Fixes the 6 duplicate barrel export issues. Each case has a different
 * root cause and therefore a different targeted fix:
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CASE 1 — quizzes: LiveQuizLeaderboard (component naming conflict)
 *   IndividualLeaderboard.tsx exports a component ALSO named LiveQuizLeaderboard
 *   — that is a copy-paste naming mistake. The component in that file should be
 *   called IndividualLeaderboard. Fix: rename the export inside that file.
 *
 * CASE 2 — social utils: validatePostContent (dead duplicate)
 *   validation.ts was moved from global src/utils/ into social/utils/ by the
 *   migration script. It has ZERO importers. postUtils.ts already has the same
 *   function. Fix: remove validation.ts entirely (dead code, already flagged).
 *
 * CASE 3 — social utils: formatEngagementCount (function duplicated across files)
 *   postUtils.ts (8 importers) and Recomendation.ts (1 importer) both define
 *   this function. postUtils.ts is the authoritative one.
 *   Fix: remove the duplicate from Recomendation.ts.
 *
 * CASE 4/5/6 — types: ClassRecording, Quiz, QuizQuestion (re-export chain conflict)
 *   EnhancedClasses.ts imports and re-exports types FROM Class.ts. The types
 *   barrel does  export * from './Class'  AND  export * from './Class'
 *   so the same names appear twice. Fix: switch the types barrel to use explicit
 *   named exports so each name comes from exactly one source.
 *
 * Usage:
 *   node fix-duplicate-exports.cjs --dry-run    preview
 *   node fix-duplicate-exports.cjs              apply
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT    = __dirname;
const SRC     = path.join(ROOT, 'src');

function rel(p)    { return path.relative(ROOT, p).replace(/\\/g, '/'); }
function abs(p)    { return path.join(SRC, p); }
function exists(p) { return fs.existsSync(p); }
function read(p)   { return fs.readFileSync(p, 'utf8'); }
function write(p, c) {
  if (!DRY_RUN) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); }
  console.log(`   ${DRY_RUN ? '[dry] would write' : '✓ wrote'}: ${rel(p)}`);
}
function del(p) {
  if (!DRY_RUN) fs.unlinkSync(p);
  console.log(`   ${DRY_RUN ? '[dry] would delete' : '✓ deleted'}: ${rel(p)}`);
}

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run — nothing written.' : '🔧  Fixing duplicate barrel exports…');
console.log('');

// ══════════════════════════════════════════════════════════════════════════════
// CASE 1: quizzes — LiveQuizLeaderboard naming conflict
// Root cause: IndividualLeaderboard.tsx exports a component wrongly named
//             LiveQuizLeaderboard (copy-paste error from LiveQuizLeaderboard.tsx)
//
// Fix A: rename the exported component inside IndividualLeaderboard.tsx
// Fix B: update the barrel so it doesn't re-export a name collision
// ══════════════════════════════════════════════════════════════════════════════

console.log('── Case 1: quizzes/IndividualLeaderboard export name conflict\n');

const individualPath = abs('modules/quizzes/components/IndividualLeaderboard.tsx');

if (exists(individualPath)) {
  const src = read(individualPath);

  // Check if this file exports something called LiveQuizLeaderboard
  if (src.includes('LiveQuizLeaderboard')) {
    console.log('   IndividualLeaderboard.tsx contains an export named LiveQuizLeaderboard.');
    console.log('   This conflicts with LiveQuizLeaderboard.tsx which is the real component.');
    console.log('   Renaming all LiveQuizLeaderboard references to IndividualLeaderboard inside this file.\n');

    // Rename every occurrence of LiveQuizLeaderboard to IndividualLeaderboard within this file
    // This covers: component definitions, const declarations, return types, exports
    const updated = src
      .replace(/\bLiveQuizLeaderboard\b/g, 'IndividualLeaderboard');

    if (updated !== src) {
      write(individualPath, updated);

      // Also fix any importer that imported LiveQuizLeaderboard FROM IndividualLeaderboard
      // (not from the real LiveQuizLeaderboard.tsx)
      const importerPath = abs('modules/quizzes/components/IndividualAutoMode.tsx');
      if (exists(importerPath)) {
        const importerSrc = read(importerPath);
        // Only fix if it imports from IndividualLeaderboard (not LiveQuizLeaderboard)
        if (importerSrc.includes('./IndividualLeaderboard') &&
            importerSrc.includes('LiveQuizLeaderboard')) {
          const fixedImporter = importerSrc.replace(
            /import\s*\{([^}]*)\bLiveQuizLeaderboard\b([^}]*)\}\s*from\s*(['"])\.\/IndividualLeaderboard\3/g,
            (match, before, after, q) => {
              const fixed = (before + 'IndividualLeaderboard' + after).replace(/\s+,\s+/g, ', ').trim();
              return `import { ${fixed} } from ${q}./IndividualLeaderboard${q}`;
            }
          );
          if (fixedImporter !== importerSrc) {
            console.log('   Updating IndividualAutoMode.tsx import reference:');
            write(importerPath, fixedImporter);
          }
        }
      }
    } else {
      console.log('   No changes needed (LiveQuizLeaderboard not exported from this file).');
    }
  } else {
    console.log('   ✓ IndividualLeaderboard.tsx does not export LiveQuizLeaderboard — already clean.');
  }
} else {
  console.log('   IndividualLeaderboard.tsx not found — skipping.');
}

// ══════════════════════════════════════════════════════════════════════════════
// CASE 2: social utils — validatePostContent in dead validation.ts
// Root cause: validation.ts was moved from global src/utils/ into social/utils/
//             by the migration. It has ZERO importers. postUtils.ts already has
//             validatePostContent. The file is dead weight.
// Fix: delete social/utils/validation.ts and remove it from the barrel.
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n── Case 2: social/utils/validation.ts — dead duplicate\n');

const socialValidationPath  = abs('modules/social/utils/validation.ts');
const socialUtilsBarrelPath = abs('modules/social/utils/index.ts');

if (exists(socialValidationPath)) {
  console.log('   social/utils/validation.ts has 0 importers and duplicates postUtils.ts functions.');
  console.log('   Deleting it and removing from barrel.\n');
  del(socialValidationPath);

  if (exists(socialUtilsBarrelPath)) {
    let barrel = read(socialUtilsBarrelPath);
    const before = barrel;
    barrel = barrel
      .replace(/^.*export\s+.*from\s+['"]\.\/validation['"]\s*;?\s*\n?/gm, '')
      .replace(/\n{3,}/g, '\n\n');
    if (barrel !== before) {
      write(socialUtilsBarrelPath, barrel);
    }
  }
} else {
  console.log('   ✓ social/utils/validation.ts not found — already removed.');
}

// ══════════════════════════════════════════════════════════════════════════════
// CASE 3: social utils — formatEngagementCount in Recomendation.ts
// Root cause: function was copied into Recomendation.ts which already exists
//             in postUtils.ts (the authoritative source with 8 importers).
// Fix: remove formatEngagementCount from Recomendation.ts.
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n── Case 3: social/utils/Recomendation.ts — formatEngagementCount duplicate\n');

const recomendationPath = abs('modules/social/utils/Recomendation.ts');

if (exists(recomendationPath)) {
  const src = read(recomendationPath);

  if (src.includes('formatEngagementCount')) {
    console.log('   Removing formatEngagementCount from Recomendation.ts');
    console.log('   (postUtils.ts is the authoritative source with 8 importers)\n');

    // Remove the entire function block for formatEngagementCount
    // Handles: export function, export const = () =>, export const = function
    let updated = src;

    // export function formatEngagementCount(...) { ... }
    updated = updated.replace(
      /\/\*[\s\S]*?\*\/\s*\nexport\s+function\s+formatEngagementCount[\s\S]*?(?=\n(?:export|\/\/|\/\*|\Z))/g,
      ''
    );
    // export const formatEngagementCount = ...
    updated = updated.replace(
      /\/\*[\s\S]*?\*\/\s*\nexport\s+const\s+formatEngagementCount[\s\S]*?(?=\n(?:export|\/\/|\/\*|\Z))/g,
      ''
    );
    // Simpler fallback: line-by-line removal of the function
    if (updated.includes('formatEngagementCount')) {
      const lines  = src.split('\n');
      const result = [];
      let skip     = false;
      let braces   = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!skip && /export\s+(function|const)\s+formatEngagementCount/.test(line)) {
          skip   = true;
          braces = 0;
        }

        if (skip) {
          braces += (line.match(/\{/g) || []).length;
          braces -= (line.match(/\}/g) || []).length;
          // Arrow function with no braces: ends at semicolon
          if (braces <= 0 && (line.includes('}') || line.trimEnd().endsWith(';'))) {
            skip = false;
          }
          continue; // skip this line
        }

        result.push(line);
      }
      updated = result.join('\n').replace(/\n{3,}/g, '\n\n');
    }

    if (updated !== src && !updated.includes('formatEngagementCount')) {
      write(recomendationPath, updated);
    } else if (updated.includes('formatEngagementCount')) {
      console.log('   ⚠  Could not auto-remove — please manually delete the');
      console.log('      formatEngagementCount function from Recomendation.ts');
    }
  } else {
    console.log('   ✓ Recomendation.ts does not contain formatEngagementCount — already clean.');
  }
} else {
  console.log('   Recomendation.ts not found — skipping.');
}

// ══════════════════════════════════════════════════════════════════════════════
// CASES 4/5/6: types — ClassRecording, Quiz, QuizQuestion
//
// Root cause: EnhancedClasses.ts imports FROM Class.ts and re-exports some of
// those types. The types/index.ts barrel does export * from both files, so
// the same type name travels two paths:
//   Class.ts → index.ts  (path A)
//   Class.ts → EnhancedClasses.ts → index.ts  (path B)
//
// Fix: switch types/index.ts from  export * from './Class'  to an
// explicit export that lists ONLY the symbols unique to EnhancedClasses
// (not the ones it re-exports from Class.ts).
//
// How we find what is unique: read EnhancedClasses.ts, find its OWN exports
// (defined in the file), exclude anything that is also in Class.ts.
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n── Cases 4/5/6: types/index.ts — ClassRecording, Quiz, QuizQuestion duplicates\n');

const classTypesPath    = abs('types/Class.ts');
const enhancedPath      = abs('types/Class.ts');
const typesBarrelPath   = abs('types/index.ts');

if (exists(classTypesPath) && exists(enhancedPath) && exists(typesBarrelPath)) {

  // Get all names defined in Class.ts
  function getDefinedNames(filePath) {
    const src = read(filePath);
    const names = new Set();
    const patterns = [
      /^export\s+(?:type\s+|interface\s+|enum\s+|const\s+|function\s+|class\s+|abstract\s+class\s+)(\w+)/gm,
      /^export\s+\{([^}]+)\}/gm,
    ];
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        if (m[1].includes(',')) {
          // named export block
          for (const part of m[1].split(',')) {
            const t = part.trim().replace(/^type\s+/, '');
            const as = t.match(/\w+\s+as\s+(\w+)/);
            names.add(as ? as[1] : t.split(/\s/)[0]);
          }
        } else {
          names.add(m[1].trim());
        }
      }
    }
    names.delete('');
    return names;
  }

  const classNames    = getDefinedNames(classTypesPath);
  const enhancedNames = getDefinedNames(enhancedPath);

  // Names unique to EnhancedClasses (not also in Class.ts)
  const uniqueToEnhanced = [...enhancedNames].filter(n => !classNames.has(n));
  // Names that are in BOTH (the duplicates)
  const duplicateNames   = [...enhancedNames].filter(n => classNames.has(n));

  console.log(`   Class.ts defines:          ${[...classNames].join(', ')}`);
  console.log(`   EnhancedClasses.ts defines: ${[...enhancedNames].join(', ')}`);
  console.log(`   Duplicates (in both):       ${duplicateNames.join(', ')}`);
  console.log(`   Unique to EnhancedClasses:  ${uniqueToEnhanced.length > 0 ? uniqueToEnhanced.join(', ') : '(none)'}\n`);

  if (duplicateNames.length > 0) {
    const barrel = read(typesBarrelPath);

    let updatedBarrel;

    if (uniqueToEnhanced.length === 0) {
      // EnhancedClasses only re-exports things already in Class.ts — remove it from barrel entirely
      console.log('   EnhancedClasses.ts adds nothing new — removing it from types/index.ts barrel.');
      updatedBarrel = barrel
        .replace(/^.*export\s+.*from\s+['"]\.\/Class['"]\s*;?\s*\n?/gm, '')
        .replace(/\n{3,}/g, '\n\n');
    } else {
      // EnhancedClasses.ts adds some unique names — use explicit named exports
      console.log('   Replacing  export * from EnhancedClasses  with explicit named exports.');
      const explicitLine = `export type { ${uniqueToEnhanced.join(', ')} } from './Class';`;
      updatedBarrel = barrel.replace(
        /^.*export\s+\*\s+from\s+['"]\.\/Class['"]\s*;?\s*$/gm,
        explicitLine
      );
    }

    if (updatedBarrel !== barrel) {
      write(typesBarrelPath, updatedBarrel);
      console.log('   ✓ types/index.ts updated.');
    } else {
      console.log('   ⚠  Could not auto-patch types/index.ts — the export * line may use');
      console.log('      a different format. Please manually replace:');
      console.log(`      export * from './Class'`);
      if (uniqueToEnhanced.length > 0) {
        console.log(`      with:`);
        console.log(`      export type { ${uniqueToEnhanced.join(', ')} } from './Class'`);
      } else {
        console.log(`      with: (nothing — remove the line entirely)`);
      }
    }
  } else {
    console.log('   ✓ No duplicate names found — types barrel is already clean.');
  }
} else {
  console.log('   One or more type files not found — check paths.');
}

// ── Final summary ─────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(64));
console.log(DRY_RUN
  ? '\n  Dry-run complete — no files were changed.\n'
  : '\n  Done.\n');
console.log('  Next steps:');
console.log('  1.  node fix-barrels.cjs --dry-run');
console.log('      ← re-run barrel check to confirm zero issues remain');
console.log('  2.  npx tsc --noEmit');
console.log('      ← confirm zero type errors');
console.log('  3.  npm run dev  ← smoke test');
console.log('═'.repeat(64));
console.log('');
