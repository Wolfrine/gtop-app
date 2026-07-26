import { beforeEach, describe, expect, it } from 'vitest';
import { DiagnosticsService } from './diagnostics.service';

describe('DiagnosticsService', () => {
  beforeEach(() => localStorage.clear());

  it('captures Firebase error codes while redacting credentials and JWTs', () => {
    const diagnostics = new DiagnosticsService();
    diagnostics.captureError('auth', 'Google popup sign-in failed.', {
      code: 'auth/popup-blocked',
      message:
        'credential=secret-value idToken=eyJabc.def.ghi authorization:Bearer-secret',
    });

    const record = diagnostics.records()[0];
    expect(record.code).toBe('auth/popup-blocked');
    expect(record.category).toBe('auth');
    expect(record.detail).toContain('[redacted]');
    expect(JSON.stringify(diagnostics.records())).not.toContain('secret-value');
    expect(JSON.stringify(diagnostics.records())).not.toContain('eyJabc.def.ghi');
  });

  it('keeps a bounded local history', () => {
    const diagnostics = new DiagnosticsService();
    for (let index = 0; index < 205; index += 1) {
      diagnostics.capture('info', 'system', `event-${index}`);
    }
    expect(diagnostics.records()).toHaveLength(200);
    expect(diagnostics.records()[0].message).toBe('event-204');
  });

  it('adds sanitized device and shell context to copied diagnostics', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    const diagnostics = new DiagnosticsService();
    diagnostics.setShellContext('admin', 'immersive');
    diagnostics.runSelfCheck();

    const report = diagnostics.exportText();
    expect(report).toContain('viewport=390x844');
    expect(report).toContain('orientation=portrait');
    expect(report).toContain('shell=admin/immersive');
  });
});
