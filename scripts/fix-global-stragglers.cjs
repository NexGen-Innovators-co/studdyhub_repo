#!/usr/bin/env node
/**
 * fix-global-stragglers.cjs
 *
 * Moves every remaining feature-specific file from the global folders into
 * its correct module subfolder. Based on real import graph analysis:
 *
 * src/services/ → module/services/
 *   contentModerationService  → social/services/
 *   courseAIGenerationService → courseLibrary/services/
 *   imageGenerationService    → aiChat/services/
 *   liveQuizService           → quizzes/services/
 *   podcastLiveService        → podcasts/services/
 *   podcastModerationService  → podcasts/services/
 *   transcriptionService      → podcasts/services/
 *
 * src/utils/ → module/utils/
 *   adminActivityLogger       → admin/utils/
 *   calculateTypyingSpeed     → aiChat/utils/
 *   markdownUtils             → notes/utils/
 *   tokenCounter              → aiChat/utils/
 *   validation                → social/utils/
 *
 * src/constants/ → module/config/
 *   aiSuggestions             → notes/config/
 *
 * src/contexts/ → module/context/
 *   EducatorContext           → educator/context/
 *
 * All staying global (genuinely cross-cutting, confirmed by import graph):
 *   aiServices, calendarIntegrationService, cloudTtsService,
 *   courseProgressService, globalSearchService, messageServices,
 *   notificationHelpers, notificationInitService,
 *   notificationPreferencesService, pushNotificationService,
 *   diagramFixService, offlineStorage, socialCache, authSessionTracker,
 *   requestCache, serviceHelpers, verifyAccess, AppContext, appReducer
 *
 * Usage (from project root beside src/):
 *   node fix-global-stragglers.cjs --dry-run   preview only
 *   node fix-global-stragglers.cjs             apply all moves
 *   node fix-global-stragglers.cjs --verbose   show every import rewrite
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

// ── Explicit move plan (derived from real import graph) ───────────────────────
// from: relative to src/    to: relative to src/
const MOVE_PLAN = [
  // ── Services ──────────────────────────────────────────────────────────────
  {
    from: 'services/contentModerationService.ts',
    to:   'modules/social/services/contentModerationService.ts',
    why:  'only imported by social/ContentModerationFeedback',
  },
  {
    from: 'services/courseAIGenerationService.ts',
    to:   'modules/courseLibrary/services/courseAIGenerationService.ts',
    why:  'only imported by courseLibrary/GenerateCourseResourcesDialog',
  },
  {
    from: 'services/imageGenerationService.ts',
    to:   'modules/aiChat/services/imageGenerationService.ts',
    why:  'only imported by aiChat/ImageGenerator',
  },
  {
    from: 'services/liveQuizService.ts',
    to:   'modules/quizzes/services/liveQuizService.ts',
    why:  'only imported by quizzes module (12 files)',
  },
  {
    from: 'services/podcastLiveService.ts',
    to:   'modules/podcasts/services/podcastLiveService.ts',
    why:  'only imported by podcasts components',
  },
  {
    from: 'services/podcastModerationService.ts',
    to:   'modules/podcasts/services/podcastModerationService.ts',
    why:  'imported by podcasts + dashboard/PodcastButton (podcasts-adjacent)',
  },
  {
    from: 'services/transcriptionService.ts',
    to:   'modules/podcasts/services/transcriptionService.ts',
    why:  'only imported by podcasts components',
  },

  // ── Utils ─────────────────────────────────────────────────────────────────
  {
    from: 'utils/adminActivityLogger.ts',
    to:   'modules/admin/utils/adminActivityLogger.ts',
    why:  'only imported by admin components',
  },
  {
    from: 'utils/calculateTypyingSpeed.ts',
    to:   'modules/aiChat/utils/calculateTypyingSpeed.ts',
    why:  'only imported by aiChat/MarkdownRenderer',
  },
  {
    from: 'utils/markdownUtils.ts',
    to:   'modules/notes/utils/markdownUtils.ts',
    why:  'only imported by notes components',
  },
  {
    from: 'utils/tokenCounter.ts',
    to:   'modules/aiChat/utils/tokenCounter.ts',
    why:  'only imported by aiChat/useMessageHandlers',
  },
  {
    from: 'utils/validation.ts',
    to:   'modules/social/utils/validation.ts',
    why:  'primarily imported by social components (6 of 7 importers are social)',
  },

  // ── Constants → module config ─────────────────────────────────────────────
  {
    from: 'constants/aiSuggestions.ts',
    to:   'modules/notes/config/aiSuggestions.ts',
    why:  'only imported by notes/AISuggestionsPopup',
  },

  // ── Contexts ──────────────────────────────────────────────────────────────
  {
    from: 'contexts/EducatorContext.tsx',
    to:   'modules/educator/context/EducatorContext.tsx',
    why:  'only imported by educator module (8 files)',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function stripExt(p) { return p.replace(/\.(ts|tsx|js|jsx)$/, ''); }
function rel(p)      { return path.relative(PROJECT_ROOT, p).replace(/\\/g, '/'); }

// ── Validate plan against real filesystem ─────────────────────────────────────

console.log('');
console.log(DRY_RUN ? '🔍  Dry-run — nothing will be written or moved.'
                    : '🔧  Moving global files to their module homes…');
console.log('');

const validated = [];
const skipped   = [];

for (const move of MOVE_PLAN) {
  const fromAbs = path.join(SRC_DIR, move.from);
  const toAbs   = path.join(SRC_DIR, move.to);

  if (!fs.existsSync(fromAbs)) {
    skipped.push({ ...move, reason: 'source not found (already moved?)' });
    continue;
  }
  if (fs.existsSync(toAbs)) {
    skipped.push({ ...move, reason: 'destination already exists' });
    continue;
  }

  validated.push({ ...move, fromAbs, toAbs });
}

// ── Print plan ────────────────────────────────────────────────────────────────

// Group by destination module
const byModule = {};
for (const m of validated) {
  const modName = m.to.replace('modules/','').split('/')[0];
  (byModule[modName] = byModule[modName] ?? []).push(m);
}

console.log(`┌─ ${validated.length} files to move\n│`);
for (const [mod, list] of Object.entries(byModule).sort()) {
  console.log(`│  📦 ${mod}/`);
  for (const m of list) {
    console.log(`│    ${path.basename(m.from)}`);
    console.log(`│      src/${m.from}`);
    console.log(`│    → src/${m.to}`);
    console.log(`│      why: ${m.why}`);
    console.log('│');
  }
}

if (skipped.length) {
  console.log(`\n  Skipped ${skipped.length} (source missing or dest exists):`);
  skipped.forEach(s => console.log(`    ${s.from}  —  ${s.reason}`));
}

if (validated.length === 0) {
  console.log('\n✓ Nothing to move — all files are already in place.\n');
  process.exit(0);
}

// ── Phase 1: Snapshot ALL files BEFORE any move ───────────────────────────────

const allFiles = walkDir(SRC_DIR);
const fileSet  = new Set(allFiles.map(f => path.normalize(f)));

// Build move lookup: old normalised abs → new abs
const moveMap = new Map();
for (const m of validated) {
  moveMap.set(path.normalize(m.fromAbs), m.toAbs);
}

// ── Phase 2: Rewrite ALL imports across whole codebase (nothing moved yet) ────

console.log('\n── Phase 2: rewriting imports…\n');

const STATIC_RE  = /((?:import|export)[\s\S]*?\bfrom\s*['"])([^'"]+?)(['"])/g;
const DYNAMIC_RE = /(\bimport\s*\(\s*['"])([^'"]+?)(['"]\s*\))/g;

let totalPatched = 0;

for (const sourceFile of allFiles) {
  if (!fs.existsSync(sourceFile)) continue;

  const original = fs.readFileSync(sourceFile, 'utf8');
  let   changed  = false;

  function replacer(match, prefix, importStr, suffix) {
    if (!importStr.startsWith('.') && !importStr.startsWith('@/')) return match;

    const base = importStr.startsWith('@/')
      ? path.join(SRC_DIR, importStr.slice(2))
      : path.join(path.dirname(sourceFile), importStr);

    const candidates = [
      base,
      ...SOURCE_EXTS.map(e => base + e),
      ...SOURCE_EXTS.map(e => path.join(base, 'index' + e)),
    ];

    const hit = candidates.find(c => moveMap.has(path.normalize(c)));
    if (!hit) return match;

    const newAbs = moveMap.get(path.normalize(hit));

    let newImp;
    if (importStr.startsWith('@/')) {
      newImp = '@/' + stripExt(path.relative(SRC_DIR, newAbs).replace(/\\/g, '/'));
    } else {
      let r = path.relative(path.dirname(sourceFile), newAbs).replace(/\\/g, '/');
      r = stripExt(r);
      if (!r.startsWith('.')) r = './' + r;
      newImp = r;
    }

    if (VERBOSE) console.log(`   ${rel(sourceFile)}\n     ${importStr}  →  ${newImp}`);
    changed = true;
    return `${prefix}${newImp}${suffix}`;
  }

  let updated = original.replace(STATIC_RE,  replacer);
  updated     = updated .replace(DYNAMIC_RE, replacer);

  if (changed) {
    totalPatched++;
    if (!DRY_RUN) fs.writeFileSync(sourceFile, updated, 'utf8');
    if (!VERBOSE) console.log(`   ${DRY_RUN ? '[dry] ' : ''}patched: ${rel(sourceFile)}`);
  }
}

console.log(`\n   ${DRY_RUN ? 'Would patch' : 'Patched'} ${totalPatched} file(s).`);

// ── Phase 3: Physically move all files ───────────────────────────────────────

console.log('\n── Phase 3: moving files…\n');

for (const m of validated) {
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(m.toAbs), { recursive: true });
    fs.renameSync(m.fromAbs, m.toAbs);
    console.log(`   ✓  ${path.basename(m.from)}  →  modules/${byModule[Object.keys(byModule).find(k=>byModule[k].includes(m))]?.find ? '' : ''}${m.to.replace('modules/','').split('/').slice(0,-1).join('/')}/`);
  } else {
    console.log(`   [dry]  ${m.from}  →  ${m.to}`);
  }
}

// ── Phase 4: Clean up empty source folders ────────────────────────────────────

if (!DRY_RUN) {
  const sourceDirs = new Set(validated.map(m => path.dirname(m.fromAbs)));
  for (const d of sourceDirs) {
    if (!fs.existsSync(d)) continue;
    const remaining = fs.readdirSync(d).filter(e => SOURCE_EXTS.some(x => e.endsWith(x)));
    if (remaining.length === 0) {
      try {
        fs.rmdirSync(d);
        console.log(`\n   🗑  removed now-empty: ${rel(d)}`);
      } catch (e) { /* not empty at dir level — ignore */ }
    } else {
      console.log(`\n   ℹ  ${rel(d)} still has ${remaining.length} file(s) — kept`);
    }
  }
}

// ── Phase 5: Update module index.ts barrel files ──────────────────────────────

console.log('\n── Phase 5: checking module barrel files…\n');

for (const m of validated) {
  const modPath  = path.join(SRC_DIR, m.to.split('/').slice(0, 3).join('/'));
  const indexPath = path.join(modPath, 'index.ts');
  if (!fs.existsSync(indexPath)) continue;

  let src     = fs.readFileSync(indexPath, 'utf8');
  const base   = path.basename(m.from, path.extname(m.from));
  const newSub = m.to.replace('modules/', '').split('/').slice(1, -1).join('/');
  const newRef = `./${newSub}/${base}`;
  const oldRef = `./${base}`;

  // Only patch if the old bare reference exists
  if (src.includes(`'${oldRef}'`) || src.includes(`"${oldRef}"`)) {
    src = src
      .replace(new RegExp(`'${oldRef.replace(/\//g,'\\/')}'`, 'g'), `'${newRef}'`)
      .replace(new RegExp(`"${oldRef.replace(/\//g,'\\/')}"`, 'g'), `"${newRef}"`);
    if (!DRY_RUN) fs.writeFileSync(indexPath, src, 'utf8');
    console.log(`   ${DRY_RUN ? '[dry] ' : ''}updated barrel: ${rel(indexPath)}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(64));
console.log(DRY_RUN
  ? `\n  Dry-run: would move ${validated.length} file(s), patch ${totalPatched} import(s).\n`
  : `\n  Done. Moved ${validated.length} file(s), patched ${totalPatched} import(s).\n`);
console.log('  What stayed global (cross-cutting, used by 3+ modules):');
[
  'aiServices               — admin + notes + social',
  'calendarIntegrationService — schedules + auth + pages',
  'cloudTtsService           — aiChat + podcasts',
  'courseProgressService     — notes + quizzes',
  'globalSearchService       — aiChat + notes + podcasts + quizzes',
  'notificationHelpers       — admin + notifications + podcasts + social',
  'notificationInitService   — auth + notifications + onboarding + pages',
  'pushNotificationService   — auth + notifications',
  'offlineStorage            — app-wide',
  'socialCache               — app-wide',
  'AppContext / appReducer   — root-level',
].forEach(l => console.log(`    ${l}`));
console.log('\n' + '═'.repeat(64));

if (!DRY_RUN) {
  console.log('\nNext steps:');
  console.log('  1.  npx tsc --noEmit        ← confirm zero type errors');
  console.log('  2.  node dependency-map.cjs  ← regenerate the dependency map');
  console.log('  3.  npm run dev              ← smoke test in the browser');
  console.log('');
}
