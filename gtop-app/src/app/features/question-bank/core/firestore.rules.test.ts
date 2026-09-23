import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('GTOP Firestore rules', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'demo-gtop',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/admin-1'), { uid: 'admin-1', role: 'admin' });
      await setDoc(doc(context.firestore(), 'users/user-1'), { uid: 'user-1', role: 'user' });
      await setDoc(doc(context.firestore(), 'users/user-2'), { uid: 'user-2', role: 'user' });
      await setDoc(doc(context.firestore(), 'actionPlans/work-1'), {
        title: 'V2',
        status: 'planned',
      });
      await setDoc(doc(context.firestore(), 'questions/question-1'), {
        question: 'Sample',
        flagCount: 0,
      });
    });
  });

  afterAll(async () => environment.cleanup());

  it('keeps the action plan admin-only and update history immutable', async () => {
    const learner = environment.authenticatedContext('user-1').firestore();
    const admin = environment.authenticatedContext('admin-1').firestore();
    await assertFails(getDoc(doc(learner, 'actionPlans/work-1')));
    await assertSucceeds(getDoc(doc(admin, 'actionPlans/work-1')));
    const update = doc(collection(admin, 'actionPlans/work-1/updates'));
    await assertSucceeds(setDoc(update, { message: 'Started', actor: { name: 'Admin' } }));
    await assertFails(setDoc(update, { message: 'Rewritten' }));
  });

  it('allows learners to create only their own immutable result', async () => {
    const learner = environment.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      addDoc(collection(learner, 'QuizResults'), { userId: 'user-1', totalQuestions: 1 }),
    );
    await assertFails(
      addDoc(collection(learner, 'QuizResults'), { userId: 'user-2', totalQuestions: 1 }),
    );
  });

  it('does not permit browser clients to forge MCP audit records', async () => {
    const admin = environment.authenticatedContext('admin-1').firestore();
    await assertFails(addDoc(collection(admin, 'mcpAuditLog'), { tool: 'fake' }));
  });

  it('keeps appearance publisher details signed-in and only admins can publish', async () => {
    const publicClient = environment.unauthenticatedContext().firestore();
    const learner = environment.authenticatedContext('user-1').firestore();
    const admin = environment.authenticatedContext('admin-1').firestore();
    await assertFails(getDoc(doc(publicClient, 'Meta/appearance')));
    await assertSucceeds(getDoc(doc(learner, 'Meta/appearance')));
    await assertFails(setDoc(doc(learner, 'Meta/appearance'), { themeId: 'quiz-pulse' }));
    await assertSucceeds(
      setDoc(doc(admin, 'Meta/appearance'), { themeId: 'quiz-pulse', version: 2 }),
    );
  });

  it('allows a learner flag transaction and repeat edit without another count increment', async () => {
    const learner = environment.authenticatedContext('user-1').firestore();
    const flagRef = doc(learner, 'questionFlags/question-1_user-1');
    const questionRef = doc(learner, 'questions/question-1');
    const flag = (reason: string) => runTransaction(learner, async transaction => {
      const [existing, question] = await Promise.all([transaction.get(flagRef), transaction.get(questionRef)]);
      transaction.set(flagRef, {
        questionId: 'question-1', userId: 'user-1', reason, status: 'open',
        createdAt: existing.exists() ? existing.data()['createdAt'] : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (!existing.exists()) transaction.update(questionRef, {
        flagCount: Number(question.data()?.['flagCount'] ?? 0) + 1, lastFlaggedAt: serverTimestamp(),
      });
    });
    await assertSucceeds(flag('Please check this answer'));
    await assertSucceeds(flag('Clarified reason'));
    expect((await getDoc(questionRef)).data()?.['flagCount']).toBe(1);
    await assertFails(updateDoc(questionRef, { flagCount: 2, lastFlaggedAt: serverTimestamp() }));
    await assertFails(updateDoc(questionRef, { question: 'Changed' }));
    await assertFails(updateDoc(flagRef, { userId: 'user-2' }));
    await assertFails(updateDoc(flagRef, { questionId: 'question-2' }));
    await assertFails(getDoc(doc(environment.authenticatedContext('user-2').firestore(), flagRef.path)));
  });

  it('blocks self promotion, including through a missing legacy role', async () => {
    const learner = environment.authenticatedContext('user-1').firestore();
    await assertFails(updateDoc(doc(learner, 'users/user-1'), { role: 'admin' }));
    await assertSucceeds(updateDoc(doc(learner, 'users/user-1'), { role: deleteField() }));
    await assertFails(updateDoc(doc(learner, 'users/user-1'), { role: 'admin' }));
    await assertSucceeds(updateDoc(doc(learner, 'users/user-1'), { role: 'user', displayName: 'Student' }));
    const fresh = environment.authenticatedContext('new-user').firestore();
    await assertFails(setDoc(doc(fresh, 'users/new-user'), { role: 'admin' }));
    await assertSucceeds(setDoc(doc(fresh, 'users/new-user'), { displayName: 'Legacy student' }));
    await assertFails(updateDoc(doc(fresh, 'users/new-user'), { role: 'admin' }));
  });

  it('preserves existing feedback and admin automation visibility', async () => {
    const learner = environment.authenticatedContext('user-1').firestore();
    const admin = environment.authenticatedContext('admin-1').firestore();
    await assertSucceeds(addDoc(collection(learner, 'appFeedback'), { message: 'Feedback' }));
    await assertSucceeds(getDoc(doc(admin, 'appFeedback/sample')));
    for (const path of ['automationRuns/run', 'automationTasks/task', 'automationTasks/task/events/event', 'automationRuns/run/events/event', 'automationTaskEvents/event', 'automationCoverage/chapter', 'featureSignals/signal', 'databankIssues/issue']) {
      await assertSucceeds(getDoc(doc(admin, path)));
      await assertFails(setDoc(doc(admin, path), { forged: true }));
      await assertFails(getDoc(doc(learner, path)));
    }
  });

  it('preserves existing session-host administration and admin result maintenance', async () => {
    const host = environment.authenticatedContext('user-1').firestore();
    const admin = environment.authenticatedContext('admin-1').firestore();
    await assertSucceeds(setDoc(doc(host, 'LiveSessions/session'), { hostId: 'user-1' }));
    await assertSucceeds(setDoc(doc(host, 'LiveSessions/session/participants/user-2'), { resultLinked: true }));
    await assertSucceeds(setDoc(doc(host, 'LiveSessions/session/answers/0/items/user-2'), { selectedIndex: 1 }));
    await assertSucceeds(deleteDoc(doc(host, 'LiveSessions/session/participants/user-2')));
    await assertSucceeds(deleteDoc(doc(host, 'LiveSessions/session')));
    await assertSucceeds(setDoc(doc(admin, 'QuizResults/maintained'), { userId: 'user-2' }));
    await assertSucceeds(updateDoc(doc(admin, 'QuizResults/maintained'), { reviewed: true }));
    await assertSucceeds(deleteDoc(doc(admin, 'QuizResults/maintained')));
  });
});
