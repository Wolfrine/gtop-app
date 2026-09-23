import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { typeLabel } from '../core/question-paper.domain';
import {
  QuestionReviewRepository,
  reviewErrorMessage,
  validateReviewEdits,
  type ReviewDraft,
  type ReviewEdits,
} from '../core/question-review.repository';

@Component({
  selector: 'app-question-review',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page review-page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Question bank</p>
          <h1>Review new questions</h1>
          <p class="muted">
            Check the question, correct answer and explanation before making it available to
            learners.
          </p>
        </div>
        <a class="btn btn-secondary" routerLink="/admin/question-paper-generator"
          >Question papers</a
        >
      </div>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (message()) {
        <p class="success-box" role="status">{{ message() }}</p>
      }

      <div class="queue-toolbar">
        <p class="muted" aria-live="polite">
          @if (loading()) {
            Loading questions for review…
          } @else {
            {{ items().length }} awaiting review{{ truncated() ? ' in this batch' : '' }}
          }
        </p>
        <button
          type="button"
          class="btn btn-secondary"
          (click)="load()"
          [disabled]="loading() || !!saving()"
        >
          Refresh queue
        </button>
      </div>
      @if (truncated()) {
        <p class="queue-notice">
          More questions are waiting. This view shows a batch of up to {{ pageLimit() }}; review
          these and refresh to see more.
        </p>
      }

      @if (!loading() && !items().length && !error()) {
        <section class="card empty">
          @if (truncated()) {
            <h2>This batch is complete</h2>
            <p>More questions are waiting. Refresh to load the next batch.</p>
            <button type="button" class="btn btn-primary" (click)="load()" [disabled]="!!saving()">
              Load next batch
            </button>
          } @else {
            <h2>Review queue is clear</h2>
            <p>New questions will appear here when creators submit them for review.</p>
            <a class="btn btn-primary" routerLink="/admin/question-paper-generator"
              >Build a question paper</a
            >
          }
        </section>
      }

      @if (items().length) {
        <div class="review-layout" [attr.aria-busy]="saving()">
          <aside class="card queue-list" aria-label="Questions awaiting review">
            <h2>Awaiting review</h2>
            @for (item of items(); track item.id) {
              <button
                type="button"
                class="queue-item"
                [class.selected]="selected()?.id === item.id"
                [attr.aria-pressed]="selected()?.id === item.id"
                [disabled]="!!saving()"
                (click)="select(item)"
              >
                <span class="queue-scope"
                  >{{ item.board }} · Class {{ item.standard }} · {{ item.subject }}</span
                >
                <strong>{{ item.title || item.question || 'Untitled question' }}</strong>
                <span class="muted small">{{ item.chapter }} · {{ label(item.questionType) }}</span>
              </button>
            }
          </aside>

          @if (selected(); as draft) {
            @if (edits; as edit) {
              <section class="card review-editor" aria-labelledby="review-heading">
                <div class="section-head">
                  <div>
                    <p class="eyebrow">Review & edit</p>
                    <h2 id="review-heading">{{ draft.subject }} · {{ draft.chapter }}</h2>
                  </div>
                  <span class="pill info">Pending review</span>
                </div>
                <div class="curriculum">
                  <span>{{ draft.board }} · Class {{ draft.standard }}</span>
                  <span>{{ label(draft.questionType) }}</span>
                  <span>{{ label(draft.difficulty) }}</span>
                </div>
                <p class="muted small">
                  Curriculum stays linked to the source chapter. Your edits below are saved when you
                  approve.
                </p>

                <fieldset class="edit-fields" [disabled]="!!saving()">
                  <legend class="sr-only">Question content</legend>
                  <div class="field">
                    <label for="review-title">Title (optional)</label>
                    <input id="review-title" [(ngModel)]="edit.title" maxlength="500" />
                  </div>
                  <div class="field">
                    <label for="review-question">Question</label>
                    <textarea
                      id="review-question"
                      [(ngModel)]="edit.question"
                      rows="5"
                      maxlength="20000"
                    ></textarea>
                  </div>
                  @if (draft.assets.length) {
                    <div class="question-assets">
                      @for (asset of draft.assets; track asset.url) {
                        <figure>
                          <img [src]="asset.url" [alt]="asset.alt" loading="lazy" />
                          <figcaption>{{ asset.alt }}</figcaption>
                        </figure>
                      }
                    </div>
                  }

                  @if (edit.options.length) {
                    <fieldset class="answer-options">
                      <legend>Answer options</legend>
                      <p class="muted small">Select the correct answer using its radio button.</p>
                      @for (option of edit.options; track $index; let index = $index) {
                        <div class="option-edit" [class.correct]="edit.correctIndex === index">
                          <input
                            type="radio"
                            name="review-correct-answer"
                            [id]="'review-correct-' + index"
                            [(ngModel)]="edit.correctIndex"
                            [value]="index"
                            [attr.aria-label]="'Option ' + (index + 1) + ' is correct'"
                          />
                          <div class="field">
                            <label [for]="'review-option-' + index"
                              >Option {{ index + 1
                              }}{{ edit.correctIndex === index ? ' · Correct answer' : '' }}</label
                            >
                            <textarea
                              [id]="'review-option-' + index"
                              [(ngModel)]="edit.options[index]"
                              rows="2"
                              maxlength="3000"
                            ></textarea>
                          </div>
                        </div>
                      }
                    </fieldset>
                  } @else {
                    <p class="queue-notice">
                      Written-answer publishing is not yet supported. You can inspect this draft and
                      leave a rejection note, but it cannot be published to learner quizzes.
                    </p>
                  }

                  <fieldset class="solutions">
                    <legend>Explanations & worked solutions</legend>
                    @for (solution of edit.solutions; track $index; let index = $index) {
                      <div class="field">
                        <label [for]="'review-solution-' + index"
                          >Explanation {{ index + 1 }}</label
                        >
                        <textarea
                          [id]="'review-solution-' + index"
                          [(ngModel)]="edit.solutions[index]"
                          rows="4"
                          maxlength="50000"
                        ></textarea>
                      </div>
                    }
                  </fieldset>
                  <div class="field">
                    <label for="review-notes">Review note (required for rejection)</label>
                    <textarea
                      id="review-notes"
                      [(ngModel)]="notes"
                      rows="3"
                      maxlength="2000"
                      placeholder="Explain any correction needed so the creator can improve it."
                    ></textarea>
                  </div>
                </fieldset>

                @if (approvalProblem()) {
                  <p class="queue-notice" id="approval-problem">{{ approvalProblem() }}</p>
                }
                <div class="review-actions">
                  <p class="muted small">
                    Approval publishes this reviewed question to the question bank and updates its
                    chapter total.
                  </p>
                  <div class="button-row">
                    <button
                      type="button"
                      class="btn btn-primary"
                      (click)="approve()"
                      [disabled]="!!saving() || !!approvalProblem()"
                      [attr.aria-describedby]="approvalProblem() ? 'approval-problem' : null"
                    >
                      {{ saving() === 'approve' ? 'Publishing…' : 'Approve & publish' }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-danger"
                      (click)="reject()"
                      [disabled]="!!saving() || !notes.trim()"
                    >
                      {{ saving() === 'reject' ? 'Saving…' : 'Reject with note' }}
                    </button>
                  </div>
                </div>
              </section>
            }
          } @else {
            <section class="card empty">
              <h2>Select the next question</h2>
              <p>Choose a question from the review list to check its answer and explanation.</p>
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .page-head p {
      max-width: 660px;
    }
    .queue-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin: 20px 0 12px;
    }
    .queue-notice {
      padding: 12px 14px;
      color: var(--ink-2);
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: 10px;
      line-height: 1.5;
    }
    .review-layout {
      display: grid;
      grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.7fr);
      gap: 20px;
      align-items: start;
    }
    .queue-list {
      padding: 18px;
    }
    .queue-list h2 {
      margin-top: 0;
    }
    .queue-item {
      width: 100%;
      display: grid;
      gap: 7px;
      text-align: left;
      padding: 15px 12px;
      margin-top: 8px;
      border: 1px solid var(--line);
      border-radius: 10px;
      color: var(--ink);
      background: var(--surface);
    }
    .queue-item.selected {
      border-color: var(--teal);
      box-shadow: inset 3px 0 var(--teal);
      background: var(--teal-soft);
    }
    .queue-item strong {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .queue-scope {
      font-size: 11px;
      font-weight: 750;
      color: var(--teal-strong);
      line-height: 1.4;
    }
    .review-editor {
      min-width: 0;
    }
    .curriculum {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .curriculum span {
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--surface-2);
      color: var(--ink-2);
      font-size: 12px;
    }
    .edit-fields,
    .answer-options,
    .solutions {
      border: 0;
      padding: 0;
      margin: 0;
      min-width: 0;
    }
    .edit-fields {
      display: grid;
      gap: 20px;
      margin-top: 24px;
    }
    legend {
      padding: 0;
      color: var(--ink);
      font-weight: 750;
      margin-bottom: 12px;
    }
    .option-edit {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr);
      gap: 12px;
      padding: 12px;
      margin: 10px 0;
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    .option-edit.correct {
      border-color: var(--teal);
      background: var(--teal-soft);
    }
    .option-edit input[type='radio'] {
      width: 20px;
      height: 20px;
      margin: 25px 0 0;
      accent-color: var(--teal);
    }
    .option-edit textarea {
      min-height: 72px;
    }
    .solutions .field + .field {
      margin-top: 16px;
    }
    .question-assets {
      display: grid;
      gap: 12px;
    }
    figure {
      margin: 0;
    }
    figure img {
      display: block;
      max-width: 100%;
      max-height: 440px;
      height: auto;
      object-fit: contain;
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    figcaption {
      color: var(--muted);
      font-size: 12px;
      margin-top: 8px;
    }
    .review-actions {
      border-top: 1px solid var(--line);
      margin-top: 24px;
      padding-top: 12px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    @media (max-width: 820px) {
      .review-layout {
        grid-template-columns: 1fr;
      }
      .queue-list {
        max-height: 350px;
        overflow: auto;
      }
      .section-head {
        align-items: flex-start;
        flex-wrap: wrap;
      }
    }
    @media (max-width: 480px) {
      .queue-toolbar {
        align-items: flex-start;
        flex-direction: column;
      }
      .button-row .btn {
        width: 100%;
      }
      .option-edit {
        padding: 9px;
        gap: 8px;
      }
    }
  `,
})
export class QuestionReviewPage implements OnInit {
  readonly items = signal<ReviewDraft[]>([]);
  readonly selected = signal<ReviewDraft | null>(null);
  readonly loading = signal(false);
  readonly saving = signal<'' | 'approve' | 'reject'>('');
  readonly truncated = signal(false);
  readonly pageLimit = signal(50);
  readonly error = signal('');
  readonly message = signal('');
  readonly label = typeLabel;
  edits: ReviewEdits | null = null;
  notes = '';

  constructor(
    private readonly repository: QuestionReviewRepository,
    private readonly auth: AuthStore,
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const queue = await this.repository.pending();
      this.items.set(queue.items);
      this.truncated.set(queue.truncated);
      this.pageLimit.set(queue.limit);
      if (queue.items.length) this.select(queue.items[0]);
      else {
        this.selected.set(null);
        this.edits = null;
      }
    } catch (error) {
      this.error.set(reviewErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  select(draft: ReviewDraft): void {
    if (this.saving()) return;
    this.selected.set(draft);
    this.edits = {
      title: draft.title,
      question: draft.question,
      options: [...draft.options],
      correctIndex: draft.correctIndex,
      solutions: draft.solutions.length ? [...draft.solutions] : [''],
    };
    this.notes = draft.reviewNotes;
    this.error.set('');
  }

  approvalProblem(): string {
    const draft = this.selected();
    return draft && this.edits ? validateReviewEdits(draft, this.edits) : '';
  }

  async approve(): Promise<void> {
    const draft = this.selected();
    if (!draft || !this.edits || this.saving()) return;
    this.saving.set('approve');
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.repository.approve(draft, this.edits, this.actorId(), this.notes);
      this.removeReviewed(draft.id);
      this.message.set(
        result.alreadyApproved
          ? 'This question was already approved. No second copy was published.'
          : 'Question approved. It is now available for learner quizzes and question papers.',
      );
    } catch (error) {
      this.error.set(reviewErrorMessage(error));
    } finally {
      this.saving.set('');
    }
  }

  async reject(): Promise<void> {
    const draft = this.selected();
    if (!draft || this.saving()) return;
    this.saving.set('reject');
    this.error.set('');
    this.message.set('');
    try {
      await this.repository.reject(draft, this.actorId(), this.notes);
      this.removeReviewed(draft.id);
      this.message.set('Question rejected. Your review note is saved for its creator.');
    } catch (error) {
      this.error.set(reviewErrorMessage(error));
    } finally {
      this.saving.set('');
    }
  }

  private actorId(): string {
    if (!this.auth.isAdmin())
      throw new Error('Sign in with an admin account before reviewing questions.');
    return this.auth.profile()?.uid ?? '';
  }

  private removeReviewed(id: string): void {
    this.items.update((items) => items.filter((item) => item.id !== id));
    this.selected.set(null);
    this.edits = null;
    this.notes = '';
    // Leave no stale editor open during the saving state; the next item is an explicit choice.
  }
}
