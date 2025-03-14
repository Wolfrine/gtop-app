import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, map } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class AuthGuard implements CanActivate {
    constructor(private authService: AuthService, private router: Router) { }

    canActivate(): Observable<boolean> {
        return this.authService.user$.pipe(
            map(user => {
                if (user) {
                    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
                    if (localUser.board && localUser.standard) {
                        return true; // Allow access
                    } else {
                        this.router.navigate(['/profile-setup']);
                        return false; // Redirect to complete profile setup
                    }
                }
                this.router.navigate(['/']);
                return false; // Redirect to Landing Page if not authenticated
            })
        );
    }
}
