import { Component, OnInit, ViewChild, HostListener, inject, isDevMode } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { SideNavComponent } from './components/side-nav/side-nav.component';
import { getAnalytics, logEvent, setCurrentScreen } from 'firebase/analytics';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        RouterOutlet,
        HeaderComponent,
        FooterComponent,
        CommonModule,
        MatSidenavModule,
        SideNavComponent
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
    @ViewChild('sidenav') sidenav!: any;

    title = "GTOP - APP"
    isLandingPage = false;
    isLandingAndProfile = false;
    isDesktop: boolean = window.innerWidth > 768;
    sidenavMode: 'side' | 'over' = this.isDesktop ? 'side' : 'over';

    private analytics: any; // Hold analytics instance

    constructor(private authService: AuthService, private router: Router) {
        // ✅ Initialize analytics only in production
        if (!isDevMode()) {
            this.analytics = getAnalytics();
        }

        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                if (event.url === '/') {
                    this.isLandingPage = true;
                    this.isLandingAndProfile = true;
                }
                else if (event.url === '/profile-setup') {
                    this.isLandingPage = false;
                    this.isLandingAndProfile = true;
                }
                else {
                    this.isLandingPage = false;
                    this.isLandingAndProfile = false;
                }

                // ✅ Fire Analytics page_view in Production only
                if (!isDevMode() && this.analytics) {
                    const pagePath = event.urlAfterRedirects;
                    setCurrentScreen(this.analytics, pagePath); // Optional
                    logEvent(this.analytics, 'page_view', { page_path: pagePath });
                }
            }
        });
    }

    ngOnInit() {
        this.authService.initGoogleOneTap();
    }

    @HostListener('window:resize', ['$event'])
    onResize(event: any) {
        this.isDesktop = event.target.innerWidth > 768;
        this.sidenavMode = this.isDesktop ? 'side' : 'over';

        if (!this.isDesktop && this.sidenav) {
            this.sidenav.close();
        }
    }

    toggleSidebar() {
        if (this.sidenav) {
            this.sidenav.toggle();
        }
    }
}
