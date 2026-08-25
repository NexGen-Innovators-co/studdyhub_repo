// Validate db_schema.ts (both copies) against the real remote schema pulled into db/real_tables.json
// Usage: node validate_schema.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // .../supabase/db
const root = path.resolve(__dirname, '..'); // .../supabase

// ── Load real schema ──
const realCols = JSON.parse(fs.readFileSync(path.join(__dirname, 'real_tables.json'), 'utf8').replace(/^\uFEFF/, ''));
const realTables = {};
for (const row of realCols) {
  if (!realTables[row.table_name]) realTables[row.table_name] = [];
  realTables[row.table_name].push(row.column_name);
}

// ── Parse db_schema.ts: entries like "N. table_name" then "   - col: type" ──
function parseSchemaFile(p) {
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split(/\r?\n/);
  const tables = {}; // name -> {cols:Set, line:number}
  const order = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*(\d+)\.\s+([a-z0-9_]+)\s*$/);
    if (m) {
      const name = m[2];
      current = { name, cols: new Set(), line: i + 1, num: parseInt(m[1], 10) };
      if (!tables[name]) {
        tables[name] = current;
        order.push(name);
      } else {
        // duplicate
        current.dupOf = true;
        tables['__dup__' + name + '_' + i] = current;
      }
      continue;
    }
    const cm = line.match(/^\s*-\s+([a-z0-9_]+)\s*:/);
    if (cm && current && !current.dupOf) {
      current.cols.add(cm[1]);
    }
  }
  return { tables, order };
}

const schemaFile = path.join(root, 'functions/gemini-chat/db_schema.ts');
const srcSchemaFile = path.join(root, '../src/db_schema.ts');

function report(fileLabel, p) {
  const { tables, order } = parseSchemaFile(p);
  console.log(`\n========== ${fileLabel} ==========`);

  // Duplicates
  const dupes = Object.keys(tables).filter((k) => k.startsWith('__dup__'));
  if (dupes.length) console.log(`\n⚠️ DUPLICATE ENTRIES (${dupes.length}):`, dupes.map((d) => d.replace('__dup__', '')).join(', '));

  // Read-only aggregate views, intentionally excluded from the writable planner schema
  const KNOWN_VIEWS = new Set(['chat_session_memory_stats', 'chat_session_summaries', 'flashcard_stats', 'system_error_summary']);

  // Missing from schema (in real DB, not in schema)
  const missing = Object.keys(realTables).filter((t) => !tables[t] && !Object.keys(tables).some((k) => k === t) && !KNOWN_VIEWS.has(t));
  console.log(`\n➡️ TABLES IN REAL DB BUT MISSING FROM SCHEMA (${missing.length}):`);
  console.log(missing.sort().join(', '));

  // Extra in schema (not in real DB)
  const extras = order.filter((t) => !realTables[t]);
  console.log(`\n➡️ TABLES IN SCHEMA BUT NOT IN REAL DB (${extras.length}):`);
  console.log(extras.sort().join(', '));

  // Column diffs for shared tables
  console.log(`\n➡️ COLUMN DIFFS (schema col → real col) for shared tables:`);
  let colDiffCount = 0;
  for (const t of Object.keys(realTables).sort()) {
    if (!tables[t]) continue;
    const realColsSet = new Set(realTables[t]);
    const schemaCols = tables[t].cols;
    const missingCols = [...realColsSet].filter((c) => !schemaCols.has(c));
    const extraCols = [...schemaCols].filter((c) => !realColsSet.has(c));
    if (missingCols.length || extraCols.length) {
      colDiffCount++;
      console.log(`  ${t}:`);
      if (missingCols.length) console.log(`    missing: ${missingCols.join(', ')}`);
      if (extraCols.length) console.log(`    extra/schema-only: ${extraCols.join(', ')}`);
    }
  }
  if (!colDiffCount) console.log('  (none)');
}

report('gemini-chat/db_schema.ts', schemaFile);
report('src/db_schema.ts', srcSchemaFile);
