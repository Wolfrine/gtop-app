import { beforeEach, describe, expect, it } from 'vitest';
import { clearPracticeSession, createPracticeAttemptId, PracticeSession, readPracticeSession, writePracticeSession } from './practice-session';

const session: PracticeSession = { version: 1, uid: 'student', role: 'user', routeKey: 'CBSE10', attemptId: 'attempt-1', quizType: 'quick',
  questions: [{ id: 'q1', board: 'CBSE', standard: '10', options: ['B', 'A'], optionOrder: [1, 0], correctIndex: 1, selectedIndex: 0 }],
  currentQuestionIndex: 0, completed: false, saved: false };
describe('tab-local practice restoration', () => {
  beforeEach(() => sessionStorage.clear());
  it('preserves answer, presentation order, cursor and attempt identity across route instances', () => {
    writePracticeSession(session);
    expect(readPracticeSession('student')).toEqual(session);
    expect(readPracticeSession('another-student')).toBeNull();
    expect(readPracticeSession('')).toBeNull();
  });
  it('retains a completed failed-save attempt until an acknowledged save', () => {
    writePracticeSession({ ...session, completed: true });
    expect(readPracticeSession('student')?.saved).toBe(false);
    writePracticeSession({ ...readPracticeSession('student')!, saved: true });
    expect(readPracticeSession('student')?.attemptId).toBe('attempt-1');
    expect(readPracticeSession('student')?.saved).toBe(true);
    clearPracticeSession();
    expect(readPracticeSession('student')).toBeNull();
  });
  it('tolerates unavailable or corrupt storage and rejects invalid cursors', () => {
    const unavailable = { getItem() { throw Error('disabled'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('disabled'); } } as unknown as Storage;
    expect(() => writePracticeSession(session, unavailable)).not.toThrow();
    expect(readPracticeSession('student', unavailable)).toBeNull();
    expect(() => clearPracticeSession(unavailable)).not.toThrow();
    writePracticeSession({ ...session, currentQuestionIndex: 99 });
    expect(readPracticeSession('student')).toBeNull();
    expect(createPracticeAttemptId()).not.toBe(createPracticeAttemptId());
  });
});
