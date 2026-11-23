import {createHash, randomUUID, timingSafeEqual} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import * as domain from './domain/index.mjs';
import {pinnedUnitCurriculum} from './domain/curriculum.mjs';
import {catalogueIndex,capabilityFacts,savedCurriculum,validateScope,validateCurriculumScope,sameScope,officialUrl} from './domain/catalogue.mjs';
import {researchCurriculum,curriculumResearchSchema} from './domain/research.mjs';
import {buildTaskBrief,missingTaskField,selectedCurriculum} from './domain/task-brief.mjs';
import {ServiceControl,serviceWorkerId} from './service-control.mjs';
import {PaperChecking} from './checking.mjs';
import {withWorkerHealth,workerFreshnessMs} from './presence.mjs';
import {proposalResponse,researchKey,pendingPaperTurns,confirmationText} from './domain/paper-proposal.mjs';
import {NativePaperError, nativePaper, workerPaper} from './native-papers.mjs';
import {stagePaperCatalogue,normaliseCatalogueSearch,decodeCatalogueCursor,encodeCatalogueCursor,publicCatalogueItem,catalogueMigrationPath} from './paper-catalogue.mjs';

export class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const fail = (status, code, message) => { throw new HttpError(status, code, message); };
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const jobSlot=j=>j.kind==='curriculum'?{id:'activeCurriculumJobId',revision:'curriculumRevision'}:{id:'activePaperJobId',revision:'requestRevision'};
const activeStates = new Set(['queued','running','validating']);
const safeId = id => { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) fail(400,'invalid_id','Invalid identifier.'); return id; };
const text = (value, max = 12000) => { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400,'invalid_text',`Text must contain 1–${max} characters.`); return value; };
const clean = value => JSON.parse(JSON.stringify(value));
const publicJobFields=['id','kind','native','ownerUid','conversationId','state','phase','createdAt','updatedAt','startedAt','elapsedSeconds','error','errorCode','requestRevision','paperId','retryable','progress'];
const publicJob = job => job && clean(Object.fromEntries(publicJobFields.filter(key => job[key] !== undefined).map(key => [key,job[key]])));
const failedCodexMessages=Object.freeze({
  codex_unavailable:'The Codex connection is unavailable. Your request is saved. Try again when the host reconnects.',
  codex_auth_required:'The host needs to sign in to Codex with ChatGPT again. Your request is saved.',
  codex_rate_limited:'The ChatGPT subscription is temporarily limited. Your request is saved. Try again when the limit resets.',
  codex_model_unavailable:'The configured Codex model is unavailable to the host. Your request is saved. Contact the administrator before retrying.',
  codex_profile_unverified:'Codex could not verify the configured model and reasoning effort. Your request is saved.',
  codex_response_timeout:'Codex took too long to reply. Your request is saved. Try again.',
  codex_response_invalid:'Codex could not prepare a usable reply. Your request is saved. Try again.',
});
const failedPaperMessages=Object.freeze({
  paper_generation_timeout:'Writing or reviewing the paper took too long. Your requirements are saved. Try again to continue.',
  paper_draft_invalid:'The draft did not pass the paper checks. Try again to continue from the verified work.',
  paper_delivery_unavailable:'The assistant could not save the finished paper. Try again to recover it.',
  paper_scope_infeasible:'These marks or section choices cannot cover all requested chapters. Change the marks or scope and send the revised request.',
});
const nativeDraftRejections=new Set(['invalid_paper','curriculum_unavailable','invalid_base_paper','invalid_question','payload_too_large','artifact_too_large']);
// An operator can briefly drain a paired runner without invalidating any live lease.
const claimsPaused=(worker,now)=>Date.parse(worker?.claimsPausedUntil||'')>now;
const leaseExpired=(job,now)=>['running','validating'].includes(job.state)&&!(Date.parse(job.leaseUntil||'')>now);
const expiredJob=(j,when)=>({...j,state:'failed',phase:'worker_disconnected',error:'The assistant disconnected. Your request is saved. Try again to continue.',errorCode:'worker_disconnected',retryable:true,updatedAt:when,leaseId:null,leaseUntil:null});
const publicConversation = c => c && clean(Object.fromEntries(['id','title','status','updatedAt','activeNativeTurnId','activePaperJobId','activeCurriculumJobId','latestPaperId'].filter(key => c[key] !== undefined).map(key => [key,c[key]])));
const visibleToAdmin=(row,uid)=>row&&(!row.nativePrivate||row.ownerUid===uid);
const summary = p => clean({...Object.fromEntries(['id','title','revision','marks','createdAt','jobId','conversationId','ownerUid','board','standard','subject','academicYear'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]])),verifiedSectionPattern:p.requirements?.format==='board'});
const paperConversationTitle=p=>p.board&&p.standard&&p.subject?`${p.board} Class ${p.standard} ${p.subject} · ${p.marks} marks`.slice(0,120):String(p.title||'Question paper').replace(/\s+/g,' ').slice(0,120);
const libraryCursorPrefix='date.';
function libraryOrder(kind,cursor){
  const field=kind==='papers'?'createdAt':'updatedAt';
  if(cursor===undefined||cursor===null||cursor==='')return {orderBy:[field,'desc'],orderById:true};
  // A page already open before rollout must finish in its original ID order.
  if(typeof cursor==='string'&&!cursor.startsWith(libraryCursorPrefix))return {orderBy:['__name__','asc'],startAfter:safeId(cursor)};
  try{
    if(typeof cursor!=='string'||cursor.length>400)throw Error();
    const values=JSON.parse(Buffer.from(cursor.slice(libraryCursorPrefix.length),'base64url').toString());
    if(!Array.isArray(values)||values.length!==3)throw Error();
    const [cursorKind,date,id]=values;
    if(cursorKind!==kind||typeof date!=='string'||date.length>40||!Number.isFinite(Date.parse(date)))throw Error();
    return {orderBy:[field,'desc'],orderById:true,cursorValues:[date,safeId(id)]};
  }catch{fail(400,'invalid_library_cursor','Reload the library to continue.');}
}
const ref = (collection,id) => `${collection}/${safeId(id)}`;
const messagePath = (cid,id) => `assistantConversations/${safeId(cid)}/messages/${safeId(id)}`;
const nativeThreadPath=id=>ref('assistantNativeThreads',id);
const nativeThreadId=value=>{
  if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value))fail(400,'invalid_native_thread','A valid Codex thread ID is required.');
  return value;
};
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
  constructor(store, {now = () => new Date(), id = randomUUID, signer = null, sleep = ms => new Promise(r => setTimeout(r,ms)), domainApi = domain} = {}) { Object.assign(this,{store,now,id,signer,sleep,domain:domainApi});this.serviceControl=new ServiceControl(this,fail);this.checking=new PaperChecking(this,fail); }
  iso() { return this.now().toISOString(); }
  notifyDispatch(tx,ownerUid) {
    tx.set(ref('assistantDispatch',ownerUid),{schemaVersion:1,revision:randomUUID(),updatedAt:this.iso()});
    this.notifyContent(tx,ownerUid);
  }
  notifyContent(tx,ownerUid) {
    tx.set(ref('assistantUiNotifications',ownerUid),{schemaVersion:1,revision:randomUUID(),updatedAt:this.iso()});
  }
  async user(claims) {
    if (!claims?.uid || claims.assistantWorker) fail(401,'sign_in_required','Sign in with your Growth Tutorials account.');
    const [profile, config] = await Promise.all([this.store.get(ref('users',claims.uid)),this.store.get('assistantConfig/pilot')]);
    if (profile?.role !== 'admin' || !config?.allowedOwnerUids?.includes(claims.uid)) fail(403,'pilot_access_required','This private pilot is restricted to invited Growth Tutorials administrators.');
    return {uid:claims.uid,displayName:profile.displayName || profile.name || claims.name || '',email:claims.email || profile.email || '',libraryAccess:true};
  }
  workerIdentity(claims) {
    if (claims?.assistantWorker !== true || !claims.workerId || claims.uid !== `assistant-worker-${claims.workerId}`) fail(403,'worker_access_required','A paired assistant worker is required.');
    return {id:safeId(claims.workerId)};
  }
  async worker(claims) {
    const {id}=this.workerIdentity(claims);
    const worker = await this.store.get(ref('assistantWorkers',id));
    if (!worker || worker.enabled !== true || !Array.isArray(worker.allowedOwnerUids)) fail(403,'worker_disabled','Worker pairing is disabled.');
    return {...worker,id};
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
    const pairings = await this.store.list('assistantWorkers', [['enabled','==',true]],20,{includeId:true});
    const workers=await Promise.all(pairings.filter(w=>w.allowedOwnerUids?.includes(user.uid)).map(async w=>withWorkerHealth(w,await this.store.get(ref('assistantWorkerHealth',w.id)))));
    const own = workers.filter(w => w.allowedOwnerUids?.includes(user.uid)).sort((a,b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''))[0];
    const fresh = own && this.now().getTime() - Date.parse(own.lastSeenAt || '')>=0 && this.now().getTime() - Date.parse(own.lastSeenAt || '') < workerFreshnessMs;
    const service=await this.serviceControl.get(user).catch(error=>{if([403,503].includes(error.status))return null;throw error;});
    return {user,worker:{state:fresh ? own.state || 'loading' : 'offline',lastSeenAt:own?.lastSeenAt || null,modelReady:!!(fresh && own.modelReady)},service,notifications:{schemaVersion:1,contentPath:ref('assistantUiNotifications',user.uid),presencePath:service?ref('assistantWorkerHealth',serviceWorkerId):null,freshnessMs:workerFreshnessMs},capabilities:capabilityFacts({}),defaults:Object.fromEntries(['marks','durationMinutes','questionLanguage','answerLanguage'].map(key=>[key,domain.defaults[key]]))};
  }
  async curriculumCatalogue(){
    if(this.catalogueCache&&Date.now()-this.catalogueCache.at<21600000)return this.catalogueCache.value;
    const rows=await this.store.list('syllabus',[],5001,{select:['board','standard','subject','chapter']});
    const value=catalogueIndex(rows);this.catalogueCache={at:Date.now(),value};return value;
  }
  async resolveCurriculum(requirements,conversationId=null,worker=null){
    const r=validateScope({...domain.defaults,...requirements});validateCurriculumScope(r);
    const c=conversationId?await this.store.get(ref('assistantConversations',conversationId)):null;
    if(conversationId&&(!c||!worker?.allowedOwnerUids?.includes(c.ownerUid)))fail(404,'not_found','Conversation unavailable.');
    const select=snapshot=>{
      try{return selectedCurriculum(snapshot,r);}
      catch(error){fail(400,'curriculum_unavailable',error.message);}
    };
    const pinnedUnit=pinnedUnitCurriculum(r);
    if(pinnedUnit)return select(pinnedUnit);
    if(c?.latestCurriculumId){const checked=await this.store.get(ref('assistantCurricula',c.latestCurriculumId));if(checked?.ownerUid===c.ownerUid&&checked.conversationId===c.id&&sameScope(checked.curriculum,r)){
        if(checked.curriculum.provenance?.coverage==='selected_chapters'&&r.scope!=='selected_chapters')fail(400,'curriculum_unavailable','The checked curriculum only covers the previously selected chapters.');
        if(r.format==='board'){
          const pattern=checked.curriculum.paperPattern;
          if(pattern?.academicYear!==r.academicYear||pattern?.marks!==r.marks)fail(400,'curriculum_unavailable','The requested board sections for these marks and year need an official-source check.');
        }
        return select(checked.curriculum);
      }}
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
    if(sameScope(domain.curriculum,r))return select(domain.curriculum);
    const rows=await this.store.list('syllabus',[['board','==',r.board],['standard','==',r.standard],['subject','==',r.subject]],401,{includeId:true});
    if(rows.length>400)fail(409,'catalogue_bound','Saved subject exceeds its chapter read bound.');
    try{return selectedCurriculum(savedCurriculum(r,rows),r);}catch(e){fail(400,'curriculum_unavailable',e.message);}
  }
  async conversations(uid) { const rows = await this.store.list('assistantConversations',[['ownerUid','==',uid]],100); return {conversations:rows.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(publicConversation)}; }
  async adminLibrary(uid,body={}) {
    await this.user({uid});
    if(!['papers','conversations'].includes(body.kind))fail(400,'invalid_library_kind','Choose papers or conversations.');
    const order=libraryOrder(body.kind,body.cursor);
    const collection=body.kind==='papers'?'assistantPapers':'assistantConversations';
    const fields=body.kind==='papers'?['id','title','revision','marks','createdAt','jobId','conversationId','ownerUid','board','standard','subject','academicYear','requirements.format']:['id','title','status','createdAt','updatedAt','ownerUid','latestPaperId'];
    const rows=[];
    const legacyOrder=order.orderBy[0]==='__name__';
    let position=order;
    // A private row never becomes a client cursor. Scan to the next visible item.
    while(rows.length<51){
      const batch=await this.store.list(collection,[],51,{includeId:true,...position,select:[...fields,'nativePrivate']});
      rows.push(...batch.filter(row=>visibleToAdmin(row,uid)));
      if(batch.length<51)break;
      const last=batch.at(-1);
      position=legacyOrder?{...order,startAfter:last.id}:{...order,cursorValues:[last[order.orderBy[0]],last.id]};
    }
    const page=rows.slice(0,50);
    const owners=[...new Set(page.map(row=>row.ownerUid).filter(Boolean))];
    const paperIds=body.kind==='conversations'?[...new Set(page.map(row=>row.latestPaperId).filter(Boolean))]:[];
    const [profiles,papers]=await Promise.all([
      this.store.getSelected(owners.map(id=>ref('users',id)),['name','displayName']),
      this.store.getSelected(paperIds.map(id=>ref('assistantPapers',id)),['title','ownerUid','conversationId','board','standard','subject','academicYear','marks','nativePrivate'])
    ]);
    const names=new Map(owners.map((id,i)=>[id,String(profiles[i]?.displayName||profiles[i]?.name||'GTOP administrator').slice(0,120)]));
    const latestPapers=new Map(paperIds.map((id,i)=>[id,papers[i]]));
    const items=page.map(row=>{
      const creatorName=names.get(row.ownerUid)||'GTOP administrator';
      if(body.kind==='papers')return {...summary(row),creatorName};
      const latest=latestPapers.get(row.latestPaperId);
      const paper=visibleToAdmin(latest,uid)&&latest.ownerUid===row.ownerUid&&latest.conversationId===row.id?latest:null;
      return {...publicConversation(row),createdAt:row.createdAt,ownerUid:row.ownerUid,creatorName,...(paper?{title:paperConversationTitle(paper),board:paper.board,standard:paper.standard,subject:paper.subject,academicYear:paper.academicYear}:{})};
    });
    const last=page.at(-1);
    const nextCursor=rows.length<=50?null:legacyOrder?last.id:
      libraryCursorPrefix+Buffer.from(JSON.stringify([body.kind,last[order.orderBy[0]],last.id])).toString('base64url');
    return {items,nextCursor};
  }
  // Authorized indexed discovery. Original papers, solutions and the existing
  // chronological library endpoint are not modified.
  async adminLibrarySearch(uid,body={}){
    await this.user({uid});
    let request,offset;
    try{
      request=normaliseCatalogueSearch(body);
      offset=decodeCatalogueCursor(body.cursor,request.signature);
    }catch(error){fail(400,'invalid_catalogue_search',String(error.message||error));}
    const migration=await this.store.get(catalogueMigrationPath);
    const columns=['paperId','title','ownerUid','nativePrivate','board','standard','subject','academicYear',
      'chapterKeys','chapterBreakdown','questionCount','questionTypeCounts','marks','format',
      'revision','familyId','parentPaperId','sourceConversationId','createdAt',
      'classificationStatus','classificationIssues','isFamilyLatest'];
    const matches=[],maxScanned=300;
    let scanned=0,exhausted=false,position=offset;
    const allowed=(row)=>{
      if(row.nativePrivate&&row.ownerUid!==uid)return false;
      if(request.filters.ownerScope==='mine'&&row.ownerUid!==uid)return false;
      const context=[row.title,row.board?.raw,row.standard?.raw,row.subject?.raw,row.academicYear,
        row.marks+' marks',...(row.chapterBreakdown||[]).map(c=>c.title)]
        .join(' ').normalize('NFKC').toLocaleLowerCase('en-IN');
      const searchTerms=context.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      return request.words.every(word=>searchTerms.includes(word));
    };
    while(scanned<maxScanned&&matches.length<=request.pageSize){
      const size=Math.min(50,maxScanned-scanned);
      const records=await this.store.list('paperCatalogue',[['lookupKeys','array-contains',request.lookupKey]],size,{
        orderBy:['createdAt','desc'],orderById:true,
        ...(position?{cursorValues:[position.createdAt,position.paperId]}:{}),select:columns
      });
      for(const record of records){
        scanned++;
        position={createdAt:record.createdAt,paperId:record.paperId};
        if(allowed(record))matches.push(record);
        if(matches.length>request.pageSize)break;
      }
      if(records.length<size){exhausted=true;break;}
    }
    const items=matches.slice(0,request.pageSize);
    const more=matches.length>request.pageSize||!exhausted;
    const last=items.at(-1)||position;
    return {items:items.map(publicCatalogueItem),
      nextCursor:more&&last?encodeCatalogueCursor(last,request.signature):null,
      indexCoverage:migration?.completed===true?'complete':'building',
      isPartial:migration?.completed!==true||(!exhausted&&matches.length<=request.pageSize),
      sortApplied:'recent',pageSize:request.pageSize};
  }
  async adminConversation(uid,id) {
    await this.user({uid});const path=ref('assistantConversations',id),c=await this.store.get(path);
    if(!visibleToAdmin(c,uid))fail(404,'not_found','Conversation unavailable.');
    const detail=await this.conversationView(c),profile=await this.store.get(ref('users',c.ownerUid));
    if(c.ownerUid!==uid&&!visibleToAdmin(await this.store.get(path),uid))fail(404,'not_found','Conversation unavailable.');
    return {...detail,readOnly:c.ownerUid!==uid,creatorName:String(profile?.displayName||profile?.name||'GTOP administrator').slice(0,120)};
  }
  async adminArtifact(uid,id,kind) {await this.user({uid});const p=await this.store.get(ref('assistantPapers',id));if(!visibleToAdmin(p,uid))fail(404,'not_found','Paper unavailable.');return this.artifact(p.ownerUid,id,kind);}
  async createConversation(uid, body) {
    const id = body.clientRequestId ? hash(`${uid}:conversation:${safeId(body.clientRequestId)}`).slice(0,40) : this.id();
    const result = await this.store.transaction(async tx => {
      const existing = await tx.get(ref('assistantConversations',id));
      if (existing) { if(existing.ownerUid !== uid) fail(404,'not_found','Conversation unavailable.'); return existing; }
      const config=await tx.get('assistantConfig/pilot');
      const c = {id,ownerUid:uid,title:'New paper conversation',status:'active',createdAt:this.iso(),updatedAt:this.iso(),requestRevision:0,...(config?.nativePapersEnabled===true?{nativePrivate:true}:{})};
      tx.create(ref('assistantConversations',id),c);this.notifyContent(tx,uid); return c;
    });
    return {conversation:publicConversation(result)};
  }
  async conversation(uid,id) {
    const c = await this.owned(uid,'assistantConversations',id);
    return this.conversationView(c,{expireLeases:true});
  }
  async conversationRevision(uid,id,admin=false){
    const c=admin?await this.store.get(ref('assistantConversations',id)):await this.owned(uid,'assistantConversations',id);
    if(!visibleToAdmin(c,uid))fail(404,'not_found','Conversation unavailable.');
    return {updatedAt:c.updatedAt};
  }
  async conversationView(c,{expireLeases=false}={}) {
    const id=c.id,uid=c.ownerUid;
    const jobFields=[...publicJobFields,'leaseUntil'];
    const [messages,jobs,papers]=await Promise.all([
      this.store.list(`assistantConversations/${id}/messages`,[],250,{orderBy:['createdAt','desc']}),
      this.store.list('assistantJobs',[['conversationId','==',id]],100,{select:jobFields}),
      this.store.list('assistantPapers',[['conversationId','==',id]],100,{select:['id','title','revision','marks','createdAt','jobId','ownerUid','conversationId','board','standard','subject','academicYear','requirements.format']})
    ]);
    const currentIds=[c.activeNativeTurnId,c.activePaperJobId,c.activeCurriculumJobId,c.pendingResumeTurnId,messages.find(m=>m.role==='user')?.jobId];
    const missing=[...new Set(currentIds.filter(jid=>jid&&!jobs.some(j=>j.id===jid)))];
    const selected=missing.length?await this.store.getSelected(missing.map(jid=>ref('assistantJobs',jid)),jobFields):[];
    const ownJobs=[...jobs,...selected].filter(j=>j?.ownerUid===uid&&j.conversationId===id);
    const now=this.now().getTime();
    const visible=expireLeases?await Promise.all(ownJobs.map(j=>leaseExpired(j,now)?this.expireOne(j.id,uid):j)):ownJobs;
    const ownPapers=papers.filter(p=>p.ownerUid===uid).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    return {conversation:{...publicConversation(c),...(ownPapers.length?{title:paperConversationTitle(ownPapers.at(-1))}:{})},messages:messages.sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),jobs:visible.filter(Boolean).map(publicJob),papers:ownPapers.map(summary)};
  }
  async submit(uid,cid,body) {
    const original = text(body.text), clientId = safeId(body.clientMessageId), mid = hash(`${uid}:${cid}:${clientId}`).slice(0,40), jid = `turn-${mid}`;
    return this.store.transaction(async tx => {
      const [c, previous, config] = await Promise.all([tx.get(ref('assistantConversations',cid)),tx.get(messagePath(cid,mid)),tx.get('assistantConfig/pilot')]);
      if (!c || c.ownerUid!==uid) fail(404,'not_found','Conversation unavailable.');
      if (previous) { if(previous.text!==original) fail(409,'idempotency_conflict','Message identifier was already used for different text.'); return {message:previous,job:publicJob(await tx.get(ref('assistantJobs',previous.jobId||jid)))}; }
      const when = this.iso();
      const message = {id:mid,conversationId:cid,role:'user',text:original,createdAt:when,jobId:jid};
      let job = {id:jid,kind:'turn',ownerUid:uid,conversationId:cid,state:'queued',phase:'waiting_for_local_assistant',createdAt:when,updatedAt:when,requestMessageId:mid,requestRevision:c.requestRevision || 0};
      const current=c.activeNativeTurnId?await tx.get(ref('assistantJobs',c.activeNativeTurnId)):null;
      const now=this.now().getTime();
      if(current&&activeStates.has(current.state)&&!leaseExpired(current,now))fail(409,'native_turn_active','Wait for the current Codex reply before sending another message.');
      if(config?.nativePapersEnabled===true||c.nativePrivate===true){
        if(!original.isWellFormed())fail(400,'invalid_text','The original message must be valid Unicode.');
        const legacy=await this.activeLegacyWork(tx,c);
        if(legacy.some(j=>!leaseExpired(j,now)))fail(409,'native_turn_active','Wait for the existing paper work in this conversation before sending another message.');
        for(const pending of [...legacy,...(current&&leaseExpired(current,now)?[current]:[])])tx.set(ref('assistantJobs',pending.id),expiredJob(pending,when));
        job={...job,native:true,inputSha256:hash(original),phase:'waiting_for_codex'};
        message.native=true;
        tx.create(messagePath(cid,mid),message);
        tx.create(ref('assistantJobs',jid),job);
        tx.set(ref('assistantConversations',cid),{...c,nativePrivate:true,activeNativeTurnId:jid,latestUserMessageId:mid,title:c.title==='New paper conversation'?original.replace(/\s+/g,' ').slice(0,80):c.title,rootRequestId:c.rootRequestId||mid,updatedAt:when});
        this.notifyDispatch(tx,uid);
        return {message,job:publicJob(job)};
      }
      const continuation=c.pendingResumeTurnId?await tx.get(ref('assistantJobs',c.pendingResumeTurnId)):null;
      let paperProposal=c.paperProposal,revision=c.requestRevision||0,taskBrief=c.taskBrief;
      const response=proposalResponse(original);
      const paper=c.activePaperJobId?await tx.get(ref('assistantJobs',c.activePaperJobId)):null;
      const research=c.activeCurriculumJobId?await tx.get(ref('assistantJobs',c.activeCurriculumJobId)):null;
      const running=[paper,research].some(j=>j&&activeStates.has(j.state));
      if(response==='accept'&&paperProposal?.status==='consumed'){
        const existing=await tx.get(ref('assistantJobs',paperProposal.generationJobId));
        if(!existing||existing.ownerUid!==uid||existing.conversationId!==cid)fail(409,'proposal_job_missing','The saved generation task is unavailable.');
        message.jobId=existing.id;job=existing;
      }else if(paperProposal?.status==='pending'){
        if(response==='accept'&&!running){
          const [profile,config,...sources]=await Promise.all([tx.get(ref('users',uid)),tx.get('assistantConfig/pilot'),...paperProposal.sourceMessageIds.map(id=>tx.get(messagePath(cid,id)))]);
          if(profile?.role!=='admin'||!config?.allowedOwnerUids?.includes(uid))fail(403,'pilot_access_required','Paper creation requires invited administrator access.');
          if(paperProposal.ownerUid!==uid||paperProposal.conversationId!==cid||!paperProposal.curriculumSnapshot||sources.some((m,i)=>!m||m.role!=='user'||m.conversationId!==cid||hash(m.text)!==paperProposal.sourceHashes[i]))fail(409,'invalid_paper_proposal','The saved proposal evidence is unavailable. Please revise the request.');
          revision++;
          job={...job,kind:'paper',operation:'generate_paper',phase:'waiting_for_codex',requestRevision:revision,rootRequestMessageId:paperProposal.rootRequestMessageId,requirements:paperProposal.requirements,curriculumSnapshot:paperProposal.curriculumSnapshot,interpretation:paperProposal.interpretation,proposedActions:['generate_paper'],confirmedProposalId:paperProposal.id};
          paperProposal={...paperProposal,status:'consumed',consumedAt:when,consumedByMessageId:mid,generationJobId:jid};
        }else if(response==='decline'){
          paperProposal={...paperProposal,status:'declined',resolvedAt:when};
          taskBrief=taskBrief?{...taskBrief,creationPaused:true,creationRequestId:null}:taskBrief;
          job.operation='proposal_declined';
        }else if(response==='ambiguous'||response==='accept')job.operation=running?'proposal_wait':'proposal_response';
        else paperProposal={...paperProposal,status:'superseded',resolvedAt:when};
      }
      // A correction/cancel invalidates the accepted work before stale delivery.
      // Questions, social acknowledgements and duplicate yes do not start work.
      if(paperProposal?.status==='consumed'&&response==='ambiguous')job.operation='proposal_status';
      if(paperProposal?.status==='consumed'&&response==='revision')paperProposal={...paperProposal,status:'superseded',resolvedAt:when};
      if(response==='decline'&&(paperProposal||taskBrief?.creationRequestId||running)){
        if(paperProposal)paperProposal={...paperProposal,status:'declined',resolvedAt:when};
        taskBrief=taskBrief?{...taskBrief,creationPaused:true,creationRequestId:null}:taskBrief;
        job.operation='proposal_declined';
      }
      if((paperProposal?.status==='superseded'&&response==='revision')||job.operation==='proposal_declined'){
        for(const active of [paper,research])if(active&&activeStates.has(active.state))tx.set(ref('assistantJobs',active.id),{...active,state:'cancelled',phase:'superseded_by_user',leaseId:null,leaseUntil:null,updatedAt:when});
      }
      tx.create(messagePath(cid,mid),message);
      if(job.id===jid){tx.create(ref('assistantJobs',jid),job);this.notifyDispatch(tx,uid);}
      else this.notifyContent(tx,uid);
      if(continuation&&activeStates.has(continuation.state))tx.set(ref('assistantJobs',continuation.id),{...continuation,state:'cancelled',phase:'superseded_by_new_message',leaseId:null,leaseUntil:null,updatedAt:when});
      if(current&&leaseExpired(current,now))tx.set(ref('assistantJobs',current.id),expiredJob(current,when));
      tx.set(ref('assistantConversations',cid),{...c,...(c.activeNativeTurnId?{activeNativeTurnId:null}:{}),...(c.nativeThreadStartedAt?{nativeLegacyContextPending:true}:{}),...(paperProposal?{paperProposal}:{}),...(taskBrief?{taskBrief}:{}),requestRevision:revision,...(job.kind==='paper'&&job.id===jid?{activePaperJobId:jid}:{}),latestUserMessageId:mid,pendingResumeTurnId:null,title:c.title==='New paper conversation'?original.replace(/\s+/g,' ').slice(0,80):c.title,rootRequestId:c.rootRequestId || mid,updatedAt:when});
      return {message,job:publicJob(job)};
    });
  }
  async activeLegacyWork(tx,c){
    const latest=c.latestUserMessageId?await tx.get(messagePath(c.id,c.latestUserMessageId)):null;
    const slots=[...new Set([c.activePaperJobId,c.activeCurriculumJobId,c.pendingResumeTurnId,latest?.jobId].filter(Boolean))];
    const jobs=await Promise.all(slots.map(async id=>{
      let j=await tx.get(ref('assistantJobs',id));
      while(j?.retryJobId)j=await tx.get(ref('assistantJobs',j.retryJobId));
      return j;
    }));
    return [...new Map(jobs.filter(j=>j&&!j.native&&j.ownerUid===c.ownerUid&&j.conversationId===c.id&&activeStates.has(j.state)).map(j=>[j.id,j])).values()];
  }
  async cancel(uid,jid) {
    return this.store.transaction(async tx => {
      const j = await tx.get(ref('assistantJobs',jid)); if(!j || j.ownerUid!==uid) fail(404,'not_found','Task unavailable.');
      if(!activeStates.has(j.state)) return {job:publicJob(j)};
      const c=await tx.get(ref('assistantConversations',j.conversationId));
      const next = {...j,state:'cancelled',phase:'cancelled_by_user',updatedAt:this.iso(),leaseId:null,leaseUntil:null};
      if(j.native&&c?.ownerUid===uid&&c.activeNativeTurnId===jid)tx.update(ref('assistantConversations',c.id),{activeNativeTurnId:null,updatedAt:next.updatedAt});
      if(!j.native&&c?.ownerUid===uid){const proposal=c.paperProposal;tx.set(ref('assistantConversations',c.id),{...c,...(proposal&&[proposal.generationJobId,proposal.sourceJobId].includes(jid)?{paperProposal:{...proposal,status:'declined',resolvedAt:this.iso()}}:{}),...(c.taskBrief?{taskBrief:{...c.taskBrief,creationPaused:true,creationRequestId:null}}:{}),updatedAt:this.iso()});}
      tx.set(ref('assistantJobs',jid),next);this.notifyContent(tx,uid); return {job:publicJob(next)};
    });
  }
  async retry(uid,jid) {
    await this.expireOne(jid,uid);
    return this.store.transaction(async tx => {
      const j = await tx.get(ref('assistantJobs',jid)); if(!j || j.ownerUid!==uid) fail(404,'not_found','Task unavailable.');
      const c = await tx.get(ref('assistantConversations',j.conversationId));
      if(j.state!=='failed' || j.retryable===false) fail(409,'retry_not_allowed','Only recoverable failed tasks can be retried.');
      if(j.retryJobId) return {job:publicJob(await tx.get(ref('assistantJobs',j.retryJobId)))};
      if(!c||c.ownerUid!==uid)fail(404,'not_found','Conversation unavailable.');
      if(j.kind==='turn'&&c.latestUserMessageId!==j.requestMessageId)fail(409,'superseded_task','Continue with the latest message in this conversation.');
      const slot=jobSlot(j);
      const native=c.activeNativeTurnId?await tx.get(ref('assistantJobs',c.activeNativeTurnId)):null;
      if(native&&activeStates.has(native.state)&&!leaseExpired(native,this.now().getTime()))fail(409,'native_turn_active','Wait for the current Codex reply before retrying another task.');
      if(j.native&&(await this.activeLegacyWork(tx,c)).some(active=>!leaseExpired(active,this.now().getTime())))fail(409,'native_turn_active','Wait for the existing paper work in this conversation before retrying this turn.');
      if(j.kind!=='turn' && (c[slot.revision]||0)!==j.requestRevision)fail(409,'superseded_task','This task has been superseded. Continue with the latest paper request.');
      const active = c[slot.id] ? await tx.get(ref('assistantJobs',c[slot.id])) : null;
      if(j.kind!=='turn' && active && active.id!==jid && activeStates.has(active.state)) fail(409,'newer_task_active','A newer paper task is active.');
      const id=this.id(), now=this.iso(), next={...j,id,state:'queued',phase:'retry_queued',createdAt:now,updatedAt:now,leaseId:null,leaseUntil:null,assignedWorkerId:null,startedAt:null,error:null,errorCode:null,elapsedSeconds:0,progress:null,retryOf:jid,retryJobId:null,...(j.native?{retryErrorCode:j.errorCode||null}:{})};
      tx.create(ref('assistantJobs',id),next); tx.set(ref('assistantJobs',jid),{...j,retryJobId:id});this.notifyDispatch(tx,uid);
      if(j.native)tx.update(ref('assistantConversations',c.id),{activeNativeTurnId:id,updatedAt:now});
      else if(j.kind!=='turn') tx.set(ref('assistantConversations',c.id),{...c,[slot.id]:id,...(j.confirmedProposalId&&c.paperProposal?.id===j.confirmedProposalId?{paperProposal:{...c.paperProposal,generationJobId:id}}:{}),updatedAt:now});
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
  async paper(uid,id) { const p=await this.owned(uid,'assistantPapers',id); const {ownerUid,conversationId,nativePrivate,...paper}=p; return {paper}; }
  async artifact(uid,id,kind) { await this.owned(uid,'assistantPapers',id); if(!['student','answers'].includes(kind))fail(404,'not_found','Artifact unavailable.');const doc=await this.store.get(`assistantPapers/${safeId(id)}/artifacts/${kind}`);if(!doc)fail(404,'not_found','Artifact unavailable.');return decodeArtifact(doc); }
  async heartbeat(worker,body) {
    if(!['ready','loading','busy','offline'].includes(body.state) || typeof body.modelReady!=='boolean')fail(400,'invalid_heartbeat','Invalid worker heartbeat.');
    await this.store.transaction(async tx=>{const current=await tx.get(ref('assistantWorkers',worker.id));if(current?.enabled!==true||!Array.isArray(current.allowedOwnerUids))fail(403,'worker_disabled','Worker pairing is disabled.');if(current.paperRuntimeMode==='codex'&&body.runtime!=='codex')fail(409,'worker_profile_required','The paired worker requires the Codex Papers runtime.');tx.set(ref('assistantWorkerHealth',worker.id),{schemaVersion:1,state:body.state,modelReady:body.modelReady,version:text(body.version,100),lastSeenAt:this.iso()});});return {ok:true};
  }
  async expireOne(id,ownerUid=null) {
    return this.store.transaction(async tx=>{
      const j=await tx.get(ref('assistantJobs',id));
      if(!j||(ownerUid!==null&&j.ownerUid!==ownerUid))return null;
      if(!leaseExpired(j,this.now().getTime()))return j;
      const c=j.native?await tx.get(ref('assistantConversations',j.conversationId)):null;
      const next=expiredJob(j,this.iso());
      tx.set(ref('assistantJobs',id),next);
      if(c?.ownerUid===j.ownerUid&&c.activeNativeTurnId===id)tx.update(ref('assistantConversations',c.id),{activeNativeTurnId:null,updatedAt:next.updatedAt});
      this.notifyContent(tx,j.ownerUid);
      return next;
    });
  }
  async claim(worker,body) {
    if(!['turn','paper'].includes(body.kind))fail(400,'invalid_kind','Invalid task kind.');
    if(claimsPaused(worker,this.now().getTime())||(worker.paperRuntimeMode==='codex'&&body.runtime!=='codex'))return {job:null};
    const wait=Math.max(0,Math.min(20,Number(body.waitSeconds)||0)),deadline=Date.now()+wait*1000;
    do {
      const candidates=(await this.store.list('assistantJobs',[['state','==','queued']],200,{select:['id','kind','native','ownerUid','createdAt']})).filter(j=>(!j.native||body.native===true)&&(j.kind===body.kind||(body.kind==='paper'&&j.kind==='curriculum'))&&worker.allowedOwnerUids.includes(j.ownerUid)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
      for(const candidate of candidates){
        const job=await this.store.transaction(async tx=>{
          const j=await tx.get(ref('assistantJobs',candidate.id));if(!j || j.state!=='queued'||(j.native&&body.native!==true))return null;
          const config=await tx.get('assistantConfig/pilot'),profile=await tx.get(ref('users',j.ownerUid)),c=await tx.get(ref('assistantConversations',j.conversationId)),currentWorker=await tx.get(ref('assistantWorkers',worker.id));
          if(!config?.allowedOwnerUids?.includes(j.ownerUid) || profile?.role!=='admin' || !c || c.ownerUid!==j.ownerUid || currentWorker?.enabled!==true || !currentWorker.allowedOwnerUids?.includes(j.ownerUid) || claimsPaused(currentWorker,this.now().getTime()) || (currentWorker.paperRuntimeMode==='codex'&&body.runtime!=='codex')) return null;
          const slot=jobSlot(j);
          if(j.native&&(c.activeNativeTurnId!==j.id||(c.nativeThreadWorkerId&&c.nativeThreadWorkerId!==worker.id)))return null;
          if(j.kind==='turn'&&c.latestUserMessageId&&c.latestUserMessageId!==j.requestMessageId){tx.set(ref('assistantJobs',j.id),{...j,state:'cancelled',phase:'superseded_by_new_message',updatedAt:this.iso()});this.notifyContent(tx,j.ownerUid);return null;}
          if(j.kind!=='turn' && (c[slot.id]!==j.id || (c[slot.revision]||0)!==j.requestRevision)){tx.set(ref('assistantJobs',j.id),{...j,state:'cancelled',phase:'superseded',updatedAt:this.iso()});this.notifyContent(tx,j.ownerUid);return null;}
          const next={...j,state:'running',phase:j.native?'codex_native_working':j.kind==='turn'?(body.runtime==='codex'?'codex_understanding_request':'local_conversation'):'codex_starting',assignedWorkerId:worker.id,leaseId:this.id(),leaseUntil:new Date(this.now().getTime()+120000).toISOString(),startedAt:this.iso(),updatedAt:this.iso()};tx.set(ref('assistantJobs',j.id),next);this.notifyContent(tx,j.ownerUid);return next;
        });
        if(job){
          try{return {job:await this.workerJob(job)};}
          catch(error){
            await this.failed(worker,job.id,{
              leaseId:job.leaseId,
              error:error instanceof HttpError?error.message:'The assistant could not load the saved request. Try again to continue.',
              retryable:!(error instanceof HttpError)||error.status>=500,
            });
            throw error;
          }
        }
      }
      if(Date.now()>=deadline)break;await this.sleep(1000);
    }while(Date.now()<deadline);
    return {job:null};
  }
  async workerJob(job) {
    const c=await this.store.get(ref('assistantConversations',job.conversationId));
    if(!c||c.ownerUid!==job.ownerUid)fail(409,'invalid_conversation','The saved request is unavailable for this task.');
    if(job.native){
      const [request,latest,migration]=await Promise.all([
        this.store.get(messagePath(c.id,job.requestMessageId)),
        c.latestPaperId?this.store.get(ref('assistantPapers',c.latestPaperId)):null,
        !c.nativeThreadStartedAt||c.nativeLegacyContextPending?this.store.list(`assistantConversations/${c.id}/messages`,[],100,{orderBy:['createdAt','desc']}):[]
      ]);
      if(request?.role!=='user'||request.conversationId!==c.id||typeof request.text!=='string'||hash(request.text)!==job.inputSha256)fail(409,'missing_original_request','The saved original message is unavailable.');
      const basePaper=workerPaper(this.domain,latest,c);
      const history=migration.filter(m=>!m.native&&m.conversationId===c.id&&m.createdAt>=(c.nativeContextImportedAt||'')&&m.createdAt<=request.createdAt&&['user','assistant'].includes(m.role)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map(({id,role,text,createdAt,paperId})=>({id,role,text,createdAt,paperId}));
      return clean({...publicJob(job),retryOf:job.retryOf,retryErrorCode:job.retryErrorCode,leaseId:job.leaseId,leaseUntil:job.leaseUntil,nativeThreadId:c.nativeThreadId||null,request:{id:request.id,text:request.text,sha256Utf8:job.inputSha256,createdAt:request.createdAt},...(basePaper?{basePaper}:{}),...(history.length?{history}:{})});
    }
    const [recent,request,active,base,latest,ownerProfile]=await Promise.all([this.store.list(`assistantConversations/${job.conversationId}/messages`,[],100,{orderBy:['createdAt','desc']}),this.store.get(messagePath(c.id,job.requestMessageId)),c.activePaperJobId?this.store.get(ref('assistantJobs',c.activePaperJobId)):null,job.basePaperId?this.store.get(ref('assistantPapers',job.basePaperId)):null,c.latestPaperId?this.store.get(ref('assistantPapers',c.latestPaperId)):null,this.store.get(ref('users',job.ownerUid))]);
    for(const p of [base,latest])if(p && (p.ownerUid!==job.ownerUid || p.conversationId!==c.id))fail(409,'invalid_paper_reference','Stored paper ownership could not be verified.');
    const root=await this.store.get(messagePath(c.id,job.rootRequestMessageId || latest?.rootRequestMessageId || c.rootRequestId));
    if(!request || !root)fail(409,'missing_original_request','Original conversation messages are unavailable.');
    // A bounded recent window must not erase the user evidence behind a brief.
    const sourceIds=[...new Set([c.taskBrief?.creationRequestId,c.taskBrief?.lastMessageId,...Object.values(c.taskBrief?.sources||{}).map(s=>s.messageId),...(job.confirmedProposalId?c.paperProposal?.sourceMessageIds||[]:[])].filter(Boolean))];
    if(sourceIds.length>160)fail(409,'brief_source_bound','Saved requirements need review before continuing.');
    const evidence=await Promise.all(sourceIds.filter(id=>!recent.some(m=>m.id===id)).map(id=>this.store.get(messagePath(c.id,safeId(id)))));
    if(evidence.some(m=>!m||m.role!=='user'||m.conversationId!==c.id))fail(409,'missing_requirement_evidence','Saved requirement evidence is unavailable. Please restate the paper requirements.');
    const all=[...new Map([root,...evidence,...recent,request].map(m=>[m.id,m])).values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const original=m=>({id:m.id,text:m.text,sha256Utf8:hash(m.text)});
    const researchActive=c.activeCurriculumJobId?await this.store.get(ref('assistantJobs',c.activeCurriculumJobId)):null;
    const checked=c.latestCurriculumId?await this.store.get(ref('assistantCurricula',c.latestCurriculumId)):null;
    const selected=checked?.ownerUid===c.ownerUid&&checked.conversationId===c.id?checked.curriculum:null;
    const pinned=job.curriculumSnapshot||base?.curriculumSnapshot||selected||latest?.curriculumSnapshot||null;
    const history=all.filter(m=>m.createdAt<=request.createdAt);
    const brief=buildTaskBrief({request,history,context:{taskBrief:c.taskBrief,latestPaper:latest}});
    const confirmationRequired=!!brief.creationRequestId&&!brief.creationPaused&&!activeStates.has(active?.state)&&(pendingPaperTurns({history,taskBrief:brief,context:{latestPaper:latest}})>=3||job.operation==='confirm_paper'||!!job.resumedFromCurriculumJobId);
    return clean({...publicJob(job),operation:job.operation,retryOf:job.retryOf,leaseId:job.leaseId,leaseUntil:job.leaseUntil,request:{...original(request),createdAt:request.createdAt},rootRequest:original(root),history,profile:{displayName:typeof ownerProfile?.displayName==='string'?ownerProfile.displayName:'',preferences:c.memory?.preferences || []},context:{latestPaperId:c.latestPaperId || null,latestPaper:latest || null,activeRequirements:active?.requirements || latest?.requirements || null,taskBrief:c.taskBrief||null,curriculum:pinned,researchOutcomes:c.researchOutcomes||[],paperProposal:c.paperProposal||null},controllerFacts:{confirmationRequired,permissions:{routinePaperWork:true,development:false,deployment:false,destructiveOperations:false,bankWrites:false},activePaperJob:publicJob(active),activeCurriculumJob:publicJob(researchActive),availableData:{bankConnector:false,curriculum:pinned}},requirements:job.requirements,curriculumSnapshot:job.curriculumSnapshot,interpretation:job.interpretation,proposedActions:job.proposedActions,basePaper:base,targetQuestionNumber:job.targetQuestionNumber});
  }
  async turnBrief(worker,job,body,input){
    if(job.kind!=='turn')return null;
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
  async leased(tx,worker,id,leaseId,existing=null) {
    const j=existing||await tx.get(ref('assistantJobs',id));if(!j || !worker.allowedOwnerUids.includes(j.ownerUid))fail(404,'not_found','Task unavailable.');
    if(j.assignedWorkerId!==worker.id || !leaseId || j.leaseId!==leaseId || !['running','validating'].includes(j.state) || !Number.isFinite(Date.parse(j.leaseUntil || '')) || Date.parse(j.leaseUntil || '')<=this.now().getTime())return null;
    const c=await tx.get(ref('assistantConversations',j.conversationId));
    const [config,profile,currentWorker]=await Promise.all([tx.get('assistantConfig/pilot'),tx.get(ref('users',j.ownerUid)),tx.get(ref('assistantWorkers',worker.id))]);
    if(!config?.allowedOwnerUids?.includes(j.ownerUid) || profile?.role!=='admin' || !c || c.ownerUid!==j.ownerUid || currentWorker?.enabled!==true || !currentWorker.allowedOwnerUids?.includes(j.ownerUid))return null;
    const slot=jobSlot(j);
    if(j.native&&(c.activeNativeTurnId!==id||(c.nativeThreadWorkerId&&c.nativeThreadWorkerId!==worker.id)))return null;
    if(j.kind==='turn'&&c.latestUserMessageId&&c.latestUserMessageId!==j.requestMessageId)return null;
    if(j.kind!=='turn' && (c?.[slot.id]!==j.id || (c[slot.revision]||0)!==j.requestRevision))return null;
    return {job:j,conversation:c};
  }
  async bindNativeThread(worker,id,body){
    const threadId=nativeThreadId(body.threadId);
    return this.store.transaction(async tx=>{
      const active=await this.leased(tx,worker,id,body.leaseId);if(!active)return {active:false};
      const {job,conversation:c}=active;
      if(!job.native)fail(409,'invalid_transition','Only native Codex turns can bind a thread.');
      const path=nativeThreadPath(threadId),binding=await tx.get(path);
      if(c.nativeThreadId&&c.nativeThreadId!==threadId||binding&&(binding.ownerUid!==c.ownerUid||binding.conversationId!==c.id||binding.workerId!==worker.id))fail(409,'native_thread_conflict','This conversation already has a different Codex thread binding.');
      if(!binding)tx.create(path,{ownerUid:c.ownerUid,conversationId:c.id,workerId:worker.id,createdAt:this.iso()});
      if(!c.nativeThreadId)tx.update(ref('assistantConversations',c.id),{nativeThreadId:threadId,nativeThreadWorkerId:worker.id});
      return {active:true,threadId};
    });
  }
  async renew(worker,id,body) {
    return this.store.transaction(async tx=>{
      const active=await this.leased(tx,worker,id,body.leaseId);if(!active)return {active:false};
      const {job}=active,now=this.now(),leaseUntil=new Date(now.getTime()+120000).toISOString();
      tx.update(ref('assistantJobs',id),{leaseUntil,updatedAt:now.toISOString(),elapsedSeconds:Math.max(0,Math.floor((now.getTime()-Date.parse(job.startedAt))/1000)),...(body.phase?{phase:text(body.phase,100)}:{})});
      if(body.phase&&body.phase!==job.phase)this.notifyContent(tx,job.ownerUid);
      return {active:true,leaseUntil};
    });
  }
  async event(worker,id,body) {
    if(body.state&&!['running','validating'].includes(body.state))fail(400,'invalid_transition','Only running and validating progress events are accepted.');
    const progress=body.progress;
    if(progress!==undefined&&(body.phase!=='codex_generating'||!Number.isInteger(progress?.completed)||!Number.isInteger(progress?.total)||progress.completed<0||progress.total<1||progress.completed>progress.total||progress.total>100))fail(400,'invalid_progress','Invalid paper progress.');
    return this.store.transaction(async tx=>{
      const active=await this.leased(tx,worker,id,body.leaseId);if(!active)return {active:false};
      const {job}=active;
      if(progress&&job.kind!=='paper')fail(400,'invalid_progress','Only paper tasks accept writing progress.');
      const advanced=progress&&(!job.progress||progress.total===job.progress.total&&progress.completed>job.progress.completed);
      const changed=(body.phase&&body.phase!==job.phase)||(body.state&&body.state!==job.state)||advanced;
      if(!changed&&!body.reply&&(!body.metrics||Object.keys(body.metrics).length===0))return {active:true};
      const now=this.iso(),eid=this.id();
      const nextProgress=advanced?{completed:progress.completed,total:progress.total}:null;
      tx.update(ref('assistantJobs',id),{updatedAt:now,...(body.phase?{phase:text(body.phase,100)}:{}),...(body.state?{state:body.state}:{}),...(nextProgress?{progress:nextProgress}:{})});
      tx.create(`assistantJobs/${id}/events/${eid}`,{id:eid,createdAt:now,phase:body.phase||job.phase,state:body.state||job.state,metrics:bounded(body.metrics),...(nextProgress?{progress:nextProgress}:{}),...(body.reply?{reply:text(body.reply,4000)}:{})});
      if(changed||body.reply)this.notifyContent(tx,job.ownerUid);
      return {active:true};
    });
  }
  async delegate(worker,id,body) {
    if(!['generate_paper','revise_paper','check_curriculum'].includes(body.operation))fail(400,'unsupported_operation','This capability is unavailable.');
    const requestedJob=await this.store.get(ref('assistantJobs',id));
    if(!requestedJob||!worker.allowedOwnerUids.includes(requestedJob.ownerUid))fail(404,'not_found','Task unavailable.');
    if(requestedJob.native)fail(409,'invalid_transition','Native Codex turns publish directly on completion.');
    const input=await this.workerJob(requestedJob);
    const taskBrief=await this.turnBrief(worker,requestedJob,body,input);
    let requirements;try{requirements=this.domain.validateRequirements(body.requirements) || body.requirements;}catch(error){fail(400,'invalid_requirements',error.message);}
    if(requirements.scope==='selected_chapters'&&JSON.stringify(requirements.selectedChapters)!==JSON.stringify(taskBrief?.requirements.selectedChapters))fail(400,'invalid_selection','Selected chapters must match saved user evidence.');
    if(body.operation==='generate_paper'&&taskBrief?.requirements.scope==='selected_chapters'&&requirements.scope!=='selected_chapters')fail(400,'invalid_selection','A selected-chapter request cannot be widened to the full syllabus.');
    if(body.operation==='generate_paper'&&taskBrief?.sources.marks&&requirements.marks!==taskBrief.requirements.marks)fail(400,'invalid_requirements','Paper marks must match the latest saved request.');
    if(body.operation==='check_curriculum')try{validateCurriculumScope(requirements);}catch(e){fail(400,'invalid_requirements',e.message);}
    if(body.operation==='generate_paper'&&input.controllerFacts.confirmationRequired)fail(400,'confirmation_required','This pending request needs its saved concrete confirmation before generation.');
    let curriculumSnapshot=null;
    if(body.operation!=='check_curriculum'){
      try{const base=body.basePaperId?await this.store.get(ref('assistantPapers',body.basePaperId)):null;
        if(body.operation==='revise_paper'&&base?.ownerUid===requestedJob.ownerUid)curriculumSnapshot=base.curriculumSnapshot||this.domain.curriculum;
        else curriculumSnapshot=await this.resolveCurriculum(requirements,requestedJob.conversationId,worker);
      }catch(e){fail(400,'curriculum_unavailable',e.message);}
    }
    if(body.operation==='generate_paper'&&requirements.format==='board'&&curriculumSnapshot?.paperPattern){
      const duration=curriculumSnapshot.paperPattern.durationMinutes;
      if(taskBrief.sources.durationMinutes&&requirements.durationMinutes!==duration)fail(400,'curriculum_unavailable','The requested duration differs from the verified board sections. Choose a practice format or the published duration.');
      requirements={...requirements,durationMinutes:duration};
    }
    if(curriculumSnapshot?.chapters?.length>requirements.marks)fail(400,'infeasible_marks',`This chapter list has ${curriculumSnapshot.chapters.length} chapters. Covering each with at least one attempted mark needs at least that many marks. Please increase marks or choose a smaller reviewed curriculum. `);
    if(curriculumSnapshot&&requirements.scope==='selected_chapters')requirements={...requirements,selectedChapters:curriculumSnapshot.chapters.map(c=>c.title)};
    const result=await this.store.transaction(async tx=>{
      const active=await this.leased(tx,worker,id,body.leaseId);if(!active)fail(409,'stale_lease','Task was cancelled or its lease expired.');const {job,conversation:c}=active;
      if(job.kind!=='turn')fail(409,'invalid_transition','Only conversation turns can delegate.');
      const slot=jobSlot({kind:body.operation==='check_curriculum'?'curriculum':'paper'});
      const old=c[slot.id]?await tx.get(ref('assistantJobs',c[slot.id])):null;
      if(body.operation==='check_curriculum'){
        const cached=(c.researchOutcomes||[]).find(x=>x.key===researchKey(requirements)&&Date.parse(x.expiresAt)>this.now().getTime());
        if(cached)fail(409,'research_cached','This exact curriculum/format check is cached. Continue to confirmation using its verified coverage and stated limitations.');
        if(old&&activeStates.has(old.state)&&researchKey(old.requirements)===researchKey(requirements))fail(409,'research_active','The same curriculum check is already active.');
      }
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
      tx.create(ref('assistantJobs',jid),next);this.notifyDispatch(tx,job.ownerUid);tx.set(ref('assistantJobs',id),{...job,state:'completed',phase:'delegated_to_codex',updatedAt:now,leaseId:null,leaseUntil:null,metrics:bounded(body.metrics)});tx.set(ref('assistantConversations',c.id),{...c,...(taskBrief&&(!c.taskBrief?.lastMessageAt||taskBrief.lastMessageAt>=c.taskBrief.lastMessageAt)?{taskBrief}:{}),[slot.id]:jid,[slot.revision]:revision,updatedAt:now});return next;
    });return {job:body.ackOnly===true?publicJob(result):await this.workerJob(result)};
  }
  async complete(worker,id,body) {
    const requestedJob=await this.store.get(ref('assistantJobs',id));
    if(!requestedJob||!worker.allowedOwnerUids.includes(requestedJob.ownerUid))fail(404,'not_found','Task unavailable.');
    if(requestedJob.native)return this.completeNative(worker,id,body);
    const receipt=requestedJob.kind==='paper'&&typeof body.leaseId==='string'?hash(body.leaseId):null;
    const {receiptOnly,...submission}=body;
    const requestHash=receipt?hash(domain.stable(submission)):null;
    const isReceipt=job=>receipt&&job.state==='completed'&&job.assignedWorkerId===worker.id&&job.completionLeaseSha256===receipt&&job.paperId;
    const plainConversation=body.plainConversation===true&&!body.selection&&!body.clarificationField&&!body.paperProposal&&!body.curriculumOffer;
    const input=receiptOnly!==true&&!plainConversation&&requestedJob.kind==='turn'&&requestedJob.state!=='completed'?await this.workerJob(requestedJob):null;
    const taskBrief=input?await this.turnBrief(worker,requestedJob,body,input):null;
    let proposalRequirements=null,proposalCurriculum=null;
    if(body.paperProposal){
      if(!taskBrief?.creationRequestId||taskBrief.creationPaused||missingTaskField(taskBrief))fail(400,'incomplete_paper_proposal','A concrete confirmation needs the saved paper scope first.');
      proposalRequirements=this.domain.validateRequirements({...domain.defaults,...taskBrief.requirements});
      try{proposalCurriculum=await this.resolveCurriculum(proposalRequirements,requestedJob.conversationId,worker);}
      catch(e){if(e.code!=='curriculum_unavailable'||proposalRequirements.format!=='board')throw e;proposalRequirements={...proposalRequirements,format:'practice'};proposalCurriculum=await this.resolveCurriculum(proposalRequirements,requestedJob.conversationId,worker);}
      if(proposalRequirements.format==='board'){
        const duration=proposalCurriculum.paperPattern.durationMinutes;
        if(taskBrief.sources.durationMinutes&&proposalRequirements.durationMinutes!==duration){
          proposalRequirements={...proposalRequirements,format:'practice'};
          proposalCurriculum=await this.resolveCurriculum(proposalRequirements,requestedJob.conversationId,worker);
        }else proposalRequirements.durationMinutes=duration;
      }
      if(proposalRequirements.scope==='selected_chapters')proposalRequirements={...proposalRequirements,selectedChapters:proposalCurriculum.chapters.map(c=>c.title)};
    }
    return this.store.transaction(async tx=>{
      const stored=await tx.get(ref('assistantJobs',id));
      if(stored&&isReceipt(stored)){
        const [profile,config,pairing,paper]=await Promise.all([tx.get(ref('users',stored.ownerUid)),tx.get('assistantConfig/pilot'),tx.get(ref('assistantWorkers',worker.id)),tx.get(ref('assistantPapers',stored.paperId))]);
        if(profile?.role!=='admin'||!config?.allowedOwnerUids?.includes(stored.ownerUid)||pairing?.enabled!==true||!pairing.allowedOwnerUids?.includes(stored.ownerUid)||paper?.ownerUid!==stored.ownerUid||paper.conversationId!==stored.conversationId||paper.jobId!==id)return {active:false};
        if(stored.completionRequestSha256!==requestHash)return {active:false};
        return {active:true,paperId:stored.paperId};
      }
      if(receiptOnly===true)return {active:false};
      const active=await this.leased(tx,worker,id,body.leaseId,stored);if(!active)return {active:false};const {job,conversation:c}=active;
      const now=this.iso(),mid=this.id();let paper=null,artifactStudent=null,artifactAnswers=null;
      // Read latest messages before any write: a later pause/correction must
      // prevent continuation even when its conversation turn is still queued.
      let resumeInput=null,resumeTurn=null;
      if(job.operation==='check_curriculum'&&job.resumePaperAfterCheck){
        const recent=await this.store.list(`assistantConversations/${c.id}/messages`,[],100,{orderBy:['createdAt','desc']});
        const latestUser=recent.find(m=>m.role==='user');
        if(latestUser&&(!c.latestUserMessageId||latestUser.id===c.latestUserMessageId)){
          resumeInput={request:{...latestUser,sha256Utf8:hash(latestUser.text)},history:recent.reverse(),context:{taskBrief:c.taskBrief},catalogue:{}};
          const brief=buildTaskBrief(resumeInput);
          if(brief.creationRequestId&&!brief.creationPaused&&!missingTaskField(brief)){
            const rid='resume-'+job.id;
            resumeTurn=await tx.get(ref('assistantJobs',rid));
            if(!resumeTurn)resumeTurn={id:rid,kind:'turn',operation:'confirm_paper',ownerUid:job.ownerUid,conversationId:c.id,state:'queued',phase:'waiting_for_confirmation',createdAt:now,updatedAt:now,requestMessageId:latestUser.id,requestRevision:c.requestRevision||0,resumedFromCurriculumJobId:job.id};else resumeTurn=null;
          }
        }
      }
      let checkedCurriculum=null;
      if(job.operation==='check_curriculum'){
        if(body.researchUnavailable!==true){try{domain.assertSchema(body.research,curriculumResearchSchema);checkedCurriculum=researchCurriculum(body.research,job.requirements,body.sourceProofs,{allowUnverifiedPattern:true});}catch(e){fail(400,'invalid_curriculum_check',e.message);}}
        if(body.paper)fail(400,'invalid_transition','Curriculum checks cannot publish papers.');
      }else if(job.kind==='paper'){
        if(!body.paper)fail(400,'paper_required','Paper output is required.');
        const base=job.basePaperId?await tx.get(ref('assistantPapers',job.basePaperId)):null;
        const input=this.domain.paperContent(bounded(body.paper,400000));
        try{
          const pinned=job.curriculumSnapshot||base?.curriculumSnapshot||this.domain.curriculum;
          const validation=this.domain.validatePaper(input,job.requirements,pinned);
          if(base)this.domain.validateRevision(base,input,job.targetQuestionNumber,pinned);
          paper={...input,id:this.id(),ownerUid:job.ownerUid,conversationId:c.id,requirements:job.requirements,curriculumSnapshot:pinned,rootRequestMessageId:job.rootRequestMessageId,revision:base?(base.revision || 1)+1:1,...(base?{parentPaperId:base.id}:{}),...(c.nativePrivate?{nativePrivate:true}:{}),jobId:id,createdAt:now,validation};
          artifactStudent=this.domain.renderPaper(paper,false);artifactAnswers=this.domain.renderPaper(paper,true);
        }catch(error){fail(400,'invalid_paper',error.message);}
        artifactStudent=encodeArtifact(artifactStudent,now);artifactAnswers=encodeArtifact(artifactAnswers,now);
      }else if(body.paper)fail(400,'invalid_transition','Conversation turns cannot publish papers.');
      let paperProposal=null;
      if(body.paperProposal){
        if(job.kind!=='turn'||c.latestUserMessageId!==job.requestMessageId)fail(409,'stale_paper_proposal','The request changed before confirmation.');
        const sources=input.history.filter(m=>m.role==='user');
        if(!sources.length||sources.length>160)fail(409,'proposal_source_bound','The saved request needs review before confirmation.');
        const evidence=await Promise.all(sources.map(m=>tx.get(messagePath(c.id,m.id))));
        if(evidence.some(m=>!m||m.role!=='user'||m.conversationId!==c.id))fail(409,'missing_requirement_evidence','The proposal needs saved user evidence.');
        const activePaper=c.activePaperJobId?await tx.get(ref('assistantJobs',c.activePaperJobId)):null;
        const activeResearch=c.activeCurriculumJobId?await tx.get(ref('assistantJobs',c.activeCurriculumJobId)):null;
        if([activePaper,activeResearch].some(j=>j&&activeStates.has(j.state)))fail(409,'paper_work_active','Wait for the active task before preparing another proposal.');
        if(c.paperProposal?.status==='pending')fail(409,'proposal_already_pending','The saved proposal is already awaiting a response.');
        paperProposal={id:hash(`${c.id}:${job.requestMessageId}:${JSON.stringify(proposalRequirements)}`).slice(0,40),status:'pending',ownerUid:job.ownerUid,conversationId:c.id,requirements:proposalRequirements,curriculumSnapshot:bounded(proposalCurriculum,180000),rootRequestMessageId:taskBrief.creationRequestId,sourceMessageIds:evidence.map(m=>m.id),sourceHashes:evidence.map(m=>hash(m.text)),interpretation:text(body.paperProposal.interpretation,4000),confirmationText:confirmationText(proposalRequirements,proposalCurriculum),createdAt:now,sourceJobId:id};
      }
      const reply=paperProposal?paperProposal.confirmationText:body.reply?text(body.reply,12000):(paper?'Your paper and separate worked answers are ready for your review.':'');
      if(!reply)fail(400,'reply_required','A conversational reply is required.');
      const message={id:mid,conversationId:c.id,role:'assistant',text:reply,createdAt:now,jobId:id,...(taskBrief?.pendingClarification?{clarificationField:taskBrief.pendingClarification.field}:{}),...(paper?{paperId:paper.id}:{})};
      const memory=body.memoryPatch?bounded(body.memoryPatch,4000):null;
      const original=memory?await tx.get(messagePath(c.id,job.requestMessageId)):null;
      if(memory && (Object.keys(memory).some(key=>key!=='preferences') || !Array.isArray(memory.preferences) || memory.preferences.length>12 || memory.preferences.some(p=>Object.keys(p || {}).some(key=>!['value','sourceMessageId'].includes(key)) || typeof p?.value!=='string' || p.sourceMessageId!==job.requestMessageId || p.value.length>300 || !original?.text.includes(p.value))))fail(400,'invalid_memory','Memory must quote explicit preferences from the current user message.');
      const mergedMemory=memory?{preferences:[...new Map([...(c.memory?.preferences || []),...memory.preferences].map(preference=>[preference.value.toLowerCase(),preference])).values()].slice(-12)}:null;
      const final={...job,state:'completed',phase:paper?'paper_ready_for_teacher_review':'reply_ready',updatedAt:now,leaseId:null,leaseUntil:null,metrics:bounded(body.metrics),...(paper?{paperId:paper.id,completionLeaseSha256:receipt,completionRequestSha256:requestHash}:{})};
      if(paperProposal)final.phase='awaiting_paper_confirmation';
      if(job.operation==='check_curriculum'&&body.researchUnavailable===true)final.phase='curriculum_unavailable';
      let curriculumId=null;
      if(checkedCurriculum){curriculumId=this.id();tx.create(ref('assistantCurricula',curriculumId),{id:curriculumId,ownerUid:job.ownerUid,conversationId:c.id,curriculum:checkedCurriculum,jobId:id,createdAt:now});final.phase='curriculum_checked';}
      if(paper)await stagePaperCatalogue(tx,paper,now);
      if(paper){tx.create(ref('assistantPapers',paper.id),paper);tx.create(`assistantPapers/${paper.id}/artifacts/student`,artifactStudent);tx.create(`assistantPapers/${paper.id}/artifacts/answers`,artifactAnswers);}
      if(resumeTurn){tx.create(ref('assistantJobs',resumeTurn.id),resumeTurn);this.notifyDispatch(tx,job.ownerUid);}
      else this.notifyContent(tx,job.ownerUid);
      const researchOutcome=job.operation==='check_curriculum'?{key:researchKey(job.requirements),status:checkedCurriculum?(checkedCurriculum.paperPattern?'pattern_verified':'syllabus_verified'):'unavailable',curriculumId,jobId:id,checkedAt:now,expiresAt:new Date(this.now().getTime()+86400000).toISOString(),limitations:bounded(body.research?.limitations||[reply],8000)}:null;
      tx.create(messagePath(c.id,mid),message);tx.set(ref('assistantJobs',id),final);tx.set(ref('assistantConversations',c.id),{...c,...(c.nativeThreadStartedAt?{nativeLegacyContextPending:true}:{}),...(paperProposal?{paperProposal}:{}),...(researchOutcome?{researchOutcomes:[...(c.researchOutcomes||[]).filter(x=>x.key!==researchOutcome.key),researchOutcome].slice(-8)}:{}),...(taskBrief&&(!c.taskBrief?.lastMessageAt||taskBrief.lastMessageAt>=c.taskBrief.lastMessageAt)?{taskBrief}:{}),updatedAt:now,...(paper?{latestPaperId:paper.id,title:paperConversationTitle(paper),titleSource:'generated-paper'}:{}),...(curriculumId?{latestCurriculumId:curriculumId}:{}),...(resumeTurn?{pendingResumeTurnId:resumeTurn.id}:{}),...(mergedMemory?{memory:mergedMemory}: {})});
      return {active:true,...(paper?{paperId:paper.id}:{})};
    });
  }
  async completeNative(worker,id,body){
    const proof=body.native,threadId=nativeThreadId(proof?.threadId),turnId=safeId(proof?.turnId);
    if(typeof proof.inputSha256!=='string'||!/^[a-f0-9]{64}$/.test(proof.inputSha256))fail(400,'invalid_native_receipt','The SHA-256 of the original Codex input is required.');
    const reply=text(body.reply),leaseHash=typeof body.leaseId==='string'?hash(body.leaseId):null;
    const requestHash=hash(domain.stable(body));
    const turnPath=`${nativeThreadPath(threadId)}/turns/${turnId}`;
    const delivery={threadId,turnId,inputSha256:proof.inputSha256};
    for(const key of ['model','reasoningEffort'])if(typeof proof[key]==='string'&&proof[key].length<=100)delivery[key]=proof[key];
    if(Number.isSafeInteger(proof.durationMs)&&proof.durationMs>=0)delivery.durationMs=proof.durationMs;
    return this.store.transaction(async tx=>{
      const stored=await tx.get(ref('assistantJobs',id));
      if(stored?.native&&stored.state==='completed'){
        if(stored.assignedWorkerId!==worker.id||stored.completionLeaseSha256!==leaseHash||stored.completionRequestSha256!==requestHash)return {active:false};
        const [profile,config,pairing,c,turn]=await Promise.all([tx.get(ref('users',stored.ownerUid)),tx.get('assistantConfig/pilot'),tx.get(ref('assistantWorkers',worker.id)),tx.get(ref('assistantConversations',stored.conversationId)),tx.get(turnPath)]);
        if(profile?.role!=='admin'||!config?.allowedOwnerUids?.includes(stored.ownerUid)||pairing?.enabled!==true||!pairing.allowedOwnerUids?.includes(stored.ownerUid)||c?.ownerUid!==stored.ownerUid||c.nativeThreadId!==threadId||c.nativeThreadWorkerId!==worker.id||turn?.jobId!==id)return {active:false};
        return {active:true,...stored.completionArtifacts};
      }
      const active=await this.leased(tx,worker,id,body.leaseId,stored);if(!active)return {active:false};
      const {job,conversation:c}=active;
      if(!job.native||c.nativeThreadId!==threadId||c.nativeThreadWorkerId!==worker.id)fail(409,'native_thread_required','This turn must use its saved Codex thread.');
      const [original,previousTurn,base]=await Promise.all([
        tx.get(messagePath(c.id,job.requestMessageId)),tx.get(turnPath),body.basePaperId?tx.get(ref('assistantPapers',body.basePaperId)):null
      ]);
      if(original?.role!=='user'||original.conversationId!==c.id||typeof original.text!=='string'||job.inputSha256!==proof.inputSha256||hash(original.text)!==proof.inputSha256)fail(409,'native_input_mismatch','Codex did not acknowledge the saved original message.');
      if(previousTurn)fail(409,'native_turn_already_used','This Codex turn already belongs to another saved reply.');
      if(body.basePaperId&&!workerPaper(this.domain,base,c))fail(400,'invalid_base_paper','Choose an existing, validated paper from this conversation.');
      if(body.targetQuestionNumber!=null&&(!base||!Number.isInteger(body.targetQuestionNumber)||body.targetQuestionNumber<1))fail(400,'invalid_question','Choose a valid question from a saved base paper.');
      let paper=null,completionArtifacts={},artifacts=null,notice=null;
      const now=this.iso();
      if(body.paper!=null){
        const candidate=bounded(body.paper,400000),submitted=body.requirements==null?body.requirements:bounded(body.requirements);
        try{
          const result=await nativePaper(this.domain,{
            candidate,requirements:submitted,base,targetQuestionNumber:body.targetQuestionNumber,
            resolveCurriculum:requirements=>this.resolveCurriculum(requirements,c.id,worker),
            userMessages:async()=>{
              const recent=await this.store.list(`assistantConversations/${c.id}/messages`,[],100,{orderBy:['createdAt','desc']});
              return [original,...recent].filter(m=>m.role==='user'&&m.conversationId===c.id&&m.createdAt<=original.createdAt&&typeof m.text==='string');
            }
          });
          notice=result.notice;
          paper={...result.paper,id:this.id(),ownerUid:job.ownerUid,conversationId:c.id,nativePrivate:true,requirements:result.requirements,curriculumSnapshot:bounded(result.curriculumSnapshot,180000),reportedSourceReferences:result.reportedSourceReferences,rootRequestMessageId:base?.rootRequestMessageId||original.id,revision:base?(base.revision||1)+1:1,...(base?{parentPaperId:base.id}:{}),jobId:id,createdAt:now,validation:result.validation};
          artifacts={student:encodeArtifact(this.domain.renderPaper(paper,false),now),answers:encodeArtifact(this.domain.renderPaper(paper,true),now)};
          completionArtifacts={paperId:paper.id,studentSha256:artifacts.student.sha256,answersSha256:artifacts.answers.sha256};
        }catch(error){
          if(error instanceof NativePaperError)fail(400,'invalid_paper',error.message);
          throw error;
        }
      }
      if(Date.parse(job.leaseUntil)<=this.now().getTime())return {active:false};
      const mid=this.id();
      if(paper)await stagePaperCatalogue(tx,paper,now);
      tx.create(messagePath(c.id,mid),{id:mid,conversationId:c.id,role:'assistant',text:notice?`${reply}\n\n${notice}`:reply,createdAt:now,jobId:id,native:true,...(paper?{paperId:paper.id}:{})});
      tx.create(turnPath,{...delivery,jobId:id,requestMessageId:original.id,completedAt:now});
      if(paper){
        tx.create(ref('assistantPapers',paper.id),paper);
        for(const [kind,artifact] of Object.entries(artifacts))tx.create(`assistantPapers/${paper.id}/artifacts/${kind}`,artifact);
      }
      tx.update(ref('assistantJobs',id),{state:'completed',phase:paper?'paper_ready_for_teacher_review':'reply_ready',updatedAt:now,leaseId:null,leaseUntil:null,nativeCompletion:delivery,completionLeaseSha256:leaseHash,completionRequestSha256:requestHash,completionArtifacts,...(body.metrics?{metrics:bounded(body.metrics)}:{}),...(paper?{paperId:paper.id}:{})});
      tx.update(ref('assistantConversations',c.id),{activeNativeTurnId:null,updatedAt:now,nativeThreadStartedAt:c.nativeThreadStartedAt||now,nativeContextImportedAt:now,nativeLegacyContextPending:false,...(paper?{latestPaperId:paper.id,title:paperConversationTitle(paper),titleSource:'generated-paper'}:{})});
      this.notifyContent(tx,job.ownerUid);
      return {active:true,...completionArtifacts};
    });
  }
  async failed(worker,id,body) {
    return this.store.transaction(async tx=>{
      const active=await this.leased(tx,worker,id,body.leaseId);if(!active)return {active:false};
      const {job,conversation}=active;
      const knownErrors=job.kind==='paper'||job.native?{...failedPaperMessages,...failedCodexMessages}:failedCodexMessages;
      const reported=job.native&&nativeDraftRejections.has(body.errorCode)?'paper_draft_invalid':body.errorCode;
      const errorCode=Object.hasOwn(knownErrors,reported)?reported:null;
      tx.update(ref('assistantJobs',id),{state:'failed',phase:'failed',error:errorCode?knownErrors[errorCode]:text(body.error,2000),errorCode,...(body.metrics?{metrics:bounded(body.metrics)}:{}),retryable:body.retryable!==false&&errorCode!=='paper_scope_infeasible',updatedAt:this.iso(),leaseId:null,leaseUntil:null});
      if(job.native)tx.update(ref('assistantConversations',conversation.id),{activeNativeTurnId:null,updatedAt:this.iso()});
      this.notifyContent(tx,job.ownerUid);
      return {active:true};
    });
  }
}
