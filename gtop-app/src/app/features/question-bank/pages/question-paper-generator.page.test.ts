import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
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
    recentDrafts: vi.fn(async () => []), createPriorityItems: vi.fn(async () => 1),
  };
  const page = new QuestionPaperGeneratorPage(repository as unknown as QuestionPaperRepository,
    { profile: () => ({ uid: 'admin-1' }) } as unknown as AuthService,
    { markForCheck: vi.fn() } as unknown as ChangeDetectorRef);
  page.syllabus = [{ id: 'light', board: 'CBSE', standard: '10', subject: 'Science', chapter: 'Light', mcqCount: 1 }];
  page.board = 'CBSE'; page.standard = '10'; page.subjects = ['Science'];
  page.chapters = [chapterKey({ subject: 'Science', chapter: 'Light' })];
  page.marks = 1; page.onMarksChange();
  return { page, repository, bank };
}

describe('paper setup state safety', () => {
  it('checks, previews and persists the same complete allocation', async () => {
    const { page, repository } = fixture();
    await page.runCoverage(); await page.generateDraft(); await page.saveDraft();
    expect(repository.approvedQuestions).toHaveBeenCalledWith('CBSE', '10', [{ subject: 'Science', chapter: 'Light' }]);
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
