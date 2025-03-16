import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, orderBy, limit, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc, startAfter, serverTimestamp, getCountFromServer, collectionSnapshots, writeBatch } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';


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

    constructor(private firestore: Firestore, private auth: Auth) { }

    /**
     * ✅ Add multiple MCQs to Firestore with proper format.
     */
    async addMCQs(mcqs: any[]) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User not authenticated');

            const mcqCollectionRef = collection(this.firestore, 'questions');
            const syllabusCollectionRef = collection(this.firestore, 'syllabus');
            const batch = writeBatch(this.firestore);

            for (const mcq of mcqs) {
                // ✅ Ensure correct format before adding to Firestore
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

                // ✅ Add MCQ to Firestore
                batch.set(doc(mcqCollectionRef), mcqData);


            }

            // ✅ Commit batch write for efficiency
            await batch.commit();
            console.log("MCQs and syllabus updated successfully!");
        } catch (error) {
            console.error('Error adding MCQs and updating syllabus:', error);
            throw error;
        }
    }


    /**
     * ✅ Fetch MCQs with correct format and optional filters.
     */
    async fetchMCQs(filters: { board?: string; standard?: string; subject?: string; chapter?: string }, lastVisible?: any) {
        // 🚀 Check: If all filters are empty, skip fetching
        const noFiltersApplied = !filters.board && !filters.standard && !filters.subject && !filters.chapter;
        if (noFiltersApplied) {
            return { mcqs: [], lastVisible: null };
        }

        let mcqQuery = query(this.mcqCollection, orderBy('createdAt', 'desc'), limit(10));

        if (filters.board) mcqQuery = query(mcqQuery, where('board', '==', filters.board));
        if (filters.standard) mcqQuery = query(mcqQuery, where('standard', '==', filters.standard));
        if (filters.subject) mcqQuery = query(mcqQuery, where('subject', '==', filters.subject));
        if (filters.chapter) mcqQuery = query(mcqQuery, where('chapter', '==', filters.chapter));
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

        // Get current MCQ data
        const mcqSnapshot = await getDocs(query(this.mcqCollection, where('__name__', '==', mcqId)));
        if (!mcqSnapshot.empty) {
            const mcqData = mcqSnapshot.docs[0].data();

            // ✅ Move to DeletedQuestions
            await setDoc(deletedRef, { ...mcqData, deletedAt: serverTimestamp() });

            // ✅ Delete from Questions
            await deleteDoc(mcqRef);
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

            const syllabusMap = new Map();

            questionsSnapshot.forEach(doc => {
                const { board, standard, subject, chapter } = doc.data();
                const key = `${board}-${standard}-${subject}-${chapter}`;

                if (!syllabusMap.has(key)) {
                    syllabusMap.set(key, { board, standard, subject, chapter, createdAt: serverTimestamp() });
                }
            });

            const batch = writeBatch(this.firestore);
            syllabusMap.forEach((data) => {
                const newDocRef = doc(syllabusRef);
                batch.set(newDocRef, data);
            });

            await batch.commit();
            console.log("Syllabus manually updated from questions!");
        } catch (error) {
            console.error('Error updating syllabus:', error);
        }
    }



}
