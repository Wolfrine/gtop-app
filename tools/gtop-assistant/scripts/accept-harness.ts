import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,cp,writeFile} from 'node:fs/promises';
import {readConfig,record,converse} from '../src/adapters.js';
import {Worker} from '../src/worker.js';
import {hash} from '../src/policy.js';
import {AssistantService} from '../../../assistant-service/service.mjs';
import {MemoryStore} from '../../../assistant-service/store.mjs';

// Actual inference, synthetic administrator and isolated in-memory storage.
// No production gateway, credential exchange, conversations or papers are written.
const installed=await readConfig(process.argv[2]);
const root=process.argv[3];if(!root||!/^F:[\\/]/i.test(root))throw Error('Use an explicit F-drive acceptance directory.');
await mkdir(root,{recursive:true});await cp(path.join(installed.dataDirectory,'tokenizer'),path.join(root,'tokenizer'),{recursive:true});
const config={...installed,gateway:'http://127.0.0.1',workerId:'acceptance',secretProtected:undefined,dataDirectory:root};
const store=new MemoryStore({'users/synthetic-teacher':{role:'admin'},'assistantConfig/pilot':{allowedOwnerUids:['synthetic-teacher']},'assistantWorkers/acceptance':{enabled:true,allowedOwnerUids:['synthetic-teacher']},'syllabus/synthetic-scope':{id:'synthetic-scope',board:'ICSE',standard:'9',subject:'Biology',chapter:'Digestive system'}});
let n=0;const service:any=new AssistantService(store,{id:()=>`acceptance-${++n}`} as any),identity={id:'acceptance',allowedOwnerUids:['synthetic-teacher']};
const worker=new Worker(config);worker.api={post:async(endpoint:string,body:any)=>{
  try{
    if(endpoint==='/worker/heartbeat')return service.heartbeat(identity,body);
    if(endpoint==='/worker/curriculum/catalogue')return service.curriculumCatalogue();
    if(endpoint==='/worker/curriculum/resolve')return {curriculum:await service.resolveCurriculum(body.requirements,body.conversationId,identity)};
    const m=endpoint.match(/^\/worker\/jobs\/([^/]+)\/(heartbeat|event|delegate|complete|fail)$/);if(!m)throw Error('No production endpoint is available in acceptance.');
    const method=({heartbeat:'renew',event:'event',delegate:'delegate',complete:'complete',fail:'failed'} as any)[m[2]];
    if(m[2]==='event')console.log(JSON.stringify({phase:body.phase,at:new Date().toISOString()}));
    return await service[method](identity,m[1],body);
  }catch(e:any){throw Object.assign(Error(`Gateway ${e.status||500}: ${e.message}`),{code:e.code});}
}} as any;
const signal=AbortSignal.timeout(900000),c=(await service.createConversation('synthetic-teacher',{})).conversation;
const turn=async(text:string)=>{await service.submit('synthetic-teacher',c.id,{text,clientMessageId:'message-'+(++n)});const {job}=await service.claim(identity,{kind:'turn'});assert(job);await worker.run(job,signal);const result=await store.get('assistantJobs/'+job.id);assert.equal(result.state,'completed',JSON.stringify(result.error));return job;};
await turn('Mujhe Class 9 Biology ka 40 marks paper chahiye. Chapters: Digestive system.');
const afterLocal=await service.conversation('synthetic-teacher',c.id);console.log(JSON.stringify({firstReply:afterLocal.messages.at(-1)?.text}));
assert(!(await service.claim(identity,{kind:'paper'})).job,'Missing board cannot generate a paper');
await turn('ICSE. Include all topics in that chapter.');
const paperJob=(await service.claim(identity,{kind:'paper'})).job;assert(paperJob);assert.equal(paperJob.operation,'generate_paper');assert.equal(paperJob.requirements.marks,40);assert.deepEqual(paperJob.requirements.selectedChapters,['Digestive system']);
await worker.run(paperJob,signal);const final=await store.get('assistantJobs/'+paperJob.id);assert.equal(final.state,'completed',JSON.stringify(final.error));
const paper=await store.get('assistantPapers/'+final.paperId);assert.equal(paper.validation.attemptedMarks,40);
await writeFile(path.join(root,'student.html'),await service.artifact('synthetic-teacher',paper.id,'student'));
await writeFile(path.join(root,'answers.html'),await service.artifact('synthetic-teacher',paper.id,'answers'));
const originalHash=hash(JSON.stringify(paper));
await turn('Please revise question 2 to be slightly harder. Preserve the chapter, marks and other questions.');
const revisionJob=(await service.claim(identity,{kind:'paper'})).job;assert.equal(revisionJob.operation,'revise_paper');assert.equal(revisionJob.targetQuestionNumber,2);await worker.run(revisionJob,signal);
const revised=await store.get('assistantJobs/'+revisionJob.id);assert.equal(revised.state,'completed',JSON.stringify(revised.error));assert.equal(hash(JSON.stringify(await store.get('assistantPapers/'+paper.id))),originalHash);
const request={id:'calculator',text:'Use the calculate tool for (17*23+9)/2, then give the result.',sha256Utf8:hash('Use the calculate tool for (17*23+9)/2, then give the result.')};
const local=await converse(config,{id:'calculator',ownerUid:'synthetic-teacher',request,rootRequest:request,history:[],profile:{},context:{},controllerFacts:{permissions:{routinePaperWork:true},availableData:{}}},path.join(root,'calculator'),signal);
await record(root,'summary.json',{syntheticAdministrator:true,productionWrites:false,model:config.model,codexModel:config.codexModel,paper:{questions:paper.validation.questionCount,marks:40,chapters:paper.validation.chaptersCovered},immutableRevision:true,calculator:local,completedAt:new Date().toISOString(),metrics:{paper:final.metrics,revision:revised.metrics}});
console.log(JSON.stringify({completed:true,marks:40,questions:paper.validation.questionCount,immutableRevision:true,calculatorToolSteps:local.metrics.toolSteps}));
