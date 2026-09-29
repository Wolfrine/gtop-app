import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  writes: [] as { path: string; data: Record<string, unknown>; mode: 'set' | 'update' }[],
  queries: [] as {
    path: string;
    constraints: { field?: string; value?: unknown; max?: number }[];
  }[],
  beforeTransaction: undefined as undefined | (() => void),
}));

vi.mock('./firebase', () => ({ FirebaseClient: class {} }));
vi.mock('@angular/fire/firestore', () => {
  const snapshot = (path: string) => ({
    id: path.split('/').at(-1)!,
    ref: { path },
    exists: () => memory.documents.has(path),
    data: () => ({ ...memory.documents.get(path) }),
  });
  return {
    collection: vi.fn((_db, path: string) => ({ path })),
    doc: vi.fn((_db, ...parts: string[]) => ({ path: parts.join('/') })),
    where: vi.fn((field: string, _operator: string, value: unknown) => ({ field, value })),
    documentId: vi.fn(() => '__name__'),
    orderBy: vi.fn((field: string) => ({ orderBy: field })),
    startAfter: vi.fn((cursor: string) => ({ cursor })),
    getCountFromServer: vi.fn(async (request) => ({ data: () => ({ count: [...memory.documents.keys()].filter((path) =>
      path.split('/').slice(0, -1).join('/') === request.path && request.constraints.every(
        (constraint: { field?: string; value?: unknown }) => !constraint.field ||
          memory.documents.get(path)?.[constraint.field] === constraint.value,
      )).length }) })),
    limit: vi.fn((max: number) => ({ max })),
    query: vi.fn((ref, ...constraints) => ({ ...ref, constraints })),
    getDocFromServer: vi.fn(async (ref) => snapshot(ref.path)),
    getDocsFromServer: vi.fn(async (request) => {
      memory.queries.push(request);
      const candidates = [...memory.documents.keys()].filter((path) => {
        if (path.split('/').slice(0, -1).join('/') !== request.path) return false;
        return request.constraints.every(
          (constraint: { field?: string; value?: unknown }) =>
            !constraint.field ||
            memory.documents.get(path)?.[constraint.field] === constraint.value,
        );
      });
      const max =
        request.constraints.find((constraint: { max?: number }) => constraint.max)?.max ??
        candidates.length;
      const docs = candidates.slice(0, max).map(snapshot);
      return { docs, size: docs.length, empty: docs.length === 0 };
    }),
    increment: vi.fn((by: number) => ({ operation: 'increment', by })),
    serverTimestamp: vi.fn(() => 'server-time'),
    runTransaction: vi.fn(async (_db, callback) => {
      memory.beforeTransaction?.();
      memory.beforeTransaction = undefined;
      const pending: typeof memory.writes = [];
      const result = await callback({
        get: async (ref: { path: string }) => {
          if (pending.length) throw new Error('Transaction read after write');
          return snapshot(ref.path);
        },
        set: (ref: { path: string }, data: Record<string, unknown>) =>
          pending.push({ path: ref.path, data, mode: 'set' }),
        update: (ref: { path: string }, data: Record<string, unknown>) =>
          pending.push({ path: ref.path, data, mode: 'update' }),
      });
      // Writes are deliberately committed only after every read and validation succeeds.
      for (const write of pending) {
        const previous = memory.documents.get(write.path) ?? {};
        const resolved = Object.fromEntries(
          Object.entries(write.data).map(([key, value]) => {
            const transform = value as { operation?: string; by?: number } | null;
            return [
              key,
              transform?.operation === 'increment'
                ? Number(previous[key] ?? 0) + transform.by!
                : value,
            ];
          }),
        );
        memory.documents.set(
          write.path,
          write.mode === 'update' ? { ...previous, ...resolved } : resolved,
        );
      }
      memory.writes.push(...pending);
      return result;
    }),
  };
});

import { FirebaseClient } from './firebase';
import {
  QuestionReviewRepository,
  reviewErrorMessage,
  toReviewDraft,
  validateReviewEdits,
  type ReviewDraft,
  type ReviewEdits,
} from './question-review.repository';

const scope = { board: 'CBSE', standard: '9', subject: 'Physics', chapter: 'Motion' };
const source = () => ({
  ...scope,
  title: 'Average speed',
  question: 'A cyclist travels 120 m in 20 s. What is the average speed?',
  options: ['4 m/s', '6 m/s', '8 m/s', '10 m/s'],
  correctIndex: 1,
  solutions: ['Average speed = total distance / total time = 120 / 20 = 6 m/s.'],
  questionType: 'numerical',
  difficulty: 'moderate',
  marks: 1,
  reviewStatus: 'pending-admin-review',
  status: 'draft',
  sourceSyllabusId: 'motion-cbse-9',
  createdAt: 'original-time',
  createdBy: 'creator-agent',
  competencyTags: ['application'],
  sourceReferences: ['Teacher-reviewed curriculum'],
  generationBatch: 'batch-1',
});

describe('question review queue and validation', () => {
  let repository: QuestionReviewRepository;
  beforeEach(() => {
    memory.documents.clear();
    memory.writes.length = 0;
    memory.queries.length = 0;
    memory.beforeTransaction = undefined;
    repository = new QuestionReviewRepository({ firestore: {} } as FirebaseClient);
  });

  it('returns only pending drafts and an honest overflow indicator', async () => {
    memory.documents.set('devQuestions/a', source());
    memory.documents.set('devQuestions/b', source());
    memory.documents.set('devQuestions/c', source());
    memory.documents.set('devQuestions/already-reviewed', {
      ...source(),
      reviewStatus: 'approved',
    });
    const result = await repository.pending(2);
    expect(result.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.truncated).toBe(true);
    expect(memory.queries[0].constraints).toContainEqual({ max: 3 });
    expect((await repository.pending(3)).truncated).toBe(false);
  });

  it('clamps excessive queue limits and handles invalid limits', async () => {
    expect((await repository.pending(10000)).limit).toBe(100);
    expect((await repository.pending(Number.NaN)).limit).toBe(50);
  });

  it('keeps blank option positions so the answer index cannot silently change', () => {
    const draft = toReviewDraft('a', {
      ...source(),
      options: ['First', '', 'Third'],
      correctIndex: 2,
    });
    expect(draft.options).toEqual(['First', '', 'Third']);
    expect(draft.correctIndex).toBe(2);
    expect(validateReviewEdits(draft, draft)).toContain('Every answer option');
  });

  it('blocks written answers and missing explanations from the learner bank', () => {
    const draft = toReviewDraft('a', source());
    expect(validateReviewEdits(draft, { ...draft, options: [] })).toContain(
      'submitted as a written-answer',
    );
    expect(validateReviewEdits(draft, { ...draft, solutions: [] })).toContain('explanation');
    expect(validateReviewEdits(draft, { ...draft, correctIndex: 4 })).toContain('correct answer');
    expect(
      validateReviewEdits(draft, { ...draft, options: ['Same answer', ' same  answer '] }),
    ).toContain('distinct');
  });

  it('allows paper-only written answers and still requires options for objective types', () => {
    const raw = { ...source(), options: [], correctIndex: -1 };
    const draft = toReviewDraft('written', raw);
    expect(draft.paperOnly).toBe(true);
    expect(validateReviewEdits(draft, draft)).toBe('');
    expect(validateReviewEdits({ ...draft, questionType: 'mcq' }, draft)).toContain('needs answer options');
    expect(validateReviewEdits({ ...draft, paperOnly: false }, draft)).toContain('submitted as a written-answer');
  });

  it('requires a visible asset for a diagram-based question', () => {
    const draft = toReviewDraft('a', { ...source(), questionType: 'diagram_based' });
    expect(validateReviewEdits(draft, draft)).toContain('diagram or graph');
  });

  it('provides actionable permission and network errors', () => {
    expect(reviewErrorMessage({ code: 'permission-denied' })).toContain('admin account');
    expect(reviewErrorMessage({ code: 'unavailable' })).toContain('retry');
  });
});

describe('atomic question approval and rejection', () => {
  let repository: QuestionReviewRepository;
  let draft: ReviewDraft;
  let edits: ReviewEdits;
  beforeEach(() => {
    memory.documents.clear();
    memory.writes.length = 0;
    memory.queries.length = 0;
    memory.beforeTransaction = undefined;
    memory.documents.set('devQuestions/draft-1', source());
    memory.documents.set('syllabus/motion-cbse-9', { ...scope, mcqCount: 7 });
    repository = new QuestionReviewRepository({ firestore: {} } as FirebaseClient);
    draft = toReviewDraft('draft-1', source());
    edits = { ...draft, options: [...draft.options], solutions: [...draft.solutions] };
  });

  it('publishes reviewed edits, preserves creator metadata, and increments the exact source chapter once', async () => {
    edits.title = '  Reviewed average speed  ';
    edits.solutions = ['Speed = distance / time, so 120 m / 20 s = 6 m/s.'];
    const result = await repository.approve(draft, edits, 'admin-1', 'Calculation checked.');
    expect(result).toEqual({ questionId: 'draft-1', alreadyApproved: false });
    const published = memory.documents.get('questions/draft-1');
    expect(published).toMatchObject({
      ...scope,
      title: 'Reviewed average speed',
      correctIndex: 1,
      options: source().options,
      solutions: edits.solutions,
      createdAt: 'original-time',
      createdBy: 'creator-agent',
      generationBatch: 'batch-1',
      competencyTags: ['application'],
      reviewStatus: 'approved',
      status: 'approved',
      reviewedBy: 'admin-1',
      reviewedAt: 'server-time',
      sourceDraftId: 'draft-1',
      sourceSyllabusId: 'motion-cbse-9',
    });
    expect(published?.['id']).toBeUndefined();
    expect(memory.documents.get('syllabus/motion-cbse-9')?.['mcqCount']).toBe(8);
    expect(memory.documents.get('devQuestions/draft-1')).toMatchObject({
      reviewStatus: 'approved',
      title: 'Reviewed average speed',
      reviewNotes: 'Calculation checked.',
    });
    expect(memory.writes.map((write) => write.path)).toEqual([
      'questions/draft-1',
      'syllabus/motion-cbse-9',
      'devQuestions/draft-1',
    ]);
  });

  it('approves written answers for papers without writing to the learner bank or MCQ count', async () => {
    const written = {
      ...source(), options: [], correctIndex: -1, questionType: 'short_answer',
    };
    memory.documents.set('devQuestions/draft-1', written);
    draft = toReviewDraft('draft-1', written);
    edits = { ...draft, question: '  Explain the average speed calculation.  ' };
    expect(await repository.approve(draft, edits, 'admin-1')).toEqual({
      questionId: 'draft-1', alreadyApproved: false,
    });
    expect(memory.documents.get('devQuestions/draft-1')).toMatchObject({
      paperOnly: true, reviewStatus: 'approved-paper-only', status: 'approved',
      question: 'Explain the average speed calculation.', reviewedBy: 'admin-1',
    });
    expect(memory.documents.has('questions/draft-1')).toBe(false);
    expect(memory.documents.get('syllabus/motion-cbse-9')?.['mcqCount']).toBe(7);
    expect(memory.writes.map((write) => write.path)).toEqual(['devQuestions/draft-1']);

    memory.writes.length = 0;
    expect(await repository.approve(draft, edits, 'admin-2')).toEqual({
      questionId: 'draft-1', alreadyApproved: true,
    });
    expect(memory.writes).toEqual([]);
  });

  it('blocks duplicate wording across paper-only and quiz questions', async () => {
    const written = {
      ...source(), paperOnly: true, options: [], correctIndex: -1, questionType: 'short_answer',
    };
    memory.documents.set('devQuestions/draft-1', written);
    draft = toReviewDraft('draft-1', written);
    edits = { ...draft };
    memory.documents.set('devQuestions/older-paper-question', {
      ...written, reviewStatus: 'approved-paper-only', status: 'approved',
    });
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow(
      'wording already exists',
    );
    expect(memory.writes).toEqual([]);
  });

  it('does not republish or increment the count on a repeated approval', async () => {
    await repository.approve(draft, edits, 'admin-1');
    const approved = memory.documents.get('questions/draft-1');
    memory.writes.length = 0;
    edits.title = 'A different reviewer’s unsaved title';
    expect(await repository.approve(draft, edits, 'admin-2')).toEqual({
      questionId: 'draft-1',
      alreadyApproved: true,
    });
    expect(memory.documents.get('questions/draft-1')).toEqual(approved);
    expect(memory.documents.get('syllabus/motion-cbse-9')?.['mcqCount']).toBe(8);
    expect(memory.writes).toEqual([]);
  });

  it('never overwrites a different bank question with the same ID', async () => {
    const existing = {
      ...source(),
      question: 'An unrelated published question',
      sourceDraftId: 'different-draft',
    };
    memory.documents.set('questions/draft-1', existing);
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow(
      'Nothing was overwritten',
    );
    expect(memory.documents.get('questions/draft-1')).toEqual(existing);
    expect(memory.writes).toEqual([]);
  });

  it('blocks duplicate wording in the same chapter before publishing', async () => {
    memory.documents.set('questions/older-question', { ...source(), status: 'approved' });
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow(
      'wording already exists',
    );
    expect(
      memory.queries.find((request) => request.path === 'questions')?.constraints,
    ).toContainEqual({ max: 2 });
    expect(memory.writes).toEqual([]);
  });

  it('does not treat an identical question in a different curriculum as a duplicate', async () => {
    memory.documents.set('questions/another-board', { ...source(), board: 'ICSE' });
    await expect(repository.approve(draft, edits, 'admin-1')).resolves.toMatchObject({
      alreadyApproved: false,
    });
  });

  it('resolves the unique exact curriculum when a draft has no source chapter ID', async () => {
    const withoutLink = { ...source(), sourceSyllabusId: '' };
    memory.documents.set('devQuestions/draft-1', withoutLink);
    draft = toReviewDraft('draft-1', withoutLink);
    await repository.approve(draft, edits, 'admin-1');
    expect(memory.documents.get('questions/draft-1')?.['sourceSyllabusId']).toBe('motion-cbse-9');
    expect(memory.documents.get('syllabus/motion-cbse-9')?.['mcqCount']).toBe(8);
  });

  it('refuses ambiguous curriculum resolution instead of counting an arbitrary chapter', async () => {
    const withoutLink = { ...source(), sourceSyllabusId: '' };
    memory.documents.set('devQuestions/draft-1', withoutLink);
    memory.documents.set('syllabus/duplicate-chapter', { ...scope, mcqCount: 4 });
    draft = toReviewDraft('draft-1', withoutLink);
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow(
      'More than one chapter',
    );
    expect(memory.writes).toEqual([]);
  });

  it('validates the linked syllabus scope inside the transaction', async () => {
    memory.beforeTransaction = () =>
      memory.documents.set('syllabus/motion-cbse-9', { ...scope, standard: '10', mcqCount: 7 });
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow('does not match');
    expect(memory.documents.has('questions/draft-1')).toBe(false);
    expect(memory.documents.get('devQuestions/draft-1')?.['reviewStatus']).toBe(
      'pending-admin-review',
    );
    expect(memory.writes).toEqual([]);
  });

  it('rejects a paper question whose approved syllabus version belongs to another year', async () => {
    const current = { ...source(), academicYear: '2026-27', curriculumVersionId: 'v1', assessmentPurpose: 'summative' };
    memory.documents.set('devQuestions/draft-1', current);
    memory.documents.set('curriculumVersions/v1', {
      ...scope, academicYear: '2025-26', reviewStatus: 'approved',
      chapters: [{ title: 'Motion', assessment: 'both' }],
    });
    draft = toReviewDraft('draft-1', current);
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow('approved syllabus version');
    expect(memory.writes).toEqual([]);
  });

  it('keeps formative-only chapters out of summative question approvals', async () => {
    const current = { ...source(), academicYear: '2026-27', curriculumVersionId: 'v1', assessmentPurpose: 'summative' };
    memory.documents.set('devQuestions/draft-1', current);
    memory.documents.set('curriculumVersions/v1', {
      ...scope, academicYear: '2026-27', reviewStatus: 'approved',
      chapters: [{ title: 'Motion', assessment: 'formative' }],
    });
    draft = toReviewDraft('draft-1', current);
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow('assessment scope');
    expect(memory.writes).toEqual([]);
    current.assessmentPurpose = 'formative';
    memory.documents.set('devQuestions/draft-1', current);
    draft = toReviewDraft('draft-1', current);
    await repository.approve(draft, edits, 'admin-1');
    expect(memory.documents.get('questions/draft-1')).toMatchObject({
      academicYear: '2026-27', curriculumVersionId: 'v1', assessmentPurpose: 'formative',
    });
  });

  it('rejects a concurrent syllabus-version change instead of approving unseen metadata', async () => {
    memory.beforeTransaction = () => memory.documents.set('devQuestions/draft-1', {
      ...source(), academicYear: '2026-27', curriculumVersionId: 'unseen-version', assessmentPurpose: 'summative',
    });
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow('changed while you were reviewing');
    expect(memory.writes).toEqual([]);
  });

  it('refuses stale edits if a creator changes the draft while approval is being prepared', async () => {
    memory.beforeTransaction = () =>
      memory.documents.set('devQuestions/draft-1', { ...source(), correctIndex: 2 });
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow(
      'changed while you were reviewing',
    );
    expect(memory.writes).toEqual([]);
  });

  it('refuses approval after another reviewer rejects the draft', async () => {
    memory.beforeTransaction = () =>
      memory.documents.set('devQuestions/draft-1', { ...source(), reviewStatus: 'rejected' });
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow('already handled');
    expect(memory.writes).toEqual([]);
  });

  it('does not reset or corrupt a malformed existing chapter total', async () => {
    memory.documents.set('syllabus/motion-cbse-9', { ...scope, mcqCount: '7' });
    await expect(repository.approve(draft, edits, 'admin-1')).rejects.toThrow(
      'total needs correction',
    );
    expect(memory.writes).toEqual([]);
  });

  it('requires a rejection note and never changes the live bank or count on rejection', async () => {
    await expect(repository.reject(draft, 'admin-1', ' ')).rejects.toThrow('review note');
    await repository.reject(draft, 'admin-1', '  Add units to the explanation.  ');
    expect(memory.documents.get('devQuestions/draft-1')).toMatchObject({
      question: source().question,
      options: source().options,
      reviewStatus: 'rejected',
      reviewNotes: 'Add units to the explanation.',
      reviewedBy: 'admin-1',
      reviewedAt: 'server-time',
    });
    expect(memory.documents.has('questions/draft-1')).toBe(false);
    expect(memory.documents.get('syllabus/motion-cbse-9')?.['mcqCount']).toBe(7);
    expect(memory.writes.map((write) => write.path)).toEqual(['devQuestions/draft-1']);
  });

  it('rejects missing actors and invalid IDs before making any writes', async () => {
    await expect(repository.approve(draft, edits, '', '')).rejects.toThrow('Sign in again');
    await expect(repository.reject({ ...draft, id: 'bad/path' }, 'admin-1', 'Fix')).rejects.toThrow(
      'invalid reference',
    );
    expect(memory.writes).toEqual([]);
  });
});
