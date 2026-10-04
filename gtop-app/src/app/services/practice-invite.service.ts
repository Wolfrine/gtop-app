import { Injectable, InjectionToken, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationStart } from '@angular/router';
import { Firestore, doc, getDocFromServer } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { REVIEWED_PRACTICES } from './reviewed-practices';
import { PracticeScope, PracticeCue, ReviewedPractice, PRACTICE_DELAY, matchesProfile, reviewedPractice, matchesReviewedContent, validCue, sameScope } from './practice-invite.domain';

export const REVIEWED_PRACTICE_SEEDS = new InjectionToken<readonly ReviewedPractice[]>('Reviewed practice seeds', { providedIn: 'root', factory: () => REVIEWED_PRACTICES });
/** Parent integration gate: enable only after reliability's stable options + acknowledged-save adapter passes. */
export const INVITED_SOLO_READY = new InjectionToken<boolean>('Invited solo engineering ready', { providedIn: 'root', factory: () => false });
export type PracticeEvent = 'invite_open' | 'practice_first_answer' | 'acknowledged_completion' | 'practice_return';
export const PRACTICE_EVIDENCE_KEY = 'gtop.practice.evidence.v1';

@Injectable({ providedIn: 'root' })
export class PracticeInviteService {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(Firestore);
  private readonly seeds = inject(REVIEWED_PRACTICE_SEEDS);
  private readonly soloReady = inject(INVITED_SOLO_READY);
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  readonly completion = signal<PracticeScope | null>(null);
  private active: { seed: ReviewedPractice; uid: string; firstAnswer: boolean; receipt?: string } | null = null;

  constructor() {
    this.auth.readyUser$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(profile => {
      if (this.active && (profile?.uid !== this.active.uid || !matchesProfile(this.active.seed.scope, profile))) this.clearAttempt();
    });
    this.router?.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (!(event instanceof NavigationStart) || !this.active) return;
      const [path, search] = event.url.split('?'); const params = new URLSearchParams(search || '');
      const state = this.router?.getCurrentNavigation()?.extras.state;
      const invitedSolo = path === '/quiz' && params.get('practice') === 'invite';
      const currentSummary = path === '/quiz-summary' && !params.has('sessionId') && !params.has('userId') && !state?.['fromLive'] && !state?.['questionSummaries'] && !state?.['session'];
      if (!invitedSolo && !currentSummary) this.clearAttempt();
    });
  }

  seed(scope: PracticeScope) { return this.soloReady ? reviewedPractice(scope, this.seeds) : null; }
  async questions(scope: PracticeScope): Promise<any[]> {
    const seed = this.seed(scope);
    const owner = this.auth.profile()?.uid;
    // This method never reads questions before a complete matching signed-in profile.
    if (!seed || !matchesProfile(scope, this.auth.profile())) throw new Error('practice-unavailable');
    const snapshots = await Promise.all(seed.questionIds.map(id => getDocFromServer(doc(this.firestore, 'questions', id))));
    const questions = snapshots.filter(snapshot => snapshot.exists()).map(snapshot => ({ ...snapshot.data(), id: snapshot.id, selectedIndex: null }));
    const reviewed = await matchesReviewedContent(seed, questions);
    if (!reviewed || this.auth.profile()?.uid !== owner || !matchesProfile(scope, this.auth.profile())) throw new Error('practice-unavailable');
    return questions;
  }
  begin(scope: PracticeScope): void {
    this.clearAttempt();
    const seed = this.seed(scope); const profile = this.auth.profile();
    if (seed && matchesProfile(scope, profile)) this.active = { seed, uid: profile.uid, firstAnswer: false };
  }
  firstAnswer(questions: any[]): void {
    if (!this.active || this.active.firstAnswer || this.auth.profile()?.uid !== this.active.uid || !this.attemptMatches(questions) || !questions.some(q => Number.isInteger(q.selectedIndex) && q.selectedIndex >= 0 && q.selectedIndex < q.options?.length)) return;
    this.active.firstAnswer = true; this.track('practice_first_answer');
  }
  /** Reliability adapter: call ONLY after the existing solo result write is server-acknowledged.
   * Never call on optimistic save, viewing history, retries, live/run, errors or cached writes.
   */
  acknowledgeCompletion(receiptId: string, questions: any[]): void {
    const active = this.active;
    if (!active || active.receipt || !receiptId || !active.firstAnswer || this.auth.profile()?.uid !== active.uid || !matchesProfile(active.seed.scope, this.auth.profile()) || !this.attemptMatches(questions)) return;
    active.receipt = receiptId; this.completion.set(active.seed.scope); this.track('acknowledged_completion');
  }
  keep(): boolean {
    const active = this.active;
    if (!active?.receipt || !this.completion() || this.auth.profile()?.uid !== active.uid) return false;
    try { localStorage.setItem(this.cueKey(active.uid), JSON.stringify({ scope: active.seed.scope, revision: active.seed.revision, dueAt: Date.now() + PRACTICE_DELAY })); this.completion.set(null); return true; }
    catch { return false; }
  }
  dismiss(): void { this.completion.set(null); }
  clearAttempt(): void { this.active = null; this.completion.set(null); }
  cue(): PracticeCue | null {
    const profile = this.auth.profile(); if (!profile?.uid) return null;
    try {
      const value = JSON.parse(localStorage.getItem(this.cueKey(profile.uid)) || 'null');
      return validCue(value) && matchesProfile(value.scope, profile) && this.seed(value.scope)?.revision === value.revision ? value : null;
    } catch { return null; }
  }
  off(): void { const uid = this.auth.profile()?.uid; if (uid) { try { localStorage.removeItem(this.cueKey(uid)); } catch {} } }
  returned(cue: PracticeCue): void { if (cue.dueAt <= Date.now()) { this.track('practice_return'); this.off(); } }
  track(stage: PracticeEvent): void {
    // Anonymous counts, not unique people or analytics-report evidence. No labels, IDs, URLs or answers.
    const event = { stage, at: Date.now(), experiment: 'reviewed-practice-v1', question_count: 5 };
    try { const previous = JSON.parse(localStorage.getItem(PRACTICE_EVIDENCE_KEY) || '[]'); localStorage.setItem(PRACTICE_EVIDENCE_KEY, JSON.stringify([...(Array.isArray(previous) ? previous.filter(item => ['invite_open','practice_first_answer','acknowledged_completion','practice_return'].includes(item?.stage)).map(item => ({ stage: item.stage, at: Number(item.at), experiment: 'reviewed-practice-v1', question_count: 5 })) : []), event].slice(-100))); } catch {}
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') gtag('event', stage, { experiment: event.experiment, question_count: 5, page_location: window.location.origin + window.location.pathname, page_referrer: '' });
  }
  private cueKey(uid: string) { return 'gtop.practice.cue.v1.' + uid; }
  private attemptMatches(questions: any[]): boolean {
    const seed = this.active?.seed;
    return !!seed && questions.length === 5 && new Set(questions.map(q => q.id)).size === 5 && questions.every(q => seed.questionIds.includes(q.id) && sameScope(q, seed.scope));
  }
}
