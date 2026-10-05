import { Component, Inject, OnInit } from '@angular/core';
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
export class ManualQuizModalComponent implements OnInit {

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

    constructor(
        public dialogRef: MatDialogRef<ManualQuizModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private authService: AuthService,
        private router: Router,
        private syllabusService: SyllabusService
    ) { }

    ngOnInit(): void {
        this.authService.getUser().subscribe(user => {
            if (user) {
                this.isAdmin = user.role === 'admin';
                this.board = user.board || '';
                this.standard = user.standard || '';

                this.syllabusService.syllabus$.subscribe((syllabusData: SyllabusItem[]) => {
                    const allBoards = syllabusData.map(s => s.board);
                    this.boards = [...new Set(allBoards)];

                    if (this.isAdmin && this.board) {
                        this.onBoardChange();
                    }

                    if (!this.isAdmin) {
                        // Direct filtering for users (fixed board & standard)
                        this.filteredSyllabus = syllabusData.filter(item =>
                            item.board === this.board && item.standard === this.standard
                        );
                        this.subjects = [...new Set(this.filteredSyllabus.map(item => item.subject))];
                    }
                });
            }
        });
    }

    onBoardChange(): void {
        // Reset everything downstream
        this.standard = '';
        this.standards = [];
        this.subjects = [];
        this.selectedSubjects = [];
        this.selectedChapters = [];
        this.chapters = [];

        const syllabusData = this.syllabusService.syllabus$.getValue();
        const filtered = syllabusData.filter(item => item.board === this.board);
        this.standards = [...new Set(filtered.map(item => item.standard))];
    }

    onStandardChange(): void {
        const syllabusData = this.syllabusService.syllabus$.getValue();

        this.filteredSyllabus = syllabusData.filter(item =>
            item.board === this.board && item.standard === this.standard
        );

        this.subjects = [...new Set(this.filteredSyllabus.map(item => item.subject))];
        this.selectedSubjects = [];
        this.selectedChapters = [];
        this.chapters = [];
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
