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
        // Fetch user role from LocalStorage or AuthService
        const localUser = JSON.parse(localStorage.getItem('user') || '{}');
        this.role = localUser.role || 'user'; // Default to 'user' if role is missing

        // Define menu items based on role
        this.menuItems = this.role === 'admin' ? this.getAdminMenu() : this.getUserMenu();
    }

    getAdminMenu() {
        return [
            { label: 'Dashboard', icon: 'dashboard', route: '/admin' },
            { label: 'Manage Syllabus', icon: 'library_books', route: '/admin/manage-syllabus' },
            { label: 'Manage MCQs', icon: 'library_books', route: '/admin/mcq-management' },
            { label: 'Live Quizzes', icon: 'quiz', route: '/admin/quizzes' },
            { label: 'User Management', icon: 'group', route: '/admin/users' },
            { label: 'Reports & Analytics', icon: 'bar_chart', route: '/admin/reports' }
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
