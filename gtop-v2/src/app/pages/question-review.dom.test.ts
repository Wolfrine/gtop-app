import '@angular/compiler';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { QuestionReviewRepository, toReviewDraft } from '../core/question-review.repository';
import { QuestionReviewPage } from './question-review.page';

// Vitest does not emit Angular's AOT constructor metadata.
(
  QuestionReviewPage as typeof QuestionReviewPage & {
    ctorParameters: () => { type: unknown }[];
  }
).ctorParameters = () => [{ type: QuestionReviewRepository }, { type: AuthStore }];

beforeAll(() => TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()));
afterEach(() => TestBed.resetTestingModule());

function makeDraft(id: string) {
  return toReviewDraft(id, {
    board: 'CBSE',
    standard: '9',
    subject: 'Science',
    chapter: 'Motion',
    questionType: 'mcq',
    difficulty: 'easy',
    reviewStatus: 'pending-admin-review',
    title: `Review sample ${id}`,
    question: `Question ${id}: what is acceleration?`,
    options: ['Change in velocity per unit time', 'Change in distance per unit time'],
    correctIndex: 0,
    solutions: [`Original explanation ${id}`],
  });
}

async function createFixture() {
  const drafts = [makeDraft('first'), makeDraft('second')];
  const repository = {
    pending: vi.fn(async () => ({ items: drafts, truncated: false, limit: 50 })),
    approve: vi.fn(async () => ({ questionId: 'approved', alreadyApproved: false })),
    reject: vi.fn(async () => undefined),
  };
  await TestBed.configureTestingModule({
    imports: [QuestionReviewPage],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: QuestionReviewRepository, useValue: repository },
      {
        provide: AuthStore,
        useValue: { profile: () => ({ uid: 'admin-1' }), isAdmin: () => true },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(QuestionReviewPage);
  await fixture.whenStable();
  return { fixture, repository, drafts, view: fixture.nativeElement as HTMLElement };
}

function input(
  view: HTMLElement,
  selector: string,
  value: string,
): HTMLInputElement | HTMLTextAreaElement {
  const control = view.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  return control;
}

describe('question review editor in the real zoneless Angular view', () => {
  it('preserves a fast title edit after clicking the already-selected queue item', async () => {
    const { fixture, repository, view } = await createFixture();
    view.querySelector<HTMLButtonElement>('.queue-item')!.click();
    // Deliberately edit before Angular renders the selection click. This is the
    // browser race that previously replaced Approved sample with Review sample.
    input(view, '#review-title', 'Approved sample first');
    await fixture.whenStable();
    expect(view.querySelector<HTMLInputElement>('#review-title')!.value).toBe(
      'Approved sample first',
    );
    view.querySelector<HTMLButtonElement>('.review-actions .btn-primary')!.click();
    await fixture.whenStable();
    expect(repository.approve).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'first' }),
      expect.objectContaining({ title: 'Approved sample first' }),
      'admin-1',
      '',
    );
  });

  it('applies immediate DOM edits to the newly selected draft and publishes that exact content', async () => {
    const { fixture, repository, drafts, view } = await createFixture();
    view.querySelectorAll<HTMLButtonElement>('.queue-item')[1].click();
    input(view, '#review-title', 'Reviewed second draft');
    input(view, '#review-question', 'What is the SI unit of speed?');
    input(view, '#review-option-0', 'Metre');
    input(view, '#review-option-1', 'Metre per second');
    view.querySelector<HTMLInputElement>('#review-correct-1')!.click();
    input(
      view,
      '#review-solution-0',
      'Speed is distance divided by time, so its SI unit is metre per second.',
    );
    input(view, '#review-notes', 'Question and explanation corrected.');
    // No artificial sleep or manual detectChanges between selection, editing,
    // and approval: application event handlers must retain the visible edits.
    view.querySelector<HTMLButtonElement>('.review-actions .btn-primary')!.click();
    await fixture.whenStable();
    expect(repository.approve).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'second' }),
      expect.objectContaining({
        title: 'Reviewed second draft',
        question: 'What is the SI unit of speed?',
        options: ['Metre', 'Metre per second'],
        correctIndex: 1,
        solutions: ['Speed is distance divided by time, so its SI unit is metre per second.'],
      }),
      'admin-1',
      'Question and explanation corrected.',
    );
    expect(drafts[0].title).toBe('Review sample first');
    expect(drafts[1].title).toBe('Review sample second');
  });

  it('does not discard unsaved content or notes when the same row is selected again', async () => {
    const { fixture, repository, view } = await createFixture();
    input(view, '#review-title', 'Keep my reviewed title');
    input(view, '#review-notes', 'Verified units.');
    await fixture.whenStable();
    view.querySelector<HTMLButtonElement>('.queue-item')!.click();
    await fixture.whenStable();
    expect(view.querySelector<HTMLInputElement>('#review-title')!.value).toBe(
      'Keep my reviewed title',
    );
    expect(view.querySelector<HTMLTextAreaElement>('#review-notes')!.value).toBe('Verified units.');
    expect(repository.approve).not.toHaveBeenCalled();
  });
});
