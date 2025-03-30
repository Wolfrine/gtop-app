import { Injectable, signal } from '@angular/core';
import { Firestore, doc, onSnapshot } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class VersionService {
    firestoreVersion = signal<string | null>(null);

    constructor(private firestore: Firestore) {
        this.listenToVersion();
    }

    private listenToVersion() {
        const versionDoc = doc(this.firestore, 'Meta/version');
        onSnapshot(versionDoc, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as { version?: string };
                this.firestoreVersion.set(data.version || null);
                console.log('[VersionService] Firestore version:', data.version);
            } else {
                console.warn('[VersionService] /Meta/version not found.');
            }
        });
    }
}
