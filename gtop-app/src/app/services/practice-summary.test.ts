import '@angular/compiler';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSummaryComponent } from '../pages/quiz-summary/quiz-summary.component';
import { readPracticeSession, writePracticeSession } from './practice-session';
import { presentQuestion } from './question-presentation';
vi.mock('./quiz.service', () => ({ QuizService: class {} }));
vi.mock('./auth.service', () => ({ AuthService: class {} }));
vi.mock('../pages/live/live-summary/live-summary.component', () => ({ LiveSummaryComponent: class {} }));

const user = { uid: 'student', role: 'user', board: 'CBSE', standard: '10' };
const bank = { id: 'q', board: 'CBSE', standard: '10', subject: 'Math', chapter: 'Numbers', question: '2+2?',
    options: ['4', '3', '2', '1'], correctIndex: 0, selectedIndex: 0, solutions: ['Reason', 'More reason'] };
const questions = [presentQuestion(bank, () => 0)];
const session = (attemptId = 'attempt-one') => ({ version: 1 as const, uid: user.uid, role: user.role, routeKey: 'route', attemptId,
    quizType: 'custom' as const, questions, currentQuestionIndex: 0, completed: true, saved: false });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function setup(nav: any = {}, params: any = {}, profile: any = user) {
    const quiz = { saveQuizResult: vi.fn(async () => 'saved'), expandSummariesToQuestions: vi.fn(async () => questions),
        fetchUserQuizResults: vi.fn(async () => []), getQuestions: vi.fn(() => questions),
        prepareRetryFromExistingAttempt: vi.fn(async () => undefined) };
    const router = { getCurrentNavigation: () => ({ extras: { state: nav } }), navigate: vi.fn() };
    const component = new QuizSummaryComponent(quiz as any, { readyUser$: new BehaviorSubject(profile) } as any,
        router as any, { snapshot: { queryParams: params } } as any, {} as any);
    return { component, quiz, router };
}
describe('summary result acknowledgement and recovery', () => {
    beforeEach(() => sessionStorage.clear());
    afterEach(() => vi.useRealTimers());
    it('awaits acknowledgement before marking saved and preserves canonical identity', async () => {
        writePracticeSession(session());
        let acknowledge!: (id: string) => void;
        const { component, quiz } = setup();
        quiz.saveQuizResult.mockImplementation(() => new Promise(resolve => acknowledge = resolve));
        component.ngOnInit(); await flush();
        expect(component.saveState).toBe('saving');
        expect(readPracticeSession(user.uid)?.saved).toBe(false);
        expect(quiz.saveQuizResult).toHaveBeenCalledWith(user.uid, expect.objectContaining({
            attemptId: 'attempt-one', quizType: 'custom', board: 'CBSE',
            questions: [expect.objectContaining({ selectedIndex: 0, correctIndex: 0, optionOrder: [1, 2, 3, 0] })] }));
        acknowledge('saved'); await flush();
        expect(component.saveState).toBe('saved');
        expect(readPracticeSession(user.uid)?.saved).toBe(true);
        component.ngOnDestroy();
    });
    it('exposes failure, retains answers and ID, gates practice retry, and recovers one attempt', async () => {
        writePracticeSession(session());
        const { component, quiz } = setup();
        quiz.saveQuizResult.mockRejectedValueOnce(Error('offline'));
        component.ngOnInit(); await flush();
        expect(component.saveState).toBe('error');
        expect(component.saveError).toContain('not been saved');
        expect(readPracticeSession(user.uid)?.questions).toEqual(questions);
        await component.retryAll();
        expect(quiz.prepareRetryFromExistingAttempt).not.toHaveBeenCalled();
        await component.retrySave();
        expect(component.saveState).toBe('saved');
        expect(quiz.saveQuizResult.mock.calls.map(call => call[1].attemptId)).toEqual(['attempt-one', 'attempt-one']);
        component.ngOnDestroy();
    });
    it('does not replace an explicit older browser-history attempt with the newest session', async () => {
        writePracticeSession(session('newest'));
        const { component, quiz } = setup({ practiceUid: user.uid, attemptId: 'older', questions: [{ ...bank }], quizType: 'quick', saved: true });
        component.ngOnInit(); await flush();
        expect(component.questions[0].options).toEqual(bank.options);
        expect(component.saveState).toBe('saved');
        expect(quiz.saveQuizResult).not.toHaveBeenCalled();
        component.ngOnDestroy();
    });
    it('blocks a changed-profile attempt including manual save retries', async () => {
        writePracticeSession(session());
        const { component, quiz } = setup({}, {}, { ...user, board: 'ICSE', standard: '8' });
        component.ngOnInit(); await flush();
        expect(component.canSave).toBe(false);
        expect(component.saveState).toBe('error');
        await component.retrySave();
        expect(quiz.saveQuizResult).not.toHaveBeenCalled();
        component.ngOnDestroy();
    });
    it('allows admin historical learner deep links, preserving historical records without saving', async () => {
        const { component, quiz } = setup({}, { userId: 'student', sessionId: 'historical' }, { uid: 'admin', role: 'admin' });
        quiz.fetchUserQuizResults.mockResolvedValue([{ id: 'historical', questions: [{ questionId: 'q', selectedIndex: 0, correctIndex: 0 }] }] as any);
        component.ngOnInit(); await flush();
        expect(quiz.fetchUserQuizResults).toHaveBeenCalledWith('student');
        expect(component.questions).toEqual(questions);
        expect(quiz.saveQuizResult).not.toHaveBeenCalled();
        component.ngOnDestroy();
    });
    it('shows a delayed acknowledgement truthfully and updates after reconnect', async () => {
        vi.useFakeTimers(); writePracticeSession(session());
        const { component, quiz } = setup();
        let acknowledge!: (id: string) => void;
        quiz.saveQuizResult.mockImplementation(() => new Promise(resolve => acknowledge = resolve));
        component.ngOnInit(); await flush();
        await vi.advanceTimersByTimeAsync(15000);
        expect(component.saveState).toBe('error');
        expect(component.savePending).toBe(true);
        expect(readPracticeSession(user.uid)?.saved).toBe(false);
        acknowledge('saved'); await flush();
        expect(component.saveState).toBe('saved');
        component.ngOnDestroy();
    });
});
