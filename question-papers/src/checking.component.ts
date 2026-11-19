import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatMathDirective } from './chat-math.directive';
import { formatAssistantText } from './presentation.mjs';
import { AssistantApi } from './api.service';
import { PaperCheckingBatchComponent } from './checking-batch.component';
import { ClassReturnComponent } from './class-return.component';
import { maxCheckingPages, rotateScan, scanBase64, scanFiles, type Scan } from './checking-intake';
import { marginGroups, marksOnPage, positionedMarks, scoreStatus, type MappingPoint, type MarkStatus,
  type MethodStep, type ScanMark } from './checking-scan';
import { summarizeGrades } from '../../assistant-service/domain/checking.mjs';

type State = 'uploading' | 'queued' | 'running' | 'failed' | 'review' | 'final';
type Result = MarkStatus;
type Answer = {
  number: number;
  max: number;
  optional: boolean;
  status: Result;
  awarded: number | null;
  choice: 'A' | 'B' | null;
  explanation: string;
  evidence: string;
  anchors: MappingPoint[];
  steps?: MethodStep[];
  counted?: boolean | null;
};
type Variant = {
  question: string;
  options?: string[];
  correctIndex?: number | null;
  answer?: string;
  markingPoints?: string[];
};
type Question = Variant & {
  number: number;
  max: number;
  sectionId?: string;
  alternative: string | null;
  alternativeRubric?: Variant | null;
};
type Section = {
  id: string;
  title: string;
  instructions?: string;
  attemptCount: number;
  questionNumbers: number[];
};
type Selection = { sectionId: string; countedNumbers: number[] };
type Decision = Section & {
  attemptedNumbers: number[];
  countedNumbers: number[];
  needsSelection: boolean;
  selectionRequired: boolean;
  missingToConfirm: number;
};
type Grade = {
  answers: Answer[];
  awarded: number;
  max: number;
  pending: number;
  sections?: Decision[];
  sectionSelections?: Selection[];
};
type Page = { index: number; width: number; height: number };
type Summary = {
  id: string;
  packetId?: string;
  label: string;
  state: State;
  pageCount: number;
  awarded: number | null;
  pending?: number;
  version: number;
  max?: number;
  updatedAt: string;
};
type Sheet = Summary & {
  notes: string;
  uploaded: Page[];
  grade?: Grade;
  error?: string;
  finalizedAt?: string;
  engine?: 'codex-cli' | 'openai-api';
};
type Rubric = {
  title: string;
  hasScheme: boolean;
  marks?: number;
  instructions?: string[];
  sections?: Section[];
};
type Detail = { sheet: Sheet; rubric: Rubric & { questions: Question[] } };
type Index = { sheets: Summary[]; rubric: Rubric; nextCursor?: string | null };
type Filter = 'All sheets' | 'Needs attention' | 'Ready' | 'In progress' | 'Finalized';

@Component({
  selector: 'gtop-paper-checking',
  standalone: true,
  imports: [CommonModule, FormsModule, PaperCheckingBatchComponent, ChatMathDirective, ClassReturnComponent],
  templateUrl: './checking.html',
  styleUrl: './checking.css',
})
export class PaperCheckingComponent implements OnInit, OnDestroy {
  @Input({ required: true }) paperId = '';
  @Input({ required: true }) onClose!: () => void;
  @Input() scopePacketId = '';
  @Input() onScanClass?: (paperId:string)=>void;
  readonly format = formatAssistantText;
  private api = inject(AssistantApi);
  private change = inject(ChangeDetectorRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private releaseMarker?: () => void;
  private observer?: ResizeObserver;
  private epoch = 0;
  private listEpoch = 0;
  private dead = false;
  private opening = '';
  private revision = '';
  private displayUrls = new Map<number, string>();
  private draftId = '';
  @ViewChild('scanStage') set stage(element: ElementRef<HTMLElement> | undefined) {
    this.observer?.disconnect();
    if (!element) return;
    this.observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry.contentRect.height);
      const width = Math.round(
        element.nativeElement.querySelector('.scan-image')?.getBoundingClientRect().width || 0,
      );
      if (height > 0 && width > 0 && (height !== this.stageHeight || width !== this.scanWidth)) {
        this.stageHeight = height;
        this.scanWidth = width;
        this.paint();
      }
    });
    this.observer.observe(element.nativeElement);
  }
  stageHeight = 600;
  scanWidth = 420;
  remarkKey = '';
  focusedStep: number | null = null;
  placingStep: number | null = null;
  readonly scoreStatus = scoreStatus;
  sheets: Summary[] = [];
  cursor: string | null = null;
  moreBusy = false;
  search = '';
  filter: Filter = 'All sheets';
  readonly filters: Filter[] = ['All sheets', 'Needs attention', 'Ready', 'In progress', 'Finalized'];
  sheet?: Sheet;
  rubric?: Rubric;
  sections: Section[] = [];
  selections: Selection[] = [];
  questions: Question[] = [];
  answers: Answer[] = [];
  pageNumber = 1;
  selected = 0;
  pane: 'scan' | 'review' = 'scan';
  focusList: 'issues' | 'all' = 'issues';
  groupedNumbers: number[] = [];
  zoom = 1;
  fit: 'page' | 'width' = 'page';
  placing = false;
  crosshair = { x: 0.5, y: 0.5 };
  editing = false;
  editingAnswer = false;
  dirty = false;
  composing = false;
  batch = false;
  batchSelection = false;
  photos: Scan[] = [];
  photoIndex = 0;
  previewZoom = false;
  conflict = false;
  readonly pageLimit = maxCheckingPages;
  label = '';
  notes = '';
  loading = true;
  busy = false;
  printing = false;
  error = '';
  message = '';
  confirmingMissing = false;
  confirmedPages = false;
  readonly captions: Record<Result, string> = {
    correct: 'Correct',
    partial: 'Partial credit',
    wrong: 'Incorrect',
    missing: 'Missing',
    unreadable: 'Unreadable',
    uncertain: 'Uncertain',
  };
  readonly statuses = Object.keys(this.captions) as Result[];
  readonly symbols: Record<Result, string> = {
    correct: '✓',
    partial: '◐',
    wrong: '×',
    missing: '–',
    unreadable: '?',
    uncertain: '?',
  };
  get base() {
    return '/papers/' + encodeURIComponent(this.paperId) + '/checking';
  }
  get pageItems() {
    return [...(this.sheet?.uploaded || [])].sort((a, b) => a.index - b.index);
  }
  get page() {
    return this.pageItems.find((item) => item.index === this.pageNumber);
  }
  get answer() {
    return this.answers.find((answer) => answer.number === this.selected);
  }
  get question() {
    return this.questions.find((question) => question.number === this.selected);
  }
  get variant() {
    const question = this.question;
    return this.answer?.choice === 'B' && question?.alternativeRubric ? question.alternativeRubric : question;
  }
  get otherVariant(): Variant | undefined {
    const question = this.question;
    if (!question?.alternative) return;
    return this.answer?.choice === 'B'
      ? question
      : (question.alternativeRubric ?? { question: question.alternative });
  }
  get section() {
    return this.sections.find((section) => section.questionNumbers.includes(this.selected));
  }
  preview?: Grade;
  get foundTotal() {
    return this.preview?.awarded ?? 0;
  }
  get pending() {
    return this.preview?.pending ?? 0;
  }
  get max() {
    return this.sheet?.grade?.max ?? this.rubric?.marks;
  }
  get canEdit() {
    return this.sheet?.state === 'review' || (this.sheet?.state === 'final' && this.editing);
  }
  get imagesReady() {
    return !!this.sheet && this.displayUrls.size === this.sheet.pageCount;
  }
  get active() {
    return this.sheet?.state === 'queued' || this.sheet?.state === 'running';
  }
  get issues() {
    return this.answers.filter((answer) => this.needsDecision(answer));
  }
  get missing() {
    return this.issues.filter((answer) => answer.status === 'missing');
  }
  get visibleAnswers() {
    return this.focusList === 'issues' ? this.issues : this.answers;
  }
  get visibleSheets() {
    const query = this.search.trim().toLocaleLowerCase();
    return this.sheets.filter(
      (item) =>
        (this.filter === 'All sheets' || this.bucket(item) === this.filter) &&
        item.label.toLocaleLowerCase().includes(query),
    );
  }
  get readySheets() {
    return this.visibleSheets.filter((item) => item.state === 'review' && item.pending === 0);
  }
  get hasUnsaved() {
    return this.dirty || this.photos.length > 0 || this.batchSelection;
  }
  url(index: number) {
    return this.displayUrls.get(index) || '';
  }
  bucket(item: Summary): Filter {
    if (item.state === 'final') return 'Finalized';
    if (item.state === 'failed' || item.state === 'uploading' || (item.state === 'review' && !!item.pending))
      return 'Needs attention';
    return item.state === 'review' ? 'Ready' : 'In progress';
  }
  stateLabel(item: Summary) {
    if (item.state === 'uploading') return 'Upload incomplete';
    if (item.state === 'failed') return 'Checking failed';
    if (item.state === 'queued') return 'Queued';
    if (item.state === 'running') return 'Checking';
    if (item.state === 'review' && item.pending === undefined) return 'Awaiting review';
    return this.bucket(item);
  }
  resultLabel(answer: Answer) {
    return answer.status === 'missing' && answer.awarded === 0 ? 'Unattempted' : this.captions[answer.status];
  }
  needsDecision(answer: Answer) {
    if (answer.awarded !== null) return false;
    const counted = this.counted(answer.number);
    if (counted === null) return false;
    if (counted !== false) return true;
    return (
      answer.status === 'missing' &&
      !!this.preview?.sections?.some(
        (section) => section.missingToConfirm > 0 && section.questionNumbers.includes(answer.number),
      )
    );
  }
  counted(number: number) {
    return this.preview?.answers.find((answer) => answer.number === number)?.counted;
  }
  answerByNumber(number: number) {
    return this.answers.find((answer) => answer.number === number);
  }
  hasSelection(id: string, number: number) {
    return !!this.selections.find((section) => section.sectionId === id)?.countedNumbers.includes(number);
  }
  markChanged() {
    this.dirty = true;
    this.message = '';
    this.recalculate();
  }
  private recalculate() {
    if (!this.sheet?.grade) {
      this.preview = undefined;
      return;
    }
    if (!this.sections.length) {
      this.preview = {
        ...this.sheet.grade,
        answers: this.answers,
        awarded: Math.round(this.answers.reduce((sum, a) => sum + (a.awarded ?? 0), 0) * 100) / 100,
        pending: this.answers.filter((a) => a.awarded === null).length,
      };
    } else
      this.preview = {
        ...this.sheet.grade,
        ...summarizeGrades(this.answers, this.sections, this.selections),
      } as Grade;
  }
  toggleSelection(section: Decision, number: number, checked: boolean) {
    const previous = this.selections.find((item) => item.sectionId === section.id)?.countedNumbers || [];
    const countedNumbers = checked ? [...previous, number] : previous.filter((n) => n !== number);
    this.selections = [
      ...this.selections.filter((item) => item.sectionId !== section.id),
      { sectionId: section.id, countedNumbers },
    ];
    this.markChanged();
  }
  private paint() {
    if (!this.dead) this.change.markForCheck();
  }
  ngOnInit() {
    const initialSheet = new URL(location.href).searchParams.get('sheet');
    const register = this.refresh();
    if (initialSheet) {
      if (this.scopePacketId) void register.then(() => { if (!this.dead && !this.error) void this.open(initialSheet); });
      else void this.open(initialSheet);
    }
    const uid = this.api.user?.uid;
    if (uid) {
      try {
        this.releaseMarker = this.api.watchMarker(
          'assistantUiNotifications/' + uid,
          (snapshot) => {
            const revision = snapshot.data?.['revision'];
            if (snapshot.fromCache || typeof revision !== 'string' || revision === this.revision) return;
            this.revision = revision;
            if (!this.dead && !this.busy && !this.composing && (this.active || !this.sheet))
              void this.refresh();
          },
          () => {},
        );
      } catch {
        /* The teacher can refresh the register manually. */
      }
    }
  }
  ngOnDestroy() {
    this.dead = true;
    this.epoch++;
    this.releaseMarker?.();
    this.observer?.disconnect();
    this.disposePhotos();
    this.releaseImages();
  }
  private describe(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong. Try again.';
  }
  private changeUrl(sheetId?: string) {
    const url = new URL(location.href);
    if (sheetId) url.searchParams.set('sheet', sheetId);
    else url.searchParams.delete('sheet');
    history.replaceState(history.state, '', url);
  }
  async refresh() {
    const request = ++this.listEpoch;
    this.error = '';
    try {
      const path = this.scopePacketId
        ? '/checking/packets/' + encodeURIComponent(this.scopePacketId) + '/results'
        : this.base;
      const { sheets, rubric, nextCursor, paperId } = await this.api.request<Index & {paperId?: string}>(path);
      if (this.dead || request !== this.listEpoch) return;
      if (this.scopePacketId && paperId !== this.paperId) throw new Error('This class belongs to a different question paper. Open it from Check papers.');
      this.sheets = sheets;
      this.cursor = nextCursor ?? null;
      this.rubric = rubric;
      this.paint();
      if (this.sheet && !this.dirty && !this.composing && !this.opening)
        await this.open(this.sheet.id, false);
    } catch (error) {
      if (!this.dead && request === this.listEpoch) this.error = this.describe(error);
    } finally {
      if (!this.dead && request === this.listEpoch) this.loading = false;
      this.paint();
    }
  }
  async loadMore() {
    if (!this.cursor || this.moreBusy) return;
    const request = this.listEpoch;
    this.moreBusy = true;
    this.error = '';
    try {
      const data = await this.api.request<Index>(this.base + '/history', 'POST', { cursor: this.cursor });
      if (this.dead || request !== this.listEpoch) return;
      const existing = new Set(this.sheets.map((item) => item.id));
      this.sheets.push(...data.sheets.filter((item) => !existing.has(item.id)));
      this.cursor = data.nextCursor ?? null;
    } catch (error) {
      if (!this.dead) this.error = this.describe(error);
    } finally {
      this.moreBusy = false;
      this.paint();
    }
  }
  async open(id: string, changeUrl = true) {
    if (this.scopePacketId && !this.sheets.some(item => item.id === id)) {
      this.changeUrl();
      this.message = 'That sheet is outside this class. Choose a sheet from the class results.';
      this.paint();
      return;
    }
    if (this.dirty && id === this.sheet?.id) return;
    const generation = ++this.epoch;
    this.opening = id;
    this.error = '';
    if (changeUrl) this.changeUrl(id);
    try {
      const { sheet, rubric } = await this.api.request<Detail>(this.base + '/' + encodeURIComponent(id));
      if (this.epoch !== generation || this.dead) return;
      const same = this.sheet?.id === id;
      const unchanged = same && this.sheet?.version === sheet.version && this.sheet?.state === sheet.state;
      if (!same) {
        this.releaseImages();
        this.selected = 0;
        this.pageNumber = 1;
        this.editing = false;
        this.editingAnswer = false;
        this.placing = false;
        this.pane = 'scan';
        this.zoom = 1;
        this.fit = 'page';
        this.groupedNumbers = [];
        this.confirmingMissing = false;
        this.message = '';
      }
      this.composing = false;
      this.conflict = false;
      this.sheet = sheet;
      this.questions = rubric.questions;
      this.rubric = rubric;
      this.sections = rubric.sections || [];
      if (!unchanged) {
        this.answers = structuredClone(sheet.grade?.answers || []);
        this.selections = structuredClone(sheet.grade?.sectionSelections || []);
        this.recalculate();
        this.focusList = this.issues.length ? 'issues' : 'all';
        if (!this.selected) {
          const answer = this.issues[0] ?? this.answers[0];
          if (answer) this.choose(answer);
        }
      }
      this.paint();
      const pages = this.pageItems.sort(
        (a, b) => Number(b.index === this.pageNumber) - Number(a.index === this.pageNumber),
      );
      for (const page of pages) {
        if (this.displayUrls.has(page.index)) continue;
        const blob = await this.api.checkingImage(this.base + '/' + id + '/pages/' + page.index);
        if (this.epoch !== generation || this.dead) return;
        this.displayUrls.set(page.index, URL.createObjectURL(blob));
        this.paint();
      }
    } catch (error) {
      if (this.epoch === generation && !this.dead) this.error = this.describe(error);
    } finally {
      if (this.epoch === generation) this.opening = '';
      this.paint();
    }
  }
  private releaseImages() {
    for (const url of this.displayUrls.values()) URL.revokeObjectURL(url);
    this.displayUrls.clear();
  }
  private disposePhotos() {
    for (const photo of this.photos) URL.revokeObjectURL(photo.url);
    this.photos = [];
    this.photoIndex = 0;
    this.previewZoom = false;
  }
  list() {
    if (
      this.busy ||
      (this.hasUnsaved && !window.confirm('Discard unsaved changes and return to all sheets?'))
    )
      return;
    this.epoch++;
    this.opening = '';
    this.sheet = undefined;
    this.dirty = false;
    this.composing = false;
    this.batchSelection = false;
    this.placing = false;
    this.message = '';
    this.releaseImages();
    this.disposePhotos();
    this.changeUrl();
    void this.refresh();
  }
  leave() {
    if (!this.busy && (!this.hasUnsaved || window.confirm('Discard unsaved changes and return to papers?')))
      this.onClose();
  }
  start(resume = false) {
    this.disposePhotos();
    this.batch = false;
    this.batchSelection = false;
    this.draftId = resume ? this.sheet!.id : '';
    this.label = resume ? this.sheet!.label : '';
    this.notes = resume ? this.sheet!.notes : '';
    this.composing = true;
    this.error = '';
    this.message = '';
  }
  intakeMode(batch: boolean) {
    if (batch === this.batch || this.busy || this.frozen) return;
    if (
      (this.photos.length || this.batchSelection) &&
      !window.confirm('Discard these selected files and switch upload mode?')
    )
      return;
    this.disposePhotos();
    this.batch = batch;
    this.batchSelection = false;
    this.error = '';
    this.message = '';
  }
  closeBatch() {
    this.batchSelection = false;
    this.busy = false;
    this.cancelIntake();
    void this.refresh();
  }
  cancelIntake() {
    this.composing = false;
    this.disposePhotos();
    this.draftId = '';
    this.error = '';
    this.message = '';
  }
  get resuming() {
    return !!this.sheet && this.draftId === this.sheet.id;
  }
  get frozen() {
    return !!this.draftId;
  }
  async addFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement,
      files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    this.busy = true;
    this.error = '';
    try {
      const pages = await scanFiles(
        files,
        (this.resuming ? this.sheet!.pageCount : this.pageLimit) - this.photos.length,
      );
      if (this.dead) {
        for (const page of pages) URL.revokeObjectURL(page.url);
        return;
      }
      this.photoIndex = this.photos.length;
      this.photos.push(...pages);
    } catch (error) {
      this.error = this.describe(error);
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  move(index: number, amount: number) {
    const target = index + amount;
    if (target < 0 || target >= this.photos.length) return;
    [this.photos[index], this.photos[target]] = [this.photos[target], this.photos[index]];
    this.photoIndex = target;
  }
  remove(index: number) {
    const [photo] = this.photos.splice(index, 1);
    URL.revokeObjectURL(photo.url);
    this.photoIndex = Math.min(this.photoIndex, Math.max(0, this.photos.length - 1));
  }
  async rotate() {
    if (this.busy) return;
    const original = this.photos[this.photoIndex];
    if (!original) return;
    this.busy = true;
    this.error = '';
    try {
      const replacement = await rotateScan(original);
      if (this.dead) {
        URL.revokeObjectURL(replacement.url);
        return;
      }
      this.photos[this.photoIndex] = replacement;
      URL.revokeObjectURL(original.url);
    } catch (error) {
      this.error = this.describe(error);
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  async submit() {
    if (this.busy || !this.label.trim() || !this.photos.length) return;
    if (this.resuming && this.sheet!.pageCount !== this.photos.length) {
      this.error = 'Choose the same ' + this.sheet!.pageCount + ' pages in their original order.';
      return;
    }
    this.busy = true;
    this.error = '';
    this.draftId ||= crypto.randomUUID();
    const id = this.draftId;
    try {
      await this.api.request(this.base, 'POST', {
        id,
        label: this.label,
        notes: this.notes,
        pageCount: this.photos.length,
      });
      for (let i = 0; i < this.photos.length; i++) {
        this.message = 'Saving page ' + (i + 1) + ' of ' + this.photos.length + '…';
        this.paint();
        const jpeg = await scanBase64(this.photos[i].blob);
        await this.api.request(this.base + '/' + id + '/pages/' + (i + 1), 'POST', { jpeg });
      }
      await this.api.request(this.base + '/' + id + '/queue', 'POST', {});
      this.disposePhotos();
      this.message = '';
      this.draftId = '';
      await this.open(id);
    } catch (error) {
      if (!this.dead) {
        this.error = this.describe(error);
        this.message = '';
      }
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  async queue(action = 'queue') {
    if (!this.sheet || this.busy) return;
    this.busy = true;
    this.error = '';
    const { id, version } = this.sheet;
    try {
      await this.api.request(this.base + '/' + id + '/' + action, 'POST', { version });
      await this.open(id, false);
    } catch (error) {
      this.error = this.describe(error);
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  async deleteSheet() {
    if (!this.sheet || this.busy) return;
    const { id, label, version } = this.sheet;
    if (
      !window.confirm(
        'Permanently delete “' + label + '”, all its scanned pages and marks? This cannot be undone.',
      )
    )
      return;
    this.busy = true;
    this.error = '';
    try {
      await this.api.request(this.base + '/' + id + '/delete', 'POST', { version });
      if (this.dead) return;
      this.dirty = false;
      this.busy = false;
      this.list();
      this.message = 'Sheet deleted.';
    } catch (error) {
      this.handleReviewError(error);
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  markManually() {
    if (this.active && !window.confirm('Stop automatic checking for this sheet and mark it manually?'))
      return;
    void this.queue('manual');
  }
  async finalizeVisible() {
    if (this.busy) return;
    const sheets = this.readySheets.map(({ id, version, label }) => ({ id, version, label }));
    if (!sheets.length) return;
    if (
      !window.confirm(
        'Finalize ' +
          sheets.length +
          ' ready sheets in the current results?\n\n' +
          sheets.map((s) => s.label).join(', '),
      )
    )
      return;
    this.busy = true;
    this.error = '';
    this.message = '';
    const counts = { finalized: 0, alreadyFinal: 0, changed: 0, blocked: 0 };
    let failure = '';
    try {
      for (let i = 0; i < sheets.length; i += 60) {
        const batch = sheets.slice(i, i + 60).map(({ id, version }) => ({ id, version }));
        const result = await this.api.request<typeof counts>(this.base + '/finalize-ready', 'POST', {
          sheets: batch,
        });
        for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] += result[key];
      }
    } catch (error) {
      failure = this.describe(error);
    } finally {
      if (!this.dead) {
        await this.refresh();
        this.message =
          [
            counts.finalized + ' finalized',
            counts.alreadyFinal ? counts.alreadyFinal + ' already final' : '',
            counts.changed ? counts.changed + ' changed since review' : '',
            counts.blocked ? counts.blocked + ' still need attention' : '',
          ]
            .filter(Boolean)
            .join(' · ') + '.';
        if (failure) this.error = failure;
      }
      this.busy = false;
      this.paint();
    }
  }
  private handleReviewError(error: unknown) {
    this.error = this.describe(error);
    this.conflict = (error as { status?: number })?.status === 409;
  }
  reloadConflict() {
    if (!this.sheet || (this.dirty && !window.confirm('Discard unsaved edits and load the latest sheet?')))
      return;
    this.dirty = false;
    this.conflict = false;
    void this.open(this.sheet.id, false);
  }
  selectNumber(number: number) {
    const answer = this.answerByNumber(Number(number));
    if (answer) this.choose(answer);
  }
  choose(answer: Answer, page?: number) {
    this.remarkKey = '';
    this.focusedStep = null;
    this.placingStep = null;
    this.selected = answer.number;
    this.pageNumber = page ?? answer.anchors[0]?.page ?? this.pageNumber;
    this.placing = false;
    this.editingAnswer = false;
    this.groupedNumbers = [];
  }
  switchPane(pane: 'review' | 'scan') {
    this.pane = pane;
    requestAnimationFrame(() => {
      if (this.dead) return;
      const el = this.host.nativeElement.querySelector<HTMLElement>(
        pane === 'review' ? '#review-focus' : '#scan-focus',
      );
      el?.focus({ preventScroll: true });
      if (matchMedia('(max-width: 760px)').matches) el?.scrollIntoView({ block: 'nearest' });
    });
  }
  inspect(answer: Answer, page?: number) {
    if (!this.needsDecision(answer)) this.focusList = 'all';
    this.choose(answer, page);
    this.switchPane('review');
  }
  showEvidence(answer: Answer, page: number) {
    this.choose(answer, page);
    this.switchPane('scan');
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector('.scan-target')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    );
  }
  showStep(answer: Answer, index: number) {
    const anchor = answer.steps?.[index]?.anchor;
    if (!anchor) return;
    this.showEvidence(answer, anchor.page);
    this.focusedStep = index;
    this.remarkKey = answer.number + '/' + index;
  }
  setFocusList(mode: 'issues' | 'all') {
    this.focusList = mode;
    if (mode === 'issues' && this.issues.length && !this.issues.some((a) => a.number === this.selected))
      this.choose(this.issues[0]);
  }
  nextIssue() {
    const issues = this.issues;
    const index = issues.findIndex((a) => a.number === this.selected);
    const next = issues[(index + 1) % issues.length];
    if (next) {
      this.focusList = 'issues';
      this.choose(next);
      this.switchPane('review');
    }
  }
  pageStep(by: number) {
    const pages = this.pageItems,
      index = pages.findIndex((item) => item.index === this.pageNumber);
    if (pages[index + by]) this.setPage(pages[index + by].index);
  }
  setPage(index: number) {
    this.remarkKey = '';
    this.focusedStep = null;
    this.pageNumber = Number(index);
    this.placing = false;
    this.groupedNumbers = [];
    this.resetScroll();
  }
  zoomBy(amount: number) {
    this.zoom = Math.max(0.75, Math.min(4, Math.round((this.zoom + amount) * 100) / 100));
  }
  setFit(fit: 'page' | 'width') {
    this.fit = fit;
    this.zoom = 1;
    this.resetScroll();
  }
  resetScroll() {
    this.host.nativeElement.querySelector('.scan-window')?.scrollTo(0, 0);
  }
  annotations(index: number) {
    return marksOnPage(this.answers, index);
  }
  screenMarks(index: number) {
    return marginGroups(this.annotations(index), this.stageHeight, 43);
  }
  marksOnScan(index: number) {
    return positionedMarks(this.annotations(index), this.scanWidth, this.stageHeight, 47, 20);
  }
  printInk(page: Page) {
    const width = Math.min(153, (244 * page.width) / page.height);
    return positionedMarks(this.annotations(page.index), width, (width * page.height) / page.width, 18, 4);
  }
  printMarks(page: Page) {
    const height = Math.min(244, (153 * page.height) / page.width);
    const marks = this.annotations(page.index);
    const groups = marginGroups(marks, height, marks.some(mark => mark.stepIndex !== null) ? 20 : 13);
    return groups.map((group, index) => {
      // Each centered caption can use its share of the gap to either neighboring mark.
      const space = Math.min(
        2 * group.center,
        2 * (1 - group.center),
        index > 0 ? group.center - groups[index - 1].center : 1,
        index + 1 < groups.length ? groups[index + 1].center - group.center : 1,
      ) * height;
      const lines = Math.max(1, Math.floor((space - 5) / 3.1));
      const mark = group.marks[0];
      return { ...group, caption: this.brief(mark.comment, mark.status, Math.min(260, lines * 21)) };
    });
  }
  openRemark(pin: ScanMark<Answer>) {
    if (this.remarkKey === pin.key) {
      this.remarkKey = '';
      return;
    }
    this.choose(pin.answer, this.pageNumber);
    this.focusedStep = pin.stepIndex;
    this.remarkKey = pin.key;
  }
  brief(remark: string, status: Result, limit = 175) {
    const explanation = remark.trim();
    if (explanation.length <= limit) return explanation;
    const sentences = explanation.split(/(?<=[.!?।])\s+/);
    // When space is tight, keep the concluding marking decision alongside the work.
    if (status !== 'correct' && sentences.length > 1) {
      const decision = sentences[sentences.length - 1];
      const summary = sentences[0] + ' ' + decision;
      if (summary.length <= limit) return summary;
      if (decision.length <= limit) return decision;
    }
    let complete = '';
    for (const sentence of sentences) {
      const next = complete ? complete + ' ' + sentence : sentence;
      if (next.length > limit) {
        if (complete) break;
        continue;
      }
      complete = next;
    }
    if (complete) return complete;
    const text = explanation.slice(0, limit - 1);
    const end = text.lastIndexOf(' ');
    return (end > 0 ? text.slice(0, end) : text).trimEnd() + '…';
  }
  openGroup(marks: ScanMark<Answer>[]) {
    const numbers = [...new Set(marks.map(mark => mark.answer.number))];
    if (numbers.length === 1) this.inspect(marks[0].answer, this.pageNumber);
    else {
      this.groupedNumbers = numbers;
      this.switchPane('review');
    }
  }
  onViewerKey(event: KeyboardEvent) {
    if (
      (event.target as HTMLElement).matches('button,input,select,textarea') ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (this.placing) {
      const d = event.shiftKey ? 0.05 : 0.01;
      if (event.key === 'Escape') this.placing = false;
      else if (event.key === 'Enter' || event.key === ' ') this.placeAt(this.crosshair.x, this.crosshair.y);
      else if (event.key === 'ArrowLeft') this.crosshair.x = Math.max(0, this.crosshair.x - d);
      else if (event.key === 'ArrowRight') this.crosshair.x = Math.min(1, this.crosshair.x + d);
      else if (event.key === 'ArrowUp') this.crosshair.y = Math.max(0, this.crosshair.y - d);
      else if (event.key === 'ArrowDown') this.crosshair.y = Math.min(1, this.crosshair.y + d);
      else return;
    } else if (event.key === 'ArrowLeft') this.pageStep(-1);
    else if (event.key === 'ArrowRight') this.pageStep(1);
    else if (event.key === '+' || event.key === '=') this.zoomBy(0.25);
    else if (event.key === '-') this.zoomBy(-0.25);
    else if (event.key === '0') this.setFit('page');
    else return;
    event.preventDefault();
  }
  beginPlacement(stepIndex: number | null = null, page = this.pageNumber) {
    this.pageNumber = page;
    this.placingStep = stepIndex;
    this.placing = true;
    const anchor = stepIndex === null
      ? this.answer?.anchors.find(a => a.page === page)
      : this.answer?.steps?.[stepIndex]?.anchor;
    this.crosshair = anchor?.page === page ? { x: anchor.x, y: anchor.y } : { x: 0.5, y: 0.5 };
    this.switchPane('scan');
  }
  place(event: MouseEvent) {
    if (!this.placing) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.placeAt((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
  }
  private placeAt(x: number, y: number) {
    if (!this.placing || !this.answer || !this.canEdit) return;
    const point = { page: this.pageNumber, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    const step = this.placingStep === null ? undefined : this.answer.steps?.[this.placingStep];
    if (step) this.moveStep(this.answer, step, point);
    else this.answer.anchors = [...this.answer.anchors.filter(anchor => anchor.page !== this.pageNumber), point];
    this.placing = false;
    this.focusedStep = this.placingStep;
    this.placingStep = null;
    this.markChanged();
    this.switchPane('review');
  }
  detach(answer: Answer, index: number) {
    answer.anchors = answer.anchors.filter((anchor) => anchor.page !== index);
    this.markChanged();
  }
  moveStep(answer: Answer, step: MethodStep, point: MappingPoint | null) {
    const steppedPages = new Set(answer.steps?.map(item => item.anchor?.page));
    const byPage = new Map(answer.anchors.filter(a => !steppedPages.has(a.page)).map(a => [a.page, a]));
    step.anchor = point;
    for (const step of answer.steps ?? []) if (step.anchor && !byPage.has(step.anchor.page))
      byPage.set(step.anchor.page, step.anchor);
    answer.anchors = [...byPage.values()];
    this.markChanged();
  }
  pickStepPage(index: number, select: HTMLSelectElement) {
    const page = Number(select.value);
    select.value = '';
    if (page > 0) this.beginPlacement(index, page);
  }
  stepAwardChanged(answer: Answer, step: MethodStep, value: number | null) {
    if (step.awarded === value) return;
    step.awarded = value;
    step.comment = value === null ? 'Teacher review pending.' : 'Teacher revised this step to ' + value + '/' + step.max + '.';
    this.reassessSteps(answer);
  }
  allocated(steps: MethodStep[]) {
    return steps.reduce((sum, item) => sum + Math.round(100 * (item.max || 0)), 0) / 100;
  }
  reassessSteps(answer: Answer) {
    const steps = answer.steps ?? [];
    const undecided = this.allocated(steps) !== answer.max || steps.some(item =>
      !Number.isFinite(item.max) || item.max <= 0 || item.awarded === null ||
      !Number.isFinite(item.awarded) || item.awarded < 0 || item.awarded > item.max);
    answer.awarded = undecided ? null : steps.reduce((sum, item) => sum + Math.round(100 * item.awarded!), 0) / 100;
    answer.status = scoreStatus(answer.awarded, answer.max);
    answer.explanation = 'Teacher revised the assessment. See the individual method marks.';
    this.markChanged();
  }
  addStep(answer: Answer) {
    const steps = answer.steps ?? [];
    if (steps.length >= 30) return;
    const remaining = Math.round((answer.max - this.allocated(steps)) * 100) / 100;
    answer.steps = [...steps, { criterion: '', max: Math.max(0, remaining), awarded: null, comment: '', anchor: null }];
    this.reassessSteps(answer);
  }
  removeStep(answer: Answer, index: number) {
    const steps = answer.steps;
    if (!steps || steps.length < 2) return;
    this.moveStep(answer, steps[index], null);
    steps.splice(index, 1);
    this.reassessSteps(answer);
  }
  replaceSteps(answer: Answer) {
    if (!window.confirm('Replace these individual method marks with one question score?')) return;
    answer.steps = [];
    answer.explanation = 'Teacher assessed the question as a whole.';
    this.remarkKey = '';
    this.focusedStep = null;
    this.markChanged();
  }
  changeChoice(answer: Answer, value: Answer['choice']) {
    if (answer.choice === value) return;
    if (answer.choice) {
      answer.steps = [];
      answer.status = 'uncertain';
      answer.awarded = null;
      answer.anchors = [];
      answer.evidence = '';
      answer.explanation = 'Review the selected alternative.';
      this.remarkKey = '';
      this.focusedStep = null;
    }
    answer.choice = value;
    this.markChanged();
  }
  setStatus(answer: Answer, status: Result) {
    answer.status = status;
    if (status === 'correct') answer.awarded = answer.max;
    else if (status === 'wrong') answer.awarded = 0;
    else if (status !== 'partial' || !(Number(answer.awarded) > 0 && Number(answer.awarded) < answer.max))
      answer.awarded = null;
    if (status === 'missing') answer.choice = null;
    this.markChanged();
  }
  confirmMissingAnswer(answer: Answer) {
    if (answer.status !== 'missing' || answer.awarded !== null || !this.canEdit) return;
    answer.awarded = 0;
    answer.choice = null;
    answer.evidence = '';
    answer.explanation = 'Teacher confirmed this question was unattempted.';
    this.markChanged();
  }
  confirmListed() {
    if (!this.confirmedPages || !this.canEdit) return;
    const targets = this.missing;
    for (const answer of targets) this.confirmMissingAnswer(answer);
    this.confirmingMissing = false;
    this.confirmedPages = false;
    this.message = targets.length + ' unattempted answers marked zero. Save corrections to keep them.';
    this.selectAfterResolution();
  }
  selectAfterResolution() {
    if (!this.issues.length) this.focusList = 'all';
    else if (this.answer && !this.needsDecision(this.answer)) this.nextIssue();
  }
  async save(final: boolean) {
    if (!this.sheet || this.busy || !this.canEdit || (final && this.pending)) return;
    const { id, version } = this.sheet;
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      const result = await this.api.request<{
        grade: Grade;
        state: State;
        version: number;
        finalizedAt: string;
      }>(this.base + '/' + id + '/review', 'POST', {
        version,
        final,
        answers: this.answers,
        sectionSelections: this.selections,
      });
      if (this.dead || this.sheet?.id !== id) return;
      this.sheet = { ...this.sheet, ...result };
      this.answers = structuredClone(result.grade.answers);
      this.selections = structuredClone(result.grade.sectionSelections || []);
      this.recalculate();
      this.editing = false;
      this.editingAnswer = false;
      this.dirty = false;
      this.confirmingMissing = false;
      this.confirmedPages = false;
      this.selectAfterResolution();
      this.message = final ? 'Marks finalized.' : 'Corrections saved.';
    } catch (error) {
      this.handleReviewError(error);
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  async print() {
    if (!this.imagesReady || this.dirty || this.busy) return;
    this.printing = true;
    this.paint();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      const images = Array.from(
        this.host.nativeElement.querySelectorAll<HTMLImageElement>('.checking-print img'),
      );
      await Promise.all(images.map((photo) => photo.decode()));
      window.print();
    } catch {
      this.error = 'The scanned pages are not ready to print. Refresh the sheet and try again.';
    } finally {
      this.printing = false;
      this.paint();
    }
  }
}
