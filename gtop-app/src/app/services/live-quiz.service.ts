import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import {
  CreateSessionOptions,
  LiveAnswerItem,
  LiveParticipant,
  LiveSession,
  ComputeScheduleResult
} from '../shared/models/live-quiz.models';

@Injectable({ providedIn: 'root' })
export class LiveQuizService {
  private sessionsCol = collection(this.firestore, 'LiveSessions');

  constructor(private firestore: Firestore, private auth: Auth) {}

  /**
   * Create a new live session document with scheduling and question IDs.
   */
  async createSession(opts: CreateSessionOptions): Promise<{ sessionId: string; joinCode: string }> {
    const joinCode = this.generateJoinCode();

    // Effective start = quiz start time (lobby opens "buffer" before this in UI logic)
    const effectiveStartAt = opts.scheduledStartAt;

    const sessionId = doc(this.sessionsCol).id;
    const sessionRef = doc(this.firestore, `LiveSessions/${sessionId}`);

    const payload: LiveSession = {
      hostId: opts.hostId,
      hostName: opts.hostName,
      joinCode,
      scope: opts.scope,
      questionIds: [...opts.questionIds],
      scheduledStartAt: opts.scheduledStartAt,
      bufferSeconds: opts.bufferSeconds,
      perQuestionSeconds: opts.perQuestionSeconds,
      effectiveStartAt,
      autoAdvance: opts.autoAdvance ?? true,
      status: 'lobby',
      overrideIndex: null,
      overrideAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      resultLinked: false
    };

    await setDoc(sessionRef, payload);
    return { sessionId, joinCode };
  }

  /**
   * Find a lobby session by join code and add/update participant record.
   */
  async joinSessionByCode(code: string, user: { uid: string; displayName: string; photoURL?: string | null }): Promise<{ sessionId: string } | null> {
    const q = query(this.sessionsCol, where('joinCode', '==', code), where('status', '==', 'lobby'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const sessionId = snap.docs[0].id;
    const participantRef = doc(this.firestore, `LiveSessions/${sessionId}/participants/${user.uid}`);

    const participant: LiveParticipant = {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      joinedAt: serverTimestamp(),
      ready: true
    };

    await setDoc(participantRef, participant, { merge: true } as any);
    return { sessionId };
  }

  /**
   * Subscribe to session document changes.
   */
  observeSession<T = LiveSession>(sessionId: string, cb: (session: T | null) => void): () => void {
    const ref = doc(this.firestore, `LiveSessions/${sessionId}`);
    return onSnapshot(ref, (docSnap) => {
      cb((docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as unknown as T) : null));
    });
  }

  /**
   * Subscribe to participants collection under a session.
   */
  observeParticipants(sessionId: string, cb: (participants: LiveParticipant[]) => void): () => void {
    const col = collection(this.firestore, `LiveSessions/${sessionId}/participants`);
    return onSnapshot(col, (snap) => {
      const items: LiveParticipant[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      cb(items);
    });
  }

  /**
   * Subscribe to answers for a given question index (leaderboard without correctness).
   */
  observeAnswers(sessionId: string, index: number, cb: (answers: LiveAnswerItem[]) => void): () => void {
    const col = collection(this.firestore, `LiveSessions/${sessionId}/answers/${String(index)}/items`);
    return onSnapshot(col, (snap) => {
      const items: LiveAnswerItem[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      cb(items);
    });
  }

  /**
   * Fetch MCQs for the given session using chunked `in` queries on `questions`.
   */
  async fetchQuestionsForSession(session: LiveSession): Promise<any[]> {
    const ids = Array.from(new Set(session.questionIds));
    const chunkSize = 10;
    const results: any[] = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      if (chunk.length === 1) {
        const ref = doc(this.firestore, `questions/${chunk[0]}`);
        const snap = await getDoc(ref as any);
        if (snap.exists()) results.push({ id: snap.id, ...(snap.data() as any), selectedIndex: null });
      } else {
        const col = collection(this.firestore, 'questions');
        const q = query(col, where('__name__', 'in', chunk));
        const snap = await getDocs(q as any);
        snap.docs.forEach(d => results.push({ id: d.id, ...(d.data() as any), selectedIndex: null }));
      }
    }

    return results;
  }

  /**
   * Compute schedule helpers: effective start and per-index start times.
   */
  computeSchedule(session: LiveSession): ComputeScheduleResult {
    const effectiveStart = new Date(session.effectiveStartAt.toMillis());
    const perMs = session.perQuestionSeconds * 1000;
    return {
      effectiveStartAt: effectiveStart,
      indexStartAt: (index: number) => new Date(effectiveStart.getTime() + index * perMs)
    };
  }

  /**
   * Submit an answer for the current user at a given question index.
   */
  async submitAnswer(sessionId: string, index: number, selectedIndex: number, questionStartAt: Date): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const responseMs = Math.max(0, Date.now() - questionStartAt.getTime());
    const ref = doc(this.firestore, `LiveSessions/${sessionId}/answers/${String(index)}/items/${user.uid}`);
    const item: LiveAnswerItem = {
      uid: user.uid,
      displayName: user.displayName || 'Anonymous',
      selectedIndex,
      submittedAt: serverTimestamp(),
      responseMs
    };
    await setDoc(ref, item, { merge: true } as any);
  }

  /**
   * Host-only: override the next question index.
   */
  async overrideNext(sessionId: string, nextIndex: number): Promise<void> {
    const ref = doc(this.firestore, `LiveSessions/${sessionId}`);
    await setDoc(ref, { overrideIndex: nextIndex, overrideAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true } as any);
  }

  /**
   * Mark session as ended.
   */
  async endSession(sessionId: string): Promise<void> {
    const ref = doc(this.firestore, `LiveSessions/${sessionId}`);
    await setDoc(ref, { status: 'ended', updatedAt: serverTimestamp() }, { merge: true } as any);
  }

  private generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
