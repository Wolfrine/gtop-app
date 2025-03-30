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

    filteredSyllabus: SyllabusItem[] = [];

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
        this.authService.getUser().subscribe(user => {
            if (user) {
                this.board = user.board || '';
                this.standard = user.standard || '';

                // ✅ Filter syllabus
                this.syllabusService.syllabus$.subscribe((syllabusData: SyllabusItem[]) => {
                    this.filteredSyllabus = syllabusData.filter(item =>
                        item.board === this.board && item.standard === this.standard
                    );

                    // ✅ Extract unique subjects
                    this.subjects = [...new Set(this.filteredSyllabus.map(item => item.subject))];
                });
            }
        });
    }

    onSubjectsChange() {
        // ✅ When subject(s) selected → filter chapters accordingly
        const filteredChapters = this.filteredSyllabus
            .filter(item => this.selectedSubjects.includes(item.subject))
            .map(item => item.chapter);

        this.chapters = [...new Set(filteredChapters)];
    }


    startQuiz() {
        this.dialogRef.close();

        this.router.navigate(['/quiz'], {
            queryParams: {
                board: this.board,               // ✅ fixed
                standard: this.standard,         // ✅ fixed
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
