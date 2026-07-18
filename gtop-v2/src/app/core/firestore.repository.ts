import { Injectable } from '@angular/core';
import {
  QueryConstraint,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseClient } from './firebase';

export interface FirestoreRepository<T extends { id: string }> {
  get(path: string): Promise<T | null>;
  query(path: string, constraints?: QueryConstraint[], max?: number): Promise<T[]>;
  observe(path: string, callback: (items: T[]) => void, constraints?: QueryConstraint[], max?: number): () => void;
  create(path: string, value: Omit<T, 'id'>): Promise<string>;
  set(path: string, value: Partial<T>, merge?: boolean): Promise<void>;
  update(path: string, value: Partial<T>): Promise<void>;
  delete(path: string): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class GenericFirestoreRepository implements FirestoreRepository<Record<string, unknown> & { id: string }> {
  constructor(private readonly firebase: FirebaseClient) {}

  async get<T extends { id: string }>(path: string): Promise<T | null> {
    const snapshot = await getDoc(doc(this.firebase.firestore, path));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
  }

  async query<T extends { id: string }>(path: string, constraints: QueryConstraint[] = [], max = 100): Promise<T[]> {
    const q = query(collection(this.firebase.firestore, path), ...constraints, limit(Math.min(Math.max(max, 1), 500)));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
  }

  observe<T extends { id: string }>(path: string, callback: (items: T[]) => void, constraints: QueryConstraint[] = [], max = 100): () => void {
    const q = query(collection(this.firebase.firestore, path), ...constraints, limit(Math.min(Math.max(max, 1), 500)));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)));
  }

  async create<T extends { id: string }>(path: string, value: Omit<T, 'id'>): Promise<string> {
    const created = await addDoc(collection(this.firebase.firestore, path), { ...value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return created.id;
  }

  async set<T extends { id: string }>(path: string, value: Partial<T>, merge = true): Promise<void> {
    await setDoc(doc(this.firebase.firestore, path), { ...value, updatedAt: serverTimestamp() }, { merge });
  }

  async update<T extends { id: string }>(path: string, value: Partial<T>): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, path), { ...value, updatedAt: serverTimestamp() });
  }

  async delete(path: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, path));
  }
}
