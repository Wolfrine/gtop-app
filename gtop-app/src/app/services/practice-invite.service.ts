import { Injectable, InjectionToken, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationStart } from '@angular/router';
import { Firestore, doc, getDocFromServer } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { REVIEWED_PRACTICES } from './reviewed-practices';
import { PracticeScope, PracticeCue, ReviewedPractice, PRACTICE_DELAY, matchesProfile, reviewedPractice, matchesReviewedContent, validCue, sameScope } from './practice-invite.domain';
import { InvitationAttempt, InvitationPresentation, createInvitationAttempt, restoreInvitationAttempt, checkpointInvitation,
  invitationStorageKey, invitationReceiptId, invitationResult } from './practice-invite-session';

export const REVIEWED_PRACTICE_SEEDS = new InjectionToken<readonly ReviewedPractice[]>('Reviewed practice seeds', { providedIn: 'root', factory: () => REVIEWED_PRACTICES });
export const INVITED_SOLO_READY = new InjectionToken<boolean>('Invited solo engineering ready', { providedIn: 'root', factory: () => false });
export const INVITATION_PRESENTATION = new InjectionToken<InvitationPresentation | null>('Reviewed invitation presentation helpers', { providedIn: 'root', factory: () => null });
export type PracticeEvent = 'invite_exposure' | 'invite_open' | 'practice_first_answer' | 'acknowledged_completion' | 'practice_return_click' | 'practice_return';
export const PRACTICE_EVIDENCE_KEY = 'gtop.practice.evidence.v1';
const stages: PracticeEvent[] = ['invite_exposure','invite_open','practice_first_answer','acknowledged_completion','practice_return_click','practice_return'];

@Injectable({ providedIn: 'root' })
export class PracticeInviteService {
  private readonly auth = inject(AuthService); private readonly firestore = inject(Firestore);
  private readonly seeds = inject(REVIEWED_PRACTICE_SEEDS); private readonly soloReady = inject(INVITED_SOLO_READY);
  private readonly presentation = inject(INVITATION_PRESENTATION);
  private readonly router = inject(Router, { optional: true }); private readonly destroyRef = inject(DestroyRef);
  readonly completion = signal<PracticeScope | null>(null);
  private active: InvitationAttempt | null = null;
  private generation = 0;
  private profileKey = '';
  private candidates = new WeakMap<InvitationAttempt, { generation: number; navigationId?: number; parentAttemptId?: string }>();
  private returnIntent: { uid: string; cue: PracticeCue } | null = null;
  constructor() {
    this.auth.readyUser$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(profile => {
      const key = JSON.stringify([profile?.uid, profile?.role, profile?.board, profile?.standard]);
      if (key !== this.profileKey) { this.generation++; this.profileKey = key; }
      if (this.active && !this.owns(this.active, profile)) this.clearAttempt();
      if (this.returnIntent?.uid !== profile?.uid) this.returnIntent = null;
    });
    this.router?.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (!(event instanceof NavigationStart)) return;
      this.generation++; if (!this.active) return;
      const [path, search] = event.url.split('?'); const params = new URLSearchParams(search || '');
      const state = this.router?.getCurrentNavigation()?.extras.state;
      const invitedSolo = path === '/quiz' && params.get('practice') === 'invite';
      const currentSummary = path === '/quiz-summary' && !params.has('sessionId') && !params.has('userId') && !state?.['fromLive'] && !state?.['questionSummaries'] && !state?.['session'] && state?.['attemptId'] === this.active.attemptId;
      if (!invitedSolo && !currentSummary) this.clearAttempt();
    });
  }
  seed(scope: PracticeScope) { return this.soloReady ? reviewedPractice(scope, this.seeds) : null; }
  async questions(scope: PracticeScope): Promise<any[]> {
    const seed = this.seed(scope); const owner = this.auth.profile()?.uid;
    if (!seed || !matchesProfile(scope, this.auth.profile())) throw new Error('practice-unavailable');
    const snapshots = await Promise.all(seed.questionIds.map(id => getDocFromServer(doc(this.firestore, 'questions', id))));
    const questions = snapshots.filter(snapshot => snapshot.exists()).map(snapshot => ({ ...snapshot.data(), id: snapshot.id, selectedIndex: null }));
    const reviewed = await matchesReviewedContent(seed, questions);
    if (!reviewed || this.auth.profile()?.uid !== owner || !matchesProfile(scope, this.auth.profile())) throw new Error('practice-unavailable');
    return questions;
  }
  /** Preparation has no storage/global-source mutation; guard commits after navigation/account checks. */
  async recover(scope: PracticeScope, returns: { returnTo?: string; hubReturnPath?: string }): Promise<InvitationAttempt | null> {
    const profile = this.auth.profile(); const seed = this.seed(scope);
    const generation = this.generation; const navigationId = this.router?.getCurrentNavigation()?.id;
    if (!profile?.uid || !seed || !this.presentation || this.returnIntent) return null;
    const raw = JSON.parse(sessionStorage.getItem(invitationStorageKey(profile.uid)) || 'null');
    if (!raw || !sameScope(raw.scope || {}, scope)) return null;
    const restored = await restoreInvitationAttempt(raw, profile, seed, this.presentation);
    if (!restored) throw new Error('practice-session-invalid');
    const { returnTo, hubReturnPath, ...base } = restored;
    const candidate = { ...base, ...returns };
    this.candidates.set(candidate, { generation, navigationId }); return candidate;
  }
  async prepare(scope: PracticeScope, sources: any[], returns: { returnTo?: string; hubReturnPath?: string }, retryOf?: string): Promise<InvitationAttempt> {
    const profile = this.auth.profile(); const seed = this.seed(scope);
    const generation = this.generation; const navigationId = this.router?.getCurrentNavigation()?.id;
    if (!seed || !this.presentation || !matchesProfile(scope, profile)) throw new Error('practice-adapter-unavailable');
    const previous = JSON.parse(sessionStorage.getItem(invitationStorageKey(profile.uid)) || 'null');
    const restored = previous && sameScope(previous.scope || {}, scope) ? await restoreInvitationAttempt(previous, profile, seed, this.presentation) : null;
    if (previous && sameScope(previous.scope || {}, scope) && !restored) throw new Error('practice-session-invalid');
    if (retryOf && (restored?.attemptId !== retryOf || !restored.acknowledgedReceipt)) throw new Error('practice-retry-unavailable');
    const attempt = restored && !restored.acknowledgedReceipt ? restored : await createInvitationAttempt(profile, seed, sources, this.presentation, crypto.randomUUID(), retryOf ? restored! : undefined);
    const intent = this.returnIntent;
    const returnCue = intent && intent.uid === profile.uid && sameScope(intent.cue.scope, scope) ? intent.cue : null;
    const { returnTo, hubReturnPath, ...base } = attempt;
    const candidate = { ...base, ...returns, ...(returnCue ? { returnCueDueAt: returnCue.dueAt } : {}) };
    this.candidates.set(candidate, { generation, navigationId }); return candidate;
  }
  async prepareRetry(attemptId: string, sources: any[]): Promise<InvitationAttempt> {
    const active = this.active; const seed = active && this.seed(active.scope);
    const generation = this.generation; const navigationId = this.router?.getCurrentNavigation()?.id;
    if (!active || !seed || !this.presentation || active.attemptId !== attemptId || !this.owns(active)) throw new Error('practice-retry-unavailable');
    const candidate = await createInvitationAttempt(this.auth.profile(), seed, sources, this.presentation, crypto.randomUUID(), active);
    this.candidates.set(candidate, { generation, navigationId, parentAttemptId: attemptId }); return candidate;
  }
  /** Current-attempt summary restoration only; reports/history must use invitationHistory instead. */
  async resumeSummary(attemptId: string): Promise<boolean> {
    const profile = this.auth.profile(); if (!profile?.uid || !this.presentation) return false;
    const generation = this.generation; const navigationId = this.router?.getCurrentNavigation()?.id;
    let raw: any; try { raw = JSON.parse(sessionStorage.getItem(invitationStorageKey(profile.uid)) || 'null'); } catch { return false; }
    const seed = raw && this.seed(raw.scope); if (!seed || raw.attemptId !== attemptId) return false;
    const restored = await restoreInvitationAttempt(raw, profile, seed, this.presentation);
    // NavigationEnd clears getCurrentNavigation; NavigationStart already invalidates generation.
    if (!restored?.completed || !this.owns(restored) || generation !== this.generation) return false;
    this.generation++; this.active = restored;
    this.completion.set(restored.acknowledgedReceipt && restored.offerDecision === 'pending' ? restored.scope : null);
    return true;
  }
  commit(attempt: InvitationAttempt): boolean {
    const candidate = this.candidates.get(attempt);
    if (!candidate || candidate.generation !== this.generation ||
      (candidate.navigationId !== undefined && this.router?.getCurrentNavigation()?.id !== candidate.navigationId) ||
      (candidate.parentAttemptId && this.active?.attemptId !== candidate.parentAttemptId) || !this.owns(attempt) || !this.persist(attempt)) return false;
    this.candidates.delete(attempt); this.generation++; this.active = attempt; this.completion.set(null); return true;
  }
  /** Dedicated reliability source. Do not pass through pendingRetry or shuffle again. */
  current(): InvitationAttempt | null { return this.active && this.owns(this.active) ? JSON.parse(JSON.stringify(this.active)) : null; }
  started(attemptId: string): void {
    const attempt = this.active; if (!attempt || attempt.attemptId !== attemptId || !this.owns(attempt) || attempt.completed) return;
    const cue = this.cue();
    if (cue && cue.dueAt <= Date.now() && cue.dueAt === attempt.returnCueDueAt && sameScope(cue.scope, attempt.scope)) {
      this.generation++; this.track('practice_return'); this.off(); delete attempt.returnCueDueAt; this.persist(attempt);
    }
    this.returnIntent = null;
  }
  checkpoint(attemptId: string, questions: any[], currentIndex: number, completed = false): boolean {
    const active = this.active; if (!active || !this.presentation || !this.owns(active)) return false;
    const next = checkpointInvitation(active, attemptId, questions, currentIndex, this.presentation, completed);
    if (!next || !this.persist(next)) return false;
    this.generation++; this.active = next; if (!active.firstAnswer && next.firstAnswer) this.track('practice_first_answer'); return true;
  }
  result(attemptId: string) {
    if (!this.active || !this.presentation || this.active.attemptId !== attemptId || !this.owns(this.active)) throw new Error('practice-result-unavailable');
    return invitationResult(this.active, this.presentation);
  }
  /** Only the server-acknowledged save callback may pass its captured exact attempt/result IDs. */
  acknowledgeCompletion(attemptId: string, receiptId: string): boolean {
    const active = this.active;
    if (!active || active.attemptId !== attemptId || active.acknowledgedReceipt || !active.completed || !active.firstAnswer ||
      !this.owns(active) || receiptId !== invitationReceiptId(active.uid, attemptId)) return false;
    const next = { ...active, acknowledgedReceipt: receiptId }; if (!this.persist(next)) return false;
    this.generation++; this.active = next; if (next.offerDecision === 'pending') this.completion.set(next.scope);
    this.track('acknowledged_completion'); return true;
  }
  keep(): boolean {
    const active = this.active; if (!active?.acknowledgedReceipt || !this.completion() || !this.owns(active)) return false;
    const next: InvitationAttempt = { ...active, offerDecision: 'kept' }; if (!this.persist(next)) return false;
    try { localStorage.setItem(this.cueKey(active.uid), JSON.stringify({ scope: active.scope, revision: active.revision, dueAt: Date.now() + PRACTICE_DELAY }));
      this.generation++; this.active = next; this.completion.set(null); return true;
    } catch { this.persist(active); return false; }
  }
  dismiss(): boolean {
    if (!this.active || !this.owns(this.active)) return false;
    const next: InvitationAttempt = { ...this.active, offerDecision: 'dismissed' }; if (!this.persist(next)) return false;
    this.generation++; this.active = next; this.completion.set(null); return true;
  }
  clearAttempt(): void { this.generation++; this.active = null; this.completion.set(null); }
  cue(): PracticeCue | null {
    const profile = this.auth.profile(); if (!profile?.uid) return null;
    try { const value = JSON.parse(localStorage.getItem(this.cueKey(profile.uid)) || 'null');
      return validCue(value) && matchesProfile(value.scope, profile) && this.seed(value.scope)?.revision === value.revision ? value : null;
    } catch { return null; }
  }
  off(): boolean {
    const uid = this.auth.profile()?.uid; if (!uid) return false;
    try { localStorage.removeItem(this.cueKey(uid)); return localStorage.getItem(this.cueKey(uid)) === null; } catch { return false; }
  }
  requestReturn(cue: PracticeCue): void {
    const current = this.cue(); const uid = this.auth.profile()?.uid;
    if (uid && current && current.dueAt === cue.dueAt && cue.dueAt <= Date.now() && sameScope(current.scope, cue.scope)) {
      this.returnIntent = { uid, cue }; this.track('practice_return_click');
    }
  }
  track(stage: PracticeEvent): void {
    // Data-minimal hooks. Existing analytics transport may carry its own identifiers.
    const event = { stage, at: Date.now(), experiment: 'reviewed-practice-v1', question_count: 5 };
    try { const previous = JSON.parse(localStorage.getItem(PRACTICE_EVIDENCE_KEY) || '[]'); localStorage.setItem(PRACTICE_EVIDENCE_KEY, JSON.stringify([...(Array.isArray(previous) ? previous.filter(item => stages.includes(item?.stage)).map(item => ({ stage: item.stage, at: Number(item.at), experiment: event.experiment, question_count: 5 })) : []), event].slice(-100))); } catch {}
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') gtag('event', stage, { experiment: event.experiment, question_count: 5, page_location: window.location.origin + window.location.pathname, page_referrer: '' });
  }
  private owns(attempt: InvitationAttempt, profile = this.auth.profile()) { return profile?.uid === attempt.uid && (profile.role || 'user') === attempt.role && matchesProfile(attempt.scope, profile); }
  private persist(attempt: InvitationAttempt): boolean { try { sessionStorage.setItem(invitationStorageKey(attempt.uid), JSON.stringify(attempt)); return true; } catch { return false; } }
  private cueKey(uid: string) { return 'gtop.practice.cue.v1.' + uid; }
}
