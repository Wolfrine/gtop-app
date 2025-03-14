import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ActiveUsersService } from '../../services/active-users.service';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.scss'],
    imports: [
        CommonModule,
        MatCardModule,
        MatListModule,
        MatButtonModule,
        MatIconModule,
        RouterModule
    ]
})
export class AdminDashboardComponent implements OnInit {
    activeUsers = 0; // Will hold count of active users
    totalMCQs = 0;   // Placeholder for now
    activeQuizzes = 0; // Placeholder for now
    totalUsers = 0;

    recentActivities: string[] = [
        "User X added a new MCQ",
        "Quiz Y was completed by 50 students",
        "MCQ Z was edited by Admin"
    ];

    constructor(private activeUsersService: ActiveUsersService) {
        // Effect runs whenever activeUsersService.activeUsers() changes
        effect(() => {
            this.activeUsers = this.activeUsersService.activeUsers().length;
            this.totalUsers = this.activeUsersService.totalUsers();
        });
    }

    ngOnInit() {
        console.log("Admin Dashboard Loaded");
    }

    addNewMCQ() {
        console.log("Redirecting to Add MCQ page...");
    }

    createQuiz() {
        console.log("Redirecting to Create Quiz page...");
    }
}
