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
        FormsModule
    ],
    templateUrl: './manual-quiz-modal.component.html',
    styleUrls: ['./manual-quiz-modal.component.scss']
})
export class ManualQuizModalComponent implements OnInit {

    board: string = '';
    standard: string = '';

    subjects: string[] = [];
    chapters: string[] = [];

    selectedSubjects: string[] = [];
    selectedChapters: string[] = [];

    questionCount: number = 10;
    difficultyLevel: string = 'adaptive';

    constructor(
        public dialogRef: MatDialogRef<ManualQuizModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private authService: AuthService,
        private router: Router,
        private syllabusService: SyllabusService
    ) { }

    ngOnInit(): void {
        // ✅ Fetch real-time user
        this.authService.getUser().subscribe(user => {
            if (user) {
                this.board = user.board || '';
                this.standard = user.standard || '';

                // ✅ Filter syllabus for this user's board + standard
                this.syllabusService.syllabus$.subscribe((syllabusData: SyllabusItem[]) => {
                    const filtered = syllabusData.filter(item =>
                        item.board === this.board && item.standard === this.standard
                    );

                    // ✅ Extract unique subjects & chapters
                    this.subjects = [...new Set(filtered.map(item => item.subject))];
                    this.chapters = [...new Set(filtered.map(item => item.chapter))];
                });
            }
        });
    }

    startQuiz() {
        this.dialogRef.close();
        this.router.navigate(['/quiz'], {
            queryParams: {
                subjects: this.selectedSubjects,
                chapters: this.selectedChapters,
                count: this.questionCount
            }
        });
    }

    closeDialog() {
        this.dialogRef.close();
    }
}
