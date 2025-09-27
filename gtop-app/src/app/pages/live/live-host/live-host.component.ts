import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-live-host',
  standalone: true,
  imports: [CommonModule, MatCardModule, AppCardDirective],
  templateUrl: './live-host.component.html',
  styleUrls: ['./live-host.component.scss']
})
export class LiveHostComponent implements OnInit, OnDestroy {
  sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
  joinCode: string | null = null;
  status: string | null = null;
  sub?: () => void;

  constructor(private route: ActivatedRoute, private live: LiveQuizService) {}

  ngOnInit(): void {
    this.sub = this.live.observeSession<any>(this.sessionId, (s) => {
      this.joinCode = s?.joinCode ?? null;
      this.status = s?.status ?? null;
    });
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub();
  }
}
