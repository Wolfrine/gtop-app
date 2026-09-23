import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authChanged: undefined as undefined | ((user: unknown) => void),
  profileChanged: undefined as undefined | ((snapshot: unknown) => void),
  profile: { uid: 'admin-1', role: 'admin', board: 'CBSE', standard: '9' },
}));

vi.mock('./firebase', () => ({ FirebaseClient: class {} }));
vi.mock('./presence.service', () => ({ PresenceService: class {} }));
vi.mock('./diagnostics.service', () => ({ DiagnosticsService: class {} }));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: vi.fn((_auth, callback) => { mocks.authChanged = callback; }),
  signInWithCredential: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => mocks.profile })),
  setDoc: vi.fn(async () => undefined),
  serverTimestamp: vi.fn(() => 'server-time'),
  onSnapshot: vi.fn((_ref, callback) => { mocks.profileChanged = callback; return vi.fn(); }),
}));

import { AuthStore } from './auth.store';
import { FirebaseClient } from './firebase';
import { PresenceService } from './presence.service';
import { DiagnosticsService } from './diagnostics.service';
import { setDoc } from 'firebase/firestore';

describe('session readiness after authentication changes', () => {
  let store: AuthStore;
  beforeEach(() => {
    vi.mocked(setDoc).mockResolvedValue(undefined);
    mocks.authChanged = undefined;
    mocks.profileChanged = undefined;
    store = new AuthStore(
      { auth: {}, firestore: {} } as FirebaseClient,
      { markOffline: vi.fn() } as unknown as PresenceService,
      { capture: vi.fn(), captureError: vi.fn() } as unknown as DiagnosticsService,
    );
  });

  async function signIn() {
    mocks.authChanged?.({ uid: 'admin-1', displayName: 'Admin', email: 'admin@example.test' });
    await vi.waitFor(() => expect(store.state().phase).toBe('authenticated'));
  }

  it('waits for initial restoration', async () => {
    let settled = false;
    void store.ready().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    mocks.authChanged?.(null);
    expect((await store.ready()).phase).toBe('unauthenticated');
  });

  it('allows route guards to use the signed-in role after initially visiting the public page', async () => {
    mocks.authChanged?.(null);
    expect((await store.ready()).phase).toBe('unauthenticated');
    await signIn();
    expect((await store.ready()).role).toBe('admin');
    expect((await store.ready()).phase).toBe('authenticated');
  });

  it('does not retain authenticated access after sign-out', async () => {
    await signIn();
    expect((await store.ready()).role).toBe('admin');
    mocks.authChanged?.(null);
    expect((await store.ready()).phase).toBe('unauthenticated');
    expect((await store.ready()).role).toBeNull();
  });

  it('restores a session while the nonessential login audit is still queued offline', async () => {
    vi.mocked(setDoc).mockImplementation(() => new Promise(() => undefined));
    await signIn();
    expect((await store.ready()).role).toBe('admin');
  });

  it('uses the current role when an admin is demoted during an existing session', async () => {
    await signIn();
    mocks.profileChanged?.({ exists: () => true, data: () => ({ ...mocks.profile, role: 'user' }) });
    expect((await store.ready()).role).toBe('user');
    expect(store.isAdmin()).toBe(false);
  });
});
