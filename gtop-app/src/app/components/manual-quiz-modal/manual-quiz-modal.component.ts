import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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
        ReactiveFormsModule
    ],
    templateUrl: './manual-quiz-modal.component.html',
    styleUrls: ['./manual-quiz-modal.component.scss']
})
export class ManualQuizModalComponent {

    // Dummy/pre-filled data (will later bind from Firestore)
    board: string = 'CBSE';
    standard: string = '8th Standard';

    subjects = ['Math', 'Science', 'English']; // To be fetched dynamically
    chapters = ['Chapter 1', 'Chapter 2', 'Chapter 3']; // Dummy

    selectedSubjects: string[] = [];
    selectedChapters: string[] = [];

    questionCount: number = 10;
    difficultyLevel: string = 'adaptive';

    constructor(
        public dialogRef: MatDialogRef<ManualQuizModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) { }

    startQuiz() {
        console.log('Starting manual quiz with:', {
            selectedSubjects: this.selectedSubjects,
            selectedChapters: this.selectedChapters,
            questionCount: this.questionCount,
            difficultyLevel: this.difficultyLevel
        });
        this.dialogRef.close(); // Close modal
    }

    closeDialog() {
        this.dialogRef.close();
    }
}
