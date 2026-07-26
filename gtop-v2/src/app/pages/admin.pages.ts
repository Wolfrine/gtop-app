import { Component, NgModule, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule as AngularFormsModule } from '@angular/forms';
import { RouterLink, RouterModule } from '@angular/router';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { AdminRepository } from '../core/admin.repository';
import { AuthStore } from '../core/auth.store';
import { ClientDiagnostic, DiagnosticsService } from '../core/diagnostics.service';
import { DialogService } from '../core/dialog.service';
import { GenericFirestoreRepository } from '../core/firestore.repository';
import { LiveRepository } from '../core/live.repository';
import {
  FirestoreRecord,
  DashboardMetric,
  GtopUser,
  LiveSession,
  Question,
  QuizResult,
  SyllabusItem,
  asDate,
} from '../core/models';
import { PresenceService } from '../core/presence.service';

@NgModule({
  imports: [AngularFormsModule, RouterModule],
  exports: [AngularFormsModule, RouterModule],
})
class FormsModule {}

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  template: `<div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Administration</p>
        <h1>See the system. Move the work.</h1>
        <p class="lede">
          Content, learner activity, live practice and delivery work in one operational workspace.
        </p>
      </div>
      <div class="button-row">
        <button class="btn btn-secondary" type="button" (click)="loadCounts(true)">
          Refresh metrics
        </button>
        <a class="btn btn-secondary" routerLink="/admin/learning/practice">Take a quiz</a
        ><a class="btn btn-primary" routerLink="/admin/action-plan">Open action plan</a>
      </div>
    </div>
    <div class="grid grid-4">
      @for (item of statCards(); track item.label) {
        <article class="card stat">
          <span class="muted small">{{ item.label }}</span>
          <p class="stat-value">{{ item.value }}</p>
          <span class="pill" [class.warning]="item.warning" [class.danger]="item.error">{{
            item.error || item.note
          }}</span>
        </article>
      }
    </div>
    <section class="section">
      <div class="section-head">
        <div>
          <p class="eyebrow">Workspace</p>
          <h2>Choose an area</h2>
        </div>
      </div>
      <div class="grid grid-3">
        @for (link of links; track link.path) {
          <a class="card card-hover" [routerLink]="link.path"
            ><span class="pill info">{{ link.kicker }}</span>
            <h3 style="margin-top:18px">{{ link.title }}</h3>
            <p class="muted">{{ link.copy }}</p></a
          >
        }
      </div>
    </section>
  </div>`,
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  readonly metrics = signal<Record<string, DashboardMetric>>({});
  readonly onlineCount = computed(
    () => this.presence.records().filter((item) => item.isOnline).length,
  );
  private stopPresence?: () => void;
  private readonly metricDefinitions = [
    ['questions', 'Questions', 'Content bank'],
    ['users', 'Users', 'Profiles'],
    ['QuizResults', 'Quiz attempts', 'Evidence'],
    ['openLiveSessions', 'Open live rooms', 'Scheduled or active'],
    ['activeWork', 'Active work', 'Action plan'],
  ] as const;
  readonly links = [
    {
      kicker: 'Learning',
      title: 'Take a quiz',
      copy: 'Use every learner practice workflow with your admin identity.',
      path: '/admin/learning/practice',
    },
    {
      kicker: 'People',
      title: 'User activity',
      copy: 'Open profiles, presence, attempts and trends.',
      path: '/admin/users',
    },
    {
      kicker: 'Content',
      title: 'Question bank',
      copy: 'Edit, import and review flagged questions.',
      path: '/admin/questions',
    },
    {
      kicker: 'Curriculum',
      title: 'Syllabus coverage',
      copy: 'Preview, edit and synchronize curriculum.',
      path: '/admin/syllabus',
    },
    {
      kicker: 'Experience',
      title: 'Theme Lab',
      copy: 'Try and publish one of five complete visual systems.',
      path: '/admin/theme-lab',
    },
    {
      kicker: 'Delivery',
      title: 'Action plan',
      copy: 'Track owners, blockers, evidence and readiness.',
      path: '/admin/action-plan',
    },
  ];
  constructor(
    private admin: AdminRepository,
    private presence: PresenceService,
  ) {}
  async ngOnInit() {
    this.stopPresence = this.presence.listenAll();
    await this.loadCounts();
  }
  ngOnDestroy() {
    this.stopPresence?.();
  }
  statCards() {
    const stored = this.metrics();
    return [
      ...this.metricDefinitions.map(([key, label, note]) => ({
        label,
        value:
          stored[key]?.status === 'ready'
            ? stored[key].value
            : stored[key]?.status === 'loading'
              ? '…'
              : '—',
        note: stored[key]?.source === 'cache' ? `${note} · cached` : note,
        error: stored[key]?.status === 'error' ? 'Unavailable · retry' : '',
        warning: key === 'activeWork',
      })),
      {
        label: 'Online now',
        value: this.onlineCount(),
        note: 'Realtime presence',
        error: '',
        warning: false,
      },
    ];
  }
  async loadCounts(force = false) {
    await Promise.all(
      this.metricDefinitions.map(async ([key]) => {
        const cacheKey = `gtop-v2-dashboard-${key}`;
        if (!force) {
          try {
            const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null') as {
              value: number;
              at: number;
            } | null;
            if (cached && Date.now() - cached.at < 300_000) {
              this.setMetric(key, {
                status: 'ready',
                value: cached.value,
                source: 'cache',
                refreshedAt: new Date(cached.at).toISOString(),
              });
              return;
            }
          } catch {}
        }
        this.setMetric(key, { status: 'loading', value: null, source: 'firestore' });
        try {
          const value = await this.admin.countMetric(key);
          const at = Date.now();
          sessionStorage.setItem(cacheKey, JSON.stringify({ value, at }));
          this.setMetric(key, {
            status: 'ready',
            value,
            source: 'firestore',
            refreshedAt: new Date(at).toISOString(),
          });
        } catch (error) {
          this.setMetric(key, {
            status: 'error',
            value: null,
            source: 'firestore',
            error: error instanceof Error ? error.message : 'Metric unavailable',
          });
        }
      }),
    );
  }
  private setMetric(key: string, value: DashboardMetric) {
    this.metrics.update((current) => ({ ...current, [key]: value }));
  }
}

interface ImportRow extends Partial<Question> {
  valid: boolean;
  errors: string[];
  duplicate: boolean;
}
@Component({
  selector: 'app-question-bank',
  imports: [FormsModule],
  template: `<div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Content quality</p>
        <h1>Question bank</h1>
        <p class="lede">
          Search, inspect, import and maintain the questions behind solo and live practice.
        </p>
      </div>
      <div class="button-row">
        <button class="btn btn-secondary" (click)="showImport.set(true)">Bulk JSON import</button
        ><button class="btn btn-primary" (click)="openNew()">Add question</button>
      </div>
    </div>
    <section class="card filters">
      <div class="form-grid">
        <div class="field">
          <label>Board</label
          ><select [(ngModel)]="filters.board" (ngModelChange)="resetAfter('board')">
            <option value="">All boards</option>
            @for (v of boards(); track v) {
              <option>{{ v }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>Standard</label
          ><select [(ngModel)]="filters.standard" (ngModelChange)="resetAfter('standard')">
            <option value="">All standards</option>
            @for (v of standards(); track v) {
              <option>{{ v }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>Subject</label
          ><select [(ngModel)]="filters.subject" (ngModelChange)="resetAfter('subject')">
            <option value="">All subjects</option>
            @for (v of subjects(); track v) {
              <option>{{ v }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>Chapter</label
          ><select [(ngModel)]="filters.chapter">
            <option value="">All chapters</option>
            @for (v of chapters(); track v) {
              <option>{{ v }}</option>
            }
          </select>
        </div>
      </div>
      <div class="button-row top-gap">
        <button class="btn btn-primary" (click)="load()">Apply filters</button
        ><button class="btn btn-secondary" (click)="clear()">Clear</button
        ><button class="btn btn-quiet" (click)="showFlags.set(!showFlags())">
          Open flags ({{ flags().length }})
        </button>
      </div>
    </section>
    @if (showFlags()) {
      <section class="card flags">
        <div class="section-head">
          <h2>Question flags</h2>
          <button class="btn btn-secondary" (click)="showFlags.set(false)">Close</button>
        </div>
        @for (flag of flags(); track flag.id) {
          <div class="flag-row">
            <span
              ><strong>{{ flag['reason'] || 'Review requested' }}</strong
              ><small>{{ flag['questionId'] }} · {{ flag['userId'] }}</small></span
            ><span class="pill warning">{{ flag['status'] }}</span>
          </div>
        } @empty {
          <div class="empty">No open question flags.</div>
        }
      </section>
    }
    @if (editor()) {
      <section class="card editor">
        <div class="section-head">
          <h2>{{ draft.id ? 'Edit question' : 'New question' }}</h2>
          <button class="btn btn-secondary" (click)="editor.set(false)">Close</button>
        </div>
        <div class="form-grid">
          <div class="field"><label>Board</label><input [(ngModel)]="draft.board" /></div>
          <div class="field"><label>Standard</label><input [(ngModel)]="draft.standard" /></div>
          <div class="field"><label>Subject</label><input [(ngModel)]="draft.subject" /></div>
          <div class="field"><label>Chapter</label><input [(ngModel)]="draft.chapter" /></div>
          <div class="field span-2">
            <label>Question</label><textarea [(ngModel)]="draft.question"></textarea>
          </div>
          @for (option of draft.options; track $index) {
            <div class="field">
              <label>Option {{ letters[$index] }}</label
              ><input [(ngModel)]="draft.options![$index]" />
            </div>
          }
          <div class="field">
            <label>Correct option</label
            ><select [(ngModel)]="draft.correctIndex">
              @for (option of draft.options; track $index) {
                <option [ngValue]="$index">{{ letters[$index] }} · {{ option || 'Empty' }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Explanation</label><textarea [(ngModel)]="solution"></textarea>
          </div>
        </div>
        <button
          class="btn btn-primary top-gap"
          (click)="save()"
          [disabled]="saving() || !draft.question"
        >
          {{ saving() ? 'Saving…' : 'Save question' }}
        </button>
      </section>
    }
    @if (showImport()) {
      <section class="card import-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Validated import</p>
            <h2>Paste a JSON array</h2>
          </div>
          <button class="btn btn-secondary" (click)="showImport.set(false)">Close</button>
        </div>
        <textarea
          class="json-input"
          [(ngModel)]="importJson"
          placeholder='[{"board":"CBSE",...}]'
        ></textarea>
        <div class="button-row top-gap">
          <button class="btn btn-secondary" (click)="validateImport()">Validate</button
          ><button
            class="btn btn-primary"
            [disabled]="!importRows().length || invalidImports() || saving()"
            (click)="commitImport()"
          >
            Import {{ validImports() }} questions
          </button>
        </div>
        @if (importError()) {
          <p class="error">{{ importError() }}</p>
        }
        @if (importRows().length) {
          <div class="import-summary">
            <span class="pill success">{{ validImports() }} valid</span
            ><span class="pill danger">{{ invalidImports() }} invalid</span
            ><span class="pill warning">{{ duplicateImports() }} possible duplicates</span>
            <span class="pill info">{{ affectedSyllabusImports() }} syllabus paths affected</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Scope</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                @for (row of importRows(); track $index) {
                  <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ row.question }}</td>
                    <td>
                      {{ row.board }} · {{ row.standard }}<br />{{ row.subject }} /
                      {{ row.chapter }}
                    </td>
                    <td>
                      <span
                        class="pill"
                        [class.success]="row.valid && !row.duplicate"
                        [class.danger]="!row.valid"
                        [class.warning]="row.duplicate"
                        >{{
                          row.errors.join(', ') || (row.duplicate ? 'Possible duplicate' : 'Ready')
                        }}</span
                      >
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <section class="section">
      <div class="section-head">
        <h2>{{ questions().length }} questions</h2>
        <span class="muted small">Click a question to inspect options and explanation</span>
      </div>
      <div class="table-wrap question-table">
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Scope</th>
              <th>Flags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (q of questions(); track q.id) {
              <tr class="expandable" (click)="expanded.set(expanded() === q.id ? '' : q.id)">
                <td>
                  <strong>{{ q.question }}</strong>
                  @if (expanded() === q.id) {
                    <div class="question-detail">
                      @for (option of q.options; track $index) {
                        <div [class.correct]="$index === q.correctIndex">
                          <b>{{ letters[$index] }}</b> {{ option }}
                        </div>
                      }
                      @if (q.solutions.length) {
                        <p><strong>Explanation:</strong> {{ q.solutions[0] }}</p>
                      }
                    </div>
                  }
                </td>
                <td>
                  {{ q.board }} · {{ q.standard }}<br /><span class="muted small"
                    >{{ q.subject }} / {{ q.chapter }}</span
                  >
                </td>
                <td>{{ q.flagCount || 0 }}</td>
                <td>
                  <div class="button-row" (click)="$event.stopPropagation()">
                    <button class="btn btn-secondary" (click)="copy(q)">Copy JSON</button
                    ><button class="btn btn-secondary" (click)="edit(q)">Edit</button
                    ><button class="btn btn-danger" (click)="remove(q)">Retire</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="empty">Choose filters and load the question bank.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="mobile-question-list">
        @for (q of questions(); track q.id) {
          <article class="card mobile-question-card">
            <div class="mobile-question-head">
              <span class="pill info">{{ q.subject }}</span>
              <span class="pill" [class.warning]="q.flagCount">{{ q.flagCount || 0 }} flags</span>
            </div>
            <button
              class="question-toggle"
              type="button"
              (click)="expanded.set(expanded() === q.id ? '' : q.id)"
            >
              <strong>{{ q.question }}</strong>
              <span aria-hidden="true">{{ expanded() === q.id ? '−' : '+' }}</span>
            </button>
            <p class="muted small">{{ q.board }} · {{ q.standard }} · {{ q.chapter }}</p>
            @if (expanded() === q.id) {
              <div class="question-detail">
                @for (option of q.options; track $index) {
                  <div [class.correct]="$index === q.correctIndex">
                    <b>{{ letters[$index] }}</b> {{ option }}
                  </div>
                }
                @if (q.solutions.length) {
                  <p><strong>Explanation:</strong> {{ q.solutions[0] }}</p>
                }
              </div>
            }
            <div class="button-row mobile-question-actions">
              <button class="btn btn-secondary" (click)="copy(q)">Copy JSON</button>
              <button class="btn btn-secondary" (click)="edit(q)">Edit</button>
              <button class="btn btn-danger" (click)="remove(q)">Retire</button>
            </div>
          </article>
        } @empty {
          <div class="card empty">Choose filters and load the question bank.</div>
        }
      </div>
      @if (nextCursor) {
        <div class="button-row top-gap">
          <button class="btn btn-secondary" (click)="loadMore()">Load next page</button>
        </div>
      }
    </section>
  </div>`,
  styles: [
    `
      .filters,
      .editor,
      .import-panel,
      .flags {
        margin-bottom: 20px;
      }
      .top-gap {
        margin-top: 16px;
      }
      .editor {
        border-color: var(--accent);
      }
      .json-input {
        width: 100%;
        min-height: 180px;
        padding: 14px;
        color: var(--ink);
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: 12px;
        font-family: ui-monospace, monospace;
      }
      .import-summary {
        display: flex;
        gap: 8px;
        margin: 16px 0;
      }
      .expandable {
        cursor: pointer;
      }
      .question-detail {
        display: grid;
        gap: 7px;
        margin-top: 14px;
        padding: 14px;
        background: var(--surface-2);
        border-radius: 10px;
      }
      .question-detail .correct {
        color: var(--success);
        font-weight: 700;
      }
      .flag-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid var(--line);
      }
      .flag-row span > * {
        display: block;
      }
      .flag-row small {
        margin-top: 4px;
        color: var(--muted);
      }
      .mobile-question-list {
        display: none;
      }
      @media (max-width: 680px) {
        .question-table {
          display: none;
        }
        .mobile-question-list {
          display: grid;
          gap: 10px;
        }
        .mobile-question-card {
          display: grid;
          gap: 10px;
        }
        .mobile-question-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .question-toggle {
          display: grid;
          width: 100%;
          min-height: 44px;
          grid-template-columns: 1fr auto;
          align-items: start;
          gap: 12px;
          padding: 0;
          color: var(--ink);
          background: transparent;
          border: 0;
          text-align: left;
          line-height: 1.45;
        }
        .question-toggle > span {
          font-size: 22px;
        }
        .mobile-question-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .mobile-question-actions .btn-danger {
          grid-column: 1 / -1;
        }
        .import-summary {
          flex-wrap: wrap;
        }
        .json-input {
          font-size: 16px;
        }
      }
    `,
  ],
})
export class QuestionBankPage implements OnInit {
  readonly questions = signal<Question[]>([]);
  readonly syllabus = signal<SyllabusItem[]>([]);
  readonly flags = signal<FirestoreRecord[]>([]);
  readonly editor = signal(false);
  readonly showImport = signal(false);
  readonly showFlags = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly importError = signal('');
  readonly importRows = signal<ImportRow[]>([]);
  readonly expanded = signal('');
  readonly letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  filters: Partial<Question> = {};
  draft: Partial<Question> = { options: ['', '', '', ''], correctIndex: 0 };
  solution = '';
  importJson = '';
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
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
            (!this.filters.subject || i.subject === this.filters.subject),
        )
        .map((i) => i.chapter),
    );
  constructor(
    private admin: AdminRepository,
    private auth: AuthStore,
    private dialog: DialogService,
  ) {}
  async ngOnInit() {
    this.syllabus.set(await this.admin.syllabus());
    this.flags.set(await this.admin.openQuestionFlags());
  }
  async load(append = false) {
    this.error.set('');
    try {
      const page = await this.admin.questionPage(
        this.filters,
        25,
        append ? this.nextCursor : undefined,
      );
      this.questions.set(append ? [...this.questions(), ...page.items] : page.items);
      this.nextCursor = page.cursor;
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
  clear() {
    this.filters = {};
    this.questions.set([]);
    this.nextCursor = undefined;
  }
  resetAfter(field: string) {
    if (field === 'board') {
      this.filters.standard = '';
      this.filters.subject = '';
      this.filters.chapter = '';
    }
    if (field === 'standard') {
      this.filters.subject = '';
      this.filters.chapter = '';
    }
    if (field === 'subject') this.filters.chapter = '';
  }
  openNew() {
    this.draft = { options: ['', '', '', ''], correctIndex: 0 };
    this.solution = '';
    this.editor.set(true);
  }
  edit(q: Question) {
    this.draft = { ...q, options: [...q.options] };
    this.solution = q.solutions?.[0] || '';
    this.editor.set(true);
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  async save() {
    this.saving.set(true);
    try {
      this.draft.solutions = this.solution ? [this.solution] : [];
      await this.admin.saveQuestion(this.draft, this.auth.profile()!.uid);
      this.editor.set(false);
      await this.admin.refreshSyllabusCounts();
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }
  async remove(q: Question) {
    const warning = environment.uat
      ? 'UAT IS USING LIVE DATA. This retires a production question.'
      : 'Retire this question?';
    const confirmed = environment.uat
      ? await this.dialog.prompt({
          title: 'Retire production question?',
          message: warning,
          inputLabel: 'Type DELETE to confirm',
          requiredValue: 'DELETE',
          confirmLabel: 'Retire question',
          danger: true,
        })
      : await this.dialog.confirm({
          title: 'Retire this question?',
          message: warning,
          confirmLabel: 'Retire question',
          danger: true,
        });
    if (!confirmed) return;
    await this.admin.softDeleteQuestion(q, this.auth.profile()!.uid);
    await this.admin.refreshSyllabusCounts();
    await this.load();
  }
  copy(q: Question) {
    void navigator.clipboard.writeText(
      JSON.stringify(
        {
          board: q.board,
          standard: q.standard,
          subject: q.subject,
          chapter: q.chapter,
          title: q.title,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          solutions: q.solutions,
        },
        null,
        2,
      ),
    );
  }
  async validateImport() {
    this.importError.set('');
    try {
      const parsed = JSON.parse(this.importJson);
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array.');
      const texts = parsed.map((raw: Partial<Question>) => raw.question || '');
      const existing = await this.admin.duplicateQuestionTexts(texts);
      const withinImport = new Map<string, number>();
      texts.forEach((value: string) => {
        const key = value.trim().toLowerCase();
        withinImport.set(key, (withinImport.get(key) || 0) + 1);
      });
      this.importRows.set(
        parsed.map((raw: Partial<Question>) => {
          const errors: string[] = [];
          if (!raw.question?.trim()) errors.push('Missing question');
          if (!Array.isArray(raw.options) || raw.options.length < 2)
            errors.push('At least 2 options');
          if (
            !Number.isInteger(raw.correctIndex) ||
            Number(raw.correctIndex) < 0 ||
            Number(raw.correctIndex) >= Number(raw.options?.length ?? 0)
          )
            errors.push('Invalid correctIndex');
          for (const key of ['board', 'standard', 'subject', 'chapter'] as const)
            if (!raw[key]) errors.push(`Missing ${key}`);
          return {
            ...raw,
            valid: !errors.length,
            errors,
            duplicate:
              existing.has(raw.question?.trim().toLowerCase() ?? '') ||
              (withinImport.get(raw.question?.trim().toLowerCase() ?? '') || 0) > 1,
          };
        }),
      );
    } catch (e) {
      this.importRows.set([]);
      this.importError.set(this.message(e));
    }
  }
  validImports() {
    return this.importRows().filter((r) => r.valid && !r.duplicate).length;
  }
  invalidImports() {
    return this.importRows().filter((r) => !r.valid).length;
  }
  duplicateImports() {
    return this.importRows().filter((r) => r.duplicate).length;
  }
  affectedSyllabusImports() {
    return new Set(
      this.importRows()
        .filter((row) => row.valid && !row.duplicate)
        .map((row) => `${row.board}|${row.standard}|${row.subject}|${row.chapter}`),
    ).size;
  }
  async loadMore() {
    if (this.nextCursor) await this.load(true);
  }
  async commitImport() {
    if (
      environment.uat &&
      !(await this.dialog.confirm({
        title: `Import ${this.validImports()} questions?`,
        message:
          'These validated questions will be written to live production data and syllabus counts will be refreshed.',
        confirmLabel: 'Import questions',
      }))
    )
      return;
    this.saving.set(true);
    try {
      await this.admin.importQuestions(
        this.importRows().filter((r) => r.valid && !r.duplicate),
        this.auth.profile()!.uid,
      );
      this.showImport.set(false);
      this.importJson = '';
      this.importRows.set([]);
      this.syllabus.set(await this.admin.syllabus());
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }
  private unique(v: string[]) {
    return [...new Set(v.filter(Boolean))].sort();
  }
  private message(e: unknown) {
    return e instanceof Error ? e.message : 'Operation failed.';
  }
}

@Component({
  selector: 'app-syllabus-admin',
  imports: [FormsModule],
  template: `<div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Curriculum coverage</p>
        <h1>Syllabus</h1>
        <p class="lede">
          Preview structure, inspect coverage and safely propagate hierarchy changes to linked
          questions.
        </p>
      </div>
      <div class="button-row">
        <button class="btn btn-secondary" (click)="preview.set(!preview())">
          {{ preview() ? 'Table view' : 'Learner preview' }}</button
        ><button class="btn btn-secondary" (click)="preparePreview()">Prepare change preview</button
        ><button
          class="btn btn-secondary"
          [disabled]="!previewRows().length"
          (click)="publishPreview()"
        >
          Publish preview</button
        ><button class="btn btn-secondary" (click)="refreshCounts()">Refresh counts</button
        ><button class="btn btn-primary" (click)="newItem()">Add chapter</button>
      </div>
    </div>
    @if (message()) {
      <p class="success-box">{{ message() }}</p>
    }
    @if (editing()) {
      <section class="card editor">
        <div class="section-head">
          <div>
            <p class="eyebrow">{{ draft.id ? 'Edit and propagate' : 'New syllabus item' }}</p>
            <h2>{{ draft.chapter || 'Chapter details' }}</h2>
          </div>
          <button class="btn btn-secondary" (click)="editing.set(false)">Close</button>
        </div>
        <div class="form-grid">
          <div class="field"><label>Board</label><input [(ngModel)]="draft.board" /></div>
          <div class="field"><label>Standard</label><input [(ngModel)]="draft.standard" /></div>
          <div class="field"><label>Subject</label><input [(ngModel)]="draft.subject" /></div>
          <div class="field"><label>Chapter</label><input [(ngModel)]="draft.chapter" /></div>
        </div>
        <p class="muted small">
          Changing hierarchy fields updates all questions currently linked to the original
          combination and writes an audit record.
        </p>
        <div class="button-row">
          <button class="btn btn-primary" (click)="save()">Preview and save</button
          ><button class="btn btn-secondary" (click)="editing.set(false)">Cancel</button>
        </div>
      </section>
    }
    @if (preview()) {
      <section class="preview-board">
        @for (group of grouped(); track group.key) {
          <article class="card">
            <div class="section-head">
              <div>
                <span class="pill info">{{ group.board }} · {{ group.standard }}</span>
                <h2>{{ group.subject }}</h2>
              </div>
              <strong>{{ group.total }} questions</strong>
            </div>
            <div class="chapter-grid">
              @for (item of group.items; track item.id) {
                <button (click)="edit(item)">
                  <span
                    >{{ item.chapter }}
                    @if (previewStatus(item.id)) {
                      <small
                        class="pill"
                        [class.warning]="previewStatus(item.id) === 'changed'"
                        [class.success]="previewStatus(item.id) === 'existing'"
                        >{{ previewStatus(item.id) }}</small
                      >
                    }</span
                  ><b [class.zero]="item.mcqCount === 0">{{ item.mcqCount || 0 }} MCQs</b>
                </button>
              }
            </div>
          </article>
        }
      </section>
    } @else {
      <section class="section">
        <div class="section-head">
          <h2>{{ items().length }} syllabus combinations</h2>
          <input class="search" [(ngModel)]="search" placeholder="Search syllabus" />
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Board</th>
                <th>Standard</th>
                <th>Subject</th>
                <th>Chapter</th>
                <th>Questions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of filtered(); track item.id) {
                <tr>
                  <td>{{ item.board }}</td>
                  <td>{{ item.standard }}</td>
                  <td>{{ item.subject }}</td>
                  <td>
                    <strong>{{ item.chapter }}</strong>
                  </td>
                  <td>
                    <span class="pill" [class.warning]="item.mcqCount === 0">{{
                      item.mcqCount || 0
                    }}</span>
                  </td>
                  <td>
                    <div class="button-row">
                      <a
                        class="btn btn-secondary"
                        [routerLink]="['/admin/questions']"
                        [queryParams]="{
                          board: item.board,
                          standard: item.standard,
                          subject: item.subject,
                          chapter: item.chapter,
                        }"
                        >View MCQs</a
                      ><button class="btn btn-secondary" (click)="edit(item)">Edit</button>
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
      .editor {
        margin-bottom: 20px;
        border-color: var(--accent);
      }
      .search {
        min-height: 42px;
        padding: 8px 12px;
        color: var(--ink);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .preview-board {
        display: grid;
        gap: 18px;
      }
      .chapter-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }
      .chapter-grid button {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 15px;
        color: var(--ink);
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: 11px;
        text-align: left;
      }
      .chapter-grid b {
        color: var(--success);
        font-size: 11px;
      }
      .chapter-grid b.zero {
        color: var(--warning);
      }
      @media (max-width: 700px) {
        .chapter-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class SyllabusAdminPage implements OnInit {
  readonly items = signal<SyllabusItem[]>([]);
  readonly editing = signal(false);
  readonly preview = signal(false);
  readonly message = signal('');
  readonly previewRows = signal<FirestoreRecord[]>([]);
  search = '';
  draft: Partial<SyllabusItem> = {};
  original: SyllabusItem | null = null;
  constructor(
    private admin: AdminRepository,
    private auth: AuthStore,
    private dialog: DialogService,
  ) {}
  async ngOnInit() {
    await this.load();
    this.previewRows.set(await this.admin.syllabusPreview());
  }
  filtered() {
    const s = this.search.toLowerCase();
    return this.items().filter(
      (i) => !s || `${i.board} ${i.standard} ${i.subject} ${i.chapter}`.toLowerCase().includes(s),
    );
  }
  grouped() {
    const groups = new Map<
      string,
      {
        key: string;
        board: string;
        standard: string;
        subject: string;
        items: SyllabusItem[];
        total: number;
      }
    >();
    for (const item of this.filtered()) {
      const key = `${item.board}|${item.standard}|${item.subject}`;
      const group = groups.get(key) ?? {
        key,
        board: item.board,
        standard: item.standard,
        subject: item.subject,
        items: [],
        total: 0,
      };
      group.items.push(item);
      group.total += item.mcqCount || 0;
      groups.set(key, group);
    }
    return [...groups.values()];
  }
  newItem() {
    this.draft = { mcqCount: 0 };
    this.original = null;
    this.editing.set(true);
  }
  edit(item: SyllabusItem) {
    this.draft = { ...item };
    this.original = item;
    this.editing.set(true);
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  async save() {
    if (
      environment.uat &&
      !(await this.dialog.confirm({
        title: 'Save syllabus change?',
        message:
          'UAT uses live production data. Linked questions may be updated when hierarchy values change.',
        confirmLabel: 'Save change',
      }))
    )
      return;
    let affected = 0;
    if (this.original)
      affected = await this.admin.updateSyllabusAndQuestions(
        this.draft,
        this.original,
        this.auth.profile()!.uid,
      );
    else await this.admin.saveSyllabus(this.draft);
    this.message.set(
      affected ? `Syllabus saved and ${affected} linked questions updated.` : 'Syllabus saved.',
    );
    this.editing.set(false);
    await this.load();
  }
  async refreshCounts() {
    const count = await this.admin.refreshSyllabusCounts(this.auth.profile()!.uid);
    this.message.set(`Refreshed question counts for ${count} syllabus combinations.`);
    await this.load();
  }
  previewStatus(id: string) {
    return String(this.previewRows().find((item) => item.id === id)?.['status'] || '');
  }
  async preparePreview() {
    this.previewRows.set(await this.admin.prepareSyllabusPreview(this.auth.profile()!.uid));
    this.preview.set(true);
    const counts = ['new', 'changed', 'existing', 'absent'].map(
      (status) =>
        `${status}: ${this.previewRows().filter((item) => item['status'] === status).length}`,
    );
    this.message.set(`Preview prepared · ${counts.join(' · ')}`);
  }
  async publishPreview() {
    if (
      environment.uat &&
      !(await this.dialog.confirm({
        title: 'Publish syllabus preview?',
        message:
          'The prepared new, changed, existing, and absent states will be published using live production data.',
        confirmLabel: 'Publish preview',
      }))
    )
      return;
    await this.admin.publishSyllabusPreview(this.auth.profile()!.uid);
    this.previewRows.set(await this.admin.syllabusPreview());
    this.message.set('Syllabus preview published.');
  }
  private async load() {
    this.items.set(
      (await this.admin.syllabus()).sort((a, b) =>
        `${a.board}${a.standard}${a.subject}${a.chapter}`.localeCompare(
          `${b.board}${b.standard}${b.subject}${b.chapter}`,
        ),
      ),
    );
  }
}

@Component({
  selector: 'app-users-admin',
  imports: [FormsModule, RouterLink],
  template: `<div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">People and access</p>
        <h1>User activity</h1>
        <p class="lede">
          See who is active and open any learner for full profile, quiz history and trends.
        </p>
      </div>
      <div class="online-card">
        <strong>{{ onlineCount() }}</strong
        ><span>online now</span>
      </div>
    </div>
    <section class="card filters">
      <div class="form-grid">
        <div class="field">
          <label>Search</label><input [(ngModel)]="search" placeholder="Name or email" />
        </div>
        <div class="field">
          <label>Role</label
          ><select [(ngModel)]="roleFilter">
            <option value="">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div class="field">
          <label>Presence</label
          ><select [(ngModel)]="presenceFilter">
            <option value="">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
        <div class="field">
          <label>Board</label
          ><select [(ngModel)]="boardFilter">
            <option value="">All boards</option>
            @for (board of boards(); track board) {
              <option>{{ board }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>Standard</label
          ><select [(ngModel)]="standardFilter">
            <option value="">All standards</option>
            @for (standard of standards(); track standard) {
              <option>{{ standard }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>Recent activity</label
          ><select [(ngModel)]="recentFilter">
            <option value="">Any time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
        <div class="field">
          <label>Latest performance</label
          ><select [(ngModel)]="performanceFilter">
            <option value="">Any score</option>
            <option value="low">Below 50%</option>
            <option value="medium">50–79%</option>
            <option value="high">80%+</option>
          </select>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <h2>{{ filtered().length }} users</h2>
        <span class="muted small">Select a row to open full activity</span>
      </div>
      <div class="table-wrap users-table">
        <table>
          <thead>
            <tr>
              <th>Presence</th>
              <th>User</th>
              <th>Learning context</th>
              <th>Role</th>
              <th>Last seen</th>
              <th>Latest score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (user of filtered(); track user.uid) {
              <tr class="user-row-link" [routerLink]="['/admin/users', user.uid]">
                <td>
                  <span class="status-dot" [class.online]="isOnline(user.uid)"></span
                  >{{ isOnline(user.uid) ? 'Online' : 'Offline' }}
                </td>
                <td>
                  <strong>{{ user.displayName || 'Unnamed user' }}</strong
                  ><br /><span class="muted small">{{ user.email }}</span>
                </td>
                <td>{{ user.board || '—' }} · {{ user.standard || '—' }}</td>
                <td>
                  <span class="pill" [class.danger]="user.role === 'admin'">{{ user.role }}</span>
                </td>
                <td>{{ lastSeen(user.uid) }}</td>
                <td>{{ latest(user.uid)?.percentage ?? '—' }}{{ latest(user.uid) ? '%' : '' }}</td>
                <td><span class="open-arrow">→</span></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty">No users match these filters.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="mobile-user-list">
        @for (user of filtered(); track user.uid) {
          <a class="card mobile-user-card" [routerLink]="['/admin/users', user.uid]">
            <span class="mobile-user-head">
              <span
                ><span class="status-dot" [class.online]="isOnline(user.uid)"></span
                >{{ isOnline(user.uid) ? 'Online' : 'Offline' }}</span
              >
              <span class="pill" [class.danger]="user.role === 'admin'">{{ user.role }}</span>
            </span>
            <strong>{{ user.displayName || 'Unnamed user' }}</strong>
            <span class="muted small">{{ user.email }}</span>
            <dl>
              <div>
                <dt>Context</dt>
                <dd>{{ user.board || '—' }} · {{ user.standard || '—' }}</dd>
              </div>
              <div>
                <dt>Latest</dt>
                <dd>{{ latest(user.uid)?.percentage ?? '—' }}{{ latest(user.uid) ? '%' : '' }}</dd>
              </div>
            </dl>
            <span class="mobile-user-foot"
              ><span>{{ lastSeen(user.uid) }}</span
              ><strong>Open activity →</strong></span
            >
          </a>
        } @empty {
          <div class="card empty">No users match these filters.</div>
        }
      </div>
    </section>
  </div>`,
  styles: [
    `
      .online-card {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 14px 18px;
        background: var(--accent-soft);
        border-radius: var(--radius);
      }
      .online-card strong {
        color: var(--accent);
        font-size: 28px;
      }
      .online-card span {
        color: var(--muted);
        font-size: 12px;
      }
      .filters {
        margin-bottom: 18px;
      }
      .user-row-link {
        cursor: pointer;
        transition: background 0.18s ease;
      }
      .user-row-link:hover {
        background: var(--accent-soft);
      }
      .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 8px;
        background: var(--muted);
        border-radius: 50%;
      }
      .status-dot.online {
        background: var(--success);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 15%, transparent);
      }
      .open-arrow {
        color: var(--accent);
        font-size: 18px;
      }
      .mobile-user-list {
        display: none;
      }
      @media (max-width: 680px) {
        .users-table {
          display: none;
        }
        .mobile-user-list {
          display: grid;
          gap: 10px;
        }
        .mobile-user-card {
          display: grid;
          gap: 7px;
        }
        .mobile-user-head,
        .mobile-user-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 11px;
        }
        .mobile-user-head > span:first-child {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .mobile-user-card dl {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin: 8px 0;
        }
        .mobile-user-card dl div {
          padding: 10px;
          background: var(--surface-2);
          border-radius: 9px;
        }
        .mobile-user-card dt {
          color: var(--muted);
          font-size: 9px;
          text-transform: uppercase;
        }
        .mobile-user-card dd {
          margin: 4px 0 0;
          font-weight: 750;
        }
        .mobile-user-foot {
          padding-top: 8px;
          color: var(--muted);
          border-top: 1px solid var(--line);
        }
        .mobile-user-foot strong {
          color: var(--accent-strong);
        }
      }
    `,
  ],
})
export class UsersAdminPage implements OnInit {
  readonly users = signal<GtopUser[]>([]);
  search = '';
  roleFilter = '';
  presenceFilter = '';
  boardFilter = '';
  standardFilter = '';
  recentFilter = '';
  performanceFilter = '';
  readonly recentResults = signal<QuizResult[]>([]);
  readonly onlineCount = computed(() => this.presence.records().filter((p) => p.isOnline).length);
  readonly boards = computed(() =>
    [
      ...new Set(
        this.users()
          .map((u) => u.board)
          .filter((v): v is string => Boolean(v)),
      ),
    ].sort(),
  );
  readonly standards = computed(() =>
    [
      ...new Set(
        this.users()
          .map((u) => u.standard)
          .filter((v): v is string => Boolean(v)),
      ),
    ].sort(),
  );
  constructor(
    public auth: AuthStore,
    private admin: AdminRepository,
    public presence: PresenceService,
  ) {}
  async ngOnInit() {
    this.presence.listenAll();
    const [users, results] = await Promise.all([this.admin.users(), this.admin.recentResults()]);
    this.users.set(users);
    this.recentResults.set(results);
  }
  filtered() {
    const s = this.search.toLowerCase();
    return this.users()
      .filter(
        (u) =>
          (!s || `${u.displayName} ${u.email}`.toLowerCase().includes(s)) &&
          (!this.roleFilter || u.role === this.roleFilter) &&
          (!this.boardFilter || u.board === this.boardFilter) &&
          (!this.standardFilter || u.standard === this.standardFilter) &&
          (!this.presenceFilter || (this.presenceFilter === 'online') === this.isOnline(u.uid)),
      )
      .filter((u) => {
        const latest = this.latest(u.uid);
        if (this.recentFilter) {
          const timestamp = asDate(latest?.timestamp)?.getTime() ?? 0;
          if (!timestamp || Date.now() - timestamp > Number(this.recentFilter) * 86_400_000)
            return false;
        }
        if (!this.performanceFilter) return true;
        const score = latest?.percentage;
        if (score == null) return false;
        return this.performanceFilter === 'low'
          ? score < 50
          : this.performanceFilter === 'medium'
            ? score >= 50 && score < 80
            : score >= 80;
      });
  }
  latest(uid: string) {
    return this.recentResults().find((result) => result.userId === uid);
  }
  isOnline(uid: string) {
    return Boolean(this.presence.records().find((p) => p.userId === uid)?.isOnline);
  }
  lastSeen(uid: string) {
    const value = this.presence.records().find((p) => p.userId === uid)?.lastActive;
    return value ? new Date(value).toLocaleString('en-IN') : '—';
  }
}

@Component({
  selector: 'app-admin-operations',
  imports: [RouterLink, FormsModule],
  template: `<div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">{{ kicker }}</p>
        <h1>{{ title }}</h1>
        <p class="lede">{{ copy }}</p>
      </div>
    </div>
    @if (mode === 'logs') {
      <div class="tabs">
        <button [class.active]="logTab === 'audit'" (click)="logTab = 'audit'">Audit trail</button
        ><button [class.active]="logTab === 'client'" (click)="logTab = 'client'">
          Client diagnostics ({{ diagnostics.records().length }})
        </button>
      </div>
      @if (logTab === 'audit') {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              @for (item of records(); track item.id) {
                <tr>
                  <td>{{ date(item['timestamp'] || item['createdAt']) }}</td>
                  <td>{{ item['action'] || item['type'] || 'Activity' }}</td>
                  <td>{{ item['editedBy'] || item['userId'] || 'System' }}</td>
                  <td>{{ item['details'] || item['description'] || '—' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="empty">No activity records are available.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="section-head">
          <select [(ngModel)]="diagnosticFilter">
            <option value="">All levels</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Information</option></select
          ><button class="btn btn-danger" (click)="diagnostics.clear()">Clear diagnostics</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Level</th>
                <th>Route</th>
                <th>Message</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredDiagnostics(); track item.id) {
                <tr>
                  <td>{{ date(item.createdAt) }}</td>
                  <td>
                    <span
                      class="pill"
                      [class.danger]="item.level === 'error'"
                      [class.warning]="item.level === 'warning'"
                      >{{ item.level }}</span
                    >
                  </td>
                  <td>{{ item.route }}</td>
                  <td>
                    <strong>{{ item.message }}</strong
                    ><br /><span class="muted small">{{ item.detail }}</span>
                  </td>
                  <td>
                    <button class="btn btn-secondary" (click)="diagnostics.copy(item)">Copy</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="empty">No client diagnostics captured in this browser.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
    @if (mode === 'reports') {
      <div class="grid grid-3">
        <article class="card stat">
          <span class="muted small">Recent attempts</span>
          <p class="stat-value">{{ results().length }}</p>
        </article>
        <article class="card stat">
          <span class="muted small">Questions answered</span>
          <p class="stat-value">{{ totalQuestions() }}</p>
        </article>
        <article class="card stat">
          <span class="muted small">Average accuracy</span>
          <p class="stat-value">{{ average() }}%</p>
        </article>
      </div>
      <section class="section">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Scope</th>
                <th>Mode</th>
                <th>Accuracy</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of results(); track r.id) {
                <tr>
                  <td>{{ r.userName }}</td>
                  <td>{{ r.subject }} / {{ r.chapter }}</td>
                  <td>{{ r.quizType }}</td>
                  <td>{{ r.percentage }}%</td>
                  <td>
                    <a class="btn btn-secondary" [routerLink]="['/admin/users', r.userId]"
                      >User activity</a
                    >
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
    @if (mode === 'live') {
      <div class="grid grid-3">
        @for (s of sessions(); track s.id) {
          <article class="card">
            <span class="pill" [class.success]="s.status === 'active'">{{ s.status }}</span>
            <h3 style="margin-top:18px">{{ s.scope?.['subject'] || 'Live quiz' }}</h3>
            <p class="muted">Code {{ s.joinCode }} · {{ s.questionIds.length }} questions</p>
            <a class="btn btn-secondary" [routerLink]="['/live/host', s.id]">Open control</a>
          </article>
        } @empty {
          <div class="card empty">No open live sessions.</div>
        }
      </div>
    }
  </div>`,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 16px;
      }
      .tabs button {
        padding: 10px 14px;
        color: var(--muted);
        background: var(--surface-2);
        border: 0;
        border-radius: 9px;
        font-weight: 750;
      }
      .tabs button.active {
        color: var(--ink);
        background: var(--surface);
        box-shadow: var(--shadow-sm);
      }
    `,
  ],
})
export class AdminOperationsPage implements OnInit {
  mode: 'logs' | 'reports' | 'live';
  title = '';
  kicker = '';
  copy = '';
  logTab: 'audit' | 'client' = 'audit';
  diagnosticFilter = '';
  readonly records = signal<FirestoreRecord[]>([]);
  readonly results = signal<QuizResult[]>([]);
  readonly sessions = signal<LiveSession[]>([]);
  readonly totalQuestions = computed(() =>
    this.results().reduce((s, r) => s + r.totalQuestions, 0),
  );
  readonly average = computed(() =>
    this.totalQuestions()
      ? Math.round(
          (this.results().reduce((s, r) => s + r.correctAnswers, 0) / this.totalQuestions()) * 100,
        )
      : 0,
  );
  constructor(
    private admin: AdminRepository,
    private data: GenericFirestoreRepository,
    private live: LiveRepository,
    public diagnostics: DiagnosticsService,
  ) {
    this.mode = location.pathname.includes('logs')
      ? 'logs'
      : location.pathname.includes('live')
        ? 'live'
        : 'reports';
    const values = {
      logs: [
        'System health',
        'Diagnostics',
        'Review durable audit events and browser-level errors.',
      ],
      reports: [
        'Learning evidence',
        'Practice reports',
        'Open any learner from recent practice outcomes.',
      ],
      live: ['Live operations', 'Live control', 'Inspect rooms and open host control.'],
    }[this.mode];
    [this.kicker, this.title, this.copy] = values;
  }
  async ngOnInit() {
    if (this.mode === 'logs') this.records.set(await this.admin.logs());
    if (this.mode === 'reports')
      this.results.set(await this.data.query<QuizResult & { id: string }>('QuizResults', [], 300));
    if (this.mode === 'live') this.live.observeSessions((v) => this.sessions.set(v));
  }
  filteredDiagnostics(): ClientDiagnostic[] {
    return this.diagnostics
      .records()
      .filter((r) => !this.diagnosticFilter || r.level === this.diagnosticFilter);
  }
  date(v: unknown) {
    return asDate(v)?.toLocaleString('en-IN') || '—';
  }
}
