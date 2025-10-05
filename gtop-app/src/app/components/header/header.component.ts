import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu'; // ✅ Import MatMenuModule
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatToolbarModule, MatMenuModule, RouterModule], // ✅ Add MatMenuModule + RouterModule
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
    showBackButton: boolean = false;
    showHamburgerMenu: boolean = true;
    user: any = null; // Stores authenticated user data

    @Output() toggleSidebar = new EventEmitter<void>();

    onMenuClick() {
        this.toggleSidebar.emit();
    }

    constructor(private authService: AuthService, private router: Router) {
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                setTimeout(() => this.updateHeaderDisplay(event.url), 0);
            }
        });
    }

    ngOnInit() {
        this.authService.getUser().subscribe((user) => {
            this.user = user;
        });

        // Ensure correct header state when component initializes
        setTimeout(() => this.updateHeaderDisplay(this.router.url), 0);
    }

    private updateHeaderDisplay(url: string) {
        if (url === '/profile-setup') {
            this.showBackButton = true;
            this.showHamburgerMenu = false;
        } else {
            this.showBackButton = false;
            this.showHamburgerMenu = true;
        }
    }

    goBack() {
        this.router.navigate(['/']);
    }

    // ✅ Sign out user
    signOut() {
        this.authService.signOut().then(() => {
            this.router.navigate(['/']);
        });
    }
}
