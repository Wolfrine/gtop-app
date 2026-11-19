import {createHash} from 'node:crypto';
import {externalGradingPaper,maxExternalPages,readExternalReference} from './domain/external-reference.mjs';

const collection = uid=>'assistantCheckingOwners/'+uid+'/references';
const validId = /^ext-[a-z0-9-]{12,90}$/i;
const pageSize = 25;

export class ExternalReference {
  constructor(checking){this.checking=checking;this.store=checking.store;this.fail=checking.fail;}
  path(uid,id){
    this.checking.id(uid);
    if(!validId.test(id))this.checking.notFound();
    return collection(uid)+'/'+id;
  }
  async paper(reader,id,uid){
    const record=await reader.get(this.path(uid,id));
    return record?.state==='ready'&&record.ownerUid===uid?externalGradingPaper(record.paper):null;
  }
  claimJob(record){return {questionPages:record.questionPages};}
  complete(body,record){
    let result;
    try{result=readExternalReference(body.reference,record.questionPages);}
    catch(error){this.fail(400,'invalid_reference',error.message);}
    const {paper,issues}=result;
    if(record.questionPages===record.pageCount){
      // The source exam supplies wording and marks. A model-generated key is not a teacher's key.
      for(const section of paper.sections)for(const q of section.questions){
        for(const variant of [q,q.alternative].filter(Boolean)){variant.answer='';variant.markingPoints=[];}
      }
    }
    const usable=issues.length===0&&externalGradingPaper(paper);
    if(!usable&&!issues.length)issues.push('Review the question numbers and mark allocations.');
    return {title:paper.title,paper,issues,state:usable?'ready':'review',engine:body.engine,error:null};
  }
  view(record){
    const {id,title,state,pageCount,questionPages,createdAt,updatedAt,version,paper,issues,error,uploaded}=record;
    return {id,title,state,pageCount,questionPages,createdAt,updatedAt,version,referenceRevision:record.referenceRevision??1,paper:paper??null,
      issues:issues??[],error:error??null,uploaded:(uploaded||[]).map(p=>p.index)};
  }
  async list(uid,cursor){
    let cursorValues;
    if(cursor){
      try{
        if(typeof cursor!=='string'||cursor.length>300)throw Error();
        cursorValues=JSON.parse(Buffer.from(cursor,'base64url').toString());
        if(!Array.isArray(cursorValues)||cursorValues.length!==2||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cursorValues[0])||!validId.test(cursorValues[1]))throw Error();
      }catch{this.fail(400,'invalid_cursor','Reload the question paper list.');}
    }
    const rows=await this.store.list(collection(uid),[],pageSize+1,{orderBy:['createdAt','desc'],orderById:true,cursorValues,
      select:['id','title','state','createdAt','updatedAt','questionPages','pageCount','paper.marks','referenceRevision']});
    const references=rows.slice(0,pageSize).map(r=>({id:r.id,title:r.title,state:r.state,questionPages:r.questionPages,
      pageCount:r.pageCount,marks:r.paper?.marks??null,updatedAt:r.updatedAt,referenceRevision:r.referenceRevision??1}));
    const last=rows[pageSize-1];
    return {references,nextCursor:rows.length>pageSize?Buffer.from(JSON.stringify([last.createdAt,last.id])).toString('base64url'):null};
  }
  async teacher(method,uid,id,action,index,body={}){
    this.checking.id(uid);
    if(!id&&method==='GET')return this.list(uid);
    if(id==='history'&&!action&&method==='POST')return this.list(uid,body.cursor);
    if(!id&&method==='POST')return this.create(uid,body);
    const path=this.path(uid,id);
    let record=await this.store.get(path);
    if(!record||record.ownerUid!==uid)this.checking.notFound();
    if(method==='GET'&&!action){
      if(record.state==='running'&&record.leaseUntil<=this.checking.now()){
        await this.checking.expire('assistantCheckingQueue/'+record.queueId);
        record=await this.store.get(path);
        if(!record)this.checking.notFound();
      }
      return {reference:this.view(record)};
    }
    if(action==='pages'&&method==='POST')return this.checking.upload(path,Number(index),body);
    if(action==='pages'&&method==='GET') {
      const sourcePath=record.sourceId?this.path(uid,record.sourceId):path;
      const source=record.sourceId?await this.store.get(sourcePath):record;
      if(!source||source.ownerUid!==uid)this.checking.notFound();
      return this.checking.page(sourcePath,source,Number(index));
    }
    if(action==='queue'&&method==='POST')return this.checking.enqueue(uid,id,path,body,'external-exam');
    if(action==='review'&&method==='POST')return this.review(uid,path,body);
    this.checking.notFound();
  }
  async create(uid,body) {
    const {id,pageCount,questionPages}=body,path=this.path(uid,id),title=this.checking.text(body.title||'Uploaded question paper',240,true);
    if(!Number.isInteger(pageCount)||!Number.isInteger(questionPages)||questionPages<1||questionPages>pageCount||pageCount>maxExternalPages)
      this.fail(400,'invalid_pages','Add question-paper pages and an optional marking scheme, up to '+maxExternalPages+' pages in total.');
    const now=this.checking.now(),ownerPath='assistantCheckingOwners/'+uid;
    return this.store.transaction(async tx=>{
      const record=await tx.get(path),owner=(await tx.get(ownerPath))||{};
      if(record){
        if(record.ownerUid!==uid||record.questionPages!==questionPages||record.pageCount!==pageCount||record.uploadTitle!==title)
          this.fail(409,'reference_conflict','These pages belong to a different upload.');
        return {id};
      }
      const date=now.slice(0,10),daily=owner.referenceDay===date?(owner.referenceDrafts||0):0;
      if(daily>=100)this.fail(429,'reference_limit','The daily private question paper upload limit has been reached.');
      tx.create(path,{id,ownerUid:uid,uploadTitle:title,title,state:'uploading',createdAt:now,updatedAt:now,
        version:0,questionPages,pageCount,uploaded:[],queueId:createHash('sha256').update('external-exam/'+uid+'/'+id).digest('hex')});
      tx.set(ownerPath,{...owner,referenceDay:date,referenceDrafts:daily+1});
      return {id};
    });
  }
  async review(uid,path,body){
    return this.store.transaction(async tx=>{
      const saved=await tx.get(path);
      if(!saved||saved.ownerUid!==uid)this.checking.notFound();
      let result;
      try{result=readExternalReference({...body.paper,issues:[]},saved.questionPages);}
      catch(error){this.fail(400,'invalid_reference',error.message);}
      if(result.issues.length||!externalGradingPaper(result.paper))this.fail(400,'invalid_reference',result.issues[0]||'Check the exam structure and marks.');
      const reviewHash=createHash('sha256').update(JSON.stringify(result.paper)).digest('hex');
      let revisedPath;
      if(body.revisionId){
        revisedPath=this.path(uid,body.revisionId);
        if(revisedPath===path)this.fail(400,'invalid_revision','Choose a new revision ID.');
        const previous=await tx.get(revisedPath);
        if(previous){
          if(previous.revisionOf===saved.id&&previous.sourceVersion===body.version&&previous.reviewHash===reviewHash)return {id:previous.id};
          this.fail(409,'reference_conflict','This revision already exists.');
        }
      }
      if(saved.state==='ready'&&!revisedPath&&saved.version===body.version+1&&saved.reviewHash===reviewHash)return {id:saved.id};
      if(saved.version!==body.version||!(saved.state==='review'||saved.state==='ready'&&revisedPath||saved.state==='failed'&&saved.uploaded.length===saved.pageCount))
        this.fail(409,'reference_changed','Reload the current question paper before editing.');
      if(saved.issues?.length&&body.reviewed!==true)this.fail(400,'review_required','Confirm the highlighted items against the original exam.');
      const now=this.checking.now();
      const ready={...saved,state:'ready',paper:result.paper,title:result.paper.title,issues:[],error:null,
        version:saved.version+1,updatedAt:now,reviewedAt:now,reviewHash};
      if(revisedPath){
        if(saved.state!=='ready')this.fail(409,'reference_changed','Complete the current review first.');
        tx.create(revisedPath,{...ready,id:body.revisionId,createdAt:now,version:1,sourceId:saved.sourceId||saved.id,
          revisionOf:saved.id,sourceVersion:saved.version,referenceRevision:(saved.referenceRevision??1)+1});
      }else tx.set(path,ready);
      this.checking.service.notifyContent(tx,uid);
      return {id:revisedPath?body.revisionId:saved.id};
    });
  }
}
