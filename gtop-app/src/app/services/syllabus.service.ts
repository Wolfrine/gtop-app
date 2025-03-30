import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, getCountFromServer, getDocs, onSnapshot, query, where, writeBatch } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

export interface SyllabusItem {
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

    async editSyllabus(oldPath: SyllabusItem, newPath: SyllabusItem, editedBy: string): Promise<void> {
        const syllabusCollRef = collection(this.firestore, 'syllabus');
        const oldDocRef = doc(this.firestore, `syllabus/${oldPath.board}_${oldPath.standard}_${oldPath.subject}_${oldPath.chapter}`);
        const newDocRef = doc(this.firestore, `syllabus/${newPath.board}_${newPath.standard}_${newPath.subject}_${newPath.chapter}`);

        const questionsRef = collection(this.firestore, 'questions');
        const q = query(
            questionsRef,
            where('board', '==', oldPath.board),
            where('standard', '==', oldPath.standard),
            where('subject', '==', oldPath.subject),
            where('chapter', '==', oldPath.chapter)
        );

        const questionSnapshot = await getDocs(q);
        const totalQuestions = questionSnapshot.docs.length;
        const questionIds = questionSnapshot.docs.map(doc => doc.id);

        // Step 1: Create or update new syllabus doc
        await writeBatch(this.firestore).set(newDocRef, {
            ...newPath,
            mcqCount: totalQuestions
        }).delete(oldDocRef).commit();

        // Step 2: Batch update questions
        const batchSize = 500;
        for (let i = 0; i < totalQuestions; i += batchSize) {
            const batch = writeBatch(this.firestore);
            const slice = questionSnapshot.docs.slice(i, i + batchSize);
            slice.forEach(docSnap => {
                const docRef = doc(this.firestore, `questions/${docSnap.id}`);
                batch.update(docRef, {
                    subject: newPath.subject,
                    chapter: newPath.chapter
                });
            });
            await batch.commit();
        }

        // Step 3: Log the update
        const logRef = doc(collection(this.firestore, 'AdminLogs/edits'));
        await writeBatch(this.firestore).set(logRef, {
            type: 'syllabus-edit',
            editedBy,
            timestamp: new Date(), // You can replace with serverTimestamp() if Firestore admin SDK is used
            originalValue: oldPath,
            newValue: newPath,
            affectedDocuments: questionIds
        }).commit();

        console.log(`✔ Syllabus edited and ${totalQuestions} questions updated.`);
    }




}
