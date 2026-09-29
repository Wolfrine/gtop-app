import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuestionModuleHeaderComponent } from './question-module-header.component';
import { AdminUsageService } from '../../../services/admin-usage.service';
import { AuthService } from '../../../services/auth.service';
import { PAPER_EXAMPLES, type PaperExample } from '../core/question-paper.examples';
import { SyllabusItem } from '../core/models';
import { CurriculumService } from '../../../services/curriculum.service';
import { applicableChapters, currentAcademicYear, type AssessmentPurpose, type CurriculumSubject, type CurriculumSeed } from '../../../services/curriculum.domain';
import {
  buildGenerationRules, chapterKey, createPaperPlan, paperPrintHtml, ruleMarks, resizeGenerationRules,
  scopeValue, setupFingerprint, typeLabel, validatePaperSetup, validatePaperStructure,
  type ChapterScope, type CoverageGap, type GeneratedPaperSection, type GenerationRule,
  type NormalizedQuestion, type PaperGenerationSetup, type PaperPlan,
  QuestionPaperRepository, type QuestionPaperTemplate, type SavedPaperDraft, type PaperRequestRecord,
} from '../core/question-paper.repository';

@Component({
  selector: 'app-question-paper-generator-page',
  standalone: true,
  imports: [FormsModule, RouterLink, QuestionModuleHeaderComponent],
  template: `
    <div class="page qpg-page">
      <app-question-module-header active="papers" title="Create a question paper" description="One step at a time. Your format stays with you." [create]="false" />
      <div class="qpg-builder-links"><a routerLink="/admin/question-papers">← All papers</a><button type="button" (click)="toggleMobileDrafts()">{{showMobileDrafts ? 'Back to paper' : 'Saved papers'}}</button></div>
      <nav class="qpg-journey" aria-label="Paper workflow">
        <button type="button" [class.active]="mobileStep === 1 && !showMobileDrafts" [disabled]="guided && (loadedSnapshot || furthestMobileStep < 1)" (click)="goToMobileStep(1)"><b>01</b> Format</button>
        <button type="button" [class.active]="mobileStep === 2 && !showMobileDrafts" [disabled]="guided && (loadedSnapshot || furthestMobileStep < 2)" (click)="goToMobileStep(2)"><b>02</b> Syllabus</button>
        <button type="button" [class.active]="mobileStep === 3 && !showMobileDrafts" [disabled]="guided && (loadedSnapshot || furthestMobileStep < 3)" (click)="goToMobileStep(3)"><b>03</b> Coverage</button>
        <button type="button" [class.active]="mobileStep === 4 && !showMobileDrafts" [disabled]="guided && furthestMobileStep < 4" (click)="goToMobileStep(4)"><b>04</b> Preview</button>
      </nav>
      <section class="qpg-format-section" [class.qpg-mobile-hidden]="showMobileDrafts || mobileStep === 3 || mobileStep === 4" aria-labelledby="format-heading">
        @if (guided && mobileStep !== 1) {
          <div class="qpg-format-summary"><div><span class="eyebrow">Selected format</span><strong>{{ selectedFormatTitle }}</strong></div>
            <div class="qpg-summary-actions"><button type="button" (click)="goToMobileStep(1)">Change</button><button type="button" (click)="mobileSampleOpen = !mobileSampleOpen" [attr.aria-expanded]="mobileSampleOpen">{{ mobileSampleOpen ? 'Hide sample' : 'View sample' }}</button></div></div>
        }
        <div [class.qpg-mobile-hidden]="guided && mobileStep !== 1">
        <div class="section-head"><div><p class="eyebrow">Step 1 · paper format</p><h2 id="format-heading">What are you preparing?</h2>
          <p class="muted">Choose a format to start with a section plan. You can adjust question counts and marks below.</p></div></div>

        </div>
        <div class="qpg-format-layout">
          <div class="qpg-format-grid" [class.qpg-mobile-hidden]="guided && mobileStep !== 1" role="group" aria-label="Paper formats">
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
          <aside class="qpg-example" [class.qpg-mobile-hidden]="guided && !mobileSampleOpen" aria-live="polite" aria-label="Selected paper format sample">
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
              <p class="qpg-example-footnote">Illustration only · availability uses approved questions.</p>
              @if (templateId !== 'auto') { <a routerLink="/admin/question-review">Review stored sample questions →</a> }
            } @else {
              <p class="qpg-example-scope">Custom template</p>
              <p>This template has no prepared example yet. Its section plan is shown below.</p>
            }
          </aside>
        </div>
        @if (guided && mobileStep === 1) { <button class="qpg-sample-link" type="button" (click)="mobileSampleOpen = !mobileSampleOpen" [attr.aria-expanded]="mobileSampleOpen">{{ mobileSampleOpen ? 'Hide example question' : 'View example question for this format' }}</button> }
      </section>
      @if (errorMessage) { <div class="card qpg-error" role="alert">{{ errorMessage }}</div> }
      @if (formatScopeWarning) { <div class="card qpg-warning" role="status">{{ formatScopeWarning }}</div> }
      @if (templateWarning) { <div class="card qpg-warning" role="status">{{ templateWarning }}</div> }
      @if (loading) { <p class="qpg-status" role="status">{{ loadingMessage }}</p> }
      @if (loadedSnapshot && (!guided || mobileStep === 4) && !showMobileDrafts) {
        <div class="card qpg-success qpg-saved-notice">
          <div><strong>Saved paper opened</strong><p>This is the saved copy. Its questions and answers stay together even if the bank changes.</p></div>
          <button class="btn btn-secondary" type="button" (click)="useSavedSetup()">Use setup for a new paper</button>
        </div>
      }

      <section class="section" [class.qpg-mobile-hidden]="guided && (mobileStep !== 2 || showMobileDrafts)" aria-labelledby="setup-heading">
        <div class="section-head"><div><p class="eyebrow">Step 2 · syllabus & sections</p><h2 id="setup-heading">Choose what to cover</h2></div></div>
        <fieldset class="card qpg-card qpg-fieldset" [disabled]="loading || loadedSnapshot">
          <legend class="qpg-sr-only">Paper setup</legend>
          <label>Paper title<input type="text" maxlength="140" [(ngModel)]="title" (ngModelChange)="onSetupChange()" /></label>
          <div class="qpg-form-grid">
            <label>Board<select [hidden]="customContext" aria-label="Board" [(ngModel)]="board" (ngModelChange)="onBoardChange()">
              <option value="">Select board</option>
              @for (item of boardOptions; track item) { <option [value]="item">{{ item }}</option> }
            </select>@if(customContext){<input aria-label="Board name" [(ngModel)]="board" (ngModelChange)="onBoardChange()" />}</label>
            <label>Standard<select [hidden]="customContext" aria-label="Standard" [(ngModel)]="standard" (ngModelChange)="onStandardChange()">
              <option value="">Select standard</option>
              @for (item of standardOptions; track item) { <option [value]="item">{{ item }}</option> }
            </select>@if(customContext){<input aria-label="Standard name" [(ngModel)]="standard" (ngModelChange)="onStandardChange()" />}</label>
            <label>Marks<input type="number" min="1" max="2000" [(ngModel)]="marks" (change)="onMarksChange()" /></label>
            <label>Duration minutes<input type="number" min="1" max="360" [(ngModel)]="durationMinutes" (ngModelChange)="onSetupChange()" /></label>
          </div>
          <label class="qpg-context-toggle"><input type="checkbox" [(ngModel)]="customContext" (ngModelChange)="onSetupChange()" /> Enter a board or standard not listed above</label>
          <div class="qpg-form-grid">
            <label>Academic year<input maxlength="7" [(ngModel)]="academicYear" (change)="yearChanged()" /></label>
            <label>Coverage scope<select [(ngModel)]="scopeMode" (ngModelChange)="scopeChanged()"><option value="selected">Selected chapters</option><option value="full">Full approved syllabus</option><option value="custom">Custom chapters or topics</option></select></label>
            <label>Assessment purpose<select [(ngModel)]="assessmentPurpose" (ngModelChange)="scopeChanged()"><option value="summative">Summative</option><option value="formative">Formative</option><option value="both">Summative and formative</option></select></label>
          </div>
          @if(catalogueWarning){<p class="qpg-warning">{{catalogueWarning}}</p>}
          <div class="qpg-selector">
            <div class="qpg-selector-head"><strong>Subjects</strong><button class="btn btn-secondary qpg-mini" type="button" (click)="clearSubjects()">Clear subjects</button></div>
            @if (!board || !standard) { <p class="muted">Choose a board and standard to see subjects.</p> }
            <div class="qpg-chip-list">
              @for (subject of subjectOptions; track subject) {
                <label class="qpg-chip" [class.active]="isSubjectSelected(subject)"><input type="checkbox" [checked]="isSubjectSelected(subject)" (change)="toggleSubject(subject)" /><span>{{ subject }}</span></label>
              }
            </div>
          </div>
          <details class="qpg-extra"><summary>Subject not listed?</summary><div class="qpg-add-subject"><label>Missing subject<input [(ngModel)]="extraSubject" placeholder="Enter subject name" /></label><button type="button" class="btn btn-secondary" (click)="addSubject()">Add subject</button></div></details>
          @if(scopeMode === 'full') {
            <div class="qpg-curriculum-note"><strong>Full syllabus · {{academicYear}}</strong>
              @if(missingApprovedSubjects.length){<p>Awaiting approved syllabus: {{missingApprovedSubjects.join(', ')}}. You can save this request now for official-source verification.</p>}
              @else {<p>{{selectedScopes.length}} approved chapters apply to this assessment. Questions must be reviewed against these exact syllabus versions and assessment scope.</p>}
              <a routerLink="/syllabus-preview">Preview or approve syllabus →</a></div>
          }
          @if(scopeMode === 'custom') {
            <label>Chapters or topics, one per line<textarea [(ngModel)]="customChapters" (ngModelChange)="onSetupChange()" rows="5" placeholder="For multiple subjects: Subject | Chapter or topic"></textarea></label>
            <p class="muted small">Topics outside the approved list will be checked against official sources and sent for syllabus review before question creation.</p>
          }
          @if(scopeMode !== 'custom') {
          <div class="qpg-selector">
            <div class="qpg-selector-head"><strong>Chapters</strong><div class="button-row">
              <button class="btn btn-secondary qpg-mini" type="button" [disabled]="scopeMode === 'full'" (click)="selectAllChapters()">Select all chapters</button>
              <button class="btn btn-secondary qpg-mini" type="button" [disabled]="scopeMode === 'full'" (click)="clearChapters()">Clear chapters</button>
            </div></div>
            @if (!subjects.length) { <p class="muted">Choose a subject to see its chapters.</p> }
            @if (guided && chapterOptions.length > 8) {
              <label class="qpg-chapter-search">Find a chapter<input type="search" placeholder="Search chapters" [(ngModel)]="chapterSearch" /></label>
              @if (visibleChapterOptions.length < filteredChapterCount) { <p class="muted small">Showing 8 of {{ filteredChapterCount }} chapters. Search to find another.</p> }
            }
            <div class="qpg-chip-list qpg-chapters">
              @for (chapter of visibleChapterOptions; track chapter.id) {
                <label class="qpg-chip" [class.active]="isChapterSelected(chapter.id)"><input type="checkbox" [disabled]="scopeMode === 'full'" [checked]="scopeMode === 'full' || isChapterSelected(chapter.id)" (change)="toggleChapter(chapter.id)" /><span>{{ chapter.chapter }}@if (subjects.length > 1) { <small> · {{ chapter.subject }}</small> }</span></label>
              }
            </div>
            @if (guided && chapterSearch && !visibleChapterOptions.length) { <p class="muted small">No chapters match this search.</p> }
            @if (chapters.length) { <p class="muted small">{{ chapters.length }} selected. Questions are spread evenly across the selected chapters within each section.</p> }
          </div>
          }
          @if(scopeMode === 'selected' && missingApprovedSubjects.length){<p class="muted small">Existing-bank chapters for {{missingApprovedSubjects.join(', ')}} have not been verified for {{academicYear}}.</p>}
          <details class="qpg-extra"><summary>Additional instructions</summary><label>Scope instructions<textarea [(ngModel)]="syllabusNotes" (ngModelChange)="onSetupChange()" rows="2" placeholder="Textbook edition, programme, custom scope or other requirements"></textarea></label></details>
          <details class="qpg-plan" >
            <summary>Section plan · {{ requiredQuestionCount }} questions · {{ sectionMarks }} marks</summary>
            <p class="muted small">Changing total marks adjusts counts while keeping every section. You can also edit section counts and marks; the total updates automatically.</p>
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
          <div class="button-row qpg-request-actions"><button class="btn btn-secondary" type="button" [disabled]="requestSaved" (click)="saveRequest()">{{requestSaved ? 'Request saved' : 'Save paper request'}}</button><button class="btn btn-primary qpg-desktop-check" type="button" (click)="runCoverage()">Check availability</button></div>
        </fieldset>
        @if(requestMessage){<p class="card qpg-success" role="status">{{requestMessage}}</p>}
      </section>

      <section class="section" [class.qpg-mobile-hidden]="guided && (mobileStep !== 3 || showMobileDrafts)" aria-labelledby="coverage-heading">
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
          @if (excludedCount) { <p class="muted small">{{ excludedCount }} questions were left out because they are not approved, have incomplete answers, need a diagram, or have not been reviewed against the selected syllabus version and assessment scope.</p> }
          @if (truncatedScopes.length) { <div class="card qpg-warning" role="status">Some large chapters have more questions than this check could inspect. Counts are a minimum; check a smaller syllabus before requesting missing questions.</div> }
          @if (gaps.length) {
            <div class="card qpg-card">
              <div class="section-head qpg-compact"><div><h3>Questions still needed</h3><p class="muted small">These chapters need more questions that match the section type and difficulty.</p></div>
                <button class="btn btn-primary" [class.qpg-inline-action]="!matchedQuestionCount" type="button" [disabled]="loading || priorityItemsCreated || !!truncatedScopes.length || loadedSnapshot" (click)="createPriorityItems()">{{ priorityItemsCreated ? 'Questions requested' : 'Request missing questions' }}</button>
              </div>
              <div class="qpg-gap-list">
                @for (gap of gaps; track gap.sectionId + gap.subject + gap.chapter) {
                  <article class="qpg-gap-row"><div><strong>{{ gap.chapter }}</strong><p>{{ gap.subject }} · {{ gap.sectionTitle }}</p><p class="muted small">{{ gapTypes(gap) }} · {{ gap.difficulty === 'any' ? 'Any difficulty' : label(gap.difficulty) }} · {{ gap.availableCount }} of {{ gap.requiredCount }} matched</p></div><span class="pill warning">{{ gap.gapCount }} needed</span></article>
                }
              </div>
              @if (priorityItemsCreated) { <p class="qpg-success-text" role="status">The request is saved. <a routerLink="/admin/question-bank">Track its priority and progress</a>; new questions will enter admin review before use in papers.</p> }
            </div>
          }
          @if (!loadedSnapshot) {
            <div class="button-row qpg-inline-action"><button class="btn btn-primary" type="button" [disabled]="loading || !matchedQuestionCount" (click)="generateDraft()">{{ totalGapCount ? 'Preview available questions' : 'Preview paper' }}</button></div>
          }
        }
      </section>

      <section class="section" [class.qpg-mobile-hidden]="guided && (mobileStep !== 4 || showMobileDrafts)" aria-labelledby="preview-heading">
        <div class="section-head"><div><p class="eyebrow">Step 4 · output</p><h2 id="preview-heading">Preview your paper</h2></div>
          @if (hasGeneratedQuestions) {
            <div class="button-row"><button class="btn btn-primary qpg-inline-save" type="button" [disabled]="loading || !!savedDraftId" (click)="saveDraft()">{{ savedDraftId ? 'Draft saved' : 'Save draft' }}</button>
              <button class="btn btn-secondary" type="button" [disabled]="!completePaper" (click)="printPaper(false)">Print paper / Save PDF</button>
              <button class="btn btn-secondary" type="button" [disabled]="!completePaper" (click)="printPaper(true)">Print answer key</button>
            </div>
          }
        </div>
        @if (savedDraftId && !loadedSnapshot) { <div class="card qpg-success" role="status">Your draft is saved. Reopen it from Saved papers.</div> }
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
      <section class="section" [class.qpg-mobile-hidden]="guided && !showMobileDrafts" aria-labelledby="drafts-heading">
        <div class="section-head"><h2 id="drafts-heading">Recent drafts</h2><button class="btn btn-secondary qpg-mini" type="button" [disabled]="loading" (click)="loadDrafts()">Refresh drafts</button></div>
        @if (draftListError) { <p class="qpg-error" role="alert">{{ draftListError }}</p> }
        @if (!recentDrafts.length && !draftListError) { <div class="card muted-card">Saved papers will appear here for you and other admins.</div> }
        <div class="qpg-draft-stack">@for (draft of recentDrafts; track draft.id) {
          <article class="card qpg-draft-row"><div><strong>{{ draft.title || draft.templateName || 'Saved paper' }}</strong><p class="muted small">{{ draft.board }} · Standard {{ draft.standard }} · {{ draft.subjects.join(', ') }} · {{ draft.marks }} marks</p></div><button class="btn btn-secondary" type="button" [disabled]="loading" (click)="openDraft(draft.id)">Open draft</button></article>
        }</div>
      </section>
      @if (guided && !showMobileDrafts && !loading && (mobileStep === 2 || (mobileStep === 3 && (matchedQuestionCount || gaps.length)) || (mobileStep === 4 && hasGeneratedQuestions && !savedDraftId))) {
        <div class="qpg-mobile-bar">
          @if (mobileStep === 2) { <button class="btn btn-primary" type="button" (click)="runCoverage()">Check availability</button> }
          @if (mobileStep === 3 && matchedQuestionCount) { <button class="btn btn-primary" type="button" (click)="generateDraft()">{{ totalGapCount ? 'Preview available questions' : 'Preview paper' }}</button> }
          @if (mobileStep === 3 && !matchedQuestionCount && gaps.length) { <button class="btn btn-primary" type="button" [disabled]="priorityItemsCreated || !!truncatedScopes.length" (click)="createPriorityItems()">{{ priorityItemsCreated ? 'Questions requested' : 'Request missing questions' }}</button> }
          @if (mobileStep === 4 && hasGeneratedQuestions && !savedDraftId) { <button class="btn btn-primary" type="button" (click)="saveDraft()">Save draft</button> }
        </div>
      }
    </div>
  `,

})
export class QuestionPaperGeneratorPage implements OnInit, OnDestroy {
  syllabus: SyllabusItem[] = [];
  academicYear = currentAcademicYear();
  scopeMode: 'selected' | 'full' | 'custom' = 'selected';
  assessmentPurpose: AssessmentPurpose = 'summative';
  curriculum: CurriculumSubject[] = [];
  catalogueSeed: CurriculumSeed | null = null;
  catalogueWarning = '';
  customContext = false;
  customChapters = '';
  syllabusNotes = '';
  extraSubject = '';
  customSubjects: string[] = [];
  requests: PaperRequestRecord[] = [];
  requestMessage = '';
  requestSaved = false;
  private requestId: string = crypto.randomUUID();

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
  mobileSampleOpen = false;
  isCompactViewport = false;
  readonly guided = true;
  mobileStep: 1 | 2 | 3 | 4 = 1;
  furthestMobileStep: 1 | 2 | 3 | 4 = 1;
  showMobileDrafts = false;
  chapterSearch = '';
  private viewportQuery: MediaQueryList | null = null;
  private readonly onViewportChange = (event: MediaQueryListEvent): void => {
    this.isCompactViewport = event.matches;
    if (event.matches) this.syncMobileStep();
    this.changeDetector.markForCheck();
  };
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
  private resumedScopes:ChapterScope[]|null=null;
  private resumedResolved=false;

  constructor(
    private readonly papers: QuestionPaperRepository,
    private readonly catalogue: CurriculumService,
    private readonly auth: AuthService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly usage: AdminUsageService,
  ) {}
  async ngOnInit(): Promise<void> {
    if (typeof window !== 'undefined') {
      this.viewportQuery = window.matchMedia('(max-width: 640px)');
      this.isCompactViewport = this.viewportQuery.matches;
      this.viewportQuery.addEventListener('change', this.onViewportChange);
    }
    await this.loadInitialData();
    const params=this.route.snapshot.queryParamMap;
    if(params.get('draftId'))await this.openDraft(params.get('draftId')!);
    else if(params.get('requestId'))await this.resumeRequest(params.get('requestId')!);
  }
  ngOnDestroy(): void { this.viewportQuery?.removeEventListener('change', this.onViewportChange); }
  get selectedFormatTitle(): string { return this.paperFormatOptions.find((format) => format.id === this.templateId)?.title ?? this.selectedTemplate?.title ?? 'Saved format'; }
  get filteredChapterCount(): number { return this.chapterOptions.filter((scope) => `${scope.subject} ${scope.chapter}`.toLocaleLowerCase().includes(this.chapterSearch.trim().toLocaleLowerCase())).length; }
  get visibleChapterOptions(): (ChapterScope & { id: string })[] {

    const search = this.chapterSearch.trim().toLocaleLowerCase();
    return this.chapterOptions.filter((scope) => `${scope.subject} ${scope.chapter}`.toLocaleLowerCase().includes(search)).slice(0, 8);
  }
  goToMobileStep(step: 1 | 2 | 3 | 4): void {
    if (step > this.furthestMobileStep || (this.loadedSnapshot && step !== 4)) return;
    this.showMobileDrafts = false;
    this.mobileStep = step;
    this.usage.track('paper_step');
    this.mobileSampleOpen = false;
    this.scrollToMobileContent();
  }
  toggleMobileDrafts(): void {
    this.showMobileDrafts = !this.showMobileDrafts;
    this.mobileSampleOpen = false;
    this.scrollToMobileContent();
  }
  private advanceMobileStep(step: 2 | 3 | 4): void {
    this.furthestMobileStep = Math.max(this.furthestMobileStep, step) as 2 | 3 | 4;
    this.goToMobileStep(step);
  }
  private syncMobileStep(): void {
    if (this.loadedSnapshot || this.hasGeneratedQuestions) this.advanceMobileStep(4);
    else if (this.coverageChecked) this.advanceMobileStep(3);
  }
  private scrollToMobileContent(): void {
    if (!this.isCompactViewport) return;
    requestAnimationFrame(() => document.querySelector('.qpg-journey')?.scrollIntoView({ block: 'start', behavior: 'auto' }));
  }
  get boardOptions(): string[] { return this.unique([...this.syllabus.map(item => item.board), ...(this.catalogueSeed?.boards.map(item => item.board) ?? []), ...this.curriculum.map(item => item.board)]); }
  get standardOptions(): string[] { return this.unique([...this.syllabus.filter(item => item.board === this.board).map(item => item.standard), ...(this.catalogueSeed?.boards.find(item => item.board === this.board)?.standards ?? []), ...this.curriculum.filter(item => item.board === this.board).map(item => item.standard)]); }
  get subjectOptions(): string[] { return this.unique([...this.syllabus.filter(item => item.board === this.board && item.standard === this.standard).map(item => item.subject), ...this.curriculum.filter(item => item.board === this.board && item.standard === this.standard).map(item => item.subject), ...(this.catalogueSeed?.subjects.filter(item => item.board === this.board && item.standard === this.standard).map(item => item.subject) ?? []), ...this.customSubjects]); }
  get selectedCurriculum(): CurriculumSubject[] { return this.curriculum.filter(item => item.board === this.board && item.standard === this.standard && item.academicYear === this.academicYear && this.subjects.includes(item.subject)); }
  get missingApprovedSubjects(): string[] { if(this.resumedScopes)return this.subjects.filter(subject=>!this.resumedScopes!.some(scope=>scope.subject===subject&&scope.curriculumVersionId)); return this.subjects.filter(subject => !this.selectedCurriculum.some(item => item.subject === subject)); }
  get chapterOptions(): (ChapterScope & { id: string })[] {
    if(this.resumedScopes)return this.resumedScopes.map(scope=>({...scope,id:chapterKey(scope)}));
    const scopes: (ChapterScope & {id:string})[] = [];
    for (const subject of this.subjects) {
      const approved = this.selectedCurriculum.find(item => item.subject === subject);
      if (approved) {
        for (const chapter of applicableChapters(approved, this.assessmentPurpose)) {
          const scope = {subject,chapter:chapter.title,curriculumVersionId:approved.versionId!,bankAliases:chapter.bankAliases};
          scopes.push({...scope,id:chapterKey(scope)});
        }
      } else if (this.scopeMode !== 'full') {
        scopes.push(...this.syllabus.filter(item => item.board === this.board && item.standard === this.standard && item.subject === subject)
          .map(item => ({subject:item.subject,chapter:item.chapter,id:chapterKey(item)})));
      }
    }
    return [...new Map(scopes.map(scope => [scope.id,scope])).values()];
  }
  get selectedScopes(): ChapterScope[] {
    if(this.resumedScopes)return structuredClone(this.resumedScopes);
    if (this.loadedSnapshot) return [...this.savedScopes];
    if (this.scopeMode === 'custom') return [...new Map(this.customChapters.split('\n').filter(line => line.trim()).map(line => {
      const index = line.indexOf(' | ');
      const subject = index >= 0 ? line.slice(0,index).trim() : this.subjects.length === 1 ? this.subjects[0] : '';
      const chapter = index >= 0 ? line.slice(index+3).trim() : line.trim();
      const approved = this.chapterOptions.find(item => item.subject === subject && item.chapter === chapter);
      const scope: ChapterScope = approved ?? {subject,chapter};
      return [chapterKey(scope),scope] as const;
    })).values()];
    return this.chapterOptions.filter(scope => this.scopeMode === 'full' || this.chapters.includes(scope.id)).map(({id,...scope}) => scope);
  }
  get syllabusResolved(): boolean {
    if(this.resumedScopes)return this.resumedResolved;
    if (this.scopeMode === 'full') return this.subjects.length > 0 && !this.missingApprovedSubjects.length && this.selectedScopes.length > 0;
    return this.selectedScopes.length > 0 && this.selectedScopes.every(scope => !!scope.curriculumVersionId || (this.scopeMode === 'selected' && this.syllabus.some(item => item.board === this.board && item.standard === this.standard && item.subject === scope.subject && item.chapter === scope.chapter)));
  }
  addSubject(): void {
    const subject = this.extraSubject.trim(); if (!subject) return;
    this.customSubjects = this.unique([...this.customSubjects,subject]);
    if (!this.subjects.includes(subject)) this.toggleSubject(subject);
    this.extraSubject = '';
  }
  async loadCurriculum(): Promise<void> {
    this.catalogueWarning = '';
    const year = this.academicYear;
    try {
      const [seed, curriculum] = await Promise.all([this.catalogue.seed(), this.catalogue.published(year)]);
      if (year !== this.academicYear) return;
      this.catalogueSeed = seed; this.curriculum = curriculum;
    } catch { this.curriculum = []; this.catalogueWarning = 'The approved syllabus catalogue is unavailable. Existing-bank selection still works; full-syllabus requests will wait for verification.'; }
    this.changeDetector.markForCheck();
  }
  async yearChanged(): Promise<void> { this.chapters = []; this.resetResults(); await this.loadCurriculum(); }
  scopeChanged(): void { this.chapters = []; this.resetResults(); }
  async saveRequest(): Promise<void> {
    if (this.formatScopeWarning || (this.templateId !== 'auto' && !this.selectedTemplate)) { this.errorMessage = this.formatScopeWarning || 'Choose an available paper format before saving.'; return; }
    if (this.loading || this.loadedSnapshot || this.requestSaved) return;
    const structureError = validatePaperStructure(this.currentSetup(), this.rules);
    if (structureError) { this.errorMessage = structureError; return; }
    if (this.selectedScopes.some(scope => !scope.subject || !this.subjects.includes(scope.subject))) { this.errorMessage = 'For multiple subjects, enter each custom line as Subject | Chapter or topic.'; return; }
    this.loading = true; this.errorMessage = '';
    try {
      await this.papers.requestPaper(this.currentSetup(),structuredClone(this.rules),this.actorId(),this.requestId);
      this.requestSaved = true;
      this.usage.track('paper_requested');
      this.requestMessage = this.syllabusResolved ? 'Paper request saved. Its chapter coverage will be checked before questions are created.' : 'Paper request saved. The creator will check official sources and prepare missing syllabus details for admin approval.';
      this.requests = await this.papers.recentRequests();
    } catch(error) { this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  get matchingTemplates(): QuestionPaperTemplate[] {
    return this.templates.filter((template) => {
      const any = (value: unknown, selected: string): boolean => !value || ['any','all'].includes(scopeValue(value)) || !selected || scopeValue(value) === scopeValue(selected);
      const templateSubjects = template.subjects ?? (template.subject ? [template.subject] : []);
      return any(template.board, this.board) && any(template.standard, this.standard) &&
        (!templateSubjects.length || !this.subjects.length || templateSubjects.some((subject) => this.subjects.some((selected) => scopeValue(subject) === scopeValue(selected))));
    });
  }
  get formatScopeWarning(): string {
    return this.selectedTemplate && !this.matchingTemplates.some(template => template.id === this.templateId)
      ? `“${this.templateTitle(this.selectedTemplate)}” does not match the selected board, standard or subjects. Your section plan is retained. Choose a compatible format or restore its syllabus selection.` : '';
  }
  get sectionMarks(): number { return ruleMarks(this.rules); }
  get selectedTemplate(): QuestionPaperTemplate | null { return this.templates.find((template) => template.id === this.templateId) ?? null; }
  get paperFormatOptions(): { id: string; title: string; family: string; description: string }[] {
    return [
      { id: 'auto', title: 'Custom objective', family: PAPER_EXAMPLES['auto'].family, description: PAPER_EXAMPLES['auto'].description },
      ...this.templates.filter(template => template.id === this.templateId || this.matchingTemplates.some(match => match.id === template.id)).map((template) => ({
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
    this.advanceMobileStep(2);
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
      await this.loadCurriculum();
      this.requests = await this.papers.recentRequests().catch(() => []);
      const profile = this.auth.profile();
      if (!this.boardOptions.includes(this.board)) this.board = profile?.board && this.boardOptions.includes(profile.board) ? profile.board : this.boardOptions[0] ?? '';
      if (!this.standardOptions.includes(this.standard)) this.standard = profile?.standard && this.standardOptions.includes(profile.standard) ? profile.standard : this.standardOptions[0] ?? '';
      this.subjects = this.subjects.filter((subject) => this.subjectOptions.includes(subject));
      this.chapters = this.chapters.filter((id) => this.chapterOptions.some((scope) => scope.id === id));
      if (this.templateId !== 'auto' && !this.selectedTemplate) {
        this.templateWarning = 'The selected format is unavailable. Its section plan is retained; choose an available format to continue.';
      } else this.refreshRuleSubjects();
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
  onBoardChange(): void { this.customSubjects = []; this.customChapters = ''; this.standard = ''; this.subjects = []; this.chapters = []; this.chapterSearch = ''; this.refreshRuleSubjects(); this.resetResults(); }
  onStandardChange(): void { this.customSubjects = []; this.customChapters = ''; this.subjects = []; this.chapters = []; this.chapterSearch = ''; this.refreshRuleSubjects(); this.resetResults(); }
  onTemplateChange(): void { this.showSampleAnswer = false; this.rebuildRules(); this.resetResults(); }
  onSetupChange(): void { this.resetResults(); }
  onMarksChange(): void {
    this.resetResults();
    try { this.rules = resizeGenerationRules(this.rules, Number(this.marks)); }
    catch (error) { this.errorMessage = this.message(error); }
  }
  onRuleChange(): void { this.marks = ruleMarks(this.rules); this.resetResults(); }
  toggleSubject(subject: string): void {
    this.subjects = this.subjects.includes(subject) ? this.subjects.filter((item) => item !== subject) : [...this.subjects, subject];
    this.chapters = this.chapters.filter((id) => this.chapterOptions.some((scope) => scope.id === id)); this.chapterSearch = '';
    this.refreshRuleSubjects(); this.resetResults();
  }
  toggleChapter(id: string): void { this.chapters = this.chapters.includes(id) ? this.chapters.filter((item) => item !== id) : [...this.chapters, id]; this.resetResults(); }
  clearSubjects(): void { this.subjects = []; this.chapters = []; this.refreshRuleSubjects(); this.resetResults(); }
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
    this.resetResults(true);
    const revision = this.revision;
    const setup = this.currentSetup();
    const rules = structuredClone(this.rules);
    const fingerprint = setupFingerprint(setup, rules);
    this.loading = true; this.loadingMessage = 'Checking the selected chapters…';
    try {
      const result = await this.papers.approvedQuestions(setup.board, setup.standard, setup.chapterScopes, this.scopeMode === 'full' ? this.assessmentPurpose : undefined);
      if (revision !== this.revision || fingerprint !== setupFingerprint(this.currentSetup(), this.rules)) return;
      const plan = createPaperPlan(setup, rules, result.questions);
      this.questions = result.questions; this.truncatedScopes = result.truncatedScopes; this.excludedCount = result.excludedCount;
      if(this.requestSaved && !result.truncatedScopes.length)await this.papers.updateRequestCoverage(this.requestId,plan,this.actorId());
      this.usage.track('coverage_checked');
      this.plan = plan; this.gaps = plan.gaps; this.coverageChecked = true; this.checkedFingerprint = fingerprint;
      this.advanceMobileStep(3);
    } catch (error) { if (revision === this.revision) this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  async generateDraft(): Promise<void> {
    if (!this.isCurrent()) await this.runCoverage();
    if (!this.isCurrent() || !this.plan || this.loading) return;
    this.generatedSections = structuredClone(this.plan.sections);
    this.savedDraftId = '';
    this.advanceMobileStep(4);
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
      },this.requestSaved?this.requestId:undefined);
      if (revision === this.revision) this.savedDraftId = id;
      this.usage.track('paper_saved');
      await this.loadDrafts();
    } catch (error) { if (revision === this.revision) this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  async createPriorityItems(): Promise<void> {
    if (this.loading || this.priorityItemsCreated || !this.gaps.length || this.truncatedScopes.length || this.loadedSnapshot) return;
    if (!this.isCurrent()) { this.errorMessage = 'The setup changed. Check availability again before requesting questions.'; return; }
    const revision = this.revision;
    this.loading = true; this.loadingMessage = 'Saving the request for missing questions…'; this.errorMessage = '';
    try { await this.papers.createPriorityItems(this.currentSetup(), this.gaps, this.actorId(), this.requestId, structuredClone(this.rules)); if (revision === this.revision) { this.priorityItemsCreated = true; this.requestSaved=true; this.usage.track('paper_requested'); this.requestMessage='Request queued. The daily creator prepares missing questions for review. Return to Papers to continue.'; } }
    catch (error) { if (revision === this.revision) this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  async resumeRequest(id:string):Promise<void> {
    if(this.loading)return;
    this.loading=true;this.errorMessage='';
    try {
      const request=await this.papers.request(id);
      this.resetResults();
      this.academicYear=request.academicYear??currentAcademicYear();this.scopeMode=request.scopeMode??'selected';this.assessmentPurpose=request.assessmentPurpose??'summative';
      this.board=request.board;this.standard=request.standard;this.subjects=[...request.subjects];this.customSubjects=[...request.subjects];
      this.title=request.title;this.templateId=request.templateId;this.marks=request.marks;this.durationMinutes=request.durationMinutes;this.negativeMarking=request.negativeMarking;
      this.syllabusNotes=request.syllabusNotes??'';this.rules=structuredClone(request.rules);this.customChapters=request.scopeMode==='custom'?request.chapterScopes.map(scope=>scope.subject+' | '+scope.chapter).join('\n'):'';
      await this.loadCurriculum();this.chapters=request.chapterScopes.map(chapterKey);this.requestId=request.id;this.requestSaved=true;this.resumedScopes=structuredClone(request.chapterScopes);this.resumedResolved=request.syllabusResolved===true;this.priorityItemsCreated=request.prioritiesCreated===true;
      this.requestMessage='Saved request opened with its original chapter scope and syllabus version. Check availability to use newly approved questions. Editing setup starts a new request.';this.advanceMobileStep(2);
    }catch(error){this.errorMessage=this.message(error);}finally{this.loading=false;this.changeDetector.markForCheck();}
  }
  async openDraft(id: string): Promise<void> {
    if (this.loading) return;
    this.loading = true; this.loadingMessage = 'Opening saved paper…'; this.errorMessage = '';
    try {
      const draft = await this.papers.draft(id);
      this.resetResults();
      this.academicYear = draft.academicYear ?? currentAcademicYear(); this.scopeMode = draft.scopeMode ?? 'selected'; this.assessmentPurpose = draft.assessmentPurpose ?? 'summative'; this.syllabusNotes = draft.syllabusNotes ?? '';
      this.customChapters = draft.scopeMode === 'custom' ? draft.chapterScopes.map(scope => `${scope.subject} | ${scope.chapter}`).join('\n') : '';
      this.board = draft.board; this.standard = draft.standard; this.subjects = [...draft.subjects];
      this.savedScopes = structuredClone(draft.chapterScopes); this.chapters = draft.chapterScopes.map(chapterKey);
      this.title = draft.title; this.templateId = draft.templateId; this.marks = draft.marks;
      this.durationMinutes = draft.durationMinutes; this.negativeMarking = draft.negativeMarking;
      this.rules = structuredClone(draft.rules); this.generatedSections = structuredClone(draft.sections);
      this.gaps = structuredClone(draft.coverage.gaps); this.loadedSnapshot = true; this.coverageChecked = true;
      this.savedDraftId = draft.id; this.checkedFingerprint = setupFingerprint(this.currentSetup(), this.rules);
      this.showMobileDrafts = false; this.advanceMobileStep(4);
    } catch (error) { this.errorMessage = this.message(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }
  async useSavedSetup(): Promise<void> { this.resetResults(); await this.loadCurriculum(); this.advanceMobileStep(2); }
  async printPaper(answers: boolean): Promise<void> {
    if (!this.completePaper) return;
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) { this.usage.track('operation_failed'); this.errorMessage = 'Allow pop-ups for GTOP to print or save a PDF.'; return; }
    printWindow.opener = null;
    printWindow.document.open(); printWindow.document.write(paperPrintHtml(this.currentSetup(), this.generatedSections, answers)); printWindow.document.close();
    const pendingImages = Array.from(printWindow.document.images).filter((image) => !image.complete).map((image) => new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); }));
    await Promise.race([Promise.all(pendingImages), new Promise((resolve) => setTimeout(resolve, 8000))]);
    if (!printWindow.closed && Array.from(printWindow.document.images).some((image) => !image.complete || !image.naturalWidth)) {
      printWindow.close(); this.usage.track('operation_failed'); this.errorMessage = 'A question diagram could not be loaded. Check the connection and diagram before printing.';
      this.changeDetector.markForCheck(); return;
    }
    if (!printWindow.closed) { printWindow.focus(); printWindow.print(); this.usage.track('paper_printed'); }
  }
  private refreshRuleSubjects(): void {
    if (!this.rules.length) { this.rebuildRules(); return; }
    if (this.templateId === 'auto' || !this.selectedTemplate || this.formatScopeWarning) return;
    const available = buildGenerationRules(this.selectedTemplate, this.subjects, Number(this.marks) || 40);
    this.rules = available.map(rule => this.rules.find(existing => existing.id === rule.id) ?? rule);
    this.marks = ruleMarks(this.rules);
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
    return { academicYear:this.academicYear, scopeMode:this.scopeMode, assessmentPurpose:this.assessmentPurpose, curriculumVersionIds:[...new Set(scopes.map(scope => scope.curriculumVersionId).filter((id): id is string => !!id))], syllabusResolved:this.loadedSnapshot || this.syllabusResolved, syllabusNotes:this.syllabusNotes.trim(), title: this.title.trim(), board: this.board, standard: this.standard, subjects: [...this.subjects],
      chapters: [...new Set(scopes.map((scope) => scope.chapter))], chapterScopes: scopes,
      marks: Number(this.marks), durationMinutes: Number(this.durationMinutes), templateId: this.templateId,
      templateName: this.selectedTemplate ? this.templateTitle(this.selectedTemplate) : 'Custom objective paper', negativeMarking: this.negativeMarking };
  }
  private validateSetup(): boolean {
    if (this.templateId !== 'auto' && !this.selectedTemplate) { this.errorMessage = 'Choose an available paper format before continuing.'; return false; }
    if (this.formatScopeWarning) { this.errorMessage = this.formatScopeWarning; return false; }
    if (this.scopeMode === 'full' && !this.loadedSnapshot && !this.syllabusResolved) { this.errorMessage = 'The full syllabus is not yet approved for every selected subject. Save the paper request to ask for verification.'; return false; }
    this.errorMessage = validatePaperSetup(this.currentSetup(), this.rules); return !this.errorMessage; }
  private isCurrent(): boolean { return this.coverageChecked && this.checkedFingerprint === setupFingerprint(this.currentSetup(), this.rules); }
  private resetResults(preserveRequest = false): void {
    if (!preserveRequest) { this.resumedScopes=null; this.requestId = crypto.randomUUID(); this.requestSaved = false; this.requestMessage = ''; }
    this.revision++; this.questions = []; this.generatedSections = []; this.gaps = []; this.plan = null;
    this.coverageChecked = false; this.checkedFingerprint = ''; if(!preserveRequest)this.priorityItemsCreated = false;
    this.savedDraftId = ''; this.errorMessage = ''; this.loadedSnapshot = false; this.truncatedScopes = []; this.excludedCount = 0;
    this.furthestMobileStep = this.mobileStep === 1 ? 1 : 2;
  }
  private actorId(): string { const profile = this.auth.profile(); return profile?.uid || profile?.email || ''; }
  private unique(values: string[]): string[] { return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
  private message(error: unknown): string {
    this.usage.track('operation_failed');
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') return 'This account cannot access the paper module. Sign in as an admin; if the problem continues, ask support to check the paper-module access rules.';
    if (code === 'unavailable') return 'The question bank could not be reached. Check your connection and try again.';
    return error instanceof Error ? error.message : 'Unable to complete this paper operation. Please try again.';
  }
}

