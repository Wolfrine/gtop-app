import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { QuestionModuleHeaderComponent } from './question-module-header.component';
import { AdminUsageService } from '../../../services/admin-usage.service';
import { AuthService } from '../../../services/auth.service';
import { type SyllabusItem } from '../core/models';
import { QuestionPaperRepository, typeLabel } from '../core/question-paper.repository';
import {
  QuestionOperationsRepository, type BankRow, type CreatedQuestionRow,
  type PriorityItem, type ScopeCounts,
} from '../core/question-operations.repository';

@Component({
  selector: 'app-question-bank-workspace',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, QuestionModuleHeaderComponent],
  templateUrl: './question-bank-workspace.page.html',
})
export class QuestionBankWorkspacePage implements OnInit {
  readonly view = signal<'coverage' | 'bank'>('coverage');
  readonly priorities = signal<PriorityItem[]>([]);
  readonly syllabus = signal<SyllabusItem[]>([]);
  readonly selectedPriority = signal<PriorityItem | null>(null);
  readonly selectedScope = signal<SyllabusItem | null>(null);
  readonly counts = signal<ScopeCounts | null>(null);
  readonly created = signal<CreatedQuestionRow[]>([]);
  readonly bankRows = signal<BankRow[]>([]);
  readonly run = signal<Record<string, unknown> | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly detailError = signal('');
  readonly success = signal('');
  readonly morePriorities = signal<string | null>(null);
  readonly moreCreated = signal<string | null>(null);
  readonly moreBank = signal<string | null>(null);
  readonly scopeSearch = signal('');
  readonly prioritySearch = signal('');
  readonly statusFilter = signal('active');
  readonly source = signal<'questions' | 'devQuestions'>('questions');
  readonly showDetail = signal(false);
  readonly target = signal(1000);
  readonly urgency = signal('high');
  readonly types = signal<string[]>(['mcq', 'short_answer']);
  readonly label = typeLabel;
  readonly typeOptions = [
    'mcq', 'assertion_reason', 'case_based', 'source_based', 'statement_based',
    'matching', 'short_answer', 'numerical', 'long_answer',
  ];

  readonly filteredPriorities = computed(() => {
    const q = this.prioritySearch().trim().toLowerCase();
    const status = this.statusFilter();
    return this.priorities().filter((item) => {
      if (status === 'active' && !['open', 'review', 'blocked', 'paused'].includes(item.status)) return false;
      if (status !== 'active' && status !== 'all' && item.status !== status) return false;
      return !q || [item.board, item.standard, item.subject, item.chapter, item.source]
        .join(' ').toLowerCase().includes(q);
    }).sort((a, b) => {
      const rank = (item: PriorityItem) =>
        ({ critical: 0, high: 1, medium: 2, low: 3 }[item.priority] ?? 4);
      return rank(a) - rank(b);
    });
  });
  readonly scopeMatches = computed(() => {
    const q = this.scopeSearch().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.syllabus().filter((item) =>
      `${item.board} ${item.standard} ${item.subject} ${item.chapter}`.toLowerCase().includes(q)).slice(0, 8);
  });
  readonly approved = computed(() => this.counts()
    ? this.counts()!.quizApproved + this.counts()!.paperOnlyApproved : null);
  readonly notYetApproved = computed(() => this.approved() === null ? null
    : Math.max(0, this.target() - this.approved()!));
  readonly unassigned = computed(() => this.notYetApproved() === null ? null
    : Math.max(0, this.notYetApproved()! - (this.counts()?.pending ?? 0)));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router:Router,
    private readonly usage:AdminUsageService,
    private readonly auth: AuthService,
    private readonly paper: QuestionPaperRepository,
    private readonly operations: QuestionOperationsRepository,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      if(params.get('view')==='bank'){void this.router.navigate(['/admin/question-library'],{replaceUrl:true});return;}
      this.view.set('coverage');
      if (this.view() === 'bank' && this.selectedScope() && !this.bankRows().length)
        void this.loadBank(true);
      const requested = params.get('priorityId');
      if (requested) {
        const found = this.priorities().find((item) => item.id === requested);
        if (found) void this.selectPriority(found);
      }
    });
    void this.load();
  }

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try {
      const [priorityPage, scopes] = await Promise.all([this.operations.priorities(undefined,50,this.route.snapshot.queryParamMap.get('requestId')??undefined), this.paper.syllabus()]);
      this.priorities.set(priorityPage.items);
      this.morePriorities.set(priorityPage.nextCursor);
      this.syllabus.set(scopes);
      const requested = this.route.snapshot.queryParamMap.get('priorityId');
      const scopeId=this.route.snapshot.queryParamMap.get('syllabusId');
      const chapter=scopes.find(scope=>scope.id===scopeId);
      if(chapter){await this.selectScope(chapter);return;}
      const initial = (requested?await this.operations.priority(requested):null) ??
        priorityPage.items.find((item) => item.status === 'open') ?? priorityPage.items[0];
      if (initial) {await this.selectPriority(initial);if(!requested)this.showDetail.set(false);}
    } catch (error) { this.error.set(this.messageFor(error)); }
    finally { this.loading.set(false); }
  }

  async loadMorePriorities(): Promise<void> {
    const cursor = this.morePriorities();
    if (!cursor || this.loading()) return;
    this.loading.set(true);
    try {
      const page = await this.operations.priorities(cursor,50,this.route.snapshot.queryParamMap.get('requestId')??undefined);
      this.priorities.update((items) => [...items, ...page.items]);
      this.morePriorities.set(page.nextCursor);
    } catch (error) { this.error.set(this.messageFor(error)); }
    finally { this.loading.set(false); }
  }

  async selectPriority(item: PriorityItem): Promise<void> {
    this.selectedPriority.set(item); this.showDetail.set(true);
    this.target.set(item.requiredCount || 1000);
    this.urgency.set(item.priority);
    this.types.set(item.questionTypes.length ? item.questionTypes : ['mcq']);
    const scope = this.syllabus().find((entry) => entry.id === item.sourceSyllabusId) ??
      this.syllabus().find((entry) => entry.board === item.board && entry.standard === item.standard &&
        entry.subject === item.subject && entry.chapter === item.chapter) ?? null;
    await this.openScope(scope, item);
  }

  async selectScope(scope: SyllabusItem): Promise<void> {
    this.scopeSearch.set(''); this.selectedPriority.set(null); this.showDetail.set(true);
    this.target.set(1000); this.urgency.set('high'); this.types.set(['mcq', 'short_answer']);
    await this.openScope(scope, null);
  }

  private async openScope(scope: SyllabusItem | null, priority: PriorityItem | null): Promise<void> {
    this.selectedScope.set(scope); this.counts.set(null); this.created.set([]);
    this.bankRows.set([]); this.moreCreated.set(null); this.moreBank.set(null); this.run.set(null);
    this.detailError.set(''); this.detailLoading.set(true);
    try {
      const [counts, created, run] = await Promise.all([
        scope ? this.operations.counts(scope) : Promise.resolve(null),
        priority ? this.operations.createdForPriority(priority.id) : Promise.resolve(null),
        priority?.agentRunId ? this.operations.run(priority.agentRunId) : Promise.resolve(null),
      ]);
      this.counts.set(counts);
      this.created.set(created?.items ?? []);
      this.moreCreated.set(created?.nextCursor ?? null);
      this.run.set(run);
      if (this.view() === 'bank' && scope) await this.loadBank(true);
    } catch (error) { this.detailError.set(this.messageFor(error)); }
    finally { this.detailLoading.set(false); }
  }

  async loadMoreCreated(): Promise<void> {
    const item = this.selectedPriority();
    const cursor = this.moreCreated();
    if (!item || !cursor) return;
    try {
      const page = await this.operations.createdForPriority(item.id, cursor);
      this.created.update((rows) => [...rows, ...page.items]);
      this.moreCreated.set(page.nextCursor);
    } catch (error) { this.detailError.set(this.messageFor(error)); }
  }

  async changeSource(source: 'questions' | 'devQuestions'): Promise<void> {
    this.source.set(source);
    await this.loadBank(true);
  }

  async loadBank(reset = false): Promise<void> {
    const scope = this.selectedScope();
    if (!scope) return;
    this.detailError.set('');
    try {
      const page = await this.operations.bank(scope, this.source(), reset ? undefined : this.moreBank() || undefined);
      this.bankRows.update((items) => reset ? page.items : [...items, ...page.items]);
      this.moreBank.set(page.nextCursor);
    } catch (error) { this.detailError.set(this.messageFor(error)); }
  }

  toggleType(type: string): void {
    this.types.update((items) => items.includes(type)
      ? items.filter((item) => item !== type) : [...items, type]);
  }

  async savePriority(): Promise<void> {
    const scope = this.selectedScope();
    if (!scope || this.saving()) return;
    this.saving.set(true); this.detailError.set(''); this.success.set('');
    try {
      const id = await this.operations.setGrowthPriority(scope, this.target(), this.urgency(),
        this.types(), this.actorId());
      const page = await this.operations.priorities();
      this.priorities.set(page.items); this.morePriorities.set(page.nextCursor);
      const updated = page.items.find((item) => item.id === id);
      if (updated) await this.selectPriority(updated);
      this.usage.track('priority_saved');
      this.success.set('Priority saved. The creator can now use this chapter and question-type mix.');
    } catch (error) { this.detailError.set(this.messageFor(error)); }
    finally { this.saving.set(false); }
  }

  async togglePause(): Promise<void> {
    const item = this.selectedPriority();
    if (!item || this.saving()) return;
    this.saving.set(true); this.detailError.set('');
    try {
      await this.operations.setPriorityStatus(item, item.status === 'paused' ? 'open' : 'paused', this.actorId());
      const page = await this.operations.priorities();
      this.priorities.set(page.items); this.morePriorities.set(page.nextCursor);
      const updated = page.items.find((row) => row.id === item.id);
      if (updated) this.selectedPriority.set(updated);
    } catch (error) { this.detailError.set(this.messageFor(error)); }
    finally { this.saving.set(false); }
  }

  back(): void { this.showDetail.set(false); }
  statusLabel(status: string): string {
    const labels: Record<string, string> = { open: 'Queued', blocked: 'Blocked',
      paused: 'Paused', review: 'Review', done: 'Complete' };
    return labels[status] ?? status;
  }
  private actorId(): string {
    if (!this.auth.isAdmin()) throw new Error('Sign in with an admin account.');
    return this.auth.profile()?.uid ?? '';
  }
  private messageFor(error: unknown): string {
    return error instanceof Error ? error.message : 'This question-bank view could not load. Refresh and try again.';
  }
}
