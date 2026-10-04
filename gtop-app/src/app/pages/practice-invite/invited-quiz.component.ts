import { Component } from '@angular/core';
import { QuizPageComponent } from '../quiz-page/quiz-page.component';

/** Route boundary; the solo player checkpoints its dedicated invitation source directly. */
@Component({ standalone: true, imports: [QuizPageComponent], template: '<app-quiz-page></app-quiz-page>' })
export class InvitedQuizComponent {}
