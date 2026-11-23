import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ManualQuizModalComponent } from '../../components/manual-quiz-modal/manual-quiz-modal.component';
import { AuthService } from '../../services/auth.service';
import { QuizService } from '../../services/quiz.service';
import { resumablePractice } from '../../services/practice-session';
import { PracticeReturnCardComponent } from '../practice-invite/practice-return.component';
import { StudentSubmission, StudentSubmissionsService, submissionStatusLabels } from '../../services/student-submissions.service';

@Component({
    selector: 'app-user-dashboard',
    standalone: true,
    imports: [DatePipe, RouterLink, MatIconModule, PracticeReturnCardComponent],
    templateUrl: './user-dashboard.component.html',
    styleUrl: './user-dashboard.component.scss',
})
export class UserDashboardComponent implements OnInit {
    private readonly destroy = inject(DestroyRef);
    private readonly auth = inject(AuthService);
    private readonly dialog = inject(MatDialog);
    private readonly quiz = inject(QuizService);
    private readonly sheets = inject(StudentSubmissionsService);
    private request?: AbortController;
    private uid = '';

    board = '';
    standard = '';
    resume: ReturnType<typeof resumablePractice> = null;
    sheetPreview: StudentSubmission[] | null = null;
    sheetError = false;
    completedCount: number | null = null;
    progressError = false;
    readonly status = submissionStatusLabels;
    readonly activities = [
        { title: 'Live Quizzes', route: '/live', icon: 'sensors' },
        { title: 'Quiz Run', route: '/quiz-run', icon: 'schedule' },
        { title: 'Learning Lab', route: '/learning-lab', icon: 'science' },
    ];

    get resumeChapter(): string | null {
        const chapters = this.resume?.params['chapters'];
        return Array.isArray(chapters) && chapters.length === 1 && typeof chapters[0] === 'string' ? chapters[0] : null;
    }

    ngOnInit(): void {
        this.destroy.onDestroy(() => this.request?.abort());
        this.auth.readyUser$.pipe(takeUntilDestroyed(this.destroy)).subscribe(profile => {
            this.board = profile?.board || '';
            this.standard = profile?.standard || '';
            this.resume = profile ? resumablePractice(profile) : null;
            const uid = profile?.uid || '';
            if (uid === this.uid) return;
            this.uid = uid;
            this.request?.abort();
            this.sheetPreview = null;
            this.sheetError = false;
            this.completedCount = null;
            this.progressError = false;
            if (!uid) return;

            const { signal } = this.request = new AbortController();
            this.sheets.preview(signal).then(result => {
                if (!signal.aborted) this.sheetPreview = result.submissions.slice(0, 3);
            }).catch(() => {
                if (!signal.aborted) this.sheetError = true;
            });
            this.quiz.countUserQuizResults(uid).then(count => {
                if (!signal.aborted) this.completedCount = count;
            }).catch(() => {
                if (!signal.aborted) this.progressError = true;
            });
        });
    }

    openManualQuiz(): void {
        this.dialog.open(ManualQuizModalComponent, {
            width: '400px',
            data: { userStandard: this.standard, userSubjects: this.board },
        });
    }
}
