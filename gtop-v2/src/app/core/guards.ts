import { inject, Injector } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import type { UserRole } from './models';

export const authGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const injector = inject(Injector);
  const router = inject(Router);
  const { AuthStore } = await import('./auth.store');
  const auth = injector.get(AuthStore);
  const current = await auth.ready();
  if (current.phase === 'authenticated') return true;
  return router.createUrlTree(['/'], { queryParams: { returnUrl: state.url } });
};

export const roleGuard =
  (roles: UserRole[]): CanActivateFn =>
  async () => {
    const injector = inject(Injector);
    const router = inject(Router);
    const { AuthStore } = await import('./auth.store');
    const auth = injector.get(AuthStore);
    const current = await auth.ready();
    if (current.phase === 'authenticated' && current.role && roles.includes(current.role))
      return true;
    return router.createUrlTree([current.role === 'admin' ? '/admin' : '/dashboard']);
  };

export const adminLearningRedirectGuard = (segment: string): CanActivateFn =>
  async (_route, state) => {
    const injector = inject(Injector);
    const router = inject(Router);
    const { AuthStore } = await import('./auth.store');
    const auth = injector.get(AuthStore);
    const current = await auth.ready();
    if (current.role !== 'admin') return true;
    const parsed = router.parseUrl(state.url);
    const currentPath = state.url.split(/[?#]/, 1)[0].replace(/^\//, '') || segment;
    return router.createUrlTree([`/admin/learning/${currentPath}`], {
      queryParams: parsed.queryParams,
      fragment: parsed.fragment ?? undefined,
    });
  };

export const legacyQuizEntryGuard: CanActivateFn = async (_route, state) => {
  const injector = inject(Injector);
  const router = inject(Router);
  const { AuthStore } = await import('./auth.store');
  const auth = injector.get(AuthStore);
  const current = await auth.ready();
  const parsed = router.parseUrl(state.url);
  const sessionId = parsed.queryParams['sessionId'];
  const mode = String(parsed.queryParams['mode'] ?? '').toLowerCase();
  const live = String(parsed.queryParams['live'] ?? '') === '1';
  const prefix = current.role === 'admin' ? '/admin/learning' : '';
  if (sessionId && mode === 'run')
    return router.createUrlTree([`${prefix}/quiz-run/lobby`, sessionId]);
  if (sessionId && (live || mode === 'live'))
    return router.createUrlTree([`${prefix}/live/play`, sessionId]);
  if (current.role === 'admin')
    return router.createUrlTree(['/admin/learning/quiz'], { queryParams: parsed.queryParams });
  return true;
};
