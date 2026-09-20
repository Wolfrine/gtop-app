import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { SyllabusItem } from '../core/models';
import {
  CoverageGap,
  GeneratedPaperSection,
  NormalizedQuestion,
  PaperGenerationSetup,
  QuestionPaperRepository,
  QuestionPaperTemplate,
  QuestionPaperTemplateSection,
} from '../core/question-paper.repository';

interface GenerationRule {
  id: string;
  title: string;
  questionType: string;
  difficulty: string;
  competencyTags: string[];
  requiredCount: number;
  marksPerQuestion: number;
}

@Component({
  selector: 'app-question-paper-generator-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page qpg-page">
      <div class="page-head">
        <div>
          <p class="eyebrow">Question paper generator</p>
          <h1>Generate papers from syllabus coverage.</h1>
          <p class="lede">
            Build paper drafts, identify question-bank gaps, and create creator-agent priority items.
          </p>
        </div>
        <div class="button-row">
          <a class="btn btn-secondary" routerLink="/admin/questions">Question bank</a>
          <a class="btn btn-secondary" routerLink="/admin/syllabus">Syllabus</a>
          <button class="btn btn-primary" type="button" (click)="loadInitialData(true)">
            Refresh
          </button>
        </div>
      </div>

      @if (errorMessage) {
        <div class="card qpg-error">{{ errorMessage }}</div>
      }

      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 1</p>
            <h2>Paper setup</h2>
          </div>
          <span class="pill info">{{ syllabus.length }} syllabus rows</span>
        </div>

        <div class="card qpg-card">
          <div class="qpg-form-grid">
            <label>
              Board
              <select [(ngModel)]="board" (ngModelChange)="onBoardChange()">
                <option value="">Select board</option>
                @for (item of boardOptions; track item) {
                  <option [value]="item">{{ item }}</option>
                }
              </select>
            </label>

            <label>
              Standard
              <select [(ngModel)]="standard" (ngModelChange)="onStandardChange()">
                <option value="">Select standard</option>
                @for (item of standardOptions; track item) {
                  <option [value]="item">{{ item }}</option>
                }
              </select>
            </label>

            <label>
              Template
              <select [(ngModel)]="templateId">
                <option value="auto">Auto objective blueprint</option>
                @for (template of matchingTemplates; track template.id) {
                  <option [value]="template.id">{{ templateTitle(template) }}</option>
                }
              </select>
            </label>

            <label>
              Marks
              <input type="number" min="1" max="200" [(ngModel)]="marks" />
            </label>

            <label>
              Duration minutes
              <input type="number" min="10" max="240" [(ngModel)]="durationMinutes" />
            </label>
          </div>

          <div class="qpg-selector">
            <div class="qpg-selector-head">
              <div>
                <strong>Subjects</strong>
                <span class="muted small">Saved as subjects[] even for single-subject papers.</span>
              </div>
              <button class="btn btn-secondary qpg-mini" type="button" (click)="clearSubjects()">
                Clear
              </button>
            </div>
            <div class="qpg-chip-list">
              @for (subject of subjectOptions; track subject) {
                <label class="qpg-chip" [class.active]="isSubjectSelected(subject)">
                  <input type="checkbox" [checked]="isSubjectSelected(subject)" (change)="toggleSubject(subject)" />
                  {{ subject }}
                </label>
              }
            </div>
          </div>

          <div class="qpg-selector">
            <div class="qpg-selector-head">
              <div>
                <strong>Chapters</strong>
                <span class="muted small">Required for accurate gap detection.</span>
              </div>
              <div class="button-row">
                <button class="btn btn-secondary qpg-mini" type="button" (click)="selectAllChapters()">
                  Select all
                </button>
                <button class="btn btn-secondary qpg-mini" type="button" (click)="clearChapters()">
                  Clear
                </button>
              </div>
            </div>
            <div class="qpg-chip-list qpg-chapters">
              @for (chapter of chapterOptions; track chapter) {
                <label class="qpg-chip" [class.active]="isChapterSelected(chapter)">
                  <input type="checkbox" [checked]="isChapterSelected(chapter)" (change)="toggleChapter(chapter)" />
                  {{ chapter }}
                </label>
              }
            </div>
          </div>

          <div class="button-row">
            <button class="btn btn-primary" type="button" [disabled]="loading" (click)="runCoverage()">
              Run coverage check
            </button>
            <button class="btn btn-secondary" type="button" [disabled]="loading || questions.length === 0" (click)="generateDraft()">
              Generate draft
            </button>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 2</p>
            <h2>Coverage readiness</h2>
          </div>
          @if (coverageChecked) {
            <span class="pill" [class.success]="gaps.length === 0" [class.warning]="gaps.length > 0">
              {{ gaps.length === 0 ? 'Ready' : gaps.length + ' gap groups' }}
            </span>
          }
        </div>

        <div class="grid grid-4">
          <article class="card stat">
            <span class="muted small">Available</span>
            <p class="stat-value">{{ questions.length }}</p>
            <span class="pill info">approved bank</span>
          </article>
          <article class="card stat">
            <span class="muted small">Required</span>
            <p class="stat-value">{{ requiredQuestionCount }}</p>
            <span class="pill info">{{ activeRuleCount }} rules</span>
          </article>
          <article class="card stat">
            <span class="muted small">Gaps</span>
            <p class="stat-value">{{ totalGapCount }}</p>
            <span class="pill" [class.success]="totalGapCount === 0" [class.warning]="totalGapCount > 0">
              {{ totalGapCount === 0 ? 'covered' : 'creator work' }}
            </span>
          </article>
          <article class="card stat">
            <span class="muted small">Draft sections</span>
            <p class="stat-value">{{ generatedSections.length }}</p>
            <span class="pill info">saved separately</span>
          </article>
        </div>

        @if (gaps.length > 0) {
          <div class="card qpg-card">
            <div class="section-head qpg-compact">
              <div>
                <p class="eyebrow">Priority queue</p>
                <h3>Creator-agent gaps</h3>
              </div>
              <button class="btn btn-primary" type="button" [disabled]="loading || priorityItemsCreated" (click)="createPriorityItems()">
                {{ priorityItemsCreated ? 'Priority items created' : 'Create priority items' }}
              </button>
            </div>
            <div class="qpg-gap-list">
              @for (gap of gaps; track gap.sectionId + gap.questionType + gap.difficulty) {
                <article class="qpg-gap-row">
                  <div>
                    <strong>{{ gap.sectionTitle }}</strong>
                    <p class="muted">
                      {{ gap.questionType }} · {{ gap.difficulty }} · required {{ gap.requiredCount }}, available {{ gap.availableCount }}
                    </p>
                  </div>
                  <span class="pill warning">gap {{ gap.gapCount }}</span>
                </article>
              }
            </div>
          </div>
        }
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 3</p>
            <h2>Generated draft</h2>
          </div>
          <button class="btn btn-primary" type="button" [disabled]="loading || generatedSections.length === 0 || savedDraftId !== ''" (click)="saveDraft()">
            {{ savedDraftId ? 'Draft saved' : 'Save draft' }}
          </button>
        </div>

        @if (savedDraftId) {
          <div class="card qpg-success">Saved draft <strong>{{ savedDraftId }}</strong> in <code>paperDrafts</code>.</div>
        }

        @if (generatedSections.length === 0) {
          <div class="card muted-card">
            Run coverage and generate a draft. PDF/DOCX export is intentionally left for the export engine phase.
          </div>
        }

        <div class="qpg-draft-stack">
          @for (section of generatedSections; track section.id) {
            <article class="card qpg-card">
              <div class="section-head qpg-compact">
                <div>
                  <p class="eyebrow">{{ section.questionType }} · {{ section.difficulty }}</p>
                  <h3>{{ section.title }}</h3>
                </div>
                <span class="pill info">{{ section.questions.length }}/{{ section.requiredCount }}</span>
              </div>
              <ol class="qpg-question-list">
                @for (question of section.questions; track question.questionId) {
                  <li>
                    <strong>{{ question.title || question.chapter }}</strong>
                    <p>{{ question.question }}</p>
                    <p class="muted small">{{ question.subject }} · {{ question.chapter }} · {{ question.marks }} mark(s)</p>
                  </li>
                }
              </ol>
            </article>
          }
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .qpg-card { display: flex; flex-direction: column; gap: 18px; }
      .qpg-form-grid { display: grid; grid-template-columns: repeat(5, minmax(130px, 1fr)); gap: 14px; }
      label { display: flex; flex-direction: column; gap: 8px; color: #60708a; font-size: 0.82rem; font-weight: 700; }
      select, input { border: 1px solid rgba(105, 125, 160, 0.25); border-radius: 14px; padding: 12px 14px; background: rgba(255, 255, 255, 0.9); color: #14213d; font: inherit; }
      .qpg-selector { border: 1px solid rgba(105, 125, 160, 0.14); border-radius: 22px; padding: 18px; background: rgba(248, 251, 255, 0.75); }
      .qpg-selector-head, .qpg-gap-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .qpg-selector-head { margin-bottom: 14px; }
      .qpg-chip-list { display: flex; flex-wrap: wrap; gap: 10px; }
      .qpg-chapters { max-height: 210px; overflow: auto; padding-right: 4px; }
      .qpg-chip { flex-direction: row; align-items: center; border: 1px solid rgba(105, 125, 160, 0.22); border-radius: 999px; padding: 8px 12px; background: #fff; color: #40516b; cursor: pointer; }
      .qpg-chip.active { border-color: rgba(48, 92, 220, 0.45); background: rgba(48, 92, 220, 0.1); color: #173b9c; }
      .qpg-chip input { width: auto; }
      .qpg-mini { min-height: 34px; padding: 7px 10px; font-size: 0.78rem; }
      .qpg-error { border-color: rgba(220, 38, 38, 0.25); color: #991b1b; background: rgba(254, 242, 242, 0.9); }
      .qpg-success { border-color: rgba(22, 163, 74, 0.22); color: #166534; background: rgba(240, 253, 244, 0.9); }
      .qpg-compact { margin: 0; }
      .qpg-gap-list, .qpg-draft-stack { display: flex; flex-direction: column; gap: 12px; }
      .qpg-gap-row { border: 1px solid rgba(105, 125, 160, 0.14); border-radius: 18px; padding: 14px; background: rgba(255, 255, 255, 0.75); }
      .qpg-question-list { margin: 0; padding-left: 22px; }
      .qpg-question-list li { margin: 14px 0; padding-left: 8px; }
      .qpg-question-list p { margin: 6px 0; }
      @media (max-width: 960px) { .qpg-form-grid { grid-template-columns: 1fr 1fr; } .qpg-selector-head, .qpg-gap-row { align-items: flex-start; flex-direction: column; } }
      @media (max-width: 640px) { .qpg-form-grid { grid-template-columns: 1fr; } }
    `,
  ],
})
export class QuestionPaperGeneratorPage implements OnInit {
  syllabus: SyllabusItem[] = [];
  templates: QuestionPaperTemplate[] = [];
  questions: NormalizedQuestion[] = [];
  generatedSections: GeneratedPaperSection[] = [];
  gaps: CoverageGap[] = [];
  board = '';
  standard = '';
  subjects: string[] = [];
  chapters: string[] = [];
  templateId = 'auto';
  marks = 40;
  durationMinutes = 90;
  loading = false;
  coverageChecked = false;
  priorityItemsCreated = false;
  savedDraftId = '';
  errorMessage = '';

  constructor(
    private readonly papers: QuestionPaperRepository,
    private readonly auth: AuthStore,
  ) {}

  async ngOnInit(): Promise<void> { await this.loadInitialData(); }

  get boardOptions(): string[] { return this.unique(this.syllabus.map((item) => item.board)); }

  get standardOptions(): string[] {
    return this.unique(this.syllabus.filter((item) => !this.board || item.board === this.board).map((item) => item.standard));
  }

  get subjectOptions(): string[] {
    return this.unique(this.syllabus.filter((item) => !this.board || item.board === this.board).filter((item) => !this.standard || item.standard === this.standard).map((item) => item.subject));
  }

  get chapterOptions(): string[] {
    const subjectSet = new Set(this.subjects);
    return this.unique(this.syllabus.filter((item) => !this.board || item.board === this.board).filter((item) => !this.standard || item.standard === this.standard).filter((item) => subjectSet.size === 0 || subjectSet.has(item.subject)).map((item) => item.chapter));
  }

  get matchingTemplates(): QuestionPaperTemplate[] {
    return this.templates.filter((template) => {
      const templateBoard = template.board ?? '';
      const templateStandard = template.standard ?? '';
      const templateSubjects = template.subjects ?? (template.subject ? [template.subject] : []);
      return (!templateBoard || !this.board || templateBoard === this.board) && (!templateStandard || !this.standard || templateStandard === this.standard) && (templateSubjects.length === 0 || this.subjects.length === 0 || templateSubjects.some((subject) => this.subjects.includes(subject)));
    });
  }

  get selectedTemplate(): QuestionPaperTemplate | null { return this.templates.find((template) => template.id === this.templateId) ?? null; }
  get activeRules(): GenerationRule[] { return this.buildRules(); }
  get activeRuleCount(): number { return this.activeRules.length; }
  get requiredQuestionCount(): number { return this.activeRules.reduce((sum, rule) => sum + rule.requiredCount, 0); }
  get totalGapCount(): number { return this.gaps.reduce((sum, gap) => sum + gap.gapCount, 0); }

  async loadInitialData(force = false): Promise<void> {
    if (this.loading && !force) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const [syllabus, templates] = await Promise.all([this.papers.syllabus(), this.papers.templates()]);
      this.syllabus = syllabus;
      this.templates = templates;
      if (!this.board && this.boardOptions.length) this.board = this.boardOptions[0];
      if (!this.standard && this.standardOptions.length) this.standard = this.standardOptions[0];
    } catch (error) { this.errorMessage = this.message(error); }
    finally { this.loading = false; }
  }

  onBoardChange(): void { this.standard = ''; this.subjects = []; this.chapters = []; this.templateId = 'auto'; this.resetResults(); }
  onStandardChange(): void { this.subjects = []; this.chapters = []; this.templateId = 'auto'; this.resetResults(); }

  toggleSubject(subject: string): void {
    this.subjects = this.subjects.includes(subject) ? this.subjects.filter((item) => item !== subject) : [...this.subjects, subject];
    const validChapters = new Set(this.chapterOptions);
    this.chapters = this.chapters.filter((chapter) => validChapters.has(chapter));
    this.resetResults();
  }

  toggleChapter(chapter: string): void { this.chapters = this.chapters.includes(chapter) ? this.chapters.filter((item) => item !== chapter) : [...this.chapters, chapter]; this.resetResults(); }
  clearSubjects(): void { this.subjects = []; this.chapters = []; this.resetResults(); }
  selectAllChapters(): void { this.chapters = [...this.chapterOptions]; this.resetResults(); }
  clearChapters(): void { this.chapters = []; this.resetResults(); }
  isSubjectSelected(subject: string): boolean { return this.subjects.includes(subject); }
  isChapterSelected(chapter: string): boolean { return this.chapters.includes(chapter); }
  templateTitle(template: QuestionPaperTemplate): string { return template.title ?? template.name ?? template.id; }

  async runCoverage(): Promise<void> {
    if (!this.validateSetup()) return;
    this.loading = true;
    this.errorMessage = '';
    this.priorityItemsCreated = false;
    this.savedDraftId = '';
    try {
      this.questions = await this.papers.approvedQuestions(this.board, this.standard, this.subjects, this.chapters);
      this.gaps = this.calculateGaps(this.activeRules, this.questions);
      this.coverageChecked = true;
      this.generatedSections = [];
    } catch (error) { this.errorMessage = this.message(error); }
    finally { this.loading = false; }
  }

  async generateDraft(): Promise<void> {
    if (!this.coverageChecked) await this.runCoverage();
    if (!this.coverageChecked) return;
    const used = new Set<string>();
    this.generatedSections = this.activeRules.map((rule) => {
      const exact = this.questions.filter((question) => !used.has(question.id) && this.matchesRule(question, rule));
      const fill = this.questions.filter((question) => !used.has(question.id) && !exact.includes(question));
      const selected = [...exact, ...fill].slice(0, rule.requiredCount);
      selected.forEach((question) => used.add(question.id));
      return {
        id: rule.id,
        title: rule.title,
        questionType: rule.questionType,
        difficulty: rule.difficulty,
        requiredCount: rule.requiredCount,
        marksPerQuestion: rule.marksPerQuestion,
        competencyTags: rule.competencyTags,
        questions: selected.map((question) => ({
          questionId: question.id,
          title: question.title,
          question: question.question,
          options: question.options,
          correctIndex: question.correctIndex,
          solutions: question.solutions,
          board: question.board,
          standard: question.standard,
          subject: question.subject,
          chapter: question.chapter,
          questionType: question.questionType,
          difficulty: question.difficulty,
          competencyTags: question.competencyTags,
          marks: rule.marksPerQuestion,
        })),
      };
    });
  }

  async saveDraft(): Promise<void> {
    if (!this.generatedSections.length || !this.validateSetup()) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const setup = this.currentSetup();
      this.savedDraftId = await this.papers.saveDraft({
        schemaVersion: 1,
        status: 'draft',
        board: setup.board,
        standard: setup.standard,
        primarySubject: setup.subjects[0] ?? '',
        subjects: setup.subjects,
        chapters: setup.chapters,
        marks: setup.marks,
        durationMinutes: setup.durationMinutes,
        templateId: setup.templateId,
        templateName: setup.templateName,
        sections: this.generatedSections,
        coverage: { availableQuestionCount: this.questions.length, requiredQuestionCount: this.requiredQuestionCount, gapCount: this.totalGapCount, gaps: this.gaps },
        createdBy: this.actorId(),
        updatedBy: this.actorId(),
      });
    } catch (error) { this.errorMessage = this.message(error); }
    finally { this.loading = false; }
  }

  async createPriorityItems(): Promise<void> {
    if (!this.gaps.length || !this.validateSetup()) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      await this.papers.createPriorityItems(this.currentSetup(), this.gaps, this.actorId());
      this.priorityItemsCreated = true;
    } catch (error) { this.errorMessage = this.message(error); }
    finally { this.loading = false; }
  }

  private validateSetup(): boolean {
    if (!this.board || !this.standard) { this.errorMessage = 'Select board and standard before checking coverage.'; return false; }
    if (this.subjects.length === 0) { this.errorMessage = 'Select at least one subject.'; return false; }
    if (this.chapters.length === 0) { this.errorMessage = 'Select at least one chapter.'; return false; }
    this.errorMessage = '';
    return true;
  }

  private buildRules(): GenerationRule[] {
    const template = this.selectedTemplate;
    const sections = template?.sections ?? template?.blueprint?.sections ?? [];
    if (sections.length > 0) return sections.map((section, index) => this.ruleFromSection(section, index));
    const count = Math.max(1, Math.floor(Number(this.marks) || 40));
    return [{ id: 'objective-mcq', title: `Objective MCQ paper (${this.marks || 40} marks)`, questionType: 'mcq', difficulty: 'any', competencyTags: [], requiredCount: count, marksPerQuestion: 1 }];
  }

  private ruleFromSection(section: QuestionPaperTemplateSection, index: number): GenerationRule {
    const marksPerQuestion = this.positiveNumber(section.marksPerQuestion ?? section.perQuestionMarks, 1);
    const requiredCount = this.positiveNumber(section.requiredCount ?? section.questionCount ?? section.count, 0) || Math.max(1, Math.floor(this.positiveNumber(section.marks, marksPerQuestion) / marksPerQuestion));
    return {
      id: section.id ?? `section-${index + 1}`,
      title: section.title ?? section.name ?? `Section ${index + 1}`,
      questionType: this.normalizeType(section.questionType ?? section.type ?? section.questionTypes?.[0] ?? 'mcq'),
      difficulty: section.difficulty?.trim() || 'any',
      competencyTags: section.competencyTags ?? [],
      requiredCount,
      marksPerQuestion,
    };
  }

  private calculateGaps(rules: GenerationRule[], questions: NormalizedQuestion[]): CoverageGap[] {
    return rules.map((rule) => {
      const availableCount = questions.filter((question) => this.matchesRule(question, rule)).length;
      return { sectionId: rule.id, sectionTitle: rule.title, questionType: rule.questionType, difficulty: rule.difficulty, competencyTags: rule.competencyTags, requiredCount: rule.requiredCount, availableCount, gapCount: Math.max(rule.requiredCount - availableCount, 0) };
    }).filter((gap) => gap.gapCount > 0);
  }

  private matchesRule(question: NormalizedQuestion, rule: GenerationRule): boolean {
    const typeMatches = rule.questionType === 'any' || question.questionType === rule.questionType;
    const difficultyMatches = rule.difficulty === 'any' || question.difficulty.toLowerCase() === rule.difficulty.toLowerCase();
    const competencyMatches = rule.competencyTags.length === 0 || rule.competencyTags.every((tag) => question.competencyTags.includes(tag));
    return typeMatches && difficultyMatches && competencyMatches;
  }

  private currentSetup(): PaperGenerationSetup {
    const template = this.selectedTemplate;
    return { board: this.board, standard: this.standard, subjects: [...this.subjects], chapters: [...this.chapters], marks: Number(this.marks) || 40, durationMinutes: Number(this.durationMinutes) || 90, templateId: this.templateId, templateName: template ? this.templateTitle(template) : 'Auto objective blueprint' };
  }

  private resetResults(): void { this.questions = []; this.generatedSections = []; this.gaps = []; this.coverageChecked = false; this.priorityItemsCreated = false; this.savedDraftId = ''; this.errorMessage = ''; }
  private actorId(): string { const profile = this.auth.profile(); return profile?.uid || profile?.email || 'admin'; }
  private unique(values: string[]): string[] { return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
  private positiveNumber(value: unknown, fallback: number): number { const numeric = Number(value); return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback; }
  private normalizeType(value: string): string { return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') || 'mcq'; }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'Unable to complete the question paper operation.'; }
}
