import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { Subject, firstValueFrom } from 'rxjs';
import { AuthGuard } from './auth.guard';
import { RoleGuard } from './role.guard';

describe('restored session route guards', () => {
  it('waits for the profile before deciding and preserves the requested sign-in path', async () => {
    const readyUser$ = new Subject<any>();
    const createUrlTree = vi.fn((path, options) => ({ path, options }));
    const guard = new AuthGuard({ readyUser$ } as any, { createUrlTree } as any);
    let finished = false;
    const result = firstValueFrom(guard.canActivate({} as any, { url: '/admin/question-paper-generator' } as any)).then(value => { finished = true; return value; });
    await Promise.resolve();
    expect(finished).toBe(false);
    readyUser$.next({ uid: 'admin', role: 'admin', board: 'CBSE', standard: '10' });
    expect(await result).toBe(true);
    const signedOut = firstValueFrom(guard.canActivate({} as any, { url: '/admin/question-review' } as any));
    readyUser$.next(null);
    expect(await signedOut).toEqual({ path: ['/'], options: { queryParams: { returnUrl: '/admin/question-review' } } });
  });
  it('requires the current admin role for new modules', async () => {
    const readyUser$ = new Subject<any>();
    const guard = new RoleGuard({ readyUser$ } as any, { createUrlTree: () => 'dashboard' } as any);
    const route = { data: { roles: ['admin'] } } as any;
    const admin = firstValueFrom(guard.canActivate(route));
    readyUser$.next({ role: 'admin' });
    expect(await admin).toBe(true);
    const demoted = firstValueFrom(guard.canActivate(route));
    readyUser$.next({ role: 'user' });
    expect(await demoted).toBe('dashboard');
  });
});
