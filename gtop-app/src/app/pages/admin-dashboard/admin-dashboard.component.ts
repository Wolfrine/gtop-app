import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ActiveUsersService } from '../../services/active-users.service';
import { McqService } from '../../services/mcq.service';
import { AppCardDirective } from '../../shared/ui/app-card/app-card.directive';

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
        RouterModule,
        AppCardDirective
    ]
})
export class AdminDashboardComponent implements OnInit {
    activeUsers = 0; // Will hold count of active users
    totalMCQs = 0;   // Placeholder for now
    activeQuizzes = 0; // Placeholder for now
    totalUsers = 0;

    recentActivities: string[] = [
        "No activity tracked yet",
    ];

    constructor(private activeUsersService: ActiveUsersService, private mcqService: McqService) {
        // Effect runs whenever activeUsersService.activeUsers() changes
        effect(() => {
            this.activeUsers = this.activeUsersService.activeUsers().length;
            this.totalUsers = this.activeUsersService.totalUsers();
        });
    }

    async ngOnInit() {
        console.log("Admin Dashboard Loaded");

        this.totalMCQs = await this.mcqService.getTotalMCQCount();
    }

}
