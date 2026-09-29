import { Component, OnInit, ViewChild, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { AuthService } from './services/auth.service';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { SideNavComponent } from './components/side-nav/side-nav.component';
import { LoggingService } from './services/logging.service';
import { AdminUsageService } from './services/admin-usage.service';
import { SeoService } from './services/seo.service';


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

    constructor(
        private authService: AuthService,
        private router: Router,
        private activatedRoute: ActivatedRoute,
        private loggingService: LoggingService,
        private seoService: SeoService,
        private usage: AdminUsageService
    ) {
        this.router.events.subscribe((event) => {
            // 🚀 SCROLL TO TOP on every route change
            window.scrollTo({ top: 0 });

            if (event instanceof NavigationEnd) {
                const deepestChild = this.getDeepestChild(this.activatedRoute);
                const seoData = deepestChild.snapshot.data['seo'];
                this.seoService.update(seoData);

                const pathname = event.urlAfterRedirects.split(/[?#]/)[0];
                if (pathname === '/') {
                    this.isLandingPage = true;
                    this.isLandingAndProfile = true;
                }
                else if (pathname === '/profile-setup') {
                    this.isLandingPage = false;
                    this.isLandingAndProfile = true;
                }
                else {
                    this.isLandingPage = false;
                    this.isLandingAndProfile = false;
                }

            }
        });
    }

    ngOnInit() {
        this.authService.initGoogleOneTap();
        this.usage.start();
    }

    @HostListener('window:resize', ['$event'])
    onResize(event: any) {
        this.isDesktop = event.target.innerWidth > 768;
        this.sidenavMode = this.isDesktop ? 'side' : 'over';

        if (!this.isDesktop && this.sidenav) {
            this.sidenav.close(); // Close menu on small screens
        }
    }

    toggleSidebar() {
        if (this.sidenav) {
            this.sidenav.toggle();
        }
    }

    onNavItemClick() {
        // Only auto-close in over mode (i.e. mobile/tablet)
        if (this.sidenavMode === 'over' && this.sidenav) {
            this.sidenav.close();
        }
    }

    private getDeepestChild(route: ActivatedRoute): ActivatedRoute {
        let child = route.firstChild;

        while (child?.firstChild) {
            child = child.firstChild;
        }

        return child ?? route;
    }
}
