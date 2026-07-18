import { Component, Input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { RequiredVersionService } from '../core/required-version.service';
import { ThemeService } from '../core/theme.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  group?: string;
}

@Component({
  selector: 'app-product-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
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
        <div class="side-foot">
          <p class="small" style="margin:0 8px 8px;color:#8090aa">Build {{ buildVersion() }}</p>
          <div class="user-row">
            <span class="avatar">
              @if (auth.profile()?.photoURL) {
                <img [src]="auth.profile()?.photoURL" alt="" />
              } @else {
                {{ initial }}
              }
            </span>
            <span class="user-meta"
              ><strong>{{ auth.profile()?.displayName || 'GTOP user' }}</strong
              ><span>{{ auth.role() }}</span></span
            >
          </div>
          <button class="nav-link" type="button" (click)="logout()">
            <span class="nav-icon">↗</span>Sign out
          </button>
        </div>
      </aside>
      <header class="mobile-top">
        <a class="brand" [routerLink]="homePath"
          ><span class="brand-mark">G</span><strong>GTOP</strong></a
        >
        <nav class="mobile-links" aria-label="Mobile navigation">
          @for (item of items; track item.path) {
            <a [routerLink]="item.path">{{ item.label }}</a>
          }
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
  constructor(
    public readonly auth: AuthStore,
    private readonly router: Router,
    theme: ThemeService,
    requiredVersion: RequiredVersionService,
  ) {
    void theme;
    void requiredVersion;
    fetch('/version.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value?.commit) this.buildVersion.set(String(value.commit).slice(0, 8));
      })
      .catch(() => undefined);
  }
  get initial(): string {
    return (this.auth.profile()?.displayName || 'G').charAt(0).toUpperCase();
  }
  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}

@Component({
  selector: 'app-learner-shell',
  imports: [ProductShellComponent],
  template: `<app-product-shell [items]="items" homePath="/dashboard" />`,
})
export class LearnerShellComponent {
  readonly items: NavItem[] = [
    { label: 'Today', path: '/dashboard', icon: '⌂', group: 'Learning' },
    { label: 'Practice', path: '/practice', icon: '✦', group: 'Learning' },
    { label: 'Reports', path: '/reports', icon: '⌁', group: 'Learning' },
    { label: 'Live practice', path: '/live', icon: '◉', group: 'Together' },
    { label: 'Quiz run', path: '/quiz-run', icon: '↯', group: 'Together' },
    { label: 'Profile', path: '/profile', icon: '○', group: 'Account' },
  ];
}

@Component({
  selector: 'app-admin-shell',
  imports: [ProductShellComponent],
  template: `<app-product-shell [items]="items" homePath="/admin" subtitle="Administration" />`,
})
export class AdminShellComponent {
  readonly items: NavItem[] = [
    { label: 'Overview', path: '/admin', icon: '⌂', group: 'Operate' },
    { label: 'Action plan', path: '/admin/action-plan', icon: '✓', group: 'Operate' },
    { label: 'Users', path: '/admin/users', icon: '○', group: 'Operate' },
    { label: 'Question bank', path: '/admin/questions', icon: '◇', group: 'Content' },
    { label: 'Syllabus', path: '/admin/syllabus', icon: '▦', group: 'Content' },
    { label: 'Learner dashboard', path: '/admin/learning/dashboard', icon: '◫', group: 'Learning' },
    { label: 'Take a quiz', path: '/admin/learning/practice', icon: '✦', group: 'Learning' },
    { label: 'My reports', path: '/admin/learning/reports', icon: '⌁', group: 'Learning' },
    { label: 'Live practice', path: '/admin/learning/live', icon: '◉', group: 'Learning' },
    { label: 'Quiz run', path: '/admin/learning/quiz-run', icon: '↯', group: 'Learning' },
    { label: 'All reports', path: '/admin/reports', icon: '▥', group: 'Insights' },
    { label: 'Live control', path: '/admin/live', icon: '◎', group: 'Insights' },
    { label: 'Diagnostics', path: '/admin/logs', icon: '≡', group: 'System' },
    { label: 'Theme Lab', path: '/admin/theme-lab', icon: '◐', group: 'System' },
  ];
}
