import { Injectable, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getPersistentCacheIndexManager,
  enablePersistentCacheIndexAutoCreation,
} from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { PersistenceState } from './models';

const productionOrigins = new Set([
  'https://gtop.growthtutorials.in',
  'https://gtop-app.web.app',
  'https://gtop-app.firebaseapp.com',
]);
const useEmulators = !environment.production || environment.uat || !productionOrigins.has(location.origin);
const app = initializeApp(useEmulators
  ? { projectId: 'demo-gtop-assistant', apiKey: 'demo-key', authDomain: 'localhost' }
  : environment.firebase);
const auth = getAuth(app);
const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: useEmulators,
  experimentalAutoDetectLongPolling: !useEmulators,
});

export const persistenceState = signal<PersistenceState>({
  mode: 'persistent-multi-tab',
  indexedDbAvailable: typeof indexedDB !== 'undefined',
  localIndexesEnabled: false,
});

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}

try {
  const indexManager = getPersistentCacheIndexManager(firestore);
  if (indexManager) {
    enablePersistentCacheIndexAutoCreation(indexManager);
    persistenceState.update((value) => ({ ...value, localIndexesEnabled: true }));
  }
} catch (error) {
  persistenceState.set({
    mode: 'memory',
    indexedDbAvailable: false,
    localIndexesEnabled: false,
    fallbackReason: error instanceof Error ? error.message : 'Persistent cache unavailable',
  });
}

@Injectable({ providedIn: 'root' })
export class FirebaseClient {
  readonly app = app;
  readonly auth = auth;
  readonly firestore = firestore;
  readonly environment = environment;
  readonly persistenceState = persistenceState;
}
