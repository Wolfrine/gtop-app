import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AssistantService} from '../service.mjs';
import {MemoryStore} from '../store.mjs';
import {withWorkerHealth,workerFreshnessMs} from '../presence.mjs';
import {uiReadRules,withoutUiReadRules} from '../ui-read-rules.mjs';
import {assistantOnlyRelease} from '../scripts/release-scope.mjs';

function fixture(){
  let ms=Date.parse('2026-11-03T00:00:00Z'),n=0;
  const pairing={id:'sachit-windows',enabled:true,allowedOwnerUids:['owner'],state:'offline',modelReady:false,lastSeenAt:'2020-01-01T00:00:00Z',bootstrapSecretSha256:'synthetic-private-only'};
  const store=new MemoryStore({'users/owner':{role:'admin'},'assistantConfig/pilot':{allowedOwnerUids:['owner']},'assistantWorkers/sachit-windows':pairing,'assistantServiceControls/sachit-windows':{lastSeenAt:new Date(ms).toISOString()}});
  const service=new AssistantService(store,{now:()=>new Date(ms),id:()=>`fixture-${++n}`}),worker={...pairing,id:'sachit-windows'};
  return {store,service,worker,pairing,advance:n=>ms+=n};
}

test('heartbeats update only public telemetry, keep pairing/dispatch byte-identical and remain visible to both status APIs',async()=>{
  const f=fixture(),reads=[],get=f.store.get.bind(f.store);f.store.get=async p=>{reads.push(p);return get(p);};
  const heartbeat={state:'ready',modelReady:false,version:'fixture'};
  await f.service.heartbeat(f.worker,heartbeat);assert.deepEqual(reads,['assistantWorkers/sachit-windows']);
  assert.deepEqual(await f.store.get('assistantWorkers/sachit-windows'),f.pairing);
  const health=await f.store.get('assistantWorkerHealth/sachit-windows');
  assert.deepEqual(Object.keys(health).sort(),['lastSeenAt','modelReady','schemaVersion','state','version']);
  assert.equal(await f.store.get('assistantDispatch/owner'),null);assert.equal(await f.store.get('assistantUiNotifications/owner'),null);
  const session=await f.service.session({uid:'owner'});assert.equal(session.worker.state,'ready');assert.equal(session.service.state,'ready');
  assert.deepEqual(session.notifications,{schemaVersion:1,contentPath:'assistantUiNotifications/owner',presencePath:'assistantWorkerHealth/sachit-windows',freshnessMs:90000});
  assert(!JSON.stringify(session).includes('synthetic-private-only'));
  assert.equal((await f.service.serviceControl.get({uid:'owner'})).state,'ready');
  f.advance(40000);await f.service.heartbeat(f.worker,heartbeat);f.advance(49999);
  assert.equal((await f.service.serviceControl.get({uid:'owner'})).worker.state,'ready');
  f.advance(40001);assert.equal((await f.service.serviceControl.get({uid:'owner'})).worker.state,'offline');
  assert.equal(workerFreshnessMs,90000);
});

test('rolling health migration preserves legacy status, malformed telemetry fails closed and telemetry cannot change authorization',async()=>{
  const f=fixture();assert.equal((await f.service.serviceControl.get({uid:'owner'})).worker.state,'offline');
  const legacy={...f.pairing,state:'ready',lastSeenAt:'2026-11-03T00:00:00.000Z'};
  f.store.docs.set('assistantWorkers/sachit-windows',legacy);assert.equal((await f.service.serviceControl.get({uid:'owner'})).state,'ready');
  f.store.docs.set('assistantWorkerHealth/sachit-windows',{schemaVersion:9,state:'ready'});
  assert.equal((await f.service.serviceControl.get({uid:'owner'})).worker.state,'offline');
  const joined=withWorkerHealth({...legacy,enabled:false},{schemaVersion:1,state:'ready',modelReady:true,lastSeenAt:legacy.lastSeenAt,enabled:true,allowedOwnerUids:['intruder']});
  assert.equal(joined.enabled,false);assert.deepEqual(joined.allowedOwnerUids,['owner']);
  f.store.docs.set('assistantWorkers/sachit-windows',{...legacy,enabled:false});
  await assert.rejects(f.service.heartbeat(f.worker,{state:'ready',modelReady:false,version:'fixture'}),/disabled/);
});

test('owned job changes notify UI; unchanged progress and lease-only renewal never wake UI or worker dispatch',async()=>{
  const f=fixture(),cid=(await f.service.createConversation('owner',{})).conversation.id;
  const sent=await f.service.submit('owner',cid,{text:'Hello',clientMessageId:'greeting'}),dispatch=await f.store.get('assistantDispatch/owner');
  let marker=await f.store.get('assistantUiNotifications/owner');
  const claimed=(await f.service.claim(f.worker,{kind:'turn'})).job;
  assert.notDeepEqual(await f.store.get('assistantUiNotifications/owner'),marker);marker=await f.store.get('assistantUiNotifications/owner');
  await f.service.renew(f.worker,claimed.id,{leaseId:claimed.leaseId});
  await f.service.event(f.worker,claimed.id,{leaseId:claimed.leaseId,phase:claimed.phase,state:'running'});
  assert.deepEqual(await f.store.get('assistantUiNotifications/owner'),marker);assert.deepEqual(await f.store.get('assistantDispatch/owner'),dispatch);
  await f.service.event(f.worker,claimed.id,{leaseId:claimed.leaseId,phase:'checking',state:'validating'});
  assert.notDeepEqual(await f.store.get('assistantUiNotifications/owner'),marker);marker=await f.store.get('assistantUiNotifications/owner');
  await f.service.failed(f.worker,claimed.id,{leaseId:claimed.leaseId,error:'Synthetic failure'});
  assert.notDeepEqual(await f.store.get('assistantUiNotifications/owner'),marker);
  const retry=(await f.service.retry('owner',sent.job.id)).job;assert.notDeepEqual(await f.store.get('assistantDispatch/owner'),dispatch);
  const running=(await f.service.claim(f.worker,{kind:'turn'})).job;
  await f.service.complete(f.worker,running.id,{leaseId:running.leaseId,reply:'Hello'});
  assert.equal((await f.store.get('assistantJobs/'+retry.id)).state,'completed');
  const next=(await f.service.submit('owner',cid,{text:'Hi',clientMessageId:'cancel'})).job;
  marker=await f.store.get('assistantUiNotifications/owner');await f.service.cancel('owner',next.id);
  assert.notDeepEqual(await f.store.get('assistantUiNotifications/owner'),marker);marker=await f.store.get('assistantUiNotifications/owner');
  await f.service.cancel('owner',next.id);assert.deepEqual(await f.store.get('assistantUiNotifications/owner'),marker);
  await f.service.submit('owner',cid,{text:'Hi',clientMessageId:'expire'});const expiring=(await f.service.claim(f.worker,{kind:'turn'})).job;
  marker=await f.store.get('assistantUiNotifications/owner');f.advance(120001);await f.service.expireOne(expiring.id,'owner');
  assert.notDeepEqual(await f.store.get('assistantUiNotifications/owner'),marker);
});

test('release guards accept only exact new public metadata grants and reject payload/query widening',()=>{
  const source=readFileSync(new URL('../../gtop-app/firestore.rules',import.meta.url),'utf8').replaceAll('\r\n','\n'),before=withoutUiReadRules(source);
  assert(source.includes(uiReadRules));assert(!before.includes('match /assistantWorkerHealth/'));
  assert(assistantOnlyRelease(['gtop-app/firestore.rules'],()=>before,()=>source));
  assert(!assistantOnlyRelease(['gtop-app/firestore.rules'],()=>before,()=>source.replace('allow list, write: if false','allow list, write: if true')));
  assert.equal(withoutUiReadRules(source.replaceAll('\n','\r\n')),before);
});
