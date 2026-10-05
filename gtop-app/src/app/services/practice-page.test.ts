import '@angular/compiler';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizPageComponent } from '../pages/quiz-page/quiz-page.component';
import { readPracticeSession, writePracticeSession } from './practice-session';
import { canonicalIndex } from './question-presentation';

vi.mock('./quiz.service', () => ({ QuizService: class {} }));
vi.mock('./auth.service', () => ({ AuthService: class {} }));
vi.mock('./live-quiz.service', () => ({ LiveQuizService: class {} }));

const learner = { uid: 'student', role: 'user', board: 'CBSE', standard: '10' };
const question = { id: 'cbse', board: 'CBSE', standard: '10', subject: 'Math', chapter: 'Numbers', question: 'Two plus two?',
  options: ['4', '3', '5', '6'], correctIndex: 0, selectedIndex: null };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
function page(profile: any = learner, params: any = {}) {
  const readyUser$ = new BehaviorSubject(profile);
  const queryParams = new BehaviorSubject(params);
  const quiz = { consumePendingRetry: vi.fn(() => null), fetchQuestionsFromRandomChapter: vi.fn(async () => [{ ...question }]),
    fetchCustomQuizQuestions: vi.fn(async () => [{ ...question }]), setQuestions: vi.fn() };
  const router = { navigate: vi.fn(async () => true) };
  const component = new QuizPageComponent(quiz as any, {} as any, router as any,
    { snapshot: { queryParams: params }, queryParams } as any, { readyUser$, profile: () => readyUser$.value } as any);
  return { component, quiz, router, readyUser$, queryParams };
}

describe('ordinary learner quiz route and restoration', () => {
  beforeEach(() => sessionStorage.clear());
  it('waits for restored authentication before fetching a scoped bare Quick Quiz', async () => {
    const readyUser$ = new Subject<any>();
    const setup = page();
    (setup.component as any).authService = { readyUser$ };
    setup.component.ngOnInit();
    expect(setup.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    readyUser$.next(learner);
    await tick();
    expect(setup.quiz.fetchQuestionsFromRandomChapter).toHaveBeenCalledWith({ board: 'CBSE', standard: '10' });
    expect(setup.component.questions[0].id).toBe('cbse');
    setup.component.ngOnDestroy();
  });
  it('locks student direct Custom links to their profile but retains admin selection', async () => {
    const params = { board: 'ICSE', standard: '8', subjects: 'Math', count: '5' };
    const student = page(learner, params);
    student.component.ngOnInit(); await tick();
    expect(student.quiz.fetchCustomQuizQuestions).toHaveBeenCalledWith('CBSE', '10', ['Math'], [], 5);
    student.component.ngOnDestroy();
    const admin = page({ uid: 'admin', role: 'admin' }, params);
    admin.quiz.fetchCustomQuizQuestions.mockResolvedValue([{ ...question, board: 'ICSE', standard: '8' }]);
    admin.component.ngOnInit(); await tick();
    expect(admin.quiz.fetchCustomQuizQuestions).toHaveBeenCalledWith('ICSE', '8', ['Math'], [], 5);
    expect(admin.component.loadError).toBe('');
    admin.component.ngOnDestroy();
  });
  it('shows a profile action without any question query, and shows recoverable empty/failure states', async () => {
    const missing = page({ uid: 'student', role: 'user' });
    missing.component.ngOnInit(); await tick();
    expect(missing.component.profileRequired).toBe(true);
    expect(missing.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    missing.component.ngOnDestroy();
    const empty = page();
    empty.quiz.fetchQuestionsFromRandomChapter.mockResolvedValue([]);
    empty.component.ngOnInit(); await tick();
    expect(empty.component.loading).toBe(false);
    expect(empty.component.loadError).toContain('No questions');
    empty.quiz.fetchQuestionsFromRandomChapter.mockRejectedValueOnce(Error('Network unavailable'));
    await empty.component.loadSoloQuiz(true);
    expect(empty.component.loadError).toBe('Network unavailable');
    empty.quiz.fetchQuestionsFromRandomChapter.mockResolvedValue([{ ...question }]);
    await empty.component.loadSoloQuiz(true);
    expect(empty.component.questions).toHaveLength(1);
    expect(empty.component.loadError).toBe('');
    empty.component.ngOnDestroy();
  });
  it('restores answers, cursor and option order without fetching or generating a new attempt', async () => {
    const first = page(); first.component.ngOnInit(); await tick();
    first.component.selectOption(2);
    const stored = readPracticeSession('student')!;
    first.component.ngOnDestroy();
    const second = page(); second.component.ngOnInit(); await tick();
    expect(second.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    expect(second.component.questions).toEqual(stored.questions);
    expect(readPracticeSession('student')?.attemptId).toBe(stored.attemptId);
    second.component.nextQuestion();
    expect(second.router.navigate).toHaveBeenCalledWith(['/quiz-summary'], expect.objectContaining({
      state: expect.objectContaining({ practiceUid: 'student', attemptId: stored.attemptId, quizType: 'quick' }) }));
    second.component.ngOnDestroy();
    const pending = page(); pending.component.ngOnInit(); await tick();
    expect(pending.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    expect(pending.router.navigate).toHaveBeenCalled();
    pending.component.ngOnDestroy();
    writePracticeSession({ ...readPracticeSession('student')!, saved: true });
    const fresh = page(); fresh.component.ngOnInit(); await tick();
    expect(fresh.quiz.fetchQuestionsFromRandomChapter).toHaveBeenCalledOnce();
    expect(readPracticeSession('student')?.attemptId).not.toBe(stored.attemptId);
    fresh.component.ngOnDestroy();
  });
  it('ignores late old-profile questions after a profile change', async () => {
    const setup = page();
    let release!: (questions: any[]) => void;
    setup.quiz.fetchQuestionsFromRandomChapter.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    setup.component.ngOnInit();
    setup.quiz.fetchQuestionsFromRandomChapter.mockResolvedValue([{ ...question, board: 'ICSE', standard: '8' }]);
    setup.readyUser$.next({ ...learner, board: 'ICSE', standard: '8' }); await tick();
    release([{ ...question }]); await tick();
    expect(setup.component.questions[0].board).toBe('ICSE');
    setup.component.ngOnDestroy();
  });
  it('restores a saved completed attempt on browser Back/Forward but starts fresh on a regular launch', async () => {
    const first = page(); first.component.ngOnInit(); await tick();
    first.component.selectOption(1); first.component.nextQuestion();
    const saved = { ...readPracticeSession('student')!, saved: true };
    writePracticeSession(saved); first.component.ngOnDestroy();
    const back = page();
    (back.router as any).getCurrentNavigation = () => ({ trigger: 'popstate' });
    back.component.ngOnInit(); await tick();
    expect(back.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    expect(back.component.questions).toEqual(saved.questions);
    expect(back.router.navigate).not.toHaveBeenCalled();
    expect(back.component.reviewingSavedAttempt).toBe(true);
    back.component.selectOption(3);
    expect(back.component.questions).toEqual(saved.questions);
    back.component.nextQuestion();
    expect(back.router.navigate).toHaveBeenCalledWith(['/quiz-summary'], expect.objectContaining({
      state: expect.objectContaining({ saved: true, attemptId: saved.attemptId }) }));
    back.component.ngOnDestroy();
    const newLaunch = page(); newLaunch.component.ngOnInit(); await tick();
    expect(newLaunch.quiz.fetchQuestionsFromRandomChapter).toHaveBeenCalledOnce();
    expect(readPracticeSession('student')?.attemptId).not.toBe(saved.attemptId);
    newLaunch.component.ngOnDestroy();
  });
  it('treats report result IDs as retry context rather than live-session IDs', async () => {
    const retry = page(learner, { retry: 'reports', sessionId: 'historical-result' });
    retry.quiz.consumePendingRetry.mockReturnValue({ questions: [{ ...question }], context: { source: 'reports', type: 'all' } } as any);
    retry.component.ngOnInit(); await tick();
    expect(retry.component.liveMode).toBe(false);
    expect(retry.component.sessionId).toBeNull();
    expect(retry.component.questions).toHaveLength(1);
    expect(retry.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    expect(readPracticeSession('student')?.quizType).toBe('retry');
    retry.component.ngOnDestroy();
    const refreshed = page(learner, { retry: 'reports', sessionId: 'historical-result' });
    refreshed.component.ngOnInit(); await tick();
    expect(refreshed.component.questions).toHaveLength(1);
    expect(refreshed.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    refreshed.component.ngOnDestroy();
    sessionStorage.clear();
    const missing = page(learner, { retry: 'reports', sessionId: 'historical-result' });
    missing.component.ngOnInit(); await tick();
    expect(missing.component.loadError).toContain('retry could not be restored');
    expect(missing.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    missing.component.ngOnDestroy();
  });
  it('recovers an unsaved result before starting another topic or retry, preserving the original Hub return', async () => {
    const first = page(learner, { returnTo: 'https://hub.example', hubReturnPath: '/practice' });
    first.component.ngOnInit(); await tick();
    first.component.selectOption(0); first.component.nextQuestion();
    const pending = readPracticeSession('student')!;
    first.component.ngOnDestroy();
    const changedTopic = page(learner, { subjects: ['Science'] });
    changedTopic.component.ngOnInit(); await tick();
    expect(changedTopic.quiz.fetchCustomQuizQuestions).not.toHaveBeenCalled();
    expect(changedTopic.quiz.consumePendingRetry).not.toHaveBeenCalled();
    expect(changedTopic.router.navigate).toHaveBeenCalledWith(['/quiz-summary'], expect.objectContaining({
      state: expect.objectContaining({ attemptId: pending.attemptId, returnTo: 'https://hub.example', hubReturnPath: '/practice' }) }));
    expect(readPracticeSession('student')?.attemptId).toBe(pending.attemptId);
    changedTopic.component.ngOnDestroy();
    const changedProfile = page({ ...learner, board: 'ICSE', standard: '8' });
    changedProfile.component.ngOnInit(); await tick();
    expect(changedProfile.quiz.fetchQuestionsFromRandomChapter).not.toHaveBeenCalled();
    expect(changedProfile.component.loadError).toContain('previous quiz result is still unsaved');
    expect(readPracticeSession('student')?.attemptId).toBe(pending.attemptId);
    changedProfile.component.ngOnDestroy();
  });
  it('converts displayed live answers back to canonical bank identity', () => {
    const setup = page();
    const submitAnswer = vi.fn(async () => undefined);
    (setup.component as any).liveService = { submitAnswer, observeAnswers: () => () => {} };
    setup.component.liveMode = true;
    (setup.component as any).liveUid = learner.uid;
    setup.component.sessionId = 'live-session';
    setup.component.timeRemainingSec = 10;
    setup.component.questions = [{ ...question, options: ['3', '5', '4', '6'], optionOrder: [1, 2, 0, 3], correctIndex: 2 }];
    setup.component.selectOption(2);
    expect(submitAnswer).toHaveBeenCalledWith('live-session', 0, 0, expect.any(Date), learner.uid);
    expect(setup.component.questions[0].selectedIndex).toBe(2);
    setup.component.ngOnDestroy();
  });
  it('does not persist late responses after destruction', async () => {
    const setup = page();
    let release!: (questions: any[]) => void;
    setup.quiz.fetchQuestionsFromRandomChapter.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    setup.component.ngOnInit();
    setup.component.ngOnDestroy();
    release([{ ...question }]); await tick();
    expect(setup.component.questions).toHaveLength(0);
    expect(readPracticeSession('student')).toBeNull();
  });
  it('brings the next question into view after rendering without changing focus during restoration', async () => {
    let frame!: FrameRequestCallback;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
    const setup = page();
    const scrollIntoView = vi.fn(), focus = vi.fn();
    setup.component.quizRoot = { nativeElement: { scrollIntoView } } as any;
    setup.component.questionHeading = { nativeElement: { focus } } as any;
    setup.quiz.fetchQuestionsFromRandomChapter.mockResolvedValue([{ ...question }, { ...question, id: 'next' }]);
    setup.component.ngOnInit(); await tick();
    expect(scrollIntoView).not.toHaveBeenCalled();
    setup.component.selectOption(0); setup.component.nextQuestion();
    expect(scrollIntoView).not.toHaveBeenCalled();
    frame(0);
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'start' });
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    setup.component.ngOnDestroy();
    vi.unstubAllGlobals();
  });
});

describe('timed live quiz re-entry', () => {
  const flush = async () => { for (let step = 0; step < 8; step++) await Promise.resolve(); };
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T12:00:05Z')); });
  afterEach(() => vi.useRealTimers());
  function livePage(status = 'active') {
    const setup = page(learner, { sessionId: 'timed', mode: 'run' });
    const session = { id: 'timed', mode: 'run', status, questionIds: ['cbse', 'second'], perQuestionSeconds: 20,
      anchorIndex: 0, anchorAt: { toDate: () => new Date('2026-10-04T12:00:00Z') },
      scheduledStartAt: { toDate: () => new Date('2026-10-04T12:00:00Z') } };
    const live = { observeSession: vi.fn((_id, cb) => { cb(session); return () => {}; }),
      observeParticipants: vi.fn(() => () => {}), observeAnswers: vi.fn(() => () => {}),
      fetchSavedResultForSession: vi.fn(async () => null),
      fetchQuestionsForSession: vi.fn(async () => [{ ...question }, { ...question, id: 'second' }]),
      restoreOwnAnswersForSession: vi.fn(async (_id, questions: any[]) => questions.map((item, index) => ({ ...item, selectedIndex: index === 0 ? 0 : null }))),
      submitAnswer: vi.fn(async () => undefined) };
    (setup.component as any).liveService = live;
    return { ...setup, live, session };
  }
  it('invalidates a mounted live attempt when another account signs in', async () => {
    const setup = livePage();
    setup.component.ngOnInit(); await flush();
    expect(setup.component.questions[0].selectedIndex).not.toBeNull();
    setup.readyUser$.next({ ...learner, uid: 'other-student' });
    setup.component.currentQuestionIndex = 1;
    setup.component.timeRemainingSec = 20;
    setup.component.selectOption(0);
    vi.advanceTimersByTime(45000);
    expect(setup.live.submitAnswer).not.toHaveBeenCalled();
    expect(setup.router.navigate).not.toHaveBeenCalled();
    expect(setup.component.loadError).toContain('account changed');
    expect(setup.component.questions).toHaveLength(0);
    setup.component.ngOnDestroy();
  });
  it('reviews a completed acknowledged session without creating a changed result or loading fresh bank answers', async () => {
    const setup = livePage('ended');
    const saved = { id: 'legacy-result', userId: 'student', sessionId: 'timed', quizType: 'run',
      questions: [{ questionId: 'cbse', selectedIndex: 0, correctIndex: 0, isCorrect: true }] };
    setup.live.fetchSavedResultForSession.mockResolvedValue(saved as any);
    setup.component.ngOnInit(); await flush();
    expect(setup.live.fetchQuestionsForSession).not.toHaveBeenCalled();
    expect(setup.live.restoreOwnAnswersForSession).not.toHaveBeenCalled();
    expect(setup.quiz.setQuestions).not.toHaveBeenCalled();
    expect(setup.router.navigate).toHaveBeenCalledExactlyOnceWith(['/quiz-summary'], expect.objectContaining({
      state: expect.objectContaining({ session: saved, questionSummaries: saved.questions, saved: true, fromLive: true, practiceUid: 'student' }) }));
    setup.component.ngOnDestroy();
  });
  it('restores an interrupted timed answer and prevents another submission while maintaining canonical scoring', async () => {
    const first = livePage(); first.component.ngOnInit(); await flush();
    expect(first.component.currentQuestionIndex).toBe(0);
    expect(canonicalIndex(first.component.questions[0], first.component.questions[0].selectedIndex)).toBe(0);
    first.component.selectOption((first.component.questions[0].selectedIndex + 1) % 4);
    expect(first.live.submitAnswer).not.toHaveBeenCalled();
    const beforeReload = first.component.questions;
    first.component.ngOnDestroy();
    const restored = livePage(); restored.component.ngOnInit(); await flush();
    expect(restored.component.questions).toEqual(beforeReload);
    const advanceFocus = vi.spyOn(restored.component as any, 'focusCurrentQuestion');
    vi.advanceTimersByTime(21000);
    expect(restored.component.currentQuestionIndex).toBe(1);
    expect(advanceFocus).toHaveBeenCalledOnce();
    const displayAnswer = restored.component.questions[1].optionOrder.indexOf(0);
    restored.component.selectOption(displayAnswer);
    expect(restored.live.submitAnswer).toHaveBeenCalledWith('timed', 1, 0, expect.any(Date), learner.uid);
    vi.advanceTimersByTime(16000);
    expect(advanceFocus).toHaveBeenCalledOnce();
    expect(restored.router.navigate).toHaveBeenCalledWith(['/quiz-summary'], expect.objectContaining({
      state: expect.objectContaining({ attemptId: 'live-timed-student', practiceUid: 'student' }) }));
    const summaryQuestions = (restored.router.navigate.mock.calls[0][1] as any).state.questions;
    expect(summaryQuestions.map((item: any) => canonicalIndex(item, item.selectedIndex))).toEqual([0, 0]);
    restored.component.ngOnDestroy();
  });
  it('waits for answer restoration before automatic ended-session summary navigation', async () => {
    const setup = livePage('ended');
    let release!: (questions: any[]) => void;
    setup.live.restoreOwnAnswersForSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    setup.component.ngOnInit(); await flush();
    vi.advanceTimersByTime(45000);
    expect(setup.router.navigate).not.toHaveBeenCalled();
    release([{ ...question, selectedIndex: 0 }, { ...question, id: 'second', selectedIndex: null }]);
    await flush();
    expect(setup.router.navigate).toHaveBeenCalledOnce();
    setup.component.ngOnDestroy();
  });
  it('shows read failures without generating a blank result and ignores destroyed asynchronous loads', async () => {
    const failed = livePage('ended');
    failed.live.fetchSavedResultForSession.mockRejectedValue(Error('offline'));
    failed.component.ngOnInit(); await flush();
    expect(failed.component.loadError).toBe('offline');
    expect(failed.router.navigate).not.toHaveBeenCalled();
    expect(failed.live.fetchQuestionsForSession).not.toHaveBeenCalled();
    failed.component.ngOnDestroy();
    const delayed = livePage('ended');
    let release!: (result: any) => void;
    delayed.live.fetchSavedResultForSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    delayed.component.ngOnInit(); delayed.component.ngOnDestroy();
    release({ questions: [{ questionId: 'cbse' }] }); await flush();
    expect(delayed.router.navigate).not.toHaveBeenCalled();
  });
});
