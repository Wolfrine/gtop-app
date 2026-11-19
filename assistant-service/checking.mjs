import {createHash,randomUUID} from 'node:crypto';
import {gradingRubric,validateGrades,summarizeGrades} from './domain/checking.mjs';
import {maxCheckingPages,checkingLeaseMs} from './domain/checking-limits.mjs';

const maxPageBytes=400000,maxActive=180,maxDrafts=500,historySize=40;
const paidBudgetPath='assistantCheckingControls/paidBudget';
const lastOwnerPath=workerId=>'assistantCheckingSchedulers/'+workerId;
const orderedKey=(uid,time,id)=>uid+'/'+time+'/'+id;
const nextDay=now=>new Date(Date.parse(day(now)+'T00:00:00.000Z')+86400000).toISOString();
const sheets=(uid,paper)=>['assistantCheckingOwners',uid,'papers',paper,'sheets'].join('/');
const quota=uid=>'assistantCheckingOwners/'+uid;
const queue=id=>'assistantCheckingQueue/'+id;
const pagePath=(path,index)=>path+'/pages/'+index;
const digest=(...values)=>createHash('sha256').update(JSON.stringify(values)).digest('hex');
const day=now=>now.slice(0,10);

function jpegDimensions(bytes){
  if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)return null;
  let offset=2;
  while(offset+8<bytes.length&&bytes[offset]===0xff){
    const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2);
    if(length<2||offset+2+length>bytes.length)return null;
    if([0xc0,0xc1,0xc2].includes(marker)&&length>=8)
      return {height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};
    if(marker===0xda)return null;
    offset+=2+length;
  }
  return null;
}

export class PaperChecking {
  constructor(service,fail){this.service=service;this.store=service.store;this.fail=fail;}
  now(){return this.service.iso();}
  id(value){
    if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))this.fail(400,'invalid_id','Invalid identifier.');
    return value;
  }
  text(value,max,required=false){
    if(typeof value!=='string'||value.length>max||(required&&!value.trim()))
      this.fail(400,'invalid_text','Enter '+(required?'1 to ':'up to ')+max+' characters.');
    return value.trim();
  }
  notFound(){this.fail(404,'checking_unavailable','This answer sheet is unavailable.');}
  async rubric(paperId){
    const paper=await this.store.get('assistantPapers/'+this.id(paperId));
    if(!paper)this.fail(404,'paper_unavailable','This paper revision is unavailable.');
    const rubric=gradingRubric(paper);
    if(!rubric)this.fail(409,'rubric_unavailable','This paper revision needs saved questions with consistent mark allocations.');
    return rubric;
  }
  async teacher(method,parts,uid,body){
    const [paperId,sheetId,action,pageIndex]=parts;
    this.id(paperId);
    const collection=sheets(this.id(uid),paperId);
    if((!sheetId&&method==='GET')||(sheetId==='history'&&!action&&method==='POST')){
      let cursorValues;
      if(body.cursor){
        try{
          if(typeof body.cursor!=='string'||body.cursor.length>300)throw Error();
          cursorValues=JSON.parse(Buffer.from(body.cursor,'base64url').toString('utf8'));
          if(!Array.isArray(cursorValues)||cursorValues.length!==2||typeof cursorValues[0]!=='string'||
              !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cursorValues[0]))throw Error();
          this.id(cursorValues[1]);
        }catch{this.fail(400,'invalid_cursor','Reload the answer-sheet list.');}
      }
      const rubric=await this.rubric(paperId);
      const rows=await this.store.list(collection,[],historySize+1,{orderBy:['createdAt','desc'],orderById:true,cursorValues,
        select:['id','label','state','createdAt','updatedAt','pageCount','version','grade.awarded','grade.max','grade.pending']});
      const page=rows.slice(0,historySize);
      return {sheets:page.map(({id,label,state,createdAt,updatedAt,pageCount,version,grade})=>({
        id,label,state,createdAt,updatedAt,pageCount,version,awarded:grade?.awarded??null,
        pending:grade?.pending??null,max:grade?.max??rubric.marks
      })),rubric:{title:rubric.title,marks:rubric.marks,hasScheme:rubric.hasScheme},
        nextCursor:rows.length>historySize?Buffer.from(JSON.stringify([page.at(-1).createdAt,page.at(-1).id])).toString('base64url'):null};
    }
    if(sheetId==='finalize-ready'&&!action&&method==='POST'){
      return this.finalizeReady(uid,collection,await this.rubric(paperId),body.sheets);
    }
    if(!sheetId&&method==='POST'){
      await this.rubric(paperId);
      return this.create(uid,paperId,collection,body);
    }
    const path=collection+'/'+this.id(sheetId);
    if(!action&&method==='GET'){
      let sheet=await this.store.get(path);
      if(!sheet)this.notFound();
      if(sheet.state==='running'&&sheet.leaseUntil<=this.now()){
        await this.expire(queue(sheet.queueId));
        sheet=await this.store.get(path);
      }
      const rubric=await this.rubric(paperId);
      const {lease,leaseUntil,queueId,modelGrade,...visible}=sheet;
      if(visible.grade&&!visible.grade.sections)visible.grade={...visible.grade,...summarizeGrades(visible.grade.answers,rubric.sections)};
      return {sheet:visible,rubric:{...rubric,questions:rubric.questions.map(({alternative,...q})=>({
        ...q,alternative:alternative?.question||null,alternativeRubric:alternative
      }))}};
    }
    if(action==='pages'&&method==='GET'){
      const sheet=await this.store.get(path);
      if(!sheet)this.notFound();
      return this.page(path,sheet,Number(pageIndex));
    }
    if(action==='pages'&&method==='POST')return this.upload(path,Number(pageIndex),body);
    if(action==='delete'&&method==='POST')return this.remove(uid,path,body.version);
    if(action==='queue'&&method==='POST')return this.enqueue(uid,paperId,path,body);
    if(action==='review'&&method==='POST')return this.review(uid,path,await this.rubric(paperId),body);
    if(action==='manual'&&method==='POST')return this.manual(uid,path,await this.rubric(paperId),body);
    this.notFound();
  }
  async create(uid,paperId,collection,body){
    const id=this.id(body.id),path=collection+'/'+id;
    const label=this.text(body.label,100,true),notes=this.text(body.notes??'',1600);
    const pageCount=body.pageCount;
    if(!Number.isInteger(pageCount)||pageCount<1||pageCount>maxCheckingPages)
      this.fail(400,'invalid_pages','Add between 1 and '+maxCheckingPages+' pages.');
    return this.store.transaction(async tx=>{
      const existing=await tx.get(path),usage=await tx.get(quota(uid))||{};
      if(existing){
        if(existing.label!==label||existing.notes!==notes||existing.pageCount!==pageCount)
          this.fail(409,'sheet_conflict','This upload was already started with different details.');
        return {id};
      }
      const now=this.now(),drafts=usage.day===day(now)?usage.drafts||0:0;
      if(drafts>=maxDrafts)this.fail(429,'draft_limit','The daily answer-sheet limit has been reached.');
      const sheet={id,label,notes,pageCount,uploaded:[],state:'uploading',version:0,
        createdAt:now,updatedAt:now,queueId:digest(uid,paperId,id)};
      tx.create(path,sheet);
      tx.set(quota(uid),{...usage,active:usage.active||0,day:day(now),drafts:drafts+1});
      return {id};
    });
  }
  async upload(path,index,body){
    const {jpeg}=body;
    if(typeof jpeg!=='string'||jpeg.length>Math.ceil(maxPageBytes/3)*4||! /^[A-Za-z0-9+/]+={0,2}$/.test(jpeg))
      this.fail(400,'invalid_image','This scan page is too large or is not a JPEG.');
    const bytes=Buffer.from(jpeg,'base64'),size=jpegDimensions(bytes);
    if(jpeg!==bytes.toString('base64')||bytes.length>maxPageBytes||!size||
        Math.min(size.width,size.height)<64||Math.max(size.width,size.height)>2600)
      this.fail(400,'invalid_image','This scan page has invalid image dimensions.');
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet)this.notFound();
      this.pageIndex(sheet,index);
      const prior=sheet.uploaded.find(item=>item.index===index);
      const sha=digest(jpeg);
      if(prior?.sha===sha)return {ok:true};
      if(sheet.state!=='uploading'||prior)
        this.fail(409,'page_conflict','This page is already saved. To change the scan order, start another sheet.');
      tx.create(pagePath(path,index),{jpeg:bytes});
      tx.set(path,{...sheet,uploaded:[...sheet.uploaded,{index,sha,...size}],version:sheet.version+1,updatedAt:this.now()});
      return {ok:true};
    });
  }
  pageIndex(sheet,index){
    if(!Number.isInteger(index)||index<1||index>sheet.pageCount)this.notFound();
  }
  async page(path,sheet,index,reader=this.store){
    this.pageIndex(sheet,index);
    const page=await reader.get(pagePath(path,index));
    const descriptor=sheet.uploaded.find(item=>item.index===index);
    if(!page||!descriptor)this.notFound();
    const bytes=Buffer.from(page.jpeg,'base64');
    if(digest(bytes.toString('base64'))!==descriptor.sha)
      this.fail(409,'scan_integrity','The saved scan could not be verified. Upload the original page in a new sheet.');
    return bytes;
  }
  async enqueue(uid,paperId,path,body){
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path),usage=await tx.get(quota(uid))||{};
      if(!sheet)this.notFound();
      if(['queued','running','review','final'].includes(sheet.state))return {state:sheet.state};
      if(!['uploading','failed'].includes(sheet.state)||sheet.uploaded.length!==sheet.pageCount)
        this.fail(409,'upload_incomplete','Finish uploading all pages first.');
      if(sheet.state==='failed'&&body.version!==sheet.version)
        this.fail(409,'sheet_changed','Reopen the latest sheet before retrying.');
      const now=this.now();
      if((usage.active||0)>=maxActive)
        this.fail(429,'grading_limit','Your '+maxActive+'-sheet checking queue is full. Your uploaded pages are saved.');
      tx.set(path,{...sheet,state:'queued',version:sheet.version+1,error:null,updatedAt:now});
      tx.set(queue(sheet.queueId),{id:sheet.queueId,path,uid,paperId,state:'queued',queuedAt:now,orderKey:orderedKey(uid,now,sheet.queueId)});
      tx.set(quota(uid),{...usage,active:(usage.active||0)+1});
      this.service.notifyDispatch(tx,uid);
      return {state:'queued'};
    });
  }
  async manual(uid,path,rubric,body){
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet)this.notFound();
      const inQueue=['queued','running'].includes(sheet.state);
      const completeDraft=sheet.state==='uploading'&&sheet.uploaded?.length===sheet.pageCount;
      if((!inQueue&&!completeDraft&&sheet.state!=='failed')||sheet.version!==body.version)
        this.fail(409,'sheet_changed','Reopen the latest sheet before editing.');
      const answers=rubric.questions.map(q=>({number:q.number,status:'uncertain',awarded:null,
        choice:null,evidence:'',explanation:'Teacher review required.',anchors:[]}));
      const grade=validateGrades({answers},rubric,sheet.pageCount);
      if(inQueue){
        const usage=await tx.get(quota(uid))||{};
        tx.delete(queue(sheet.queueId));
        tx.set(quota(uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
      }
      tx.set(path,{...sheet,state:'review',grade,lease:null,leaseUntil:null,error:null,updatedAt:this.now(),version:sheet.version+1});
      this.service.notifyContent(tx,uid);
      return {ok:true};
    });
  }
  async review(uid,path,rubric,body){
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet)this.notFound();
      if(!['review','final'].includes(sheet.state)||sheet.version!==body.version)
        this.fail(409,'sheet_changed','This sheet has changed. Reopen the latest saved review.');
      let grade;
      try{grade=validateGrades(body,rubric,sheet.pageCount,{final:body.final===true});}
      catch(error){this.fail(400,'invalid_review',error.message);}
      const now=this.now(),state=body.final===true?'final':'review';
      const saved={...sheet,grade,state,version:sheet.version+1,updatedAt:now,reviewedAt:now,
        finalizedAt:state==='final'?now:null};
      tx.set(path,saved);
      this.service.notifyContent(tx,uid);
      return {grade,state,version:saved.version,finalizedAt:saved.finalizedAt};
    });
  }
  async finalizeReady(uid,collection,rubric,entries){
    if(!Array.isArray(entries)||!entries.length||entries.length>60||
        entries.some(e=>!e||!Number.isSafeInteger(e.version)||e.version<0)||
        new Set(entries.map(e=>e.id)).size!==entries.length)
      this.fail(400,'invalid_selection','Select between 1 and 60 distinct answer sheets with their current versions.');
    const items=entries.map(e=>({id:this.id(e.id),version:e.version}));
    const out={finalized:0,alreadyFinal:0,changed:0,blocked:0,results:[]};
    // Bound transaction size even for legacy sheets that embed both grade versions.
    // A repeat after a lost response reports already-final sheets without changing them.
    for(let i=0;i<items.length;i+=4){
      const group=items.slice(i,i+4);
      const results=await this.store.transaction(async tx=>{
        const [teacher,pilot]=await Promise.all([tx.get('users/'+uid),tx.get('assistantConfig/pilot')]);
        if(teacher?.role!=='admin'||!pilot?.allowedOwnerUids?.includes(uid))
          this.fail(403,'pilot_access_required','Your checking access has changed.');
        const docs=await Promise.all(group.map(e=>tx.get(collection+'/'+e.id)));
        let saved=false;
        const now=this.now();
        const statuses=group.map(({id,version},n)=>{
          const sheet=docs[n];
          if(sheet?.state==='final')return {id,status:'alreadyFinal'};
          if(!sheet||sheet.version!==version)return {id,status:'changed'};
          if(sheet.state!=='review'||!sheet.grade)return {id,status:'blocked'};
          let grade;
          try{grade=validateGrades(sheet.grade,rubric,sheet.pageCount,{final:true});}
          catch{return {id,status:'blocked'};}
          tx.set(collection+'/'+id,{...sheet,grade,state:'final',version:version+1,
            updatedAt:now,reviewedAt:now,finalizedAt:now});
          saved=true;
          return {id,status:'finalized'};
        });
        if(saved)this.service.notifyContent(tx,uid);
        return statuses;
      });
      for(const result of results){out[result.status]++;out.results.push(result);}
    }
    return out;
  }
  async remove(uid,path,version){
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet)return {deleted:true};
      if(sheet.version!==version)this.fail(409,'sheet_changed','Reopen the latest sheet before deleting it.');
      const usage=await tx.get(quota(uid))||{};
      // Uploads and completion also transact on the parent, so concurrent operations
      // retry against its removal and cannot recreate its private page documents.
      for(let i=1;i<=sheet.pageCount;i++)tx.delete(pagePath(path,i));
      if(['queued','running'].includes(sheet.state))
        tx.set(quota(uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
      tx.delete(queue(sheet.queueId));
      tx.delete(path+'/grading/original');
      tx.delete(path);
      this.service.notifyContent(tx,uid);
      return {deleted:true};
    });
  }
  async authorizedWorker(tx,workerId,uid){
    const [pairing,profile,pilot]=await Promise.all([
      tx.get('assistantWorkers/'+workerId),tx.get('users/'+uid),tx.get('assistantConfig/pilot')
    ]);
    return pairing?.enabled===true&&pairing.allowedOwnerUids?.includes(uid)&&
      profile?.role==='admin'&&pilot?.allowedOwnerUids?.includes(uid);
  }
  async worker(parts,worker,body){
    const [id,action,index]=parts;
    if(id==='claim'&&!action)return this.claim(worker,body.engine??'codex-cli');
    const key=queue(this.id(id));
    const {row,sheet,image}=await this.store.transaction(async tx=>{
      const row=await tx.get(key);
      if(!row||row.workerId!==worker.id||row.state!=='running'||row.lease!==body.lease||
          row.leaseUntil<=this.now()||!await this.authorizedWorker(tx,worker.id,row.uid))
        this.fail(409,'lease_lost','This grading lease is unavailable.');
      const sheet=await tx.get(row.path);
      if(!sheet||sheet.lease!==row.lease)this.notFound();
      if(action==='pages'){
        const bytes=await this.page(row.path,sheet,Number(index),tx);
        return {image:bytes.toString('base64')};
      }
      return {row,sheet};
    });
    if(action==='pages')return {jpeg:image};
    if(action==='complete'){
      const rubric=await this.rubric(row.paperId);
      let grade;
      try{grade=validateGrades(body,rubric,sheet.pageCount,{model:true});}
      catch(error){this.fail(400,'invalid_grade',error.message);}
      const engine=body.engine;
      if(!['codex-cli','openai-api'].includes(engine)||(row.engine&&engine!==row.engine))
        this.fail(400,'invalid_engine','The grading engine must match its reservation.');
      return this.finish(row,{state:'review',grade,modelGrade:grade,engine,error:null});
    }
    if(action==='fail')return this.finish(row,{state:'failed',
      error:'Checking could not finish. You can retry or review this sheet manually.'});
    this.notFound();
  }
  async indexLegacyRows(uid){
    const owner=await this.store.get(quota(uid));
    if(owner?.queueIndexVersion===2)return;
    const existing=await this.store.list('assistantCheckingQueue',[['uid','==',uid]],maxActive);
    for(const candidate of existing.filter(r=>r.state==='queued'?!r.orderKey:!r.runningKey)){
      await this.store.transaction(async tx=>{
        const row=await tx.get(queue(candidate.id));
        if(row?.state==='queued'&&!row.orderKey)
          tx.set(queue(row.id),{...row,orderKey:orderedKey(uid,row.queuedAt,row.id)});
        if(row?.state==='running'&&!row.runningKey)
          tx.set(queue(row.id),{...row,runningKey:orderedKey(uid,row.leaseUntil,row.id)});
      });
    }
    await this.store.transaction(async tx=>{
      const latest=await tx.get(quota(uid));
      if(latest?.queueIndexVersion!==2)tx.set(quota(uid),{...latest,queueIndexVersion:2});
    });
  }
  async claim(worker,engine='codex-cli'){
    if(!['codex-cli','openai-api'].includes(engine))this.fail(400,'invalid_engine','Unknown grading engine.');
    const [scheduler,pilot]=await Promise.all([this.store.get(lastOwnerPath(worker.id)),this.store.get('assistantConfig/pilot')]);
    const owners=[...new Set(worker.allowedOwnerUids.filter(uid=>pilot?.allowedOwnerUids?.includes(uid)))].sort();
    const offset=owners.indexOf(scheduler?.lastOwnerUid)+1;
    const now=this.now();
    let nextWake=null;
    const wakeAt=time=>{if(time&&(!nextWake||time<nextWake))nextWake=time;};
    // Each teacher's indexed head also recovers leases held by replaced workers.
    // All queue documents are live; old unindexed records are normalized only once.
    await Promise.all(owners.map(async uid=>{
      await this.indexLegacyRows(uid);
      const field='runningKey',bounds=[[field,'>=',uid+'/'],[field,'<',uid+'0']];
      const [row]=await this.store.list('assistantCheckingQueue',bounds,1,{orderBy:[field,'asc']});
      if(!row)return;
      if(row.leaseUntil<=now){
        await this.expire(queue(row.id));
        wakeAt(now);
      }else wakeAt(row.leaseUntil);
    }));
    for(const uid of [...owners.slice(offset),...owners.slice(0,offset)]){
      // A single-field range index yields the owner's oldest pending sheet.
      const bounds=[['orderKey','>=',uid+'/'],['orderKey','<',uid+'0']];
      const [candidate]=await this.store.list('assistantCheckingQueue',bounds,1,{orderBy:['orderKey','asc']});
      if(!candidate)continue;
      const result=await this.claimOne(worker.id,candidate,engine);
      if(result?.job)return {job:result.job,nextWake};
      wakeAt(result?.nextWake);
    }
    return {job:null,nextWake};
  }
  async claimOne(workerId,candidate,engine){
    return this.store.transaction(async tx=>{
      const row=await tx.get(queue(candidate.id));
      if(row?.state!=='queued'||!await this.authorizedWorker(tx,workerId,row.uid))return null;
      const [sheet,usage,paper]=await Promise.all([
        tx.get(row.path),tx.get(quota(row.uid)),tx.get('assistantPapers/'+row.paperId)
      ]);
      if(sheet?.state!=='queued')return null;
      const rubric=gradingRubric(paper);
      const now=this.now();
      if(!rubric){
        tx.delete(queue(row.id));
        tx.set(row.path,{...sheet,state:'failed',version:sheet.version+1,updatedAt:now,
          error:'This paper revision is unavailable or its mark allocations are inconsistent.'});
        tx.set(quota(row.uid),{...usage,active:Math.max(0,(usage?.active||0)-1)});
        this.service.notifyDispatch(tx,row.uid);
        return {nextWake:now};
      }
      if(engine==='openai-api'){
        const [policy,global]=await Promise.all([tx.get('assistantConfig/checking'),tx.get(paidBudgetPath)]);
        const limit=(value,defaultLimit)=>value===undefined?defaultLimit:Number.isSafeInteger(value)&&value>=0?value:0;
        const today=day(now),ownerUsed=usage?.paidDay===today?usage.paidAttempts||0:0;
        const globalUsed=global?.day===today?global.attempts||0:0;
        if(ownerUsed>=limit(policy?.paidDailyOwnerAttempts,60)||globalUsed>=limit(policy?.paidDailyProjectAttempts,120))
          return {nextWake:nextDay(now)};
        tx.set(quota(row.uid),{...usage,paidDay:today,paidAttempts:ownerUsed+1});
        tx.set(paidBudgetPath,{day:today,attempts:globalUsed+1});
      }
      const lease=randomUUID(),leaseUntil=new Date(Date.parse(now)+checkingLeaseMs(sheet.pageCount,rubric.questions.length)).toISOString();
      tx.set(queue(row.id),{...row,orderKey:null,runningKey:orderedKey(row.uid,leaseUntil,row.id),state:'running',workerId,lease,leaseUntil,engine});
      tx.set(row.path,{...sheet,state:'running',version:sheet.version+1,lease,leaseUntil,updatedAt:now});
      tx.set(lastOwnerPath(workerId),{lastOwnerUid:row.uid});
      this.service.notifyContent(tx,row.uid);
      return {job:{id:row.id,lease,leaseUntil,pageCount:sheet.pageCount,notes:sheet.notes,rubric}};
    });
  }
  async expire(path){
    const row=await this.store.get(path);
    if(row?.state==='running'&&row.leaseUntil<=this.now())
      return this.finish(row,{state:'failed',error:'The local checker stopped before saving a result. Retry or review manually.'},true);
  }
  async finish(expected,patch,expired=false){
    const path=queue(expected.id);
    return this.store.transaction(async tx=>{
      const row=await tx.get(path),sheet=await tx.get(expected.path),usage=await tx.get(quota(expected.uid))||{};
      if(row?.state!=='running'||row.lease!==expected.lease||sheet?.lease!==row.lease||
          (row.leaseUntil<=this.now())!==expired)return {active:false};
      if(!expired&&!await this.authorizedWorker(tx,row.workerId,row.uid))return {active:false};
      tx.delete(path);
      const {modelGrade,...visiblePatch}=patch;
      if(modelGrade)tx.set(row.path+'/grading/original',{grade:modelGrade,engine:patch.engine,createdAt:this.now()});
      tx.set(row.path,{...sheet,...visiblePatch,lease:null,leaseUntil:null,updatedAt:this.now(),version:sheet.version+1});
      tx.set(quota(row.uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
      this.service.notifyContent(tx,row.uid);
      return {active:true};
    });
  }
}
