import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readConfig,record,converse,waitForRuntime,localModelLoaded} from '../src/adapters.js';
import {Worker} from '../src/worker.js';
import {hash} from '../src/policy.js';
import {AssistantService} from '../../../assistant-service/service.mjs';
import {MemoryStore} from '../../../assistant-service/store.mjs';
import {buildTaskBrief} from '../../../assistant-service/domain/task-brief.mjs';

// Real local Qwen/Codex, isolated in-memory application. Never starts the worker
// claim loops, connects to the production gateway, or reads/resumes old jobs.
const installed=await readConfig(process.argv[2]);
const root=process.argv[3];if(!root||!/^F:[\\/]/i.test(root))throw Error('Use an explicit F-drive acceptance directory.');
await mkdir(root,{recursive:true});
await cp(path.join(installed.dataDirectory,'tokenizer'),path.join(root,'tokenizer'),{recursive:true});
const config={...installed,gateway:'http://127.0.0.1',workerId:'synthetic-runner',secretProtected:undefined,
  firebaseApiKey:'synthetic-unused',dataDirectory:root,codexModel:'gpt-6.1-sol',codexReasoningEffort:'xhigh' as const};
const signal=AbortSignal.timeout(900000);
await waitForRuntime(config,signal);
const text='Reply briefly in English to this greeting: Good morning.';
const request={id:'synthetic-greeting',text,sha256Utf8:hash(text)};
const local=await converse(config,{id:'synthetic-greeting',ownerUid:'synthetic-teacher',request,rootRequest:request,
  history:[],profile:{},context:{},controllerFacts:{permissions:{routinePaperWork:true},availableData:{}}},path.join(root,'local'),signal);
assert.match(local.proposal.reply,/morning|hello/i);
assert.equal(await localModelLoaded(config),false,'Qwen must unload after the actual inference');
console.log(JSON.stringify({stage:'local-inference',completed:true,modelResident:false}));

const store=new MemoryStore({'users/synthetic-teacher':{role:'admin'},'assistantConfig/pilot':{allowedOwnerUids:['synthetic-teacher']},
  'assistantWorkers/synthetic-runner':{enabled:true,allowedOwnerUids:['synthetic-teacher']},
  'syllabus/synthetic-addition':{id:'synthetic-addition',board:'CBSE',standard:'5',subject:'Mathematics',chapter:'Addition'}});
let n=0;const service:any=new AssistantService(store,{id:()=>`runner-acceptance-${++n}`} as any);
const identity={id:'synthetic-runner',allowedOwnerUids:['synthetic-teacher']};
const worker=new Worker(config);
worker.api={post:async(endpoint:string,body:any)=>{
  if(endpoint==='/worker/heartbeat')return service.heartbeat(identity,body);
  if(endpoint==='/worker/curriculum/catalogue')return service.curriculumCatalogue();
  if(endpoint==='/worker/curriculum/resolve')return {curriculum:await service.resolveCurriculum(body.requirements,body.conversationId,identity)};
  const m=endpoint.match(/^\/worker\/jobs\/([^/]+)\/(heartbeat|event|delegate|complete|fail)$/);
  assert(m,'Only isolated application endpoints are available');
  if(m[2]==='event')console.log(JSON.stringify({stage:body.phase,at:new Date().toISOString()}));
  return service[({heartbeat:'renew',event:'event',delegate:'delegate',complete:'complete',fail:'failed'} as any)[m[2]]](identity,m[1],body);
}} as any;
const c=(await service.createConversation('synthetic-teacher',{})).conversation;
await service.submit('synthetic-teacher',c.id,{text:'Create a fresh CBSE Class 5 Mathematics practice paper in English. Only chapter Addition. Total 10 marks. Duration 10 minutes. Exactly two short-answer questions worth 5 marks each. No internal choices. Include worked answers. Use the selected saved curriculum; custom practice format.',clientMessageId:'synthetic-fresh-request'});
const turn=(await service.claim(identity,{kind:'turn'})).job;assert(turn);
// Assert the interpreted scope before any paid/expensive generation. Preserve a
// failed fixture instead of letting defaults silently expand the acceptance run.
const brief=buildTaskBrief(turn);assert.equal(brief.requirements.marks,10);assert.equal(brief.requirements.durationMinutes,10);assert.equal(brief.requirements.internalChoices,false);
await worker.run(turn,signal);
const turnResult=await store.get('assistantJobs/'+turn.id);assert.equal(turnResult.state,'completed',turnResult.error);
const paperJob=(await service.claim(identity,{kind:'paper'})).job;assert(paperJob,'Fresh explicit request must delegate one paper');
assert.equal(paperJob.operation,'generate_paper');assert.equal(paperJob.requirements.marks,10);assert.equal(paperJob.requirements.durationMinutes,10);assert.equal(paperJob.requirements.internalChoices,false);await worker.run(paperJob,signal);
const final=await store.get('assistantJobs/'+paperJob.id);assert.equal(final.state,'completed',final.error);
const paper=await store.get('assistantPapers/'+final.paperId);assert(paper);assert.equal(paper.validation.attemptedMarks,10);
assert.equal(paper.validation.questionCount,2);
const artifacts:any={};
for(const kind of ['student','answers']){
  const html=await service.artifact('synthetic-teacher',paper.id,kind);
  const file=path.join(root,kind+'.html');await writeFile(file,html);
  artifacts[kind]={bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex')};
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),artifacts[kind].sha256);
}
assert.notEqual(artifacts.student.sha256,artifacts.answers.sha256);
assert.equal((await service.claim(identity,{kind:'paper'})).job,null);
assert.equal(await localModelLoaded(config),false);
await record(root,'summary.json',{evidenceKind:'actual-inference-synthetic-in-memory-application',productionWrites:false,
  productionQueueClaims:false,oldJobsReadOrResumed:false,endpoint:config.ollama,model:config.model,codexModel:config.codexModel,
  reasoningEffort:config.codexReasoningEffort,local:local.metrics,paperId:paper.id,validation:paper.validation,
  metrics:final.metrics,artifacts,modelResident:false,completedAt:new Date().toISOString()});
console.log(JSON.stringify({completed:true,productionWrites:false,marks:10,questions:2,artifacts,modelResident:false}));
