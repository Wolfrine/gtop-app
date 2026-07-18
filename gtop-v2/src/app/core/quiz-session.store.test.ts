import { beforeEach, describe, expect, it } from 'vitest';
import { QuizSessionStore } from './quiz-session.store';

describe('QuizSessionStore', () => {
  beforeEach(() => sessionStorage.clear());

  it('preserves Hub return contracts through browser restoration', () => {
    const store = new QuizSessionStore();
    store.start({
      questions: [],
      filters: { quizType: 'quick' },
      startedAt: 1,
      returnTo: 'https://hub.example',
      hubReturnPath: '/practice/complete',
    });
    const restored = new QuizSessionStore().restore();
    expect(restored?.returnTo).toBe('https://hub.example');
    expect(restored?.hubReturnPath).toBe('/practice/complete');
  });

  it('preserves retry context and updated answers', () => {
    const store = new QuizSessionStore();
    store.start({
      questions: [],
      filters: { quizType: 'custom' },
      startedAt: 5,
      launchContext: { kind: 'retry-incorrect', sourceResultId: 'result-1' },
    });
    store.persist({ ...store.active()!, startedAt: 6 });
    const restored = new QuizSessionStore().restore();
    expect(restored?.launchContext?.kind).toBe('retry-incorrect');
    expect(restored?.startedAt).toBe(6);
  });
});
