import {createHash,randomUUID} from 'node:crypto';
import {gradingRubric,validateGrades} from './domain/checking.mjs';

const maxPages=12,maxPageBytes=400000,maxActive=5,maxAttempts=24,maxDrafts=30;
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
    if(!sheetId&&method==='GET'){
      const rubric=await this.rubric(paperId);
      const rows=await this.store.list(collection,[],60,{orderBy:['createdAt','desc']});
      return {sheets:rows.map(({id,label,state,createdAt,updatedAt,pageCount,grade})=>({
        id,label,state,createdAt,updatedAt,pageCount,awarded:grade?.awarded??null
      })),rubric:{title:rubric.title,marks:rubric.marks,hasScheme:rubric.hasScheme}};
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
      return {sheet:visible,rubric:{title:rubric.title,hasScheme:rubric.hasScheme,
        questions:rubric.questions.map(({number,max,question,alternative})=>({number,max,question,alternative:alternative?.question||null}))}};
    }
    if(action==='pages'&&method==='GET'){
      const sheet=await this.store.get(path);
      if(!sheet)this.notFound();
      return this.page(path,sheet,Number(pageIndex));
    }
    if(action==='pages'&&method==='POST')return this.upload(path,Number(pageIndex),body);
    if(action==='queue'&&method==='POST')return this.enqueue(uid,paperId,path,body);
    if(action==='review'&&method==='POST')return this.review(uid,path,await this.rubric(paperId),body);
    if(action==='manual'&&method==='POST')return this.manual(uid,path,await this.rubric(paperId),body);
    this.notFound();
  }
  async create(uid,paperId,collection,body){
    const id=this.id(body.id),path=collection+'/'+id;
    const label=this.text(body.label,100,true),notes=this.text(body.notes??'',1600);
    const pageCount=body.pageCount;
    if(!Number.isInteger(pageCount)||pageCount<1||pageCount>maxPages)
      this.fail(400,'invalid_pages','Add between 1 and 12 pages.');
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
      tx.set(quota(uid),{active:usage.active||0,day:day(now),drafts:drafts+1,
        attempts:usage.day===day(now)?usage.attempts||0:0});
      return {id};
    });
  }
  async upload(path,index,body){
    const {jpeg}=body;
    if(typeof jpeg!=='string'||jpeg.length>Math.ceil(maxPageBytes/3)*4||! /^[A-Za-z0-9+/]+={0,2}$/.test(jpeg))
      this.fail(400,'invalid_image','This scan page is too large or is not a JPEG.');
    const bytes=Buffer.from(jpeg,'base64'),size=jpegDimensions(bytes);
    if(bytes.length>maxPageBytes||!size||Math.min(size.width,size.height)<64||Math.max(size.width,size.height)>2600)
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
      tx.set(path,{...sheet,uploaded:[...sheet.uploaded,{index,sha,...size}],updatedAt:this.now()});
      return {ok:true};
    });
  }
  pageIndex(sheet,index){
    if(!Number.isInteger(index)||index<1||index>sheet.pageCount)this.notFound();
  }
  async page(path,sheet,index){
    this.pageIndex(sheet,index);
    const page=await this.store.get(pagePath(path,index));
    if(!page)this.notFound();
    return Buffer.from(page.jpeg,'base64');
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
      const now=this.now(),attempts=usage.day===day(now)?usage.attempts||0:0;
      if(attempts>=maxAttempts||(usage.active||0)>=maxActive)
        this.fail(429,'grading_limit','Your checking queue or daily grading limit is full.');
      tx.set(path,{...sheet,state:'queued',version:sheet.version+1,error:null,updatedAt:now});
      tx.set(queue(sheet.queueId),{id:sheet.queueId,path,uid,paperId,state:'queued',queuedAt:now});
      tx.set(quota(uid),{active:(usage.active||0)+1,day:day(now),attempts:attempts+1,
        drafts:usage.day===day(now)?usage.drafts||0:0});
      this.service.notifyDispatch(tx,uid);
      return {state:'queued'};
    });
  }
  async manual(uid,path,rubric,body){
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet)this.notFound();
      if(sheet.state!=='failed'||sheet.version!==body.version)
        this.fail(409,'sheet_changed','Reopen the latest sheet before editing.');
      const answers=rubric.questions.map(q=>({number:q.number,status:'uncertain',awarded:null,
        choice:null,evidence:'',explanation:'Teacher review required.',anchors:[]}));
      const grade=validateGrades({answers},rubric,sheet.pageCount);
      tx.set(path,{...sheet,state:'review',grade,updatedAt:this.now(),version:sheet.version+1});
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
  async worker(parts,worker,body){
    const [id,action,index]=parts;
    if(id==='claim'&&!action)return this.claim(worker);
    const row=await this.store.get(queue(this.id(id)));
    if(!row||row.workerId!==worker.id||!worker.allowedOwnerUids.includes(row.uid)||
        row.state!=='running'||row.lease!==body.lease||row.leaseUntil<=this.now())
      this.fail(409,'lease_lost','This grading lease is unavailable.');
    const sheet=await this.store.get(row.path);
    if(!sheet||sheet.lease!==row.lease)this.notFound();
    if(action==='pages'){
      const bytes=await this.page(row.path,sheet,Number(index));
      return {jpeg:bytes.toString('base64')};
    }
    if(action==='complete'){
      const rubric=await this.rubric(row.paperId);
      let grade;
      try{grade=validateGrades(body,rubric,sheet.pageCount,{model:true});}
      catch(error){this.fail(400,'invalid_grade',error.message);}
      const engine=['codex-cli','openai-api'].includes(body.engine)?body.engine:null;
      if(!engine)this.fail(400,'invalid_engine','Unknown grading engine.');
      return this.finish(row,{state:'review',grade,modelGrade:grade,engine,error:null});
    }
    if(action==='fail')return this.finish(row,{state:'failed',
      error:'Checking could not finish. You can retry or review this sheet manually.'});
    this.notFound();
  }
  async claim(worker){
    const pending=(await this.store.list('assistantCheckingQueue',[['state','in',['queued','running']]],120))
      .filter(row=>worker.allowedOwnerUids.includes(row.uid));
    const now=this.now();
    const running=pending.filter(row=>row.state==='running');
    for(const row of running.filter(row=>row.leaseUntil<=now))await this.expire(queue(row.id));
    const nextWake=running.filter(row=>row.leaseUntil>now).map(row=>row.leaseUntil).sort()[0]||null;
    const queued=pending.filter(row=>row.state==='queued').sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt));
    for(const candidate of queued){
      const rubric=await this.rubric(candidate.paperId);
      const result=await this.store.transaction(async tx=>{
        const row=await tx.get(queue(candidate.id)),sheet=await tx.get(candidate.path);
        const pairing=await tx.get('assistantWorkers/'+worker.id),profile=await tx.get('users/'+candidate.uid);
        const pilot=await tx.get('assistantConfig/pilot');
        if(row?.state!=='queued'||sheet?.state!=='queued'||pairing?.enabled!==true||
          !pairing.allowedOwnerUids?.includes(row.uid)||profile?.role!=='admin'||!pilot?.allowedOwnerUids?.includes(row.uid))return null;
        const lease=randomUUID(),leaseUntil=new Date(Date.parse(this.now())+6*60000).toISOString();
        tx.set(queue(row.id),{...row,state:'running',workerId:worker.id,lease,leaseUntil});
        tx.set(row.path,{...sheet,state:'running',lease,leaseUntil,updatedAt:this.now()});
        this.service.notifyContent(tx,row.uid);
        return {id:row.id,lease,leaseUntil,pageCount:sheet.pageCount,notes:sheet.notes,rubric};
      });
      if(result)return {job:result,nextWake};
    }
    return {job:null,nextWake};
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
      tx.delete(path);
      tx.set(row.path,{...sheet,...patch,lease:null,leaseUntil:null,updatedAt:this.now(),version:sheet.version+1});
      tx.set(quota(row.uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
      this.service.notifyContent(tx,row.uid);
      return {active:true};
    });
  }
}
