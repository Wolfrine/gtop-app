import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, getDoc, getDocFromServer, setDoc, runTransaction, increment } from '@angular/fire/firestore';
import { SyllabusService, SyllabusItem } from './syllabus.service';
import { Timestamp } from '@angular/fire/firestore';
import { filter, firstValueFrom, timeout } from 'rxjs';
import { normalizePracticeBoard } from './practice-context';
import { canonicalIndex, canonicalQuestion, restorePresentation, presentQuestion, validOrder } from './question-presentation';
import { invitationHistory } from './practice-invite-session';
import { REVIEWED_PRACTICES } from './reviewed-practices';

export interface QuizCurriculumScope { board: string; standard: string; }

@Injectable({
    providedIn: 'root'
})
export class QuizService {
    private quizQuestions: any[] = [];
    private pendingRetry: {
        questions: any[];
        context: RetryContext;
    } | null = null;

    constructor(
        private firestore: Firestore,
        private syllabusService: SyllabusService
    ) { }

    setQuestions(questions: any[]) {
        this.quizQuestions = questions;
    }

    getQuestions() {
        return this.quizQuestions;
    }

    resetQuestions() {
        this.quizQuestions = [];
    }

    setPendingRetry(questions: any[], context: RetryContext) {
        if (!questions.length) {
            this.pendingRetry = null;
            return;
        }

        const sanitized = questions.map(q => ({
            ...canonicalQuestion(q),
            selectedIndex: null
        }));

        this.pendingRetry = {
            questions: sanitized,
            context
        };
    }

    consumePendingRetry(): { questions: any[]; context: RetryContext } | null {
        if (!this.pendingRetry) return null;
        const payload = this.pendingRetry;
        this.pendingRetry = null;
        return payload;
    }

    getPendingRetryContext(): RetryContext | null {
        return this.pendingRetry?.context || null;
    }

    /**
     * ✅ Quick Quiz → Random chapter
     */
    async fetchQuestionsFromRandomChapter(scope?: QuizCurriculumScope): Promise<any[]> {
        const board = scope ? normalizePracticeBoard(scope.board) : '';
        const standard = scope ? String(scope.standard ?? '').trim() : '';
        if (scope && (!board || !standard)) throw new Error('profile-required');
        const matchesScope = (item: SyllabusItem) => item.mcqCount > 0 && (!scope ||
            (normalizePracticeBoard(item.board) === board && String(item.standard).trim() === standard));

        // syllabus$ starts with a placeholder []; wait for an actual catalogue snapshot.
        const snapshot = await firstValueFrom(this.syllabusService.snapshots$.pipe(
            filter(snapshot => !snapshot.fromCache || snapshot.items.some(matchesScope)),
            timeout({ first: 15_000 })
        ));
        const eligible = snapshot.items.filter(matchesScope);
        if (!eligible.length) throw new Error(scope
            ? 'No chapters with MCQs found for this curriculum.'
            : 'No chapters with MCQs found.');

        const selected = eligible[Math.floor(Math.random() * eligible.length)];
        const questions = await this.fetchCurriculumQuestions(selected.board, String(selected.standard), [
            where('subject', '==', selected.subject), where('chapter', '==', selected.chapter)
        ]);
        return this.shuffleQuestions(questions).slice(0, 10);
    }

    private async fetchCurriculumQuestions(board: string, standard: string, constraints: any[]): Promise<any[]> {
        const normalized = normalizePracticeBoard(board);
        // Query each historical alias separately: another `in` would multiply the
        // custom subject/chapter disjunctions and can exceed Firestore's query limit.
        const boards = normalized === 'IGCSE' ? ['IGCSE', 'Cambridge IGCSE'] : [normalized];
        const snapshots = await Promise.all(boards.map(value => getDocs(query(
            collection(this.firestore, 'questions'), where('board', '==', value),
            where('standard', '==', standard), ...constraints
        ))));
        const questions = new Map<string, any>();
        snapshots.forEach(snapshot => snapshot.docs.forEach(item => questions.set(item.id, {
            ...item.data(), id: item.id, selectedIndex: null
        })));
        return [...questions.values()];
    }

    private shuffleQuestions(questions: any[]): any[] {
        const shuffled = [...questions];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * ✅ Custom Quiz → Based on selected subjects, chapters, count
     */
    async fetchCustomQuizQuestions(
        board: string,
        standard: string,
        selectedSubjects: string[],
        selectedChapters: string[],
        questionCount: number
    ): Promise<any[]> {
        const normalized = normalizePracticeBoard(board);
        const classValue = String(standard ?? '').trim();
        if (!normalized || !classValue) throw new Error('profile-required');
        const constraints = [];
        if (selectedSubjects.length) constraints.push(where('subject', 'in', selectedSubjects));
        if (selectedChapters.length) constraints.push(where('chapter', 'in', selectedChapters));
        const questions = await this.fetchCurriculumQuestions(normalized, classValue, constraints);
        return this.shuffleQuestions(questions).slice(0, questionCount);
    }

    /** Save canonical answer indices; optionOrder retains the attempt's display order. */
    async saveQuizResult(userId: string, resultData: {
        userName: string;
        board: string;
        standard: string;
        subject: string;
        chapter: string;
        quizType: string;
        sessionId?: string;
        attemptId?: string;
        invitation?: any;
        questions: {
            id: string;
            selectedIndex: number | null;
            correctIndex: number;
            optionOrder?: number[];
        }[];
    }): Promise<string> {
        if (!userId) throw new Error('missing-user-id');
        let invitation: any;
        if (resultData.invitation !== undefined) {
            const input = resultData.invitation;
            const seed = REVIEWED_PRACTICES.find(item => item.revision === input?.revision);
            const history = seed && await invitationHistory(input, seed, { presentQuestion, restorePresentation, validOrder, canonicalIndex });
            if (!history || input.attemptId !== resultData.attemptId || resultData.quizType !== 'custom' ||
                ['board', 'standard', 'subject', 'chapter'].some(key => (resultData as any)[key] !== input.scope[key]) ||
                resultData.questions.length !== 5 || resultData.questions.some((q, i) => q.id !== input.answers[i].questionId ||
                    q.selectedIndex !== input.answers[i].selectedIndex || q.correctIndex !== input.answers[i].correctIndex ||
                    JSON.stringify(q.optionOrder) !== JSON.stringify(input.answers[i].optionOrder))) throw new Error('invalid-invitation-result');
            // Explicit whitelist: private reviewed content and provenance, never arbitrary caller fields.
            invitation = { version: 1, attemptId: input.attemptId, entryType: input.entryType,
                ...(typeof input.parentAttemptId === 'string' ? { parentAttemptId: input.parentAttemptId } : {}),
                scope: { ...seed!.scope }, revision: seed!.revision, questionIds: [...seed!.questionIds], contentHashes: { ...seed!.contentHashes },
                snapshots: input.snapshots.map((q: any) => ({ id: q.id, board: q.board, standard: q.standard, subject: q.subject,
                    chapter: q.chapter, question: q.question, options: [...q.options], correctIndex: q.correctIndex, solutions: [...q.solutions], selectedIndex: null })),
                answers: input.answers.map((a: any) => ({ questionId: a.questionId, optionOrder: [...a.optionOrder], selectedIndex: a.selectedIndex, correctIndex: a.correctIndex })) };
            if (new TextEncoder().encode(JSON.stringify(invitation)).length > 256000) throw new Error('invitation-result-too-large');
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
        const quizId = resultData.attemptId
            ? `attempt-${encodeURIComponent(userId)}:${encodeURIComponent(resultData.attemptId)}`
            : doc(collection(this.firestore, 'QuizResults')).id;
        if (quizId.length > 1400) throw new Error('invalid-attempt-id');
        const isCorrect = (q: { selectedIndex: number | null; correctIndex: number }) =>
            Number.isInteger(q.selectedIndex) && Number(q.selectedIndex) >= 0 && q.selectedIndex === q.correctIndex;
        const totalQuestions = resultData.questions.length;
        const correctAnswers = resultData.questions.filter(isCorrect).length;
        const quizDoc: any = {
            userId, userName: resultData.userName, board: resultData.board,
            standard: resultData.standard, subject: resultData.subject, chapter: resultData.chapter,
            quizType: resultData.quizType, totalQuestions, correctAnswers,
            wrongAnswers: totalQuestions - correctAnswers,
            percentage: totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
            timestamp: Timestamp.now(),
            questions: resultData.questions.map(q => ({
                questionId: q.id, selectedIndex: q.selectedIndex, correctIndex: q.correctIndex,
                isCorrect: isCorrect(q), ...(q.optionOrder ? { optionOrder: [...q.optionOrder] } : {})
            }))
        };
        if (resultData.sessionId) quizDoc.sessionId = resultData.sessionId;
        if (resultData.attemptId) quizDoc.attemptId = resultData.attemptId;
        if (invitation) {
            quizDoc.invitation = invitation;
            quizDoc.source = { kind: 'invitation', revision: invitation.revision, entryType: invitation.entryType };
        }
        const resultRef = doc(this.firestore, `QuizResults/${quizId}`);
        const equal = (a: any, b: any): boolean => {
            if (a === b) return true;
            if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
            if (Array.isArray(a) !== Array.isArray(b)) return false;
            const keys = Object.keys(a);
            return keys.length === Object.keys(b).length && keys.every(key =>
                Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]));
        };
        const matches = (existing: any) => Object.keys(quizDoc).filter(key => key !== 'timestamp')
            .every(key => equal(existing[key], quizDoc[key]));

        if (resultData.attemptId) {
            // Existing attempts are immutable, including admin retries. The current
            // learner rules deny reads of missing results, so only that denial may
            // proceed to create; no security rule change is needed.
            let existing;
            try { existing = await getDocFromServer(resultRef); }
            catch (error: any) { if (error?.code !== 'permission-denied') throw error; }
            if (existing?.exists()) {
                if (!matches(existing.data())) throw new Error('attempt-id-conflict');
                return quizId;
            }
        }
        try {
            await setDoc(resultRef, quizDoc);
        } catch (error) {
            // A lost acknowledgement or concurrent retry may already have committed.
            // Verify on the server, never a locally pending Firestore write.
            if (resultData.attemptId) {
                try {
                    const existing = await getDocFromServer(resultRef);
                    if (existing.exists() && matches(existing.data())) return quizId;
                } catch { /* Preserve the original save failure for visible retry. */ }
            }
            throw error;
        }
        return quizId;
    }

    //*** 🚀 Future → Fetch Quiz Results
    async fetchUserQuizResults(userId: string): Promise<any[]> {
        try {
            const quizResultsRef = collection(this.firestore, 'QuizResults');
            const fetchQuery = query(
                quizResultsRef,
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(fetchQuery);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data['timestamp']?.toDate?.() || null
                };
            });
        } catch (error) {
            console.error('❌ Error fetching quiz results:', error);
            return [];
        }
    }

    // Live Leaderboard: aggregate results directly from the live session data so every
    // participant sees a consistent scoreboard ordered by score then total time taken.
    async fetchLiveResultsForSession(sessionId: string): Promise<any[]> {
        try {
            const sessionRef = doc(this.firestore, 'LiveSessions', sessionId);
            const sessionSnap = await getDoc(sessionRef);
            if (!sessionSnap.exists()) {
                return [];
            }

            const sessionData: any = sessionSnap.data();
            const questionIds: string[] = Array.isArray(sessionData?.questionIds) ? sessionData.questionIds : [];
            const totalQuestions = questionIds.length;
            const perQuestionSeconds = Math.max(1, Number(sessionData?.perQuestionSeconds || 20));

            const questions = await this.fetchQuestionsByIds(questionIds);
            const correctIndexByOrder = questionIds.map(id => {
                const question = questions.find(q => q.id === id);
                return typeof question?.correctIndex === 'number' ? question.correctIndex : null;
            });

            const participantsCol = collection(this.firestore, `LiveSessions/${sessionId}/participants`);
            const participantsSnap = await getDocs(participantsCol);

            type LeaderboardAccumulator = {
                id: string;
                userName: string;
                correct: number;
                answered: number;
                totalTimeMs: number;
            };

            const stats = new Map<string, LeaderboardAccumulator>();
            const ensureEntry = (uid: string, displayName?: string | null) => {
                const key = uid || 'unknown';
                if (!stats.has(key)) {
                    stats.set(key, {
                        id: key,
                        userName: displayName || 'Anonymous',
                        correct: 0,
                        answered: 0,
                        totalTimeMs: 0
                    });
                }
                const entry = stats.get(key)!;
                if (displayName && entry.userName === 'Anonymous') {
                    entry.userName = displayName;
                }
                return entry;
            };

            participantsSnap.docs.forEach(docSnap => {
                const data: any = docSnap.data();
                ensureEntry(docSnap.id, data?.displayName);
            });

            const answerPromises = questionIds.map((_, index) => {
                const answersCol = collection(this.firestore, `LiveSessions/${sessionId}/answers/${String(index)}/items`);
                return getDocs(answersCol).then(snap => snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any)));
            });

            const answersByIndex = await Promise.all(answerPromises);

            answersByIndex.forEach((answers, index) => {
                const correctIndex = correctIndexByOrder[index];
                answers.forEach(answer => {
                    const uid = answer?.uid || answer?.id || 'unknown';
                    const record = ensureEntry(uid, answer?.displayName);
                    const selectedIndex = typeof answer?.selectedIndex === 'number' ? answer.selectedIndex : null;
                    if (typeof correctIndex === 'number' && selectedIndex === correctIndex) {
                        record.correct += 1;
                    }
                    record.answered += 1;
                    const responseMs = Number(answer?.responseMs);
                    const safeResponse = Number.isFinite(responseMs) ? Math.max(0, responseMs) : perQuestionSeconds * 1000;
                    record.totalTimeMs += safeResponse;
                });
            });

            const penaltyPerQuestion = perQuestionSeconds * 1000;
            const rows = Array.from(stats.values()).map(row => {
                const unanswered = Math.max(0, totalQuestions - row.answered);
                const totalTimeWithPenalty = row.totalTimeMs + unanswered * penaltyPerQuestion;
                const percentage = totalQuestions > 0 ? Math.round((row.correct / totalQuestions) * 100) : 0;
                return {
                    id: row.id,
                    userName: row.userName,
                    totalQuestions,
                    correctAnswers: row.correct,
                    percentage,
                    totalTimeMs: totalTimeWithPenalty
                };
            });

            return rows.sort((a, b) => {
                if (b.correctAnswers !== a.correctAnswers) {
                    return b.correctAnswers - a.correctAnswers;
                }
                if (a.totalTimeMs !== b.totalTimeMs) {
                    return a.totalTimeMs - b.totalTimeMs;
                }
                return a.userName.localeCompare(b.userName);
            });
        } catch (e) {
            console.error('Error fetching live session results:', e);
            return [];
        }
    }

    async prepareRetryFromExistingAttempt(options: {
        questions: any[];
        incorrectOnly?: boolean;
        context: RetryContext;
    }) {
        const { questions, incorrectOnly = false, context } = options;
        const sourceQuestions = incorrectOnly
            ? questions.filter(q => q.selectedIndex !== q.correctIndex)
            : questions;

        this.setPendingRetry(sourceQuestions, context);
    }

    async prepareRetryFromResults(options: {
        questionSummaries: QuizResultQuestion[];
        incorrectOnly?: boolean;
        context: RetryContext;
    }) {
        const { questionSummaries, incorrectOnly = false, context } = options;
        const filteredSummaries = incorrectOnly
            ? questionSummaries.filter(q => !q.isCorrect)
            : questionSummaries;

        if (filteredSummaries.length === 0) {
            this.pendingRetry = null;
            return;
        }

        const questionIds = filteredSummaries.map(q => q.questionId).filter(Boolean);
        const questions = await this.fetchQuestionsByIds(questionIds);
        this.setPendingRetry(questions, context);
    }

    async flagQuestion(question: any, userId: string): Promise<void> {
        if (!question?.id) {
            throw new Error('missing-question-id');
        }

        if (!userId) {
            throw new Error('missing-user-id');
        }

        const flagDocId = `${question.id}_${userId}`;
        const flagDocRef = doc(this.firestore, `questionFlags/${flagDocId}`);
        const questionRef = doc(this.firestore, `questions/${question.id}`);

        const payload = {
            questionId: question.id,
            userId,
            flaggedAt: Timestamp.now(),
            board: question.board ?? null,
            standard: question.standard ?? null,
            subject: question.subject ?? null,
            chapter: question.chapter ?? null,
            correctIndex: canonicalIndex(question, question.correctIndex),
            selectedIndex: canonicalIndex(question, question.selectedIndex)
        };

        // A single commit keeps report creation and its count consistent, including retries.
        await runTransaction(this.firestore, async transaction => {
            const existing = await transaction.get(flagDocRef);
            if (existing.exists()) {
                const error: any = new Error('already-flagged');
                error.code = 'already-flagged';
                throw error;
            }
            transaction.set(flagDocRef, payload);
            transaction.update(questionRef, {
                flagCount: increment(1),
                lastFlaggedAt: Timestamp.now()
            });
        });
    }

    private async fetchQuestionsByIds(ids: string[]): Promise<any[]> {
        if (ids.length === 0) return [];

        const uniqueIds = Array.from(new Set(ids));
        const chunks: string[][] = [];
        const chunkSize = 10;

        for (let i = 0; i < uniqueIds.length; i += chunkSize) {
            chunks.push(uniqueIds.slice(i, i + chunkSize));
        }

        const fetched: Record<string, any> = {};

        for (const chunk of chunks) {
            if (chunk.length === 1) {
                const docRef = doc(this.firestore, 'questions', chunk[0]);
                const snapshot = await getDoc(docRef);
                if (snapshot.exists()) {
                    fetched[chunk[0]] = {
                        id: snapshot.id,
                        ...snapshot.data()
                    };
                }
            } else {
                const questionsCollection = collection(this.firestore, 'questions');
                const fetchQuery = query(questionsCollection, where('__name__', 'in', chunk));
                const snapshot = await getDocs(fetchQuery);
                snapshot.docs.forEach(docSnap => {
                    fetched[docSnap.id] = {
                        id: docSnap.id,
                        ...docSnap.data()
                    };
                });
            }
        }

        return ids
            .map(id => fetched[id])
            .filter(question => !!question)
            .map(question => ({
                ...question,
                selectedIndex: null
            }));
    }

    /**
     * Public helper to expand stored summaries back to full question docs
     * and merge selected/correct indices for review views.
     */
    async expandSummariesToQuestions(summaries: QuizResultQuestion[], invitation?: any): Promise<any[]> {
        if (invitation !== undefined) {
            const seed = REVIEWED_PRACTICES.find(item => item.revision === invitation?.revision);
            const restored = await invitationHistory(invitation, seed, { presentQuestion, restorePresentation, validOrder, canonicalIndex });
            if (!restored || summaries.length !== 5 || summaries.some((s, i) => s.questionId !== invitation.answers[i].questionId ||
                s.selectedIndex !== invitation.answers[i].selectedIndex || s.correctIndex !== invitation.answers[i].correctIndex ||
                JSON.stringify(s.optionOrder) !== JSON.stringify(invitation.answers[i].optionOrder))) throw new Error('invalid-invitation-history');
            return restored;
        }
        const ids = summaries.map(s => s.questionId).filter(Boolean);
        const full = await this.fetchQuestionsByIds(ids);
        const byId = new Map<string, QuizResultQuestion>(summaries.map(s => [s.questionId, s]));
        return full.map(q => {
            const s = byId.get(q.id);
            if (s?.optionOrder) return restorePresentation(q, s.optionOrder, s.selectedIndex, s.correctIndex);
            return {
                ...q,
                selectedIndex: s?.selectedIndex ?? q.selectedIndex ?? null,
                correctIndex: s?.correctIndex ?? q.correctIndex
            };
        });
    }
}

export interface RetryContext {
    source: 'summary' | 'reports';
    type: 'incorrect' | 'all';
    originId?: string;
    metadata?: {
        board?: string;
        standard?: string;
        subject?: string;
        chapter?: string;
    };
}

export interface QuizResultQuestion {
    questionId: string;
    selectedIndex: number | null;
    correctIndex: number;
    isCorrect: boolean;
    optionOrder?: number[];
}
