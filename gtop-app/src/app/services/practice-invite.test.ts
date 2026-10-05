import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { convertToParamMap, Router, NavigationStart } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { createHash, webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { PracticeInviteService, REVIEWED_PRACTICE_SEEDS, INVITED_SOLO_READY, PRACTICE_EVIDENCE_KEY, INVITATION_PRESENTATION } from './practice-invite.service';
import { matchesProfile, matchesReviewedContent, parsePracticeScope, practiceParams, reviewedPractice, validatePracticeQuestions, PRACTICE_DELAY } from './practice-invite.domain';
import type { ReviewedPractice } from './practice-invite.domain';

const reads = vi.hoisted(() => ({ getDoc: vi.fn() }));
vi.mock('@angular/fire/firestore', () => ({ Firestore: class {}, doc: (_db: unknown, _collection: string, id: string) => id, getDocFromServer: reads.getDoc }));
const scope = { board: 'Fixture Board', standard: '12', subject: 'Fixture Chemistry', chapter: 'Fixture Solutions' };
const questions = Array.from({ length: 5 }, (_, i) => ({ ...scope, id: `fixture-${i}`, question: 'Which statement is correct?', options: ['Correct', 'Incorrect'], correctIndex: 0, solutions: ['The correct statement explains the idea.', 'This is not correct.'], selectedIndex: null }));
const hash = (q: any) => createHash('sha256').update(JSON.stringify([q.board,q.standard,q.subject,q.chapter,q.question,q.options,q.correctIndex,q.solutions])).digest('hex');
const seed: ReviewedPractice = { scope, questionIds: questions.map(q => q.id), revision: 'fixture-reviewed-v1', reviewEvidence: 'fixture-only', contentHashes: Object.fromEntries(questions.map(q => [q.id,hash(q)])) };
const profile = { uid: 'fixture-user', role: 'user', board: scope.board, standard: scope.standard };

describe('reviewed practice invitation', () => {
  let user: any; let invites: PracticeInviteService; let ready: BehaviorSubject<any>; let events: Subject<any>;
  const create = (soloReady = true) => runInInjectionContext(Injector.create({ providers: [
    { provide: AuthService, useValue: { profile: () => user, readyUser$: ready } }, { provide: Firestore, useValue: {} },
    { provide: Router, useValue: { events, getCurrentNavigation: () => null } },
    { provide: REVIEWED_PRACTICE_SEEDS, useValue: [seed] }, { provide: INVITED_SOLO_READY, useValue: soloReady }, { provide: INVITATION_PRESENTATION, useValue: null }
  ] }), () => new PracticeInviteService());
  beforeEach(() => { user = { ...profile }; ready = new BehaviorSubject(user); events = new Subject(); localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('gtag', vi.fn()); reads.getDoc.mockReset(); reads.getDoc.mockImplementation(async id => ({ id, exists: () => true, data: () => questions.find(q => q.id === id) })); invites = create(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it('normalizes scalar and repeated ParamMap values and rejects ambiguous links', () => {
    expect(parsePracticeScope(convertToParamMap({ ...practiceParams(scope), subjects: scope.subject, chapters: scope.chapter }))).toEqual(scope);
    expect(parsePracticeScope(convertToParamMap(practiceParams(scope)))).toEqual(scope);
    for (const params of [{...practiceParams(scope),subjects:[scope.subject,'Other']},{...practiceParams(scope),count:'10'},{...practiceParams(scope),board:['A','B']},{...practiceParams(scope),chapters:[]},{...practiceParams(scope),board:'line\nfeed'}]) expect(parsePracticeScope(convertToParamMap(params))).toBeNull();
  });
  it('respects ordinary learner curriculum and intentional admin freedom', () => {
    expect(matchesProfile(scope, profile)).toBe(true);
    expect(matchesProfile(scope, { ...profile, standard: 12 })).toBe(true);
    expect(matchesProfile(scope, { ...profile, standard:'10' })).toBe(false);
    expect(matchesProfile(scope, { ...profile, board:'Other' })).toBe(false);
    expect(matchesProfile(scope, { ...profile, role:'admin', board:'Other', standard:'10' })).toBe(true);
    expect(matchesProfile(scope, null)).toBe(false);
  });
  it('requires exactly five distinct reviewed IDs with fingerprints', () => {
    expect(reviewedPractice(scope,[seed])).toBe(seed);
    expect(reviewedPractice(scope,[{...seed,questionIds:seed.questionIds.slice(0,4)}])).toBeNull();
    expect(reviewedPractice(scope,[{...seed,questionIds:Array(5).fill('fixture-0')}])).toBeNull();
    expect(reviewedPractice(scope,[{...seed,contentHashes:{}}])).toBeNull();
    expect(create(false).seed(scope)).toBeNull();
  });
  it('reads only authenticated matching scope, rejects missing/changed questions without fallback', async () => {
    user=null; await expect(invites.questions(scope)).rejects.toThrow(); expect(reads.getDoc).not.toHaveBeenCalled();
    user={...profile,standard:'10'}; await expect(invites.questions(scope)).rejects.toThrow(); expect(reads.getDoc).not.toHaveBeenCalled();
    user={...profile}; expect(await invites.questions(scope)).toHaveLength(5);
    reads.getDoc.mockImplementation(async id=>({id,exists:()=>id!=='fixture-0',data:()=>questions.find(q=>q.id===id)})); await expect(invites.questions(scope)).rejects.toThrow();
    reads.getDoc.mockImplementation(async id=>({id,exists:()=>true,data:()=>({...questions.find(q=>q.id===id),question:'Changed source'})})); await expect(invites.questions(scope)).rejects.toThrow();
  });
  it('fails closed on source answer/explanation/metadata changes, retired content and unusable answers', async () => {
    expect(await matchesReviewedContent(seed,questions)).toBe(true);
    for (const changed of [{chapter:'Other'},{correctIndex:2},{solutions:[]},{options:['']},{status:'archived'},{paperOnly:true},{solutions:['Changed explanation','Other']}]) {
      const qs=questions.map((q,i)=>i===0?{...q,...changed}:q); expect(await matchesReviewedContent(seed,qs)).toBe(false);
    }
    expect(validatePracticeQuestions(seed,questions.slice(0,4))).toBe(false);
  });
});

