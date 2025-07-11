import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface LogEntry {
    timestamp: Date;
    level: 'log' | 'error' | 'warn' | 'info';
    message: string;
}

@Injectable({
    providedIn: 'root'
})
export class LoggingService {
    private logs: LogEntry[] = [];
    private logsSubject = new BehaviorSubject<LogEntry[]>([]);
    logs$ = this.logsSubject.asObservable();

    constructor() {
        this.patchConsole();
    }

    private patchConsole() {
        (['log', 'error', 'warn', 'info'] as const).forEach(level => {
            const original = console[level].bind(console);
            console[level] = (...args: any[]) => {
                const message = args.map(a => {
                    if (typeof a === 'object') {
                        try { return JSON.stringify(a); } catch { return String(a); }
                    }
                    return String(a);
                }).join(' ');
                this.logs.push({ timestamp: new Date(), level, message });
                this.logsSubject.next([...this.logs]);
                original(...args);
            };
        });
    }

    clear() {
        this.logs = [];
        this.logsSubject.next([]);
    }
}
