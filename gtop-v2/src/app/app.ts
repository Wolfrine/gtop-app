import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../environments/environment';
import { AppUpdateService } from './core/app-update.service';
import { DiagnosticsService } from './core/diagnostics.service';
import { PlatformMetaService } from './core/platform-meta.service';
import { DiagnosticsPanelComponent } from './shared/diagnostics-panel.component';
import { AppDialogComponent } from './shared/app-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DiagnosticsPanelComponent, AppDialogComponent],
  template: `
    <div #chromeStack class="app-chrome-stack">
      @if (uat) {
        <div class="uat-banner" role="status">UAT — LIVE PRODUCTION DATA · CHANGES ARE REAL</div>
      }
      @if (!updates.online()) {
        <div class="network-banner" role="status">
          Offline · cached learning data remains available; live sessions require a connection.
        </div>
      }
    </div>
    @if (updates.state().phase === 'available') {
      <div class="update-toast" role="status">
        <span>A newer GTOP build is ready.</span
        ><button type="button" (click)="updates.applyUpdate()">Update safely</button>
      </div>
    } @else if (updates.installAvailable()) {
      <div class="update-toast" role="status">
        <span>Install GTOP for quicker access.</span
        ><button type="button" (click)="updates.install()">Install app</button>
      </div>
    }
    @if (navigationError()) {
      <main class="startup-message" role="alert">
        <p class="eyebrow">Growth Tutorials</p>
        <h1>GTOP could not open this page.</h1>
        <p>Your saved work is safe. Check your connection and try again.</p>
        <div class="button-row">
          <button class="btn btn-primary" type="button" (click)="reload()">Reload GTOP</button>
          <a class="btn btn-secondary" href="/">Go to home</a>
        </div>
      </main>
    } @else if (navigating()) {
      <div class="startup-message" role="status" aria-live="polite">
        <p class="eyebrow">Growth Tutorials</p>
        <h1>Opening GTOP…</h1>
        <p>Loading your workspace. This may take a moment on a slower connection.</p>
        @if (slowNavigation()) {
          <p>This is taking longer than usual. Check your connection, then try again.</p>
          <div class="button-row">
            <button class="btn btn-primary" type="button" (click)="reload()">Reload GTOP</button>
            <a class="btn btn-secondary" href="/">Go to home</a>
          </div>
        }
      </div>
    }
    <router-outlet />
    <app-dialog />
    <app-diagnostics-panel />
  `,
  styles: `.startup-message { max-width: 660px; margin: 12vh auto; padding: 24px; }
    .startup-message h1 { font-size: clamp(25px, 5vw, 40px); }
    .startup-message p { line-height: 1.6; }`,
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('chromeStack', { static: true }) private chromeStack?: ElementRef<HTMLElement>;
  protected readonly uat = environment.uat;
  readonly navigating = signal(true);
  readonly navigationError = signal(false);
  readonly slowNavigation = signal(false);
  private navigationTimer?: ReturnType<typeof setTimeout>;
  private chromeObserver?: ResizeObserver;
  private readonly navigationSubscription: Subscription;

  constructor(
    readonly diagnostics: DiagnosticsService,
    readonly updates: AppUpdateService,
    readonly meta: PlatformMetaService,
    router: Router,
  ) {
    this.startNavigation();
    this.navigationSubscription = router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.startNavigation();
      } else if (event instanceof NavigationEnd) {
        clearTimeout(this.navigationTimer);
        this.navigating.set(false);
        diagnostics.capture('info', 'system', 'Navigation completed.', event.urlAfterRedirects);
      } else if (event instanceof NavigationError) {
        clearTimeout(this.navigationTimer);
        this.navigating.set(false);
        this.navigationError.set(true);
        diagnostics.captureError('system', 'Page navigation failed.', event.error);
      } else if (event instanceof NavigationCancel) {
        clearTimeout(this.navigationTimer);
        this.navigating.set(false);
      }
    });
  }

  reload(): void { location.reload(); }

  private startNavigation(): void {
    clearTimeout(this.navigationTimer);
    this.navigating.set(true);
    this.navigationError.set(false);
    this.slowNavigation.set(false);
    this.navigationTimer = setTimeout(() => this.slowNavigation.set(true), 10_000);
  }

  ngAfterViewInit(): void {
    const element = this.chromeStack?.nativeElement;
    if (!element) return;
    const updateHeight = () =>
      document.documentElement.style.setProperty(
        '--app-chrome-height',
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
      );
    updateHeight();
    this.chromeObserver = new ResizeObserver(updateHeight);
    this.chromeObserver.observe(element);
  }

  ngOnDestroy(): void {
    clearTimeout(this.navigationTimer);
    this.navigationSubscription.unsubscribe();
    this.chromeObserver?.disconnect();
    document.documentElement.style.removeProperty('--app-chrome-height');
  }
}
