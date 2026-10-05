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
    const profiles = new BehaviorSubject(profile);
    const component = new QuizSummaryComponent(quiz as any, { readyUser$: profiles } as any,
        router as any, { snapshot: { queryParams: params } } as any, {} as any);
    return { component, quiz, router, profiles };
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
    it('blocks save retry when the learning profile changes after an offline failure', async () => {
        writePracticeSession(session());
        const { component, quiz, profiles } = setup();
        quiz.saveQuizResult.mockRejectedValueOnce(Error('offline'));
        component.ngOnInit(); await flush();
        profiles.next({ ...user, board: 'ICSE', standard: '8' }); await flush();
        await component.retrySave();
        expect(quiz.saveQuizResult).toHaveBeenCalledTimes(1);
        expect(component.canSave).toBe(false);
        expect(component.saveState).toBe('error');
        expect(component.saveError).toContain('profile');
        expect(readPracticeSession(user.uid)?.saved).toBe(false);
        component.ngOnDestroy();
    });
    it('blocks old attempt saving when the account changes after an offline failure', async () => {
        writePracticeSession(session());
        const { component, quiz, profiles } = setup();
        quiz.saveQuizResult.mockRejectedValueOnce(Error('offline'));
        component.ngOnInit(); await flush();
        profiles.next({ ...user, uid: 'other-student' }); await flush();
        await component.retrySave();
        expect(quiz.saveQuizResult).toHaveBeenCalledTimes(1);
        expect(component.currentUserId).toBe('other-student');
        expect(component.canSave).toBe(false);
        expect(component.questions).toEqual([]);
        expect(readPracticeSession(user.uid)?.saved).toBe(false);
        component.ngOnDestroy();
    });
    it('ignores a previous account acknowledgement after logout and retains recovery under its owner', async () => {
        writePracticeSession(session());
        const { component, quiz, profiles } = setup();
        let acknowledge!: (id: string) => void;
        quiz.saveQuizResult.mockImplementation(() => new Promise(resolve => acknowledge = resolve));
        component.ngOnInit(); await flush();
        profiles.next(null); await flush();
        expect(component.currentUserId).toBeNull();
        expect(component.canSave).toBe(false);
        expect(component.saveState).toBe('error');
        acknowledge('saved'); await flush();
        expect(component.saveState).toBe('error');
        expect(component.questions).toEqual([]);
        expect(readPracticeSession(user.uid)?.saved).toBe(false);
        profiles.next(user); await flush();
        await component.retrySave();
        expect(quiz.saveQuizResult).toHaveBeenCalledTimes(1);
        component.ngOnDestroy();
        // Reopening under the original owner safely recovers the same durable attempt.
        const reopened = setup(); reopened.component.ngOnInit(); await flush();
        expect(reopened.quiz.saveQuizResult).toHaveBeenCalledWith(user.uid, expect.objectContaining({ attemptId: 'attempt-one' }));
        reopened.component.ngOnDestroy();
    });
    it('prevents an old loading history response from appearing under a new account', async () => {
        const { component, quiz, profiles } = setup({}, { sessionId: 'old-result', userId: user.uid });
        let finishHistory!: (value: any) => void;
        quiz.fetchUserQuizResults.mockImplementation(() => new Promise(resolve => finishHistory = resolve));
        component.ngOnInit(); await flush();
        profiles.next({ ...user, uid: 'other-student' });
        finishHistory([{ id: 'old-result', questions: [{ questionId: 'q', selectedIndex: 0, correctIndex: 0 }] }]);
        await flush();
        expect(component.questions).toEqual([]);
        expect(component.saveState).toBe('error');
        expect(quiz.expandSummariesToQuestions).not.toHaveBeenCalled();
        expect(quiz.saveQuizResult).not.toHaveBeenCalled();
        component.ngOnDestroy();
    });
    it('prevents a late expanded historical review from repopulating an invalidated summary', async () => {
        const { component, quiz, profiles } = setup({ questionSummaries: [{ questionId: 'q', selectedIndex: 0, correctIndex: 0 }] });
        let finishExpand!: (value: any) => void;
        quiz.expandSummariesToQuestions.mockImplementation(() => new Promise(resolve => finishExpand = resolve));
        component.ngOnInit(); await flush();
        profiles.next({ ...user, role: 'admin' });
        finishExpand(questions); await flush();
        expect(component.questions).toEqual([]);
        expect(component.canSave).toBe(false);
        expect(component.saveState).toBe('error');
        expect(quiz.saveQuizResult).not.toHaveBeenCalled();
        component.ngOnDestroy();
    });
    it('retains admin curriculum freedom when unrelated admin profile defaults change', async () => {
        const admin = { uid: 'admin', role: 'admin', board: 'ICSE', standard: '8' };
        const { component, quiz, profiles } = setup({ questions, practiceUid: admin.uid, attemptId: 'admin-selected-cbse' }, {}, admin);
        quiz.saveQuizResult.mockRejectedValueOnce(Error('offline'));
        component.ngOnInit(); await flush();
        profiles.next({ ...admin, board: 'IGCSE', standard: '12' });
        await component.retrySave();
        expect(component.saveState).toBe('saved');
        expect(quiz.saveQuizResult.mock.calls.map(call => call[0])).toEqual(['admin', 'admin']);
        expect(quiz.saveQuizResult.mock.calls.map(call => call[1].attemptId)).toEqual(['admin-selected-cbse', 'admin-selected-cbse']);
        component.ngOnDestroy();
    });
    it('treats equivalent learner board aliases as the same profile during retry', async () => {
        const igcseUser = { ...user, board: 'Cambridge IGCSE' };
        const { component, quiz, profiles } = setup({ questions: [{ ...bank, board: 'IGCSE' }], practiceUid: user.uid, attemptId: 'igcse' }, {}, igcseUser);
        quiz.saveQuizResult.mockRejectedValueOnce(Error('offline'));
        component.ngOnInit(); await flush();
        profiles.next({ ...igcseUser, board: 'IGCSE' });
        await component.retrySave();
        expect(component.saveState).toBe('saved');
        expect(quiz.saveQuizResult).toHaveBeenCalledTimes(2);
        component.ngOnDestroy();
    });
    it('unsubscribes and ignores a late write acknowledgement after destruction', async () => {
        writePracticeSession(session());
        const { component, quiz, profiles } = setup();
        let acknowledge!: (id: string) => void;
        quiz.saveQuizResult.mockImplementation(() => new Promise(resolve => acknowledge = resolve));
        component.ngOnInit(); await flush();
        component.ngOnDestroy();
        acknowledge('saved'); profiles.next({ ...user, uid: 'other-student' }); await flush();
        expect(component.currentUserId).toBe(user.uid);
        expect(readPracticeSession(user.uid)?.saved).toBe(false);
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
