import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { createHash, webcrypto } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { PracticeInviteService, INVITATION_PRESENTATION, INVITED_SOLO_READY, REVIEWED_PRACTICE_SEEDS, PRACTICE_EVIDENCE_KEY } from './practice-invite.service';
import { PracticeReturnCardComponent } from '../pages/practice-invite/practice-return.component';
import { ReviewedPractice, PRACTICE_DELAY } from './practice-invite.domain';
import { InvitationPresentation, createInvitationAttempt, checkpointInvitation, restoreInvitationAttempt, invitationResult, invitationHistory, invitationReceiptId, invitationStorageKey } from './practice-invite-session';

const scope={board:'Fixture Board',standard:'12',subject:'Science',chapter:'Motion'};
const sources=Array.from({length:5},(_,i)=>({...scope,id:`fixture-${i}`,question:'Which statement is correct?',options:['Correct','Incorrect'],correctIndex:0,solutions:['Reason one.','Reason two.'],selectedIndex:null}));
const hashes=Object.fromEntries(sources.map(q=>[q.id,createHash('sha256').update(JSON.stringify([q.board,q.standard,q.subject,q.chapter,q.question,q.options,q.correctIndex,q.solutions])).digest('hex')]));
const seed:ReviewedPractice={scope,questionIds:sources.map(q=>q.id),revision:'reviewed-fixture-v1',reviewEvidence:'fixture-only',contentHashes:hashes};
const profile={uid:'fixture-user',role:'user',board:scope.board,standard:scope.standard};
// A deterministic injected presentation boundary. Production must provide PR57's helpers.
const presentation:InvitationPresentation={
  validOrder:(order:any,length)=>Array.isArray(order)&&order.length===length&&new Set(order).size===length&&order.every(i=>Number.isInteger(i)&&i>=0&&i<length),
  canonicalIndex:(q,index)=>index===null?null:q.optionOrder[index],
  restorePresentation:(q,order:any,selected,correct)=>({...q,optionOrder:[...order],options:order.map((i:number)=>q.options[i]),selectedIndex:selected===null?null:order.indexOf(selected),correctIndex:order.indexOf(correct)}),
  presentQuestion:q=>presentation.restorePresentation(q,[1,0],null,q.correctIndex)
};
const answered=(qs:any[])=>qs.map(q=>({...q,selectedIndex:q.correctIndex}));

describe('durable reviewed invitation contract',()=>{
  let user:any,ready:BehaviorSubject<any>,events:Subject<any>,invites:PracticeInviteService;
  const create=()=>runInInjectionContext(Injector.create({providers:[{provide:AuthService,useValue:{profile:()=>user,readyUser$:ready}},{provide:Firestore,useValue:{}},
    {provide:Router,useValue:{events,getCurrentNavigation:()=>null}},{provide:REVIEWED_PRACTICE_SEEDS,useValue:[seed]},
    {provide:INVITED_SOLO_READY,useValue:true},{provide:INVITATION_PRESENTATION,useValue:presentation}]}),()=>new PracticeInviteService());
  const launch=async()=>{const value=await invites.prepare(scope,sources,{});expect(invites.commit(value)).toBe(true);return value;};
  const complete=async()=>{const value=await launch();expect(invites.checkpoint(value.attemptId,answered(value.questions),4,true)).toBe(true);return value;};
  const acknowledge=(id:string)=>invites.acknowledgeCompletion(id,invitationReceiptId(profile.uid,id));
  beforeEach(()=>{user={...profile};ready=new BehaviorSubject(user);events=new Subject();localStorage.clear();sessionStorage.clear();vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('gtag',vi.fn());invites=create();});
  afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
  it('prepares without side effects, restores ID/answers/order/index/first-answer, and never reshuffles on reload',async()=>{
    const candidate=await invites.prepare(scope,sources,{returnTo:'/dashboard'});expect(invites.current()).toBeNull();expect(sessionStorage.length).toBe(0);expect(invites.commit(candidate)).toBe(true);
    const qs=candidate.questions.map((q,i)=>({...q,selectedIndex:i===0?1:null}));expect(invites.checkpoint(candidate.attemptId,qs,1)).toBe(true);
    const shuffle=vi.spyOn(presentation,'presentQuestion');const reload=create();const restored=await reload.prepare(scope,sources,{});expect(restored.attemptId).toBe(candidate.attemptId);expect(restored.entryType).toBe('invitation');expect(restored.questions).toEqual(qs);expect(restored.currentQuestionIndex).toBe(1);expect(restored.firstAnswer).toBe(true);expect(shuffle).not.toHaveBeenCalled();
    expect(await restoreInvitationAttempt({...restored,uid:'other'},profile,seed,presentation)).toBeNull();expect(await restoreInvitationAttempt(restored,{...profile,role:'admin'},seed,presentation)).toBeNull();
  });
  it('rejects corrupted snapshots/order and stale answer callbacks without creating random replacements',async()=>{
    const attempt=await launch();expect(invites.checkpoint('older-attempt',answered(attempt.questions),4)).toBe(false);
    const invalid={...attempt,questions:attempt.questions.map((q,i)=>i? q:{...q,optionOrder:[0,0]})};expect(await restoreInvitationAttempt(invalid,profile,seed,presentation)).toBeNull();
    expect(await restoreInvitationAttempt({...attempt,snapshots:[...attempt.snapshots].reverse(),questions:[...attempt.questions].reverse()},profile,seed,presentation)).toBeNull();
    const corrupted={...attempt,snapshots:attempt.snapshots.map((q,i)=>i?q:{...q,solutions:['Changed source']})};sessionStorage.setItem(invitationStorageKey(profile.uid),JSON.stringify(corrupted));await expect(invites.prepare(scope,sources,{})).rejects.toThrow('practice-session-invalid');
    expect(checkpointInvitation(attempt,attempt.attemptId,attempt.questions.map(q=>({...q,optionOrder:[0,1],options:[...q.options].reverse(),correctIndex:0})),0,presentation)).toBeNull();
  });
  it('binds acknowledged receipts to the completed exact attempt; rejects late A/B and account callbacks',async()=>{
    const a=await complete();expect(invites.acknowledgeCompletion(a.attemptId,'optimistic')).toBe(false);expect(invites.keep()).toBe(false);expect(acknowledge(a.attemptId)).toBe(true);expect(acknowledge(a.attemptId)).toBe(false);
    const b=await launch();expect(b.attemptId).not.toBe(a.attemptId);expect(acknowledge(a.attemptId)).toBe(false);expect(invites.completion()).toBeNull();
    expect(invites.checkpoint(b.attemptId,answered(b.questions),4,true)).toBe(true);user={...profile,uid:'other'};ready.next(user);expect(acknowledge(b.attemptId)).toBe(false);expect(invites.keep()).toBe(false);
  });
  it('resumes unsaved completion and exposes offer only after actual receipt; dismissed consent stays dismissed',async()=>{
    const attempt=await complete();const reload=create();const restored=await reload.prepare(scope,sources,{});expect(restored.attemptId).toBe(attempt.attemptId);expect(restored.completed).toBe(true);expect(reload.commit(restored)).toBe(true);expect(reload.completion()).toBeNull();expect(reload.acknowledgeCompletion(restored.attemptId,invitationReceiptId(profile.uid,restored.attemptId))).toBe(true);
    reload.dismiss();expect(reload.keep()).toBe(false);expect(reload.cue()).toBeNull();const summary=create();expect(await summary.resumeSummary(restored.attemptId)).toBe(true);expect(summary.completion()).toBeNull();expect(await summary.resumeSummary('history-other')).toBe(false);
  });
  it('returns immutable canonical snapshots for persistence/history after later source edits',async()=>{
    const attempt=await complete();const result=invites.result(attempt.attemptId);expect(result.entryType).toBe('invitation');expect(result.answers[0].selectedIndex).toBe(0);expect(result.answers[0].optionOrder).toEqual([1,0]);expect(result.snapshots[0].options).toEqual(['Correct','Incorrect']);
    const changedBank=sources.map(q=>({...q,question:'Later edit',options:['Later answer','Different answer'],solutions:['Later explanation']}));expect(changedBank[0].question).not.toBe(result.snapshots[0].question);
    expect(await invitationHistory(result,seed,presentation)).toEqual(answered(attempt.questions));expect(await invitationHistory({...result,snapshots:changedBank},seed,presentation)).toBeNull();
    expect(await invitationHistory({...result,snapshots:[...result.snapshots].reverse(),answers:[...result.answers].reverse()},seed,presentation)).toBeNull();
    expect(()=>invitationResult({...attempt,completed:false},presentation)).toThrow();
  });
  it('deliberate invitation retry creates a fresh linked ID and clears answers, while ordinary resume does not',async()=>{
    const a=await complete();await expect(invites.prepareRetry(a.attemptId,sources)).rejects.toThrow();expect(acknowledge(a.attemptId)).toBe(true);
    const retry=await invites.prepareRetry(a.attemptId,sources);expect(retry.attemptId).not.toBe(a.attemptId);expect(retry.entryType).toBe('invitation-retry');expect(retry.parentAttemptId).toBe(a.attemptId);expect(retry.questions.every(q=>q.selectedIndex===null)).toBe(true);expect(retry.firstAnswer).toBe(false);expect(retry.acknowledgedReceipt).toBeUndefined();
    expect(invites.commit(retry)).toBe(true);expect((await invites.prepare(scope,sources,{})).attemptId).toBe(retry.attemptId);
  });
  it('reads retired revisions from saved immutable metadata without approving a new launch',async()=>{
    const attempt=await complete();const result=invites.result(attempt.attemptId);
    expect(await invitationHistory(result,undefined,presentation)).toEqual(answered(attempt.questions));
    expect(await invitationHistory({...result,scope:{...scope,chapter:''}},undefined,presentation)).toBeNull();
    expect(await invitationHistory({...result,contentHashes:{}},undefined,presentation)).toBeNull();
    const corrupted={...result,snapshots:result.snapshots.map((q:any,i:number)=>i?q:{...q,question:'Changed snapshot'})};
    expect(await invitationHistory(corrupted,undefined,presentation)).toBeNull();
    const invalidOrder={...result,answers:result.answers.map((a:any,i:number)=>i?a:{...a,optionOrder:[0,0]})};
    expect(await invitationHistory(invalidOrder,undefined,presentation)).toBeNull();
    expect(await invitationHistory(result,{...seed,revision:'replacement'},presentation)).toBeNull();
  });
  it('keeps a voluntary 24h local cue, reports failed Off honestly, then removes it when storage permits',async()=>{
    const a=await complete();expect(acknowledge(a.attemptId)).toBe(true);expect(invites.keep()).toBe(true);expect(invites.cue()?.dueAt).toBeGreaterThanOrEqual(Date.now()+PRACTICE_DELAY-30);
    const card=runInInjectionContext(Injector.create({providers:[{provide:PracticeInviteService,useValue:invites},{provide:AuthService,useValue:{readyUser$:ready}},{provide:Router,useValue:{}}]}),()=>new PracticeReturnCardComponent());card.ngOnInit();
    const failure=vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('blocked');});card.off();expect(card.cue()).not.toBeNull();expect(card.error()).toContain('still saved');expect(invites.cue()).not.toBeNull();failure.mockRestore();card.off();expect(card.cue()).toBeNull();expect(card.error()).toBe('');expect(invites.cue()).toBeNull();
  });
  it('separates return clicks from successful practice starts, keeps cue on failed navigation, and excludes identifiers from hooks',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));const a=await complete();expect(acknowledge(a.attemptId)).toBe(true);invites.keep();const cue=invites.cue()!;
    invites.requestReturn(cue);expect(JSON.parse(localStorage.getItem(PRACTICE_EVIDENCE_KEY)!).some((e:any)=>e.stage==='practice_return_click')).toBe(false);
    vi.advanceTimersByTime(PRACTICE_DELAY);invites.requestReturn(cue);expect(invites.cue()).not.toBeNull();let evidence=localStorage.getItem(PRACTICE_EVIDENCE_KEY)!;expect(evidence).toContain('practice_return_click');expect(JSON.parse(evidence).some((e:any)=>e.stage==='practice_return')).toBe(false);
    const b=await launch();invites.started(a.attemptId);expect(invites.cue()).not.toBeNull();invites.started(b.attemptId);expect(invites.cue()).toBeNull();evidence=localStorage.getItem(PRACTICE_EVIDENCE_KEY)!;expect(JSON.parse(evidence).filter((e:any)=>e.stage==='practice_return')).toHaveLength(1);
    for(const secret of [profile.uid,a.attemptId,b.attemptId,scope.board,scope.chapter,sources[0].id,sources[0].question])expect(evidence).not.toContain(secret);
    expect(JSON.stringify(vi.mocked((window as any).gtag).mock.calls)).not.toContain(profile.uid);
  });
  it('account or unrelated/history navigation clears the active source but retains its resumable private snapshot',async()=>{
    const attempt=await complete();acknowledge(attempt.attemptId);events.next(new NavigationStart(1,'/quiz-summary?sessionId=history'));expect(invites.current()).toBeNull();expect(invites.completion()).toBeNull();expect(sessionStorage.getItem(invitationStorageKey(profile.uid))).not.toBeNull();
    user={...profile,standard:'10'};ready.next(user);expect(await create().resumeSummary(attempt.attemptId)).toBe(false);
  });
  it('failed session storage cannot imply saved consent or commit a new source',async()=>{
    const attempt=await complete();acknowledge(attempt.attemptId);const original=Storage.prototype.setItem;
    const blocked=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key,value){if(key.startsWith('gtop.practice-invitation-session'))throw new Error('blocked');original.call(this,key,value);});
    expect(invites.keep()).toBe(false);expect(invites.dismiss()).toBe(false);expect(invites.completion()).toEqual(scope);expect(invites.cue()).toBeNull();expect(invites.commit({...attempt,attemptId:'new'})).toBe(false);blocked.mockRestore();
  });
  it('a delayed summary restore and a stale retry candidate cannot replace a newer attempt',async()=>{
    const a=await complete();acknowledge(a.attemptId);const staleRetry=await invites.prepareRetry(a.attemptId,sources);const b=await invites.prepare(scope,sources,{});
    const digest=crypto.subtle.digest.bind(crypto.subtle);const releases:Array<()=>void>=[];
    const delayed=vi.spyOn(crypto.subtle,'digest').mockImplementation((algorithm,data)=>new Promise(resolve=>releases.push(()=>{void digest(algorithm,data).then(resolve);})));
    const pending=invites.resumeSummary(a.attemptId);await vi.waitFor(()=>expect(releases).toHaveLength(5));expect(invites.commit(b)).toBe(true);expect(invites.commit(staleRetry)).toBe(false);
    releases.forEach(release=>release());expect(await pending).toBe(false);expect(invites.current()?.attemptId).toBe(b.attemptId);expect(acknowledge(a.attemptId)).toBe(false);delayed.mockRestore();
  });
  it('delayed same-attempt restoration cannot undo an acknowledged receipt or a later consent decision',async()=>{
    for(const mutation of ['acknowledge','dismiss','keep'] as const){
      sessionStorage.clear();localStorage.clear();invites.clearAttempt();const a=await complete();if(mutation!=='acknowledge')acknowledge(a.attemptId);
      const digest=crypto.subtle.digest.bind(crypto.subtle);const releases:Array<()=>void>=[];
      const delayed=vi.spyOn(crypto.subtle,'digest').mockImplementation((algorithm,data)=>new Promise(resolve=>releases.push(()=>{void digest(algorithm,data).then(resolve);})));
      const pending=invites.resumeSummary(a.attemptId);await vi.waitFor(()=>expect(releases).toHaveLength(5));
      expect(mutation==='acknowledge'?acknowledge(a.attemptId):mutation==='dismiss'?invites.dismiss():invites.keep()).toBe(true);
      releases.forEach(release=>release());expect(await pending).toBe(false);expect(invites.current()?.acknowledgedReceipt).toBe(invitationReceiptId(profile.uid,a.attemptId));
      if(mutation!=='acknowledge')expect(invites.current()?.offerDecision).toBe(mutation==='dismiss'?'dismissed':'kept');delayed.mockRestore();
    }
  });
});
