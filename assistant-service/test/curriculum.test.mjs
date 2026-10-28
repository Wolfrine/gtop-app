import test from 'node:test';
import assert from 'node:assert/strict';
import {boards,validateScope,validateCurriculumScope,catalogueIndex,extractScope,savedCurriculum,sameScope} from '../domain/catalogue.mjs';
import {defaults,validateRequirements,validatePaper,validateRevision,renderPaper} from '../domain/index.mjs';
import {researchCurriculum,validateResearchCandidate,retrieveOfficialSource} from '../domain/research.mjs';
import {AssistantService} from '../service.mjs';
import {MemoryStore} from '../store.mjs';
import {buildTaskBrief,selectedCurriculum} from '../domain/task-brief.mjs';
const scope={board:'CBSE',standard:'10',subject:'Science',academicYear:'2026-27'};
const rows=Array.from({length:10},(_,i)=>({...scope,id:'saved-'+i,chapter:'Chapter '+(i+1)}));
function paper(r,c){return {...defaults,...r,title:'SYNTHETIC structural fixture',instructions:['Attempt all numbered questions.'],sections:[{title:'Section A',instructions:'',questions:c.chapters.map((x,i)=>({number:i+1,chapter:x.title,type:'short_answer',marks:1,question:'SYNTHETIC fixture '+i,options:[],correctIndex:null,answer:'PRIVATE answer '+i,markingPoints:['PRIVATE mark '+i],alternative:null}))}],sourceReferences:[{id:c.id,url:c.url,title:c.title}]};}
const candidate=(r=scope)=>({...Object.fromEntries(['programme','level','subjectCode','examYear','edition'].map(k=>[k,''])),...r,status:'found',reply:'Source-backed test fixture only.',title:'SYNTHETIC official source fixture',complete:true,chapters:[{id:'c1',title:'Chapter one',focus:'Test focus'}],sources:[{url:'https://cbseacademic.nic.in/test.pdf',title:'Official test fixture',applicableYear:'2026-27',locator:'p.1'}],paperPattern:null,limitations:[]});
const proofs=[{url:'https://cbseacademic.nic.in/test.pdf',finalUrl:'https://cbseacademic.nic.in/test.pdf',sha256:'a'.repeat(64),bytes:100,checkedAt:'2026-10-24T00:00:00Z'}];
function fixture(){let n=0;const store=new MemoryStore({'users/owner':{role:'admin'},'assistantConfig/pilot':{allowedOwnerUids:['owner']},'assistantWorkers/w':{enabled:true,allowedOwnerUids:['owner']},...Object.fromEntries(rows.map(x=>['syllabus/'+x.id,x]))});const service=new AssistantService(store,{id:()=>`test-${++n}`});return {store,service,w:{id:'w',allowedOwnerUids:['owner']}};}

test('sourced brief survives turns and fresh worker context; invented and assistant-sourced selections fail',async()=>{
  const f=fixture();const t=await turn(f,null,'Create a CBSE Class 10 Science 20 marks paper. Chapters: Chapter 1, Chapter 2.');
  await f.service.complete(f.w,t.job.id,{leaseId:t.job.leaseId,reply:'Both chapters are saved.'});
  const saved=await f.store.get('assistantConversations/'+t.cid);assert.deepEqual(saved.taskBrief.requirements.selectedChapters,['Chapter 1','Chapter 2']);assert.equal(saved.taskBrief.requirements.marks,20);
  const next=await turn(f,t.cid,'All topics. Start creating the paper.');assert.deepEqual(next.job.context.taskBrief.requirements.selectedChapters,['Chapter 1','Chapter 2']);
  const r={...defaults,...buildTaskBrief(next.job).requirements,internalChoices:false};const selected=await f.service.resolveCurriculum(r,t.cid,f.w);assert.equal(selected.chapters.length,2);
  await assert.rejects(()=>f.service.delegate(f.w,next.job.id,{leaseId:next.job.leaseId,operation:'generate_paper',requirements:{...r,scope:'full_syllabus',selectedChapters:undefined},interpretation:'widened',proposedActions:[]}),/cannot be widened/);
  await assert.rejects(()=>f.service.delegate(f.w,next.job.id,{leaseId:next.job.leaseId,operation:'generate_paper',requirements:{...r,selectedChapters:['Chapter 3']},interpretation:'invented',proposedActions:[]}),/saved user evidence/);
  await assert.rejects(()=>f.service.complete(f.w,next.job.id,{leaseId:next.job.leaseId,reply:'Forged',selection:{chapters:['Chapter 3'],sourceMessageId:next.job.request.id,quote:'Chapter 3'}}),/saved user/);
  await f.service.delegate(f.w,next.job.id,{leaseId:next.job.leaseId,operation:'generate_paper',requirements:r,rootRequestMessageId:t.job.request.id,interpretation:'Both selected chapters, every topic',proposedActions:['generate_paper']});
  const paperJob=(await f.service.claim(f.w,{kind:'paper'})).job;assert.equal(paperJob.curriculumSnapshot.chapters.length,2);assert.equal(paperJob.rootRequest.text,t.job.request.text);assert.equal(paperJob.requirements.scope,'selected_chapters');
});
test('selected-chapter publication rejects other chapters and missing selected coverage',()=>{
  const r={...defaults,...scope,scope:'selected_chapters',selectedChapters:['Chapter 1','Chapter 2'],marks:10,internalChoices:false};const all=savedCurriculum(r,rows),c=selectedCurriculum(all,r);
  const p=paper(r,c);p.sections[0].questions=Array.from({length:10},(_,i)=>({...p.sections[0].questions[i%2],number:i+1,question:'SYNTHETIC selected question '+i}));assert(validatePaper(p,r,all).passed);
  const bad=structuredClone(p);bad.sections[0].questions[0].chapter='Chapter 3';assert.throws(()=>validatePaper(bad,r,all),/pinned/);
  const missing=structuredClone(p);missing.sections[0].questions.forEach(q=>q.chapter='Chapter 1');assert.throws(()=>validatePaper(missing,r,all),/all 2 chapters/);
  const base={...p,requirements:r,curriculumSnapshot:c};assert(validateRevision(base,p,null,c).passed);
});
async function turn(f,cid,text){if(!cid)cid=(await f.service.createConversation('owner',{})).conversation.id;await f.service.submit('owner',cid,{text,clientMessageId:Math.random().toString(36).slice(2)});return {cid,job:(await f.service.claim(f.w,{kind:'turn'})).job};}

test('observed ICSE chapter request stays scoped through gateway delegation, publication and immutable revision',async()=>{
  const f=fixture();f.store.docs.set('syllabus/icse-digestive',{id:'icse-digestive',board:'ICSE',standard:'9',subject:'Biology',chapter:'Digestive system'});
  f.store.docs.set('syllabus/icse-other',{id:'icse-other',board:'ICSE',standard:'9',subject:'Biology',chapter:'Respiration'});
  const t=await turn(f,null,'Create question paper for 9 th ICSE, biology, Digestive system,40 mark');
  const brief=buildTaskBrief(t.job);assert.deepEqual(brief.requirements.selectedChapters,['Digestive system']);
  const r={...defaults,...brief.requirements,internalChoices:false};
  await assert.rejects(()=>f.service.delegate(f.w,t.job.id,{leaseId:t.job.leaseId,operation:'generate_paper',requirements:{...r,scope:'full_syllabus',selectedChapters:undefined}}),/cannot be widened/);
  await f.service.delegate(f.w,t.job.id,{leaseId:t.job.leaseId,operation:'generate_paper',requirements:r,rootRequestMessageId:t.job.request.id,interpretation:'Synthetic scope verification',proposedActions:['generate_paper']});
  const p=(await f.service.claim(f.w,{kind:'paper'})).job;assert.deepEqual(p.curriculumSnapshot.chapters.map(c=>c.title),['Digestive system']);assert.equal(p.rootRequest.text,t.job.request.text);assert.equal(p.request.text,t.job.request.text);
  const output=paper(r,p.curriculumSnapshot);output.sections[0].questions=Array.from({length:10},(_,i)=>({...output.sections[0].questions[0],number:i+1,marks:4,question:'SYNTHETIC question '+i}));
  const delivered=await f.service.complete(f.w,p.id,{leaseId:p.leaseId,paper:output,reply:'Synthetic reviewed fixture only.'});
  const old=await f.store.get('assistantPapers/'+delivered.paperId);assert.equal(old.requirements.scope,'selected_chapters');
  const next=await turn(f,t.cid,'Revise question 1 to be harder.');await f.service.delegate(f.w,next.job.id,{leaseId:next.job.leaseId,operation:'revise_paper',requirements:r,basePaperId:old.id,targetQuestionNumber:1,interpretation:'Synthetic revision',proposedActions:['revise_paper']});
  const revision=(await f.service.claim(f.w,{kind:'paper'})).job;const revised=structuredClone(output);revised.sections[0].questions[0].question='SYNTHETIC harder question';
  await f.service.complete(f.w,revision.id,{leaseId:revision.leaseId,paper:revised,reply:'Synthetic revision only.'});assert.deepEqual(await f.store.get('assistantPapers/'+old.id),old);
});

test('curriculum offer is saved only after independent unavailability and cannot silently delegate',async()=>{
  const f=fixture();const t=await turn(f,null,'Create Class 9 ICSE Biology paper, Digestive system, 40 marks');
  await f.service.complete(f.w,t.job.id,{leaseId:t.job.leaseId,reply:'Shall I check it online?',curriculumOffer:true});
  const c=await f.store.get('assistantConversations/'+t.cid);assert.equal(c.taskBrief.pendingClarification.field,'curriculum');assert.deepEqual(c.taskBrief.requirements.selectedChapters,['Digestive system']);
  assert.equal((await f.service.claim(f.w,{kind:'paper'})).job,null);
  const available=await turn(f,null,'Create CBSE Class 10 Science paper, 20 marks');await f.service.complete(f.w,available.job.id,{leaseId:available.job.leaseId,reply:'Forged offer',curriculumOffer:true});
  assert.equal((await f.store.get('assistantConversations/'+available.cid)).taskBrief.pendingClarification,null);
});

test('brief evidence outside the recent 100 messages remains in the worker handoff',async()=>{
  const f=fixture(),t=await turn(f,null,'Create CBSE Class 10 Science paper, 20 marks. Chapters: Chapter 1.');
  await f.service.complete(f.w,t.job.id,{leaseId:t.job.leaseId,reply:'Saved.'});
  const original=t.job.request;
  for(let i=0;i<105;i++){const id='padding-'+i;f.store.docs.set(`assistantConversations/${t.cid}/messages/${id}`,{id,conversationId:t.cid,role:'assistant',text:'Synthetic padding',createdAt:'2026-10-27T00:00:00Z'});}
  const next=await turn(f,t.cid,'All topics.');assert(next.job.history.some(m=>m.id===original.id));assert.deepEqual(buildTaskBrief(next.job).requirements.selectedChapters,['Chapter 1']);
});
const delegate=(f,t,operation='generate_paper',requirements={...defaults,...scope,marks:10,internalChoices:false})=>f.service.delegate(f.w,t.job.id,{leaseId:t.job.leaseId,operation,requirements,interpretation:'Synthetic test only',proposedActions:[operation]});
test('all configured board/class scopes 5–12 validate against their own pinned chapters; cross-scope output fails',()=>{let count=0;for(const board of boards)for(const standard of board.standards){const r=validateRequirements({...defaults,board:board.name,standard:String(standard),subject:'Science',marks:10,internalChoices:false});const c=savedCurriculum(r,rows.map(x=>({...x,board:r.board,standard:r.standard})));assert.equal(validatePaper(paper(r,c),r,c).attemptedMarks,10);assert.throws(()=>validatePaper(paper(r,c),{...r,standard:'4'},c));count++;}assert(count>=40);const r={...defaults,...scope,marks:10,internalChoices:false},c=savedCurriculum(r,rows);const html=renderPaper({...paper(r,c),curriculumSnapshot:c,requirements:r});assert(html.includes('Class 10'));assert(!html.includes('PRIVATE answer'));assert(!html.includes('official completeness'));assert(!/<p class="notice">/.test(html));assert(c.provenance.records.includes('saved-1'));assert.equal(savedCurriculum({...r,marks:80},rows).id,c.id);});
test('programme variants are not silently reused and unavailable programmes clarify',()=>{assert(!sameScope({...scope,level:'HL'},{...scope,level:'SL'}));assert.throws(()=>validateScope({...scope,board:'ICSE',standard:'12'}),/ISC/);assert.throws(()=>validateCurriculumScope({...scope,board:'IB'}),/programme/);assert.throws(()=>validateCurriculumScope({...scope,board:'Cambridge IGCSE'}),/code/);const index=catalogueIndex([{...rows[0],subject:'Math'}]);assert.equal(extractScope('CBSE Class 10 Maths in English',index).subject,'Math');assert.equal(extractScope('कक्षा ५ Science',{},{board:'CBSE'}).standard,'5');});
test('official check validates exact scope, variants, sources, year and independently retrieved bytes',()=>{const v=candidate();assert.equal(researchCurriculum(v,scope,proofs).provenance.centralCatalogueApproval,false);for(const change of [{sources:[]},{chapters:[]},{level:'HL'},{standard:'9'},{sources:[{...v.sources[0],url:'https://evil.example/cbse.pdf'}]},{sources:[{...v.sources[0],applicableYear:'2024-25'}]}])assert.throws(()=>researchCurriculum({...v,...change},scope,proofs));assert.throws(()=>researchCurriculum(v,scope,[]),/proof/);assert.throws(()=>researchCurriculum(v,scope,[{...proofs[0],finalUrl:'http://127.0.0.1/secret'}]));assert.throws(()=>validateResearchCandidate({...v,sources:Array(4).fill(v.sources[0])},scope),/1–3/);});

test('CISCE junior years accept their two-year exam cohort without weakening other years or boards',()=>{
  const r={...scope,board:'ICSE',standard:'9',subject:'Physics'};
  const v=candidate(r);v.sources=[{url:'https://cisce.org/wp-content/uploads/2026/01/10.-Physics.pdf',title:'Physics 2028',applicableYear:'2026-27 Class IX; ICSE examination cohort 2028',locator:'Class IX, section 6'},{url:'https://cisce.org/wp-content/uploads/2026/01/1.-Regulations.pdf',title:'Regulations 2028',applicableYear:'ICSE examination cohort 2028',locator:'Chapter I, two-year course'}];
  assert.equal(validateResearchCandidate(v,r).academicYear,'2026-27');
  const explicit={...r,examYear:'2027'};assert.throws(()=>validateResearchCandidate({...v,examYear:'2027'},explicit),/year/);
  const senior={...r,standard:'10'};assert.throws(()=>validateResearchCandidate({...v,standard:'10'},senior),/year/);
  assert.throws(()=>validateResearchCandidate({...v,sources:v.sources.map(s=>({...s,applicableYear:'2024'}))},r),/year/);
  const isc={...r,board:'ISC',standard:'11'};assert(validateResearchCandidate({...v,board:'ISC',standard:'11'},isc));
});
test('official retrieval rejects external redirects, bad status, empty/oversized sources; records hashes of bounded real bytes',async()=>{let calls=0;const fetcher=async()=>{calls++;return new Response('source fixture',{headers:{'Content-Type':'text/plain'}});};const p=await retrieveOfficialSource(candidate().sources[0],'CBSE',fetcher);assert.equal(calls,1);assert.equal(p.bytes,14);assert.equal(p.sha256.length,64);await assert.rejects(()=>retrieveOfficialSource(candidate().sources[0],'CBSE',async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/secret'}})),/official HTTPS/);await assert.rejects(()=>retrieveOfficialSource(candidate().sources[0],'CBSE',async()=>new Response('',{status:403})),/403/);await assert.rejects(()=>retrieveOfficialSource(candidate().sources[0],'CBSE',async()=>new Response('')),/empty/);await assert.rejects(()=>retrieveOfficialSource(candidate().sources[0],'CBSE',async()=>new Response(new Uint8Array(12_000_001))),/12 MB/);});
test('curriculum check uses a separate leased slot, preserves running paper, selects new snapshot only for future work',async()=>{const f=fixture(),t=await turn(f,null,'Create CBSE Class 10 Science paper');await delegate(f,t);const p=(await f.service.claim(f.w,{kind:'paper'})).job;const t2=await turn(f,t.cid,'Check latest official syllabus');await delegate(f,t2,'check_curriculum');assert.equal((await f.store.get('assistantJobs/'+p.id)).state,'running');const check=(await f.service.claim(f.w,{kind:'paper'})).job;assert.equal(check.kind,'curriculum');const completed=await f.service.complete(f.w,check.id,{leaseId:check.leaseId,research:candidate(),sourceProofs:proofs,reply:'Checked synthetic source.'});assert(completed.active);const selected=await f.service.resolveCurriculum(scope,t.cid,f.w);assert.equal(selected.chapters[0].title,'Chapter one');assert.equal((await f.store.get('assistantJobs/'+p.id)).curriculumSnapshot.chapters.length,10);const next=await turn(f,t.cid,'Which chapters?');assert.equal(next.job.context.curriculum.id,selected.id);await assert.rejects(()=>f.service.resolveCurriculum(scope,t.cid,{allowedOwnerUids:['other']}),/unavailable/);const other=await f.service.createConversation('owner',{});assert.notEqual((await f.service.resolveCurriculum(scope,other.conversation.id,f.w)).id,selected.id);});
test('no saved coverage, impossible mark totals and malformed research cannot activate or launch a paper',async()=>{const f=fixture();await assert.rejects(()=>f.service.resolveCurriculum({...scope,subject:'Unknown'}),/no saved/);const t=await turn(f,null,'create');await assert.rejects(()=>delegate(f,t,'generate_paper',{...defaults,...scope,marks:10,internalChoices:false,subject:'Unknown'}),/no saved/);for(let i=10;i<15;i++)await f.store.transaction(tx=>tx.set('syllabus/more-'+i,{...scope,chapter:'Extra '+i}));await assert.rejects(()=>delegate(f,t),/at least/);await delegate(f,t,'check_curriculum');const check=(await f.service.claim(f.w,{kind:'paper'})).job;await assert.rejects(()=>f.service.complete(f.w,check.id,{leaseId:check.leaseId,research:{...candidate(),board:'ICSE'},sourceProofs:proofs,reply:'bad'}),/scope/);assert.equal((await f.store.list('assistantCurricula')).length,0);assert((await f.service.complete(f.w,check.id,{leaseId:check.leaseId,researchUnavailable:true,reply:'Please clarify the edition.'})).active);assert.equal((await f.store.list('assistantCurricula')).length,0);});

test('variant-bearing revision retains exact pinned identity; unqualified saved chapters cannot be relabelled SL/HL',()=>{const r={...defaults,...scope,marks:10,internalChoices:false},c=savedCurriculum(r,rows);const variant={...r,programme:'DP',level:'HL',board:'IB',standard:'11'};assert.throws(()=>savedCurriculum(variant,rows.map(x=>({...x,board:'IB',standard:'11'}))),/no verified/);assert.throws(()=>validateCurriculumScope({...variant,level:'EXTENDED'}),/SL or HL/);const checked={...c,...variant,id:'synthetic-checked-IB-HL'},base={...paper(variant,checked),requirements:variant,curriculumSnapshot:checked};const revised=structuredClone(base);revised.sections[0].questions[0].question='SYNTHETIC revised question';assert(validateRevision(base,revised,1,checked).passed);assert(validateRevision(base,revised,null,checked).passed);});

test('rejected scope mentions never win over explicit corrections',()=>{assert.equal(extractScope('Not HL, please use SL.',{},{}).level,'SL');assert.equal(extractScope('Not Core; use Extended.',{},{}).level,'EXTENDED');assert.equal(extractScope('I do not want CBSE; use ICSE Class 10 Science instead.',{},{}).board,'ICSE');assert.equal(extractScope('Not Class 12. Create Class 10 Science.',{},{}).standard,'10');assert.equal(extractScope('CBSE or ICSE Class 10 Science',{},{}).board,'');});

test('conversation language requests never switch the selected school subject',()=>{for(const text of ['Paper mein kaun se chapters cover honge? Hindi mein samjhao, aur actual progress batao.','Hindi mein bolo','हिंदी में समझाइए','Please explain in Hindi'])assert.equal(extractScope(text,{},scope).subject,'Science',text);assert.equal(extractScope('Create CBSE Class 10 Hindi paper',{},{}).subject,'Hindi');});

test('a successful prerequisite check resumes exactly one requested paper turn; chapter proof never becomes full-subject proof',async()=>{
  const f=fixture(),t=await turn(f,null,'Create CBSE Class 10 Science 20 marks paper. Chapters: Chapter one.');
  const r={...defaults,...buildTaskBrief(t.job).requirements,internalChoices:false};
  await f.service.delegate(f.w,t.job.id,{leaseId:t.job.leaseId,operation:'check_curriculum',requirements:r,rootRequestMessageId:t.job.request.id,interpretation:'Check the selected chapter then create the paper',proposedActions:['check_curriculum','generate_paper']});
  const check=(await f.service.claim(f.w,{kind:'paper'})).job;
  const body={leaseId:check.leaseId,research:candidate(),sourceProofs:proofs,reply:'Synthetic checked source.'};
  assert((await f.service.complete(f.w,check.id,body)).active);
  assert.equal((await f.service.complete(f.w,check.id,body)).active,false);
  const resumed=(await f.service.claim(f.w,{kind:'turn'})).job;assert(resumed);assert.equal(resumed.request.text,t.job.request.text);assert.deepEqual(buildTaskBrief(resumed).requirements.selectedChapters,['Chapter one']);
  assert.equal((await f.service.claim(f.w,{kind:'turn'})).job,null);
  await assert.rejects(()=>f.service.resolveCurriculum({...r,scope:'full_syllabus',selectedChapters:undefined},t.cid,f.w),/only covers/);
});
test('a newer user pause or correction prevents check completion from resuming a paper',async()=>{
  for(const later of ['Do not create the paper yet.','Use different chapters instead.']){
    const f=fixture(),t=await turn(f,null,'Create CBSE Class 10 Science 20 marks paper. Chapters: Chapter one.');const r={...defaults,...buildTaskBrief(t.job).requirements,internalChoices:false};
    await f.service.delegate(f.w,t.job.id,{leaseId:t.job.leaseId,operation:'check_curriculum',requirements:r,interpretation:'Synthetic check',proposedActions:['check_curriculum']});const check=(await f.service.claim(f.w,{kind:'paper'})).job;
    await f.service.submit('owner',t.cid,{text:later,clientMessageId:'newer'});await f.service.complete(f.w,check.id,{leaseId:check.leaseId,research:candidate(),sourceProofs:proofs,reply:'Synthetic checked source.'});
    assert.equal((await f.store.list('assistantJobs',[],100)).filter(j=>j.resumedFromCurriculumJobId===check.id).length,0);
  }
});
test('IB Mathematics course is explicit and conflicting or missing courses cannot be assumed',()=>{
  const r={...scope,board:'IB',standard:'11',subject:'Mathematics',programme:'DP',level:'SL'};
  assert.throws(()=>validateCurriculumScope(r),/Analysis and Approaches/);
  assert.equal(extractScope('IB Class 11 Mathematics AA SL').subjectCode,'AA');assert.equal(extractScope('IB Class 11 Mathematics applications and interpretation HL').subjectCode,'AI');
  assert(validateCurriculumScope({...r,subjectCode:'AA'}));
});
test('a new message cancels a queued automatic continuation before it can reach Codex',async()=>{
  const f=fixture(),t=await turn(f,null,'Create CBSE Class 10 Science 20 marks paper. Chapters: Chapter one.');
  const r={...defaults,...buildTaskBrief(t.job).requirements,internalChoices:false};
  await f.service.delegate(f.w,t.job.id,{leaseId:t.job.leaseId,operation:'check_curriculum',requirements:r,interpretation:'Synthetic check',proposedActions:['check_curriculum']});const check=(await f.service.claim(f.w,{kind:'paper'})).job;
  await f.service.complete(f.w,check.id,{leaseId:check.leaseId,research:candidate(),sourceProofs:proofs,reply:'Synthetic checked source.'});
  await f.service.submit('owner',t.cid,{text:'Wait, do not create it yet.',clientMessageId:'pause-after-check'});
  const continuation=await f.store.get('assistantJobs/resume-'+check.id);assert.equal(continuation.state,'cancelled');assert.equal(continuation.phase,'superseded_by_new_message');
});
