import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, onSnapshot } from '@angular/fire/firestore';
import { SyllabusService, SyllabusItem } from './syllabus.service';
import { doc, setDoc } from '@angular/fire/firestore';
import { Timestamp } from '@angular/fire/firestore';

@Injectable({
    providedIn: 'root'
})
export class QuizService {
    private quizQuestions: any[] = [];

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

            const quizDoc = {
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

}
