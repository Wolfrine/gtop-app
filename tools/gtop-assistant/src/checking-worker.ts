import path from 'node:path';
import { mkdir, realpath } from 'node:fs/promises';
import { Gateway, delay, readGatewayConfig, record } from './adapters.js';
import { resolveDesktopCodex } from './runner.js';
import { DispatchWake } from './dispatch.js';
import { acquireWorkerLock } from './singleton.js';
import { checkingConfig, gradeScans } from './checking-model.mjs';

interface GradingJob {
  id:string;
  lease:string;
  leaseUntil:string;
  pageCount:number;
  notes:string;
  rubric:Parameters<typeof gradeScans>[1];
}

const [pairing,operations]=process.argv.slice(2);
if(!pairing||!operations||!path.isAbsolute(operations))throw Error('Pass the existing worker configuration and a private operations directory.');
await mkdir(operations,{recursive:true});
const root=await realpath(operations);
if(process.platform==='win32'&&!/^H:\\/i.test(root))throw Error('Keep the checking runtime on H:.');
const config=await readGatewayConfig(pairing);
const model=checkingConfig();
const gateway=new Gateway(config);
const wake=new DispatchWake(),lane='checking';
const stop=new AbortController();
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>stop.abort());
const status={pid:process.pid,engine:model.engine,model:model.model,startedAt:new Date().toISOString(),
  connected:false,claims:0,graded:0,failed:0,state:'connecting'};
async function report(state:string){
  status.state=state;
  await record(root,'checking-status.json',{...status,updatedAt:new Date().toISOString()});
}
const unlocked=await acquireWorkerLock(root);
try{
  await report('connecting');
  await Promise.all([listen(),work()]);
}finally{await unlocked();}

async function listen(){
  let failures=0;
  while(!stop.signal.aborted){
    let close:(()=>Promise<void>)|undefined;
    let timer:ReturnType<typeof setTimeout>|undefined;
    let done=()=>{};
    const ended=new Promise<void>(resolve=>{done=resolve;});
    stop.signal.addEventListener('abort',done,{once:true});
    try{
      close=await gateway.listen(()=>wake.wake(lane),online=>{
        if(status.connected===online)return;
        status.connected=online;
        if(online){failures=0;wake.wake(lane);}
        else void report('connecting').catch(()=>{});
      },done);
      timer=setTimeout(done,50*60_000);
      if(stop.signal.aborted)done();
      await ended;
    }catch{
      console.error('Checking dispatch connection failed.');
    }finally{
      status.connected=false;
      clearTimeout(timer);
      stop.signal.removeEventListener('abort',done);
      await close?.().catch(()=>{});
      await report(stop.signal.aborted?'stopped':'connecting');
    }
    await delay(Math.min(60_000,1000*2**Math.min(failures++,6)),stop.signal).catch(()=>{});
  }
}

async function work(){
  let next:ReturnType<typeof setTimeout>|undefined;
  let failures=0;
  try{
    while(!stop.signal.aborted){
      try{
        await wake.wait(lane,stop.signal);
        if(!status.connected)continue;
        status.claims++;
        const {job,nextWake}=await gateway.post('/worker/checking/claim',{},stop.signal) as {job:GradingJob|null;nextWake:string|null};
        failures=0;
        clearTimeout(next);
        if(nextWake)next=setTimeout(()=>wake.wake(lane),Math.max(500,Date.parse(nextWake)-Date.now()+500));
        if(job){await grade(job);wake.wake(lane);}
        await report('idle');
      }catch{
        if(stop.signal.aborted)break;
        await report('connection_error');
        console.error('Checking queue request failed.');
        await delay(Math.min(60_000,1000*2**Math.min(failures++,6)),stop.signal).catch(()=>{});
        wake.wake(lane);
      }
    }
  }finally{clearTimeout(next);}
}

async function grade(job:GradingJob){
  const endpoint='/worker/checking/'+job.id;
  const signal=AbortSignal.any([stop.signal,AbortSignal.timeout(Math.max(1,Date.parse(job.leaseUntil)-Date.now()-10_000))]);
  await report('grading');
  try{
    const images:Buffer[]=[];
    for(let index=1;index<=job.pageCount;index++){
      const {jpeg}=await gateway.post(endpoint+'/pages/'+index,{lease:job.lease},signal);
      images.push(Buffer.from(jpeg,'base64'));
    }
    const executable=model.engine==='codex-cli'?await resolveDesktopCodex():undefined;
    const result=await gradeScans(model,job.rubric,job.notes,images,{executable,root,signal});
    const completed=await gateway.post(endpoint+'/complete',{...result,engine:model.engine,lease:job.lease},signal);
    if(!completed.active)throw Error('lease_lost');
    status.graded++;
  }catch{
    status.failed++;
    console.error('One grading attempt failed.');
    await gateway.post(endpoint+'/fail',{lease:job.lease},stop.signal).catch(()=>{});
  }
}
