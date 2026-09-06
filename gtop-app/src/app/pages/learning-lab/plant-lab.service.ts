import { Injectable, inject } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  startAfter,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from '@angular/fire/firestore';
import {
  Answers,
  LabAttempt,
  LabChange,
  appendAttempt,
  changeAttempt,
  newAttempt,
  readHistory,
} from './plant-attempt';

export interface LearnerAttempts {
  uid: string;
  name: string;
  attempts: LabAttempt[];
}
@Injectable({ providedIn: 'root' })
export class PlantLabService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  watchAccount(changed: () => void): () => void {
    let first = true;
    let previous = this.auth.currentUser?.uid;
    return onAuthStateChanged(this.auth, user => {
      const uid = user?.uid;
      if (!first && uid !== previous) changed();
      first = false; previous = uid;
    });
  }
  private sameAccount(uid: string) {
    if (this.auth.currentUser?.uid !== uid) throw new Error('Your signed-in account changed.');
  }
  private async ownRef() {
    await this.auth.authStateReady();
    if (!this.auth.currentUser)
      throw new Error('Please sign in again to save your progress.');
    return doc(this.firestore, 'users', this.auth.currentUser.uid);
  }
  async load(): Promise<LabAttempt[]> {
    const ref = await this.ownRef();
    const snapshot = await getDoc(ref);
    this.sameAccount(ref.id);
    if (!snapshot.exists())
      throw new Error('Complete your GTOP profile before saving an attempt.');
    return readHistory(snapshot.data()['plantLab']);
  }
  async isAdmin(): Promise<boolean> {
    const ref = await this.ownRef();
    const snapshot = await getDoc(ref);
    this.sameAccount(ref.id);
    return snapshot.data()?.['role'] === 'admin';
  }
  async start(answers: Answers): Promise<LabAttempt> {
    const ref = await this.ownRef();
    const attempt = newAttempt(crypto.randomUUID(), answers, Date.now());
    return runTransaction(this.firestore, async (tx) => {
      this.sameAccount(ref.id);
      const snapshot = await tx.get(ref);
      this.sameAccount(ref.id);
      if (!snapshot.exists())
        throw new Error('Complete your GTOP profile before saving an attempt.');
      const attempts = appendAttempt(
        readHistory(snapshot.data()['plantLab']),
        attempt,
      );
      tx.update(ref, { plantLab: { lessonId: 'plant-reproduction', attempts } });
      return attempt;
    });
  }
  async change(id: string, change: LabChange): Promise<LabAttempt> {
    const ref = await this.ownRef();
    return runTransaction(this.firestore, async (tx) => {
      this.sameAccount(ref.id);
      const snapshot = await tx.get(ref);
      this.sameAccount(ref.id);
      const history = readHistory(snapshot.data()?.['plantLab']);
      const existing = history.find((a) => a.id === id);
      if (!existing)
        throw new Error(
          'This attempt is no longer saved. Return to Learning Lab and open your latest attempt.',
        );
      const updated = changeAttempt(existing, change, Date.now());
      tx.update(ref, {
        plantLab: {
          lessonId: 'plant-reproduction',
          attempts: history.map((a) => (a.id === id ? updated : a)),
        },
      });
      return updated;
    });
  }
  // Existing users permissions allow only the owner or GTOP admins to read these records.
  // Paginate learners to bound reads; every aggregate is labelled with the loaded sample size.
  async results(
    cursor?: QueryDocumentSnapshot<DocumentData>,
  ): Promise<{
    rows: LearnerAttempts[];
    cursor?: QueryDocumentSnapshot<DocumentData>;
    more: boolean;
  }> {
    const ref = await this.ownRef();
    if (!(await this.isAdmin()))
      throw new Error('Only GTOP admins can view learner feedback.');
    const base = collection(this.firestore, 'users');
    const constraints = [
      where('plantLab.lessonId', '==', 'plant-reproduction'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(51),
    ];
    const snapshot = await getDocs(query(base, ...constraints));
    this.sameAccount(ref.id);
    const docs = snapshot.docs.slice(0, 50);
    return {
      rows: docs.map((d) => ({
        uid: d.id,
        name: String(d.data()['displayName'] || 'GTOP learner'),
        attempts: readHistory(d.data()['plantLab']),
      })),
      cursor: docs.at(-1),
      more: snapshot.size > 50,
    };
  }
}
