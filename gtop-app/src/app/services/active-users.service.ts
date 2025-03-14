import { Injectable, inject, signal } from '@angular/core';
import { Database, ref, set, remove, onDisconnect, update, get, onValue } from '@angular/fire/database';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';

@Injectable({
    providedIn: 'root'
})
export class ActiveUsersService {
    private db = inject(Database);
    private auth = inject(Auth);
    private user = signal<User | null>(null); // Holds the current user
    activeUsers = signal<any[]>([]); // Holds only online users
    totalUsers = signal<number>(0);  // ✅ Should be a number, not an array

    constructor() {
        // Track user login/logout status
        onAuthStateChanged(this.auth, (user) => {
            this.user.set(user);
            if (user) {
                this.setUserActive(user);
            } else {
                this.removeUser();
            }
        });

        // Listen for real-time updates
        this.listenToActiveUsers();
    }

    // Set user as active and update status in the database
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
        });

        // Mark user as offline when they disconnect
        onDisconnect(userRef).update({
            isOnline: false,
            lastActive: Date.now()
        }).then(() => {
            console.log('User will be marked offline on disconnect.');
        });
    }

    // Remove user from the active users list when they log out
    private removeUser() {
        if (this.user()) {
            const userRef = ref(this.db, `activeUsers/${this.user()?.uid}`);
            remove(userRef).then(() => {
                console.log('User removed from active users.');
            });
        }
    }

    // ✅ Fetch both active and total users in real-time
    listenToActiveUsers() {
        const activeUsersRef = ref(this.db, 'activeUsers');
        onValue(activeUsersRef, (snapshot) => {
            const usersData = snapshot.val();
            if (usersData) {
                const usersArray = Object.values(usersData);

                // ✅ Track the total number of users
                this.totalUsers.set(usersArray.length);

                // ✅ Filter only online users
                const onlineUsers = usersArray.filter((user: any) => user.isOnline);
                this.activeUsers.set(onlineUsers);
            } else {
                this.totalUsers.set(0);
                this.activeUsers.set([]);
            }
        });
    }

    // ✅ Fetch once (used only if needed for a one-time fetch)
    fetchActiveUsers() {
        const activeUsersRef = ref(this.db, 'activeUsers');
        get(activeUsersRef).then((snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                const usersArray = Object.values(usersData);

                // ✅ Set total users
                this.totalUsers.set(usersArray.length);

                // ✅ Set only online users
                const onlineUsers = usersArray.filter((user: any) => user.isOnline);
                this.activeUsers.set(onlineUsers);
            } else {
                console.log('No active users found.');
                this.totalUsers.set(0);
                this.activeUsers.set([]);
            }
        });
    }

    // ✅ Update last active time (user inactivity tracking)
    updateUserLastActive() {
        const userRef = ref(this.db, `activeUsers/${this.user()?.uid}`);
        update(userRef, { lastActive: Date.now() }).then(() => {
            console.log('User last active time updated.');
        });
    }

    // ✅ Mark user as offline (if needed)
    setUserOffline(userId: string) {
        const userRef = ref(this.db, `activeUsers/${userId}`);
        update(userRef, { isOnline: false, lastActive: Date.now() }).then(() => {
            console.log('User marked as offline.');
        });
    }

    // ✅ Update user data if needed
    updateUserData(userId: string, data: any) {
        const userRef = ref(this.db, `activeUsers/${userId}`);
        update(userRef, data).then(() => {
            console.log('User data updated.');
        });
    }
}
