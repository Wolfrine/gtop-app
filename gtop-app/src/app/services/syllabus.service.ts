import { Injectable, OnDestroy } from '@angular/core';
import { Firestore, collection, collectionData, doc, getCountFromServer, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from '@angular/fire/firestore';
import { BehaviorSubject, ReplaySubject, Subscription } from 'rxjs';
import { FirestoreReadService } from './firestore-read.service';

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
export class SyllabusService implements OnDestroy {

    private syllabusCollection = collection(this.firestore, 'syllabus');
    syllabus$ = new BehaviorSubject<SyllabusItem[]>([]); // Observable syllabus data for reuse
    readonly snapshots$ = new ReplaySubject<{ items: SyllabusItem[]; fromCache: boolean }>(1);
    private subscription?:Subscription;

    constructor(private firestore: Firestore, private readonly reads: FirestoreReadService) {
        this.loadSyllabus();
    }

    private loadSyllabus() {
        this.subscription=this.reads.watch(this.syllabusCollection).subscribe({ next: snapshot => {
            const syllabus: SyllabusItem[] = snapshot.docs.map(doc => ({
                id: doc.id,
                board: doc.data()['board'],
                standard: String(doc.data()['standard']),
                subject: doc.data()['subject'],
                chapter: doc.data()['chapter'],
                mcqCount: doc.data()['mcqCount'] || 0 // ✅ Fetch mcqCount, default 0
            }));
            this.syllabus$.next(syllabus);
            this.snapshots$.next({ items: syllabus, fromCache: snapshot.metadata.fromCache });
        }, error: error => this.snapshots$.error(error) });
    }
    ngOnDestroy():void {this.subscription?.unsubscribe();}

    // Optional: Manual refresh
    async refreshSyllabus() {
        const snapshot = await getDocs(this.syllabusCollection);
        this.syllabus$.next(snapshot.docs.map(item => ({ ...item.data(), id:item.id, standard:String(item.data()['standard']) })) as SyllabusItem[]);
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

    }

    async insertComboIfNotExists(board: string, standard: string, subject: string, chapter: string): Promise<void> {
        board = board.trim(); standard = String(standard).trim(); subject = subject.trim(); chapter = chapter.trim();
        if (!board || !standard || !subject || !chapter) throw new Error('A complete syllabus scope is required.');
        const matches = await getDocs(query(this.syllabusCollection, where('board','==',board),
            where('standard','in',/^\d+$/.test(standard) ? [standard,Number(standard)] : [standard]),
            where('subject','==',subject), where('chapter','==',chapter)));
        if (!matches.empty) return;
        const id = 'scope-' + [board,standard,subject,chapter].map(encodeURIComponent).join('~');
        const ref = doc(this.syllabusCollection,id);
        await runTransaction(this.firestore, async transaction => {
            const current = await transaction.get(ref);
            if (!current.exists()) transaction.set(ref,{board,standard,subject,chapter,mcqCount:0,createdAt:serverTimestamp()});
        });
    }

    async updateMcqCountForCombo(board: string, standard: string, subject: string, chapter: string): Promise<void> {
        const syllabusQuery = query(
            collection(this.firestore, 'questions'),
            where('board', '==', board),
            where('standard', '==', standard),
            where('subject', '==', subject),
            where('chapter', '==', chapter)
        );

        const countSnap = await getCountFromServer(syllabusQuery);
        const count = countSnap.data().count;

        // Find existing syllabus doc ID from cached value
        const match = this.syllabus$.value.find(item =>
            item.board === board &&
            item.standard === standard &&
            item.subject === subject &&
            item.chapter === chapter
        );

        if (match?.id) {
            const syllabusDoc = doc(this.firestore, `syllabus/${match.id}`);
            await updateDoc(syllabusDoc, { mcqCount: count });
        }
    }

}
