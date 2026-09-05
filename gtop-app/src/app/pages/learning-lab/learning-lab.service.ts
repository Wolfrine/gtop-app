import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
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
import { CanActivateFn, Router } from '@angular/router';
import {
  Answers,
  LabAttempt,
  LabChange,
  appendAttempt,
  changeAttempt,
  newAttempt,
  readHistory,
} from './attempt';

export const labGuard: CanActivateFn = async (route) => {
  const auth = inject(Auth),
    firestore = inject(Firestore),
    router = inject(Router);
  await auth.authStateReady();
  if (!auth.currentUser) return router.createUrlTree(['/']);
  if (!route.data['adminOnly']) return true;
  try {
    const profile = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
    return (
      profile.data()?.['role'] === 'admin' ||
      router.createUrlTree(['/learning-lab'])
    );
  } catch {
    return router.createUrlTree(['/learning-lab']);
  }
};

export interface LearnerAttempts {
  uid: string;
  name: string;
  attempts: LabAttempt[];
}
@Injectable({ providedIn: 'root' })
export class LearningLabService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private async ownRef() {
    await this.auth.authStateReady();
    if (!this.auth.currentUser)
      throw new Error('Please sign in again to save your progress.');
    return doc(this.firestore, 'users', this.auth.currentUser.uid);
  }
  async load(): Promise<LabAttempt[]> {
    const snapshot = await getDoc(await this.ownRef());
    if (!snapshot.exists())
      throw new Error('Complete your GTOP profile before saving an attempt.');
    return readHistory(snapshot.data()['learningLab']);
  }
  async isAdmin(): Promise<boolean> {
    return (await getDoc(await this.ownRef())).data()?.['role'] === 'admin';
  }
  async start(answers: Answers): Promise<LabAttempt> {
    const ref = await this.ownRef();
    const attempt = newAttempt(crypto.randomUUID(), answers, Date.now());
    return runTransaction(this.firestore, async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists())
        throw new Error('Complete your GTOP profile before saving an attempt.');
      const attempts = appendAttempt(
        readHistory(snapshot.data()['learningLab']),
        attempt,
      );
      tx.update(ref, { learningLab: { lessonId: 'current-lab', attempts } });
      return attempt;
    });
  }
  async change(id: string, change: LabChange): Promise<LabAttempt> {
    const ref = await this.ownRef();
    return runTransaction(this.firestore, async (tx) => {
      const snapshot = await tx.get(ref);
      const history = readHistory(snapshot.data()?.['learningLab']);
      const existing = history.find((a) => a.id === id);
      if (!existing)
        throw new Error(
          'This attempt is no longer saved. Return to Learning Lab and open your latest attempt.',
        );
      const updated = changeAttempt(existing, change, Date.now());
      tx.update(ref, {
        learningLab: {
          lessonId: 'current-lab',
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
    if (!(await this.isAdmin()))
      throw new Error('Only GTOP admins can view learner feedback.');
    const base = collection(this.firestore, 'users');
    const constraints = [
      where('learningLab.lessonId', '==', 'current-lab'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(51),
    ];
    const snapshot = await getDocs(query(base, ...constraints));
    const docs = snapshot.docs.slice(0, 50);
    return {
      rows: docs.map((d) => ({
        uid: d.id,
        name: String(d.data()['displayName'] || 'GTOP learner'),
        attempts: readHistory(d.data()['learningLab']),
      })),
      cursor: docs.at(-1),
      more: snapshot.size > 50,
    };
  }
}
