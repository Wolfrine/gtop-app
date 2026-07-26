import { Component, HostListener, effect } from '@angular/core';
import { DialogService } from '../core/dialog.service';

@Component({
  selector: 'app-dialog',
  template: `
    @if (dialog.request(); as request) {
      <div class="app-dialog-backdrop" (click)="dialog.complete(null)">
        <section
          class="app-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-dialog-title"
          (click)="$event.stopPropagation()"
        >
          <div class="dialog-handle" aria-hidden="true"></div>
          <p class="eyebrow">{{ request.danger ? 'Confirmation required' : 'GTOP' }}</p>
          <h2 id="app-dialog-title">{{ request.title }}</h2>
          <p class="muted">{{ request.message }}</p>
          @if (request.kind === 'prompt') {
            <div class="field">
              <label for="app-dialog-input">{{ request.inputLabel }}</label>
              <textarea
                id="app-dialog-input"
                name="dialogInput"
                [value]="value"
                (input)="value = $any($event.target).value"
                rows="3"
                autofocus
              ></textarea>
              @if (request.requiredValue) {
                <small
                  >Enter <strong>{{ request.requiredValue }}</strong> exactly to continue.</small
                >
              }
            </div>
          }
          <div class="dialog-actions">
            <button class="btn btn-secondary" type="button" (click)="dialog.complete(null)">
              {{ request.cancelLabel }}
            </button>
            <button
              class="btn"
              [class.btn-primary]="!request.danger"
              [class.btn-danger]="request.danger"
              type="button"
              [disabled]="
                request.kind === 'prompt' &&
                (!value.trim() || (request.requiredValue && value.trim() !== request.requiredValue))
              "
              (click)="complete(request.kind)"
            >
              {{ request.confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .app-dialog-backdrop {
      display: flex;
      position: fixed;
      z-index: 1200;
      inset: 0;
      align-items: center;
      justify-content: center;
      padding: 24px max(18px, var(--safe-right)) max(24px, var(--safe-bottom))
        max(18px, var(--safe-left));
      background: rgba(8, 16, 31, 0.58);
      backdrop-filter: blur(4px);
      animation: surface-fade 0.16s ease-out both;
    }
    .app-dialog {
      width: min(480px, 100%);
      max-height: calc(100dvh - 48px);
      padding: 24px;
      overflow: auto;
      color: var(--ink);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      animation: dialog-in 0.2s var(--ease-out) both;
    }
    .app-dialog h2 {
      margin-bottom: 10px;
    }
    .app-dialog .muted {
      line-height: 1.55;
    }
    .dialog-handle {
      display: none;
    }
    .field {
      margin-top: 18px;
    }
    .field small {
      color: var(--muted);
    }
    .dialog-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 22px;
    }
    @keyframes dialog-in {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.99);
      }
    }
    @media (max-width: 640px) {
      .app-dialog-backdrop {
        align-items: flex-end;
        padding: 0;
      }
      .app-dialog {
        width: 100%;
        max-height: calc(100dvh - 12px);
        padding: 12px max(18px, var(--safe-right)) max(20px, var(--safe-bottom))
          max(18px, var(--safe-left));
        border-radius: 24px 24px 0 0;
        animation: sheet-in 0.22s var(--ease-out) both;
      }
      .dialog-handle {
        display: block;
        width: 42px;
        height: 4px;
        margin: 0 auto 18px;
        background: var(--line);
        border-radius: 99px;
      }
      .field textarea {
        font-size: 16px;
      }
    }
  `,
})
export class AppDialogComponent {
  value = '';

  constructor(readonly dialog: DialogService) {
    effect(() => (this.value = dialog.request()?.defaultValue ?? ''));
  }

  complete(kind: 'confirm' | 'prompt'): void {
    this.dialog.complete(kind === 'prompt' ? this.value.trim() : true);
  }

  @HostListener('document:keydown.escape')
  cancel(): void {
    if (this.dialog.request()) this.dialog.complete(null);
  }
}
