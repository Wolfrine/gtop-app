import { PracticeScope, ReviewedPractice, matchesProfile, matchesReviewedContent, sameScope } from './practice-invite.domain';

/** Implement with PR57's existing presentation helpers; no second shuffle/scoring implementation. */
export interface InvitationPresentation {
  presentQuestion(question: any): any;
  restorePresentation(question: any, order: unknown, selectedIndex: number | null, correctIndex: number): any;
  validOrder(order: unknown, length: number): boolean;
  canonicalIndex(question: any, index: number | null): number | null;
}
export interface InvitationAttempt {
  version: 1; uid: string; role: string; attemptId: string;
  entryType: 'invitation' | 'invitation-retry'; parentAttemptId?: string;
  scope: PracticeScope; revision: string; questionIds: string[]; contentHashes: Record<string, string>;
  snapshots: any[]; questions: any[]; currentQuestionIndex: number;
  firstAnswer: boolean; completed: boolean; acknowledgedReceipt?: string;
  offerDecision: 'pending' | 'dismissed' | 'kept';
  returnTo?: string; hubReturnPath?: string; returnCueDueAt?: number;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const content = (q: any) => [q.id, q.board, q.standard, q.subject, q.chapter, q.question, q.options, q.correctIndex, q.solutions];
export const invitationStorageKey = (uid: string) => 'gtop.practice-invitation-session.v1.' + uid;
export const invitationReceiptId = (uid: string, attemptId: string) => `attempt-${encodeURIComponent(uid)}:${encodeURIComponent(attemptId)}`;

function validPresentation(attempt: InvitationAttempt, questions: any[], presentation: InvitationPresentation): boolean {
  return questions.length === 5 && questions.every((q, i) => {
    const source = attempt.snapshots[i];
    if (!q || !source || q.id !== source.id || !sameScope(q, attempt.scope) || !presentation.validOrder(q.optionOrder, source.options.length) ||
      !(q.selectedIndex === null || (Number.isInteger(q.selectedIndex) && q.selectedIndex >= 0 && q.selectedIndex < q.options.length))) return false;
    const expected = presentation.restorePresentation(source, q.optionOrder, presentation.canonicalIndex(q, q.selectedIndex), source.correctIndex);
    return JSON.stringify(content(q)) === JSON.stringify(content(expected));
  });
}
export async function createInvitationAttempt(profile: any, seed: ReviewedPractice, sources: any[], presentation: InvitationPresentation,
  attemptId: string, previous?: InvitationAttempt): Promise<InvitationAttempt> {
  if (!matchesProfile(seed.scope, profile) || !attemptId || !await matchesReviewedContent(seed, sources)) throw new Error('practice-unavailable');
  if (previous && (previous.uid !== profile.uid || !previous.acknowledgedReceipt || !sameScope(previous.scope, seed.scope))) throw new Error('practice-retry-unavailable');
  // Whitelist immutable content: no personal fields or bank timestamps enter the snapshot.
  const snapshots = seed.questionIds.map(id => {
    const q = sources.find(item => item.id === id);
    return clone({ id: q.id, board: q.board, standard: q.standard, subject: q.subject, chapter: q.chapter,
      question: q.question, options: q.options, correctIndex: q.correctIndex, solutions: q.solutions, selectedIndex: null });
  });
  const attempt: InvitationAttempt = { version: 1, uid: profile.uid, role: profile.role || 'user', attemptId,
    entryType: previous ? 'invitation-retry' : 'invitation', ...(previous ? { parentAttemptId: previous.attemptId } : {}),
    scope: clone(seed.scope), revision: seed.revision, questionIds: [...seed.questionIds], contentHashes: { ...seed.contentHashes },
    snapshots, questions: snapshots.map(q => presentation.presentQuestion(clone(q))), currentQuestionIndex: 0,
    firstAnswer: false, completed: false, offerDecision: 'pending' };
  if (!validPresentation(attempt, attempt.questions, presentation)) throw new Error('practice-presentation-unavailable');
  return attempt;
}
export async function restoreInvitationAttempt(value: any, profile: any, seed: ReviewedPractice, presentation: InvitationPresentation): Promise<InvitationAttempt | null> {
  if (!value || value.version !== 1 || value.uid !== profile?.uid || value.role !== (profile?.role || 'user') || !matchesProfile(seed.scope, profile) ||
    typeof value.attemptId !== 'string' || !value.attemptId || !['invitation', 'invitation-retry'].includes(value.entryType) ||
    value.revision !== seed.revision || !sameScope(value.scope || {}, seed.scope) || JSON.stringify(value.questionIds) !== JSON.stringify(seed.questionIds) ||
    seed.questionIds.some(id => value.contentHashes?.[id] !== seed.contentHashes[id]) || !Array.isArray(value.snapshots) || JSON.stringify(value.snapshots.map((q: any) => q?.id)) !== JSON.stringify(seed.questionIds) || !Array.isArray(value.questions) ||
    !Number.isInteger(value.currentQuestionIndex) || value.currentQuestionIndex < 0 || value.currentQuestionIndex >= 5 ||
    typeof value.completed !== 'boolean' || typeof value.firstAnswer !== 'boolean' || !['pending', 'dismissed', 'kept'].includes(value.offerDecision) ||
    (value.acknowledgedReceipt && value.acknowledgedReceipt !== invitationReceiptId(profile.uid, value.attemptId)) ||
    !await matchesReviewedContent(seed, value.snapshots) || !validPresentation(value, value.questions, presentation) ||
    value.firstAnswer !== value.questions.some((q: any) => q.selectedIndex !== null) ||
    (value.completed && value.questions.some((q: any) => q.selectedIndex === null)) || (value.acknowledgedReceipt && !value.completed)) return null;
  // Restore exactly the recorded order/answers; do not call presentQuestion or fetch current bank content.
  return clone(value);
}
export function checkpointInvitation(attempt: InvitationAttempt, attemptId: string, questions: any[], currentQuestionIndex: number,
  presentation: InvitationPresentation, completed = false): InvitationAttempt | null {
  if (attempt.attemptId !== attemptId || attempt.acknowledgedReceipt || attempt.completed || !Number.isInteger(currentQuestionIndex) ||
    currentQuestionIndex < 0 || currentQuestionIndex >= 5 || !validPresentation(attempt, questions, presentation) ||
    questions.some((q, i) => JSON.stringify(q.optionOrder) !== JSON.stringify(attempt.questions[i].optionOrder)) ||
    (completed && questions.some(q => q.selectedIndex === null))) return null;
  return { ...attempt, questions: clone(questions), currentQuestionIndex, completed,
    firstAnswer: attempt.firstAnswer || questions.some(q => q.selectedIndex !== null) };
}
/** Private QuizResults payload for the generic acknowledged-save interface; never send to analytics. */
export function invitationResult(attempt: InvitationAttempt, presentation: InvitationPresentation) {
  if (!attempt.completed || !attempt.firstAnswer || !validPresentation(attempt, attempt.questions, presentation)) throw new Error('practice-result-unavailable');
  return clone({ version: 1, attemptId: attempt.attemptId, entryType: attempt.entryType,
    ...(attempt.parentAttemptId ? { parentAttemptId: attempt.parentAttemptId } : {}), scope: attempt.scope, revision: attempt.revision,
    questionIds: attempt.questionIds, contentHashes: attempt.contentHashes, snapshots: attempt.snapshots,
    answers: attempt.questions.map(q => ({ questionId: q.id, optionOrder: [...q.optionOrder],
      selectedIndex: presentation.canonicalIndex(q, q.selectedIndex), correctIndex: presentation.canonicalIndex(q, q.correctIndex) })) });
}
/** History uses the acknowledged immutable snapshots, even if the source bank was edited later. */
export async function invitationHistory(result: any, seed: ReviewedPractice, presentation: InvitationPresentation): Promise<any[] | null> {
  if (!result || result.version !== 1 || result.revision !== seed.revision || !sameScope(result.scope || {}, seed.scope) ||
    !['invitation', 'invitation-retry'].includes(result.entryType) || !result.attemptId ||
    JSON.stringify(result.questionIds) !== JSON.stringify(seed.questionIds) || seed.questionIds.some(id => result.contentHashes?.[id] !== seed.contentHashes[id]) || !Array.isArray(result.answers) || result.answers.length !== 5 ||
    !Array.isArray(result.snapshots) || JSON.stringify(result.snapshots.map((q: any) => q?.id)) !== JSON.stringify(seed.questionIds) || !await matchesReviewedContent(seed, result.snapshots)) return null;
  const questions = result.snapshots.map((source: any, i: number) => {
    const answer = result.answers[i];
    if (!answer || answer.questionId !== source.id || answer.correctIndex !== source.correctIndex || !presentation.validOrder(answer.optionOrder, source.options.length) ||
      !Number.isInteger(answer.selectedIndex) || answer.selectedIndex < 0 || answer.selectedIndex >= source.options.length) return null;
    return presentation.restorePresentation(source, answer.optionOrder, answer.selectedIndex, source.correctIndex);
  });
  return questions.every(Boolean) ? questions : null;
}
