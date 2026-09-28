import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
} from '@angular/fire/firestore';
import { FirebaseClient } from './firebase';
import { normalizeQuestion, scopeValue, textValue, type PaperAsset } from './question-paper.domain';

export interface ReviewEdits {
  title: string;
  question: string;
  options: string[];
  correctIndex: number;
  solutions: string[];
}

export interface ReviewDraft extends ReviewEdits {
  id: string;
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  questionType: string;
  difficulty: string;
  assets: PaperAsset[];
  sourceSyllabusId: string;
  sourceTemplateId: string;
  contentPurpose: string;
  reviewNotes: string;
  paperOnly: boolean;
  sourcePriorityId: string;
  agentRunId: string;
  marks: number;
  levelJustification: string;
  referenceUsed: string;
  referenceConfidence: number;
  boardStandardMatched: boolean | null;
  priorityStatus: string;
  priorityBlocker: string;
  version: string;
  academicYear?: string;
  assessmentPurpose?: string;
  curriculumVersionId?: string;
}

export interface ReviewQueue {
  items: ReviewDraft[];
  truncated: boolean;
  limit: number;
  nextCursor: string | null;
  total: number;
}

export type ApprovalResult = { questionId: string; alreadyApproved: boolean };

const scopeFields = ['board', 'standard', 'subject', 'chapter'] as const;
const pendingStatus = 'pending-admin-review';

// A content revision also detects concurrent edits by older creators that omit updatedAt.
// Unedited metadata is copied from the transaction's fresh snapshot, not from the UI.
export function reviewVersion(raw: Record<string, unknown>): string {
  return JSON.stringify([
    raw['reviewStatus'],
    ...scopeFields.map((field) => raw[field]),
    raw['sourceSyllabusId'],
    raw['academicYear'], raw['assessmentPurpose'], raw['curriculumVersionId'], raw['parentRequestId'],
    raw['title'],
    raw['question'],
    raw['options'],
    raw['correctIndex'],
    raw['solutions'],
    raw['answer'],
    raw['questionType'],
    raw['type'],
    raw['difficulty'],
    raw['assets'],
    raw['imageUrl'],
    raw['diagramUrl'],
    raw['marks'],
    raw['paperOnly'],
    raw['updatedAt'],
  ]);
}

export function toReviewDraft(id: string, raw: Record<string, unknown>): ReviewDraft {
  const normalized = normalizeQuestion(id, raw);
  return {
    id,
    board: normalized.board,
    standard: normalized.standard,
    subject: normalized.subject,
    chapter: normalized.chapter,
    title: normalized.title,
    question: normalized.question,
    // Keep blanks in position: filtering them would silently move the answer index.
    options: Array.isArray(raw['options']) ? raw['options'].map(textValue) : [],
    correctIndex: normalized.correctIndex,
    solutions: Array.isArray(raw['solutions'])
      ? raw['solutions'].map(textValue)
      : typeof raw['answer'] === 'string'
        ? [raw['answer']]
        : normalized.solutions,
    questionType: normalized.questionType,
    difficulty: normalized.difficulty,
    assets: normalized.assets,
    sourceSyllabusId: textValue(raw['sourceSyllabusId']),
    academicYear: textValue(raw['academicYear']), assessmentPurpose: textValue(raw['assessmentPurpose']), curriculumVersionId: textValue(raw['curriculumVersionId']),
    sourceTemplateId: textValue(raw['sourceTemplateId']),
    contentPurpose: textValue(raw['contentPurpose']),
    reviewNotes: textValue(raw['reviewNotes']),
    paperOnly: raw['paperOnly'] === true ||
      (normalized.options.length === 0 &&
        !['mcq', 'assertion_reason', 'statement_based'].includes(normalized.questionType)),
    sourcePriorityId: textValue(raw['sourcePriorityId']),
    agentRunId: textValue(raw['agentRunId']),
    marks: Number(raw['marks']) || 0,
    levelJustification: textValue(raw['levelJustification']),
    referenceUsed: textValue(raw['referenceUsed']),
    referenceConfidence: Number(raw['referenceConfidence']) || 0,
    boardStandardMatched: typeof raw['boardStandardCheck'] === 'object' && raw['boardStandardCheck'] !== null &&
      typeof (raw['boardStandardCheck'] as Record<string, unknown>)['matched'] === 'boolean'
      ? (raw['boardStandardCheck'] as { matched: boolean }).matched : null,
    priorityStatus: '',
    priorityBlocker: '',
    version: reviewVersion(raw),
  };
}

export function validateReviewEdits(draft: ReviewDraft, edits: ReviewEdits): string {
  if (scopeFields.some((field) => !draft[field]))
    return 'This question has an incomplete syllabus. Ask its creator to correct the curriculum before approval.';
  if (!edits.question.trim()) return 'Enter the question before approving.';
  if (edits.question.length > 20_000 || edits.title.length > 500)
    return 'Shorten the question or title before approving.';
  if (edits.options.length === 0) {
    if (['mcq', 'assertion_reason', 'statement_based'].includes(draft.questionType))
      return 'This objective question needs answer options and a correct answer.';
    if (!draft.paperOnly)
      return 'This draft must be submitted as a written-answer question before approval.';
  } else {
    if (edits.options.length < 2 || edits.options.length > 10)
      return 'Use between 2 and 10 answer options.';
    if (edits.options.some((option) => !option.trim() || option.length > 3000))
      return 'Every answer option needs text of at most 3,000 characters.';
    if (new Set(edits.options.map(scopeValue)).size !== edits.options.length)
      return 'Answer options must be distinct.';
    if (
      !Number.isInteger(edits.correctIndex) ||
      edits.correctIndex < 0 ||
      edits.correctIndex >= edits.options.length
    )
      return 'Select the correct answer.';
  }
  if (!edits.solutions.length || edits.solutions.some((solution) => !solution.trim()))
    return 'Add an explanation or worked solution before approving.';
  if (edits.solutions.join('\n').length > 50_000)
    return 'Shorten the explanations before approving.';
  if (
    ['diagram_based', 'graph_based', 'instrument_reading'].includes(draft.questionType) &&
    !draft.assets.length
  )
    return 'This question needs its diagram or graph before it can be approved.';
  return '';
}

export function reviewErrorMessage(error: unknown): string {
  const code = textValue((error as { code?: unknown } | null)?.code);
  if (code.endsWith('permission-denied') || code.endsWith('unauthenticated')) {
    return 'Your admin session could not be verified. Sign in again with an admin account, then retry.';
  }
  if (
    ['unavailable', 'deadline-exceeded', 'network-request-failed'].some((value) =>
      code.endsWith(value),
    )
  ) {
    return 'The connection was interrupted. Check your internet connection and retry; approving again will not publish a second copy.';
  }
  if (code.endsWith('failed-precondition'))
    return 'The review service is not ready. Refresh and retry; if it continues, ask support to check the review configuration.';
  return error instanceof Error
    ? error.message
    : 'The question could not be saved. Refresh the review queue and try again.';
}

@Injectable({ providedIn: 'root' })
export class QuestionReviewRepository {
  constructor(private readonly firebase: FirebaseClient) {}

  async pending(max = 50, cursor?: string, priorityId?: string): Promise<ReviewQueue> {
    const pageLimit = Number.isFinite(max) ? Math.max(1, Math.min(100, Math.floor(max))) : 50;
    if (priorityId && priorityId.includes('/')) throw new Error('The priority reference is invalid.');
    const filters = [where('reviewStatus', '==', pendingStatus),
      ...(priorityId ? [where('sourcePriorityId', '==', priorityId)] : [])];
    const scope = query(collection(this.firebase.firestore, 'devQuestions'), ...filters);
    const snapshot = await getDocs(
      query(
        collection(this.firebase.firestore, 'devQuestions'),
        ...filters,
        orderBy(documentId()),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(pageLimit + 1),
      ),
    );
    const visible = snapshot.docs.slice(0, pageLimit);
    const items = visible.map((item) => toReviewDraft(item.id, item.data()));
    const priorityIds = [...new Set(items.map((item) => item.sourcePriorityId).filter(Boolean))];
    const priorities = await Promise.all(priorityIds.map((id) => getDoc(doc(this.firebase.firestore, 'questionBankPriorityItems', id))));
    const statuses = new Map(priorities.map((item) => [item.id, item.data()]));
    for (const item of items) {
      const priority = statuses.get(item.sourcePriorityId);
      item.priorityStatus = textValue(priority?.['status']);
      item.priorityBlocker = textValue(priority?.['lastBlocker'] || priority?.['blocker']);
    }
    const count = await getCountFromServer(scope);
    return {
      items,
      truncated: snapshot.size > pageLimit,
      limit: pageLimit,
      nextCursor: snapshot.size > pageLimit ? visible.at(-1)?.id ?? null : null,
      total: count.data().count,
    };
  }

  async approve(
    draft: ReviewDraft,
    edits: ReviewEdits,
    actorId: string,
    reviewNotes = '',
  ): Promise<ApprovalResult> {
    this.requireActor(actorId);
    this.requireId(draft.id);
    const invalid = validateReviewEdits(draft, edits);
    if (invalid) throw new Error(invalid);
    if (reviewNotes.length > 2000) throw new Error('Keep the review note within 2,000 characters.');
    const sourceRef = doc(this.firebase.firestore, 'devQuestions', draft.id);
    const bankRef = doc(this.firebase.firestore, 'questions', draft.id);
    const source = await getDoc(sourceRef);
    if (!source.exists()) throw new Error('This draft no longer exists. Refresh the review queue.');
    const raw = source.data();
    // Resolving a query happens before the transaction because the browser SDK only
    // supports transactional document reads. Its exact scope is rechecked below.
    const syllabusId = await this.resolveSyllabus(raw);
    const syllabusRef = doc(this.firebase.firestore, 'syllabus', syllabusId);
    const priorityId = textValue(raw['sourcePriorityId']);
    const priorityRef = priorityId ? doc(this.firebase.firestore, 'questionBankPriorityItems', priorityId) : null;
    const content: ReviewEdits = {
      title: edits.title.trim(),
      question: edits.question.trim(),
      options: edits.options.map((option) => option.trim()),
      correctIndex: edits.correctIndex,
      solutions: edits.solutions.map((solution) => solution.trim()),
    };
    const duplicates = await getDocs(
      query(
        collection(this.firebase.firestore, 'questions'),
        ...scopeFields.map((field) => where(field, '==', textValue(raw[field]))),
        where('question', '==', content.question),
        limit(2),
      ),
    );
    const paperDuplicates = await getDocs(
      query(
        collection(this.firebase.firestore, 'devQuestions'),
        where('reviewStatus', '==', 'approved-paper-only'),
        ...scopeFields.map((field) => where(field, '==', textValue(raw[field]))),
        where('question', '==', content.question),
        limit(2),
      ),
    );
    if ([...duplicates.docs, ...paperDuplicates.docs].some((item) => item.id !== draft.id)) {
      throw new Error(
        'A question with this wording already exists in this chapter. Review the existing question or reject this duplicate.',
      );
    }
    return runTransaction(this.firebase.firestore, async (transaction) => {
      const current = await transaction.get(sourceRef);
      const existing = await transaction.get(bankRef);
      const syllabus = await transaction.get(syllabusRef);
      const priority = priorityRef ? await transaction.get(priorityRef) : null;
      if (!current.exists())
        throw new Error('This draft no longer exists. Refresh the review queue.');
      const fresh = current.data();
      if (
        (fresh['reviewStatus'] === 'approved-paper-only' && fresh['paperOnly'] === true && !existing.exists()) ||
        (fresh['reviewStatus'] === 'approved' && existing.exists() &&
          existing.data()['sourceDraftId'] === draft.id)
      ) {
        return { questionId: draft.id, alreadyApproved: true };
      }
      if (existing.exists())
        throw new Error(
          'A published question already uses this draft ID. Nothing was overwritten. Refresh and ask support to check the duplicate.',
        );
      this.requirePendingVersion(fresh, draft);
      if (priorityRef && !priority?.exists())
        throw new Error('The source priority is missing. Restore its context before approval.');
      if (priority?.data()?.['status'] === 'blocked')
        throw new Error('This priority is blocked. Resolve its syllabus or reference issue before approving its questions.');
      const requiredVersion = textValue(priority?.data()?.['curriculumVersionId']);
      const versionId = textValue(fresh['curriculumVersionId']);
      if (requiredVersion && requiredVersion !== versionId)
        throw new Error('This question is missing the syllabus version required by its paper request.');
      if (versionId) {
        const version = await transaction.get(doc(this.firebase.firestore,'curriculumVersions',versionId));
        const value = version.data();
        const chapter = Array.isArray(value?.['chapters']) ? value!['chapters'].find((item: {title:string}) => item.title === fresh['chapter']) : undefined;
        const purpose = textValue(fresh['assessmentPurpose']);
        if (!value || value['reviewStatus'] !== 'approved' || !chapter ||
          ['board','standard','subject','academicYear'].some(field => textValue(fresh[field]) !== textValue(value[field])) ||
          !['summative','formative','both'].includes(purpose) ||
          (chapter.assessment === 'formative' && purpose !== 'formative') ||
          (chapter.assessment === 'summative' && purpose !== 'summative'))
          throw new Error('The question does not match its approved syllabus version and assessment scope. Ask its creator to correct it.');
      }
      if (typeof fresh['boardStandardCheck'] === 'object' && fresh['boardStandardCheck'] !== null &&
        (fresh['boardStandardCheck'] as Record<string, unknown>)['matched'] === false)
        throw new Error('This draft did not pass its board and standard check.');
      if (!syllabus.exists())
        throw new Error(
          'The source chapter is missing. Restore or correct the syllabus before approving.',
        );
      const syllabusData = syllabus.data();
      if (
        scopeFields.some((field) => scopeValue(fresh[field]) !== scopeValue(syllabusData[field]))
      ) {
        throw new Error(
          'The source chapter does not match this question’s curriculum. Ask its creator to correct the syllabus link before approval.',
        );
      }
      const count = syllabusData['mcqCount'];
      if (!draft.paperOnly && count !== undefined && (!Number.isInteger(count) || (count as number) < 0)) {
        throw new Error(
          'The chapter’s question total needs correction. Ask support to fix it before approving.',
        );
      }
      const freshInvalid = validateReviewEdits(toReviewDraft(draft.id, fresh), content);
      if (freshInvalid) throw new Error(freshInvalid);
      const canonicalScope = Object.fromEntries(
        scopeFields.map((field) => [field, textValue(syllabusData[field])]),
      );
      const audit = {
        reviewStatus: draft.paperOnly ? 'approved-paper-only' : 'approved',
        status: 'approved',
        ...(draft.paperOnly ? { paperOnly: true } : {}),
        reviewNotes: reviewNotes.trim(),
        reviewedAt: serverTimestamp(),
        reviewedBy: actorId,
        updatedAt: serverTimestamp(),
        updatedBy: actorId,
        sourceSyllabusId: syllabusId,
        sourceDraftId: draft.id,
      };
      const published: Record<string, unknown> = {
        ...fresh,
        ...canonicalScope,
        ...content,
        ...audit,
      };
      delete published['id'];
      if (!draft.paperOnly) {
        transaction.set(bankRef, published);
        transaction.update(syllabusRef, { mcqCount: increment(1), updatedAt: serverTimestamp() });
      }
      transaction.update(sourceRef, { ...canonicalScope, ...content, ...audit });
      return { questionId: draft.id, alreadyApproved: false };
    });
  }

  async reject(draft: ReviewDraft, actorId: string, reviewNotes: string): Promise<void> {
    this.requireActor(actorId);
    this.requireId(draft.id);
    if (!reviewNotes.trim())
      throw new Error('Add a review note so the creator knows what to correct.');
    if (reviewNotes.length > 2000) throw new Error('Keep the review note within 2,000 characters.');
    const sourceRef = doc(this.firebase.firestore, 'devQuestions', draft.id);
    await runTransaction(this.firebase.firestore, async (transaction) => {
      const current = await transaction.get(sourceRef);
      if (!current.exists())
        throw new Error('This draft no longer exists. Refresh the review queue.');
      this.requirePendingVersion(current.data(), draft);
      transaction.update(sourceRef, {
        reviewStatus: 'rejected',
        status: 'rejected',
        reviewNotes: reviewNotes.trim(),
        reviewedAt: serverTimestamp(),
        reviewedBy: actorId,
        updatedAt: serverTimestamp(),
        updatedBy: actorId,
      });
    });
  }

  private async resolveSyllabus(raw: Record<string, unknown>): Promise<string> {
    const explicit = textValue(raw['sourceSyllabusId']);
    if (explicit) {
      this.requireId(explicit);
      return explicit;
    }
    if (scopeFields.some((field) => !textValue(raw[field])))
      throw new Error('This draft needs a complete curriculum before approval.');
    const matches = await getDocs(
      query(
        collection(this.firebase.firestore, 'syllabus'),
        ...scopeFields.map((field) => where(field, '==', raw[field])),
        limit(2),
      ),
    );
    if (matches.size !== 1) {
      throw new Error(
        matches.size === 0
          ? 'No matching chapter was found. Add the chapter or correct the draft’s curriculum before approval.'
          : 'More than one chapter matches this draft. Ask its creator to link the exact source chapter before approval.',
      );
    }
    return matches.docs[0].id;
  }

  private requirePendingVersion(raw: Record<string, unknown>, draft: ReviewDraft): void {
    if (raw['reviewStatus'] !== pendingStatus)
      throw new Error('Another reviewer has already handled this draft. Refresh the review queue.');
    if (reviewVersion(raw) !== draft.version)
      throw new Error(
        'This draft changed while you were reviewing it. Refresh and review the updated version before saving.',
      );
  }

  private requireActor(actorId: string): void {
    if (!actorId || actorId === 'admin')
      throw new Error('Sign in again with your admin account before reviewing questions.');
  }

  private requireId(id: string): void {
    if (!id || id.includes('/'))
      throw new Error(
        'This question has an invalid reference. Refresh and ask its creator to correct it.',
      );
  }
}
