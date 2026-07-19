import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthStore } from './auth.store';
import { DiagnosticsService } from './diagnostics.service';

interface GooglePromptMoment {
  isNotDisplayed(): boolean;
  getNotDisplayedReason(): string;
  isSkippedMoment(): boolean;
  getSkippedReason(): string;
  isDismissedMoment(): boolean;
  getDismissedReason(): string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: Record<string, unknown>): void;
          prompt(listener?: (moment: GooglePromptMoment) => void): void;
          cancel(): void;
        };
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleOneTapService {
  private initialized = false;
  constructor(
    private readonly auth: AuthStore,
    private readonly router: Router,
    private readonly diagnostics: DiagnosticsService,
  ) {
    void this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initialized || !environment.googleOneTapEnabled) return;
    const state = await this.auth.ready();
    if (state.phase === 'authenticated' || location.hostname === 'localhost') return;
    this.initialized = true;
    try {
      await this.loadScript();
      window.google?.accounts.id.initialize({
        client_id: environment.googleOneTapClientId,
        auto_select: true,
        cancel_on_tap_outside: true,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            this.diagnostics.capture('warning', 'auth', 'Google One Tap returned no credential.');
            return;
          }
          try {
            const profile = await this.auth.signInWithGoogleIdToken(response.credential);
            const returnUrl = new URLSearchParams(location.search).get('returnUrl');
            await this.router.navigateByUrl(
              returnUrl || (profile.role === 'admin' ? '/admin' : profile.board && profile.standard ? '/dashboard' : '/profile-setup'),
            );
          } catch (error) {
            this.diagnostics.captureError('auth', 'Google One Tap callback failed.', error);
          }
        },
      });
      this.diagnostics.capture('info', 'auth', 'Google One Tap initialized.');
      window.google?.accounts.id.prompt((moment) => {
        if (moment.isNotDisplayed()) {
          this.diagnostics.capture(
            'warning',
            'auth',
            'Google One Tap was not displayed.',
            undefined,
            moment.getNotDisplayedReason(),
          );
        } else if (moment.isSkippedMoment()) {
          this.diagnostics.capture(
            'warning',
            'auth',
            'Google One Tap was skipped.',
            undefined,
            moment.getSkippedReason(),
          );
        } else if (moment.isDismissedMoment()) {
          this.diagnostics.capture(
            'info',
            'auth',
            'Google One Tap was dismissed.',
            undefined,
            moment.getDismissedReason(),
          );
        }
      });
    } catch (error) {
      this.diagnostics.captureError('auth', 'Google One Tap initialization failed.', error);
      this.initialized = false;
    }
  }

  private loadScript(): Promise<void> {
    if (window.google?.accounts) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('#google-one-tap-script');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-one-tap-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}
