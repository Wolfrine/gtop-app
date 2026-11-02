import test from 'node:test';
import assert from 'node:assert/strict';
import {AssistantService} from '../service.mjs';
import {MemoryStore} from '../store.mjs';
import {dispatchRule,withoutDispatchRule} from '../dispatch-rule.mjs';
import {assistantOnlyRelease} from '../scripts/release-scope.mjs';
import {readFileSync} from 'node:fs';

test('enqueue marker is atomic, minimal and idempotent; health and lease changes never notify',async()=>{
  const store=new MemoryStore({'assistantWorkers/w':{enabled:true,allowedOwnerUids:['owner']}}),service=new AssistantService(store);
  const c=(await service.createConversation('owner',{})).conversation;
  const sent=await service.submit('owner',c.id,{text:'Hi',clientMessageId:'one'});
  const marker=await store.get('assistantDispatch/owner');assert.deepEqual(Object.keys(marker).sort(),['revision','schemaVersion','updatedAt']);
  assert.equal(marker.schemaVersion,1);
  await service.submit('owner',c.id,{text:'Hi',clientMessageId:'one'});assert.deepEqual(await store.get('assistantDispatch/owner'),marker);
  await service.heartbeat({id:'w'},{state:'ready',modelReady:false,version:'test'});assert.deepEqual(await store.get('assistantDispatch/owner'),marker);
  await service.cancel('owner',sent.job.id);assert.deepEqual(await store.get('assistantDispatch/owner'),marker);
  await assert.rejects(service.submit('stranger',c.id,{text:'forbidden',clientMessageId:'x'}));assert.equal(await store.get('assistantDispatch/stranger'),null);
});

test('unchanged conversation revision avoids all history queries and enforces ownership',async()=>{
  const store=new MemoryStore(),service=new AssistantService(store),c=(await service.createConversation('owner',{})).conversation;
  store.list=()=>{throw Error('No collection query for revision');};
  assert.deepEqual(await service.conversationRevision('owner',c.id),{updatedAt:c.updatedAt});
  await assert.rejects(service.conversationRevision('other',c.id),/unavailable/);
});

test('shared release guard accepts exactly the dispatch grant and rejects widened access',()=>{
  const source=readFileSync(new URL('../../gtop-app/firestore.rules',import.meta.url),'utf8'),old=withoutDispatchRule(source);
  assert.notEqual(old,source);assert(source.includes(dispatchRule));
  assert(assistantOnlyRelease(['gtop-app/firestore.rules'],()=>old,()=>source));
  assert(!assistantOnlyRelease(['gtop-app/firestore.rules'],()=>old,()=>source.replace('allow list, write: if false','allow list, write: if true')));
});
