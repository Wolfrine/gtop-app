import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, onSnapshot } from '@angular/fire/firestore';
import { SyllabusService, SyllabusItem } from './syllabus.service';

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
    async saveQuizResult(userId: string, resultData: any) {
        // Stub - Will integrate post-MVP
    }
}
