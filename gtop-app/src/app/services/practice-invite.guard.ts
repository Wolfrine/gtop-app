import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
import { AuthService } from './auth.service';
import { QuizService } from './quiz.service';
import { PracticeInviteService } from './practice-invite.service';
import { matchesProfile, parsePracticeScope, practiceParams, practiceReturns } from './practice-invite.domain';

export const invitedQuizMatch: CanMatchFn = () => inject(Router).getCurrentNavigation()?.extractedUrl.queryParamMap.get('practice') === 'invite';
export const practiceInviteGuard: CanActivateFn = async route => {
  const router = inject(Router); const auth = inject(AuthService); const quiz = inject(QuizService); const invites = inject(PracticeInviteService);
  invites.clearAttempt();
  const scope = parsePracticeScope(route.queryParamMap);
  if (!scope) return router.createUrlTree(['/practice']);
  const returns = practiceReturns(route.queryParamMap);
  const preview = (unavailable = false) => router.createUrlTree(['/practice'], { queryParams: { ...practiceParams(scope), ...returns, unavailable: unavailable ? '1' : undefined } });
  if (['live', 'sessionId', 'mode', 'retry', 'scope'].some(key => route.queryParamMap.has(key))) return preview(true);
  // Direct links and interrupted login can bypass the preview. Sanitize before player input.
  if (['returnTo', 'hubReturnPath'].some(key => route.queryParamMap.has(key) && !(key in returns)))
    return router.createUrlTree(['/quiz'], { queryParams: { ...practiceParams(scope), practice: 'invite', ...returns } });
  // canActivate guards run concurrently; await hydration independently of AuthGuard.
  const profile = await firstValueFrom(auth.readyUser$.pipe(take(1)));
  if (!matchesProfile(scope, profile) || !invites.seed(scope)) return preview();
  try {
    const questions = await invites.questions(scope);
    if (auth.profile()?.uid !== profile.uid || !matchesProfile(scope, auth.profile())) return preview();
    // Reuse existing asynchronous solo pending-question flow; no random chapter fallback.
    quiz.setPendingRetry(questions, { source: 'summary', type: 'all', metadata: scope });
    invites.begin(scope); return true;
  } catch { return preview(true); }
};
