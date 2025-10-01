import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgChartsModule } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { ChartConfiguration } from 'chart.js';
import { Auth } from '@angular/fire/auth';
import { QuizService } from '../../services/quiz.service';
import { ActivatedRoute, Router } from '@angular/router';
import { QuizResultQuestion } from '../../services/quiz.service';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';

@Component({
    selector: 'app-reports-page',
    standalone: true,
    templateUrl: './reports-page.component.html',
    styleUrls: ['./reports-page.component.scss'],
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        NgChartsModule,
        AppCardDirective,
    ],
})
export class ReportsPageComponent implements OnInit {
    constructor(
        private quizService: QuizService,
        private auth: Auth,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    quizResults: any[] = [];
    hasResults = false;
    isLoading = true;
    lastUpdatedLabel = '';

    summaryCards: SummaryCard[] = this.createDefaultSummaryCards();

    accuracyChartData: ChartConfiguration<'line'>['data'] = this.createLineChartData([]);

    quizTypeChartData: ChartConfiguration<'pie'>['data'] = this.createQuizTypeChartData({
        quick: 0,
        custom: 0,
        live: 0,
        run: 0
    });

    lineChartOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#475569',
                    boxWidth: 12,
                    boxHeight: 12,
                    usePointStyle: true,
                }
            },
            tooltip: {
                backgroundColor: '#0f172a',
                padding: 12,
                titleFont: { weight: 600, size: 12 },
                bodyFont: { size: 12 },
                displayColors: false
            }
        },
        scales: {
            x: {
                ticks: { color: '#64748b' },
                grid: { display: false },
                border: { display: false }
            },
            y: {
                ticks: {
                    color: '#64748b',
                    callback: (value: string | number) => `${value}%`
                },
                grid: { color: 'rgba(148, 163, 184, 0.25)' },
                border: { display: false },
                suggestedMin: 0,
                suggestedMax: 100
            }
        }
    };

    pieChartOptions: ChartConfiguration<'pie'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    color: '#475569',
                    usePointStyle: true,
                    boxWidth: 12
                }
            },
            tooltip: {
                backgroundColor: '#0f172a',
                padding: 12,
                titleFont: { weight: 600, size: 12 },
                bodyFont: { size: 12 },
                usePointStyle: true
            }
        }
    };

    sessions: ReportSession[] = [];
    private currentUserId: string | null = null;

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            const userIdFromRoute = params['userId'];
            if (userIdFromRoute) {
                this.fetchAndProcessUserReports(userIdFromRoute);
                this.currentUserId = userIdFromRoute;
            } else {
                const user = this.auth.currentUser;
                if (user) {
                    this.fetchAndProcessUserReports(user.uid);
                    this.currentUserId = user.uid;
                }
            }
        });
    }

    async fetchAndProcessUserReports(userId: string) {
        this.isLoading = true;
        try {
            const results = await this.quizService.fetchUserQuizResults(userId);
            this.quizResults = results;
            this.processReportData(results);
        } catch (error) {
            console.error('Error fetching quiz reports:', error);
            this.quizResults = [];
            this.processReportData([]);
        } finally {
            this.isLoading = false;
        }
    }

    processReportData(results: any[]) {
        if (!results || results.length === 0) {
            this.hasResults = false;
            this.lastUpdatedLabel = '';
            this.summaryCards = this.createDefaultSummaryCards();
            this.accuracyChartData = this.createLineChartData([]);
            this.quizTypeChartData = this.createQuizTypeChartData({ quick: 0, custom: 0, live: 0, run: 0 });
            this.sessions = [];
            return;
        }

        this.hasResults = true;

        // ✅ Sort first by timestamp ascending for chart
        const sortedByDate = results.slice().sort((a, b) => {
            const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
            return aTime - bTime;
        });

        // ✅ Use sorted list for chart + stats
        const totalQuizzes = sortedByDate.length;
        const totalCorrect = sortedByDate.reduce((sum, r) => sum + (r.correctAnswers || 0), 0);
        const totalQuestions = sortedByDate.reduce((sum, r) => sum + (r.totalQuestions || 0), 0);
        const avgAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        const lastResult = sortedByDate[sortedByDate.length - 1];
        const lastScore = `${lastResult.correctAnswers}/${lastResult.totalQuestions}`;

        const sessionHistory = sortedByDate.slice().reverse().map(r => {
            const dateObj = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
            const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const time = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            return {
                id: r.id,
                board: r.board,
                standard: r.standard,
                subject: r.subject,
                chapter: r.chapter,
                quizType: r.quizType,
                date,
                time,
                total: r.totalQuestions,
                correct: r.correctAnswers,
                duration: r.duration || '—',
                questions: (r.questions || []) as QuizResultQuestion[],
                sessionId: r.sessionId || null
            };
        });

        const lastSession = sessionHistory[0];
        const previousSession = sessionHistory[1];
        const lastAccuracy = lastSession?.total ? Math.round((lastSession.correct / lastSession.total) * 100) : 0;
        const previousAccuracy = previousSession?.total ? Math.round((previousSession.correct / previousSession.total) * 100) : null;
        const accuracyDelta = previousAccuracy !== null ? lastAccuracy - previousAccuracy : null;

        const uniqueQuizDays = new Set(sortedByDate.map(result => {
            const timestamp = result.timestamp?.toDate ? result.timestamp.toDate() : new Date(result.timestamp);
            return timestamp.toDateString();
        })).size;

        this.lastUpdatedLabel = lastSession ? `${lastSession.date} at ${lastSession.time}` : '';

        this.summaryCards = [
            {
                label: 'Total Quizzes',
                value: totalQuizzes,
                sublabel: totalQuizzes === 1
                    ? 'Great start! Keep the streak going.'
                    : `Completed across ${uniqueQuizDays} day${uniqueQuizDays === 1 ? '' : 's'}.`,
                icon: 'quiz',
                accent: '#2563eb',
                accentBg: 'rgba(37, 99, 235, 0.12)'
            },
            {
                label: 'Average Accuracy',
                value: `${avgAccuracy}%`,
                sublabel: accuracyDelta === null
                    ? 'Accuracy is based on your quiz history.'
                    : accuracyDelta >= 0
                        ? 'Nice improvement since your last quiz.'
                        : 'Catch up on topics that need attention.',
                icon: 'monitoring',
                accent: accuracyDelta === null ? '#2563eb' : accuracyDelta >= 0 ? '#16a34a' : '#f97316',
                accentBg: accuracyDelta === null ? 'rgba(37, 99, 235, 0.12)' : accuracyDelta >= 0 ? 'rgba(22, 163, 74, 0.18)' : 'rgba(249, 115, 22, 0.18)',
                trend: accuracyDelta === null ? undefined : {
                    direction: accuracyDelta >= 0 ? 'up' : 'down',
                    text: `${accuracyDelta >= 0 ? '+' : ''}${accuracyDelta.toFixed(1)} pts vs last quiz`
                }
            },
            {
                label: 'Last Score',
                value: lastScore,
                sublabel: lastSession
                    ? `${lastSession.quizType || 'Quiz'} on ${lastSession.date} · ${lastSession.time}`
                    : 'Complete a session to record your score.',
                icon: 'military_tech',
                accent: lastAccuracy >= 70 ? '#16a34a' : lastAccuracy >= 40 ? '#2563eb' : '#f97316',
                accentBg: lastAccuracy >= 70 ? 'rgba(22, 163, 74, 0.18)' : lastAccuracy >= 40 ? 'rgba(37, 99, 235, 0.12)' : 'rgba(249, 115, 22, 0.18)'
            }
        ];

        // ✅ Accuracy Over Time
        const groupedByDate = new Map<string, { correct: number, total: number }>();
        sortedByDate.forEach(r => {
            const date = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const group = groupedByDate.get(date) || { correct: 0, total: 0 };
            group.correct += r.correctAnswers;
            group.total += r.totalQuestions;
            groupedByDate.set(date, group);
        });

        const accuracyLabels = Array.from(groupedByDate.keys());
        const accuracyData = accuracyLabels.map(date => {
            const g = groupedByDate.get(date)!;
            return Math.round((g.correct / g.total) * 100);
        });

        this.accuracyChartData = this.createLineChartData(accuracyData, accuracyLabels);

        // ✅ Quiz Type Distribution
        const quizTypeCounts: Record<'quick' | 'custom' | 'live' | 'run', number> = { quick: 0, custom: 0, live: 0, run: 0 };
        sortedByDate.forEach(r => {
            const type = (r.quizType || '').toLowerCase();
            switch (type) {
                case 'quick':
                case 'custom':
                case 'live':
                case 'run':
                    quizTypeCounts[type as keyof typeof quizTypeCounts]++;
                    break;
            }
        });

        this.quizTypeChartData = this.createQuizTypeChartData(quizTypeCounts);

        // ✅ Session History = DESCENDING
        this.sessions = sessionHistory;
    }

    hasIncorrectQuestions(session: ReportSession) {
        return session.questions?.some(question => !question.isCorrect);
    }

    openSession(session: ReportSession) {
        const userId = this.currentUserId || this.auth.currentUser?.uid || '';
        this.router.navigate(['/quiz-summary'], {
            state: {
                sessionId: session.id,
                userId,
                questionSummaries: session.questions,
                quizType: session.quizType,
                liveSessionId: session.sessionId
            },
            queryParams: {
                sessionId: session.id,
                userId
            }
        });
    }

    getAccuracyPercent(session: ReportSession) {
        if (!session.total) {
            return 0;
        }
        return Math.round((session.correct / session.total) * 100);
    }

    startNewQuiz() {
        this.router.navigate(['/quiz']);
    }

    private createDefaultSummaryCards(): SummaryCard[] {
        return [
            {
                label: 'Total Quizzes',
                value: '—',
                sublabel: 'Take your first quiz to unlock performance insights.',
                icon: 'quiz',
                accent: '#2563eb',
                accentBg: 'rgba(37, 99, 235, 0.12)'
            },
            {
                label: 'Average Accuracy',
                value: '—',
                sublabel: 'Accuracy data appears after your first quiz.',
                icon: 'monitoring',
                accent: '#2563eb',
                accentBg: 'rgba(37, 99, 235, 0.12)'
            },
            {
                label: 'Last Score',
                value: '—',
                sublabel: 'Complete a quiz to record your most recent score.',
                icon: 'military_tech',
                accent: '#2563eb',
                accentBg: 'rgba(37, 99, 235, 0.12)'
            }
        ];
    }

    private createLineChartData(data: number[], labels: string[] = []): ChartConfiguration<'line'>['data'] {
        return {
            labels,
            datasets: [
                {
                    data,
                    label: 'Accuracy %',
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                    fill: 'origin',
                    tension: 0.35,
                    pointRadius: data.length <= 1 ? 4 : 3,
                    pointBorderWidth: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#f8fafc'
                }
            ]
        };
    }

    private createQuizTypeChartData(counts: Record<'quick' | 'custom' | 'live' | 'run', number>): ChartConfiguration<'pie'>['data'] {
        return {
            labels: ['Quick', 'Custom', 'Live', 'Run'],
            datasets: [
                {
                    data: [counts.quick, counts.custom, counts.live, counts.run],
                    backgroundColor: ['#2563eb', '#22c55e', '#f97316', '#9333ea'],
                    hoverBackgroundColor: ['#1d4ed8', '#16a34a', '#ea580c', '#7e22ce'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }
            ]
        };
    }

    async retrySession(session: ReportSession, scope: 'incorrect' | 'all' = 'incorrect') {
        const questionSummaries = session.questions || [];
        const hasQuestions = questionSummaries.length > 0;
        const hasIncorrect = questionSummaries.some(q => !q.isCorrect);

        const shouldProceed = scope === 'all' ? hasQuestions : hasIncorrect;
        if (!shouldProceed) return;

        try {
            await this.quizService.prepareRetryFromResults({
                questionSummaries,
                incorrectOnly: scope === 'incorrect',
                context: {
                    source: 'reports',
                    type: scope,
                    originId: session.id,
                    metadata: {
                        board: session.board,
                        standard: session.standard,
                        subject: session.subject,
                        chapter: session.chapter
                    }
                }
            });

            this.router.navigate(['/quiz'], {
                queryParams: {
                    retry: 'reports',
                    scope,
                    sessionId: session.id
                }
            });
        } catch (error) {
            console.error('Error preparing retry from reports:', error);
        }
    }

}

interface ReportSession {
    id: string;
    board: string;
    standard: string;
    subject: string;
    chapter: string;
    quizType: string;
    date: string;
    time: string;
    total: number;
    correct: number;
    duration: string;
    questions: QuizResultQuestion[];
    sessionId: string | null;
}

interface SummaryCardTrend {
    direction: 'up' | 'down';
    text: string;
}

interface SummaryCard {
    label: string;
    value: string | number;
    sublabel: string;
    icon: string;
    accent: string;
    accentBg: string;
    trend?: SummaryCardTrend;
}
