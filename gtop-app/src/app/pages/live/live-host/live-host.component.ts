import { Component, OnDestroy, OnInit, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { Subscription, interval } from 'rxjs';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionPanel } from '@angular/material/expansion';

@Component({
  selector: 'app-live-host',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, AppCardDirective, MatListModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatExpansionModule, MatChipsModule],
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
  currentIndex = -1;
  total = 0;
  anchorIndex = 0;
  anchorAt?: Date;
  startEdit: string = '';
  private endedFired = false;

  participants: { uid: string; displayName: string; photoURL?: string }[] = [];
  questions: any[] = [];
  answersSubs: Map<number, () => void> = new Map();
  answersByIndex: Map<number, { uid: string; displayName: string; responseMs: number }[]> = new Map();
  timeLeftSec = 0;

  @ViewChildren(MatExpansionPanel) panels!: QueryList<MatExpansionPanel>;

  constructor(private route: ActivatedRoute, private live: LiveQuizService) {}

  ngOnInit(): void {
    this.sub = this.live.observeSession<any>(this.sessionId, (s) => {
      this.joinCode = s?.joinCode ?? null;
      this.status = s?.status ?? null;
      this.startAt = s?.scheduledStartAt?.toDate ? s.scheduledStartAt.toDate() : undefined;
      this.bufferSeconds = Number(s?.bufferSeconds || 0);
      this.perQuestionSeconds = Number(s?.perQuestionSeconds || 20);
      this.total = Array.isArray(s?.questionIds) ? s.questionIds.length : 0;
      this.anchorIndex = Number(s?.anchorIndex || 0);
      this.anchorAt = s?.anchorAt?.toDate ? s.anchorAt.toDate() : undefined;
      if (this.questions.length === 0 && s?.questionIds?.length) {
        this.live.fetchQuestionsForSession(s).then(qs => {
          const byId = new Map(qs.map((q: any) => [q.id, q]));
          this.questions = s.questionIds.map((id: string) => byId.get(id)).filter(Boolean);
        }).catch(() => {});
      }
      this.computeLobbyOpen();
      this.startEdit = this.startAt ? this.toDateTimeLocal(this.startAt) : '';
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
    this.answersSubs.forEach(unsub => { try { unsub(); } catch {} });
    this.tickSub?.unsubscribe();
  }

  private computeLobbyOpen() {
    if (!this.startAt) { this.lobbyOpensAt = undefined; return; }
    this.lobbyOpensAt = new Date(this.startAt.getTime() - this.bufferSeconds * 1000);
    this.updateCountdown();
  }

  private updateCountdown() {
    const now = new Date();
    if (this.status === 'ended') { this.countdownLabel = 'Ended'; this.countdownValue = ''; return; }
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
    // Active — compute using anchor pair (anchorAt/anchorIndex)
    const base = this.anchorAt ?? this.startAt;
    const elapsedSec = Math.max(0, Math.floor((now.getTime() - base.getTime()) / 1000));
    const advance = Math.floor(elapsedSec / Math.max(1, this.perQuestionSeconds));
    this.currentIndex = Math.min(this.total > 0 ? this.total - 1 : 0, Math.max(0, this.anchorIndex + advance));
    const intoQuestion = elapsedSec % Math.max(1, this.perQuestionSeconds);
    const remaining = Math.max(0, this.perQuestionSeconds - intoQuestion);
    this.timeLeftSec = remaining;
    this.countdownLabel = `Q ${this.total ? this.currentIndex + 1 : 0}/${this.total || 0} · Time left`;
    this.countdownValue = this.formatSec(remaining);

    // Compute absolute quiz end time from base anchor and question count
    if (!this.endedFired && this.total > 0 && this.status !== 'ended') {
      const remainingQuestions = Math.max(0, this.total - this.anchorIndex);
      const endAtMs = base.getTime() + remainingQuestions * this.perQuestionSeconds * 1000;
      if (now.getTime() >= endAtMs) {
        this.endedFired = true;
        try { this.live.endSession(this.sessionId); } catch {}
        return;
      }
    }
    // Fallback: if exactly on last boundary
    if (!this.endedFired && this.total > 0 && this.currentIndex === this.total - 1 && remaining === 0 && this.status !== 'ended') {
      this.endedFired = true;
      try { this.live.endSession(this.sessionId); } catch {}
    }
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

  endSession() {
    this.live.endSession(this.sessionId);
  }

  prev() {
    if (this.total <= 0) return;
    const next = Math.max(0, this.currentIndex - 1);
    this.live.overrideNext(this.sessionId, next);
  }

  next() {
    if (this.total <= 0) return;
    const next = Math.min(this.total - 1, this.currentIndex + 1);
    this.live.overrideNext(this.sessionId, next);
  }

  openPanel(index: number) {
    if (this.answersSubs.has(index)) return;
    const unsub = this.live.observeAnswers(this.sessionId, index, (items) => {
      const rows = (items || [])
        .map((it: any) => ({ uid: it.uid, displayName: it.displayName, responseMs: Number(it.responseMs || 0) }))
        .sort((a, b) => a.responseMs - b.responseMs);
      this.answersByIndex.set(index, rows);
    });
    this.answersSubs.set(index, unsub);
  }

  closePanel(index: number) {
    // keep subscribed for live monitoring; noop for now
  }

  expandAll() {
    if (!this.panels) return;
    this.panels.forEach(p => {
      try { p.open(); } catch {}
    });
  }

  collapseAll() {
    if (!this.panels) return;
    this.panels.forEach(p => {
      try { p.close(); } catch {}
    });
  }

  updateStart(): void {
    if (!this.startEdit) return;
    const d = new Date(this.startEdit);
    if (isNaN(d.getTime())) return;
    this.live.rescheduleStart(this.sessionId, d);
  }

  startNow(): void {
    this.live.startNow(this.sessionId);
  }

  private toDateTimeLocal(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }
}
