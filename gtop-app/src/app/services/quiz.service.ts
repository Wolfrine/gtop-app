import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, onSnapshot, doc, getDoc } from '@angular/fire/firestore';
import { SyllabusService, SyllabusItem } from './syllabus.service';
import { setDoc } from '@angular/fire/firestore';
import { Timestamp } from '@angular/fire/firestore';

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
            ...q,
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
    async fetchQuestionsFromRandomChapter(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const syllabusSub = this.syllabusService.syllabus$.subscribe((syllabusData: SyllabusItem[]) => {
                try {
                    const filtered = syllabusData.filter(item => item.mcqCount > 0);
                    if (filtered.length === 0) {
                        syllabusSub.unsubscribe();
                        reject('No chapters with MCQs found.');
                        return;
                    }

                    const randomIndex = Math.floor(Math.random() * filtered.length);
                    const selected = filtered[randomIndex];

                    const questionsCollection = collection(this.firestore, 'questions');
                    const fetchQuery = query(
                        questionsCollection,
                        where('board', '==', selected.board),
                        where('standard', '==', selected.standard),
                        where('subject', '==', selected.subject),
                        where('chapter', '==', selected.chapter)
                    );

                    const unsubscribe = onSnapshot(fetchQuery, (snapshot) => {
                        let questions = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            selectedIndex: null
                        }));

                        unsubscribe(); // ✅ Immediately unsubscribe Firestore listener
                        syllabusSub.unsubscribe(); // ✅ Unsubscribe syllabus listener too

                        // Shuffle + pick 10
                        questions = questions.sort(() => 0.5 - Math.random());
                        resolve(questions.slice(0, 10));
                    }, (error) => {
                        unsubscribe();
                        syllabusSub.unsubscribe();
                        reject(error);
                    });

                } catch (error) {
                    syllabusSub.unsubscribe();
                    reject(error);
                }
            });
        });
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
        return new Promise((resolve, reject) => {
            try {
                const questionsCollection = collection(this.firestore, 'questions');

                let fetchQuery = query(
                    questionsCollection,
                    where('board', '==', board),
                    where('standard', '==', standard)
                );

                if (selectedSubjects.length > 0) {
                    fetchQuery = query(fetchQuery, where('subject', 'in', selectedSubjects));
                }

                if (selectedChapters.length > 0) {
                    fetchQuery = query(fetchQuery, where('chapter', 'in', selectedChapters));
                }

                const unsubscribe = onSnapshot(fetchQuery, (snapshot) => {
                    let questions = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        selectedIndex: null
                    }));

                    unsubscribe(); // 🔄 Detach after one-time fetch

                    // 🔀 Shuffle & limit
                    questions = questions.sort(() => 0.5 - Math.random());
                    resolve(questions.slice(0, questionCount));
                }, (error) => {
                    unsubscribe();
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }



    /**
     * 🚀 Future → Save Quiz Result
     */
    async saveQuizResult(userId: string, resultData: {
        userName: string;
        board: string;
        standard: string;
        subject: string;
        chapter: string;
        quizType: string;
        sessionId?: string;
        questions: {
            id: string;
            selectedIndex: number;
            correctIndex: number;
        }[];
    }) {
        try {
            const quizId = doc(collection(this.firestore, 'QuizResults')).id; // auto-generated ID

            const totalQuestions = resultData.questions.length;
            const correctAnswers = resultData.questions.filter(q => q.selectedIndex === q.correctIndex).length;
            const wrongAnswers = totalQuestions - correctAnswers;
            const percentage = Math.round((correctAnswers / totalQuestions) * 100);

            const quizDoc: any = {
                userId,
                userName: resultData.userName,
                standard: resultData.standard,
                subject: resultData.subject,
                chapter: resultData.chapter,
                quizType: resultData.quizType,
                totalQuestions,
                correctAnswers,
                wrongAnswers,
                percentage,
                timestamp: Timestamp.now(),
                questions: resultData.questions.map(q => ({
                    questionId: q.id,
                    selectedIndex: q.selectedIndex,
                    correctIndex: q.correctIndex,
                    isCorrect: q.selectedIndex === q.correctIndex
                }))
            };
            if (resultData.sessionId) {
                quizDoc.sessionId = resultData.sessionId;
            }

            const resultRef = doc(this.firestore, `QuizResults/${quizId}`);
            await setDoc(resultRef, quizDoc);

            console.log('✅ Quiz result saved:', quizId);
        } catch (error) {
            console.error('❌ Error saving quiz result:', error);
        }
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
    async expandSummariesToQuestions(summaries: QuizResultQuestion[]): Promise<any[]> {
        const ids = summaries.map(s => s.questionId).filter(Boolean);
        const full = await this.fetchQuestionsByIds(ids);
        const byId = new Map<string, QuizResultQuestion>(summaries.map(s => [s.questionId, s]));
        return full.map(q => {
            const s = byId.get(q.id);
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
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
}
