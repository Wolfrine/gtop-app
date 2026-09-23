import '@angular/compiler';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ChangeDetectorRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import {
  chapterKey, normalizeQuestion, type PaperDraftPayload,
  QuestionPaperRepository, type SavedPaperDraft,
} from '../core/question-paper.repository';
import { QuestionPaperGeneratorPage } from './question-paper-generator.page';

// Vitest transpiles TypeScript rather than running Angular's AOT compiler. Supply
// the constructor metadata which Angular emits for this component in app builds.
(QuestionPaperGeneratorPage as typeof QuestionPaperGeneratorPage & {
  ctorParameters: () => { type: unknown }[];
}).ctorParameters = () => [
  { type: QuestionPaperRepository }, { type: AuthStore }, { type: ChangeDetectorRef },
];

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});
afterEach(() => TestBed.resetTestingModule());

const syllabus = [{ id: 'light', board: 'CBSE', standard: '10', subject: 'Science', chapter: 'Light', mcqCount: 1 }];
const bank = { questions: [normalizeQuestion('light-1', {
  ...syllabus[0], question: 'Which lens corrects myopia?', options: ['Concave', 'Convex'],
  correctIndex: 0, solutions: ['A concave lens diverges incoming light.'],
})], excludedCount: 0, truncatedScopes: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function createFixture(repository: object) {
  await TestBed.configureTestingModule({
    imports: [QuestionPaperGeneratorPage],
    providers: [provideZonelessChangeDetection(), provideRouter([]),
      { provide: QuestionPaperRepository, useValue: repository },
      { provide: AuthStore, useValue: { profile: () => ({ uid: 'admin-1', board: 'CBSE', standard: '10' }) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(QuestionPaperGeneratorPage);
  await fixture.whenStable();
  return fixture;
}

describe('paper generator in the real zoneless Angular view', () => {
  it('renders delayed loading, coverage, saving and reopening without manual change detection', async () => {
    const initial = deferred<typeof syllabus>();
    const saved: SavedPaperDraft[] = [];
    const repository = {
      syllabus: vi.fn(() => initial.promise), templates: vi.fn(async () => []),
      recentDrafts: vi.fn(async () => saved), approvedQuestions: vi.fn(async () => bank),
      saveDraft: vi.fn(async (payload: PaperDraftPayload) => { saved.push({ ...payload, id: 'saved-1' }); return 'saved-1'; }),
      draft: vi.fn(async () => saved[0]),
    };
    const fixture = await createFixture(repository);
    const view: HTMLElement = fixture.nativeElement;
    const boardSelect = view.querySelector('select')!;
    expect(boardSelect.matches(':disabled')).toBe(true);
    expect(view.textContent).toContain('Loading syllabus and templates');

    initial.resolve(syllabus);
    await vi.waitFor(() => {
      expect(boardSelect.matches(':disabled')).toBe(false);
      expect(boardSelect.value).toBe('CBSE');
      expect(view.textContent).not.toContain('Loading syllabus and templates');
    });

    const page = fixture.componentInstance;
    page.subjects = ['Science']; page.chapters = [chapterKey(syllabus[0])];
    page.marks = 1; page.onMarksChange();
    await page.runCoverage();
    await vi.waitFor(() => expect(view.textContent).toContain('Ready to prepare'));
    await page.generateDraft();
    await vi.waitFor(() => expect(view.querySelector('.qpg-paper')?.textContent).toContain('Which lens corrects myopia?'));
    await page.saveDraft();
    await vi.waitFor(() => expect(view.textContent).toContain('Your draft is saved. Reopen it from Recent drafts below.'));
    page.useSavedSetup();
    await page.openDraft('saved-1');
    await vi.waitFor(() => expect(view.textContent).toContain('Saved paper opened'));

    // This refresh is called without a template click, so only the async result's
    // explicit notification can render the changed list in a zoneless view.
    repository.recentDrafts.mockResolvedValueOnce([{ ...saved[0], id: 'saved-2', title: 'Refreshed saved paper' }]);
    await page.loadDrafts();
    await vi.waitFor(() => expect(view.querySelector('.qpg-draft-row')?.textContent).toContain('Refreshed saved paper'));
  });

  it('renders an asynchronous load failure and re-enables refresh', async () => {
    const initial = deferred<typeof syllabus>();
    const fixture = await createFixture({ syllabus: () => initial.promise, templates: async () => [], recentDrafts: async () => [] });
    const view: HTMLElement = fixture.nativeElement;
    initial.reject(new Error('Connection interrupted'));
    await vi.waitFor(() => {
      expect(view.querySelector('[role="alert"]')?.textContent).toContain('Connection interrupted');
      const refresh = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Refresh');
      expect(refresh?.disabled).toBe(false);
    });
  });
});
