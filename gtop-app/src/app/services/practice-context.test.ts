import { describe, expect, it } from 'vitest';
import { normalizePracticeBoard, questionsMatchPractice, resolvePracticeContext } from './practice-context';

const student = { uid: 'student', role: 'user', board: 'CBSE', standard: '10' };
describe('solo learner curriculum boundary', () => {
  it('uses the student profile for bare Quick Quiz and ignores alternate curriculum URL parameters', () => {
    expect(resolvePracticeContext(student, {}).curriculum).toEqual({ board: 'CBSE', standard: '10' });
    const custom = resolvePracticeContext(student, { board: 'ICSE', standard: '8', subjects: 'Science', count: '5' });
    expect(custom.curriculum).toEqual({ board: 'CBSE', standard: '10' });
    expect(custom.subjects).toEqual(['Science']);
    expect(custom.quizType).toBe('custom');
    expect(questionsMatchPractice([{ board: 'ICSE', standard: '8' }], custom)).toBe(false);
  });
  it('retains admin custom choice and global quick selection without requiring a learner profile', () => {
    const admin = { uid: 'admin', role: 'admin' };
    expect(resolvePracticeContext(admin, {}).curriculum).toBeUndefined();
    expect(resolvePracticeContext(admin, { board: 'ICSE', standard: 8, subjects: ['Science'] }).curriculum)
      .toEqual({ board: 'ICSE', standard: '8' });
    expect(() => resolvePracticeContext(admin, { board: 'ICSE' })).toThrow('both a board and class');
  });
  it('never falls back to global questions for a missing student profile', () => {
    expect(() => resolvePracticeContext({ uid: 'student', role: 'user' }, { board: 'ICSE', standard: '8' })).toThrow('profile-required');
    expect(() => resolvePracticeContext(null, {})).toThrow('Sign in');
  });
  it('matches only the verified Cambridge alias and keeps Hub return contracts in session identity', () => {
    expect(normalizePracticeBoard('Cambridge IGCSE')).toBe('IGCSE');
    const aliasStudent = { ...student, board: 'Cambridge IGCSE', standard: '8' };
    const context = resolvePracticeContext(aliasStudent, {});
    expect(questionsMatchPractice([{ board: 'IGCSE', standard: '8' }], context)).toBe(true);
    expect(resolvePracticeContext(student, { returnTo: 'https://hub.example', hubReturnPath: '/practice' }).routeKey).not.toBe(resolvePracticeContext(student, {}).routeKey);
  });
});
