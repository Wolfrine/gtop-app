import { Component, OnDestroy, OnInit } from '@angular/core';
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

    optionsLabel = ['A', 'B', 'C', 'D'];

    // Dummy Firestore-style data (used in non-live mode only)
    questions = [
        {
            board: 'ICSE',
            standard: '6',
            subject: 'Mathematics',
            chapter: '8 Decimals',
            title: 'Untitled',
            question: 'What is the difference between 4.5 and 1.2?',
            options: ['3.3', '3.5', '3.0', '4.7'],
            correctIndex: 0,
            solutions: ['Correct answer is 3.3', '', '', ''],
            selectedIndex: null as number | null
        },
        {
            board: 'CBSE',
            standard: '7',
            subject: 'Science',
            chapter: 'Electricity',
            title: 'Untitled',
            question: 'What is the SI unit of electric current?',
            options: ['Ohm', 'Ampere', 'Volt', 'Watt'],
            correctIndex: 1,
            solutions: ['', '', '', ''],
            selectedIndex: null as number | null
        },
        {
            board: 'ICSE',
            standard: '8',
            subject: 'Mathematics',
            chapter: 'Algebra',
            title: 'Untitled',
            question: 'Simplify: 3(2x - 4) = ?',
            options: ['6x - 4', '6x - 12', '5x - 4', '6x + 4'],
            correctIndex: 1,
            solutions: ['', '', '', ''],
            selectedIndex: null as number | null
        }
    ];

    currentQuestionIndex = 0;
    // Live mode
    liveMode = false;
    sessionId: string | null = null;
    status: string | null = null;
    perQuestionSeconds = 20;
    anchorIndex = 0;
    anchorAt?: Date;
    startAt?: Date;
    timeRemainingSec = 0;
    countdownValue = '';
    leaderboard: { uid: string; displayName: string; responseMs: number }[] = [];
    answersUnsub: (() => void) | null = null;
    sessionUnsub: (() => void) | null = null;
    private retryContext: RetryContext | null = null;

    constructor(
        private quizService: QuizService,
        private liveService: LiveQuizService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        // Detect live mode via query param
        this.route.queryParams.subscribe(params => {
            this.sessionId = params['sessionId'] || null;
            this.liveMode = params['live'] == 1 || params['live'] === '1' || !!this.sessionId;
        });

        if (this.liveMode && this.sessionId) {
            // Subscribe to session and drive UI from it
            this.sessionUnsub = this.liveService.observeSession<any>(this.sessionId, (s) => {
                if (!s) return;
                this.status = s.status || null;
                this.perQuestionSeconds = Number(s.perQuestionSeconds || 20);
                this.anchorIndex = Number(s.anchorIndex || 0);
                this.anchorAt = s.anchorAt?.toDate ? s.anchorAt.toDate() : undefined;
                this.startAt = s.scheduledStartAt?.toDate ? s.scheduledStartAt.toDate() : undefined;
                if (Array.isArray(s.questionIds) && s.questionIds.length && this.questions.length === 0) {
                    this.liveService.fetchQuestionsForSession(s).then(qs => {
                        const byId = new Map(qs.map((q: any) => [q.id, q]));
                        this.questions = s.questionIds.map((id: string) => byId.get(id)).filter(Boolean);
                    });
                }
                this.updateFromSchedule();
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
    }




    selectOption(optionIndex: number) {
        const q = this.questions[this.currentQuestionIndex];
        if (!q) return;
        if (this.liveMode) {
            if (q.selectedIndex != null) return; // freeze after first selection in live mode
            q.selectedIndex = optionIndex;
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
        if (this.status === 'ended') { this.countdownValue = ''; return; }
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
    }

    private formatSec(totalSec: number) {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
}
