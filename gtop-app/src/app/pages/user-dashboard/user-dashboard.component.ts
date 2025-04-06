import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ManualQuizModalComponent } from '../../components/manual-quiz-modal/manual-quiz-modal.component';
import { AuthService } from '../../services/auth.service';
import { QuizService } from '../../services/quiz.service';

@Component({
    selector: 'app-user-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        RouterModule
    ],
    templateUrl: './user-dashboard.component.html',
    styleUrls: ['./user-dashboard.component.scss']
})
export class UserDashboardComponent implements OnInit {

    // User details
    userName: string = '';
    userStandard: string = '';
    userSubjects: string = '';

    // Stats
    totalQuizzes: number = 0;
    accuracyPercent: number = 0;
    lastQuizScore: string = '0/0';

    constructor(
        private dialog: MatDialog,
        private router: Router,
        private authService: AuthService,
        private quizService: QuizService
    ) { }

    ngOnInit(): void {
        this.authService.getUser().subscribe(user => {
            if (user) {
                this.userName = user.displayName || '';
                this.userStandard = user.standard || '';
                this.userSubjects = user.board || '';

                // ✅ Fetch quiz results for the current user
                this.quizService.fetchUserQuizResults(user.uid).then(results => {
                    if (results.length > 0) {
                        this.totalQuizzes = results.length;

                        const totalCorrect = results.reduce((sum, r) => sum + r.correctAnswers, 0);
                        const totalQuestions = results.reduce((sum, r) => sum + r.totalQuestions, 0);
                        this.accuracyPercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

                        const last = results[results.length - 1];
                        this.lastQuizScore = `${last.correctAnswers}/${last.totalQuestions}`;
                    }
                });
            }
        });
    }

    startQuickQuiz() {
        this.router.navigate(['/quiz']);
    }

    openManualQuiz() {
        this.dialog.open(ManualQuizModalComponent, {
            width: '400px',
            data: {
                userStandard: this.userStandard,
                userSubjects: this.userSubjects
            }
        });
    }

}
