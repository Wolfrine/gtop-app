import { Injectable } from '@angular/core';
import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, startAfter, where, writeBatch,
  type DocumentData, type QueryDocumentSnapshot,
} from '@angular/fire/firestore';
import { FirebaseClient } from './firebase';
import { SyllabusItem } from './models';
import {
  chapterKey, isUsableQuestion, normalizeQuestion, strings, textValue, validatePaperDraft,
  type ChapterScope, type CoverageGap, type PaperDraftPayload,
  type PaperGenerationSetup, type QuestionBankResult, type QuestionPaperTemplate,
  type SavedPaperDraft,
} from './question-paper.domain';

export * from './question-paper.domain';

@Injectable({ providedIn: 'root' })
export class QuestionPaperRepository {
  constructor(private readonly firebase: FirebaseClient) {}

  async syllabus(): Promise<SyllabusItem[]> {
    const items: SyllabusItem[] = [];
    let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
    // Fetch every page: an arbitrary first-page cap can hide entire board/standard options.
    for (let page = 0; page < 12; page++) {
      const snapshot = await getDocs(query(collection(this.firebase.firestore, 'syllabus'),
        ...(cursor ? [startAfter(cursor)] : []), limit(500)));
      items.push(...snapshot.docs.map((item) => {
        const raw = item.data();
        return { id: item.id, board: textValue(raw['board']), standard: textValue(raw['standard']),
          subject: textValue(raw['subject']), chapter: textValue(raw['chapter']), mcqCount: Number(raw['mcqCount']) || 0 };
      }).filter((item) => item.board && item.standard && item.subject && item.chapter));
      if (snapshot.size < 500) return items.sort((a, b) =>
        `${a.board}|${a.standard}|${a.subject}|${a.chapter}`.localeCompare(`${b.board}|${b.standard}|${b.subject}|${b.chapter}`));
      cursor = snapshot.docs.at(-1);
    }
    throw new Error('The syllabus is too large to load completely. Please ask support to narrow the syllabus catalogue.');
  }

  async templates(): Promise<QuestionPaperTemplate[]> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'paperTemplates'), limit(100)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as QuestionPaperTemplate)
      .filter((item) => !item.status || item.status === 'active')
      .sort((a, b) => (a.title ?? a.name ?? a.id).localeCompare(b.title ?? b.name ?? b.id));
  }

  async approvedQuestions(board: string, standard: string, scopes: ChapterScope[]): Promise<QuestionBankResult> {
    const result: QuestionBankResult = { questions: [], truncatedScopes: [], excludedCount: 0 };
    const unique = [...new Map(scopes.map((scope) => [chapterKey(scope), scope])).values()];
    if (!unique.length || unique.length > 60) throw new Error('Select between 1 and 60 chapters.');
    let nextScope = 0;
    // Each query is restricted to a selected subject/chapter before its limit is applied.
    // Four workers bound both read concurrency and UI memory pressure for full-portion papers.
    const worker = async (): Promise<void> => {
      while (nextScope < unique.length) {
        const scope = unique[nextScope++];
        let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
        for (let page = 0; page < 4; page++) {
          const snapshot = await getDocs(query(collection(this.firebase.firestore, 'questions'),
            where('board', '==', board), where('standard', '==', standard),
            where('subject', '==', scope.subject), where('chapter', '==', scope.chapter),
            ...(cursor ? [startAfter(cursor)] : []), limit(page === 3 ? 501 : 500)));
          for (const item of snapshot.docs.slice(0, 500)) {
            const question = normalizeQuestion(item.id, item.data());
            if (isUsableQuestion(question)) result.questions.push(question);
            else result.excludedCount++;
          }
          if (page === 3 && snapshot.size > 500) result.truncatedScopes.push(scope);
          if (snapshot.size < 500) break;
          cursor = snapshot.docs.at(-1);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, unique.length) }, () => worker()));
    return result;
  }

  async saveDraft(payload: PaperDraftPayload): Promise<string> {
    // Firestore rejects undefined values and documents above 1 MiB. Fail before writing a partial paper.
    if (!payload.createdBy || payload.createdBy === 'admin') throw new Error('Sign in again before saving this paper.');
    const validation = validatePaperDraft(payload);
    if (validation) throw new Error(validation);
    if (!payload.sections.some((section) => section.questions.length)) throw new Error('Add questions before saving.');
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 850_000) {
      throw new Error('This paper is too large to save as one draft. Reduce the number of questions.');
    }
    const created = await addDoc(collection(this.firebase.firestore, 'paperDrafts'), {
      ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return created.id;
  }

  async recentDrafts(): Promise<SavedPaperDraft[]> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'paperDrafts'), orderBy('createdAt', 'desc'), limit(20)));
    return snapshot.docs.map((item) => ({ ...item.data(), id: item.id, subjects: strings(item.data()['subjects']) }) as SavedPaperDraft);
  }

  async draft(id: string): Promise<SavedPaperDraft> {
    if (!id || id.includes('/')) throw new Error('This saved paper could not be found.');
    const snapshot = await getDoc(doc(this.firebase.firestore, 'paperDrafts', id));
    if (!snapshot.exists()) throw new Error('This saved paper could not be found.');
    const raw = snapshot.data();
    if (raw['schemaVersion'] !== 2 || !Array.isArray(raw['sections']) || !Array.isArray(raw['rules']) ||
      !Array.isArray(raw['subjects']) || !Array.isArray(raw['chapterScopes']) || !raw['coverage']) {
      throw new Error('This older draft does not include a complete section plan. Generate a fresh draft to use the updated paper builder.');
    }
    const draft = { ...raw, id: snapshot.id } as SavedPaperDraft;
    const validation = validatePaperDraft(draft);
    if (validation) throw new Error(validation);
    return draft;
  }

  async createPriorityItems(setup: PaperGenerationSetup, gaps: CoverageGap[], actorId: string): Promise<number> {
    if (!actorId || actorId === 'admin') throw new Error('Sign in again before requesting questions.');
    if (gaps.length > 450) throw new Error('Reduce the number of sections or chapters before requesting questions.');
    const batch = writeBatch(this.firebase.firestore);
    for (const gap of gaps) {
      batch.set(doc(collection(this.firebase.firestore, 'questionBankPriorityItems')), {
        board: setup.board, standard: setup.standard,
        subjects: [gap.subject], primarySubject: gap.subject, subject: gap.subject,
        chapters: [gap.chapter], chapter: gap.chapter,
        questionType: gap.questionTypes.find((type) => type !== 'any' && type !== 'mixed') ?? 'mcq',
        questionTypes: gap.questionTypes, acceptableQuestionTypes: gap.questionTypes,
        ...(gap.typeRequirements ? { typeRequirements: gap.typeRequirements } : {}),
        competencyTags: gap.competencyTags, difficulty: gap.difficulty,
        requiredCount: gap.requiredCount, availableCount: gap.availableCount, gapCount: gap.gapCount,
        marksPerQuestion: gap.marksPerQuestion,
        priority: gap.gapCount >= 10 ? 'critical' : gap.gapCount >= 5 ? 'high' : 'medium',
        status: 'open', source: 'admin-question-paper-generator',
        sourceTemplateId: setup.templateId, sourceTemplateName: setup.templateName,
        sourceSectionId: gap.sectionId, sourceSectionTitle: gap.sectionTitle,
        assignedAgent: null, createdBy: actorId, updatedBy: actorId,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return gaps.length;
  }
}
