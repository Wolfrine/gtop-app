import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { typeLabel } from '../core/question-paper.domain';
import {
  QuestionReviewRepository, reviewErrorMessage, validateReviewEdits,
  type ReviewDraft, type ReviewEdits,
} from '../core/question-review.repository';

interface BatchGroup { id: string; title: string; scope: string; count: number; flagged: number }

function editsFor(draft: ReviewDraft): ReviewEdits {
  return { title: draft.title, question: draft.question,
    options: [...draft.options], correctIndex: draft.correctIndex,
    solutions: [...draft.solutions] };
}

function normalizedQuestion(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

@Component({
  selector: 'app-question-review-workbench',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './question-review-workbench.page.html',
})
export class QuestionReviewWorkbenchPage implements OnInit {
  readonly items = signal<ReviewDraft[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly expandedId = signal('');
  readonly editing = signal<ReviewDraft | null>(null);
  readonly edits = signal<ReviewEdits | null>(null);
  readonly editNote = signal('');
  readonly batchId = signal('all');
  readonly typeFilter = signal('all');
  readonly search = signal('');
  readonly total = signal(0);
  readonly cursor = signal<string | null>(null);
  readonly loading = signal(false);
  readonly processing = signal(false);
  readonly processed = signal(0);
  readonly processTotal = signal(0);
  readonly confirmAction = signal<'' | 'approve' | 'reject'>('');
  readonly rejectionNote = signal('');
  readonly error = signal('');
  readonly message = signal('');
  readonly failures = signal<string[]>([]);
  readonly label = typeLabel;
  readonly priorityId: string | null;

  readonly repeatedIds = computed(() => {
    const seen = new Map<string, string>();
    const repeats = new Set<string>();
    for (const item of this.items()) {
      const key = [item.board, item.standard, item.subject, item.chapter,
        normalizedQuestion(item.question)].join('|');
      if (seen.has(key)) { repeats.add(item.id); repeats.add(seen.get(key)!); }
      else seen.set(key, item.id);
    }
    return repeats;
  });

  readonly batches = computed<BatchGroup[]>(() => {
    const groups = new Map<string, BatchGroup>();
    for (const item of this.items()) {
      const key = this.groupKey(item);
      const group = groups.get(key) ?? { id: key,
        title: item.chapter || 'Unassigned chapter',
        scope: `${item.board} · Class ${item.standard} · ${item.subject}`,
        count: 0, flagged: 0 };
      group.count++;
      if (this.issue(item)) group.flagged++;
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  });
  readonly visible = computed(() => {
    const text = this.search().trim().toLowerCase();
    return this.items().filter((item) =>
      (this.batchId() === 'all' || this.groupKey(item) === this.batchId()) &&
      (this.typeFilter() === 'all' || item.questionType === this.typeFilter()) &&
      (!text || `${item.question} ${item.title} ${item.chapter}`.toLowerCase().includes(text)));
  });
  readonly types = computed(() => [...new Set(this.items().map((item) => item.questionType))].sort());
  readonly selected = computed(() => this.items().filter((item) => this.selectedIds().has(item.id)));
  readonly eligible = computed(() => this.selected().filter((item) => !this.issue(item)));
  readonly selectedFlagged = computed(() => this.selected().length - this.eligible().length);
  readonly allShownSelected = computed(() => this.visible().length > 0 &&
    this.visible().every((item) => this.selectedIds().has(item.id)));
  readonly quizDestination = computed(() => this.eligible().filter((item) => !item.paperOnly).length);
  readonly paperDestination = computed(() => this.eligible().filter((item) => item.paperOnly).length);

  constructor(
    route: ActivatedRoute,
    private readonly repository: QuestionReviewRepository,
    private readonly auth: AuthService,
  ) { this.priorityId = route.snapshot.queryParamMap.get('priorityId'); }

  ngOnInit(): void { void this.load(true); }

  async load(reset = false): Promise<void> {
    if (this.loading() || this.processing()) return;
    this.loading.set(true); this.error.set('');
    try {
      const page = await this.repository.pending(50, reset ? undefined : this.cursor() ?? undefined,
        this.priorityId ?? undefined);
      this.items.update((items) => reset ? page.items : [...items, ...page.items]);
      this.cursor.set(page.nextCursor); this.total.set(page.total);
      if (reset) { this.selectedIds.set(new Set()); this.batchId.set('all'); }
      if (this.batchId() !== 'all' && !this.batches().some((group) => group.id === this.batchId()))
        this.batchId.set('all');
    } catch (error) { this.error.set(reviewErrorMessage(error)); }
    finally { this.loading.set(false); }
  }

  groupKey(item: ReviewDraft): string {
    return item.agentRunId || item.sourcePriorityId ||
      `${item.board}|${item.standard}|${item.subject}|${item.chapter}`;
  }

  issue(item: ReviewDraft, edits = editsFor(item)): string {
    if (item.priorityStatus === 'blocked') return 'Blocked syllabus priority';
    if (item.boardStandardMatched === false) return 'Board or class mismatch';
    if (item.boardStandardMatched === null) return 'Class-level check missing';
    if (!item.referenceUsed || item.referenceConfidence < 0.85) return 'Reference needs review';
    if (this.repeatedIds().has(item.id)) return 'Repeated wording in this batch';
    return validateReviewEdits(item, edits);
  }

  answer(item: ReviewDraft): string {
    return item.options.length && item.correctIndex >= 0
      ? item.options[item.correctIndex] || 'Answer missing'
      : item.solutions[0] || 'Solution missing';
  }

  toggle(id: string): void {
    if (this.processing()) return;
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    this.confirmAction.set('');
  }

  selectVisible(): void {
    const rows = this.visible();
    const allSelected = rows.length > 0 && rows.every((item) => this.selectedIds().has(item.id));
    this.selectedIds.update((current) => {
      const next = new Set(current);
      for (const item of rows) { if (allSelected) next.delete(item.id); else next.add(item.id); }
      return next;
    });
    this.confirmAction.set('');
  }

  clearSelection(): void { this.selectedIds.set(new Set()); this.confirmAction.set(''); }
  expand(id: string): void { this.expandedId.set(this.expandedId() === id ? '' : id); }

  openEditor(item: ReviewDraft): void {
    this.editing.set(item); this.edits.set(editsFor(item)); this.editNote.set(item.reviewNotes);
    this.error.set('');
  }
  closeEditor(): void { if (!this.processing()) { this.editing.set(null); this.edits.set(null); } }
  updateEdit(field: 'title' | 'question', value: string): void {
    this.edits.update((edit) => edit ? { ...edit, [field]: value } : edit);
  }
  updateOption(index: number, value: string): void {
    this.edits.update((edit) => edit ? { ...edit,
      options: edit.options.map((option, i) => i === index ? value : option) } : edit);
  }
  updateSolution(index: number, value: string): void {
    this.edits.update((edit) => edit ? { ...edit,
      solutions: edit.solutions.map((solution, i) => i === index ? value : solution) } : edit);
  }
  setCorrect(index: number): void {
    this.edits.update((edit) => edit ? { ...edit, correctIndex: index } : edit);
  }

  async saveEdited(approve: boolean): Promise<void> {
    const draft = this.editing(); const edits = this.edits();
    if (!draft || !edits || this.processing()) return;
    this.processing.set(true); this.error.set('');
    try {
      if (approve) {
        if (this.issue(draft, edits)) throw new Error(`Resolve this review issue before approval: ${this.issue(draft, edits)}`);
        await this.repository.approve(draft, edits, this.actorId(), this.editNote());
      } else await this.repository.reject(draft, this.actorId(), this.editNote());
      this.removeHandled([draft.id]); this.closeAfterSave();
      this.message.set(approve ? 'Edited question approved.' : 'Question rejected with your note.');
    } catch (error) { this.error.set(reviewErrorMessage(error)); }
    finally { this.processing.set(false); }
  }

  startAction(action: 'approve' | 'reject'): void {
    if (!this.selected().length) return;
    this.confirmAction.set(action); this.error.set(''); this.message.set('');
  }

  async applySelected(): Promise<void> {
    const action = this.confirmAction();
    if (!action || this.processing()) return;
    const rows = action === 'approve' ? this.eligible() : this.selected();
    if (!rows.length) { this.error.set('No eligible questions are selected for approval.'); return; }
    if (action === 'reject' && !this.rejectionNote().trim()) {
      this.error.set('Add a reason before rejecting selected questions.'); return;
    }
    this.processing.set(true); this.processed.set(0); this.processTotal.set(rows.length);
    this.failures.set([]); this.error.set(''); this.message.set('');
    const handled: string[] = []; const failures: string[] = [];
    // Each existing approval transaction rechecks the draft, syllabus, priority and
    // duplicate wording. Independent transactions keep partial failures retryable.
    for (const item of rows) {
      try {
        if (action === 'approve')
          await this.repository.approve(item, editsFor(item), this.actorId());
        else await this.repository.reject(item, this.actorId(), this.rejectionNote());
        handled.push(item.id);
      } catch (error) { failures.push(`${item.id}: ${reviewErrorMessage(error)}`); }
      this.processed.update((count) => count + 1);
    }
    this.removeHandled(handled); this.failures.set(failures);
    this.message.set(`${handled.length} ${action === 'approve' ? 'approved' : 'rejected'}; ${failures.length} need attention.`);
    this.confirmAction.set(''); this.processing.set(false);
    if (this.cursor() && this.items().length < 15) void this.load(false);
  }

  private closeAfterSave(): void { this.editing.set(null); this.edits.set(null); this.editNote.set(''); }
  private removeHandled(ids: string[]): void {
    const set = new Set(ids);
    this.items.update((items) => items.filter((item) => !set.has(item.id)));
    this.selectedIds.update((current) => new Set([...current].filter((id) => !set.has(id))));
    this.total.update((total) => Math.max(0, total - ids.length));
    if (set.has(this.expandedId())) this.expandedId.set('');
  }
  private actorId(): string {
    if (!this.auth.isAdmin()) throw new Error('Sign in with an admin account before reviewing questions.');
    return this.auth.profile()?.uid ?? '';
  }
}
