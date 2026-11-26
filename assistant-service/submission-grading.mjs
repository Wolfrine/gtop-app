import {gradingRubric} from './domain/checking.mjs';
import {createHash, randomUUID} from 'node:crypto';
import {currentSheetGrade, digest, maxActive, orderedKey, queue, queueField, quota, sheets} from './checking-storage.mjs';
import {indexStudent} from './checking-student.mjs';
import {confirmedPaperPath, moveStaffSubmissionIndex, notifySubmissionInbox, submissionPath} from './student-submission-storage.mjs';

import {staffSubmission} from './student-submission-access.mjs';

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
      checker.service.notifyDispatch(tx, uid);
    } else {
      checker.service.notifyContent(tx, uid);
    }
    tx.update(path, {referenceId, referenceRevision: current.revision, referencePreparedByUid: actorUid,
      updatedAt: now, version: current.version + 1});
    notifySubmissionInbox(tx, now);
    return {referenceId};
  });
}

export function queueSubmissionSheet(checker, tx, current, paperId, rubric, now) {
  const uid=current.ownerUid;
  const sheetId='submission-'+digest(uid,current.id,current.revision).slice(0,45);
  const sheetPath=sheets(uid,paperId)+'/'+sheetId;
  const sheet={
    id:sheetId,label:current.studentLabel,studentUid:current.studentUid,studentLabel:current.studentLabel,
    labelFromStudent:true,singleStudentBook:true,notes:'',version:0,state:'queued',
    createdAt:current.submittedAt||current.createdAt,updatedAt:now,uploaded:current.answer.pages,
    pageCount:current.answer.pageCount,queueId:digest(uid,paperId,sheetId),
    submissionUploadId:current.id,submissionUploadKind:'answer',approvalRevision:current.revision,
    automatic:true,rubricDigest:rubric?digest(rubric):null
  };
  tx.create(sheetPath,sheet);
  createQueueEntry(tx,uid,sheetPath,paperId,sheet,now,'auto-grade');
  indexStudent(tx,uid,sheet,'sheet',paperId);
  return {paperId,paperTitle:rubric?.title||current.title,sheetId};
}

export async function approveSubmission(checker, actorUid, id, body, {batch=false}={}) {
  const path = submissionPath(checker.id(id));
  return checker.store.transaction(async tx => {
    const current = await staffSubmission(checker, tx, actorUid, path, {queueing:true});
    const uid = current.ownerUid;
    if (['checking','released'].includes(current.status) && current.approvedAt) {
      if (body.paperId && current.paperId !== body.paperId)
        checker.fail(409,'submission_changed','This submission was approved against another paper.');
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
    let linkedPaperId=current.paperId||matchedPaperId;
    if(!linkedPaperId&&current.referenceId&&current.referenceRevision===current.revision){
      const reference=await tx.get(checker.references.path(uid,current.referenceId));
      if(reference?.state==='ready'&&reference.reviewedAt)linkedPaperId=current.referenceId;
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
      next=queueSubmissionSheet(checker,tx,current,paperId,rubric,now);
      if(body.paperId&&!current.paperId&&!matchedPaperId&&current.questionFingerprint)
        tx.create(confirmedPaperPath(uid,current.questionFingerprint),{paperId,confirmedAt:now});
    }else{
      if(!current.question?.pages?.length||!shaPattern.test(current.questionFingerprint||''))
        checker.fail(409,'question_scan_unavailable','The approved submission needs its complete question scan.');
      const referenceId='ext-auto-'+digest(uid,id,current.revision,current.questionFingerprint).slice(0,48);
      const referencePath=checker.references.path(uid,referenceId);
      const pageCount=current.question.pageCount;
      const entry={
        id:referenceId,ownerUid:uid,title:current.title,uploadTitle:current.title,state:'queued',
        createdAt:now,updatedAt:now,version:0,questionPages:pageCount,pageCount,
        uploaded:current.question.pages,queueId:digest(uid,'auto-reference',referenceId),
        submissionUploadId:id,submissionUploadKind:'question',approvalRevision:current.revision,automatic:true
      };
      tx.create(referencePath,entry);
      createQueueEntry(tx,uid,referencePath,referenceId,entry,now,'auto-reference');
      next={paperId:null,sheetId:null,referenceId,referenceRevision:current.revision};
    }
    tx.update(path,{...next,status:'checking',approvedAt:now,approvedByUid:actorUid,approvalRevision:current.revision,automatic:true,
      updatedAt:now,version:current.version+1});
    tx.set(quota(uid),{...usage,active:(usage?.active||0)+1});
    moveStaffSubmissionIndex(tx,current,'checking',now);
    checker.service.notifyDispatch(tx,uid);
    return {paperId:next.paperId,sheetId:next.sheetId,referenceId:next.referenceId??null};
  });
}

function cachedRead(store, reads, path, fields) {
  const get = () => store.getSelected([path], fields).then(([row]) => row);
  if (!reads) return get();
  if (!reads.has(path)) reads.set(path, get());
  return reads.get(path);
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
  const paperId = row.paperId || matched;
  if (paperId && !paperId.startsWith('ext-')) {
    const paper = await read('assistantPapers/' + paperId, ['title']);
    return {paperId, paperTitle: paper?.title || row.title, paperReady: !!paper};
  }
  const referenceId = paperId || row.referenceId || (row.questionFingerprint ? referenceKey(row) : null);
  if (!referenceId) return {paperReady: false};
  const reference = await read(checker.references.path(row.ownerUid, referenceId), ['title', 'state', 'requiresPaperReview', 'reviewedAt']);
  if (!reference) return {paperReady: false};
  const paperReady = reference.state === 'ready' && (!reference.requiresPaperReview || !!reference.reviewedAt);
  return {
    referenceId, referenceState: reference.state, paperReady,
    ...(paperReady ? {paperId: referenceId, paperTitle: reference.title} : {})
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
  const {awarded,max,answers,pending=0,outcome='complete',message=null,assessedAwarded=null}=record.result;
  return {
    rubric: {title: record.paperTitle || record.title, marks: max},
    sheet:{grade:{awarded,max,pending,answers}},outcome,message,assessedAwarded,
    filename: 'checked-answer-sheet.pdf', releasedAt: record.releasedAt
  };
}

export async function studentResultPdf(checker, studentUid, id) {
  const record = await releasedRecord(checker, studentUid, id);
  return readResultBytes(checker, stagePath(record.result.checkingPath??submissionPath(id), record.result.fileKey??record.result.sheetVersion), record.result, true);
}

export async function staffResultPdf(checker,actorUid,id){
  const record=await staffSubmission(checker,checker.store,actorUid,submissionPath(checker.id(id)),{write:false});
  if(record.status!=='released'||!record.result)checker.notFound();
  return readResultBytes(checker,stagePath(record.result.checkingPath??submissionPath(id),
    record.result.fileKey??record.result.sheetVersion),record.result,true);
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
