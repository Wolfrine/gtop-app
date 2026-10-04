import { Component, OnInit, OnDestroy, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { canonicalIndex, explanationText } from '../../services/question-presentation';
import { readPracticeSession, writePracticeSession, createPracticeAttemptId } from '../../services/practice-session';
import { normalizePracticeBoard, questionsMatchPractice, resolvePracticeContext } from '../../services/practice-context';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { MatIconModule } from '@angular/material/icon';
import { LiveSummaryComponent } from '../live/live-summary/live-summary.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PracticeInviteService } from '../../services/practice-invite.service';
import { PracticeScope, practiceParams, matchesProfile } from '../../services/practice-invite.domain';

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
        MatSnackBarModule,
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
    saveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
    saveError = '';
    canSave = false;
    private attemptId = '';
    private invitationAttemptId = '';
    practiceReturnScope: PracticeScope | null = null;
    private quizType = 'quick';
    private currentUser: any = null;
    private ownerIdentity: string | null = null;
    private identityVersion = 0;
    private summaryInvalidated = false;
    private destroyed = false;
    private pendingSave: Promise<void> | null = null;
    private acknowledgementTimer: ReturnType<typeof setTimeout> | null = null;
    explanationText = explanationText;
    fromLive = false;
    liveSessionId: string | null = null;
    liveMode: 'live' | 'run' | null = null;
    hubReturnUrl: string | null = null;

    // UI state
    incorrectOnly = false;
    currentUserId: string | null = null;
    private flaggedQuestionIds = new Set<string>();
    private flaggingState: Record<string, boolean> = {};

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
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        @Optional() private invites: PracticeInviteService | null = null
    ) { }

    ngOnInit() {
        const navState: any = this.router.getCurrentNavigation()?.extras?.state || history.state || {};
        this.userSub = this.authService.readyUser$.subscribe(user => {
            const previousUid = this.currentUserId;
            this.currentUser = user;
            this.currentUserId = user?.uid ?? null;
            const identity = this.profileIdentity(user);
            if (this.ownerIdentity === null) {
                if (!user?.uid) return;
                this.ownerIdentity = identity;
                void this.loadSummary(navState, ++this.identityVersion);
            } else if (identity !== this.ownerIdentity && !this.summaryInvalidated) {
                this.invalidateSummary(previousUid === this.currentUserId
                    ? 'Your learning profile changed. Reopen this attempt with its original profile before saving.'
                    : 'Your account changed. Sign in with this attempt\'s original account and reopen it before saving.');
            }
        });
    }

    private profileIdentity(user: any): string {
        if (!user?.uid) return '';
        const role = user.role || 'user';
        return JSON.stringify([user.uid, role,
            role === 'admin' ? '' : normalizePracticeBoard(user.board),
            role === 'admin' ? '' : String(user.standard ?? '').trim()]);
    }

    private isCurrentSummary(version = this.identityVersion): boolean {
        return !this.destroyed && !this.summaryInvalidated && version === this.identityVersion &&
            this.ownerIdentity !== null && this.profileIdentity(this.currentUser) === this.ownerIdentity;
    }

    private invalidateSummary(message: string): void {
        this.summaryInvalidated = true;
        this.identityVersion++;
        this.canSave = false;
        this.saved = false;
        this.attemptId = '';
        this.questions = [];
        this.fromLive = false;
        this.liveSessionId = null;
        this.liveMode = null;
        this.flaggedQuestionIds.clear();
        this.saveState = 'error';
        this.saveError = message;
        if (this.acknowledgementTimer) clearTimeout(this.acknowledgementTimer);
        this.acknowledgementTimer = null;
        this.updateChart();
        // Keep the original tab session intact for recovery under its owning profile.
    }

    private async loadSummary(navState: any, version: number) {
        const user = this.currentUser;
        if (this.invites?.seed(navState.practiceReturnScope) && matchesProfile(navState.practiceReturnScope, user))
            this.practiceReturnScope = navState.practiceReturnScope;
        const uid = user.uid;
        const params = this.route.snapshot.queryParams || {};
        this.hubReturnUrl = navState.returnTo || params['returnTo'] || null;
        this.fromLive = !!navState.fromLive;
        this.liveSessionId = navState.liveSessionId || navState.sessionId || null;
        this.liveMode = navState.liveMode || (this.fromLive ? 'live' : null);
        try {
            if (navState.practiceUid && navState.practiceUid !== uid) {
                this.invalidateSummary('This attempt belongs to another account. Sign in with its original account and reopen it.');
                return;
            }
            let historical = navState.session;
            if (params['sessionId'] && params['userId'] &&
                (params['userId'] === uid || user.role === 'admin')) {
                historical = (await this.quizService.fetchUserQuizResults(params['userId']))
                    .find(r => r.id === params['sessionId']);
                if (!this.isCurrentSummary(version)) return;
                if (!historical) { this.saveState = 'error'; this.saveError = 'This saved attempt could not be loaded. Open it from your reports.'; return; }
            }
            const summaries = navState.questionSummaries || historical?.questions;
            if (Array.isArray(summaries) && summaries.length) {
                if (historical?.source?.kind === 'invitation' && !historical.invitation) throw new Error('missing-invitation-history');
                const questions = await this.quizService.expandSummariesToQuestions(summaries, historical?.invitation);
                if (!this.isCurrentSummary(version)) return;
                this.saved = true;
                this.saveState = 'saved';
                const type = historical?.quizType || navState.quizType;
                if (type === 'run' || type === 'live') {
                    this.fromLive = true;
                    this.liveMode = type;
                    this.liveSessionId = historical?.sessionId || this.liveSessionId;
                }
                this.questions = questions;
            } else if (params['sessionId']) {
                this.saveError = 'This saved attempt could not be loaded. Open it from your reports.';
                this.saveState = 'error';
                return;
            } else {
                const session = readPracticeSession(uid);
                const useSession = !this.fromLive && session?.completed &&
                    (!navState.attemptId || navState.attemptId === session.attemptId);
                this.questions = useSession ? session!.questions : (navState.questions || []);
                this.attemptId = useSession ? session!.attemptId : (navState.attemptId || createPracticeAttemptId());
                this.quizType = useSession ? session!.quizType : (navState.quizType || 'quick');
                this.saved = useSession ? !!session!.saved : !!navState.saved;
                const source = useSession ? session!.source : navState.source;
                if (source?.kind === 'invitation') {
                    if (source.attemptId !== this.attemptId || !this.invites || !await this.invites.resumeSummary(this.attemptId))
                        throw new Error('invitation-summary-unavailable');
                    if (!this.isCurrentSummary(version)) return;
                    const attempt = this.invites.current();
                    if (!attempt || attempt.attemptId !== this.attemptId || !attempt.completed) throw new Error('invitation-summary-unavailable');
                    this.invitationAttemptId = attempt.attemptId;
                    this.questions = attempt.questions;
                    this.quizType = 'custom';
                    this.saved = !!attempt.acknowledgedReceipt;
                    this.hubReturnUrl = attempt.returnTo || null;
                }
                if (!this.fromLive && this.questions.length && !this.saved &&
                    (!questionsMatchPractice(this.questions, resolvePracticeContext(user, {})) ||
                    (useSession && session!.role !== (user.role || 'user')))) {
                    this.saveState = 'error';
                    this.saveError = 'Your learning profile changed. Start a quiz for your current board and class.';
                    return;
                }
                this.saveState = this.saved ? 'saved' : 'idle';
                this.hubReturnUrl ||= session?.returnTo || null;
            }
            this.updateChart();
            this.canSave = this.questions.length > 0 && !this.saved;
            if (this.questions.length && !this.saved) void this.retrySave();
        } catch (error) {
            if (!this.isCurrentSummary(version)) return;
            this.saveState = 'error';
            this.saveError = 'Your attempt could not be loaded. Try opening it again.';
        }
    }

    async retrySave(): Promise<void> {
        if (!this.isCurrentSummary() || !this.canSave || this.saved || !this.currentUser || !this.questions.length || this.pendingSave) return;
        const version = this.identityVersion;
        const uid = this.currentUser.uid;
        const sample = this.questions[0];
        this.attemptId ||= createPracticeAttemptId();
        const attemptId = this.attemptId;
        const invitation = this.invitationAttemptId ? this.invites?.result(attemptId) : undefined;
        this.saveState = 'saving';
        this.saveError = '';
        const acknowledgementTimer = setTimeout(() => {
            if (!this.isCurrentSummary(version)) return;
            this.saveState = 'error';
            this.saveError = 'Saving is taking longer than expected. Keep this tab open and reconnect; your answers are retained.';
        }, 15000);
        this.acknowledgementTimer = acknowledgementTimer;
        const pendingSave = this.quizService.saveQuizResult(uid, {
            attemptId,
            ...(invitation ? { invitation } : {}),
            userName: this.currentUser.displayName || 'Unknown',
            board: sample.board,
            standard: sample.standard,
            subject: sample.subject,
            chapter: sample.chapter,
            quizType: this.fromLive ? (this.liveMode === 'run' ? 'run' : 'live') : this.quizType,
            sessionId: this.fromLive ? this.liveSessionId || undefined : undefined,
            questions: this.questions.map(q => ({
                id: q.id,
                selectedIndex: canonicalIndex(q, q.selectedIndex) as any,
                correctIndex: canonicalIndex(q, q.correctIndex) as number,
                ...(q.optionOrder ? { optionOrder: q.optionOrder } : {})
            }))
        }).then(receiptId => {
            if (!this.isCurrentSummary(version)) return;
            this.saved = true;
            this.saveState = 'saved';
            this.saveError = '';
            if (this.invitationAttemptId === attemptId) this.invites?.acknowledgeCompletion(attemptId, receiptId);
            const session = readPracticeSession(uid);
            if (session?.attemptId === attemptId) writePracticeSession({ ...session, saved: true });
            // Keep browser history entries tied to their own acknowledged attempt.
            if (history.state?.attemptId === attemptId) history.replaceState({ ...history.state, saved: true }, '');
        }).catch(() => {
            if (!this.isCurrentSummary(version)) return;
            this.saveState = 'error';
            this.saveError = 'Your result has not been saved. Your answers are retained in this tab. Reconnect and try again.';
        }).finally(() => {
            clearTimeout(acknowledgementTimer);
            if (this.acknowledgementTimer === acknowledgementTimer) this.acknowledgementTimer = null;
            if (this.pendingSave === pendingSave) this.pendingSave = null;
        });
        this.pendingSave = pendingSave;
        await pendingSave;
    }

    get savePending() { return !!this.pendingSave; }

    ngOnDestroy() {
        this.destroyed = true;
        this.identityVersion++;
        if (this.acknowledgementTimer) clearTimeout(this.acknowledgementTimer);
        if (this.userSub) this.userSub.unsubscribe();
    }

    backToHub() {
        if (!this.hubReturnUrl) {
            return;
        }
        window.location.assign(this.hubReturnUrl);
    }
    backToInvitation(): void {
        if (this.practiceReturnScope && this.saved && this.isCurrentSummary())
            void this.router.navigate(['/practice'], { queryParams: practiceParams(this.practiceReturnScope) });
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

    isQuestionFlagged(questionId: string) {
        return this.flaggedQuestionIds.has(questionId);
    }

    isQuestionFlagging(questionId: string) {
        return !!this.flaggingState[questionId];
    }

    async retryIncorrect() {
        if (!this.saved || !this.hasIncorrectAnswers) return;

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
        if (!this.saved) return;
        const invitation = this.invites?.current();
        if (this.invitationAttemptId && invitation?.attemptId === this.invitationAttemptId) {
            void this.router.navigate(['/quiz'], { queryParams: { ...practiceParams(invitation.scope), practice: 'invite',
                returnTo: invitation.returnTo, hubReturnPath: invitation.hubReturnPath },
                state: { invitationRetryOf: invitation.attemptId } });
            return;
        }
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

    async flagQuestion(question: any) {
        if (!this.isCurrentSummary()) return;
        if (!question?.id) {
            return;
        }

        if (!this.currentUserId) {
            this.snackBar.open('Please sign in to flag questions.', 'Dismiss', { duration: 3000 });
            return;
        }

        if (this.isQuestionFlagged(question.id)) {
            this.snackBar.open('You have already flagged this question.', 'Dismiss', { duration: 3000 });
            return;
        }

        this.flaggingState = { ...this.flaggingState, [question.id]: true };

        try {
            await this.quizService.flagQuestion(question, this.currentUserId);
            this.flaggedQuestionIds.add(question.id);
            this.snackBar.open('Question flagged for review. Thank you!', 'Dismiss', { duration: 4000 });
        } catch (error: any) {
            const code = error?.code || error?.message;
            if (code === 'already-flagged') {
                this.flaggedQuestionIds.add(question.id);
                this.snackBar.open('You already flagged this question.', 'Dismiss', { duration: 3000 });
            } else {
                console.error('Error flagging question:', error);
                this.snackBar.open('Could not flag this question. Please try again later.', 'Dismiss', { duration: 4000 });
            }
        } finally {
            const { [question.id]: removed, ...rest } = this.flaggingState;
            this.flaggingState = { ...rest };
        }
    }
}
