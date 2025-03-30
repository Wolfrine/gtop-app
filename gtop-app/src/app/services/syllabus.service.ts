import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, getCountFromServer, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

export interface SyllabusItem {
    id?: string;
    board: string;
    standard: string;
    subject: string;
    chapter: string;
    mcqCount: number;
}

@Injectable({
    providedIn: 'root'
})
export class SyllabusService {

    private syllabusCollection = collection(this.firestore, 'syllabus');
    syllabus$ = new BehaviorSubject<SyllabusItem[]>([]); // Observable syllabus data for reuse

    constructor(private firestore: Firestore) {
        this.loadSyllabus();
    }

    private loadSyllabus() {
        onSnapshot(this.syllabusCollection, (snapshot) => {
            const syllabus: SyllabusItem[] = snapshot.docs.map(doc => ({
                id: doc.id,
                board: doc.data()['board'],
                standard: doc.data()['standard'],
                subject: doc.data()['subject'],
                chapter: doc.data()['chapter'],
                mcqCount: doc.data()['mcqCount'] || 0 // ✅ Fetch mcqCount, default 0
            }));
            console.log('Syllabus Updated:', syllabus);
            this.syllabus$.next(syllabus);
        });
    }

    // Optional: Manual refresh
    async refreshSyllabus() {
        const snapshot = await collectionData(this.syllabusCollection, { idField: 'id' }).toPromise();
        console.log('Manual Syllabus Refresh:', snapshot);
        this.syllabus$.next(snapshot as SyllabusItem[]);
    }

    async updateSyllabusCountsFromIndexedDB() {
        const syllabusCollection = collection(this.firestore, 'syllabus');
        const syllabusSnapshot = await getDocs(syllabusCollection);
        const batch = writeBatch(this.firestore);

        for (const docSnap of syllabusSnapshot.docs) {
            const syllabusDoc = docSnap.ref;
            const syllabusData = docSnap.data();

            const mcqQuery = query(
                collection(this.firestore, 'questions'),
                where('board', '==', syllabusData['board']),
                where('standard', '==', syllabusData['standard']),
                where('subject', '==', syllabusData['subject']),
                where('chapter', '==', syllabusData['chapter'])
            );

            const mcqSnapshot = await getCountFromServer(mcqQuery);
            const count = mcqSnapshot.data().count;

            batch.update(syllabusDoc, { mcqCount: count });
        }

        await batch.commit();
        console.log('Optimized syllabus counts updated!');
    }

    async editSyllabus(
        syllabusId: string,
        oldPath: SyllabusItem,
        newPath: Partial<SyllabusItem>,
        editedBy: string
    ): Promise<void> {
        const syllabusDocRef = doc(this.firestore, `syllabus/${syllabusId}`);

        // 🔍 1. Detect what changed
        const changedFields: Partial<SyllabusItem> = {};
        (['board', 'standard', 'subject', 'chapter'] as const).forEach(key => {
            if (newPath[key] && newPath[key] !== oldPath[key]) {
                changedFields[key] = newPath[key]!;
            }
        });

        // ⚡️ 2. Update Syllabus (only changed fields)
        if (Object.keys(changedFields).length > 0) {
            await updateDoc(syllabusDocRef, changedFields);
        }

        // 🔃 3. If subject/chapter changed, update MCQs
        const shouldUpdateMCQs = changedFields.subject || changedFields.chapter;
        const updatedMCQIds: string[] = [];

        if (shouldUpdateMCQs) {
            const questionsRef = collection(this.firestore, 'questions');
            const q = query(
                questionsRef,
                where('board', '==', oldPath.board),
                where('standard', '==', oldPath.standard),
                where('subject', '==', oldPath.subject),
                where('chapter', '==', oldPath.chapter)
            );

            const snapshot = await getDocs(q);
            const total = snapshot.docs.length;

            const batchSize = 500;
            for (let i = 0; i < total; i += batchSize) {
                const batch = writeBatch(this.firestore);
                const slice = snapshot.docs.slice(i, i + batchSize);

                slice.forEach(docSnap => {
                    const ref = doc(this.firestore, `questions/${docSnap.id}`);
                    updatedMCQIds.push(docSnap.id);
                    batch.update(ref, {
                        ...(changedFields.subject && { subject: changedFields.subject }),
                        ...(changedFields.chapter && { chapter: changedFields.chapter })
                    });
                });

                await batch.commit();
            }
        }

        // 📝 4. Create Admin Log (single write)
        const logId = `log_${Date.now()}`;
        const logRef = doc(this.firestore, `activity/${logId}`);
        await setDoc(logRef, {
            type: 'syllabus-edit',
            editedBy,
            timestamp: serverTimestamp(),
            syllabusId,
            originalValue: oldPath,
            newValue: { ...oldPath, ...changedFields },
            affectedDocuments: updatedMCQIds
        });

        console.log(`✔ Syllabus updated. MCQs updated: ${updatedMCQIds.length}`);
    }




}
