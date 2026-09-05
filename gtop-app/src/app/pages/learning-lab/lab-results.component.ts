import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';
import { LearningLabService, LearnerAttempts } from './learning-lab.service';
import { LabAttempt } from './attempt';
import { baseline, questions, missions, score } from './lesson';
type ResultRow = LabAttempt & { name: string; uid: string };
@Component({
  selector: 'app-lab-results',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './lab-results.component.html',
})
export class LabResultsComponent implements OnInit {
  learners: LearnerAttempts[] = [];
  loading = false;
  error = '';
  more = false;
  cursor?: QueryDocumentSnapshot<DocumentData>;
  readonly questions = questions;
  readonly baseline = baseline;
  readonly missions = missions;
  readonly pairs = [
    { name: 'Ohm’s law', pre: baseline[0], post: questions[0] },
    { name: 'Parallel paths', pre: baseline[1], post: questions[3] },
  ];
  constructor(private labs: LearningLabService) {}
  ngOnInit() {
    void this.load();
  }
  async load(reset = false) {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      const page = await this.labs.results(reset ? undefined : this.cursor);
      this.learners = reset
        ? page.rows
        : [
            ...this.learners,
            ...page.rows.filter(
              (r) => !this.learners.some((l) => l.uid === r.uid),
            ),
          ];
      this.cursor = page.cursor;
      this.more = page.more;
    } catch {
      this.error =
        'Could not load results. Check your connection and admin access, then retry.';
    } finally {
      this.loading = false;
    }
  }
  get rows(): ResultRow[] {
    return this.learners
      .flatMap((l) =>
        l.attempts.map((a) => ({ ...a, name: l.name, uid: l.uid })),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  get checked() {
    return this.rows.filter((a) => a.phase !== 'experiment');
  }
  get rated() {
    return this.rows.filter(
      (a) => a.phase === 'complete' && a.rating >= 1 && a.rating <= 5,
    );
  }
  get averageRating() {
    return this.rated.length
      ? (
          this.rated.reduce((n, a) => n + a.rating, 0) / this.rated.length
        ).toFixed(1)
      : '—';
  }
  correct(id: string, answer: number, pre = false) {
    return this.checked.filter(
      (a) => (pre ? a.baseline : a.answers)[id] === answer,
    ).length;
  }
  score(a: LabAttempt) {
    return score(a.answers);
  }
  phase(a: LabAttempt) {
    return a.phase === 'experiment'
      ? 'Experimenting'
      : a.phase === 'checked'
        ? 'Answers checked'
        : 'Complete';
  }
  choice(
    answers: Record<string, number>,
    id: string,
    choices: readonly string[],
  ) {
    return choices[answers[id]] || 'Not answered';
  }
}
