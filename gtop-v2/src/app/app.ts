import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { ThemeService } from './core/theme.service';
import { PresenceService } from './core/presence.service';
import { DiagnosticsService } from './core/diagnostics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (uat) {
      <div class="uat-banner" role="status">UAT — LIVE PRODUCTION DATA · CHANGES ARE REAL</div>
    }
    <router-outlet />
  `,
})
export class App {
  protected readonly uat = environment.uat;
  constructor(
    readonly theme: ThemeService,
    readonly presence: PresenceService,
    readonly diagnostics: DiagnosticsService,
  ) {}
}
