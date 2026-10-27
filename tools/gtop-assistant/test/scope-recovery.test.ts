import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTaskBrief} from '../../../assistant-service/domain/task-brief.mjs';
import {route,verifiedRequirements,curriculumHelp,hash,handoff,taskRoot,patternClarification} from '../src/policy.js';
import {Worker} from '../src/worker.js';
import {AssistantService} from '../../../assistant-service/service.mjs';
import {MemoryStore} from '../../../assistant-service/store.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const message=(id:string,text:string)=>({id,text,role:'user',createdAt:'2026-10-26T00:00:00Z',sha256Utf8:hash(text)});
function job(text:string):any{const request=message('current',text);return {request,rootRequest:request,history:[],context:{},catalogue:{},controllerFacts:{permissions:{routinePaperWork:true},availableData:{}}};}

test('IB to ICSE replaces deleted qualifiers, their evidence and the previous creation root',()=>{
  const j=job('Create question paper for 9 th ICSE biology,');
  j.history=[message('ib','Create question paper for 11 th IBDP maths, 60 marks'),message('level','SL')];
  const b=buildTaskBrief(j);assert.equal(b.requirements.board,'ICSE');assert.equal(b.requirements.standard,'9');assert.equal(b.requirements.subject,'Biology');
  for(const k of ['programme','level','subjectCode','examYear','edition']){assert.equal(b.requirements[k],undefined);assert.equal(b.sources[k],undefined);}
  assert.equal(b.creationRequestId,'current');
});

test('legacy persisted contamination is repaired on the next turn, preserving the actual single chapter',()=>{
  const j=job('All topics. Create the paper.');
  const original=message('icse','Create question paper for 9 th ICSE, biology  , digestive system,40 mark, ICSE board pattern');
  j.history=[message('ib','Create question paper for 11 th IBDP maths'),original];
  j.context.taskBrief={version:1,requirements:{board:'ICSE',standard:'9',subject:'Biology',programme:'IBDP',scope:'full_syllabus',marks:40},sources:{},lastMessageId:'icse'};
  j.taskBrief=buildTaskBrief(j);const b=j.taskBrief;
  assert.equal(b.version,2);assert.equal(b.requirements.programme,undefined);assert.deepEqual(b.requirements.selectedChapters,['digestive system']);assert.equal(b.requirements.scope,'selected_chapters');assert.equal(b.requirements.marks,40);
  assert.equal(taskRoot(j),'icse');
  const r=verifiedRequirements(j,{action:'generate_paper'});j.requirements=r;
  const packet=handoff(j);assert.equal(packet.originalUserRequest.text,j.request.text);assert.equal(packet.controllerVerified.requirements.scope,'selected_chapters');assert.equal(packet.relevantConversationHistory[1].text,original.text);
});

test('period-separated digestivesystem follow-up retains prior subject and never widens scope',()=>{
  const j=job('Digestive system. ,40 mark , question paper for 9 th ICSE');
  j.history=[message('scope','Create question paper for 9 th ICSE biology,')];
  const b=buildTaskBrief(j);assert.deepEqual(b.requirements.selectedChapters,['Digestive system']);assert.equal(b.requirements.subject,'Biology');assert.equal(b.coverage,'all_topics_in_selected_chapters');
});

test('a prior active paper cannot reintroduce IB qualifiers after a board correction',()=>{
  const j=job('Create ICSE Class 9 Biology 40 mark paper. Chapters: Digestive system.');
  j.context.activeRequirements={board:'IB',standard:'11',subject:'Mathematics',programme:'DP',level:'HL',subjectCode:'old',examYear:'2027',edition:'old',marks:60};
  const r=verifiedRequirements(j,{action:'generate_paper'});for(const k of ['programme','level','subjectCode','examYear','edition'])assert(!r[k]);
  assert.deepEqual(r.selectedChapters,['Digestive system']);
});

test('negative and discussion turns cannot become chapter selections or online-check approval',()=>{
  for(const text of ['What is the digestive system?','Explain ICSE Biology, digestive system.']){
    const j=job(text),b=buildTaskBrief(j);assert(!b.requirements.selectedChapters,text);
  }
  const j=job('No, do not check online.');j.context.taskBrief={version:2,requirements:{board:'ICSE',standard:'9',subject:'Biology'},sources:{},creationRequestId:'old',pendingClarification:{field:'curriculum'},lastMessageId:'old'};
  assert.notEqual(route(j,{action:'check_curriculum',reply:'Okay'}).action,'check_curriculum');
});

test('gateway-confirmed curriculum offer accepts yes as a check, never as a paper or broad approval',()=>{
  const j=job('Yes');j.context.taskBrief={version:2,requirements:{board:'ICSE',standard:'9',subject:'Biology',scope:'selected_chapters',selectedChapters:['Digestive system'],marks:40},sources:{},creationRequestId:'original',pendingClarification:{field:'curriculum',attempts:1},lastMessageId:'previous'};
  assert.equal(route(j,{action:'local_answer',reply:'Okay'}).action,'check_curriculum');
  assert.match(curriculumHelp(j),/Digestive system/);assert(curriculumHelp(j).split(/\s+/).length<40);
  j.context.taskBrief.creationPaused=true;assert.notEqual(route(j,{action:'check_curriculum',reply:'Okay'}).action,'check_curriculum');
  j.context.taskBrief=null;assert.notEqual(route(j,{action:'check_curriculum',reply:'Shall I check it online?'}).action,'check_curriculum');
});

test('short format clarification retains the actual restriction and can be accepted',()=>{
  const j=job('Yes');j.history=[message('root','Create ICSE Class 9 Biology 40 marks paper, digestive system, ICSE board pattern'),{role:'assistant',text:patternClarification(j)}];
  assert(patternClarification(j).split(/\s+/).length<30);assert.equal(route(j,{action:'local_answer',reply:'Okay'}).action,'generate_paper');
});

test('real worker and gateway logic recover missing curriculum and delegate only a confirmed check',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gtop-scope-integration-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new MemoryStore({'users/owner':{role:'admin'},'assistantConfig/pilot':{allowedOwnerUids:['owner']},'assistantWorkers/w':{enabled:true,allowedOwnerUids:['owner']}});
  let id=0,clock=Date.parse('2026-10-27T00:00:00Z');const service:any=new AssistantService(store,{id:()=>`scope-${++id}`,now:()=>new Date(clock+=1000)} as any);
  const w={id:'w',allowedOwnerUids:['owner']};const c=(await service.createConversation('owner',{})).conversation;
  const worker=new Worker({gateway:'http://127.0.0.1',workerId:'w',firebaseApiKey:'synthetic',ollama:'http://127.0.0.1:11434',model:'synthetic',codexExecutable:'never-executed',codexModel:'unused',dataDirectory:dir});
  worker.api={post:async(endpoint:string,body:any)=>{
    try{if(endpoint==='/worker/curriculum/catalogue')return service.curriculumCatalogue();if(endpoint==='/worker/curriculum/resolve')return {curriculum:await service.resolveCurriculum(body.requirements,body.conversationId,w)};
      const match=endpoint.match(/^\/worker\/jobs\/([^/]+)\/(delegate|complete)$/);assert(match,endpoint);return await (service as any)[match![2]](w,match![1],body);
    }catch(e:any){throw Object.assign(Error(`Gateway ${e.status||500}: ${e.message}`),{code:e.code});}
  }} as any;
  let chats=0,unloads=0;t.mock.method(globalThis,'fetch',async(input:any)=>{
    if(String(input).endsWith('/api/chat')){chats++;return Response.json({message:{content:JSON.stringify({action:'generate_paper',reply:'I have sent it to Codex.'})}});}
    assert(String(input).endsWith('/api/generate'));unloads++;return Response.json({done:true});
  });
  const original='Create question paper for 9 th ICSE, biology, Digestive system,40 mark';
  await service.submit('owner',c.id,{text:original,clientMessageId:'first'});let j=(await service.claim(w,{kind:'turn'})).job;await worker.turn(j,dir,new AbortController().signal);
  const saved=await store.get('assistantConversations/'+c.id);assert.equal(saved.taskBrief.pendingClarification.field,'curriculum');assert.deepEqual(saved.taskBrief.requirements.selectedChapters,['Digestive system']);
  assert.equal((await service.claim(w,{kind:'paper'})).job,null);
  await service.submit('owner',c.id,{text:'Yes',clientMessageId:'confirmed'});j=(await service.claim(w,{kind:'turn'})).job;await worker.turn(j,dir,new AbortController().signal);
  const research=(await service.claim(w,{kind:'paper'})).job;assert.equal(research.operation,'check_curriculum');assert.equal(research.rootRequest.text,original);assert.equal(research.request.text,'Yes');assert.deepEqual(research.requirements.selectedChapters,['Digestive system']);assert.equal(research.requirements.marks,40);
  assert.equal(chats,2);assert.equal(unloads,2);
});
