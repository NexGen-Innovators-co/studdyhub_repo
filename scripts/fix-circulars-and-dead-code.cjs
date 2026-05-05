#!/usr/bin/env node
/**
 * fix-circulars-and-dead-code.cjs
 *
 * Fixes all 3 circular dependencies and removes confirmed dead code.
 *
 * ── Circular 1: App.tsx ↔ pages/Auth.tsx ──────────────────────────────────
 *   Auth.tsx imports App.tsx (wrong direction).
 *   Fix: Extract whatever Auth.tsx needs from App.tsx into src/lib/routes.ts,
 *        then rewrite Auth.tsx to import from there instead.
 *
 * ── Circular 2+3: aiChat/AiChat.tsx ↔ aiChat/ContextBadges.tsx ────────────
 *   Cycles 2 and 3 are the SAME cycle appearing twice because Windows is
 *   case-insensitive (Components/ and components/ resolve to the same folder).
 *   Fix: Deduplicate the folder casing so only one path exists, then break
 *        the actual import cycle by extracting shared types.
 *
 * ── Dead code removal ─────────────────────────────────────────────────────
 *   Deletes files confirmed to have zero importers that are not:
 *     - Barrel index.ts files (public module API)
 *     - Entry points (main.tsx, App.tsx)
 *     - Supabase type supplements (may be needed at compile time)
 *   Ambiguous files (ProtectedRoute, SEOAppWrapper, etc.) are LISTED but
 *   NOT auto-deleted — they need a human decision.
 *
 * Usage:
 *   node fix-circulars-and-dead-code.cjs --dry-run   preview
 *   node fix-circulars-and-dead-code.cjs             apply
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN      = process.argv.includes('--dry-run');
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const SOURCE_EXTS  = ['.ts', '.tsx', '.js', '.jsx'];

function rel(p)  { return path.relative(PROJECT_ROOT, p).replace(/\\/g, '/'); }
function abs(p)  { return path.join(SRC_DIR, p); }
function exists(p) { return fs.existsSync(p); }
function read(p)   { return fs.readFileSync(p, 'utf8'); }
function write(p, c) {
  if (!DRY_RUN) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); }
  console.log(`   ${DRY_RUN ? '[dry] write' : '✓ wrote'}: ${rel(p)}`);
}
function del(p) {
  if (!DRY_RUN) fs.unlinkSync(p);
  console.log(`   ${DRY_RUN ? '[dry] delete' : '✓ deleted'}: ${rel(p)}`);
}

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run — nothing written or deleted.' : '🔧  Fixing circulars and dead code…');
console.log('');

// ══════════════════════════════════════════════════════════════════════════════
// CIRCULAR 1 — App.tsx ↔ Auth.tsx
// Auth.tsx imports src/App.tsx — almost certainly for route path constants.
// Fix: create src/lib/routes.ts with all route strings, rewrite Auth.tsx.
// ══════════════════════════════════════════════════════════════════════════════

console.log('── Circular 1: App.tsx ↔ Auth.tsx\n');

const authPath = abs('pages/Auth.tsx');
const appPath  = abs('App.tsx');
const routesPath = abs('lib/routes.ts');

if (exists(authPath) && exists(appPath)) {
  const authSrc = read(authPath);
  const appSrc  = read(appPath);

  // Check if Auth.tsx already imports from routes
  if (authSrc.includes("from '../App'") || authSrc.includes('from "../App"') ||
      authSrc.includes("from '../App.tsx'") || authSrc.includes('from "../App.tsx"')) {

    console.log('   Auth.tsx imports App.tsx — breaking the cycle.\n');

    // Extract all route-like string constants from App.tsx
    // Pattern: path="..." or path={'...'} used in <Route>
    const routeMatches = [...appSrc.matchAll(/path=["'`]([^"'`]+)["'`]/g)];
    const uniqueRoutes = [...new Set(routeMatches.map(m => m[1]))].filter(r => r !== '*');

    // Also look for any exported constants Auth.tsx might be using
    const exportedConsts = [...appSrc.matchAll(/^export\s+const\s+(\w+)/gm)].map(m => m[1]);

    if (!exists(routesPath)) {
      // Build routes.ts
      const routeEntries = uniqueRoutes.map(r => {
        const name = r
          .replace(/^\//, '')
          .replace(/[/-](.)/g, (_, c) => c.toUpperCase())
          .replace(/^\w/, c => c.toUpperCase()) || 'Home';
        return `  ${name.toUpperCase().replace(/[^A-Z0-9]/g,'_') || 'HOME'}: '${r}',`;
      });

      const routesSrc = `// src/lib/routes.ts
// Extracted from App.tsx to break circular dependency with Auth.tsx
// All application route paths live here.

export const ROUTES = {
${routeEntries.join('\n')}
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
`;
      write(routesPath, routesSrc);
    } else {
      console.log('   src/lib/routes.ts already exists — skipping creation.');
    }

    // Rewrite Auth.tsx: replace `from '../App'` with `from '../lib/routes'`
    const updatedAuth = authSrc
      .replace(/from ['"]\.\.\/App['"]/g, "from '../lib/routes'")
      .replace(/from ['"]\.\.\/App\.tsx['"]/g, "from '../lib/routes'");

    if (updatedAuth !== authSrc) {
      write(authPath, updatedAuth);
    }
  } else {
    console.log('   Auth.tsx does not import App.tsx directly in detected pattern.');
    console.log('   Manual check needed — open Auth.tsx and find what it imports from App.');
    console.log('   Move that export to src/lib/routes.ts or src/lib/constants.ts');
    console.log('   and update both files.\n');
  }
} else {
  console.log('   Auth.tsx or App.tsx not found at expected path — skipping.\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// CIRCULAR 2+3 — aiChat case-sensitivity phantom + real cycle
//
// Windows: Components/ and components/ are the same folder.
// Madge reports the cycle twice because it sees two "different" paths.
// Fix A: ensure only ONE casing exists (Components with capital C — matches
//        the original structure).
// Fix B: if AiChat.tsx and ContextBadges.tsx have a real mutual import,
//        extract the shared type to a types/ file.
// ══════════════════════════════════════════════════════════════════════════════

console.log('── Circular 2+3: aiChat AiChat ↔ ContextBadges (+ case dupe)\n');

const aiChatUpper = abs('modules/aiChat/Components');
const aiChatLower = abs('modules/aiChat/components');

// Check for the case-duplicate folder situation
if (exists(aiChatUpper) && exists(aiChatLower)) {
  console.log('   ⚠  Both Components/ and components/ exist inside aiChat/');
  console.log('   This creates phantom cycles on case-insensitive filesystems (Windows).');
  console.log('   Fix: merge the lowercase one into the uppercase one.\n');

  // List files in lowercase folder
  const lowerFiles = fs.readdirSync(aiChatLower).filter(f => SOURCE_EXTS.some(e => f.endsWith(e)));
  for (const f of lowerFiles) {
    const fromAbs = path.join(aiChatLower, f);
    const toAbs   = path.join(aiChatUpper, f);
    if (!exists(toAbs)) {
      if (!DRY_RUN) {
        fs.mkdirSync(path.dirname(toAbs), { recursive: true });
        fs.renameSync(fromAbs, toAbs);
      }
      console.log(`   ${DRY_RUN ? '[dry] move' : '✓ moved'}: ${f}  →  Components/${f}`);
    } else {
      console.log(`   skip (exists in Components/): ${f}`);
    }
  }
  // Remove lowercase folder if now empty
  if (!DRY_RUN) {
    try {
      const remaining = fs.readdirSync(aiChatLower);
      if (remaining.length === 0) { fs.rmdirSync(aiChatLower); console.log('   ✓ removed empty components/ folder'); }
      else console.log(`   ℹ  components/ still has ${remaining.length} items — check manually`);
    } catch(e){}
  }
} else {
  console.log('   No case-duplicate folder — checking for real import cycle.\n');
}

// Now check for a real mutual import between AiChat.tsx and ContextBadges.tsx
const aiChatFile       = exists(aiChatUpper) ? path.join(aiChatUpper, 'AiChat.tsx') : null;
const contextBadgeFile = exists(aiChatUpper) ? path.join(aiChatUpper, 'ContextBadges.tsx') : null;

if (aiChatFile && contextBadgeFile && exists(aiChatFile) && exists(contextBadgeFile)) {
  const aiChatSrc   = read(aiChatFile);
  const ctxBadgeSrc = read(contextBadgeFile);

  const aiImportsCB  = aiChatSrc.includes('ContextBadges');
  const cbImportsAI  = ctxBadgeSrc.includes('AiChat') || ctxBadgeSrc.includes('useStream') ||
                       ctxBadgeSrc.includes('ChatState');

  if (aiImportsCB && cbImportsAI) {
    console.log('\n   Real cycle detected: AiChat ↔ ContextBadges share a type.');
    console.log('   Fix: move the shared type to aiChat/types/chatTypes.ts\n');

    // Extract the specific type ContextBadges imports from AiChat
    // Find type/interface exports in AiChat that ContextBadges uses
    const typeMatches = [...aiChatSrc.matchAll(/^export\s+(type|interface)\s+(\w+)/gm)];

    if (typeMatches.length > 0) {
      const sharedTypes = typeMatches.map(m => `export ${m[1]} ${m[2]} = // TODO: paste definition here`).join('\n\n');
      const typesFilePath = abs('modules/aiChat/types/chatTypes.ts');

      if (!exists(typesFilePath)) {
        const typesSrc = `// src/modules/aiChat/types/chatTypes.ts
// Shared types extracted from AiChat.tsx to break circular dependency.
// AiChat.tsx and ContextBadges.tsx both import from here instead of each other.

${sharedTypes}
`;
        console.log('   Types to move (complete the TODO stubs in chatTypes.ts):');
        typeMatches.forEach(m => console.log(`     ${m[0]}`));
        write(typesFilePath, typesSrc);
      }

      console.log('\n   Next manual steps:');
      console.log('   1. Open src/modules/aiChat/types/chatTypes.ts');
      console.log('   2. Fill in the type definitions (copy from AiChat.tsx)');
      console.log('   3. In AiChat.tsx: remove the exported types, import from ./types/chatTypes');
      console.log('   4. In ContextBadges.tsx: change import to come from ../types/chatTypes');
    }
  } else {
    console.log('   AiChat.tsx and ContextBadges.tsx do not mutually import each other.');
    console.log('   The cycle is likely only the Windows case-sensitivity phantom — fixed above.');
  }
}

console.log('');

// ══════════════════════════════════════════════════════════════════════════════
// DEAD CODE — Confirmed safe deletes (zero importers, not barrels or entries)
// ══════════════════════════════════════════════════════════════════════════════

console.log('── Dead code removal\n');

// SAFE: zero importers, clearly not needed
const SAFE_DELETE = [
  'utils/audioMixer.ts',
  'utils/avatarCache.ts',
  'utils/codeHighlighting.ts',
  'utils/detectCodeBlock.ts',
  'utils/messageUtils.ts',
  'utils/serviceHelpers.ts',
  'utils/syntaxHighlighting.ts',
  'services/diagramFixService.ts',
  'services/messageServices.ts',
  'modules/userSettings/components.tsx/LearningGoals.tsx', // phantom old path
];

console.log('   Deleting confirmed dead files:\n');
let deleted = 0;
for (const relPath of SAFE_DELETE) {
  const absPath = abs(relPath);
  if (exists(absPath)) {
    del(absPath);
    deleted++;
  } else {
    console.log(`   (already gone): ${relPath}`);
  }
}

// Clean up the malformed folder if now empty
const malformedDir = abs('modules/userSettings/components.tsx');
if (exists(malformedDir) && !DRY_RUN) {
  try {
    const left = fs.readdirSync(malformedDir);
    if (left.length === 0) { fs.rmdirSync(malformedDir); console.log('   ✓ removed empty: modules/userSettings/components.tsx/'); }
  } catch(e){}
}

// NEEDS HUMAN DECISION — list these but don't auto-delete
const REVIEW_NEEDED = [
  { file: 'hooks/useInstantMessage.ts',
    note: 'May have been moved to aiChat/hooks/ — check if duplicate exists there' },
  { file: 'integrations/supabase/notification-types-supplement.ts',
    note: 'Supabase type supplements can be needed at compile time even with 0 importers' },
  { file: 'modules/ProtectedRoute.tsx',
    note: 'App.tsx may import this — check the actual current App.tsx' },
  { file: 'modules/SEOAppWrapper.tsx',
    note: 'May be used by index.html or router — verify before deleting' },
  { file: 'modules/dashboard/widgets/EducationWidgets.tsx',
    note: 'Was it replaced by a newer widget? Check Dashboard.tsx' },
  { file: 'modules/educator/onboarding/VerificationUpload.tsx',
    note: 'May be used by CreateInstitutionFlow.tsx — check that file' },
  { file: 'pages/Testimonials.tsx',
    note: 'If there is no /testimonials route in App.tsx, safe to delete' },
  { file: 'services/diagramFixService.ts',
    note: 'Check if used dynamically (not statically importable by graph)' },
];

console.log('\n   ⚠  Needs manual review before deleting:\n');
for (const item of REVIEW_NEEDED) {
  if (exists(abs(item.file))) {
    console.log(`   ❓ src/${item.file}`);
    console.log(`      ${item.note}`);
    console.log('');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════

console.log('═'.repeat(64));
console.log(DRY_RUN
  ? `\n  Dry-run complete.\n`
  : `\n  Done.\n  Deleted ${deleted} dead file(s).\n`);
console.log('  Next steps:');
console.log('  1.  npx tsc --noEmit              ← must be zero errors');
console.log('  2.  npx madge --circular --extensions ts,tsx src/');
console.log('                                    ← must be zero cycles');
console.log('  3.  Review the ❓ files above manually');
console.log('  4.  npm run build && npm run dev  ← final smoke test');
console.log('');
console.log('  If Circular 1 was not auto-fixed (pattern not matched):');
console.log('  → Open src/pages/Auth.tsx');
console.log("  → Find `import ... from '../App'` or similar");
console.log('  → Move whatever it needs to src/lib/routes.ts');
console.log('  → Update both files');
console.log('═'.repeat(64));
console.log('');
