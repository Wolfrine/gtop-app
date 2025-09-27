import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-live-player',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule, AppCardDirective],
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
  participants: { uid: string; displayName: string; photoURL?: string }[] = [];
  partSub?: () => void;
  perQuestionSeconds = 20;
  currentIndex = -1;
  total = 0;
  questions: any[] = [];
  schedule: Map<number, Date> = new Map();

  constructor(private route: ActivatedRoute, private live: LiveQuizService) {}

  ngOnInit(): void {
    this.sub = this.live.observeSession<any>(this.sessionId, (s) => {
      this.startAt = s?.scheduledStartAt?.toDate ? s.scheduledStartAt.toDate() : undefined;
      this.bufferSeconds = Number(s?.bufferSeconds || 0);
      this.perQuestionSeconds = Number(s?.perQuestionSeconds || 20);
      this.total = Array.isArray(s?.questionIds) ? s.questionIds.length : 0;
      // Fetch questions once when session arrives
      if (!this.questions.length && s) {
        this.live.fetchQuestionsForSession(s).then(qs => {
          // reorder by session.questionIds
          const byId = new Map(qs.map((q: any) => [q.id, q]));
          this.questions = (s.questionIds || []).map((id: string) => byId.get(id)).filter(Boolean);
        }).catch(() => {});
      }
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
      this.participants = list
        .map(p => ({ uid: p.uid, displayName: p.displayName, photoURL: p.photoURL || undefined }))
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
    // Use latest scheduled anchor
    let anchorIndex = -1; let anchorTime: Date | null = null;
    this.schedule.forEach((date, idx) => {
      if (date <= now && (anchorTime == null || date > anchorTime)) { anchorTime = date; anchorIndex = idx; }
    });
    if (anchorTime == null) { this.countdownLabel = 'Starts in'; this.countdownValue = this.formatDiff(this.startAt!, now); return; }
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
}
