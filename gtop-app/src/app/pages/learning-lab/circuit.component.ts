import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CircuitMode } from './lesson';
@Component({
  selector: 'app-lab-circuit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './circuit.component.html',
})
export class LabCircuitComponent {
  @Input() voltage = 6;
  @Input() r1 = 6;
  @Input() r2 = 6;
  @Input() mode: CircuitMode = 'single';
  @Input() closed = true;
  @Input() current = 1;
  get paths(): string[] {
    return this.mode === 'parallel'
      ? [
          'M70 175 V80 H240',
          'M360 80 H610 V205',
          'M170 80 V205 H240',
          'M360 205 H610',
          'M610 205 V330 H390',
          'M340 330 H70 V220',
        ]
      : this.mode === 'series'
        ? [
            'M70 175 V95 H180',
            'M270 95 H405',
            'M495 95 H610 V330 H390',
            'M340 330 H70 V220',
          ]
        : ['M70 175 V95 H275', 'M395 95 H610 V330 H390', 'M340 330 H70 V220'];
  }
  get resistors() {
    return this.mode === 'single'
      ? [{ x: 275, y: 95, w: 120, label: `R₁ ${this.r1} Ω` }]
      : this.mode === 'series'
        ? [
            { x: 180, y: 95, w: 90, label: `R₁ ${this.r1} Ω` },
            { x: 405, y: 95, w: 90, label: `R₂ ${this.r2} Ω` },
          ]
        : [
            { x: 240, y: 80, w: 120, label: `R₁ ${this.r1} Ω` },
            { x: 240, y: 205, w: 120, label: `R₂ ${this.r2} Ω` },
          ];
  }
  get duration() {
    return `${Math.max(0.28, 1.6 / (this.current + 0.5))}s`;
  }
}
