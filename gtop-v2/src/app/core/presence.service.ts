import { Injectable, signal } from '@angular/core';
import { onAuthStateChanged } from 'firebase/auth';
import type { Database } from 'firebase/database';
import { FirebaseClient } from './firebase';
import { PresenceRecord } from './models';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  readonly records = signal<PresenceRecord[]>([]);
  readonly connected = signal(false);
  readonly error = signal('');
  private unsubscribeAll?: () => void;
  private unsubscribeOwn?: () => void;
  private unsubscribeConnection?: () => void;
  private readonly database: Promise<Database>;

  constructor(private readonly firebase: FirebaseClient) {
    this.database = import('firebase/database').then(({ getDatabase, connectDatabaseEmulator }) => {
      const db = getDatabase(firebase.app);
      if (typeof window !== 'undefined' && new URLSearchParams(location.search).has('emulator'))
        connectDatabaseEmulator(db, '127.0.0.1', 9000);
      return db;
    });
    onAuthStateChanged(firebase.auth, (user) => {
      this.unsubscribeOwn?.();
      if (user) {
        void this.markOnline(user.uid, user.displayName ?? 'GTOP user', user.email ?? '');
        void this.watchOwn(user.uid, user.displayName ?? 'GTOP user', user.email ?? '');
      }
    });
    void this.watchConnection();
    document.addEventListener('visibilitychange', () => {
      const user = firebase.auth.currentUser;
      if (user && document.visibilityState === 'visible')
        void this.markOnline(user.uid, user.displayName ?? 'GTOP user', user.email ?? '');
      if (user && document.visibilityState === 'hidden') void this.touch(user.uid);
    });
  }

  listenAll(): () => void {
    void Promise.all([this.database, import('firebase/database')]).then(
      ([db, { onValue, ref }]) => {
        this.unsubscribeAll?.();
        this.unsubscribeAll = onValue(
          ref(db, 'activeUsers'),
          (snapshot) => {
            const raw = snapshot.val() as Record<string, Omit<PresenceRecord, 'userId'>> | null;
            this.records.set(
              Object.entries(raw ?? {}).map(([userId, value]) => ({
                userId,
                ...value,
                isOnline: Boolean(value.isOnline),
              })),
            );
          },
          (error) => this.error.set(error.message),
        );
      },
    );
    return () => this.unsubscribeAll?.();
  }
  async getOne(uid: string): Promise<PresenceRecord | null> {
    const [db, { get, ref }] = await Promise.all([this.database, import('firebase/database')]);
    const snapshot = await get(ref(db, `activeUsers/${uid}`));
    return snapshot.exists() ? ({ userId: uid, ...snapshot.val() } as PresenceRecord) : null;
  }
  async markOffline(uid: string): Promise<void> {
    const [db, { update, ref }] = await Promise.all([this.database, import('firebase/database')]);
    await update(ref(db, `activeUsers/${uid}`), {
      userId: uid,
      isOnline: false,
      lastActive: Date.now(),
    });
  }
  private async touch(uid: string): Promise<void> {
    const [db, { update, ref }] = await Promise.all([this.database, import('firebase/database')]);
    await update(ref(db, `activeUsers/${uid}`), { lastActive: Date.now() }).catch(() => undefined);
  }
  private async markOnline(uid: string, displayName: string, email: string): Promise<void> {
    const [db, { set, ref, onDisconnect, serverTimestamp }] = await Promise.all([
      this.database,
      import('firebase/database'),
    ]);
    const userRef = ref(db, `activeUsers/${uid}`);
    try {
      await set(userRef, { userId: uid, displayName, email, isOnline: true, lastActive: Date.now() });
      await onDisconnect(userRef).update({ isOnline: false, lastActive: serverTimestamp() });
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Presence update failed');
      throw error;
    }
  }
  private async watchOwn(uid: string, displayName: string, email: string): Promise<void> {
    const [db, { onValue, ref }] = await Promise.all([this.database, import('firebase/database')]);
    this.unsubscribeOwn = onValue(ref(db, `activeUsers/${uid}`), (snapshot) => {
      if (!snapshot.exists() && this.firebase.auth.currentUser?.uid === uid)
        void this.markOnline(uid, displayName, email);
    });
  }
  private async watchConnection(): Promise<void> {
    const [db, { onValue, ref }] = await Promise.all([this.database, import('firebase/database')]);
    this.unsubscribeConnection?.();
    this.unsubscribeConnection = onValue(ref(db, '.info/connected'), (snapshot) => {
      const connected = snapshot.val() === true;
      this.connected.set(connected);
      const user = this.firebase.auth.currentUser;
      if (connected && user)
        void this.markOnline(user.uid, user.displayName ?? 'GTOP user', user.email ?? '');
    });
  }
}
