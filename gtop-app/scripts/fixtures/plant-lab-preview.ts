// Isolated DOM-test entry point. Production builds only src/main.ts.
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouterOutlet, RouterLink } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';
import { LandingPageComponent } from '../../src/app/pages/landing-page/landing-page.component';
import { ProfileSetupComponent } from '../../src/app/pages/profile-setup/profile-setup.component';
import { AuthService } from '../../src/app/services/auth.service';
import { SyllabusService } from '../../src/app/services/syllabus.service';
import { PlantLabComponent } from '../../src/app/pages/learning-lab/plant-lab.component';
import { LearningLabComponent } from '../../src/app/pages/learning-lab/learning-lab.component';
import { PlantResultsComponent } from '../../src/app/pages/learning-lab/plant-results.component';
import { LearningLabService } from '../../src/app/pages/learning-lab/learning-lab.service';
import { PlantLabService } from '../../src/app/pages/learning-lab/plant-lab.service';
import {
  Answers,
  LabChange,
  LabAttempt,
  appendAttempt,
  changeAttempt,
  newAttempt,
} from '../../src/app/pages/learning-lab/plant-attempt';
// Model the production profile snapshot: every lesson save emits an updated user.
// Use the real landing/profile components so their navigation lifecycle is exercised.
const previewUser = new BehaviorSubject<any>(null);
const previewAuth = {
  getUser: () => previewUser.asObservable(),
  signInWithGoogle: async () =>
    previewUser.next({
      uid: 'qa-only',
      displayName: 'Local QA learner',
      role: 'user',
      board: 'CBSE',
      standard: '10',
    }),
};
@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<h1>QA dashboard</h1>
    <a routerLink="/learning-lab">Learning Lab</a>`,
})
class PreviewDashboard {}
// Test-only signal for account-switch cleanup. This entry point is never shipped.
window.addEventListener('gtop-qa-account-change', () => previewUser.next({ uid: 'qa-other', role: 'user' }));
class PreviewStore {
  watchAccount(changed: () => void) {
    let previous = previewUser.value?.uid;
    const sub = previewUser.subscribe(user => { const next = user?.uid; if (next !== previous) changed(); previous = next; });
    return () => sub.unsubscribe();
  }
  history: LabAttempt[] = JSON.parse(
    sessionStorage.getItem('gtop-plant-qa-attempts') || '[]',
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
    sessionStorage.setItem('gtop-plant-qa-attempts', JSON.stringify(this.history));
    previewUser.next({
      ...previewUser.value,
      plantLab: { lessonId: 'plant-reproduction', attempts: this.history },
    });
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
    provideNoopAnimations(),
    { provide: AuthService, useValue: previewAuth },
    { provide: SyllabusService, useValue: { syllabus$: of([]) } },
    { provide: PlantLabService, useClass: PreviewStore },
    { provide: LearningLabService, useValue: { isAdmin: async () => true } },
    provideRouter([
      { path: '', pathMatch: 'full', component: LandingPageComponent },
      { path: 'profile-setup', component: ProfileSetupComponent },
      { path: 'dashboard', component: PreviewDashboard },
      { path: 'learning-lab/plants', component: PlantLabComponent },
      { path: 'learning-lab/plants/results', component: PlantResultsComponent },
      { path: '**', component: LearningLabComponent },
    ]),
  ],
});
