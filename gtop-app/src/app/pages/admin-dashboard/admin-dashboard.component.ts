import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

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
    activeUsers = 0; // 🔥 Placeholder for now
    totalMCQs = 0; // 🔥 Placeholder for now
    activeQuizzes = 0; // 🔥 Placeholder for now

    recentActivities: string[] = [
        "User X added a new MCQ",
        "Quiz Y was completed by 50 students",
        "MCQ Z was edited by Admin"
    ];

    ngOnInit() {
        console.log("Admin Dashboard Loaded");
    }

    addNewMCQ() {
        console.log("Redirecting to Add MCQ page...");
        // Future: Implement navigation logic
    }

    createQuiz() {
        console.log("Redirecting to Create Quiz page...");
        // Future: Implement navigation logic
    }
}
