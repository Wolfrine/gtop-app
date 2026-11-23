import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, ParamMap, Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent, HeaderBackLink } from './components/header/header.component';
import { SideNavComponent } from './components/side-nav/side-nav.component';
import { AdminUsageService } from './services/admin-usage.service';
import { SeoService } from './services/seo.service';
import { adminGroups } from './pages/admin-dashboard/admin-groups';
import { parsePracticeScope, practiceParams, practiceReturns } from './services/practice-invite.domain';


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
    mobileBack: HeaderBackLink | null = null;
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
            const route = this.getDeepestChild(this.activatedRoute).snapshot;
            this.seoService.update(route.data['seo']);
            const [path] = event.urlAfterRedirects.split(/[?#]/);
            this.isLandingPage = path === '/';
            this.isSetupPage = path === '/profile-setup';
            this.section = this.sectionFor(path);
            this.mobileBack = this.mobileReturnFor(route.routeConfig?.path ?? '', route.queryParamMap);
        });
    }

    ngOnInit() {
        this.authService.initGoogleOneTap();
        this.usage.start();
    }

    // The main destinations need the bottom bar. Task routes return to a known parent,
    // including when a shared URL or PWA launch has no in-app history.
    private mobileReturnFor(route: string, params: ParamMap): HeaderBackLink | null {
        if (['dashboard', 'answer-sheets', 'reports'].includes(route)) return null;

        const back = (label: string, path: string, queryParams?: Record<string, unknown>) => ({
            label: 'Back to ' + label,
            path, queryParams,
        });

        if (route === 'admin') {
            return adminGroups.some(group => group.key === params.get('section'))
                ? back('Admin overview', '/admin') : null;
        }
        if (route === 'quiz') {
            if (params.get('practice') === 'invite') {
                const scope = parsePracticeScope(params);
                return back('invitation', '/practice', { ...(scope ? practiceParams(scope) : {}), ...practiceReturns(params) });
            }
            if (params.get('retry')) return back('Progress', '/reports');
            if (params.get('mode')?.toLowerCase() === 'run') return back('Quiz Run', '/quiz-run');
            if (params.get('live') === '1' || params.get('sessionId')) return back('Live Quizzes', '/live');
        }
        if (route === 'quiz-summary') return back('Progress', '/reports');
        if (route.startsWith('live/')) return back('Live Quizzes', '/live');
        if (route.startsWith('quiz-run/')) return back('Quiz Run', '/quiz-run');
        if (route.startsWith('admin/question-papers/')) {
            return back('Papers', '/admin/question-papers', {
                paperQ: params.get('paperQ'),
                paperView: params.get('paperView'),
                paperMine: params.get('paperMine'),
            });
        }
        if (route === 'admin/manage-syllabus/edit') return back('Manage syllabus', '/admin/manage-syllabus');

        const group = adminGroups.find(group => group.tools.some(tool => tool.route === '/' + route));
        if (group) return back(group.title, '/admin', { section: group.key });
        if (route.startsWith('learning-lab/')) return back('Learning Lab', '/learning-lab');
        return back('Practice', '/dashboard');
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
