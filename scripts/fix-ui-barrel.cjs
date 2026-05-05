#!/usr/bin/env node
/**
 * fix-ui-barrel.cjs
 * Fixes TS2308: duplicate 'Toaster' export in src/modules/ui/components/index.ts
 * Both sonner.tsx and toaster.tsx export a member named Toaster.
 * Solution: use named re-exports to alias the sonner one.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const DRY_RUN    = process.argv.includes('--dry-run');
const BARREL     = path.join(__dirname, 'src/modules/ui/components/index.ts');

if (!fs.existsSync(BARREL)) {
  console.error('ERROR: Cannot find', BARREL);
  process.exit(1);
}

let src = fs.readFileSync(BARREL, 'utf8');

// Replace the blanket sonner re-export with an explicit named export
// that aliases Toaster → Sonner so it doesn't clash with toaster.tsx
const OLD_SONNER = `export * from './sonner'`;
const NEW_SONNER = `export { Toaster as SonnerToaster } from './sonner'`;

if (!src.includes(OLD_SONNER)) {
  console.log('sonner export line not found in expected form — printing current file:');
  console.log(src);
  process.exit(1);
}

const updated = src.replace(OLD_SONNER, NEW_SONNER);

console.log('');
console.log('Fix: TS2308 duplicate Toaster export');
console.log(`  ${OLD_SONNER}`);
console.log(`→ ${NEW_SONNER}`);
console.log('');
console.log('NOTE: Any file importing Toaster from sonner must now import SonnerToaster.');
console.log('      The shadcn Toaster (toaster.tsx) remains exported as Toaster.');
console.log('');

if (!DRY_RUN) {
  fs.writeFileSync(BARREL, updated, 'utf8');
  console.log('✓ Written:', BARREL);
} else {
  console.log('[dry-run] would write:', BARREL);
}
