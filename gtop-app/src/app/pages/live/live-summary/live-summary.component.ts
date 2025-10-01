import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { QuizService } from '../../../services/quiz.service';

@Component({
  selector: 'app-live-summary',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatListModule, MatIconModule, AppCardDirective],
  templateUrl: './live-summary.component.html',
  styleUrls: ['./live-summary.component.scss']
})
export class LiveSummaryComponent implements OnInit, OnDestroy {
  @Input() sessionIdInput?: string;
  sessionId = '';
  results: any[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private router: Router, private quiz: QuizService) {}

  ngOnInit(): void {
    this.sessionId = this.sessionIdInput || this.route.snapshot.paramMap.get('sessionId') || '';
    if (!this.sessionId) { this.loading = false; return; }
    this.load();
  }

  ngOnDestroy(): void {}

  private async load() {
    this.loading = true;
    const rows = await this.quiz.fetchLiveResultsForSession(this.sessionId);
    this.results = rows.map((r: any) => ({
      id: r.id,
      userName: r.userName || 'Anonymous',
      total: r.totalQuestions || 0,
      correct: r.correctAnswers || 0,
      percentage: r.percentage || 0,
      totalTimeMs: typeof r.totalTimeMs === 'number' ? r.totalTimeMs : null
    }));
    this.loading = false;
  }
}
