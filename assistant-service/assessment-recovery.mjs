import {isDeepStrictEqual} from 'node:util';
import {digest,maxActive,queue,quota} from './checking-storage.mjs';
import {maxCheckingPages} from './domain/checking-limits.mjs';
import {maxExternalPages} from './domain/external-reference.mjs';
import {verifiedQuestionSourcePath,verifiedQuestionWordingSha} from './source-fidelity.mjs';
import {createQueueEntry,readResultBytes,resultShape} from './submission-grading.mjs';
import {notifySubmissionInbox,submissionPath,submissionSettingsPath} from './student-submission-storage.mjs';

const shaPattern=/^[a-f0-9]{64}$/;
const leasePattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const originalReferencePattern=/^ext-auto-[a-f0-9]{48}$/;
const attemptPattern=/^[a-z0-9_-]{16,80}$/;
const reasonLimit=240;

export const assessmentRecoveryPath=(id,attemptId)=>submissionPath(id)+'/assessmentRecoveries/'+attemptId;

function orderedPages(attachment,limit,revision){
  const count=attachment?.pageCount;
  if(!Number.isSafeInteger(count)||count<1||count>limit||!Array.isArray(attachment.pages)||attachment.pages.length!==count)
    return null;
  const pages=[...attachment.pages].sort((left,right)=>(left?.index??0)-(right?.index??0));
  return pages.every((page,index)=>
    page?.index===index+1&&shaPattern.test(page.sha)&&Number.isSafeInteger(page.sourceRevision)&&
    page.sourceRevision>=1&&page.sourceRevision<=revision)?pages:null;
}

function sameFile(left,right){
  return !!left&&!!right&&['sheetVersion','sha','size','chunks','generation','fileKey'].every(key=>left[key]===right[key]);
}

function samePages(left,right){
  const fields=['index','sha','width','height','sourceRevision','sourceIndex'];
  return !!left&&left.length===right.length&&left.every((page,index)=>fields.every(key=>page[key]===right[index][key]));
}

function changed(checker){
  checker.fail(409,'recovery_target_changed','The original approved submission or its released report did not match.');
}

function validSourceReason(reason){
  return typeof reason==='string'&&reason.length>0&&reason.length<=reasonLimit&&
    reason===reason.trim()&&!/[\p{Cc}\p{Zl}\p{Zp}]/u.test(reason);
}

function sourceEvidenceRequest(checker,number,reason,wordingSha){
  if(number===undefined&&reason===undefined&&wordingSha===undefined)return null;
  const trimmed=typeof reason==='string'?reason.trim():null;
  if(!Number.isSafeInteger(number)||number<1||!validSourceReason(trimmed)||!shaPattern.test(wordingSha??'')){
    checker.fail(400,'invalid_source_evidence','Supply a question number and a short factual reason from the verified source scan.');
  }
  return {number,reason:trimmed,wordingSha,digest:digest(number,trimmed,wordingSha)};
}

function validSourceQuestion(question,pageCount){
  return Number.isSafeInteger(question?.number)&&question.number>0&&
    typeof question.label==='string'&&question.label.trim().length>0&&question.label.length<=90&&
    Number.isSafeInteger(question.sourcePage)&&question.sourcePage>0&&question.sourcePage<=pageCount&&
    Number.isFinite(question.marks)&&question.marks>0&&question.marks<=2000&&
    typeof question.question==='string'&&question.question.trim().length>0&&question.question.length<=5000;
}

function archivedSourceEvidence(checker,reference,fingerprint,request){
  const sections=reference.paper?.sections;
  const matches=Array.isArray(sections)?sections.flatMap(section=>
    Array.isArray(section?.questions)?section.questions.filter(question=>question?.number===request.number):[]):[];
  const question=matches[0];
  if(matches.length!==1||!validSourceQuestion(question,reference.questionPages)||question.alternative!==null){
    checker.fail(409,'source_evidence_unavailable','The original reference must contain one matching question with a verified page and mark allocation.');
  }
  const {number,label,sourcePage,marks,question:wording}=question;
  if(verifiedQuestionWordingSha(wording)!==request.wordingSha)
    checker.fail(409,'source_evidence_conflict','The archived wording differs from the reviewed question.');
  return {fingerprint,sourceReferenceId:reference.id,
    questions:[{number,label,sourcePage,marks,question:wording,reason:request.reason,wordingSha:request.wordingSha}]};
}

function recoverySourceEvidence(checker,reference,fingerprint,request,saved){
  const requested=request?archivedSourceEvidence(checker,reference,fingerprint,request):null;
  if(!saved)return requested;
  if(saved.fingerprint!==fingerprint||typeof saved.sourceReferenceId!=='string'||!originalReferencePattern.test(saved.sourceReferenceId)||
      !Array.isArray(saved.questions)||saved.questions.length!==1||!validSourceQuestion(saved.questions[0],reference.questionPages)||
      !validSourceReason(saved.questions[0].reason)||
      verifiedQuestionWordingSha(saved.questions[0].question)!==saved.questions[0].wordingSha||
      (requested&&!isDeepStrictEqual(saved,requested))){
    checker.fail(409,'source_evidence_conflict','An existing source record differs for these ordered question pages.');
  }
  return saved;
}

async function recoveryTarget(checker,reader,expected,sourceRequest){
  const {id,version,revision,referenceId,reportSha,attemptId}=expected;
  const [record,prior,pilot,settings]=await Promise.all([
    reader.get(submissionPath(id)),reader.get(assessmentRecoveryPath(id,attemptId)),
    reader.get('assistantConfig/pilot'),reader.get(submissionSettingsPath)
  ]);
  if(!record||record.id!==id||!record.ownerUid||!record.studentUid)changed(checker);
  const ownerUid=checker.id(record.ownerUid);
  const [owner]=await reader.getSelected(['users/'+ownerUid],['role']);
  const allowedOwners=pilot?.allowedOwnerUids;
  if(settings?.enabled===false||owner?.role!=='admin'||!Array.isArray(allowedOwners)||!allowedOwners.includes(ownerUid)){
    checker.fail(403,'recovery_owner_unavailable','The original checking inbox is unavailable for recovery.');
  }
  if(prior){
    if(prior.id!==attemptId||prior.submissionId!==id||prior.ownerUid!==ownerUid||
        prior.studentUid!==record.studentUid||prior.originalVersion!==version||
        prior.approvalRevision!==revision||prior.originalReferenceId!==referenceId||
        prior.originalResult?.sha!==reportSha||
        (prior.sourceEvidence?.requestDigest??null)!==(sourceRequest?.digest??null))changed(checker);
    return {prior};
  }

  const result=record.result;
  const referencePath=checker.references.path(ownerUid,referenceId);
  if(record.version!==version||record.revision!==revision||record.approvalRevision!==revision||
      record.referenceRevision!==revision||record.referenceId!==referenceId||record.sheetId||record.paperId||
      record.status!=='released'||record.automatic!==true||record.teacherUpload||
      typeof record.approvedByUid!=='string'||!record.approvedByUid||!Number.isFinite(Date.parse(record.approvedAt))||
      !Number.isFinite(Date.parse(record.releasedAt))||result?.outcome!=='unassessable'||
      result.sha!==reportSha||result.checkingPath!==referencePath||result.storage!=='checking'||
      result.sheetVersion!==record.publishedSheetVersion||!leasePattern.test(result.generation)||
      result.fileKey!=='auto-'+result.generation)changed(checker);
  if(record.assessmentRecovery&&record.assessmentRecovery.state!=='failed'){
    checker.fail(409,'recovery_already_started','This submission already has an assessment recovery.');
  }
  const questionPages=orderedPages(record.question,maxExternalPages,revision);
  if(!questionPages||!orderedPages(record.answer,maxCheckingPages,revision)||
      digest('ordered-question-pages-v1',...questionPages.map(page=>page.sha))!==record.questionFingerprint||
      referenceId!=='ext-auto-'+digest(ownerUid,id,revision,record.questionFingerprint).slice(0,48))
    changed(checker);
  if(resultShape(checker,result).chunks!==result.chunks)changed(checker);
  const reference=await reader.get(referencePath);
  const originalPages=orderedPages({pageCount:reference?.pageCount,pages:reference?.uploaded},maxExternalPages,revision);
  const originalQueueId=digest(ownerUid,'auto-reference',referenceId);
  if(reference?.id!==referenceId||reference.ownerUid!==ownerUid||reference.state!=='failed'||reference.automatic!==true||
      reference.version!==result.sheetVersion||reference.submissionUploadId!==id||reference.submissionUploadKind!=='question'||
      reference.approvalRevision!==revision||reference.pageCount!==record.question.pageCount||
      reference.questionPages!==reference.pageCount||reference.queueId!==originalQueueId||!samePages(originalPages,questionPages)||
      !sameFile(reference.checkingResult,result))changed(checker);
  return {record,result,reference,referencePath,originalQueueId};
}

export async function startAssessmentRecovery(checker,expected){
  const {id,version,revision,referenceId,reportSha,attemptId,verifiedQuestion,sourceReason,verifiedWordingSha}=expected;
  checker.id(id);
  if(!Number.isSafeInteger(version)||version<1||!Number.isSafeInteger(revision)||revision<1||
      typeof referenceId!=='string'||!originalReferencePattern.test(referenceId)||
      typeof reportSha!=='string'||!shaPattern.test(reportSha)||typeof attemptId!=='string'||!attemptPattern.test(attemptId)){
    checker.fail(400,'invalid_recovery_target','Supply the exact approved revision, report digest and a new attempt ID.');
  }
  const sourceRequest=sourceEvidenceRequest(checker,verifiedQuestion,sourceReason,verifiedWordingSha);
  const initial=await recoveryTarget(checker,checker.store,expected,sourceRequest);
  if(initial.prior)return {state:initial.prior.state,replayed:true};

  const pdf=await readResultBytes(checker,initial.referencePath+'/resultFiles/'+initial.result.fileKey,initial.result,true);
  if(pdf.subarray(0,5).toString()!=='%PDF-')changed(checker);
  return checker.store.transaction(async tx=>{
    const target=await recoveryTarget(checker,tx,expected,sourceRequest);
    if(target.prior)return {state:target.prior.state,replayed:true};
    const {record,result}=target;
    if(!sameFile(result,initial.result))changed(checker);
    const uid=record.ownerUid;
    const fingerprint=record.questionFingerprint;
    const evidencePath=verifiedQuestionSourcePath(uid,fingerprint);
    const previous=record.assessmentRecovery;
    const previousQueueId=previous&&(previous.sheetId?digest(uid,previous.referenceId,previous.sheetId):
      digest(uid,'assessment-recovery-reference',id,revision,previous.attemptId));
    const [usage,[student],originalQueue,savedEvidence,previousQueue]=await Promise.all([
      tx.get(quota(uid)),tx.getSelected(['users/'+checker.id(record.studentUid)],['role']),
      tx.get(queue(target.originalQueueId)),tx.get(evidencePath),previousQueueId?tx.get(queue(previousQueueId)):null
    ]);
    if(originalQueue)changed(checker);
    if(previousQueue)checker.fail(409,'recovery_still_running','The prior assessment attempt is still stopping.');
    if(!student)checker.fail(409,'recovery_student_unavailable','The original student account is unavailable.');
    const active=usage?.active??0;
    if(!Number.isSafeInteger(active)||active<0||active>=maxActive)
      checker.fail(429,'recovery_queue_unavailable','The original checking inbox cannot reserve a queue slot.');
    const sourceEvidence=recoverySourceEvidence(checker,target.reference,fingerprint,sourceRequest,savedEvidence);

    const now=checker.now();
    const freshReferenceId='ext-auto-'+digest(uid,id,revision,'assessment-recovery',attemptId).slice(0,48);
    const freshPath=checker.references.path(uid,freshReferenceId);
    const pageCount=record.question.pageCount;
    const recovery={attemptId,state:'reference_queued',referenceId:freshReferenceId,sheetId:null};
    const entry={
      id:freshReferenceId,ownerUid:uid,title:record.title,uploadTitle:record.title,state:'queued',
      createdAt:now,updatedAt:now,version:0,questionPages:pageCount,pageCount,uploaded:record.question.pages,
      queueId:digest(uid,'assessment-recovery-reference',id,revision,attemptId),submissionUploadId:id,
      submissionUploadKind:'question',approvalRevision:revision,automatic:true,assessmentRecoveryId:attemptId,
      ...(sourceEvidence?{sourceFingerprint:fingerprint,sourceEvidence}:{})
    };
    tx.create(assessmentRecoveryPath(id,attemptId),{
      id:attemptId,submissionId:id,ownerUid:uid,studentUid:record.studentUid,
      approvalRevision:revision,approvedAt:record.approvedAt,approvedByUid:record.approvedByUid,
      originalVersion:version,originalReferenceId:referenceId,originalPaperId:record.paperId??null,
      originalSheetId:record.sheetId??null,originalQuestionFingerprint:record.questionFingerprint,
      originalResult:result,originalReleasedAt:record.releasedAt,
      referenceId:freshReferenceId,sheetId:null,state:recovery.state,createdAt:now,updatedAt:now,
      ...(sourceEvidence?{sourceEvidence:{fingerprint,sourceReferenceId:sourceEvidence.sourceReferenceId,
        ...(sourceRequest?{requestDigest:sourceRequest.digest}:{})}}:{}),
      startedVia:'operator_adc'
    });
    if(sourceEvidence&&!savedEvidence)tx.create(evidencePath,sourceEvidence);
    tx.create(freshPath,entry);
    createQueueEntry(tx,uid,freshPath,freshReferenceId,entry,now,'auto-reference');
    tx.update(submissionPath(id),{assessmentRecovery:recovery,version:version+1,updatedAt:now});
    tx.set(quota(uid),{...usage,active:active+1});
    notifySubmissionInbox(tx,now);
    checker.service.notifyDispatch(tx,uid);
    return {state:recovery.state,replayed:false};
  });
}
