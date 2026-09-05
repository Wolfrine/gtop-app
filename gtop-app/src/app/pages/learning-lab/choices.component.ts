import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-lab-choices',
  standalone: true,
  imports: [CommonModule],
  template: `<fieldset class="choices" [disabled]="disabled">
    <legend class="sr-only">{{ label }}</legend>
    <label
      *ngFor="let choice of choices; let i = index"
      class="choice"
      [class.selected]="value === i"
      ><input
        type="radio"
        [name]="id"
        [checked]="value === i"
        (change)="selected.emit(i)"
      /><span>{{ choice }}</span></label
    >
  </fieldset>`,
})
export class LabChoicesComponent {
  @Input() id = '';
  @Input() label = '';
  @Input() choices: readonly string[] = [];
  @Input() value?: number;
  @Input() disabled = false;
  @Output() selected = new EventEmitter<number>();
}
