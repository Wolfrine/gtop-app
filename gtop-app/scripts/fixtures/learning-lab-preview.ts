// Isolated DOM-test entry point. Production builds only src/main.ts.
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { CurrentLabComponent } from '../../src/app/pages/learning-lab/current-lab.component';
import { LearningLabComponent } from '../../src/app/pages/learning-lab/learning-lab.component';
import { LabResultsComponent } from '../../src/app/pages/learning-lab/lab-results.component';
import { LearningLabService } from '../../src/app/pages/learning-lab/learning-lab.service';
import {
  Answers,
  LabChange,
  LabAttempt,
  appendAttempt,
  changeAttempt,
  newAttempt,
} from '../../src/app/pages/learning-lab/attempt';
class PreviewStore {
  history: LabAttempt[] = JSON.parse(
    sessionStorage.getItem('gtop-qa-attempts') || '[]',
  );
  async load() {
    return this.history;
  }
  async isAdmin() {
    return true;
  }
  async start(answers: Answers) {
    const a = newAttempt(crypto.randomUUID(), answers, Date.now());
    this.history = appendAttempt(this.history, a);
    this.persist();
    return a;
  }
  async change(id: string, change: LabChange) {
    const a = this.history.find((x) => x.id === id)!;
    const next = changeAttempt(a, change, Date.now());
    this.history = this.history.map((x) => (x.id === id ? next : x));
    this.persist();
    return next;
  }
  persist() {
    sessionStorage.setItem('gtop-qa-attempts', JSON.stringify(this.history));
  }
  async results() {
    return {
      rows: this.history.length
        ? [{ uid: 'qa-only', name: 'Local QA learner', attempts: this.history }]
        : [],
      more: false,
    };
  }
}
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<div style="max-width:1280px;margin:auto"><router-outlet /></div>`,
})
class PreviewApp {}
bootstrapApplication(PreviewApp, {
  providers: [
    { provide: LearningLabService, useClass: PreviewStore },
    provideRouter([
      { path: 'learning-lab/current', component: CurrentLabComponent },
      { path: 'learning-lab/results', component: LabResultsComponent },
      { path: '**', component: LearningLabComponent },
    ]),
  ],
});
