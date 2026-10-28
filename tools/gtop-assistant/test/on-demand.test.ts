import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {converse,type Config} from '../src/adapters.js';
import {Worker} from '../src/worker.js';
import {hash} from '../src/policy.js';

async function fixture(t:any){
  const dir=await mkdtemp(path.join(os.tmpdir(),'gtop-on-demand-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const config:Config={gateway:'http://127.0.0.1',workerId:'synthetic',firebaseApiKey:'synthetic',ollama:'http://127.0.0.1:11434',model:'synthetic-model',codexExecutable:process.execPath,codexModel:'unused',dataDirectory:dir};
  const request={id:'r',text:'Hello!',sha256Utf8:hash('Hello!')};
  const job:any={id:'idle-wake',kind:'turn',leaseId:'synthetic-lease',ownerUid:'synthetic',conversationId:'c',requestRevision:1,request,rootRequest:request,history:[{...request,role:'user'}],profile:{},context:{},controllerFacts:{permissions:{routinePaperWork:true},availableData:{}}};
  return {config,dir,job};
}

test('idle startup advertises an available listener without loading a model',async t=>{
  const {config}=await fixture(t),stop=new AbortController(),calls:string[]=[],heartbeats:any[]=[];
  t.mock.method(globalThis,'fetch',async(input:any)=>{calls.push(String(input));assert(String(input).endsWith('/api/ps'));return Response.json({models:[]});});
  const worker=new Worker(config);
  worker.api={post:async(endpoint:string,body:any)=>{assert.equal(endpoint,'/worker/heartbeat');heartbeats.push(body);stop.abort();return {ok:true};}} as any;
  await worker.start(stop.signal);
  assert.equal(calls.length,1);
  assert.deepEqual(heartbeats.map(h=>[h.state,h.modelReady]),[['ready',false],['offline',false]]);
});

test('queued work wakes an unloaded model and returns to idle after the reply',async t=>{
  const {config,dir,job}=await fixture(t),stop=new AbortController();let claimed=false,completed=false,chats=0,unloads=0;
  job.request={id:'r',text:'Explain how evaporation works.',sha256Utf8:hash('Explain how evaporation works.')};job.rootRequest=job.request;job.history=[{...job.request,role:'user'}];
  const timeout=setTimeout(()=>stop.abort(Error('Synthetic queue test timed out')),5000);t.after(()=>clearTimeout(timeout));
  t.mock.method(globalThis,'fetch',async(input:any,init:any)=>{
    const url=String(input);if(url.endsWith('/api/ps'))return Response.json({models:[]});
    const body=JSON.parse(init.body);assert.equal(body.keep_alive,url.endsWith('/api/chat')?30:0);assert(claimed,'No inference before a job is claimed');
    if(url.endsWith('/api/chat')){chats++;return Response.json({message:{content:JSON.stringify({action:'local_answer',reply:'Liquid molecules escape into the air as vapour.'})},prompt_eval_count:100,eval_count:10});}
    assert(url.endsWith('/api/generate'));unloads++;assert.equal(body.prompt,undefined);return Response.json({done:true,done_reason:'unload'});
  });
  const worker=new Worker(config);
  worker.api={post:async(endpoint:string,body:any)=>{
    if(endpoint==='/worker/heartbeat')return {ok:true};
    if(endpoint==='/worker/claim'){if(body.kind==='turn'&&!claimed){claimed=true;return {job};}return {job:null};}
    if(endpoint==='/worker/curriculum/catalogue')return {boards:[]};
    if(endpoint.endsWith('/event'))throw Error('Unexpected escalation: '+await readFile(path.join(dir,'jobs',job.id,'local-fallback.json'),'utf8'));
    if(endpoint.endsWith('/fail')){stop.abort(Error(body.error));throw Error(body.error);}
    assert.equal(endpoint,'/worker/jobs/idle-wake/complete');assert.equal(body.reply,'Liquid molecules escape into the air as vapour.');completed=true;stop.abort();return {active:true};
  }} as any;
  await worker.start(stop.signal);
  assert(completed);assert.equal(chats,1);assert.equal(unloads,1);assert.equal(worker.ready,false);
  assert.equal(JSON.parse(await readFile(path.join(dir,'jobs',job.id,'local-model-release.json'),'utf8')).released,true);
});

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
    assert.equal(JSON.parse(init.body).keep_alive,String(input).endsWith('/api/chat')?30:0);
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

test('model-ready heartbeat reflects actual residency and remains false when Ollama is unavailable',async t=>{
  const {config}=await fixture(t),heartbeats:any[]=[];let count=0;
  t.mock.method(globalThis,'fetch',async()=>{count++;if(count===3)throw Error('Offline');return Response.json({models:[{name:count===1?'another-model':config.model}]});});
  const worker=new Worker(config);worker.api={post:async(_endpoint:string,body:any)=>{heartbeats.push(body);return {ok:true};}} as any;
  await worker.heartbeat();await worker.heartbeat();await worker.heartbeat();
  assert.deepEqual(heartbeats.map(h=>[h.state,h.modelReady]),[['ready',false],['ready',true],['ready',false]]);
});
