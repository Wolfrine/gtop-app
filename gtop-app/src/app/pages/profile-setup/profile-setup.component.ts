import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { SyllabusService, SyllabusItem } from '../../services/syllabus.service';

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
export class ProfileSetupComponent implements OnInit {
    standards: string[] = [];
    boards: string[] = [];

    selectedStandard: string | undefined = undefined;
    selectedBoard: string | undefined = undefined;

    user: any = null;

    constructor(
        private authService: AuthService,
        private syllabusService: SyllabusService,
        private router: Router
    ) { }

    ngOnInit() {
        // ✅ Subscribe to AuthService
        this.authService.getUser().subscribe((user) => {
            if (user && user.board && user.standard) {
                // Already setup
                this.router.navigate(['/dashboard']);
                return;
            }
            this.user = user;
        });

        // ✅ Fetch distinct boards & standards from syllabus (from IndexedDB)
        this.syllabusService.syllabus$.subscribe((syllabus: SyllabusItem[]) => {
            const uniqueBoards = new Set<string>();
            const uniqueStandards = new Set<string>();

            syllabus.forEach(item => {
                uniqueBoards.add(item.board);
                uniqueStandards.add(item.standard);
            });

            this.boards = Array.from(uniqueBoards);
            this.standards = Array.from(uniqueStandards);
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

        // ✅ Save board & standard in Firestore only
        await this.authService.storeUserInFirestore(
            this.user,
            this.selectedBoard,
            this.selectedStandard
        );

        this.router.navigate(['/dashboard']);
    }

    switchUser() {
        this.authService.signOut().then(() => {
            this.router.navigate(['/profile-setup']);
        });
    }
}
