import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { Subscription, interval } from 'rxjs';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-live-host',
  standalone: true,
  imports: [CommonModule, MatCardModule, AppCardDirective, MatListModule, MatIconModule, MatButtonModule],
  templateUrl: './live-host.component.html',
  styleUrls: ['./live-host.component.scss']
})
export class LiveHostComponent implements OnInit, OnDestroy {
  sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
  joinCode: string | null = null;
  status: string | null = null;
  sub?: () => void;
  partSub?: () => void;
  tickSub?: Subscription;

  // schedule
  startAt?: Date;
  bufferSeconds = 0;
  lobbyOpensAt?: Date;
  countdownLabel = '';
  countdownValue = '';
  perQuestionSeconds = 20;
  overrideIndex: number | null = null;
  currentIndex = -1;
  total = 0;
  schedule: Map<number, Date> = new Map();

  participants: { uid: string; displayName: string; photoURL?: string }[] = [];

  constructor(private route: ActivatedRoute, private live: LiveQuizService) {}

  ngOnInit(): void {
    this.sub = this.live.observeSession<any>(this.sessionId, (s) => {
      this.joinCode = s?.joinCode ?? null;
      this.status = s?.status ?? null;
      this.startAt = s?.scheduledStartAt?.toDate ? s.scheduledStartAt.toDate() : undefined;
      this.bufferSeconds = Number(s?.bufferSeconds || 0);
      this.perQuestionSeconds = Number(s?.perQuestionSeconds || 20);
      this.overrideIndex = (s?.overrideIndex ?? null) as number | null;
      this.total = Array.isArray(s?.questionIds) ? s.questionIds.length : 0;
      // Build schedule map
      this.schedule.clear();
      const raw = s?.schedule || {};
      Object.keys(raw).forEach(k => {
        const idx = Number(k);
        const ts = (raw as any)[k];
        const d = ts?.toDate ? ts.toDate() : undefined;
        if (!isNaN(idx) && d) this.schedule.set(idx, d);
      });
      this.computeLobbyOpen();
    });

    this.partSub = this.live.observeParticipants(this.sessionId, (list) => {
      this.participants = list.map(p => ({ uid: p.uid, displayName: p.displayName, photoURL: p.photoURL || undefined }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    this.tickSub = interval(1000).subscribe(() => this.updateCountdown());
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub();
    if (this.partSub) this.partSub();
    this.tickSub?.unsubscribe();
  }

  private computeLobbyOpen() {
    if (!this.startAt) { this.lobbyOpensAt = undefined; return; }
    this.lobbyOpensAt = new Date(this.startAt.getTime() - this.bufferSeconds * 1000);
    this.updateCountdown();
  }

  private updateCountdown() {
    const now = new Date();
    if (!this.startAt) {
      this.countdownLabel = '';
      this.countdownValue = '';
      return;
    }
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
    // Active — compute current index and time left
    // Find latest scheduled anchor <= now, else use index 0 if in the past
    let anchorIndex = -1;
    let anchorTime: Date | null = null;
    this.schedule.forEach((date, idx) => {
      if (date <= now && (anchorTime == null || date > anchorTime)) {
        anchorTime = date; anchorIndex = idx;
      }
    });
    if (anchorTime == null) {
      // Not started yet
      this.countdownLabel = 'Starts in';
      this.countdownValue = this.formatDiff(this.startAt, now);
      return;
    }
    const elapsedSec = Math.floor((now.getTime() - (anchorTime as Date).getTime()) / 1000);
    const advance = Math.floor(elapsedSec / Math.max(1, this.perQuestionSeconds));
    this.currentIndex = Math.min(this.total > 0 ? this.total - 1 : 0, Math.max(anchorIndex, anchorIndex + advance));
    const intoQuestion = elapsedSec % Math.max(1, this.perQuestionSeconds);
    const remaining = Math.max(0, this.perQuestionSeconds - intoQuestion);
    this.countdownLabel = `Q ${this.total ? this.currentIndex + 1 : 0}/${this.total || 0} · Time left`;
    this.countdownValue = this.formatSec(remaining);
  }

  private formatDiff(target: Date, now: Date): string {
    const ms = Math.max(0, target.getTime() - now.getTime());
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  private formatSec(totalSec: number): string {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  jump(delta: number) {
    if (this.total <= 0) return;
    const next = Math.min(this.total - 1, Math.max(0, (this.currentIndex >= 0 ? this.currentIndex : 0) + delta));
    this.live.overrideNext(this.sessionId, next);
  }

  endSession() {
    this.live.endSession(this.sessionId);
  }
}
