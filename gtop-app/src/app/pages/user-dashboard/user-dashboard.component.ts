import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ManualQuizModalComponent } from '../../components/manual-quiz-modal/manual-quiz-modal.component';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-user-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        RouterModule
    ],
    templateUrl: './user-dashboard.component.html',
    styleUrls: ['./user-dashboard.component.scss']
})
export class UserDashboardComponent implements OnInit {

    // User details
    userName: string = '';
    userStandard: string = '';
    userSubjects: string = '';

    // Stats (Dummy for now, will integrate QuizResults later)
    totalQuizzes: number = 0;
    accuracyPercent: number = 0;
    lastQuizScore: number = 0;

    constructor(
        private dialog: MatDialog,
        private router: Router,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        // ✅ Pull from LocalStorage (already maintained in AuthService)
        const localUser = JSON.parse(localStorage.getItem('user') || '{}');

        this.userName = localUser.displayName || '';
        this.userStandard = localUser.standard || '';
        this.userSubjects = localUser.board || ''; // Temporarily showing board (subjects can be added later)

        // 🔽 Optionally, subscribe to observable (if real-time sync needed)
        // this.authService.getUser().subscribe(user => {
        //   if (user) {
        //     const localUser = JSON.parse(localStorage.getItem('user') || '{}');
        //     this.userName = localUser.displayName || '';
        //     this.userStandard = localUser.standard || '';
        //     this.userSubjects = localUser.board || '';
        //   }
        // });
    }

    startQuickQuiz() {
        this.router.navigate(['/quiz']);
    }

    openManualQuiz() {
        this.dialog.open(ManualQuizModalComponent, {
            width: '400px',
            data: {
                userStandard: this.userStandard,
                userSubjects: this.userSubjects
            }
        });
    }

}
