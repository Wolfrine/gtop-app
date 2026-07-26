import { Injectable, signal } from '@angular/core';
import { DeviceDiagnosticContext, ShellContext, ShellDisplayMode } from './models';

export type DiagnosticLevel = 'error' | 'warning' | 'info';
export type DiagnosticCategory = 'auth' | 'console' | 'runtime' | 'network' | 'system';

export interface ClientDiagnostic {
  id: string;
  level: DiagnosticLevel;
  category: DiagnosticCategory;
  message: string;
  detail?: string;
  code?: string;
  route: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class DiagnosticsService {
  readonly records = signal<ClientDiagnostic[]>(this.read());
  readonly panelOpen = signal(false);
  private static listenersInstalled = false;
  private shellContext?: ShellContext;
  private shellDisplayMode?: ShellDisplayMode;

  constructor() {
    if (DiagnosticsService.listenersInstalled) return;
    DiagnosticsService.listenersInstalled = true;
    window.addEventListener('error', (event) =>
      this.captureError('runtime', event.message || 'Browser runtime error', event.error),
    );
    window.addEventListener('unhandledrejection', (event) =>
      this.captureError('runtime', 'Unhandled promise rejection', event.reason),
    );
    window.addEventListener('online', () =>
      this.capture('info', 'network', 'Network connection restored.'),
    );
    window.addEventListener('offline', () =>
      this.capture('warning', 'network', 'Network connection lost.'),
    );
    this.interceptConsole('error', 'error');
    this.interceptConsole('warn', 'warning');
    this.capture(
      'info',
      'system',
      'Client diagnostics initialized.',
      `online=${navigator.onLine}; secureContext=${window.isSecureContext}`,
    );
  }

  capture(
    level: DiagnosticLevel,
    category: DiagnosticCategory,
    message: string,
    detail?: string,
    code?: string,
  ): void {
    const safeMessage = this.redact(message || 'No diagnostic message was provided.');
    const safeDetail = detail ? this.redact(detail) : undefined;
    const safeCode = code ? this.redact(code) : undefined;
    const latest = this.records()[0];
    if (
      latest &&
      latest.message === safeMessage &&
      latest.code === safeCode &&
      Date.now() - Date.parse(latest.createdAt) < 1_500
    ) {
      return;
    }
    const next = [
      {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        level,
        category,
        message: safeMessage,
        detail: safeDetail,
        code: safeCode,
        route: `${location.pathname}${location.search}`,
        createdAt: new Date().toISOString(),
      },
      ...this.records(),
    ].slice(0, 200);
    this.records.set(next);
    try {
      localStorage.setItem('gtop-v2-diagnostics', JSON.stringify(next));
    } catch {
      // Diagnostics must never break the application when storage is unavailable.
    }
  }

  captureError(category: DiagnosticCategory, message: string, error: unknown): void {
    const value = error as { code?: unknown; message?: unknown; stack?: unknown } | null;
    const errorMessage = value?.message ? String(value.message) : this.render(error);
    const stack = value?.stack ? String(value.stack) : undefined;
    this.capture(
      'error',
      category,
      message,
      [errorMessage, stack].filter(Boolean).join('\n'),
      value?.code ? String(value.code) : undefined,
    );
  }

  runSelfCheck(): void {
    const context = this.deviceContext();
    const checks = [
      `online=${navigator.onLine}`,
      `secureContext=${window.isSecureContext}`,
      `indexedDB=${typeof indexedDB !== 'undefined'}`,
      `localStorage=${this.storageAvailable()}`,
      `standalone=${context.standalone}`,
      `viewport=${context.viewportWidth}x${context.viewportHeight}`,
      `visualViewport=${context.visualViewportWidth ?? 'n/a'}x${context.visualViewportHeight ?? 'n/a'}`,
      `orientation=${context.orientation}`,
      `pointer=${context.coarsePointer ? 'coarse' : 'fine'}`,
      `hover=${context.hoverCapable}`,
      `shell=${context.shellContext ?? 'public'}/${context.shellDisplayMode ?? 'standard'}`,
      `googleIdentity=${Boolean(window.google?.accounts?.id)}`,
    ];
    this.capture('info', 'system', 'Device self-check completed.', checks.join('; '));
  }

  openPanel(): void {
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  setShellContext(context?: ShellContext, displayMode: ShellDisplayMode = 'standard'): void {
    this.shellContext = context;
    this.shellDisplayMode = displayMode;
  }

  deviceContext(): DeviceDiagnosticContext {
    const visual = window.visualViewport;
    return {
      viewportWidth: Math.round(window.innerWidth),
      viewportHeight: Math.round(window.innerHeight),
      visualViewportWidth: visual ? Math.round(visual.width) : undefined,
      visualViewportHeight: visual ? Math.round(visual.height) : undefined,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
      standalone: this.matches('(display-mode: standalone)'),
      coarsePointer: this.matches('(pointer: coarse)'),
      hoverCapable: this.matches('(hover: hover)'),
      shellContext: this.shellContext,
      shellDisplayMode: this.shellDisplayMode,
    };
  }

  clear(): void {
    this.records.set([]);
    try {
      localStorage.removeItem('gtop-v2-diagnostics');
    } catch {
      // Keep clearing the in-memory records even when storage is unavailable.
    }
  }

  copy(record: ClientDiagnostic): Promise<void> {
    return navigator.clipboard.writeText(this.format(record));
  }

  copyAll(): Promise<void> {
    return navigator.clipboard.writeText(this.exportText());
  }

  exportText(): string {
    const device = this.deviceContext();
    const header = [
      'GTOP client diagnostics',
      `generated=${new Date().toISOString()}`,
      `url=${location.origin}${location.pathname}${location.search}`,
      `online=${navigator.onLine}`,
      `language=${navigator.language}`,
      `viewport=${device.viewportWidth}x${device.viewportHeight}`,
      `visualViewport=${device.visualViewportWidth ?? 'n/a'}x${device.visualViewportHeight ?? 'n/a'}`,
      `orientation=${device.orientation}`,
      `standalone=${device.standalone}`,
      `pointer=${device.coarsePointer ? 'coarse' : 'fine'}`,
      `hover=${device.hoverCapable}`,
      `shell=${device.shellContext ?? 'public'}/${device.shellDisplayMode ?? 'standard'}`,
      `userAgent=${this.redact(navigator.userAgent)}`,
    ].join('\n');
    const records = this.records()
      .map((record) => this.format(record))
      .join('\n\n');
    return `${header}\n\n${records || 'No diagnostic events captured.'}`;
  }

  private format(record: ClientDiagnostic): string {
    return [
      `${record.createdAt} ${record.level.toUpperCase()} [${record.category}] ${record.route}`,
      record.code ? `code=${record.code}` : '',
      record.message,
      record.detail ?? '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private interceptConsole(method: 'error' | 'warn', level: 'error' | 'warning'): void {
    const original = console[method].bind(console);
    console[method] = (...values: unknown[]) => {
      original(...values);
      const rendered = values.map((value) => this.render(value));
      this.capture(level, 'console', `console.${method}`, rendered.join(' '));
    };
  }

  private render(value: unknown): string {
    if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private redact(value: string): string {
    return value
      .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-jwt]')
      .replace(
        /(credential|idToken|accessToken|refreshToken|password|authorization)(["'\s:=]+)([^\s,;}"']+)/gi,
        '$1$2[redacted]',
      )
      .slice(0, 8_000);
  }

  private storageAvailable(): boolean {
    try {
      const key = '__gtop_diagnostics_check__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  private matches(query: string): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  }

  private read(): ClientDiagnostic[] {
    try {
      const parsed = JSON.parse(localStorage.getItem('gtop-v2-diagnostics') || '[]') as Array<
        Partial<ClientDiagnostic>
      >;
      return parsed.slice(0, 200).map((record) => ({
        id: String(record.id ?? `${Date.now()}-${Math.random()}`),
        level: record.level === 'warning' || record.level === 'info' ? record.level : 'error',
        category: record.category ?? 'runtime',
        message: String(record.message ?? 'Unknown diagnostic'),
        detail: record.detail,
        code: record.code,
        route: String(record.route ?? '/'),
        createdAt: String(record.createdAt ?? new Date().toISOString()),
      }));
    } catch {
      return [];
    }
  }
}
