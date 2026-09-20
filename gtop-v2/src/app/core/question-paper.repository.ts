import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { FirebaseClient } from './firebase';
import { Question, SyllabusItem } from './models';

export interface QuestionPaperTemplateSection {
  id?: string;
  title?: string;
  name?: string;
  questionType?: string;
  type?: string;
  questionTypes?: string[];
  difficulty?: string;
  competencyTags?: string[];
  requiredCount?: number;
  questionCount?: number;
  count?: number;
  marks?: number;
  marksPerQuestion?: number;
  perQuestionMarks?: number;
}

export interface QuestionPaperTemplate {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  board?: string;
  standard?: string;
  subjects?: string[];
  subject?: string;
  marks?: number;
  totalMarks?: number;
  durationMinutes?: number;
  sections?: QuestionPaperTemplateSection[];
  blueprint?: { sections?: QuestionPaperTemplateSection[] };
}

export interface NormalizedQuestion extends Question {
  questionType: string;
  difficulty: string;
  competencyTags: string[];
  marks: number;
  status?: string;
}

export interface GeneratedPaperQuestion {
  questionId: string;
  title: string;
  question: string;
  options: string[];
  correctIndex: number;
  solutions: string[];
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  questionType: string;
  difficulty: string;
  competencyTags: string[];
  marks: number;
}

export interface GeneratedPaperSection {
  id: string;
  title: string;
  questionType: string;
  difficulty: string;
  requiredCount: number;
  marksPerQuestion: number;
  competencyTags: string[];
  questions: GeneratedPaperQuestion[];
}

export interface CoverageGap {
  sectionId: string;
  sectionTitle: string;
  questionType: string;
  difficulty: string;
  competencyTags: string[];
  requiredCount: number;
  availableCount: number;
  gapCount: number;
}

export interface PaperGenerationSetup {
  board: string;
  standard: string;
  subjects: string[];
  chapters: string[];
  marks: number;
  durationMinutes: number;
  templateId: string;
  templateName: string;
}

export interface PaperDraftPayload {
  schemaVersion: number;
  status: 'draft';
  board: string;
  standard: string;
  primarySubject: string;
  subjects: string[];
  chapters: string[];
  marks: number;
  durationMinutes: number;
  templateId: string;
  templateName: string;
  sections: GeneratedPaperSection[];
  coverage: {
    availableQuestionCount: number;
    requiredQuestionCount: number;
    gapCount: number;
    gaps: CoverageGap[];
  };
  createdBy: string;
  updatedBy: string;
}

@Injectable({ providedIn: 'root' })
export class QuestionPaperRepository {
  constructor(private readonly firebase: FirebaseClient) {}

  async syllabus(): Promise<SyllabusItem[]> {
    const snapshot = await getDocs(query(collection(this.firebase.firestore, 'syllabus'), limit(1000)));
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as SyllabusItem)
      .sort((a, b) =>
        `${a.board}|${a.standard}|${a.subject}|${a.chapter}`.localeCompare(
          `${b.board}|${b.standard}|${b.subject}|${b.chapter}`,
        ),
      );
  }

  async templates(): Promise<QuestionPaperTemplate[]> {
    try {
      const snapshot = await getDocs(query(collection(this.firebase.firestore, 'paperTemplates'), limit(50)));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as QuestionPaperTemplate);
    } catch {
      return [];
    }
  }

  async approvedQuestions(
    board: string,
    standard: string,
    subjects: string[],
    chapters: string[],
  ): Promise<NormalizedQuestion[]> {
    const snapshot = await getDocs(
      query(
        collection(this.firebase.firestore, 'questions'),
        where('board', '==', board),
        where('standard', '==', standard),
        limit(1200),
      ),
    );
    const subjectSet = new Set(subjects);
    const chapterSet = new Set(chapters);
    return snapshot.docs
      .map((item) => this.normalizeQuestion({ id: item.id, ...item.data() } as Question))
      .filter((item) => subjectSet.size === 0 || subjectSet.has(item.subject))
      .filter((item) => chapterSet.size === 0 || chapterSet.has(item.chapter))
      .filter((item) => !item.status || ['active', 'approved', 'published'].includes(item.status));
  }

  async saveDraft(payload: PaperDraftPayload): Promise<string> {
    const created = await addDoc(collection(this.firebase.firestore, 'paperDrafts'), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return created.id;
  }

  async createPriorityItems(
    setup: PaperGenerationSetup,
    gaps: CoverageGap[],
    actorId: string,
  ): Promise<number> {
    let created = 0;
    for (const gap of gaps.slice(0, 50)) {
      await addDoc(collection(this.firebase.firestore, 'questionBankPriorityItems'), {
        board: setup.board,
        standard: setup.standard,
        subjects: setup.subjects,
        primarySubject: setup.subjects[0] ?? '',
        chapters: setup.chapters,
        questionType: gap.questionType,
        competencyTags: gap.competencyTags,
        difficulty: gap.difficulty,
        requiredCount: gap.requiredCount,
        availableCount: gap.availableCount,
        gapCount: gap.gapCount,
        priority: gap.gapCount >= 10 ? 'critical' : gap.gapCount >= 5 ? 'high' : 'medium',
        status: 'open',
        source: 'admin-question-paper-generator',
        sourceTemplateId: setup.templateId,
        sourceTemplateName: setup.templateName,
        assignedAgent: null,
        createdBy: actorId,
        updatedBy: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created++;
    }
    return created;
  }

  private normalizeQuestion(raw: Question): NormalizedQuestion {
    const record = raw as unknown as Record<string, unknown>;
    const questionText = String(raw.question ?? '');
    const title = String(raw.title ?? '');
    const inferredType = this.inferQuestionType(questionText || title);
    const competencyTags = this.arrayOfStrings(record['competencyTags'] ?? record['tags']);
    const status = this.optionalString(record['status']);
    return {
      ...raw,
      questionType: this.normalizeType(
        this.optionalString(record['questionType']) ||
          this.optionalString(record['type']) ||
          this.optionalString(record['question_type']) ||
          inferredType,
      ),
      difficulty:
        this.optionalString(record['difficulty']) ||
        this.optionalString(record['level']) ||
        'standard',
      competencyTags,
      marks: this.numberValue(record['marks'], 1),
      status,
    };
  }

  private inferQuestionType(text: string): string {
    const value = text.toLowerCase();
    if (value.includes('assertion') && value.includes('reason')) return 'assertion_reason';
    if (value.includes('case') || value.includes('passage')) return 'case_based';
    if (value.includes('diagram') || value.includes('figure')) return 'diagram_based';
    if (value.includes('experiment') || value.includes('observation')) return 'experiment_based';
    return 'mcq';
  }

  private normalizeType(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') || 'mcq';
  }

  private optionalString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private arrayOfStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  private numberValue(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }
}
