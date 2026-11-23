import {createHash} from 'node:crypto';

export const centralIntakeSource = 'growth_tutorials';
export const centralIntakeLabel = 'Growth Tutorials';

const root = 'assistantStudentSubmissions';
const owners = 'assistantStudentSubmissionOwners';
export const submissionPath = id => root + '/' + id;
export const submissionPagePath = (id, revision, kind, index) =>
  submissionPath(id) + '/revisions/' + revision + '/' + kind + '/' + index;
export const ownerSubmissions = uid => owners + '/' + uid + '/submissions';
export const staffSubmissionStates = Object.freeze(['submitted', 'needs_rescan', 'checking', 'released']);
export const staffSubmissionStatePath = (uid, status) => owners + '/' + uid + '/states/' + status + '/submissions';
export function moveStaffSubmissionIndex(tx, row, nextStatus, at) {
  if (row.status === nextStatus) return;
  if (staffSubmissionStates.includes(row.status)) tx.delete(staffSubmissionStatePath(row.ownerUid, row.status) + '/' + row.id);
  if (staffSubmissionStates.includes(nextStatus)) tx.set(staffSubmissionStatePath(row.ownerUid, nextStatus) + '/' + row.id, {createdAt: at});
}
export const studentSubmissions = uid => 'assistantStudentSubmissionStudents/' + uid + '/submissions';
export const confirmedPaperPath = (ownerUid, fingerprint) => owners + '/' + ownerUid + '/papers/' + fingerprint;
export const submissionAccessPath = uid => 'assistantStudentSubmissionAccess/' + uid;
export const submissionSettingsPath = 'assistantConfig/studentSubmissions';
export const submissionLimitPath = uid => 'assistantStudentSubmissionLimits/' + uid;
export const submissionIntakeLimitPath = uid => owners + '/' + uid + '/intakeLimits/daily';
export const submissionTestPath = code => 'assistantStudentSubmissionTests/' + code;
export const submissionTestOwnerPath = (uid, paperId) => owners + '/' + uid + '/tests/' + paperId;
export const submissionInvitePath = id => 'assistantStudentSubmissionInvites/' + id;
export const ownerInvites = uid => owners + '/' + uid + '/invites';
export const inviteId = code => createHash('sha256').update(code).digest('hex');

export function submissionSummary(row, staff, detail, progress) {
  const attachment = file => file && ({
    name: file.name,
    pageCount: file.pageCount,
    saved: file.pages.length,
    ...(detail ? {pages: file.pages.map(({index, sha, width, height}) => ({index, sha, width, height}))} : {})
  });
  const {id, title, subject, testCode, paperId, status, version, revision, rescan, createdAt, updatedAt, submittedAt} = row;
  const {paperTitle, paperReady, ...internalProgress} = progress;
  return {
    id, title, subject: subject || null, status, version, revision,
    answer: attachment(row.answer), question: attachment(row.question) || null,
    rescan: rescan || null, createdAt, updatedAt, submittedAt: submittedAt || null,
    paperTitle: paperTitle || null,
    ...(testCode ? {testCode} : {}),
    ...(row.intake?.source === centralIntakeSource ? {checkingRecipient: centralIntakeLabel} : {}),
    ...(staff ? {
      studentUid: row.studentUid, studentLabel: row.studentLabel, intake: row.intake || null,
      paperId: paperId || null, questionFingerprint: row.questionFingerprint || null,
      paperReady, ...internalProgress
    } : {}),
    ...(internalProgress.sheetState ? {
      sheetState: ['review','final','failed','unavailable'].includes(internalProgress.sheetState) && !staff
        ? 'review' : internalProgress.sheetState
    } : {})
  };
}
