import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {converse,type Config} from '../src/adapters.js';
import {Worker,healthHeartbeatMs} from '../src/worker.js';
import {hash} from '../src/policy.js';

test('health interval remains below unchanged availability TTL while lease renewal stays independent',()=>{
  assert.equal(healthHeartbeatMs,40000);
  assert(healthHeartbeatMs*2+10000<=90000,'One missed publication plus network margin must fit the existing freshness bound');
});

async function fixture(t:any){
  const dir=await mkdtemp(path.join(os.tmpdir(),'gtop-on-demand-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const config:Config={gateway:'http://127.0.0.1',workerId:'synthetic',firebaseApiKey:'synthetic',ollama:'http://127.0.0.1:11435',model:'synthetic-model',codexExecutable:process.execPath,codexModel:'unused',dataDirectory:dir,runner:{resolveCodex:async()=>process.execPath}};
  const request={id:'r',text:'Hello!',sha256Utf8:hash('Hello!')};
  const job:any={id:'idle-wake',kind:'turn',leaseId:'synthetic-lease',ownerUid:'synthetic',conversationId:'c',requestRevision:1,request,rootRequest:request,history:[{...request,role:'user'}],profile:{},context:{},controllerFacts:{permissions:{routinePaperWork:true},availableData:{}}};
  return {config,dir,job};
}

test('exact greetings and thanks do not wake the model or query the catalogue',async t=>{
  const {config,dir,job}=await fixture(t);let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Social replies need no model');});
  const worker=new Worker(config);let completed=0;
  worker.api={post:async(endpoint:string,body:any)=>{assert.equal(endpoint,'/worker/jobs/idle-wake/complete');assert.equal(body.metrics.localInference,false);completed++;return {active:true};}} as any;
  for(const text of ['Hello!','धन्यवाद','Aap kaise ho?']){job.request={id:'social',text};await worker.turn(job,dir,new AbortController().signal);}
  assert.equal(calls,0);assert.equal(completed,3);
});

test('invalid model JSON cannot leave the runner pinned after bounded repair',async t=>{
  const {config,dir,job}=await fixture(t);let chats=0,unloads=0;
  t.mock.method(globalThis,'fetch',async(input:any,init:any)=>{
    assert.equal(JSON.parse(init.body).keep_alive,String(input).endsWith('/api/chat')?60:0);
    if(String(input).endsWith('/api/chat')){chats++;return Response.json({message:{content:'{"reply":'}});}
    unloads++;return Response.json({done:true,done_reason:'unload'});
  });
  await assert.rejects(()=>converse(config,job,dir,new AbortController().signal),/invalid response twice/);
  assert.equal(chats,2);assert.equal(unloads,1);
});

test('cancellation still unloads with a separate live cleanup signal',async t=>{
  const {config,dir,job}=await fixture(t),stop=new AbortController();let unloads=0;
  t.mock.method(globalThis,'fetch',async(input:any,init:any)=>{
    if(String(input).endsWith('/api/chat')){stop.abort(Error('Synthetic cancellation'));throw stop.signal.reason;}
    assert.equal(init.signal.aborted,false);assert.equal(JSON.parse(init.body).keep_alive,0);unloads++;return Response.json({done:true});
  });
  await assert.rejects(()=>converse(config,job,dir,stop.signal),/Synthetic cancellation/);assert.equal(unloads,1);
});

test('gateway errors and cleanup failure preserve the original failure and record resource risk',async t=>{
  const {config,dir,job}=await fixture(t);
  t.mock.method(globalThis,'fetch',async(input:any)=>Response.json({}, {status:String(input).endsWith('/api/chat')?500:503}));
  await assert.rejects(()=>converse(config,job,dir,new AbortController().signal),/Local conversation unavailable \(500\)/);
  const released=JSON.parse(await readFile(path.join(dir,'local-model-release.json'),'utf8'));assert.equal(released.released,false);assert.match(released.error,/unload unavailable/);
});

test('already cancelled work never starts local inference',async t=>{
  const {config,dir,job}=await fixture(t),stop=new AbortController();stop.abort(Error('Already stopped'));let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Should not run');});
  await assert.rejects(()=>converse(config,job,dir,stop.signal),/Already stopped/);assert.equal(calls,0);
});

test('missing Codex makes heartbeat offline',async t=>{
  const {config}=await fixture(t),heartbeats:any[]=[];
  config.runner!.resolveCodex=async()=>{throw Error('Desktop build removed');};
  t.mock.method(globalThis,'fetch',async(input:any)=>Response.json({models:String(input).endsWith('/tags')?[{name:config.model}]:[]}));
  const worker=new Worker(config);worker.api={post:async(endpoint:string,body:any)=>{assert.equal(endpoint,'/worker/heartbeat');heartbeats.push(body);return {ok:true};}} as any;
  await worker.heartbeat();assert.equal(worker.available,false);assert.equal(heartbeats[0].state,'offline');
  assert.equal(heartbeats.length,1);
});
