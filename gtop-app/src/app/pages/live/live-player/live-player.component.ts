import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-live-player',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule, MatProgressSpinnerModule, MatProgressBarModule, AppCardDirective],
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
  anchorIndex = 0;
  anchorAt?: Date;
  redirected = false;
  optionsLabel = ['A','B','C','D'];
  status: string | null = null;
  timeRemainingSec = 0;
  leaderboard: { uid: string; displayName: string; responseMs: number }[] = [];
  answersSub?: () => void;

  constructor(private route: ActivatedRoute, private router: Router, private live: LiveQuizService) {}

  ngOnInit(): void {
    this.sub = this.live.observeSession<any>(this.sessionId, (s) => {
      if (s && (s.mode || 'live') === 'run') {
        this.router.navigate(['/quiz-run/lobby', this.sessionId]);
        return;
      }
      this.status = s?.status ?? null;
      this.startAt = s?.scheduledStartAt?.toDate ? s.scheduledStartAt.toDate() : undefined;
      this.bufferSeconds = Number(s?.bufferSeconds || 0);
      this.perQuestionSeconds = Number(s?.perQuestionSeconds || 20);
      this.total = Array.isArray(s?.questionIds) ? s.questionIds.length : 0;
      this.anchorIndex = Number(s?.anchorIndex || 0);
      this.anchorAt = s?.anchorAt?.toDate ? s.anchorAt.toDate() : undefined;
      // Fetch questions once when session arrives
      if (!this.questions.length && s) {
        this.live.fetchQuestionsForSession(s).then(qs => {
          // reorder by session.questionIds
          const byId = new Map(qs.map((q: any) => [q.id, q]));
          this.questions = (s.questionIds || []).map((id: string) => byId.get(id)).filter(Boolean);
        }).catch(() => {});
      }
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
    if (this.countdownLabel !== 'Ended' && (this as any).status === 'ended') { this.countdownLabel = 'Ended'; this.countdownValue = ''; }
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
    // If started (based on startAt), redirect to quiz page once
    if (!this.redirected) {
      this.redirected = true;
      this.router.navigate(['/quiz'], { queryParams: { live: 1, sessionId: this.sessionId } });
    }
    // Stay in lobby; show only countdowns/roster (we will navigate immediately above)
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

  getTimePercent(): number {
    const denom = Math.max(1, this.perQuestionSeconds);
    return Math.max(0, Math.min(100, Math.round((this.timeRemainingSec / denom) * 100)));
  }

  getHeaderProgress(): number {
    if (this.total <= 0) return 0;
    const pct = ((this.currentIndex + 1) / this.total) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  selectOption(i: number) {
    if (this.currentIndex < 0) return;
    const q = this.questions[this.currentIndex];
    if (!q) return;
    if (q.selectedIndex != null) return; // freeze after first selection
    q.selectedIndex = i;
    const base = this.anchorAt ?? this.startAt!;
    const questionStartAt = new Date(base.getTime() + (this.currentIndex - this.anchorIndex) * this.perQuestionSeconds * 1000);
    this.live.submitAnswer(this.sessionId, this.currentIndex, i, questionStartAt).catch(() => {});
    if (this.answersSub) this.answersSub();
    this.answersSub = this.live.observeAnswers(this.sessionId, this.currentIndex, (items) => {
      this.leaderboard = (items || [])
        .map(x => ({ uid: (x as any).uid, displayName: (x as any).displayName, responseMs: Number((x as any).responseMs || 0) }))
        .sort((a, b) => a.responseMs - b.responseMs);
    });
  }
}
