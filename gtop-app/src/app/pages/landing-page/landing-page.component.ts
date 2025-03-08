import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MATERIAL_MODULES } from '../../material.module';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [...MATERIAL_MODULES, CommonModule],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
    // Track selected answer + feedback
    selectedAnswer: string | null = null;
    answerFeedback: string | null = null;

    // Our MCQ
    questionText = 'Q: What is the capital of France?';
    options = [
        { label: 'A) Berlin', value: 'A' },
        { label: 'B) Madrid', value: 'B' },
        { label: 'C) Paris', value: 'C' },
        { label: 'D) Rome', value: 'D' }
    ];
    correctAnswer = 'C';

    constructor(private router: Router) { }

    // Called when an option is clicked
    checkAnswer(optionValue: string) {
        this.selectedAnswer = optionValue;

        if (optionValue === this.correctAnswer) {
            this.answerFeedback = '✅ Correct! Ready for more?';
        } else {
            this.answerFeedback = '❌ Oops! The correct answer is Paris.';
        }
    }

    // Dynamic style binding for each button
    getButtonStyle(optionValue: string): { [klass: string]: any } {
        // No selection yet? No styles
        if (!this.selectedAnswer) return {};

        // If user chose correctly:
        if (this.selectedAnswer === this.correctAnswer) {
            // Highlight only the selected button as green
            if (optionValue === this.selectedAnswer) {
                return { 'background-color': '#4CAF50' }; // Green
            }
            // Others remain unstyled
            return {};
        }
        // If user chose incorrectly:
        else {
            // Red for the selected wrong button
            if (optionValue === this.selectedAnswer) {
                return { 'background-color': '#e36f66' }; // Red
            }
            // Green for the correct answer
            if (optionValue === this.correctAnswer) {
                return { 'background-color': '#4CAF50' };
            }
            // Others remain unstyled
            return {};
        }
    }

    signUp() {
        this.router.navigate(['/auth']);
    }
}





