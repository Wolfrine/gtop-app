import { Injectable, inject } from '@angular/core';
import { Database, ref, set, remove, onDisconnect, update, get, onValue } from '@angular/fire/database';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ActiveUsersService {
    private db = inject(Database);
    private auth = inject(Auth);
    private user = signal<User | null>(null); // This holds the current user
    activeUsers = signal<any[]>([]); // This holds the list of active users

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

        // Fetch the active users on load
        this.fetchActiveUsers();
    }

    // Set user as active and update their status in the database
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
        const disconnectRef = onDisconnect(userRef);
        disconnectRef.update({
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

    // Fetch the list of active users
    private fetchActiveUsers() {
        const activeUsersRef = ref(this.db, 'activeUsers');
        get(activeUsersRef).then((snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                this.activeUsers.set(Object.values(usersData));
            } else {
                console.log('No active users found.');
            }
        });
    }

    // Update the user's last active time (for user inactivity tracking)
    updateUserLastActive() {
        const userRef = ref(this.db, `activeUsers/${this.user()?.uid}`);
        update(userRef, { lastActive: Date.now() }).then(() => {
            console.log('User last active time updated.');
        });
    }

    // Listen for active users changes in real-time
    listenToActiveUsers() {
        const activeUsersRef = ref(this.db, 'activeUsers');
        onValue(activeUsersRef, (snapshot) => {
            const usersData = snapshot.val();
            if (usersData) {
                this.activeUsers.set(Object.values(usersData));
            }
        });
    }

    // You can create a function to manually mark a user as offline (if needed)
    setUserOffline(userId: string) {
        const userRef = ref(this.db, `activeUsers/${userId}`);
        update(userRef, { isOnline: false, lastActive: Date.now() }).then(() => {
            console.log('User marked as offline.');
        });
    }

    // You can create a function to manually update a specific user data if needed
    updateUserData(userId: string, data: any) {
        const userRef = ref(this.db, `activeUsers/${userId}`);
        update(userRef, data).then(() => {
            console.log('User data updated.');
        });
    }
}
