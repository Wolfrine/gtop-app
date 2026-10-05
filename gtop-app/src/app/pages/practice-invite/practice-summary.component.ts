import { Component } from '@angular/core';
import { QuizSummaryComponent } from '../quiz-summary/quiz-summary.component';
import { PracticeReturnOfferComponent } from './practice-return.component';

@Component({ standalone: true, imports: [QuizSummaryComponent, PracticeReturnOfferComponent], template: '<app-quiz-summary></app-quiz-summary><app-practice-return-offer></app-practice-return-offer>' })
export class PracticeSummaryComponent {}
