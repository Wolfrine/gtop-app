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

        // ✅ Correct Firebase Initialization
        provideFirebaseApp(() => initializeApp(firebaseConfig)),

        // ✅ FIX: Wrap inject(FirebaseApp) inside a lambda
        provideFirestore(() => {
            const app = inject(FirebaseApp); // SAFE way
            return initializeFirestore(app, { localCache: persistentLocalCache() });
        }),

        provideAuth(() => getAuth()),
        provideDatabase(() => getDatabase()),

        // Conditionally enable Analytics in Prod
        ...(isDevMode() ? [] : [provideAnalytics(() => getAnalytics())]),

        provideAnimationsAsync(),
        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
        })
    ]
};
