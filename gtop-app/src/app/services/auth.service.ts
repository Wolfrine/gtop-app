import { Injectable, NgZone } from '@angular/core';
import {
    Auth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    signInWithCredential,
    User
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, onSnapshot } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActiveUsersService } from './active-users.service';

declare global {
    interface Window {
        google: any;
    }
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userSubject = new BehaviorSubject<any>(null);
    user$ = this.userSubject.asObservable();
    googleClientId = '120622375082-4161ki3qobd7mc4m2as3e19qb0ef3dkh.apps.googleusercontent.com'; // Replace with Firebase OAuth Client ID

    private snapshotUnsubscribe: any = null;

    constructor(
        private auth: Auth,
        private firestore: Firestore,
        private router: Router,
        private ngZone: NgZone,
        private activeUsersService: ActiveUsersService
    ) {
        this.checkUserSession();
    }

    private oneTapInitialized = false;

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
                if (!isLocalhost) {
                    window.google.accounts.id.initialize({
                        client_id: this.googleClientId,
                        callback: (response: { credential: string }) => this.handleCredentialResponse(response),
                        auto_select: true,
                        cancel_on_tap_outside: false
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

    // ✅ Handle One Tap Credential
    async handleCredentialResponse(response: { credential: string }) {
        try {
            const credential = GoogleAuthProvider.credential(response.credential);
            const result = await signInWithCredential(this.auth, credential);
            const user = result.user;

            await this.storeUserInFirestore(user);
            this.userSubject.next(user);
            await this.setupUserSnapshot(user.uid);

        } catch (error) {
            console.error('One Tap Error:', error);
        }
    }

    // ✅ Google Popup Login
    async signInWithGoogle(): Promise<void> {
        try {
            const provider = new GoogleAuthProvider();
            const credential = await signInWithPopup(this.auth, provider);
            const user = credential.user;

            await this.storeUserInFirestore(user);
            this.userSubject.next(user);
            await this.setupUserSnapshot(user.uid);

            this.router.navigate(['/dashboard']);
        } catch (error) {
            console.error('Login Error:', error);
        }
    }

    // ✅ Store User in Firestore
    async storeUserInFirestore(user: User, board?: string, standard?: string): Promise<void> {
        const userRef = doc(this.firestore, `users/${user.uid}`);
        const userSnapshot = await getDoc(userRef);

        const existingData = userSnapshot.exists() ? userSnapshot.data() : {};

        const userData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdOn: existingData['createdOn'] || new Date(),
            board: board ?? existingData['board'] ?? null,
            standard: standard ?? existingData['standard'] ?? null,
            role: existingData['role'] ?? 'user'
        };

        await setDoc(userRef, userData, { merge: true });
        this.redirectToDashboard(userData.role);
    }

    // ✅ Firestore Snapshot Listener
    private async setupUserSnapshot(uid: string) {
        if (this.snapshotUnsubscribe) {
            this.snapshotUnsubscribe(); // Remove previous
        }

        const userDoc = doc(this.firestore, `users/${uid}`);
        this.snapshotUnsubscribe = onSnapshot(userDoc, (snapshot) => {
            if (snapshot.exists()) {
                const updatedUser = snapshot.data();
                console.log('User updated in Firestore:', updatedUser);
                this.userSubject.next(updatedUser);
            }
        });
    }

    // ✅ Session Check
    async checkUserSession() {
        onAuthStateChanged(this.auth, async (user) => {
            this.ngZone.run(async () => {
                if (user) {
                    const userRef = doc(this.firestore, `users/${user.uid}`);
                    const userSnapshot = await getDoc(userRef);
                    if (userSnapshot.exists()) {
                        const userData = userSnapshot.data();
                        this.userSubject.next(userData);
                        await this.setupUserSnapshot(user.uid);

                        // ✅ Update Realtime DB presence
                        this.activeUsersService.setPresenceForUser(user);

                        if (userData['board'] && userData['standard']) {
                            this.redirectToDashboard(userData['role']);
                        }
                    }
                } else {
                    this.userSubject.next(null);
                    if (this.snapshotUnsubscribe) {
                        this.snapshotUnsubscribe();
                    }
                }
            });
        });
    }

    async signOut(): Promise<void> {
        await signOut(this.auth);
        this.userSubject.next(null);
        if (this.snapshotUnsubscribe) {
            this.snapshotUnsubscribe();
        }
        this.router.navigate(['/']);
    }

    getUser(): Observable<any> {
        return this.user$;
    }

    private redirectToDashboard(role: string) {
        let targetRoute = '/dashboard';
        if (role === 'admin') {
            targetRoute = '/admin';
        } else if (role === 'institute-admin') {
            targetRoute = '/institute-admin';
        }
        this.router.navigate([targetRoute]);
    }
}
