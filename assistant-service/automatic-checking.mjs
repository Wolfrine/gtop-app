import {createHash} from 'node:crypto';
import {checkingReport} from './checking-report.mjs';
import {externalGradingPaper} from './domain/external-reference.mjs';
import {assessStudentGrade,gradingRubric} from './domain/checking.mjs';
import {digest,queue} from './checking-storage.mjs';
import {chunkBytes,queueSubmissionSheet,readResultBytes,resultShape} from './submission-grading.mjs';
import {moveStaffSubmissionIndex,notifySubmissionInbox,ownerSubmissions,studentSubmissions,submissionPath} from './student-submission-storage.mjs';

export const autoReference = kind => kind==='auto-reference'||kind==='auto-print-reference';
export const automaticJob = kind => kind==='auto-grade'||autoReference(kind);

async function approvedSubmission(tx,row,sheet){
  if(!sheet.submissionUploadId)return null;
  const current=await tx.get(submissionPath(sheet.submissionUploadId));
  if(current?.status!=='checking'||!current.automatic||!current.approvedAt||
    current.revision!==sheet.approvalRevision||current.approvalRevision!==sheet.approvalRevision||current.ownerUid!==row.uid)
    return null;
  if(autoReference(row.kind))return current.referenceId===sheet.id&&!current.sheetId?current:null;
  return current.sheetId===sheet.id&&current.paperId===row.paperId&&current.studentUid===sheet.studentUid?current:null;
}

export async function continueApprovedReference(checker,row,sheet,patch){
  const paper=patch.state==='ready'?gradingRubric(externalGradingPaper(patch.paper)):null;
  if(!paper)return false;
  return checker.finish(row,patch,false,async(tx,liveRow,liveSheet)=>{
    const approval=await approvedSubmission(tx,liveRow,liveSheet);
    if(!approval)return null;
    const now=checker.now();
    const next=queueSubmissionSheet(checker,tx,approval,liveSheet.id,paper,now);
    tx.update(submissionPath(approval.id),{...next,updatedAt:now,version:approval.version+1});
    notifySubmissionInbox(tx,now);
    return {transferred:true};
  });
}

function gradingFeedback(grade){
  return (grade?.answers??[]).map(({number,status,awarded,max,explanation,counted})=>({
    number,status,awarded,max,explanation,counted
  }));
}
const resultFile = (path,key) => path+'/resultFiles/'+key;

export async function finishAutomatic(checker,row,sheet,{grade=null,message=null,title,scans=false,expired=false,referencePatch}={}){
  const outcome=grade?.answers.some(answer=>answer.awarded!==null)
    ? (message||grade.pending?'partial':'complete'):'unassessable';
  const finalTitle=title||sheet.title||'Answer sheet';
  const path=row.path;
  const fileKey='auto-'+row.lease;
  const filePath=resultFile(path,fileKey);
  let pdf;
  try{
    const images=[];
    if(scans){
      for(let first=1;first<=sheet.pageCount;first+=4){
        const batch=Array.from({length:Math.min(4,sheet.pageCount-first+1)},(_,i)=>checker.page(path,sheet,first+i));
        images.push(...await Promise.all(batch));
      }
    }
    pdf=await checkingReport(finalTitle,outcome,grade,message,images);
    if(pdf.length>22_000_000)throw Error('Report exceeds the result limit.');
  }catch{
    message=[message,'Scan images could not be included. The assessment notes are available below.'].filter(Boolean).join(' ');
    pdf=await checkingReport(finalTitle,outcome,grade,message);
  }
  const sha=createHash('sha256').update(pdf).digest('hex');
  const stage=resultShape(checker,{sheetVersion:sheet.version+1,size:pdf.length,sha});
  const result={...stage,generation:row.lease,fileKey,outcome,message,pending:grade?.pending??null,
    awarded:outcome==='complete'?grade.awarded:null,max:grade?.max??null,
    assessedAwarded:grade?.answers.some(a=>a.counted===true&&a.awarded!==null)?grade.awarded:null,
    storage:'checking',answers:gradingFeedback(grade)};
  // Files staged by a superseded lease are never visible. Each bounded batch must
  // still own the lease; the final transaction publishes exactly one result pointer.
  const batchSize=12;
  const saveChunks=(tx,from,to)=>{
    for(let i=from;i<to;i++){
      const bytes=pdf.subarray(i*chunkBytes,(i+1)*chunkBytes);
      tx.create(filePath+'/chunks/'+i,{bytes,generation:row.lease});
    }
  };
  let offset=0;
  while(stage.chunks-offset>batchSize){
    const from=offset;
    const active=await checker.store.transaction(async tx=>{
      const current=await tx.get(queue(row.id));
      if(current?.lease!==row.lease||current.state!=='running'||current.leaseUntil<=checker.now())return false;
      // Firestore's native retry can repeat the function; this marker also allows
      // an HTTP retry to reuse the bytes after a lost response.
      const part=await tx.get(filePath+'/batches/'+from);
      if(part?.sha===sha)return true;
      if(part)return false;
      saveChunks(tx,from,from+batchSize);
      tx.create(filePath+'/batches/'+from,{sha});
      return true;
    });
    if(!active)return {active:false};
    offset+=batchSize;
  }

  const checkingResult={...result,answers:[]};
  const patch=autoReference(row.kind)
    ? {...referencePatch,state:'failed',error:message,checkingResult}
    : {state:outcome==='complete'?'final':'completed',grade,modelGrade:grade,engine:'codex-cli',error:null,checkingResult};
  return checker.finish(row,patch,expired,async(tx,liveRow,liveSheet)=>{
    const approval=await approvedSubmission(tx,liveRow,liveSheet);
    if(liveSheet.submissionUploadId&&!approval)return null;
    // Staff-uploaded work can reach a student only when explicitly linked to a
    // verified account at intake. Unlinked or unidentified class work stays staff-only.
    const directId=!approval&&liveSheet.studentUid?'teacher-'+digest(row.uid,row.paperId,liveSheet.id).slice(0,48):null;
    const [previous,profile]=directId?await Promise.all([
      tx.get(submissionPath(directId)),tx.get('users/'+liveSheet.studentUid)
    ]):[];
    if(previous)return null;
    saveChunks(tx,offset,stage.chunks);
    const now=checker.now();
    const released={status:'released',paperTitle:finalTitle,releasedAt:now,updatedAt:now,
      publishedSheetVersion:stage.sheetVersion,result:{...result,checkingPath:path}};
    if(approval){
      tx.update(submissionPath(approval.id),{...released,version:approval.version+1});
      moveStaffSubmissionIndex(tx,approval,'released',now);
    }else if(directId&&profile){
      const direct={...released,id:directId,ownerUid:row.uid,studentUid:liveSheet.studentUid,studentLabel:liveSheet.studentLabel,
        title:finalTitle,paperId:row.paperId,sheetId:liveSheet.id,automatic:true,teacherUpload:true,createdAt:liveSheet.createdAt,
        submittedAt:liveSheet.createdAt,approvedAt:liveSheet.createdAt,revision:1,version:1,
        answer:{name:'Teacher-uploaded answer sheet',pageCount:liveSheet.pageCount,pages:[]}};
      tx.create(submissionPath(directId),direct);
      tx.create(studentSubmissions(direct.studentUid)+'/'+directId,{createdAt:now});
      tx.create(ownerSubmissions(row.uid)+'/'+directId,{createdAt:now});
      moveStaffSubmissionIndex(tx,{id:directId,ownerUid:row.uid},'released',now);
    }
    return {};
  });
}

export async function completeAutomatic(checker,row,sheet,body){
  if(autoReference(row.kind)){
    let patch;
    try{patch=checker.references.complete(body,sheet);}
    catch{return finishAutomatic(checker,row,sheet,{message:'The question scan could not be read reliably. The answer sheet could not be assessed.'});}
    if(patch.state==='ready'&&row.kind==='auto-print-reference')return checker.finish(row,patch);
    if(patch.state==='ready')return continueApprovedReference(checker,row,sheet,patch);
    return finishAutomatic(checker,row,sheet,{referencePatch:patch,
      message:(patch.issues??[]).slice(0,4).join(' ').slice(0,1200)||'The question scan does not establish a usable marking reference.'});
  }
  let assessment;
  const source=await checker.sourcePaper(checker.store,row.paperId,row.uid);
  const rubric=gradingRubric(source);
  if(!rubric||digest(rubric)!==row.rubricDigest)
    return finishAutomatic(checker,row,sheet,{message:'The approved question paper or mark allocations are unavailable.'});
  try{assessment=assessStudentGrade(body,rubric,sheet.pageCount);}
  catch{assessment={grade:null,issue:{message:'The checker did not produce marks that could be validated against the supplied scans.'}};}
  return finishAutomatic(checker,row,sheet,{...assessment,title:rubric.title,scans:!!assessment.grade?.answers.some(answer=>answer.anchors.length||answer.awarded!==null),
    grade:assessment.grade,message:assessment.issue?.message??null});
}

export async function automaticReportPdf(checker,path,result){
  return readResultBytes(checker,resultFile(path,result.fileKey),result,true);
}
