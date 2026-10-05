import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveQuizService } from './live-quiz.service';
import { setDoc } from '@angular/fire/firestore';

const state = vi.hoisted(() => ({ records: new Map<string, any>(), error: null as any, requests: [] as any[] }));
function snapshot(path: string) {
  return { id: path.split('/').at(-1), exists: () => state.records.has(path), data: () => state.records.get(path) };
}
vi.mock('@angular/fire/auth', () => ({ Auth: class {} }));
vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {}, collection: (_db: any, path: string) => ({ path }),
  doc: (_db: any, path: string) => ({ path }), where: (field: string, op: string, value: any) => ({ field, op, value }),
  query: (base: any, ...constraints: any[]) => ({ ...base, constraints }),
  getDoc: vi.fn(async (ref: any) => snapshot(ref.path)),
  getDocFromServer: vi.fn(async (ref: any) => {
    state.requests.push(ref);
    if (state.error) throw state.error;
    return snapshot(ref.path);
  }),
  getDocsFromServer: vi.fn(async (request: any) => {
    state.requests.push(request);
    if (state.error) throw state.error;
    const docs = [...state.records.entries()].filter(([path, data]) =>
      path.startsWith(`${request.path}/`) && !path.slice(request.path.length + 1).includes('/') &&
      request.constraints.every(({ field, value }: any) => data[field] === value))
      .map(([path, data]) => ({ id: path.split('/').at(-1), data: () => data }));
    return { docs };
  }),
  getDocs: vi.fn(), setDoc: vi.fn(), onSnapshot: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  serverTimestamp: vi.fn(), Timestamp: { now: vi.fn() }, getCountFromServer: vi.fn()
}));
const question = { id: 'one', options: ['A', 'B', 'C'], correctIndex: 1, selectedIndex: null };
const result = { userId: 'learner', sessionId: 'session', quizType: 'run', questions: [{ questionId: 'one', selectedIndex: 1, correctIndex: 1 }] };
describe('live attempt re-entry and answer restoration', () => {
  beforeEach(() => { state.records.clear(); state.requests = []; state.error = null; vi.clearAllMocks(); });
  it('rejects a mounted account A attempt while Firebase Auth has already changed to B', async () => {
    const service = new LiveQuizService({} as any, { currentUser: { uid: 'other' } } as any);
    await expect(service.fetchSavedResultForSession('session', 'learner')).rejects.toThrow('account changed');
    await expect(service.restoreOwnAnswersForSession('session', [question], 'learner')).rejects.toThrow('account changed');
    await expect(service.submitAnswer('session', 0, 1, new Date(), 'learner')).rejects.toThrow('account changed');
    expect(state.requests).toHaveLength(0);
    expect(setDoc).not.toHaveBeenCalled();
  });
  it('opens the acknowledged immutable attempt first, while retaining legacy results', async () => {
    const service = new LiveQuizService({} as any, { currentUser: { uid: 'learner' } } as any);
    state.records.set('QuizResults/legacy', { ...result, timestamp: { toMillis: () => 20 } });
    state.records.set('QuizResults/stable', { ...result, attemptId: 'live-session-learner', timestamp: { toMillis: () => 10 } });
    state.records.set('QuizResults/other-user', { ...result, userId: 'other' });
    expect((await service.fetchSavedResultForSession('session')).id).toBe('stable');
    expect(state.requests[0].constraints).toEqual([{ field: 'userId', op: '==', value: 'learner' }]);
    state.records.delete('QuizResults/stable');
    expect((await service.fetchSavedResultForSession('session')).id).toBe('legacy');
    expect(await service.fetchSavedResultForSession('missing')).toBeNull();
    expect(state.records.size).toBe(2);
  });
  it('restores canonical answers by position, including repeated question IDs', async () => {
    const service = new LiveQuizService({} as any, { currentUser: { uid: 'learner' } } as any);
    state.records.set('LiveSessions/session/answers/0/items/learner', { uid: 'learner', selectedIndex: 1 });
    state.records.set('LiveSessions/session/answers/1/items/learner', { uid: 'learner', selectedIndex: 2 });
    const restored = await service.restoreOwnAnswersForSession('session', [question, question, { ...question, id: 'two' }]);
    expect(restored.map(item => item.selectedIndex)).toEqual([1, 2, null]);
    expect(restored[0]).not.toBe(restored[1]);
    expect(question.selectedIndex).toBeNull();
    expect(state.requests.map(item => item.path)).toEqual([0, 1, 2].map(index => `LiveSessions/session/answers/${index}/items/learner`));
  });
  it('rejects unconfirmed reads rather than treating an offline result or answer as empty', async () => {
    const service = new LiveQuizService({} as any, { currentUser: { uid: 'learner' } } as any);
    state.error = Error('offline');
    await expect(service.fetchSavedResultForSession('session')).rejects.toThrow('offline');
    await expect(service.restoreOwnAnswersForSession('session', [question])).rejects.toThrow('offline');
  });
  it('requires authentication and never adopts another participant or an invalid option', async () => {
    const service = new LiveQuizService({} as any, { currentUser: { uid: 'learner' } } as any);
    state.records.set('LiveSessions/session/answers/0/items/learner', { uid: 'other', selectedIndex: 1 });
    state.records.set('LiveSessions/session/answers/1/items/learner', { uid: 'learner', selectedIndex: 90 });
    expect((await service.restoreOwnAnswersForSession('session', [question, question])).map(item => item.selectedIndex)).toEqual([null, null]);
    const signedOut = new LiveQuizService({} as any, { currentUser: null } as any);
    await expect(signedOut.fetchSavedResultForSession('session')).rejects.toThrow('authenticated');
    await expect(signedOut.restoreOwnAnswersForSession('session', [question])).rejects.toThrow('authenticated');
  });
});
