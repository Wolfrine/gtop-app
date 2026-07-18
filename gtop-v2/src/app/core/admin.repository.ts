import { Injectable } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { FirebaseClient } from './firebase';
import { FirestoreRecord, GtopUser, Question, SyllabusItem } from './models';

@Injectable({ providedIn: 'root' })
export class AdminRepository {
  constructor(private readonly firebase: FirebaseClient) {}

  async counts(): Promise<Record<string, number>> {
    const names = ['questions', 'users', 'QuizResults', 'LiveSessions', 'actionPlans'];
    const values = await Promise.all(names.map(async (name) => (await getCountFromServer(collection(this.firebase.firestore, name))).data().count));
    return Object.fromEntries(names.map((name, index) => [name, values[index]]));
  }

  async questions(filters: Partial<Pick<Question, 'board' | 'standard' | 'subject' | 'chapter'>>, max = 100): Promise<Question[]> {
    const constraints = [];
    if (filters.board) constraints.push(where('board', '==', filters.board));
    if (filters.standard) constraints.push(where('standard', '==', filters.standard));
    if (filters.subject) constraints.push(where('subject', '==', filters.subject));
    if (filters.chapter) constraints.push(where('chapter', '==', filters.chapter));
    constraints.push(limit(Math.min(max, 200)));
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'questions'), ...constraints));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Question);
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
    const created = await addDoc(collection(this.firebase.firestore, 'questions'), { ...data, createdAt: serverTimestamp(), createdBy: actorId });
    return created.id;
  }

  async softDeleteQuestion(question: Question, actorId: string): Promise<void> {
    const batch = writeBatch(this.firebase.firestore);
    batch.set(doc(this.firebase.firestore, 'deletedQuestions', question.id), { ...question, deletedAt: serverTimestamp(), deletedBy: actorId });
    batch.delete(doc(this.firebase.firestore, 'questions', question.id));
    await batch.commit();
  }

  async syllabus(): Promise<SyllabusItem[]> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'syllabus'), limit(500)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SyllabusItem);
  }

  async saveSyllabus(value: Partial<SyllabusItem>): Promise<string> {
    const data = {
      board: value.board ?? '', standard: value.standard ?? '', subject: value.subject ?? '', chapter: value.chapter ?? '',
      mcqCount: value.mcqCount ?? 0, updatedAt: serverTimestamp(),
    };
    if (value.id) {
      await updateDoc(doc(this.firebase.firestore, 'syllabus', value.id), data);
      return value.id;
    }
    const created = await addDoc(collection(this.firebase.firestore, 'syllabus'), { ...data, createdAt: serverTimestamp() });
    return created.id;
  }

  async users(): Promise<GtopUser[]> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'users'), limit(300)));
    return snapshot.docs.map((item) => ({ id: item.id, uid: item.id, ...item.data() }) as unknown as GtopUser);
  }

  async setRole(uid: string, role: GtopUser['role']): Promise<void> {
    await setDoc(doc(this.firebase.firestore, 'users', uid), { role, updatedAt: serverTimestamp() }, { merge: true });
  }

  async logs(): Promise<FirestoreRecord[]> {
    try {
      const snapshot = await getDocs(query(collection(this.firebase.firestore, 'activity'), orderBy('timestamp', 'desc'), limit(100)));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    } catch {
      const snapshot = await getDocs(query(collection(this.firebase.firestore, 'activity'), limit(100)));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    }
  }
}
