import {gradingRubric} from './domain/checking.mjs';
import {approvedExamSourceMatches} from './exam-identity.mjs';
import {createHash, randomUUID} from 'node:crypto';
import {currentSheetGrade, digest, maxActive, orderedKey, queue, queueField, quota, sheets} from './checking-storage.mjs';
import {indexStudent} from './checking-student.mjs';
import {confirmedPaperPath, moveStaffSubmissionIndex, notifySubmissionInbox, submissionApprovalScope, submissionPath} from './student-submission-storage.mjs';

import {staffSubmission} from './student-submission-access.mjs';
import {verifiedQuestionSourcePath} from './source-fidelity.mjs';
import {releasedAssessment} from './released-assessment.mjs';
import {enqueueExamUpdate} from './exam-notifications.mjs';

export const chunkBytes = 400_000;
const maxResultBytes = 22_000_000;
const shaPattern = /^[a-f0-9]{64}$/;
const stagePath = (path, sheetVersion) => path + '/resultFiles/' + sheetVersion;
const chunkPath = (stage, index) => stage + '/chunks/' + index;

function submittedRevision(checker, record, expectedVersion) {
  if (record.status !== 'submitted' || record.version !== expectedVersion) {
    checker.fail(409, 'submission_changed', 'Open the latest submission before approving it.');
  }
}

function ensureQueueSpace(checker, usage) {
  if ((usage?.active || 0) >= maxActive) {
    checker.fail(429, 'grading_limit', 'The checking queue is full. This submission remains in the inbox.');
  }
}

export function createQueueEntry(tx, uid, path, paperId, record, now, kind) {
  tx.create(queue(record.queueId), {
    id: record.queueId, path, uid, paperId, state: 'queued', queuedAt: now,
    ...(kind ? {kind} : {}), [queueField(kind)]: orderedKey(uid, now, record.queueId)
  });
}

async function confirmedPaper(store, submission) {
  return submission.questionFingerprint
    ? (await store.get(confirmedPaperPath(submission.ownerUid, submission.questionFingerprint)))?.paperId || null
    : null;
}

const currentReferenceId = row => Number.isSafeInteger(row.revision) && row.revision > 0 &&
  row.referenceRevision === row.revision ? row.referenceId : null;
const linkedSubmissionPaper = (row, matched, reference) => row.paperId || matched ||
  (reference?.state === 'ready' && reference.reviewedAt ? currentReferenceId(row) : null);

function verifyApprovalScope(checker, scope, exactScope) {
  if (!exactScope || scope !== exactScope) {
    checker.fail(409, 'approval_scope_changed', 'This submission no longer belongs to that approval group. Reload the inbox.');
  }
}

const referenceKey = submission => 'ext-sub-' +
  digest(submission.ownerUid, submission.questionFingerprint).slice(0, 52);

export async function prepareSubmissionReference(checker, actorUid, id, {version}) {
  const path = submissionPath(checker.id(id));
  return checker.store.transaction(async tx => {
    const current = await staffSubmission(checker, tx, actorUid, path, {queueing:true});
    const uid = current.ownerUid;
    if (current.referenceId && current.status === 'submitted' && current.referenceRevision === current.revision &&
        await tx.get(checker.references.path(uid, current.referenceId))) {
      return {referenceId: current.referenceId};
    }
    submittedRevision(checker, current, version);
    if (current.paperId || !current.question?.pages?.length || !shaPattern.test(current.questionFingerprint || '')) {
      checker.fail(409, 'question_scan_unavailable', 'This submission already has a paper or has no saved question scan.');
    }
    const savedPaperId = await confirmedPaper(tx, current);
    if (savedPaperId && !savedPaperId.startsWith('ext-')) return {referenceId: null, paperId: savedPaperId};
    const referenceId = savedPaperId || referenceKey(current);
    const referencePath = checker.references.path(uid, referenceId);
    const [reference, usage] = await Promise.all([tx.get(referencePath), tx.get(quota(uid))]);
    const now = checker.now();
    if (!reference) {
      ensureQueueSpace(checker, usage);
      const pageCount = current.question.pageCount;
      const entry = {
        id: referenceId, ownerUid: uid, title: current.title, uploadTitle: current.title,
        state: 'queued', createdAt: now, updatedAt: now, version: 0, questionPages: pageCount, pageCount,
        uploaded: current.question.pages, queueId: digest(uid, 'submission-reference', referenceId),
        submissionUploadId: current.id, submissionUploadKind: 'question', requiresPaperReview: true
      };
      tx.create(referencePath, entry);
      createQueueEntry(tx, uid, referencePath, referenceId, entry, now, 'external-exam');
      tx.set(quota(uid), {...usage, active: (usage?.active || 0) + 1});
      checker.service.notifyDispatch(tx, uid, 'checking');
    } else {
      checker.service.notifyContent(tx, uid);
    }
    tx.update(path, {referenceId, referenceRevision: current.revision, referencePreparedByUid: actorUid,
      updatedAt: now, version: current.version + 1});
    notifySubmissionInbox(tx, now);
    return {referenceId};
  });
}

export function queueSubmissionSheet(checker, tx, current, paperId, rubric, now, {attemptId,examIdentity}={}) {
  const uid=current.ownerUid;
  const identity=[uid,current.id,current.revision];
  if(attemptId)identity.push('assessment-recovery',attemptId);
  const sheetId='submission-'+digest(...identity).slice(0,45);
  const sheetPath=sheets(uid,paperId)+'/'+sheetId;
  const sheet={
    id:sheetId,label:current.studentLabel,studentUid:current.studentUid,studentLabel:current.studentLabel,
    labelFromStudent:true,singleStudentBook:true,notes:'',version:0,state:'queued',
    createdAt:current.submittedAt||current.createdAt,updatedAt:now,uploaded:current.answer.pages,
    pageCount:current.answer.pageCount,queueId:digest(uid,paperId,sheetId),
    submissionUploadId:current.id,submissionUploadKind:'answer',approvalRevision:current.revision,
    automatic:true,rubricDigest:rubric?digest(rubric):null,
    ...(examIdentity ? {examIdentity} : {}),
    ...(attemptId?{assessmentRecoveryId:attemptId}:{})
  };
  tx.create(sheetPath,sheet);
  createQueueEntry(tx,uid,sheetPath,paperId,sheet,now,'auto-grade');
  if(!attemptId)indexStudent(tx,uid,sheet,'sheet',paperId);
  return {paperId,paperTitle:rubric?.title||current.title,sheetId,...(examIdentity ? {examIdentity} : {})};
}

export async function approveSubmission(checker, actorUid, id, body, {batch=false, approvalScope}={}) {
  const path = submissionPath(checker.id(id));
  return checker.store.transaction(async tx => {
    const current = await staffSubmission(checker, tx, actorUid, path, {queueing:true});
    const uid = current.ownerUid;
    if (['checking','released'].includes(current.status) && current.approvedAt) {
      if (body.paperId && current.paperId !== body.paperId)
        checker.fail(409,'submission_changed','This submission was approved against another paper.');
      if(batch)verifyApprovalScope(checker,approvalScope,current.approvedScope || submissionApprovalScope(uid,current.paperId));
      return {paperId:current.paperId??null,sheetId:current.sheetId??null,referenceId:current.referenceId??null};
    }
    submittedRevision(checker,current,body.version);
    if (current.paperId && body.paperId && body.paperId !== current.paperId)
      checker.fail(409,'paper_changed','This submission is attached to the paper used in its test link.');
    const [matchedPaperId,usage,profile]=await Promise.all([
      current.paperId?null:confirmedPaper(tx,current),tx.get(quota(uid)),tx.get('users/'+checker.id(current.studentUid))
    ]);
    if(!profile)checker.fail(409,'student_unavailable','The submitted student account is unavailable.');
    ensureQueueSpace(checker,usage);
    if(!current.paperId&&body.paperId&&(body.confirmReference!==true||matchedPaperId&&body.paperId!==matchedPaperId))
      checker.fail(409,'paper_confirmation_required','Use the confirmed question paper for this version.');
    let linkedPaperId=linkedSubmissionPaper(current,matchedPaperId);
    const reviewedReferenceId=currentReferenceId(current);
    if(!linkedPaperId&&reviewedReferenceId){
      const reference=await tx.get(checker.references.path(uid,reviewedReferenceId));
      linkedPaperId=linkedSubmissionPaper(current,matchedPaperId,reference);
    }
    if((batch||actorUid!==uid&&body.paperId) && (!linkedPaperId||body.paperId!==linkedPaperId)){
      checker.fail(409,'paper_confirmation_required','Batch or shared approval requires the paper already linked to this submission.');
    }
    const paperId=body.paperId||linkedPaperId;
    const now=checker.now();
    let next;
    if(paperId){
      const source=await checker.sourcePaper(tx,paperId,uid);
      if(body.paperId&&!current.paperId&&body.paperId!==matchedPaperId&&!source)checker.notFound();
      const rubric=gradingRubric(source);
      if(batch&&!rubric)checker.fail(409,'paper_confirmation_required','The linked paper has no usable marking reference.');
      const identity=source?.examIdentity;
      const scope=submissionApprovalScope(uid,paperId,identity);
      if(batch)verifyApprovalScope(checker,approvalScope, !approvedExamSourceMatches(source,identity) ||
        identity && identity.rubricDigest!==digest(rubric) ? null : scope);
      next=queueSubmissionSheet(checker,tx,current,paperId,rubric,now,{examIdentity:identity});
      if(scope)next.approvedScope=scope;
      if(body.paperId&&!current.paperId&&!matchedPaperId&&current.questionFingerprint)
        tx.create(confirmedPaperPath(uid,current.questionFingerprint),{paperId,confirmedAt:now});
    }else{
      if(!current.question?.pages?.length||!shaPattern.test(current.questionFingerprint||''))
        checker.fail(409,'question_scan_unavailable','The approved submission needs its complete question scan.');
      const sourceFingerprint=current.questionFingerprint;
      const sourceEvidence=await tx.get(verifiedQuestionSourcePath(uid,sourceFingerprint));
      const referenceId='ext-auto-'+digest(uid,id,current.revision,sourceFingerprint).slice(0,48);
      const referencePath=checker.references.path(uid,referenceId);
      const pageCount=current.question.pageCount;
      const entry={
        id:referenceId,ownerUid:uid,title:current.title,uploadTitle:current.title,state:'queued',
        createdAt:now,updatedAt:now,version:0,questionPages:pageCount,pageCount,
        uploaded:current.question.pages,queueId:digest(uid,'auto-reference',referenceId),
        submissionUploadId:id,submissionUploadKind:'question',approvalRevision:current.revision,automatic:true,
        sourceFingerprint,...(sourceEvidence?{sourceEvidence}:{})
      };
      tx.create(referencePath,entry);
      createQueueEntry(tx,uid,referencePath,referenceId,entry,now,'auto-reference');
      next={paperId:null,sheetId:null,referenceId,referenceRevision:current.revision};
    }
    tx.update(path,{...next,status:'checking',approvedAt:now,approvedByUid:actorUid,approvalRevision:current.revision,automatic:true,
      updatedAt:now,version:current.version+1});
    tx.set(quota(uid),{...usage,active:(usage?.active||0)+1});
    moveStaffSubmissionIndex(tx,current,'checking',now);
    checker.service.notifyDispatch(tx,uid,'checking');
    return {paperId:next.paperId,sheetId:next.sheetId,referenceId:next.referenceId??null};
  });
}

function cachedRead(store, reads, path, fields) {
  const get = () => store.getSelected([path], fields).then(([row]) => row);
  if (!reads) return get();
  if (!reads.has(path)) reads.set(path, get());
  return reads.get(path);
}

const publishedOutcomes = new Set(['complete', 'partial', 'unassessable']);
const questionStatuses = new Set(['correct', 'partial', 'wrong', 'missing', 'unreadable', 'uncertain']);
const positiveMax = value => Number.isFinite(value) && value > 0 ? value : null;
const boundedAward = (value, max) => max > 0 && Number.isFinite(value) && value >= 0 && value <= max ? value : null;

export function staffReleasedAssessment(row, detail) {
  const result = row.result;
  if (row.status !== 'released' || !result) return {};
  const max = positiveMax(result.max);
  const finalAward = boundedAward(result.awarded, max);
  const storedAssessedMax = result.assessedMax === 0 ? 0 : positiveMax(result.assessedMax);
  const assessedMax = max !== null && storedAssessedMax > max ? null : storedAssessedMax;
  const legacyComplete = result.outcome === undefined && finalAward !== null && max !== null;
  const outcome = publishedOutcomes.has(result.outcome) ? result.outcome : legacyComplete ? 'complete' : null;
  const score = {
    outcome, awarded: outcome === 'complete' ? finalAward : null, max,
    assessedAwarded: boundedAward(result.assessedAwarded, assessedMax), assessedMax,
    pending: Number.isSafeInteger(result.pending) && result.pending >= 0 ? result.pending : null
  };
  if (!detail) return {score};
  const questionMarks = (Array.isArray(result.answers) ? result.answers.slice(0, 100) : [])
    .filter(answer => Number.isSafeInteger(answer?.number) && answer.number > 0 && questionStatuses.has(answer.status))
    .map(({number, status, awarded, max, counted, choice, explanation}) => {
      const questionMax = positiveMax(max);
      return {number, status, awarded: boundedAward(awarded, questionMax), max: questionMax,
        counted: typeof counted === 'boolean' ? counted : null,
        choice: choice === 'A' || choice === 'B' ? choice : null,
        explanation: typeof explanation === 'string' ? explanation.slice(0, 600) : ''};
    });
  return {score, questionMarks};
}

export async function staffTeacherAnswerPage(checker, row, index) {
  const result = row.result;
  if (row.teacherUpload !== true || row.automatic !== true || row.status !== 'released' || !row.releasedAt ||
      !row.paperId || !row.sheetId || !row.studentUid || result?.storage !== 'checking' ||
      !Number.isSafeInteger(row.publishedSheetVersion) || row.publishedSheetVersion < 1 ||
      result.sheetVersion !== row.publishedSheetVersion || !shaPattern.test(result.sha ?? '') ||
      !Number.isSafeInteger(row.answer?.pageCount) || !Number.isInteger(index) || index < 1 || index > row.answer.pageCount) checker.notFound();
  const path = sheets(row.ownerUid, checker.id(row.paperId)) + '/' + checker.id(row.sheetId);
  if (result.checkingPath !== path || row.id !== 'teacher-' + digest(row.ownerUid, row.paperId, row.sheetId).slice(0, 48)) checker.notFound();
  const [sheet] = await checker.store.getSelected([path], [
    'id', 'version', 'state', 'studentUid', 'pageCount', 'uploaded', 'scanSource', 'submissionUploadId', 'automatic',
    'checkingResult.sha', 'checkingResult.sheetVersion', 'checkingResult.fileKey', 'checkingResult.generation'
  ]);
  if (sheet?.id !== row.sheetId || sheet.version !== row.publishedSheetVersion || sheet.studentUid !== row.studentUid ||
      sheet.pageCount !== row.answer.pageCount || sheet.automatic !== true || sheet.submissionUploadId ||
      !['final', 'completed'].includes(sheet.state) || !Array.isArray(sheet.uploaded) || sheet.uploaded.length !== sheet.pageCount ||
      sheet.checkingResult?.sha !== result.sha || sheet.checkingResult.sheetVersion !== result.sheetVersion ||
      sheet.checkingResult.fileKey !== result.fileKey || sheet.checkingResult.generation !== result.generation) checker.notFound();
  return checker.page(path, sheet, index);
}

export async function submissionProgress(checker, row, reads) {
  const read = (path, fields) => cachedRead(checker.store, reads, path, fields);
  if(row.automatic&&row.status==='released')return {
    paperId:row.paperId??null,paperTitle:row.paperTitle||row.title,sheetId:row.sheetId??null,
    releasedAt:row.releasedAt,automatic:true,outcome:row.result?.outcome??null,message:row.result?.message??null
  };
  if(row.automatic&&row.referenceId&&!row.sheetId)return {
    paperReady:false,referenceId:row.referenceId,referenceState:'running',automatic:true
  };
  if (row.sheetId && row.paperId) {
    const sheet = await read(sheets(row.ownerUid, row.paperId) + '/' + row.sheetId,
      ['state', 'version', 'error', 'gradingRevision', 'gradeRevision', 'grade.awarded', 'grade.max', 'grade.pending']);
    const grade = currentSheetGrade(sheet || {});
    const out = {
      paperId: row.paperId, paperTitle: row.paperTitle, paperReady: true, sheetId: row.sheetId, automatic:row.automatic===true,
      sheetState: sheet?.state || 'unavailable', sheetVersion: sheet?.version ?? null
    };
    if (row.status === 'submitted') out.batchPaperId = row.paperId;
    if (sheet?.state === 'failed') out.error = sheet.error || 'Checking stopped. The teacher can retry.';
    if (row.status === 'released') {
      out.releasedAt = row.releasedAt;
      out.updatedCopyReady = sheet?.state === 'final' && Number.isSafeInteger(row.publishedSheetVersion) &&
        sheet.version > row.publishedSheetVersion;
    }
    if (grade && row.status !== 'released') Object.assign(out, {awarded: grade.awarded, max: grade.max, pending: grade.pending});
    return out;
  }
  const matched = row.questionFingerprint
    ? (await read(confirmedPaperPath(row.ownerUid, row.questionFingerprint), ['paperId']))?.paperId
    : null;
  const paperId = linkedSubmissionPaper(row, matched);
  if (paperId && !paperId.startsWith('ext-')) {
    const paper = await read('assistantPapers/' + paperId, ['title','examIdentity']);
    return {paperId, paperTitle: paper?.title || row.title, paperReady: !!paper, batchPaperId: paper ? paperId : null,
      examIdentity:paper?.examIdentity};
  }
  const referenceId = paperId || row.referenceId || (row.questionFingerprint ? referenceKey(row) : null);
  if (!referenceId) return {paperReady: false};
  const reference = await read(checker.references.path(row.ownerUid, referenceId), ['title', 'state', 'requiresPaperReview', 'reviewedAt', 'examIdentity']);
  if (!reference) return {paperReady: false};
  const paperReady = reference.state === 'ready' && (!reference.requiresPaperReview || !!reference.reviewedAt);
  return {
    referenceId, referenceState: reference.state, paperReady, batchPaperId: paperReady ? linkedSubmissionPaper(row, matched, reference) : null,
    ...(paperReady ? {paperId: referenceId, paperTitle: reference.title, examIdentity:reference.examIdentity} : {})
  };
}

export function resultShape(checker, {sheetVersion, size, sha}) {
  if (!Number.isSafeInteger(sheetVersion) || sheetVersion < 0 || !Number.isSafeInteger(size) ||
      size < 12 || size > maxResultBytes || typeof sha !== 'string' || !shaPattern.test(sha)) {
    checker.fail(400, 'invalid_result', 'Export a marked PDF no larger than 22 MB.');
  }
  return {sheetVersion, size, sha, chunks: Math.ceil(size / chunkBytes)};
}

const expectedLength = (stage, index) => Math.min(chunkBytes, stage.size - index * chunkBytes);

function approvedSheet(checker, record, sheet, {version, sheetVersion}) {
  if(record.automatic||sheet?.automatic)
    checker.fail(409,'automatic_handback','This result is returned automatically.');
  const grade = currentSheetGrade(sheet || {});
  if (record.version !== version || sheet?.version !== sheetVersion ||
      !['checking', 'released'].includes(record.status) || sheet?.state !== 'final' || !grade ||
      grade.pending || sheet.studentUid !== record.studentUid || sheet.submissionUploadId !== record.id) {
    checker.fail(409, 'result_changed', 'Open the latest approved marks before releasing the result.');
  }
  return grade;
}

export async function stageSubmissionResult(checker, actorUid, id, index, body) {
  const path = submissionPath(checker.id(id));
  const stage = resultShape(checker, body);
  if (!Number.isSafeInteger(index) || index < 0 || index >= stage.chunks ||
      typeof body.data !== 'string' || body.data.length > Math.ceil(chunkBytes / 3) * 4) {
    checker.fail(400, 'invalid_result_chunk', 'The exported PDF could not be uploaded.');
  }
  const bytes = Buffer.from(body.data, 'base64');
  if (bytes.length !== expectedLength(stage, index) || bytes.toString('base64') !== body.data ||
      (index === 0 && bytes.subarray(0, 5).toString() !== '%PDF-')) {
    checker.fail(400, 'invalid_result_chunk', 'The exported PDF could not be uploaded.');
  }
  const staged = stagePath(path, stage.sheetVersion);
  const part = chunkPath(staged, index);
  return checker.store.transaction(async tx => {
    const record = await staffSubmission(checker, tx, actorUid, path);
    if (record.result?.sheetVersion === stage.sheetVersion) {
      if (record.result.sha === stage.sha) return {ok: true};
      checker.fail(409, 'result_released', 'This approved revision is already released.');
    }
    if (!record.sheetId || !record.paperId) checker.notFound();
    const [sheet, previous, savedChunk] = await Promise.all([
      tx.get(sheets(record.ownerUid, record.paperId) + '/' + record.sheetId), tx.get(staged), tx.get(part)
    ]);
    approvedSheet(checker, record, sheet, body);
    const sameStage = previous?.sha === stage.sha && previous.size === stage.size;
    if (index !== 0 && !sameStage) {
      checker.fail(409, 'upload_changed', 'Start uploading the current marked PDF again.');
    }
    if (sameStage && savedChunk?.generation === previous.generation) {
      if (!Buffer.from(savedChunk.bytes).equals(bytes)) {
        checker.fail(409, 'upload_changed', 'Upload the current marked PDF again.');
      }
      return {ok: true};
    }
    const generation = sameStage ? previous.generation : randomUUID();
    if (!sameStage) tx.set(staged, {...stage, generation});
    tx.set(part, {generation, bytes});
    return {ok: true};
  });
}

export async function readResultBytes(checker, path, stage, download) {
  const sha = createHash('sha256');
  const result = download ? Buffer.allocUnsafe(stage.size) : null;
  let end = Buffer.alloc(0);
  for (let start = 0; start < stage.chunks; start += 4) {
    const count = Math.min(4, stage.chunks - start);
    const rows = await checker.store.getSelected(
      Array.from({length: count}, (_, i) => chunkPath(path, start + i)), ['generation', 'bytes']);
    for (const [offset, row] of rows.entries()) {
      const index = start + offset;
      const bytes = row?.generation === stage.generation && row?.bytes ? Buffer.from(row.bytes) : null;
      if (!bytes || bytes.length !== expectedLength(stage, index)) {
        checker.fail(409, 'result_upload_incomplete', 'Finish uploading the marked PDF before release.');
      }
      sha.update(bytes);
      if (result) bytes.copy(result, index * chunkBytes);
      if (index >= stage.chunks - 2) end = Buffer.concat([end, bytes.subarray(-16)]).subarray(-16);
    }
  }
  if (sha.digest('hex') !== stage.sha || !end.toString('latin1').trimEnd().endsWith('%%EOF')) {
    checker.fail(409, 'result_integrity', 'Export the approved marked PDF again before release.');
  }
  return result;
}

export async function releaseSubmission(checker, actorUid, id, body) {
  const path = submissionPath(checker.id(id));
  const stage = resultShape(checker, body);
  const staged = stagePath(path, stage.sheetVersion);
  const [current, prepared] = await Promise.all([
    staffSubmission(checker, checker.store, actorUid, path), checker.store.get(staged)
  ]);
  if (current.result?.sheetVersion === stage.sheetVersion && current.result.sha === stage.sha) return {ok: true};
  if (!current.sheetId || !current.paperId) checker.notFound();
  approvedSheet(checker, current, await checker.store.get(sheets(current.ownerUid, current.paperId) + '/' + current.sheetId), body);
  if (prepared?.sha !== stage.sha || prepared.size !== stage.size) {
    checker.fail(409, 'upload_changed', 'Upload the latest approved marked PDF again before release.');
  }
  await readResultBytes(checker, staged, prepared, false);
  return checker.store.transaction(async tx => {
    const record = await staffSubmission(checker, tx, actorUid, path);
    if (record.result?.sheetVersion === stage.sheetVersion && record.result.sha === stage.sha) return {ok: true};
    if (!record.sheetId || !record.paperId) checker.notFound();
    const [sheet, saved] = await Promise.all([
      tx.get(sheets(record.ownerUid, record.paperId) + '/' + record.sheetId), tx.get(staged)
    ]);
    const grade = approvedSheet(checker, record, sheet, body);
    if (saved?.generation !== prepared.generation) {
      checker.fail(409, 'upload_changed', 'Upload the latest approved marked PDF again before release.');
    }
    const {title: paperTitle} = await checker.rubric(sheet.gradingPaperId || record.paperId, record.ownerUid, tx);
    const now = checker.now();
    const feedback = grade.answers.map(({number, status, awarded, max, explanation, counted}) =>
      ({number, status, awarded, max, explanation, counted: counted !== false}));
    tx.update(path, {status: 'released', paperTitle, publishedSheetVersion: stage.sheetVersion,
      releasedAt: now, releasedByUid: actorUid, updatedAt: now, version: record.version + 1,
      result: {...stage, generation: prepared.generation, awarded: grade.awarded, max: grade.max, answers: feedback}});
    if (record.status !== 'released') moveStaffSubmissionIndex(tx, record, 'released', now);
    else notifySubmissionInbox(tx, now);
    checker.service.notifyContent(tx, record.ownerUid);
    enqueueExamUpdate(tx,{kind:'result-complete',entityId:record.id,version:stage.sheetVersion+'-'+stage.sha,at:now});
    return {ok: true};
  });
}

async function releasedRecord(checker, studentUid, id) {
  const record = await checker.store.get(submissionPath(checker.id(id)));
  if (record?.studentUid !== studentUid || record.status !== 'released' || !record.result) checker.notFound();
  return record;
}

export async function studentResult(checker, studentUid, id) {
  const record = await releasedRecord(checker, studentUid, id);
  const {awarded,max,answers,pending=0,outcome='complete',message=null,assessedAwarded=null,assessedMax=null}=record.result;
  const share = releasedAssessment(record);
  return {
    rubric: {title: record.paperTitle || record.title, marks: max},
    sheet:{grade:{awarded,max,pending,answers}},outcome,message,assessedAwarded,assessedMax,
    filename: share.filename, releasedAt: record.releasedAt, share
  };
}

async function reportDownload(checker, record, id, expectedRevision) {
  const result = record.result;
  const file = releasedAssessment(record);
  if (expectedRevision !== null && expectedRevision !== file.revision) {
    checker.fail(409,'report_changed','The released report changed. Prepare the latest files again.');
  }
  const bytes = await readResultBytes(checker, stagePath(result.checkingPath ?? submissionPath(id),
    result.fileKey ?? result.sheetVersion), result, true);
  return {bytes, filename:file.filename};
}

export async function studentResultPdf(checker, studentUid, id, expectedRevision = null) {
  return reportDownload(checker, await releasedRecord(checker, studentUid, id), id, expectedRevision);
}

async function staffReleasedRecord(checker, actorUid, id) {
  const record = await staffSubmission(checker,checker.store,actorUid,submissionPath(checker.id(id)),{write:false});
  if (record.status !== 'released' || !record.result) checker.notFound();
  return record;
}

export async function staffResult(checker, actorUid, id) {
  return {share:releasedAssessment(await staffReleasedRecord(checker, actorUid, id))};
}

export async function staffResultPdf(checker, actorUid, id, expectedRevision = null) {
  return reportDownload(checker, await staffReleasedRecord(checker, actorUid, id), id, expectedRevision);
}

export async function legacySubmissionSource(checker, actorUid, id, page) {
  const record = await staffSubmission(checker, checker.store, actorUid, submissionPath(checker.id(id)), {write:false});
  if (!record.sheetId || !record.paperId) checker.notFound();
  const source = sheets(record.ownerUid, record.paperId) + '/' + record.sheetId;
  const sheet = await checker.store.get(source);
  const grade = approvedSheet(checker, record, sheet, {version:record.version, sheetVersion:sheet?.version});
  if (page !== undefined) return checker.page(source, sheet, page);
  const {title, marks} = await checker.rubric(sheet.gradingPaperId || record.paperId, record.ownerUid);
  const {id:sheetId, version, state, pageCount, label, studentUid, studentLabel, labelFromStudent, singleStudentBook} = sheet;
  return {
    rubric:{title, marks},
    sheet:{id:sheetId, version, state, pageCount, label, studentUid, studentLabel,
      labelFromStudent:!!labelFromStudent, singleStudentBook:!!singleStudentBook, grade,
      uploaded:sheet.uploaded.map(({index, width, height})=>({index, width, height}))}
  };
}
