import { ApplicationConfig, provideZoneChangeDetection, isDevMode, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Firebase imports
import { provideFirebaseApp, initializeApp, FirebaseApp } from '@angular/fire/app';
import { provideFirestore, initializeFirestore, persistentLocalCache } from '@angular/fire/firestore';
import { provideAuth, initializeAuth, indexedDBLocalPersistence } from '@angular/fire/auth';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';

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
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),

        // ✅ Firebase Initialization
        provideFirebaseApp(() => {
            const app = initializeApp(firebaseConfig);
            console.log('[Firebase Init] Firebase App Initialized:', app.name, app.options);
            return app;
        }),

        // ✅ Firestore Initialization
        provideFirestore(() => {
            const app = inject(FirebaseApp);
            console.log('[Firestore Init] App:', app.name);
            return initializeFirestore(app, { localCache: persistentLocalCache() });
        }),

        // ✅ Auth Initialization (Fix potential timing issue)
        provideAuth(() => {
            const app = inject(FirebaseApp);
            console.log('[Auth Init]');
            return initializeAuth(app, { persistence: indexedDBLocalPersistence });
        }),

        // ✅ Realtime Database Initialization
        provideDatabase(() => {
            const app = inject(FirebaseApp);
            console.log('[Database Init]');
            return getDatabase(app);
        }),

        // ✅ Analytics in Production
        ...(isDevMode() ? [] : [
            provideAnalytics(() => {
                const app = inject(FirebaseApp);
                console.log('[Analytics Init]');
                return getAnalytics(app);
            })
        ]),

        provideAnimationsAsync(),
        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
        })
    ]
};
