import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { LearningRepository } from '../core/learning.repository';
import { LiveRepository } from '../core/live.repository';
import { LiveSession, Question, SyllabusItem, asDate } from '../core/models';

@Component({
  selector: 'app-live-hub',
  imports: [FormsModule, RouterLink],
  template: `<div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Live practice</p>
        <h1>Practise together, in sync.</h1>
        <p class="lede">
          Join by code or prepare a scheduled teacher-led session with a verified question preview.
        </p>
      </div>
      @if (auth.isAdmin()) {
        <button class="btn btn-primary" (click)="showCreate.set(!showCreate())">
          {{ showCreate() ? 'Close studio' : 'Create live quiz' }}
        </button>
      }
    </div>
    <div class="grid grid-2">
      <section class="card join-card">
        <span class="live-orb"></span>
        <div>
          <p class="eyebrow">Join a session</p>
          <h2>Enter the six-character code</h2>
          <div class="join-row">
            <input
              aria-label="Join code"
              maxlength="6"
              [(ngModel)]="joinCode"
              placeholder="ABC123"
            /><button
              class="btn btn-primary"
              [disabled]="joinCode.length < 6 || busy()"
              (click)="join()"
            >
              Join →
            </button>
          </div>
        </div>
      </section>
      <a class="card card-hover run-card" routerLink="/quiz-run"
        ><span class="pill warning">Peer mode</span>
        <h2>Start a quiz run</h2>
        <p class="muted">A configurable challenge with lobby, shared timing and leaderboard.</p></a
      >
    </div>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (showCreate()) {
      <section class="card studio">
        <div class="section-head">
          <div>
            <p class="eyebrow">Live quiz studio</p>
            <h2>Scope and schedule</h2>
          </div>
          <span class="pill danger">UAT · Live data</span>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Board</label
            ><select [(ngModel)]="board" (ngModelChange)="resetScope()">
              <option value="">Choose</option>
              @for (v of boards(); track v) {
                <option>{{ v }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Standard</label
            ><select [(ngModel)]="standard" (ngModelChange)="resetScope(false)">
              <option value="">Choose</option>
              @for (v of standards(); track v) {
                <option>{{ v }}</option>
              }
            </select>
          </div>
        </div>
        <div class="selection">
          <strong>Subjects</strong>
          <div class="chips">
            @for (v of subjects(); track v) {
              <button
                [class.active]="selectedSubjects.includes(v)"
                (click)="selectedSubjects = toggle(selectedSubjects, v)"
              >
                {{ selectedSubjects.includes(v) ? '✓' : '+' }} {{ v }}
              </button>
            }
          </div>
        </div>
        <div class="selection">
          <strong>Chapters</strong>
          <div class="chips">
            @for (v of chapters(); track v) {
              <button
                [class.active]="selectedChapters.includes(v)"
                (click)="selectedChapters = toggle(selectedChapters, v)"
              >
                {{ selectedChapters.includes(v) ? '✓' : '+' }} {{ v }}
              </button>
            }
          </div>
        </div>
        <div class="form-grid settings">
          <div class="field">
            <label>Question count</label
            ><select [(ngModel)]="count">
              <option [ngValue]="5">5</option>
              <option [ngValue]="10">10</option>
              <option [ngValue]="15">15</option>
              <option [ngValue]="20">20</option>
            </select>
          </div>
          <div class="field">
            <label>Seconds per question</label
            ><input type="number" min="10" max="180" [(ngModel)]="seconds" />
          </div>
          <div class="field">
            <label>Start time (optional)</label
            ><input type="datetime-local" [(ngModel)]="scheduled" />
          </div>
          <div class="field">
            <label>Join buffer after start</label
            ><select [(ngModel)]="buffer">
              <option [ngValue]="0">No late joins</option>
              <option [ngValue]="5">5 minutes</option>
              <option [ngValue]="10">10 minutes</option>
            </select>
          </div>
        </div>
        <div class="button-row">
          <button class="btn btn-secondary" [disabled]="busy()" (click)="preview()">
            Generate preview</button
          ><button
            class="btn btn-primary"
            [disabled]="!previewQuestions().length || busy()"
            (click)="create()"
          >
            Create room
          </button>
        </div>
        @if (previewQuestions().length) {
          <div class="preview">
            <div class="section-head">
              <h3>Generated question preview</h3>
              <span>{{ previewQuestions().length }} questions</span>
            </div>
            @for (q of previewQuestions(); track q.id; let i = $index) {
              <details>
                <summary>{{ i + 1 }}. {{ q.question }}</summary>
                <p class="muted">
                  {{ q.subject }} / {{ q.chapter }} · Correct: {{ letters[q.correctIndex] }}
                </p>
              </details>
            }
          </div>
        }
      </section>
    }
    <section class="section">
      <div class="section-head">
        <div>
          <p class="eyebrow">Rooms</p>
          <h2>Scheduled and active</h2>
        </div>
      </div>
      <div class="grid grid-3">
        @for (session of sessions(); track session.id) {
          <article class="card room">
            <div class="section-head">
              <span
                class="pill"
                [class.success]="session.status === 'active'"
                [class.info]="session.status === 'scheduled' || session.status === 'lobby'"
                >{{ session.status }}</span
              ><strong>{{ session.joinCode }}</strong>
            </div>
            <h3>
              {{
                session.scope?.['subjectLabel'] || session.scope?.['subject'] || 'Mixed practice'
              }}
            </h3>
            <p class="muted">
              {{ session.questionIds.length }} questions · {{ session.perQuestionSeconds }} sec
            </p>
            @if (session.scheduledStartAt) {
              <p class="schedule">◷ {{ date(session.scheduledStartAt) }}</p>
            }
            <button class="btn btn-secondary" (click)="open(session)">
              {{ session.hostId === auth.profile()?.uid ? 'Host control' : 'Join room' }}
            </button>
          </article>
        } @empty {
          <div class="card empty" style="grid-column:1/-1">No open rooms.</div>
        }
      </div>
    </section>
  </div>`,
  styles: [
    `
      .join-card {
        display: flex;
        align-items: center;
        gap: 22px;
        background: linear-gradient(135deg, var(--surface), var(--accent-soft));
      }
      .live-orb {
        width: 70px;
        height: 70px;
        flex: 0 0 auto;
        background: radial-gradient(circle at 35% 30%, var(--accent-2), var(--accent));
        border-radius: 50%;
        box-shadow: 0 0 0 12px var(--accent-soft);
        animation: pulse-ring 1.8s infinite;
      }
      .join-card > div {
        flex: 1;
      }
      .join-row {
        display: flex;
        gap: 10px;
      }
      .join-row input {
        min-width: 0;
        flex: 1;
        padding: 12px 15px;
        color: var(--ink);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 12px;
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .run-card {
        background: linear-gradient(
          135deg,
          var(--surface),
          color-mix(in srgb, var(--accent-2) 12%, var(--surface))
        );
      }
      .studio {
        margin-top: 22px;
        padding: 30px;
        border-color: var(--accent);
      }
      .selection {
        margin: 22px 0;
      }
      .selection strong {
        display: block;
        margin-bottom: 10px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .chips button {
        padding: 8px 11px;
        color: var(--ink);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 99px;
      }
      .chips button.active {
        background: var(--accent-soft);
        border-color: var(--accent);
      }
      .settings {
        margin: 24px 0;
      }
      .preview {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--line);
      }
      .preview details {
        padding: 12px 0;
        border-bottom: 1px solid var(--line);
      }
      .schedule {
        color: var(--accent);
        font-size: 12px;
        font-weight: 750;
      }
      @media (max-width: 650px) {
        .join-card {
          align-items: stretch;
          flex-direction: column;
        }
        .live-orb {
          width: 50px;
          height: 50px;
        }
      }
    `,
  ],
})
export class LiveHubPage implements OnInit, OnDestroy {
  readonly sessions = signal<LiveSession[]>([]);
  readonly syllabus = signal<SyllabusItem[]>([]);
  readonly previewQuestions = signal<Question[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly showCreate = signal(false);
  joinCode = '';
  board = '';
  standard = '';
  selectedSubjects: string[] = [];
  selectedChapters: string[] = [];
  count = 10;
  seconds = 30;
  scheduled = '';
  buffer = 5;
  readonly letters = ['A', 'B', 'C', 'D'];
  private stop?: () => void;
  boards = () => this.unique(this.syllabus().map((i) => i.board));
  standards = () =>
    this.unique(
      this.syllabus()
        .filter((i) => !this.board || i.board === this.board)
        .map((i) => i.standard),
    );
  subjects = () =>
    this.unique(
      this.syllabus()
        .filter(
          (i) =>
            (!this.board || i.board === this.board) &&
            (!this.standard || i.standard === this.standard),
        )
        .map((i) => i.subject),
    );
  chapters = () =>
    this.unique(
      this.syllabus()
        .filter(
          (i) =>
            (!this.board || i.board === this.board) &&
            (!this.standard || i.standard === this.standard) &&
            (!this.selectedSubjects.length || this.selectedSubjects.includes(i.subject)),
        )
        .map((i) => i.chapter),
    );
  constructor(
    public auth: AuthStore,
    private live: LiveRepository,
    private learning: LearningRepository,
    private router: Router,
  ) {}
  async ngOnInit() {
    this.board = this.auth.profile()?.board || '';
    this.standard = this.auth.profile()?.standard || '';
    this.syllabus.set(await this.learning.syllabus());
    this.stop = this.live.observeSessions((v) => this.sessions.set(v));
  }
  ngOnDestroy() {
    this.stop?.();
  }
  resetScope(resetStandard = true) {
    if (resetStandard) this.standard = '';
    this.selectedSubjects = [];
    this.selectedChapters = [];
    this.previewQuestions.set([]);
  }
  toggle(v: string[], x: string) {
    return v.includes(x) ? v.filter((i) => i !== x) : [...v, x];
  }
  async preview() {
    this.busy.set(true);
    this.error.set('');
    try {
      this.previewQuestions.set(
        await this.learning.questions({
          board: this.board,
          standard: this.standard,
          subjects: this.selectedSubjects,
          chapters: this.selectedChapters,
          count: this.count,
        }),
      );
      if (!this.previewQuestions().length) throw new Error('No questions match this scope.');
    } catch (e) {
      this.error.set(this.msg(e));
    } finally {
      this.busy.set(false);
    }
  }
  async create() {
    const p = this.auth.profile();
    if (!p || !this.previewQuestions().length) return;
    if (!confirm('Create this UAT live room using production data?')) return;
    this.busy.set(true);
    try {
      const start = this.scheduled ? new Date(this.scheduled) : undefined;
      const session = await this.live.create({
        hostId: p.uid,
        hostName: p.displayName,
        status: start && start.getTime() > Date.now() ? 'scheduled' : 'lobby',
        mode: 'live',
        questionIds: this.previewQuestions().map((q) => q.id),
        perQuestionSeconds: this.seconds,
        scheduledStartAt: start,
        joinBufferMinutes: this.buffer,
        scope: {
          board: this.board,
          standard: this.standard,
          subjects: this.selectedSubjects,
          chapters: this.selectedChapters,
          subjectLabel: this.selectedSubjects.join(', ') || 'Mixed practice',
        },
      });
      await this.router.navigate(['/live/host', session.id]);
    } catch (e) {
      this.error.set(this.msg(e));
    } finally {
      this.busy.set(false);
    }
  }
  async join() {
    this.busy.set(true);
    this.error.set('');
    try {
      const s = await this.live.findByCode(this.joinCode);
      if (!s || s.status === 'ended') throw new Error('No open session matches that code.');
      const p = this.auth.profile()!;
      await this.live.join(s.id, { uid: p.uid, displayName: p.displayName, photoURL: p.photoURL });
      await this.router.navigate(['/live/play', s.id]);
    } catch (e) {
      this.error.set(this.msg(e));
    } finally {
      this.busy.set(false);
    }
  }
  open(s: LiveSession) {
    this.router.navigate([
      s.hostId === this.auth.profile()?.uid ? '/live/host' : '/live/play',
      s.id,
    ]);
  }
  date(v: unknown) {
    return asDate(v)?.toLocaleString('en-IN') || '—';
  }
  private unique(v: string[]) {
    return [...new Set(v.filter(Boolean))].sort();
  }
  private msg(e: unknown) {
    return e instanceof Error ? e.message : 'Live operation failed.';
  }
}

@Component({
  selector: 'app-quiz-run',
  imports: [FormsModule],
  template: `<div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Quiz run</p>
        <h1>A fast peer challenge.</h1>
        <p class="lede">Create a configurable room or join the code shared by a friend.</p>
      </div>
    </div>
    <div class="grid grid-2">
      <section class="card">
        <span class="pill warning">Join</span>
        <h2>Enter a run code</h2>
        <div class="join">
          <input maxlength="6" [(ngModel)]="code" placeholder="RUN CODE" /><button
            class="btn btn-primary"
            (click)="join()"
            [disabled]="code.length < 6"
          >
            Join
          </button>
        </div>
      </section>
      <section class="card">
        <span class="pill info">Create</span>
        <h2>Prepare a run</h2>
        <div class="form-grid">
          <div class="field"><label>Board</label><input [(ngModel)]="board" /></div>
          <div class="field"><label>Standard</label><input [(ngModel)]="standard" /></div>
          <div class="field"><label>Subject</label><input [(ngModel)]="subject" /></div>
          <div class="field"><label>Chapter</label><input [(ngModel)]="chapter" /></div>
          <div class="field">
            <label>Questions</label
            ><select [(ngModel)]="count">
              <option [ngValue]="5">5</option>
              <option [ngValue]="10">10</option>
              <option [ngValue]="15">15</option>
              <option [ngValue]="20">20</option>
            </select>
          </div>
          <div class="field">
            <label>Seconds each</label
            ><input type="number" min="10" max="120" [(ngModel)]="seconds" />
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:18px" (click)="create()">
          Create quiz run
        </button>
      </section>
    </div>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
  </div>`,
  styles: [
    `
      .join {
        display: flex;
        gap: 10px;
      }
      .join input {
        min-width: 0;
        flex: 1;
        padding: 12px;
        color: var(--ink);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 10px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }
    `,
  ],
})
export class QuizRunPage {
  code = '';
  board = '';
  standard = '';
  subject = '';
  chapter = '';
  count = 10;
  seconds = 30;
  readonly error = signal('');
  constructor(
    private auth: AuthStore,
    private live: LiveRepository,
    private learning: LearningRepository,
    private router: Router,
  ) {
    this.board = auth.profile()?.board || '';
    this.standard = auth.profile()?.standard || '';
  }
  async join() {
    try {
      const s = await this.live.findByCode(this.code);
      if (!s || s.mode !== 'run') throw new Error('Quiz run not found.');
      const p = this.auth.profile()!;
      await this.live.join(s.id, { uid: p.uid, displayName: p.displayName, photoURL: p.photoURL });
      await this.router.navigate(['/quiz-run/lobby', s.id]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Unable to join.');
    }
  }
  async create() {
    try {
      const q = await this.learning.questions({
        board: this.board,
        standard: this.standard,
        subject: this.subject,
        chapter: this.chapter,
        count: this.count,
      });
      if (!q.length) throw new Error('No questions found.');
      const p = this.auth.profile()!;
      const s = await this.live.create({
        hostId: p.uid,
        hostName: p.displayName,
        mode: 'run',
        questionIds: q.map((v) => v.id),
        perQuestionSeconds: this.seconds,
        scope: {
          board: this.board,
          standard: this.standard,
          subject: this.subject,
          chapter: this.chapter,
        },
      });
      await this.router.navigate(['/quiz-run/lobby', s.id]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Unable to create.');
    }
  }
}

@Component({
  selector: 'app-live-session',
  imports: [RouterLink],
  template: `<div class="page session-page">
    @if (!session()) {
      <div class="card empty">Loading session…</div>
    } @else {
      <div class="page-head">
        <div>
          <p class="eyebrow">{{ modeLabel }}</p>
          <h1>
            {{
              session()?.scope?.['subjectLabel'] ||
                session()?.scope?.['subject'] ||
                'Live practice room'
            }}
          </h1>
          <p class="lede">
            Room <strong>{{ session()?.joinCode }}</strong> ·
            {{ session()?.questionIds?.length }} questions
          </p>
        </div>
        <div class="room-status">
          <span class="pill" [class.success]="session()?.status === 'active'">{{
            session()?.status
          }}</span>
          @if (session()?.status === 'active') {
            <strong class="countdown" [class.urgent]="remaining() <= 5">{{ remaining() }}s</strong>
          }
        </div>
      </div>
      @if (isHost()) {
        <section class="card control">
          <div>
            <h2>Host control</h2>
            <p class="muted">
              {{ participants().length }} participants · {{ answers().length }} answered this
              question
            </p>
          </div>
          <div class="button-row">
            @if (session()?.status === 'scheduled' || session()?.status === 'lobby') {
              <button class="btn btn-primary" (click)="start()">Start now</button>
            }
            @if (session()?.status === 'active') {
              <button
                class="btn btn-secondary"
                [disabled]="index() === 0"
                (click)="previousQuestion()"
              >
                Previous</button
              ><button class="btn btn-primary" (click)="nextQuestion()">
                {{ index() >= questions().length - 1 ? 'Finish' : 'Next' }}
              </button>
            }
            <button
              class="btn btn-danger"
              (click)="end()"
              [disabled]="session()?.status === 'ended'"
            >
              End
            </button>
          </div>
        </section>
      }
      @if (session()?.status === 'scheduled') {
        <section class="card lobby">
          <span class="pulse"></span>
          <h2>Scheduled to begin in {{ scheduledCountdown() }}</h2>
          <p class="muted">Participants can join now. The host may start early.</p>
          <div class="participant-cloud">
            @for (p of participants(); track p['id']) {
              <span>{{ p['displayName'] }}</span>
            }
          </div>
        </section>
      } @else if (session()?.status === 'lobby') {
        <section class="card lobby">
          <span class="pulse"></span>
          <h2>{{ isHost() ? 'Waiting for participants' : 'Waiting for the host' }}</h2>
          <div class="participant-cloud">
            @for (p of participants(); track p['id']) {
              <span>{{ p['displayName'] }}</span>
            }
          </div>
        </section>
      } @else if (session()?.status === 'ended' || summaryMode) {
        <section class="card leaderboard">
          <p class="eyebrow">Final standings</p>
          <h2>Leaderboard</h2>
          @for (row of leaderboard(); track row.uid; let rank = $index) {
            <div class="leader-row" [class.me]="row.uid === auth.profile()?.uid">
              <b>{{ rank + 1 }}</b
              ><span
                ><strong>{{ row.name }}</strong
                ><small
                  >{{ row.correct }} correct · {{ durationLabel(row.responseMs) }}</small
                ></span
              ><strong>{{ row.points }}</strong>
            </div>
          } @empty {
            <div class="empty">No submitted answers were recorded.</div>
          }
          <div class="button-row">
            <a class="btn btn-primary" routerLink="/reports">Review reports</a
            ><a class="btn btn-secondary" routerLink="/live">Back to live</a>
          </div>
        </section>
      } @else {
        <section class="card active-room">
          <div class="question-meta">
            <div>
              <p class="eyebrow">Question {{ index() + 1 }} of {{ questions().length }}</p>
              <span class="muted small">{{ participants().length }} participants</span>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="progress()"></div>
          </div>
          @if (current()) {
            <h2>{{ current().question }}</h2>
            @for (option of current().options || []; track $index) {
              <button
                class="option"
                [class.selected]="selected() === $index"
                [disabled]="isHost() || submitted()"
                (click)="select($index)"
              >
                <span class="option-key">{{ letters[$index] }}</span
                >{{ option }}
                @if (isHost()) {
                  <span class="response-count">{{ optionCount($index) }}</span>
                }
              </button>
            }
            @if (!isHost()) {
              <button
                class="btn btn-primary submit"
                [disabled]="selected() === null || submitted()"
                (click)="submitAnswer()"
              >
                {{ submitted() ? 'Answer submitted' : 'Submit answer' }}
              </button>
            } @else {
              <div class="response-bar"><span [style.width.%]="responsePercent()"></span></div>
              <p class="muted">
                {{ answers().length }} of {{ participants().length }} responses received
              </p>
            }
          }
        </section>
      }
    }
  </div>`,
  styles: [
    `
      .session-page {
        max-width: 920px;
      }
      .control,
      .question-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
      }
      .room-status {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .countdown {
        display: grid;
        width: 56px;
        height: 56px;
        place-items: center;
        color: var(--accent);
        background: var(--accent-soft);
        border-radius: 50%;
        font-size: 17px;
      }
      .countdown.urgent {
        color: var(--danger);
        animation: pulse-ring 1s infinite;
      }
      .lobby {
        text-align: center;
        padding: 60px 20px;
      }
      .pulse {
        display: inline-block;
        width: 18px;
        height: 18px;
        margin-bottom: 20px;
        background: var(--accent);
        border-radius: 50%;
        box-shadow: 0 0 0 12px var(--accent-soft);
        animation: pulse-ring 1.8s infinite;
      }
      .participant-cloud {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin-top: 20px;
      }
      .participant-cloud span {
        padding: 8px 12px;
        background: var(--surface-2);
        border-radius: 99px;
        font-size: 12px;
      }
      .active-room {
        padding: 40px;
      }
      .active-room .progress-track {
        margin: 25px 0;
      }
      .active-room h2 {
        margin: 28px 0;
        font-size: clamp(23px, 3vw, 32px);
        line-height: 1.4;
      }
      .active-room .option {
        position: relative;
      }
      .response-count {
        margin-left: auto;
        color: var(--accent);
        font-weight: 900;
      }
      .submit {
        width: 100%;
        margin-top: 18px;
      }
      .response-bar {
        height: 8px;
        margin-top: 18px;
        background: var(--surface-2);
        border-radius: 99px;
      }
      .response-bar span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, var(--accent), var(--accent-2));
        border-radius: inherit;
        transition: width 0.3s;
      }
      .leaderboard {
        max-width: 680px;
        margin: auto;
      }
      .leader-row {
        display: grid;
        grid-template-columns: 36px 1fr auto;
        align-items: center;
        gap: 13px;
        padding: 14px;
        border-bottom: 1px solid var(--line);
        transition: transform 0.3s;
      }
      .leader-row.me {
        background: var(--accent-soft);
        border-radius: 10px;
      }
      .leader-row > b {
        display: grid;
        width: 30px;
        height: 30px;
        place-items: center;
        background: var(--surface-2);
        border-radius: 50%;
      }
      .leader-row span > * {
        display: block;
      }
      .leader-row small {
        margin-top: 3px;
        color: var(--muted);
      }
      @media (max-width: 650px) {
        .control,
        .question-meta {
          align-items: stretch;
          flex-direction: column;
        }
        .active-room {
          padding: 20px;
        }
      }
    `,
  ],
})
export class LiveSessionPage implements OnDestroy {
  readonly session = signal<LiveSession | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly participants = signal<Array<Record<string, unknown>>>([]);
  readonly answers = signal<Array<Record<string, unknown>>>([]);
  readonly answerGroups = signal<Array<{ index: number; items: Array<Record<string, unknown>> }>>(
    [],
  );
  readonly selected = signal<number | null>(null);
  readonly submitted = signal(false);
  readonly remaining = signal(0);
  readonly now = signal(Date.now());
  readonly letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  readonly index = computed(() =>
    Math.min(
      this.session()?.currentQuestionIndex ?? this.session()?.overrideIndex ?? 0,
      Math.max(this.questions().length - 1, 0),
    ),
  );
  readonly current = computed(() => this.questions()[this.index()] ?? null);
  readonly progress = computed(
    () => ((this.index() + 1) / Math.max(this.questions().length, 1)) * 100,
  );
  readonly summaryMode = location.pathname.includes('/summary/');
  readonly modeLabel = location.pathname.includes('quiz-run')
    ? 'Quiz run'
    : location.pathname.includes('host')
      ? 'Live host'
      : this.summaryMode
        ? 'Live summary'
        : 'Live participant';
  private stops: Array<() => void> = [];
  private answerStop?: () => void;
  private loaded = '';
  private transitionPending = false;
  private startedAt = Date.now();
  private tick = window.setInterval(() => this.onTick(), 1000);
  private localAnswers = new Map<number, number>();
  constructor(
    private route: ActivatedRoute,
    private live: LiveRepository,
    private learning: LearningRepository,
    public auth: AuthStore,
  ) {
    const id = route.snapshot.paramMap.get('sessionId')!;
    this.stops.push(live.observeSession(id, (value) => void this.onSession(value)));
  }
  ngOnDestroy() {
    this.stops.forEach((s) => s());
    this.answerStop?.();
    clearInterval(this.tick);
  }
  isHost() {
    return (
      this.session()?.hostId === this.auth.profile()?.uid || location.pathname.includes('/host/')
    );
  }
  async start() {
    const s = this.session();
    if (s && !this.transitionPending) {
      this.transitionPending = true;
      await this.live.start(s.id, 0);
    }
  }
  async end() {
    const s = this.session();
    if (s && confirm('End this room and calculate the leaderboard?'))
      await this.live.updateSession(s.id, { status: 'ended' });
  }
  async nextQuestion() {
    const s = this.session();
    if (!s || this.transitionPending) return;
    this.transitionPending = true;
    if (this.index() >= this.questions().length - 1)
      await this.live.updateSession(s.id, { status: 'ended' });
    else await this.live.move(s.id, this.index() + 1);
  }
  async previousQuestion() {
    const s = this.session();
    if (s && this.index() > 0) await this.live.move(s.id, this.index() - 1);
  }
  select(i: number) {
    this.selected.set(i);
  }
  async submitAnswer() {
    const s = this.session(),
      p = this.auth.profile(),
      value = this.selected();
    if (!s || !p || value === null) return;
    await this.live.submitAnswer(
      s.id,
      this.index(),
      value,
      { uid: p.uid, displayName: p.displayName },
      Date.now() - this.startedAt,
    );
    this.localAnswers.set(this.index(), value);
    this.submitted.set(true);
  }
  optionCount(i: number) {
    return this.answers().filter((a) => Number(a['selectedIndex']) === i).length;
  }
  responsePercent() {
    return this.participants().length
      ? Math.min((this.answers().length / this.participants().length) * 100, 100)
      : 0;
  }
  scheduledCountdown() {
    const target = asDate(this.session()?.scheduledStartAt)?.getTime() ?? this.now();
    const seconds = Math.max(Math.ceil((target - this.now()) / 1000), 0);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  durationLabel(ms: number) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  leaderboard() {
    const map = new Map<
      string,
      { uid: string; name: string; correct: number; responseMs: number; points: number }
    >();
    for (const group of this.answerGroups()) {
      const q = this.questions()[group.index];
      for (const a of group.items) {
        const uid = String(a['uid'] ?? a['id']),
          name = String(a['displayName'] ?? 'Learner'),
          correct = Number(a['selectedIndex']) === q?.correctIndex,
          responseMs = Number(a['responseMs'] ?? 0),
          row = map.get(uid) ?? { uid, name, correct: 0, responseMs: 0, points: 0 };
        row.correct += correct ? 1 : 0;
        row.responseMs += responseMs;
        row.points += correct ? Math.max(1000 - Math.round(responseMs / 20), 100) : 0;
        map.set(uid, row);
      }
    }
    return [...map.values()].sort(
      (a, b) => b.points - a.points || a.responseMs - b.responseMs || a.name.localeCompare(b.name),
    );
  }
  private async onSession(value: LiveSession | null) {
    const previous = this.session();
    this.session.set(value);
    this.transitionPending = false;
    if (value && this.loaded !== value.id) {
      this.loaded = value.id;
      this.questions.set(await this.learning.questionsByIds(value.questionIds));
      this.stops.push(this.live.observeParticipants(value.id, (p) => this.participants.set(p)));
    }
    if (value && previous?.currentQuestionIndex !== value.currentQuestionIndex)
      this.watchAnswers(value);
    if (value?.status === 'ended' && previous?.status !== 'ended') {
      this.answerGroups.set(await this.live.allAnswers(value.id, value.questionIds.length));
      await this.persistResult(value);
    }
  }
  private watchAnswers(s: LiveSession) {
    this.answerStop?.();
    this.selected.set(null);
    this.submitted.set(false);
    this.startedAt = Date.now();
    this.answerStop = this.live.observeAnswers(s.id, this.index(), (items) => {
      this.answers.set(items);
      const own = items.find((a) => (a['uid'] ?? a['id']) === this.auth.profile()?.uid);
      if (own) {
        this.selected.set(Number(own['selectedIndex']));
        this.submitted.set(true);
        this.localAnswers.set(this.index(), Number(own['selectedIndex']));
      }
    });
  }
  private onTick() {
    this.now.set(Date.now());
    const s = this.session();
    if (!s) return;
    const anchor = asDate(s.overrideAt ?? s.anchorAt)?.getTime();
    if (s.status === 'active' && anchor) {
      const elapsed = Math.floor((Date.now() - anchor) / 1000);
      this.remaining.set(Math.max(s.perQuestionSeconds - elapsed, 0));
      if (this.isHost() && this.remaining() === 0 && this.index() < this.questions().length - 1)
        void this.nextQuestion();
      if (
        this.isHost() &&
        !this.transitionPending &&
        this.remaining() === 0 &&
        this.index() === this.questions().length - 1
      ) {
        this.transitionPending = true;
        void this.live.updateSession(s.id, { status: 'ended' });
      }
    }
    const scheduled = asDate(s.scheduledStartAt)?.getTime();
    if (this.isHost() && s.status === 'scheduled' && scheduled && scheduled <= Date.now())
      void this.start();
  }
  private async persistResult(s: LiveSession) {
    const p = this.auth.profile();
    if (this.isHost() || !p || sessionStorage.getItem(`gtop-live-saved-${s.id}`)) return;
    const answers = this.questions().map((q, i) => ({
      questionId: q.id,
      selectedIndex: this.localAnswers.get(i) ?? -1,
      correctIndex: q.correctIndex,
      isCorrect: this.localAnswers.get(i) === q.correctIndex,
    }));
    if (!answers.some((a) => a.selectedIndex >= 0)) return;
    const first = this.questions()[0];
    const resultId = await this.learning.saveResult({
      userId: p.uid,
      userName: p.displayName,
      board: first?.board || p.board || '',
      standard: first?.standard || p.standard || '',
      subject: first?.subject || 'Mixed',
      chapter: first?.chapter || 'Mixed',
      quizType: s.mode === 'run' ? 'run' : 'live',
      answers,
      sessionId: s.id,
    });
    await this.live.linkResult(s.id, p.uid, resultId);
    sessionStorage.setItem(`gtop-live-saved-${s.id}`, '1');
  }
}
