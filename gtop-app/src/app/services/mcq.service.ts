import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, orderBy, limit, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc, startAfter, serverTimestamp, getCountFromServer, collectionSnapshots, writeBatch, onSnapshot, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import { SyllabusService } from './syllabus.service';


export interface MCQ {
    id: string;
    board: string;
    standard: string;
    subject: string;
    chapter: string;
    title: string;
    question: string;
    options: string[];
    correctIndex: number;
    solutions: string[];
    selected: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class McqService {
    private mcqCollection = collection(this.firestore, 'questions');
    private deletedMcqCollection = collection(this.firestore, 'deletedQuestions');

    constructor(private firestore: Firestore, private auth: Auth, private syllabusService: SyllabusService) { }

    /**
     * ✅ Add multiple MCQs to Firestore with proper format.
     */
    async addMCQs(mcqs: any[]) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User not authenticated');

            const mcqCollectionRef = collection(this.firestore, 'questions');
            const batch = writeBatch(this.firestore);

            // 📌 Track affected syllabus combinations
            const touchedCombos = new Map<string, { board: string; standard: string; subject: string; chapter: string }>();

            for (const mcq of mcqs) {
                const mcqData = {
                    board: mcq.board || 'Unknown',
                    standard: mcq.standard || 'Unknown',
                    subject: mcq.subject || 'Unknown',
                    chapter: mcq.chapter || 'Unknown',
                    title: mcq.title || 'Untitled',
                    question: mcq.question || 'No question',
                    options: Array.isArray(mcq.options) && mcq.options.length >= 2 ? mcq.options : [],
                    correctIndex: typeof mcq.correctIndex === 'number' && mcq.correctIndex >= 0 && mcq.correctIndex < mcq.options.length ? mcq.correctIndex : -1,
                    solutions: Array.isArray(mcq.solutions) ? mcq.solutions : [],
                    createdAt: serverTimestamp(),
                    createdBy: user.uid
                };

                // ✅ Add MCQ to batch
                batch.set(doc(mcqCollectionRef), mcqData);

                // 📌 Add syllabus combo to touchedCombos
                const key = JSON.stringify({
                    board: mcqData.board,
                    standard: mcqData.standard,
                    subject: mcqData.subject,
                    chapter: mcqData.chapter
                });

                touchedCombos.set(key, {
                    board: mcqData.board,
                    standard: mcqData.standard,
                    subject: mcqData.subject,
                    chapter: mcqData.chapter
                });
            }

            // ✅ Commit all MCQs
            await batch.commit();

            // 🧠 Syllabus combo insertion + count update
            for (const { board, standard, subject, chapter } of touchedCombos.values()) {
                await this.syllabusService.insertComboIfNotExists(board, standard, subject, chapter);
                await this.syllabusService.updateMcqCountForCombo(board, standard, subject, chapter);
            }

            console.log("MCQs and syllabus updated successfully!");
        } catch (error) {
            console.error('Error adding MCQs and updating syllabus:', error);
            throw error;
        }
    }



    /**
     * ✅ Fetch MCQs with correct format and optional filters.
     */
    async fetchMCQs(filters: { board?: string; standard?: string; subject?: string; chapter?: string }, lastVisible?: any): Promise<{ mcqs: MCQ[], lastVisible: any }> {
        const noFiltersApplied = !filters.board && !filters.standard && !filters.subject && !filters.chapter;
        if (noFiltersApplied) {
            return { mcqs: [], lastVisible: null };
        }

        // 📌 Base query
        let mcqQuery = query(this.mcqCollection, orderBy('createdAt', 'desc'));

        // 🧩 Apply filters
        if (filters.board) mcqQuery = query(mcqQuery, where('board', '==', filters.board));
        if (filters.standard) mcqQuery = query(mcqQuery, where('standard', '==', filters.standard));
        if (filters.subject) mcqQuery = query(mcqQuery, where('subject', '==', filters.subject));
        if (filters.chapter) {
            mcqQuery = query(mcqQuery, where('chapter', '==', filters.chapter));

            // ✅ Use one-time onSnapshot with unsubscribe for live-safe, fast fetch
            return new Promise((resolve, reject) => {
                try {
                    const unsubscribe = onSnapshot(mcqQuery, (snapshot) => {
                        const mcqs: MCQ[] = snapshot.docs.map(doc => ({
                            id: doc.id,
                            board: doc.data()['board'] || 'Unknown',
                            standard: doc.data()['standard'] || 'Unknown',
                            subject: doc.data()['subject'] || 'Unknown',
                            chapter: doc.data()['chapter'] || 'Unknown',
                            title: doc.data()['title'] || 'Untitled',
                            question: doc.data()['question'] || 'No question',
                            options: Array.isArray(doc.data()['options']) ? doc.data()['options'] : [],
                            correctIndex: typeof doc.data()['correctIndex'] === 'number' ? doc.data()['correctIndex'] : -1,
                            solutions: Array.isArray(doc.data()['solutions']) ? doc.data()['solutions'] : [],
                            selected: false
                        }));

                        unsubscribe(); // ✅ Immediately stop listening
                        resolve({ mcqs, lastVisible: snapshot.docs[snapshot.docs.length - 1] || null });
                    });
                } catch (error) {
                    reject(error);
                }
            });

        } else {
            // 🧭 Chapter not selected → apply pagination limit
            mcqQuery = query(mcqQuery, limit(10));
            if (lastVisible) mcqQuery = query(mcqQuery, startAfter(lastVisible));

            const snapshot = await getDocs(mcqQuery);

            const mcqs: MCQ[] = snapshot.docs.map(doc => ({
                id: doc.id,
                board: doc.data()['board'] || 'Unknown',
                standard: doc.data()['standard'] || 'Unknown',
                subject: doc.data()['subject'] || 'Unknown',
                chapter: doc.data()['chapter'] || 'Unknown',
                title: doc.data()['title'] || 'Untitled',
                question: doc.data()['question'] || 'No question',
                options: Array.isArray(doc.data()['options']) ? doc.data()['options'] : [],
                correctIndex: typeof doc.data()['correctIndex'] === 'number' ? doc.data()['correctIndex'] : -1,
                solutions: Array.isArray(doc.data()['solutions']) ? doc.data()['solutions'] : [],
                selected: false
            }));

            return { mcqs, lastVisible: snapshot.docs[snapshot.docs.length - 1] || null };
        }
    }



    async fetchQuickQuizQuestions(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.syllabusService.syllabus$.subscribe(async (syllabusData: any[]) => {
                try {
                    // Filter chapters with at least 1 MCQ
                    const validChapters = syllabusData.filter(item => item.mcqCount > 0);
                    if (validChapters.length === 0) {
                        reject('No chapters with MCQs found.');
                        return;
                    }

                    // Pick random chapter
                    const randomIndex = Math.floor(Math.random() * validChapters.length);
                    const selected = validChapters[randomIndex];

                    // Firestore Query
                    const chapterQuery = query(
                        this.mcqCollection,
                        where('board', '==', selected.board),
                        where('standard', '==', selected.standard),
                        where('subject', '==', selected.subject),
                        where('chapter', '==', selected.chapter)
                    );

                    // OnSnapshot fetch + unsubscribe immediately
                    const unsubscribe = onSnapshot(chapterQuery, (snapshot) => {
                        let mcqs = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            selectedIndex: null
                        }));

                        unsubscribe(); // ✅ Unsubscribe immediately!

                        // Shuffle & return
                        mcqs = mcqs.sort(() => 0.5 - Math.random());
                        resolve(mcqs.slice(0, 10));
                    });

                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * ✅ Fetch Custom Quiz Questions based on selected subjects & chapters.
     */
    async fetchCustomQuizQuestions(filters: { board: string; standard: string; subjects: string[]; chapters: string[] }): Promise<MCQ[]> {
        try {
            // Defensive check
            if (!filters.board || !filters.standard || filters.subjects.length === 0 || filters.chapters.length === 0) {
                throw new Error('Invalid filters provided for custom quiz!');
            }

            // Firestore Query - Multiple OR conditions (subject IN, chapter IN)
            const mcqQuery = query(
                this.mcqCollection,
                where('board', '==', filters.board),
                where('standard', '==', filters.standard),
                where('subject', 'in', filters.subjects),
                where('chapter', 'in', filters.chapters)
            );

            const snapshot = await getDocs(mcqQuery);

            const mcqs: MCQ[] = snapshot.docs.map(doc => ({
                id: doc.id,
                board: doc.data()['board'] || 'Unknown',
                standard: doc.data()['standard'] || 'Unknown',
                subject: doc.data()['subject'] || 'Unknown',
                chapter: doc.data()['chapter'] || 'Unknown',
                title: doc.data()['title'] || 'Untitled',
                question: doc.data()['question'] || 'No question',
                options: Array.isArray(doc.data()['options']) ? doc.data()['options'] : [],
                correctIndex: typeof doc.data()['correctIndex'] === 'number' ? doc.data()['correctIndex'] : -1,
                solutions: Array.isArray(doc.data()['solutions']) ? doc.data()['solutions'] : [],
                selected: false
            }));

            // ✅ Shuffle client-side
            const shuffled = mcqs.sort(() => 0.5 - Math.random());

            return shuffled; // No slice limit → you can slice later if needed in quiz page

        } catch (error) {
            console.error('Error fetching custom quiz MCQs:', error);
            throw error;
        }
    }





    /**
     * ✅ Edit an existing MCQ.
     */
    async updateMCQ(mcqId: string, updatedData: any) {
        const mcqRef = doc(this.firestore, `questions/${mcqId}`);
        await updateDoc(mcqRef, updatedData);
    }

    /**
     * ✅ Soft delete an MCQ (move to `deletedQuestions` and remove from `questions`).
     */
    async deleteMCQ(mcqId: string) {
        const mcqRef = doc(this.firestore, `questions/${mcqId}`);
        const deletedRef = doc(this.firestore, `deletedQuestions/${mcqId}`);

        // 🔍 Get MCQ Data
        const mcqSnapshot = await getDoc(mcqRef);

        if (mcqSnapshot.exists()) {
            const mcqData = mcqSnapshot.data();

            const { board, standard, subject, chapter } = mcqData;

            // ✅ Move to DeletedQuestions
            await setDoc(deletedRef, { ...mcqData, deletedAt: serverTimestamp() });

            // ✅ Delete from Questions
            await deleteDoc(mcqRef);

            // ✅ Update Syllabus Count
            await this.syllabusService.updateMcqCountForCombo(board, standard, subject, chapter);

            // 🔁 Check if count is now zero → delete syllabus combo
            const currentCombo = this.syllabusService.syllabus$.value.find(item =>
                item.board === board &&
                item.standard === standard &&
                item.subject === subject &&
                item.chapter === chapter
            );

            if (currentCombo?.id && currentCombo.mcqCount === 0) {
                const syllabusDocRef = doc(this.firestore, `syllabus/${currentCombo.id}`);
                await deleteDoc(syllabusDocRef);
                console.log(`🗑 Syllabus combo removed: ${board} > ${standard} > ${subject} > ${chapter}`);
            }
        }
    }



    async getTotalMCQCount(): Promise<number> {
        const mcqCollectionRef = collection(this.firestore, 'questions');
        const snapshot = await getCountFromServer(mcqCollectionRef);
        return snapshot.data().count;
    }

    async updateSyllabusFromQuestions() {
        try {
            const syllabusRef = collection(this.firestore, 'syllabus');
            const questionsSnapshot = await getDocs(collection(this.firestore, 'questions'));

            const syllabusMap = new Map<string, { board: string; standard: string; subject: string; chapter: string; createdAt: any }>();

            questionsSnapshot.forEach(doc => {
                const { board, standard, subject, chapter } = doc.data();
                const key = `${board}-${standard}-${subject}-${chapter}`;

                if (!syllabusMap.has(key)) {
                    syllabusMap.set(key, { board, standard, subject, chapter, createdAt: serverTimestamp() });
                }
            });

            const existingSyllabusSnapshot = await getDocs(syllabusRef);
            const existingSyllabusKeys = new Set<string>();

            existingSyllabusSnapshot.forEach(doc => {
                const { board, standard, subject, chapter } = doc.data();
                const key = `${board}-${standard}-${subject}-${chapter}`;
                existingSyllabusKeys.add(key);
            });

            const batch = writeBatch(this.firestore);
            let batchCount = 0;

            for (const [key, data] of syllabusMap.entries()) {
                if (!existingSyllabusKeys.has(key)) {
                    const newDocRef = doc(syllabusRef);
                    batch.set(newDocRef, data);
                    batchCount++;

                    if (batchCount === 500) {
                        await batch.commit();
                        batchCount = 0;
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            console.log("Syllabus manually updated from questions!");
        } catch (error) {
            console.error('Error updating syllabus:', error);
        }
    }




}
