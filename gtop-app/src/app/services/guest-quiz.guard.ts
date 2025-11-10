import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { GuestAccessService } from './guest-access.service';
import { Observable, from, of, switchMap, take, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class GuestQuizGuard implements CanActivate {
    constructor(
        private authService: AuthService,
        private guestAccessService: GuestAccessService,
        private router: Router
    ) { }

    canActivate(): Observable<boolean> {
        return this.authService.user$.pipe(
            take(1),
            switchMap(user => {
                if (!user) {
                    this.router.navigate(['/']);
                    return of(false);
                }

                const role = user['role'] || 'user';
                if (role !== 'guest') {
                    return of(true);
                }

                const uid = user['uid'];
                const cachedCount = typeof user['guestQuizCount'] === 'number' ? user['guestQuizCount'] : undefined;
                return from(this.guestAccessService.canAttemptQuiz(uid, cachedCount)).pipe(
                    tap(canAttempt => {
                        if (!canAttempt) {
                            this.router.navigate(['/dashboard'], {
                                state: { guestLimitReached: true }
                            });
                        }
                    })
                );
            })
        );
    }
}
