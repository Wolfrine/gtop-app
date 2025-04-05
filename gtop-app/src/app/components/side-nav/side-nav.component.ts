import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-side-nav',
    standalone: true,
    templateUrl: './side-nav.component.html',
    styleUrls: ['./side-nav.component.scss'],
    imports: [CommonModule, MatListModule, MatIconModule, MatButtonModule, RouterModule]
})
export class SideNavComponent implements OnInit {
    role: string = 'user'; // Default role
    menuItems: { label: string; icon: string; route: string }[] = [];

    constructor(private authService: AuthService) { }

    ngOnInit() {
        // Fetch user data from AuthService (Firestore snapshot + IndexedDB cache)
        this.authService.getUser().subscribe(user => {
            if (user) {
                this.role = user.role || 'user';
            } else {
                this.role = 'user'; // Default if null
            }

            // Define menu items based on role
            this.menuItems = this.role === 'admin' ? this.getAdminMenu() : this.getUserMenu();
        });
    }

    getAdminMenu() {
        return [
            { label: 'Admin Dashboard', icon: 'dashboard', route: '/admin' },
            { label: 'Manage Syllabus', icon: 'library_books', route: '/admin/manage-syllabus' },
            { label: 'Manage MCQs', icon: 'library_books', route: '/admin/mcq-management' },
            { label: 'User Dashboard', icon: 'dashboard', route: '/dashboard' },
            { label: 'Live Quizzes', icon: 'quiz', route: '/admin/quizzes' },
            { label: 'User Management', icon: 'group', route: '/admin/user-list' },
            { label: 'Performance Reports', icon: 'bar_chart', route: '/reports' },
            { label: 'Reports & Analytics', icon: 'bar_chart', route: '/admin/reports' },
        ];
    }

    getUserMenu() {
        return [
            { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
            { label: 'Practice MCQs', icon: 'school', route: '/practice' },
            { label: 'Live Quizzes', icon: 'quiz', route: '/quizzes' },
            { label: 'Performance Reports', icon: 'bar_chart', route: '/reports' }
        ];
    }
}
