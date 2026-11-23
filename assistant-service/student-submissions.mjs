import {HttpError} from './service.mjs';
import {day, digest} from './checking-storage.mjs';
import {maxCheckingPages} from './domain/checking-limits.mjs';
import {maxExternalPages} from './domain/external-reference.mjs';
import {assertEnrollment, currentEnrollment, getSubmissionTest, submissionsEnabled} from './student-submission-access.mjs';
import {
  moveStaffSubmissionIndex, ownerSubmissions, staffSubmissionStatePath, staffSubmissionStates, studentSubmissions, submissionLimitPath, submissionPagePath, submissionPath, submissionSummary
} from './student-submission-storage.mjs';

const pageSize = 25;
const limits = {answer: maxCheckingPages, question: maxExternalPages};
const dailyDraftLimit = 8;
const dailyPageLimit = 168;
const fail = (status, code, message) => { throw new HttpError(status, code, message); };
const unavailable = () => fail(404, 'submission_unavailable', 'This submission is unavailable.');
const changed = () => fail(409, 'submission_changed', 'This submission changed. Reload the latest version.');
const progressStub = () => ({});

export async function authorizedSubmission(checker, uid, id, staff, reader = checker.store) {
  const row = await reader.get(submissionPath(checker.id(id)));
  if (!row || (staff ? row.ownerUid !== uid || row.status === 'draft' : row.studentUid !== uid)) unavailable();
  return row;
}

function projectedPageCount(value, type) {
  if (!Number.isInteger(value) || value < 1 || value > limits[type]) {
    fail(400, 'invalid_pages', 'Choose between 1 and ' + limits[type] + ' ' + type + ' pages.');
  }
  return value;
}

function attachment(checker, kind, name, pageCount) {
  return {name: checker.text(name || (kind === 'answer' ? 'Answer sheet' : 'Question paper'), 200, true),
    pageCount: projectedPageCount(pageCount, kind), pages: []};
}

function creditState(usage, now) {
  return usage?.day === day(now) ? usage : {day: day(now), drafts: 0, pages: 0};
}

async function renderRow(checker, row, staff, detail = false, progress = progressStub, reads) {
  return submissionSummary(row, staff, detail, await progress(checker, row, reads));
}

export async function submissionList(checker, uid, cursor, staff, progress, status = null) {
  const eligible = staff ? undefined : !!await currentEnrollment(checker, uid);
  if (!staff && !eligible) return {eligible: false, submissions: [], nextCursor: null};
  if (status && (!staff || !staffSubmissionStates.includes(status))) {
    fail(400, 'invalid_submission_status', 'Choose a valid submissions filter.');
  }
  const collection = status ? staffSubmissionStatePath(uid, status) : staff ? ownerSubmissions(uid) : studentSubmissions(uid);
  const pointers = await checker.store.list(collection, [], pageSize + 1, {
    orderBy: ['createdAt','desc'], orderById: true, cursorValues: checker.readCursor(cursor), includeId: true
  });
  const page = pointers.slice(0, pageSize);
  const rows = await checker.store.getSelected(page.map(row => submissionPath(row.id)), [
    'id','title','subject','ownerUid','studentUid','studentLabel','paperId','testCode','questionFingerprint','staffPaperId',
    'status','version','revision','rescan','answer','question','createdAt','updatedAt','submittedAt','referenceId',
    'sheetId','requiresPaperReview','paperTitle','releasedAt','publishedSheetVersion'
  ]);
  const visible = rows.filter(row => row && (staff ? row.ownerUid === uid && row.status !== 'draft' &&
    (!status || row.status === status) : row.studentUid === uid));
  const last = page.at(-1);
  const reads = new Map();
  return {
    ...(staff ? {enabled: await submissionsEnabled(checker)} : {eligible}),
    submissions: await Promise.all(visible.map(row => renderRow(checker, row, staff, false, progress, reads))),
    nextCursor: pointers.length > pageSize ? Buffer.from(JSON.stringify([last.createdAt,last.id])).toString('base64url') : null
  };
}

export async function submissionDetail(checker, uid, id, staff, progress) {
  if (!staff) await assertEnrollment(checker, uid);
  const row = await authorizedSubmission(checker, uid, id, staff);
  return {submission: await renderRow(checker, row, staff, true, progress)};
}

export async function createStudentSubmission(checker, uid, body) {
  const nonce = checker.id(body.id);
  // A caller controls its own retry key but cannot reserve IDs belonging to other pupils.
  const id = digest('student-submission', uid, nonce).slice(0, 40);
  const submission = await checker.store.transaction(async tx => {
    const membership = await assertEnrollment(checker, uid, tx);
    const test = body.testCode ? await getSubmissionTest(checker, membership, body.testCode, tx) : null;
    const title = test?.title || checker.text(body.title ?? '', 120) || 'Uploaded question paper';
    const subject = test?.subject || checker.text(body.subject ?? '', 100) || null;
    const answer = attachment(checker, 'answer', body.answerName, body.answerPageCount);
    if (test && body.questionPageCount > 0) fail(400, 'unexpected_question_paper', 'This test already includes the question paper.');
    const question = test ? null : attachment(checker, 'question', body.questionName, body.questionPageCount);
    const path = submissionPath(id), existing = await tx.get(path);
    if (existing) {
      if (existing.testCode !== (test?.code || null) || existing.title !== title ||
          existing.answer.pageCount !== answer.pageCount || (existing.question?.pageCount || 0) !== (question?.pageCount || 0)) changed();
      return existing;
    }
    const now = checker.now(), credits = submissionLimitPath(uid);
    const usage = creditState(await tx.get(credits), now);
    if (usage.drafts >= dailyDraftLimit) {
      fail(429, 'submission_limit', 'The daily submission limit was reached. You can continue any saved drafts.');
    }
    const row = {
      id, ...membership, title, subject, paperId: test?.paperId || null, testCode: test?.code || null,
      status: 'draft', version: 1, revision: 1, answer, question, rescan: null,
      createdAt: now, updatedAt: now
    };
    tx.create(path, row);
    tx.create(studentSubmissions(uid) + '/' + id, {createdAt: now});
    tx.set(credits, {...usage, drafts: usage.drafts + 1});
    return row;
  });
  return {submission: await renderRow(checker, submission, false, true)};
}

export async function uploadSubmissionPage(checker, uid, id, kind, index, body) {
  const {bytes, size, sha} = checker.scan(body);
  const submission = await checker.store.transaction(async tx => {
    await assertEnrollment(checker, uid, tx);
    const row = await authorizedSubmission(checker, uid, id, false, tx);
    const doc = row[kind];
    if (!doc || !Number.isInteger(index) || index < 1 || index > doc.pageCount) unavailable();
    const prior = doc.pages.find(page => page.index === index);
    if (row.status !== 'draft') changed();
    if (prior?.sha === sha) return row;
    if (row.version !== body.version || prior) changed();
    const now = checker.now(), credits = submissionLimitPath(uid);
    const usage = creditState(await tx.get(credits), now);
    if (usage.pages >= dailyPageLimit) {
      fail(429, 'submission_page_limit', 'The daily scan limit was reached. Your uploaded pages are saved.');
    }
    const page = {index, sha, ...size, sourceRevision: row.revision};
    const next = {...row, [kind]: {...doc, pages: [...doc.pages, page]}, version: row.version + 1, updatedAt: now};
    tx.create(submissionPagePath(id, row.revision, kind, index), {jpeg: bytes});
    tx.set(submissionPath(id), next);
    tx.set(credits, {...usage, pages: usage.pages + 1});
    return next;
  });
  return {submission: await renderRow(checker, submission, false, true)};
}

export async function readSubmissionPage(checker, uid, id, kind, index, staff) {
  if (!staff) await assertEnrollment(checker, uid);
  const row = await authorizedSubmission(checker, uid, id, staff);
  const page = row[kind]?.pages.find(page => page.index === index);
  if (!page) unavailable();
  const stored = await checker.store.get(submissionPagePath(id, page.sourceRevision, kind, index));
  if (!stored?.jpeg) unavailable();
  const bytes = Buffer.from(stored.jpeg);
  if (digest(bytes.toString('base64')) !== page.sha) {
    fail(409, 'scan_integrity', 'This scan page could not be verified. Ask the student to replace it.');
  }
  return bytes;
}

function orderedChecksums(doc, kind) {
  if (doc.pages.length !== doc.pageCount) fail(409, 'upload_incomplete', 'Finish uploading all ' + kind + ' pages first.');
  const ordered = doc.pages.toSorted((a, b) => a.index - b.index);
  const checksums = new Map();
  for (const {index, sha} of ordered) {
    if (checksums.has(sha)) {
      fail(409, 'duplicate_scan_page', 'Review the ' + kind + ' scan. Page ' + index + ' repeats page ' + checksums.get(sha) + '.');
    }
    checksums.set(sha, index);
  }
  return [...checksums.keys()];
}

export async function submitStudentSubmission(checker, uid, id, body) {
  const submission = await checker.store.transaction(async tx => {
    const member = await assertEnrollment(checker, uid, tx);
    const row = await authorizedSubmission(checker, uid, id, false, tx);
    if (row.status === 'submitted' && row.submittedVersion === body.version) return row;
    if (row.status !== 'draft' || row.version !== body.version) changed();
    if (row.ownerUid !== member.ownerUid) {
      fail(409, 'student_scope_conflict', 'Your GTOP account is linked to another submissions inbox. Ask GT staff for help.');
    }
    orderedChecksums(row.answer, 'answer');
    const questionFingerprint = row.question ? digest('ordered-question-pages-v1', ...orderedChecksums(row.question, 'question')) : null;
    const now = checker.now();
    const next = {...row, studentLabel: member.studentLabel, status: 'submitted', submittedVersion: row.version,
      submittedAt: now, updatedAt: now, version: row.version + 1, rescan: null, questionFingerprint};
    tx.set(submissionPath(id), next);
    moveStaffSubmissionIndex(tx, row, next.status, now);
    if (!row.submittedAt) tx.create(ownerSubmissions(row.ownerUid) + '/' + id, {createdAt: now});
    checker.service.notifyContent(tx, row.ownerUid);
    return next;
  });
  return {submission: await renderRow(checker, submission, false, true)};
}

function revisedAttachment(checker, row, kind, target, page, body) {
  const current = row[kind];
  if (!current) return null;
  const changedFile = target === kind;
  const pageCount = body[kind + 'PageCount'] ?? current.pageCount;
  const name = body[kind + 'Name'] ?? current.name;
  if (!changedFile) {
    if (pageCount !== current.pageCount || name !== current.name) {
      fail(400, 'unselected_scan', 'Choose which document to replace first.');
    }
    return current;
  }
  const next = attachment(checker, kind, name, pageCount);
  if (page != null) {
    if (!Number.isInteger(page) || page < 1 || page > current.pageCount || pageCount !== current.pageCount) {
      fail(400, 'invalid_page', 'Keep the same page count when replacing one page.');
    }
    next.pages = current.pages.filter(saved => saved.index !== page);
  }
  return next;
}

export async function reviseStudentSubmission(checker, uid, id, body) {
  const submission = await checker.store.transaction(async tx => {
    await assertEnrollment(checker, uid, tx);
    const row = await authorizedSubmission(checker, uid, id, false, tx);
    if (!['draft','needs_rescan'].includes(row.status)) changed();
    const kind = body.replaceKind ?? row.rescan?.kind;
    const page = Object.hasOwn(body, 'replacePage') ? body.replacePage : body.replaceKind ? null : row.rescan?.page ?? null;
    if (!Object.hasOwn(limits, kind) || !row[kind]) fail(400, 'invalid_replacement', 'Choose the document to replace.');
    const answer = revisedAttachment(checker, row, 'answer', kind, page, body);
    const question = revisedAttachment(checker, row, 'question', kind, page, body);
    const request = digest(kind, page, answer.name, answer.pageCount, question?.name ?? null, question?.pageCount ?? null);
    if (row.status === 'draft' && row.replaceSourceVersion === body.version && row.replaceRequest === request) return row;
    if (row.version !== body.version) changed();
    const next = {...row, answer, question, revision: row.revision + 1, status: 'draft', version: row.version + 1,
      replaceSourceVersion: body.version, replaceRequest: request, updatedAt: checker.now(),
      ...(kind === 'question' ? {questionFingerprint: null, referenceId: null, requiresPaperReview: false} : {})};
    tx.set(submissionPath(id), next);
    moveStaffSubmissionIndex(tx, row, next.status, next.updatedAt);
    if (row.submittedAt) checker.service.notifyContent(tx, row.ownerUid);
    return next;
  });
  return {submission: await renderRow(checker, submission, false, true)};
}

export async function requestSubmissionRescan(checker, uid, id, body, progress) {
  const submission = await checker.store.transaction(async tx => {
    const row = await authorizedSubmission(checker, uid, id, true, tx);
    if (row.status !== 'submitted' || row.version !== body.version) changed();
    const kind = body.kind;
    if (!Object.hasOwn(limits, kind) || !row[kind]) fail(400, 'invalid_replacement', 'Choose the document to replace.');
    const page = body.page ?? null;
    if (page != null && (!Number.isInteger(page) || page < 1 || page > row[kind].pageCount)) {
      fail(400, 'invalid_page', 'Choose a page from the selected document.');
    }
    const reason = checker.text(body.reason ?? '', 600, true);
    const next = {...row, status: 'needs_rescan', rescan: {kind, page, reason}, version: row.version + 1,
      updatedAt: checker.now()};
    tx.set(submissionPath(id), next);
    moveStaffSubmissionIndex(tx, row, next.status, next.updatedAt);
    checker.service.notifyContent(tx, uid);
    return next;
  });
  return {submission: await renderRow(checker, submission, true, true, progress)};
}
