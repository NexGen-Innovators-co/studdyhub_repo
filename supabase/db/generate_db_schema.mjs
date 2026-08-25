// Regenerate db_schema.ts (both copies) from the REAL remote schema pulled into supabase/db/.
// Usage: node generate_db_schema.mjs
// Outputs: functions/gemini-chat/db_schema.ts and src/db_schema.ts (backups written alongside).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // .../supabase/db
const supabase = path.resolve(__dirname, '..');
const repoRoot = path.resolve(supabase, '..');

function readJson(file) {
  const raw = fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

const colTypes = readJson('real_coltypes.json');   // table_name, column_name, data_type (precise), attnum
const pks = readJson('real_pks.json');             // table_name, column_name
const fks = readJson('real_fks.json');             // table_name, column_name, foreign_table, foreign_column

// ── Type normalization to match existing schema conventions ──
function normType(t) {
  if (!t) return 'text';
  if (t === 'timestamp with time zone' || t === 'timestamp without time zone') return 'timestamp';
  if (t === 'time without time zone' || t === 'time with time zone') return 'time';
  if (t.startsWith('character varying')) return 'text';
  if (t === 'double precision') return 'double precision';
  return t; // uuid, text, jsonb, boolean, integer, smallint, bigint, numeric, real, inet, date, enums, arrays...
}

// ── Build per-table structure ──
const tables = {}; // table -> [{name, type}]
for (const r of colTypes) {
  if (!tables[r.table_name]) tables[r.table_name] = [];
  tables[r.table_name].push({ name: r.column_name, type: normType(r.data_type) });
}

const pkSet = new Set(pks.map((r) => `${r.table_name}.${r.column_name}`));
// FK: column -> foreign table (single target; composite FK rare here)
const fkMap = {}; // "table.col" -> "foreign_table"  (foreign_table may be "users" for auth.users)
for (const r of fks) {
  const key = `${r.table_name}.${r.column_name}`;
  const target = r.foreign_table === 'users' ? 'auth.users' : r.foreign_table;
  if (!fkMap[key]) fkMap[key] = target;
}

// ── Render one table block ──
function renderTable(name, cols, idx) {
  const lines = [`${idx}. ${name}`];
  for (const c of cols) {
    let ann = '';
    const key = `${name}.${c.name}`;
    if (pkSet.has(key)) ann += ' (pk)';
    // The FK catalog only captures public-schema references, so auth.users FKs never
    // appear — annotate those owner columns explicitly (they are the authenticated user).
    if (fkMap[key]) {
      ann += ` (fk -> ${fkMap[key]})`;
    } else if (c.name === 'user_id' && !pkSet.has(key)) {
      ann += ' (fk -> auth.users)';
    }
    lines.push(`   - ${c.name}: ${c.type}${ann}`);
  }
  return lines.join('\n');
}

// Order: keep current schema's table order for stability, then append new tables alphabetically.
function currentTableOrder(file) {
  const text = fs.readFileSync(file, 'utf8');
  const order = [];
  for (const m of text.matchAll(/^\s*(\d+)\.\s+([a-z0-9_]+)\s*$/gm)) {
    if (!order.includes(m[2])) order.push(m[2]);
  }
  return order;
}

const header = `export const DB_SCHEMA_DEFINITION = \`
DATABASE SCHEMA DEFINITION

Allowed Tables & Operations:
You may perform INSERT, UPDATE, DELETE, and SELECT operations on the following tables.

`;

const footer = `
GUIDELINES:
- Always use the correct UUIDs when linking tables.
- For 'user_id', the system will automatically inject the authenticated user's ID, but you can include it if you have it.
- JSON fields like 'questions' in 'quizzes' should be strictly formatted.
- Respect table relationships (foreign keys).
\`;
`;

function build(outputFile) {
  const order = currentTableOrder(outputFile);
  const known = new Set(order);
  for (const name of Object.keys(tables).sort()) {
    if (!known.has(name)) order.push(name);
  }
  // Only tables that actually exist in the real DB
  const finalOrder = order.filter((n) => tables[n]);
  const blocks = finalOrder.map((name, i) => renderTable(name, tables[name], i + 1));
  return header + blocks.join('\n\n') + footer;
}

const targets = [
  path.join(supabase, 'functions/gemini-chat/db_schema.ts'),
  path.join(repoRoot, 'src/db_schema.ts'),
];

for (const target of targets) {
  const out = build(target);
  fs.writeFileSync(target + '.bak', fs.readFileSync(target, 'utf8'));
  fs.writeFileSync(target, out, 'utf8');
  const tableCount = [...out.matchAll(/^\s*\d+\.\s+([a-z0-9_]+)\s*$/gm)].length;
  const colCount = [...out.matchAll(/^\s*-\s+/gm)].length;
  console.log(`WROTE ${target} (${tableCount} tables, ${colCount} column lines)`);
}
console.log('DONE');
