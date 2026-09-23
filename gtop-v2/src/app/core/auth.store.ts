import { Injectable, computed, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirebaseClient } from './firebase';
import { AuthState, GtopUser, UserRole } from './models';
import { PresenceService } from './presence.service';
import { DiagnosticsService } from './diagnostics.service';

const initialState: AuthState = {
  phase: 'initializing',
  firebaseUser: null,
  profile: null,
  role: null,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly state = signal<AuthState>(initialState);
  readonly profile = computed(() => this.state().profile);
  readonly role = computed(() => this.state().role);
  readonly isAdmin = computed(() => this.state().role === 'admin');
  readonly isAuthenticated = computed(() => this.state().phase === 'authenticated');

  private resolveReady!: (state: AuthState) => void;
  private readonly readyPromise = new Promise<AuthState>(
    (resolve) => (this.resolveReady = resolve),
  );
  private profileUnsubscribe?: () => void;
  private settled = false;
  private emulatorSignInPending = false;

  constructor(
    private readonly firebase: FirebaseClient,
    private readonly presence: PresenceService,
    private readonly diagnostics: DiagnosticsService,
  ) {
    const params = new URLSearchParams(location.search);
    const testEmail = params.get('testEmail');
    const testPassword = params.get('testPassword');
    const emulatorTestHost = ['127.0.0.1', 'localhost'].includes(location.hostname);
    this.emulatorSignInPending =
      emulatorTestHost && params.has('emulator') && Boolean(testEmail && testPassword);
    onAuthStateChanged(
      this.firebase.auth,
      (user) => void this.handleAuthChange(user),
      (error) => {
        this.diagnostics.captureError('auth', 'Firebase session listener failed.', error);
        this.finish({ ...initialState, phase: 'error', error: error.message });
      },
    );
    if (emulatorTestHost && params.has('emulator') && testEmail && testPassword)
      void signInWithEmailAndPassword(this.firebase.auth, testEmail, testPassword)
        .catch((error) => {
          this.diagnostics.captureError('auth', 'Emulator sign-in failed.', error);
          this.finish({ ...initialState, phase: 'error', error: error.message });
        })
        .finally(() => (this.emulatorSignInPending = false));
  }

  async ready(): Promise<AuthState> {
    // The promise gates initial restoration only. Sign-in, sign-out and role
    // changes must use the current state rather than the first resolved value.
    await this.readyPromise;
    return this.state();
  }

  async signIn(): Promise<GtopUser | null> {
    this.diagnostics.capture('info', 'auth', 'Google popup sign-in started.');
    try {
      const credential = await signInWithPopup(this.firebase.auth, new GoogleAuthProvider());
      const profile = await this.ensureProfile(credential.user);
      await this.handleAuthChange(credential.user);
      this.diagnostics.capture('info', 'auth', 'Google popup sign-in completed.');
      return profile;
    } catch (error) {
      this.diagnostics.captureError('auth', 'Google popup sign-in failed.', error);
      const code = String((error as { code?: unknown })?.code ?? '');
      if (
        [
          'auth/popup-blocked',
          'auth/operation-not-supported-in-this-environment',
          'auth/web-storage-unsupported',
        ].includes(code)
      ) {
        this.diagnostics.capture(
          'warning',
          'auth',
          'Popup sign-in is unavailable; continuing with redirect sign-in.',
          `code=${code}`,
          code,
        );
        await signInWithRedirect(this.firebase.auth, new GoogleAuthProvider());
        return null;
      }
      throw error;
    }
  }

  async signInWithGoogleIdToken(idToken: string): Promise<GtopUser> {
    this.diagnostics.capture('info', 'auth', 'Google One Tap sign-in started.');
    try {
      const credential = await signInWithCredential(
        this.firebase.auth,
        GoogleAuthProvider.credential(idToken),
      );
      const profile = await this.ensureProfile(credential.user);
      await this.handleAuthChange(credential.user);
      this.diagnostics.capture('info', 'auth', 'Google One Tap sign-in completed.');
      return profile;
    } catch (error) {
      this.diagnostics.captureError('auth', 'Google One Tap sign-in failed.', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.profileUnsubscribe?.();
    const uid = this.firebase.auth.currentUser?.uid;
    if (uid) await this.presence.markOffline(uid).catch(() => undefined);
    sessionStorage.removeItem('gtop-v2-quiz');
    sessionStorage.removeItem('gtop-v2-summary');
    await signOut(this.firebase.auth);
  }

  async updateProfile(
    changes: Partial<Pick<GtopUser, 'displayName' | 'board' | 'standard'>>,
  ): Promise<void> {
    const user = this.firebase.auth.currentUser;
    if (!user) throw new Error('Sign in before updating your profile.');
    await setDoc(
      doc(this.firebase.firestore, 'users', user.uid),
      { ...changes, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }

  private async handleAuthChange(user: import('firebase/auth').User | null): Promise<void> {
    this.profileUnsubscribe?.();
    if (!user) {
      if (this.emulatorSignInPending) return;
      this.diagnostics.capture('info', 'auth', 'No restored Firebase session was found.');
      this.finish({ ...initialState, phase: 'unauthenticated' });
      return;
    }
    try {
      const profile = await this.ensureProfile(user);
      this.finish({
        phase: 'authenticated',
        firebaseUser: user,
        profile,
        role: profile.role,
        error: null,
      });
      this.diagnostics.capture('info', 'auth', 'Firebase session and role loaded.');
      this.profileUnsubscribe = onSnapshot(
        doc(this.firebase.firestore, 'users', user.uid),
        (snapshot) => {
          if (!snapshot.exists()) return;
          const updated = this.toProfile(user, snapshot.data());
          this.state.set({
            phase: 'authenticated',
            firebaseUser: user,
            profile: updated,
            role: updated.role,
            error: null,
          });
        },
      );
    } catch (error) {
      this.diagnostics.captureError('auth', 'Firebase profile or role loading failed.', error);
      this.finish({
        phase: 'error',
        firebaseUser: user,
        profile: null,
        role: null,
        error: this.message(error),
      });
    }
  }

  private async ensureProfile(user: import('firebase/auth').User): Promise<GtopUser> {
    const ref = doc(this.firebase.firestore, 'users', user.uid);
    const snapshot = await getDoc(ref);
    const existing = snapshot.exists() ? snapshot.data() : {};
    if (!snapshot.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? null,
        role: 'user',
        board: null,
        standard: null,
        createdOn: serverTimestamp(),
      });
    } else {
      // Session readiness depends on the stored role, not on this best-effort login audit.
      // Firestore queues offline writes, so awaiting this can strand a restored session.
      void setDoc(
        ref,
        {
          lastLogin: serverTimestamp(),
          displayName: user.displayName ?? existing['displayName'] ?? '',
          email: user.email ?? existing['email'] ?? '',
          photoURL: user.photoURL ?? existing['photoURL'] ?? null,
        },
        { merge: true },
      ).catch((error) => this.diagnostics.captureError('auth', 'Login details could not be refreshed.', error));
    }
    return this.toProfile(user, existing);
  }

  private toProfile(user: import('firebase/auth').User, raw: Record<string, unknown>): GtopUser {
    const role = ['admin', 'institute-admin', 'user'].includes(String(raw['role']))
      ? (raw['role'] as UserRole)
      : 'user';
    return {
      uid: user.uid,
      displayName: String(raw['displayName'] ?? user.displayName ?? ''),
      email: String(raw['email'] ?? user.email ?? ''),
      photoURL: (raw['photoURL'] as string | null | undefined) ?? user.photoURL,
      board: (raw['board'] as string | null | undefined) ?? null,
      standard: (raw['standard'] as string | null | undefined) ?? null,
      role,
    };
  }

  private finish(state: AuthState): void {
    this.state.set(state);
    if (!this.settled && state.phase !== 'initializing') {
      this.settled = true;
      this.resolveReady(state);
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'Authentication could not be completed.';
  }
}
