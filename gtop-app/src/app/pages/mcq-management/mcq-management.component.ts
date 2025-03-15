import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

interface MCQ {
    title: string;
    question: string;
    options: string[];
    correctIndex: number,
    subject: string;
    selected: boolean;
}

@Component({
    selector: 'app-mcq-management',
    standalone: true,
    templateUrl: './mcq-management.component.html',
    styleUrls: ['./mcq-management.component.scss'],
    imports: [
        CommonModule,
        FormsModule,
        MatExpansionModule,
        MatCheckboxModule,
        MatButtonModule,
        MatIconModule,
        MatToolbarModule
    ]
})
export class McqManagementComponent {
    optionLabels = ['A)', 'B)', 'C)', 'D)'];
    mcqs: MCQ[] = [
        {
            title: 'What is the capital of France?',
            question: 'Which city is the capital of France?',
            options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
            correctIndex: 0,
            subject: 'Geography',
            selected: false
        },
        {
            title: 'Solve: 5 + 3',
            question: 'What is 5 + 3?',
            options: ['6', '7', '8', '9'],
            correctIndex: 2,
            subject: 'Mathematics',
            selected: false
        }
    ];

    toggleExpand(event: Event, mcq: any) {
        const target = event.target as HTMLElement;
        if (target.closest('.mcq-actions')) return; // ✅ Prevents expansion when clicking icons
        mcq.expanded = !mcq.expanded;
    }

    editMcq(mcq: MCQ) {
        console.log('Edit MCQ:', mcq);
    }

    deleteMcq(mcq: MCQ) {
        this.mcqs = this.mcqs.filter(item => item !== mcq);
    }
}
