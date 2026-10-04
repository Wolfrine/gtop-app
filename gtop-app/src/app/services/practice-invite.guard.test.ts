import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { Router, convertToParamMap } from '@angular/router';
import { Subject, BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { QuizService } from './quiz.service';
import { PracticeInviteService } from './practice-invite.service';
import { practiceInviteGuard } from './practice-invite.guard';
import { practiceParams, practiceReturns } from './practice-invite.domain';

const scope={board:'Fixture Board',standard:'12',subject:'Science',chapter:'Motion'};
const setup=(readyUser$:any, profile:any) => {
  const auth={readyUser$,profile:()=>profile};
  const router={createUrlTree:vi.fn((path,options)=>({path,options}))};
  const quiz={setPendingRetry:vi.fn()};
  const invites={clearAttempt:vi.fn(),seed:vi.fn(()=>({scope})),questions:vi.fn(async()=>Array(5).fill({id:'fixture'})),begin:vi.fn()};
  const injector=Injector.create({providers:[{provide:AuthService,useValue:auth},{provide:Router,useValue:router},{provide:QuizService,useValue:quiz},{provide:PracticeInviteService,useValue:invites}]});
  const guard=(extra={})=>runInInjectionContext(injector,()=>practiceInviteGuard({queryParamMap:convertToParamMap({...practiceParams(scope),practice:'invite',...extra})} as any,{} as any));
  return {guard,auth,router,quiz,invites};
};
describe('invitation launch guard',()=>{
  it('waits for restored profile even when other canActivate guards run concurrently',async()=>{
    const ready=new Subject<any>();const state=setup(ready,null);let settled=false;
    const pending=Promise.resolve(state.guard()).then(value=>{settled=true;return value;});await Promise.resolve();expect(settled).toBe(false);expect(state.invites.questions).not.toHaveBeenCalled();
    const profile={uid:'fixture-user',role:'user',board:scope.board,standard:scope.standard};state.auth.profile=()=>profile;
    ready.next(profile);expect(await pending).toBe(true);expect(state.quiz.setPendingRetry).toHaveBeenCalledOnce();expect(state.invites.begin).toHaveBeenCalledWith(scope);
  });
  it('refuses conflicting live/run/retry modes before reading any questions',async()=>{
    const profile={uid:'fixture-user',role:'admin',board:'Other',standard:'10'};const state=setup(new BehaviorSubject(profile),profile);
    for(const extra of [{live:'1'},{live:'0'},{sessionId:'private-session'},{mode:'run'},{retry:'summary'},{scope:'all'}]) expect(await state.guard(extra)).toMatchObject({path:['/practice']});
    expect(state.invites.questions).not.toHaveBeenCalled();expect(state.quiz.setPendingRetry).not.toHaveBeenCalled();
  });
  it('stops curriculum mismatch, malformed scope and content failure without random fallback',async()=>{
    const user={uid:'fixture-user',role:'user',board:scope.board,standard:'10'};const state=setup(new BehaviorSubject(user),user);
    expect(await state.guard()).toMatchObject({path:['/practice']});expect(state.invites.questions).not.toHaveBeenCalled();
    expect(await state.guard({returnTo:'/dashboard',hubReturnPath:'/practice'})).toMatchObject({options:{queryParams:{returnTo:'/dashboard',hubReturnPath:'/practice'}}});
    expect(await state.guard({subjects:['Science','Other']})).toMatchObject({path:['/practice']});
    const admin={...user,role:'admin'};state.auth.readyUser$=new BehaviorSubject(admin);state.invites.questions.mockRejectedValue(new Error('changed-content'));
    expect(await state.guard()).toMatchObject({path:['/practice'],options:{queryParams:{unavailable:'1'}}});expect(state.quiz.setPendingRetry).not.toHaveBeenCalled();
  });
  it('existing auth guard preserves invitation and Hub return parameters through sign-in/profile',async()=>{
    const ready=new Subject<any>();const router={createUrlTree:vi.fn((path,options)=>({path,options}))};const auth=new AuthGuard({readyUser$:ready} as any,router as any);
    const url='/quiz?board=Fixture&standard=12&subjects=Science&chapters=Motion&count=5&practice=invite&returnTo=%2Fdashboard&hubReturnPath=%2Fpractice';
    const values:any[]=[];auth.canActivate({} as any,{url} as any).subscribe(value=>values.push(value));ready.next(null);expect(values[0]).toEqual({path:['/'],options:{queryParams:{returnUrl:url}}});
    auth.canActivate({} as any,{url} as any).subscribe(value=>values.push(value));ready.next({uid:'fixture-user'});expect(values[1]).toEqual({path:['/profile-setup'],options:{queryParams:{returnUrl:url}}});
  });
  it('strips malicious or ambiguous returns before the solo player can read them',async()=>{
    const user={uid:'fixture-user',role:'user',board:scope.board,standard:scope.standard};const state=setup(new BehaviorSubject(user),user);
    for(const value of ['javascript:alert(1)','//evil.test','https://evil.test','/\\evil.test','/%2f%2fevil.test','/dashboard?returnTo=https://evil.test','/unknown',' /dashboard','/dashboard\n']) {
      for(const key of ['returnTo','hubReturnPath']) {
        const result:any=await state.guard({[key]:value});expect(result.path).toEqual(['/quiz']);expect(result.options.queryParams[key]).toBeUndefined();expect(result.options.queryParams.practice).toBe('invite');
      }
    }
    expect(await state.guard({returnTo:['/dashboard','/reports']})).toMatchObject({path:['/quiz']});
    expect(state.invites.questions).not.toHaveBeenCalled();expect(state.quiz.setPendingRetry).not.toHaveBeenCalled();
    expect(practiceReturns(convertToParamMap({returnTo:'/dashboard',hubReturnPath:'/reports'}))).toEqual({returnTo:'/dashboard',hubReturnPath:'/reports'});
  });
  it('resumes an interrupted login with original scope, then validates returns and the restored profile',async()=>{
    const ready=new Subject<any>();const router={createUrlTree:vi.fn((path,options)=>({path,options}))};const loginGuard=new AuthGuard({readyUser$:ready} as any,router as any);
    const url='/quiz?board=Fixture%20Board&standard=12&subjects=Science&chapters=Motion&count=5&practice=invite&returnTo=javascript%3Aalert(1)&hubReturnPath=%2Fdashboard';
    let redirect:any;loginGuard.canActivate({} as any,{url} as any).subscribe(value=>redirect=value);ready.next(null);expect(redirect.options.queryParams.returnUrl).toBe(url);
    const params=Object.fromEntries(new URL(redirect.options.queryParams.returnUrl,'https://gtop.test').searchParams);
    const user={uid:'fixture-user',role:'user',board:scope.board,standard:scope.standard};const state=setup(new BehaviorSubject(user),user);
    const sanitized:any=await state.guard(params);expect(sanitized.options.queryParams).toEqual({...practiceParams(scope),practice:'invite',hubReturnPath:'/dashboard'});
    expect(await state.guard(sanitized.options.queryParams)).toBe(true);expect(state.quiz.setPendingRetry).toHaveBeenCalledOnce();
  });
});
