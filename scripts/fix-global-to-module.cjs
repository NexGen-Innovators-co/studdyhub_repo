#!/usr/bin/env node
/**
 * fix-global-to-module.cjs
 *
 * Finds files that live in the GLOBAL folders (src/hooks, src/services,
 * src/utils) but actually belong to a specific feature module, then moves
 * them into the correct module subfolder and rewrites every import.
 *
 * A file "belongs" to a module when:
 *   - Its name contains the module keyword  (useCourseLibrary → courseLibrary)
 *   - OR it is ONLY imported by files inside one single module
 *   - OR its content only references one module's types/supabase tables
 *
 * Usage (from the project root beside src/):
 *   node fix-global-to-module.cjs --dry-run    ← preview, nothing written
 *   node fix-global-to-module.cjs              ← apply all moves
 *   node fix-global-to-module.cjs --verbose    ← show every import rewrite
 *   node fix-global-to-module.cjs --report     ← show analysis only, no moves
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN      = process.argv.includes('--dry-run');
const VERBOSE      = process.argv.includes('--verbose');
const REPORT_ONLY  = process.argv.includes('--report');
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const MODULES_DIR  = path.join(SRC_DIR, 'modules');
const SOURCE_EXTS  = ['.ts', '.tsx', '.js', '.jsx'];

// ── Module keyword map ────────────────────────────────────────────────────────
// Maps every keyword that appears in a filename to its module folder.
// If a filename matches a keyword, it's a candidate for that module.
const MODULE_KEYWORDS = {
  // keyword (lowercase)    :  module folder name
  'courseenrollment'        : 'courseLibrary',
  'courselibrary'           : 'courseLibrary',
  'courseprogress'          : 'courseLibrary',
  'courseresource'          : 'courseLibrary',
  'educatorcourse'          : 'educator',
  'educatorpermission'      : 'educator',
  'institution'             : 'educator',
  'institutionmember'       : 'educator',
  'roleverification'        : 'educator',
  'roleupgrade'             : 'educator',
  'podcast'                 : 'podcasts',
  'podcastcredit'           : 'podcasts',
  'quiz'                    : 'quizzes',
  'dailyquiz'               : 'quizzes',
  'exammode'                : 'quizzes',
  'schedule'                : 'schedules',
  'calendar'                : 'schedules',
  'social'                  : 'social',
  'chat'                    : 'social',
  'notification'            : 'notifications',
  'dashboard'               : 'dashboard',
  'dailyactivity'           : 'dashboard',
  'subscription'            : 'subscription',
  'featureaccess'           : 'subscription',
  'document'                : 'documents',
  'folder'                  : 'documents',
  'recording'               : 'classRecordings',
  'chunkedrecording'        : 'classRecordings',
  'streamingupload'         : 'classRecordings',
  'audioprocessing'         : 'classRecordings',
  'transcription'           : 'classRecordings',
  'messagehandler'          : 'aiChat',
  'instantmessage'          : 'aiChat',
  'streamingchat'           : 'aiChat',
  'imagegeneration'         : 'aiChat',
  'aimessagetracker'        : 'aiChat',
  'enhancedtyping'          : 'aiChat',
  'typing'                  : 'aiChat',
  'globalsearch'            : 'layout',
  'onlineStatus'            : 'layout',
  'useronlineStatus'        : 'layout',
  'webrTC'                  : 'podcasts',
  'webrtc'                  : 'podcasts',
  'offlineSync'             : 'layout',
  'userverification'        : 'educator',
  'useractivity'            : 'dashboard',
  'education'               : 'onboarding',
  'educationcontext'        : 'onboarding',
  'educationframework'      : 'onboarding',
  'onboarding'              : 'onboarding',
};

// Canonical subfolder per file type
const TYPE_FOLDER = {
  hook    : 'hooks',
  service : 'services',
  util    : 'utils',
  type    : 'types',
  config  : 'config',
  component: 'components',
};

// Files that should stay global (used by many modules or truly cross-cutting)
const KEEP_GLOBAL = new Set([
  'useAuth',
  'useAppContext',
  'useAppData',
  'useAppOperations',
  'useSubscription',
  'useFeatureAccess',
  'useOfflineSync',
  'useOnlineStatus',
  'useAdminAuth',
  'useMobile',
  'use-mobile',
  'use-toast',
  'useToast',
  'useNotifications',
  'useSocialData',
  'useDailyActivity',
  'useUserActivityLogger',
  'useUserVerificationStatus',
  'aiServices',
  'contentModerationService',
  'globalSearchService',
  'notificationHelpers',
  'notificationInitService',
  'notificationPreferencesService',
  'pushNotificationService',
  'messageServices',
  'diagramFixService',
  'imageGenerationService',
  'liveQuizService',
  'courseAIGenerationService',
  'courseProgressService',
  'calendarIntegrationService',
  'cloudTtsService',
  'podcastLiveService',
  'podcastModerationService',
  'transcriptionService',
  'offlineStorage',
  'socialCache',
  'authSessionTracker',
  'requestCache',
  'tokenCounter',
  'validation',
  'markdownUtils',
  'serviceHelpers',
  'adminActivityLogger',
  'verifyAccess',
  'codeHighlighting',
  'syntaxHighlighting',
  'detectCodeBlock',
  'avatarCache',
  'audioMixer',
  'messageUtils',
  'calculateTypyingSpeed',
]);

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

// ── File type classifier ──────────────────────────────────────────────────────

function classifyFile(absPath) {
  const base = path.basename(absPath, path.extname(absPath));
  const ext  = path.extname(absPath);
  const src  = fs.readFileSync(absPath, 'utf8');

  if (/^use[A-Z]/.test(base)) return 'hook';
  if (ext === '.tsx') return 'component';

  if (ext === '.ts') {
    const noComments = src.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
    if (!/\bfunction\b/.test(noComments) &&
        !/\bconst\s+\w+\s*=\s*(async\s*)?\(/.test(noComments) &&
        /export\s+(type|interface|enum)/.test(noComments)) return 'type';

    if (/\basync\s+function\b/.test(src) ||
        /supabase\.(from|auth|storage|rpc|functions)/.test(src) ||
        /\bfetch\s*\(/.test(src)) return 'service';

    if (/^export\s+const\s+[A-Z_]+\s*=/m.test(src) &&
        !/\basync\b/.test(src) && !/\bfunction\b/.test(src)) return 'config';

    if (/export\s+(const|function)/.test(src)) return 'util';
  }
  return 'unknown';
}

// ── Build import graph ────────────────────────────────────────────────────────
// importedBy[absPath] = Set of absolute paths that import it

function buildImportGraph(allFiles) {
  const fileSet   = new Set(allFiles.map(f => path.normalize(f)));
  const importedBy = {};
  for (const f of allFiles) importedBy[f] = new Set();

  const STATIC_RE  = /(?:import|export)[\s\S]*?\bfrom\s*['"]([^'"]+?)['"]/g;
  const DYNAMIC_RE = /\bimport\s*\(\s*['"]([^'"]+?)['"]\s*\)/g;

  for (const file of allFiles) {
    const src = fs.readFileSync(file, 'utf8');
    const importStrs = [];
    let m;
    STATIC_RE .lastIndex = 0; while ((m = STATIC_RE .exec(src)) !== null) importStrs.push(m[1]);
    DYNAMIC_RE.lastIndex = 0; while ((m = DYNAMIC_RE.exec(src)) !== null) importStrs.push(m[1]);

    for (const imp of importStrs) {
      if (!imp.startsWith('.') && !imp.startsWith('@/')) continue;
      let base;
      if (imp.startsWith('@/')) base = path.join(SRC_DIR, imp.slice(2));
      else base = path.join(path.dirname(file), imp);

      const candidates = [base, ...SOURCE_EXTS.map(e=>base+e),
                          ...SOURCE_EXTS.map(e=>path.join(base,'index'+e))];
      const resolved = candidates.find(c => fileSet.has(path.normalize(c)));
      if (resolved && importedBy[resolved]) {
        importedBy[resolved].add(file);
      }
    }
  }
  return importedBy;
}

// ── Module affinity detector ──────────────────────────────────────────────────

/**
 * Returns { module, reason, confidence } for a file that should move,
 * or null if it should stay global.
 */
function detectModule(absPath, importedBy) {
  const base      = path.basename(absPath, path.extname(absPath));
  const baseLower = base.toLowerCase().replace(/[^a-z]/g, '');

  // 1. Check keep-global list
  if (KEEP_GLOBAL.has(base)) return null;

  // 2. Name-based match (strongest signal)
  let nameMatch = null;
  for (const [kw, mod] of Object.entries(MODULE_KEYWORDS)) {
    if (baseLower.includes(kw.toLowerCase())) {
      nameMatch = { module: mod, reason: `name contains "${kw}"`, confidence: 'high' };
      break;
    }
  }

  // 3. Importer-based match — if ALL importers are in ONE module, it belongs there
  const importers = [...(importedBy[absPath] ?? [])];
  let importerMatch = null;

  if (importers.length > 0) {
    const moduleOf = (p) => {
      const r = path.relative(MODULES_DIR, p).replace(/\\/g, '/');
      return r.startsWith('..') ? null : r.split('/')[0];
    };
    const mods = new Set(importers.map(moduleOf).filter(Boolean));
    if (mods.size === 1) {
      const [onlyMod] = mods;
      importerMatch = {
        module: onlyMod,
        reason: `only imported by ${importers.length} file(s) in "${onlyMod}"`,
        confidence: importers.length >= 2 ? 'high' : 'medium',
      };
    }
  }

  // 4. Zero importers + name match → move with low confidence (annotated)
  if (!nameMatch && !importerMatch) {
    if (importers.length === 0) return null; // truly orphaned — don't move
    return null;
  }

  // Prefer name match; use importer match as tie-break or confirmation
  if (nameMatch && importerMatch) {
    // Both agree → very high confidence
    if (nameMatch.module === importerMatch.module) {
      return { ...nameMatch, confidence: 'confirmed', importerCount: importers.length };
    }
    // Disagree → trust name match but note disagreement
    return { ...nameMatch, confidence: 'medium',
             note: `importers suggest "${importerMatch.module}" but name points to "${nameMatch.module}"` };
  }

  return nameMatch ?? importerMatch;
}

// ── Import rewriter ───────────────────────────────────────────────────────────

const STATIC_RE  = /((?:import|export)[\s\S]*?\bfrom\s*['"])([^'"]+?)(['"])/g;
const DYNAMIC_RE = /(\bimport\s*\(\s*['"])([^'"]+?)(['"]\s*\))/g;

function rewriteImportsForMove(allFiles, oldAbs, newAbs) {
  let total = 0;
  for (const f of allFiles) {
    const original = fs.readFileSync(f, 'utf8');
    let changed = false;

    function replacer(match, prefix, importStr, suffix) {
      if (!importStr.startsWith('.') && !importStr.startsWith('@/')) return match;
      let base;
      if (importStr.startsWith('@/')) base = path.join(SRC_DIR, importStr.slice(2));
      else base = path.join(path.dirname(f), importStr);

      const candidates = [base, ...SOURCE_EXTS.map(e=>base+e),
                          ...SOURCE_EXTS.map(e=>path.join(base,'index'+e))];
      if (!candidates.some(c => path.normalize(c) === path.normalize(oldAbs))) return match;

      // Build new import
      let newImp;
      if (importStr.startsWith('@/')) {
        newImp = '@/' + stripExt(path.relative(SRC_DIR, newAbs).replace(/\\/g,'/'));
      } else {
        let r = path.relative(path.dirname(f), newAbs).replace(/\\/g,'/');
        r = stripExt(r);
        if (!r.startsWith('.')) r = './' + r;
        newImp = r;
      }

      if (VERBOSE) console.log(`      ${rel(f)}\n        ${importStr}  →  ${newImp}`);
      changed = true;
      return `${prefix}${newImp}${suffix}`;
    }

    let updated = original.replace(STATIC_RE,  replacer);
    updated     = updated .replace(DYNAMIC_RE, replacer);

    if (changed) {
      total++;
      if (!DRY_RUN && !REPORT_ONLY) fs.writeFileSync(f, updated, 'utf8');
      if (!VERBOSE) console.log(`      ${DRY_RUN||REPORT_ONLY?'[dry] ':''}patched: ${rel(f)}`);
    }
  }
  return total;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('');
console.log(REPORT_ONLY ? '📊  Analysis report — no changes will be made.'
  : DRY_RUN ? '🔍  Dry-run — nothing will be written or moved.'
  : '🔧  Moving feature files to their module homes…');
console.log('');

// Collect candidate files from global folders
const GLOBAL_DIRS = [
  path.join(SRC_DIR, 'hooks'),
  path.join(SRC_DIR, 'services'),
  path.join(SRC_DIR, 'utils'),
];

const candidateFiles = GLOBAL_DIRS.flatMap(d => walkDir(d));
const allFiles       = walkDir(SRC_DIR);
const importedByMap  = buildImportGraph(allFiles);

// Analyse each candidate
const toMove   = [];  // { absPath, fileType, targetModule, targetFolder, fromRel, toRel, info }
const keepGlobal = [];
const uncertain  = [];

for (const f of candidateFiles) {
  const base     = path.basename(f, path.extname(f));
  if (base === 'index') continue;

  const fileType = classifyFile(f);
  const info     = detectModule(f, importedByMap);

  if (!info) {
    keepGlobal.push({ file: f, base, reason: 'globally used or keep-listed' });
    continue;
  }

  if (info.confidence === 'medium' && info.note) {
    uncertain.push({ file: f, base, info });
    continue;
  }

  const targetFolder = TYPE_FOLDER[fileType] ?? 'utils';
  const toAbs        = path.join(MODULES_DIR, info.module, targetFolder, path.basename(f));

  // Already exists at destination → skip
  if (fs.existsSync(toAbs)) {
    keepGlobal.push({ file: f, base, reason: `already exists at ${rel(toAbs)}` });
    continue;
  }

  toMove.push({
    absPath: f,
    base,
    fileType,
    targetModule: info.module,
    targetFolder,
    fromRel: rel(f),
    toRel:   rel(toAbs),
    toAbs,
    info,
  });
}

// ── Print report ──────────────────────────────────────────────────────────────

// Group moves by target module
const byModule = {};
for (const m of toMove) {
  (byModule[m.targetModule] = byModule[m.targetModule] ?? []).push(m);
}

console.log(`┌─ Files to MOVE into modules (${toMove.length} total)`);
console.log('│');
for (const [mod, list] of Object.entries(byModule).sort()) {
  console.log(`│  📦 ${mod}/`);
  for (const m of list) {
    const conf = m.info.confidence === 'confirmed' ? '✓✓' :
                 m.info.confidence === 'high'      ? '✓ ' : '? ';
    console.log(`│    ${conf} ${m.base}  [${m.fileType}]`);
    console.log(`│       ${m.fromRel}`);
    console.log(`│    →  ${m.toRel}`);
    console.log(`│       reason: ${m.info.reason}`);
    if (m.info.importerCount) console.log(`│       importers: ${m.info.importerCount}`);
    console.log('│');
  }
}

if (uncertain.length) {
  console.log(`┌─ UNCERTAIN — needs manual decision (${uncertain.length} files)`);
  for (const u of uncertain) {
    console.log(`│  ${u.base}`);
    console.log(`│    ${u.info.note}`);
    console.log(`│    ${rel(u.file)}`);
    console.log('│');
  }
}

if (keepGlobal.length) {
  console.log(`\n  Staying global: ${keepGlobal.length} file(s) — genuinely shared`);
  if (VERBOSE) keepGlobal.forEach(k => console.log(`    ${k.base}  (${k.reason})`));
}

console.log('');

if (REPORT_ONLY || toMove.length === 0) {
  if (toMove.length === 0) console.log('Nothing to move.\n');
  process.exit(0);
}

// ── Execute moves ─────────────────────────────────────────────────────────────

let totalImportFixes = 0;

for (const move of toMove) {
  console.log(`── ${move.base}  →  ${move.targetModule}/${move.targetFolder}/`);
  const fixed = rewriteImportsForMove(allFiles, move.absPath, move.toAbs);
  totalImportFixes += fixed;
  if (fixed === 0) console.log('      (no files import this)');

  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(move.toAbs), { recursive: true });
    fs.renameSync(move.absPath, move.toAbs);
    console.log(`   ✓ moved`);
  }
  console.log('');
}

// ── Update global barrel index files ─────────────────────────────────────────

for (const globalDir of GLOBAL_DIRS) {
  const indexPath = path.join(globalDir, 'index.ts');
  if (!fs.existsSync(indexPath)) continue;

  let src     = fs.readFileSync(indexPath, 'utf8');
  let changed = false;

  for (const m of toMove) {
    const oldExport = `./${m.base}`;
    if (src.includes(oldExport)) {
      // Comment it out rather than delete, so nothing silently breaks
      src     = src.replace(new RegExp(`^(export .* from ['"]${oldExport}['"].*)$`, 'gm'),
                            `// moved to ${m.toRel}\n// $1`);
      changed = true;
    }
  }

  if (changed && !DRY_RUN) {
    fs.writeFileSync(indexPath, src, 'utf8');
    console.log(`   updated barrel: ${rel(indexPath)}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('═'.repeat(64));
console.log(DRY_RUN
  ? `\n  Dry-run: would move ${toMove.length} file(s), fix ${totalImportFixes} import(s).\n`
  : `\n  Done. Moved ${toMove.length} file(s), fixed ${totalImportFixes} import reference(s).\n`);

if (uncertain.length) {
  console.log(`  ⚠  ${uncertain.length} file(s) need manual review (see output above).`);
}

console.log('═'.repeat(64));
if (!DRY_RUN) {
  console.log('\nNext steps:');
  console.log('  1.  npx tsc --noEmit        ← confirm no type errors');
  console.log('  2.  node dependency-map.cjs  ← regenerate clean dependency map');
  console.log('  3.  Review uncertain files listed above manually');
  console.log('');
}
