import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, map, take } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class RoleGuard implements CanActivate {
    constructor(private authService: AuthService, private router: Router) { }

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
        return this.authService.readyUser$.pipe(take(1),
            map(user => {
                let role = 'user'; // Default role

                if (user?.role) {
                    role = user.role;
                }

                const allowedRoles: string[] = route.data['roles'];

                console.log(`RoleGuard Check - User Role: ${role}, Allowed Roles: ${allowedRoles}`);

                if (allowedRoles.includes(role)) {
                    return true;
                }

                return this.router.createUrlTree(['/dashboard']);
            })
        );
    }
}
