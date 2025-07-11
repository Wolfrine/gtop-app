import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { LoggingService, LogEntry } from '../../services/logging.service';

@Component({
    selector: 'app-logs',
    standalone: true,
    imports: [CommonModule, MatToolbarModule, MatListModule, MatButtonModule],
    templateUrl: './logs.component.html',
    styleUrls: ['./logs.component.scss']
})
export class LogsComponent {
    logs: LogEntry[] = [];

    constructor(private loggingService: LoggingService) {
        this.loggingService.logs$.subscribe(l => this.logs = l);
    }

    clearLogs() {
        this.loggingService.clear();
    }
}
