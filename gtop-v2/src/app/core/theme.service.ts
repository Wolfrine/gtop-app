import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { AuthStore } from './auth.store';
import { FirebaseClient } from './firebase';
import { MotionPreset, PublishedAppearance, ThemeId } from './models';
import { GTOP_THEME_DEFINITIONS as GTOP_THEMES } from './theme.definitions';

const fallback: PublishedAppearance = {
  themeId: 'academic-editorial',
  motionPreset: 'purposeful',
  version: 1,
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly published = signal<PublishedAppearance>(fallback);
  readonly previewTheme = signal<ThemeId | null>(null);
  readonly activeTheme = computed(() => this.previewTheme() ?? this.published().themeId);
  readonly themes = GTOP_THEMES;
  private unsubscribe?: () => void;

  constructor(
    private readonly firebase: FirebaseClient,
    private readonly auth: AuthStore,
  ) {
    this.apply(fallback.themeId, fallback.motionPreset);
    this.unsubscribe = onSnapshot(
      doc(this.firebase.firestore, 'Meta', 'appearance'),
      (snapshot) => {
        const value = snapshot.exists() ? this.normalize(snapshot.data()) : fallback;
        this.published.set(value);
        if (!this.previewTheme()) this.apply(value.themeId, value.motionPreset);
      },
      () => this.apply(fallback.themeId, fallback.motionPreset),
    );
  }

  preview(themeId: ThemeId): void {
    this.previewTheme.set(themeId);
    this.apply(themeId, this.published().motionPreset);
  }

  resetPreview(): void {
    this.previewTheme.set(null);
    this.apply(this.published().themeId, this.published().motionPreset);
  }

  async publish(themeId: ThemeId): Promise<void> {
    const current = await getDoc(doc(this.firebase.firestore, 'Meta', 'appearance'));
    const version = current.exists() ? Number(current.data()['version'] ?? 0) + 1 : 1;
    const profile = this.auth.profile();
    await setDoc(doc(this.firebase.firestore, 'Meta', 'appearance'), {
      themeId,
      motionPreset: 'purposeful' satisfies MotionPreset,
      version,
      updatedBy: {
        uid: profile?.uid ?? null,
        name: profile?.displayName || 'Administrator',
        email: profile?.email ?? null,
        kind: 'user',
      },
      updatedAt: serverTimestamp(),
    });
    this.previewTheme.set(null);
  }

  private apply(themeId: ThemeId, motion: MotionPreset): void {
    const root = this.document.documentElement;
    root.dataset['theme'] = themeId;
    root.dataset['motion'] = motion;
    root.style.colorScheme = GTOP_THEMES.find((theme) => theme.id === themeId)?.dark
      ? 'dark'
      : 'light';
  }

  private normalize(raw: Record<string, unknown>): PublishedAppearance {
    const candidate = String(raw['themeId']) as ThemeId;
    return {
      themeId: GTOP_THEMES.some((theme) => theme.id === candidate) ? candidate : fallback.themeId,
      motionPreset: raw['motionPreset'] === 'reduced' ? 'reduced' : 'purposeful',
      version: Number(raw['version'] ?? 1),
      updatedBy: raw['updatedBy'] as PublishedAppearance['updatedBy'],
      updatedAt: raw['updatedAt'],
    };
  }
}
