import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { CurriculumService } from '../../../services/curriculum.service';
import { AuthService } from '../../../services/auth.service';
import { chapterKey, normalizeQuestion, type QuestionBankResult, QuestionPaperRepository } from '../core/question-paper.repository';
import { QuestionPaperGeneratorPage } from './question-paper-generator.page';

function fixture() {
  const bank: QuestionBankResult = { questions: [normalizeQuestion('light-1', {
    board: 'CBSE', standard: '10', subject: 'Science', chapter: 'Light', title: 'Optics',
    question: 'Which lens corrects myopia?', options: ['Concave', 'Convex'], correctIndex: 0,
    solutions: ['A concave lens diverges the incoming light.'],
  })], excludedCount: 0, truncatedScopes: [] };
  const repository = {
    approvedQuestions: vi.fn(async () => bank), saveDraft: vi.fn(async () => 'saved-1'),
    recentDrafts: vi.fn(async () => []), recentRequests: vi.fn(async () => []), requestPaper: vi.fn(async () => 'request-1'), createPriorityItems: vi.fn(async () => 1),
  };
  const page = new QuestionPaperGeneratorPage(repository as unknown as QuestionPaperRepository,
    {seed:vi.fn().mockResolvedValue({boards:[],subjects:[]}),published:vi.fn().mockResolvedValue([])} as unknown as CurriculumService,
    { profile: () => ({ uid: 'admin-1' }) } as unknown as AuthService,
    { markForCheck: vi.fn() } as unknown as ChangeDetectorRef);
  page.syllabus = [{ id: 'light', board: 'CBSE', standard: '10', subject: 'Science', chapter: 'Light', mcqCount: 1 }];
  page.board = 'CBSE'; page.standard = '10'; page.subjects = ['Science'];
  page.chapters = [chapterKey({ subject: 'Science', chapter: 'Light' })];
  page.marks = 1; page.onMarksChange();
  return { page, repository, bank };
}

describe('paper setup state safety', () => {
  it('keeps standard paper preparation available when stored templates cannot be read', async () => {
    const { page, repository } = fixture();
    Object.assign(repository, {
      syllabus: vi.fn(async () => page.syllabus),
      templates: vi.fn(async () => { throw Object.assign(new Error('Denied'), { code: 'permission-denied' }); }),
    });
    await page.loadInitialData();
    expect(page.board).toBe('CBSE');
    expect(page.templateWarning).toContain('standard MCQ paper');
    expect(page.errorMessage).toBe('');
    page.marks = 1; page.onMarksChange();
    await page.runCoverage(); await page.generateDraft();
    expect(page.completePaper).toBe(true);
  });
  it('checks, previews and persists the same complete allocation', async () => {
    const { page, repository } = fixture();
    await page.runCoverage(); await page.generateDraft(); await page.saveDraft();
    expect(repository.approvedQuestions).toHaveBeenCalledWith('CBSE', '10', [{ subject: 'Science', chapter: 'Light' }], undefined);
    expect(page.completePaper).toBe(true);
    expect(page.savedDraftId).toBe('saved-1');
    expect(repository.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ marks: 1, actualMarks: 1, subjects: ['Science'], schemaVersion: 2 }));
  });
  it('invalidates preview, coverage and saved identity on title, duration and section changes', async () => {
    const { page } = fixture();
    await page.runCoverage(); await page.generateDraft();
    page.durationMinutes = 45; page.onSetupChange();
    expect(page.coverageChecked).toBe(false); expect(page.generatedSections).toEqual([]);
    await page.runCoverage(); await page.generateDraft();
    page.rules[0].marksPerQuestion = 2; page.onRuleChange();
    expect(page.marks).toBe(2); expect(page.completePaper).toBe(false); expect(page.savedDraftId).toBe('');
  });
  it('discards a late coverage result when the selected setup changed', async () => {
    const { page, repository, bank } = fixture();
    let resolve!: (value: QuestionBankResult) => void;
    repository.approvedQuestions.mockImplementationOnce(() => new Promise<QuestionBankResult>((done) => { resolve = done; }));
    const checking = page.runCoverage();
    page.marks = 2; page.onMarksChange();
    resolve(bank); await checking;
    expect(page.coverageChecked).toBe(false); expect(page.questions).toEqual([]); expect(page.generatedSections).toEqual([]);
  });
  it('refuses stale saves even if an edit bypassed the normal change handler', async () => {
    const { page, repository } = fixture();
    await page.runCoverage(); await page.generateDraft();
    page.title = 'Changed title'; await page.saveDraft();
    expect(repository.saveDraft).not.toHaveBeenCalled();
    expect(page.errorMessage).toMatch(/setup changed/);
  });
  it('does not request a gap after a bounded bank scan was incomplete', async () => {
    const { page, repository, bank } = fixture();
    bank.truncatedScopes = [{ subject: 'Science', chapter: 'Light' }];
    page.marks = 2; page.onMarksChange(); await page.runCoverage(); await page.createPriorityItems();
    expect(page.totalGapCount).toBe(1); expect(repository.createPriorityItems).not.toHaveBeenCalled();
  });
});

describe('full and missing syllabus requests', () => {
  it('does not represent the existing bank as a complete approved syllabus', async () => {
    const {page,repository} = fixture();
    page.scopeMode = 'full';
    expect(page.selectedScopes).toEqual([]);
    await page.runCoverage();
    expect(repository.approvedQuestions).not.toHaveBeenCalled();
    expect(page.errorMessage).toMatch(/not yet approved/);
    await page.saveRequest();
    expect(repository.requestPaper).toHaveBeenCalledWith(expect.objectContaining({scopeMode:'full',syllabusResolved:false,subjects:['Science']}),expect.any(Array),'admin-1',expect.any(String));
  });
  it('saves a chapter absent from the bank and keeps its request ID during coverage', async () => {
    const {page,repository} = fixture();
    page.scopeMode = 'custom'; page.customChapters = 'New chapter';
    await page.saveRequest();
    const parent = repository.requestPaper.mock.calls[0];
    expect(parent?.[0]).toMatchObject({scopeMode:'custom',chapterScopes:[{subject:'Science',chapter:'New chapter'}],syllabusResolved:false});
    await page.runCoverage();
    expect(page.requestSaved).toBe(true);
  });
});
