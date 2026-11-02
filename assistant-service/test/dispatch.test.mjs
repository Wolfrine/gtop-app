import test from 'node:test';
import assert from 'node:assert/strict';
import {AssistantService} from '../service.mjs';
import {MemoryStore} from '../store.mjs';
import {dispatchRule,withoutDispatchRule} from '../dispatch-rule.mjs';
import {assistantOnlyRelease} from '../scripts/release-scope.mjs';
import {readFileSync} from 'node:fs';
import {createGateway} from '../gateway.mjs';

test('maintenance reads pairing once inside the transaction and still refuses disabled or forged identities',async()=>{
  const store=new MemoryStore({'assistantWorkers/sachit-windows':{enabled:true,allowedOwnerUids:['owner']}}),service=new AssistantService(store);
  const reads=[],get=store.get.bind(store);store.get=async path=>{reads.push(path);return get(path);};
  const claims={uid:'assistant-worker-sachit-windows',assistantWorker:true,workerId:'sachit-windows'};
  const route=createGateway(service,async()=>claims),request=(path,body)=>route({method:'POST',path,body,headers:{authorization:'Bearer fixture'}});
  const heartbeat={state:'ready',modelReady:false,version:'fixture'};
  assert.equal((await request('/worker/heartbeat',heartbeat)).status,200);
  assert.deepEqual(reads,['assistantWorkers/sachit-windows']);reads.length=0;
  assert.equal((await request('/worker/service/poll',{workerRunning:true,version:'fixture'})).status,200);
  assert.deepEqual(reads.sort(),['assistantServiceControls/sachit-windows','assistantWorkers/sachit-windows']);
  store.docs.set('assistantWorkers/sachit-windows',{enabled:false,allowedOwnerUids:['owner']});
  assert.equal((await request('/worker/heartbeat',heartbeat)).status,403);
  assert.equal((await request('/worker/service/poll',{workerRunning:true,version:'fixture'})).status,403);
  claims.uid='forged';assert.equal((await request('/worker/heartbeat',heartbeat)).status,403);
});

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
  const source=readFileSync(new URL('../../gtop-app/firestore.rules',import.meta.url),'utf8').replaceAll('\r\n','\n'),old=withoutDispatchRule(source);
  assert.notEqual(old,source);assert(source.includes(dispatchRule));
  assert.equal(withoutDispatchRule(source.replaceAll('\n','\r\n')),old);
  assert(assistantOnlyRelease(['gtop-app/firestore.rules'],()=>old,()=>source));
  assert(!assistantOnlyRelease(['gtop-app/firestore.rules'],()=>old,()=>source.replace('allow list, write: if false','allow list, write: if true')));
});
