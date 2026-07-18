import { Component, Input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth.store';

interface NavItem { label: string; path: string; icon: string; }

@Component({
  selector: 'app-product-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" [routerLink]="homePath">
          <span class="brand-mark">G</span>
          <span class="brand-copy"><strong>GTOP</strong><span>{{ subtitle }}</span></span>
        </a>
        <div class="nav-label">Workspace</div>
        <nav aria-label="Primary navigation">
          @for (item of items; track item.path) {
            <a class="nav-link" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{exact: item.path === homePath}">
              <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>{{ item.label }}
            </a>
          }
        </nav>
        <div class="side-foot">
          <p class="small" style="margin:0 8px 8px;color:#8090aa">Build {{ buildVersion() }}</p>
          <div class="user-row">
            <span class="avatar">
              @if (auth.profile()?.photoURL) { <img [src]="auth.profile()?.photoURL" alt=""> }
              @else { {{ initial }} }
            </span>
            <span class="user-meta"><strong>{{ auth.profile()?.displayName || 'GTOP user' }}</strong><span>{{ auth.role() }}</span></span>
          </div>
          <button class="nav-link" type="button" (click)="logout()"><span class="nav-icon">↗</span>Sign out</button>
        </div>
      </aside>
      <header class="mobile-top">
        <a class="brand" [routerLink]="homePath"><span class="brand-mark">G</span><strong>GTOP</strong></a>
        <nav class="mobile-links" aria-label="Mobile navigation">
          @for (item of items; track item.path) { <a [routerLink]="item.path">{{ item.label }}</a> }
        </nav>
      </header>
      <main class="shell-main"><router-outlet /></main>
    </div>
  `,
})
export class ProductShellComponent {
  @Input({ required: true }) items: NavItem[] = [];
  @Input({ required: true }) homePath = '/dashboard';
  @Input() subtitle = 'Practice intelligence';
  readonly buildVersion = signal('local');
  constructor(public readonly auth: AuthStore, private readonly router: Router) {
    fetch('/version.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((value) => {
      if (value?.commit) this.buildVersion.set(String(value.commit).slice(0, 8));
    }).catch(() => undefined);
  }
  get initial(): string { return (this.auth.profile()?.displayName || 'G').charAt(0).toUpperCase(); }
  async logout(): Promise<void> { await this.auth.logout(); await this.router.navigateByUrl('/'); }
}

@Component({
  selector: 'app-learner-shell',
  imports: [ProductShellComponent],
  template: `<app-product-shell [items]="items" homePath="/dashboard" />`,
})
export class LearnerShellComponent {
  readonly items: NavItem[] = [
    { label: 'Today', path: '/dashboard', icon: '⌂' },
    { label: 'Practice', path: '/practice', icon: '✦' },
    { label: 'Reports', path: '/reports', icon: '⌁' },
    { label: 'Live practice', path: '/live', icon: '◉' },
    { label: 'Quiz run', path: '/quiz-run', icon: '↯' },
    { label: 'Profile', path: '/profile', icon: '○' },
  ];
}

@Component({
  selector: 'app-admin-shell',
  imports: [ProductShellComponent],
  template: `<app-product-shell [items]="items" homePath="/admin" subtitle="Administration" />`,
})
export class AdminShellComponent {
  readonly items: NavItem[] = [
    { label: 'Overview', path: '/admin', icon: '⌂' },
    { label: 'Action plan', path: '/admin/action-plan', icon: '✓' },
    { label: 'Question bank', path: '/admin/questions', icon: '◇' },
    { label: 'Syllabus', path: '/admin/syllabus', icon: '▦' },
    { label: 'Users', path: '/admin/users', icon: '○' },
    { label: 'Reports', path: '/admin/reports', icon: '⌁' },
    { label: 'Live control', path: '/admin/live', icon: '◉' },
    { label: 'Activity log', path: '/admin/logs', icon: '≡' },
  ];
}
