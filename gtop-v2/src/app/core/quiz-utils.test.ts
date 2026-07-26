import { describe, expect, it } from 'vitest';
import { rankLiveAnswers, retryQuestionIds, weightedAccuracy } from './quiz-utils';

describe('quiz parity calculations', () => {
  it('builds an incorrect-only retry without changing order', () => {
    const result = {
      questions: [
        { questionId: 'a', selectedIndex: 0, correctIndex: 0, isCorrect: true },
        { questionId: 'b', selectedIndex: 1, correctIndex: 2, isCorrect: false },
      ],
    };
    expect(retryQuestionIds(result, false)).toEqual(['a', 'b']);
    expect(retryQuestionIds(result, true)).toEqual(['b']);
  });
  it('uses question-weighted accuracy', () => {
    expect(
      weightedAccuracy([
        { correctAnswers: 1, totalQuestions: 2 },
        { correctAnswers: 9, totalQuestions: 10 },
      ]),
    ).toBe(83);
  });
  it('ranks by points then response time deterministically', () => {
    const ranked = rankLiveAnswers([
      {
        correctIndex: 1,
        answers: [
          { uid: 'slow', displayName: 'Slow', selectedIndex: 1, responseMs: 8000 },
          { uid: 'fast', displayName: 'Fast', selectedIndex: 1, responseMs: 2000 },
        ],
      },
    ]);
    expect(ranked.map((v) => v.uid)).toEqual(['fast', 'slow']);
    expect(ranked[0].correct).toBe(1);
  });
});
