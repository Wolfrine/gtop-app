import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { doc, Firestore, getDoc, updateDoc } from '@angular/fire/firestore';
import { AuthService } from '../../services/auth.service';
import { ActiveUsersService } from '../../services/active-users.service';
import { SyllabusService, SyllabusItem } from '../../services/syllabus.service';
import { QuizService } from '../../services/quiz.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatIconModule]
})
export class ProfileComponent implements OnInit, OnDestroy {
  viewedUser: any = null;
  currentUser: any = null;

  boards: string[] = [];
  standards: string[] = [];

  selectedBoard: string | undefined = undefined;
  selectedStandard: string | undefined = undefined;

  profileLoading = true;
  profileError = '';

  totalQuizzes = 0;
  lastQuizDate: Date | null = null;
  lastLoginDate: Date | null = null;
  lastSeenDate: Date | null = null;
  isOnlineStatus: boolean | null = null;

  selectedRole = '';
  updatingRole = false;
  roleUpdateMessage = '';
  roleUpdateSuccess: boolean | null = null;

  resettingLastLogin = false;
  lastLoginMessage = '';
  lastLoginSuccess: boolean | null = null;

  saving = false;
  savedMessage = '';

  viewedUserId: string | null = null;
  isSelfView = true;
  isAdmin = false;

  private subscriptions = new Subscription();
  private presenceSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private syllabusService: SyllabusService,
    private route: ActivatedRoute,
    private firestore: Firestore,
    private quizService: QuizService,
    private activeUsersService: ActiveUsersService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.syllabusService.syllabus$.subscribe((syllabus: SyllabusItem[]) => {
        const boardSet = new Set<string>();
        const standardSet = new Set<string>();
        syllabus.forEach((item) => {
          if (item.board) boardSet.add(item.board);
          if (item.standard) standardSet.add(item.standard);
        });
        this.boards = Array.from(boardSet);
        this.standards = Array.from(standardSet);
      })
    );

    this.subscriptions.add(
      combineLatest([this.route.queryParamMap, this.authService.getUser()]).subscribe(([params, currentUser]) => {
        void this.handleProfileContext(params.get('userId'), currentUser);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.presenceSubscription) {
      this.presenceSubscription.unsubscribe();
      this.presenceSubscription = null;
    }
  }

  get canSave(): boolean {
    if (!this.isSelfView || !this.currentUser) return false;
    const unchanged = this.currentUser.board === this.selectedBoard && this.currentUser.standard === this.selectedStandard;
    return !!this.selectedBoard && !!this.selectedStandard && !unchanged && !this.saving;
  }

  get joinedDate(): Date | null {
    const created = this.viewedUser?.createdOn ?? this.viewedUser?.createdAt ?? null;
    return this.extractTimestamp(created);
  }

  get canUpdateRole(): boolean {
    if (!this.isAdmin || !this.viewedUser) return false;
    const currentRole = this.normalizeRole(this.viewedUser.role);
    return !!this.selectedRole && this.selectedRole !== currentRole && !this.updatingRole;
  }

  async save(): Promise<void> {
    if (!this.isSelfView || !this.currentUser || !this.selectedBoard || !this.selectedStandard) return;
    this.saving = true;
    this.savedMessage = '';
    try {
      await this.authService.updateUserBoardStandard(this.currentUser.uid, this.selectedBoard, this.selectedStandard);
      this.savedMessage = 'Profile updated successfully';
    } catch (e) {
      console.error(e);
      this.savedMessage = 'Failed to update profile';
    } finally {
      this.saving = false;
    }
  }

  async updateRole(): Promise<void> {
    if (!this.viewedUserId || !this.canUpdateRole) {
      return;
    }

    this.updatingRole = true;
    this.roleUpdateMessage = '';
    this.roleUpdateSuccess = null;

    try {
      const userRef = doc(this.firestore, `users/${this.viewedUserId}`);
      await updateDoc(userRef, { role: this.selectedRole });
      if (this.viewedUser) {
        this.viewedUser = { ...this.viewedUser, role: this.selectedRole };
      }
      this.roleUpdateMessage = 'Account type updated successfully.';
      this.roleUpdateSuccess = true;
    } catch (error) {
      console.error('Failed to update user role', error);
      this.roleUpdateMessage = 'Failed to update account type.';
      this.roleUpdateSuccess = false;
    } finally {
      this.updatingRole = false;
    }
  }

  async resetLastLogin(): Promise<void> {
    if (!this.viewedUserId || this.resettingLastLogin) {
      return;
    }

    this.resettingLastLogin = true;
    this.lastLoginMessage = '';
    this.lastLoginSuccess = null;

    try {
      const userRef = doc(this.firestore, `users/${this.viewedUserId}`);
      await updateDoc(userRef, { lastLogin: null });

      const markedOffline = await this.activeUsersService.setUserOffline(this.viewedUserId);

      this.lastLoginDate = null;
      this.isOnlineStatus = false;
      if (markedOffline) {
        this.lastSeenDate = new Date();
      }
      if (this.viewedUser) {
        this.viewedUser = { ...this.viewedUser, lastLogin: null, isOnline: false };
      }
      this.lastLoginMessage = 'Last login has been reset.';
      this.lastLoginSuccess = true;
    } catch (error) {
      console.error('Failed to reset last login', error);
      this.lastLoginMessage = 'Failed to reset last login.';
      this.lastLoginSuccess = false;
    } finally {
      this.resettingLastLogin = false;
    }
  }

  private async handleProfileContext(requestedUserId: string | null, currentUser: any): Promise<void> {
    this.currentUser = currentUser;
    this.isAdmin = this.normalizeRole(currentUser?.role) === 'admin';

    const targetUserId = this.resolveTargetUserId(requestedUserId, currentUser);

    if (!targetUserId) {
      if (this.presenceSubscription) {
        this.presenceSubscription.unsubscribe();
        this.presenceSubscription = null;
      }
      this.isOnlineStatus = null;
      this.lastSeenDate = null;
      this.viewedUser = null;
      this.profileError = 'Unable to load profile.';
      this.profileLoading = false;
      return;
    }

    const targetChanged = this.viewedUserId !== targetUserId;
    this.viewedUserId = targetUserId;
    this.isSelfView = !!currentUser && targetUserId === currentUser.uid;
    this.profileError = '';

    if (targetChanged) {
      this.totalQuizzes = 0;
      this.lastQuizDate = null;
      this.lastLoginDate = null;
      this.lastSeenDate = null;
      this.isOnlineStatus = null;
      this.roleUpdateMessage = '';
      this.lastLoginMessage = '';
      this.roleUpdateSuccess = null;
      this.lastLoginSuccess = null;
      this.subscribeToPresence(targetUserId);
    } else if (!this.presenceSubscription) {
      this.subscribeToPresence(targetUserId);
    }

    if (this.isSelfView) {
      this.profileLoading = false;
      this.viewedUser = currentUser;
      this.initializeBoardAndStandard(currentUser);
      this.updateRoleSelection(currentUser);
      this.updateLastLoginFromUser(currentUser);
      this.roleUpdateMessage = '';
      this.lastLoginMessage = '';
      this.roleUpdateSuccess = null;
      this.lastLoginSuccess = null;
    } else if (targetChanged || !this.viewedUser) {
      await this.fetchUserProfile(targetUserId);
    } else {
      this.updateRoleSelection(this.viewedUser);
      this.updateLastLoginFromUser(this.viewedUser);
    }

    await this.loadQuizStats(targetUserId);
  }

  private resolveTargetUserId(requestedUserId: string | null, currentUser: any): string | null {
    if (requestedUserId && (this.isAdmin || requestedUserId === currentUser?.uid)) {
      return requestedUserId;
    }

    return currentUser?.uid ?? null;
  }

  private async fetchUserProfile(userId: string): Promise<void> {
    this.profileLoading = true;
    this.roleUpdateMessage = '';
    this.lastLoginMessage = '';
    this.roleUpdateSuccess = null;
    this.lastLoginSuccess = null;

    try {
      const userRef = doc(this.firestore, `users/${userId}`);
      const snapshot = await getDoc(userRef);

      if (!snapshot.exists()) {
        throw new Error('User not found');
      }

      const data = snapshot.data();
      this.viewedUser = { uid: userId, ...data };
      this.initializeBoardAndStandard(this.viewedUser);
      this.updateRoleSelection(this.viewedUser);
      this.updateLastLoginFromUser(this.viewedUser);
      this.profileLoading = false;
    } catch (error) {
      console.error('Failed to load user profile', error);
      this.profileError = 'Unable to load user profile.';
      this.viewedUser = null;
      this.profileLoading = false;
    }
  }

  private async loadQuizStats(userId: string): Promise<void> {
    try {
      const results = await this.quizService.fetchUserQuizResults(userId);
      this.totalQuizzes = results.length;

      const latest = results.reduce<Date | null>((latestDate, result) => {
        const timestamp = this.extractTimestamp(result.timestamp ?? result['timestamp']);
        if (!timestamp) {
          return latestDate;
        }
        if (!latestDate || timestamp.getTime() > latestDate.getTime()) {
          return timestamp;
        }
        return latestDate;
      }, null);

      this.lastQuizDate = latest;
    } catch (error) {
      console.error('Failed to load quiz stats', error);
      this.totalQuizzes = 0;
      this.lastQuizDate = null;
    }
  }

  private initializeBoardAndStandard(user: any | null): void {
    if (!user) {
      this.selectedBoard = undefined;
      this.selectedStandard = undefined;
      return;
    }

    this.selectedBoard = user.board ?? undefined;
    this.selectedStandard = user.standard ?? undefined;
  }

  private updateRoleSelection(user: any | null): void {
    this.selectedRole = this.normalizeRole(user?.role);
  }

  private updateLastLoginFromUser(user: any | null): void {
    this.lastLoginDate = this.extractTimestamp(user?.lastLogin ?? null);
  }

  get statusLabel(): string {
    if (this.isOnlineStatus === null) {
      return '—';
    }

    if (this.isOnlineStatus) {
      return 'Online';
    }

    return this.lastSeenDate ? 'Last seen' : 'Offline';
  }

  get statusDate(): Date | null {
    if (this.isOnlineStatus || this.isOnlineStatus === null) {
      return null;
    }

    return this.lastSeenDate;
  }

  private subscribeToPresence(userId: string): void {
    if (!userId) {
      return;
    }

    if (this.presenceSubscription) {
      this.presenceSubscription.unsubscribe();
      this.presenceSubscription = null;
    }

    this.presenceSubscription = this.activeUsersService.watchUserPresence(userId).subscribe((presence) => {
      if (!presence) {
        this.isOnlineStatus = false;
        this.lastSeenDate = null;
        return;
      }

      this.isOnlineStatus = presence.isOnline ?? false;
      this.lastSeenDate = this.extractTimestamp(presence.lastActive ?? null);
    });
  }

  private normalizeRole(role: any): string {
    if (typeof role === 'string' && role.trim() !== '') {
      return role.toLowerCase();
    }
    return 'user';
  }

  private extractTimestamp(value: any): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        const converted = value.toDate();
        if (converted instanceof Date && !isNaN(converted.getTime())) {
          return converted;
        }
      }
      if (value.seconds !== undefined && value.nanoseconds !== undefined) {
        const millis = value.seconds * 1000 + value.nanoseconds / 1_000_000;
        const date = new Date(millis);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }
}
