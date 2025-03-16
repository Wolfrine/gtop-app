import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ManualQuizModalComponent } from '../../components/manual-quiz-modal/manual-quiz-modal.component';
import { Router } from '@angular/router';


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
export class UserDashboardComponent {



    // Dummy user details (will wire to Firestore later)
    userName: string = 'John Doe';
    userStandard: string = '8th Standard';
    userSubjects: string = 'Math, Science, English';

    // Stats dummy values
    totalQuizzes: number = 12;
    accuracyPercent: number = 78;
    lastQuizScore: number = 85;

    constructor(private dialog: MatDialog, private router: Router) { }


    startQuickQuiz() {
        this.router.navigate(['/quiz']);
    }


    openManualQuiz() {
        this.dialog.open(ManualQuizModalComponent, {
            width: '400px',
            data: {} // Later pass dynamic user data if needed
        });
    }

}
