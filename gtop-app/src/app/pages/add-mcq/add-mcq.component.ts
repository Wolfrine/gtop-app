import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { McqService } from '../../services/mcq.service';

@Component({
    selector: 'app-add-mcq',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatExpansionModule,
        MatSnackBarModule
    ],
    templateUrl: './add-mcq.component.html',
    styleUrls: ['./add-mcq.component.scss']
})
export class AddMcqComponent {
    constructor(
        private router: Router,
        private snackBar: MatSnackBar,
        private mcqService: McqService
    ) { }

    chatGptPrompt = signal(`Generate MCQs in the following format:
[
  {
    "board": "CBSE",
    "standard": "10",
    "subject": "Mathematics",
    "chapter": "Algebra",
    "question": "What is x if 2x + 3 = 7?",
    "options": ["1", "2", "3", "4"],
    "correctIndex": 1,
    "solutions": [
      "Option A is incorrect because 2(1) + 3 ≠ 7.",
      "Option B is correct because 2(2) + 3 = 7.",
      "Option C is incorrect because 2(3) + 3 ≠ 7.",
      "Option D is incorrect because 2(4) + 3 ≠ 7."
    ]
  }
]`);

    pastedMCQs = signal('');
    parsedMCQs = signal<any[]>([]);
    isSaving = signal(false);
    optionLabels = ['A', 'B', 'C', 'D'];

    goBack() {
        this.router.navigate(['/admin/mcq-management']);
    }

    copyPrompt() {
        navigator.clipboard.writeText(this.chatGptPrompt());
        this.snackBar.open('Prompt copied to clipboard!', 'Close', { duration: 2000 });
    }

    parseMCQs() {
        try {
            const data = JSON.parse(this.pastedMCQs());
            if (Array.isArray(data) && data.every(this.isValidMCQ)) {
                this.parsedMCQs.set(data);
                this.snackBar.open('MCQs parsed successfully!', 'Close', { duration: 2000 });
            } else {
                this.snackBar.open('Invalid format! Please paste a valid JSON array.', 'Close', { duration: 3000 });
            }
        } catch (error) {
            this.snackBar.open('Error parsing JSON. Please check your format.', 'Close', { duration: 3000 });
        }
    }

    async saveMCQs() {
        if (this.parsedMCQs().length === 0) {
            this.snackBar.open('No MCQs to save!', 'Close', { duration: 2000 });
            return;
        }

        this.isSaving.set(true);

        try {
            await this.mcqService.addMCQs(this.parsedMCQs());
            this.snackBar.open('MCQs saved successfully!', 'Close', { duration: 3000 });
            this.pastedMCQs.set('');
            this.parsedMCQs.set([]);
        } catch (error) {
            console.error('Error saving MCQs:', error);
            this.snackBar.open('Error saving MCQs. Try again later.', 'Close', { duration: 3000 });
        } finally {
            this.isSaving.set(false);
        }
    }

    isValidMCQ(mcq: any): boolean {
        return (
            mcq &&
            typeof mcq.board === 'string' &&
            typeof mcq.standard === 'string' &&
            typeof mcq.subject === 'string' &&
            typeof mcq.chapter === 'string' &&
            typeof mcq.question === 'string' &&
            Array.isArray(mcq.options) &&
            mcq.options.length >= 2 &&
            typeof mcq.correctIndex === 'number' &&
            mcq.correctIndex >= 0 &&
            mcq.correctIndex < mcq.options.length
        );
    }

    // ✅ Getter for input binding
    getPastedMCQs() {
        return this.pastedMCQs();
    }

    // ✅ Setter for input binding
    setPastedMCQs(value: string) {
        this.pastedMCQs.set(value);
    }

    handleInputChange(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        this.pastedMCQs.set(target.value);
    }
}
