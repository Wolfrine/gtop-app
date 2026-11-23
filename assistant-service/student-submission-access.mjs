import {randomBytes} from 'node:crypto';
import {HttpError} from './service.mjs';
import {
  inviteId, ownerInvites, submissionAccessPath, submissionInvitePath, submissionSettingsPath,
  submissionTestOwnerPath, submissionTestPath
} from './student-submission-storage.mjs';

const inviteLifeMs = 7 * 86400000;
const fail = (status, code, message) => { throw new HttpError(status, code, message); };
const inviteUnavailable = () => fail(404, 'invite_unavailable', 'This invitation is no longer available. Ask GT staff for a new link.');
const testUnavailable = () => fail(404, 'test_unavailable', 'This test link is unavailable for your GTOP account.');
const enabled = settings => settings?.enabled !== false;
const validCode = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const studentLabel = profile => [profile?.displayName, profile?.name]
  .find(value => typeof value === 'string' && value.trim())?.trim().slice(0, 100);

export function authenticatedStudent(checker, claims) {
  if (!claims?.uid || claims.assistantWorker || claims.firebase?.sign_in_provider === 'anonymous') {
    fail(401, 'student_sign_in_required', 'Sign in to GTOP to submit an answer sheet.');
  }
  return checker.id(claims.uid);
}

async function activeOwner(reader, ownerUid) {
  const [pilot, profile] = await reader.getSelected(
    ['assistantConfig/pilot', 'users/' + ownerUid], ['allowedOwnerUids', 'role']
  );
  return pilot?.allowedOwnerUids?.includes(ownerUid) && profile?.role === 'admin';
}

export async function currentEnrollment(checker, uid, reader = checker.store) {
  const [membership, profile, settings] = await reader.getSelected(
    [submissionAccessPath(uid), 'users/' + uid, submissionSettingsPath],
    ['enabled', 'ownerUid', 'role', 'displayName', 'name']
  );
  const label = studentLabel(profile);
  if (!enabled(settings) || profile?.role !== 'user' || !label || membership?.enabled !== true ||
      typeof membership.ownerUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(membership.ownerUid)) return null;
  return await activeOwner(reader, membership.ownerUid) ? {studentUid: uid, studentLabel: label, ownerUid: membership.ownerUid} : null;
}

export async function assertEnrollment(checker, uid, reader = checker.store) {
  const membership = await currentEnrollment(checker, uid, reader);
  if (!membership) fail(403, 'student_invite_required', 'Ask Growth Tutorials for a student submission link.');
  return membership;
}

export async function submissionsEnabled(checker, reader = checker.store) {
  return enabled(await reader.get(submissionSettingsPath));
}

export async function assertSubmissionsEnabled(checker, reader = checker.store) {
  if (!await submissionsEnabled(checker, reader)) {
    fail(503, 'student_submissions_paused', 'Student submissions are paused.');
  }
}

function testView(test) {
  return {code: test.code, paperId: test.paperId, title: test.title, subject: test.subject};
}

export async function getSubmissionTest(checker, membership, code, reader = checker.store) {
  if (!validCode(code)) testUnavailable();
  const test = await reader.get(submissionTestPath(code));
  if (!test || test.ownerUid !== membership.ownerUid) testUnavailable();
  return testView(test);
}

export async function shareSubmissionTest(checker, ownerUid, paperId) {
  checker.id(paperId);
  if (paperId.startsWith('ext-')) testUnavailable();
  return checker.store.transaction(async tx => {
    await assertSubmissionsEnabled(checker, tx);
    const ownerPath = submissionTestOwnerPath(ownerUid, paperId);
    const prior = await tx.get(ownerPath);
    const {title} = await checker.rubric(paperId, ownerUid, tx);
    const [paper] = await tx.getSelected(['assistantPapers/' + paperId], ['subject', 'paper.subject']);
    if (prior) return testView(prior);
    const code = randomBytes(16).toString('hex');
    const test = {code, ownerUid, paperId, title, subject: paper?.subject || paper?.paper?.subject || null,
      createdAt: checker.now()};
    tx.create(submissionTestPath(code), test);
    tx.create(ownerPath, test);
    return testView(test);
  });
}

function inviteView(invite) {
  const {id, createdAt, expiresAt, uses, used, revokedAt} = invite;
  return {id, createdAt, expiresAt, uses, used, ...(revokedAt ? {revokedAt} : {})};
}

export async function listSubmissionInvites(checker, ownerUid) {
  const rows = await checker.store.list(ownerInvites(ownerUid), [], 25, {orderBy: ['createdAt', 'desc']});
  return {invites: rows.map(inviteView)};
}

export async function createSubmissionInvite(checker, ownerUid, body) {
  const uses = body.uses ?? 1;
  if (!Number.isInteger(uses) || uses < 1 || uses > 30) {
    fail(400, 'invalid_invite_cap', 'Allow between 1 and 30 students to use an invitation.');
  }
  const test = body.paperId == null ? null : await shareSubmissionTest(checker, ownerUid, body.paperId);
  const code = randomBytes(16).toString('hex'), id = inviteId(code), createdAt = checker.now();
  const expiresAt = new Date(Date.parse(createdAt) + inviteLifeMs).toISOString();
  const record = {id, ownerUid, uses, used: 0, createdAt, expiresAt,
    ...(test ? {testCode: test.code} : {})};
  await checker.store.transaction(async tx => {
    await assertSubmissionsEnabled(checker, tx);
    tx.create(submissionInvitePath(id), record);
    tx.create(ownerInvites(ownerUid) + '/' + id, record);
  });
  return {...inviteView(record), code, ...(test ? {testCode: test.code} : {})};
}

export async function revokeSubmissionInvite(checker, ownerUid, id) {
  if (!/^[a-f0-9]{64}$/.test(id)) inviteUnavailable();
  await checker.store.transaction(async tx => {
    const path = submissionInvitePath(id), invite = await tx.get(path);
    if (!invite || invite.ownerUid !== ownerUid) inviteUnavailable();
    if (invite.revokedAt) return;
    const revokedAt = checker.now();
    tx.update(path, {revokedAt});
    tx.update(ownerInvites(ownerUid) + '/' + id, {revokedAt});
  });
  return {ok: true};
}

export async function redeemSubmissionInvite(checker, uid, code) {
  if (!validCode(code)) inviteUnavailable();
  return checker.store.transaction(async tx => {
    const id = inviteId(code), path = submissionInvitePath(id);
    const [invite, settings, profile, membership] = await tx.getSelected(
      [path, submissionSettingsPath, 'users/' + uid, submissionAccessPath(uid)],
      ['enabled','ownerUid','uses','used','revokedAt','expiresAt','testCode','role','displayName','name']
    );
    if (!enabled(settings) || profile?.role !== 'user' || !studentLabel(profile) || !invite ||
        invite.revokedAt || invite.expiresAt <= checker.now() || !await activeOwner(tx, invite.ownerUid)) {
      inviteUnavailable();
    }
    if (membership?.ownerUid && membership.ownerUid !== invite.ownerUid) {
      fail(409, 'student_scope_conflict', 'Your GTOP account is already linked to a different submissions inbox. Ask GT staff for help.');
    }
    const outcome = {eligible: true, ...(invite.testCode ? {testCode: invite.testCode} : {})};
    if (membership?.enabled === true) return outcome;
    if (membership?.enabled === false) {
      fail(403, 'student_access_disabled', 'Your student submissions access is paused. Ask GT staff for help.');
    }
    if (invite.used >= invite.uses) inviteUnavailable();
    tx.create(submissionAccessPath(uid), {enabled: true, ownerUid: invite.ownerUid, createdAt: checker.now(), inviteId: id});
    const update = {used: invite.used + 1};
    tx.update(path, update);
    tx.update(ownerInvites(invite.ownerUid) + '/' + id, update);
    return outcome;
  });
}
