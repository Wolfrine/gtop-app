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
        // ✅ Subscribe to real-time user data (Firestore + IndexedDB synced)
        this.authService.getUser().subscribe(user => {
            if (user) {
                this.userName = user.displayName || '';
                this.userStandard = user.standard || '';
                this.userSubjects = user.board || ''; // Temporarily showing board (can adjust later)
            }
        });
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
