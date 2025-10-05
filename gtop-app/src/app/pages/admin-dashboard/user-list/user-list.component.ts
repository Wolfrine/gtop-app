import { Component, DestroyRef, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ActiveUsersService } from '../../../services/active-users.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatChipsModule,
        MatIcon,
        MatButtonModule
    ],
    templateUrl: './user-list.component.html',
    styleUrls: ['./user-list.component.scss']
})
export class UserListComponent {
    users: any[] = [];
    selectedUsers: any[] = [];
    currentUserId: string | null = null;
    private promotingUserIds = new Set<string>();
    private destroyRef = inject(DestroyRef);

    constructor(
        private activeUsersService: ActiveUsersService,
        private router: Router,
        private authService: AuthService
    ) {
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
                    lastSeen: match?.lastActive
                        ? new Date(
                            typeof match.lastActive === 'string' || typeof match.lastActive === 'number'
                                ? Number(match.lastActive)
                                : match.lastActive.toDate?.() || match.lastActive
                        )
                        : null,

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

        this.authService.getUser()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(user => {
                this.currentUserId = user?.uid ?? null;
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

    showPromoteButton(user: any): boolean {
        if (!user?.userId) {
            return false;
        }

        const role = typeof user.role === 'string' ? user.role.toLowerCase() : '';
        return role !== 'admin' && user.userId !== this.currentUserId;
    }

    isPromoting(userId: string): boolean {
        return this.promotingUserIds.has(userId);
    }

    async promoteToAdmin(user: any, event: MouseEvent): Promise<void> {
        event.stopPropagation();

        if (!user?.userId || this.isPromoting(user.userId)) {
            return;
        }

        this.promotingUserIds.add(user.userId);

        try {
            await this.activeUsersService.updateUserRole(user.userId, 'admin');
        } catch (error) {
            console.error('Failed to promote user to admin:', error);
        } finally {
            this.promotingUserIds.delete(user.userId);
        }
    }
}
