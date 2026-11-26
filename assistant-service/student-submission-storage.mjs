import {createHash, randomUUID} from 'node:crypto';

export const centralIntakeSource = 'growth_tutorials';
export const centralIntakeLabel = 'Growth Tutorials';

export const submissionCollection = 'assistantStudentSubmissions';
const owners = 'assistantStudentSubmissionOwners';
export const submissionPath = id => submissionCollection + '/' + id;
export const submissionPagePath = (id, revision, kind, index) =>
  submissionPath(id) + '/revisions/' + revision + '/' + kind + '/' + index;
export const ownerSubmissions = uid => owners + '/' + uid + '/submissions';
export const staffSubmissionStates = Object.freeze(['submitted', 'needs_rescan', 'checking', 'released']);
export const staffSubmissionStatePath = (uid, status) => owners + '/' + uid + '/states/' + status + '/submissions';
export function notifySubmissionInbox(tx, at) {
  tx.set('assistantInboxNotifications/submissions', {schemaVersion: 1, revision: randomUUID(), updatedAt: at});
}
export const hasSubmissionOwner = row => typeof row?.ownerUid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(row.ownerUid);
export function moveStaffSubmissionIndex(tx, row, nextStatus, at) {
  if (row.status === nextStatus) return;
  if (staffSubmissionStates.includes(row.status) || staffSubmissionStates.includes(nextStatus)) notifySubmissionInbox(tx, at);
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

export function submissionSummary(row, staff, detail, progress, actorUid) {
  const attachment = file => file && ({
    name: file.name,
    pageCount: file.pageCount,
    saved: file.pages.length,
    ...(detail ? {pages: file.pages.map(({index, sha, width, height}) => ({index, sha, width, height}))} : {})
  });
  const {id, title, subject, testCode, paperId, status, version, revision, rescan, createdAt, updatedAt, submittedAt} = row;
  const {paperTitle, paperReady, ...internalProgress} = progress;
  const linkedPaperId = internalProgress.paperId || paperId;
  return {
    id, title, subject: subject || null, status, version, revision,
    answer: attachment(row.answer), question: attachment(row.question) || null,
    ...(row.teacherUpload?{teacherUpload:true}:{}),
    rescan: rescan || null, createdAt, updatedAt, submittedAt: submittedAt || null,
    paperTitle: paperTitle || null,
    ...(testCode && (!staff || row.ownerUid === actorUid) ? {testCode} : {}),
    ...(row.intake?.source === centralIntakeSource ? {checkingRecipient: centralIntakeLabel} : {}),
    ...(staff ? {
      studentUid: row.studentUid, studentLabel: row.studentLabel, intake: row.intake || null,
      paperId: paperId || null, questionFingerprint: row.questionFingerprint || null,
      paperReady, ...internalProgress,
      ownerWorkspace: row.ownerUid === actorUid,
      ...(linkedPaperId?.startsWith('ext-') ? {
        paperScope:createHash('sha256').update(row.ownerUid+'/'+linkedPaperId).digest('hex')
      } : {})
    } : {}),
    ...(internalProgress.sheetState ? {
      sheetState: ['review','final','failed','unavailable'].includes(internalProgress.sheetState) && !staff
        ? 'review' : internalProgress.sheetState
    } : {})
  };
}
