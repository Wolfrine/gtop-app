import { Injectable, NgZone } from '@angular/core';
import {
    Auth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    signInWithCredential,
    User,
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

declare global {
    interface Window {
        google: any;
    }
}

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private userSubject = new BehaviorSubject<any>(null);
    user$ = this.userSubject.asObservable();
    googleClientId = '120622375082-4161ki3qobd7mc4m2as3e19qb0ef3dkh.apps.googleusercontent.com'; // Replace with Firebase OAuth Client ID

    constructor(
        private auth: Auth,
        private firestore: Firestore,
        private router: Router,
        private ngZone: NgZone
    ) {
        this.checkUserSession();
    }

    private oneTapInitialized = false; // ✅ Prevent duplicate One Tap calls

    private loadGoogleScript(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (document.getElementById('google-one-tap-script')) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.id = 'google-one-tap-script';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Google One Tap script'));
            document.head.appendChild(script);
        });
    }

    initGoogleOneTap() {
        if (this.oneTapInitialized || this.userSubject.value) {
            console.log('Skipping One Tap: Already initialized or user logged in.');
            return;
        }

        this.oneTapInitialized = true;

        this.loadGoogleScript().then(() => {
            if (window.google?.accounts) {
                const isLocalhost = window.location.hostname === 'localhost';

                if (!isLocalhost) { // ✅ Only enable One Tap in production
                    window.google.accounts.id.initialize({
                        client_id: this.googleClientId,
                        callback: (response: { credential: string }) => this.handleCredentialResponse(response),
                        auto_select: true,
                        cancel_on_tap_outside: false,
                    });
                    window.google.accounts.id.prompt();
                } else {
                    console.warn("One Tap is disabled in localhost. Use popup login instead.");
                }
            }
        }).catch((error) => {
            console.error('Google One Tap failed to initialize:', error);
        });
    }


    // ✅ Handle One Tap Credential Response
    async handleCredentialResponse(response: { credential: string }) {
        try {
            const credential = GoogleAuthProvider.credential(response.credential);
            const result = await signInWithCredential(this.auth, credential);
            const user = result.user;

            await this.storeUserInFirestore(user);
            this.userSubject.next(user);
        } catch (error) {
            console.error('Google One Tap Sign-In Error:', error);
        }
    }

    // ✅ Sign in with Google Popup
    async signInWithGoogle(): Promise<void> {
        try {
            const provider = new GoogleAuthProvider();
            const credential = await signInWithPopup(this.auth, provider);
            const user = credential.user;

            await this.storeUserInFirestore(user);
            this.userSubject.next(user);
            this.router.navigate(['/dashboard']);
        } catch (error) {
            console.error('Login Error:', error);
        }
    }

    // ✅ Store User in Firestore (Fix: Preserve `createdOn` date)
    async storeUserInFirestore(user: User, board?: string, standard?: string): Promise<void> {
        const userRef = doc(this.firestore, `users/${user.uid}`);
        const userSnapshot = await getDoc(userRef);

        const existingData = userSnapshot.exists() ? userSnapshot.data() : {};

        // ✅ Now includes role-based storage & redirects
        const userData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdOn: existingData['createdOn'] || new Date(),

            board: board ?? existingData['board'] ?? null,
            standard: standard ?? existingData['standard'] ?? null,

            // ✅ Store role from Firestore or default to 'user'
            role: existingData['role'] ?? 'user'
        };

        // ✅ Store in Firestore
        await setDoc(userRef, userData, { merge: true });

        // ✅ Store in LocalStorage
        localStorage.setItem('user', JSON.stringify(userData));

        // ✅ Redirect Based on Role
        this.redirectToDashboard(userData.role);

    }


    // ✅ Auto Login Check
    async checkUserSession() {
        onAuthStateChanged(this.auth, async (user) => {
            this.ngZone.run(async () => {
                if (user) {
                    this.userSubject.next(user);

                    // ✅ Fetch user data from Firestore ONLY if NOT in localStorage
                    if (!localStorage.getItem('user')) {
                        const userRef = doc(this.firestore, `users/${user.uid}`);
                        const userSnapshot = await getDoc(userRef);

                        if (userSnapshot.exists()) {
                            localStorage.setItem('user', JSON.stringify(userSnapshot.data()));
                        }
                    }

                    // ✅ Auto-Redirect Based on Role if board & standard exist
                    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
                    if (localUser.board && localUser.standard) {
                        this.redirectToDashboard(localUser.role);
                    }


                } else {
                    this.userSubject.next(null);
                    localStorage.removeItem('user');
                }
            });
        });
    }


    // ✅ Sign out
    async signOut(): Promise<void> {
        await signOut(this.auth);
        this.userSubject.next(null);
        this.router.navigate(['/']);
    }

    // ✅ Get User as Observable
    getUser(): Observable<any> {
        return this.user$;
    }

    // ✅ Centralized redirect function for future scalability
    private redirectToDashboard(role: string) {
        let targetRoute = '/dashboard'; // Default for users

        if (role === 'admin') {
            targetRoute = '/admin';
        } else if (role === 'institute-admin') {
            targetRoute = '/institute-admin'; // Future-proofing
        }

        this.router.navigate([targetRoute]);
    }
}
