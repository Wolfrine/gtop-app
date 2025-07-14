import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subject-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subject-card.component.html',
  styleUrls: ['./subject-card.component.scss']
})
export class SubjectCardComponent {
  @Input() name = '';
  @Input() chapterCount = 0;
  @Input() questionCount = 0;
  @Input() selected = false;
}
