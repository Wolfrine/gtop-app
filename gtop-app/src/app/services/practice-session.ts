export interface PracticeSession {
  version: 1;
  uid: string;
  role: string;
  routeKey: string;
  attemptId: string;
  quizType: 'quick' | 'custom' | 'retry';
  source?: { kind: 'invitation'; attemptId: string; revision: string };
  questions: any[];
  currentQuestionIndex: number;
  completed: boolean;
  saved: boolean;
  returnTo?: string | null;
  hubReturnPath?: string | null;
}

const SESSION_KEY = 'gtop.practice-session.v1';
export const practiceSessionKey = (uid: string) => `${SESSION_KEY}.${encodeURIComponent(uid)}`;
function tabStorage(): Storage | undefined {
  try { return globalThis.sessionStorage; } catch { return undefined; }
}
export function createPracticeAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() || `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function readPracticeSession(uid: string, storage: Storage | undefined = tabStorage()): PracticeSession | null {
  try {
    const owned = storage?.getItem(practiceSessionKey(uid));
    const value = JSON.parse(owned || storage?.getItem(SESSION_KEY) || 'null');
    if (!uid || value?.version !== 1 || value.uid !== uid || !value.attemptId || !value.routeKey ||
      !['quick', 'custom', 'retry'].includes(value.quizType) || !Array.isArray(value.questions) || !value.questions.length ||
      !Number.isInteger(value.currentQuestionIndex) || value.currentQuestionIndex < 0 || value.currentQuestionIndex >= value.questions.length ||
      typeof value.completed !== 'boolean' || typeof value.saved !== 'boolean') return null;
    if (!owned) {
      try { storage?.setItem(practiceSessionKey(uid), JSON.stringify(value)); } catch { /* Legacy restoration also works without storage. */ }
    }
    return value;
  } catch { return null; }
}
export function writePracticeSession(session: PracticeSession, storage: Storage | undefined = tabStorage()): void {
  try {
    // Migrate an older tab's owner before a different account replaces the legacy pointer.
    const legacyUid = JSON.parse(storage?.getItem(SESSION_KEY) || 'null')?.uid;
    if (typeof legacyUid === 'string' && legacyUid !== session.uid) readPracticeSession(legacyUid, storage);
    const value = JSON.stringify(session);
    storage?.setItem(practiceSessionKey(session.uid), value);
    // Keep a latest-session pointer for older tabs; account-owned records are authoritative.
    storage?.setItem(SESSION_KEY, value);
  } catch { /* Storage is optional; in-memory practice remains usable. */ }
}
export function clearPracticeSession(storage: Storage | undefined = tabStorage()): void {
  try {
    const uid = JSON.parse(storage?.getItem(SESSION_KEY) || 'null')?.uid;
    if (typeof uid === 'string') storage?.removeItem(practiceSessionKey(uid));
    storage?.removeItem(SESSION_KEY);
  } catch { /* Private browsing can disable storage. */ }
}
