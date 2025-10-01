import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { MatIconModule } from '@angular/material/icon';
import { LiveSummaryComponent } from '../live/live-summary/live-summary.component';

@Component({
    selector: 'app-quiz-summary',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        AppCardDirective,
        MatButtonModule,
        MatExpansionModule,
        RouterModule,
        NgChartsModule,
        MatIconModule,
        LiveSummaryComponent
    ],
    templateUrl: './quiz-summary.component.html',
    styleUrls: ['./quiz-summary.component.scss']
})
export class QuizSummaryComponent implements OnInit, OnDestroy {
    questions: any[] = [];
    optionLabels = ['A)', 'B)', 'C)', 'D)'];
    private userSub!: Subscription;
    private saved = false;
    fromLive = false;
    liveSessionId: string | null = null;
    liveMode: 'live' | 'run' | null = null;

    // UI state
    incorrectOnly = false;

    // Charts
    doughnutData: ChartConfiguration<'doughnut'>['data'] = {
        labels: ['Correct', 'Incorrect'],
        datasets: [{ data: [0, 0], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 2, borderColor: '#fff' }]
    };
    doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: { legend: { display: false } }
    };

    constructor(
        private quizService: QuizService,
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit() {
        const navState: any = (this.router.getCurrentNavigation()?.extras?.state) || (history.state || {});
        const summaries = navState?.questionSummaries;
        const navSession = navState?.session;
        this.fromLive = !!navState?.fromLive;
        this.liveSessionId = navState?.liveSessionId || navState?.sessionId || null;
        this.liveMode = navState?.liveMode || (this.fromLive ? 'live' : null);
        const navQuizType = (navState?.quizType || '').toLowerCase();
        if (navQuizType === 'run') {
            this.fromLive = true;
            this.liveMode = 'run';
        } else if (navQuizType === 'live') {
            this.fromLive = true;
            this.liveMode = 'live';
        }

        if (Array.isArray(summaries) && summaries.length) {
            // Expand summaries to full questions
            this.quizService.expandSummariesToQuestions(summaries).then(qs => {
                this.questions = qs;
                this.updateChart();
            });
            this.saved = true; // avoid re-saving when viewing past session
        } else if (navSession?.questions?.length) {
            // Fallback if a whole session object was provided
            this.quizService.expandSummariesToQuestions(navSession.questions).then(qs => {
                this.questions = qs;
                this.updateChart();
            });
            this.saved = true;
            const type = (navSession.quizType || '').toLowerCase();
            if (type === 'run') {
                this.fromLive = true;
                this.liveMode = 'run';
            } else if (type === 'live') {
                this.fromLive = true;
                this.liveMode = 'live';
            }
        } else {
            // Deep link fallback using query params
            this.route.queryParams.subscribe(async params => {
                const sessionId = params['sessionId'];
                const userId = params['userId'];
                if (sessionId && userId) {
                    const results = await this.quizService.fetchUserQuizResults(userId);
                    const session = results.find(r => r.id === sessionId);
                    if (session?.questions?.length) {
                        const qs = await this.quizService.expandSummariesToQuestions(session.questions);
                        this.questions = qs;
                        const type = (session.quizType || '').toLowerCase();
                        if (type === 'run') {
                            this.fromLive = true;
                            this.liveMode = 'run';
                            this.liveSessionId = session.sessionId || sessionId;
                        } else if (type === 'live') {
                            this.fromLive = true;
                            this.liveMode = 'live';
                            this.liveSessionId = session.sessionId || sessionId;
                        }
                        this.updateChart();
                        this.saved = true;
                        return;
                    }
                }
                // Default: current attempt questions
                this.questions = this.quizService.getQuestions();
                this.updateChart();
            });
        }

        this.userSub = this.authService.getUser().subscribe(user => {
            if (user && this.questions.length > 0 && !this.saved) {
                const sample = this.questions[0];

                this.quizService.saveQuizResult(user.uid, {
                    userName: user.displayName || 'Unknown',
                    board: sample.board,
                    standard: sample.standard,
                    subject: sample.subject,
                    chapter: sample.chapter,
                    quizType: this.fromLive ? (this.liveMode === 'run' ? 'run' : 'live') : 'quick',
                    sessionId: this.fromLive ? this.liveSessionId || undefined : undefined,
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

    get filteredQuestions() {
        return this.incorrectOnly
            ? this.questions.filter(q => q.selectedIndex !== q.correctIndex)
            : this.questions;
    }

    toggleIncorrectOnly() {
        this.incorrectOnly = !this.incorrectOnly;
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

    async retryAll() {
        try {
            await this.quizService.prepareRetryFromExistingAttempt({
                questions: this.questions,
                incorrectOnly: false,
                context: {
                    source: 'summary',
                    type: 'all',
                    metadata: this.buildQuizMetadata()
                }
            });

            this.router.navigate(['/quiz'], {
                queryParams: { retry: 'summary', scope: 'all' }
            });
        } catch (error) {
            console.error('Error preparing retry all from summary:', error);
        }
    }

    private updateChart() {
        const correct = this.correctAnswers;
        const incorrect = Math.max(this.totalQuestions - correct, 0);
        this.doughnutData = {
            labels: ['Correct', 'Incorrect'],
            datasets: [{ data: [correct, incorrect], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 2, borderColor: '#fff' }]
        };
    }

    buildQuizMetadata() {
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
