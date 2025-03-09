import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';

import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Component({
    selector: 'app-profile-setup',
    standalone: true,
    templateUrl: './profile-setup.component.html',
    styleUrl: './profile-setup.component.scss',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCardModule
    ],
})
export class ProfileSetupComponent {
    standards = ['5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
    boards = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge']; // ✅ Predefined Boards

    selectedStandard: string | undefined = undefined;
    selectedBoard: string | undefined = undefined;

    user: any = null; // Stores authenticated user data

    constructor(private authService: AuthService, private router: Router, private firestore: Firestore) { }

    ngOnInit() {
        const localUser = localStorage.getItem('user');
        if (localUser) {
            const userData = JSON.parse(localUser);
            if (userData.board && userData.standard) {
                this.router.navigate(['/dashboard']);
                return;
            }
        }

        this.authService.getUser().subscribe((user) => {
            this.user = user;
        });
    }




    signInWithGoogle() {
        this.authService.signInWithGoogle();
    }

    isDisabled() {
        return !this.selectedStandard || !this.selectedBoard;
    }

    async continue() {
        if (!this.user) return;

        // ✅ Save to Firestore

        await this.authService.storeUserInFirestore(
            this.user,
            this.selectedBoard,
            this.selectedStandard
        );

        // ✅ Save to LocalStorage
        localStorage.setItem('user', JSON.stringify({
            ...JSON.parse(localStorage.getItem('user') || '{}'),
            board: this.selectedBoard,
            standard: this.selectedStandard
        }));

        this.router.navigate(['/dashboard']);
    }

    // Logout and allow user to switch accounts
    switchUser() {
        this.authService.signOut().then(() => {
            this.router.navigate(['/profile-setup']); // Stay on profile setup instead of landing page
        });
    }
}
