import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { ActiveUsersService } from '../../../services/active-users.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatChipsModule,
        MatIcon
    ],
    templateUrl: './user-list.component.html',
    styleUrls: ['./user-list.component.scss']
})
export class UserListComponent {
    users: any[] = [];
    selectedUsers: any[] = [];

    constructor(private activeUsersService: ActiveUsersService, private router: Router) {
        this.activeUsersService.listenToUsersCollection();
        this.activeUsersService.listenToActiveUsers();

        effect(() => {
            const userList = this.activeUsersService.allUsers();
            const realtimeUsers = this.activeUsersService.activeInactiveUsers();

            const enrichedUsers = userList.map(user => {
                const match = realtimeUsers.find(o => o.userId === user.userId);

                return {
                    ...user,
                    isOnline: !!match?.isOnline,
                    lastSeen: match?.lastActive ? new Date(Number(match.lastActive)) : null,
                    createdAt: user.createdAt?.toDate
                        ? user.createdAt.toDate()
                        : user.createdOn?.toDate
                            ? user.createdOn.toDate()
                            : user.createdAt
                                ? new Date(user.createdAt)
                                : user.createdOn
                                    ? new Date(user.createdOn)
                                    : null
                };
            });

            // ✅ Sort: online first, then by latest lastSeen
            this.users = enrichedUsers.sort((a, b) => {
                if (a.isOnline && !b.isOnline) return -1;
                if (!a.isOnline && b.isOnline) return 1;

                // Both are same online status → compare lastSeen
                const timeA = a.lastSeen?.getTime?.() || 0;
                const timeB = b.lastSeen?.getTime?.() || 0;
                return timeB - timeA;
            });
        });

    }

    onUserSelect(user: any) {
        const index = this.selectedUsers.findIndex(u => u.email === user.email);
        if (index > -1) {
            this.selectedUsers.splice(index, 1);
        } else {
            this.selectedUsers.push(user);
        }
    }

    toggleAll(event: any) {
        if (event.checked) {
            this.selectedUsers = [...this.users];
        } else {
            this.selectedUsers = [];
        }
    }

    viewReport(user: any) {
        this.router.navigate(['/reports'], { queryParams: { userId: user.userId } });
    }
}
