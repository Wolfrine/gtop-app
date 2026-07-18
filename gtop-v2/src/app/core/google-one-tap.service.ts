import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthStore } from './auth.store';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: Record<string, unknown>): void;
          prompt(): void;
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
          if (!response.credential) return;
          const profile = await this.auth.signInWithGoogleIdToken(response.credential);
          const returnUrl = new URLSearchParams(location.search).get('returnUrl');
          await this.router.navigateByUrl(
            returnUrl || (profile.role === 'admin' ? '/admin' : profile.board && profile.standard ? '/dashboard' : '/profile-setup'),
          );
        },
      });
      window.google?.accounts.id.prompt();
    } catch {
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
