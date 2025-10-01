import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { AuthService } from '../../../services/auth.service';
import { LiveParticipant, LiveSession, SessionStatus } from '../../../shared/models/live-quiz.models';

@Component({
  selector: 'app-quiz-run-lobby',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatListModule, MatButtonModule, MatIconModule, MatTooltipModule, AppCardDirective],
  templateUrl: './quiz-run-lobby.component.html',
  styleUrls: ['./quiz-run-lobby.component.scss']
})
export class QuizRunLobbyComponent implements OnInit, OnDestroy {
  sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
  joinCode = '';
  status: SessionStatus | null = null;
  maxParticipants = 5;
  hostName = '';
  hostId = '';

  participants: LiveParticipant[] = [];
  copySuccess = false;
  startError = '';
  starting = false;
  infoMsg = '';

  private sessionUnsub?: () => void;
  private participantsUnsub?: () => void;
  private userSub?: Subscription;
  private currentUser: any;
  private navigated = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private liveQuiz: LiveQuizService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.userSub = this.auth.user$.subscribe(user => {
      this.currentUser = user;
      this.updateInfoMessage();
    });

    this.sessionUnsub = this.liveQuiz.observeSession<LiveSession & { id: string }>(this.sessionId, (session) => {
      if (!session) {
        this.infoMsg = 'This quiz run is no longer available.';
        return;
      }
      if ((session.mode || 'live') !== 'run') {
        this.router.navigate(['/live/play', this.sessionId]);
        return;
      }
      this.joinCode = session.joinCode;
      this.status = session.status;
      this.maxParticipants = session.maxParticipants ?? 5;
      this.hostName = session.hostName;
      this.hostId = session.hostId;
      this.updateInfoMessage();
      if (session.status === 'active' && !this.navigated) {
        this.navigated = true;
        this.router.navigate(['/quiz'], { queryParams: { sessionId: this.sessionId, mode: 'run' } });
      }
      if (session.status === 'ended') {
        this.infoMsg = 'This quiz run has ended.';
      }
    });

    this.participantsUnsub = this.liveQuiz.observeParticipants(this.sessionId, (list) => {
      this.participants = (list || []).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      this.updateInfoMessage();
    });
  }

  ngOnDestroy(): void {
    this.sessionUnsub?.();
    this.participantsUnsub?.();
    this.userSub?.unsubscribe();
  }

  get canStart(): boolean {
    return this.isCreator && this.status === 'lobby' && this.participants.length > 0;
  }

  get slotsRemaining(): number {
    return Math.max(0, this.maxParticipants - this.participants.length);
  }

  async startRun(): Promise<void> {
    if (!this.canStart) {
      return;
    }
    this.starting = true;
    this.startError = '';
    try {
      await this.liveQuiz.startRun(this.sessionId);
    } catch (err: any) {
      console.error(err);
      this.startError = err?.message || 'Failed to start quiz run.';
    } finally {
      this.starting = false;
    }
  }

  async copyJoinCode(): Promise<void> {
    if (!this.joinCode) return;
    try {
      await navigator.clipboard.writeText(this.joinCode);
      this.copySuccess = true;
      setTimeout(() => (this.copySuccess = false), 1500);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }
  }

  trackByUid(_: number, item: LiveParticipant): string {
    return item.uid;
  }

  private updateInfoMessage() {
    if (this.status === 'ended') {
      this.infoMsg = 'This quiz run has ended.';
      return;
    }
    if (this.status === 'active') {
      this.infoMsg = 'Redirecting to quiz…';
      return;
    }
    if (this.isCreator) {
      this.infoMsg = this.participants.length > 1
        ? 'Start when everyone is ready.'
        : 'Share the code so friends can join.';
    } else if (this.hostName) {
      this.infoMsg = `${this.hostName} will start the run once everyone joins.`;
    } else {
      this.infoMsg = 'Waiting for the host to start the run.';
    }
  }

  get isCreator(): boolean {
    return !!this.currentUser?.uid && !!this.hostId && this.currentUser.uid === this.hostId;
  }
}
