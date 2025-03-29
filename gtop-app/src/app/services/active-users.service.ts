import { Injectable, inject, signal } from '@angular/core';
import { Database, ref, set, remove, onDisconnect, update, get, onValue } from '@angular/fire/database';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';

@Injectable({
    providedIn: 'root'
})
export class ActiveUsersService {
    private db = inject(Database);
    private auth = inject(Auth);
    private user = signal<User | null>(null);
    activeUsers = signal<any[]>([]);
    totalUsers = signal<number>(0);

    constructor() {
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

        this.listenToActiveUsers();
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

        // First set the user data, then bind onDisconnect
        set(userRef, userData).then(() => {
            console.log('User active status set.');

            onDisconnect(userRef).update({
                isOnline: false,
                lastActive: Date.now()
            }).then(() => {
                console.log('User will be marked offline on disconnect.');
            });
        }).catch((err) => {
            console.error('Failed to set active user:', err);
        });
    }

    // Remove user from active list on logout
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
                const usersArray = Object.values(usersData);
                this.totalUsers.set(usersArray.length);
                const onlineUsers = usersArray.filter((user: any) => user.isOnline);
                this.activeUsers.set(onlineUsers);
            } else {
                this.totalUsers.set(0);
                this.activeUsers.set([]);
            }
        });
    }

    fetchActiveUsers() {
        const activeUsersRef = ref(this.db, 'activeUsers');
        get(activeUsersRef).then((snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                const usersArray = Object.values(usersData);
                this.totalUsers.set(usersArray.length);
                const onlineUsers = usersArray.filter((user: any) => user.isOnline);
                this.activeUsers.set(onlineUsers);
            } else {
                console.log('No active users found.');
                this.totalUsers.set(0);
                this.activeUsers.set([]);
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

    setUserOffline(userId: string) {
        const userRef = ref(this.db, `activeUsers/${userId}`);
        update(userRef, { isOnline: false, lastActive: Date.now() }).then(() => {
            console.log('User marked as offline.');
        });
    }

    updateUserData(userId: string, data: any) {
        const userRef = ref(this.db, `activeUsers/${userId}`);
        update(userRef, data).then(() => {
            console.log('User data updated.');
        });
    }
}
