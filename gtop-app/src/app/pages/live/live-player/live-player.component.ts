import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-live-player',
  standalone: true,
  imports: [CommonModule, MatCardModule, AppCardDirective],
  templateUrl: './live-player.component.html',
  styleUrls: ['./live-player.component.scss']
})
export class LivePlayerComponent implements OnInit, OnDestroy {
  sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
  sub?: () => void;
  tickSub?: Subscription;
  startAt?: Date;
  bufferSeconds = 0;
  lobbyOpensAt?: Date;
  countdownLabel = '';
  countdownValue = '';

  constructor(private route: ActivatedRoute, private live: LiveQuizService) {}

  ngOnInit(): void {
    this.sub = this.live.observeSession<any>(this.sessionId, (s) => {
      this.startAt = s?.scheduledStartAt?.toDate ? s.scheduledStartAt.toDate() : undefined;
      this.bufferSeconds = Number(s?.bufferSeconds || 0);
      this.computeLobbyOpen();
    });
    this.tickSub = interval(1000).subscribe(() => this.updateCountdown());
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub();
    this.tickSub?.unsubscribe();
  }

  private computeLobbyOpen() {
    if (!this.startAt) { this.lobbyOpensAt = undefined; return; }
    this.lobbyOpensAt = new Date(this.startAt.getTime() - this.bufferSeconds * 1000);
    this.updateCountdown();
  }

  private updateCountdown() {
    const now = new Date();
    if (!this.startAt) { this.countdownLabel = ''; this.countdownValue = ''; return; }
    if (this.lobbyOpensAt && now < this.lobbyOpensAt) {
      this.countdownLabel = 'Lobby opens in';
      this.countdownValue = this.formatDiff(this.lobbyOpensAt, now);
      return;
    }
    if (now < this.startAt) {
      this.countdownLabel = 'Starts in';
      this.countdownValue = this.formatDiff(this.startAt, now);
      return;
    }
    this.countdownLabel = 'Starting...';
    this.countdownValue = '';
  }

  private formatDiff(target: Date, now: Date): string {
    const ms = Math.max(0, target.getTime() - now.getTime());
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }
}
