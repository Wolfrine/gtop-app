import { ApplicationConfig, provideZoneChangeDetection, isDevMode, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Firebase imports
import { provideFirebaseApp, initializeApp, FirebaseApp } from '@angular/fire/app';
import { provideFirestore, initializeFirestore, persistentLocalCache } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';

// Firebase Config
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

        // ✅ Correct Firebase Initialization with Debug Log
        provideFirebaseApp(() => {
            const app = initializeApp(firebaseConfig);
            console.log('[Firebase Init] Firebase App Initialized:', app.name, app.options);
            return app;
        }),

        // ✅ Firestore Persistence with Debug Log
        provideFirestore(() => {
            const app = inject(FirebaseApp);
            console.log('[Firestore Init] Firebase App Injected:', app.name);
            const firestore = initializeFirestore(app, { localCache: persistentLocalCache() });
            console.log('[Firestore Init] Firestore Initialized');
            return firestore;
        }),

        // ✅ Auth Debug Log
        provideAuth(() => {
            const auth = getAuth();
            console.log('[Auth Init] Auth Initialized');
            return auth;
        }),

        // ✅ Database Debug Log
        provideDatabase(() => {
            const db = getDatabase();
            console.log('[Database Init] Realtime Database Initialized');
            return db;
        }),

        // Conditionally enable Analytics in Prod
        ...(isDevMode() ? [] : [
            provideAnalytics(() => {
                const analytics = getAnalytics();
                console.log('[Analytics Init] Analytics Initialized');
                return analytics;
            })
        ]),

        provideAnimationsAsync(),
        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
        })
    ]
};
