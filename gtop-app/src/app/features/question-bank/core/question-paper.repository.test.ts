import { describe, expect, it, vi } from 'vitest';

const documents = vi.hoisted(() => new Map<string, Record<string, unknown>>());

vi.mock('./firebase', () => ({ FirebaseClient: class {} }));
vi.mock('../../../services/syllabus.service', () => ({ SyllabusService: class {} }));
vi.mock('../../../services/firestore-read.service', () => ({ FirestoreReadService: class {} }));
vi.mock('@angular/fire/firestore', () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  where: vi.fn((field: string, operator: string, value: unknown) => ({ field, value, operator })),
  limit: vi.fn((max: number) => ({ max })),
  query: vi.fn((ref, ...constraints) => ({ ...ref, constraints })),
  getDocsFromServer: vi.fn(async (request) => {
    const matching = [...documents.entries()].filter(([path, data]) =>
      path.startsWith(request.path + '/') &&
      request.constraints.every((constraint: { field?: string; value?: unknown; operator?: string }) =>
        !constraint.field || (constraint.operator === 'in' ? (constraint.value as unknown[]).includes(data[constraint.field]) : data[constraint.field] === constraint.value)));
    return {
      docs: matching.map(([path, data]) => ({
        id: path.split('/').at(-1)!, data: () => data,
      })),
      size: matching.length,
    };
  }),
}));

import { FirebaseClient } from './firebase';
import { buildGenerationRules, QuestionPaperRepository } from './question-paper.repository';

const scope = { board: 'CBSE', standard: '9', subject: 'Physics', chapter: 'Motion' };
const base = {
  ...scope, question: 'Explain speed.', solutions: ['Distance divided by time.'],
  options: [], correctIndex: -1, questionType: 'short_answer', status: 'approved',
};

describe('approved paper question sources', () => {
  it('includes only approved paper-only drafts alongside published quiz questions', async () => {
    documents.clear();
    documents.set('questions/quiz', {
      ...base, question: 'What is speed?', options: ['distance/time', 'time/distance'],
      correctIndex: 0, questionType: 'mcq',
    });
    documents.set('devQuestions/written-approved', {
      ...base, paperOnly: true, reviewStatus: 'approved-paper-only',
    });
    documents.set('devQuestions/written-pending', {
      ...base, paperOnly: true, reviewStatus: 'pending-admin-review',
    });
    documents.set('devQuestions/not-paper-only', {
      ...base, paperOnly: false, reviewStatus: 'approved-paper-only',
    });
    documents.set('devQuestions/another-chapter', {
      ...base, chapter: 'Force', paperOnly: true, reviewStatus: 'approved-paper-only',
    });
    const repository = new QuestionPaperRepository({ firestore: {} } as FirebaseClient, {} as any, {} as any);
    const result = await repository.approvedQuestions('CBSE', '9', [
      { subject: 'Physics', chapter: 'Motion' },
    ]);
    expect(result.questions.map((question) => question.id).sort()).toEqual([
      'quiz', 'written-approved',
    ]);
    expect(result.truncatedScopes).toEqual([]);
  });
});



describe('paper request section consistency', () => {
  it('rejects conflicting totals before writing even when syllabus resolution is pending', async () => {
    const repository = new QuestionPaperRepository({firestore:{}} as FirebaseClient, {} as any, {} as any);
    const rules = buildGenerationRules({id:'competency_based_paper'}, ['Science']);
    await expect(repository.requestPaper({title:'Requested paper', board:'CBSE', standard:'10', subjects:['Science'], chapters:[], chapterScopes:[], scopeMode:'full', syllabusResolved:false, academicYear:'2026-27', marks:5, durationMinutes:60, templateId:'competency_based_paper', templateName:'Competency', negativeMarking:0}, rules, 'admin-user', 'request-1')).rejects.toThrow(/section marks must add up/);
  });
});
