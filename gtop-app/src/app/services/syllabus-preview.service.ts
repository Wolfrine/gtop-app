import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, writeBatch } from '@angular/fire/firestore';

export interface SyllabusPreviewItem {
    board: string;
    standard: string;
    subject: string;
    chapter: string;
    mcqCount: number;
}

@Injectable({ providedIn: 'root' })
export class SyllabusPreviewService {
    private previewCollection = collection(this.firestore, 'syllabus-preview');

    constructor(private firestore: Firestore) {}

    async savePreview(items: SyllabusPreviewItem[]): Promise<void> {
        const batch = writeBatch(this.firestore);
        for (const item of items) {
            const docId = `${item.board}_${item.standard}_${item.subject}_${item.chapter}`.replace(/\s+/g, '_');
            const docRef = doc(this.previewCollection, docId);
            batch.set(docRef, item, { merge: true });
        }
        await batch.commit();
    }
}
