import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.scss'],
    imports: [
        CommonModule,
        MatSidenavModule,
        MatToolbarModule,
        MatIconModule,
        MatButtonModule,
        MatListModule,
        MatCardModule,
        RouterModule
    ]
})
export class AdminDashboardComponent {
    isDesktop = window.innerWidth > 768; // Default sidebar state
    totalUsers = 0;
    totalMCQs = 0;
    activeQuizzes = 0;
    recentActivities: string[] = [
        "User X added a new MCQ",
        "Quiz Y was completed by 50 students",
        "MCQ Z was edited by Admin"
    ];

    toggleSidenav() {
        this.isDesktop = !this.isDesktop;
    }

    addNewMCQ() {
        console.log("Redirecting to Add MCQ page...");
        // Future: Implement navigation logic
    }

    createQuiz() {
        console.log("Redirecting to Create Quiz page...");
        // Future: Implement navigation logic
    }

    @HostListener('window:resize', ['$event'])
    onResize(event: any) {
        this.isDesktop = event.target.innerWidth > 768;
    }
}
