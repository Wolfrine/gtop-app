import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { FirebaseClient } from './firebase';
import {
  FirestoreRecord,
  GtopUser,
  LiveSession,
  Question,
  QuizResult,
  SyllabusItem,
  asDate,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminRepository {
  constructor(private readonly firebase: FirebaseClient) {}

  async counts(): Promise<Record<string, number>> {
    const names = ['questions', 'users', 'QuizResults', 'LiveSessions', 'actionPlans'];
    const values = await Promise.all(
      names.map(
        async (name) =>
          (await getCountFromServer(collection(this.firebase.firestore, name))).data().count,
      ),
    );
    return Object.fromEntries(names.map((name, index) => [name, values[index]]));
  }

  async countMetric(
    metric: 'questions' | 'users' | 'QuizResults' | 'openLiveSessions' | 'activeWork',
  ): Promise<number> {
    const target =
      metric === 'openLiveSessions'
        ? query(
            collection(this.firebase.firestore, 'LiveSessions'),
            where('status', 'in', ['scheduled', 'lobby', 'active']),
          )
        : metric === 'activeWork'
          ? query(
              collection(this.firebase.firestore, 'actionPlans'),
              where('status', 'in', ['planned', 'in-progress', 'blocked', 'review']),
            )
          : collection(this.firebase.firestore, metric);
    return (await getCountFromServer(target)).data().count;
  }

  async questions(
    filters: Partial<Pick<Question, 'board' | 'standard' | 'subject' | 'chapter'>>,
    max = 100,
  ): Promise<Question[]> {
    const constraints = [];
    if (filters.board) constraints.push(where('board', '==', filters.board));
    if (filters.standard) constraints.push(where('standard', '==', filters.standard));
    if (filters.subject) constraints.push(where('subject', '==', filters.subject));
    if (filters.chapter) constraints.push(where('chapter', '==', filters.chapter));
    constraints.push(limit(Math.min(max, 200)));
    const snapshot = await getDocs(
      query(collection(this.firebase.firestore, 'questions'), ...constraints),
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Question);
  }

  async questionPage(
    filters: Partial<Pick<Question, 'board' | 'standard' | 'subject' | 'chapter'>>,
    pageSize = 25,
    cursor?: QueryDocumentSnapshot<DocumentData>,
  ): Promise<{ items: Question[]; cursor?: QueryDocumentSnapshot<DocumentData> }> {
    const constraints = [];
    if (filters.board) constraints.push(where('board', '==', filters.board));
    if (filters.standard) constraints.push(where('standard', '==', filters.standard));
    if (filters.subject) constraints.push(where('subject', '==', filters.subject));
    if (filters.chapter) constraints.push(where('chapter', '==', filters.chapter));
    constraints.push(orderBy(documentId()), limit(pageSize));
    if (cursor) constraints.push(startAfter(cursor));
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'questions'), ...constraints));
    return {
      items: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Question),
      cursor: snapshot.docs.length === pageSize ? snapshot.docs.at(-1) : undefined,
    };
  }

  async duplicateQuestionTexts(values: string[]): Promise<Set<string>> {
    const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    const duplicates = new Set<string>();
    for (let offset = 0; offset < unique.length; offset += 30) {
      const chunk = unique.slice(offset, offset + 30);
      const snapshot = await getDocs(
        query(collection(this.firebase.firestore, 'questions'), where('question', 'in', chunk)),
      );
      snapshot.docs.forEach((item) =>
        duplicates.add(String(item.data()['question']).trim().toLowerCase()),
      );
    }
    return duplicates;
  }

  async saveQuestion(value: Partial<Question>, actorId: string): Promise<string> {
    const data = {
      board: value.board ?? 'Unknown',
      standard: value.standard ?? 'Unknown',
      subject: value.subject ?? 'General',
      chapter: value.chapter ?? 'General',
      title: value.title ?? '',
      question: value.question ?? '',
      options: value.options ?? [],
      correctIndex: value.correctIndex ?? 0,
      solutions: value.solutions ?? [],
      updatedAt: serverTimestamp(),
      updatedBy: actorId,
    };
    if (value.id) {
      await updateDoc(doc(this.firebase.firestore, 'questions', value.id), data);
      return value.id;
    }
    const created = await addDoc(collection(this.firebase.firestore, 'questions'), {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: actorId,
    });
    return created.id;
  }

  async softDeleteQuestion(question: Question, actorId: string): Promise<void> {
    const batch = writeBatch(this.firebase.firestore);
    batch.set(doc(this.firebase.firestore, 'deletedQuestions', question.id), {
      ...question,
      deletedAt: serverTimestamp(),
      deletedBy: actorId,
    });
    batch.delete(doc(this.firebase.firestore, 'questions', question.id));
    await batch.commit();
  }

  async syllabus(): Promise<SyllabusItem[]> {
    const snapshot = await getDocs(
      query(collection(this.firebase.firestore, 'syllabus'), limit(500)),
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SyllabusItem);
  }

  async saveSyllabus(value: Partial<SyllabusItem>): Promise<string> {
    const data = {
      board: value.board ?? '',
      standard: value.standard ?? '',
      subject: value.subject ?? '',
      chapter: value.chapter ?? '',
      mcqCount: value.mcqCount ?? 0,
      updatedAt: serverTimestamp(),
    };
    if (value.id) {
      await updateDoc(doc(this.firebase.firestore, 'syllabus', value.id), data);
      return value.id;
    }
    const created = await addDoc(collection(this.firebase.firestore, 'syllabus'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return created.id;
  }

  async syllabusPreview(): Promise<FirestoreRecord[]> {
    const snapshot = await getDocs(
      query(collection(this.firebase.firestore, 'syllabus-preview'), limit(1000)),
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  async prepareSyllabusPreview(actorId: string): Promise<FirestoreRecord[]> {
    const [current, previous] = await Promise.all([this.syllabus(), this.syllabusPreview()]);
    const previousById = new Map(previous.map((item) => [item.id, item]));
    const currentIds = new Set(current.map((item) => item.id));
    const rows: FirestoreRecord[] = current.map((item) => {
      const old = previousById.get(item.id);
      const changed = old && ['board', 'standard', 'subject', 'chapter'].some((key) => old[key] !== item[key as keyof SyllabusItem]);
      return { ...item, status: !old ? 'new' : changed ? 'changed' : 'existing' };
    });
    rows.push(...previous.filter((item) => !currentIds.has(item.id)).map((item) => ({ ...item, status: 'absent' })));
    for (let offset = 0; offset < rows.length; offset += 400) {
      const batch = writeBatch(this.firebase.firestore);
      rows.slice(offset, offset + 400).forEach((item) => {
        const { id, ...data } = item;
        batch.set(doc(this.firebase.firestore, 'syllabus-preview', id), {
          ...data,
          preparedBy: actorId,
          preparedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
    return rows;
  }

  async publishSyllabusPreview(actorId: string): Promise<void> {
    const rows = await this.syllabusPreview();
    for (let offset = 0; offset < rows.length; offset += 400) {
      const batch = writeBatch(this.firebase.firestore);
      rows.slice(offset, offset + 400).forEach((item) => {
        batch.update(doc(this.firebase.firestore, 'syllabus-preview', item.id), {
          status: item['status'] === 'absent' ? 'absent' : 'existing',
          publishedBy: actorId,
          publishedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
    await this.log('publish-syllabus-preview', actorId, `Published ${rows.length} syllabus preview records.`);
  }

  async refreshSyllabusCounts(actorId?: string): Promise<number> {
    const [syllabus, questions] = await Promise.all([
      this.syllabus(),
      getDocs(query(collection(this.firebase.firestore, 'questions'), limit(5000))),
    ]);
    const counts = new Map<string, number>();
    for (const entry of questions.docs) {
      const q = entry.data();
      const key = `${q['board']}|${q['standard']}|${q['subject']}|${q['chapter']}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (let offset = 0; offset < syllabus.length; offset += 400) {
      const batch = writeBatch(this.firebase.firestore);
      for (const item of syllabus.slice(offset, offset + 400)) {
        const key = `${item.board}|${item.standard}|${item.subject}|${item.chapter}`;
        batch.update(doc(this.firebase.firestore, 'syllabus', item.id), {
          mcqCount: counts.get(key) ?? 0,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    if (actorId)
      await this.log(
        'refresh-syllabus-counts',
        actorId,
        `Refreshed counts for ${syllabus.length} syllabus combinations.`,
      );
    return syllabus.length;
  }

  async updateSyllabusAndQuestions(
    value: Partial<SyllabusItem>,
    original: SyllabusItem,
    actorId: string,
  ): Promise<number> {
    const changed = ['board', 'standard', 'subject', 'chapter'].some(
      (key) =>
        String(value[key as keyof SyllabusItem] ?? '') !==
        String(original[key as keyof SyllabusItem] ?? ''),
    );
    let affected = 0;
    if (changed) {
      const snapshot = await getDocs(
        query(
          collection(this.firebase.firestore, 'questions'),
          where('board', '==', original.board),
          where('standard', '==', original.standard),
          where('subject', '==', original.subject),
          where('chapter', '==', original.chapter),
          limit(5000),
        ),
      );
      affected = snapshot.size;
      for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
        const batch = writeBatch(this.firebase.firestore);
        for (const item of snapshot.docs.slice(offset, offset + 400)) {
          batch.update(item.ref, {
            board: value.board ?? original.board,
            standard: value.standard ?? original.standard,
            subject: value.subject ?? original.subject,
            chapter: value.chapter ?? original.chapter,
            updatedAt: serverTimestamp(),
            updatedBy: actorId,
          });
        }
        await batch.commit();
      }
    }
    await this.saveSyllabus(value);
    await this.log(
      'update-syllabus',
      actorId,
      `Updated syllabus and ${affected} linked questions.`,
      {
        syllabusId: original.id,
        before: {
          board: original.board,
          standard: original.standard,
          subject: original.subject,
          chapter: original.chapter,
        },
        after: {
          board: value.board,
          standard: value.standard,
          subject: value.subject,
          chapter: value.chapter,
        },
        affectedDocuments: affected,
      },
    );
    return affected;
  }

  async importQuestions(values: Array<Partial<Question>>, actorId: string): Promise<number> {
    let created = 0;
    for (let offset = 0; offset < values.length; offset += 350) {
      const batch = writeBatch(this.firebase.firestore);
      for (const value of values.slice(offset, offset + 350)) {
        const ref = doc(collection(this.firebase.firestore, 'questions'));
        batch.set(ref, {
          board: value.board ?? 'Unknown',
          standard: value.standard ?? 'Unknown',
          subject: value.subject ?? 'General',
          chapter: value.chapter ?? 'General',
          title: value.title ?? '',
          question: value.question ?? '',
          options: value.options ?? [],
          correctIndex: value.correctIndex ?? 0,
          solutions: value.solutions ?? [],
          createdAt: serverTimestamp(),
          createdBy: actorId,
          updatedAt: serverTimestamp(),
          updatedBy: actorId,
        });
        created++;
      }
      await batch.commit();
    }
    await this.log('bulk-import-questions', actorId, `Imported ${created} questions.`);
    await this.ensureSyllabusCombinations(values);
    await this.refreshSyllabusCounts();
    return created;
  }

  async openQuestionFlags(): Promise<FirestoreRecord[]> {
    const snapshot = await getDocs(
      query(
        collection(this.firebase.firestore, 'questionFlags'),
        where('status', '==', 'open'),
        limit(200),
      ),
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  private async ensureSyllabusCombinations(values: Array<Partial<Question>>): Promise<void> {
    const existing = await this.syllabus();
    const keys = new Set(existing.map((i) => `${i.board}|${i.standard}|${i.subject}|${i.chapter}`));
    const missing = new Map<string, Partial<Question>>();
    for (const q of values) {
      const key = `${q.board}|${q.standard}|${q.subject}|${q.chapter}`;
      if (!keys.has(key)) missing.set(key, q);
    }
    for (const value of missing.values())
      await addDoc(collection(this.firebase.firestore, 'syllabus'), {
        board: value.board ?? '',
        standard: value.standard ?? '',
        subject: value.subject ?? '',
        chapter: value.chapter ?? '',
        mcqCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  }

  async users(): Promise<GtopUser[]> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'users'), limit(300)));
    return snapshot.docs.map(
      (item) => ({ id: item.id, uid: item.id, ...item.data() }) as unknown as GtopUser,
    );
  }

  async setRole(uid: string, role: GtopUser['role']): Promise<void> {
    await setDoc(
      doc(this.firebase.firestore, 'users', uid),
      { role, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }

  async user(uid: string): Promise<GtopUser | null> {
    const snapshot = await getDoc(doc(this.firebase.firestore, 'users', uid));
    return snapshot.exists() ? ({ uid: snapshot.id, ...snapshot.data() } as GtopUser) : null;
  }

  async resultsForUser(uid: string): Promise<QuizResult[]> {
    const snapshot = await getDocs(
      query(
        collection(this.firebase.firestore, 'QuizResults'),
        where('userId', '==', uid),
        limit(200),
      ),
    );
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as QuizResult)
      .sort(
        (a, b) => (asDate(b.timestamp)?.getTime() ?? 0) - (asDate(a.timestamp)?.getTime() ?? 0),
      );
  }

  async recentResults(max = 300): Promise<QuizResult[]> {
    const snapshot = await getDocs(
      query(
        collection(this.firebase.firestore, 'QuizResults'),
        orderBy('timestamp', 'desc'),
        limit(Math.min(max, 500)),
      ),
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as QuizResult);
  }

  async liveSessionsForUser(uid: string): Promise<LiveSession[]> {
      const participants = await getDocs(
        query(
          collectionGroup(this.firebase.firestore, 'participants'),
          where('uid', '==', uid),
          limit(100),
        ),
      );
      const sessionIds = [
        ...new Set(
          participants.docs
            .map((item) => item.ref.parent.parent?.id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const sessions = await Promise.all(
        sessionIds.map(async (id) => {
          const value = await getDoc(doc(this.firebase.firestore, 'LiveSessions', id));
          return value.exists() ? ({ id: value.id, ...value.data() } as LiveSession) : null;
        }),
      );
      return sessions.filter((item): item is LiveSession => Boolean(item));
  }

  async resetLastLogin(uid: string, actorId: string): Promise<void> {
    await setDoc(
      doc(this.firebase.firestore, 'users', uid),
      { lastLogin: null, updatedAt: serverTimestamp() },
      { merge: true },
    );
    await addDoc(collection(this.firebase.firestore, 'activity'), {
      action: 'reset-last-login',
      userId: uid,
      editedBy: actorId,
      timestamp: serverTimestamp(),
      details: 'Administrator reset last-login metadata.',
    });
  }

  async log(
    action: string,
    actorId: string,
    details: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await addDoc(collection(this.firebase.firestore, 'activity'), {
      action,
      editedBy: actorId,
      details,
      ...metadata,
      timestamp: serverTimestamp(),
    });
  }

  async logs(): Promise<FirestoreRecord[]> {
    try {
      const snapshot = await getDocs(
        query(
          collection(this.firebase.firestore, 'activity'),
          orderBy('timestamp', 'desc'),
          limit(100),
        ),
      );
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    } catch {
      const snapshot = await getDocs(
        query(collection(this.firebase.firestore, 'activity'), limit(100)),
      );
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    }
  }
}
