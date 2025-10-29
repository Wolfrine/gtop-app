import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../services/auth.service';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatTabsModule, AppCardDirective],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit, OnDestroy {

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

    readonly tourSlides = [
        {
            icon: 'leaderboard',
            label: 'Dashboard',
            heading: 'Track mastery across every subject',
            description: 'See streaks, recent wins, and smart nudges the moment you sign in. GTOP keeps revisions focused and exam readiness visible.',
            image: 'assets/tour/dashboard-glimpse.svg',
            imageAlt: 'Dashboard overview showing streak, accuracy cards, and quick-start actions.'
        },
        {
            icon: 'groups',
            label: 'Live Quiz',
            heading: 'Host adrenaline-packed live battles',
            description: 'Spin up a room, invite friends, and watch the leaderboard glow in real time. Moderation controls keep every session school-safe.',
            image: 'assets/tour/live-quiz-glimpse.svg',
            imageAlt: 'Live quiz lobby with participant avatars, host controls, and buzzing question list.'
        },
        {
            icon: 'insights',
            label: 'Quiz Summary',
            heading: 'Celebrate progress with instant insights',
            description: 'Review accuracy, speed, and topic trends at a glance. Shareable reports turn every attempt into a smarter next step.',
            image: 'assets/tour/summary-glimpse.svg',
            imageAlt: 'Quiz summary analytics including accuracy donut chart and revision checklist.'
        }
    ];

    selectedTourIndex = 0;
    private autoplayIntervalId: number | null = null;
    private readonly tourAutoplayDelay = 8000;

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

        this.startTourAutoplay();
    }

    ngOnDestroy(): void {
        this.clearTourAutoplay();
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

    onTourSelectionChange(index: number): void {
        this.selectedTourIndex = index;
        this.startTourAutoplay();
    }

    private startTourAutoplay(): void {
        if (typeof window === 'undefined') {
            return;
        }

        this.clearTourAutoplay();

        this.autoplayIntervalId = window.setInterval(() => {
            this.selectedTourIndex = (this.selectedTourIndex + 1) % this.tourSlides.length;
        }, this.tourAutoplayDelay);
    }

    private clearTourAutoplay(): void {
        if (typeof window === 'undefined') {
            return;
        }

        if (this.autoplayIntervalId !== null) {
            window.clearInterval(this.autoplayIntervalId);
            this.autoplayIntervalId = null;
        }
    }

    signUp() {
        this.router.navigate(['/profile-setup']);
    }
}
