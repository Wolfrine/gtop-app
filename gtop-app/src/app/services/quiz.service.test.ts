import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReplaySubject } from 'rxjs';
import { QuizService } from './quiz.service';
import { presentQuestion } from './question-presentation';
import { createHash, webcrypto } from 'node:crypto';

const state = vi.hoisted(() => ({
    records: new Map<string, any>(), queries: [] as any[], writes: [] as any[],
    readError: null as any, writeError: null as any, waitForWrite: null as Promise<void> | null,
    missingDenied: true, autoId: 0, commitBeforeError: false
}));
const permissionDenied = () => Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
vi.mock('./syllabus.service', () => ({ SyllabusService: class {} }));
vi.mock('@angular/fire/firestore', () => ({
    Firestore: class {},
    collection: (_db: any, ...path: string[]) => ({ path: path.join('/') }),
    doc: (...args: any[]) => args.length === 1
        ? { path: `${args[0].path}/auto-${++state.autoId}`, id: `auto-${state.autoId}` }
        : { path: args.slice(1).join('/'), id: args[args.length - 1].split('/').at(-1) },
    where: (field: string, op: string, value: any) => ({ field, op, value }),
    query: (base: any, ...constraints: any[]) => ({ ...base, constraints: [...(base.constraints || []), ...constraints] }),
    getDocs: vi.fn(async (request: any) => {
        state.queries.push(request);
        if (state.readError) throw state.readError;
        const docs = [...state.records.entries()].filter(([path, data]) => {
            if (!path.startsWith(`${request.path}/`) || path.slice(request.path.length + 1).includes('/')) return false;
            return (request.constraints || []).every(({ field, op, value }: any) => {
                const actual = field === '__name__' ? path.split('/').at(-1) : data[field];
                return op === 'in' ? value.includes(actual) : actual === value;
            });
        }).map(([path, data]) => ({ id: path.split('/').at(-1), data: () => data }));
        return { docs, empty: !docs.length };
    }),
    getDoc: vi.fn(async (ref: any) => ({ id: ref.id, exists: () => state.records.has(ref.path), data: () => state.records.get(ref.path) })),
    getDocFromServer: vi.fn(async (ref: any) => {
        if (state.readError) throw state.readError;
        if (!state.records.has(ref.path) && state.missingDenied) throw permissionDenied();
        return { id: ref.id, exists: () => state.records.has(ref.path), data: () => state.records.get(ref.path) };
    }),
    setDoc: vi.fn(async (ref: any, data: any) => {
        state.writes.push({ ref, data });
        if (state.waitForWrite) await state.waitForWrite;
        if (state.writeError) {
            if (state.commitBeforeError) state.records.set(ref.path, data);
            throw state.writeError;
        }
        // Match current learner rules: create own result, no update.
        if (state.records.has(ref.path)) throw permissionDenied();
        state.records.set(ref.path, data);
    }),
    Timestamp: { now: () => ({ toDate: () => new Date('2026-10-04T00:00:00Z') }) },
    runTransaction: vi.fn(async (_db: any, callback: any) => callback({
        get: async (ref: any) => ({ exists: () => state.records.has(ref.path) }),
        set: (ref: any, data: any) => state.records.set(ref.path, data),
        update: (ref: any, data: any) => state.records.set(ref.path, { ...state.records.get(ref.path), ...data })
    })), increment: (value: number) => value
}));

const cbse = { board: 'CBSE', standard: '10', subject: 'Math', chapter: 'Algebra', mcqCount: 3 };
const icse = { board: 'ICSE', standard: '8', subject: 'Science', chapter: 'Cells', mcqCount: 2 };
const bankQuestion = (id: string, scope = cbse) => ({
    id, ...scope, question: 'Which option?', options: ['one', 'two', 'three'], correctIndex: 0,
    solutions: ['Option A explains the answer.', 'This second paragraph is also needed.']
});
const result = (attemptId = 'attempt-one') => ({
    userName: 'Learner', board: 'CBSE', standard: '10', subject: 'Math', chapter: 'Algebra',
    quizType: 'quick', attemptId,
    questions: [{ id: 'cbse-question', selectedIndex: 0, correctIndex: 0, optionOrder: [2, 0, 1] }]
});

describe('quiz service curriculum selection', () => {
    let service: QuizService;
    let snapshots: ReplaySubject<any>;
    beforeEach(() => {
        state.records.clear(); state.queries = []; state.writes = []; state.readError = null;
        state.writeError = null; state.waitForWrite = null; state.missingDenied = true; state.autoId = 0; state.commitBeforeError = false;
        snapshots = new ReplaySubject(1);
        snapshots.next({ items: [cbse, icse], fromCache: false });
        service = new QuizService({} as any, { snapshots$: snapshots } as any);
        state.records.set('questions/cbse-question', bankQuestion('cbse-question'));
        state.records.set('questions/icse-question', bankQuestion('icse-question', icse));
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
    });
    afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

    it('reproduces global chapter selection for the explicit unscoped admin path', async () => {
        const questions = await service.fetchQuestionsFromRandomChapter();
        expect(questions.map(q => q.id)).toEqual(['icse-question']);
        expect(state.queries[0].constraints).toContainEqual({ field: 'board', op: '==', value: 'ICSE' });
    });
    it('restricts a learner quick quiz to their curriculum despite another eligible board and class', async () => {
        const questions = await service.fetchQuestionsFromRandomChapter({ board: 'CBSE', standard: '10' });
        expect(questions.map(q => q.id)).toEqual(['cbse-question']);
        expect(state.queries[0].constraints).toContainEqual({ field: 'standard', op: '==', value: '10' });
    });
    it('retains explicit admin custom selections outside the ordinary learner curriculum', async () => {
        const questions = await service.fetchCustomQuizQuestions('ICSE', '8', ['Science'], ['Cells'], 10);
        expect(questions.map(q => q.id)).toEqual(['icse-question']);
    });
    it('rejects missing profile scope before reading questions', async () => {
        await expect(service.fetchQuestionsFromRandomChapter({ board: '', standard: '10' })).rejects.toThrow('profile-required');
        await expect(service.fetchCustomQuizQuestions('CBSE', '', [], [], 10)).rejects.toThrow('profile-required');
        expect(state.queries).toHaveLength(0);
    });
    it('reports an empty curriculum without falling back to another curriculum', async () => {
        await expect(service.fetchQuestionsFromRandomChapter({ board: 'CBSE', standard: '9' })).rejects.toThrow('this curriculum');
        expect(state.queries).toHaveLength(0);
    });
    it('waits past an empty cached snapshot and handles an actual empty server catalogue', async () => {
        snapshots = new ReplaySubject(1);
        snapshots.next({ items: [], fromCache: true });
        service = new QuizService({} as any, { snapshots$: snapshots } as any);
        const pending = service.fetchQuestionsFromRandomChapter({ board: 'CBSE', standard: '10' });
        snapshots.next({ items: [cbse, icse], fromCache: false });
        await expect(pending).resolves.toHaveLength(1);
        snapshots.next({ items: [], fromCache: false });
        await expect(service.fetchQuestionsFromRandomChapter()).rejects.toThrow('No chapters');
    });
    it('waits for server curriculum data when the cache only has another board', async () => {
        snapshots.next({ items: [icse], fromCache: true });
        const pending = service.fetchQuestionsFromRandomChapter({ board: 'CBSE', standard: '10' });
        snapshots.next({ items: [cbse, icse], fromCache: false });
        await expect(pending).resolves.toMatchObject([{ id: 'cbse-question' }]);
    });
    it('exposes a recoverable timeout instead of hanging on an empty offline catalogue', async () => {
        vi.useFakeTimers();
        snapshots.next({ items: [], fromCache: true });
        const pending = expect(service.fetchQuestionsFromRandomChapter({ board: 'CBSE', standard: '10' }))
            .rejects.toMatchObject({ name: 'TimeoutError' });
        await vi.advanceTimersByTimeAsync(15_000);
        await pending;
    });
    it('propagates catalogue and question read failures for the page retry state', async () => {
        const error = new Error('unavailable');
        snapshots = new ReplaySubject(1);
        service = new QuizService({} as any, { snapshots$: snapshots } as any);
        snapshots.error(error);
        await expect(service.fetchQuestionsFromRandomChapter()).rejects.toBe(error);
        state.readError = error;
        await expect(service.fetchCustomQuizQuestions('CBSE', '10', [], [], 10)).rejects.toBe(error);
    });
    it('matches Cambridge IGCSE syllabus to historical IGCSE question records in quick and custom', async () => {
        const scope = { ...cbse, board: 'Cambridge IGCSE', standard: '8', chapter: 'Number' };
        snapshots.next({ items: [scope, cbse], fromCache: false });
        state.records.set('questions/igcse-question', bankQuestion('igcse-question', { ...scope, board: 'IGCSE' }));
        state.records.set('questions/cambridge-question', bankQuestion('cambridge-question', scope));
        const quick = await service.fetchQuestionsFromRandomChapter({ board: 'IGCSE', standard: '8' });
        expect(quick.map(q => q.id).sort()).toEqual(['cambridge-question', 'igcse-question']);
        const custom = await service.fetchCustomQuizQuestions('Cambridge IGCSE', '8', ['Math'], ['Number'], 10);
        expect(custom.map(q => q.id).sort()).toEqual(['cambridge-question', 'igcse-question']);
        expect(state.queries.filter(q => q.constraints.some((c: any) => c.field === 'board' && c.op === 'in'))).toHaveLength(0);
    });
    it('limits question count without modifying the bank or option presentation', async () => {
        const original = state.records.get('questions/cbse-question');
        const questions = await service.fetchCustomQuizQuestions('CBSE', '10', [], [], 1);
        expect(questions).toHaveLength(1);
        expect(questions[0].options).toEqual(original.options);
        expect(questions[0].selectedIndex).toBeNull();
        expect(original.selectedIndex).toBeUndefined();
    });
});

describe('acknowledged immutable quiz attempts', () => {
    let service: QuizService;
    beforeEach(() => {
        state.records.clear(); state.queries = []; state.writes = []; state.readError = null;
        state.writeError = null; state.waitForWrite = null; state.missingDenied = true; state.autoId = 0; state.commitBeforeError = false;
        service = new QuizService({} as any, {} as any);
    });
    afterEach(() => vi.restoreAllMocks());
    it('resolves only after write acknowledgement and stores board plus canonical answer identity', async () => {
        let acknowledge!: () => void;
        state.waitForWrite = new Promise<void>(resolve => acknowledge = resolve);
        const saved = vi.fn();
        const pending = service.saveQuizResult('student', result()).then(saved);
        await vi.waitFor(() => expect(state.writes).toHaveLength(1));
        expect(saved).not.toHaveBeenCalled();
        acknowledge(); await pending;
        expect(saved).toHaveBeenCalledWith('attempt-student:attempt-one');
        const data = state.records.get('QuizResults/attempt-student:attempt-one');
        expect(data).toMatchObject({ board: 'CBSE', correctAnswers: 1, percentage: 100, attemptId: 'attempt-one' });
        expect(data.questions[0]).toEqual({ questionId: 'cbse-question', selectedIndex: 0, correctIndex: 0, isCorrect: true, optionOrder: [2, 0, 1] });
    });
    it('propagates save failure then retries the same identity successfully', async () => {
        const error = new Error('unavailable'); state.writeError = error;
        await expect(service.saveQuizResult('student', result())).rejects.toBe(error);
        expect(state.records.size).toBe(0);
        state.writeError = null;
        await expect(service.saveQuizResult('student', result())).resolves.toBe('attempt-student:attempt-one');
        expect(state.writes.map(w => w.ref.path)).toEqual(['QuizResults/attempt-student:attempt-one', 'QuizResults/attempt-student:attempt-one']);
    });
    it('recognizes repeat saves without updating an acknowledged result or its timestamp', async () => {
        const id = await service.saveQuizResult('student', result());
        const original = state.records.get(`QuizResults/${id}`);
        await expect(service.saveQuizResult('student', result())).resolves.toBe(id);
        expect(state.writes).toHaveLength(1);
        expect(state.records.get(`QuizResults/${id}`)).toBe(original);
    });
    it('recognizes Firestore maps independently of their returned property order', async () => {
        const id = await service.saveQuizResult('student', result());
        const saved = state.records.get(`QuizResults/${id}`);
        saved.questions = [{ optionOrder: [2, 0, 1], isCorrect: true, correctIndex: 0, selectedIndex: 0, questionId: 'cbse-question' }];
        await expect(service.saveQuizResult('student', result())).resolves.toBe(id);
        expect(state.writes).toHaveLength(1);
    });
    it('handles concurrent retries under create-only learner rules exactly once', async () => {
        const ids = await Promise.all([service.saveQuizResult('student', result()), service.saveQuizResult('student', result())]);
        expect(ids[0]).toBe(ids[1]); expect(state.records.size).toBe(1);
    });
    it('verifies the committed server record when a write acknowledgement is lost', async () => {
        state.writeError = new Error('acknowledgement-lost'); state.commitBeforeError = true;
        await expect(service.saveQuizResult('student', result())).resolves.toBe('attempt-student:attempt-one');
        expect(state.records.size).toBe(1);
        await expect(service.saveQuizResult('student', result())).resolves.toBe('attempt-student:attempt-one');
        expect(state.writes).toHaveLength(1);
    });
    it('rejects reuse of an attempt identity with changed answers', async () => {
        await service.saveQuizResult('student', result());
        const changed = result(); changed.questions[0].selectedIndex = 1;
        await expect(service.saveQuizResult('student', changed)).rejects.toThrow('attempt-id-conflict');
        expect(state.writes).toHaveLength(1);
    });
    it('keeps identities distinct across accounts and escapes path separators', async () => {
        const one = await service.saveQuizResult('student/a', result('attempt/b'));
        const two = await service.saveQuizResult('student/b', result('attempt/b'));
        expect(one).not.toBe(two); expect(one).toBe('attempt-student%2Fa:attempt%2Fb');
        expect(state.records.size).toBe(2);
    });
    it('returns a recoverable offline failure before starting a write', async () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        await expect(service.saveQuizResult('student', result())).rejects.toThrow('offline');
        expect(state.writes).toHaveLength(0);
    });
    it('propagates server verification errors without claiming an existing save', async () => {
        state.readError = new Error('unavailable');
        await expect(service.saveQuizResult('student', result())).rejects.toBe(state.readError);
        expect(state.writes).toHaveLength(0);
    });
    it('preserves callers without attempt IDs and does not count unanswered or empty attempts as correct', async () => {
        const payload: any = result(); delete payload.attemptId;
        payload.questions = [{ id: 'unanswered', selectedIndex: null, correctIndex: 0 }];
        const id = await service.saveQuizResult('student', payload);
        expect(id).toBe('auto-1'); expect(state.records.get(`QuizResults/${id}`).correctAnswers).toBe(0);
        const emptyId = await service.saveQuizResult('student', { ...payload, questions: [] });
        expect(state.records.get(`QuizResults/${emptyId}`).percentage).toBe(0);
    });
    it('reviews historical canonical summaries and restores the exact new display order', async () => {
        const question = bankQuestion('cbse-question'); state.records.set('questions/cbse-question', question);
        const historical = await service.expandSummariesToQuestions([{ questionId: question.id, selectedIndex: 1, correctIndex: 0, isCorrect: false }]);
        expect(historical[0].options).toEqual(question.options); expect(historical[0].selectedIndex).toBe(1);
        const current = await service.expandSummariesToQuestions([{ questionId: question.id, selectedIndex: 0, correctIndex: 0, isCorrect: true, optionOrder: [2, 0, 1] }]);
        expect(current[0].options).toEqual(['three', 'one', 'two']);
        expect(current[0].selectedIndex).toBe(1); expect(current[0].correctIndex).toBe(1);
        expect(current[0].solutions).toHaveLength(2);
    });
    it('reads saved invitation answers after their revision leaves the active manifest without fetching current content', async () => {
        vi.stubGlobal('crypto', webcrypto);
        try {
            const snapshots = Array.from({ length: 5 }, (_, i) => bankQuestion(`archived-${i}`));
            const answers = snapshots.map(q => ({ questionId: q.id, selectedIndex: 0, correctIndex: 0, optionOrder: [2, 0, 1] }));
            const invitation = { version: 1, attemptId: 'owned-archived-attempt', entryType: 'invitation', revision: 'retired-fixture-v1',
                scope: { board: cbse.board, standard: cbse.standard, subject: cbse.subject, chapter: cbse.chapter },
                questionIds: snapshots.map(q => q.id), snapshots, answers,
                contentHashes: Object.fromEntries(snapshots.map(q => [q.id, createHash('sha256').update(JSON.stringify(
                    [q.board, q.standard, q.subject, q.chapter, q.question, q.options, q.correctIndex, q.solutions])).digest('hex')])) };
            const summaries = answers.map(answer => ({ ...answer, isCorrect: true }));
            const restored = await service.expandSummariesToQuestions(summaries, invitation);
            expect(restored.map(q => q.id)).toEqual(invitation.questionIds);
            expect(restored[0].options).toEqual(['three', 'one', 'two']);
            expect(restored[0].selectedIndex).toBe(1);
            expect(state.queries).toHaveLength(0);
            expect(state.writes).toHaveLength(0);
            await expect(service.expandSummariesToQuestions(summaries.map((s,i) => i ? s : { ...s, selectedIndex: 1 }), invitation)).rejects.toThrow('invalid-invitation-history');
        } finally { vi.unstubAllGlobals(); }
    });
    it('canonicalizes an in-memory presented question before a fresh retry', () => {
        const question = presentQuestion({ ...bankQuestion('cbse-question'), selectedIndex: 0 }, () => 0);
        service.setPendingRetry([question], { source: 'summary', type: 'all' });
        const retry = service.consumePendingRetry()!;
        expect(retry.questions[0].options).toEqual(['one', 'two', 'three']);
        expect(retry.questions[0].correctIndex).toBe(0); expect(retry.questions[0].selectedIndex).toBeNull();
        expect(retry.questions[0].optionOrder).toBeUndefined();
        expect(service.consumePendingRetry()).toBeNull();
    });
    it('reports canonical selected and correct indices for a presented question', async () => {
        const question = presentQuestion(bankQuestion('cbse-question'), () => 0);
        question.selectedIndex = question.correctIndex;
        state.records.set('questions/cbse-question', bankQuestion('cbse-question'));
        await service.flagQuestion(question, 'student');
        expect(state.records.get('questionFlags/cbse-question_student')).toMatchObject({ selectedIndex: 0, correctIndex: 0 });
    });
    it('keeps historical records intact when fetching learner history', async () => {
        const historical = { userId: 'student', quizType: 'quick', standard: '10', questions: [], timestamp: { toDate: () => new Date('2025-01-01') } };
        state.records.set('QuizResults/historical', historical);
        const history = await service.fetchUserQuizResults('student');
        expect(history[0]).toMatchObject({ id: 'historical', quizType: 'quick', standard: '10' });
        expect(history[0].board).toBeUndefined(); expect(history[0].timestamp).toEqual(new Date('2025-01-01'));
        expect(state.records.get('QuizResults/historical')).toBe(historical);
    });
});
