import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { combineLatest, distinctUntilChanged, map, Subscription } from 'rxjs';
import { QuizResultPage, QuizService } from '../../services/quiz.service';
import { StudentSubmissionsService, SubmissionResult } from '../../services/student-submissions.service';
import { PaperActivity, QuizActivity, Score, SubjectProgress, paperActivity, percent, quizActivity, subjectProgress, totalScore, trendDays } from './report-data';

@Component({
    selector: 'app-reports-page',
    standalone: true,
    templateUrl: './reports-page.component.html',
    styleUrls: ['./reports-page.component.scss'],
    imports: [CommonModule, MatIconModule, RouterLink, NgChartsModule],
})
export class ReportsPageComponent implements OnInit, OnDestroy {
    private readonly auth = inject(Auth);
    private readonly quizService = inject(QuizService);
    private readonly papersApi = inject(StudentSubmissionsService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private subscription?: Subscription;
    private request = new AbortController();
    private paperRequest?: AbortController;
    private downloadUrl?: string;

    quizzes: QuizActivity[] = [];
    papers: PaperActivity[] = [];
    subjects: SubjectProgress[] = [];
    quizScore: Score | null = null;
    paperScore: Score | null = null;
    quizCount = 0;
    paperCount = 0;
    quizVisible = 4;
    paperVisible = 3;
    quizCursor?: QuizResultPage['nextCursor'];
    paperCursor?: string | null;
    quizLoading = true;
    paperLoading = false;
    quizError = false;
    paperError = false;
    otherStudent = false;
    showPapers = false;
    userId = '';
    quizId = '';
    paperId = '';
    paperResult?: SubmissionResult;
    feedbackLoading = false;
    feedbackError = false;
    pdfLoading = false;
    pdfError = false;
    retrying = false;
    retryError = false;
    trend: 'quiz' | 'written' = 'quiz';
    quizDays: ReturnType<typeof trendDays> = [];
    paperDays: ReturnType<typeof trendDays> = [];

    readonly percent = percent;
    chartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
    readonly chartOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: point => point.formattedValue + '%' } },
        },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 5, maxRotation: 0, color: '#4c6258' } },
            y: {
                min: 0, max: 100, border: { display: false }, grid: { color: '#e1e8e1' },
                ticks: { stepSize: 50, color: '#4c6258', callback: value => value + '%' },
            },
        },
    };

    ngOnInit(): void {
        this.subscription = combineLatest([authState(this.auth), this.route.queryParamMap]).pipe(
            map(([account, params]) => {
                const uid = account?.uid ?? '';
                const target = uid ? params.get('userId') || uid : '';
                return { uid, target, personal: !!account && !account.isAnonymous && target === uid };
            }),
            distinctUntilChanged((a, b) => a.uid === b.uid && a.target === b.target && a.personal === b.personal),
        ).subscribe(({ uid, target, personal }) => {
            this.reset();
            this.userId = target;
            this.otherStudent = target !== uid;
            this.showPapers = personal;
            this.quizLoading = !!target;
            if (target) void this.loadQuizzes();
            if (personal) void this.loadPapers();
        });
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this.reset();
    }

    private reset(): void {
        this.request.abort();
        this.request = new AbortController();
        this.closePaper();
        this.quizzes = [];
        this.papers = [];
        this.quizCursor = undefined;
        this.paperCursor = undefined;
        this.quizCount = this.paperCount = 0;
        this.quizVisible = 4;
        this.paperVisible = 3;
        this.quizScore = this.paperScore = null;
        this.quizDays = this.paperDays = [];
        this.trend = 'quiz';
        this.chartData = { labels: [], datasets: [] };
        this.subjects = [];
        this.quizError = this.paperError = this.paperLoading = false;
        this.quizId = '';
        this.retrying = this.retryError = false;
    }

    async loadQuizzes(older = false): Promise<void> {
        if (!this.userId || (older && (!this.quizCursor || this.quizLoading))) return;
        const signal = this.request.signal;
        this.quizLoading = true;
        this.quizError = false;
        try {
            const page = await this.quizService.fetchRecentQuizResults(this.userId, older ? this.quizCursor : undefined);
            if (signal.aborted) return;
            const rows = page.results.map(quizActivity);
            this.quizzes = older ? this.appendPage(this.quizzes, rows) : rows;
            this.quizCursor = page.nextCursor;
            if (older) this.quizVisible += 6;
            if (!older) {
                this.quizCount = rows.length;
                this.quizScore = totalScore(rows);
                this.quizDays = trendDays(rows);
                this.refreshOverview();
            }
        } catch {
            if (!signal.aborted) this.quizError = true;
        } finally {
            if (!signal.aborted) this.quizLoading = false;
        }
    }

    async loadPapers(older = false): Promise<void> {
        if (!this.showPapers || this.paperLoading || (older && !this.paperCursor)) return;
        const signal = this.request.signal;
        this.paperLoading = true;
        this.paperError = false;
        try {
            const page = await this.papersApi.releasedScores(signal, older ? this.paperCursor! : undefined);
            if (signal.aborted) return;
            const rows = page.papers.map(paperActivity);
            this.papers = older ? this.appendPage(this.papers, rows) : rows;
            this.paperCursor = page.nextCursor;
            if (older) this.paperVisible += 6;
            if (!older) {
                this.paperCount = rows.length;
                this.paperScore = totalScore(rows);
                this.paperDays = trendDays(rows);
                this.refreshOverview();
            }
        } catch {
            if (!signal.aborted) this.paperError = true;
        } finally {
            if (!signal.aborted) this.paperLoading = false;
        }
    }

    private appendPage<T extends { id: string }>(current: T[], page: T[]): T[] {
        const ids = new Set(current.map(row => row.id));
        return [...current, ...page.filter(row => !ids.has(row.id))];
    }

    moreQuizzes(): void {
        if (this.quizVisible < this.quizzes.length) this.quizVisible += 6;
        else void this.loadQuizzes(true);
    }

    morePapers(): void {
        if (this.paperVisible < this.papers.length) this.paperVisible += 6;
        else void this.loadPapers(true);
    }

    private refreshOverview(): void {
        this.subjects = subjectProgress(this.quizzes.slice(0, this.quizCount), this.papers.slice(0, this.paperCount));
        if (this.days.length < 2) {
            if (this.quizDays.length >= 2 || (this.quizDays.length && !this.paperDays.length)) this.trend = 'quiz';
            else if (this.paperDays.length) this.trend = 'written';
        }
        this.selectTrend(this.trend);
    }

    get days() { return this.trend === 'quiz' ? this.quizDays : this.paperDays; }

    selectTrend(kind: 'quiz' | 'written'): void {
        this.trend = kind;
        const format = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
        this.chartData = {
            labels: this.days.map(point => format.format(point.date)),
            datasets: [{
                data: this.days.map(point => percent(point.score)),
                borderColor: kind === 'quiz' ? '#20543f' : '#536b33',
                backgroundColor: kind === 'quiz' ? '#20543f13' : '#536b3313',
                pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, fill: 'origin',
            }],
        };
    }

    reviewLatestPaper(): void {
        const paper = this.papers[0];
        if (!paper) return;
        document.getElementById('progress-paper-' + paper.id)?.focus();
        if (this.paperId !== paper.id) void this.openPaper(paper.id);
    }

    togglePaper(id: string): void {
        if (id === this.paperId) this.closePaper();
        else void this.openPaper(id);
    }

    private closePaper(): void {
        this.paperRequest?.abort();
        this.paperRequest = undefined;
        if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
        this.downloadUrl = undefined;
        this.paperId = '';
        this.paperResult = undefined;
        this.feedbackLoading = this.feedbackError = this.pdfLoading = this.pdfError = false;
    }

    async openPaper(id: string): Promise<void> {
        if (!this.showPapers || !this.papers.some(paper => paper.id === id)) return;
        this.closePaper();
        this.paperId = id;
        this.paperRequest = new AbortController();
        const { signal } = this.paperRequest;
        this.feedbackLoading = true;
        try {
            const result = await this.papersApi.result(id, signal);
            if (!signal.aborted) this.paperResult = result;
        } catch {
            if (!signal.aborted) this.feedbackError = true;
        } finally {
            if (!signal.aborted) this.feedbackLoading = false;
        }
    }

    async downloadPdf(): Promise<void> {
        const result = this.paperResult;
        const signal = this.paperRequest?.signal;
        if (!this.showPapers || !result || !signal || this.pdfLoading) return;
        this.pdfLoading = true;
        this.pdfError = false;
        try {
            const pdf = await this.papersApi.blob('/' + encodeURIComponent(this.paperId) + '/result/pdf', signal);
            if (signal.aborted) return;
            if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
            this.downloadUrl = URL.createObjectURL(pdf);
            const link = document.createElement('a');
            link.href = this.downloadUrl;
            link.download = result.filename || 'checked-answer-sheet.pdf';
            link.click();
        } catch {
            if (!signal.aborted) this.pdfError = true;
        } finally {
            if (!signal.aborted) this.pdfLoading = false;
        }
    }

    toggleQuiz(id: string): void {
        if (this.retrying) return;
        this.quizId = this.quizId === id ? '' : id;
        this.retryError = false;
    }

    get hubParams() {
        const params = this.route.snapshot.queryParamMap;
        return { returnTo: params.get('returnTo'), hubReturnPath: params.get('hubReturnPath') };
    }

    reviewQuiz(row: QuizActivity): void {
        void this.router.navigate(['/quiz-summary'], {
            queryParams: { ...this.hubParams, sessionId: row.id, userId: this.userId },
        });
    }

    hasIncorrect(row: QuizActivity): boolean {
        return row.quiz.questions?.some(question => !question.isCorrect) ?? false;
    }

    async retryQuiz(row: QuizActivity, scope: 'incorrect' | 'all'): Promise<void> {
        const { questions, board, standard, subject, chapter } = row.quiz;
        if (!questions?.length || this.retrying || (scope === 'incorrect' && !this.hasIncorrect(row))) return;
        const signal = this.request.signal;
        this.retrying = true;
        this.retryError = false;
        try {
            await this.quizService.prepareRetryFromResults({
                questionSummaries: questions, incorrectOnly: scope === 'incorrect', signal,
                context: { source: 'reports', type: scope, originId: row.id, metadata: { board, standard, subject, chapter } },
            });
            if (!signal.aborted) {
                if (this.quizService.getPendingRetryContext()?.originId !== row.id) throw Error('No retry questions available.');
                await this.router.navigate(['/quiz'], {
                    queryParams: { ...this.hubParams, retry: 'reports', scope, sessionId: row.id },
                });
            }
        } catch {
            if (!signal.aborted) this.retryError = true;
        } finally {
            if (!signal.aborted) this.retrying = false;
        }
    }
}
