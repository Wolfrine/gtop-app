import { Injectable } from '@angular/core';
import { MCQ } from './mcq.service';
import { RetryContext, QuizResultQuestion } from './quiz.service';
import { SAMPLE_QUESTIONS } from '../data/sample-questions';

type SampleQuestion = MCQ & { selectedIndex: number | null };

interface SampleAttempt {
  id: string;
  completedAt: number;
  quizType: string;
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  questions: QuizResultQuestion[];
}

interface PersistedState {
  questions: SampleQuestion[];
  attempts: SampleAttempt[];
}

@Injectable()
export class SampleQuizService {
  private static readonly STORAGE_KEY = 'gtop-sample-quiz-state-v1';

  private quizQuestions: SampleQuestion[] = [];
  private pendingRetry: {
    questions: SampleQuestion[];
    context: RetryContext;
  } | null = null;
  private attempts: SampleAttempt[] = [];

  constructor() {
    this.restoreState();
  }

  setQuestions(questions: any[]) {
    this.quizQuestions = questions.map((question) =>
      this.cloneQuestion(question),
    );
    this.persistState();
  }

  getQuestions() {
    return this.quizQuestions.map((question) => this.cloneQuestion(question));
  }

  resetQuestions() {
    this.quizQuestions = [];
    this.persistState();
  }

  setPendingRetry(questions: any[], context: RetryContext) {
    const sanitized = questions.map((question) => ({
      ...this.cloneQuestion(question),
      selectedIndex: null,
    }));

    this.pendingRetry = {
      questions: sanitized,
      context,
    };
    this.persistState();
  }

  consumePendingRetry(): { questions: any[]; context: RetryContext } | null {
    if (!this.pendingRetry) {
      return null;
    }

    const payload = {
      questions: this.pendingRetry.questions.map((question) =>
        this.cloneQuestion(question),
      ),
      context: this.pendingRetry.context,
    };

    this.pendingRetry = null;
    this.persistState();
    return payload;
  }

  getPendingRetryContext(): RetryContext | null {
    return this.pendingRetry?.context || null;
  }

  async fetchQuestionsFromRandomChapter(): Promise<any[]> {
    const randomized = this.shuffle([...SAMPLE_QUESTIONS]);
    const selection = randomized
      .slice(0, 5)
      .map((question) => this.cloneQuestion(question));
    this.setQuestions(selection);
    return selection;
  }

  async fetchCustomQuizQuestions(
    board: string,
    standard: string,
    selectedSubjects: string[],
    selectedChapters: string[],
    questionCount: number,
  ): Promise<any[]> {
    const filtered = SAMPLE_QUESTIONS.filter((question) => {
      if (board && question.board !== board) {
        return false;
      }
      if (standard && question.standard !== standard) {
        return false;
      }
      if (
        selectedSubjects.length &&
        !selectedSubjects.includes(question.subject)
      ) {
        return false;
      }
      if (
        selectedChapters.length &&
        !selectedChapters.includes(question.chapter)
      ) {
        return false;
      }
      return true;
    });

    const pool = filtered.length ? filtered : [...SAMPLE_QUESTIONS];
    const randomized = this.shuffle([...pool]);
    const selection = randomized
      .slice(0, Math.max(1, Math.min(questionCount || 5, pool.length)))
      .map((question) => this.cloneQuestion(question));
    this.setQuestions(selection);
    return selection;
  }

  async saveQuizResult(
    _userId: string,
    payload: {
      userName: string;
      board: string;
      standard: string;
      subject: string;
      chapter: string;
      quizType: string;
      sessionId?: string;
      questions: {
        id: string;
        selectedIndex: number;
        correctIndex: number;
      }[];
    },
  ) {
    const attempt: SampleAttempt = {
      id: `sample-${Date.now()}`,
      completedAt: Date.now(),
      quizType: payload.quizType || 'sample',
      board: payload.board,
      standard: payload.standard,
      subject: payload.subject,
      chapter: payload.chapter,
      questions: payload.questions.map((question) => ({
        questionId: question.id,
        selectedIndex: question.selectedIndex,
        correctIndex: question.correctIndex,
        isCorrect: question.selectedIndex === question.correctIndex,
      })),
    };

    this.attempts = [attempt, ...this.attempts].slice(0, 10);
    this.persistState();
  }

  async fetchUserQuizResults(_userId: string) {
    return this.attempts.map((attempt) => ({
      ...attempt,
      questions: attempt.questions.map((question) => ({ ...question })),
    }));
  }

  async expandSummariesToQuestions(
    summaries: QuizResultQuestion[],
  ): Promise<any[]> {
    return summaries.map((summary) => {
      const id = summary.questionId;
      const base = this.findSampleQuestion(id);
      if (!base) {
        return {
          id,
          board: 'Sample',
          standard: 'Sample',
          subject: 'Sample',
          chapter: 'Sample',
          title: 'Sample Question',
          question: 'Question data unavailable.',
          options: [],
          correctIndex: summary.correctIndex,
          solutions: [],
          selected: false,
          selectedIndex: summary.selectedIndex ?? null,
        };
      }

      return {
        ...this.cloneQuestion(base),
        correctIndex:
          typeof summary.correctIndex === 'number'
            ? summary.correctIndex
            : base.correctIndex,
        selectedIndex: summary.selectedIndex ?? null,
      };
    });
  }

  async prepareRetryFromExistingAttempt(options: {
    questions: any[];
    incorrectOnly?: boolean;
    context: RetryContext;
  }) {
    const { questions, incorrectOnly = false, context } = options;
    const source = incorrectOnly
      ? questions.filter(
          (question) => question.selectedIndex !== question.correctIndex,
        )
      : questions;

    this.setPendingRetry(source, context);
  }

  async prepareRetryFromResults(options: {
    questionSummaries: QuizResultQuestion[];
    incorrectOnly?: boolean;
    context: RetryContext;
  }) {
    const { questionSummaries, incorrectOnly = false, context } = options;
    const filtered = incorrectOnly
      ? questionSummaries.filter((summary) => !summary.isCorrect)
      : questionSummaries;

    if (!filtered.length) {
      this.pendingRetry = null;
      this.persistState();
      return;
    }

    const expanded = await this.expandSummariesToQuestions(filtered);
    this.setPendingRetry(expanded, context);
  }

  async flagQuestion(_question: any, _userId: string): Promise<void> {
    // Sample quizzes do not support server-side flagging. Silently ignore.
    return Promise.resolve();
  }

  private findSampleQuestion(id: string): SampleQuestion | undefined {
    const found = SAMPLE_QUESTIONS.find((question) => question.id === id);
    return found ? this.cloneQuestion(found) : undefined;
  }

  private cloneQuestion(question: any): SampleQuestion {
    return {
      id: question.id,
      board: question.board,
      standard: question.standard,
      subject: question.subject,
      chapter: question.chapter,
      title: question.title,
      question: question.question,
      options: Array.isArray(question.options) ? [...question.options] : [],
      correctIndex:
        typeof question.correctIndex === 'number' ? question.correctIndex : 0,
      solutions: Array.isArray(question.solutions)
        ? [...question.solutions]
        : [],
      selected:
        typeof question.selected === 'boolean' ? question.selected : false,
      selectedIndex:
        typeof question.selectedIndex === 'number'
          ? question.selectedIndex
          : null,
    };
  }

  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  private restoreState() {
    if (!this.hasBrowserStorage()) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(SampleQuizService.STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedState;
      if (Array.isArray(parsed.questions)) {
        this.quizQuestions = parsed.questions.map((question) =>
          this.cloneQuestion(question),
        );
      }
      if (Array.isArray(parsed.attempts)) {
        this.attempts = parsed.attempts.map((attempt) => ({
          ...attempt,
          questions: attempt.questions.map((question) => ({ ...question })),
        }));
      }
    } catch (error) {
      console.warn('Unable to restore sample quiz state:', error);
      this.quizQuestions = [];
      this.attempts = [];
    }
  }

  private persistState() {
    if (!this.hasBrowserStorage()) {
      return;
    }

    try {
      const payload: PersistedState = {
        questions: this.quizQuestions.map((question) =>
          this.cloneQuestion(question),
        ),
        attempts: this.attempts.map((attempt) => ({
          ...attempt,
          questions: attempt.questions.map((question) => ({ ...question })),
        })),
      };
      window.localStorage.setItem(
        SampleQuizService.STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch (error) {
      console.warn('Unable to persist sample quiz state:', error);
    }
  }

  private hasBrowserStorage() {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const storage = window.localStorage;
      const probeKey = '__gtop_sample_probe__';
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  }
}
