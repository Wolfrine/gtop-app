import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { Output, EventEmitter } from '@angular/core';

type MenuItem = { label: string; icon: string; route: string; badge?: string; tooltip?: string };

@Component({
    selector: 'app-side-nav',
    standalone: true,
    templateUrl: './side-nav.component.html',
    styleUrls: ['./side-nav.component.scss'],
    imports: [CommonModule, MatListModule, MatIconModule, MatButtonModule, MatTooltipModule, RouterModule]
})
export class SideNavComponent implements OnInit {
    @Output() itemClicked = new EventEmitter<void>();
    role: string = 'user'; // Default role
    menuItems: MenuItem[] = [];

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
            const isDevHost = typeof window !== 'undefined' && /dev-gtop-app\.web\.app$/i.test(window.location.host);
            this.menuItems = this.role === 'admin' ? this.getAdminMenu() : this.getUserMenu(isDevHost);
        });
    }

    getAdminMenu(): MenuItem[] {
        // Dashboard first for quick access (landing route)
        return [
            { label: 'User Dashboard', icon: 'dashboard', route: '/dashboard' },
            { label: 'Start Quiz', icon: 'play_arrow', route: '/quiz' },
            { label: 'Live Quizzes', icon: 'bolt', route: '/live', tooltip: 'Host or join a live session' },
            { label: 'Performance Reports', icon: 'insights', route: '/reports' },

            { label: 'Manage MCQs', icon: 'library_books', route: '/admin/mcq-management' },
            { label: 'Manage Syllabus', icon: 'fact_check', route: '/admin/manage-syllabus' },
            { label: 'Syllabus Preview', icon: 'menu_book', route: '/syllabus-preview' },
            { label: 'User Management', icon: 'group', route: '/admin/user-list' },

            { label: 'Admin Dashboard', icon: 'grid_view', route: '/admin' },

            { label: 'UI Kitchen (Dev)', icon: 'science', route: '/dev/ui', badge: 'DEV', tooltip: 'Development preview (admin only)' },
            { label: 'Logs', icon: 'bug_report', route: '/logs' },
        ];
    }

    getUserMenu(isDevHost: boolean = false): MenuItem[] {
        const base: MenuItem[] = [
            // Dashboard first for parity with admin experience
            { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
            { label: 'Start Quiz', icon: 'play_arrow', route: '/quiz' },
            { label: 'Join Live Quiz', icon: 'bolt', route: '/live', tooltip: 'Enter a code to join' },
            { label: 'Performance Reports', icon: 'insights', route: '/reports' },
        ];
        if (isDevHost) {
            base.push({ label: 'Logs', icon: 'bug_report', route: '/logs' });
        }
        return base;
    }
}
