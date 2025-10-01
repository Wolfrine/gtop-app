import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { SyllabusService, SyllabusItem } from '../../services/syllabus.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatIconModule]
})
export class ProfileComponent implements OnInit {
  user: any = null;

  boards: string[] = [];
  standards: string[] = [];

  selectedBoard: string | undefined = undefined;
  selectedStandard: string | undefined = undefined;

  saving = false;
  savedMessage = '';

  constructor(private authService: AuthService, private syllabusService: SyllabusService) {}

  ngOnInit(): void {
    // Subscribe to user profile from Firestore
    this.authService.getUser().subscribe((u) => {
      this.user = u;
      if (u) {
        this.selectedBoard = u.board ?? undefined;
        this.selectedStandard = u.standard ?? undefined;
      }
    });

    // Distinct boards and standards from syllabus
    this.syllabusService.syllabus$.subscribe((syllabus: SyllabusItem[]) => {
      const boardSet = new Set<string>();
      const standardSet = new Set<string>();
      syllabus.forEach((item) => {
        if (item.board) boardSet.add(item.board);
        if (item.standard) standardSet.add(item.standard);
      });
      this.boards = Array.from(boardSet);
      this.standards = Array.from(standardSet);
    });
  }

  get canSave(): boolean {
    if (!this.user) return false;
    const unchanged = this.user.board === this.selectedBoard && this.user.standard === this.selectedStandard;
    return !!this.selectedBoard && !!this.selectedStandard && !unchanged && !this.saving;
  }

  async save(): Promise<void> {
    if (!this.user || !this.selectedBoard || !this.selectedStandard) return;
    this.saving = true;
    this.savedMessage = '';
    try {
      await this.authService.updateUserBoardStandard(this.user.uid, this.selectedBoard, this.selectedStandard);
      this.savedMessage = 'Profile updated successfully';
    } catch (e) {
      console.error(e);
      this.savedMessage = 'Failed to update profile';
    } finally {
      this.saving = false;
    }
  }
}
