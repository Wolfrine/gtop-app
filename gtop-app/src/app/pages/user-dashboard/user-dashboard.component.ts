import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ManualQuizModalComponent } from '../../components/manual-quiz-modal/manual-quiz-modal.component';
import { AuthService } from '../../services/auth.service';
import { QuizService } from '../../services/quiz.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GuestAccessService } from '../../services/guest-access.service';

@Component({
    selector: 'app-user-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        RouterModule,
        MatIconModule,
        MatTooltipModule,
        MatSnackBarModule,
        AppCardDirective
    ],
    templateUrl: './user-dashboard.component.html',
    styleUrls: ['./user-dashboard.component.scss']
})
export class UserDashboardComponent implements OnInit {

    // User details
    userName: string = '';
    userStandard: string = '';
    userSubjects: string = '';

    isGuest = false;
    guestQuizCount = 0;
    guestQuota: number;
    guestLimitReached = false;
    remainingGuestQuizzes = 0;

    // Stats
    totalQuizzes: number = 0;
    accuracyPercent: number = 0;
    lastQuizScore: string = '0/0';
    recentSessions: Array<{ quizType: string; date: string; time: string; total: number; correct: number; accuracy: number; }> = [];

    private readonly guestLimitMessage = 'Guest preview limit reached. Create a free account to keep going.';
    private guestLimitNoticePending: boolean;
    private lastGuestCount = -1;

    constructor(
        private dialog: MatDialog,
        private router: Router,
        private authService: AuthService,
        private quizService: QuizService,
        private snackBar: MatSnackBar,
        private guestAccessService: GuestAccessService
    ) {
        this.guestQuota = this.guestAccessService.getMaxGuestQuizzes();
        this.guestLimitNoticePending = !!this.router.getCurrentNavigation()?.extras?.state?.['guestLimitReached'];
    }

    ngOnInit(): void {
        this.authService.getUser().subscribe(user => {
            if (!user) {
                return;
            }

            this.userName = user.displayName || '';
            this.userStandard = user.standard || '';
            this.userSubjects = user.board || '';

            this.isGuest = user.role === 'guest';
            if (this.isGuest) {
                const currentCount = Number(user.guestQuizCount ?? 0);
                const previousCount = this.lastGuestCount;
                if (currentCount !== this.lastGuestCount) {
                    this.guestQuizCount = currentCount;
                    this.remainingGuestQuizzes = Math.max(this.guestQuota - this.guestQuizCount, 0);
                    this.guestLimitReached = this.guestQuizCount >= this.guestQuota;
                    this.lastGuestCount = currentCount;

                    const shouldAnnounce = this.guestLimitReached && (previousCount < this.guestQuota);
                    if (shouldAnnounce || this.guestLimitNoticePending) {
                        this.triggerGuestLimitSnack();
                        this.guestLimitNoticePending = false;
                    }
                } else if (this.guestLimitNoticePending) {
                    this.triggerGuestLimitSnack();
                    this.guestLimitNoticePending = false;
                }
            } else {
                this.guestQuizCount = 0;
                this.remainingGuestQuizzes = 0;
                this.guestLimitReached = false;
                this.lastGuestCount = -1;
                this.guestLimitNoticePending = false;
            }

            // ✅ Fetch quiz results for the current user
            this.quizService.fetchUserQuizResults(user.uid).then(results => {
                if (results.length > 0) {
                    this.totalQuizzes = results.length;

                    const totalCorrect = results.reduce((sum, r) => sum + r.correctAnswers, 0);
                    const totalQuestions = results.reduce((sum, r) => sum + r.totalQuestions, 0);
                    this.accuracyPercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

                    const last = results[results.length - 1];
                    this.lastQuizScore = `${last.correctAnswers}/${last.totalQuestions}`;

                    // Recent 5 sessions (desc)
                    const byDate = results.slice().sort((a: any, b: any) => {
                        const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
                        const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
                        return bTime - aTime;
                    }).slice(0, 5);

                    this.recentSessions = byDate.map((r: any) => {
                        const dateObj = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
                        const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const time = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        const accuracy = r.totalQuestions ? Math.round((r.correctAnswers / r.totalQuestions) * 100) : 0;
                        return { quizType: r.quizType, date, time, total: r.totalQuestions, correct: r.correctAnswers, accuracy };
                    });
                } else {
                    this.totalQuizzes = 0;
                    this.accuracyPercent = 0;
                    this.lastQuizScore = '0/0';
                    this.recentSessions = [];
                }
            });
        });
    }

    startQuickQuiz() {
        if (!this.enforceGuestLimit()) {
            return;
        }
        this.router.navigate(['/quiz']);
    }

    openManualQuiz() {
        if (!this.enforceGuestLimit()) {
            return;
        }
        this.dialog.open(ManualQuizModalComponent, {
            width: '400px',
            data: {
                userStandard: this.userStandard,
                userSubjects: this.userSubjects
            }
        });
    }

    onRestrictedLink(event: Event) {
        this.enforceGuestLimit(event);
    }

    goToSignup() {
        this.router.navigate(['/profile-setup']);
    }

    private enforceGuestLimit(event?: Event): boolean {
        if (!this.isGuest || !this.guestLimitReached) {
            return true;
        }

        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        this.triggerGuestLimitSnack();
        return false;
    }

    private triggerGuestLimitSnack() {
        const snack = this.snackBar.open(this.guestLimitMessage, 'Sign up', {
            duration: 6000,
            panelClass: ['guest-limit-snackbar']
        });
        snack.onAction().subscribe(() => {
            this.router.navigate(['/profile-setup']);
        });
    }
}
