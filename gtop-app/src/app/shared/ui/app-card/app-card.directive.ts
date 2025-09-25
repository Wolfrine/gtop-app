import { Directive, Input } from '@angular/core';

@Directive({
  selector: 'mat-card[appCard]',
  standalone: true,
  host: {
    '[class.card]': 'true',
    '[class.card--hover]': 'hover',
    '[class.card--soft]': 'soft',
  }
})
export class AppCardDirective {
  @Input() soft = false;
  @Input() hover = true;
}

