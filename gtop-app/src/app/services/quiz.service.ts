import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class QuizService {
    private quizQuestions: any[] = [];

    setQuestions(questions: any[]) {
        this.quizQuestions = questions;
    }

    getQuestions() {
        return this.quizQuestions;
    }

    resetQuestions() {
        this.quizQuestions = [];
    }
}
