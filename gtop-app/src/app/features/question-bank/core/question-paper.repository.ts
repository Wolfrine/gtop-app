import { Injectable } from '@angular/core';
import {
  addDoc, collection, doc, getDoc, getDocFromServer, getDocsFromServer as getDocs, getCountFromServer, limit, orderBy, query,
  serverTimestamp, startAfter, where, writeBatch, runTransaction,
  type DocumentData, type QueryDocumentSnapshot,
} from '@angular/fire/firestore';
import { FirebaseClient } from './firebase';
import { SyllabusService } from '../../../services/syllabus.service';
import { FirestoreReadService } from '../../../services/firestore-read.service';
import { filter, firstValueFrom, map } from 'rxjs';
import { SyllabusItem } from './models';
import { curriculumKey } from '../../../services/curriculum.domain';
import {
  chapterKey, isUsableQuestion, normalizeQuestion, strings, textValue, validatePaperDraft, validatePaperStructure,
  type ChapterScope, type CoverageGap, type PaperDraftPayload,
  type PaperGenerationSetup, type QuestionBankResult, type QuestionPaperTemplate,
  type SavedPaperDraft, type GenerationRule, type PaperPlan,
} from './question-paper.domain';

export * from './question-paper.domain';

@Injectable({ providedIn: 'root' })
export class QuestionPaperRepository {
  constructor(private readonly firebase: FirebaseClient, private readonly catalogue: SyllabusService, private readonly reads: FirestoreReadService) {}

  async syllabus(): Promise<SyllabusItem[]> {
    return firstValueFrom(this.syllabusUpdates());
  }

  syllabusUpdates() {
    return this.catalogue.snapshots$.pipe(filter(state => !state.fromCache || state.items.length > 0), map(state => state.items
      .filter(item => item.id && item.board && item.standard && item.subject && item.chapter)
      .map(item => ({ ...item, id: item.id!, standard: String(item.standard) }))
      .sort((a,b) => `${a.board}|${a.standard}|${a.subject}|${a.chapter}`.localeCompare(`${b.board}|${b.standard}|${b.subject}|${b.chapter}`))));
  }

  async templates(): Promise<QuestionPaperTemplate[]> {
    return firstValueFrom(this.templateUpdates());
  }
  templateUpdates() {
    return this.reads.watch(query(collection(this.firebase.firestore, 'paperTemplates'), limit(100))).pipe(filter(snapshot => !snapshot.metadata.fromCache || !snapshot.empty), map(snapshot => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as QuestionPaperTemplate)
      .filter((item) => !item.status || item.status === 'active')
      .sort((a, b) => (a.title ?? a.name ?? a.id).localeCompare(b.title ?? b.name ?? b.id))));
  }

  draftUpdates() {
    return this.reads.watch(query(collection(this.firebase.firestore, 'paperDrafts'), orderBy('createdAt','desc'), limit(20))).pipe(filter(snapshot => !snapshot.metadata.fromCache || !snapshot.empty), map(snapshot => snapshot.docs.map(item => ({...item.data(),id:item.id,subjects:strings(item.data()['subjects'])}) as SavedPaperDraft)));
  }
  requestUpdates() {
    return this.reads.watch(query(collection(this.firebase.firestore, 'paperRequests'), orderBy('createdAt','desc'), limit(20))).pipe(filter(snapshot => !snapshot.metadata.fromCache || !snapshot.empty), map(snapshot => snapshot.docs.map(item => ({...item.data(),id:item.id}) as PaperRequestRecord)));
  }

  async approvedQuestions(board: string, standard: string, scopes: ChapterScope[], assessmentPurpose?: 'summative' | 'formative' | 'both'): Promise<QuestionBankResult> {
    const result: QuestionBankResult = { questions: [], truncatedScopes: [], excludedCount: 0 };
    const unique = [...new Map(scopes.map((scope) => [chapterKey(scope), scope])).values()];
    if (!unique.length || unique.length > 60) throw new Error('Select between 1 and 60 chapters.');
    let nextScope = 0;
    // Each query is restricted to a selected subject/chapter before its limit is applied.
    // Four workers bound both read concurrency and UI memory pressure for full-portion papers.
    const worker = async (): Promise<void> => {
      while (nextScope < unique.length) {
        const scope = unique[nextScope++];
        for (const bankScope of [{subject:scope.subject,chapter:scope.chapter}, ...(scope.bankAliases ?? [])]) {
        for (const source of ['questions', 'devQuestions'] as const) {
          let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
          for (let page = 0; page < 4; page++) {
            const snapshot = await getDocs(query(collection(this.firebase.firestore, source),
              where('board', '==', board), where('standard', 'in', [...new Set([standard, Number(standard)].filter(value => typeof value === 'string' || Number.isFinite(value)))]),
              where('subject', '==', bankScope.subject), where('chapter', '==', bankScope.chapter),
              ...(source === 'devQuestions' ? [where('reviewStatus', '==', 'approved-paper-only')] : []),
              ...(cursor ? [startAfter(cursor)] : []), limit(page === 3 ? 501 : 500)));
            for (const item of snapshot.docs.slice(0, 500)) {
              const raw = item.data();
              if (assessmentPurpose && scope.curriculumVersionId && (raw['curriculumVersionId'] !== scope.curriculumVersionId ||
                !(assessmentPurpose === 'both' ? ['both','summative','formative'] : ['both',assessmentPurpose]).includes(String(raw['assessmentPurpose'] ?? '')))) { result.excludedCount++; continue; }
              // The staging collection contains drafts too. Only reviewed paper-only items
              // are eligible for the admin paper builder; learner quizzes read questions.
              if (source === 'devQuestions' && raw['paperOnly'] !== true) {
                result.excludedCount++;
                continue;
              }
              const question = normalizeQuestion(item.id, raw);
              if (isUsableQuestion(question)) result.questions.push({...question,subject:scope.subject,chapter:scope.chapter});
              else result.excludedCount++;
            }
            if (page === 3 && snapshot.size > 500 &&
              !result.truncatedScopes.some((item) => chapterKey(item) === chapterKey(scope))) {
              result.truncatedScopes.push(scope);
            }
            if (snapshot.size < 500) break;
            cursor = snapshot.docs.at(-1);
          }
        }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, unique.length) }, () => worker()));
    return result;
  }

  async saveDraft(payload: PaperDraftPayload, parentRequestId?:string): Promise<string> {
    // Firestore rejects undefined values and documents above 1 MiB. Fail before writing a partial paper.
    if (!payload.createdBy || payload.createdBy === 'admin') throw new Error('Sign in again before saving this paper.');
    const validation = validatePaperDraft(payload);
    if (validation) throw new Error(validation);
    if (!payload.sections.some((section) => section.questions.length)) throw new Error('Add questions before saving.');
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 850_000) {
      throw new Error('This paper is too large to save as one draft. Reduce the number of questions.');
    }
    const ref=doc(collection(this.firebase.firestore,'paperDrafts'));
    await runTransaction(this.firebase.firestore,async tx=>{
      const parentRef=parentRequestId?doc(this.firebase.firestore,'paperRequests',parentRequestId):null;
      const parent=parentRef?await tx.get(parentRef):null;
      if(parent?.exists()&&parent.data()['status']==='cancelled')throw new Error('This request was cancelled. Use its setup for a new paper.');
      tx.set(ref,{...payload,...(parentRequestId?{parentRequestId}:{}),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      if(parentRef&&parent?.exists()&&parent.data()['status']!=='completed')tx.update(parentRef,{savedDraftId:ref.id,status:payload.coverage.gapCount===0?'completed':parent.data()['status'],updatedAt:serverTimestamp()});
    });
    return ref.id;
  }

  async recentDrafts(cursor?:string): Promise<SavedPaperDraft[]> {
    if(!cursor)return firstValueFrom(this.draftUpdates());
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'paperDrafts'), orderBy('createdAt', 'desc'), ...(cursor?[startAfter(await getDoc(doc(this.firebase.firestore,'paperDrafts',cursor)))]:[]), limit(20)));
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

  async recentRequests(cursor?:string): Promise<PaperRequestRecord[]> {
    if(!cursor)return firstValueFrom(this.requestUpdates());
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'paperRequests'), orderBy('createdAt', 'desc'), ...(cursor?[startAfter(await getDoc(doc(this.firebase.firestore,'paperRequests',cursor)))]:[]), limit(20)));
    return snapshot.docs.map(item => ({...item.data(), id:item.id}) as PaperRequestRecord);
  }

  async updateRequestCoverage(id:string,plan:PaperPlan,actor:string):Promise<void> {
    const ref=doc(this.firebase.firestore,'paperRequests',id);
    const pending=(await getCountFromServer(query(collection(this.firebase.firestore,'devQuestions'),where('parentRequestId','==',id),where('reviewStatus','==','pending-admin-review')))).data().count;
    await runTransaction(this.firebase.firestore,async tx=>{
      const snapshot=await tx.get(ref);if(!snapshot.exists()||['cancelled','completed'].includes(snapshot.data()['status']))return;
      const value=snapshot.data();const scopes=Array.isArray(value['chapterScopes'])?value['chapterScopes']:[];
      const missing=new Set(plan.gaps.filter(g=>g.gapCount>0).map(chapterKey));
      tx.update(ref,{status:missing.size?(pending?'awaiting-review':'creating-questions'):'ready',needsCoverageCheck:false,
        progress:{requestedChapters:scopes.length,completedChapters:Math.max(0,scopes.length-missing.size),pendingReview:pending},
        updatedAt:serverTimestamp(),updatedBy:actor});
    });
  }

  async cancelRequest(id:string,actor:string):Promise<void> {
    if(!actor||!id||id.includes('/'))throw new Error('Sign in to cancel this request.');
    const ref=doc(this.firebase.firestore,'paperRequests',id);
    await runTransaction(this.firebase.firestore,async tx=>{
      const parent=await tx.get(ref);if(!parent.exists()||parent.data()['status']==='completed')throw new Error('This request has already finished.');
      const ids=Array.isArray(parent.data()['childPriorityIds'])?parent.data()['childPriorityIds'] as string[]:[];
      if(ids.length>400)throw new Error('This request is too large to cancel in one operation.');
      const children=await Promise.all(ids.map(id=>tx.get(doc(this.firebase.firestore,'questionBankPriorityItems',id))));
      for(const child of children)if(child.exists()&&child.data()['status']!=='done')tx.update(child.ref,{status:'paused',updatedBy:actor,updatedAt:serverTimestamp()});
      tx.update(ref,{status:'cancelled',cancelledBy:actor,updatedAt:serverTimestamp()});
    });
  }

  async request(id:string):Promise<PaperRequestRecord> {
    if(!id||id.includes('/'))throw new Error('Invalid paper request.');
    const item=await getDocFromServer(doc(this.firebase.firestore,'paperRequests',id));
    if(!item.exists())throw new Error('This paper request no longer exists.');
    const value={...item.data(),id:item.id} as PaperRequestRecord;
    if(value.status==='cancelled')throw new Error('This request was cancelled. Create a new paper instead.');
    if(!Array.isArray(value.rules)||!value.rules.length)throw new Error('This older request has no saved section plan. Create a new paper.');
    return value;
  }

  async requestPaper(setup: PaperGenerationSetup, rules: GenerationRule[], actorId: string, requestId: string): Promise<string> {
    if (!actorId || actorId === 'admin') throw new Error('Sign in again before requesting a paper.');
    if (!setup.title || !setup.board || !setup.standard || !setup.subjects.length) throw new Error('Specify a title, board, standard and subject.');
    const structureError = validatePaperStructure(setup, rules);
    if (structureError) throw new Error(structureError);
    if (!/^\d{4}-\d{2}$/.test(setup.academicYear ?? '')) throw new Error('Specify an academic year such as 2026-27.');
    if (setup.scopeMode !== 'full' && !setup.chapterScopes.length) throw new Error('Select at least one chapter or enter a custom topic.');
    if (new TextEncoder().encode(JSON.stringify({setup,rules})).length > 700_000) throw new Error('This request is too large. Shorten the notes.');
    const ref = doc(this.firebase.firestore, 'paperRequests', requestId);
    await runTransaction(this.firebase.firestore, async transaction => {
      const existing = await transaction.get(ref);
      if (existing.exists()) return;
      transaction.set(ref, { ...setup, rules, id:requestId, source:'admin-question-paper-generator',
        status:setup.syllabusResolved ? 'awaiting-coverage' : 'awaiting-syllabus',
        createdBy:actorId, createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
        progress:{requestedChapters:setup.chapterScopes.length, completedChapters:0, pendingReview:0},
        instruction:'Resolve only this admin request. Use the approved year-specific syllabus; research missing scope into a draft for admin approval. Keep all child priorities under this request. Never publish unreviewed syllabus or questions.' });
    });
    return requestId;
  }

  async createPriorityItems(setup: PaperGenerationSetup, gaps: CoverageGap[], actorId: string,
    requestId = doc(collection(this.firebase.firestore, 'paperRequests')).id, rules: GenerationRule[] = []): Promise<number> {
    if (!actorId || actorId === 'admin') throw new Error('Sign in again before requesting questions.');
    if (gaps.length > 400) throw new Error('Reduce the number of sections or chapters before requesting questions.');
    if (setup.scopeMode === 'full' && !setup.syllabusResolved) throw new Error('The full syllabus must be approved before questions can be requested. Save the paper request first.');
    const parent = doc(this.firebase.firestore, 'paperRequests', requestId);
    const prepared: {ref: ReturnType<typeof doc>; data: Record<string, unknown>}[] = [];
    for (const [index, gap] of gaps.filter(item => item.gapCount > 0).entries()) {
      const scope = setup.chapterScopes.find(item => item.subject === gap.subject && item.chapter === gap.chapter);
      const matches = await getDocs(query(collection(this.firebase.firestore, 'syllabus'),
        where('board', '==', setup.board), where('standard', 'in', [...new Set([setup.standard, Number(setup.standard)].filter(value => typeof value === 'string' || Number.isFinite(value)))]),
        where('subject', '==', gap.subject), where('chapter', '==', gap.chapter)));
      // Exact duplicates are the same text scope. Choose a stable existing ID; keep every
      // old record and question intact. Aliases require an approved curriculum mapping.
      const ids = matches.docs.map(item => item.id).sort();
      let scopeId = ids[0];
      if (!scopeId) {
        if (!scope?.curriculumVersionId) throw new Error(`${gap.chapter} needs syllabus review. Save the paper request to ask for source verification.`);
        const version = await getDocFromServer(doc(this.firebase.firestore, 'curriculumVersions', scope.curriculumVersionId));
        if (!version.exists() || version.data()['reviewStatus'] !== 'approved' || version.data()['board'] !== setup.board ||
          version.data()['standard'] !== setup.standard || version.data()['academicYear'] !== setup.academicYear || version.data()['subject'] !== gap.subject ||
          !version.data()['chapters'].some((item: {title:string}) => item.title === gap.chapter)) throw new Error('The selected approved syllabus could not be verified. Refresh the catalogue.');
        scopeId = `curriculum-${curriculumKey({board:setup.board,standard:setup.standard,subject:gap.subject,academicYear:setup.academicYear!})}-${encodeURIComponent(gap.chapter)}`;
        const scopeRef = doc(this.firebase.firestore, 'syllabus', scopeId);
        await runTransaction(this.firebase.firestore, async transaction => {
          const current = await transaction.get(scopeRef);
          if (!current.exists()) transaction.set(scopeRef, {board:setup.board,standard:setup.standard,subject:gap.subject,chapter:gap.chapter,
            mcqCount:0,curriculumVersionId:scope.curriculumVersionId,createdAt:serverTimestamp()});
        });
      }
      const priorityId = `paper-${requestId}-${index}`;
      prepared.push({ref:doc(this.firebase.firestore, 'questionBankPriorityItems', priorityId), data:{
        board:setup.board, standard:setup.standard, academicYear:setup.academicYear ?? '',
        sourceSyllabusId:scopeId, sourceSyllabusIds:ids.length ? ids : [scopeId],
        curriculumVersionId:scope?.curriculumVersionId ?? '', parentRequestId:requestId,
        subjects:[gap.subject], primarySubject:gap.subject, subject:gap.subject, chapters:[gap.chapter], chapter:gap.chapter,
        questionType:gap.questionTypes.find(type => type !== 'any' && type !== 'mixed') ?? 'mcq',
        questionTypes:gap.questionTypes, acceptableQuestionTypes:gap.questionTypes,
        ...(gap.typeRequirements ? {typeRequirements:gap.typeRequirements} : {}),
        competencyTags:gap.competencyTags, difficulty:gap.difficulty, requiredCount:gap.requiredCount,
        availableCount:gap.availableCount, gapCount:gap.gapCount, marksPerQuestion:gap.marksPerQuestion,
        assessmentPurpose:setup.assessmentPurpose ?? 'summative', priority:gap.gapCount >= 10 ? 'critical' : gap.gapCount >= 5 ? 'high' : 'medium',
        status:'open', source:'admin-question-paper-generator', createdBy:actorId,createdAt:serverTimestamp(),
        sourceTemplateId:setup.templateId,sourceTemplateName:setup.templateName,sourceSectionId:gap.sectionId,sourceSectionTitle:gap.sectionTitle,
        assignedAgent:null,updatedBy:actorId,updatedAt:serverTimestamp(),
      }});
    }
    await runTransaction(this.firebase.firestore, async transaction => {
      const parentSnapshot = await transaction.get(parent);
      if (parentSnapshot.exists() && ['completed','cancelled'].includes(parentSnapshot.data()['status'])) throw new Error('This paper request is closed. Start a new paper to request more questions.');
      // The parent is the idempotency boundary: retrying a request cannot reopen
      // completed work or replace priorities that the creator already processed.
      if (parentSnapshot.exists() && parentSnapshot.data()['prioritiesCreated'] === true) return;
      for (const item of prepared) transaction.set(item.ref,item.data);
      transaction.set(parent,{...setup,rules,id:requestId,source:'admin-question-paper-generator',status:'creating-questions',
        prioritiesCreated:true,childPriorityIds:prepared.map(item => item.ref.id),
        progress:{requestedChapters:new Set(gaps.map(item => chapterKey(item))).size,completedChapters:0,pendingReview:0},
        ...(parentSnapshot.exists() ? {} : {createdBy:actorId,createdAt:serverTimestamp()}),updatedAt:serverTimestamp()}, {merge:true});
    });
    return prepared.length;
  }
}

export interface PaperRequestRecord extends PaperGenerationSetup {
  id: string; status: string; childPriorityIds?: string[]; rules:GenerationRule[]; prioritiesCreated?:boolean;
  progress?: {requestedChapters:number;completedChapters:number;pendingReview:number};
}
