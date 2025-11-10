import { Injectable, NgZone } from '@angular/core';
import {
    Auth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    signInWithEmailAndPassword,
    signInWithPhoneNumber,
    signInWithPopup,
    signOut,
    User,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInAnonymously,
    updateProfile
} from '@angular/fire/auth';
import { ConfirmationResult, ApplicationVerifier } from 'firebase/auth';
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
    readonly guestQuizLimit = 5;

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

            await this.handlePostAuthentication(user, { provider: 'google.com' });
        } catch (error) {
            console.error('Login Error:', error);
        }
    }

    async registerWithEmail(email: string, password: string, displayName: string): Promise<void> {
        try {
            const credential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = credential.user;

            if (displayName?.trim()) {
                await updateProfile(user, { displayName: displayName.trim() });
            }

            await this.handlePostAuthentication(user, {
                provider: 'password',
                displayName: displayName?.trim() || user.displayName || 'Learner'
            });
        } catch (error) {
            console.error('Email registration error:', error);
            throw error;
        }
    }

    async signInWithEmail(email: string, password: string): Promise<void> {
        try {
            const credential = await signInWithEmailAndPassword(this.auth, email, password);
            const user = credential.user;

            await this.handlePostAuthentication(user, { provider: 'password' });
        } catch (error) {
            console.error('Email sign-in error:', error);
            throw error;
        }
    }

    async sendPasswordReset(email: string): Promise<void> {
        try {
            await sendPasswordResetEmail(this.auth, email);
        } catch (error) {
            console.error('Password reset error:', error);
            throw error;
        }
    }

    async startPhoneSignIn(phoneNumber: string, verifier: ApplicationVerifier): Promise<ConfirmationResult> {
        try {
            return await signInWithPhoneNumber(this.auth, phoneNumber, verifier);
        } catch (error) {
            console.error('Phone sign-in start error:', error);
            throw error;
        }
    }

    async confirmPhoneSignIn(
        confirmation: ConfirmationResult,
        code: string,
        options?: { displayName?: string }
    ): Promise<void> {
        try {
            const credential = await confirmation.confirm(code);
            const user = credential.user;

            if (options?.displayName?.trim()) {
                await updateProfile(user, { displayName: options.displayName.trim() });
            }

            await this.handlePostAuthentication(user, {
                provider: 'phone',
                displayName: options?.displayName?.trim() || user.displayName || user.phoneNumber || 'Learner'
            });
        } catch (error) {
            console.error('Phone confirmation error:', error);
            throw error;
        }
    }

    async continueAsGuest(preferredName?: string): Promise<void> {
        try {
            const credential = await signInAnonymously(this.auth);
            const user = credential.user;
            const displayName = preferredName?.trim() || 'Guest Explorer';

            await updateProfile(user, { displayName });

            await this.handlePostAuthentication(user, {
                provider: 'anonymous',
                displayName,
                role: 'guest',
                guestQuizCount: 0
            });
        } catch (error) {
            console.error('Anonymous sign-in error:', error);
            throw error;
        }
    }

    // ✅ Store User in Firestore
    async storeUserInFirestore(
        user: User,
        board?: string | null,
        standard?: string | null,
        options?: {
            role?: string;
            displayName?: string;
            provider?: string;
            guestQuizCount?: number;
        }
    ): Promise<void> {
        const userRef = doc(this.firestore, `users/${user.uid}`);
        const userSnapshot = await getDoc(userRef);

        const existingData = userSnapshot.exists() ? userSnapshot.data() : {};

        const hasExistingRole = typeof existingData['role'] === 'string' && existingData['role'].trim() !== '';
        const resolvedRole = options?.role
            ? options.role
            : hasExistingRole
                ? existingData['role']
                : 'user';

        const guestQuizCount = typeof options?.guestQuizCount === 'number'
            ? options.guestQuizCount
            : typeof existingData['guestQuizCount'] === 'number'
                ? existingData['guestQuizCount']
                : (resolvedRole === 'guest' ? 0 : undefined);

        const userData: any = {
            uid: user.uid,
            displayName: options?.displayName || user.displayName || existingData['displayName'] || null,
            email: user.email,
            photoURL: user.photoURL,
            phoneNumber: user.phoneNumber || existingData['phoneNumber'] || null,
            createdOn: existingData['createdOn'] || new Date(),
            board: board ?? existingData['board'] ?? null,
            standard: standard ?? existingData['standard'] ?? null,
            provider: options?.provider || existingData['provider'] || null
        };

        // Only persist the default "user" role when the document does not have one yet.
        if (!hasExistingRole) {
            userData.role = resolvedRole;
        } else if (options?.role) {
            userData.role = resolvedRole;
        }

        if (typeof guestQuizCount === 'number') {
            userData.guestQuizCount = guestQuizCount;
        }

        await setDoc(userRef, userData, { merge: true });
        this.redirectToDashboard(resolvedRole);
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

                        const role = userData['role'];
                        if (role === 'guest') {
                            this.redirectToDashboard(role);
                        } else if (userData['board'] && userData['standard']) {
                            this.redirectToDashboard(role);
                        } else {
                            this.router.navigate(['/profile-setup']);
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
        const currentUser = this.auth.currentUser;
        if (currentUser) {
            await this.activeUsersService.setUserOffline(currentUser.uid);
        }

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

    // Update board and standard without redirecting the user
    async updateUserBoardStandard(uid: string, board: string, standard: string): Promise<void> {
        const userRef = doc(this.firestore, `users/${uid}`);
        await setDoc(userRef, { board, standard }, { merge: true });
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

    private async handlePostAuthentication(
        user: User,
        options?: {
            provider?: string;
            displayName?: string;
            role?: string;
            guestQuizCount?: number;
        }
    ) {
        await this.storeUserInFirestore(user, undefined, undefined, options);
        this.userSubject.next({
            uid: user.uid,
            displayName: options?.displayName || user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            role: options?.role || 'user',
            guestQuizCount: options?.guestQuizCount
        });
        await this.setupUserSnapshot(user.uid);
    }
}
