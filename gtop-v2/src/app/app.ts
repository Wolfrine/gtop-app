import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { DiagnosticsService } from './core/diagnostics.service';
import { AppUpdateService } from './core/app-update.service';
import { PlatformMetaService } from './core/platform-meta.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (uat) {
      <div class="uat-banner" role="status">UAT — LIVE PRODUCTION DATA · CHANGES ARE REAL</div>
    }
    @if (!updates.online()) {
      <div class="network-banner" role="status">Offline · cached learning data remains available; live sessions require a connection.</div>
    }
    @if (updates.state().phase === 'available') {
      <div class="update-toast" role="status"><span>A newer GTOP build is ready.</span><button type="button" (click)="updates.applyUpdate()">Update safely</button></div>
    } @else if (updates.installAvailable()) {
      <div class="update-toast" role="status"><span>Install GTOP for quicker access.</span><button type="button" (click)="updates.install()">Install app</button></div>
    }
    <router-outlet />
  `,
})
export class App {
  protected readonly uat = environment.uat;
  constructor(
    readonly diagnostics: DiagnosticsService,
    readonly updates: AppUpdateService,
    readonly meta: PlatformMetaService,
  ) {}
}
