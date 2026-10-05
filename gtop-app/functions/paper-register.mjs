import {createHash} from 'node:crypto';
import {FieldPath,FieldValue} from 'firebase-admin/firestore';

export const REGISTER_VERSION=1;
export const SOURCE_COLLECTIONS=['paperConversations','paperRequests','paperDrafts'];
const PREFIX={paperConversations:'c',paperRequests:'r',paperDrafts:'p'};
const text=value=>typeof value==='string'||typeof value==='number'?String(value).trim():'';
const strings=value=>Array.isArray(value)?value.map(text).filter(Boolean):[];
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,140}$/.test(value);
export const millis=value=>typeof value?.toMillis==='function'?value.toMillis():typeof value==='number'?value:typeof value==='string'?(Date.parse(value)||0):0;
// The scheduled worker can retain updatedAt while writing updatedAtIso. Use
// the latest valid recorded change, not field presence, across both writers.
const changedAt=data=>Math.max(...[data?.updatedAt,data?.updatedAtIso,data?.publishedAt].map(value=>millis(value)).filter(Number.isFinite),0);
const version=snapshot=>snapshot.updateTime?String(snapshot.updateTime.seconds)+'.'+String(snapshot.updateTime.nanoseconds).padStart(9,'0'):'';
const sourceKey=(collection,id)=>PREFIX[collection]+'-'+id;
const clean=value=>Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined));

// Whole Unicode words, with a complete ID token as well as its word components.
// This indexes only record metadata and requirements, never question bodies or HTML.
export function searchTokens(values){
  return [...new Set(values.flatMap(value=>text(value).normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}\p{M}]+(?:[_-][\p{L}\p{N}\p{M}]+)*/gu)??[])
    .flatMap(word=>[word,...word.split(/[_-]/)]).filter(word=>word.length<=240))].sort();
}
export function isReadyPaper(data){
  return data?.status==='ready'||(data?.status==='draft'&&Array.isArray(data.sections)&&data.sections.length>0&&Number(data.marks)>0&&Number(data.actualMarks)===Number(data.marks)&&!data.coverage?.gapCount);
}
function metadata(data={}){
  const setup=data.setup??data.requirement??{};
  return {board:text(data.board||setup.board),className:text(data.standard||data.className||setup.standard),subjects:strings(data.subjects||setup.subjects).length?strings(data.subjects||setup.subjects):[text(data.subject||data.primarySubject)].filter(Boolean),chapters:strings(data.chapters||setup.chapters)};
}
async function familyFor(tx,db,collection,id,data){
  if(collection==='paperConversations')return {id,kind:'chat',conversationId:id};
  if(validId(data.conversationId))return {id:data.conversationId,kind:'chat',conversationId:data.conversationId};
  if(collection==='paperRequests')return {id:'legacy-request-'+id,kind:'legacy',legacyRequestId:id};
  if(validId(data.parentRequestId)){
    const request=await tx.get(db.doc('paperRequests/'+data.parentRequestId));
    if(validId(request.data()?.conversationId))return {id:request.data().conversationId,kind:'chat',conversationId:request.data().conversationId};
    return {id:'legacy-request-'+data.parentRequestId,kind:'legacy',legacyRequestId:data.parentRequestId};
  }
  // A legacy savedDraftId is an explicit relationship, unlike matching titles.
  const links=await tx.get(db.collection('paperRequests').where('savedDraftId','==',id).limit(2));
  if(links.size===1){const request=links.docs[0];return validId(request.data().conversationId)?{id:request.data().conversationId,kind:'chat',conversationId:request.data().conversationId}:{id:'legacy-request-'+request.id,kind:'legacy',legacyRequestId:request.id};}
  return {id:'legacy-paper-'+id,kind:'legacy',legacyPaperId:id};
}
function projection(collection,id,snapshot,family){
  const data=snapshot.data(),scope=metadata(data);
  const brief=text(data.brief||data.rawBrief||data.requirements||data.description);
  const title=text(data.title||data.name||brief.slice(0,140))||'Untitled paper';
  const createdAt=millis(data.createdAt)||millis(snapshot.createTime);
  const updatedAt=changedAt(data)||createdAt;
  return clean({schemaVersion:REGISTER_VERSION,sourceCollection:collection,sourceId:id,sourceVersion:version(snapshot),familyId:family.id,...family,
    sourceKind:collection==='paperDrafts'?'paper':collection==='paperRequests'?'request':'conversation',title,brief,ownerUid:text(data.ownerUid||data.requestedBy||data.createdBy),createdAt,updatedAt,sortTime:updatedAt,
    status:text(data.status)||'draft',ready:collection==='paperDrafts'&&isReadyPaper(data),revision:Number(data.requestRevision||data.revision)||0,linkedPaperId:collection==='paperRequests'&&validId(data.savedDraftId)?data.savedDraftId:undefined,...scope,
    tokens:searchTokens([id,family.id,data.conversationId,data.parentRequestId,data.savedDraftId,title,brief,scope.board,scope.className,scope.className?'class standard '+scope.className:'',...scope.subjects,...scope.chapters,...(Array.isArray(data.chapterScopes)?data.chapterScopes:[]).flatMap(s=>[s?.subject,s?.chapter]),data.academicYear])});
}

// Always re-read the authoritative source inside the transaction. Delayed events
// and resumed backfills therefore cannot overwrite a newer projection.
export async function projectSource(db,collection,id,{refreshLinked=true}={}){
  if(!SOURCE_COLLECTIONS.includes(collection)||!validId(id))throw Error('Invalid register source.');
  const result=await db.runTransaction(async tx=>{
    const source=await tx.get(db.doc(collection+'/'+id));
    const ref=db.doc('paperRegisterSearch/'+sourceKey(collection,id)),previous=await tx.get(ref);
    if(!source.exists){if(previous.exists)tx.delete(ref);return {families:[previous.data()?.familyId].filter(Boolean),linked:[previous.data()?.linkedPaperId].filter(Boolean)};}
    const family=await familyFor(tx,db,collection,id,source.data());
    const row=projection(collection,id,source,family);
    tx.set(ref,row);
    return {families:[...new Set([previous.data()?.familyId,family.id].filter(Boolean))],linked:[...new Set([previous.data()?.linkedPaperId,row.linkedPaperId].filter(Boolean))]};
  });
  if(refreshLinked){
    for(const linkedId of result.linked??[])await projectSource(db,'paperDrafts',linkedId,{refreshLinked:false});
    if(collection==='paperRequests'){
      // An explicit parent link can exist on several immutable output revisions.
      // Re-evaluate every linked paper using bounded pages if request links change.
      let cursor;
      do{
        let query=db.collection('paperDrafts').where('parentRequestId','==',id).orderBy(FieldPath.documentId()).limit(100);
        if(cursor)query=query.startAfter(cursor);
        const page=await query.get();
        for(let offset=0;offset<page.docs.length;offset+=5)await Promise.all(page.docs.slice(offset,offset+5).map(paper=>projectSource(db,'paperDrafts',paper.id,{refreshLinked:false})));
        cursor=page.size===100?page.docs.at(-1).id:null;
      }while(cursor);
    }
  }
  for(const familyId of result.families)await refreshRegister(db,familyId);
}

export async function refreshRegister(db,familyId){
  if(!validId(familyId)&&!/^legacy-(request|paper)-[a-zA-Z0-9_-]{1,140}$/.test(familyId))return;
  await db.runTransaction(async tx=>{
    const sources=db.collection('paperRegisterSearch').where('familyId','==',familyId);
    const [recent,ready]=await Promise.all([tx.get(sources.orderBy('sortTime','desc').orderBy(FieldPath.documentId(),'desc').limit(1)),tx.get(sources.where('ready','==',true).orderBy('sortTime','desc').orderBy(FieldPath.documentId(),'desc').limit(1))]);
    const ref=db.doc('paperRegister/'+familyId);
    if(recent.empty){tx.delete(ref);return;}
    const latest=recent.docs[0].data(),paper=ready.docs[0]?.data();
    let conversation,request,requestId;
    if(latest.kind==='chat'){
      conversation=(await tx.get(db.doc('paperConversations/'+latest.conversationId))).data();
      requestId=conversation?.activeRequestId;
      if(validId(requestId))request=(await tx.get(db.doc('paperRequests/'+requestId))).data();
    }else if(latest.legacyRequestId){requestId=latest.legacyRequestId;request=(await tx.get(db.doc('paperRequests/'+requestId))).data();}
    const status=text(request?.status||conversation?.status||latest.status)||'draft';
    let clarificationText;
    if(status==='needs-info'&&latest.conversationId){
      const messages=await tx.get(db.collection('paperMessages').where('conversationId','==',latest.conversationId).orderBy('createdAt','desc').limit(10));
      clarificationText=messages.docs.map(d=>d.data()).find(m=>m.role==='agent'&&m.requestId===requestId&&text(m.text))?.text;
    }
    const scope=metadata(request),paperScope=metadata({board:paper?.board,standard:paper?.className,subjects:paper?.subjects,chapters:paper?.chapters});
    const ownerUid=text(conversation?.ownerUid||request?.requestedBy||request?.createdBy||latest.ownerUid);
    const creator=validId(ownerUid)?(await tx.get(db.doc('users/'+ownerUid))).data():undefined;
    const row=clean({id:familyId,kind:latest.kind,conversationId:latest.conversationId,legacyRequestId:latest.legacyRequestId,legacyPaperId:latest.legacyPaperId,
      title:text(conversation?.title||request?.title||paper?.title||latest.title)||'Untitled paper',ownerUid,creatorName:text(creator?.displayName||creator?.name)||undefined,
      createdAt:millis(conversation?.createdAt)||millis(request?.createdAt)||latest.createdAt,updatedAt:Math.max(changedAt(conversation),changedAt(request),latest.updatedAt),
      status,activeRequestId:requestId,requestRevision:Number(request?.revision||conversation?.revision)||0,brief:text(request?.brief||request?.rawBrief||latest.brief),
      progress:request?.progress,error:text(request?.error)||undefined,nextRunAtIso:request?.nextRunAtIso,hasReady:!!paper,
      needsAction:['needs-info','error','awaiting-review'].includes(status)||(latest.kind==='legacy'&&!!request&&status==='ready'&&!paper),
      inProgress:['queued','generating','publishing','awaiting-syllabus','awaiting-coverage','creating-questions'].includes(status),
      latestPaperId:paper?.sourceId,latestPaperTitle:paper?.title,latestPaperRevision:paper?.revision,board:scope.board||paperScope.board||latest.board,className:scope.className||paperScope.className||latest.className,
      subjects:scope.subjects.length?scope.subjects:paperScope.subjects.length?paperScope.subjects:latest.subjects,chapters:scope.chapters.length?scope.chapters:paperScope.chapters.length?paperScope.chapters:latest.chapters,clarificationText,
      schemaVersion:REGISTER_VERSION});
    tx.set(ref,row);
  });
}

export function parseRegisterQuery(query={},uid){
  const view=text(query.view)||'all';
  if(!['all','needs-action','in-progress','ready'].includes(view))throw Error('Unknown register view.');
  const q=text(query.q);if(q.length>240)throw Error('Search is limited to 240 characters.');
  const terms=searchTokens([q]);if(terms.length>24||((q.match(/\S+/g)??[]).length>8))throw Error('Use at most eight search words.');
  if(q&&!terms.length)throw Error('Enter at least one search word.');
  const limit=Math.min(30,Math.max(1,Math.floor(Number(query.limit))||30));
  const filters={view,q:q.toLocaleLowerCase('en'),mine:query.mine==='1'?uid:'',board:text(query.board).toLocaleLowerCase('en'),className:text(query.className).toLocaleLowerCase('en'),subject:text(query.subject).toLocaleLowerCase('en')};
  const signature=createHash('sha256').update(JSON.stringify({uid,filters})).digest('hex').slice(0,24);
  let cursor;
  if(query.cursor){try{cursor=JSON.parse(Buffer.from(String(query.cursor),'base64url').toString());}catch{throw Error('Invalid register continuation.');}
    if(cursor.v!==REGISTER_VERSION||cursor.signature!==signature||!Number.isFinite(cursor.time)||typeof cursor.id!=='string'||cursor.id.length>300||cursor.id.includes('/'))throw Error('This continuation belongs to a different search.');}
  return {terms,limit,filters,signature,cursor};
}
function filterRecord(item,filters){
  return (filters.view!=='needs-action'||item.needsAction)&&(filters.view!=='in-progress'||item.inProgress)&&(filters.view!=='ready'||item.hasReady)&&(!filters.mine||item.ownerUid===filters.mine)&&
    (!filters.board||text(item.board).toLocaleLowerCase('en')===filters.board)&&(!filters.className||text(item.className).toLocaleLowerCase('en')===filters.className)&&(!filters.subject||(item.subjects??[]).some(s=>text(s).toLocaleLowerCase('en')===filters.subject));
}
export async function searchRegister(db,query,uid){
  const {terms,limit,filters,signature,cursor}=parseRegisterQuery(query,uid);
  const searching=terms.length>0,sortField=searching?'sortTime':'updatedAt';
  let candidates=db.collection(searching?'paperRegisterSearch':'paperRegister');
  if(searching)candidates=candidates.where('tokens','array-contains',terms.reduce((a,b)=>a.length>=b.length?a:b));
  else{
    if(filters.view==='needs-action')candidates=candidates.where('needsAction','==',true);
    if(filters.view==='in-progress')candidates=candidates.where('inProgress','==',true);
    if(filters.view==='ready')candidates=candidates.where('hasReady','==',true);
    if(filters.mine)candidates=candidates.where('ownerUid','==',filters.mine);
  }
  candidates=candidates.orderBy(sortField,'desc').orderBy(FieldPath.documentId(),'desc');
  if(cursor)candidates=candidates.startAfter(cursor.time,cursor.id);
  const candidateLimit=searching||filters.board||filters.className||filters.subject?200:limit;
  const [page,state]=await Promise.all([candidates.limit(candidateLimit).get(),db.doc('paperRegisterState/v1').get()]);
  const items=[],seen=new Set();let scanned=0,last;
  // Fetch only matching family summaries in groups. At most 200 candidates and
  // 200 lightweight summaries are read; no full papers or HTML enter this API.
  const eligible=searching?page.docs.filter(d=>terms.every(t=>d.data().tokens?.includes(t))):[];
  const familyIds=[...new Set(eligible.map(d=>d.data().familyId))];
  const families=familyIds.length?await db.getAll(...familyIds.map(id=>db.doc('paperRegister/'+id))):[];
  const byId=new Map(families.filter(d=>d.exists).map(d=>[d.id,d.data()]));
  for(const doc of page.docs){
    scanned++;last={time:doc.data()[sortField],id:doc.id};
    const row=doc.data();if(searching&&!terms.every(t=>row.tokens?.includes(t)))continue;
    const item=searching?byId.get(row.familyId):row;
    if(!item||seen.has(item.id)||!filterRecord(item,filters))continue;
    seen.add(item.id);items.push(searching?clean({...item,matchedSourceId:row.sourceId,matchedPaperId:row.sourceKind==='paper'?row.sourceId:undefined}):item);
    if(items.length===limit)break;
  }
  const more=!!last&&(scanned<page.size||page.size===candidateLimit);
  const nextCursor=more?Buffer.from(JSON.stringify({v:REGISTER_VERSION,signature,...last})).toString('base64url'):null;
  return {items,nextCursor,indexReady:state.data()?.schemaVersion===REGISTER_VERSION&&state.data()?.ready===true,continuing:more,scanned};
}

export async function runBackfill(db,{maxDocuments=10000,pageSize=100,reset=false}={}){
  const ref=db.doc('paperRegisterState/v1');
  let state=(await ref.get()).data();
  if(reset||!state||state.schemaVersion!==REGISTER_VERSION){state={schemaVersion:REGISTER_VERSION,ready:false,phase:'project',collectionIndex:0,cursor:null,checked:0,repaired:0};await ref.set({...state,startedAt:FieldValue.serverTimestamp()});}
  if(state.ready)return {ready:true,processed:0,state};
  let processed=0;
  while(processed<maxDocuments){
    const collection=state.phase==='reconcile'?'paperRegisterSearch':SOURCE_COLLECTIONS[state.collectionIndex];
    let query=db.collection(collection).orderBy(FieldPath.documentId()).limit(Math.min(pageSize,maxDocuments-processed));
    if(state.cursor)query=query.startAfter(state.cursor);
    const page=await query.get();
    for(let offset=0;offset<page.docs.length;offset+=5){
      await Promise.all(page.docs.slice(offset,offset+5).map(async snapshot=>{
        if(state.phase==='reconcile'){
          const row=snapshot.data();
          if(SOURCE_COLLECTIONS.includes(row.sourceCollection)&&validId(row.sourceId))await projectSource(db,row.sourceCollection,row.sourceId);
          else{await snapshot.ref.delete();if(row.familyId)await refreshRegister(db,row.familyId);}
          return;
        }
        const projected=state.phase==='verify'?await db.doc('paperRegisterSearch/'+sourceKey(collection,snapshot.id)).get():null;
        if(state.phase==='verify'&&(!projected.exists||projected.data()?.sourceVersion!==version(snapshot)))state.repaired++;
        // Also rebuild the summary when the source fingerprint already matches:
        // a process could have stopped between its projection and summary writes.
        await projectSource(db,collection,snapshot.id);
      }));
    }
    processed+=page.size;state.checked+=page.size;state.cursor=page.docs.at(-1)?.id??state.cursor;
    if(page.size<Math.min(pageSize,maxDocuments-processed+page.size)){
      state.collectionIndex++;state.cursor=null;
      if(state.phase==='reconcile'){state.ready=true;state.phase='ready';}
      else if(state.collectionIndex===SOURCE_COLLECTIONS.length){
        if(state.phase==='verify'&&state.repaired===0){state.phase='reconcile';state.collectionIndex=0;}
        else{state.phase='verify';state.collectionIndex=0;state.repaired=0;}
      }
    }
    await ref.set({...state,updatedAt:FieldValue.serverTimestamp(),...(state.ready?{verifiedAt:FieldValue.serverTimestamp()}: {})},{merge:true});
    if(state.ready)break;
  }
  return {ready:state.ready,processed,state};
}
