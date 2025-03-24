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

async updateSyllabusCountsEfficient() {
    const syllabusCollection = collection(this.firestore, 'syllabus');
    const syllabusSnapshot = await getDocs(syllabusCollection);
    const batch = writeBatch(this.firestore);

    for (const docSnap of syllabusSnapshot.docs) {
        const syllabusDoc = docSnap.ref;
        const syllabusData = docSnap.data();

        const mcqQuery = query(
            collection(this.firestore, 'questions'),
            where('board', '==', syllabusData.board),
            where('standard', '==', syllabusData.standard),
            where('subject', '==', syllabusData.subject),
            where('chapter', '==', syllabusData.chapter)
        );

        const mcqSnapshot = await getCountFromServer(mcqQuery);
        const count = mcqSnapshot.data().count;

        batch.update(syllabusDoc, { mcqCount: count });
    }

    await batch.commit();
    console.log('Optimized syllabus counts updated!');
}



}
