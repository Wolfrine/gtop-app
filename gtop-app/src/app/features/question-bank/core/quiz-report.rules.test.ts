import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Only replace Angular injection with the emulator client; execute the actual service.
vi.mock('@angular/core', () => ({ Injectable: () => (value: unknown) => value }));
vi.mock('@angular/fire/firestore', async () => ({ ...(await import('firebase/firestore')), Firestore: class {} }));
import { QuizService } from '../../../services/quiz.service';

describe('current quiz reporting service with real rules', () => {
  let environment: RulesTestEnvironment;
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'demo-gtop-report',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    });
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/student'), { role: 'user' });
      await setDoc(doc(context.firestore(), 'questions/reportable'), { question: 'Check this', flagCount: 0 });
    });
  });
  afterAll(async () => environment?.cleanup());

  it('saves the actual report and count atomically, counts once under retries, and rejects impersonation', async () => {
    const db = environment.authenticatedContext('student').firestore();
    const service = new QuizService(db as any, {} as any);
    const question = { id: 'reportable', board: 'CBSE', standard: '9', subject: 'Science', chapter: 'Motion' };
    const attempts = await Promise.allSettled([
      service.flagQuestion(question, 'student'),
      service.flagQuestion(question, 'student'),
    ]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failure = attempts.find(result => result.status === 'rejected') as PromiseRejectedResult;
    // The emulator can reject the losing commit before the SDK retries its read.
    expect(['already-flagged', 'permission-denied']).toContain(failure.reason.code);
    expect((await getDoc(doc(db, 'questions/reportable'))).data()?.['flagCount']).toBe(1);
    expect((await getDoc(doc(db, 'questionFlags/reportable_student'))).data()?.['questionId']).toBe('reportable');
    await expect(service.flagQuestion(question, 'student')).rejects.toMatchObject({ code: 'already-flagged' });
    await expect(service.flagQuestion(question, 'other-student')).rejects.toBeDefined();
  });
});
