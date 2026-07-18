import { Injectable, computed, signal } from '@angular/core';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirebaseClient } from './firebase';
import { AuthState, GtopUser, UserRole } from './models';

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
  private readonly readyPromise = new Promise<AuthState>((resolve) => (this.resolveReady = resolve));
  private profileUnsubscribe?: () => void;
  private settled = false;

  constructor(private readonly firebase: FirebaseClient) {
    onAuthStateChanged(
      this.firebase.auth,
      (user) => void this.handleAuthChange(user),
      (error) => this.finish({ ...initialState, phase: 'error', error: error.message }),
    );
  }

  ready(): Promise<AuthState> {
    return this.readyPromise;
  }

  async signIn(): Promise<GtopUser> {
    const credential = await signInWithPopup(this.firebase.auth, new GoogleAuthProvider());
    const profile = await this.ensureProfile(credential.user);
    await this.handleAuthChange(credential.user);
    return profile;
  }

  async logout(): Promise<void> {
    this.profileUnsubscribe?.();
    await signOut(this.firebase.auth);
  }

  async updateProfile(changes: Partial<Pick<GtopUser, 'displayName' | 'board' | 'standard'>>): Promise<void> {
    const user = this.firebase.auth.currentUser;
    if (!user) throw new Error('Sign in before updating your profile.');
    await setDoc(doc(this.firebase.firestore, 'users', user.uid), { ...changes, updatedAt: serverTimestamp() }, { merge: true });
  }

  private async handleAuthChange(user: import('firebase/auth').User | null): Promise<void> {
    this.profileUnsubscribe?.();
    if (!user) {
      this.finish({ ...initialState, phase: 'unauthenticated' });
      return;
    }
    try {
      const profile = await this.ensureProfile(user);
      this.finish({ phase: 'authenticated', firebaseUser: user, profile, role: profile.role, error: null });
      this.profileUnsubscribe = onSnapshot(doc(this.firebase.firestore, 'users', user.uid), (snapshot) => {
        if (!snapshot.exists()) return;
        const updated = this.toProfile(user, snapshot.data());
        this.state.set({ phase: 'authenticated', firebaseUser: user, profile: updated, role: updated.role, error: null });
      });
    } catch (error) {
      this.finish({ phase: 'error', firebaseUser: user, profile: null, role: null, error: this.message(error) });
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
