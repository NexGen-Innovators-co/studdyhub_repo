#!/usr/bin/env node
/**
 * fix-global-to-module.cjs  (v2)
 *
 * Moves feature-specific files from global src/hooks, src/services, src/utils
 * into their correct module subfolders, then rewrites all imports.
 *
 * v2 fix: separates into 3 clean phases so no file is read after being moved:
 *   Phase 1 — Analyse & plan all moves (nothing written)
 *   Phase 2 — Rewrite ALL imports for ALL planned moves (files still at old paths)
 *   Phase 3 — Move ALL files physically (old paths still exist during phase 2)
 *
 * Usage:
 *   node fix-global-to-module.cjs --dry-run   preview only
 *   node fix-global-to-module.cjs             apply
 *   node fix-global-to-module.cjs --report    analysis only, no changes
 *   node fix-global-to-module.cjs --verbose   show every import rewrite
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN     = process.argv.includes('--dry-run');
const VERBOSE     = process.argv.includes('--verbose');
const REPORT_ONLY = process.argv.includes('--report');
const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, 'src');
const MODULES_DIR  = path.join(SRC_DIR, 'modules');
const SOURCE_EXTS  = ['.ts', '.tsx', '.js', '.jsx'];

// ── Module keyword map ────────────────────────────────────────────────────────
const MODULE_KEYWORDS = {
  'courseenrollment'  : 'courseLibrary',
  'courselibrary'     : 'courseLibrary',
  'courseprogress'    : 'courseLibrary',
  'courseresource'    : 'courseLibrary',
  'educatorcourse'    : 'educator',
  'educatorpermission': 'educator',
  'institution'       : 'educator',
  'institutionmember' : 'educator',
  'roleverification'  : 'educator',
  'podcast'           : 'podcasts',
  'podcastcredit'     : 'podcasts',
  'webrtc'            : 'podcasts',
  'quiz'              : 'quizzes',
  'dailyquiz'         : 'quizzes',
  'exammode'          : 'quizzes',
  'schedule'          : 'schedules',
  'calendar'          : 'schedules',
  'social'            : 'social',
  'notification'      : 'notifications',
  'dashboard'         : 'dashboard',
  'dailyactivity'     : 'dashboard',
  'subscription'      : 'subscription',
  'featureaccess'     : 'subscription',
  'document'          : 'documents',
  'folder'            : 'documents',
  'recording'         : 'classRecordings',
  'chunkedrecording'  : 'classRecordings',
  'streamingupload'   : 'classRecordings',
  'audioprocessing'   : 'classRecordings',
  'messagehandler'    : 'aiChat',
  'instantmessage'    : 'aiChat',
  'streamingchat'     : 'aiChat',
  'imagegeneration'   : 'aiChat',
  'aimessagetracker'  : 'aiChat',
  'typing'            : 'aiChat',
  'globalsearch'      : 'layout',
  'educationcontext'  : 'onboarding',
  'educationframework': 'onboarding',
  'useractivity'      : 'dashboard',
  'userverification'  : 'educator',
};

const TYPE_FOLDER = {
  hook: 'hooks', service: 'services', util: 'utils',
  type: 'types', config: 'config', component: 'components',
};

const KEEP_GLOBAL = new Set([
  'useAuth','useAppContext','useAppData','useAppOperations','useSubscription',
  'useFeatureAccess','useOfflineSync','useOnlineStatus','useAdminAuth',
  'useMobile','use-mobile','use-toast','useToast','useNotifications',
  'useSocialData','useDailyActivity','useUserActivityLogger',
  'useUserVerificationStatus','useCopyToClipboard',
  'aiServices','contentModerationService','globalSearchService',
  'notificationHelpers','notificationInitService','notificationPreferencesService',
  'pushNotificationService','messageServices','diagramFixService',
  'imageGenerationService','liveQuizService','courseAIGenerationService',
  'courseProgressService','calendarIntegrationService','cloudTtsService',
  'podcastLiveService','podcastModerationService','transcriptionService',
  'offlineStorage','socialCache','authSessionTracker','requestCache',
  'tokenCounter','validation','markdownUtils','serviceHelpers',
  'adminActivityLogger','verifyAccess','codeHighlighting','syntaxHighlighting',
  'detectCodeBlock','avatarCache','audioMixer','messageUtils','calculateTypyingSpeed',
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

function classifyFile(absPath) {
  const base = path.basename(absPath, path.extname(absPath));
  const ext  = path.extname(absPath);
  const src  = fs.readFileSync(absPath, 'utf8');
  if (/^use[A-Z]/.test(base)) return 'hook';
  if (ext === '.tsx') return 'component';
  if (ext === '.ts') {
    const nc = src.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
    if (!/\bfunction\b/.test(nc) && !/\bconst\s+\w+\s*=\s*(async\s*)?\(/.test(nc) &&
        /export\s+(type|interface|enum)/.test(nc)) return 'type';
    if (/\basync\s+function\b/.test(src) ||
        /supabase\.(from|auth|storage|rpc|functions)/.test(src) ||
        /\bfetch\s*\(/.test(src)) return 'service';
    if (/^export\s+const\s+[A-Z_]+\s*=/m.test(src) &&
        !/\basync\b/.test(src) && !/\bfunction\b/.test(src)) return 'config';
    if (/export\s+(const|function)/.test(src)) return 'util';
  }
  return 'unknown';
}

function buildImportGraph(allFiles) {
  const fileSet    = new Set(allFiles.map(f => path.normalize(f)));
  const importedBy = {};
  for (const f of allFiles) importedBy[f] = new Set();

  const SR = /(?:import|export)[\s\S]*?\bfrom\s*['"]([^'"]+?)['"]/g;
  const DR = /\bimport\s*\(\s*['"]([^'"]+?)['"]\s*\)/g;

  for (const file of allFiles) {
    const src = fs.readFileSync(file, 'utf8');
    const imps = [];
    let m;
    SR.lastIndex=0; while((m=SR.exec(src))!==null) imps.push(m[1]);
    DR.lastIndex=0; while((m=DR.exec(src))!==null) imps.push(m[1]);
    for (const imp of imps) {
      if (!imp.startsWith('.') && !imp.startsWith('@/')) continue;
      let base = imp.startsWith('@/') ? path.join(SRC_DIR, imp.slice(2))
                                      : path.join(path.dirname(file), imp);
      const cands = [base, ...SOURCE_EXTS.map(e=>base+e),
                     ...SOURCE_EXTS.map(e=>path.join(base,'index'+e))];
      const resolved = cands.find(c => fileSet.has(path.normalize(c)));
      if (resolved && importedBy[resolved]) importedBy[resolved].add(file);
    }
  }
  return importedBy;
}

function detectModule(absPath, importedBy) {
  const base      = path.basename(absPath, path.extname(absPath));
  const baseLower = base.toLowerCase().replace(/[^a-z]/g,'');
  if (KEEP_GLOBAL.has(base)) return null;

  let nameMatch = null;
  for (const [kw, mod] of Object.entries(MODULE_KEYWORDS)) {
    if (baseLower.includes(kw.toLowerCase())) {
      nameMatch = { module: mod, reason: `name contains "${kw}"`, confidence: 'high' };
      break;
    }
  }

  const importers = [...(importedBy[absPath] ?? [])];
  let importerMatch = null;
  if (importers.length > 0) {
    const moduleOf = p => {
      const r = path.relative(MODULES_DIR, p).replace(/\\/g,'/');
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

  if (!nameMatch && !importerMatch) return null;

  if (nameMatch && importerMatch) {
    if (nameMatch.module === importerMatch.module)
      return { ...nameMatch, confidence: 'confirmed', importerCount: importers.length };
    return { ...nameMatch, confidence: 'medium',
             note: `importers suggest "${importerMatch.module}" but name points to "${nameMatch.module}"` };
  }
  return nameMatch ?? importerMatch;
}

// ── Phase 1: Plan all moves ───────────────────────────────────────────────────

console.log('');
console.log(REPORT_ONLY ? '📊  Report mode — no changes.'
  : DRY_RUN ? '🔍  Dry-run — nothing written or moved.'
  : '🔧  Moving feature files to their module homes…');
console.log('');

const GLOBAL_DIRS = [
  path.join(SRC_DIR,'hooks'),
  path.join(SRC_DIR,'services'),
  path.join(SRC_DIR,'utils'),
];

// Snapshot ALL files ONCE before anything is touched
const allFiles      = walkDir(SRC_DIR);
const candidateFiles = GLOBAL_DIRS.flatMap(d => walkDir(d));
const importedByMap  = buildImportGraph(allFiles);

const toMove    = [];
const uncertain = [];
const keepList  = [];

for (const f of candidateFiles) {
  const base = path.basename(f, path.extname(f));
  if (base === 'index') continue;

  const fileType = classifyFile(f);
  const info     = detectModule(f, importedByMap);

  if (!info) { keepList.push({ file:f, base }); continue; }
  if (info.confidence === 'medium' && info.note) { uncertain.push({ file:f, base, info }); continue; }

  const targetFolder = TYPE_FOLDER[fileType] ?? 'utils';
  const toAbs = path.join(MODULES_DIR, info.module, targetFolder, path.basename(f));

  if (fs.existsSync(toAbs)) { keepList.push({ file:f, base, reason:'already at destination' }); continue; }

  toMove.push({ absPath:f, base, fileType, targetModule:info.module,
                targetFolder, fromRel:rel(f), toRel:rel(toAbs), toAbs, info });
}

// ── Print plan ────────────────────────────────────────────────────────────────

const byModule = {};
for (const m of toMove) (byModule[m.targetModule] = byModule[m.targetModule]??[]).push(m);

console.log(`┌─ Files to move: ${toMove.length}\n│`);
for (const [mod, list] of Object.entries(byModule).sort()) {
  console.log(`│  📦 ${mod}/`);
  for (const m of list) {
    const conf = m.info.confidence==='confirmed'?'✓✓':'✓ ';
    console.log(`│    ${conf} ${m.base}  [${m.fileType}]`);
    console.log(`│       ${m.fromRel}`);
    console.log(`│    →  ${m.toRel}`);
    console.log(`│       ${m.info.reason}`);
    if (m.info.importerCount) console.log(`│       importers: ${m.info.importerCount}`);
    console.log('│');
  }
}

if (uncertain.length) {
  console.log(`\n⚠  Uncertain (skipped — review manually): ${uncertain.length}`);
  for (const u of uncertain) {
    console.log(`   ${u.base}  —  ${u.info.note}`);
    console.log(`   ${rel(u.file)}`);
  }
}
console.log(`\n  Staying global: ${keepList.length} files`);

if (REPORT_ONLY || toMove.length === 0) {
  if (toMove.length === 0) console.log('\nNothing to move.\n');
  process.exit(0);
}

// ── Phase 2: Rewrite ALL imports (all files still at old paths) ───────────────

console.log('\n── Phase 2: rewriting imports across whole codebase…\n');

const STATIC_RE  = /((?:import|export)[\s\S]*?\bfrom\s*['"])([^'"]+?)(['"])/g;
const DYNAMIC_RE = /(\bimport\s*\(\s*['"])([^'"]+?)(['"]\s*\))/g;

// Build a lookup: normalised old abs path → new abs path
const moveMap = new Map();
for (const m of toMove) moveMap.set(path.normalize(m.absPath), m.toAbs);

let totalPatched = 0;

// Process every file in the snapshot (all still exist on disk at this point)
for (const sourceFile of allFiles) {
  // Safety: skip if file was somehow already removed
  if (!fs.existsSync(sourceFile)) continue;

  const original = fs.readFileSync(sourceFile, 'utf8');
  let changed = false;

  function replacer(match, prefix, importStr, suffix) {
    if (!importStr.startsWith('.') && !importStr.startsWith('@/')) return match;

    let base = importStr.startsWith('@/')
      ? path.join(SRC_DIR, importStr.slice(2))
      : path.join(path.dirname(sourceFile), importStr);

    const candidates = [base, ...SOURCE_EXTS.map(e=>base+e),
                        ...SOURCE_EXTS.map(e=>path.join(base,'index'+e))];

    const hit = candidates.find(c => moveMap.has(path.normalize(c)));
    if (!hit) return match;

    const newAbs = moveMap.get(path.normalize(hit));
    let newImp;
    if (importStr.startsWith('@/')) {
      newImp = '@/' + stripExt(path.relative(SRC_DIR, newAbs).replace(/\\/g,'/'));
    } else {
      let r = path.relative(path.dirname(sourceFile), newAbs).replace(/\\/g,'/');
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
    if (!VERBOSE) console.log(`   ${DRY_RUN?'[dry] ':''}patched: ${rel(sourceFile)}`);
  }
}

console.log(`\n   ${DRY_RUN?'Would patch':'Patched'} ${totalPatched} file(s).`);

// ── Phase 3: Move all files physically ───────────────────────────────────────

console.log('\n── Phase 3: moving files…\n');

for (const m of toMove) {
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(m.toAbs), { recursive: true });
    fs.renameSync(m.absPath, m.toAbs);
    console.log(`   ✓  ${m.base}  →  ${m.targetModule}/${m.targetFolder}/`);
  } else {
    console.log(`   [dry] ${m.base}  →  ${m.targetModule}/${m.targetFolder}/`);
  }
}

// Clean up empty source folders
const sourceDirs = new Set(toMove.map(m => path.dirname(m.absPath)));
if (!DRY_RUN) {
  for (const d of sourceDirs) {
    if (fs.existsSync(d)) {
      const remaining = fs.readdirSync(d).filter(e => SOURCE_EXTS.some(x=>e.endsWith(x)));
      if (remaining.length === 0) {
        try { fs.rmdirSync(d); console.log(`   🗑  removed empty: ${rel(d)}`); } catch(e){}
      }
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(64));
console.log(DRY_RUN
  ? `\n  Dry-run: would move ${toMove.length} file(s), patch ${totalPatched} import(s).\n`
  : `\n  Done. Moved ${toMove.length} file(s), patched ${totalPatched} import(s).\n`);
if (uncertain.length) console.log(`  ⚠  ${uncertain.length} file(s) need manual review (listed above).`);
console.log('═'.repeat(64));
if (!DRY_RUN) {
  console.log('\nNext steps:');
  console.log('  1.  npx tsc --noEmit        ← confirm zero type errors');
  console.log('  2.  node dependency-map.cjs  ← regenerate the dependency map');
  console.log('');
}
