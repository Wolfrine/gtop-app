import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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

  it('allows public appearance reads but only admins can publish', async () => {
    const publicClient = environment.unauthenticatedContext().firestore();
    const learner = environment.authenticatedContext('user-1').firestore();
    const admin = environment.authenticatedContext('admin-1').firestore();
    await assertSucceeds(getDoc(doc(publicClient, 'Meta/appearance')));
    await assertFails(setDoc(doc(learner, 'Meta/appearance'), { themeId: 'quiz-pulse' }));
    await assertSucceeds(
      setDoc(doc(admin, 'Meta/appearance'), { themeId: 'quiz-pulse', version: 2 }),
    );
  });

  it('allows a learner to increment only question flag metadata', async () => {
    const learner = environment.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(learner, 'questions/question-1'), {
        question: 'Sample',
        flagCount: 1,
        lastFlaggedAt: new Date(),
      }),
    );
    await assertFails(
      setDoc(doc(learner, 'questions/question-1'), {
        question: 'Changed',
        flagCount: 2,
        lastFlaggedAt: new Date(),
      }),
    );
  });
});
