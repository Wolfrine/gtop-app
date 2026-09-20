import { expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

it('preserves the original dist/index.js stdio entry point',async()=>{
  const client=new Client({name:'stdio-compatibility-test',version:'1'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/index.js',import.meta.url))],stderr:'pipe'});
  try {
    await client.connect(transport);
    const {tools}=await client.listTools();
    expect(tools).toHaveLength(15);
    expect(tools.map(tool=>tool.name)).toContain('firestore_update_document');
  } finally {await client.close();}
});
