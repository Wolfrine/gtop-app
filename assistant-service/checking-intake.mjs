import {randomUUID} from 'node:crypto';
import {resolveStudent} from './student-directory.mjs';
import {indexStudent,removeStudentIndex} from './checking-student.mjs';
import {recheckClass} from './checking-rekey.mjs';
import {correctPacket} from './checking-correction.mjs';
import {isAnonymous,intakeChunkSize,suggestIntakeGroups,validateIntakePages} from './domain/checking-intake.mjs';
import {maxCheckingPages} from './domain/checking-limits.mjs';
import {day,digest,matchesStudentLabel,maxActive,maxDrafts,orderedKey,packets,queue,quota,sheets,sheetFields,sheetSummary} from './checking-storage.mjs';

const maxPages=200,historySize=40;
const summaryFields=['id','label','pageCount','expectedStudents','paperId','state','version','processedPages','createdAt','updatedAt','groupCount','error','studentUid','studentLabel'];
const identity=record=>record.studentUid?{studentUid:record.studentUid,studentLabel:record.studentLabel}:{};
const singleGroup=packet=>[{...identity(packet),label:packet.studentLabel,labelFromStudent:true,
  pages:Array.from({length:packet.pageCount},(_,i)=>i+1),needsReview:false,reason:''}];
const visible=record=>{
  const {lease,leaseUntil,queueId,readings,deleting,scanSource,lastCorrection,lastRecheck,...packet}=record;
  return packet;
};

export class ClassIntake {
  constructor(checking){this.checking=checking;this.store=checking.store;this.fail=checking.fail;}
  async teacher(method,uid,id,action,index,body){
    const collection=packets(this.checking.id(uid));
    if((!id&&method==='GET')||(id==='history'&&method==='POST'))return this.history(collection,body.cursor);
    if(!id&&method==='POST')return this.create(uid,collection,body);
    const path=collection+'/'+this.checking.id(id);
    if(!action&&method==='GET'){
      let packet=await this.store.get(path);
      if(!packet)this.checking.notFound();
      if(packet.state==='running'&&packet.leaseUntil<=this.checking.now()){
        await this.checking.expire(queue(packet.queueId));
        packet=await this.store.get(path);
        if(!packet)this.checking.notFound();
      }
      return {packet:visible(packet)};
    }
    if(action==='pages'&&method==='POST')return this.checking.upload(path,Number(index),body);
    if(action==='pages'&&method==='GET'){
      const packet=await this.store.get(path);
      if(!packet||packet.state==='deleting')this.checking.notFound();
      return this.checking.page(path,packet,Number(index));
    }
    if(action==='results'&&method==='GET')return this.results(uid,path);
    if(method!=='POST')this.checking.notFound();
    if(action==='correct')return correctPacket(this,uid,path,body);
    if(action==='recheck')return recheckClass(this,uid,path,body);
    if(action==='manual')return this.manual(uid,path,body.version);
    if(action==='reference')return this.attach(uid,path,body);
    if(action==='organize'){
      const record=await this.store.get(path);
      if(record?.studentUid)return this.manual(uid,path,body.version??record.version);
      await this.checking.enqueue(uid,null,path,body,'class-intake');
      return {packet:visible(await this.store.get(path))};
    }
    if(action==='save'||action==='confirm')return this.review(uid,path,body,action==='confirm');
    if(action==='delete')return this.remove(uid,path,body.version);
    this.checking.notFound();
  }
  async history(collection,cursor){
    const cursorValues=this.checking.readCursor(cursor);
    const found=await this.store.list(collection,[],historySize+1,{orderBy:['createdAt','desc'],orderById:true,cursorValues,select:summaryFields});
    const page=found.slice(0,historySize),last=page.at(-1);
    return {packets:page,nextCursor:found.length>historySize?Buffer.from(JSON.stringify([last.createdAt,last.id])).toString('base64url'):null};
  }
  async create(uid,collection,body){
    const id=this.checking.id(body.id),path=collection+'/'+id;
    const label=this.checking.text(body.label??'Class scan',100,true);
    const linked=body.studentUid!=null;
    const expectedStudents=body.expectedStudents??(linked?1:null),pageCount=body.pageCount,knownStarts=body.knownStarts??[];
    if(linked&&(expectedStudents!==1||pageCount>maxCheckingPages))
      this.fail(400,'booklet_size','Upload one student book of up to '+maxCheckingPages+' pages.');
    if(!Number.isInteger(pageCount)||pageCount<1||pageCount>maxPages)
      this.fail(400,'packet_size','Choose a class scan with 1–'+maxPages+' pages.');
    if(expectedStudents!==null&&(!Number.isInteger(expectedStudents)||expectedStudents<1||expectedStudents>maxActive))
      this.fail(400,'student_count','Enter the number of students who took the test.');
    if(!Array.isArray(knownStarts)||knownStarts.length>pageCount||knownStarts.some(n=>!Number.isInteger(n)||n<1||n>pageCount)||new Set(knownStarts).size!==knownStarts.length)
      this.fail(400,'invalid_starts','Check the booklet starting pages.');
    const starts=[...knownStarts].sort((a,b)=>a-b);
    if(linked&&starts.some(n=>n!==1))this.fail(400,'invalid_starts','One student book begins on page 1.');
    const paperId=body.paperId?this.checking.id(body.paperId):null;
    if(paperId)await this.checking.rubric(paperId,uid);
    return this.store.transaction(async tx=>{
      const existing=await tx.get(path);
      if(existing){
        if((existing.studentUid??null)!==(body.studentUid??null)||existing.label!==label||existing.pageCount!==pageCount||existing.expectedStudents!==expectedStudents||
            JSON.stringify(existing.knownStarts)!==JSON.stringify(starts)||(paperId&&existing.paperId!==paperId))
          this.fail(409,'packet_conflict','The original upload has different details. Reopen it or start a new class scan.');
        return {packet:visible(existing)};
      }
      const student=linked?await resolveStudent(tx,body.studentUid):{};
      const usage=await tx.get(quota(uid))||{},now=this.checking.now();
      const drafts=usage.day===day(now)?usage.drafts||0:0;
      if(drafts>=maxDrafts)this.fail(429,'draft_limit','The daily checking upload limit has been reached.');
      const packet={id,label,...student,...(linked?{singleStudentBook:true,labelFromStudent:matchesStudentLabel(label,student.studentLabel)}:{}),scanSource:randomUUID(),pageCount,expectedStudents,knownStarts:starts,paperId,uploaded:[],groups:[],groupCount:0,
        state:'uploading',processedPages:0,version:0,createdAt:now,updatedAt:now,error:null,queueId:digest(uid,'class-intake',id)};
      tx.create(path,packet);
      indexStudent(tx,uid,packet,'packet');
      tx.set(quota(uid),{...usage,day:day(now),drafts:drafts+1});
      this.checking.service.notifyContent(tx,uid);
      return {packet:visible(packet)};
    });
  }
  job(record){
    const firstPage=record.processedPages+1,lastPage=Math.min(record.pageCount,firstPage+intakeChunkSize-1);
    return {firstPage,lastPage,knownStarts:record.knownStarts||[],expectedStudents:record.expectedStudents};
  }
  async complete(row,body){
    return this.store.transaction(async tx=>{
      const current=await tx.get(queue(row.id)),packet=await tx.get(row.path),usage=await tx.get(quota(row.uid))||{};
      if(current?.state!=='running'||current.lease!==row.lease||packet?.lease!==row.lease||
          current.leaseUntil<=this.checking.now()||!await this.checking.authorizedWorker(tx,current.workerId,row.uid))return {active:false};
      const {firstPage,lastPage}=this.job(packet);
      let slice;
      try{slice=validateIntakePages(body,firstPage,lastPage);}
      catch(error){this.fail(400,'invalid_intake_reading',error.message);}
      const readings=[...(packet.readings||[]),...slice],now=this.checking.now();
      const finished=lastPage===packet.pageCount;
      const groups=finished?(packet.studentUid?singleGroup(packet):suggestIntakeGroups(readings,packet)):[];
      const next={...packet,readings:finished?[]:readings,groups,groupCount:groups.length,processedPages:lastPage,
        state:finished?'review':'queued',updatedAt:now,version:packet.version+1,lease:null,leaseUntil:null,error:null};
      tx.set(row.path,next);
      if(finished){
        tx.delete(queue(row.id));
        tx.set(quota(row.uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
      }else{
        tx.set(queue(row.id),{id:row.id,uid:row.uid,paperId:null,path:row.path,kind:'class-intake',state:'queued',
          queuedAt:now,intakeOrderKey:orderedKey(row.uid,now,row.id)});
      }
      this.checking.service.notifyDispatch(tx,row.uid);
      return {active:true};
    });
  }
  async manual(uid,path,version){
    return this.store.transaction(async tx=>{
      const record=await tx.get(path);
      if(!record||record.state==='deleting')this.checking.notFound();
      if(record.state==='review')return {packet:visible(record)};
      if(record.version!==version||!['uploading','queued','running','failed'].includes(record.state))
        this.fail(409,'packet_changed','Reopen the current class scan before grouping it.');
      if(record.uploaded.length!==record.pageCount)this.fail(409,'upload_incomplete','Finish uploading the class scan first.');
      const waiting=['queued','running'].includes(record.state);
      const usage=waiting?await tx.get(quota(uid)):null;
      const groups=record.studentUid?singleGroup(record):
        record.readings?.length?suggestIntakeGroups(record.readings,{knownStarts:record.knownStarts}):[];
      const packet={...record,state:'review',lease:null,leaseUntil:null,readings:[],groups,groupCount:groups.length,
        version:record.version+1,updatedAt:this.checking.now(),error:null};
      if(waiting){
        tx.delete(queue(record.queueId));
        tx.set(quota(uid),{...usage,active:Math.max(0,(usage?.active||0)-1)});
      }
      tx.set(path,packet);
      this.checking.service.notifyDispatch(tx,uid);
      return {packet:visible(packet)};
    });
  }
  visible(record){return visible(record);}
  groups(raw,packet,final){
    const {pageCount}=packet;
    if(packet.studentUid&&(!Array.isArray(raw)||raw.length!==1||raw[0]?.held===true))
      this.fail(400,'single_student_book','Keep all pages in the selected student’s book.');
    if(!Array.isArray(raw)||!raw.length||raw.length>maxActive)this.fail(400,'invalid_booklets','Add at least one answer book.');
    const assigned=new Set(),labels=new Set();
    const groups=raw.map((g,i)=>{
      if(!g||typeof g!=='object'||!Array.isArray(g.pages)||g.pages.length>pageCount)
        this.fail(400,'invalid_booklet','Check the pages assigned to book '+(i+1)+'.');
      if(g.held!==undefined&&typeof g.held!=='boolean')this.fail(400,'booklet_identity','Choose whether to hold the book for identification.');
      if(final&&(!g.pages.length||g.pages.length>maxCheckingPages))
        this.fail(400,'booklet_size','Each book needs 1–'+maxCheckingPages+' pages before checking.');
      if(final&&!g.held&&g.needsReview===true)
        this.fail(400,'booklet_review','Confirm the identity and pages of book '+(i+1)+' before starting checking.');
      const label=this.checking.text(g.label||packet.studentLabel||(g.held===true?'Unidentified copy '+String(i+1).padStart(2,'0'):''),100,final);
      const key=label.normalize('NFKC').toLocaleLowerCase();
      if(final&&!packet.studentUid&&!g.held&&isAnonymous(label))this.fail(400,'booklet_identity','Enter the student identifier or hold this book for identification.');
      if(final&&!g.held&&labels.has(key))this.fail(400,'duplicate_label','Give each student a distinct label, such as a roll number.');
      if(!g.held)labels.add(key);
      for(const n of g.pages){
        if(!Number.isInteger(n)||n<1||n>pageCount||assigned.has(n))
          this.fail(400,'page_assignment','Assign each scan page to exactly one book.');
        assigned.add(n);
      }
      return {label,...identity(packet),...(matchesStudentLabel(label,packet.studentLabel)?{labelFromStudent:true}:{}),pages:[...g.pages],...(g.held===true?{held:true}:{}),needsReview:!final&&g.needsReview===true,
        reason:final?'':this.checking.text(g.reason??'',600)};
    });
    if(final&&assigned.size!==pageCount)this.fail(400,'missing_pages','Assign all '+pageCount+' pages before starting checking.');
    return groups;
  }
  async attach(uid,path,body){
    const paperId=this.checking.id(body.paperId);
    return this.store.transaction(async tx=>{
      const record=await tx.get(path);
      if(!record||record.state==='deleting')this.checking.notFound();
      if(record.paperId===paperId)return {packet:visible(record)};
      if(record.state==='completed'||record.version!==body.version)
        this.fail(409,'packet_changed','Reopen the current class scan before changing the question paper.');
      await this.checking.rubric(paperId,uid,tx);
      const packet={...record,paperId,updatedAt:this.checking.now(),version:record.version+1};
      tx.set(path,packet);
      this.checking.service.notifyContent(tx,uid);
      return {packet:visible(packet)};
    });
  }
  async review(uid,path,body,final){
    return this.store.transaction(async tx=>{
      const packet=await tx.get(path);
      if(!packet)this.checking.notFound();
      if(final&&packet.state==='completed'){
        const replay=this.groups(body.groups,packet,true);
        const sameBooks=replay.length===packet.groups.length&&replay.every((group,i)=>{
          const original=packet.groups[i];
          return original.label===group.label&&!!original.held===!!group.held&&original.pages.length===group.pages.length&&
            original.pages.every((page,j)=>page===group.pages[j]);
        });
        if((body.paperId??packet.paperId)!==packet.paperId||!sameBooks)
          this.fail(409,'packet_changed','This class has already been sent with a different page assignment.');
        return {packet:visible(packet)};
      }
      if(!['uploading','review','failed'].includes(packet.state)||packet.version!==body.version)
        this.fail(409,'packet_changed','Reopen the current class scan before saving changes.');
      if(packet.uploaded.length!==packet.pageCount)this.fail(409,'upload_incomplete','Finish uploading the scan first.');
      const paperId=body.paperId?this.checking.id(body.paperId):packet.paperId;
      const groups=this.groups(body.groups,packet,final),now=this.checking.now();
      if(final&&!paperId)this.fail(400,'choose_paper','Choose or upload the question paper before starting checking.');
      if(paperId)await this.checking.rubric(paperId,uid,tx);
      if(final){
        const usage=await tx.get(quota(uid))||{},drafts=usage.day===day(now)?usage.drafts||0:0;
        const ready=groups.filter(g=>!g.held).length;
        if((usage.active||0)+ready>maxActive||drafts+groups.length>maxDrafts)
          this.fail(429,'grading_limit','The checking queue is full. This class scan is saved; try again later.');
        const byIndex=new Map(packet.uploaded.map(p=>[p.index,p]));
        removeStudentIndex(tx,uid,packet,'packet');
        for(const [i,group] of groups.entries()){
          const id='book-'+digest(uid,packet.scanSource,i).slice(0,40),source=sheets(uid,paperId)+'/'+id,queueId=digest(uid,paperId,id);
          const uploaded=group.pages.map((n,j)=>({...byIndex.get(n),index:j+1,sourceIndex:byIndex.get(n).sourceIndex??n}));
          const sheet={id,label:group.label,...identity(group),...(packet.studentUid?{singleStudentBook:true}:{}),...(group.labelFromStudent?{labelFromStudent:true}:{}),packetId:packet.id,packetLabel:packet.label,scanSource:packet.scanSource,pageCount:uploaded.length,uploaded,notes:'',state:group.held?'held':'queued',
            version:1,createdAt:now,updatedAt:now,queueId};
          tx.create(source,sheet);
          indexStudent(tx,uid,sheet,'sheet',paperId);
          if(!group.held)tx.create(queue(queueId),{id:queueId,path:source,uid,paperId,state:'queued',queuedAt:now,orderKey:orderedKey(uid,now,queueId)});
          group.sheetId=id;
        }
        tx.set(quota(uid),{...usage,day:day(now),drafts:drafts+groups.length,active:(usage.active||0)+ready});
        this.checking.service.notifyDispatch(tx,uid);
      }else this.checking.service.notifyContent(tx,uid);
      const next={...packet,readings:[],paperId,state:final?'completed':'review',groups,groupCount:groups.length,
        error:null,version:packet.version+1,updatedAt:now};
      tx.set(path,next);
      return {packet:visible(next)};
    });
  }
  async results(uid,path){
    return this.store.transaction(async tx=>{
      const packet=await tx.get(path);
      if(!packet||packet.state!=='completed')this.checking.notFound();
      const gradingPaperId=packet.gradingPaperId??packet.paperId;
      const {title,marks,hasScheme}=await this.checking.rubric(gradingPaperId,uid,tx);
      const paths=packet.groups.map(g=>sheets(uid,packet.paperId)+'/'+g.sheetId);
      const records=await tx.getSelected(paths,sheetFields);
      const byId=new Map(records.filter(s=>s?.packetId===packet.id).map(s=>[s.id,s]));
      const register=packet.groups.map(group=>{
        const sheet=byId.get(group.sheetId);
        if(sheet&&!group.withdrawn&&sheet.state!=='deleting'&&sheet.state!=='withdrawn')return sheetSummary(sheet,marks);
        return {id:group.sheetId,packetId:packet.id,label:group.label,...identity(group),...(group.labelFromStudent?{labelFromStudent:true}:{}),...(packet.studentUid?{singleStudentBook:true}:{}),pageCount:group.pages.length,
          state:'withdrawn',version:sheet?.state==='withdrawn'?sheet.version:-1,awarded:null,pending:null,max:marks};
      });
      return {paperId:packet.paperId,gradingPaperId,gradingRevision:packet.gradingRevision??1,packetLabel:packet.label,version:packet.version,sheets:register,
        rubric:{title,marks,hasScheme},nextCursor:null};
    });
  }
  async remove(uid,path,version){
    const result=await this.store.transaction(async tx=>{
      const packet=await tx.get(path);
      if(!packet)return {done:true};
      if(packet.state==='deleting')return {done:false};
      if(packet.version!==version)this.fail(409,'packet_changed','Reopen the current class scan before deleting it.');
      if(packet.state==='completed'){
        // A confirmed book owns its original image pages until the teacher deletes that book.
        tx.delete(path);
        this.checking.service.notifyContent(tx,uid);
        return {done:true};
      }
      if(['queued','running'].includes(packet.state)){
        const usage=await tx.get(quota(uid))||{};
        tx.set(quota(uid),{...usage,active:Math.max(0,(usage.active||0)-1)});
      }
      tx.delete(queue(packet.queueId));
      removeStudentIndex(tx,uid,packet,'packet');
      tx.set(path,{...packet,state:'deleting',lease:null,leaseUntil:null,deleting:0,version:packet.version+1});
      return {done:false};
    });
    if(!result.done)await this.checking.cleanPages(uid,path);
    return {deleted:true};
  }
}
