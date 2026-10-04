import { Component, ViewChild, inject } from '@angular/core';
import { QuizPageComponent } from '../quiz-page/quiz-page.component';
import { PracticeInviteService } from '../../services/practice-invite.service';

/** Narrow adapter keeps the existing player owned by the reliability workstream. */
@Component({ standalone: true, imports: [QuizPageComponent], template: '<app-quiz-page (click)="captureAnswer()"></app-quiz-page>' })
export class InvitedQuizComponent {
  @ViewChild(QuizPageComponent) player?: QuizPageComponent;
  private readonly invites = inject(PracticeInviteService);
  private readonly attemptId = this.invites.current()?.attemptId;
  captureAnswer(): void { if (this.player && this.attemptId) this.invites.checkpoint(this.attemptId, this.player.questions, this.player.currentQuestionIndex); }
}
