import { Injectable, signal } from '@angular/core';

export interface ClientDiagnostic {
  id: string;
  level: 'error' | 'warning';
  message: string;
  detail?: string;
  route: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class DiagnosticsService {
  readonly records = signal<ClientDiagnostic[]>(this.read());
  constructor() {
    window.addEventListener('error', (event) =>
      this.capture('error', event.message, event.error?.stack),
    );
    window.addEventListener('unhandledrejection', (event) =>
      this.capture('error', 'Unhandled promise rejection', String(event.reason)),
    );
  }
  capture(level: ClientDiagnostic['level'], message: string, detail?: string): void {
    const next = [
      {
        id: crypto.randomUUID(),
        level,
        message,
        detail,
        route: location.pathname,
        createdAt: new Date().toISOString(),
      },
      ...this.records(),
    ].slice(0, 200);
    this.records.set(next);
    try {
      localStorage.setItem('gtop-v2-diagnostics', JSON.stringify(next));
    } catch {}
  }
  clear(): void {
    this.records.set([]);
    localStorage.removeItem('gtop-v2-diagnostics');
  }
  copy(record: ClientDiagnostic): Promise<void> {
    return navigator.clipboard.writeText(
      `${record.createdAt} ${record.level.toUpperCase()} ${record.route}\n${record.message}\n${record.detail ?? ''}`,
    );
  }
  private read(): ClientDiagnostic[] {
    try {
      return JSON.parse(localStorage.getItem('gtop-v2-diagnostics') || '[]') as ClientDiagnostic[];
    } catch {
      return [];
    }
  }
}
