import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { increment } from 'firebase/firestore';

@Injectable({
    providedIn: 'root'
})
export class GuestAccessService {
    private readonly maxGuestQuizzes = 5;

    constructor(private firestore: Firestore) { }

    getMaxGuestQuizzes(): number {
        return this.maxGuestQuizzes;
    }

    async canAttemptQuiz(userId: string, cachedCount?: number | null): Promise<boolean> {
        if (!userId) {
            return false;
        }

        if (typeof cachedCount === 'number') {
            return cachedCount < this.maxGuestQuizzes;
        }

        const userDoc = await getDoc(doc(this.firestore, `users/${userId}`));
        const guestQuizCount = userDoc.exists() ? Number(userDoc.data()?.['guestQuizCount'] ?? 0) : 0;

        return guestQuizCount < this.maxGuestQuizzes;
    }

    async recordGuestAttempt(userId: string): Promise<void> {
        if (!userId) {
            return;
        }

        const userRef = doc(this.firestore, `users/${userId}`);
        await setDoc(userRef, {
            guestQuizCount: increment(1)
        }, { merge: true });
    }
}
