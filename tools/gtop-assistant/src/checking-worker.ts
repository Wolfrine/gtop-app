import path from 'node:path';
import { mkdir, realpath } from 'node:fs/promises';
import { Gateway, delay, readGatewayConfig, record } from './adapters.js';
import { resolveDesktopCodex } from './runner.js';
import { DispatchWake } from './dispatch.js';
import { acquireWorkerLock } from './singleton.js';
import { assessStudentGrade } from '../../../assistant-service/domain/checking.mjs';
import { checkingConfig, gradeScans, organizeScans, readExternalExam, verifyExternalExamSource } from './checking-model.mjs';
import { reconcileSourceFidelity, sourceFidelityBudgetMs } from './checking-source-fidelity.mjs';
import { intakeChunkSize } from '../../../assistant-service/domain/checking-intake.mjs';
import { maxCheckingPages } from '../../../assistant-service/domain/checking-limits.mjs';
import { maxExternalPages, readExternalReference } from '../../../assistant-service/domain/external-reference.mjs';

interface LeasedJob {
  id:string;
  lease:string;
  leaseUntil:string;
  pageCount:number;
  automatic?:boolean;
}
interface GradingJob extends LeasedJob {
  kind?:'grade';
  notes:string;
  rubric:Parameters<typeof gradeScans>[1];
}
interface IntakeJob extends LeasedJob {
  kind:'class-intake';
  firstPage:number;
  lastPage:number;
  knownStarts?:number[];
}
interface ExternalExamJob extends LeasedJob {
  kind:'external-exam';
  questionPages:number;
}
type CheckingJob=GradingJob|IntakeJob|ExternalExamJob;

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
const status={protocol:'automatic-checking-v1',pid:process.pid,engine:model.engine,model:model.model,startedAt:new Date().toISOString(),
  connected:false,claims:0,graded:0,organizedChunks:0,examsRead:0,failed:0,state:'connecting'};
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
        const {job,nextWake}=await gateway.post('/worker/checking/claim',{
          engine:model.engine,capabilities:['class-intake-v1','external-exam-v1','automatic-checking-v1'],
        },stop.signal) as {job:CheckingJob|null;nextWake:string|null};
        failures=0;
        clearTimeout(next);
        if(nextWake)next=setTimeout(()=>wake.wake(lane),Math.max(500,Date.parse(nextWake)-Date.now()+500));
        if(job){await processJob(job);wake.wake(lane);}
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

function pageRange(job:CheckingJob):[number,number]{
  if(!Number.isSafeInteger(job.pageCount)||job.pageCount<1)throw Error('bad_job');
  if(job.kind==='class-intake'){
    if(!Number.isInteger(job.firstPage)||!Number.isInteger(job.lastPage)||job.firstPage<1||
        job.lastPage<job.firstPage||job.lastPage>job.pageCount||job.lastPage-job.firstPage>=intakeChunkSize)
      throw Error('invalid_packet_range');
    return [Math.max(1,job.firstPage-1),job.lastPage];
  }
  if(job.kind==='external-exam'){
    if(!Number.isInteger(job.questionPages)||job.questionPages<1||job.questionPages>job.pageCount||job.pageCount>maxExternalPages)
      throw Error('invalid_exam_pages');
  }else if(job.pageCount>maxCheckingPages||!job.rubric?.questions)throw Error('invalid_grading_job');
  return [1,job.pageCount];
}

async function processJob(job:CheckingJob){
  const endpoint='/worker/checking/'+job.id;
  const signal=AbortSignal.any([stop.signal,AbortSignal.timeout(Math.max(1,Date.parse(job.leaseUntil)-Date.now()-10_000))]);
  const state=job.kind==='class-intake'?'organizing':job.kind==='external-exam'?'reading_exam':'grading';
  await report(state);
  let reason='checker_failed';
  try{
    if(job.automatic&&job.kind!=='external-exam'&&job.kind!=='class-intake'&&!job.rubric){
      await gateway.post(endpoint+'/complete',{engine:model.engine,lease:job.lease},signal);
      return;
    }
    const [first,last]=pageRange(job);
    const images:Buffer[]=[];
    reason='scan_unavailable';
    for(let index=first;index<=last;index++){
      const {jpeg}=await gateway.post(endpoint+'/pages/'+index,{lease:job.lease},signal);
      images.push(Buffer.from(jpeg,'base64'));
    }
    reason='checker_failed';
    const executable=model.engine==='codex-cli'?await resolveDesktopCodex():undefined;
    const options={executable,root,signal,automatic:job.automatic===true};
    const run=(recheck=false)=>job.kind==='class-intake'?organizeScans(model,job,images,options):
      job.kind==='external-exam'?readExternalExam(model,job,images,{...options,recheck}):
      gradeScans(model,job.rubric,job.notes,images,{...options,recheck});
    let result;
    let recovered=false;
    try{result=await run();}
    catch(error){
      if(!job.automatic||signal.aborted)throw error;
      recovered=true;
      result=await run(true);
    }
    const timeLeft=Date.parse(job.leaseUntil)-Date.now();
    if(!recovered&&job.automatic&&job.kind==='external-exam'&&model.engine==='codex-cli'&&timeLeft>90_000){
      const usable=(value:{reference?:unknown})=>{
        try{return readExternalReference(value.reference,job.questionPages).issues.length===0;}
        catch{return false;}
      };
      const verifySource=usable(result);
      const budget=verifySource?sourceFidelityBudgetMs:120_000;
      const recovery=AbortSignal.any([signal,AbortSignal.timeout(Math.min(budget,timeLeft-65_000))]);
      try{
        if(verifySource){
          const evidence=await verifyExternalExamSource(model,result.reference,images.slice(0,job.questionPages),{...options,signal:recovery});
          const reference=structuredClone(result.reference);
          reconcileSourceFidelity(reference,evidence,job.questionPages);
          if(usable({reference}))result={reference};
        }else{
          // A structural retry and a source reread share the same second model turn.
          const revised=await readExternalExam(model,job,images,{...options,recheck:true,signal:recovery});
          if(usable(revised))result=revised;
        }
      }catch{/* Keep the first reading and any structural reason it established. */}
    }
    if(!recovered&&job.automatic&&job.kind!=='external-exam'&&job.kind!=='class-intake'&&timeLeft>75_000){
      const assessment=(()=>{try{return assessStudentGrade(result,job.rubric,images.length);}catch{return null;}})();
      if(!assessment||assessment.recheck){
        // Never trade valid results from the first reading for a failed or less
        // complete retry. Only one targeted reread can run within this lease.
        const recovery=AbortSignal.any([signal,AbortSignal.timeout(Math.min(90_000,Date.parse(job.leaseUntil)-Date.now()-65_000))]);
        try{
          const reconsidered=await gradeScans(model,job.rubric,job.notes,images,{...options,recheck:true,signal:recovery});
          const revised=assessStudentGrade(reconsidered,job.rubric,images.length);
          const kept=new Map(revised.grade?.answers.map(answer=>[answer.number,answer]));
          const consistent=assessment?.grade?.answers.every(answer=>answer.awarded===null||
            kept.get(answer.number)?.awarded===answer.awarded&&kept.get(answer.number)?.status===answer.status)??true;
          if(consistent&&revised.grade&&(!assessment?.grade||revised.grade.pending<assessment.grade.pending))result=reconsidered;
        }catch{/* Keep the first validated assessment. */}
      }
    }
    const payload={...result,engine:model.engine,lease:job.lease};
    let completed;
    try{completed=await gateway.post(endpoint+'/complete',payload,signal);}
    catch(error){
      if(!job.automatic||signal.aborted)throw error;
      completed=await gateway.post(endpoint+'/complete',payload,signal);
    }
    if(!completed.active)throw Error('lease_lost');
    if(job.kind==='class-intake')status.organizedChunks++;
    else if(job.kind==='external-exam')status.examsRead++;
    else status.graded++;
  }catch{
    status.failed++;
    console.error('Checking attempt failed during '+state+'.');
    await gateway.post(endpoint+'/fail',{lease:job.lease,reason},stop.signal).catch(()=>{});
  }
}
