import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, AppCardDirective],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit, OnDestroy, AfterViewInit {
    private readonly subscriptions = new Subscription();
    private revealObserver?: IntersectionObserver;
    motionPaused = false;
    circuitOn = false;

    // Track selected answer + feedback
    selectedAnswer: string | null = null;
    answerFeedback: string | null = null;

    // Our MCQ
    questionText = 'What is the capital of France?';
    options = [
        { label: 'A) Berlin', value: 'A' },
        { label: 'B) Madrid', value: 'B' },
        { label: 'C) Paris', value: 'C' },
        { label: 'D) Rome', value: 'D' }
    ];
    correctAnswer = 'C';

    constructor(
        private router: Router,
        private authService: AuthService,
        private element: ElementRef<HTMLElement>
    ) { }

    ngOnInit(): void {
        this.subscriptions.add(this.authService.getUser().subscribe(user => {
            if (user && user.board && user.standard) {
                this.router.navigate(['/dashboard']);
            }
        }));
    }

    ngOnDestroy(): void {
        // Profile updates (including saved lessons) must not navigate from a departed page.
        this.subscriptions.unsubscribe();
        this.revealObserver?.disconnect();
    }

    ngAfterViewInit(): void {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
        const root = this.element.nativeElement.querySelector('.landing-experience');
        this.revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-revealed');
                this.revealObserver?.unobserve(entry.target);
            });
        }, { threshold: 0.08 });
        root?.classList.add('motion-ready');
        this.element.nativeElement.querySelectorAll('.landing-reveal').forEach(item => this.revealObserver?.observe(item));
    }

    scrollToSection(id: string, event?: Event): void {
        event?.preventDefault();
        const target = this.element.nativeElement.querySelector<HTMLElement>(`#${id}`);
        const reduceMotion = this.motionPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        target?.focus({ preventScroll: true });
    }

    resetSample(): void {
        this.selectedAnswer = null;
        this.answerFeedback = null;
    }

    // Called when an option is clicked
    checkAnswer(optionValue: string) {
        this.selectedAnswer = optionValue;

        if (optionValue === this.correctAnswer) {
            this.answerFeedback = 'Correct. Paris is the capital of France.';
        } else {
            this.answerFeedback = 'Not quite. Paris is the capital of France; it is answer C.';
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
