import { Injectable } from '@angular/core';
import {
  collection, doc, documentId, getCountFromServer, getDoc, getDocs, limit,
  orderBy, query, runTransaction, serverTimestamp, startAfter, where,
} from '@angular/fire/firestore';
import { FirebaseClient } from './firebase';
import { type SyllabusItem } from './models';
import { libraryScopeFilters } from './question-library.repository';
import { normalizeQuestion, normalizeQuestionType, textValue } from './question-paper.domain';

export interface PriorityItem {
  id: string;
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  sourceSyllabusId: string;
  questionTypes: string[];
  priority: string;
  status: string;
  source: string;
  parentRequestId: string;
  requiredCount: number;
  availableCount: number;
  pendingCount: number | null;
  stagedCount: number;
  blocker: string;
  agentRunId: string;
  updatedAt: string;
}

export interface ScopeCounts {
  quizApproved: number;
  paperOnlyApproved: number;
  pending: number;
  rejected: number;
}

export interface BankRow {
  id: string;
  question: string;
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  questionType: string;
  difficulty: string;
  paperOnly: boolean;
  solutions: string[];
}

export interface CreatedQuestionRow extends BankRow {
  reviewStatus: string;
  agentRunId: string;
}

function scopeFilters(scope: SyllabusItem) {
  return libraryScopeFilters(scope);
}

function toPriority(id: string, data: Record<string, unknown>): PriorityItem {
  const progress = data['progress'] && typeof data['progress'] === 'object'
    ? data['progress'] as Record<string, unknown> : {};
  return {
    id, board: textValue(data['board']), standard: textValue(data['standard']),
    subject: textValue(data['subject'] || data['primarySubject']), chapter: textValue(data['chapter']),
    sourceSyllabusId: textValue(data['sourceSyllabusId']),
    questionTypes: Array.isArray(data['questionTypes'])
      ? data['questionTypes'].map(textValue) : [textValue(data['questionType'])].filter(Boolean),
    priority: textValue(data['priority']) || 'medium', status: textValue(data['status']) || 'open',
    source: textValue(data['source']), parentRequestId:textValue(data['parentRequestId']), requiredCount: Number(data['requiredCount']) || 0,
    availableCount: Number(data['availableCount']) || 0,
    pendingCount: typeof progress['pendingDraftCount'] === 'number'
      ? progress['pendingDraftCount'] as number : null,
    stagedCount: Number(progress['stagedCount']) || Number(data['generatedCount']) || 0,
    blocker: textValue(data['lastBlocker'] || data['blocker']),
    agentRunId: textValue(progress['lastRunId'] || data['agentRunId']),
    updatedAt: textValue(data['updatedAtIso'] || data['createdAtIso']),
  };
}

@Injectable({ providedIn: 'root' })
export class QuestionOperationsRepository {
  constructor(private readonly firebase: FirebaseClient) {}

  async priorities(cursor?: string, max = 50, parentRequestId?:string): Promise<{ items: PriorityItem[]; nextCursor: string | null }> {
    const pageSize = Math.min(100, Math.max(1, max));
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'questionBankPriorityItems'),
      ...(parentRequestId?[where('parentRequestId','==',parentRequestId)]:[]), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize + 1)));
    const visible = snapshot.docs.slice(0, pageSize);
    return { items: visible.map((item) => toPriority(item.id, item.data())),
      nextCursor: snapshot.size > pageSize ? visible.at(-1)?.id ?? null : null };
  }

  async priority(id:string):Promise<PriorityItem|null> {
    if(!id||id.includes('/'))return null;
    const result=await getDoc(doc(this.firebase.firestore,'questionBankPriorityItems',id));
    return result.exists()?toPriority(result.id,result.data()):null;
  }
  async typeCounts(scope:SyllabusItem, types:string[]):Promise<{approved:number;pending:number}> {
    types=[...new Set(types.map(normalizeQuestionType))];
    let quiz=0,written=0,pending=0;
    for(const source of ['questions','devQuestions']) {
      let cursor:string|undefined;
      for(let page=0;page<8;page++) {
        const snapshot=await getDocs(query(collection(this.firebase.firestore,source),...scopeFilters(scope),orderBy(documentId()),...(cursor?[startAfter(cursor)]:[]),limit(501)));
        for(const item of snapshot.docs.slice(0,500)) {
          const raw=item.data();const question=normalizeQuestion(item.id,raw);
          if(!types.includes(question.questionType))continue;
          if(source==='questions')quiz++;
          else if(raw['reviewStatus']==='approved-paper-only'&&raw['paperOnly']===true)written++;
          else if(raw['reviewStatus']==='pending-admin-review')pending++;
        }
        if(snapshot.size<=500)break;
        if(page===7)throw new Error('This chapter is too large to verify its type coverage safely. Narrow the request before saving.');
        cursor=snapshot.docs[499].id;
      }
    }
    return {approved:quiz+written,pending};
  }

  async forSyllabus(scope: SyllabusItem): Promise<PriorityItem[]> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'questionBankPriorityItems'),
      where('sourceSyllabusId', '==', scope.id), limit(100)));
    return snapshot.docs.map((item) => toPriority(item.id, item.data()));
  }

  async counts(scope: SyllabusItem): Promise<ScopeCounts> {
    const base = scopeFilters(scope);
    const sources = [
      query(collection(this.firebase.firestore, 'questions'), ...base),
      query(collection(this.firebase.firestore, 'devQuestions'), ...base,
        where('reviewStatus', '==', 'approved-paper-only'), where('paperOnly', '==', true)),
      query(collection(this.firebase.firestore, 'devQuestions'), ...base,
        where('reviewStatus', '==', 'pending-admin-review')),
      query(collection(this.firebase.firestore, 'devQuestions'), ...base,
        where('reviewStatus', '==', 'rejected')),
    ];
    const [quizApproved, paperOnlyApproved, pending, rejected] = await Promise.all(
      sources.map(async (source) => (await getCountFromServer(source)).data().count));
    return { quizApproved, paperOnlyApproved, pending, rejected };
  }

  async setGrowthPriority(scope: SyllabusItem, target: number, priority: string,
    questionTypes: string[], actorId: string): Promise<string> {
    if (!actorId || actorId === 'admin') throw new Error('Sign in again to set a priority.');
    if (!Number.isInteger(target) || target < 1 || target > 100000)
      throw new Error('Choose a target between 1 and 100,000 questions.');
    if (!['critical', 'high', 'medium', 'low'].includes(priority)) throw new Error('Choose a priority level.');
    questionTypes=[...new Set(questionTypes.map(normalizeQuestionType))];
    if (!questionTypes.length) throw new Error('Select at least one question type.');
    const coverage = await this.typeCounts(scope,questionTypes);
    const approved = coverage.approved;
    const existing = (await this.forSyllabus(scope)).find((item) =>
      item.source === 'admin-question-bank-growth' && item.status !== 'done');
    const id = existing?.id ?? `growth-${scope.id}`;
    const sourceRef = doc(this.firebase.firestore, 'questionBankPriorityItems', id);
    const syllabusRef = doc(this.firebase.firestore, 'syllabus', scope.id);
    await runTransaction(this.firebase.firestore, async (tx) => {
      const syllabus = await tx.get(syllabusRef);
      const current = await tx.get(sourceRef);
      if (!syllabus.exists() || ['board', 'standard', 'subject', 'chapter'].some((field) =>
        textValue(syllabus.data()[field]) !== scope[field as keyof SyllabusItem]))
        throw new Error('The syllabus changed. Refresh and select the chapter again.');
      if (current.exists() && current.data()['status'] === 'blocked')
        throw new Error('This priority is blocked. Resolve its syllabus or reference issue first.');
      const fields = {
        board: scope.board, standard: scope.standard, subject: scope.subject,
        subjects: [scope.subject], primarySubject: scope.subject,
        chapter: scope.chapter, chapters: [scope.chapter], sourceSyllabusId: scope.id,
        questionType: questionTypes[0], questionTypes, acceptableQuestionTypes: questionTypes,
        requiredCount: target, availableCount: approved,
        gapCount: Math.max(0, target - approved), pendingCount:coverage.pending, generationDeficit:Math.max(0,target-approved-coverage.pending), priority, status:approved>=target?'done':coverage.pending>=target-approved?'review':'open', updatedBy: actorId,
        updatedAt: serverTimestamp(),
      };
      if (current.exists()) tx.update(sourceRef, fields);
      else tx.set(sourceRef, { ...fields, source: 'admin-question-bank-growth',
        createdBy: actorId, createdAt: serverTimestamp(), schemaVersion: 2 });
    });
    return id;
  }

  async setPriorityStatus(item: PriorityItem, status: 'open' | 'paused', actorId: string): Promise<void> {
    if (!actorId || actorId === 'admin') throw new Error('Sign in again to change priority status.');
    if (item.status === 'blocked') throw new Error('Resolve the documented blocker before reopening this priority.');
    const ref = doc(this.firebase.firestore, 'questionBankPriorityItems', item.id);
    await runTransaction(this.firebase.firestore, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists()) throw new Error('This priority no longer exists. Refresh the list.');
      if (current.data()['status'] === 'blocked') throw new Error('This priority was blocked. Refresh before editing.');
      tx.update(ref, { status, updatedBy: actorId, updatedAt: serverTimestamp() });
    });
  }

  async bank(scope: SyllabusItem, source: 'questions' | 'devQuestions', cursor?: string,
    max = 25): Promise<{ items: BankRow[]; nextCursor: string | null }> {
    const size = Math.max(1, Math.min(max, 50));
    const snapshot = await getDocs(query(collection(this.firebase.firestore, source),
      ...scopeFilters(scope),
      ...(source === 'devQuestions' ? [where('reviewStatus', '==', 'approved-paper-only'),
        where('paperOnly', '==', true)] : []),
      orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(size + 1)));
    const visible = snapshot.docs.slice(0, size);
    return { items: visible.map((item) => {
      const q = normalizeQuestion(item.id, item.data());
      return { id: item.id, question: q.question, board: q.board, standard: q.standard,
        subject: q.subject, chapter: q.chapter, questionType: q.questionType,
        difficulty: q.difficulty, paperOnly: source === 'devQuestions', solutions: q.solutions };
    }), nextCursor: snapshot.size > size ? visible.at(-1)?.id ?? null : null };
  }

  async createdForPriority(id: string, cursor?: string): Promise<{
    items: CreatedQuestionRow[]; nextCursor: string | null;
  }> {
    if (!id || id.includes('/')) throw new Error('The priority reference is invalid.');
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'devQuestions'),
      where('sourcePriorityId', '==', id), orderBy(documentId()),
      ...(cursor ? [startAfter(cursor)] : []), limit(26)));
    const visible = snapshot.docs.slice(0, 25);
    return { items: visible.map((item) => {
      const q = normalizeQuestion(item.id, item.data());
      return { id: item.id, question: q.question, board: q.board, standard: q.standard,
        subject: q.subject, chapter: q.chapter, questionType: q.questionType,
        difficulty: q.difficulty, paperOnly: item.data()['paperOnly'] === true,
        solutions: q.solutions, reviewStatus: textValue(item.data()['reviewStatus']),
        agentRunId: textValue(item.data()['agentRunId']) };
    }), nextCursor: snapshot.size > 25 ? visible.at(-1)?.id ?? null : null };
  }

  async run(id: string): Promise<Record<string, unknown> | null> {
    if (!id || id.includes('/')) return null;
    const snapshot = await getDoc(doc(this.firebase.firestore, 'automationRuns', id));
    return snapshot.exists() ? snapshot.data() : null;
  }
}
