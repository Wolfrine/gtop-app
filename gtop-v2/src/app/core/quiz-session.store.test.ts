import { beforeEach, describe, expect, it } from 'vitest';
import { QuizSessionStore } from './quiz-session.store';

describe('QuizSessionStore', () => {
  beforeEach(() => sessionStorage.clear());

  it('preserves Hub return contracts through browser restoration', () => {
    const store = new QuizSessionStore();
    store.start({ questions: [], filters: { quizType: 'quick' }, startedAt: 1, returnTo: 'https://hub.example', hubReturnPath: '/practice/complete' });
    const restored = new QuizSessionStore().restore();
    expect(restored?.returnTo).toBe('https://hub.example');
    expect(restored?.hubReturnPath).toBe('/practice/complete');
  });
});
