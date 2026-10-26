import test from 'node:test';
import assert from 'node:assert/strict';
import {AssistantService} from '../service.mjs';
import {MemoryStore} from '../store.mjs';
import {createGateway} from '../gateway.mjs';
import {serviceWorkerId,ptiProjectId,ptiOwnerUid} from '../service-control.mjs';

const workerClaims={uid:'assistant-worker-'+serviceWorkerId,assistantWorker:true,workerId:serviceWorkerId};
const ptiClaims={uid:ptiOwnerUid,aud:ptiProjectId,iss:`https://securetoken.google.com/${ptiProjectId}`};
const controlPath='assistantServiceControls/'+serviceWorkerId;
function fixture(){
  let clock=Date.parse('2026-10-26T09:00:00Z');
  const store=new MemoryStore({'users/admin':{role:'admin'},'users/unpaired':{role:'admin'},'users/learner':{role:'user'},'assistantConfig/pilot':{allowedOwnerUids:['admin','unpaired']},['assistantWorkers/'+serviceWorkerId]:{enabled:true,allowedOwnerUids:['admin'],bootstrapSecretSha256:'private-secret-hash'}});
  const service=new AssistantService(store,{now:()=>new Date(clock)});
  const route=createGateway(service,async token=>{if(token==='worker')return workerClaims;if(['invalid','pti-owner'].includes(token))throw Error('Invalid GTOP token');return {uid:token};},{verifyHostIdToken:async token=>{if(token==='pti-owner')return ptiClaims;if(token==='pti-other')return {...ptiClaims,uid:'different-owner'};if(token==='wrong-project')return {...ptiClaims,aud:'other-project'};throw Error('Invalid PTI token');}});
  const request=(method,path,body={},token='admin',origin)=>route({method,path,body,headers:{...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})}});
  const poll=(body={})=>request('POST','/worker/service/poll',{version:'synthetic-starter-test',workerRunning:false,...body},'worker');
  return {store,service,request,poll,advance:seconds=>clock+=seconds*1000};
}

test('fixed service controls deny anonymous, learner, unpaired admin, forged worker and cross-project identities',async()=>{
  const f=fixture();await f.poll();
  for(const token of [null,'learner','unpaired','worker','pti-owner'])assert.notEqual((await f.request('POST','/service/start',{clientRequestId:'denied'},token)).status,200);
  const unpaired=await f.request('GET','/session',{},'unpaired');assert.equal(unpaired.status,200);assert.equal(unpaired.body.service,null);
  for(const token of [null,'admin','pti-other','wrong-project','worker','invalid'])assert.notEqual((await f.request('GET','/host/status',{},token)).status,200);
  assert.equal((await f.request('GET','/host/status',{},'pti-owner')).status,200);
  assert.equal((await f.request('POST','/host/start',{clientRequestId:'pti-start'},'pti-owner','https://pti-app-2ab59.web.app')).status,200);
  assert.equal((await f.request('GET','/host/status',{},'pti-owner','https://hostile.example')).status,403);
  const wrongWorker=await f.service.worker({...workerClaims});
  await assert.rejects(()=>f.service.serviceControl.poll({...wrongWorker,id:'other-worker'},{version:'test',workerRunning:false}),{status:403});
});

test('offline starter cannot remotely start itself and client cannot supply commands or targets',async()=>{
  const f=fixture();let session=await f.request('GET','/session');assert.equal(session.body.service.state,'starter_offline');assert.equal(session.body.service.canStart,false);
  assert.equal((await f.request('POST','/service/start',{clientRequestId:'one'})).body.error.code,'starter_offline');
  await f.poll();
  for(const body of [{clientRequestId:'one',command:'powershell'},{clientRequestId:'one',workerId:'other'},{clientRequestId:'one',path:'C:/whatever'},{clientRequestId:'../bad'},{}])assert.equal((await f.request('POST','/service/start',body)).status,400);
  session=await f.request('GET','/session');assert.equal(session.body.service.state,'offline');assert.equal(session.body.service.canStart,true);assert(!JSON.stringify(session).includes('private-secret'));
});

test('concurrent cross-app starts coalesce, claimed request replays until acknowledgement, heartbeat alone establishes readiness',async()=>{
  const f=fixture();await f.poll();
  const [a,b]=await Promise.all([f.request('POST','/service/start',{clientRequestId:'gtop-one'}),f.request('POST','/host/start',{clientRequestId:'pti-one'},'pti-owner')]);
  assert.equal(a.body.service.request.id,b.body.service.request.id);assert.equal(a.body.service.state,'starting');
  const first=await f.poll({workerRunning:true}),again=await f.poll();assert.equal(first.body.request.action,'start');assert.deepEqual(first.body.request,again.body.request);assert.equal(first.body.service.worker.state,'offline');
  const id=first.body.request.id;
  let ack=await f.poll({lastStartResult:{requestId:id,state:'started'}});assert.equal(ack.body.request,null);assert.equal(ack.body.service.state,'starting');assert.equal(ack.body.service.request.state,'started');
  const heartbeat=await f.request('POST','/worker/heartbeat',{state:'ready',modelReady:false,version:'synthetic-worker-test'},'worker');assert.equal(heartbeat.status,200);
  ack=await f.poll();assert.equal(ack.body.service.state,'ready');assert.equal(ack.body.service.request.state,'completed');assert.equal(ack.body.service.worker.modelReady,false);assert.equal(ack.body.service.canStart,false);
  f.advance(121);await f.poll();
  // Both clients' accepted submission IDs remain receipts; late retry cannot restart the PC.
  const old=await f.request('POST','/service/start',{clientRequestId:'gtop-one'}),other=await f.request('POST','/host/start',{clientRequestId:'pti-one'},'pti-owner');
  assert.equal(old.body.service.request.id,id);assert.equal(other.body.service.request.id,id);assert.equal(old.body.service.request.state,'completed');assert.equal((await f.poll()).body.request,null);
});

test('expiry refuses late acknowledgement, surfaces timeout and requires a new explicit request',async()=>{
  const f=fixture();await f.poll();const start=await f.request('POST','/service/start',{clientRequestId:'first'}),id=start.body.service.request.id;await f.poll();f.advance(121);
  const expired=await f.poll({lastStartResult:{requestId:id,state:'started'}});assert.equal(expired.body.request,null);assert.equal(expired.body.service.request.state,'expired');assert.equal(expired.body.service.request.errorCode,'worker_start_timeout');assert.equal(expired.body.service.state,'failed');
  const next=await f.request('POST','/service/start',{clientRequestId:'second'});assert.equal(next.status,200);assert.notEqual(next.body.service.request.id,id);
  const staleAck=await f.poll({lastStartResult:{requestId:id,state:'failed',errorCode:'start_failed'}});assert.equal(staleAck.body.request.id,next.body.service.request.id);
});

test('loading heartbeat stays loading and cannot complete a start request or trigger a duplicate start',async()=>{
  const f=fixture();await f.poll();const start=await f.request('POST','/service/start',{clientRequestId:'first'});const id=start.body.service.request.id;await f.poll();
  await f.request('POST','/worker/heartbeat',{state:'loading',modelReady:false,version:'synthetic-worker-test'},'worker');
  const status=await f.poll({lastStartResult:{requestId:id,state:'started'}});assert.equal(status.body.service.state,'starting');assert.equal(status.body.service.worker.state,'loading');assert.equal(status.body.service.request.state,'started');assert.equal(status.body.service.canStart,false);
  const duplicate=await f.request('POST','/service/start',{clientRequestId:'second'});assert.equal(duplicate.status,200);assert.equal(duplicate.body.service.request.id,id);
});

test('allowlisted failures are private, duplicate failures are harmless, cooldown bounds restart loops',async()=>{
  const f=fixture();await f.poll();const start=await f.request('POST','/service/start',{clientRequestId:'first'}),id=start.body.service.request.id;await f.poll();
  assert.equal((await f.poll({lastStartResult:{requestId:id,state:'failed',errorCode:'C:/secret-folder/token'}})).status,400);
  const result={requestId:id,state:'failed',errorCode:'model_unavailable'};let ack=await f.poll({lastStartResult:result});assert.equal(ack.body.service.state,'failed');assert.equal(ack.body.service.request.errorCode,'model_unavailable');
  ack=await f.poll({lastStartResult:result});assert.equal(ack.body.service.request.state,'failed');assert.equal((await f.request('POST','/service/start',{clientRequestId:'second'})).status,429);
  f.advance(31);assert.equal((await f.request('POST','/service/start',{clientRequestId:'second'})).status,200);
});

test('stale starter, stale heartbeat, disabled pairing and removed admin authority never report usable service',async()=>{
  const f=fixture();await f.poll();f.advance(91);let session=await f.request('GET','/session');assert.equal(session.body.service.state,'starter_offline');assert.equal(session.body.service.canStart,false);
  await f.poll();f.store.docs.set('users/admin',{role:'user'});assert.equal((await f.request('POST','/service/start',{clientRequestId:'denied'})).status,403);
  f.store.docs.set('users/admin',{role:'admin'});f.store.docs.get('assistantWorkers/'+serviceWorkerId).enabled=false;
  assert.equal((await f.poll()).status,403);assert.equal((await f.request('GET','/host/status',{},'pti-owner')).status,503);session=await f.request('GET','/session');assert.equal(session.body.service,null);
});
