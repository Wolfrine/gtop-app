import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-ui-kitchen',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  templateUrl: './ui-kitchen.component.html',
  styleUrls: ['./ui-kitchen.component.scss'],
})
export class UiKitchenComponent {
  readonly viewports = [
    { label: 'Phone · 360', width: 360 },
    { label: 'Phone · 390', width: 390 },
    { label: 'Tablet · 768', width: 768 },
    { label: 'Desktop · 1024', width: 1024 },
  ];
  previewWidth = 390;
  previewOpen = false;
}
