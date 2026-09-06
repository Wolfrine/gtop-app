import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { connectServer, executeRequest, validateRequest } from './client.mjs';

const request = (overrides = {}) => ({ schemaVersion: 1, requestId: 'test-request', purpose: 'Test a user-directed MCP operation.', expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'read', kind: 'call', calls: [{ name: 'read', arguments: {} }], ...overrides });

test('rejects stale requests and oversized validity windows before connecting', () => {
  assert.throws(() => validateRequest(request({ expiresAt: new Date(Date.now() - 1000).toISOString() })), /expire/);
  assert.throws(() => validateRequest(request({ expiresAt: new Date(Date.now() + 25 * 3600000).toISOString() })), /expire/);
  assert.throws(() => validateRequest(request({ kind: 'verify' })), /write/);
  assert.equal(validateRequest(request()).mode, 'read');
});

test('preflights every tool so a forbidden call prevents the complete batch', async () => {
  let invoked = 0;
  const client = {
    listTools: async () => ({ tools: [{ name: 'read', annotations: { readOnlyHint: true } }, { name: 'write', annotations: { readOnlyHint: false } }] }),
    callTool: async () => { invoked++; return {}; },
  };
  await assert.rejects(executeRequest(client, request({ calls: [{ name: 'read', arguments: {} }, { name: 'write', arguments: {} }] })), /Write mode/);
  assert.equal(invoked, 0);
  await assert.rejects(executeRequest(client, request({ mode: 'write', calls: [{ name: 'missing', arguments: {} }] })), /Unadvertised/);
  assert.equal(invoked, 0);
});

test('treats MCP isError results as failure and stops later calls', async () => {
  let invoked = 0;
  const client = {
    listTools: async () => ({ tools: [{ name: 'read', annotations: { readOnlyHint: true } }] }),
    callTool: async () => { invoked++; return { isError: true, content: [{ type: 'text', text: 'Denied' }] }; },
  };
  await assert.rejects(executeRequest(client, request({ calls: [{ name: 'read', arguments: {} }, { name: 'read', arguments: {} }] })), (error) => error.results.length === 1);
  assert.equal(invoked, 1);
});

test('uses real MCP stdio for create, update, read, delete and absence verification', async () => {
  const client = await connectServer(fileURLToPath(new URL('./fixtures/server.mjs', import.meta.url)));
  try {
    const result = await executeRequest(client, request({ kind: 'verify', mode: 'write' }));
    assert.equal(result.status, 'success');
    assert.deepEqual(result.results.map((item) => item.name), ['firestore_create_document', 'firestore_update_document', 'firestore_get_document', 'firestore_delete_document', 'firestore_get_document']);
    assert.equal(JSON.parse(result.results.at(-1).result.content[0].text), null);
    const fixture = JSON.parse(result.results[0].result.content[0].text);
    assert.match(fixture.path, /^mcpConnectionChecks\/[a-f0-9-]+$/);
  } finally { await client.close(); }
});

test('retains completed results and marks a timed-out call as unknown', async () => {
  let invoked = 0;
  const client = {
    listTools: async () => ({ tools: [{ name: 'write', annotations: { readOnlyHint: false } }] }),
    callTool: async () => {
      if (++invoked === 2) throw new Error('Transport timeout');
      return { content: [{ type: 'text', text: 'committed' }] };
    },
  };
  await assert.rejects(executeRequest(client, request({ mode: 'write', calls: [{ name: 'write', arguments: {} }, { name: 'write', arguments: {} }] })), (error) => {
    assert.deepEqual(error.results.map((entry) => entry.outcome), ['completed', 'unknown']);
    assert.equal(error.results[0].result.content[0].text, 'committed');
    return true;
  });
});

test('cleans up its fixture when an update fails after creation', async () => {
  const actual = await connectServer(fileURLToPath(new URL('./fixtures/server.mjs', import.meta.url)));
  let fixturePath;
  const client = {
    listTools: (...args) => actual.listTools(...args),
    callTool: async (...args) => {
      if (args[0].name === 'firestore_create_document') fixturePath = args[0].arguments.path;
      if (args[0].name === 'firestore_update_document') return { isError: true, content: [{ type: 'text', text: 'Injected update failure' }] };
      return actual.callTool(...args);
    },
  };
  try {
    await assert.rejects(executeRequest(client, request({ kind: 'verify', mode: 'write' })), (error) => error.cleanupNeeded === false);
    const after = await actual.callTool({ name: 'firestore_get_document', arguments: { path: fixturePath } });
    assert.equal(JSON.parse(after.content[0].text), null);
  } finally { await actual.close(); }
});
