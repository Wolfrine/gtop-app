import { Injectable } from '@angular/core';
import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { FirebaseClient } from './firebase';
import { LiveSession } from './models';

@Injectable({ providedIn: 'root' })
export class LiveRepository {
  constructor(private readonly firebase: FirebaseClient) {}

  observeSessions(callback: (sessions: LiveSession[]) => void): () => void {
    return onSnapshot(query(collection(this.firebase.firestore, 'LiveSessions'), limit(50)), (snapshot) => {
      const sessions = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as LiveSession)
        .filter((session) => session.status !== 'ended');
      callback(sessions);
    });
  }

  observeSession(id: string, callback: (session: LiveSession | null) => void): () => void {
    return onSnapshot(doc(this.firebase.firestore, 'LiveSessions', id), (snapshot) => callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() }) as LiveSession : null));
  }

  async create(input: Omit<LiveSession, 'id' | 'joinCode' | 'status'> & { status?: LiveSession['status'] }): Promise<LiveSession> {
    const joinCode = this.joinCode();
    const created = await addDoc(collection(this.firebase.firestore, 'LiveSessions'), {
      ...input,
      joinCode,
      status: input.status ?? 'lobby',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: created.id, joinCode, status: input.status ?? 'lobby', ...input };
  }

  async findByCode(code: string): Promise<LiveSession | null> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'LiveSessions'), where('joinCode', '==', code.toUpperCase()), limit(1)));
    return snapshot.empty ? null : ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() }) as LiveSession;
  }

  async join(sessionId: string, user: { uid: string; displayName: string; photoURL?: string | null }): Promise<void> {
    await setDoc(doc(this.firebase.firestore, `LiveSessions/${sessionId}/participants/${user.uid}`), { ...user, ready: true, joinedAt: serverTimestamp() }, { merge: true });
  }

  async updateSession(id: string, changes: Partial<LiveSession>): Promise<void> {
    const safe = { ...changes } as Record<string, unknown>;
    delete safe['id'];
    await updateDoc(doc(this.firebase.firestore, 'LiveSessions', id), { ...safe, updatedAt: serverTimestamp() });
  }

  async submitAnswer(sessionId: string, index: number, selectedIndex: number, user: { uid: string; displayName: string }, responseMs: number): Promise<void> {
    await setDoc(doc(this.firebase.firestore, `LiveSessions/${sessionId}/answers/${index}/items/${user.uid}`), {
      uid: user.uid, displayName: user.displayName, selectedIndex, responseMs, submittedAt: serverTimestamp(),
    }, { merge: true });
  }

  observeParticipants(sessionId: string, callback: (participants: Array<Record<string, unknown>>) => void): () => void {
    return onSnapshot(collection(this.firebase.firestore, `LiveSessions/${sessionId}/participants`), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
  }

  private joinCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  }
}
