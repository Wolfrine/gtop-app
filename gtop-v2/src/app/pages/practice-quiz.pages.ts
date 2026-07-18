import { Component, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppNavigationService } from '../core/app-navigation.service';
import { AuthStore } from '../core/auth.store';
import { LearningRepository, PracticeFilters } from '../core/learning.repository';
import { Question, QuizAnswer, QuizResult, SyllabusItem, asDate } from '../core/models';
import { QuizSessionState, QuizSessionStore } from '../core/quiz-session.store';

@Component({
  selector: 'app-practice-builder',
  imports: [FormsModule],
  template: `<div class="page builder-page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Practice studio</p>
        <h1>Build the right challenge.</h1>
        <p class="lede">
          Start quickly or combine subjects and chapters into one deliberate practice set.
        </p>
      </div>
    </div>
    <div class="mode-tabs">
      <button [class.active]="mode === 'quick'" (click)="mode = 'quick'">✦ Quick practice</button
      ><button [class.active]="mode === 'custom'" (click)="mode = 'custom'">
        ◫ Custom practice
      </button>
    </div>
    <section class="card builder">
      @if (mode === 'quick') {
        <div class="quick-note">
          <span>✦</span>
          <div>
            <h2>Ten useful questions, chosen for you</h2>
            <p class="muted">
              GTOP will use {{ auth.profile()?.board || 'your board' }} ·
              {{ auth.profile()?.standard || 'your standard' }} and available coverage.
            </p>
          </div>
        </div>
      } @else {
        <div class="form-grid">
          <div class="field">
            <label>Board</label
            ><select [(ngModel)]="filters.board" (ngModelChange)="resetAfter('board')">
              <option value="">Choose board</option>
              @for (v of boards(); track v) {
                <option>{{ v }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Standard</label
            ><select [(ngModel)]="filters.standard" (ngModelChange)="resetAfter('standard')">
              <option value="">Choose standard</option>
              @for (v of standards(); track v) {
                <option>{{ v }}</option>
              }
            </select>
          </div>
        </div>
        <div class="selection-block">
          <label>Subjects <small>Select one or more</small></label>
          <div class="choice-grid">
            @for (v of subjects(); track v) {
              <button [class.active]="selectedSubjects.includes(v)" (click)="toggleSubject(v)">
                <span>{{ selectedSubjects.includes(v) ? '✓' : '+' }}</span
                >{{ v }}
              </button>
            }
          </div>
        </div>
        <div class="selection-block">
          <label
            >Chapters <small>{{ selectedChapters.length || 'All matching' }} selected</small></label
          >
          <div class="choice-grid chapters">
            @for (v of chapters(); track v) {
              <button [class.active]="selectedChapters.includes(v)" (click)="toggleChapter(v)">
                <span>{{ selectedChapters.includes(v) ? '✓' : '+' }}</span
                >{{ v }}
              </button>
            }
          </div>
        </div>
      }
      <div class="settings-grid">
        <div>
          <strong>Question count</strong>
          <div class="segmented">
            @for (count of counts; track count) {
              <button [class.active]="filters.count === count" (click)="filters.count = count">
                {{ count }}
              </button>
            }
          </div>
        </div>
        <div>
          <strong>Time per question</strong>
          <div class="segmented">
            @for (time of times; track time.value) {
              <button
                [class.active]="filters.perQuestionSeconds === time.value"
                (click)="filters.perQuestionSeconds = time.value"
              >
                {{ time.label }}
              </button>
            }
          </div>
        </div>
        <label class="toggle"
          ><input type="checkbox" [(ngModel)]="filters.autoAdvance" /><span></span>Auto-advance when
          time ends</label
        >
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <button class="btn btn-primary start" (click)="start()" [disabled]="loading()">
        {{ loading() ? 'Preparing questions…' : 'Start practice →' }}
      </button>
    </section>
  </div>`,
  styles: [
    `
      .builder-page {
        max-width: 1000px;
      }
      .builder {
        padding: 30px;
      }
      .mode-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 14px;
      }
      .mode-tabs button,
      .segmented button {
        padding: 10px 14px;
        color: var(--ink-2);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 10px;
        font-weight: 750;
      }
      .mode-tabs button.active,
      .segmented button.active {
        color: var(--accent-strong);
        background: var(--accent-soft);
        border-color: var(--accent);
      }
      .quick-note {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 24px;
        background: linear-gradient(135deg, var(--accent-soft), var(--surface-2));
        border-radius: var(--radius);
      }
      .quick-note > span {
        display: grid;
        width: 56px;
        height: 56px;
        place-items: center;
        color: var(--accent-contrast);
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        border-radius: 18px;
        font-size: 24px;
      }
      .selection-block {
        margin-top: 24px;
      }
      .selection-block > label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        font-weight: 800;
      }
      .selection-block small {
        color: var(--muted);
      }
      .choice-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .choice-grid button {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 9px 12px;
        color: var(--ink);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 99px;
      }
      .choice-grid button span {
        color: var(--accent);
        font-weight: 900;
      }
      .choice-grid button.active {
        background: var(--accent-soft);
        border-color: var(--accent);
      }
      .chapters button {
        border-radius: 10px;
      }
      .settings-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin: 28px 0;
        padding-top: 24px;
        border-top: 1px solid var(--line);
      }
      .settings-grid strong {
        display: block;
        margin-bottom: 10px;
      }
      .segmented {
        display: flex;
        gap: 6px;
      }
      .toggle {
        display: flex;
        grid-column: 1/-1;
        align-items: center;
        gap: 9px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }
      .toggle input {
        width: 18px;
        height: 18px;
      }
      .start {
        width: 100%;
        min-height: 50px;
      }
      @media (max-width: 650px) {
        .builder {
          padding: 20px;
        }
        .settings-grid {
          grid-template-columns: 1fr;
        }
        .segmented {
          overflow: auto;
        }
      }
    `,
  ],
})
export class PracticeBuilderPage implements OnInit {
  readonly syllabus = signal<SyllabusItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  mode: 'quick' | 'custom' = 'quick';
  filters: PracticeFilters = {
    count: 10,
    board: '',
    standard: '',
    subjects: [],
    chapters: [],
    perQuestionSeconds: 60,
    autoAdvance: true,
  };
  selectedSubjects: string[] = [];
  selectedChapters: string[] = [];
  readonly counts = [5, 10, 15, 20, 30];
  readonly times = [
    { label: 'Untimed', value: 0 },
    { label: '30 sec', value: 30 },
    { label: '60 sec', value: 60 },
    { label: '90 sec', value: 90 },
  ];
  boards = () => this.unique(this.syllabus().map((i) => i.board));
  standards = () =>
    this.unique(
      this.syllabus()
        .filter((i) => !this.filters.board || i.board === this.filters.board)
        .map((i) => i.standard),
    );
  subjects = () =>
    this.unique(
      this.syllabus()
        .filter(
          (i) =>
            (!this.filters.board || i.board === this.filters.board) &&
            (!this.filters.standard || i.standard === this.filters.standard),
        )
        .map((i) => i.subject),
    );
  chapters = () =>
    this.unique(
      this.syllabus()
        .filter(
          (i) =>
            (!this.filters.board || i.board === this.filters.board) &&
            (!this.filters.standard || i.standard === this.filters.standard) &&
            (!this.selectedSubjects.length || this.selectedSubjects.includes(i.subject)),
        )
        .map((i) => i.chapter),
    );
  constructor(
    public auth: AuthStore,
    private learning: LearningRepository,
    private sessions: QuizSessionStore,
    private route: ActivatedRoute,
    private router: Router,
    private navigation: AppNavigationService,
  ) {}
  async ngOnInit() {
    this.syllabus.set(await this.learning.syllabus());
    this.filters.board = this.auth.profile()?.board || '';
    this.filters.standard = this.auth.profile()?.standard || '';
  }
  resetAfter(field: string) {
    if (field === 'board') this.filters.standard = '';
    this.selectedSubjects = [];
    this.selectedChapters = [];
  }
  toggleSubject(v: string) {
    this.selectedSubjects = this.toggle(this.selectedSubjects, v);
    this.selectedChapters = this.selectedChapters.filter((c) => this.chapters().includes(c));
  }
  toggleChapter(v: string) {
    this.selectedChapters = this.toggle(this.selectedChapters, v);
  }
  async start() {
    this.loading.set(true);
    this.error.set('');
    try {
      const prepared = {
        ...this.filters,
        subjects: this.selectedSubjects,
        chapters: this.selectedChapters,
        quizType: this.mode,
      };
      const questions =
        this.mode === 'quick'
          ? await this.learning.quickQuestions(this.auth.profile() ?? {}, this.filters.count)
          : await this.learning.questions(prepared);
      if (!questions.length)
        throw new Error('No questions match this selection. Try fewer filters.');
      const qp = this.route.snapshot.queryParamMap;
      this.sessions.start({
        questions,
        filters: prepared,
        startedAt: Date.now(),
        returnTo: qp.get('returnTo') || undefined,
        hubReturnPath: qp.get('hubReturnPath') || undefined,
        launchContext: this.navigation.launch('new', {
          returnTo: qp.get('returnTo') || undefined,
          hubReturnPath: qp.get('hubReturnPath') || undefined,
        }),
      });
      await this.router.navigate([this.navigation.path('quiz')], {
        queryParams: { returnTo: qp.get('returnTo'), hubReturnPath: qp.get('hubReturnPath') },
      });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Practice could not be prepared.');
    } finally {
      this.loading.set(false);
    }
  }
  private unique(v: string[]) {
    return [...new Set(v.filter(Boolean))].sort();
  }
  private toggle(v: string[], x: string) {
    return v.includes(x) ? v.filter((i) => i !== x) : [...v, x];
  }
}

@Component({
  selector: 'app-quiz-player',
  template: `<div class="page quiz-wrap">
    @if (!session()) {
      <div class="card empty">
        <h2>No active practice</h2>
        <p>Build a practice set before opening the player.</p>
        <button class="btn btn-primary" (click)="router.navigateByUrl(navigation.path('practice'))">
          Build practice
        </button>
      </div>
    } @else {
      <div class="quiz-top">
        <div>
          <p class="eyebrow">{{ session()?.filters?.quizType }} practice</p>
          <strong>Question {{ index() + 1 }} of {{ questions().length }}</strong>
        </div>
        <div class="top-actions">
          @if (timed()) {
            <span class="timer" [class.urgent]="remaining() <= 10">{{ remaining() }}s</span>
          }
          <button class="btn btn-secondary" (click)="leave()">Exit</button>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-fill" [style.width.%]="progress()"></div>
      </div>
      <article class="card question-card" [class.swap]="swapping()">
        <div class="question-meta">
          <span class="pill info">{{ current().subject }}</span
          ><span class="muted small">{{ current().chapter }}</span>
        </div>
        <h1>{{ current().question }}</h1>
        <div role="radiogroup" aria-label="Answer options">
          @for (option of current().options || []; track $index) {
            <button
              class="option"
              [class.selected]="current().selectedIndex === $index"
              (click)="select($index)"
              [attr.aria-checked]="current().selectedIndex === $index"
            >
              <span class="option-key">{{ letters[$index] }}</span
              >{{ option }}
            </button>
          }
        </div>
        <div class="quiz-actions">
          <span class="muted small">Answers are saved in this browser until submission.</span>
          <div class="button-row">
            <button class="btn btn-secondary" [disabled]="index() === 0" (click)="previous()">
              Previous
            </button>
            @if (index() < questions().length - 1) {
              <button
                class="btn btn-primary"
                [disabled]="current().selectedIndex == null"
                (click)="next()"
              >
                Next question
              </button>
            } @else {
              <button
                class="btn btn-primary"
                [disabled]="!complete() || saving()"
                (click)="submit()"
              >
                {{ saving() ? 'Saving…' : 'Finish and review' }}
              </button>
            }
          </div>
        </div>
      </article>
    }
  </div>`,
  styles: [
    `
      .quiz-wrap {
        max-width: 900px;
      }
      .quiz-top,
      .question-meta,
      .quiz-actions,
      .top-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .quiz-wrap > .progress-track {
        margin: 16px 0 24px;
      }
      .timer {
        display: grid;
        min-width: 52px;
        height: 52px;
        place-items: center;
        color: var(--accent);
        background: var(--accent-soft);
        border: 2px solid var(--accent);
        border-radius: 50%;
        font-weight: 900;
      }
      .timer.urgent {
        color: var(--danger);
        border-color: var(--danger);
        animation: pulse-ring 1s infinite;
      }
      .question-card {
        padding: 34px;
        transition:
          opacity 0.16s,
          transform 0.16s;
      }
      .question-card.swap {
        opacity: 0.45;
        transform: translateX(8px);
      }
      .question-card h1 {
        margin: 28px 0;
        font-size: clamp(23px, 3vw, 34px);
        line-height: 1.35;
      }
      .quiz-actions {
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid var(--line);
      }
      @media (max-width: 600px) {
        .question-card {
          padding: 20px;
        }
        .quiz-actions {
          align-items: stretch;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class QuizPlayerPage implements OnDestroy {
  readonly session = signal<QuizSessionState | null>(null);
  readonly index = signal(0);
  readonly saving = signal(false);
  readonly remaining = signal(0);
  readonly swapping = signal(false);
  readonly letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  readonly questions = computed(() => this.session()?.questions ?? []);
  readonly current = computed(() => this.questions()[this.index()]);
  readonly progress = computed(
    () => ((this.index() + 1) / Math.max(this.questions().length, 1)) * 100,
  );
  readonly complete = computed(() => this.questions().every((q) => q.selectedIndex != null));
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private sessions: QuizSessionStore,
    private learning: LearningRepository,
    private auth: AuthStore,
    public router: Router,
    public navigation: AppNavigationService,
  ) {
    this.session.set(sessions.restore());
    this.resetTimer();
    window.addEventListener('beforeunload', this.beforeUnload);
  }
  ngOnDestroy() {
    clearInterval(this.timer);
    window.removeEventListener('beforeunload', this.beforeUnload);
  }
  timed() {
    return Number(this.session()?.filters.perQuestionSeconds || 0) > 0;
  }
  select(value: number) {
    const state = this.session();
    if (!state) return;
    state.questions[this.index()].selectedIndex = value;
    this.session.set({ ...state, questions: [...state.questions] });
    this.sessions.persist(this.session()!);
  }
  next() {
    if (this.index() < this.questions().length - 1) this.move(1);
  }
  previous() {
    if (this.index() > 0) this.move(-1);
  }
  leave() {
    if (confirm('Leave this practice? Your answers will remain in this browser.'))
      this.router.navigateByUrl(this.navigation.routeForSession('practice', this.session()?.launchContext));
  }
  async submit() {
    const session = this.session(),
      profile = this.auth.profile();
    if (!session || !profile) return;
    this.saving.set(true);
    const answers: QuizAnswer[] = session.questions.map((q) => ({
      questionId: q.id,
      selectedIndex: q.selectedIndex ?? -1,
      correctIndex: q.correctIndex,
      isCorrect: q.selectedIndex === q.correctIndex,
    }));
    const first = session.questions[0],
      durationSeconds = Math.round((Date.now() - session.startedAt) / 1000);
    const resultId = await this.learning.saveResult({
      userId: profile.uid,
      userName: profile.displayName,
      board: first?.board || profile.board || '',
      standard: first?.standard || profile.standard || '',
      subject: this.mixed('subject'),
      chapter: this.mixed('chapter'),
      quizType: session.filters.quizType || 'custom',
      answers,
      duration: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
      durationSeconds,
    });
    sessionStorage.setItem(
      'gtop-v2-summary',
      JSON.stringify({ ...session, resultId, durationSeconds }),
    );
    this.sessions.finish();
    await this.router.navigate([this.navigation.routeForSession('quiz-summary', session.launchContext)], {
      queryParams: { returnTo: session.returnTo, hubReturnPath: session.hubReturnPath },
    });
  }
  @HostListener('window:keydown', ['$event']) keys(event: KeyboardEvent) {
    if (/^[1-6]$/.test(event.key)) {
      const i = Number(event.key) - 1;
      if (i < this.current()?.options.length) this.select(i);
    }
    if (event.key === 'ArrowRight' && this.current()?.selectedIndex != null) this.next();
    if (event.key === 'ArrowLeft') this.previous();
  }
  private move(delta: number) {
    this.swapping.set(true);
    setTimeout(() => {
      this.index.update((v) => v + delta);
      this.swapping.set(false);
      this.resetTimer();
    }, 140);
  }
  private resetTimer() {
    clearInterval(this.timer);
    const seconds = Number(this.session()?.filters.perQuestionSeconds || 0);
    this.remaining.set(seconds);
    if (!seconds) return;
    this.timer = setInterval(() => {
      this.remaining.update((v) => Math.max(v - 1, 0));
      if (this.remaining() === 0) {
        clearInterval(this.timer);
        if (this.current().selectedIndex == null) this.select(-1);
        if (this.session()?.filters.autoAdvance) {
          if (this.index() < this.questions().length - 1) this.move(1);
          else void this.submit();
        }
      }
    }, 1000);
  }
  private mixed(key: 'subject' | 'chapter') {
    const values = [...new Set(this.questions().map((q) => q[key]))];
    return values.length === 1 ? values[0] : 'Mixed';
  }
  private beforeUnload = (e: BeforeUnloadEvent) => {
    if (this.session() && !this.saving()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
}

interface SummaryState extends QuizSessionState {
  resultId?: string;
  durationSeconds?: number;
}
@Component({
  selector: 'app-quiz-summary',
  imports: [FormsModule, RouterLink],
  template: `<div class="page summary-page">
    <div class="celebration" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="page-head">
      <div>
        <p class="eyebrow">Practice complete</p>
        <h1>{{ message() }}</h1>
        <p class="lede">
          Review the evidence, flag content issues and choose the most useful retry.
        </p>
      </div>
      <div class="score-ring" [style.--score]="accuracy()">
        <strong>{{ accuracy() }}%</strong><span>accuracy</span>
      </div>
    </div>
    <div class="grid grid-4">
      <div class="card stat">
        <small>Correct</small>
        <p class="stat-value">{{ correct() }}/{{ questions().length }}</p>
      </div>
      <div class="card stat">
        <small>Needs review</small>
        <p class="stat-value">{{ incorrect().length }}</p>
      </div>
      <div class="card stat">
        <small>Duration</small>
        <p class="stat-value small-value">{{ duration() }}</p>
      </div>
      <div class="card stat">
        <small>Scope</small>
        <p class="stat-value small-value">{{ scope() }}</p>
      </div>
    </div>
    <section class="section">
      <div class="section-head">
        <div>
          <p class="eyebrow">Question review</p>
          <h2>Understand each answer</h2>
        </div>
        <div class="button-row">
          <div class="segmented">
            <button [class.active]="filter() === 'all'" (click)="filter.set('all')">All</button
            ><button [class.active]="filter() === 'incorrect'" (click)="filter.set('incorrect')">
              Incorrect only
            </button>
          </div>
          <button class="btn btn-secondary" (click)="retry(false)">Retry all</button
          ><button class="btn btn-primary" [disabled]="!incorrect().length" (click)="retry(true)">
            Retry incorrect
          </button>
        </div>
      </div>
      <div class="grid">
        @for (question of visible(); track question.id; let i = $index) {
          <article class="card review-card">
            <div class="section-head">
              <span
                class="pill"
                [class.success]="question.selectedIndex === question.correctIndex"
                [class.danger]="question.selectedIndex !== question.correctIndex"
                >{{ question.selectedIndex === question.correctIndex ? 'Correct' : 'Review' }}</span
              ><button
                class="flag-btn"
                [disabled]="flagged().has(question.id)"
                (click)="flag(question)"
              >
                {{ flagged().has(question.id) ? '✓ Flagged' : '⚑ Report question' }}
              </button>
            </div>
            <h3>{{ question.question }}</h3>
            @for (option of question.options; track $index) {
              <div
                class="option"
                [class.correct]="$index === question.correctIndex"
                [class.incorrect]="
                  $index === question.selectedIndex && $index !== question.correctIndex
                "
              >
                <span class="option-key">{{ letters[$index] }}</span
                >{{ option }}
              </div>
            }
            @if (question.solutions.length) {
              <div class="solution">
                <strong>Explanation</strong>
                <p>{{ question.solutions[0] }}</p>
              </div>
            }
          </article>
        }
      </div>
    </section>
    <div class="button-row footer-actions">
      <a class="btn btn-secondary" routerLink="/reports">Open reports</a
      ><a class="btn btn-secondary" routerLink="/dashboard">Dashboard</a>
      @if (returnTarget) {
        <a class="btn btn-primary" [href]="returnTarget">Return to connected app</a>
      }
    </div>
  </div>`,
  styles: [
    `
      .summary-page {
        max-width: 1000px;
        position: relative;
      }
      .score-ring {
        display: grid;
        width: 120px;
        height: 120px;
        place-items: center;
        background: conic-gradient(var(--accent) calc(var(--score) * 1%), var(--surface-2) 0);
        border: 10px solid var(--surface);
        border-radius: 50%;
        box-shadow: var(--shadow);
      }
      .score-ring::before {
        position: absolute;
        width: 82px;
        height: 82px;
        background: var(--surface);
        border-radius: 50%;
        content: '';
      }
      .score-ring > * {
        position: relative;
        z-index: 1;
      }
      .score-ring strong {
        font-size: 24px;
      }
      .score-ring span {
        margin-top: -28px;
        color: var(--muted);
        font-size: 9px;
      }
      .small-value {
        font-size: 20px;
      }
      .segmented {
        display: flex;
        gap: 5px;
        padding: 4px;
        background: var(--surface-2);
        border-radius: 10px;
      }
      .segmented button {
        padding: 8px 10px;
        color: var(--muted);
        background: transparent;
        border: 0;
        border-radius: 7px;
        font-weight: 700;
      }
      .segmented button.active {
        color: var(--ink);
        background: var(--surface);
      }
      .review-card h3 {
        margin: 20px 0;
        line-height: 1.5;
      }
      .review-card .option {
        cursor: default;
      }
      .solution {
        margin-top: 18px;
        padding: 16px;
        background: var(--surface-2);
        border-radius: 12px;
      }
      .flag-btn {
        color: var(--accent);
        background: transparent;
        border: 0;
        font-weight: 750;
      }
      .footer-actions {
        margin-top: 28px;
      }
      .celebration i {
        position: absolute;
        width: 7px;
        height: 18px;
        background: var(--accent);
        animation: confetti 1.3s ease-out both;
      }
      .celebration i:nth-child(1) {
        left: 20%;
        --x: -30px;
      }
      .celebration i:nth-child(2) {
        left: 50%;
        background: var(--accent-2);
        --x: 15px;
      }
      .celebration i:nth-child(3) {
        right: 20%;
        background: var(--success);
        --x: 35px;
      }
      @keyframes confetti {
        from {
          top: 80px;
          opacity: 1;
          transform: translateX(0) rotate(0);
        }
        to {
          top: 280px;
          opacity: 0;
          transform: translateX(var(--x)) rotate(270deg);
        }
      }
    `,
  ],
})
export class QuizSummaryPage implements OnInit {
  readonly session = signal<SummaryState | null>(null);
  readonly filter = signal<'all' | 'incorrect'>('all');
  readonly flagged = signal(new Set<string>());
  readonly letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  readonly questions = computed(() => this.session()?.questions ?? []);
  readonly correct = computed(
    () => this.questions().filter((q) => q.selectedIndex === q.correctIndex).length,
  );
  readonly incorrect = computed(() =>
    this.questions().filter((q) => q.selectedIndex !== q.correctIndex),
  );
  readonly accuracy = computed(() =>
    this.questions().length ? Math.round((this.correct() / this.questions().length) * 100) : 0,
  );
  readonly visible = computed(() =>
    this.filter() === 'incorrect' ? this.incorrect() : this.questions(),
  );
  readonly message = computed(() =>
    this.accuracy() >= 80
      ? 'Strong work. Keep the rhythm.'
      : this.accuracy() >= 50
        ? 'Useful attempt. Tighten the gaps.'
        : 'Clear evidence for what to revisit.',
  );
  returnTarget = '';
  constructor(
    private sessions: QuizSessionStore,
    private learning: LearningRepository,
    private auth: AuthStore,
    private router: Router,
    private route: ActivatedRoute,
    private navigation: AppNavigationService,
  ) {
    try {
      this.session.set(JSON.parse(sessionStorage.getItem('gtop-v2-summary') || 'null'));
    } catch {}
    const origin = this.route.snapshot.queryParamMap.get('returnTo') || '';
    const path = this.route.snapshot.queryParamMap.get('hubReturnPath') || '';
    if (origin)
      try {
        this.returnTarget = new URL(path || '/', origin).toString();
      } catch {
        this.returnTarget = '';
      }
  }
  async ngOnInit() {
    if (this.session()) return;
    const resultId = this.route.snapshot.queryParamMap.get('sessionId');
    const userId = this.route.snapshot.queryParamMap.get('userId') || this.auth.profile()?.uid;
    if (!resultId || !userId) return;
    const result = await this.learning.resultById(resultId);
    if (!result || result.userId !== userId) return;
    const questions = await this.learning.questionsByIds(result.questions.map((q) => q.questionId));
    const answers = new Map(result.questions.map((q) => [q.questionId, q]));
    questions.forEach((question) => {
      question.selectedIndex = answers.get(question.id)?.selectedIndex ?? null;
    });
    this.session.set({
      questions,
      filters: { quizType: result.quizType },
      startedAt: Date.now(),
      resultId: result.id,
      durationSeconds: result.durationSeconds,
      launchContext: this.navigation.launch('historical', {
        sourceResultId: result.id,
        sourceUserId: userId,
        readOnly: userId !== this.auth.profile()?.uid,
      }),
    });
  }
  duration() {
    const seconds = this.session()?.durationSeconds ?? 0;
    return seconds ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : '—';
  }
  scope() {
    const values = [...new Set(this.questions().map((q) => q.subject))];
    return values.length === 1 ? values[0] : 'Mixed';
  }
  async retry(onlyIncorrect: boolean) {
    const source = onlyIncorrect ? this.incorrect() : this.questions();
    const questions = source.map((q) => ({ ...q, selectedIndex: null }));
    const state = this.session();
    if (!state || !questions.length) return;
    this.sessions.start({
      ...state,
      questions,
      startedAt: Date.now(),
      launchContext: {
        ...this.navigation.launch(onlyIncorrect ? 'retry-incorrect' : 'retry-all'),
        sourceResultId: state.resultId,
      },
    });
    await this.router.navigateByUrl(
      this.navigation.routeForSession('quiz', this.sessions.active()?.launchContext),
    );
  }
  async flag(question: Question) {
    const reason = prompt(
      'What should the content team review?',
      'Question or answer may be incorrect',
    );
    if (!reason) return;
    await this.learning.flagQuestion(question.id, this.auth.profile()!.uid, reason);
    this.flagged.update((v) => new Set(v).add(question.id));
  }
}

@Component({
  selector: 'app-reports',
  imports: [FormsModule, RouterLink],
  template: `<div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Practice evidence</p>
        <h1>Progress you can act on.</h1>
        <p class="lede">Open any attempt, understand the pattern and launch a focused retry.</p>
      </div>
      <a class="btn btn-primary" [routerLink]="navigation.path('practice')">New practice</a>
    </div>
    @if (loading()) {
      <div class="grid grid-4">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="card skeleton" style="height:130px"></div>
        }
      </div>
    } @else if (!results().length) {
      <div class="card empty">
        <h2>No attempts yet</h2>
        <a class="btn btn-primary" [routerLink]="navigation.path('practice')">Start practice</a>
      </div>
    } @else {
      <div class="grid grid-4">
        <div class="card stat">
          <small>Attempts</small>
          <p class="stat-value">{{ results().length }}</p>
        </div>
        <div class="card stat">
          <small>Questions</small>
          <p class="stat-value">{{ total() }}</p>
        </div>
        <div class="card stat">
          <small>Average</small>
          <p class="stat-value">{{ average() }}%</p>
        </div>
        <div class="card stat">
          <small>Latest</small>
          <p class="stat-value">{{ results()[0].percentage }}%</p>
          <span class="muted small">{{ delta() }}</span>
        </div>
      </div>
      <section class="section grid grid-2">
        <article class="card">
          <p class="eyebrow">Accuracy trend</p>
          <h2>Recent attempts</h2>
          <div class="chart">
            @for (result of reverseRecent(); track result.id) {
              <div>
                <span [style.height.%]="result.percentage"></span
                ><small>{{ result.percentage }}%</small>
              </div>
            }
          </div>
        </article>
        <article class="card">
          <p class="eyebrow">Practice mix</p>
          <h2>Quiz types</h2>
          @for (item of mix(); track item.type) {
            <div class="mix">
              <span>{{ item.type }}</span>
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="item.percent"></div>
              </div>
              <b>{{ item.count }}</b>
            </div>
          }
        </article>
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Attempt history</h2>
          <select [(ngModel)]="typeFilter">
            <option value="">All types</option>
            <option value="quick">Quick</option>
            <option value="custom">Custom</option>
            <option value="live">Live</option>
            <option value="run">Run</option>
          </select>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Scope</th>
                <th>Mode</th>
                <th>Duration</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (result of filtered(); track result.id) {
                <tr>
                  <td>{{ date(result.timestamp) }}</td>
                  <td>
                    <strong>{{ result.subject }}</strong
                    ><br /><span class="muted small">{{ result.chapter }}</span>
                  </td>
                  <td>{{ result.quizType }}</td>
                  <td>{{ result.duration || '—' }}</td>
                  <td>
                    <span
                      class="pill"
                      [class.success]="result.percentage >= 70"
                      [class.warning]="result.percentage < 70"
                      >{{ result.percentage }}%</span
                    >
                  </td>
                  <td>
                    <div class="button-row">
                      <button class="btn btn-secondary" (click)="review(result)">Review</button
                      ><button
                        class="btn btn-quiet"
                        (click)="retry(result, true)"
                        [disabled]="!result.wrongAnswers"
                      >
                        Retry incorrect
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  </div>`,
  styles: [
    `
      .chart {
        display: flex;
        height: 240px;
        align-items: end;
        gap: 9px;
        border-bottom: 1px solid var(--line);
      }
      .chart > div {
        display: flex;
        height: 100%;
        flex: 1;
        align-items: center;
        justify-content: flex-end;
        flex-direction: column;
        gap: 7px;
      }
      .chart span {
        width: 100%;
        min-height: 3px;
        background: linear-gradient(var(--accent-2), var(--accent));
        border-radius: 6px 6px 0 0;
        animation: chart-grow 0.7s var(--ease-out);
      }
      .chart small {
        font-size: 8px;
      }
      .mix {
        display: grid;
        grid-template-columns: 70px 1fr 25px;
        gap: 12px;
        align-items: center;
        margin: 18px 0;
        text-transform: capitalize;
      }
    `,
  ],
})
export class ReportsPage implements OnInit {
  readonly results = signal<QuizResult[]>([]);
  readonly loading = signal(true);
  readonly total = computed(() => this.results().reduce((s, r) => s + r.totalQuestions, 0));
  readonly average = computed(() =>
    this.total()
      ? Math.round((this.results().reduce((s, r) => s + r.correctAnswers, 0) / this.total()) * 100)
      : 0,
  );
  typeFilter = '';
  constructor(
    private auth: AuthStore,
    private learning: LearningRepository,
    private sessions: QuizSessionStore,
    private router: Router,
    private route: ActivatedRoute,
    public navigation: AppNavigationService,
  ) {}
  async ngOnInit() {
    const requested = this.route.snapshot.queryParamMap.get('userId');
    const uid = requested && this.auth.isAdmin() ? requested : this.auth.profile()?.uid;
    if (uid) this.results.set(await this.learning.results(uid));
    this.loading.set(false);
  }
  filtered() {
    return this.results().filter((r) => !this.typeFilter || r.quizType === this.typeFilter);
  }
  reverseRecent() {
    return this.results().slice(0, 12).reverse();
  }
  date(v: unknown) {
    return (
      asDate(v)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) ||
      '—'
    );
  }
  delta() {
    const a = this.results();
    if (a.length < 2) return 'First result';
    const d = a[0].percentage - a[1].percentage;
    return `${d >= 0 ? '↑' : '↓'} ${Math.abs(d)} pts vs previous`;
  }
  mix() {
    const values = ['quick', 'custom', 'live', 'run'].map((type) => ({
      type,
      count: this.results().filter((r) => r.quizType === type).length,
    }));
    const max = Math.max(...values.map((v) => v.count), 1);
    return values.map((v) => ({ ...v, percent: (v.count / max) * 100 }));
  }
  async review(result: QuizResult) {
    const questions = await this.load(result, false);
    sessionStorage.setItem(
      'gtop-v2-summary',
      JSON.stringify({
        questions,
        filters: { quizType: result.quizType },
        startedAt: Date.now(),
        resultId: result.id,
        launchContext: this.navigation.launch('historical', {
          sourceResultId: result.id,
          sourceUserId: result.userId,
          readOnly: result.userId !== this.auth.profile()?.uid,
        }),
      }),
    );
    await this.router.navigateByUrl(this.navigation.path('quiz-summary'));
  }
  async retry(result: QuizResult, incorrect: boolean) {
    const questions = await this.load(result, incorrect);
    this.sessions.start({
      questions,
      filters: {
        board: result.board,
        standard: result.standard,
        subject: result.subject,
        chapter: result.chapter,
        count: questions.length,
        quizType: 'custom',
      },
      startedAt: Date.now(),
      launchContext: {
        ...this.navigation.launch(incorrect ? 'retry-incorrect' : 'retry-all'),
        sourceResultId: result.id,
      },
    });
    await this.router.navigateByUrl(this.navigation.path('quiz'));
  }
  private async load(result: QuizResult, incorrect: boolean) {
    const answers = result.questions.filter((a) => !incorrect || !a.isCorrect),
      questions = await this.learning.questionsByIds(answers.map((a) => a.questionId)),
      byId = new Map(answers.map((a) => [a.questionId, a]));
    questions.forEach(
      (q) => (q.selectedIndex = incorrect ? null : (byId.get(q.id)?.selectedIndex ?? null)),
    );
    return questions;
  }
}
