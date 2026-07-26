import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
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
    <router-outlet />
    <app-dialog />
    <app-diagnostics-panel />
  `,
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('chromeStack', { static: true }) private chromeStack?: ElementRef<HTMLElement>;
  protected readonly uat = environment.uat;
  private chromeObserver?: ResizeObserver;

  constructor(
    readonly diagnostics: DiagnosticsService,
    readonly updates: AppUpdateService,
    readonly meta: PlatformMetaService,
    router: Router,
  ) {
    router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) =>
        diagnostics.capture('info', 'system', 'Navigation completed.', event.urlAfterRedirects),
      );
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
    this.chromeObserver?.disconnect();
    document.documentElement.style.removeProperty('--app-chrome-height');
  }
}
