import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { Router, ActivatedRoute } from '@angular/router';
import { QuizService, RetryContext } from '../../services/quiz.service';
import { LiveQuizService } from '../../services/live-quiz.service';

@Component({
    selector: 'app-quiz-page',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        AppCardDirective,
        MatButtonModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatListModule,
        MatIconModule
    ],
    templateUrl: './quiz-page.component.html',
    styleUrls: ['./quiz-page.component.scss']
})
export class QuizPageComponent implements OnInit, OnDestroy {

    @ViewChild('quizRoot', { static: true }) quizRoot?: ElementRef<HTMLDivElement>;

    optionsLabel = ['A', 'B', 'C', 'D'];

    // Questions list; in live mode populated from session; in normal mode populated from selected filters
    questions: any[] = [];

    currentQuestionIndex = 0;
    // Live mode
    liveMode = false;
    sessionId: string | null = null;
    status: string | null = null;
    liveModeType: 'live' | 'run' | null = null;
    perQuestionSeconds = 20;
    anchorIndex = 0;
    anchorAt?: Date;
    startAt?: Date;
    timeRemainingSec = 0;
    countdownValue = '';
    leaderboard: { uid: string; displayName: string; responseMs: number }[] = [];
    answersUnsub: (() => void) | null = null;
    sessionUnsub: (() => void) | null = null;
    participantsUnsub: (() => void) | null = null;
    participantsCount = 0;
    private navigatedToSummary = false;
    private retryContext: RetryContext | null = null;
    private hasSubmittedLiveAnswer = false;
    private sawActiveRun = false;
    private lastTouchY = 0;

    constructor(
        private quizService: QuizService,
        private liveService: LiveQuizService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        // Detect live mode synchronously from snapshot to avoid race with normal fetch
        const qp = this.route.snapshot.queryParams || {};
        const modeParam = (qp['mode'] || '').toLowerCase();
        if (modeParam === 'run') {
            this.liveModeType = 'run';
        }
        this.sessionId = qp['sessionId'] || null;
        const liveFlag = qp['live'] == 1 || qp['live'] === '1';
        this.liveMode = liveFlag || !!this.sessionId || !!this.liveModeType;
        if (this.liveMode && !this.liveModeType) {
            this.liveModeType = 'live';
        }

        if (this.liveMode && this.sessionId) {
            // Subscribe to session and drive UI from it
            this.sessionUnsub = this.liveService.observeSession<any>(this.sessionId, (s) => {
                if (!s) return;
                const sessionMode = (s.mode || 'live');
                if (this.liveMode && !this.liveModeType) {
                    this.liveModeType = sessionMode;
                }
                if (sessionMode === 'run') {
                    this.liveModeType = 'run';
                }
                this.status = s.status || null;
                this.perQuestionSeconds = Number(s.perQuestionSeconds || 20);
                this.anchorIndex = Number(s.anchorIndex || 0);
                this.anchorAt = s.anchorAt?.toDate ? s.anchorAt.toDate() : undefined;
                this.startAt = s.scheduledStartAt?.toDate ? s.scheduledStartAt.toDate() : undefined;
                if (sessionMode === 'run' && s.status === 'active') {
                    this.sawActiveRun = true;
                }
                if (Array.isArray(s.questionIds) && s.questionIds.length && this.questions.length === 0) {
                    this.liveService.fetchQuestionsForSession(s).then(qs => {
                        const byId = new Map(qs.map((q: any) => [q.id, q]));
                        this.questions = s.questionIds.map((id: string) => byId.get(id)).filter(Boolean);
                    });
                }
                this.updateFromSchedule();
            });
            // Track participants count for per-question submission summary
            this.participantsUnsub = this.liveService.observeParticipants(this.sessionId, (list) => {
                this.participantsCount = Array.isArray(list) ? list.length : 0;
            });
            // Tick every second for timer updates
            const t = setInterval(() => this.updateFromSchedule(), 1000);
            (this as any)._tick = t;
            return;
        }

        const pendingRetry = this.quizService.consumePendingRetry();
        if (pendingRetry) {
            this.questions = pendingRetry.questions.map(question => ({ ...question }));
            this.retryContext = pendingRetry.context;
            this.currentQuestionIndex = 0;
            return;
        }

        this.route.queryParams.subscribe(params => {
            if (this.retryContext || this.liveMode) {
                return;
            }
            const board = params['board'] || null;
            const standard = params['standard'] || null;
            const subjects: string[] = params['subjects'] || [];
            const chapters: string[] = params['chapters'] || [];
            const count = params['count'] ? +params['count'] : 10;

            if (board && standard && (subjects.length > 0 || chapters.length > 0)) {
                // Custom quiz
                this.quizService.fetchCustomQuizQuestions(board, standard, subjects, chapters, count)
                    .then(fetchedQuestions => {
                        this.questions = fetchedQuestions;
                    })
                    .catch(error => {
                        console.error('Error fetching custom quiz:', error);
                    });
            } else {
                // Quick quiz
                this.quizService.fetchQuestionsFromRandomChapter()
                    .then(fetchedQuestions => {
                        this.questions = fetchedQuestions;
                    })
                    .catch(error => {
                        console.error('Error fetching quiz questions:', error);
                    });
            }
        });
    }

    ngOnDestroy(): void {
        if (this.sessionUnsub) this.sessionUnsub();
        if ((this as any)._tick) clearInterval((this as any)._tick);
        if (this.answersUnsub) this.answersUnsub();
        if (this.participantsUnsub) this.participantsUnsub();
    }

    @HostListener('window:touchstart', ['$event'])
    onWindowTouchStart(event: TouchEvent) {
        if (!this.shouldInterceptPullToRefresh(event)) {
            return;
        }
        this.lastTouchY = event.touches[0].clientY;
    }

    @HostListener('window:touchmove', ['$event'])
    onWindowTouchMove(event: TouchEvent) {
        if (!this.shouldInterceptPullToRefresh(event)) {
            return;
        }

        const currentY = event.touches[0].clientY;
        const deltaY = currentY - this.lastTouchY;
        this.lastTouchY = currentY;

        if (deltaY <= 0) {
            return;
        }

        const container = this.quizRoot?.nativeElement;
        if (!container) {
            return;
        }

        const atTop = container.scrollTop <= 0;
        const canScroll = container.scrollHeight > container.clientHeight;

        if ((atTop || !canScroll) && event.cancelable) {
            event.preventDefault();
        }
    }

    private shouldInterceptPullToRefresh(event: TouchEvent): boolean {
        if (event.touches.length !== 1) {
            return false;
        }
        const container = this.quizRoot?.nativeElement;
        if (!container) {
            return false;
        }
        const target = event.target as Node | null;
        if (!target) {
            return false;
        }
        return container.contains(target);
    }




    selectOption(optionIndex: number) {
        const q = this.questions[this.currentQuestionIndex];
        if (!q) return;
        if (this.liveMode) {
            if (this.timeRemainingSec <= 0) return; // time up
            if (q.selectedIndex != null) return; // freeze after first selection in live mode
            q.selectedIndex = optionIndex;
            this.hasSubmittedLiveAnswer = true;
            if (!this.sessionId) return;
            const base = this.anchorAt ?? this.startAt ?? new Date();
            const questionStartAt = new Date(base.getTime() + (this.currentQuestionIndex - this.anchorIndex) * this.perQuestionSeconds * 1000);
            this.liveService.submitAnswer(this.sessionId, this.currentQuestionIndex, optionIndex, questionStartAt).catch(() => {});
            if (this.answersUnsub) this.answersUnsub();
            this.answersUnsub = this.liveService.observeAnswers(this.sessionId, this.currentQuestionIndex, (items) => {
                this.leaderboard = (items || [])
                    .map(it => ({ uid: (it as any).uid, displayName: (it as any).displayName, responseMs: Number((it as any).responseMs || 0) }))
                    .sort((a, b) => a.responseMs - b.responseMs);
            });
            return;
        }

        // Normal mode
        q.selectedIndex = optionIndex;
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
        } else {
            // Save to service
            this.quizService.setQuestions(this.questions);
            this.router.navigate(['/quiz-summary']);
        }
    }


    getProgressPercent() {
        return ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
    }

    private updateFromSchedule() {
        if (!this.liveMode || !this.startAt) return;
        if (this.status === 'ended') { this.countdownValue = ''; this.navigateToSummaryIfReady(true, true); /* keep ticking until questions are loaded */ }
        const base = this.anchorAt ?? this.startAt;
        const now = new Date();
        if (now < this.startAt) { this.countdownValue = this.formatSec(Math.ceil((this.startAt.getTime() - now.getTime())/1000)); return; }
        const elapsedSec = Math.max(0, Math.floor((now.getTime() - base.getTime()) / 1000));
        const advance = Math.floor(elapsedSec / Math.max(1, this.perQuestionSeconds));
        const idx = Math.min(this.questions.length > 0 ? this.questions.length - 1 : 0, Math.max(0, this.anchorIndex + advance));
        if (idx !== this.currentQuestionIndex) {
            // clear leaderboard subscription when question changes
            if (this.answersUnsub) { this.answersUnsub(); this.answersUnsub = null; }
            this.leaderboard = [];
        }
        this.currentQuestionIndex = idx;
        const intoQuestion = elapsedSec % Math.max(1, this.perQuestionSeconds);
        const remaining = Math.max(0, this.perQuestionSeconds - intoQuestion);
        this.timeRemainingSec = remaining;
        this.countdownValue = this.formatSec(remaining);
        // end time based navigation
        const remainingQuestions = Math.max(0, (this.questions.length || 0) - this.anchorIndex);
        const endAtMs = base.getTime() + remainingQuestions * this.perQuestionSeconds * 1000;
        const hitEnd = now.getTime() >= endAtMs;
        this.navigateToSummaryIfReady(false, hitEnd);
    }

    private navigateToSummaryIfReady(ended: boolean, hitEndByTime: boolean) {
        if (this.navigatedToSummary) return;
        if (!this.questions || this.questions.length === 0) return;
        // Navigate when session ended or last question time elapses
        const isLast = this.currentQuestionIndex === this.questions.length - 1;
        const timeUp = this.timeRemainingSec <= 0;
        if (ended || hitEndByTime || (isLast && timeUp)) {
            if (this.liveModeType === 'run' && !this.hasSubmittedLiveAnswer && !this.sawActiveRun) {
                return;
            }
            this.navigatedToSummary = true;
            // Expose questions to summary save flow
            this.quizService.setQuestions(this.questions);
            this.router.navigate(['/quiz-summary'], { state: { fromLive: true, liveMode: this.liveModeType || 'live', sessionId: this.sessionId } });
        }
    }

    private formatSec(totalSec: number) {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }

}
