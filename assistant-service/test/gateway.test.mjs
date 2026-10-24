import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AssistantService} from '../service.mjs';
import {MemoryStore} from '../store.mjs';
import {createGateway} from '../gateway.mjs';
import * as realDomain from '../domain/index.mjs';

const secret='synthetic-emulator-bootstrap-secret-0123456789';
const workerClaims={uid:'assistant-worker-test',assistantWorker:true,workerId:'test'};
const requirements={board:'CBSE',standard:'12',subject:'Chemistry',marks:80,sourcePolicy:'original'};
function fixture(domainApi=null){
  let clock=Date.parse('2026-10-24T09:00:00.000Z'),count=0;
  const store=new MemoryStore({'users/admin':{role:'admin'},'users/other':{role:'admin'},'users/learner':{role:'user'},'assistantConfig/pilot':{allowedOwnerUids:['admin','other']},'assistantWorkers/test':{enabled:true,allowedOwnerUids:['admin'],bootstrapSecretSha256:createHash('sha256').update(secret).digest('hex')}});
  const api={defaults:requirements,curriculum:{id:'synthetic-test-curriculum'},paperContent:p=>p,validateRequirements:r=>{if(r.sourcePolicy!=='original')throw Error('No bank connector');return r;},validatePaper:p=>{if(p.marks!==80)throw Error('Wrong marks');return {valid:true};},validateRevision:(base,p,n)=>{if(p.target!==n)throw Error('Invalid revision');},renderPaper:(p,answers)=>answers?'<html>worked answer</html>':'<html>student question</html>'};
  const service=new AssistantService(store,{now:()=>new Date(clock),id:()=>`fixture-${++count}`,domainApi:domainApi || api,signer:async(uid,claims)=>JSON.stringify({uid,claims})});
  const route=createGateway(service,async token=>{if(token==='worker')return workerClaims;if(token==='invalid')throw Error('Invalid');return {uid:token,email:token+'@example.test'};});
  const request=(method,path,body={},token='admin')=>route({method,path,body,headers:token?{authorization:'Bearer '+token}:{}});
  return {store,service,request,advance:seconds=>clock+=seconds*1000};
}
async function turn(f,text='Create a full syllabus paper, please.'){const {body:c}=await f.request('POST','/conversations');const {body:r}=await f.request('POST',`/conversations/${c.conversation.id}/messages`,{text,clientMessageId:'message-one'});const claim=await f.request('POST','/worker/claim',{kind:'turn'},'worker');return {cid:c.conversation.id,mid:r.message.id,job:claim.body.job};}
async function paper(f){const t=await turn(f);const {body:d}=await f.request('POST',`/worker/jobs/${t.job.id}/delegate`,{leaseId:t.job.leaseId,operation:'generate_paper',requirements,interpretation:'Synthetic test interpretation',proposedActions:['generate']},'worker');assert.equal(d.job.kind,'paper');const {body:claimed}=await f.request('POST','/worker/claim',{kind:'paper'},'worker');return {...t,job:claimed.job};}

test('anonymous, learner, non-invited and forged-worker identities are denied',async()=>{const f=fixture();assert.equal((await f.request('GET','/session',{},null)).status,401);assert.equal((await f.request('GET','/session',{},'learner')).status,403);assert.equal((await f.request('GET','/session',{},'stranger')).status,403);assert.equal((await f.request('POST','/worker/claim',{kind:'turn'})).status,403);assert.equal((await f.request('GET','/session',{},'worker')).status,401);assert.equal((await f.request('GET','/session',{},'invalid')).status,401);});
test('worker exchange validates hash, returns scoped token, never leaks stored secret',async()=>{const f=fixture();const bad=await f.request('POST','/worker/session',{workerId:'test',secret:secret+'wrong'},null);assert.equal(bad.status,401);const good=await f.request('POST','/worker/session',{workerId:'test',secret},null);assert.equal(good.status,200);assert.deepEqual(JSON.parse(good.body.customToken),{uid:'assistant-worker-test',claims:{assistantWorker:true,workerId:'test'}});assert.equal((await f.request('GET','/session')).body.worker.state,'offline');});
test('durable submission is idempotent, keeps verbatim Unicode, rejects key reuse',async()=>{const f=fixture(),t=await turn(f,'हिंदी में समझाइए — 80 marks, “पूरा syllabus”.');const same=await f.request('POST',`/conversations/${t.cid}/messages`,{text:t.job.request.text,clientMessageId:'message-one'});assert.equal(same.body.message.id,t.mid);assert.equal(t.job.request.sha256Utf8,createHash('sha256').update(t.job.request.text).digest('hex'));assert.equal((await f.request('POST',`/conversations/${t.cid}/messages`,{text:'changed',clientMessageId:'message-one'})).status,409);assert.equal((await f.request('GET',`/conversations/${t.cid}`,{},'other')).status,404);assert.equal(t.job.controllerFacts.permissions.deployment,false);assert.equal(t.job.rootRequest.text,t.job.request.text);});
test('atomic claim chooses exactly one worker; user views omit leases/internal proposals',async()=>{const f=fixture();const {body:c}=await f.request('POST','/conversations');await f.request('POST',`/conversations/${c.conversation.id}/messages`,{text:'Hello',clientMessageId:'one'});const [a,b]=await Promise.all([f.request('POST','/worker/claim',{kind:'turn'},'worker'),f.request('POST','/worker/claim',{kind:'turn'},'worker')]);assert.equal([a,b].filter(x=>x.body.job).length,1);const view=await f.request('GET',`/conversations/${c.conversation.id}`);assert(!JSON.stringify(view).includes('leaseId'));assert(!JSON.stringify(view).includes('bootstrapSecret'));});
test('cancellation and expired leases refuse completion; explicit retry creates one new task',async()=>{const f=fixture(),p=await paper(f);f.advance(121);assert.equal((await f.request('POST',`/worker/jobs/${p.job.id}/complete`,{leaseId:p.job.leaseId,paper:{marks:80}},'worker')).body.active,false);const view=await f.request('GET',`/conversations/${p.cid}`);assert.equal(view.body.jobs.find(j=>j.id===p.job.id).state,'failed');const a=await f.request('POST',`/jobs/${p.job.id}/retry`),b=await f.request('POST',`/jobs/${p.job.id}/retry`);assert.equal(a.body.job.id,b.body.job.id);const claimed=await f.request('POST','/worker/claim',{kind:'paper'},'worker');await f.request('POST',`/jobs/${claimed.body.job.id}/cancel`);assert.equal((await f.request('POST',`/worker/jobs/${claimed.body.job.id}/complete`,{leaseId:claimed.body.job.leaseId,paper:{marks:80}},'worker')).body.active,false);});
test('paper completion independently validates, atomically publishes private separate HTML',async()=>{const f=fixture(),p=await paper(f);assert.equal((await f.request('POST',`/worker/jobs/${p.job.id}/complete`,{leaseId:p.job.leaseId,paper:{marks:60}},'worker')).status,400);const result=await f.request('POST',`/worker/jobs/${p.job.id}/complete`,{leaseId:p.job.leaseId,paper:{title:'Synthetic fixture',marks:80}},'worker');assert(result.body.paperId);const student=await f.request('GET',`/papers/${result.body.paperId}/artifact/student`);assert.equal(student.body,'<html>student question</html>');assert.equal((await f.request('GET',`/papers/${result.body.paperId}/artifact/answers`)).body,'<html>worked answer</html>');assert.equal((await f.request('GET',`/papers/${result.body.paperId}`,{},'other')).status,404);assert.equal((await f.request('POST',`/worker/jobs/${p.job.id}/complete`,{leaseId:p.job.leaseId,paper:{marks:80}},'worker')).body.active,false);});
test('worker owner boundary and owner revocation apply to in-flight completion',async()=>{const f=fixture();const {body:c}=await f.request('POST','/conversations',{},'other');await f.request('POST',`/conversations/${c.conversation.id}/messages`,{text:'Other owner',clientMessageId:'one'},'other');assert.equal((await f.request('POST','/worker/claim',{kind:'turn'},'worker')).body.job,null);const t=await turn(f);await f.store.transaction(tx=>tx.set('assistantConfig/pilot',{allowedOwnerUids:['other']}));assert.equal((await f.request('POST',`/worker/jobs/${t.job.id}/complete`,{leaseId:t.job.leaseId,reply:'Unauthorized after revocation'},'worker')).body.active,false);});
test('model cannot approve development, publish from turn or invent persistent preference',async()=>{const f=fixture(),t=await turn(f);assert.equal((await f.request('POST',`/worker/jobs/${t.job.id}/delegate`,{leaseId:t.job.leaseId,operation:'deploy',requirements},'worker')).status,400);assert.equal((await f.request('POST',`/worker/jobs/${t.job.id}/complete`,{leaseId:t.job.leaseId,paper:{marks:80},reply:'done'},'worker')).status,400);assert.equal((await f.request('POST',`/worker/jobs/${t.job.id}/complete`,{leaseId:t.job.leaseId,reply:'hello',memoryPatch:{preferences:[{value:'ICSE grade 6',sourceMessageId:t.mid}]}},'worker')).status,400);assert.equal((await f.request('POST',`/worker/jobs/${t.job.id}/event`,{leaseId:t.job.leaseId,state:'completed'},'worker')).status,400);});
test('cross-owner feedback and untrusted browser origins fail',async()=>{const f=fixture(),t=await turn(f);assert.equal((await f.request('POST','/feedback',{conversationId:t.cid,rating:'helpful'},'other')).status,404);assert.equal((await f.request('POST','/feedback',{conversationId:t.cid,rating:'helpful',text:'Actual fixture feedback'})).body.saved,true);const route=createGateway(f.service,async()=>({uid:'admin'}));assert.equal((await route({method:'GET',path:'/session',headers:{origin:'https://evil.example',authorization:'Bearer admin'}})).status,403);});
test('real Chemistry domain rejects incomplete publication and delivers separate immutable validated artifacts',async()=>{
  const f=fixture(realDomain),p=await paper(f);
  const synthetic={...realDomain.defaults,title:'Synthetic structural fixture — not academic content',instructions:['Attempt all questions. Choose one alternative where provided.'],sections:[{title:'Synthetic full-syllabus section',questions:realDomain.curriculum.chapters.map((chapter,index)=>({number:index+1,chapter:chapter.title,type:'long_answer',marks:8,question:`Synthetic structural question ${index+1}: $\\ce{H2 + Cl2 -> 2HCl}$.`,options:[],correctIndex:null,answer:'PRIVATE ANSWER '+index,markingPoints:['PRIVATE MARKING '+index],alternative:index===0?{question:'Synthetic alternative',options:[],correctIndex:null,answer:'PRIVATE ALT',markingPoints:['PRIVATE ALT MARKING']}:null}))}],sourceReferences:[{id:realDomain.curriculum.id,url:realDomain.curriculum.url,title:realDomain.curriculum.title}]};
  synthetic.sections[0].instructions='';
  const incomplete=structuredClone(synthetic);incomplete.sections[0].questions[0].marks=7;
  assert.equal((await f.request('POST',`/worker/jobs/${p.job.id}/complete`,{leaseId:p.job.leaseId,paper:incomplete},'worker')).status,400);
  assert.equal((await f.store.list('assistantPapers')).length,0);
  const completed=await f.request('POST',`/worker/jobs/${p.job.id}/complete`,{leaseId:p.job.leaseId,paper:synthetic},'worker');assert.equal(completed.status,200);
  const paperId=completed.body.paperId, student=await f.request('GET',`/papers/${paperId}/artifact/student`),answers=await f.request('GET',`/papers/${paperId}/artifact/answers`);
  assert(!student.body.includes('PRIVATE ANSWER'));assert(!student.body.includes('PRIVATE MARKING'));assert(answers.body.includes('PRIVATE ANSWER'));assert(student.body.includes('data:font/woff2;base64,'));assert(student.headers['Content-Security-Policy'].includes("font-src 'self' data:"));
  const {body:view}=await f.request('GET',`/papers/${paperId}`);assert.equal(view.paper.validation.attemptedMarks,80);assert.equal(view.paper.validation.academicApproval,false);assert.equal(view.paper.revision,1);
});
test('paper root survives a greeting and whole-paper revision; owned latest context carries verified requirements',async()=>{
  const f=fixture(),{body:created}=await f.request('POST','/conversations'),cid=created.conversation.id;
  await f.request('POST',`/conversations/${cid}/messages`,{text:'Hello, Aparna here.',clientMessageId:'greeting'});
  let claim=(await f.request('POST','/worker/claim',{kind:'turn'},'worker')).body.job;
  await f.request('POST',`/worker/jobs/${claim.id}/complete`,{leaseId:claim.leaseId,reply:'Hello!'},'worker');f.advance(1);
  const original='Please create my original full-syllabus Chemistry paper.';
  const firstRequest=await f.request('POST',`/conversations/${cid}/messages`,{text:original,clientMessageId:'paper-request'});
  claim=(await f.request('POST','/worker/claim',{kind:'turn'},'worker')).body.job;
  await f.request('POST',`/worker/jobs/${claim.id}/complete`,{leaseId:claim.leaseId,reply:'Which paper language do you prefer?'},'worker');f.advance(1);
  await f.request('POST',`/conversations/${cid}/messages`,{text:'English, please.',clientMessageId:'paper-clarification'});
  claim=(await f.request('POST','/worker/claim',{kind:'turn'},'worker')).body.job;
  const wrongRoot=await f.request('POST',`/worker/jobs/${claim.id}/delegate`,{leaseId:claim.leaseId,operation:'generate_paper',requirements,interpretation:'Create original paper',proposedActions:['generate'],rootRequestMessageId:'foreign-conversation-message'},'worker');assert.equal(wrongRoot.status,400);
  const delegated=await f.request('POST',`/worker/jobs/${claim.id}/delegate`,{leaseId:claim.leaseId,operation:'generate_paper',requirements,interpretation:'Create original paper',proposedActions:['generate'],rootRequestMessageId:firstRequest.body.message.id},'worker');
  assert.equal(delegated.body.job.rootRequest.text,original);
  claim=(await f.request('POST','/worker/claim',{kind:'paper'},'worker')).body.job;
  const published=await f.request('POST',`/worker/jobs/${claim.id}/complete`,{leaseId:claim.leaseId,paper:{title:'Synthetic original',marks:80}},'worker');const paperId=published.body.paperId;f.advance(1);
  await f.request('POST',`/conversations/${cid}/messages`,{text:'Make the whole paper harder.',clientMessageId:'whole-revision'});
  claim=(await f.request('POST','/worker/claim',{kind:'turn'},'worker')).body.job;
  assert.equal(claim.context.latestPaper.id,paperId);assert.deepEqual(claim.context.activeRequirements,requirements);assert.equal(claim.rootRequest.text,original);
  const revised=await f.request('POST',`/worker/jobs/${claim.id}/delegate`,{leaseId:claim.leaseId,operation:'revise_paper',requirements,interpretation:'Whole-paper revision',proposedActions:['revise'],basePaperId:paperId,targetQuestionNumber:null},'worker');
  assert.equal(revised.status,200);assert.equal(revised.body.job.targetQuestionNumber,null);assert.equal(revised.body.job.rootRequest.text,original);
  claim=(await f.request('POST','/worker/claim',{kind:'paper'},'worker')).body.job;
  assert.equal(claim.operation,'revise_paper');assert.equal(claim.targetQuestionNumber,null);
  const result=await f.request('POST',`/worker/jobs/${claim.id}/complete`,{leaseId:claim.leaseId,paper:{title:'Synthetic harder revision',marks:80,target:null}},'worker');assert.equal(result.status,200);
  const first=(await f.request('GET',`/papers/${paperId}`)).body.paper,next=(await f.request('GET',`/papers/${result.body.paperId}`)).body.paper;
  assert.equal(first.title,'Synthetic original');assert.equal(next.parentPaperId,paperId);assert.equal(next.revision,2);assert.equal(next.rootRequestMessageId,first.rootRequestMessageId);
});
test('math-rich HTML is gzip-stored privately with raw SHA verification and corruption fails closed',async()=>{
  const f=fixture(),p=await paper(f);
  // Synthetic serialized-maths markup, not educational acceptance evidence.
  const html='<!doctype html><html><body>'+('<span class="katex"><math><mfrac><mi>n</mi><mi>V</mi></mfrac></math><span aria-hidden="true">\\frac{n}{V}</span></span>'.repeat(12000))+'</body></html>';
  assert(Buffer.byteLength(html)>850000);assert(Buffer.byteLength(html)<4_000_000);
  f.service.domain.renderPaper=()=>html;
  const result=await f.request('POST',`/worker/jobs/${p.job.id}/complete`,{leaseId:p.job.leaseId,paper:{marks:80,title:'Synthetic math-rich fixture'}},'worker');assert.equal(result.status,200);
  const path=`assistantPapers/${result.body.paperId}/artifacts/student`,stored=await f.store.get(path);
  assert.equal(stored.encoding,'gzip-base64');assert.equal(stored.rawBytes,Buffer.byteLength(html));assert.equal(stored.sha256,createHash('sha256').update(html).digest('hex'));assert(Buffer.byteLength(stored.content)<850000);assert(!Object.hasOwn(stored,'html'));
  const received=await f.request('GET',`/papers/${result.body.paperId}/artifact/student`);assert.equal(received.status,200);assert.equal(received.body,html);
  await f.store.transaction(tx=>tx.set(path,{...stored,sha256:'0'.repeat(64)}));
  const corrupted=await f.request('GET',`/papers/${result.body.paperId}/artifact/student`);assert.equal(corrupted.status,500);assert.equal(corrupted.body.error.code,'artifact_integrity_failed');assert(!JSON.stringify(corrupted.body).includes('<math>'));
});
test('actual failure contract accepts a string and explicit retry privately preserves operation and retry source',async()=>{
  const f=fixture(),p=await paper(f);
  assert.equal((await f.request('POST',`/worker/jobs/${p.job.id}/fail`,{leaseId:p.job.leaseId,error:{message:'Object is not the contract'}},'worker')).status,400);
  const failed=await f.request('POST',`/worker/jobs/${p.job.id}/fail`,{leaseId:p.job.leaseId,error:'Synthetic delivery failure after validated generation',retryable:true},'worker');assert.equal(failed.status,200);assert.equal(failed.body.active,true);
  const retry=await f.request('POST',`/jobs/${p.job.id}/retry`);assert.equal(retry.status,200);
  const claim=(await f.request('POST','/worker/claim',{kind:'paper'},'worker')).body.job;
  assert.equal(claim.retryOf,p.job.id);assert.equal(claim.operation,'generate_paper');assert.equal(claim.request.sha256Utf8,p.job.request.sha256Utf8);assert.equal(claim.rootRequest.sha256Utf8,p.job.rootRequest.sha256Utf8);
  const view=await f.request('GET',`/conversations/${p.cid}`);assert(!view.body.jobs.some(job=>Object.hasOwn(job,'retryOf')));
});
test('explicit quoted preferences merge without importing legacy user profile or losing previous preference',async()=>{
  const f=fixture(),t=await turn(f,'Remember that I prefer Hindi explanations.');
  await f.request('POST',`/worker/jobs/${t.job.id}/complete`,{leaseId:t.job.leaseId,reply:'I will use Hindi.',memoryPatch:{preferences:[{value:'I prefer Hindi explanations.',sourceMessageId:t.mid}]}},'worker');
  f.advance(1);const second=await f.request('POST',`/conversations/${t.cid}/messages`,{text:'Also remember: use worked examples.',clientMessageId:'second-memory'});
  const claimed=(await f.request('POST','/worker/claim',{kind:'turn'},'worker')).body.job;
  await f.request('POST',`/worker/jobs/${claimed.id}/complete`,{leaseId:claimed.leaseId,reply:'I will use worked examples.',memoryPatch:{preferences:[{value:'use worked examples.',sourceMessageId:second.body.message.id}]}},'worker');
  await f.store.transaction(tx=>tx.set('users/admin',{role:'admin',displayName:'Synthetic Aparna',board:'ICSE',grade:'6',unrelatedHistory:['private legacy laboratory task']}));
  f.advance(1);await f.request('POST',`/conversations/${t.cid}/messages`,{text:'Continue, please.',clientMessageId:'after-memory'});
  const next=(await f.request('POST','/worker/claim',{kind:'turn'},'worker')).body.job;
  assert.equal(next.profile.preferences.length,2);assert.equal(next.profile.displayName,'Synthetic Aparna');assert(!JSON.stringify(next.profile).includes('ICSE'));assert(!JSON.stringify(next.profile).includes('laboratory'));assert(!Object.hasOwn(next.profile,'grade'));
});
