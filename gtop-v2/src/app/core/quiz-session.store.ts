import { Injectable, signal } from '@angular/core';
import { PracticeFilters } from './learning.repository';
import { Question } from './models';
import { QuizLaunchContext } from './models';

export interface QuizSessionState {
  questions: Question[];
  filters: PracticeFilters;
  startedAt: number;
  returnTo?: string;
  hubReturnPath?: string;
  launchContext?: QuizLaunchContext;
}

@Injectable({ providedIn: 'root' })
export class QuizSessionStore {
  readonly active = signal<QuizSessionState | null>(null);
  readonly completed = signal<QuizSessionState | null>(null);

  start(state: QuizSessionState): void {
    this.active.set(state);
    sessionStorage.setItem('gtop-v2-quiz', JSON.stringify(state));
  }

  restore(): QuizSessionState | null {
    if (this.active()) return this.active();
    const raw = sessionStorage.getItem('gtop-v2-quiz');
    if (!raw) return null;
    try {
      const state = JSON.parse(raw) as QuizSessionState;
      this.active.set(state);
      return state;
    } catch {
      return null;
    }
  }

  finish(): void {
    this.completed.set(this.active());
    sessionStorage.removeItem('gtop-v2-quiz');
  }

  persist(state: QuizSessionState): void {
    this.active.set(state);
    sessionStorage.setItem('gtop-v2-quiz', JSON.stringify(state));
  }

  clear(): void {
    this.active.set(null);
    sessionStorage.removeItem('gtop-v2-quiz');
  }
}
