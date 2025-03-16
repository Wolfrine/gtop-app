import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, limit, getDocs } from '@angular/fire/firestore';
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

    // ✅ Fetch questions from a random chapter (no filter by board/standard)
    async fetchQuestionsFromRandomChapter(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.syllabusService.syllabus$.subscribe(async (syllabusData: SyllabusItem[]) => {
                try {
                    const filtered = syllabusData.filter(item => item.mcqCount > 0);

                    if (filtered.length === 0) {
                        reject('No syllabus entries with MCQs found!');
                        return;
                    }

                    // ✅ Random chapter selection
                    const randomIndex = Math.floor(Math.random() * filtered.length);
                    const selected = filtered[randomIndex];

                    const questionsCollection = collection(this.firestore, 'questions');
                    const fetchQuery = query(
                        questionsCollection,
                        where('board', '==', selected.board),
                        where('standard', '==', selected.standard),
                        where('subject', '==', selected.subject),
                        where('chapter', '==', selected.chapter),
                        limit(50)
                    );

                    const snapshot = await getDocs(fetchQuery);
                    let questions = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        selectedIndex: null
                    }));

                    // ✅ Shuffle client-side
                    questions = questions.sort(() => 0.5 - Math.random());

                    resolve(questions.slice(0, 10));

                } catch (error) {
                    reject(error);
                }
            });
        });
    }
}
