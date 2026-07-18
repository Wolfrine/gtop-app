import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { asDate, ThemeId } from '../core/models';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-theme-lab',
  imports: [FormsModule],
  template: `
    <div class="page theme-lab page-enter">
      <div class="page-head">
        <div>
          <p class="eyebrow">Experience studio</p>
          <h1>Choose how GTOP should feel.</h1>
          <p class="lede">
            Explore five complete visual directions privately. Nothing changes for other UAT users
            until you explicitly publish.
          </p>
        </div>
        <div class="published">
          <span class="pill success">Published</span><strong>{{ publishedName() }}</strong
          ><small>v{{ theme.published().version }} · {{ publishedAt() }}</small>
        </div>
      </div>
      <section class="theme-picker" aria-label="Available themes">
        @for (item of theme.themes; track item.id; let i = $index) {
          <button
            class="theme-choice card"
            [class.active]="selected() === item.id"
            (click)="select(item.id)"
            [style.--delay.ms]="i * 55"
          >
            <span class="swatches">
              @for (color of item.swatches; track color) {
                <i [style.background]="color"></i>
              }
            </span>
            <strong>{{ item.name }}</strong
            ><small>{{ item.description }}</small>
          </button>
        }
      </section>
      <div class="lab-toolbar card">
        <div class="segmented" aria-label="Preview size">
          @for (size of sizes; track size.id) {
            <button [class.active]="viewport() === size.id" (click)="viewport.set(size.id)">
              {{ size.label }}
            </button>
          }
        </div>
        <div class="button-row">
          <button
            class="btn btn-secondary"
            (click)="theme.resetPreview(); selected.set(theme.published().themeId)"
          >
            Reset</button
          ><button
            class="btn btn-primary"
            [disabled]="saving() || selected() === theme.published().themeId"
            (click)="publish()"
          >
            {{ saving() ? 'Publishing…' : 'Publish to UAT' }}
          </button>
        </div>
      </div>
      @if (message()) {
        <p class="success-box" role="status">{{ message() }}</p>
      }
      <section class="preview-stage">
        <div class="device-frame" [class]="viewport()">
          <div class="mini-shell">
            <aside>
              <div class="mini-brand">G</div>
              <span></span><span class="active"></span><span></span><span></span>
            </aside>
            <main>
              <div class="preview-head">
                <div>
                  <p class="eyebrow">Learning dashboard</p>
                  <h2>Good morning, Shalini.</h2>
                  <p class="muted">Build confidence one useful attempt at a time.</p>
                </div>
                <button class="btn btn-primary">Start practice</button>
              </div>
              <div class="grid grid-3 preview-stats">
                <article class="card">
                  <small>Accuracy</small><strong>78%</strong><span class="trend">↗ 6%</span>
                </article>
                <article class="card">
                  <small>Questions</small><strong>124</strong><span class="muted">This month</span>
                </article>
                <article class="card">
                  <small>Focus</small><strong>Light</strong><span class="muted">Science</span>
                </article>
              </div>
              <div class="grid grid-2 preview-content">
                <article class="card">
                  <div class="section-head">
                    <h3>Accuracy trend</h3>
                    <span class="pill info">12 attempts</span>
                  </div>
                  <div class="mini-chart">
                    @for (n of bars; track $index) {
                      <i [style.height.%]="n"></i>
                    }
                  </div>
                </article>
                <article class="card quiz-demo">
                  <span class="pill warning">Question 4 of 10</span>
                  <h3>Which lens corrects myopia?</h3>
                  @for (option of options; track option; let i = $index) {
                    <div class="option" [class.selected]="i === 1">
                      <span class="option-key">{{ letters[i] }}</span
                      >{{ option }}
                    </div>
                  }
                </article>
              </div>
              <div class="table-wrap preview-table">
                <table>
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Latest activity</th>
                      <th>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Aarav Mehta</strong></td>
                      <td>Science · Light</td>
                      <td><span class="pill success">84%</span></td>
                    </tr>
                    <tr>
                      <td><strong>Diya Shah</strong></td>
                      <td>Maths · Algebra</td>
                      <td><span class="pill warning">62%</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </main>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .published {
        display: grid;
        min-width: 190px;
        gap: 4px;
        text-align: right;
      }
      .published .pill {
        justify-self: end;
      }
      .published small,
      .theme-choice small {
        color: var(--muted);
      }
      .theme-picker {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 12px;
      }
      .theme-choice {
        display: grid;
        gap: 10px;
        text-align: left;
        animation: rise 0.45s var(--ease-out) both;
        animation-delay: var(--delay);
      }
      .theme-choice.active {
        border-color: var(--accent);
        box-shadow:
          0 0 0 3px var(--accent-soft),
          var(--shadow);
      }
      .swatches {
        display: flex;
        height: 32px;
        overflow: hidden;
        border-radius: 9px;
      }
      .swatches i {
        flex: 1;
      }
      .theme-choice strong {
        font-size: 14px;
      }
      .theme-choice small {
        line-height: 1.45;
      }
      .lab-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 16px;
        padding: 12px 14px;
      }
      .segmented {
        display: flex;
        padding: 4px;
        background: var(--surface-2);
        border-radius: 11px;
      }
      .segmented button {
        padding: 8px 12px;
        color: var(--muted);
        background: transparent;
        border: 0;
        border-radius: 8px;
        font-weight: 750;
      }
      .segmented button.active {
        color: var(--ink);
        background: var(--surface);
        box-shadow: var(--shadow-sm);
      }
      .preview-stage {
        display: flex;
        justify-content: center;
        margin-top: 22px;
        padding: 26px;
        background: var(--stage);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        overflow: auto;
      }
      .device-frame {
        width: 100%;
        max-width: 1100px;
        transition: width 0.35s var(--ease-out);
      }
      .device-frame.tablet {
        width: 780px;
      }
      .device-frame.mobile {
        width: 390px;
      }
      .mini-shell {
        display: grid;
        grid-template-columns: 100px 1fr;
        min-height: 650px;
        overflow: hidden;
        background: var(--canvas);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: var(--shadow-lg);
      }
      .mini-shell aside {
        display: flex;
        align-items: stretch;
        flex-direction: column;
        gap: 14px;
        padding: 22px 14px;
        background: var(--sidebar-bg);
      }
      .mini-shell aside > span {
        height: 24px;
        background: var(--sidebar-muted);
        border-radius: 7px;
        opacity: 0.32;
      }
      .mini-shell aside > span.active {
        background: var(--accent);
        opacity: 1;
      }
      .mini-brand {
        display: grid;
        width: 36px;
        height: 36px;
        margin-bottom: 22px;
        place-items: center;
        color: var(--accent-contrast);
        background: var(--accent);
        border-radius: 11px;
        font-weight: 900;
      }
      .mini-shell main {
        padding: 28px;
      }
      .preview-head {
        display: flex;
        justify-content: space-between;
        gap: 20px;
      }
      .preview-stats {
        margin-top: 22px;
      }
      .preview-stats article {
        display: grid;
        gap: 9px;
      }
      .preview-stats strong {
        font-size: 27px;
      }
      .trend {
        color: var(--success);
        font-weight: 800;
      }
      .preview-content {
        margin-top: 16px;
      }
      .mini-chart {
        display: flex;
        height: 170px;
        align-items: end;
        gap: 8px;
      }
      .mini-chart i {
        flex: 1;
        background: linear-gradient(180deg, var(--accent), var(--accent-2));
        border-radius: 5px 5px 0 0;
        animation: chart-grow 0.7s var(--ease-out) both;
      }
      .quiz-demo h3 {
        margin: 18px 0;
      }
      .quiz-demo .option {
        min-height: 42px;
        padding: 9px;
      }
      .preview-table {
        margin-top: 16px;
      }
      .device-frame.mobile .mini-shell {
        grid-template-columns: 1fr;
      }
      .device-frame.mobile aside {
        display: none;
      }
      .device-frame.mobile .preview-stats,
      .device-frame.mobile .preview-content {
        grid-template-columns: 1fr;
      }
      .device-frame.mobile .preview-head {
        flex-direction: column;
      }
      .device-frame.mobile .preview-table {
        display: none;
      }
      @media (max-width: 1000px) {
        .theme-picker {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 650px) {
        .theme-picker {
          grid-template-columns: 1fr;
        }
        .lab-toolbar {
          align-items: stretch;
          flex-direction: column;
          gap: 12px;
        }
        .segmented {
          overflow: auto;
        }
        .published {
          text-align: left;
        }
        .published .pill {
          justify-self: start;
        }
        .preview-stage {
          padding: 10px;
        }
      }
    `,
  ],
})
export class ThemeLabPage {
  readonly selected = signal<ThemeId>('academic-editorial');
  readonly viewport = signal<'desktop' | 'tablet' | 'mobile'>('desktop');
  readonly saving = signal(false);
  readonly message = signal('');
  readonly sizes = [
    { id: 'desktop' as const, label: 'Desktop' },
    { id: 'tablet' as const, label: 'Tablet' },
    { id: 'mobile' as const, label: 'Mobile' },
  ];
  readonly bars = [42, 58, 49, 72, 64, 84, 78, 91];
  readonly options = ['Concave lens', 'Convex lens', 'Cylindrical lens'];
  readonly letters = ['A', 'B', 'C'];
  readonly publishedName = computed(
    () =>
      this.theme.themes.find((item) => item.id === this.theme.published().themeId)?.name ??
      'Academic Editorial',
  );
  constructor(readonly theme: ThemeService) {
    this.selected.set(theme.activeTheme());
  }
  select(id: ThemeId): void {
    this.selected.set(id);
    this.theme.preview(id);
    this.message.set('');
  }
  publishedAt(): string {
    return asDate(this.theme.published().updatedAt)?.toLocaleString('en-IN') ?? 'Default';
  }
  async publish(): Promise<void> {
    if (
      environment.uat &&
      !confirm('UAT uses live configuration. Publish this theme for every v2 UAT user?')
    )
      return;
    this.saving.set(true);
    try {
      await this.theme.publish(this.selected());
      this.message.set(`${this.publishedName()} is now published to UAT.`);
    } finally {
      this.saving.set(false);
    }
  }
}
