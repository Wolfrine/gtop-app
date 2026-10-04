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
import { AuthService } from '../../services/auth.service';
import { combineLatest, Subscription } from 'rxjs';
import { PracticeContext, questionsMatchPractice, resolvePracticeContext } from '../../services/practice-context';
import { createPracticeAttemptId, PracticeSession, readPracticeSession, writePracticeSession } from '../../services/practice-session';
import { canonicalIndex, presentLiveQuestion, presentQuestion } from '../../services/question-presentation';

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
    loading = true;
    loadError = '';
    profileRequired = false;
    private soloSubscription?: Subscription;
    private requestVersion = 0;
    private practiceSession: PracticeSession | null = null;
    private currentProfile: any;
    private currentParams: Record<string, any> = {};
    private loadedContextKey = '';
    private historyNavigation = false;

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
    private hubReturnUrl: string | null = null;
    private hubReturnPath: string | null = null;

    constructor(
        private quizService: QuizService,
        private liveService: LiveQuizService,
        private router: Router,
        private route: ActivatedRoute,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        // Detect live mode synchronously from snapshot to avoid race with normal fetch
        const qp = this.route.snapshot.queryParams || {};
        this.historyNavigation = this.router.getCurrentNavigation?.()?.trigger === 'popstate';
        this.hubReturnUrl = qp['returnTo'] || null;
        this.hubReturnPath = qp['hubReturnPath'] || null;
        const modeParam = (qp['mode'] || '').toLowerCase();
        if (modeParam === 'run') {
            this.liveModeType = 'run';
        }
        // Reports retries carry their source result ID; it is not a LiveSessions ID.
        this.sessionId = qp['retry'] ? null : qp['sessionId'] || null;
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
                        this.questions = s.questionIds.map((id: string) => byId.get(id)).filter(Boolean)
                            .map((question: any) => presentLiveQuestion(question, this.sessionId!, this.authService.profile()?.uid || ''));
                        this.loading = false;
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

        if (this.liveMode) {
            this.loading = false;
            this.loadError = 'This quiz link is missing its session. Return to the dashboard and join again.';
            return;
        }
        this.soloSubscription = combineLatest([this.authService.readyUser$, this.route.queryParams]).subscribe(([profile, params]) => {
            this.currentProfile = profile;
            this.currentParams = params;
            void this.loadSoloQuiz();
        });
    }

    async loadSoloQuiz(force = false): Promise<void> {
        const profile = this.currentProfile;
        let context: PracticeContext;
        try {
            context = resolvePracticeContext(profile, this.currentParams);
        } catch (error) {
            this.requestVersion++;
            this.loadedContextKey = '';
            this.questions = [];
            this.loading = false;
            this.profileRequired = (error as Error).message === 'profile-required';
            this.loadError = this.profileRequired ? 'Add your board and class to start a quiz for your curriculum.' : (error as Error).message;
            return;
        }
        const key = `${profile.uid}:${context.routeKey}`;
        if (!force && this.loadedContextKey === key) return;
        this.loadedContextKey = key;
        const version = ++this.requestVersion;
        this.loading = true;
        this.loadError = '';
        this.profileRequired = false;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.hubReturnUrl = this.currentParams['returnTo'] || null;
        this.hubReturnPath = this.currentParams['hubReturnPath'] || null;
        this.practiceSession = null;
        this.retryContext = null;
        try {
            const restored = readPracticeSession(profile.uid);
            if (restored?.completed && !restored.saved) {
                const profileContext = resolvePracticeContext(profile, {});
                if (restored.role !== (profile.role || 'user') || !questionsMatchPractice(restored.questions, profileContext)) {
                    this.profileRequired = true;
                    throw new Error('Your previous quiz result is still unsaved. Restore its original board and class, then save it before starting another quiz.');
                }
                this.practiceSession = restored;
                this.questions = restored.questions;
                this.currentQuestionIndex = restored.currentQuestionIndex;
                this.hubReturnUrl = restored.returnTo || null;
                this.hubReturnPath = restored.hubReturnPath || null;
                this.openSoloSummary();
                return;
            }
            const pendingRetry = this.quizService.consumePendingRetry();
            if (!pendingRetry && restored?.routeKey === context.routeKey && restored.role === (profile.role || 'user') &&
                questionsMatchPractice(restored.questions, context) && (!(restored.completed && restored.saved) || this.historyNavigation)) {
                this.practiceSession = restored;
                this.questions = restored.questions;
                this.currentQuestionIndex = restored.currentQuestionIndex;
                this.loading = false;
                return;
            }
            let questions: any[];
            if (this.currentParams['retry'] && !pendingRetry) {
                throw new Error('This retry could not be restored. Open the saved result and choose Retry again.');
            }
            if (pendingRetry) {
                if (!questionsMatchPractice(pendingRetry.questions, context)) {
                    throw new Error('This attempt belongs to a different curriculum. Start a new quiz for your current board and class.');
                }
                this.retryContext = pendingRetry.context;
                questions = pendingRetry.questions;
            } else if (context.quizType === 'custom' && context.curriculum) {
                questions = await this.quizService.fetchCustomQuizQuestions(context.curriculum.board, context.curriculum.standard,
                    context.subjects, context.chapters, context.count);
            } else {
                questions = await this.quizService.fetchQuestionsFromRandomChapter(context.curriculum);
            }
            if (version !== this.requestVersion) return;
            if (!questions.length) throw new Error('No questions are available for this curriculum and topic yet. Choose another topic or try again later.');
            if (!questionsMatchPractice(questions, context)) throw new Error('These questions do not match your quiz curriculum. Try again.');
            this.questions = questions.map(question => presentQuestion(question));
            this.practiceSession = { version: 1, uid: profile.uid, role: profile.role || 'user', routeKey: context.routeKey,
                attemptId: createPracticeAttemptId(), quizType: pendingRetry ? 'retry' : context.quizType,
                questions: this.questions, currentQuestionIndex: 0, completed: false, saved: false,
                returnTo: this.hubReturnUrl, hubReturnPath: this.hubReturnPath };
            this.persistPractice();
        } catch (error) {
            if (version !== this.requestVersion) return;
            this.loadError = error instanceof Error ? error.message : 'Unable to load your quiz. Check your connection and try again.';
        } finally {
            if (version === this.requestVersion) this.loading = false;
        }
    }

    goToProfile(): void { void this.router.navigate(['/profile-setup']); }
    goToDashboard(): void { void this.router.navigate([this.currentProfile?.role === 'admin' ? '/admin' : '/dashboard']); }
    get reviewingSavedAttempt(): boolean { return !!(this.practiceSession?.completed && this.practiceSession.saved); }

    private persistPractice(completed = false): void {
        if (!this.practiceSession) return;
        this.practiceSession = { ...this.practiceSession, questions: this.questions, currentQuestionIndex: this.currentQuestionIndex,
            completed: completed || this.practiceSession.completed };
        writePracticeSession(this.practiceSession);
    }

    private openSoloSummary(): void {
        this.persistPractice(true);
        this.quizService.setQuestions(this.questions);
        void this.router.navigate(['/quiz-summary'], {
            state: { questions: this.questions, practiceUid: this.practiceSession?.uid, attemptId: this.practiceSession?.attemptId, quizType: this.practiceSession?.quizType,
                saved: this.practiceSession?.saved, returnTo: this.hubReturnUrl, hubReturnPath: this.hubReturnPath },
            queryParams: this.hubReturnUrl ? { returnTo: this.hubReturnUrl, hubReturnPath: this.hubReturnPath || undefined } : undefined
        });
    }

    ngOnDestroy(): void {
        this.requestVersion++;
        this.soloSubscription?.unsubscribe();
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
        if (this.practiceSession?.completed) return;
        if (this.liveMode) {
            if (this.timeRemainingSec <= 0) return; // time up
            if (q.selectedIndex != null) return; // freeze after first selection in live mode
            q.selectedIndex = optionIndex;
            this.hasSubmittedLiveAnswer = true;
            if (!this.sessionId) return;
            const base = this.anchorAt ?? this.startAt ?? new Date();
            const questionStartAt = new Date(base.getTime() + (this.currentQuestionIndex - this.anchorIndex) * this.perQuestionSeconds * 1000);
            this.liveService.submitAnswer(this.sessionId, this.currentQuestionIndex, canonicalIndex(q, optionIndex)!, questionStartAt).catch(() => {});
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
        this.persistPractice();
    }

    nextQuestion() {
        if (!this.questions.length || this.questions[this.currentQuestionIndex]?.selectedIndex == null) return;
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.persistPractice();
        } else {
            this.openSoloSummary();
        }
    }


    getProgressPercent() {
        return this.questions.length ? ((this.currentQuestionIndex + 1) / this.questions.length) * 100 : 0;
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
            this.router.navigate(['/quiz-summary'], {
                state: {
                    fromLive: true,
                    questions: this.questions,
                    practiceUid: this.authService.profile()?.uid,
                    attemptId: `live-${this.sessionId}-${this.authService.profile()?.uid}`,
                    liveMode: this.liveModeType || 'live',
                    sessionId: this.sessionId,
                    returnTo: this.hubReturnUrl,
                    hubReturnPath: this.hubReturnPath
                },
                queryParams: this.hubReturnUrl ? {
                    returnTo: this.hubReturnUrl,
                    hubReturnPath: this.hubReturnPath || undefined
                } : undefined
            });
        }
    }

    private formatSec(totalSec: number) {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }

}
