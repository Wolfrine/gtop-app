import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule],
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
    showBackButton: boolean = true;
    showHamburgerMenu: boolean = false;

    constructor(private router: Router) {
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.updateHeaderDisplay(event.url);
            }
        });
    }

    private updateHeaderDisplay(url: string) {
        if (url === '/dashboard') {
            this.showBackButton = false;
            this.showHamburgerMenu = true;
        } else {
            this.showBackButton = url !== '/';
            this.showHamburgerMenu = false;
        }
    }

    goBack() {
        this.router.navigate(['/']);
    }

    openMenu() {
        console.log('Hamburger menu clicked'); // Implement menu toggle logic here
    }
}
