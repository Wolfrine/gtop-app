import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { RouterModule } from '@angular/router';
import { QuizService } from '../../services/quiz.service';

@Component({
    selector: 'app-quiz-summary',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatExpansionModule,
        RouterModule
    ],
    templateUrl: './quiz-summary.component.html',
    styleUrls: ['./quiz-summary.component.scss']
})
export class QuizSummaryComponent {

    // Dummy quiz result data (later will be passed from quiz page)
    questions = [
        {
            question: 'What is the difference between 4.5 and 1.2?',
            options: ['3.3', '3.5', '3.0', '4.7'],
            correctIndex: 0,
            selectedIndex: 1,
            solutions: [
                'Option A is correct because 4.5 – 1.2 = 3.3.',
                'Option B is incorrect because 4.5 – 1.2 ≠ 3.5.',
                'Option C is incorrect because 4.5 – 1.2 ≠ 3.0.',
                'Option D is incorrect because 4.5 – 1.2 ≠ 4.7.'
            ]
        }
    ];

    constructor(private quizService: QuizService) {
        this.questions = this.quizService.getQuestions(); // Get quiz data
    }

    get totalQuestions() {
        return this.questions.length;
    }

    get correctAnswers() {
        return this.questions.filter(q => q.selectedIndex === q.correctIndex).length;
    }

    get accuracyPercent() {
        return Math.round((this.correctAnswers / this.totalQuestions) * 100);
    }
}