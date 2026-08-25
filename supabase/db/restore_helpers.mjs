// Restore the helper section (ARRAY_COLUMNS, TABLE_ALIASES, validateAndRepairActionParams
// and internal helpers) that db_schema regeneration wiped from src/db_schema.ts.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const target = path.join(repoRoot, 'src/db_schema.ts');
const backup = path.join(repoRoot, 'src/db_schema.ts.bak');

const current = fs.readFileSync(target, 'utf8');
const bak = fs.readFileSync(backup, 'utf8');

// Find the start of the helper comment block in the backup
const marker = '// These are used by actions-service.ts to validate AI-generated queries BEFORE';
const idx = bak.indexOf(marker);
if (idx < 0) {
  console.error('MARKER NOT FOUND in backup');
  process.exit(1);
}

// Everything from the marker to end of backup = helper section
const helpers = bak.slice(idx).replace(/\s+$/, '');

// Append after the regenerated file (which ends with the closing `;` of the template)
const updated = current.replace(/\s+$/, '') + '\n\n' + helpers + '\n';
fs.writeFileSync(target, updated, 'utf8');

// Verify
const check = fs.readFileSync(target, 'utf8');
console.log('ARRAY_COLUMNS:', (check.match(/export const ARRAY_COLUMNS/g) || []).length);
console.log('TABLE_ALIASES:', (check.match(/export const TABLE_ALIASES/g) || []).length);
console.log('validateAndRepairActionParams:', (check.match(/export function validateAndRepairActionParams/g) || []).length);
console.log('RESTORED_DONE');
