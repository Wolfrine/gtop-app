import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, catchError, combineLatest, of, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { SyllabusService } from '../../services/syllabus.service';

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
export class ProfileSetupComponent implements OnInit, OnDestroy {
    private readonly subscriptions = new Subscription();
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
        this.subscriptions.add(this.authService.getUser().pipe(switchMap(user => {
            if (user && user.board && user.standard) {
                // Already setup
                this.authService.continueAfterSignIn(user.role);
                return of([[], []]);
            }
            this.user = user;
            return user ? combineLatest([this.syllabusService.boards(), this.syllabusService.standards()]).pipe(catchError(error => {
                console.error('Unable to load curriculum options', error);
                return of([[], []]);
            })) : of([[], []]);
        })).subscribe(([boards, standards]) => { this.boards = boards; this.standards = standards; }));
    }

    ngOnDestroy(): void {
        // Stop both profile redirects and syllabus updates when leaving setup.
        this.subscriptions.unsubscribe();
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

        this.authService.continueAfterSignIn(this.user.role);
    }

    switchUser() {
        this.authService.signOut().then(() => {
            this.router.navigate(['/profile-setup']);
        });
    }
}
