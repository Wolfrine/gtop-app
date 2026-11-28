import {HttpError} from './service.mjs';
import {attachmentHeader} from './domain/artifact-filenames.mjs';
import {
  assertEnrollment, assertStaffSubmissionActor, authenticatedStudent, createSubmissionInvite, getSubmissionTest, listSubmissionInvites, personalSubmissionAccess,
  redeemSubmissionInvite, revokeSubmissionInvite, shareSubmissionTest
} from './student-submission-access.mjs';
import {
  createStudentSubmission, readSubmissionPage, releasedSubmissionScores, requestSubmissionRescan, reviseStudentSubmission,
  submissionDetail, submissionList, submitStudentSubmission, uploadSubmissionPage
} from './student-submissions.mjs';
import {
  approveSubmission, legacySubmissionSource, prepareSubmissionReference, releaseSubmission, stageSubmissionResult,
  staffResult, staffResultPdf, studentResult, studentResultPdf, submissionProgress
} from './submission-grading.mjs';

const studentRoot = '/student-submissions';
const staffRoot = '/staff/student-submissions';
const itemRoute = /^\/([a-z0-9_-]+)(?:\/(.*))?$/i;
const scanRoute = /^pages\/(answer|question)\/(\d+)$/;
const legacyPageRoute = /^legacy-source\/pages\/(\d+)$/;
const chunkRoute = /^result-chunks\/(\d+)$/;

export const hasStudentSubmissionRoute = path => [studentRoot, staffRoot]
  .some(root => path === root || path.startsWith(root + '/'));

const missing = () => { throw new HttpError(404, 'not_found', 'Endpoint unavailable.'); };

export async function studentSubmissionRoute(service, claims, method, path, query, body, headers) {
  const checker = service.checking;
  const staff = path.startsWith(staffRoot);
  const relative = path.slice((staff ? staffRoot : studentRoot).length);
  const uid = authenticatedStudent(checker, claims);
  if (staff) await assertStaffSubmissionActor(checker, uid);
  if (relative === '' && method === 'GET') {
    if (staff && query.get('status') === 'released' && query.get('access') === '1') return {allowed:true};
    if (!staff && query.get('view') === 'released-scores') {
      return releasedSubmissionScores(checker, uid, query.get('cursor'));
    }
    if (!staff && query.get('eligibility') === '1') {
      const access = await personalSubmissionAccess(checker, uid);
      return {eligible: access.sharedTestsAvailable};
    }
    const preview = !staff && query.get('preview') === '1';
    return submissionList(checker, uid, query.get('cursor'), staff, submissionProgress, staff ? query.get('status') : null, preview);
  }
  if (relative === '' && method === 'POST' && !staff) return createStudentSubmission(checker, uid, body);
  if (staff && relative === '/tests' && method === 'POST') return shareSubmissionTest(checker, uid, body.paperId);
  if (staff && relative === '/invites') {
    if (method === 'GET') return listSubmissionInvites(checker, uid);
    return createSubmissionInvite(checker, uid, body);
  }
  if (staff && relative.startsWith('/invites/') && method === 'POST') {
    const invite = relative.match(/^\/invites\/([a-f0-9]{64})\/revoke$/);
    if (invite) return revokeSubmissionInvite(checker, uid, invite[1]);
  }
  if (staff && relative === '/approve-batch' && method === 'POST') return approveBatch(checker, uid, body);
  if (!staff && relative === '/enroll' && method === 'POST') return redeemSubmissionInvite(checker, uid, body.code);
  if (!staff && relative.startsWith('/test/') && method === 'GET') {
    const member = await assertEnrollment(checker, uid);
    return getSubmissionTest(checker, member, relative.slice('/test/'.length));
  }

  const route = relative.match(itemRoute);
  if (!route) missing();
  const [, id, action] = route;
  if (!action && method === 'GET') return submissionDetail(checker, uid, id, staff, submissionProgress);
  const scan = action?.match(scanRoute);
  if (scan) {
    const [, kind, index] = scan;
    if (method === 'GET') {
      const {bytes,filename} = await readSubmissionPage(checker, uid, id, kind, Number(index), staff);
      headers['Content-Type'] = 'image/jpeg';
      headers['Content-Disposition'] = attachmentHeader(filename);
      return bytes;
    }
    if (!staff && method === 'POST') return uploadSubmissionPage(checker, uid, id, kind, Number(index), body);
  }
  if (staff && method === 'POST') {
    if (action === 'rescan') return requestSubmissionRescan(checker, uid, id, body, submissionProgress);
    if (action === 'prepare-reference') return prepareSubmissionReference(checker, uid, id, body);
    if (action === 'approve') return approveSubmission(checker, uid, id, body);
    if (action === 'release') return releaseSubmission(checker, uid, id, body);
    const chunk = action?.match(chunkRoute);
    if (chunk) return stageSubmissionResult(checker, uid, id, Number(chunk[1]), body);
  }
  if (!staff && method === 'POST') {
    if (action === 'submit') return submitStudentSubmission(checker, uid, id, body);
    if (action === 'revise') return reviseStudentSubmission(checker, uid, id, body);
  }
  if (staff && method === 'GET') {
    if (action === 'legacy-source') return legacySubmissionSource(checker, uid, id);
    const legacyPage = action?.match(legacyPageRoute);
    if (legacyPage) {
      const image = await legacySubmissionSource(checker, uid, id, Number(legacyPage[1]));
      headers['Content-Type'] = 'image/jpeg';
      return image;
    }
  }
  if (staff && method === 'GET' && action === 'report') {
    const {bytes,filename}=await staffResultPdf(checker,uid,id,query.get('revision'));
    headers['Content-Type']='application/pdf';
    headers['Content-Disposition']=attachmentHeader(filename);
    return bytes;
  }
  if (staff && method === 'GET' && action === 'result') {
    return staffResult(checker,uid,id);
  }
  if (!staff && method === 'GET') {
    if (action === 'result') {
      return studentResult(checker, uid, id);
    }
    if (action === 'result/pdf') {
      const {bytes,filename} = await studentResultPdf(checker, uid, id,query.get('revision'));
      headers['Content-Type'] = 'application/pdf';
      headers['Content-Disposition'] = attachmentHeader(filename);
      return bytes;
    }
  }
  missing();
}

async function approveBatch(checker, uid, {submissions, paperId, approvalScope}) {
  checker.id(paperId);
  if (typeof approvalScope !== 'string' || !/^(?:v2\.)?[a-f0-9]{64}$/.test(approvalScope)) {
    throw new HttpError(400, 'invalid_approval_scope', 'Reload the submissions before approving this group.');
  }
  if (!Array.isArray(submissions) || !submissions.length || submissions.length > 30 ||
      submissions.some(row => !row || typeof row.id !== 'string' || !Number.isSafeInteger(row.version)) ||
      new Set(submissions.map(row => row.id)).size !== submissions.length) {
    throw new HttpError(400, 'invalid_selection', 'Select up to 30 distinct submissions for the same paper.');
  }
  const results = [];
  for (const {id, version} of submissions) {
    try {
      const approved = await approveSubmission(checker, uid, id, {version, paperId, confirmReference: true}, {batch:true, approvalScope});
      results.push({id, ok: true, ...approved});
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      results.push({id, ok: false, code: error.code, message: error.message});
    }
  }
  return {results};
}
