import {createHash, randomUUID, timingSafeEqual} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import * as domain from './domain/index.mjs';
import {catalogueIndex,capabilityFacts,savedCurriculum,validateScope,validateCurriculumScope,sameScope,officialUrl} from './domain/catalogue.mjs';
import {researchCurriculum,curriculumResearchSchema} from './domain/research.mjs';
import {buildTaskBrief,missingTaskField,selectedCurriculum} from './domain/task-brief.mjs';
import {ServiceControl} from './service-control.mjs';

export class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const fail = (status, code, message) => { throw new HttpError(status, code, message); };
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const jobSlot=j=>j.kind==='curriculum'?{id:'activeCurriculumJobId',revision:'curriculumRevision'}:{id:'activePaperJobId',revision:'requestRevision'};
const activeStates = new Set(['queued','running','validating']);
const safeId = id => { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) fail(400,'invalid_id','Invalid identifier.'); return id; };
const text = (value, max = 12000) => { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400,'invalid_text',`Text must contain 1–${max} characters.`); return value; };
const clean = value => JSON.parse(JSON.stringify(value));
const publicJob = job => job && clean(Object.fromEntries(['id','kind','ownerUid','conversationId','state','phase','createdAt','updatedAt','startedAt','elapsedSeconds','error','requestRevision','paperId','retryable'].filter(key => job[key] !== undefined).map(key => [key,job[key]])));
const publicConversation = c => c && clean(Object.fromEntries(['id','title','status','updatedAt','activePaperJobId','activeCurriculumJobId','latestPaperId'].filter(key => c[key] !== undefined).map(key => [key,c[key]])));
const summary = p => clean(Object.fromEntries(['id','title','revision','marks','createdAt','jobId','conversationId','ownerUid','board','standard','subject','academicYear'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]])));
const paperConversationTitle=p=>p.board&&p.standard&&p.subject?`${p.board} Class ${p.standard} ${p.subject} · ${p.marks} marks`.slice(0,120):String(p.title||'Question paper').replace(/\s+/g,' ').slice(0,120);
const ref = (collection,id) => `${collection}/${safeId(id)}`;
const messagePath = (cid,id) => `assistantConversations/${safeId(cid)}/messages/${safeId(id)}`;
const bounded = (value, max = 24000) => { const s = JSON.stringify(value ?? null); if (Buffer.byteLength(s) > max) fail(400,'payload_too_large','Payload is too large.'); return clean(value ?? {}); };
const maxRawArtifactBytes=4_000_000,maxCompressedArtifactBytes=850_000;
function encodeArtifact(html,createdAt){
  const raw=Buffer.from(html,'utf8');
  if(raw.length>maxRawArtifactBytes)fail(400,'artifact_too_large','Printable paper exceeds the safe uncompressed artifact size.');
  const content=gzipSync(raw).toString('base64');
  if(Buffer.byteLength(content)>maxCompressedArtifactBytes)fail(400,'artifact_too_large','Printable paper exceeds the safe compressed artifact size.');
  return {encoding:'gzip-base64',content,sha256:hash(html),rawBytes:raw.length,createdAt};
}
function decodeArtifact(doc){
  try{
    const html=doc.encoding==='gzip-base64'?gunzipSync(Buffer.from(doc.content,'base64'),{maxOutputLength:maxRawArtifactBytes}).toString('utf8'):doc.html;
    if(typeof html!=='string' || Buffer.byteLength(html)>maxRawArtifactBytes || (doc.rawBytes!==undefined && Buffer.byteLength(html)!==doc.rawBytes) || hash(html)!==doc.sha256)throw Error('Artifact integrity mismatch');
    return html;
  }catch{fail(500,'artifact_integrity_failed','The stored document failed its integrity check. Please report this task before using the paper.');}
}

export class AssistantService {
  constructor(store, {now = () => new Date(), id = randomUUID, signer = null, sleep = ms => new Promise(r => setTimeout(r,ms)), domainApi = domain} = {}) { Object.assign(this,{store,now,id,signer,sleep,domain:domainApi});this.serviceControl=new ServiceControl(this,fail); }
  iso() { return this.now().toISOString(); }
  async user(claims) {
    if (!claims?.uid || claims.assistantWorker) fail(401,'sign_in_required','Sign in with your Growth Tutorials account.');
    const [profile, config] = await Promise.all([this.store.get(ref('users',claims.uid)),this.store.get('assistantConfig/pilot')]);
    if (profile?.role !== 'admin' || !config?.allowedOwnerUids?.includes(claims.uid)) fail(403,'pilot_access_required','This private pilot is restricted to invited Growth Tutorials administrators.');
    return {uid:claims.uid,displayName:profile.displayName || profile.name || claims.name || '',email:claims.email || profile.email || '',libraryAccess:true};
  }
  async worker(claims) {
    if (claims?.assistantWorker !== true || !claims.workerId || claims.uid !== `assistant-worker-${claims.workerId}`) fail(403,'worker_access_required','A paired assistant worker is required.');
    const worker = await this.store.get(ref('assistantWorkers',claims.workerId));
    if (!worker || worker.enabled !== true || !Array.isArray(worker.allowedOwnerUids)) fail(403,'worker_disabled','Worker pairing is disabled.');
    return {...worker,id:claims.workerId};
  }
  async bootstrap(body) {
    const workerId = safeId(body.workerId), secret = text(body.secret,256);
    if (secret.length < 32) fail(401,'invalid_worker_secret','Worker authentication failed.');
    const worker = await this.store.get(ref('assistantWorkers',workerId));
    const expected = worker?.bootstrapSecretSha256;
    const actual = hash(secret);
    if (worker?.enabled !== true || typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || !timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'))) fail(401,'invalid_worker_secret','Worker authentication failed.');
    if (!this.signer) fail(503,'worker_signer_unavailable','Worker token signing is unavailable.');
    const customToken = await this.signer(`assistant-worker-${workerId}`,{assistantWorker:true,workerId});
    return {customToken};
  }
  async owned(uid, collection, id) {
    const doc = await this.store.get(ref(collection,id));
    if (!doc || doc.ownerUid !== uid) fail(404,'not_found','This item is unavailable.');
    return doc;
  }
  async session(user) {
    const workers = await this.store.list('assistantWorkers', [['enabled','==',true]],20);
    const own = workers.filter(w => w.allowedOwnerUids?.includes(user.uid)).sort((a,b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''))[0];
    const fresh = own && this.now().getTime() - Date.parse(own.lastSeenAt || '') < 90000;
    const service=await this.serviceControl.get(user).catch(error=>{if([403,503].includes(error.status))return null;throw error;});
    return {user,worker:{state:fresh ? own.state || 'loading' : 'offline',lastSeenAt:own?.lastSeenAt || null,modelReady:!!(fresh && own.modelReady)},service,capabilities:capabilityFacts({}),defaults:{marks:80,durationMinutes:180,questionLanguage:'English',answerLanguage:'English'}};
  }
  async curriculumCatalogue(){
    if(this.catalogueCache&&Date.now()-this.catalogueCache.at<21600000)return this.catalogueCache.value;
    const rows=await this.store.list('syllabus',[],5001,{select:['board','standard','subject','chapter']});
    const value=catalogueIndex(rows);this.catalogueCache={at:Date.now(),value};return value;
  }
  async resolveCurriculum(requirements,conversationId=null,worker=null){
    const r=validateScope({...domain.defaults,...requirements});validateCurriculumScope(r);
    if(conversationId){const c=await this.store.get(ref('assistantConversations',conversationId));if(!c||!worker?.allowedOwnerUids?.includes(c.ownerUid))fail(404,'not_found','Conversation unavailable.');
      if(c.latestCurriculumId){const checked=await this.store.get(ref('assistantCurricula',c.latestCurriculumId));if(checked?.ownerUid===c.ownerUid&&checked.conversationId===c.id&&sameScope(checked.curriculum,r)){
        if(checked.curriculum.provenance?.coverage==='selected_chapters'&&r.scope!=='selected_chapters')fail(400,'curriculum_unavailable','The checked curriculum only covers the previously selected chapters.');
        if(r.format==='board'&&!checked.curriculum.paperPattern)fail(400,'curriculum_unavailable','The requested board pattern needs an official-source check.');
        return selectedCurriculum(checked.curriculum,r);
      }}}
    if(r.format==='board')fail(400,'curriculum_unavailable','The requested applicable board pattern needs an official-source check.');
    const key=[r.academicYear,r.board,r.standard,r.subject].map(encodeURIComponent).join('~');
    const release=await this.store.get('curriculumReleases/'+key);
    if(release?.versionId&&!r.programme&&!r.level&&!r.subjectCode&&!r.examYear&&!r.edition){const version=await this.store.get(ref('curriculumVersions',release.versionId));
      if(!version||version.reviewStatus!=='approved'||version.completeness!=='complete'||version.sourceStatus!=='official-source'||!['board','standard','subject','academicYear'].every(k=>version[k]===r[k]))fail(409,'invalid_curriculum_release','The published curriculum needs administrator review.');
      const source=version.sources?.[0];if(!source)fail(409,'missing_source','Published curriculum has no source.');officialUrl(source.url,r.board);
      const chapters=version.chapters.filter(c=>c.assessment!=='formative').map((c,i)=>({id:'chapter-'+(i+1),title:c.title,focus:(c.topics||[]).join('; ')}));
      if(!chapters.length||chapters.length>100)fail(409,'invalid_curriculum','Published chapter coverage is unavailable.');
      return selectedCurriculum({id:'release-'+release.versionId,...r,title:`${r.board} Class ${r.standard} ${r.subject}`,url:source.url,chapters,sources:version.sources,provenance:{kind:'gtop-approved',versionId:release.versionId,yearVerified:true},notice:'Custom Growth Tutorials practice paper using the approved GTOP curriculum. Teacher review required.'},r);
    }
    const rows=await this.store.list('syllabus',[['board','==',r.board],['standard','==',r.standard],['subject','==',r.subject]],401,{includeId:true});
    if(rows.length>400)fail(409,'catalogue_bound','Saved subject exceeds its chapter read bound.');
    try{return selectedCurriculum(savedCurriculum(r,rows),r);}catch(e){fail(400,'curriculum_unavailable',e.message);}
  }
  async conversations(uid) { const rows = await this.store.list('assistantConversations',[['ownerUid','==',uid]],100); return {conversations:rows.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(publicConversation)}; }
  async adminLibrary(uid,body={}) {
    await this.user({uid});
    if(!['papers','conversations'].includes(body.kind))fail(400,'invalid_library_kind','Choose papers or conversations.');
    const cursor=body.cursor?safeId(body.cursor):null;
    const collection=body.kind==='papers'?'assistantPapers':'assistantConversations';
    const fields=body.kind==='papers'?['id','title','revision','marks','createdAt','jobId','conversationId','ownerUid','board','standard','subject','academicYear']:['id','title','status','createdAt','updatedAt','ownerUid','latestPaperId'];
    const rows=await this.store.list(collection,[],51,{includeId:true,orderBy:['__name__','asc'],...(cursor?{startAfter:cursor}:{}),select:fields});
    const page=rows.slice(0,50),names=new Map();
    for(const owner of new Set(page.map(x=>x.ownerUid))){const profile=owner?await this.store.get(ref('users',owner)):null;names.set(owner,String(profile?.displayName||profile?.name||'GTOP administrator').slice(0,120));}
    const items=await Promise.all(page.map(async row=>{
      if(body.kind==='papers')return {...summary(row),creatorName:names.get(row.ownerUid)};
      const latest=row.latestPaperId?await this.store.get(ref('assistantPapers',row.latestPaperId)):null;
      const paper=latest?.ownerUid===row.ownerUid&&latest.conversationId===row.id?latest:null;
      return {...publicConversation(row),createdAt:row.createdAt,ownerUid:row.ownerUid,creatorName:names.get(row.ownerUid),...(paper?{title:paperConversationTitle(paper),board:paper.board,standard:paper.standard,subject:paper.subject,academicYear:paper.academicYear}:{})};
    }));
    return {items,nextCursor:rows.length>50?page.at(-1).id:null};
  }
  async adminConversation(uid,id) {
    await this.user({uid});const c=await this.store.get(ref('assistantConversations',id));if(!c)fail(404,'not_found','Conversation unavailable.');
    const detail=await this.conversationView(c),profile=await this.store.get(ref('users',c.ownerUid));
    return {...detail,readOnly:c.ownerUid!==uid,creatorName:String(profile?.displayName||profile?.name||'GTOP administrator').slice(0,120)};
  }
  async adminArtifact(uid,id,kind) {await this.user({uid});const p=await this.store.get(ref('assistantPapers',id));if(!p)fail(404,'not_found','Paper unavailable.');return this.artifact(p.ownerUid,id,kind);}
  async createConversation(uid, body) {
    const id = body.clientRequestId ? hash(`${uid}:conversation:${safeId(body.clientRequestId)}`).slice(0,40) : this.id();
    const result = await this.store.transaction(async tx => {
      const existing = await tx.get(ref('assistantConversations',id));
      if (existing) { if(existing.ownerUid !== uid) fail(404,'not_found','Conversation unavailable.'); return existing; }
      const c = {id,ownerUid:uid,title:'New paper conversation',status:'active',createdAt:this.iso(),updatedAt:this.iso(),requestRevision:0};
      tx.create(ref('assistantConversations',id),c); return c;
    });
    return {conversation:publicConversation(result)};
  }
  async conversation(uid,id) {
    let c = await this.owned(uid,'assistantConversations',id);
    await this.expireConversationJobs(uid,id);
    c = await this.owned(uid,'assistantConversations',id);
    return this.conversationView(c);
  }
  async conversationView(c) {
    const id=c.id,uid=c.ownerUid;
    const [messages,jobs,papers] = await Promise.all([this.store.list(`assistantConversations/${id}/messages`,[],250,{orderBy:['createdAt','desc']}),this.store.list('assistantJobs',[['conversationId','==',id]],100),this.store.list('assistantPapers',[['conversationId','==',id]],100,{select:['id','title','revision','marks','createdAt','jobId','ownerUid','conversationId','board','standard','subject','academicYear']})]);
    const ownPapers=papers.filter(p=>p.ownerUid===uid).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    return {conversation:{...publicConversation(c),...(ownPapers.length?{title:paperConversationTitle(ownPapers.at(-1))}:{})},messages:messages.sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),jobs:jobs.filter(j => j.ownerUid===uid).map(publicJob),papers:ownPapers.map(summary)};
  }
  async submit(uid,cid,body) {
    const original = text(body.text), clientId = safeId(body.clientMessageId), mid = hash(`${uid}:${cid}:${clientId}`).slice(0,40), jid = `turn-${mid}`;
    return this.store.transaction(async tx => {
      const [c, previous] = await Promise.all([tx.get(ref('assistantConversations',cid)),tx.get(messagePath(cid,mid))]);
      if (!c || c.ownerUid!==uid) fail(404,'not_found','Conversation unavailable.');
      if (previous) { if(previous.text!==original) fail(409,'idempotency_conflict','Message identifier was already used for different text.'); return {message:previous,job:publicJob(await tx.get(ref('assistantJobs',jid)))}; }
      const continuation=c.pendingResumeTurnId?await tx.get(ref('assistantJobs',c.pendingResumeTurnId)):null;
      const when = this.iso();
      const message = {id:mid,conversationId:cid,role:'user',text:original,createdAt:when,jobId:jid};
      const job = {id:jid,kind:'turn',ownerUid:uid,conversationId:cid,state:'queued',phase:'waiting_for_local_assistant',createdAt:when,updatedAt:when,requestMessageId:mid,requestRevision:c.requestRevision || 0};
      tx.create(messagePath(cid,mid),message); tx.create(ref('assistantJobs',jid),job);
      if(continuation&&activeStates.has(continuation.state))tx.set(ref('assistantJobs',continuation.id),{...continuation,state:'cancelled',phase:'superseded_by_new_message',leaseId:null,leaseUntil:null,updatedAt:when});
      tx.set(ref('assistantConversations',cid),{...c,latestUserMessageId:mid,pendingResumeTurnId:null,title:c.title==='New paper conversation'?original.replace(/\s+/g,' ').slice(0,80):c.title,rootRequestId:c.rootRequestId || mid,updatedAt:when});
      return {message,job:publicJob(job)};
    });
  }
  async cancel(uid,jid) {
    return this.store.transaction(async tx => {
      const j = await tx.get(ref('assistantJobs',jid)); if(!j || j.ownerUid!==uid) fail(404,'not_found','Task unavailable.');
      if(!activeStates.has(j.state)) return {job:publicJob(j)};
      const next = {...j,state:'cancelled',phase:'cancelled_by_user',updatedAt:this.iso(),leaseId:null,leaseUntil:null}; tx.set(ref('assistantJobs',jid),next); return {job:publicJob(next)};
    });
  }
  async retry(uid,jid) {
    await this.expireOne(jid,uid);
    return this.store.transaction(async tx => {
      const j = await tx.get(ref('assistantJobs',jid)); if(!j || j.ownerUid!==uid) fail(404,'not_found','Task unavailable.');
      const c = await tx.get(ref('assistantConversations',j.conversationId));
      if(j.state!=='failed' || j.retryable===false) fail(409,'retry_not_allowed','Only recoverable failed tasks can be retried.');
      if(j.retryJobId) return {job:publicJob(await tx.get(ref('assistantJobs',j.retryJobId)))};
      const slot=jobSlot(j);
      if(j.kind!=='turn' && (c[slot.revision]||0)!==j.requestRevision)fail(409,'superseded_task','This task has been superseded. Continue with the latest paper request.');
      const active = c[slot.id] ? await tx.get(ref('assistantJobs',c[slot.id])) : null;
      if(j.kind!=='turn' && active && active.id!==jid && activeStates.has(active.state)) fail(409,'newer_task_active','A newer paper task is active.');
      const id=this.id(), now=this.iso(), next={...j,id,state:'queued',phase:'retry_queued',createdAt:now,updatedAt:now,leaseId:null,leaseUntil:null,assignedWorkerId:null,startedAt:null,error:null,retryOf:jid,retryJobId:null};
      tx.create(ref('assistantJobs',id),next); tx.set(ref('assistantJobs',jid),{...j,retryJobId:id});
      if(j.kind!=='turn') tx.set(ref('assistantConversations',c.id),{...c,[slot.id]:id,updatedAt:now});
      return {job:publicJob(next)};
    });
  }
  async feedback(uid,body) {
    await this.owned(uid,'assistantConversations',safeId(body.conversationId));
    if(body.paperId) { const p=await this.owned(uid,'assistantPapers',body.paperId); if(p.conversationId!==body.conversationId) fail(400,'invalid_reference','Paper belongs to another conversation.'); }
    if(body.messageId && !await this.store.get(messagePath(body.conversationId,body.messageId))) fail(404,'not_found','Message unavailable.');
    if(!['helpful','needs_work'].includes(body.rating)) fail(400,'invalid_rating','Choose a feedback rating.');
    const id=this.id(), entry={id,ownerUid:uid,conversationId:body.conversationId,rating:body.rating,createdAt:this.iso()};
    if(body.messageId)entry.messageId=body.messageId;if(body.paperId)entry.paperId=body.paperId;if(body.text)entry.text=text(body.text,2000);
    await this.store.transaction(tx=>{tx.create(ref('assistantFeedback',id),entry);}); return {saved:true};
  }
  async paper(uid,id) { const p=await this.owned(uid,'assistantPapers',id); const {ownerUid,conversationId,...paper}=p; return {paper}; }
  async artifact(uid,id,kind) { await this.owned(uid,'assistantPapers',id); if(!['student','answers'].includes(kind))fail(404,'not_found','Artifact unavailable.');const doc=await this.store.get(`assistantPapers/${safeId(id)}/artifacts/${kind}`);if(!doc)fail(404,'not_found','Artifact unavailable.');return decodeArtifact(doc); }
  async heartbeat(worker,body) {
    if(!['ready','loading','busy','offline'].includes(body.state) || typeof body.modelReady!=='boolean')fail(400,'invalid_heartbeat','Invalid worker heartbeat.');
    await this.store.transaction(async tx=>{const current=await tx.get(ref('assistantWorkers',worker.id));tx.set(ref('assistantWorkers',worker.id),{...current,state:body.state,modelReady:body.modelReady,version:text(body.version,100),lastSeenAt:this.iso()});});return {ok:true};
  }
  async expireOne(id,ownerUid=null) {
    await this.store.transaction(async tx=>{
      const j=await tx.get(ref('assistantJobs',id));if(!j || (ownerUid!==null&&j.ownerUid!==ownerUid) || !['running','validating'].includes(j.state) || Date.parse(j.leaseUntil || '')>this.now().getTime())return;
      tx.set(ref('assistantJobs',id),{...j,state:'failed',phase:'worker_disconnected',error:'The local worker stopped responding. Retry explicitly to continue.',retryable:true,updatedAt:this.iso(),leaseId:null,leaseUntil:null});
    });
  }
  async expireConversationJobs(uid,cid){const jobs=await this.store.list('assistantJobs',[['conversationId','==',cid]],100);for(const j of jobs)if(j.ownerUid===uid && ['running','validating'].includes(j.state))await this.expireOne(j.id);}
  async claim(worker,body) {
    if(!['turn','paper'].includes(body.kind))fail(400,'invalid_kind','Invalid task kind.');
    const wait=Math.max(0,Math.min(20,Number(body.waitSeconds)||0)),deadline=Date.now()+wait*1000;
    do {
      const candidates=(await this.store.list('assistantJobs',[['state','==','queued']],200)).filter(j=>(j.kind===body.kind||(body.kind==='paper'&&j.kind==='curriculum')) && worker.allowedOwnerUids.includes(j.ownerUid)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
      for(const candidate of candidates){
        const job=await this.store.transaction(async tx=>{
          const j=await tx.get(ref('assistantJobs',candidate.id));if(!j || j.state!=='queued')return null;
          const config=await tx.get('assistantConfig/pilot'),profile=await tx.get(ref('users',j.ownerUid)),c=await tx.get(ref('assistantConversations',j.conversationId)),currentWorker=await tx.get(ref('assistantWorkers',worker.id));
          if(!config?.allowedOwnerUids?.includes(j.ownerUid) || profile?.role!=='admin' || !c || c.ownerUid!==j.ownerUid || currentWorker?.enabled!==true || !currentWorker.allowedOwnerUids?.includes(j.ownerUid)) return null;
          const slot=jobSlot(j);
          if(j.resumedFromCurriculumJobId&&c.latestUserMessageId&&c.latestUserMessageId!==j.requestMessageId){tx.set(ref('assistantJobs',j.id),{...j,state:'cancelled',phase:'superseded_by_new_message',updatedAt:this.iso()});return null;}
          if(j.kind!=='turn' && (c[slot.id]!==j.id || (c[slot.revision]||0)!==j.requestRevision)){tx.set(ref('assistantJobs',j.id),{...j,state:'cancelled',phase:'superseded',updatedAt:this.iso()});return null;}
          const next={...j,state:'running',phase:j.kind==='turn'?'local_conversation':'codex_starting',assignedWorkerId:worker.id,leaseId:this.id(),leaseUntil:new Date(this.now().getTime()+120000).toISOString(),startedAt:this.iso(),updatedAt:this.iso()};tx.set(ref('assistantJobs',j.id),next);return next;
        });
        if(job)return {job:await this.workerJob(job)};
      }
      if(Date.now()>=deadline)break;await this.sleep(1000);
    }while(Date.now()<deadline);
    return {job:null};
  }
  async workerJob(job) {
    const c=await this.store.get(ref('assistantConversations',job.conversationId));
    const [recent,request,active,base,latest,ownerProfile]=await Promise.all([this.store.list(`assistantConversations/${job.conversationId}/messages`,[],100,{orderBy:['createdAt','desc']}),this.store.get(messagePath(c.id,job.requestMessageId)),c.activePaperJobId?this.store.get(ref('assistantJobs',c.activePaperJobId)):null,job.basePaperId?this.store.get(ref('assistantPapers',job.basePaperId)):null,c.latestPaperId?this.store.get(ref('assistantPapers',c.latestPaperId)):null,this.store.get(ref('users',job.ownerUid))]);
    for(const p of [base,latest])if(p && (p.ownerUid!==job.ownerUid || p.conversationId!==c.id))fail(409,'invalid_paper_reference','Stored paper ownership could not be verified.');
    const root=await this.store.get(messagePath(c.id,job.rootRequestMessageId || latest?.rootRequestMessageId || c.rootRequestId));
    if(!request || !root)fail(409,'missing_original_request','Original conversation messages are unavailable.');
    // A bounded recent window must not erase the user evidence behind a brief.
    const sourceIds=[...new Set([c.taskBrief?.creationRequestId,c.taskBrief?.lastMessageId,...Object.values(c.taskBrief?.sources||{}).map(s=>s.messageId)].filter(Boolean))];
    if(sourceIds.length>30)fail(409,'brief_source_bound','Saved requirements need review before continuing.');
    const evidence=await Promise.all(sourceIds.filter(id=>!recent.some(m=>m.id===id)).map(id=>this.store.get(messagePath(c.id,safeId(id)))));
    if(evidence.some(m=>!m||m.role!=='user'||m.conversationId!==c.id))fail(409,'missing_requirement_evidence','Saved requirement evidence is unavailable. Please restate the paper requirements.');
    const all=[...new Map([root,...evidence,...recent,request].map(m=>[m.id,m])).values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const original=m=>({id:m.id,text:m.text,sha256Utf8:hash(m.text)});
    const researchActive=c.activeCurriculumJobId?await this.store.get(ref('assistantJobs',c.activeCurriculumJobId)):null;
    const checked=c.latestCurriculumId?await this.store.get(ref('assistantCurricula',c.latestCurriculumId)):null;
    const selected=checked?.ownerUid===c.ownerUid&&checked.conversationId===c.id?checked.curriculum:null;
    const pinned=job.curriculumSnapshot||base?.curriculumSnapshot||selected||latest?.curriculumSnapshot||null;
    return clean({...publicJob(job),operation:job.operation,retryOf:job.retryOf,leaseId:job.leaseId,request:{...original(request),createdAt:request.createdAt},rootRequest:original(root),history:all.filter(m=>m.createdAt<=request.createdAt),profile:{displayName:typeof ownerProfile?.displayName==='string'?ownerProfile.displayName:'',preferences:c.memory?.preferences || []},context:{latestPaperId:c.latestPaperId || null,latestPaper:latest || null,activeRequirements:active?.requirements || latest?.requirements || null,taskBrief:c.taskBrief||null,curriculum:pinned},controllerFacts:{permissions:{routinePaperWork:true,development:false,deployment:false,destructiveOperations:false,bankWrites:false},activePaperJob:publicJob(active),activeCurriculumJob:publicJob(researchActive),availableData:{bankConnector:false,curriculum:pinned}},requirements:job.requirements,curriculumSnapshot:job.curriculumSnapshot,interpretation:job.interpretation,proposedActions:job.proposedActions,basePaper:base,targetQuestionNumber:job.targetQuestionNumber});
  }
  async turnBrief(worker,id,body){
    const job=await this.store.get(ref('assistantJobs',id));
    if(!job||!worker.allowedOwnerUids.includes(job.ownerUid))fail(404,'not_found','Task unavailable.');
    if(job.kind!=='turn')return null;
    const input=await this.workerJob(job);
    input.catalogue=await this.curriculumCatalogue();
    let brief;try{brief=buildTaskBrief(input,body.selection||null);}catch(e){fail(400,'invalid_selection',e.message);}
    const field=missingTaskField(brief);
    const asked=body.clarificationField&&(body.clarificationField===field||['course','edition','curriculum','format'].includes(body.clarificationField));
    brief.pendingClarification=asked?{field:body.clarificationField,attempts:brief.pendingClarification?.field===body.clarificationField?(brief.pendingClarification.attempts||0)+1:1}:null;
    brief.clarificationTurns=Math.min(50,(brief.clarificationTurns||0)+(asked?1:0));
    // An offer is actionable only after the gateway independently confirms
    // unavailable curriculum. A model-written invitation grants nothing.
    if(body.curriculumOffer===true&&!field&&brief.creationRequestId&&!brief.creationPaused){
      try{await this.resolveCurriculum(brief.requirements,job.conversationId,worker);}
      catch(e){if(e.code==='curriculum_unavailable')brief.pendingClarification={field:'curriculum',attempts:1};}
    }
    return bounded(brief,20000);
  }
  async leased(tx,worker,id,leaseId) {
    const j=await tx.get(ref('assistantJobs',id));if(!j || !worker.allowedOwnerUids.includes(j.ownerUid))fail(404,'not_found','Task unavailable.');
    if(j.assignedWorkerId!==worker.id || !leaseId || j.leaseId!==leaseId || !['running','validating'].includes(j.state) || !Number.isFinite(Date.parse(j.leaseUntil || '')) || Date.parse(j.leaseUntil || '')<=this.now().getTime())return null;
    const c=await tx.get(ref('assistantConversations',j.conversationId));
    const [config,profile,currentWorker]=await Promise.all([tx.get('assistantConfig/pilot'),tx.get(ref('users',j.ownerUid)),tx.get(ref('assistantWorkers',worker.id))]);
    if(!config?.allowedOwnerUids?.includes(j.ownerUid) || profile?.role!=='admin' || !c || c.ownerUid!==j.ownerUid || currentWorker?.enabled!==true || !currentWorker.allowedOwnerUids?.includes(j.ownerUid))return null;
    const slot=jobSlot(j);
    if(j.kind!=='turn' && (c?.[slot.id]!==j.id || (c[slot.revision]||0)!==j.requestRevision))return null;
    return {job:j,conversation:c};
  }
  async renew(worker,id,body) {
    return this.store.transaction(async tx=>{const active=await this.leased(tx,worker,id,body.leaseId);if(!active)return {active:false};const {job}=active;tx.set(ref('assistantJobs',id),{...job,leaseUntil:new Date(this.now().getTime()+120000).toISOString(),updatedAt:this.iso(),elapsedSeconds:Math.max(0,Math.floor((this.now().getTime()-Date.parse(job.startedAt))/1000)),...(body.phase?{phase:text(body.phase,100)}:{})});return {active:true};});
  }
  async event(worker,id,body) {
    if(body.state && !['running','validating'].includes(body.state))fail(400,'invalid_transition','Only running and validating progress events are accepted.');
    return this.store.transaction(async tx=>{const active=await this.leased(tx,worker,id,body.leaseId);if(!active)return {active:false};const {job}=active;const now=this.iso(),eid=this.id();tx.set(ref('assistantJobs',id),{...job,updatedAt:now,...(body.phase?{phase:text(body.phase,100)}:{}),...(body.state?{state:body.state}:{})});tx.create(`assistantJobs/${id}/events/${eid}`,{id:eid,createdAt:now,phase:body.phase || job.phase,state:body.state || job.state,metrics:bounded(body.metrics),...(body.reply?{reply:text(body.reply,4000)}:{})});return {active:true};});
  }
  async delegate(worker,id,body) {
    if(!['generate_paper','revise_paper','check_curriculum'].includes(body.operation))fail(400,'unsupported_operation','This capability is unavailable.');
    const taskBrief=await this.turnBrief(worker,id,body);
    let requirements;try{requirements=this.domain.validateRequirements(body.requirements) || body.requirements;}catch(error){fail(400,'invalid_requirements',error.message);}
    if(requirements.scope==='selected_chapters'&&JSON.stringify(requirements.selectedChapters)!==JSON.stringify(taskBrief?.requirements.selectedChapters))fail(400,'invalid_selection','Selected chapters must match saved user evidence.');
    if(body.operation==='generate_paper'&&taskBrief?.requirements.scope==='selected_chapters'&&requirements.scope!=='selected_chapters')fail(400,'invalid_selection','A selected-chapter request cannot be widened to the full syllabus.');
    if(body.operation==='check_curriculum')try{validateCurriculumScope(requirements);}catch(e){fail(400,'invalid_requirements',e.message);}
    const requestedJob=await this.store.get(ref('assistantJobs',id));
    if(!requestedJob||!worker.allowedOwnerUids.includes(requestedJob.ownerUid))fail(404,'not_found','Task unavailable.');
    let curriculumSnapshot=null;
    if(body.operation!=='check_curriculum'){
      try{const base=body.basePaperId?await this.store.get(ref('assistantPapers',body.basePaperId)):null;
        if(body.operation==='revise_paper'&&base?.ownerUid===requestedJob.ownerUid)curriculumSnapshot=base.curriculumSnapshot||this.domain.curriculum;
        else curriculumSnapshot=await this.resolveCurriculum(requirements,requestedJob.conversationId,worker);
      }catch(e){fail(400,'curriculum_unavailable',e.message);}
    }
    if(curriculumSnapshot?.chapters?.length>requirements.marks)fail(400,'infeasible_marks',`This chapter list has ${curriculumSnapshot.chapters.length} chapters. Covering each with at least one attempted mark needs at least that many marks. Please increase marks or choose a smaller reviewed curriculum. `);
    const result=await this.store.transaction(async tx=>{
      const active=await this.leased(tx,worker,id,body.leaseId);if(!active)fail(409,'stale_lease','Task was cancelled or its lease expired.');const {job,conversation:c}=active;
      if(job.kind!=='turn')fail(409,'invalid_transition','Only conversation turns can delegate.');
      const slot=jobSlot({kind:body.operation==='check_curriculum'?'curriculum':'paper'});
      const old=c[slot.id]?await tx.get(ref('assistantJobs',c[slot.id])):null;
      const [currentRequest,olderRequest]=old?await Promise.all([tx.get(messagePath(c.id,job.requestMessageId)),tx.get(messagePath(c.id,old.requestMessageId))]):[];
      if(old && currentRequest?.createdAt<olderRequest?.createdAt)fail(409,'superseded_task','A newer user paper request is already active.');
      let base=null;if(body.operation==='revise_paper'){base=body.basePaperId?await tx.get(ref('assistantPapers',body.basePaperId)):null;if(!base || base.ownerUid!==job.ownerUid || base.conversationId!==job.conversationId)fail(400,'invalid_base_paper','Choose an existing paper from this conversation.');if(body.targetQuestionNumber!==null && body.targetQuestionNumber!==undefined && (!Number.isInteger(body.targetQuestionNumber)||body.targetQuestionNumber<1))fail(400,'invalid_question','Choose a valid question to revise, or a whole-paper revision.');}
      const rootRequestMessageId=base?.rootRequestMessageId || body.rootRequestMessageId || job.requestMessageId;
      const [rootMessage,currentMessage]=await Promise.all([tx.get(messagePath(c.id,rootRequestMessageId)),tx.get(messagePath(c.id,job.requestMessageId))]);
      const creationMessage=taskBrief?.creationRequestId?await tx.get(messagePath(c.id,taskBrief.creationRequestId)):null;
      const latestPaperForResume=c.latestPaperId?await tx.get(ref('assistantPapers',c.latestPaperId)):null;
      const pendingCreation=creationMessage&&(!latestPaperForResume||creationMessage.createdAt>latestPaperForResume.createdAt);
      if(!rootMessage || rootMessage.role!=='user' || rootMessage.conversationId!==c.id || rootMessage.createdAt>currentMessage.createdAt)fail(400,'invalid_root_request','The original paper request must be a saved user message from this conversation.');
      const jid=this.id(),now=this.iso(),revision=(c[slot.revision] || 0)+1;
      const next={id:jid,kind:body.operation==='check_curriculum'?'curriculum':'paper',operation:body.operation,ownerUid:job.ownerUid,conversationId:job.conversationId,state:'queued',phase:'waiting_for_codex',createdAt:now,updatedAt:now,requestMessageId:job.requestMessageId,rootRequestMessageId,requestRevision:revision,requirements:bounded(requirements),...(body.operation==='check_curriculum'&&pendingCreation&&!taskBrief.creationPaused?{resumePaperAfterCheck:true}:{}),...(curriculumSnapshot?{curriculumSnapshot:bounded(curriculumSnapshot,180000)}:{}),interpretation:text(body.interpretation,4000),proposedActions:bounded(body.proposedActions,8000),...(base?{basePaperId:base.id,targetQuestionNumber:body.targetQuestionNumber ?? null}:{})};
      if(old && activeStates.has(old.state))tx.set(ref('assistantJobs',old.id),{...old,state:'cancelled',phase:'superseded_by_new_request',leaseId:null,leaseUntil:null,updatedAt:now});
      tx.create(ref('assistantJobs',jid),next);tx.set(ref('assistantJobs',id),{...job,state:'completed',phase:'delegated_to_codex',updatedAt:now,leaseId:null,leaseUntil:null,metrics:bounded(body.metrics)});tx.set(ref('assistantConversations',c.id),{...c,...(taskBrief&&(!c.taskBrief?.lastMessageAt||taskBrief.lastMessageAt>=c.taskBrief.lastMessageAt)?{taskBrief}:{}),[slot.id]:jid,[slot.revision]:revision,updatedAt:now});return next;
    });return {job:await this.workerJob(result)};
  }
  async complete(worker,id,body) {
    const taskBrief=await this.turnBrief(worker,id,body);
    return this.store.transaction(async tx=>{
      const active=await this.leased(tx,worker,id,body.leaseId);if(!active)return {active:false};const {job,conversation:c}=active;
      const now=this.iso(),mid=this.id();let paper=null,artifactStudent=null,artifactAnswers=null;
      // Read latest messages before any write: a later pause/correction must
      // prevent continuation even when its conversation turn is still queued.
      let resumeInput=null,resumeTurn=null;
      if(job.operation==='check_curriculum'&&job.resumePaperAfterCheck&&body.researchUnavailable!==true){
        const recent=await this.store.list(`assistantConversations/${c.id}/messages`,[],100,{orderBy:['createdAt','desc']});
        const latestUser=recent.find(m=>m.role==='user');
        if(latestUser?.id===job.requestMessageId){
          resumeInput={request:{...latestUser,sha256Utf8:hash(latestUser.text)},history:recent.reverse(),context:{taskBrief:c.taskBrief},catalogue:{}};
          const brief=buildTaskBrief(resumeInput);
          if(brief.creationRequestId&&!brief.creationPaused&&!missingTaskField(brief)){
            const rid='resume-'+job.id;
            resumeTurn=await tx.get(ref('assistantJobs',rid));
            if(!resumeTurn)resumeTurn={id:rid,kind:'turn',ownerUid:job.ownerUid,conversationId:c.id,state:'queued',phase:'waiting_for_codex',createdAt:now,updatedAt:now,requestMessageId:job.requestMessageId,requestRevision:c.requestRevision||0,resumedFromCurriculumJobId:job.id};else resumeTurn=null;
          }
        }
      }
      let checkedCurriculum=null;
      if(job.operation==='check_curriculum'){
        if(body.researchUnavailable!==true){try{domain.assertSchema(body.research,curriculumResearchSchema);checkedCurriculum=researchCurriculum(body.research,job.requirements,body.sourceProofs);}catch(e){fail(400,'invalid_curriculum_check',e.message);}}
        if(body.paper)fail(400,'invalid_transition','Curriculum checks cannot publish papers.');
      }else if(job.kind==='paper'){
        if(!body.paper)fail(400,'paper_required','Paper output is required.');
        const base=job.basePaperId?await tx.get(ref('assistantPapers',job.basePaperId)):null;
        const input=this.domain.paperContent(bounded(body.paper,400000));
        try{
          const pinned=job.curriculumSnapshot||base?.curriculumSnapshot||this.domain.curriculum;
          const validation=this.domain.validatePaper(input,job.requirements,pinned);
          if(base)this.domain.validateRevision(base,input,job.targetQuestionNumber,pinned);
          paper={...input,id:this.id(),ownerUid:job.ownerUid,conversationId:c.id,requirements:job.requirements,curriculumSnapshot:pinned,rootRequestMessageId:job.rootRequestMessageId,revision:base?(base.revision || 1)+1:1,...(base?{parentPaperId:base.id}:{}),jobId:id,createdAt:now,validation};
          artifactStudent=this.domain.renderPaper(paper,false);artifactAnswers=this.domain.renderPaper(paper,true);
        }catch(error){fail(400,'invalid_paper',error.message);}
        artifactStudent=encodeArtifact(artifactStudent,now);artifactAnswers=encodeArtifact(artifactAnswers,now);
      }else if(body.paper)fail(400,'invalid_transition','Conversation turns cannot publish papers.');
      const reply=body.reply?text(body.reply,12000):(paper?'Your paper and separate worked answers are ready for your review.':'');
      if(!reply)fail(400,'reply_required','A conversational reply is required.');
      const message={id:mid,conversationId:c.id,role:'assistant',text:reply,createdAt:now,jobId:id,...(taskBrief?.pendingClarification?{clarificationField:taskBrief.pendingClarification.field}:{}),...(paper?{paperId:paper.id}:{})};
      const memory=body.memoryPatch?bounded(body.memoryPatch,4000):null;
      const original=memory?await tx.get(messagePath(c.id,job.requestMessageId)):null;
      if(memory && (Object.keys(memory).some(key=>key!=='preferences') || !Array.isArray(memory.preferences) || memory.preferences.length>12 || memory.preferences.some(p=>Object.keys(p || {}).some(key=>!['value','sourceMessageId'].includes(key)) || typeof p?.value!=='string' || p.sourceMessageId!==job.requestMessageId || p.value.length>300 || !original?.text.includes(p.value))))fail(400,'invalid_memory','Memory must quote explicit preferences from the current user message.');
      const mergedMemory=memory?{preferences:[...new Map([...(c.memory?.preferences || []),...memory.preferences].map(preference=>[preference.value.toLowerCase(),preference])).values()].slice(-12)}:null;
      const final={...job,state:'completed',phase:paper?'paper_ready_for_teacher_review':'reply_ready',updatedAt:now,leaseId:null,leaseUntil:null,metrics:bounded(body.metrics),...(paper?{paperId:paper.id}:{})};
      let curriculumId=null;
      if(checkedCurriculum){curriculumId=this.id();tx.create(ref('assistantCurricula',curriculumId),{id:curriculumId,ownerUid:job.ownerUid,conversationId:c.id,curriculum:checkedCurriculum,jobId:id,createdAt:now});final.phase='curriculum_checked';}
      if(paper){tx.create(ref('assistantPapers',paper.id),paper);tx.create(`assistantPapers/${paper.id}/artifacts/student`,artifactStudent);tx.create(`assistantPapers/${paper.id}/artifacts/answers`,artifactAnswers);}
      if(resumeTurn&&checkedCurriculum)tx.create(ref('assistantJobs',resumeTurn.id),resumeTurn);
      tx.create(messagePath(c.id,mid),message);tx.set(ref('assistantJobs',id),final);tx.set(ref('assistantConversations',c.id),{...c,...(taskBrief&&(!c.taskBrief?.lastMessageAt||taskBrief.lastMessageAt>=c.taskBrief.lastMessageAt)?{taskBrief}:{}),updatedAt:now,...(paper?{latestPaperId:paper.id,title:paperConversationTitle(paper),titleSource:'generated-paper'}:{}),...(curriculumId?{latestCurriculumId:curriculumId}:{}),...(resumeTurn&&checkedCurriculum?{pendingResumeTurnId:resumeTurn.id}:{}),...(mergedMemory?{memory:mergedMemory}: {})});
      return {active:true,...(paper?{paperId:paper.id}:{})};
    });
  }
  async failed(worker,id,body) {
    return this.store.transaction(async tx=>{const active=await this.leased(tx,worker,id,body.leaseId);if(!active)return {active:false};tx.set(ref('assistantJobs',id),{...active.job,state:'failed',phase:'failed',error:text(body.error,2000),retryable:body.retryable!==false,updatedAt:this.iso(),leaseId:null,leaseUntil:null});return {active:true};});
  }
}
