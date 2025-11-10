import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, map } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class RoleGuard implements CanActivate {
    constructor(private authService: AuthService, private router: Router) { }

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
        return this.authService.user$.pipe(
            map(user => {
                let role = 'user'; // Default role

                if (user?.role) {
                    role = user.role;
                }

                const allowedRoles: string[] = route.data['roles'];

                console.log(`RoleGuard Check - User Role: ${role}, Allowed Roles: ${allowedRoles}`);

                if (allowedRoles.includes(role) || (role === 'guest' && allowedRoles.includes('user'))) {
                    return true;
                }

                console.log("Unauthorized Access - Redirecting to /unauthorized");
                this.router.navigate(['/unauthorized']);
                return false;
            })
        );
    }
}
