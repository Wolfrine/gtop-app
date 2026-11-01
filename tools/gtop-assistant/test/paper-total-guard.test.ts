import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSourcedPaperTotal,hash} from '../src/policy.js';
import {Worker} from '../src/worker.js';
import type {Config} from '../src/adapters.js';

function packet(text='Create a CBSE Class 5 Mathematics paper. Only chapter Addition. Total 4 marks.'){
  const request={id:'original',text,sha256Utf8:hash(text)};
  return {request,rootRequest:request,history:[{...request,role:'user'}],context:{},requirements:{marks:80}} as any;
}
test('observed single-digit total/default expansion is refused before any model or artifact work',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('No inference is authorized for a conflicting packet');});
  await assert.rejects(()=>new Worker({} as Config).paper(packet(),'never-created',new AbortController().signal),/original paper total was not preserved/);
  assert.equal(calls,0);
});
test('a later sourced supported correction wins over the old unsupported total',()=>{
  const job=packet();job.request={id:'correction',text:'Use total 10 marks instead.'};job.history.push({...job.request,role:'user'});job.requirements.marks=10;
  assert.doesNotThrow(()=>assertSourcedPaperTotal(job));
  job.requirements.marks=80;assert.throws(()=>assertSourcedPaperTotal(job),/sourced paper total conflicts/);
});
test('ordinary supported totals and per-question marks are not mistaken for a total override',()=>{
  const supported=packet('Create a CBSE Class 5 Mathematics paper. Total 10 marks, two questions worth 5 marks each.');supported.requirements.marks=10;
  assert.doesNotThrow(()=>assertSourcedPaperTotal(supported));
  assert.doesNotThrow(()=>assertSourcedPaperTotal(packet('Create a CBSE Class 5 Mathematics paper with 2-mark questions.')));
});
