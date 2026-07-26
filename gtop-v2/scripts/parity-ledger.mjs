import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ledger = JSON.parse(readFileSync(resolve(root, 'parity-ledger.json'), 'utf8'));
const statuses = new Set(['missing', 'implemented', 'verified', 'excluded']);
const required = ['id', 'role', 'v1Route', 'v1Control', 'dataOperation', 'v2Route', 'implementation', 'status', 'evidence', 'actionPlanKey'];
const ids = new Set();
for (const row of ledger) {
  for (const key of required) if (!(key in row)) throw new Error(`${row.id || 'unknown'} is missing ${key}`);
  if (ids.has(row.id)) throw new Error(`Duplicate parity id ${row.id}`);
  ids.add(row.id);
  if (!statuses.has(row.status)) throw new Error(`Invalid status ${row.status} for ${row.id}`);
  if (row.status === 'verified' && !row.evidence.length) throw new Error(`Verified row ${row.id} has no evidence`);
  for (const evidence of row.evidence) if (!existsSync(resolve(root, evidence))) throw new Error(`${row.id} references missing evidence ${evidence}`);
  if (row.status === 'excluded' && !row.exclusionReason) throw new Error(`Excluded row ${row.id} needs exclusionReason`);
}

const header = '# GTOP v2 Functional Parity Matrix\n\nGenerated from `gtop-v2/parity-ledger.json`. `verified` requires runnable evidence; `implemented` is not a release sign-off.\n\n';
const table = ['| Area | Role | v1 capability | v2 route | Status | Evidence | Action Plan |', '|---|---|---|---|---|---|---|', ...ledger.map((row) => `| ${row.id} | ${row.role} | ${row.v1Control} | ${row.v2Route} | ${row.status} | ${row.evidence.join('<br>') || '—'} | ${row.actionPlanKey} |`)].join('\n');
const output = `${header}${table}\n`;
const target = resolve(root, '..', 'docs', 'GTOP_V2_PARITY_MATRIX.md');
if (process.argv.includes('--write')) writeFileSync(target, output);
else if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error('Parity matrix is stale. Run npm run parity:generate.');
console.log(`Validated ${ledger.length} parity rows.`);
