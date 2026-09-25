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
            { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', tooltip: 'Practice and review your recent attempts' },
            { label: 'Quick Quiz', icon: 'play_arrow', route: '/quiz', tooltip: 'Launch a random solo quiz' },
            { label: 'Learning Lab', icon: 'science', route: '/learning-lab', badge: 'NEW', tooltip: 'Learn through interactive experiments' },
            { label: 'Quiz Runs', icon: 'groups', route: '/quiz-run', tooltip: 'Create a real-time lobby (max 5 learners)' },
            { label: 'Live Quizzes', icon: 'event', route: '/live', tooltip: 'Review and host upcoming live quizzes' },
            { label: 'Progress', icon: 'insights', route: '/reports', tooltip: 'Analyse learner attempts and accuracy' },

            { label: 'Action Plan', icon: 'assignment_turned_in', route: '/admin/action-plan', badge: 'LIVE', tooltip: 'Coordinate priorities, owners, progress and blockers' },

            { label: 'Question bank', icon: 'library_books', route: '/admin/question-bank', badge: 'NEW', tooltip: 'Papers, coverage, review and approved questions' },
            { label: 'Manage Syllabus', icon: 'fact_check', route: '/admin/manage-syllabus' },
            { label: 'Syllabus Preview', icon: 'menu_book', route: '/syllabus-preview' },
            { label: 'User Management', icon: 'group', route: '/admin/user-list' },

            { label: 'Admin Console', icon: 'grid_view', route: '/admin', tooltip: 'Access administrative metrics and tools' },

            { label: 'UI Preview', icon: 'science', route: '/dev/ui', badge: 'DEV', tooltip: 'Review shared styles and responsive layouts' },
            { label: 'Logs', icon: 'bug_report', route: '/logs' },
        ];
    }

    getUserMenu(isDevHost: boolean = false): MenuItem[] {
        const base: MenuItem[] = [
            // Dashboard first for parity with admin experience
            { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
            { label: 'Quick Quiz', icon: 'play_arrow', route: '/quiz' },
            { label: 'Learning Lab', icon: 'science', route: '/learning-lab', badge: 'NEW', tooltip: 'Learn through interactive experiments' },
            { label: 'Live Quizzes', icon: 'bolt', route: '/live', tooltip: 'Enter a code to join' },
            { label: 'Progress', icon: 'insights', route: '/reports' },
        ];
        if (isDevHost) {
            base.push({ label: 'Logs', icon: 'bug_report', route: '/logs' });
        }
        return base;
    }
}
