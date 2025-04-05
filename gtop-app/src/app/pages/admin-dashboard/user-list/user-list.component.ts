import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatChipsModule
    ],
    templateUrl: './user-list.component.html',
    styleUrls: ['./user-list.component.scss']
})
export class UserListComponent {
    users = [
        {
            name: 'John Doe',
            email: 'john@example.com',
            photoURL: 'https://i.pravatar.cc/150?img=11',
            role: 'user',
            board: 'CBSE',
            standard: '10',
            createdAt: new Date('2024-11-15'),
            subscriptionStatus: 'premium',
            isOnline: true,
            lastSeen: new Date()
        },
        {
            name: 'Alice Sharma',
            email: 'alice@school.org',
            photoURL: 'https://i.pravatar.cc/150?img=32',
            role: 'admin',
            board: 'ICSE',
            standard: '12',
            createdAt: new Date('2024-12-01'),
            subscriptionStatus: 'free',
            isOnline: false,
            lastSeen: new Date('2025-04-05T19:40:00')
        },
        {
            name: 'Ravi Kumar',
            email: 'ravi.kumar@gmail.com',
            photoURL: 'https://i.pravatar.cc/150?img=25',
            role: 'user',
            board: 'State Board',
            standard: '9',
            createdAt: new Date('2025-01-08'),
            subscriptionStatus: 'premium',
            isOnline: false,
            lastSeen: new Date('2025-04-05T18:12:00')
        }
    ];

    selectedUsers = signal<any[]>([]);

    onUserSelect(user: any) {
        const selected = this.selectedUsers();
        const index = selected.findIndex(u => u.email === user.email);
        if (index > -1) {
            this.selectedUsers.set([...selected.slice(0, index), ...selected.slice(index + 1)]);
        } else {
            this.selectedUsers.set([...selected, user]);
        }
    }

    toggleAll(event: any) {
        if (event.checked) {
            this.selectedUsers.set([...this.users]);
        } else {
            this.selectedUsers.set([]);
        }
    }
}
