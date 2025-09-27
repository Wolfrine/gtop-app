import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';

@Component({
  selector: 'app-live-player',
  standalone: true,
  imports: [CommonModule, MatCardModule, AppCardDirective],
  templateUrl: './live-player.component.html',
  styleUrls: ['./live-player.component.scss']
})
export class LivePlayerComponent {
  sessionId = this.route.snapshot.paramMap.get('sessionId') || '';

  constructor(private route: ActivatedRoute) {}
}

