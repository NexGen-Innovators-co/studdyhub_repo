/**
 * Script to add logSystemError to all edge functions that don't have it yet.
 * 
 * Run: node scripts/add-error-logger.js
 */
const fs = require('fs');
const path = require('path');

const FUNCTIONS_DIR = path.join(__dirname, '..', 'supabase', 'functions');
const SKIP_DIRS = new Set(['_shared', 'test', 'node_modules', '.vscode', 'utils']);

const dirs = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !SKIP_DIRS.has(d.name))
  .map(d => d.name)
  .sort();

let modified = 0;
let skipped = 0;
const errors = [];
const processed = [];

for (const funcName of dirs) {
  // Try index.ts then index.tsx
  let indexPath = path.join(FUNCTIONS_DIR, funcName, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    indexPath = path.join(FUNCTIONS_DIR, funcName, 'index.tsx');
    if (!fs.existsSync(indexPath)) continue;
  }

  let content = fs.readFileSync(indexPath, 'utf-8');

  // Skip if already has logSystemError
  if (content.includes('logSystemError')) {
    skipped++;
    continue;
  }

  const lines = content.split('\n');

  // ── Step 1: Find last import line ──
  let lastImportLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
      // Multi-line import: find the line with the closing semicolon
      let j = i;
      while (j < lines.length && !lines[j].includes(';') && !lines[j].includes("'") && j - i < 10) {
        j++;
      }
      lastImportLineIdx = j;
    }
  }

  // ── Step 2: Find outermost catch block ──
  // Search from end backwards for the last `} catch (varName` pattern
  let catchLineIdx = -1;
  let catchVar = 'error';
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/}\s*catch\s*\((\w+)/);
    if (match) {
      catchLineIdx = i;
      catchVar = match[1];
      break;
    }
  }

  if (catchLineIdx === -1) {
    errors.push(`${funcName}: no catch block found — SKIPPED`);
    continue;
  }

  // ── Step 3: Check indentation of catch block ──
  const catchIndent = lines[catchLineIdx].match(/^(\s*)/)?.[1] || '  ';
  const innerIndent = catchIndent + '  ';
  const innerInnerIndent = innerIndent + '  ';

  // ── Step 4: Build imports to add ──
  const hasCreateClient = content.includes('createClient');
  const importsToAdd = [];
  
  if (!hasCreateClient) {
    importsToAdd.push(`import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';`);
  }
  importsToAdd.push(`import { logSystemError } from '../_shared/errorLogger.ts';`);

  // Insert imports after last import line
  if (lastImportLineIdx >= 0) {
    lines.splice(lastImportLineIdx + 1, 0, ...importsToAdd);
    catchLineIdx += importsToAdd.length; // adjust
  } else {
    lines.splice(0, 0, ...importsToAdd);
    catchLineIdx += importsToAdd.length;
  }

  // ── Step 5: Build logging block ──
  const logBlock = [
    `${innerIndent}// ── Log to system_error_logs ──`,
    `${innerIndent}try {`,
    `${innerInnerIndent}const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);`,
    `${innerInnerIndent}await logSystemError(_logClient, {`,
    `${innerInnerIndent}  severity: 'error',`,
    `${innerInnerIndent}  source: '${funcName}',`,
    `${innerInnerIndent}  message: ${catchVar}?.message || String(${catchVar}),`,
    `${innerInnerIndent}  details: { stack: ${catchVar}?.stack },`,
    `${innerInnerIndent}});`,
    `${innerIndent}} catch (_logErr) { console.error('[${funcName}] Error logging failed:', _logErr); }`,
  ];

  // Insert after the catch line
  lines.splice(catchLineIdx + 1, 0, ...logBlock);

  // ── Step 6: Write back ──
  fs.writeFileSync(indexPath, lines.join('\n'), 'utf-8');
  modified++;
  processed.push(funcName);
  console.log(`✅ ${funcName} (catchVar: ${catchVar}, createClient: ${hasCreateClient ? 'existing' : 'added'})`);
}

console.log(`\n════════════════════════════════════════`);
console.log(`Done: ${modified} modified, ${skipped} already had logger`);
if (errors.length) {
  console.log(`\nSkipped (${errors.length}):`);
  errors.forEach(e => console.log(`  ⚠️  ${e}`));
}
console.log(`\nProcessed functions:`);
processed.forEach(f => console.log(`  - ${f}`));
