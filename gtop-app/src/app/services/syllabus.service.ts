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

    async updateSyllabusCountsFromIndexedDB(syllabusData: any[]) {
        const syllabusCollection = collection(this.firestore, 'syllabus');
        const batch = writeBatch(this.firestore);

        for (const boardItem of syllabusData) {
            const board = boardItem.name;
            if (!board) continue; // Defensive check

            for (const standardItem of boardItem.standards) {
                const standard = standardItem.name;
                if (!standard) continue;

                for (const subjectItem of standardItem.subjects) {
                    const subject = subjectItem.name;
                    if (!subject) continue;

                    for (const chapterItem of subjectItem.chapters) {
                        const chapter = chapterItem.name;
                        if (!chapter) continue;

                        // ✅ Query MCQ count for this syllabus combo
                        const mcqQuery = query(
                            collection(this.firestore, 'questions'),
                            where('board', '==', board),
                            where('standard', '==', standard),
                            where('subject', '==', subject),
                            where('chapter', '==', chapter)
                        );

                        const mcqSnapshot = await getCountFromServer(mcqQuery);
                        const count = mcqSnapshot.data().count;

                        // ✅ Find syllabus doc by board-standard-subject-chapter key
                        const syllabusQuery = query(
                            syllabusCollection,
                            where('board', '==', board),
                            where('standard', '==', standard),
                            where('subject', '==', subject),
                            where('chapter', '==', chapter)
                        );

                        const syllabusDocs = await getDocs(syllabusQuery);
                        if (!syllabusDocs.empty) {
                            const syllabusDoc = syllabusDocs.docs[0].ref;
                            batch.update(syllabusDoc, { mcqCount: count });
                        }
                    }
                }
            }
        }

        await batch.commit();
        console.log('Syllabus counts updated successfully!');
    }


}
