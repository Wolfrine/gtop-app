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
import { MatAccordion } from '@angular/material/expansion';

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
        MatExpansionModule
    ],
    templateUrl: './add-mcq.component.html',
    styleUrls: ['./add-mcq.component.scss']
})
export class AddMcqComponent {
    router = signal(new Router());
    chatGptPrompt = signal(`
Generate MCQs in the following format:
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
    optionLabels = ['A', 'B', 'C', 'D'];

    goBack() {
        this.router().navigate(['/admin/mcq-management']);
    }

    copyPrompt() {
        navigator.clipboard.writeText(this.chatGptPrompt());
        alert('Prompt copied to clipboard!');
    }

    parseMCQs() {
        try {
            const data = JSON.parse(this.pastedMCQs());
            if (Array.isArray(data)) {
                this.parsedMCQs.set(data);
            } else {
                alert('Invalid format! Please paste a valid JSON array.');
            }
        } catch (error) {
            alert('Error parsing JSON. Please check your format.');
        }
    }

    saveMCQs() {
        alert('MCQs saved successfully! (Firestore integration will be added later.)');
        this.pastedMCQs.set('');
        this.parsedMCQs.set([]);
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
        this.setPastedMCQs(target.value);
    }
}
