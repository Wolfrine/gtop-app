import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthStore } from './auth.store';
import { UserRole } from './models';

export const authGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const current = await auth.ready();
  if (current.phase === 'authenticated') return true;
  return router.createUrlTree(['/'], { queryParams: { returnUrl: state.url } });
};

export const roleGuard =
  (roles: UserRole[]): CanActivateFn =>
  async () => {
    const auth = inject(AuthStore);
    const router = inject(Router);
    const current = await auth.ready();
    if (current.phase === 'authenticated' && current.role && roles.includes(current.role))
      return true;
    return router.createUrlTree([current.role === 'admin' ? '/admin' : '/dashboard']);
  };
