import type { ParamMap } from '@angular/router';
import { normalizePracticeBoard } from './practice-context';

export interface PracticeScope { board: string; standard: string; subject: string; chapter: string; }
export interface ReviewedPractice { scope: PracticeScope; questionIds: readonly string[]; revision: string; reviewEvidence: string; contentHashes: Readonly<Record<string, string>>; }
export interface PracticeCue { scope: PracticeScope; revision: string; dueAt: number; }
export const PRACTICE_DELAY = 24 * 60 * 60 * 1000;
const fields = ['board', 'standard', 'subject', 'chapter'] as const;
const label = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);

/** getAll handles scalar and repeated Angular query values without a string-to-array cast. */
export function parsePracticeScope(params: Pick<ParamMap, 'getAll'>): PracticeScope | null {
  const keys = ['board', 'standard', 'subjects', 'chapters', 'count'];
  const values = keys.map(key => params.getAll(key));
  if (values.some(value => value.length !== 1) || String(values[4][0]) !== '5') return null;
  const scope = { board: values[0][0], standard: values[1][0], subject: values[2][0], chapter: values[3][0] };
  return fields.every(key => label(scope[key])) ? scope : null;
}
export function practiceParams(scope: PracticeScope) {
  return { board: scope.board, standard: scope.standard, subjects: [scope.subject], chapters: [scope.chapter], count: 5 };
}
/** Shareable invitation returns may name only these local destinations, without nested URLs. */
export function practiceReturns(params: Pick<ParamMap, 'getAll'>): { returnTo?: string; hubReturnPath?: string } {
  const allowed = new Set(['/', '/dashboard', '/reports', '/profile', '/practice', '/admin']);
  const result: { returnTo?: string; hubReturnPath?: string } = {};
  for (const key of ['returnTo', 'hubReturnPath'] as const) {
    const values = params.getAll(key);
    if (values.length === 1 && allowed.has(values[0])) result[key] = values[0];
  }
  return result;
}
export function sameScope(a: PracticeScope, b: PracticeScope): boolean { return !!a && !!b && fields.every(key => a[key] === b[key]); }
export function matchesProfile(scope: PracticeScope, profile: any): boolean {
  return !!scope && !!profile?.uid && (profile.role === 'admin' || (normalizePracticeBoard(profile.board) === normalizePracticeBoard(scope.board) && String(profile.standard ?? '').trim() === scope.standard));
}
export function reviewedPractice(scope: PracticeScope, seeds: readonly ReviewedPractice[]): ReviewedPractice | null {
  const seed = seeds.find(item => sameScope(scope, item.scope));
  return seed && seed.questionIds.length === 5 && new Set(seed.questionIds).size === 5 && seed.questionIds.every(id => label(id) && !id.includes('/') && /^[a-f0-9]{64}$/.test(seed.contentHashes[id])) && label(seed.revision) && label(seed.reviewEvidence) ? seed : null;
}
/** Review proves relevance; runtime checks protect against missing, changed or unusable documents. */
export function validatePracticeQuestions(seed: ReviewedPractice, questions: any[]): boolean {
  if (!Array.isArray(questions) || questions.some(q => !q || typeof q !== 'object')) return false;
  return questions.length === 5 && new Set(questions.map(q => q.id)).size === 5 && seed.questionIds.every(id => questions.some(q => q.id === id)) && questions.every(q =>
    sameScope(q, seed.scope) && (!q.status || q.status === 'approved') && !q.paperOnly && (!q.questionType || q.questionType === 'mcq') &&
    typeof q.question === 'string' && q.question.trim().length > 0 && Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 4 && q.options.every((option: unknown) => typeof option === 'string' && option.trim().length > 0) &&
    Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length &&
    Array.isArray(q.solutions) && typeof q.solutions[q.correctIndex] === 'string' && q.solutions[q.correctIndex].trim().length > 0);
}
export async function matchesReviewedContent(seed: ReviewedPractice, questions: any[]): Promise<boolean> {
  if (!validatePracticeQuestions(seed, questions)) return false;
  const checks = await Promise.all(questions.map(async q => {
    const bytes = new TextEncoder().encode(JSON.stringify([q.board, q.standard, q.subject, q.chapter, q.question, q.options, q.correctIndex, q.solutions]));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') === seed.contentHashes[q.id];
  }));
  return checks.every(Boolean);
}
export function validCue(value: any): value is PracticeCue {
  return value && fields.every(key => label(value.scope?.[key])) && label(value.revision) && Number.isFinite(value.dueAt) && value.dueAt > 0;
}
