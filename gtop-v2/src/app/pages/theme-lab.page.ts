import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { DialogService } from '../core/dialog.service';
import { asDate, DevicePreviewPreset, MotionPreset, ThemeId } from '../core/models';
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
            Explore five complete visual directions privately. Nothing changes for other users until
            you explicitly publish.
          </p>
        </div>
        <div class="published">
          <span class="pill success">Published</span><strong>{{ publishedName() }}</strong
          ><small>v{{ theme.published().version }} · {{ publishedAt() }}</small>
          <small>Published by {{ theme.published().updatedBy?.name || 'system default' }}</small>
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
        <div class="segmented" aria-label="Motion preset">
          <button [class.active]="motion() === 'purposeful'" (click)="setMotion('purposeful')">
            Purposeful motion
          </button>
          <button [class.active]="motion() === 'reduced'" (click)="setMotion('reduced')">
            Reduced motion
          </button>
        </div>
        <div class="button-row">
          <button class="btn btn-secondary" (click)="compare.update((value) => !value)">
            {{ compare() ? 'Close compare' : 'Compare' }}
          </button>
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
            {{ saving() ? 'Publishing…' : publishLabel }}
          </button>
        </div>
      </div>
      @if (message()) {
        <p class="success-box" role="status">{{ message() }}</p>
      }
      @if (compare()) {
        <section class="compare-grid" aria-label="Theme comparison">
          <article class="card">
            <p class="eyebrow">Experiment</p>
            <h2>{{ selectedDefinition()?.name }}</h2>
            <p class="muted">{{ selectedDefinition()?.description }}</p>
            <span class="swatches">
              @for (color of selectedDefinition()?.swatches || []; track color) {
                <i [style.background]="color"></i>
              }
            </span>
          </article>
          <article class="card">
            <p class="eyebrow">Published</p>
            <h2>{{ publishedName() }}</h2>
            <p class="muted">{{ publishedDefinition()?.description }}</p>
            <span class="swatches">
              @for (color of publishedDefinition()?.swatches || []; track color) {
                <i [style.background]="color"></i>
              }
            </span>
          </article>
        </section>
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
              <div class="grid grid-2 preview-extras">
                <article class="card">
                  <p class="eyebrow">Form controls</p>
                  <h3>Create practice</h3>
                  <label>Subject<input value="Science" readonly /></label
                  ><label
                    >Question count<select>
                      <option>10 questions</option>
                    </select></label
                  ><button class="btn btn-primary">Continue</button>
                </article>
                <article class="card mini-dialog">
                  <span class="pill info">Dialog</span>
                  <h3>Publish this experience?</h3>
                  <p class="muted">
                    The selected theme and motion preset will become visible to
                    {{ audienceLabel }}.
                  </p>
                  <div class="button-row">
                    <button class="btn btn-secondary">Cancel</button
                    ><button class="btn btn-primary">Publish</button>
                  </div>
                </article>
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
      .device-frame.wide {
        width: 1320px;
        max-width: none;
      }
      .device-frame.desktop {
        width: 1024px;
      }
      .device-frame.tablet {
        width: 768px;
      }
      .device-frame.phone {
        width: 390px;
      }
      .device-frame.compact-phone {
        width: 320px;
      }
      .device-frame.landscape-phone {
        width: 844px;
        max-width: none;
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
      .compare-grid,
      .preview-extras {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .compare-grid .swatches {
        margin-top: 18px;
      }
      .preview-extras label {
        display: grid;
        gap: 6px;
        margin: 12px 0;
        color: var(--muted);
        font-size: 11px;
      }
      .preview-extras input,
      .preview-extras select {
        width: 100%;
        padding: 9px;
        color: var(--ink);
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .mini-dialog {
        align-self: center;
        box-shadow: var(--shadow-lg);
      }
      .device-frame.compact-phone .mini-shell,
      .device-frame.phone .mini-shell,
      .device-frame.landscape-phone .mini-shell {
        grid-template-columns: 1fr;
      }
      .device-frame.compact-phone aside,
      .device-frame.phone aside,
      .device-frame.landscape-phone aside {
        display: none;
      }
      .device-frame.compact-phone .preview-stats,
      .device-frame.compact-phone .preview-content,
      .device-frame.phone .preview-stats,
      .device-frame.phone .preview-content {
        grid-template-columns: 1fr;
      }
      .device-frame.compact-phone .preview-head,
      .device-frame.phone .preview-head {
        flex-direction: column;
      }
      .device-frame.compact-phone .mini-shell {
        min-height: 568px;
      }
      .device-frame.phone .mini-shell {
        min-height: 844px;
      }
      .device-frame.landscape-phone .mini-shell {
        min-height: 390px;
      }
      .device-frame.landscape-phone .mini-shell main {
        padding: 18px;
      }
      .device-frame.compact-phone .preview-table,
      .device-frame.phone .preview-table {
        font-size: 10px;
      }
      .device-frame.compact-phone .preview-table th,
      .device-frame.compact-phone .preview-table td,
      .device-frame.phone .preview-table th,
      .device-frame.phone .preview-table td {
        padding: 8px;
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
  readonly audienceLabel = environment.uat ? 'v2 UAT users' : 'all GTOP users';
  readonly publishLabel = environment.uat ? 'Publish to UAT' : 'Publish appearance';
  readonly selected = signal<ThemeId>('academic-editorial');
  readonly viewport = signal<DevicePreviewPreset['id']>('desktop');
  readonly compare = signal(false);
  readonly motion = signal<MotionPreset>('purposeful');
  readonly saving = signal(false);
  readonly message = signal('');
  readonly sizes: DevicePreviewPreset[] = [
    { id: 'compact-phone', label: '320 phone', width: 320, height: 568 },
    { id: 'phone', label: '390 phone', width: 390, height: 844 },
    { id: 'landscape-phone', label: 'Landscape', width: 844, height: 390 },
    { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
    { id: 'desktop', label: 'Desktop', width: 1024, height: 768 },
    { id: 'wide', label: 'Wide', width: 1320, height: 900 },
  ];
  readonly bars = [42, 58, 49, 72, 64, 84, 78, 91];
  readonly options = ['Concave lens', 'Convex lens', 'Cylindrical lens'];
  readonly letters = ['A', 'B', 'C'];
  readonly publishedName = computed(
    () =>
      this.theme.themes.find((item) => item.id === this.theme.published().themeId)?.name ??
      'Academic Editorial',
  );
  readonly selectedDefinition = computed(() =>
    this.theme.themes.find((item) => item.id === this.selected()),
  );
  readonly publishedDefinition = computed(() =>
    this.theme.themes.find((item) => item.id === this.theme.published().themeId),
  );
  constructor(
    readonly theme: ThemeService,
    private readonly dialog: DialogService,
  ) {
    this.selected.set(theme.activeTheme());
    this.motion.set(theme.published().motionPreset);
  }
  select(id: ThemeId): void {
    this.selected.set(id);
    this.theme.preview(id, this.motion());
    this.message.set('');
  }
  setMotion(value: MotionPreset): void {
    this.motion.set(value);
    this.theme.preview(this.selected(), value);
  }
  publishedAt(): string {
    return asDate(this.theme.published().updatedAt)?.toLocaleString('en-IN') ?? 'Default';
  }
  async publish(): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: environment.uat
        ? 'Publish theme to all v2 UAT users?'
        : 'Publish theme to all GTOP users?',
      message: environment.uat
        ? 'UAT uses live configuration. This appearance and motion preset will update for every v2 UAT user.'
        : 'This appearance and motion preset will update for every GTOP user.',
      confirmLabel: this.publishLabel,
    });
    if (!confirmed) return;
    this.saving.set(true);
    try {
      await this.theme.publish(this.selected(), this.motion());
      this.message.set(`${this.publishedName()} is now published to ${this.audienceLabel}.`);
    } finally {
      this.saving.set(false);
    }
  }
}
