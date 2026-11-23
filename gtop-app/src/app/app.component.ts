import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { AuthService } from './services/auth.service';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { SideNavComponent } from './components/side-nav/side-nav.component';
import { AdminUsageService } from './services/admin-usage.service';
import { SeoService } from './services/seo.service';


@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        RouterOutlet,
        HeaderComponent,
        FooterComponent,
        SideNavComponent
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
    isLandingPage = true;
    isSetupPage = false;
    section = 'Practice';
    profile: { role?: string } | null = null;

    get showNavigation(): boolean {
        return !this.isLandingPage && !this.isSetupPage && !!this.profile;
    }

    constructor(
        private authService: AuthService,
        private router: Router,
        private activatedRoute: ActivatedRoute,
        private seoService: SeoService,
        private usage: AdminUsageService
    ) {
        this.authService.readyUser$.subscribe(profile => this.profile = profile);
        this.router.events.subscribe(event => {
            if (!(event instanceof NavigationEnd)) return;
            window.scrollTo({ top: 0 });
            this.seoService.update(this.getDeepestChild(this.activatedRoute).snapshot.data['seo']);
            const [path] = event.urlAfterRedirects.split(/[?#]/);
            this.isLandingPage = path === '/';
            this.isSetupPage = path === '/profile-setup';
            this.section = this.sectionFor(path);
        });
    }

    ngOnInit() {
        this.authService.initGoogleOneTap();
        this.usage.start();
    }

    private sectionFor(path: string): string {
        if (path === '/answer-sheets') return 'Answer Sheets';
        if (path === '/reports' || path === '/quiz-summary') return 'Progress';
        if (path === '/profile') return 'Account';
        if (path === '/admin' || path.startsWith('/admin/') ||
            ['/logs', '/syllabus-preview', '/dev/ui', '/learning-lab/results', '/learning-lab/plants/results'].includes(path)) return 'Admin';
        return 'Practice';
    }

    private getDeepestChild(route: ActivatedRoute): ActivatedRoute {
        let child = route.firstChild;

        while (child?.firstChild) {
            child = child.firstChild;
        }

        return child ?? route;
    }
}
