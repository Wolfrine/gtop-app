import { Injectable } from '@angular/core';
import { doc, onSnapshot } from 'firebase/firestore';
import { AppUpdateService } from './app-update.service';
import { FirebaseClient } from './firebase';

@Injectable({ providedIn: 'root' })
export class RequiredVersionService {
  constructor(firebase: FirebaseClient, updates: AppUpdateService) {
    onSnapshot(
      doc(firebase.firestore, 'Meta', 'version'),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        updates.setRequiredRelease(
          String(data['version'] ?? ''),
          data['commit'] ? String(data['commit']) : undefined,
        );
      },
      () => undefined,
    );
  }
}
