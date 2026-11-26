import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {PDFDict,PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';
import {checkingReport,checkingReportLayout} from './checking-report.mjs';
import {currentSheetGrade,digest,sheets} from './checking-storage.mjs';
import {maxCheckingPages} from './domain/checking-limits.mjs';
import {chunkBytes,readResultBytes,resultShape} from './submission-grading.mjs';
import {submissionPath} from './student-submission-storage.mjs';

const shaPattern=/^[a-f0-9]{64}$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
const attemptPattern=/^[a-z0-9_-]{16,80}$/;
const validId=id=>typeof id==='string'&&idPattern.test(id);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const reportFields=['sheetVersion','sha','size','chunks','generation','fileKey','outcome','message',
  'pending','awarded','max','assessedAwarded','assessedMax','storage','layout'];
const storageFields=['sheetVersion','sha','size','chunks','generation','fileKey'];
const subset=(object,fields)=>Object.fromEntries(fields.filter(field=>Object.hasOwn(object,field)).map(field=>[field,object[field]]));
const stableJSON=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

function changed(checker){
  checker.fail(409,'report_target_changed','The exact released checking report and its saved evidence could not be matched.');
}

function targetPaths(checker,expected){
  const {submissionId,submissionVersion,ownerUid,paperId,sheetId,sheetVersion,oldSha,attemptId}=expected;
  for(const id of [submissionId,ownerUid,paperId,sheetId])checker.id(id);
  if(!Number.isSafeInteger(submissionVersion)||submissionVersion<1||!Number.isSafeInteger(sheetVersion)||sheetVersion<1||
      typeof oldSha!=='string'||!shaPattern.test(oldSha)||typeof attemptId!=='string'||!attemptPattern.test(attemptId)){
    checker.fail(400,'invalid_report_target','Specify the exact submission, sheet revision, report digest and repair attempt.');
  }
  const sheetPath=sheets(ownerUid,paperId)+'/'+sheetId;
  const fileKey='repair-'+attemptId;
  return {
    submission:submissionPath(submissionId),sheet:sheetPath,grade:sheetPath+'/grading/original',
    audit:sheetPath+'/reportRegenerations/'+attemptId,file:sheetPath+'/resultFiles/'+fileKey,fileKey
  };
}

async function assertOwner(checker,reader,uid){
  const [user,pilot]=await reader.getSelected(['users/'+uid,'assistantConfig/pilot'],['role','allowedOwnerUids']);
  if(user?.role!=='admin'||!Array.isArray(pilot?.allowedOwnerUids)||!pilot.allowedOwnerUids.includes(uid)){
    checker.fail(403,'report_owner_unavailable','The original checking owner is unavailable.');
  }
}

function sourcePages(checker,sheet){
  if(!Number.isSafeInteger(sheet.pageCount)||sheet.pageCount<1||sheet.pageCount>maxCheckingPages||
      !Array.isArray(sheet.uploaded)||sheet.uploaded.length!==sheet.pageCount)changed(checker);
  const ordered=[...sheet.uploaded].sort((left,right)=>(left?.index??0)-(right?.index??0));
  for(const [index,page] of ordered.entries()){
    const source=page?.sourceIndex;
    const validSource=source==null||(Number.isSafeInteger(source)&&source>0)||
      validId(source);
    if(page?.index!==index+1||typeof page.sha!=='string'||!shaPattern.test(page.sha)||!validSource)changed(checker);
  }
  return ordered;
}

function boundPointers(checker,record,sheet,expected,paths){
  const {submissionId,submissionVersion,ownerUid,paperId,sheetId,sheetVersion,oldSha}=expected;
  const recovery=record?.assessmentRecovery;
  if(record?.id!==submissionId||record.ownerUid!==ownerUid||record.version!==submissionVersion||
      record.status!=='released'||record.automatic!==true||!record.releasedAt||
      record.sheetId!==sheetId||record.paperId!==paperId||record.publishedSheetVersion!==sheetVersion||
      (recovery&&recovery.state!=='published')||
      sheet?.id!==sheetId||sheet.version!==sheetVersion||sheet.automatic!==true||
      !['final','completed'].includes(sheet.state)||sheet.studentUid!==record.studentUid||
      sheet.studentLabel!==record.studentLabel||
      !validId(record.studentUid)||sheet.lease||
      (recovery&&(recovery.attemptId!==sheet.assessmentRecoveryId||recovery.sheetId!==sheetId||recovery.referenceId!==paperId))||
      (sheet.assessmentRecoveryId&&!recovery))
    changed(checker);
  const report=record.result;
  if(!report||!sheet.checkingResult||report.checkingPath!==paths.sheet||report.sha!==oldSha||
      report.sheetVersion!==sheetVersion||report.storage!=='checking'||
      !['complete','partial'].includes(report.outcome)||!validId(report.fileKey)||
      !validId(report.generation)||resultShape(checker,report).chunks!==report.chunks||
      !isDeepStrictEqual(subset(report,reportFields),subset(sheet.checkingResult,reportFields)))changed(checker);
  if(record.teacherUpload){
    const teacherRelease='teacher-'+digest(ownerUid,paperId,sheetId).slice(0,48);
    if(submissionId!==teacherRelease||sheet.submissionUploadId||record.answer?.pageCount!==sheet.pageCount)changed(checker);
  }else if(!record.approvedAt||!validId(record.approvedByUid)||
      !Number.isSafeInteger(record.approvalRevision)||record.approvalRevision!==record.revision||
      sheet.submissionUploadId!==submissionId||sheet.submissionUploadKind!=='answer'||
      sheet.approvalRevision!==record.approvalRevision||record.answer?.pageCount!==sheet.pageCount||
      !isDeepStrictEqual(sheet.uploaded,record.answer.pages))changed(checker);
  return report;
}

async function exactSource(checker,reader,expected,paths){
  const [record,sheet,original]=await Promise.all([
    reader.get(paths.submission),reader.get(paths.sheet),reader.get(paths.grade),
    assertOwner(checker,reader,expected.ownerUid)
  ]);
  const report=boundPointers(checker,record,sheet,expected,paths);
  const grade=currentSheetGrade(sheet);
  if(!grade||!original||original.gradingRevision!==sheet.gradeRevision||
      original.gradingPaperId!==(sheet.gradingPaperId??expected.paperId)||
      !isDeepStrictEqual(original.grade,grade)||!Array.isArray(grade.answers)||
      !Number.isFinite(grade.awarded)||!Number.isFinite(grade.max)||grade.max<=0||
      (report.outcome==='complete'?(sheet.state!=='final'||grade.pending!==0):sheet.state!=='completed')||
      !grade.answers.some(answer=>answer.counted===true&&answer.awarded!==null&&answer.anchors?.length)||
      typeof record.paperTitle!=='string'||!record.paperTitle.trim())changed(checker);
  const answers=grade.answers.map(({number,status,awarded,max,explanation,counted})=>
    ({number,status,awarded,max,explanation,counted}));
  if(!isDeepStrictEqual(report.answers,answers)||report.pending!==grade.pending||report.max!==grade.max||
      report.awarded!==(report.outcome==='complete'?grade.awarded:null)||
      report.assessedAwarded!==grade.awarded||
      (report.assessedMax!=null&&report.assessedMax!==grade.assessedMax))changed(checker);
  const pages=sourcePages(checker,sheet);
  if(sheet.scanSource&&!validId(sheet.scanSource))changed(checker);
  if(sheet.submissionUploadId&&pages.some(p=>!Number.isSafeInteger(p.sourceRevision)||p.sourceRevision<1||
      p.sourceRevision>record.approvalRevision))changed(checker);
  const sourceSha=hash(Buffer.from(stableJSON({record,sheet,original})));
  return {record,sheet,grade,report,pages,sourceSha};
}

async function checkedImages(checker,pdf,pages){
  try{
    if(pdf.subarray(0,5).toString()!=='%PDF-')throw Error();
    const doc=await PDFDocument.load(pdf,{updateMetadata:false});
    const pdfPages=doc.getPageCount();
    if(pdfPages<=pages.length)throw Error();
    const images=pages.map(({sha},index)=>{
      const resources=doc.getPage(index).node.Resources();
      const objects=resources?.lookupMaybe(PDFName.of('XObject'),PDFDict);
      for(const [,ref] of objects?.entries()??[]){
        const image=doc.context.lookup(ref);
        if(!(image instanceof PDFRawStream)||image.dict.get(PDFName.of('Subtype'))?.toString()!=='/Image'||
            image.dict.get(PDFName.of('Filter'))?.toString()!=='/DCTDecode')continue;
        const bytes=Buffer.from(image.getContents());
        if(digest(bytes.toString('base64'))===sha)return bytes;
      }
      throw Error();
    });
    return {images,pdfPages};
  }catch{
    checker.fail(409,'report_scan_mismatch','The report does not contain the exact ordered saved scans and a summary.');
  }
}

function render(source,images){
  return checkingReport(source.record.paperTitle,source.report.outcome,source.grade,source.report.message,images,source.sheet);
}

export async function prepareCheckingReportRegeneration(checker,expected){
  const paths=targetPaths(checker,expected);
  const source=await exactSource(checker,checker.store,expected,paths);
  const oldPdf=await readResultBytes(checker,paths.sheet+'/resultFiles/'+source.report.fileKey,source.report,true);
  const {images}=await checkedImages(checker,oldPdf,source.pages);
  const pdf=await render(source,images);
  const candidateSha=hash(pdf);
  resultShape(checker,{sheetVersion:expected.sheetVersion,size:pdf.length,sha:candidateSha});
  if(candidateSha===expected.oldSha)
    checker.fail(409,'report_already_current','The saved report already matches the current rendering.');
  const {pdfPages}=await checkedImages(checker,pdf,source.pages);
  return {pdf,oldSha:expected.oldSha,candidateSha,sourceSha:source.sourceSha,scanPages:images.length,pdfPages};
}

function repairRequest(expected){
  const {submissionId,submissionVersion,ownerUid,paperId,sheetId,sheetVersion,oldSha,attemptId,candidateSha,sourceSha}=expected;
  return {submissionId,submissionVersion,ownerUid,paperId,sheetId,sheetVersion,oldSha,attemptId,candidateSha,sourceSha};
}

function replayed(checker,receipt,request){
  if(!isDeepStrictEqual(receipt.request,request))changed(checker);
  return {state:'published',replayed:true,oldSha:request.oldSha,candidateSha:request.candidateSha};
}

export async function publishCheckingReportRegeneration(checker,expected){
  const paths=targetPaths(checker,expected);
  const request=repairRequest(expected);
  const {candidateSha,sourceSha,pdf}=expected;
  if(typeof candidateSha!=='string'||!shaPattern.test(candidateSha)||candidateSha===expected.oldSha||
      typeof sourceSha!=='string'||!shaPattern.test(sourceSha)||!Buffer.isBuffer(pdf))
    checker.fail(400,'invalid_report_candidate','Supply the private inspected PDF and its exact source and candidate digests.');
  const stage={...resultShape(checker,{sheetVersion:expected.sheetVersion,size:pdf.length,sha:candidateSha}),
    generation:expected.attemptId,fileKey:paths.fileKey,layout:checkingReportLayout};
  if(hash(pdf)!==candidateSha)changed(checker);
  const prior=await checker.store.get(paths.audit);
  if(prior){
    await assertOwner(checker,checker.store,expected.ownerUid);
    return replayed(checker,prior,request);
  }
  const source=await exactSource(checker,checker.store,expected,paths);
  if(source.sourceSha!==sourceSha)changed(checker);
  const {images,pdfPages}=await checkedImages(checker,pdf,source.pages);
  const rendered=await render(source,images);
  if(!rendered.equals(pdf))
    checker.fail(409,'report_render_changed','The inspected report differs from the current rendering of the saved marks and scans.');

  const batchSize=12;
  for(let from=0;from<stage.chunks;from+=batchSize){
    const marker=paths.file+'/batches/'+from;
    const receipt=await checker.store.transaction(async tx=>{
      const [audit,record,sheet,batch]=await Promise.all([
        tx.get(paths.audit),tx.get(paths.submission),tx.get(paths.sheet),tx.get(marker),
        assertOwner(checker,tx,expected.ownerUid)
      ]);
      if(audit)return audit;
      boundPointers(checker,record,sheet,expected,paths);
      if(batch){
        if(!isDeepStrictEqual(batch.request,request))changed(checker);
        return null;
      }
      for(let i=from;i<Math.min(from+batchSize,stage.chunks);i++){
        const bytes=pdf.subarray(i*chunkBytes,(i+1)*chunkBytes);
        tx.create(paths.file+'/chunks/'+i,{bytes,generation:stage.generation});
      }
      tx.create(marker,{request});
      return null;
    });
    if(receipt)return replayed(checker,receipt,request);
  }
  const restored=await readResultBytes(checker,paths.file,stage,true);
  if(!restored.equals(pdf))changed(checker);

  return checker.store.transaction(async tx=>{
    const prior=await tx.get(paths.audit);
    if(prior){
      await assertOwner(checker,tx,expected.ownerUid);
      return replayed(checker,prior,request);
    }
    const live=await exactSource(checker,tx,expected,paths);
    if(live.sourceSha!==sourceSha)changed(checker);
    tx.update(paths.sheet,{checkingResult:{...live.sheet.checkingResult,...stage}});
    tx.update(paths.submission,{result:{...live.report,...stage}});
    tx.create(paths.audit,{
      request,previous:subset(live.report,storageFields),replacement:stage,checkingPath:paths.sheet,
      releasedAt:live.record.releasedAt,scanPages:images.length,pdfPages,updatedAt:checker.now()
    });
    return {state:'published',replayed:false,oldSha:expected.oldSha,candidateSha};
  });
}
