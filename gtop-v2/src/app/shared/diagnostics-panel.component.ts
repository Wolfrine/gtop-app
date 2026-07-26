import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ClientDiagnostic, DiagnosticsService } from '../core/diagnostics.service';

@Component({
  selector: 'app-diagnostics-panel',
  template: `
    <button
      class="diagnostics-launch"
      type="button"
      aria-controls="client-diagnostics-panel"
      [attr.aria-expanded]="open()"
      (click)="open.set(true)"
    >
      <span class="diagnostics-dot" [class.has-error]="errorCount() > 0" aria-hidden="true"></span>
      Diagnostics
      @if (diagnostics.records().length) {
        <span class="diagnostics-count">{{ diagnostics.records().length }}</span>
      }
    </button>

    @if (open()) {
      <div class="diagnostics-backdrop" (click)="open.set(false)">
        <section
          id="client-diagnostics-panel"
          class="diagnostics-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-diagnostics-title"
          (click)="$event.stopPropagation()"
        >
          <header>
            <div>
              <p class="eyebrow">This device only</p>
              <h2 id="client-diagnostics-title">Client diagnostics</h2>
              <p>
                If sign-in fails, retry once, then copy this report. Credentials and tokens are
                automatically redacted.
              </p>
            </div>
            <button
              class="diagnostics-close"
              type="button"
              aria-label="Close diagnostics"
              (click)="open.set(false)"
            >
              ×
            </button>
          </header>

          <div class="diagnostics-summary">
            <span
              ><strong>{{ errorCount() }}</strong> errors</span
            >
            <span
              ><strong>{{ warningCount() }}</strong> warnings</span
            >
            <span
              ><strong>{{ online() ? 'Online' : 'Offline' }}</strong> network</span
            >
            <span
              ><strong>{{ build() }}</strong> build</span
            >
          </div>

          <div class="diagnostics-actions">
            <button class="btn btn-primary" type="button" (click)="copyAll()">Copy report</button>
            <button class="btn btn-secondary" type="button" (click)="runSelfCheck()">
              Run device check
            </button>
            <button class="btn btn-quiet" type="button" (click)="diagnostics.clear()">Clear</button>
          </div>
          @if (message()) {
            <p class="diagnostics-message" role="status">{{ message() }}</p>
          }

          <div class="diagnostics-events" aria-live="polite">
            @for (item of visibleRecords(); track item.id) {
              <article class="diagnostic-event" [class.event-error]="item.level === 'error'">
                <div class="event-head">
                  <span class="event-level">{{ item.level }}</span>
                  <span>{{ item.category }}</span>
                  <time>{{ date(item.createdAt) }}</time>
                  <button type="button" (click)="copy(item)">Copy</button>
                </div>
                <strong>{{ item.message }}</strong>
                @if (item.code) {
                  <code>{{ item.code }}</code>
                }
                @if (item.detail) {
                  <pre>{{ item.detail }}</pre>
                }
                <small>{{ item.route }}</small>
              </article>
            } @empty {
              <div class="diagnostics-empty">
                <strong>No errors captured yet.</strong>
                <p>Run the device check or retry sign-in while this panel is available.</p>
              </div>
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .diagnostics-launch {
      position: fixed;
      right: 16px;
      bottom: max(16px, env(safe-area-inset-bottom));
      z-index: 1000;
      display: flex;
      min-height: 44px;
      padding: 0 14px;
      align-items: center;
      gap: 8px;
      color: #fff;
      background: #17233c;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      box-shadow: 0 10px 30px rgba(23, 35, 60, 0.28);
      font: inherit;
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }
    .diagnostics-launch:focus-visible,
    button:focus-visible {
      outline: 3px solid var(--focus, #49b8ad);
      outline-offset: 3px;
    }
    .diagnostics-dot {
      width: 8px;
      height: 8px;
      background: #55c9bc;
      border-radius: 50%;
    }
    .diagnostics-dot.has-error {
      background: #ff7868;
      box-shadow: 0 0 0 4px rgba(255, 120, 104, 0.18);
    }
    .diagnostics-count {
      display: grid;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      place-items: center;
      background: rgba(255, 255, 255, 0.14);
      border-radius: 10px;
    }
    .diagnostics-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: flex;
      padding: 24px;
      align-items: flex-end;
      justify-content: flex-end;
      background: rgba(8, 16, 31, 0.52);
      backdrop-filter: blur(4px);
    }
    .diagnostics-panel {
      display: flex;
      width: min(620px, 100%);
      max-height: min(820px, calc(100vh - 48px));
      padding: 24px;
      flex-direction: column;
      color: var(--ink, #17233c);
      background: var(--surface, #fff);
      border: 1px solid var(--line, #dfe3e8);
      border-radius: 22px;
      box-shadow: 0 30px 90px rgba(8, 16, 31, 0.34);
    }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
    }
    header h2 {
      margin: 2px 0 8px;
      font-size: 26px;
    }
    header p:not(.eyebrow) {
      max-width: 500px;
      margin: 0;
      color: var(--muted, #647083);
      font-size: 13px;
      line-height: 1.5;
    }
    .diagnostics-close {
      flex: 0 0 auto;
      width: 44px;
      height: 44px;
      color: inherit;
      background: var(--canvas, #f4f2ec);
      border: 0;
      border-radius: 12px;
      font-size: 24px;
      cursor: pointer;
    }
    .diagnostics-summary {
      display: grid;
      margin: 20px 0 14px;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .diagnostics-summary span {
      padding: 12px;
      color: var(--muted, #647083);
      background: var(--canvas, #f4f2ec);
      border-radius: 12px;
      font-size: 10px;
    }
    .diagnostics-summary strong {
      display: block;
      margin-bottom: 3px;
      color: var(--ink, #17233c);
      font-size: 13px;
    }
    .diagnostics-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .diagnostics-message {
      margin: 10px 0 0;
      color: var(--teal-strong, #167a70);
      font-size: 12px;
      font-weight: 700;
    }
    .diagnostics-events {
      min-height: 150px;
      margin-top: 16px;
      overflow: auto;
      overscroll-behavior: contain;
    }
    .diagnostic-event {
      padding: 14px 0;
      border-top: 1px solid var(--line, #dfe3e8);
    }
    .diagnostic-event > strong,
    .diagnostic-event > code,
    .diagnostic-event > small {
      display: block;
    }
    .diagnostic-event > strong {
      margin: 8px 0 4px;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .diagnostic-event > code {
      width: fit-content;
      margin-bottom: 6px;
      padding: 3px 6px;
      color: #8c3027;
      background: #fff0ed;
      border-radius: 5px;
      font-size: 11px;
    }
    .diagnostic-event > small {
      margin-top: 8px;
      color: var(--muted, #647083);
      overflow-wrap: anywhere;
    }
    .diagnostic-event pre {
      max-height: 150px;
      margin: 8px 0;
      padding: 10px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: #364052;
      background: #f4f5f7;
      border-radius: 8px;
      font:
        11px/1.45 ui-monospace,
        SFMono-Regular,
        Consolas,
        monospace;
    }
    .event-head {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted, #647083);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .event-head time {
      margin-left: auto;
      text-transform: none;
      letter-spacing: 0;
    }
    .event-head button {
      min-width: 44px;
      min-height: 44px;
      padding: 4px 7px;
      color: var(--ink, #17233c);
      background: transparent;
      border: 1px solid var(--line, #dfe3e8);
      border-radius: 6px;
      font: inherit;
      cursor: pointer;
    }
    .event-level {
      padding: 3px 6px;
      color: #27645e;
      background: #e5f5f2;
      border-radius: 5px;
      font-weight: 800;
    }
    .event-error .event-level {
      color: #8c3027;
      background: #fff0ed;
    }
    .diagnostics-empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--muted, #647083);
      border-top: 1px solid var(--line, #dfe3e8);
    }
    .diagnostics-empty p {
      margin-bottom: 0;
      font-size: 12px;
    }
    @media (max-width: 640px) {
      .diagnostics-launch {
        right: 10px;
        bottom: max(10px, env(safe-area-inset-bottom));
      }
      .diagnostics-backdrop {
        padding: 0;
        align-items: flex-end;
      }
      .diagnostics-panel {
        width: 100%;
        max-height: calc(100dvh - 18px);
        padding: 20px 16px max(18px, env(safe-area-inset-bottom));
        border-radius: 22px 22px 0 0;
      }
      .diagnostics-summary {
        grid-template-columns: repeat(2, 1fr);
      }
      .event-head {
        flex-wrap: wrap;
      }
      .event-head time {
        margin-left: 0;
      }
    }
    @media (max-width: 939px) {
      :host-context(.authenticated-shell) .diagnostics-launch {
        display: none;
      }
    }
    @media (prefers-reduced-motion: no-preference) {
      .diagnostics-backdrop {
        animation: diagnostic-fade 0.16s ease-out;
      }
      .diagnostics-panel {
        animation: diagnostic-rise 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      @keyframes diagnostic-fade {
        from {
          opacity: 0;
        }
      }
      @keyframes diagnostic-rise {
        from {
          opacity: 0;
          transform: translateY(18px);
        }
      }
    }
  `,
})
export class DiagnosticsPanelComponent {
  readonly diagnostics = inject(DiagnosticsService);
  readonly open = this.diagnostics.panelOpen;
  readonly message = signal('');
  readonly build = signal('unknown');
  readonly visibleRecords = computed(() => this.diagnostics.records().slice(0, 50));
  readonly errorCount = computed(
    () => this.diagnostics.records().filter((record) => record.level === 'error').length,
  );
  readonly warningCount = computed(
    () => this.diagnostics.records().filter((record) => record.level === 'warning').length,
  );
  readonly online = computed(() => {
    this.diagnostics.records();
    return navigator.onLine;
  });

  constructor() {
    fetch('/version.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value?.commit) this.build.set(String(value.commit).slice(0, 8));
      })
      .catch((error) =>
        this.diagnostics.captureError('network', 'Build information could not be loaded.', error),
      );
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.open.set(false);
  }

  runSelfCheck(): void {
    this.diagnostics.runSelfCheck();
    this.message.set('Device check added to the report.');
  }

  async copyAll(): Promise<void> {
    try {
      await this.diagnostics.copyAll();
      this.message.set('Diagnostic report copied.');
    } catch (error) {
      this.message.set(
        'Copy was blocked by this browser. Select and copy individual details instead.',
      );
      this.diagnostics.captureError('system', 'Clipboard copy failed.', error);
    }
  }

  async copy(record: ClientDiagnostic): Promise<void> {
    try {
      await this.diagnostics.copy(record);
      this.message.set('Event copied.');
    } catch (error) {
      this.message.set('Copy was blocked by this browser.');
      this.diagnostics.captureError('system', 'Clipboard copy failed.', error);
    }
  }

  date(value: string): string {
    return new Date(value).toLocaleString('en-IN');
  }
}
