import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { Router, RouterModule } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-quiz-summary',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        AppCardDirective,
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
        private authService: AuthService,
        private router: Router
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
        if (this.totalQuestions === 0) return 0;
        return Math.round((this.correctAnswers / this.totalQuestions) * 100);
    }

    get hasIncorrectAnswers() {
        return this.questions.some(q => q.selectedIndex !== q.correctIndex);
    }

    async retryIncorrect() {
        if (!this.hasIncorrectAnswers) return;

        try {
            await this.quizService.prepareRetryFromExistingAttempt({
                questions: this.questions,
                incorrectOnly: true,
                context: {
                    source: 'summary',
                    type: 'incorrect',
                    metadata: this.buildQuizMetadata()
                }
            });

            this.router.navigate(['/quiz'], {
                queryParams: {
                    retry: 'summary',
                    scope: 'incorrect'
                }
            });
        } catch (error) {
            console.error('Error preparing retry from summary:', error);
        }
    }

    private buildQuizMetadata() {
        if (this.questions.length === 0) return undefined;
        const sample = this.questions[0];
        return {
            board: sample.board,
            standard: sample.standard,
            subject: sample.subject,
            chapter: sample.chapter
        };
    }
}
