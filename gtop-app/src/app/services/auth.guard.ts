import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, map, take } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class AuthGuard implements CanActivate {
    constructor(private authService: AuthService, private router: Router) { }

    canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
        return this.authService.readyUser$.pipe(take(1),
            map(user => {
                if (user) {
                    if (user.board && user.standard) {
                        return true; // ✅ Allow access if profile is complete
                    } else {
                        return this.router.createUrlTree(['/profile-setup'], { queryParams: { returnUrl: state.url } });
                    }
                }
                return this.router.createUrlTree(['/'], { queryParams: { returnUrl: state.url } });
            })
        );
    }
}
