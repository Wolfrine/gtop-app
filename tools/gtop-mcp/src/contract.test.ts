import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const requiredTools = [
  'action_plan_list', 'action_plan_get', 'action_plan_create', 'action_plan_update', 'action_plan_add_update',
  'firestore_list_collections', 'firestore_get_document', 'firestore_query', 'firestore_create_document',
  'firestore_update_document', 'firestore_batch_write', 'firestore_transaction', 'firestore_delete_document',
];

describe('GTOP MCP contract', () => {
  it.each(requiredTools)('registers %s', (name) => {
    expect(source).toContain(`registerTool('${name}'`);
  });

  it('marks batch, transaction, and delete operations as destructive', () => {
    for (const name of ['firestore_batch_write', 'firestore_transaction', 'firestore_delete_document']) {
      const registration = source.slice(source.indexOf(`registerTool('${name}'`), source.indexOf(`registerTool('${name}'`) + 1200);
      expect(registration).toContain('annotations: destructive');
    }
  });
});
