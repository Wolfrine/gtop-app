import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DispatchWake,DispatchState} from '../src/dispatch.js';
import {acquireWorkerLock} from '../src/singleton.js';
import {Worker} from '../src/worker.js';

test('only server initial/revision/reconnect snapshots dispatch; duplicate and cache events do not',()=>{
  const state=new DispatchState(['owner']),one={schemaVersion:1,revision:'one'};
  assert.deepEqual(state.accept('owner',one,true),{ready:false,changed:false});
  assert.deepEqual(state.accept('owner',one,false),{ready:true,changed:true});
  assert.deepEqual(state.accept('owner',one,false),{ready:true,changed:false});
  assert.equal(state.accept('owner',one,true).changed,false);
  assert.equal(state.accept('owner',one,false).changed,true);
  assert.equal(state.accept('owner',{...one,revision:'two'},false).changed,true);
  assert.throws(()=>state.accept('owner',{schemaVersion:2,revision:'forged'},false),/Invalid dispatch/);
  assert.deepEqual(new DispatchState(['owner']).accept('owner',undefined,false),{ready:true,changed:true});
});

test('dispatch coalesces duplicate revisions and preserves work arriving during a busy lane',async()=>{
  const wake=new DispatchWake(),stop=new AbortController();wake.wake();wake.wake();
  await wake.wait('turn',stop.signal);await wake.wait('paper',stop.signal);
  let delivered=false;const next=wake.wait('turn',stop.signal).then(()=>{delivered=true;});
  await Promise.resolve();assert.equal(delivered,false);wake.wake('turn');await next;
  wake.wake('turn');await wake.wait('turn',stop.signal);
  const waiting=wake.wait('turn',stop.signal);stop.abort(Error('Stopped'));await assert.rejects(waiting,/Stopped/);
});

test('quiet connected worker makes no recurring claims; reconnect wakes both lanes once',async()=>{
  const worker=new Worker({} as any),stop=new AbortController();const calls:string[]=[];
  worker.available=true;worker.listenerReady=true;
  worker.api={post:async(endpoint:string,body:any)=>{assert.equal(endpoint,'/worker/claim');calls.push(body.kind);return {job:null};}} as any;
  const loops=Promise.all([worker.loop('turn',stop.signal),worker.loop('paper',stop.signal)]);
  worker.wake.wake();await new Promise(r=>setTimeout(r,20));assert.equal(calls.length,2);
  await new Promise(r=>setTimeout(r,60));assert.equal(calls.length,2);
  worker.listenerReady=false;worker.wake.wake();await new Promise(r=>setTimeout(r,20));assert.equal(calls.length,2);
  worker.listenerReady=true;worker.wake.wake();await new Promise(r=>setTimeout(r,20));assert.equal(calls.length,4);
  stop.abort();await loops;
});

test('atomic worker lock refuses a simultaneous launch and releases on orderly shutdown',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gtop-lock-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const release=await acquireWorkerLock(dir);await assert.rejects(acquireWorkerLock(dir),/worker lock exists/);
  await release();await (await acquireWorkerLock(dir))();
});
