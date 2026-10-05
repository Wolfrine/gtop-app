import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection, isDevMode, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

// Firebase services
import { provideFirebaseApp, initializeApp, FirebaseApp } from '@angular/fire/app';
import { provideFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from '@angular/fire/firestore';
import { Auth, provideAuth, getAuth, connectAuthEmulator, signInWithEmailAndPassword } from '@angular/fire/auth';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideDatabase, getDatabase, connectDatabaseEmulator } from '@angular/fire/database';
import { INVITATION_PRESENTATION, INVITED_SOLO_READY } from './services/practice-invite.service';
import { presentQuestion, restorePresentation, validOrder, canonicalIndex } from './services/question-presentation';

// Local integration tests use isolated emulators; query parameters cannot switch a hosted site.
const params = new URLSearchParams(window.location.search);
const localHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
let useEmulators = localHost && params.has('emulator');
// Keep isolated local QA in its emulators across real route reloads; hosted sites ignore it.
if (localHost) try {
    if (useEmulators) sessionStorage.setItem('gtop.local-emulators', '1');
    useEmulators ||= sessionStorage.getItem('gtop.local-emulators') === '1';
} catch { /* The explicit localhost query remains sufficient if storage is unavailable. */ }

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyATxEIUYY7rPgJriy_0q7yjfcP-QyBMZkM",
    authDomain: "gtop-app.firebaseapp.com",
    projectId: "gtop-app",
    storageBucket: "gtop-app.firebasestorage.app",
    messagingSenderId: "78765581239",
    appId: "1:78765581239:web:25b3433cd1192a50673e32",
    measurementId: "G-JKGH6JKDHJ"
};

export const appConfig: ApplicationConfig = {
    providers: [
        { provide: INVITATION_PRESENTATION, useValue: { presentQuestion, restorePresentation, validOrder, canonicalIndex } },
        { provide: INVITED_SOLO_READY, useValue: true },
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideHttpClient(),

        // Initialize Firebase App
        provideFirebaseApp(() => initializeApp(firebaseConfig)),

        // Enable Firestore Persistence
        provideFirestore(() => {
            const app = inject(FirebaseApp);
            const persistent = !useEmulators || params.get('persistentCache') === '1';
            const firestore = initializeFirestore(app, {
                ...(useEmulators ? { experimentalForceLongPolling: true } : {}),
                ...(persistent ? { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) } : {}),
            });
            if (useEmulators) connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
            return firestore;
        }),

        provideAuth(() => {
            const auth = getAuth();
            if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
            return auth;
        }),
        { provide: APP_INITIALIZER, multi: true, useFactory: () => {
            const auth = inject(Auth);
            return async () => {
                if (useEmulators && params.get('testEmail') && params.get('testPassword')) {
                    await signInWithEmailAndPassword(auth, params.get('testEmail')!, params.get('testPassword')!);
                }
            };
        } },
        provideAnimationsAsync(),
        provideDatabase(() => {
            const database = getDatabase();
            if (useEmulators) connectDatabaseEmulator(database, '127.0.0.1', 9000);
            return database;
        }),

        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode() && !useEmulators,
            registrationStrategy: 'registerWhenStable:30000'
        })
    ]
};
