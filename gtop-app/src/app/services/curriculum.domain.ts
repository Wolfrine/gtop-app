/** The published curriculum is independent of question-bank coverage. */
export type AssessmentPurpose = 'summative' | 'formative' | 'both';
export interface CurriculumSource {
  url: string; title: string; year: string; locator: string;
  discoveredAt?: string;
  retrievedAt?: string;
}
export interface CurriculumChapter {
  title: string;
  topics: string[];
  formativeTopics?: string[];
  assessment: AssessmentPurpose;
  /** Explicitly reviewed mappings; never infer equivalent chapters from fuzzy text. */
  bankAliases: { subject: string; chapter: string }[];
  publishedMarks?: number;
}
export interface CurriculumSubject {
  id: string;
  board: string;
  standard: string;
  subject: string;
  academicYear: string;
  examYear: string;
  programme: string;
  sources: CurriculumSource[];
  chapters: CurriculumChapter[];
  completeness: 'incomplete' | 'complete';
  sourceStatus: 'unverified' | 'official-source';
  reviewStatus: 'draft' | 'approved';
  notes: string;
  assessmentNotes?: string;
  revision: number;
  baseVersionId: string;
  versionId?: string;
  approvedBy?: string;
  approvedAt?: unknown;
}
export interface CurriculumCoverageBoard {
  board: string; standards: string[]; sourceUrl: string; note: string;
}
export interface CurriculumSeed {
  academicYear: string; boards: CurriculumCoverageBoard[]; subjects: CurriculumSubject[];
}
export interface LegacyChapter { id?: string; board: string; standard: string; subject: string; chapter: string; mcqCount?: number; }

export function currentAcademicYear(date = new Date()): string {
  const year = date.getUTCFullYear() - (date.getUTCMonth() < 3 ? 1 : 0);
  return `${year}-${String(year + 1).slice(-2)}`;
}
/** Reversible, case-sensitive identities avoid accidental curriculum merges. */
export function curriculumKey(item: Pick<CurriculumSubject, 'board' | 'standard' | 'subject' | 'academicYear'>): string {
  return [item.academicYear, item.board, String(item.standard), item.subject].map(value => encodeURIComponent(value.trim())).join('~');
}
export function emptyCurriculum(board: string, standard: string, subject: string, academicYear: string): CurriculumSubject {
  const value: CurriculumSubject = { id: '', board: board.trim(), standard: String(standard).trim(), subject: subject.trim(), academicYear,
    examYear: '', programme: '', sources: [], chapters: [], completeness: 'incomplete', sourceStatus: 'unverified',
    reviewStatus: 'draft', notes: '', revision: 0, baseVersionId: '' };
  return { ...value, id: curriculumKey(value) };
}
export function legacyDrafts(items: LegacyChapter[], year: string): CurriculumSubject[] {
  const scopes = new Map<string, CurriculumSubject>();
  for (const item of items) {
    const draft = emptyCurriculum(item.board, String(item.standard), item.subject, year);
    const target = scopes.get(draft.id) ?? draft;
    if (!target.chapters.some(chapter => chapter.title === item.chapter)) {
      target.chapters.push({ title: item.chapter, topics: [], assessment: 'both', bankAliases: [] });
    }
    target.notes = 'Imported from the existing question bank. Year, chapter list, topics and assessment scope require official-source verification.';
    scopes.set(draft.id, target);
  }
  return [...scopes.values()];
}
export function curriculumValidation(item: CurriculumSubject): string[] {
  const errors: string[] = [];
  if (!item.board.trim() || !item.standard.trim() || !item.subject.trim()) errors.push('Specify the board, standard and subject.');
  if (!/^\d{4}-\d{2}$/.test(item.academicYear)) errors.push('Use an academic year such as 2026-27.');
  if (item.id !== curriculumKey(item)) errors.push('The subject identity changed. Create a separate subject instead.');
  if (item.sourceStatus !== 'official-source' || !item.sources.length) errors.push('Add and verify an official source.');
  if (item.sources.some(source => !/^https:\/\//i.test(source.url) || !source.title.trim() || !source.year.trim() || !source.locator.trim())) errors.push('Each source needs an HTTPS link, title, applicable year and page or section.');
  if (item.completeness !== 'complete') errors.push('Confirm that all chapters and topics for this subject are included.');
  if (!item.chapters.length || item.chapters.length > 400) errors.push('Include between 1 and 400 chapters.');
  if (item.chapters.some(chapter => !chapter.title.trim() || !chapter.topics.some(topic => topic.trim()) || !['summative','formative','both'].includes(chapter.assessment))) errors.push('Every chapter needs a title, topics and assessment scope.');
  if (new Set(item.chapters.map(chapter => chapter.title.trim().toLocaleLowerCase())).size !== item.chapters.length) errors.push('Remove duplicate chapter titles.');
  if (new TextEncoder().encode(JSON.stringify(item)).length > 700_000) errors.push('This subject exceeds the document size limit. Reduce source excerpts.');
  return errors;
}
export function curriculumDiff(before: CurriculumSubject | undefined, after: CurriculumSubject): { added: string[]; removed: string[]; changed: string[] } {
  const previous = new Map((before?.chapters ?? []).map(chapter => [chapter.title, chapter]));
  const next = new Map(after.chapters.map(chapter => [chapter.title, chapter]));
  return {
    added: [...next.keys()].filter(title => !previous.has(title)),
    removed: [...previous.keys()].filter(title => !next.has(title)),
    changed: [...next.keys()].filter(title => previous.has(title) && JSON.stringify(previous.get(title)) !== JSON.stringify(next.get(title))),
  };
}
export function applicableChapters(item: CurriculumSubject, purpose: AssessmentPurpose): CurriculumChapter[] {
  return item.chapters.filter(chapter => purpose === 'both' || chapter.assessment === 'both' || chapter.assessment === purpose);
}
