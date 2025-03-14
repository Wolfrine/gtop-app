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

                // ✅ Read role from LocalStorage first
                const localUser = JSON.parse(localStorage.getItem('user') || '{}');
                if (localUser?.role) {
                    role = localUser.role;
                } else if (user?.role) {
                    role = user.role;
                }

                const allowedRoles: string[] = route.data['roles']; // Allowed roles for this route

                console.log(`RoleGuard Check - User Role: ${role}, Allowed Roles: ${allowedRoles}`);

                if (allowedRoles.includes(role)) {
                    return true; // ✅ Allow access if the role matches any allowed roles
                }

                console.log("Unauthorized Access - Redirecting to /dashboard");
                this.router.navigate(['/unauthorized']); // ❌ Redirect unauthorized users
                return false;
            })
        );
    }




}
