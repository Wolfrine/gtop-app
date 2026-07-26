import { Component, HostListener, Input, OnDestroy, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../core/auth.store';
import { DiagnosticsService } from '../core/diagnostics.service';
import { NavItem, ShellContext, ShellDisplayMode } from '../core/models';
import { RequiredVersionService } from '../core/required-version.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-product-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  template: `
    <div
      class="app-shell"
      [class.immersive-shell]="displayMode() === 'immersive'"
      [attr.data-shell]="roleMode"
    >
      <aside class="sidebar">
        <a class="brand" [routerLink]="homePath">
          <span class="brand-mark">G</span>
          <span class="brand-copy"
            ><strong>GTOP</strong><span>{{ subtitle }}</span></span
          >
        </a>
        <nav aria-label="Primary navigation">
          @for (item of items; track item.path) {
            @if (item.group && item.group !== items[$index - 1]?.group) {
              <div class="nav-label">{{ item.group }}</div>
            }
            <a
              class="nav-link"
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.path === homePath }"
            >
              <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span
              >{{ item.label }}
            </a>
          }
        </nav>
        <ng-container [ngTemplateOutlet]="accountControls" />
      </aside>

      <header class="mobile-top">
        <a class="mobile-brand" [routerLink]="homePath" aria-label="GTOP home">
          <span class="brand-mark">G</span>
          <span
            ><strong>GTOP</strong><small>{{ currentLabel() }}</small></span
          >
        </a>
        @if (displayMode() === 'immersive') {
          <span class="mobile-mode">Focused session</span>
        }
        <button
          #menuTrigger
          class="mobile-menu-trigger"
          type="button"
          [attr.aria-label]="roleMode === 'admin' ? 'Open admin navigation' : 'Open more options'"
          aria-controls="mobile-navigation-panel"
          [attr.aria-expanded]="menuOpen()"
          (click)="openMenu(menuTrigger)"
        >
          @if (roleMode === 'admin') {
            <span aria-hidden="true">☰</span><span>Menu</span>
          } @else {
            <span class="avatar mini">{{ initial }}</span>
          }
        </button>
      </header>

      <main class="shell-main"><router-outlet /></main>

      @if (roleMode === 'learner' && displayMode() === 'standard') {
        <nav class="learner-bottom-nav" aria-label="Mobile primary navigation">
          @for (item of primaryMobileItems(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.path === homePath }"
            >
              <span aria-hidden="true">{{ item.icon }}</span
              ><small>{{ item.label }}</small>
            </a>
          }
          <button type="button" (click)="openMenu($event.currentTarget)">
            <span aria-hidden="true">•••</span><small>More</small>
          </button>
        </nav>
      }

      @if (menuOpen()) {
        <div class="mobile-nav-backdrop" (click)="closeMenu()"></div>
        <aside
          id="mobile-navigation-panel"
          class="mobile-nav-panel"
          [class.admin-drawer]="roleMode === 'admin'"
          [class.learner-sheet]="roleMode === 'learner'"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="roleMode === 'admin' ? 'Admin navigation' : 'More options'"
        >
          <div class="mobile-panel-head">
            <div>
              <p class="eyebrow">
                {{ roleMode === 'admin' ? 'Administration' : 'Your workspace' }}
              </p>
              <h2>{{ roleMode === 'admin' ? 'Navigate GTOP' : 'More options' }}</h2>
            </div>
            <button
              class="mobile-panel-close"
              type="button"
              aria-label="Close navigation"
              (click)="closeMenu()"
            >
              ×
            </button>
          </div>
          <nav aria-label="Mobile navigation destinations">
            @for (item of panelItems(); track item.path) {
              @if (item.group && item.group !== panelItems()[$index - 1]?.group) {
                <div class="mobile-nav-group">{{ item.group }}</div>
              }
              <a
                class="mobile-nav-destination"
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === homePath }"
                (click)="closeMenu(false)"
              >
                <span aria-hidden="true">{{ item.icon }}</span>
                <strong>{{ item.label }}</strong>
                <span aria-hidden="true">→</span>
              </a>
            }
          </nav>
          <div class="mobile-panel-foot">
            <button class="mobile-nav-destination" type="button" (click)="openDiagnostics()">
              <span aria-hidden="true">≡</span><strong>Device diagnostics</strong
              ><span aria-hidden="true">→</span>
            </button>
            <div class="mobile-account">
              <span class="avatar">{{ initial }}</span>
              <span class="user-meta">
                <strong>{{ auth.profile()?.displayName || 'GTOP user' }}</strong>
                <span
                  >{{ auth.role() }} · {{ buildVersion()
                  }}{{ buildCommit() ? ' · ' + buildCommit() : '' }}</span
                >
              </span>
            </div>
            <button class="btn btn-secondary sign-out-mobile" type="button" (click)="logout()">
              Sign out
            </button>
          </div>
        </aside>
      }

      <ng-template #accountControls>
        <div class="side-foot">
          <p class="small" style="margin:0 8px 8px;color:#8090aa">
            {{ buildVersion() }}{{ buildCommit() ? ' · ' + buildCommit() : '' }}
          </p>
          <div class="user-row">
            <span class="avatar">
              @if (auth.profile()?.photoURL) {
                <img [src]="auth.profile()?.photoURL" alt="" />
              } @else {
                {{ initial }}
              }
            </span>
            <span class="user-meta">
              <strong>{{ auth.profile()?.displayName || 'GTOP user' }}</strong>
              <span>{{ auth.role() }}</span>
            </span>
          </div>
          <button class="nav-link" type="button" (click)="openDiagnostics()">
            <span class="nav-icon">≡</span>Diagnostics
          </button>
          <button class="nav-link" type="button" (click)="logout()">
            <span class="nav-icon">↗</span>Sign out
          </button>
        </div>
      </ng-template>
    </div>
  `,
})
export class ProductShellComponent implements OnDestroy {
  @Input({ required: true }) items: NavItem[] = [];
  @Input({ required: true }) homePath = '/dashboard';
  @Input() subtitle = 'Practice intelligence';
  @Input() roleMode: ShellContext = 'learner';

  readonly buildVersion = signal('local');
  readonly buildCommit = signal('');
  readonly menuOpen = signal(false);
  readonly displayMode = signal<ShellDisplayMode>('standard');
  readonly currentLabel = signal('Workspace');
  private restoreFocus?: HTMLElement;

  constructor(
    public readonly auth: AuthStore,
    private readonly router: Router,
    private readonly diagnostics: DiagnosticsService,
    theme: ThemeService,
    requiredVersion: RequiredVersionService,
  ) {
    void theme;
    void requiredVersion;
    fetch('/version.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value?.version) this.buildVersion.set(`v${String(value.version)}`);
        if (value?.commit) this.buildCommit.set(String(value.commit).slice(0, 8));
      })
      .catch(() => undefined);
    this.syncRouteState();
    queueMicrotask(() => this.syncRouteState());
    router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeMenu(false);
        this.syncRouteState();
      });
  }

  get initial(): string {
    return (this.auth.profile()?.displayName || 'G').charAt(0).toUpperCase();
  }

  primaryMobileItems(): NavItem[] {
    return this.items
      .filter((item) => item.mobilePlacement === 'primary')
      .sort((a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99));
  }

  panelItems(): NavItem[] {
    if (this.roleMode === 'admin') return this.items;
    return this.items.filter((item) => item.mobilePlacement !== 'primary');
  }

  openMenu(trigger: EventTarget | null): void {
    this.restoreFocus = trigger instanceof HTMLElement ? trigger : undefined;
    this.menuOpen.set(true);
    document.body.classList.add('mobile-overlay-open');
    queueMicrotask(() =>
      document.querySelector<HTMLElement>('#mobile-navigation-panel .mobile-panel-close')?.focus(),
    );
  }

  closeMenu(restoreFocus = true): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    document.body.classList.remove('mobile-overlay-open');
    if (restoreFocus) queueMicrotask(() => this.restoreFocus?.focus());
  }

  openDiagnostics(): void {
    this.closeMenu(false);
    this.diagnostics.openPanel();
  }

  async logout(): Promise<void> {
    this.closeMenu(false);
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('mobile-overlay-open');
    document.body.classList.remove('authenticated-shell');
    document.documentElement.style.setProperty('--mobile-content-bottom', '0px');
    this.diagnostics.setShellContext();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.menuOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
      return;
    }
    if (event.key !== 'Tab') return;
    const panel = document.getElementById('mobile-navigation-panel');
    const focusable = Array.from(
      panel?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private syncRouteState(): void {
    document.body.classList.add('authenticated-shell');
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const mode = (route.data['shellDisplay'] as ShellDisplayMode | undefined) ?? 'standard';
    this.displayMode.set(mode);
    document.documentElement.style.setProperty(
      '--mobile-content-bottom',
      this.roleMode === 'learner' && mode === 'standard' ? 'var(--mobile-nav-height)' : '0px',
    );
    const match = this.items
      .filter((item) => this.router.url.startsWith(item.path))
      .sort((a, b) => b.path.length - a.path.length)[0];
    this.currentLabel.set(match?.label ?? (mode === 'immersive' ? 'Focused session' : 'Workspace'));
    this.diagnostics.setShellContext(this.roleMode, mode);
  }
}

@Component({
  selector: 'app-learner-shell',
  imports: [ProductShellComponent],
  template: `<app-product-shell [items]="items" homePath="/dashboard" roleMode="learner" />`,
})
export class LearnerShellComponent {
  readonly items: NavItem[] = [
    {
      label: 'Today',
      path: '/dashboard',
      icon: '⌂',
      group: 'Learning',
      mobilePlacement: 'primary',
      mobilePriority: 1,
    },
    {
      label: 'Practice',
      path: '/practice',
      icon: '✦',
      group: 'Learning',
      mobilePlacement: 'primary',
      mobilePriority: 2,
    },
    {
      label: 'Reports',
      path: '/reports',
      icon: '⌁',
      group: 'Learning',
      mobilePlacement: 'primary',
      mobilePriority: 3,
    },
    {
      label: 'Live practice',
      path: '/live',
      icon: '◉',
      group: 'Together',
      mobilePlacement: 'primary',
      mobilePriority: 4,
    },
    { label: 'Quiz run', path: '/quiz-run', icon: '↯', group: 'Together', mobilePlacement: 'more' },
    { label: 'Profile', path: '/profile', icon: '○', group: 'Account', mobilePlacement: 'more' },
  ];
}

@Component({
  selector: 'app-admin-shell',
  imports: [ProductShellComponent],
  template: `<app-product-shell
    [items]="items"
    homePath="/admin"
    subtitle="Administration"
    roleMode="admin"
  />`,
})
export class AdminShellComponent {
  readonly items: NavItem[] = [
    { label: 'Overview', path: '/admin', icon: '⌂', group: 'Operate', mobilePlacement: 'drawer' },
    {
      label: 'Action plan',
      path: '/admin/action-plan',
      icon: '✓',
      group: 'Operate',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Users',
      path: '/admin/users',
      icon: '○',
      group: 'Operate',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Question bank',
      path: '/admin/questions',
      icon: '◇',
      group: 'Content',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Syllabus',
      path: '/admin/syllabus',
      icon: '▦',
      group: 'Content',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Learner dashboard',
      path: '/admin/learning/dashboard',
      icon: '◫',
      group: 'Learning',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Take a quiz',
      path: '/admin/learning/practice',
      icon: '✦',
      group: 'Learning',
      mobilePlacement: 'drawer',
    },
    {
      label: 'My reports',
      path: '/admin/learning/reports',
      icon: '⌁',
      group: 'Learning',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Live practice',
      path: '/admin/learning/live',
      icon: '◉',
      group: 'Learning',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Quiz run',
      path: '/admin/learning/quiz-run',
      icon: '↯',
      group: 'Learning',
      mobilePlacement: 'drawer',
    },
    {
      label: 'All reports',
      path: '/admin/reports',
      icon: '▥',
      group: 'Insights',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Live control',
      path: '/admin/live',
      icon: '◍',
      group: 'Insights',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Diagnostics',
      path: '/admin/logs',
      icon: '≡',
      group: 'System',
      mobilePlacement: 'drawer',
    },
    {
      label: 'Theme Lab',
      path: '/admin/theme-lab',
      icon: '◐',
      group: 'System',
      mobilePlacement: 'drawer',
    },
  ];
}
