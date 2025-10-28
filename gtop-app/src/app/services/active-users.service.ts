import { Injectable, inject, signal } from '@angular/core';
import { Database, ref, set, remove, onDisconnect, update, get, onValue } from '@angular/fire/database';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, onSnapshot, CollectionReference, DocumentData, doc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';


@Injectable({
    providedIn: 'root'
})
export class ActiveUsersService {
    private db = inject(Database);
    private auth = inject(Auth);
    private user = signal<User | null>(null);
    activeUsers = signal<any[]>([]);
    activeInactiveUsers = signal<any[]>([]);
    totalUsers = signal<number>(0);
    allUsers = signal<any[]>([]);
    private firestore = inject(Firestore);

    constructor() {
        // Firebase auth state change handler
        onAuthStateChanged(this.auth, (user) => {
            if (user) {
                this.user.set(user);
                this.setUserActive(user);
            } else {
                const previousUser = this.user();
                if (previousUser) {
                    this.removeUser(previousUser.uid);
                }
                this.user.set(null);
            }
        });

        // Re-check and reinitialize presence
        this.reinitializePresenceIfNeeded();

        // Re-add presence if manually removed from DB
        this.watchOwnPresenceInRealtimeDB();

        // Set active when tab regains visibility
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const current = this.auth.currentUser;
                if (current) this.setUserActive(current);
            }
        });

        // Listen for all active user changes
        this.listenToActiveUsers();
    }

    listenToUsersCollection() {
        const usersCollection = collection(this.firestore, 'users') as CollectionReference<DocumentData>;

        onSnapshot(usersCollection, (snapshot) => {
            const userList = snapshot.docs.map(doc => ({
                userId: doc.id,
                ...doc.data()
            }));
            this.allUsers.set(userList);
        }, (error) => {
            console.error('Error listening to Users collection:', error);
        });
    }



    // Ensure presence is set even if onAuthStateChanged is skipped
    private async reinitializePresenceIfNeeded() {
        const user = this.auth.currentUser;
        if (user) {
            await this.setUserActive(user);
        }
    }

    // Watch own presence record; re-add if manually deleted
    private watchOwnPresenceInRealtimeDB() {
        setTimeout(() => {
            const currentUser = this.auth.currentUser;
            if (!currentUser) return;

            const userRef = ref(this.db, `activeUsers/${currentUser.uid}`);
            onValue(userRef, (snapshot) => {
                if (!snapshot.exists()) {
                    this.setUserActive(currentUser);
                }
            });
        }, 1000); // Wait for auth to initialize
    }

    private setUserActive(user: User) {
        const userRef = ref(this.db, `activeUsers/${user.uid}`);
        const userData = {
            userId: user.uid,
            displayName: user.displayName || 'Unknown',
            email: user.email || '',
            lastActive: Date.now(),
            isOnline: true
        };

        set(userRef, userData).then(() => {
            console.log('User active status set.');

            onDisconnect(userRef).update({
                isOnline: false,
                lastActive: { ".sv": "timestamp" }
            }).then(() => {
                console.log('User will be marked offline on disconnect.');
            });
        }).catch((err) => {
            console.error('Failed to set active user:', err);
        });
    }

    private removeUser(uid: string) {
        const userRef = ref(this.db, `activeUsers/${uid}`);
        remove(userRef).then(() => {
            console.log('User removed from active users.');
        }).catch((err) => {
            console.error('Failed to remove user:', err);
        });
    }

    listenToActiveUsers() {
        const activeUsersRef = ref(this.db, 'activeUsers');
        onValue(activeUsersRef, (snapshot) => {
            const usersData = snapshot.val();
            if (usersData) {
                const usersArray = Object.entries(usersData).map(([userId, value]: [string, any]) => ({
                    userId,
                    ...value,
                }));
                this.activeInactiveUsers.set(usersArray);
                this.totalUsers.set(usersArray.length);
                const onlineUsers = usersArray.filter((user: any) => user.isOnline);
                this.activeUsers.set(onlineUsers);
            } else {
                this.totalUsers.set(0);
                this.activeUsers.set([]);
                this.activeInactiveUsers.set([]);
            }
        });
    }

    fetchActiveUsers() {
        const activeUsersRef = ref(this.db, 'activeUsers');
        get(activeUsersRef).then((snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                const usersArray = Object.entries(usersData).map(([userId, value]: [string, any]) => ({
                    userId,
                    ...value,
                }));
                this.totalUsers.set(usersArray.length);
                const onlineUsers = usersArray.filter((user: any) => user.isOnline);
                this.activeUsers.set(onlineUsers);
            } else {
                console.log('No active users found.');
                this.totalUsers.set(0);
                this.activeUsers.set([]);
                this.activeInactiveUsers.set([]);
            }
        }).catch((err) => {
            console.error('Failed to fetch active users:', err);
        });
    }

    updateUserLastActive() {
        const currentUser = this.user();
        if (!currentUser || !navigator.onLine) return;

        const userRef = ref(this.db, `activeUsers/${currentUser.uid}`);
        update(userRef, { lastActive: Date.now() }).then(() => {
            console.log('User last active time updated.');
        });
    }

    async setUserOffline(userId: string): Promise<boolean> {
        const userRef = ref(this.db, `activeUsers/${userId}`);

        try {
            await update(userRef, { isOnline: false, lastActive: Date.now() });
            console.log('User marked as offline.');
            return true;
        } catch (error) {
            console.error('Failed to mark user offline in Realtime DB:', error);
            return false;
        }
    }

    updateUserData(userId: string, data: any) {
        const userRef = ref(this.db, `activeUsers/${userId}`);
        update(userRef, data).then(() => {
            console.log('User data updated.');
        });
    }

    async updateUserRole(userId: string, role: string): Promise<void> {
        try {
            const userDocRef = doc(this.firestore, `users/${userId}`);
            await updateDoc(userDocRef, { role });
            console.log(`User ${userId} role updated to ${role}.`);
        } catch (error) {
            console.error('Failed to update user role:', error);
            throw error;
        }
    }

    public setPresenceForUser(user: User) {
        this.user.set(user);
        this.setUserActive(user);
    }

    watchUserPresence(userId: string): Observable<{ userId: string; isOnline?: boolean; lastActive?: any } | null> {
        const userRef = ref(this.db, `activeUsers/${userId}`);

        return new Observable((subscriber) => {
            const unsubscribe = onValue(
                userRef,
                (snapshot) => {
                    if (!snapshot.exists()) {
                        subscriber.next(null);
                        return;
                    }

                    subscriber.next({ userId, ...snapshot.val() });
                },
                (error) => {
                    console.error('Failed to read user presence:', error);
                    subscriber.next(null);
                }
            );

            return () => unsubscribe();
        });
    }
}
