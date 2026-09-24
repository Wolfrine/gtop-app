import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';

// Reuse the established application's configured client and authenticated session.
@Injectable({ providedIn: 'root' })
export class FirebaseClient {
  constructor(readonly firestore: Firestore) {}
}
