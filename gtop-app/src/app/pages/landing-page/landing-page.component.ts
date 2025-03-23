import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit {

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

    constructor(
        private router: Router,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        this.authService.getUser().subscribe(user => {
            if (user && user.board && user.standard) {
                this.router.navigate(['/dashboard']);
            }
        });
    }

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
        if (!this.selectedAnswer) return {};

        if (this.selectedAnswer === this.correctAnswer) {
            return optionValue === this.selectedAnswer
                ? { 'background-color': '#4CAF50' }  // Green
                : {};
        } else {
            return optionValue === this.selectedAnswer
                ? { 'background-color': '#e36f66' }  // Red
                : optionValue === this.correctAnswer
                    ? { 'background-color': '#4CAF50' }  // Green
                    : {};
        }
    }

    signUp() {
        this.router.navigate(['/profile-setup']);
    }
}
