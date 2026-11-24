import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { SyllabusService, SyllabusItem } from '../../services/syllabus.service';
import { PracticeShareComponent } from '../../pages/practice-invite/practice-share.component';
import { Subscription, distinctUntilChanged } from 'rxjs';

@Component({
    selector: 'app-manual-quiz-modal',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatRadioModule,
        MatButtonModule,
        FormsModule,
        PracticeShareComponent
    ],
    templateUrl: './manual-quiz-modal.component.html',
    styleUrls: ['./manual-quiz-modal.component.scss']
})
export class ManualQuizModalComponent implements OnInit, OnDestroy {

    // Role Check
    isAdmin: boolean = false;

    // Dropdowns
    board: string = '';
    standard: string = '';
    boards: string[] = [];
    standards: string[] = [];

    // Dynamic Subjects/Chapters
    subjects: string[] = [];
    chapters: string[] = [];
    selectedSubjects: string[] = [];
    selectedChapters: string[] = [];

    // Quiz Setup
    questionCount: number = 10;
    difficultyLevel: string = 'adaptive';

    get invitationScope() {
        return this.board && this.standard && this.selectedSubjects.length === 1 && this.selectedChapters.length === 1 && this.questionCount === 5
            ? { board: this.board, standard: this.standard, subject: this.selectedSubjects[0], chapter: this.selectedChapters[0] } : null;
    }

    // All syllabus matching selected board/standard
    filteredSyllabus: SyllabusItem[] = [];
    private readonly subscriptions = new Subscription();
    private catalogueOptions?: Subscription;
    private boardOptions?: Subscription;
    private scopedSyllabus?: Subscription;

    constructor(
        public dialogRef: MatDialogRef<ManualQuizModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private authService: AuthService,
        private router: Router,
        private syllabusService: SyllabusService
    ) { }

    ngOnInit(): void {
        this.subscriptions.add(this.authService.getUser().pipe(distinctUntilChanged((previous, current) =>
            previous?.uid === current?.uid && previous?.role === current?.role &&
            previous?.board === current?.board && previous?.standard === current?.standard
        )).subscribe(user => {
            this.catalogueOptions?.unsubscribe();
            this.isAdmin = user?.role === 'admin';
            this.board = user?.board || '';
            this.standard = String(user?.standard || '');
            if (this.isAdmin) {
                this.catalogueOptions = this.syllabusService.boards().subscribe({
                    next: boards => { this.boards = boards; },
                    error: error => console.error('Unable to load boards', error)
                });
                this.onBoardChange();
            } else {
                this.boardOptions?.unsubscribe();
                this.onStandardChange();
            }
        }));
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
        this.catalogueOptions?.unsubscribe();
        this.boardOptions?.unsubscribe();
        this.scopedSyllabus?.unsubscribe();
    }

    onBoardChange(): void {
        // Reset everything downstream
        this.standard = '';
        this.standards = [];
        this.onStandardChange();
        this.boardOptions?.unsubscribe();
        if (!this.board) return;
        this.boardOptions = this.syllabusService.standards(this.board).subscribe({
            next: standards => { this.standards = standards; },
            error: error => console.error('Unable to load classes', error)
        });
    }

    onStandardChange(): void {
        this.scopedSyllabus?.unsubscribe();
        this.filteredSyllabus = [];
        this.subjects = [];
        this.selectedSubjects = [];
        this.selectedChapters = [];
        this.chapters = [];
        if (!this.board || !this.standard) return;
        this.scopedSyllabus = this.syllabusService.watchScope(this.board, this.standard, {
            includeBoardAliases: !this.isAdmin
        }).subscribe({
            next: ({ items }) => {
                this.filteredSyllabus = items;
                this.subjects = [...new Set(items.map(item => item.subject))];
                this.selectedSubjects = this.selectedSubjects.filter(subject => this.subjects.includes(subject));
                this.onSubjectsChange();
                this.selectedChapters = this.selectedChapters.filter(chapter => this.chapters.includes(chapter));
            },
            error: error => console.error('Unable to load syllabus', error)
        });
    }

    onSubjectsChange(): void {
        const filteredChapters = this.filteredSyllabus
            .filter(item => this.selectedSubjects.includes(item.subject))
            .map(item => item.chapter);

        this.chapters = [...new Set(filteredChapters)];
    }

    startQuiz(): void {
        this.dialogRef.close();
        this.router.navigate(['/quiz'], {
            queryParams: {
                board: this.board,
                standard: this.standard,
                subjects: this.selectedSubjects,
                chapters: this.selectedChapters,
                count: this.questionCount
            }
        });
    }

    closeDialog(): void {
        this.dialogRef.close();
    }
}
