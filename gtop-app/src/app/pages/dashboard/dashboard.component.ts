import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss',
    imports: [CommonModule, MatButtonModule]
})
export class DashboardComponent {
    user: any = null;

    constructor(private authService: AuthService, private router: Router) { }

    ngOnInit() {
        const localUser = localStorage.getItem('user');
        if (localUser) {
            this.user = JSON.parse(localUser);
        } else {
            this.authService.getUser().subscribe(user => {
                if (!user) {
                    this.router.navigate(['/']);
                }
                this.user = user;
            });
        }
    }

    logout() {
        this.authService.signOut();
    }
}
