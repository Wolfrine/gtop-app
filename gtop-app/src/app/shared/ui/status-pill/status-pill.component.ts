import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-pill.component.html',
  styleUrls: ['./status-pill.component.scss']
})
export class StatusPillComponent {
  @Input() type: 'new' | 'modified' | 'existing' | 'removed' = 'existing';

  get label() {
    switch (this.type) {
      case 'new':
        return 'New';
      case 'modified':
        return 'Modified';
      case 'removed':
        return 'Removed';
      default:
        return 'Existing';
    }
  }
}
