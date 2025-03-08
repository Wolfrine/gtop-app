import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

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
        MatSelectModule
    ],
})
export class ProfileSetupComponent {
    standards = ['5th', '6th', '7th', '8th', '9th', '10th'];
    boards = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge']; // ✅ Predefined Boards

    selectedStandard: string | null = null;
    selectedBoard: string | null = null;

    constructor(private router: Router) { }

    isDisabled() {
        return !this.selectedStandard || !this.selectedBoard; // ✅ Both standard & board must be selected
    }

    continue() {
        console.log('Selected Standard:', this.selectedStandard);
        console.log('Selected Board:', this.selectedBoard);
        this.router.navigate(['/dashboard']);
    }
}
