import { Injectable, signal } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { AppUpdateState } from './models';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  readonly online = signal(navigator.onLine);
  readonly installAvailable = signal(false);
  readonly state = signal<AppUpdateState>({ phase: 'current' });
  private installPrompt?: InstallPromptEvent;

  constructor(private readonly updates: SwUpdate) {
    addEventListener('online', () => this.online.set(true));
    addEventListener('offline', () => this.online.set(false));
    addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event as InstallPromptEvent;
      this.installAvailable.set(true);
    });
    if (updates.isEnabled) {
      updates.versionUpdates.subscribe((event) => this.onVersionEvent(event));
      this.state.set({ phase: 'checking' });
      void updates
        .checkForUpdate()
        .then((available) => {
          if (!available && this.state().phase === 'checking') this.state.set({ phase: 'current' });
        })
        .catch((error) => this.fail(error));
    }
    fetch('/version.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value?.commit || value?.version)
          this.state.update((current) => ({
            ...current,
            currentVersion: value?.version ? String(value.version) : current.currentVersion,
            currentCommit: value?.commit ? String(value.commit).slice(0, 8) : current.currentCommit,
            channel: this.releaseChannel(value?.channel),
          }));
      })
      .catch(() => undefined);
  }

  async install(): Promise<void> {
    if (!this.installPrompt) return;
    await this.installPrompt.prompt();
    await this.installPrompt.userChoice;
    this.installPrompt = undefined;
    this.installAvailable.set(false);
  }

  setRequiredRelease(requiredVersion: string, requiredCommit?: string): void {
    if (!requiredVersion) return;
    this.state.update((value) => ({
      ...value,
      requiredVersion,
      requiredCommit: requiredCommit ? requiredCommit.slice(0, 8) : value.requiredCommit,
    }));
    if (
      this.updates.isEnabled &&
      requiredCommit &&
      this.state().currentCommit &&
      !requiredCommit.startsWith(this.state().currentCommit ?? '')
    ) {
      void this.updates.checkForUpdate().catch((error) => this.fail(error));
    }
  }

  async applyUpdate(): Promise<void> {
    if (!this.updates.isEnabled) return;
    this.state.update((value) => ({ ...value, phase: 'applying' }));
    try {
      await this.updates.activateUpdate();
      location.reload();
    } catch (error) {
      this.fail(error);
    }
  }

  private onVersionEvent(event: VersionEvent): void {
    if (event.type === 'VERSION_READY')
      this.state.update((value) => ({ ...value, phase: 'available' }));
    if (event.type === 'VERSION_INSTALLATION_FAILED') this.fail(event.error);
    if (event.type === 'NO_NEW_VERSION_DETECTED')
      this.state.update((value) => ({ ...value, phase: 'current' }));
  }

  private fail(error: unknown): void {
    this.state.update((value) => ({
      ...value,
      phase: 'error',
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  private releaseChannel(value: unknown): 'local' | 'dev' | 'uat' | 'production' {
    return value === 'dev' || value === 'uat' || value === 'production' ? value : 'local';
  }
}
