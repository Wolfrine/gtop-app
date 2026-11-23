import {createHash, randomUUID} from 'node:crypto';
import {currentSheetGrade, digest, maxActive, orderedKey, queue, queueField, quota, sheets} from './checking-storage.mjs';
import {indexStudent} from './checking-student.mjs';
import {confirmedPaperPath, moveStaffSubmissionIndex, submissionPath} from './student-submission-storage.mjs';

const chunkBytes = 400_000;
const maxResultBytes = 22_000_000;
const shaPattern = /^[a-f0-9]{64}$/;
const stagePath = (path, sheetVersion) => path + '/resultFiles/' + sheetVersion;
const chunkPath = (stage, index) => stage + '/chunks/' + index;

async function staffSubmission(checker, tx, uid, path) {
  const [record, profile, pilot, policy] = await Promise.all([
    tx.get(path), tx.get('users/' + uid), tx.get('assistantConfig/pilot'),
    tx.get('assistantConfig/studentSubmissions')
  ]);
  if (profile?.role !== 'admin' || !pilot?.allowedOwnerUids?.includes(uid) || policy?.enabled === false) {
    checker.fail(403, 'pilot_access_required', 'Your submission access has changed.');
  }
  if (record?.ownerUid !== uid || record.status === 'draft') checker.notFound();
  return record;
}

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

function createQueueEntry(tx, uid, path, paperId, record, now, kind) {
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

export async function prepareSubmissionReference(checker, uid, id, {version}) {
  const path = submissionPath(checker.id(id));
  return checker.store.transaction(async tx => {
    const current = await staffSubmission(checker, tx, uid, path);
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
    tx.update(path, {referenceId, referenceRevision: current.revision, updatedAt: now, version: current.version + 1});
    return {referenceId};
  });
}

export async function approveSubmission(checker, uid, id, body) {
  const path = submissionPath(checker.id(id));
  return checker.store.transaction(async tx => {
    const current = await staffSubmission(checker, tx, uid, path);
    if (current.sheetId && current.paperId && ['checking', 'released'].includes(current.status)) {
      if (body.paperId && body.paperId !== current.paperId) {
        checker.fail(409, 'submission_changed', 'This submission is already checking against another paper.');
      }
      return {paperId: current.paperId, sheetId: current.sheetId};
    }
    submittedRevision(checker, current, body.version);
    if (current.paperId && body.paperId && body.paperId !== current.paperId) {
      checker.fail(409, 'paper_changed', 'This submission is attached to the paper used in its test link.');
    }
    const matchedPaperId = await confirmedPaper(tx, current);
    const paperId = current.paperId || body.paperId || matchedPaperId || current.referenceId ||
      (current.questionFingerprint ? referenceKey(current) : null);
    if (!paperId) checker.fail(409, 'choose_paper', 'Confirm the question paper before checking the answers.');
    checker.id(paperId);
    if (!current.paperId && (!matchedPaperId && body.confirmReference !== true || matchedPaperId && paperId !== matchedPaperId)) {
      checker.fail(409, 'paper_confirmation_required', 'Use the confirmed question paper for this version.');
    }

    const [rubric, reference, usage, profile] = await Promise.all([
      checker.rubric(paperId, uid, tx),
      paperId.startsWith('ext-') ? tx.get(checker.references.path(uid, paperId)) : null,
      tx.get(quota(uid)), tx.get('users/' + checker.id(current.studentUid))
    ]);
    if (reference?.requiresPaperReview && !reference.reviewedAt) {
      checker.fail(409, 'paper_review_required', 'Review the uploaded question paper before checking the answers.');
    }
    if (!profile) checker.fail(409, 'student_unavailable', 'The submitted student account is unavailable.');
    ensureQueueSpace(checker, usage);
    const sheetId = 'submission-' + digest(uid, id, current.revision).slice(0, 45);
    const sheetPath = sheets(uid, paperId) + '/' + sheetId;
    const createdAt = current.submittedAt || current.createdAt;
    const now = checker.now();
    const sheet = {
      id: sheetId, label: current.studentLabel, studentUid: current.studentUid, studentLabel: current.studentLabel,
      labelFromStudent: true, singleStudentBook: true, notes: '', version: 0, state: 'queued', createdAt, updatedAt: now,
      uploaded: current.answer.pages, pageCount: current.answer.pageCount, queueId: digest(uid, paperId, sheetId),
      submissionUploadId: current.id, submissionUploadKind: 'answer'
    };
    tx.create(sheetPath, sheet);
    createQueueEntry(tx, uid, sheetPath, paperId, sheet, now);
    tx.set(quota(uid), {...usage, active: (usage?.active || 0) + 1});
    indexStudent(tx, uid, sheet, 'sheet', paperId);
    if (!current.paperId && current.questionFingerprint && !matchedPaperId) {
      tx.create(confirmedPaperPath(uid, current.questionFingerprint), {paperId, confirmedAt: now});
    }
    tx.update(path, {status: 'checking', paperId, paperTitle: rubric.title, sheetId, approvedAt: now,
      updatedAt: now, version: current.version + 1});
    moveStaffSubmissionIndex(tx, current, 'checking', now);
    checker.service.notifyDispatch(tx, uid);
    return {paperId, sheetId};
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
  if (row.sheetId && row.paperId) {
    const sheet = await read(sheets(row.ownerUid, row.paperId) + '/' + row.sheetId,
      ['state', 'version', 'error', 'gradingRevision', 'gradeRevision', 'grade.awarded', 'grade.max', 'grade.pending']);
    const grade = currentSheetGrade(sheet || {});
    const out = {
      paperId: row.paperId, paperTitle: row.paperTitle, paperReady: true, sheetId: row.sheetId,
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

function resultShape(checker, {sheetVersion, size, sha}) {
  if (!Number.isSafeInteger(sheetVersion) || sheetVersion < 0 || !Number.isSafeInteger(size) ||
      size < 12 || size > maxResultBytes || typeof sha !== 'string' || !shaPattern.test(sha)) {
    checker.fail(400, 'invalid_result', 'Export a marked PDF no larger than 22 MB.');
  }
  return {sheetVersion, size, sha, chunks: Math.ceil(size / chunkBytes)};
}

const expectedLength = (stage, index) => Math.min(chunkBytes, stage.size - index * chunkBytes);

function approvedSheet(checker, record, sheet, {version, sheetVersion}) {
  const grade = currentSheetGrade(sheet || {});
  if (record.version !== version || sheet?.version !== sheetVersion ||
      !['checking', 'released'].includes(record.status) || sheet?.state !== 'final' || !grade ||
      grade.pending || sheet.studentUid !== record.studentUid || sheet.submissionUploadId !== record.id) {
    checker.fail(409, 'result_changed', 'Open the latest approved marks before releasing the result.');
  }
  return grade;
}

export async function stageSubmissionResult(checker, uid, id, index, body) {
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
    const record = await staffSubmission(checker, tx, uid, path);
    if (record.result?.sheetVersion === stage.sheetVersion) {
      if (record.result.sha === stage.sha) return {ok: true};
      checker.fail(409, 'result_released', 'This approved revision is already released.');
    }
    if (!record.sheetId || !record.paperId) checker.notFound();
    const [sheet, previous, savedChunk] = await Promise.all([
      tx.get(sheets(uid, record.paperId) + '/' + record.sheetId), tx.get(staged), tx.get(part)
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

async function readResultBytes(checker, path, stage, download) {
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

export async function releaseSubmission(checker, uid, id, body) {
  const path = submissionPath(checker.id(id));
  const stage = resultShape(checker, body);
  const staged = stagePath(path, stage.sheetVersion);
  const [current, prepared] = await Promise.all([
    staffSubmission(checker, checker.store, uid, path), checker.store.get(staged)
  ]);
  if (current.result?.sheetVersion === stage.sheetVersion && current.result.sha === stage.sha) return {ok: true};
  if (!current.sheetId || !current.paperId) checker.notFound();
  approvedSheet(checker, current, await checker.store.get(sheets(uid, current.paperId) + '/' + current.sheetId), body);
  if (prepared?.sha !== stage.sha || prepared.size !== stage.size) {
    checker.fail(409, 'upload_changed', 'Upload the latest approved marked PDF again before release.');
  }
  await readResultBytes(checker, staged, prepared, false);
  return checker.store.transaction(async tx => {
    const record = await staffSubmission(checker, tx, uid, path);
    if (record.result?.sheetVersion === stage.sheetVersion && record.result.sha === stage.sha) return {ok: true};
    if (!record.sheetId || !record.paperId) checker.notFound();
    const [sheet, saved] = await Promise.all([
      tx.get(sheets(uid, record.paperId) + '/' + record.sheetId), tx.get(staged)
    ]);
    const grade = approvedSheet(checker, record, sheet, body);
    if (saved?.generation !== prepared.generation) {
      checker.fail(409, 'upload_changed', 'Upload the latest approved marked PDF again before release.');
    }
    const {title: paperTitle} = await checker.rubric(sheet.gradingPaperId || record.paperId, uid, tx);
    const now = checker.now();
    const feedback = grade.answers.map(({number, status, awarded, max, explanation, counted}) =>
      ({number, status, awarded, max, explanation, counted: counted !== false}));
    tx.update(path, {status: 'released', paperTitle, publishedSheetVersion: stage.sheetVersion,
      releasedAt: now, updatedAt: now, version: record.version + 1,
      result: {...stage, generation: prepared.generation, awarded: grade.awarded, max: grade.max, answers: feedback}});
    if (record.status !== 'released') moveStaffSubmissionIndex(tx, record, 'released', now);
    checker.service.notifyContent(tx, uid);
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
  const {awarded, max, answers} = record.result;
  return {
    rubric: {title: record.paperTitle || record.title, marks: max},
    sheet: {grade: {awarded, max, pending: 0, answers}},
    filename: 'checked-answer-sheet.pdf', releasedAt: record.releasedAt
  };
}

export async function studentResultPdf(checker, studentUid, id) {
  const record = await releasedRecord(checker, studentUid, id);
  return readResultBytes(checker, stagePath(submissionPath(id), record.result.sheetVersion), record.result, true);
}
