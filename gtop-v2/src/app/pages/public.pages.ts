import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { GoogleOneTapService } from '../core/google-one-tap.service';
import { DiagnosticsService } from '../core/diagnostics.service';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  template: `
    <div class="landing">
      <header class="landing-nav">
        <a class="brand" routerLink="/"
          ><span class="brand-mark">G</span
          ><span class="brand-copy"><strong>GTOP</strong><span>Growth Tutorials</span></span></a
        >
        <nav>
          <a href="#practice">Practice</a><a href="#clarity">Progress</a><a href="#live">Live</a>
        </nav>
        <button
          class="btn btn-secondary"
          type="button"
          aria-label="Sign in or open the GTOP workspace"
          (click)="enter()"
          [disabled]="busy()"
        >
          {{ auth.isAuthenticated() ? 'Open workspace' : 'Sign in' }}
        </button>
      </header>
      <main>
        <section class="hero">
          <div class="hero-copy">
            <p class="eyebrow">Objective practice, made useful</p>
            <h1>Practice with focus. Finish with a clear next step.</h1>
            <p class="lede">
              GTOP turns curriculum-aligned questions into a repeatable learning rhythm: choose a
              topic, practise, review the evidence, and know where to go next.
            </p>
            <div class="button-row">
              <button
                class="btn btn-primary"
                type="button"
                aria-label="Continue with Google to GTOP"
                (click)="enter()"
                [disabled]="busy()"
              >
                {{
                  busy()
                    ? 'Signing in…'
                    : auth.isAuthenticated()
                      ? 'Continue practising'
                      : 'Continue with Google'
                }}
              </button>
              <a class="btn btn-secondary" href="#practice">See how it works</a>
            </div>
            @if (error()) {
              <div class="error auth-error" role="alert">
                <strong>Sign-in did not complete.</strong>
                <span>{{ error() }}</span>
                <button class="btn btn-secondary" type="button" (click)="enter()">Try again</button>
              </div>
            }
            <div class="trust-row">
              <span>Board and standard aligned</span><span>Review every attempt</span
              ><span>Built for repeat practice</span>
            </div>
          </div>
          <div class="hero-panel" aria-label="Example learning dashboard">
            <div class="panel-top">
              <span class="pill success">Practice ready</span
              ><span class="muted small">Class 10 · Science</span>
            </div>
            <div class="focus-card">
              <p class="eyebrow">Your next useful move</p>
              <h2>Revisit light and reflection</h2>
              <p>Two recent attempts show the same concept needs another short round.</p>
              <div class="progress-track"><div class="progress-fill" style="width:64%"></div></div>
              <button class="btn btn-primary" type="button" (click)="enter()">
                Start 10 questions
              </button>
            </div>
            <div class="mini-grid">
              <div><strong>76%</strong><span>Recent accuracy</span></div>
              <div><strong>4</strong><span>Practice days</span></div>
              <div><strong>2</strong><span>Topics to revisit</span></div>
            </div>
          </div>
        </section>
        <section id="practice" class="story-section">
          <p class="eyebrow">The practice loop</p>
          <h2>Everything points back to better practice.</h2>
          <div class="grid grid-3">
            <article class="card">
              <span class="step">01</span>
              <h3>Choose a useful scope</h3>
              <p class="muted">
                Use your board and standard, then narrow to the subject or chapter that matters now.
              </p>
            </article>
            <article class="card">
              <span class="step">02</span>
              <h3>Answer without clutter</h3>
              <p class="muted">
                A calm quiz player keeps attention on the question, timing, and your own reasoning.
              </p>
            </article>
            <article class="card">
              <span class="step">03</span>
              <h3>Review and continue</h3>
              <p class="muted">
                See what worked, inspect mistakes, and retry weak areas instead of stopping at a
                score.
              </p>
            </article>
          </div>
        </section>
        <section id="clarity" class="split-section">
          <div>
            <p class="eyebrow">Clarity after every attempt</p>
            <h2>A score is a signal, not the finish line.</h2>
            <p class="lede">
              Reports connect recent accuracy, question history, and topic context. When evidence is
              limited, GTOP stays honest and recommends simple review instead of overclaiming
              personalization.
            </p>
          </div>
          <div class="card insight-card">
            <span class="pill warning">Needs another look</span>
            <h3>Electricity · Numericals</h3>
            <p class="muted">Accuracy moved from 48% to 61% across three attempts.</p>
            <div class="bars">
              <span style="height:36%"></span><span style="height:48%"></span
              ><span style="height:61%"></span><span class="target" style="height:78%"></span>
            </div>
          </div>
        </section>
        <section id="live" class="live-band">
          <div>
            <p class="eyebrow">Live practice</p>
            <h2>Bring energy into the same learning loop.</h2>
            <p>
              Join teacher-led live quizzes or start a lightweight quiz run with peers. Results
              still lead back to review and retry.
            </p>
          </div>
          <button class="btn btn-secondary" type="button" (click)="enter()">
            Explore live practice
          </button>
        </section>
      </main>
      <footer class="landing-footer">
        <strong>GTOP</strong><span>Growth Tutorials Objective Practice</span
        ><a routerLink="/privacy">Privacy</a>
      </footer>
    </div>
  `,
  styles: [
    `
      .landing {
        min-height: 100dvh;
        background: #f7f5ef;
      }
      .landing-nav {
        display: flex;
        width: min(1240px, 100%);
        height: 82px;
        margin: auto;
        padding: 0 28px;
        align-items: center;
        justify-content: space-between;
      }
      .landing-nav .brand {
        padding: 0;
      }
      .landing-nav .brand-copy strong {
        color: var(--ink);
      }
      .landing-nav .brand-copy span {
        color: var(--muted);
      }
      .landing-nav nav {
        display: flex;
        gap: 28px;
        color: var(--ink-2);
        font-size: 13px;
        font-weight: 650;
      }
      .hero {
        display: grid;
        width: min(1240px, 100%);
        min-height: 670px;
        margin: auto;
        padding: 72px 28px 88px;
        grid-template-columns: 1.08fr 0.92fr;
        align-items: center;
        gap: 72px;
      }
      .hero h1 {
        max-width: 760px;
        font-size: clamp(44px, 6vw, 76px);
      }
      .hero-copy .lede {
        font-size: 18px;
      }
      .hero-copy .button-row {
        margin: 30px 0;
      }
      .trust-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        color: var(--muted);
        font-size: 11px;
        font-weight: 650;
      }
      .trust-row span::before {
        margin-right: 6px;
        color: var(--teal);
        content: '✓';
      }
      .hero-panel {
        padding: 20px;
        background: #fff;
        border: 1px solid rgba(23, 35, 60, 0.08);
        border-radius: 28px;
        box-shadow: 0 28px 70px rgba(23, 35, 60, 0.13);
        transform: rotate(1deg);
      }
      .panel-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 4px 18px;
      }
      .focus-card {
        padding: 28px;
        color: #fff;
        background: var(--ink);
        border-radius: 20px;
      }
      .focus-card .eyebrow {
        color: #6ed0c7;
      }
      .focus-card p {
        color: #c2ccda;
        line-height: 1.6;
      }
      .focus-card .progress-track {
        margin: 24px 0;
        background: rgba(255, 255, 255, 0.13);
      }
      .focus-card .btn {
        width: 100%;
      }
      .mini-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-top: 10px;
      }
      .mini-grid div {
        padding: 18px 10px;
        text-align: center;
        background: #f6f5f1;
        border-radius: 14px;
      }
      .mini-grid strong,
      .mini-grid span {
        display: block;
      }
      .mini-grid strong {
        font-size: 23px;
      }
      .mini-grid span {
        margin-top: 4px;
        color: var(--muted);
        font-size: 9px;
      }
      .story-section,
      .split-section {
        width: min(1180px, 100%);
        margin: auto;
        padding: 90px 28px;
      }
      .story-section > h2 {
        max-width: 650px;
        margin-bottom: 32px;
      }
      .step {
        display: inline-grid;
        width: 34px;
        height: 34px;
        place-items: center;
        margin-bottom: 24px;
        color: var(--teal-strong);
        background: var(--teal-soft);
        border-radius: 10px;
        font-size: 11px;
        font-weight: 800;
      }
      .split-section {
        display: grid;
        grid-template-columns: 1fr 420px;
        align-items: center;
        gap: 80px;
        border-top: 1px solid var(--line);
      }
      .insight-card {
        padding: 30px;
      }
      .insight-card h3 {
        margin-top: 20px;
        font-size: 24px;
      }
      .bars {
        display: flex;
        height: 160px;
        align-items: flex-end;
        gap: 14px;
        margin-top: 30px;
        padding-top: 16px;
        border-bottom: 1px solid var(--line);
      }
      .bars span {
        flex: 1;
        background: #9ac7c3;
        border-radius: 8px 8px 0 0;
      }
      .bars .target {
        background: var(--teal);
      }
      .live-band {
        display: flex;
        width: min(1180px, calc(100% - 56px));
        margin: 50px auto 100px;
        padding: 48px;
        align-items: center;
        justify-content: space-between;
        gap: 40px;
        color: #fff;
        background: var(--ink);
        border-radius: 28px;
      }
      .live-band p:not(.eyebrow) {
        max-width: 680px;
        color: #c4cede;
        line-height: 1.6;
      }
      .live-band .eyebrow {
        color: #6ed0c7;
      }
      .landing-footer {
        display: flex;
        width: min(1180px, 100%);
        margin: auto;
        padding: 30px 28px max(30px, var(--safe-bottom));
        gap: 18px;
        color: var(--muted);
        border-top: 1px solid var(--line);
        font-size: 12px;
      }
      .landing-footer strong {
        color: var(--ink);
      }
      .landing-footer a {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        margin-left: auto;
      }
      .auth-error {
        display: grid;
        gap: 10px;
        margin: 18px 0;
      }
      .auth-error span {
        line-height: 1.5;
      }
      .auth-error .btn {
        justify-self: start;
      }
      @media (max-width: 850px) {
        .landing-nav nav {
          display: none;
        }
        .hero {
          min-height: auto;
          padding-top: 46px;
          grid-template-columns: 1fr;
        }
        .hero-panel {
          transform: none;
        }
        .split-section {
          grid-template-columns: 1fr;
          gap: 32px;
        }
        .live-band {
          align-items: flex-start;
          flex-direction: column;
        }
        .story-section,
        .split-section {
          padding-top: 64px;
          padding-bottom: 64px;
        }
      }
      @media (max-width: 540px) {
        .landing-nav {
          height: 70px;
          padding: 0 max(17px, var(--safe-right)) 0 max(17px, var(--safe-left));
        }
        .landing-nav .btn {
          min-height: 44px;
          padding: 0 12px;
        }
        .hero {
          padding: 34px max(17px, var(--safe-right)) 56px max(17px, var(--safe-left));
          gap: 30px;
        }
        .hero h1 {
          font-size: clamp(36px, 11vw, 42px);
        }
        .hero-copy .lede {
          font-size: 16px;
        }
        .hero-copy .button-row > * {
          width: 100%;
        }
        .hero-panel {
          padding: 14px;
          border-radius: 20px;
        }
        .focus-card {
          padding: 22px;
        }
        .mini-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .mini-grid div {
          padding: 14px 5px;
        }
        .mini-grid strong {
          font-size: 20px;
        }
        .story-section,
        .split-section {
          padding-left: max(17px, var(--safe-left));
          padding-right: max(17px, var(--safe-right));
        }
        .live-band {
          width: calc(100% - 34px);
          padding: 24px;
          margin-bottom: 60px;
        }
        .landing-footer {
          align-items: flex-start;
          flex-wrap: wrap;
          padding-left: max(17px, var(--safe-left));
          padding-right: max(17px, var(--safe-right));
        }
      }
      @media (max-width: 359px) {
        .landing-nav .brand-copy span {
          display: none;
        }
        .hero {
          padding-top: 28px;
        }
        .hero h1 {
          font-size: 36px;
        }
        .mini-grid {
          grid-template-columns: 1fr;
        }
        .landing-footer a {
          width: 100%;
          margin-left: 0;
        }
      }
      @media (max-height: 500px) and (orientation: landscape) and (max-width: 850px) {
        .hero {
          padding-top: 28px;
          gap: 26px;
        }
        .hero-panel {
          display: none;
        }
        .story-section,
        .split-section {
          padding-top: 46px;
          padding-bottom: 46px;
        }
      }
    `,
  ],
})
export class LandingPage {
  readonly busy = signal(false);
  readonly error = signal('');
  constructor(
    public readonly auth: AuthStore,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly diagnostics: DiagnosticsService,
    oneTap: GoogleOneTapService,
  ) {
    void oneTap;
    effect(() => {
      const profile = this.auth.profile();
      if (!profile || !this.auth.isAuthenticated()) return;
      const stored = sessionStorage.getItem('gtop-v2-auth-return-url');
      if (stored === null) return;
      sessionStorage.removeItem('gtop-v2-auth-return-url');
      const target =
        stored ||
        (profile.role === 'admin'
          ? '/admin'
          : profile.board && profile.standard
            ? '/dashboard'
            : '/profile-setup');
      void this.router.navigateByUrl(target);
    });
  }
  async enter(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (!this.auth.isAuthenticated()) {
        sessionStorage.setItem('gtop-v2-auth-return-url', returnUrl || '');
      }
      const profile = this.auth.isAuthenticated() ? this.auth.profile() : await this.auth.signIn();
      if (!profile) return;
      sessionStorage.removeItem('gtop-v2-auth-return-url');
      await this.router.navigateByUrl(
        returnUrl ||
          (profile?.role === 'admin'
            ? '/admin'
            : profile?.board && profile?.standard
              ? '/dashboard'
              : '/profile-setup'),
      );
    } catch (error) {
      this.diagnostics.captureError('auth', 'Landing-page sign-in flow failed.', error);
      sessionStorage.removeItem('gtop-v2-auth-return-url');
      const value = error as { code?: string; message?: string };
      this.error.set(
        `${value.message || 'Sign-in could not be completed.'}${value.code ? ` (${value.code})` : ''} Open Diagnostics below to copy device details.`,
      );
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-profile-editor',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Learning profile</p>
          <h1>{{ setup ? 'Set your practice context' : 'Your GTOP profile' }}</h1>
          <p class="lede">
            Board and standard help GTOP keep practice relevant. You can update them whenever your
            learning context changes.
          </p>
        </div>
      </div>
      <section class="card" style="max-width:720px">
        <form class="form-grid" (ngSubmit)="save()">
          <div class="field span-2">
            <label for="name">Display name</label
            ><input id="name" name="name" [(ngModel)]="name" required maxlength="80" />
          </div>
          <div class="field">
            <label for="board">Board</label
            ><select id="board" name="board" [(ngModel)]="board" required>
              <option value="">Choose board</option>
              <option>CBSE</option>
              <option>ICSE</option>
              <option>State Board</option>
              <option>NEET</option>
              <option>JEE</option>
            </select>
          </div>
          <div class="field">
            <label for="standard">Standard</label
            ><select id="standard" name="standard" [(ngModel)]="standard" required>
              <option value="">Choose standard</option>
              @for (value of standards; track value) {
                <option [value]="value">{{ value }}</option>
              }
            </select>
          </div>
          <div class="span-2 button-row">
            <button class="btn btn-primary" [disabled]="saving || !board || !standard">
              {{ saving ? 'Saving…' : 'Save and continue' }}
            </button>
            @if (!setup) {
              <a class="btn btn-secondary" routerLink="/dashboard">Cancel</a>
            }
          </div>
          @if (message) {
            <p class="span-2 success-box">{{ message }}</p>
          }
        </form>
      </section>
    </div>
  `,
})
export class ProfilePage {
  readonly standards = Array.from({ length: 8 }, (_, index) => String(index + 5));
  name = '';
  board = '';
  standard = '';
  saving = false;
  message = '';
  setup = false;
  constructor(
    public readonly auth: AuthStore,
    private readonly router: Router,
  ) {
    const profile = auth.profile();
    this.name = profile?.displayName ?? '';
    this.board = profile?.board ?? '';
    this.standard = profile?.standard ?? '';
    this.setup = router.url.includes('profile-setup');
  }
  async save(): Promise<void> {
    this.saving = true;
    await this.auth.updateProfile({
      displayName: this.name.trim(),
      board: this.board,
      standard: this.standard,
    });
    this.message = 'Profile saved.';
    this.saving = false;
    await this.router.navigateByUrl(this.auth.role() === 'admin' ? '/admin' : '/dashboard');
  }
}

@Component({
  selector: 'app-static-page',
  imports: [RouterLink],
  template: `<div class="page">
    <a class="eyebrow" routerLink="/">← GTOP home</a>
    <h1>{{ title() }}</h1>
    <p class="lede">{{ copy() }}</p>
    <section class="card">
      <h2>How GTOP handles your information</h2>
      <p class="muted">
        GTOP stores account, learning-profile, question-attempt, and live-session information needed
        to provide practice and reporting. Administrative access is role controlled. Contact Growth
        Tutorials for access, correction, or deletion requests.
      </p>
    </section>
  </div>`,
})
export class StaticPage {
  readonly title = computed(() =>
    location.pathname === '/privacy' ? 'Privacy and data use' : 'Page not found',
  );
  readonly copy = computed(() =>
    location.pathname === '/privacy'
      ? 'A concise explanation of the information used to operate your practice experience.'
      : 'The requested GTOP page does not exist or has moved.',
  );
}
