import { Injectable } from '@angular/core';
import { addDoc, collection, documentId, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { FirebaseClient } from './firebase';
import { GenericFirestoreRepository } from './firestore.repository';
import { Question, QuizAnswer, QuizResult, SyllabusItem, asDate } from './models';

export interface PracticeFilters {
  board?: string;
  standard?: string;
  subject?: string;
  chapter?: string;
  count?: number;
  quizType?: 'quick' | 'custom';
}

@Injectable({ providedIn: 'root' })
export class LearningRepository {
  constructor(
    private readonly firebase: FirebaseClient,
    private readonly data: GenericFirestoreRepository,
  ) {}

  async syllabus(): Promise<SyllabusItem[]> {
    const items = await this.data.query<SyllabusItem>('syllabus', [], 500);
    return items.sort((a, b) => `${a.board}${a.standard}${a.subject}${a.chapter}`.localeCompare(`${b.board}${b.standard}${b.subject}${b.chapter}`));
  }

  async questions(filters: PracticeFilters): Promise<Question[]> {
    const constraints = [];
    if (filters.board) constraints.push(where('board', '==', filters.board));
    if (filters.standard) constraints.push(where('standard', '==', filters.standard));
    if (filters.subject) constraints.push(where('subject', '==', filters.subject));
    if (filters.chapter) constraints.push(where('chapter', '==', filters.chapter));
    constraints.push(limit(Math.min(Math.max((filters.count ?? 10) * 3, 20), 200)));
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'questions'), ...constraints));
    const items = snapshot.docs.map((entry) => this.normalizeQuestion(entry.id, entry.data()));
    return this.shuffle(items).slice(0, filters.count ?? 10);
  }

  async quickQuestions(profile: { board?: string | null; standard?: string | null }, count = 10): Promise<Question[]> {
    const syllabus = (await this.syllabus()).filter((item) => item.mcqCount > 0
      && (!profile.board || item.board === profile.board)
      && (!profile.standard || item.standard === profile.standard));
    if (!syllabus.length) throw new Error('No available chapters match your learning profile.');
    const selection = syllabus[Math.floor(Math.random() * syllabus.length)];
    return this.questions({ ...selection, count, quizType: 'quick' });
  }

  async questionsByIds(ids: string[]): Promise<Question[]> {
    const unique = [...new Set(ids)].filter(Boolean);
    const found: Question[] = [];
    for (let offset = 0; offset < unique.length; offset += 30) {
      const chunk = unique.slice(offset, offset + 30);
      const snapshot = await getDocs(query(collection(this.firebase.firestore, 'questions'), where(documentId(), 'in', chunk)));
      found.push(...snapshot.docs.map((entry) => this.normalizeQuestion(entry.id, entry.data())));
    }
    const byId = new Map(found.map((question) => [question.id, question]));
    return unique.map((id) => byId.get(id)).filter((question): question is Question => Boolean(question));
  }

  async saveResult(input: {
    userId: string;
    userName: string;
    board: string;
    standard: string;
    subject: string;
    chapter: string;
    quizType: QuizResult['quizType'];
    answers: QuizAnswer[];
    sessionId?: string;
    duration?: string;
  }): Promise<string> {
    const correctAnswers = input.answers.filter((answer) => answer.isCorrect).length;
    const totalQuestions = input.answers.length;
    const result: Omit<QuizResult, 'id'> = {
      userId: input.userId,
      userName: input.userName,
      board: input.board,
      standard: input.standard,
      subject: input.subject,
      chapter: input.chapter,
      quizType: input.quizType,
      totalQuestions,
      correctAnswers,
      wrongAnswers: totalQuestions - correctAnswers,
      percentage: totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
      questions: input.answers,
      timestamp: serverTimestamp(),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.duration ? { duration: input.duration } : {}),
    };
    const created = await addDoc(collection(this.firebase.firestore, 'QuizResults'), result);
    return created.id;
  }

  async results(userId: string): Promise<QuizResult[]> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'QuizResults'), where('userId', '==', userId), limit(100)));
    return snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }) as QuizResult)
      .sort((a, b) => (asDate(b.timestamp)?.getTime() ?? 0) - (asDate(a.timestamp)?.getTime() ?? 0));
  }

  async flagQuestion(questionId: string, userId: string, reason: string): Promise<void> {
    await addDoc(collection(this.firebase.firestore, 'questionFlags'), { questionId, userId, reason, status: 'open', createdAt: serverTimestamp() });
  }

  private normalizeQuestion(id: string, raw: Record<string, unknown>): Question {
    return {
      id,
      board: String(raw['board'] ?? 'Unknown'),
      standard: String(raw['standard'] ?? 'Unknown'),
      subject: String(raw['subject'] ?? 'General'),
      chapter: String(raw['chapter'] ?? 'General'),
      title: String(raw['title'] ?? ''),
      question: String(raw['question'] ?? 'Question unavailable'),
      options: Array.isArray(raw['options']) ? raw['options'].map(String) : [],
      correctIndex: Number(raw['correctIndex'] ?? -1),
      solutions: Array.isArray(raw['solutions']) ? raw['solutions'].map(String) : [],
      selectedIndex: null,
      createdAt: raw['createdAt'],
      createdBy: raw['createdBy'] ? String(raw['createdBy']) : undefined,
    };
  }

  private shuffle<T>(values: T[]): T[] {
    return values.map((value) => ({ value, order: Math.random() })).sort((a, b) => a.order - b.order).map(({ value }) => value);
  }
}
