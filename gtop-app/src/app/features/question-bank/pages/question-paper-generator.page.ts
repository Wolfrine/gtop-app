import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PAPER_EXAMPLES, type PaperExample } from '../core/question-paper.examples';
import { SyllabusItem } from '../core/models';
import {
  buildGenerationRules, chapterKey, createPaperPlan, paperPrintHtml, ruleMarks,
  scopeValue, setupFingerprint, typeLabel, validatePaperSetup,
  type ChapterScope, type CoverageGap, type GeneratedPaperSection, type GenerationRule,
  type NormalizedQuestion, type PaperGenerationSetup, type PaperPlan,
  QuestionPaperRepository, type QuestionPaperTemplate, type SavedPaperDraft,
} from '../core/question-paper.repository';

@Component({
  selector: 'app-question-paper-generator-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page qpg-page">
      <div class="page-head">
        <div>
          <p class="eyebrow">For teachers & admins</p>
          <h1>Question paper generator</h1>
          <p class="lede">Choose a syllabus, check the question bank, and prepare a paper with a separate answer key.</p>
        </div>
        <div class="button-row">
          <a class="btn btn-secondary" routerLink="/admin/question-review">Review new questions</a>
          <a class="btn btn-secondary" routerLink="/admin/mcq-management">Question bank</a>
          <button class="btn btn-secondary" type="button" [disabled]="loading" (click)="loadInitialData()">Refresh</button>
        </div>
      </div>
      <nav class="qpg-journey" aria-label="Paper workflow">
        <span><b>01</b> Choose format</span><span><b>02</b> Set syllabus</span>
        <span><b>03</b> Check coverage</span><span><b>04</b> Preview & save</span>
      </nav>
      <section class="qpg-format-section" aria-labelledby="format-heading">
        <div class="section-head"><div><p class="eyebrow">Step 1 · paper format</p><h2 id="format-heading">What are you preparing?</h2>
          <p class="muted">Choose a format to start with a section plan. You can adjust question counts and marks below.</p></div></div>
        <p class="qpg-swipe-hint">Swipe to explore all paper formats →</p>
        <div class="qpg-format-layout">
          <div class="qpg-format-grid" role="group" aria-label="Paper formats">
            @for (format of paperFormatOptions; track format.id) {
              <button type="button" class="qpg-format-option" [attr.data-template-id]="format.id" [class.selected]="templateId === format.id"
                [attr.aria-pressed]="templateId === format.id" [disabled]="loading || loadedSnapshot"
                (click)="choosePaperFormat(format.id)">
                <span class="qpg-format-family">{{ format.family }}</span>
                <strong>{{ format.title }}</strong>
                <span class="qpg-format-description">{{ format.description }}</span>
                <span class="qpg-format-selected" aria-hidden="true">{{ templateId === format.id ? 'Selected ✓' : 'View sample →' }}</span>
              </button>
            }
          </div>
          <aside class="qpg-example" aria-live="polite" aria-label="Selected paper format sample">
            @if (selectedSample; as sample) {
              <div class="qpg-example-top"><span>EXAMPLE / {{ sample.family }}</span><span>{{ sample.marks }} {{ sample.marks === 1 ? 'mark' : 'marks' }}</span></div>
              <p class="qpg-example-scope">{{ sample.curriculum }} · {{ sample.questionType }}</p>
              <p class="qpg-example-question">{{ sample.question }}</p>
              @if (sample.options?.length) {
                <ol type="A" class="qpg-example-options">@for (option of sample.options; track option) { <li>{{ option }}</li> }</ol>
              } @else { <div class="qpg-example-lines" aria-hidden="true"><i></i><i></i><i></i></div> }
              <button type="button" class="qpg-answer-toggle" (click)="showSampleAnswer = !showSampleAnswer"
                [attr.aria-expanded]="showSampleAnswer">{{ showSampleAnswer ? 'Hide model answer' : 'Show model answer' }}</button>
              @if (showSampleAnswer) { <p class="qpg-example-answer">{{ sample.answer }}</p> }
              <p class="qpg-example-footnote">Illustration only · availability is checked against approved questions.</p>
            } @else {
              <p class="qpg-example-scope">Custom template</p>
              <p>This template has no prepared example yet. Its section plan is shown below.</p>
            }
          </aside>
        </div>
      </section>
      @if (errorMessage) { <div class="card qpg-error" role="alert">{{ errorMessage }}</div> }
      @if (templateWarning) { <div class="card qpg-warning" role="status">{{ templateWarning }}</div> }
      @if (loading) { <p class="qpg-status" role="status">{{ loadingMessage }}</p> }
      @if (loadedSnapshot) {
        <div class="card qpg-success qpg-saved-notice">
          <div><strong>Saved paper opened</strong><p>This is the saved copy. Its questions and answers stay together even if the bank changes.</p></div>
          <button class="btn btn-secondary" type="button" (click)="useSavedSetup()">Use setup for a new paper</button>
        </div>
      }

      <section class="section" aria-labelledby="setup-heading">
        <div class="section-head"><div><p class="eyebrow">Step 2 · syllabus & sections</p><h2 id="setup-heading">Choose what to cover</h2></div></div>
        <fieldset class="card qpg-card qpg-fieldset" [disabled]="loading || loadedSnapshot">
          <legend class="qpg-sr-only">Paper setup</legend>
          <label>Paper title<input type="text" maxlength="140" [(ngModel)]="title" (ngModelChange)="onSetupChange()" /></label>
          <div class="qpg-form-grid">
            <label>Board<select aria-label="Board" [(ngModel)]="board" (ngModelChange)="onBoardChange()">
              <option value="">Select board</option>
              @for (item of boardOptions; track item) { <option [value]="item">{{ item }}</option> }
            </select></label>
            <label>Standard<select aria-label="Standard" [(ngModel)]="standard" (ngModelChange)="onStandardChange()">
              <option value="">Select standard</option>
              @for (item of standardOptions; track item) { <option [value]="item">{{ item }}</option> }
            </select></label>
            <label>Marks<input type="number" min="1" max="2000" [(ngModel)]="marks" [readonly]="templateId !== 'auto'" (ngModelChange)="onMarksChange()" /></label>
            <label>Duration minutes<input type="number" min="1" max="360" [(ngModel)]="durationMinutes" (ngModelChange)="onSetupChange()" /></label>
          </div>
          <div class="qpg-selector">
            <div class="qpg-selector-head"><strong>Subjects</strong><button class="btn btn-secondary qpg-mini" type="button" (click)="clearSubjects()">Clear subjects</button></div>
            @if (!board || !standard) { <p class="muted">Choose a board and standard to see subjects.</p> }
            <div class="qpg-chip-list">
              @for (subject of subjectOptions; track subject) {
                <label class="qpg-chip" [class.active]="isSubjectSelected(subject)"><input type="checkbox" [checked]="isSubjectSelected(subject)" (change)="toggleSubject(subject)" /><span>{{ subject }}</span></label>
              }
            </div>
          </div>
          <div class="qpg-selector">
            <div class="qpg-selector-head"><strong>Chapters</strong><div class="button-row">
              <button class="btn btn-secondary qpg-mini" type="button" (click)="selectAllChapters()">Select all chapters</button>
              <button class="btn btn-secondary qpg-mini" type="button" (click)="clearChapters()">Clear chapters</button>
            </div></div>
            @if (!subjects.length) { <p class="muted">Choose a subject to see its chapters.</p> }
            <div class="qpg-chip-list qpg-chapters">
              @for (chapter of chapterOptions; track chapter.id) {
                <label class="qpg-chip" [class.active]="isChapterSelected(chapter.id)"><input type="checkbox" [checked]="isChapterSelected(chapter.id)" (change)="toggleChapter(chapter.id)" /><span>{{ chapter.chapter }}@if (subjects.length > 1) { <small> · {{ chapter.subject }}</small> }</span></label>
              }
            </div>
            @if (chapters.length) { <p class="muted small">{{ chapters.length }} selected. Questions are spread evenly across the selected chapters within each section.</p> }
          </div>
          <details class="qpg-plan" [open]="templateId !== 'auto'">
            <summary>Section plan · {{ requiredQuestionCount }} questions · {{ marks }} marks</summary>
            <p class="muted small">Review the template's starting plan. Adjust the counts and marks to suit your test; the paper total updates automatically.</p>
            @for (rule of rules; track rule.id; let i = $index) {
              <div class="qpg-rule-row">
                <div class="qpg-rule-title"><strong>{{ rule.title }}</strong><span class="muted small">{{ ruleTypes(rule) }}@if (rule.subject) { · {{ rule.subject }} }</span></div>
                <label>Questions<input type="number" min="1" max="400" [attr.aria-label]="rule.title + ' question count'" [(ngModel)]="rule.requiredCount" (ngModelChange)="onRuleChange()" /></label>
                <label>Marks each<input type="number" min="1" max="20" [attr.aria-label]="rule.title + ' marks each'" [(ngModel)]="rule.marksPerQuestion" (ngModelChange)="onRuleChange()" /></label>
                <label>Difficulty<select [attr.aria-label]="rule.title + ' difficulty'" [(ngModel)]="rule.difficulty" (ngModelChange)="onRuleChange()">
                  <option value="any">Any difficulty</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option>
                </select></label>
                <span class="pill info">{{ rule.requiredCount * rule.marksPerQuestion }} marks</span>
              </div>
            }
          </details>
          <div class="button-row"><button class="btn btn-primary" type="button" (click)="runCoverage()">Check availability</button></div>
        </fieldset>
      </section>

      <section class="section" aria-labelledby="coverage-heading">
        <div class="section-head"><div><p class="eyebrow">Step 3 · coverage</p><h2 id="coverage-heading">Check the question bank</h2></div>
          @if (coverageChecked) { <span class="pill" [class.success]="!totalGapCount" [class.warning]="totalGapCount > 0">{{ totalGapCount ? totalGapCount + ' more needed' : 'Ready to prepare' }}</span> }
        </div>
        @if (!coverageChecked) { <div class="card muted-card">Choose the chapters and check availability to see whether your paper can be completed.</div> }
        @if (coverageChecked) {
          <div class="grid grid-3 qpg-stat-grid">
            <article class="card stat"><span class="muted small">Questions needed</span><p class="stat-value">{{ requiredQuestionCount }}</p></article>
            <article class="card stat"><span class="muted small">Matched without repeats</span><p class="stat-value">{{ matchedQuestionCount }}</p></article>
            <article class="card stat"><span class="muted small">Marks covered</span><p class="stat-value">{{ matchedMarks }}<small> / {{ marks }}</small></p></article>
          </div>
          @if (excludedCount) { <p class="muted small">{{ excludedCount }} questions were left out because they are not approved, have incomplete answers, or need a diagram.</p> }
          @if (truncatedScopes.length) { <div class="card qpg-warning" role="status">Some large chapters have more questions than this check could inspect. Counts are a minimum; check a smaller syllabus before requesting missing questions.</div> }
          @if (gaps.length) {
            <div class="card qpg-card">
              <div class="section-head qpg-compact"><div><h3>Questions still needed</h3><p class="muted small">These chapters need more questions that match the section type and difficulty.</p></div>
                <button class="btn btn-primary" type="button" [disabled]="loading || priorityItemsCreated || !!truncatedScopes.length || loadedSnapshot" (click)="createPriorityItems()">{{ priorityItemsCreated ? 'Questions requested' : 'Request missing questions' }}</button>
              </div>
              <div class="qpg-gap-list">
                @for (gap of gaps; track gap.sectionId + gap.subject + gap.chapter) {
                  <article class="qpg-gap-row"><div><strong>{{ gap.chapter }}</strong><p>{{ gap.subject }} · {{ gap.sectionTitle }}</p><p class="muted small">{{ gapTypes(gap) }} · {{ gap.difficulty === 'any' ? 'Any difficulty' : label(gap.difficulty) }} · {{ gap.availableCount }} of {{ gap.requiredCount }} matched</p></div><span class="pill warning">{{ gap.gapCount }} needed</span></article>
                }
              </div>
              @if (priorityItemsCreated) { <p class="qpg-success-text" role="status">The request is saved. New questions will appear in Review new questions before they can be used in papers.</p> }
            </div>
          }
          @if (!loadedSnapshot) {
            <div class="button-row"><button class="btn btn-primary" type="button" [disabled]="loading || !matchedQuestionCount" (click)="generateDraft()">{{ totalGapCount ? 'Preview available questions' : 'Preview paper' }}</button></div>
          }
        }
      </section>

      <section class="section" aria-labelledby="preview-heading">
        <div class="section-head"><div><p class="eyebrow">Step 4 · output</p><h2 id="preview-heading">Preview your paper</h2></div>
          @if (hasGeneratedQuestions) {
            <div class="button-row"><button class="btn btn-primary" type="button" [disabled]="loading || !!savedDraftId" (click)="saveDraft()">{{ savedDraftId ? 'Draft saved' : 'Save draft' }}</button>
              <button class="btn btn-secondary" type="button" [disabled]="!completePaper" (click)="printPaper(false)">Print paper / Save PDF</button>
              <button class="btn btn-secondary" type="button" [disabled]="!completePaper" (click)="printPaper(true)">Print answer key</button>
            </div>
          }
        </div>
        @if (savedDraftId) { <div class="card qpg-success" role="status">Your draft is saved. Reopen it from Recent drafts below.</div> }
        @if (!hasGeneratedQuestions) { <div class="card muted-card">Your paper and its separate answer key will appear here after previewing.</div> }
        @if (hasGeneratedQuestions) {
          @if (!completePaper) { <div class="card qpg-warning">Incomplete draft: {{ generatedMarks }} of {{ marks }} marks. You can save this draft. Fill the missing questions before printing the student paper.</div> }
          <article class="card qpg-paper">
            <header class="qpg-paper-head"><p class="eyebrow">Growth Tutorials</p><h3>{{ title }}</h3><p>{{ board }} · Standard {{ standard }} · {{ subjects.join(', ') }}</p><p>{{ durationMinutes }} minutes · {{ marks }} marks</p>@if (negativeMarking < 0) { <p>{{ negativeMarking }} for each incorrect answer.</p> }</header>
            @for (section of generatedSections; track section.id; let sectionIndex = $index) {
              <section class="qpg-paper-section"><div class="qpg-section-heading"><h4>{{ section.title }}</h4><span>{{ section.questions.length * section.marksPerQuestion }} marks</span></div>
                <ol class="qpg-question-list" [attr.start]="questionStart(sectionIndex)">
                  @for (question of section.questions; track question.questionId) {
                    <li><p class="qpg-stem">{{ question.question }} <span class="qpg-mark">[{{ question.marks }}]</span></p>
                      @for (asset of question.assets; track asset.url) { <img class="qpg-diagram" [src]="asset.url" [alt]="asset.alt" loading="lazy" /> }
                      @if (question.options.length) { <ol type="A" class="qpg-options">@for (option of question.options; track $index) { <li>{{ option }}</li> }</ol> }
                    </li>
                  }
                </ol>
                @if (!section.questions.length) { <p class="muted">No matching questions available for this section yet.</p> }
              </section>
            }
          </article>
          <details class="card qpg-answer-key"><summary>Separate answer key</summary>
            @for (section of generatedSections; track section.id; let sectionIndex = $index) {
              <h3>{{ section.title }}</h3><ol [attr.start]="questionStart(sectionIndex)">
                @for (question of section.questions; track question.questionId) {
                  <li>@if (question.options.length) { <strong>{{ answerLetter(question.correctIndex) }}. {{ question.options[question.correctIndex] }}</strong> }
                    @for (solution of question.solutions; track $index) { <p>{{ solution }}</p> }
                    @if (!question.solutions.length) { <p class="muted">No detailed explanation saved.</p> }
                  </li>
                }
              </ol>
            }
          </details>
        }
      </section>
      <section class="section" aria-labelledby="drafts-heading">
        <div class="section-head"><h2 id="drafts-heading">Recent drafts</h2><button class="btn btn-secondary qpg-mini" type="button" [disabled]="loading" (click)="loadDrafts()">Refresh drafts</button></div>
        @if (draftListError) { <p class="qpg-error" role="alert">{{ draftListError }}</p> }
        @if (!recentDrafts.length && !draftListError) { <div class="card muted-card">Saved papers will appear here for you and other admins.</div> }
        <div class="qpg-draft-stack">@for (draft of recentDrafts; track draft.id) {
          <article class="card qpg-draft-row"><div><strong>{{ draft.title || draft.templateName || 'Saved paper' }}</strong><p class="muted small">{{ draft.board }} · Standard {{ draft.standard }} · {{ draft.subjects.join(', ') }} · {{ draft.marks }} marks</p></div><button class="btn btn-secondary" type="button" [disabled]="loading" (click)="openDraft(draft.id)">Open draft</button></article>
        }</div>
      </section>
    </div>
  `,

})
export class QuestionPaperGeneratorPage implements OnInit {
  syllabus: SyllabusItem[] = [];
  templates: QuestionPaperTemplate[] = [];
  questions: NormalizedQuestion[] = [];
  generatedSections: GeneratedPaperSection[] = [];
  rules: GenerationRule[] = buildGenerationRules(null, [], 40);
  gaps: CoverageGap[] = [];
  recentDrafts: SavedPaperDraft[] = [];
  truncatedScopes: ChapterScope[] = [];
  excludedCount = 0;
  board = '';
  standard = '';
  subjects: string[] = [];
  chapters: string[] = [];
  title = 'Chapter practice test';
  templateId = 'auto';
  showSampleAnswer = false;
  marks = 40;
  durationMinutes = 90;
  negativeMarking = 0;
  loading = false;
  loadingMessage = 'Loading paper setup…';
  coverageChecked = false;
  priorityItemsCreated = false;
  savedDraftId = '';
  errorMessage = '';
  templateWarning = '';
  draftListError = '';
  loadedSnapshot = false;
  private revision = 0;
  private checkedFingerprint = '';
  private plan: PaperPlan | null = null;
  private savedScopes: ChapterScope[] = [];

  constructor(
    private readonly papers: QuestionPaperRepository,
    private readonly auth: AuthService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}
  async ngOnInit(): Promise<void> { await this.loadInitialData(); }
  get boardOptions(): string[] { return this.unique(this.syllabus.map((item) => item.board)); }
  get standardOptions(): string[] { return this.unique(this.syllabus.filter((item) => item.board === this.board).map((item) => item.standard)); }
  get subjectOptions(): string[] { return this.unique(this.syllabus.filter((item) => item.board === this.board && item.standard === this.standard).map((item) => item.subject)); }
  get chapterOptions(): (ChapterScope & { id: string })[] {
    const scopes = this.syllabus.filter((item) => item.board === this.board && item.standard === this.standard && this.subjects.includes(item.subject))
      .map((item) => ({ subject: item.subject, chapter: item.chapter, id: chapterKey(item) }));
    return [...new Map(scopes.map((scope) => [scope.id, scope])).values()]
      .sort((a, b) => `${a.subject}|${a.chapter}`.localeCompare(`${b.subject}|${b.chapter}`, undefined, { numeric: true }));
  }
  get selectedScopes(): ChapterScope[] {
    return this.loadedSnapshot ? [...this.savedScopes] : this.chapterOptions.filter((scope) => this.chapters.includes(scope.id)).map(({ subject, chapter }) => ({ subject, chapter }));
  }
  get matchingTemplates(): QuestionPaperTemplate[] {
    return this.templates.filter((template) => {
      const any = (value: unknown, selected: string): boolean => !value || ['any','all'].includes(scopeValue(value)) || !selected || scopeValue(value) === scopeValue(selected);
      const templateSubjects = template.subjects ?? (template.subject ? [template.subject] : []);
      return any(template.board, this.board) && any(template.standard, this.standard) &&
        (!templateSubjects.length || !this.subjects.length || templateSubjects.some((subject) => this.subjects.some((selected) => scopeValue(subject) === scopeValue(selected))));
    });
  }
  get selectedTemplate(): QuestionPaperTemplate | null { return this.templates.find((template) => template.id === this.templateId) ?? null; }
  get paperFormatOptions(): { id: string; title: string; family: string; description: string }[] {
    return [
      { id: 'auto', title: 'Custom objective', family: PAPER_EXAMPLES['auto'].family, description: PAPER_EXAMPLES['auto'].description },
      ...this.matchingTemplates.map((template) => ({
        id: template.id, title: this.templateTitle(template), family: PAPER_EXAMPLES[template.id]?.family ?? 'Template',
        description: PAPER_EXAMPLES[template.id]?.description ?? template.description ?? template.notes ?? 'Use the stored section plan.',
      })),
    ];
  }
  get selectedSample(): PaperExample | null { return PAPER_EXAMPLES[this.templateId] ?? null; }
  choosePaperFormat(id: string): void {
    if (this.loading || this.loadedSnapshot || (id !== 'auto' && !this.matchingTemplates.some((template) => template.id === id))) return;
    this.templateId = id;
    this.onTemplateChange();
  }

  get requiredQuestionCount(): number { return this.rules.reduce((sum, rule) => sum + Number(rule.requiredCount || 0), 0); }
  get totalGapCount(): number { return this.gaps.reduce((sum, gap) => sum + gap.gapCount, 0); }
  get matchedQuestionCount(): number { return this.plan?.selectedCount ?? this.generatedSections.reduce((sum, section) => sum + section.questions.length, 0); }
  get matchedMarks(): number { return this.plan?.actualMarks ?? this.generatedMarks; }
  get generatedMarks(): number { return this.generatedSections.reduce((sum, section) => sum + section.questions.reduce((total, question) => total + question.marks, 0), 0); }
  get hasGeneratedQuestions(): boolean { return this.generatedSections.some((section) => section.questions.length > 0); }
  get completePaper(): boolean { return this.hasGeneratedQuestions && !this.totalGapCount && this.generatedMarks === this.marks && this.isCurrent(); }

  async loadInitialData(): Promise<void> {
    if (this.loading) return;
    this.loading = true; this.loadingMessage = 'Loading syllabus and templates…'; this.errorMessage = ''; this.templateWarning = '';
    this.resetResults();
    try {
      const [syllabus, templates] = await Promise.all([this.papers.syllabus(), this.papers.templates().catch(() => {
        this.templateWarning = 'Paper templates are unavailable right now. You can still prepare and print a standard MCQ paper. Refresh to try loading templates again.';
        return [] as QuestionPaperTemplate[];
      })]);
      this.syllabus = syllabus; this.templates = templates;
      const profile = this.auth.profile();
      if (!this.boardOptions.includes(this.board)) this.board = profile?.board && this.boardOptions.includes(profile.board) ? profile.board : this.boardOptions[0] ?? '';
      if (!this.standardOptions.includes(this.standard)) this.standard = profile?.standard && this.standardOptions.includes(profile.standard) ? profile.standard : this.standardOptions[0] ?? '';
      this.subjects = this.subjects.filter((subject) => this.subjectOptions.includes(subject));
      this.chapters = this.chapters.filter((id) => this.chapterOptions.some((scope) => scope.id === id));
      if (!this.matchingTemplates.some((template) => template.id === this.templateId)) this.templateId = 'auto';
      this.rebuildRules();
      await this.loadDrafts();
    } catch (error) { this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  async loadDrafts(): Promise<void> {
    this.draftListError = '';
    try { this.recentDrafts = await this.papers.recentDrafts(); }
    catch (error) { this.draftListError = `Saved papers could not be loaded. ${this.message(error)}`; }
    finally { this.changeDetector.markForCheck(); }
  }
  onBoardChange(): void { this.standard = ''; this.subjects = []; this.chapters = []; this.templateId = 'auto'; this.rebuildRules(); this.resetResults(); }
  onStandardChange(): void { this.subjects = []; this.chapters = []; this.templateId = 'auto'; this.rebuildRules(); this.resetResults(); }
  onTemplateChange(): void { this.showSampleAnswer = false; this.rebuildRules(); this.resetResults(); }
  onSetupChange(): void { this.resetResults(); }
  onMarksChange(): void { if (this.templateId === 'auto') this.rules = buildGenerationRules(null, this.subjects, Number(this.marks)); this.resetResults(); }
  onRuleChange(): void { this.marks = ruleMarks(this.rules); this.resetResults(); }
  toggleSubject(subject: string): void {
    this.subjects = this.subjects.includes(subject) ? this.subjects.filter((item) => item !== subject) : [...this.subjects, subject];
    this.chapters = this.chapters.filter((id) => this.chapterOptions.some((scope) => scope.id === id));
    if (this.templateId !== 'auto' && !this.matchingTemplates.some((template) => template.id === this.templateId)) this.templateId = 'auto';
    this.rebuildRules(); this.resetResults();
  }
  toggleChapter(id: string): void { this.chapters = this.chapters.includes(id) ? this.chapters.filter((item) => item !== id) : [...this.chapters, id]; this.resetResults(); }
  clearSubjects(): void { this.subjects = []; this.chapters = []; this.rebuildRules(); this.resetResults(); }
  selectAllChapters(): void { this.chapters = this.chapterOptions.map((scope) => scope.id); this.resetResults(); }
  clearChapters(): void { this.chapters = []; this.resetResults(); }
  isSubjectSelected(subject: string): boolean { return this.subjects.includes(subject); }
  isChapterSelected(id: string): boolean { return this.chapters.includes(id); }
  templateTitle(template: QuestionPaperTemplate): string { return template.title ?? template.name ?? template.id; }
  label(value: string): string { return typeLabel(value); }
  ruleTypes(rule: GenerationRule): string {
    return rule.typeRequirements?.length ? rule.typeRequirements.map((item) =>
      `${typeLabel(item.questionType)}${item.competencyTags.length ? ' (' + item.competencyTags.map(typeLabel).join(', ') + ')' : ''}`).join(' / ') : rule.questionTypes.map(typeLabel).join(' / ');
  }
  gapTypes(gap: CoverageGap): string { return gap.questionTypes.map(typeLabel).join(' / '); }
  answerLetter(index: number): string { return String.fromCharCode(65 + index); }
  questionStart(sectionIndex: number): number { return 1 + this.generatedSections.slice(0, sectionIndex).reduce((sum, section) => sum + section.questions.length, 0); }

  async runCoverage(): Promise<void> {
    if (this.loading || this.loadedSnapshot || !this.validateSetup()) return;
    this.resetResults();
    const revision = this.revision;
    const setup = this.currentSetup();
    const rules = structuredClone(this.rules);
    const fingerprint = setupFingerprint(setup, rules);
    this.loading = true; this.loadingMessage = 'Checking the selected chapters…';
    try {
      const result = await this.papers.approvedQuestions(setup.board, setup.standard, setup.chapterScopes);
      if (revision !== this.revision || fingerprint !== setupFingerprint(this.currentSetup(), this.rules)) return;
      const plan = createPaperPlan(setup, rules, result.questions);
      this.questions = result.questions; this.truncatedScopes = result.truncatedScopes; this.excludedCount = result.excludedCount;
      this.plan = plan; this.gaps = plan.gaps; this.coverageChecked = true; this.checkedFingerprint = fingerprint;
    } catch (error) { if (revision === this.revision) this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  async generateDraft(): Promise<void> {
    if (!this.isCurrent()) await this.runCoverage();
    if (!this.isCurrent() || !this.plan || this.loading) return;
    this.generatedSections = structuredClone(this.plan.sections);
    this.savedDraftId = '';
    this.changeDetector.markForCheck();
  }
  async saveDraft(): Promise<void> {
    if (this.loading || this.savedDraftId || !this.hasGeneratedQuestions) return;
    if (!this.isCurrent()) { this.errorMessage = 'The setup changed. Check availability and preview the paper again before saving.'; return; }
    if (!this.validateSetup()) return;
    const revision = this.revision;
    const setup = this.currentSetup();
    this.loading = true; this.loadingMessage = 'Saving your paper…'; this.errorMessage = '';
    try {
      const id = await this.papers.saveDraft({
        ...setup, schemaVersion: 2, status: 'draft', primarySubject: setup.subjects[0] ?? '',
        actualMarks: this.generatedMarks, rules: structuredClone(this.rules), sections: structuredClone(this.generatedSections),
        coverage: { availableQuestionCount: this.questions.length, requiredQuestionCount: this.requiredQuestionCount, gapCount: this.totalGapCount, gaps: structuredClone(this.gaps) },
        createdBy: this.actorId(), updatedBy: this.actorId(),
      });
      if (revision === this.revision) this.savedDraftId = id;
      await this.loadDrafts();
    } catch (error) { if (revision === this.revision) this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  async createPriorityItems(): Promise<void> {
    if (this.loading || this.priorityItemsCreated || !this.gaps.length || this.truncatedScopes.length || this.loadedSnapshot) return;
    if (!this.isCurrent()) { this.errorMessage = 'The setup changed. Check availability again before requesting questions.'; return; }
    const revision = this.revision;
    this.loading = true; this.loadingMessage = 'Saving the request for missing questions…'; this.errorMessage = '';
    try { await this.papers.createPriorityItems(this.currentSetup(), this.gaps, this.actorId()); if (revision === this.revision) this.priorityItemsCreated = true; }
    catch (error) { if (revision === this.revision) this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  async openDraft(id: string): Promise<void> {
    if (this.loading) return;
    this.loading = true; this.loadingMessage = 'Opening saved paper…'; this.errorMessage = '';
    try {
      const draft = await this.papers.draft(id);
      this.resetResults();
      this.board = draft.board; this.standard = draft.standard; this.subjects = [...draft.subjects];
      this.savedScopes = structuredClone(draft.chapterScopes); this.chapters = draft.chapterScopes.map(chapterKey);
      this.title = draft.title; this.templateId = draft.templateId; this.marks = draft.marks;
      this.durationMinutes = draft.durationMinutes; this.negativeMarking = draft.negativeMarking;
      this.rules = structuredClone(draft.rules); this.generatedSections = structuredClone(draft.sections);
      this.gaps = structuredClone(draft.coverage.gaps); this.loadedSnapshot = true; this.coverageChecked = true;
      this.savedDraftId = draft.id; this.checkedFingerprint = setupFingerprint(this.currentSetup(), this.rules);
    } catch (error) { this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  useSavedSetup(): void { this.resetResults(); }
  async printPaper(answers: boolean): Promise<void> {
    if (!this.completePaper) return;
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) { this.errorMessage = 'Allow pop-ups for GTOP to print or save a PDF.'; return; }
    printWindow.opener = null;
    printWindow.document.open(); printWindow.document.write(paperPrintHtml(this.currentSetup(), this.generatedSections, answers)); printWindow.document.close();
    const pendingImages = Array.from(printWindow.document.images).filter((image) => !image.complete).map((image) => new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); }));
    await Promise.race([Promise.all(pendingImages), new Promise((resolve) => setTimeout(resolve, 8000))]);
    if (!printWindow.closed && Array.from(printWindow.document.images).some((image) => !image.complete || !image.naturalWidth)) {
      printWindow.close(); this.errorMessage = 'A question diagram could not be loaded. Check the connection and diagram before printing.';
      this.changeDetector.markForCheck(); return;
    }
    if (!printWindow.closed) { printWindow.focus(); printWindow.print(); }
  }
  private rebuildRules(): void {
    const template = this.selectedTemplate;
    this.rules = buildGenerationRules(template, this.subjects, Number(this.marks) || 40);
    this.marks = ruleMarks(this.rules);
    this.negativeMarking = template?.structure?.negativeMarking ?? template?.blueprint?.negativeMarking ?? 0;
    const duration = template?.durationMinutes ?? template?.structure?.durationMinutes;
    if (duration) this.durationMinutes = duration;
  }
  private currentSetup(): PaperGenerationSetup {
    const scopes = this.selectedScopes;
    return { title: this.title.trim(), board: this.board, standard: this.standard, subjects: [...this.subjects],
      chapters: [...new Set(scopes.map((scope) => scope.chapter))], chapterScopes: scopes,
      marks: Number(this.marks), durationMinutes: Number(this.durationMinutes), templateId: this.templateId,
      templateName: this.selectedTemplate ? this.templateTitle(this.selectedTemplate) : 'Custom objective paper', negativeMarking: this.negativeMarking };
  }
  private validateSetup(): boolean { this.errorMessage = validatePaperSetup(this.currentSetup(), this.rules); return !this.errorMessage; }
  private isCurrent(): boolean { return this.coverageChecked && this.checkedFingerprint === setupFingerprint(this.currentSetup(), this.rules); }
  private resetResults(): void {
    this.revision++; this.questions = []; this.generatedSections = []; this.gaps = []; this.plan = null;
    this.coverageChecked = false; this.checkedFingerprint = ''; this.priorityItemsCreated = false;
    this.savedDraftId = ''; this.errorMessage = ''; this.loadedSnapshot = false; this.truncatedScopes = []; this.excludedCount = 0;
  }
  private actorId(): string { const profile = this.auth.profile(); return profile?.uid || profile?.email || ''; }
  private unique(values: string[]): string[] { return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
  private message(error: unknown): string {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') return 'This account cannot access the paper module. Sign in as an admin; if the problem continues, ask support to check the paper-module access rules.';
    if (code === 'unavailable') return 'The question bank could not be reached. Check your connection and try again.';
    return error instanceof Error ? error.message : 'Unable to complete this paper operation. Please try again.';
  }
}
