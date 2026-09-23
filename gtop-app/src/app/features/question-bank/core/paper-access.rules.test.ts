import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, increment, query, runTransaction, setDoc, where, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

describe('question-paper browser access', () => {
  let environment: RulesTestEnvironment;
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'demo-paper-access',
      firestore: { rules: readFileSync(process.env['GTOP_RULES_FILE'] || 'firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    });
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/paper-admin'), { uid: 'paper-admin', role: 'admin' });
      await setDoc(doc(context.firestore(), 'users/paper-student'), { uid: 'paper-student', role: 'user' });
      await setDoc(doc(context.firestore(), 'paperTemplates/mock'), { name: 'Mock', structure: { totalMarks: 4 } });
      await setDoc(doc(context.firestore(), 'devQuestions/draft'), { question: 'Draft', reviewStatus: 'pending-admin-review' });
      await setDoc(doc(context.firestore(), 'syllabus/review-chapter'), { board: 'CBSE', standard: '10', subject: 'Science', chapter: 'Motion', mcqCount: 0 });
    });
  });
  afterAll(async () => environment?.cleanup());

  it('lets an admin load templates and the pending review queue', async () => {
    const db = environment.authenticatedContext('paper-admin').firestore();
    await assertSucceeds(getDocs(collection(db, 'paperTemplates')));
    await assertSucceeds(getDocs(query(collection(db, 'devQuestions'), where('reviewStatus', '==', 'pending-admin-review'))));
  });
  it('lets an admin save a paper and a creator priority', async () => {
    const db = environment.authenticatedContext('paper-admin').firestore();
    await assertSucceeds(setDoc(doc(db, 'paperDrafts/test'), { title: 'Review paper', status: 'draft', createdBy: 'paper-admin' }));
    await assertSucceeds(setDoc(doc(db, 'questionBankPriorityItems/test'), { board: 'CBSE', status: 'open', createdBy: 'paper-admin' }));
  });
  async function approveDraft(db: Firestore, targetId: string) {
    return runTransaction(db, async transaction => {
      const draft = doc(db, 'devQuestions/draft');
      const question = doc(db, 'questions', targetId);
      const syllabus = doc(db, 'syllabus/review-chapter');
      await transaction.get(draft);
      await transaction.get(question);
      await transaction.get(syllabus);
      transaction.set(question, { question: 'Reviewed question', options: ['Correct', 'Incorrect'], correctIndex: 0, status: 'approved' });
      transaction.update(syllabus, { mcqCount: increment(1) });
      transaction.update(draft, { reviewStatus: 'approved', sourceDraftId: 'draft' });
    });
  }
  it('allows the full admin publication transaction', async () => {
    await assertSucceeds(approveDraft(environment.authenticatedContext('paper-admin').firestore(), 'reviewed-question'));
  });
  it('rejects publication transactions from students and visitors', async () => {
    await assertFails(approveDraft(environment.authenticatedContext('paper-student').firestore(), 'forbidden-student-question'));
    await assertFails(approveDraft(environment.unauthenticatedContext().firestore(), 'forbidden-visitor-question'));
  });
  it('keeps drafts, answer keys and creator queues private from students and visitors', async () => {
    for (const db of [environment.authenticatedContext('paper-student').firestore(), environment.unauthenticatedContext().firestore()]) {
      for (const path of ['paperTemplates/mock', 'paperDrafts/test', 'devQuestions/draft', 'questionBankPriorityItems/test']) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), { status: 'approved' }));
      }
    }
  });
});
