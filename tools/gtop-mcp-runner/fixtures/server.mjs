import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../gtop-mcp/package.json', import.meta.url));
const { McpServer } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/server/mcp.js')).href);
const { StdioServerTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/server/stdio.js')).href);
const { z } = await import(pathToFileURL(require.resolve('zod')).href);
const server = new McpServer({ name: 'in-memory-test-server', version: '1.0.0' });
const documents = new Map();
let version = 0;
const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
server.registerTool('firestore_get_document', { inputSchema: { path: z.string() }, annotations: { readOnlyHint: true } }, async ({ path }) => json(documents.get(path) ?? null));
server.registerTool('firestore_create_document', { inputSchema: { path: z.string(), data: z.record(z.string(), z.unknown()) }, annotations: { readOnlyHint: false } }, async ({ path, data }) => {
  if (documents.has(path)) throw new Error('Already exists.');
  const value = { ...data, path, updateToken: String(++version) };
  documents.set(path, value);
  return json(value);
});
server.registerTool('firestore_update_document', { inputSchema: { path: z.string(), expectedUpdateToken: z.string(), data: z.record(z.string(), z.unknown()) }, annotations: { readOnlyHint: false } }, async ({ path, expectedUpdateToken, data }) => {
  const previous = documents.get(path);
  if (!previous || previous.updateToken !== expectedUpdateToken) throw new Error('Conflict.');
  const value = { ...previous, ...data, updateToken: String(++version) };
  documents.set(path, value);
  return json(value);
});
server.registerTool('firestore_delete_document', { inputSchema: { path: z.string(), expectedUpdateToken: z.string(), confirmation: z.string() }, annotations: { readOnlyHint: false, destructiveHint: true } }, async ({ path, expectedUpdateToken, confirmation }) => {
  if (documents.get(path)?.updateToken !== expectedUpdateToken || confirmation !== `DELETE ${path}`) throw new Error('Invalid deletion.');
  documents.delete(path);
  return json({ deleted: true });
});
await server.connect(new StdioServerTransport());
