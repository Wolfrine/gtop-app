import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { RouterModule } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

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
export class QuizSummaryComponent implements OnInit, OnDestroy {
    questions: any[] = [];
    optionLabels = ['A)', 'B)', 'C)', 'D)'];
    private userSub!: Subscription;
    private saved = false;

    constructor(
        private quizService: QuizService,
        private authService: AuthService
    ) { }

    ngOnInit() {
        this.questions = this.quizService.getQuestions();

        this.userSub = this.authService.getUser().subscribe(user => {
            if (user && this.questions.length > 0 && !this.saved) {
                const sample = this.questions[0];

                this.quizService.saveQuizResult(user.uid, {
                    userName: user.displayName || 'Unknown',
                    board: sample.board,
                    standard: sample.standard,
                    subject: sample.subject,
                    chapter: sample.chapter,
                    quizType: 'quick', // Make dynamic if needed
                    questions: this.questions.map(q => ({
                        id: q.id,
                        selectedIndex: q.selectedIndex,
                        correctIndex: q.correctIndex
                    }))
                });

                this.saved = true;
            }
        });
    }

    ngOnDestroy() {
        if (this.userSub) this.userSub.unsubscribe();
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
