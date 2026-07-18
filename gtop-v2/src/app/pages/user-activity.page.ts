import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminRepository } from '../core/admin.repository';
import { AuthStore } from '../core/auth.store';
import { LearningRepository } from '../core/learning.repository';
import { GtopUser, LiveSession, PresenceRecord, QuizResult, asDate } from '../core/models';
import { PresenceService } from '../core/presence.service';
import { QuizSessionStore } from '../core/quiz-session.store';

@Component({
  selector: 'app-user-activity',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page user-activity">
      <a class="back-link" routerLink="/admin/users">← All users</a>
      @if (loading()) {
        <div class="profile-skeleton grid grid-3">
          <div class="card skeleton"></div>
          <div class="card skeleton"></div>
          <div class="card skeleton"></div>
        </div>
      } @else if (!user()) {
        <div class="card empty">
          <h2>User not found</h2>
          <p>The profile is unavailable.</p>
        </div>
      } @else {
        <section class="profile-hero card">
          <div class="avatar large">
            @if (user()?.photoURL) {
              <img [src]="user()?.photoURL" alt="" />
            } @else {
              <span>{{ initial() }}</span>
            }
          </div>
          <div class="profile-copy">
            <div class="profile-title">
              <div>
                <p class="eyebrow">Learner activity</p>
                <h1>{{ user()?.displayName || 'Unnamed user' }}</h1>
                <p class="muted">{{ user()?.email }}</p>
              </div>
              <span class="presence" [class.online]="presence()?.isOnline"
                ><i></i>{{ presence()?.isOnline ? 'Online now' : 'Last seen ' + lastSeen() }}</span
              >
            </div>
            <div class="chips">
              <span>{{ user()?.board || 'Board not set' }}</span
              ><span>Standard {{ user()?.standard || 'not set' }}</span
              ><span>{{ user()?.role }}</span>
            </div>
          </div>
        </section>
        <div class="grid grid-4 metric-grid">
          <article class="card stat">
            <small>Attempts</small><strong>{{ attempts().length }}</strong
            ><span>Recorded quizzes</span>
          </article>
          <article class="card stat">
            <small>Questions</small><strong>{{ totalQuestions() }}</strong
            ><span>Answered</span>
          </article>
          <article class="card stat">
            <small>Average</small><strong>{{ average() }}%</strong><span>Overall accuracy</span>
          </article>
          <article class="card stat">
            <small>Latest</small><strong>{{ latestScore() }}%</strong
            ><span>{{ latestDate() }}</span>
          </article>
        </div>
        <div class="tabs" role="tablist">
          <button [class.active]="tab() === 'activity'" (click)="tab.set('activity')">
            Activity</button
          ><button [class.active]="tab() === 'profile'" (click)="tab.set('profile')">
            Profile & access</button
          ><button [class.active]="tab() === 'live'" (click)="tab.set('live')">
            Live sessions
          </button>
        </div>
        @if (tab() === 'activity') {
          <section class="grid grid-2">
            <article class="card">
              <p class="eyebrow">Accuracy trend</p>
              <h2>Recent performance</h2>
              <div class="activity-chart">
                @for (item of recentChart(); track item.id) {
                  <div>
                    <span [style.height.%]="item.percentage"></span
                    ><small>{{ item.percentage }}%</small>
                  </div>
                }
              </div>
            </article>
            <article class="card">
              <p class="eyebrow">Practice mix</p>
              <h2>By quiz type</h2>
              @for (item of quizMix(); track item.label) {
                <div class="mix-row">
                  <span>{{ item.label }}</span>
                  <div class="progress-track">
                    <div class="progress-fill" [style.width.%]="item.value"></div>
                  </div>
                  <strong>{{ item.count }}</strong>
                </div>
              }
            </article>
          </section>
          <section class="section">
            <div class="section-head">
              <h2>Session history</h2>
              <select [(ngModel)]="typeFilter">
                <option value="">All types</option>
                <option value="quick">Quick</option>
                <option value="custom">Custom</option>
                <option value="live">Live</option>
                <option value="run">Quiz run</option>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (result of filteredAttempts(); track result.id) {
                    <tr>
                      <td>{{ date(result.timestamp) }}</td>
                      <td>
                        <strong>{{ result.subject || 'Mixed' }}</strong
                        ><br /><span class="muted small">{{
                          result.chapter || 'Multiple chapters'
                        }}</span>
                      </td>
                      <td>
                        <span class="pill info">{{ result.quizType }}</span>
                      </td>
                      <td>{{ result.duration || '—' }}</td>
                      <td>
                        <strong>{{ result.correctAnswers }}/{{ result.totalQuestions }}</strong
                        ><br /><span class="muted small">{{ result.percentage }}%</span>
                      </td>
                      <td>
                        <div class="button-row">
                          <button class="btn btn-secondary" (click)="review(result)">Review</button
                          ><button class="btn btn-quiet" (click)="practiceFrom(result)">
                            Create practice set
                          </button>
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="empty">No attempts match this filter.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
        @if (tab() === 'profile') {
          <section class="grid grid-2">
            <article class="card">
              <p class="eyebrow">Profile</p>
              <h2>Learning context</h2>
              <dl>
                <div>
                  <dt>Board</dt>
                  <dd>{{ user()?.board || 'Not set' }}</dd>
                </div>
                <div>
                  <dt>Standard</dt>
                  <dd>{{ user()?.standard || 'Not set' }}</dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{{ date(user()?.createdOn) }}</dd>
                </div>
                <div>
                  <dt>Last login</dt>
                  <dd>{{ date(user()?.lastLogin) }}</dd>
                </div>
              </dl>
            </article>
            <article class="card">
              <p class="eyebrow">Access controls</p>
              <h2>Administrator actions</h2>
              <div class="field">
                <label>Role</label
                ><select
                  [ngModel]="user()?.role"
                  (ngModelChange)="changeRole($event)"
                  [disabled]="user()?.uid === auth.profile()?.uid"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div class="danger-zone">
                <p>Use reset controls only to troubleshoot stale access or presence.</p>
                <div class="button-row">
                  <button class="btn btn-secondary" (click)="markOffline()">Mark offline</button
                  ><button class="btn btn-danger" (click)="resetLogin()">Reset last login</button>
                </div>
              </div>
              @if (actionMessage()) {
                <p class="success-box">{{ actionMessage() }}</p>
              }
            </article>
          </section>
        }
        @if (tab() === 'live') {
          <section class="grid grid-3">
            @for (session of liveSessions(); track session.id) {
              <article class="card">
                <span class="pill" [class.success]="session.status === 'active'">{{
                  session.status
                }}</span>
                <h3>{{ session.scope?.['subject'] || 'Live practice' }}</h3>
                <p class="muted">
                  {{ session.questionIds.length }} questions · Code {{ session.joinCode }}
                </p>
                <a class="btn btn-secondary" [routerLink]="['/live/summary', session.id]"
                  >Open session</a
                >
              </article>
            } @empty {
              <div class="card empty" style="grid-column:1/-1">No live participation found.</div>
            }
          </section>
        }
      }
    </div>
  `,
  styles: [
    `
      .back-link {
        display: inline-flex;
        margin-bottom: 18px;
        color: var(--accent);
        font-weight: 750;
      }
      .profile-skeleton > div {
        height: 170px;
      }
      .profile-hero {
        display: flex;
        gap: 22px;
        padding: 28px;
        background: linear-gradient(135deg, var(--surface), var(--accent-soft));
      }
      .avatar.large {
        width: 78px;
        height: 78px;
        font-size: 26px;
      }
      .profile-copy {
        min-width: 0;
        flex: 1;
      }
      .profile-title {
        display: flex;
        justify-content: space-between;
        gap: 20px;
      }
      .presence {
        display: flex;
        align-items: center;
        gap: 7px;
        align-self: flex-start;
        color: var(--muted);
        font-size: 12px;
        font-weight: 750;
      }
      .presence i {
        width: 9px;
        height: 9px;
        background: var(--muted);
        border-radius: 50%;
      }
      .presence.online {
        color: var(--success);
      }
      .presence.online i {
        background: var(--success);
        animation: pulse-ring 1.8s infinite;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 15px;
      }
      .chips span {
        padding: 6px 10px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 99px;
        font-size: 11px;
        font-weight: 700;
      }
      .metric-grid {
        margin-top: 18px;
      }
      .metric-grid .stat {
        display: grid;
        gap: 7px;
      }
      .metric-grid strong {
        font-size: 30px;
      }
      .metric-grid span,
      .metric-grid small {
        color: var(--muted);
      }
      .tabs {
        display: flex;
        gap: 5px;
        margin: 28px 0 16px;
        padding: 5px;
        background: var(--surface-2);
        border-radius: 13px;
      }
      .tabs button {
        padding: 10px 16px;
        color: var(--muted);
        background: transparent;
        border: 0;
        border-radius: 9px;
        font-weight: 750;
      }
      .tabs button.active {
        color: var(--ink);
        background: var(--surface);
        box-shadow: var(--shadow-sm);
      }
      .activity-chart {
        display: flex;
        height: 220px;
        align-items: end;
        gap: 10px;
        border-bottom: 1px solid var(--line);
      }
      .activity-chart > div {
        display: flex;
        height: 100%;
        flex: 1;
        align-items: center;
        justify-content: flex-end;
        flex-direction: column;
        gap: 8px;
      }
      .activity-chart span {
        width: 100%;
        min-height: 3px;
        background: linear-gradient(var(--accent-2), var(--accent));
        border-radius: 7px 7px 0 0;
        animation: chart-grow 0.7s var(--ease-out) both;
      }
      .activity-chart small {
        font-size: 9px;
      }
      .mix-row {
        display: grid;
        grid-template-columns: 90px 1fr 28px;
        align-items: center;
        gap: 12px;
        margin: 18px 0;
        text-transform: capitalize;
      }
      dl div {
        display: flex;
        justify-content: space-between;
        padding: 14px 0;
        border-bottom: 1px solid var(--line);
      }
      dt {
        color: var(--muted);
      }
      dd {
        margin: 0;
        font-weight: 750;
      }
      .danger-zone {
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
      }
      @media (max-width: 650px) {
        .profile-hero,
        .profile-title {
          flex-direction: column;
        }
        .tabs {
          overflow: auto;
        }
        .tabs button {
          white-space: nowrap;
        }
      }
    `,
  ],
})
export class UserActivityPage implements OnInit {
  readonly user = signal<GtopUser | null>(null);
  readonly presence = signal<PresenceRecord | null>(null);
  readonly attempts = signal<QuizResult[]>([]);
  readonly liveSessions = signal<LiveSession[]>([]);
  readonly loading = signal(true);
  readonly tab = signal<'activity' | 'profile' | 'live'>('activity');
  readonly actionMessage = signal('');
  typeFilter = '';
  readonly totalQuestions = computed(() =>
    this.attempts().reduce((s, r) => s + Number(r.totalQuestions || 0), 0),
  );
  readonly average = computed(() =>
    this.totalQuestions()
      ? Math.round(
          (this.attempts().reduce((s, r) => s + Number(r.correctAnswers || 0), 0) /
            this.totalQuestions()) *
            100,
        )
      : 0,
  );
  readonly latestScore = computed(() => this.attempts()[0]?.percentage ?? 0);
  private readonly uid: string;
  constructor(
    route: ActivatedRoute,
    private admin: AdminRepository,
    private presenceService: PresenceService,
    private learning: LearningRepository,
    private sessions: QuizSessionStore,
    private router: Router,
    public auth: AuthStore,
  ) {
    this.uid = route.snapshot.paramMap.get('uid')!;
  }
  async ngOnInit() {
    const [user, presence, attempts, live] = await Promise.all([
      this.admin.user(this.uid),
      this.presenceService.getOne(this.uid),
      this.admin.resultsForUser(this.uid),
      this.admin.liveSessionsForUser(this.uid),
    ]);
    this.user.set(user);
    this.presence.set(presence);
    this.attempts.set(attempts);
    this.liveSessions.set(live);
    this.loading.set(false);
  }
  initial() {
    return (this.user()?.displayName || 'U')[0].toUpperCase();
  }
  date(value: unknown) {
    return (
      asDate(value)?.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) || '—'
    );
  }
  lastSeen() {
    return this.presence()?.lastActive
      ? new Date(this.presence()!.lastActive!).toLocaleString('en-IN')
      : 'unknown';
  }
  latestDate() {
    return this.attempts()[0] ? this.date(this.attempts()[0].timestamp) : 'No attempts';
  }
  recentChart() {
    return this.attempts().slice(0, 12).reverse();
  }
  filteredAttempts() {
    return this.attempts().filter((r) => !this.typeFilter || r.quizType === this.typeFilter);
  }
  quizMix() {
    const values = ['quick', 'custom', 'live', 'run'].map((label) => ({
      label,
      count: this.attempts().filter((r) => r.quizType === label).length,
    }));
    const max = Math.max(...values.map((v) => v.count), 1);
    return values.map((v) => ({ ...v, value: (v.count / max) * 100 }));
  }
  async review(result: QuizResult) {
    const questions = await this.learning.questionsByIds(result.questions.map((a) => a.questionId));
    const byId = new Map(result.questions.map((a) => [a.questionId, a]));
    questions.forEach((q) => (q.selectedIndex = byId.get(q.id)?.selectedIndex ?? null));
    sessionStorage.setItem(
      'gtop-v2-summary',
      JSON.stringify({
        questions,
        filters: { quizType: result.quizType },
        startedAt: Date.now(),
        launchContext: {
          kind: 'historical',
          sourceResultId: result.id,
          sourceUserId: this.uid,
          readOnly: true,
        },
      }),
    );
    await this.router.navigateByUrl('/quiz-summary');
  }
  async practiceFrom(result: QuizResult) {
    const questions = await this.learning.questionsByIds(result.questions.map((a) => a.questionId));
    questions.forEach((q) => (q.selectedIndex = null));
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
      launchContext: { kind: 'generated', sourceResultId: result.id, sourceUserId: this.uid },
    });
    await this.router.navigateByUrl('/quiz');
  }
  async changeRole(role: GtopUser['role']) {
    const user = this.user();
    if (!user) return;
    if (environment.uat && !confirm(`UAT uses live data. Change ${user.email} to ${role}?`)) return;
    await this.admin.setRole(user.uid, role);
    this.user.set({ ...user, role });
    this.actionMessage.set('Role updated.');
  }
  async markOffline() {
    if (!confirm('Mark this user offline?')) return;
    await this.presenceService.markOffline(this.uid);
    this.presence.set({ userId: this.uid, isOnline: false, lastActive: Date.now() });
    await this.admin.log(
      'mark-user-offline',
      this.auth.profile()!.uid,
      'Administrator marked user offline.',
      { userId: this.uid },
    );
    this.actionMessage.set('User marked offline.');
  }
  async resetLogin() {
    if (!confirm('Reset this user’s last-login metadata?')) return;
    await this.admin.resetLastLogin(this.uid, this.auth.profile()!.uid);
    const user = this.user();
    if (user) this.user.set({ ...user, lastLogin: null });
    this.actionMessage.set('Last login reset.');
  }
}
