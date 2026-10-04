import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';
import { BehaviorSubject, Subject } from 'rxjs';
import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { PracticeInviteService, INVITATION_PRESENTATION, INVITED_SOLO_READY, REVIEWED_PRACTICE_SEEDS } from './practice-invite.service';
import { presentQuestion, restorePresentation, validOrder, canonicalIndex } from './question-presentation';
import { invitationReceiptId } from './practice-invite-session';
import { readPracticeSession, writePracticeSession } from './practice-session';
import { practiceParams } from './practice-invite.domain';
import { QuizPageComponent } from '../pages/quiz-page/quiz-page.component';
import { QuizSummaryComponent } from '../pages/quiz-summary/quiz-summary.component';

const scope = { board: 'CBSE', standard: '12', subject: 'Chemistry', chapter: 'Fixture topic' };
const profile = { uid: 'local-test-owner', role: 'user', board: 'CBSE', standard: '12' };
const sources = Array.from({ length: 5 }, (_, i) => ({ ...scope, id: `fixture-${i}`, question: 'Which statement?',
  options: ['Correct', 'Wrong', 'Another', 'Last'], correctIndex: 0, solutions: ['Option A is correct.', 'Second explanation.'], selectedIndex: null }));
const seed = { scope, revision: 'integration-fixture', reviewEvidence: 'local-fixture', questionIds: sources.map(q => q.id),
  contentHashes: Object.fromEntries(sources.map(q => [q.id, createHash('sha256').update(JSON.stringify([
    q.board, q.standard, q.subject, q.chapter, q.question, q.options, q.correctIndex, q.solutions])).digest('hex')])) };
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function setup() {
  const readyUser$ = new BehaviorSubject<any>(profile);
  const params = { ...practiceParams(scope), practice: 'invite' };
  const auth = { readyUser$, profile: () => readyUser$.value };
  let state: any = {};
  const router = { events: new Subject(), getCurrentNavigation: () => null,
    navigate: vi.fn(async (_: any, options: any) => { state = options?.state || {}; return true; }) };
  const invites = runInInjectionContext(Injector.create({ providers: [
    { provide: AuthService, useValue: auth }, { provide: Router, useValue: router }, { provide: Firestore, useValue: {} },
    { provide: INVITED_SOLO_READY, useValue: true }, { provide: REVIEWED_PRACTICE_SEEDS, useValue: [seed] },
    { provide: INVITATION_PRESENTATION, useValue: { presentQuestion, restorePresentation, validOrder, canonicalIndex } }
  ] }), () => new PracticeInviteService());
  const quiz = { consumePendingRetry: vi.fn(), fetchQuestionsFromRandomChapter: vi.fn(), fetchCustomQuizQuestions: vi.fn(),
    setQuestions: vi.fn(), saveQuizResult: vi.fn() };
  const player = () => new QuizPageComponent(quiz as any, {} as any, router as any,
    { snapshot: { queryParams: params }, queryParams: new BehaviorSubject(params) } as any, auth as any, invites);
  const summary = () => new QuizSummaryComponent(quiz as any, auth as any,
    { ...router, getCurrentNavigation: () => ({ extras: { state } }) } as any,
    { snapshot: { queryParams: {} } } as any, {} as any, invites);
  return { invites, quiz, player, summary, readyUser$ };
}
describe('actual solo invitation integration', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('loads the dedicated attempt, resumes its answer/order, and offers consent only for the real acknowledged receipt', async () => {
    const s = setup(); const attempt = await s.invites.prepare(scope, sources, {}); expect(s.invites.commit(attempt)).toBe(true);
    const first = s.player(); first.ngOnInit(); await flush();
    expect(s.quiz.consumePendingRetry).not.toHaveBeenCalled(); expect(s.quiz.fetchCustomQuizQuestions).not.toHaveBeenCalled();
    first.selectOption(first.questions[0].correctIndex); first.nextQuestion(); first.ngOnDestroy();
    const resumed = s.player(); resumed.ngOnInit(); await flush();
    expect(resumed.currentQuestionIndex).toBe(1); expect(resumed.questions[0].optionOrder).toEqual(attempt.questions[0].optionOrder);
    expect(resumed.questions[0].selectedIndex).toBe(resumed.questions[0].correctIndex);
    for (let i = 1; i < 5; i++) { resumed.selectOption(resumed.questions[i].correctIndex); resumed.nextQuestion(); }
    expect(s.invites.current()?.completed).toBe(true); expect(s.invites.completion()).toBeNull();
    let acknowledge!: (id: string) => void;
    s.quiz.saveQuizResult.mockImplementation(() => new Promise(resolve => acknowledge = resolve));
    const summary = s.summary(); summary.ngOnInit();
    await vi.waitFor(() => expect(s.quiz.saveQuizResult).toHaveBeenCalledOnce());
    expect(summary.saveState).toBe('saving'); expect(s.invites.completion()).toBeNull();
    const payload = s.quiz.saveQuizResult.mock.calls[0][1];
    expect(payload.invitation.attemptId).toBe(attempt.attemptId); expect(payload.invitation.snapshots).toEqual(attempt.snapshots);
    expect(payload.questions.every((q: any) => q.selectedIndex === 0 && q.correctIndex === 0)).toBe(true);
    acknowledge(invitationReceiptId(profile.uid, attempt.attemptId)); await flush();
    expect(summary.saveState).toBe('saved'); expect(s.invites.completion()).toEqual(scope);
    expect(s.invites.dismiss()).toBe(true); summary.ngOnDestroy(); resumed.ngOnDestroy();
    const reloaded = s.summary(); reloaded.ngOnInit();
    await vi.waitFor(() => expect(reloaded.saveState).toBe('saved'));
    expect(s.invites.completion()).toBeNull(); expect(s.quiz.saveQuizResult).toHaveBeenCalledOnce(); reloaded.ngOnDestroy();
  });
  it('does not overwrite a completed unsaved ordinary quiz or accept a stale account acknowledgement', async () => {
    const s = setup(); const attempt = await s.invites.prepare(scope, sources, {}); s.invites.commit(attempt);
    writePracticeSession({ version: 1, uid: profile.uid, role: profile.role, routeKey: 'ordinary', attemptId: 'unsaved-ordinary', quizType: 'quick',
      questions: [sources[0]], currentQuestionIndex: 0, completed: true, saved: false });
    const blocked = s.player(); blocked.ngOnInit(); await flush();
    expect(blocked.loadError).toContain('previous quiz result'); expect(readPracticeSession(profile.uid)?.attemptId).toBe('unsaved-ordinary'); blocked.ngOnDestroy();
    sessionStorage.removeItem('gtop.practice-session.v1');
    const player = s.player(); player.ngOnInit(); await flush();
    for (let i = 0; i < 5; i++) { player.selectOption(player.questions[i].correctIndex); player.nextQuestion(); }
    let acknowledge!: (id: string) => void;
    s.quiz.saveQuizResult.mockImplementation(() => new Promise(resolve => acknowledge = resolve));
    const summary = s.summary(); summary.ngOnInit(); await vi.waitFor(() => expect(s.quiz.saveQuizResult).toHaveBeenCalledOnce());
    s.readyUser$.next({ ...profile, uid: 'other-owner' }); acknowledge(invitationReceiptId(profile.uid, attempt.attemptId)); await flush();
    expect(summary.saveState).toBe('error'); expect(s.invites.completion()).toBeNull(); expect(s.invites.cue()).toBeNull();
    summary.ngOnDestroy(); player.ngOnDestroy();
  });
});
