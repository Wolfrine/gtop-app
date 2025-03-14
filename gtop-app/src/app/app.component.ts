import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';  // ✅ Correct Import
import { SideNavComponent } from './components/side-nav/side-nav.component';
import { MatDrawer } from '@angular/material/sidenav';
import { ActiveUsersService } from './services/active-users.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        RouterOutlet,
        HeaderComponent,
        FooterComponent,
        CommonModule,
        MatSidenavModule, // ✅ Corrected: Import MatSidenavModule instead of MatDrawer
        SideNavComponent
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
    private activeUsersService = inject(ActiveUsersService);
    @ViewChild('sidenav') sidenav!: MatDrawer;   // ✅ Ensure ViewChild properly detects the sidenav
    title = "GTOP - APP"
    isLandingPage = false;

    constructor(private authService: AuthService, private router: Router) {
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.isLandingPage = event.url === '/';
            }
        });
    }

    ngOnInit() {
        this.authService.initGoogleOneTap(); // 🔥 Ensure One Tap runs on load
    }

    toggleSidebar() {
        if (this.sidenav) {
            this.sidenav.toggle(); // ✅ Toggle the SideNav
        }
    }
}
