import {randomUUID} from 'node:crypto';
import {resolveStudent} from './student-directory.mjs';
import {indexStudent,linkSheetStudent,removeStudentIndex,studentHistory} from './checking-student.mjs';
import {ClassIntake} from './checking-intake.mjs';
import {ExternalReference} from './external-reference.mjs';
import {currentSheetGrade,day,digest,matchesStudentLabel,maxActive,maxDrafts,orderedKey,packets,pagePath,queue,queueField,quota,sheets,sheetFields,sheetSummary} from './checking-storage.mjs';
import {gradingRubric,validateGrades,summarizeGrades} from './domain/checking.mjs';
import {maxCheckingPages,checkingLeaseMs} from './domain/checking-limits.mjs';
import {notifySubmissionInbox,submissionPagePath} from './student-submission-storage.mjs';

import {autoReference,automaticJob,automaticReportPdf,completeAutomatic,finishAutomatic} from './automatic-checking.mjs';

const maxPageBytes=400000,historySize=40;
const paidBudgetPath='assistantCheckingControls/paidBudget';
const lastOwnerPath=workerId=>'assistantCheckingSchedulers/'+workerId;
const nextDay=now=>new Date(Date.parse(day(now)+'T00:00:00.000Z')+86400000).toISOString();
const checkingPaused=(pilot,now)=>typeof pilot?.checkingCutoverUntil==='string'&&pilot.checkingCutoverUntil>now;
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
  constructor(service,fail){
    this.service=service;this.store=service.store;this.fail=fail;
    this.packets=new ClassIntake(this);this.references=new ExternalReference(this);
  }
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
  async sourcePaper(reader,paperId,uid){
    this.id(paperId);
    if(paperId.startsWith('ext-'))return this.references.paper(reader,paperId,uid);
    const paper=await reader.get('assistantPapers/'+paperId);
    return paper?.nativePrivate&&paper.ownerUid!==uid?null:paper;
  }
  async rubric(paperId,uid,reader=this.store){
    const paper=await this.sourcePaper(reader,paperId,uid);
    if(!paper)this.fail(404,'paper_unavailable','This paper revision is unavailable.');
    const rubric=gradingRubric(paper);
    if(!rubric)this.fail(409,'rubric_unavailable','This paper revision needs saved questions with consistent mark allocations.');
    return rubric;
  }
  readCursor(cursor){
    if(!cursor)return undefined;
    try{
      if(typeof cursor!=='string'||cursor.length>300)throw Error();
      const values=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
      if(!Array.isArray(values)||values.length!==2||typeof values[0]!=='string'||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(values[0]))throw Error();
      this.id(values[1]);
      return values;
    }catch{this.fail(400,'invalid_cursor','Reload the scan list.');}
  }
  studentHistory(uid,body){return studentHistory(this,uid,body);}
  async recentWork(uid){
    const fields=['label','state','updatedAt','pageCount','grade.pending','gradeRevision','gradingRevision','packetId','packetLabel','studentUid','studentLabel','labelFromStudent','singleStudentBook'];
    const rows=await this.store.recentSheetWork(quota(this.id(uid)),['uploading','review','failed'],fields,20);
    return {sheets:rows.map(row=>({
      id:row.id,paperId:row.paperId,label:row.label,state:row.state,updatedAt:row.updatedAt,pageCount:row.pageCount,
      ...(row.labelFromStudent?{labelFromStudent:true}:{}),...(row.singleStudentBook?{singleStudentBook:true}:{}),
      pending:currentSheetGrade(row)?.pending??null,...(row.studentUid?{studentUid:row.studentUid,studentLabel:row.studentLabel}:{}),
      ...(row.packetId?{packetId:row.packetId}:{}),...(row.packetLabel?{packetLabel:row.packetLabel}:{})
    }))};
  }
  async teacher(method,parts,uid,body){
    const [paperId,sheetId,action,pageIndex]=parts;
    this.id(paperId);
    const collection=sheets(this.id(uid),paperId);
    if(sheetId==='rubric-info'&&!action&&method==='GET'){
      const {title,marks,hasScheme}=await this.rubric(paperId,uid);
      return {rubric:{title,marks,hasScheme}};
    }
    if((!sheetId&&method==='GET')||(sheetId==='history'&&!action&&method==='POST')){
      const cursorValues=this.readCursor(body.cursor);
      const rubric=await this.rubric(paperId,uid);
      const rows=await this.store.list(collection,[],historySize+1,{orderBy:['createdAt','desc'],orderById:true,cursorValues,
        select:sheetFields});
      const page=rows.slice(0,historySize);
      return {sheets:page.map(row=>sheetSummary(row,rubric.marks)),rubric:{title:rubric.title,marks:rubric.marks,hasScheme:rubric.hasScheme},
        nextCursor:rows.length>historySize?Buffer.from(JSON.stringify([page.at(-1).createdAt,page.at(-1).id])).toString('base64url'):null};
    }
    if(sheetId==='finalize-ready'&&!action&&method==='POST'){
      return this.finalizeReady(uid,collection,paperId,body.sheets);
    }
    if(!sheetId&&method==='POST'){
      await this.rubric(paperId,uid);
      return this.create(uid,paperId,collection,body);
    }
    const path=collection+'/'+this.id(sheetId);
    if(!action&&method==='GET'){
      let sheet=await this.store.get(path);
      if(!sheet||sheet.state==='deleting')this.notFound();
      if(sheet.state==='running'&&sheet.leaseUntil<=this.now()){
        await this.expire(queue(sheet.queueId));
        sheet=await this.store.get(path);
        if(!sheet||sheet.state==='deleting')this.notFound();
      }
      const rubric=await this.rubric(sheet.gradingPaperId??paperId,uid);
      const {lease,leaseUntil,queueId,modelGrade,scanSource,retiredSources,submissionUploadId,submissionUploadKind,...visible}=sheet;
      if(submissionUploadId)visible.studentSubmission=true;
      if(sheet.packetId&&!sheet.packetLabel){
        const [packet]=await this.store.getSelected([packets(uid)+'/'+this.id(sheet.packetId)],['label','paperId','scanSource']);
        visible.packetLabel=(packet?.paperId===paperId&&packet.scanSource===sheet.scanSource&&packet.label)||sheet.packetId;
      }
      if(visible.grade&&!currentSheetGrade(sheet))delete visible.grade;
      if(visible.grade&&!visible.grade.sections)visible.grade={...visible.grade,...summarizeGrades(visible.grade.answers,rubric.sections)};
      return {sheet:visible,rubric:{...rubric,questions:rubric.questions.map(({alternative,...q})=>({
        ...q,alternative:alternative?.question||null,alternativeRubric:alternative
      }))}};
    }
    if(action==='result-pdf'&&method==='GET'){
      const sheet=await this.store.get(path);
      if(!sheet?.checkingResult)this.notFound();
      return automaticReportPdf(this,path,sheet.checkingResult);
    }
    if(action==='pages'&&method==='GET'){
      const sheet=await this.store.get(path);
      if(!sheet||sheet.state==='deleting')this.notFound();
      return this.page(path,sheet,Number(pageIndex));
    }
    if(action==='pages'&&method==='POST')return this.upload(path,Number(pageIndex),body);
    if(action==='student'&&method==='POST')return linkSheetStudent(this,uid,paperId,path,body);
    if(action==='delete'&&method==='POST')return this.remove(uid,path,body.version,paperId);
    if(action==='queue'&&method==='POST')return this.enqueue(uid,paperId,path,body);
    if(action==='review'&&method==='POST')return this.review(uid,path,paperId,body);
    if(action==='manual'&&method==='POST')return this.manual(uid,path,paperId,body);
    this.notFound();
  }
  async create(uid,paperId,collection,body){
    const id=this.id(body.id),path=collection+'/'+id;
    const notes=this.text(body.notes??'',1600);
    const pageCount=body.pageCount;
    if(!Number.isInteger(pageCount)||pageCount<1||pageCount>maxCheckingPages)
      this.fail(400,'invalid_pages','Add between 1 and '+maxCheckingPages+' pages.');
    return this.store.transaction(async tx=>{
      const existing=await tx.get(path),usage=await tx.get(quota(uid))||{};
      if(existing){
        const label=this.text(body.label||existing.studentLabel,100,true);
        if((existing.studentUid??null)!==(body.studentUid??null)||existing.label!==label||existing.notes!==notes||existing.pageCount!==pageCount)
          this.fail(409,'sheet_conflict','This upload was already started with different details.');
        return {id};
      }
      const student=body.studentUid==null?{}:await resolveStudent(tx,body.studentUid);
      const label=this.text(body.label||student.studentLabel,100,true);
      const now=this.now(),drafts=usage.day===day(now)?usage.drafts||0:0;
      if(drafts>=maxDrafts)this.fail(429,'draft_limit','The daily answer-sheet limit has been reached.');
      const sheet={id,label,...student,...(matchesStudentLabel(label,student.studentLabel)?{labelFromStudent:true}:{}),notes,pageCount,uploaded:[],state:'uploading',version:0,
        createdAt:now,updatedAt:now,queueId:digest(uid,paperId,id)};
      tx.create(path,sheet);
      indexStudent(tx,uid,sheet,'sheet',paperId);
      tx.set(quota(uid),{...usage,active:usage.active||0,day:day(now),drafts:drafts+1});
      this.service.notifyContent(tx,uid);
      return {id};
    });
  }
  imagePath(path,record,index){
    if(!record.scanSource)return pagePath(path,index);
    const uid=path.split('/')[1];
    return pagePath(quota(uid)+'/scanSources/'+this.id(record.scanSource),index);
  }
  scan(body){
    const {jpeg}=body;
    if(typeof jpeg!=='string'||jpeg.length>Math.ceil(maxPageBytes/3)*4||! /^[A-Za-z0-9+/]+={0,2}$/.test(jpeg))
      this.fail(400,'invalid_image','This scan page is too large or is not a JPEG.');
    const bytes=Buffer.from(jpeg,'base64'),size=jpegDimensions(bytes);
    if(jpeg!==bytes.toString('base64')||bytes.length>maxPageBytes||!size||
        Math.min(size.width,size.height)<64||Math.max(size.width,size.height)>2600)
      this.fail(400,'invalid_image','This scan page has invalid image dimensions.');
    return {bytes,size,sha:digest(jpeg)};
  }
  async upload(path,index,body){
    const {bytes,size,sha}=this.scan(body);
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet||sheet.state==='deleting')this.notFound();
      this.pageIndex(sheet,index);
      const prior=sheet.uploaded.find(item=>item.index===index);
      if(prior?.sha===sha)return {ok:true};
      if(sheet.state!=='uploading'||prior)
        this.fail(409,'page_conflict','This page is already saved. To change the scan order, start another sheet.');
      tx.create(this.imagePath(path,sheet,index),{jpeg:bytes});
      tx.set(path,{...sheet,uploaded:[...sheet.uploaded,{index,sha,...size}],version:sheet.version+1,updatedAt:this.now()});
      return {ok:true};
    });
  }
  pageIndex(sheet,index){
    if(!Number.isInteger(index)||index<1||index>sheet.pageCount)this.notFound();
  }
  async page(path,sheet,index,reader=this.store){
    this.pageIndex(sheet,index);
    const descriptor=sheet.uploaded.find(item=>item.index===index);
    if(!descriptor)this.notFound();
    const imagePath=sheet.submissionUploadId
      ? submissionPagePath(sheet.submissionUploadId,descriptor.sourceRevision,sheet.submissionUploadKind,descriptor.sourceIndex??index)
      : this.imagePath(path,sheet,descriptor.sourceIndex??index);
    const page=await reader.get(imagePath);
    if(!page||!descriptor)this.notFound();
    const bytes=Buffer.from(page.jpeg,'base64');
    if(digest(bytes.toString('base64'))!==descriptor.sha)
      this.fail(409,'scan_integrity','The saved scan could not be verified. Upload the original page in a new sheet.');
    return bytes;
  }
  async enqueue(uid,paperId,path,body,kind='grading'){
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path),usage=await tx.get(quota(uid))||{};
      if(!sheet)this.notFound();
      if(sheet.automatic&&sheet.checkingResult)return {state:sheet.state};
      if(['queued','running','review','final','ready','completed'].includes(sheet.state))return {state:sheet.state};
      if(!['uploading','failed'].includes(sheet.state)||sheet.uploaded.length!==sheet.pageCount)
        this.fail(409,'upload_incomplete','Finish uploading all pages first.');
      if(sheet.state==='failed'&&body.version!==sheet.version)
        this.fail(409,'sheet_changed','Reopen the latest sheet before retrying.');
      if(sheet.submissionUploadId&&!sheet.automatic)
        this.fail(409,'legacy_submission','This older submission needs its original delivery workflow.');
      const autoKind=kind==='grading'?'auto-grade':kind==='external-exam'?'auto-print-reference':kind;
      const now=this.now();
      if((usage.active||0)>=maxActive)
        this.fail(429,'grading_limit','Your '+maxActive+'-sheet checking queue is full. Your uploaded pages are saved.');
      tx.set(path,{...sheet,automatic:automaticJob(autoKind),state:'queued',version:sheet.version+1,error:null,updatedAt:now});
      tx.set(queue(sheet.queueId),{id:sheet.queueId,path,uid,paperId:sheet.gradingPaperId??paperId,state:'queued',queuedAt:now,kind:autoKind,[queueField(autoKind)]:orderedKey(uid,now,sheet.queueId)});
      tx.set(quota(uid),{...usage,active:(usage.active||0)+1});
      this.service.notifyDispatch(tx,uid);
      return {state:'queued'};
    });
  }
  async manual(uid,path,paperId,body){
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet)this.notFound();
      if(sheet.automatic)this.fail(409,'automatic_checking','This sheet is evaluated and returned automatically.');
      const inQueue=['queued','running'].includes(sheet.state);
      const completeDraft=sheet.state==='uploading'&&sheet.uploaded?.length===sheet.pageCount;
      if((!inQueue&&!completeDraft&&sheet.state!=='failed')||sheet.version!==body.version)
        this.fail(409,'sheet_changed','Reopen the latest sheet before editing.');
      const rubric=await this.rubric(sheet.gradingPaperId??paperId,uid,tx);
      const answers=rubric.questions.map(q=>({number:q.number,status:'uncertain',awarded:null,
        choice:null,evidence:'',explanation:'Teacher review required.',anchors:[]}));
      const grade=validateGrades({answers},rubric,sheet.pageCount);
      if(inQueue){
        const usage=await tx.get(quota(uid))||{};
        tx.delete(queue(sheet.queueId));
        tx.set(quota(uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
      }
      tx.set(path,{...sheet,state:'review',grade,gradeRevision:sheet.gradingRevision??1,lease:null,leaseUntil:null,error:null,updatedAt:this.now(),version:sheet.version+1});
      if(sheet.submissionUploadId)notifySubmissionInbox(tx,this.now());
      this.service.notifyContent(tx,uid);
      return {ok:true};
    });
  }
  async review(uid,path,paperId,body){
    return this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet)this.notFound();
      if(sheet.automatic||!['review','final'].includes(sheet.state)||sheet.version!==body.version)
        this.fail(409,'sheet_changed','This sheet has changed. Reopen the latest saved review.');
      const rubric=await this.rubric(sheet.gradingPaperId??paperId,uid,tx);
      let grade;
      try{grade=validateGrades(body,rubric,sheet.pageCount,{final:body.final===true});}
      catch(error){this.fail(400,'invalid_review',error.message);}
      const now=this.now(),state=body.final===true?'final':'review';
      const saved={...sheet,grade,gradeRevision:sheet.gradingRevision??1,state,version:sheet.version+1,updatedAt:now,reviewedAt:now,
        finalizedAt:state==='final'?now:null};
      tx.set(path,saved);
      if(sheet.submissionUploadId)notifySubmissionInbox(tx,now);
      this.service.notifyContent(tx,uid);
      return {grade,state,version:saved.version,finalizedAt:saved.finalizedAt};
    });
  }
  async finalizeReady(uid,collection,paperId,entries){
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
        const paperIds=[...new Set(docs.filter(sheet=>sheet?.state==='review').map(sheet=>sheet.gradingPaperId??paperId))];
        const rubrics=new Map(await Promise.all(paperIds.map(async id=>[id,await this.rubric(id,uid,tx)])));
        let saved=false,linkedSubmission=false;
        const now=this.now();
        const statuses=group.map(({id,version},n)=>{
          const sheet=docs[n];
          if(sheet?.state==='final')return {id,status:'alreadyFinal'};
          if(!sheet||sheet.version!==version)return {id,status:'changed'};
          if(sheet.state!=='review'||!currentSheetGrade(sheet))return {id,status:'blocked'};
          const rubric=rubrics.get(sheet.gradingPaperId??paperId);
          let grade;
          try{grade=validateGrades(sheet.grade,rubric,sheet.pageCount,{final:true});}
          catch{return {id,status:'blocked'};}
          tx.set(collection+'/'+id,{...sheet,grade,state:'final',version:version+1,
            updatedAt:now,reviewedAt:now,finalizedAt:now});
          saved=true;
          if(sheet.submissionUploadId)linkedSubmission=true;
          return {id,status:'finalized'};
        });
        if(saved)this.service.notifyContent(tx,uid);
        if(linkedSubmission)notifySubmissionInbox(tx,now);
        return statuses;
      });
      for(const result of results){out[result.status]++;out.results.push(result);}
    }
    return out;
  }
  async remove(uid,path,version,paperId){
    const clean=await this.store.transaction(async tx=>{
      const sheet=await tx.get(path);
      if(!sheet)return false;
      if(sheet.state==='deleting')return true;
      if(sheet.submissionUploadId)this.fail(409,'student_submission_locked','The student’s original submission and review are kept together. Manage this sheet from Submissions.');
      if(sheet.version!==version)this.fail(409,'sheet_changed','Reopen the latest sheet before deleting it.');
      const usage=await tx.get(quota(uid))||{};
      if(['queued','running'].includes(sheet.state))
        tx.set(quota(uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
      tx.delete(queue(sheet.queueId));
      tx.delete(path+'/grading/original');
      tx.delete(path+'/grading/before-correction');
      removeStudentIndex(tx,uid,sheet,'sheet',paperId);
      tx.set(path,{...sheet,state:'deleting',lease:null,leaseUntil:null,deleting:0,version:sheet.version+1});
      this.service.notifyContent(tx,uid);
      return true;
    });
    if(clean)await this.cleanPages(uid,path);
    return {deleted:true};
  }
  async cleanPages(uid,path){
    // Keep each delete transaction under Firestore's 10 MiB limit, including image bytes.
    // A durable cursor and parent lock allow concurrent deletion or retries after a lost reply.
    let done=false;
    while(!done){
      done=await this.store.transaction(async tx=>{
        const record=await tx.get(path);
        if(!record||record.state!=='deleting')return true;
        // Student-uploaded originals belong to the immutable submission revision.
        const pages=record.submissionUploadId?[]:[...record.uploaded,...(record.retiredSources||[])];
        const next=pages.slice(record.deleting,record.deleting+8);
        for(const info of next)tx.delete(this.imagePath(path,record,info.sourceIndex??info.index));
        const cursor=record.deleting+next.length;
        if(cursor<pages.length){tx.set(path,{...record,deleting:cursor});return false;}
        tx.delete(path);
        this.service.notifyContent(tx,uid);
        return true;
      });
    }
  }
  async authorizedOwner(tx,uid){
    const [profile,pilot]=await Promise.all([tx.get('users/'+uid),tx.get('assistantConfig/pilot')]);
    return profile?.role==='admin'&&pilot?.allowedOwnerUids?.includes(uid);
  }
  async authorizedWorker(tx,workerId,uid,{claim=false}={}){
    const [pairing,profile,pilot]=await Promise.all([
      tx.get('assistantWorkers/'+workerId),tx.get('users/'+uid),tx.get('assistantConfig/pilot')
    ]);
    return (!claim||!checkingPaused(pilot,this.now()))&&pairing?.enabled===true&&pairing.allowedOwnerUids?.includes(uid)&&
      profile?.role==='admin'&&pilot?.allowedOwnerUids?.includes(uid);
  }
  async worker(parts,worker,body){
    const [id,action,index]=parts;
    if(id==='claim'&&!action)return this.claim(worker,body.engine??'codex-cli',body.capabilities);
    const key=queue(this.id(id));
    const {row,sheet,image}=await this.store.transaction(async tx=>{
      const row=await tx.get(key);
      if(!row||row.workerId!==worker.id||row.state!=='running'||row.lease!==body.lease||
          row.leaseUntil<=this.now()||!await this.authorizedWorker(tx,worker.id,row.uid))
        this.fail(409,'lease_lost','This grading lease is unavailable.');
      const sheet=await tx.get(row.path);
      if(!sheet||sheet.lease!==row.lease)this.notFound();
      if(action==='pages'){
        if(row.kind==='class-intake'){
          const {firstPage,lastPage}=this.packets.job(sheet);
          if(Number(index)<Math.max(1,firstPage-1)||Number(index)>lastPage)this.notFound();
        }
        const bytes=await this.page(row.path,sheet,Number(index),tx);
        return {image:bytes.toString('base64')};
      }
      return {row,sheet};
    });
    if(action==='pages')return {jpeg:image};
    if(action==='complete'){
      const engine=body.engine;
      if(!['codex-cli','openai-api'].includes(engine)||(row.engine&&engine!==row.engine))
        this.fail(400,'invalid_engine','The checking engine must match its reservation.');
      if(automaticJob(row.kind))return completeAutomatic(this,row,sheet,body);
      if(row.kind==='class-intake')return this.packets.complete(row,body);
      if(row.kind==='external-exam')return this.finish(row,await this.references.complete(body,sheet));
      const rubric=await this.rubric(row.paperId,row.uid);
      let grade;
      try{grade=validateGrades(body,rubric,sheet.pageCount,{model:true});}
      catch(error){this.fail(400,'invalid_grade',error.message);}
      return this.finish(row,{state:'review',grade,modelGrade:grade,engine,error:null});
    }
    if(action==='fail'){
      if(automaticJob(row.kind))return finishAutomatic(this,row,sheet,{
        message:body.reason==='scan_unavailable'
          ? 'At least one saved scan page could not be retrieved or verified. No mark was issued.'
          : 'Automatic checking could not complete after recovery. No mark was issued.'
      });
      return this.finish(row,{state:'failed',error:'Checking could not finish. You can retry or review this sheet manually.'});
    }
    this.notFound();
  }
  async indexLegacyRows(uid){
    const owner=await this.store.get(quota(uid));
    if(owner?.queueIndexVersion===2)return;
    const existing=await this.store.list('assistantCheckingQueue',[['uid','==',uid]],maxActive);
    for(const candidate of existing.filter(r=>r.state==='queued'?!r[queueField(r.kind)]:!r.runningKey)){
      await this.store.transaction(async tx=>{
        const row=await tx.get(queue(candidate.id));
        if(row?.state==='queued'&&!row[queueField(row.kind)])
          tx.set(queue(row.id),{...row,[queueField(row.kind)]:orderedKey(uid,row.queuedAt,row.id)});
        if(row?.state==='running'&&!row.runningKey)
          tx.set(queue(row.id),{...row,runningKey:orderedKey(uid,row.leaseUntil,row.id)});
      });
    }
    await this.store.transaction(async tx=>{
      const latest=await tx.get(quota(uid));
      if(latest?.queueIndexVersion!==2)tx.set(quota(uid),{...latest,queueIndexVersion:2});
    });
  }
  async claim(worker,engine='codex-cli',capabilities=[]){
    if(!['codex-cli','openai-api'].includes(engine))this.fail(400,'invalid_engine','Unknown grading engine.');
    const [scheduler,pilot]=await Promise.all([this.store.get(lastOwnerPath(worker.id)),this.store.get('assistantConfig/pilot')]);
    if(checkingPaused(pilot,this.now()))return {job:null,nextWake:pilot.checkingCutoverUntil};
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
    const supportsAutomatic=engine==='codex-cli'&&Array.isArray(capabilities)&&capabilities.includes('automatic-checking-v1');
    for(const uid of [...owners.slice(offset),...owners.slice(0,offset)]){
      // A single-field range index yields the owner's oldest pending sheet.
      const fields=['orderKey'];
      if(supportsAutomatic)
        fields.push('automaticOrderKey');
      if(Array.isArray(capabilities)&&capabilities.includes('class-intake-v1'))fields.push('intakeOrderKey');
      if(Array.isArray(capabilities)&&capabilities.includes('external-exam-v1'))fields.push('referenceOrderKey');
      const heads=await Promise.all(fields.map(field=>this.store.list('assistantCheckingQueue',
        [[field,'>=',uid+'/'],[field,'<',uid+'0']],1,{orderBy:[field,'asc']})));
      const [candidate]=heads.flat().sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt)||a.id.localeCompare(b.id));
      if(!candidate)continue;
      const result=await this.claimOne(worker.id,candidate,engine,supportsAutomatic);
      if(result?.job)return {job:result.job,nextWake};
      wakeAt(result?.nextWake);
    }
    return {job:null,nextWake};
  }
  async claimOne(workerId,candidate,engine,supportsAutomatic){
    return this.store.transaction(async tx=>{
      const row=await tx.get(queue(candidate.id));
      if(row?.state!=='queued'||automaticJob(row.kind)&&!supportsAutomatic||!await this.authorizedWorker(tx,workerId,row.uid,{claim:true}))return null;
      const reference=row.kind==='external-exam'||autoReference(row.kind);
      const auto=automaticJob(row.kind);
      const special=row.kind==='class-intake'||reference;
      const [sheet,usage,paper]=await Promise.all([
        tx.get(row.path),tx.get(quota(row.uid)),special?null:this.sourcePaper(tx,row.paperId,row.uid)
      ]);
      if(sheet?.state!=='queued')return null;
      let rubric=special?null:gradingRubric(paper);
      if(auto&&sheet.rubricDigest&&rubric&&sheet.rubricDigest!==digest(rubric))rubric=null;
      const now=this.now();
      if(!special&&!rubric&&!auto){
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
      const detail=row.kind==='class-intake'?this.packets.job(sheet):reference?this.references.claimJob(sheet):{notes:sheet.notes,rubric};
      const imageCount=row.kind==='class-intake'?detail.lastPage-Math.max(1,detail.firstPage-1)+1:sheet.pageCount;
      const questionBudget=reference?50:rubric?.questions.length??1;
      const lease=randomUUID(),leaseUntil=new Date(Date.parse(now)+checkingLeaseMs(imageCount,questionBudget)).toISOString();
      tx.set(queue(row.id),{...row,...(auto?{rubricDigest:rubric?digest(rubric):null}:{}),[queueField(row.kind)]:null,runningKey:orderedKey(row.uid,leaseUntil,row.id),state:'running',workerId,lease,leaseUntil,engine});
      tx.set(row.path,{...sheet,state:'running',version:sheet.version+1,lease,leaseUntil,updatedAt:now});
      tx.set(lastOwnerPath(workerId),{lastOwnerUid:row.uid});
      if(sheet.submissionUploadId&&!autoReference(row.kind))notifySubmissionInbox(tx,now);
      this.service.notifyContent(tx,row.uid);
      return {job:{id:row.id,lease,leaseUntil,pageCount:sheet.pageCount,...(special?{kind:reference?'external-exam':row.kind}:{}),...(auto?{automatic:true}:{}),...detail}};
    });
  }
  async expire(path){
    const row=await this.store.get(path);
    if(row?.state!=='running'||row.leaseUntil>this.now())return;
    if(!automaticJob(row.kind))
      return this.finish(row,{state:'failed',error:'The local checker stopped before saving a result. Retry or review manually.'},true);
    const sheet=await this.store.get(row.path);
    if(!sheet||sheet.lease!==row.lease)return;
    if(!row.recoveryCount){
      return this.store.transaction(async tx=>{
        const [current,live]=await Promise.all([tx.get(path),tx.get(row.path)]);
        if(current?.lease!==row.lease||current.leaseUntil>this.now()||live?.lease!==row.lease)return;
        const now=this.now();
        tx.set(path,{...current,state:'queued',recoveryCount:1,lease:null,leaseUntil:null,runningKey:null,
          [queueField(current.kind)]:orderedKey(row.uid,row.queuedAt,row.id)});
        tx.update(row.path,{state:'queued',lease:null,leaseUntil:null,version:live.version+1,updatedAt:now});
        if(live.submissionUploadId&&!autoReference(row.kind))notifySubmissionInbox(tx,now);
        this.service.notifyDispatch(tx,row.uid);
      });
    }
    return finishAutomatic(this,row,sheet,{expired:true,message:'The local checker stopped twice before producing a usable assessment.'});
  }
  async finish(expected,patch,expired=false,finalize){
    const path=queue(expected.id);
    return this.store.transaction(async tx=>{
      const row=await tx.get(path),sheet=await tx.get(expected.path),usage=await tx.get(quota(expected.uid))||{};
      if(row?.state!=='running'||row.lease!==expected.lease||sheet?.lease!==row.lease||
          (row.leaseUntil<=this.now())!==expired)return {active:false};
      if(!expired&&!await this.authorizedWorker(tx,row.workerId,row.uid))return {active:false};
      if(expired&&automaticJob(row.kind)&&!await this.authorizedOwner(tx,row.uid)){
        tx.delete(path);
        tx.update(row.path,{state:'failed',error:'The checking authorization changed.',lease:null,leaseUntil:null,
          updatedAt:this.now(),version:sheet.version+1});
        tx.set(quota(row.uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
        return {active:false};
      }
      const action=finalize?await finalize(tx,row,sheet):{};
      if(!action)return {active:false};
      tx.delete(path);
      const {modelGrade,...visiblePatch}=patch;
      if(modelGrade){
        visiblePatch.gradeRevision=sheet.gradingRevision??1;
        tx.set(row.path+'/grading/original',{grade:modelGrade,gradingRevision:visiblePatch.gradeRevision,
          gradingPaperId:row.paperId,engine:patch.engine,createdAt:this.now()});
      }
      const now=this.now();
      tx.set(row.path,{...sheet,...visiblePatch,lease:null,leaseUntil:null,updatedAt:now,version:sheet.version+1});
      if(sheet.submissionUploadId&&!automaticJob(row.kind))notifySubmissionInbox(tx,now);
      if(action.transferred)this.service.notifyDispatch(tx,row.uid);
      else{
        tx.set(quota(row.uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
        this.service.notifyContent(tx,row.uid);
      }
      return {active:true};
    });
  }
}
