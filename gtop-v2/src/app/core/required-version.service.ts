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
        if (snapshot.exists()) updates.setRequiredVersion(String(snapshot.data()['version'] ?? ''));
      },
      () => undefined,
    );
  }
}
