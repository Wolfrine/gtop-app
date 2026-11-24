import { Injectable } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { DocumentSnapshot, Firestore, QueryConstraint, collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter, updateDoc, where, writeBatch } from '@angular/fire/firestore';
import { Observable, distinctUntilChanged, from, fromEvent, map, merge, of, share, switchMap, tap } from 'rxjs';
import { FirestoreReadService } from './firestore-read.service';
import { normalizePracticeBoard } from './practice-context';

export interface SyllabusItem {
    id?: string;
    board: string;
    standard: string;
    subject: string;
    chapter: string;
    mcqCount: number;
}

export interface SyllabusSnapshot {
    items: SyllabusItem[];
    fromCache: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class SyllabusService {
    private readonly syllabusCollection = collection(this.firestore, 'syllabus');
    private readonly optionReads = new Map<string, { expiresAt: number; result: Promise<string[]> }>();
    private readonly optionsReconnect = fromEvent(window, 'online').pipe(
        tap(() => this.optionReads.clear()),
        share()
    );
    private optionUser = '';

    constructor(private firestore: Firestore, private readonly reads: FirestoreReadService, private readonly auth: Auth) {}

    watchScope(board: string, standard: string, options?: { includeBoardAliases?: boolean }): Observable<SyllabusSnapshot> {
        if (!board || !standard) return of({ items: [], fromCache: false });
        const boardFilter = options?.includeBoardAliases && normalizePracticeBoard(board) === 'IGCSE'
            ? where('board', 'in', ['Cambridge IGCSE', 'IGCSE'])
            : where('board', '==', board);
        return this.watch('syllabus.curriculum', boardFilter, this.standardFilter(standard));
    }

    /** Only views that intentionally use the whole catalogue should call this. */
    watchCatalogue(): Observable<SyllabusSnapshot> {
        return this.watch('syllabus.catalogue');
    }

    async readCatalogue(): Promise<SyllabusItem[]> {
        const snapshot = await getDocs(this.syllabusCollection);
        console.debug('[firestore-read]', { scope: 'syllabus.catalogue',
            source: snapshot.metadata.fromCache ? 'cache' : 'server', resultCount: snapshot.size });
        return snapshot.docs.map(row => this.toItem(row));
    }

    async item(id: string, scope?: Pick<SyllabusItem, 'board' | 'standard' | 'subject' | 'chapter'>): Promise<SyllabusItem | null> {
        if (id && !id.includes('/')) {
            try {
                const row = await getDoc(doc(this.syllabusCollection, id));
                if (row.exists()) return this.toItem(row);
            } catch (error) {
                if (!scope || (error as { code?: string })?.code !== 'unavailable') throw error;
            }
        }
        if (!scope?.board || !scope.standard || !scope.subject || !scope.chapter) return null;
        const matches = await getDocs(query(this.syllabusCollection, ...this.comboFilters(scope.board, String(scope.standard), scope.subject, scope.chapter), limit(1)));
        return matches.empty ? null : this.toItem(matches.docs[0]);
    }

    boards(): Observable<string[]> {
        return this.options('board');
    }

    standards(board?: string): Observable<string[]> {
        return this.options('standard', board);
    }

    private watch(scope: string, ...constraints: QueryConstraint[]): Observable<SyllabusSnapshot> {
        return this.reads.watch(query(this.syllabusCollection, ...constraints), scope).pipe(map(snapshot => ({
            items: snapshot.docs.map(row => this.toItem(row)),
            fromCache: snapshot.metadata.fromCache
        })));
    }

    private toItem(row: DocumentSnapshot): SyllabusItem {
        const data = row.data()!;
        return { id: row.id, board: data['board'], standard: String(data['standard']), subject: data['subject'],
            chapter: data['chapter'], mcqCount: data['mcqCount'] || 0 };
    }

    private comboFilters(board: string, standard: string, subject: string, chapter: string): QueryConstraint[] {
        return [where('board', '==', board), this.standardFilter(standard), where('subject', '==', subject), where('chapter', '==', chapter)];
    }

    private standardFilter(standard: string): QueryConstraint {
        const numeric = Number(standard);
        return Number.isFinite(numeric) && String(numeric) === standard
            ? where('standard', 'in', [standard, numeric])
            : where('standard', '==', standard);
    }

    private options(field: 'board' | 'standard', board?: string): Observable<string[]> {
        return authState(this.auth).pipe(switchMap(user => {
            const uid = user?.uid ?? '';
            if (this.optionUser !== uid) {
                this.optionReads.clear();
                this.optionUser = uid;
            }
            return uid ? merge(of(null), this.optionsReconnect).pipe(
                switchMap(() => from(this.readOptions(uid, field, board))),
                distinctUntilChanged((left, right) => left.length === right.length &&
                    left.every((value, index) => value === right[index]))
            ) : of([]);
        }));
    }

    private readOptions(uid: string, field: 'board' | 'standard', board?: string): Promise<string[]> {
        const key = JSON.stringify([field, board]);
        const now = Date.now();
        const cached = this.optionReads.get(key);
        if (cached && cached.expiresAt > now) return cached.result;

        const entry = { expiresAt: Infinity, result: board
            ? this.readOptions(uid, 'standard').then(values => this.standardsForBoard(uid, board, values))
            : this.distinctValues(uid, field) };
        this.optionReads.set(key, entry);
        void entry.result.then(
            values => { entry.expiresAt = Date.now() + (values.length ? 60_000 : 5_000); },
            () => { if (this.optionReads.get(key) === entry) this.optionReads.delete(key); }
        );
        for (const [cachedKey, value] of this.optionReads) {
            if (value.expiresAt <= now) this.optionReads.delete(cachedKey);
        }
        return entry.result;
    }

    private async distinctValues(uid: string, field: 'board' | 'standard'): Promise<string[]> {
        const values = new Set<string>();
        let cursor: unknown;
        let resultCount = 0;
        let queryCount = 0;
        let fromCache = false;
        while (this.auth.currentUser?.uid === uid) {
            // A field-value cursor skips every row with the previous value.
            const result = await getDocs(query(this.syllabusCollection, orderBy(field), limit(1),
                ...(cursor === undefined ? [] : [startAfter(cursor)])));
            queryCount++;
            resultCount += result.size;
            fromCache ||= result.metadata.fromCache;
            if (result.empty) break;
            cursor = result.docs[0].get(field);
            if (typeof cursor === 'string' && cursor) values.add(cursor);
            if (field === 'standard' && typeof cursor === 'number') values.add(String(cursor));
        }
        console.debug('[firestore-read]', { scope: 'syllabus.options.' + field,
            source: fromCache ? 'cache-or-mixed' : 'server', resultCount, queryCount });
        return [...values];
    }

    private async standardsForBoard(uid: string, board: string, values: string[]): Promise<string[]> {
        if (this.auth.currentUser?.uid !== uid) return [];
        const results = await Promise.all(values.map(standard => getDocs(query(this.syllabusCollection,
            where('board', '==', board), this.standardFilter(standard), limit(1)))));
        console.debug('[firestore-read]', { scope: 'syllabus.options.board-standards',
            source: results.some(result => result.metadata.fromCache) ? 'cache-or-mixed' : 'server',
            resultCount: results.reduce((total, result) => total + result.size, 0), queryCount: results.length });
        return values.filter((_, index) => !results[index].empty);
    }

    async updateSyllabusCountsFromIndexedDB() {
        const syllabusCollection = collection(this.firestore, 'syllabus');
        const syllabusSnapshot = await getDocs(syllabusCollection);
        let batch = writeBatch(this.firestore);
        let changed = 0;

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

            if (syllabusData['mcqCount'] === count) continue;
            batch.update(syllabusDoc, { mcqCount: count });
            if (++changed === 400) {
                await batch.commit();
                batch = writeBatch(this.firestore);
                changed = 0;
            }
        }

        if (changed) await batch.commit();
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
        if (!Object.keys(changedFields).length) return;
        await updateDoc(syllabusDocRef, changedFields);
        if (changedFields.board || changedFields.standard) this.optionReads.clear();

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
        const matches = await getDocs(query(this.syllabusCollection, ...this.comboFilters(board, standard, subject, chapter), limit(1)));
        if (!matches.empty) return;
        const id = 'scope-' + [board,standard,subject,chapter].map(encodeURIComponent).join('~');
        const ref = doc(this.syllabusCollection,id);
        await runTransaction(this.firestore, async transaction => {
            const current = await transaction.get(ref);
            if (!current.exists()) transaction.set(ref,{board,standard,subject,chapter,mcqCount:0,createdAt:serverTimestamp()});
        });
        this.optionReads.clear();
    }

    async updateMcqCountForCombo(board: string, standard: string, subject: string, chapter: string) {
        const syllabusQuery = query(
            collection(this.firestore, 'questions'),
            where('board', '==', board),
            where('standard', '==', standard),
            where('subject', '==', subject),
            where('chapter', '==', chapter)
        );

        const matchesQuery = query(this.syllabusCollection, ...this.comboFilters(board, String(standard), subject, chapter), limit(1));
        const [countSnap, matches] = await Promise.all([getCountFromServer(syllabusQuery), getDocs(matchesQuery)]);
        const count = countSnap.data().count;
        const match = matches.docs[0];
        if (!match) return null;
        if (match.data()['mcqCount'] !== count) await updateDoc(match.ref, { mcqCount: count });
        return { id: match.id, count };
    }

}
