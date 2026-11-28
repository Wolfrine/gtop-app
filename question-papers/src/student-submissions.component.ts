import { DatePipe } from '@angular/common';
import {
  ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnChanges, OnDestroy,
  OnInit, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OwnerEvents } from './owner-events';
import { AssistantApi } from './api.service';
import { ExternalExamComponent } from './external-exam.component';
import { useEmulators } from './firebase-environment';
import { openResultShare } from '../../assistant-service/domain/result-share.mjs';
import { saveArtifact } from '../../assistant-service/domain/artifact-filenames.mjs';

const base = '/staff/student-submissions';
const batchLimit = 30;
const gtopOrigin = 'https://gtop.growthtutorials.in';

export function studentSubmissionLink(kind: 'test' | 'invite', code: string) {
  const origin = useEmulators ? 'http://localhost:4200' : gtopOrigin;
  const url = new URL('/answer-sheets', origin);
  if (kind === 'invite') {
    url.hash = new URLSearchParams({ invite: code }).toString();
    url.searchParams.set('ngsw-bypass', '1');
  } else url.searchParams.set('test', code);
  return url.href;
}

type ScanKind = 'answer' | 'question';
type Status = 'submitted' | 'needs_rescan' | 'checking' | 'released';
type MarkingState = 'completed' | 'queued' | 'running' | 'failed' | 'review' | 'final';
type Outcome = 'complete' | 'partial' | 'unassessable';
interface Score {
  outcome: Outcome | null;
  awarded: number | null;
  max: number | null;
  assessedAwarded: number | null;
  assessedMax: number | null;
  pending: number | null;
}
interface QuestionMark {
  number: number;
  status: string;
  awarded: number | null;
  max: number | null;
  counted: boolean | null;
  choice: 'A' | 'B' | null;
  explanation: string;
}
const findingLabels = {
  correct: 'Correct', partial: 'Partial', wrong: 'Wrong', unattempted: 'Unattempted', uncertain: 'Uncertain',
} as const;
type Finding = keyof typeof findingLabels;
type PdfPreview = Awaited<ReturnType<typeof import('./checking-intake')['openReportPreview']>>;
type ReferenceState = 'uploading' | 'queued' | 'running' | 'review' | 'ready' | 'failed';
interface FileSummary { name: string; pageCount: number }
interface Submission {
  id: string;
  automatic?: boolean;
  teacherUpload?: boolean;
  ownerWorkspace?: boolean;
  paperScope?: string;
  scanScope?: string;
  examIdentity?: {examId: string; paperRevisionId: string; examCode?: string | null; sourceMaximum?: number | null};
  approvalScope?: string;
  outcome?: Outcome | null;
  score?: Score;
  questionMarks?: QuestionMark[];
  message?: string | null;
  version: number;
  title: string;
  subject?: string;
  paperTitle?: string;
  error?: string;
  studentLabel: string;
  studentUid: string;
  status: Status;
  submittedAt?: string;
  updatedAt: string;
  revision: number;
  paperId?: string;
  testCode?: string;
  paperReady?: boolean;
  questionFingerprint?: string;
  referenceId?: string;
  referenceState?: ReferenceState;
  sheetId?: string;
  markingState?: MarkingState;
  sheetState?: MarkingState;
  updatedCopyReady?: boolean;
  answer: FileSummary;
  question?: FileSummary | null;
  rescan?: { kind: ScanKind; page?: number | null; reason: string } | null;
}
interface SubmissionPage { submissions: Submission[]; nextCursor: string | null; enabled: boolean }
interface ApprovalSet { key: string; rows: Submission[]; paperId?: string; approvalScope?: string; batch: Submission[] }
interface SubmissionGroup { key: string; title: string; examCode?: string; count: number; sets: ApprovalSet[] }
interface Invitation { id: string; expiresAt: string; uses: number; used: number; revokedAt?: string }
interface SavedReference { id: string; title: string; state: string; referenceRevision: number; marks: number | null }
type Filter = 'all' | Status;

const filterLabels: Record<Filter, string> = {
  all: 'All submissions', submitted: 'For approval', checking: 'Checking', needs_rescan: 'Rescan requested', released: 'Released',
};

@Component({
  selector: 'gtop-student-submissions',
  standalone: true,
  imports: [DatePipe, FormsModule, ExternalExamComponent],
  templateUrl: './student-submissions.html',
  styleUrl: './student-submissions.css',
})
export class StudentSubmissionsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedId = '';
  @Input({ required: true }) onSelect!: (id: string) => void;
  @Input({ required: true }) onOpenSheet!: (submissionId: string, paperId: string, sheetId: string) => void;
  @ViewChild('reviewHeading') private reviewHeading?: ElementRef<HTMLElement>;

  private readonly api = inject(AssistantApi);
  private readonly change = inject(ChangeDetectorRef);
  private closed = false;
  private listSequence = 0;
  private detailSequence = 0;
  private requestedId = '';
  private scanSequence = 0;
  private scanDownload?: File;
  private reportSequence = 0;
  private pdf?: PdfPreview;
  private reportBytes?: File;
  private closeShare?: () => void;
  private refreshPending = false;
  private inboxEvents?: OwnerEvents;
  private inboxStartup?: ReturnType<typeof setTimeout>;
  private selectedApprovals = new Map<string, number>();
  readonly filters = Object.keys(filterLabels) as Filter[];
  readonly findings = Object.keys(findingLabels) as Finding[];
  readonly findingLabels = findingLabels;
  readonly filterLabels = filterLabels;
  readonly fileKinds: { value: ScanKind; label: string }[] = [
    { value: 'answer', label: 'Answer sheet' }, { value: 'question', label: 'Question paper' },
  ];
  filter: Filter = 'all';
  rows: Submission[] = [];
  selected?: Submission;
  listBusy = false;
  loadingInbox = true;
  refreshBusy = false;
  detailBusy = false;
  mutationBusy = false;
  mutationProgress = '';
  listError = '';
  actionError = '';
  notice = '';
  cursor: string | null = null;
  enabled = true;
  scansOpen = false;
  reportOpen = false;
  reportBusy = false;
  reportDownloadBusy = false;
  reportError = '';
  reportPage = 1;
  reportPages = 0;
  reportUrl = '';
  scanKind: ScanKind = 'answer';
  scanPage = 1;
  scanUrl = '';
  scanBusy = false;
  scanError = '';
  referenceEditor = '';
  showRescan = false;
  showReferences = false;
  referenceBusy = false;
  referenceError = '';
  referenceQuery = '';
  referenceCursor: string | null = null;
  references: SavedReference[] = [];
  chosenReference?: SavedReference;
  rescanKind: ScanKind = 'answer';
  rescanPage: number | null = null;
  rescanReason = '';
  showInvitations = false;
  invitations: Invitation[] = [];
  invitationUses = 10;
  invitationLink = '';
  invitationError = '';
  invitationBusy = false;

  ngOnInit() { this.startInboxEvents(); }
  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedId'] && this.selectedId !== this.requestedId) {
      if (this.selectedId) void this.loadDetail(this.selectedId);
      else this.clearSelection();
    }
  }
  ngOnDestroy() {
    this.closed = true;
    this.stopInboxEvents();
    this.closePreviews();
  }
  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (document.hidden) this.stopInboxEvents();
    else this.startInboxEvents();
  }

  private startInboxEvents() {
    if (this.closed || document.hidden || this.inboxEvents) return;
    const read = () => {
      clearTimeout(this.inboxStartup);
      if (!this.closed && !document.hidden) void this.refresh(false);
    };
    const marker = 'assistantInboxNotifications/submissions';
    this.inboxEvents = new OwnerEvents(this.api.watchMarker.bind(this.api),
      {schemaVersion: 1, contentPath: marker, presencePath: null, freshnessMs: 90000},
      {
        content: (_revision, signal) => {
          performance.mark('gt-papers:submissions:' + signal);
          read();
        },
        presence: () => {},
        state: () => {},
        denied: () => {
          this.showRescan = false;
          this.referenceEditor = '';
          read();
        },
      });
    // While the stream is offline, the initial gateway read still reports its own result.
    // A later server snapshot reconciles any change since that read.
    this.inboxStartup = setTimeout(read, 1500);
    this.inboxEvents.start();
  }

  private stopInboxEvents() {
    clearTimeout(this.inboxStartup);
    this.inboxEvents?.stop();
    this.inboxEvents = undefined;
  }
  private paint() { if (!this.closed) this.change.markForCheck(); }
  private message(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
  }
  private trailRefresh() {
    if (!this.refreshPending || this.closed || document.hidden || this.listBusy || this.detailBusy || this.refreshBusy || this.mutationBusy ||
        this.showRescan || this.referenceEditor) return;
    this.refreshPending = false;
    queueMicrotask(() => void this.refresh(false));
  }
  private endpoint(id: string, action = '') { return base + '/' + encodeURIComponent(id) + action; }
  markState(row: Submission) { return row.sheetState ?? row.markingState; }
  status(row: Submission) {
    if (row.status === 'submitted') {
      if (this.canApprove(row)) return 'Ready for approval';
      if (row.referenceState === 'failed') return 'Question paper needs attention';
      if (row.referenceState === 'running' || row.referenceState === 'queued') return 'Preparing question paper';
      if (row.referenceId) return 'Confirm question paper';
      return 'Question paper to prepare';
    }
    if (row.status === 'checking') {
      if (row.automatic && !row.sheetId) return 'Preparing question paper';
      switch (this.markState(row)) {
        case 'final': return 'Ready to release';
        case 'review': return 'Ready for review';
        case 'running': return 'Marking';
        case 'failed': return 'Checking needs attention';
        default: return 'Queued for checking';
      }
    }
    return row.status === 'needs_rescan' ? 'Rescan requested' : 'Result sent';
  }
  canApprove(row: Submission) {
    return row.status === 'submitted' && (row.paperReady === true || !!row.question?.pageCount);
  }
  assessment(row: Submission) { return row.score?.outcome ?? row.outcome; }
  assessmentLabel(row: Submission) {
    switch (this.assessment(row)) {
      case 'complete': return 'Complete';
      case 'partial': return 'Partial';
      case 'unassessable': return 'Unassessable';
      default: return 'Assessment unavailable';
    }
  }
  displayedMarks(row: Submission) {
    const score = row.score;
    if (!score) return;
    switch (this.assessment(row)) {
      case 'complete':
        if (score.awarded != null && score.max != null) return {awarded: score.awarded, max: score.max};
        break;
      case 'partial':
        if (score.assessedAwarded != null && score.assessedMax != null)
          return {awarded: score.assessedAwarded, max: score.assessedMax};
    }
  }
  finding(mark: QuestionMark): Finding {
    if (mark.awarded == null) return 'uncertain';
    switch (mark.status) {
      case 'correct': case 'partial': case 'wrong': return mark.status;
      case 'missing': case 'unattempted': return 'unattempted';
      default: return 'uncertain';
    }
  }
  get findingCounts() {
    const counts = this.findings.map(finding => ({finding, offered: 0, counted: 0}));
    for (const mark of this.selected?.questionMarks ?? []) {
      const count = counts[this.findings.indexOf(this.finding(mark))];
      count.offered++;
      if (mark.counted === true) count.counted++;
    }
    return counts;
  }
  get showChoiceCounts() {
    const row = this.selected;
    return !!row?.questionMarks?.some(mark => mark.counted === false || (mark.counted === null && row.automatic));
  }
  get scanFile() { return this.scanKind === 'answer' ? this.selected?.answer : this.selected?.question; }
  get fileCount() { return this.scanFile?.pageCount || 0; }
  get visibleReferences() {
    const query = this.referenceQuery.trim().toLocaleLowerCase();
    return this.references.filter(item => item.title.toLocaleLowerCase().includes(query));
  }
  selectedForApproval(row: Submission) { return this.selectedApprovals.get(row.id) === row.version; }
  groupSelected(set: ApprovalSet) { return set.batch.filter(row => this.selectedForApproval(row)); }
  canSelectRow(set: ApprovalSet, row: Submission) {
    return set.batch.length > 1 && set.batch.some(item => item.id === row.id);
  }
  selectionChange(row: Submission, checked: boolean) {
    if (checked) this.selectedApprovals.set(row.id, row.version);
    else this.selectedApprovals.delete(row.id);
  }
  selectGroup(set: ApprovalSet, checked: boolean) {
    for (const row of set.batch) this.selectionChange(row, checked);
  }
  get rescanFileCount() { return (this.rescanKind === 'answer' ? this.selected?.answer : this.selected?.question)?.pageCount || 0; }
  get groups() {
    const exams = new Map<string, SubmissionGroup>();
    const linkedSets = new Map<string, ApprovalSet>();
    for (const row of this.rows) {
      const paperKey = row.paperScope || (row.paperId?.startsWith('ext-') ? null : row.paperId);
      const key = row.examIdentity?.examId ? 'exam:' + row.examIdentity.examId
        : row.scanScope ? 'scan:' + row.scanScope : paperKey ? 'paper:' + paperKey : 'submission:' + row.id;
      let exam = exams.get(key);
      if (!exam) {
        exam = {key, title: row.paperTitle || row.title, count: 0, sets: []};
        exams.set(key, exam);
      }
      if (row.examIdentity?.examCode) exam.examCode ||= row.examIdentity.examCode;
      exam.count++;
      // Display lineage can contain more than one exact approval scope.
      const eligible = row.status === 'submitted' && row.paperReady === true && row.paperId && row.approvalScope;
      const setKey = key + '/' + (eligible ? row.approvalScope : 'other');
      let set = linkedSets.get(setKey);
      if (!set) {
        set = {key: setKey, rows: [], paperId: eligible ? row.paperId : undefined,
          approvalScope: eligible ? row.approvalScope : undefined, batch: []};
        linkedSets.set(setKey, set);
        exam.sets.push(set);
      }
      set.rows.push(row);
      if (eligible && set.batch.length < batchLimit) set.batch.push(row);
    }
    return [...exams.values()];
  }
  trackFilter(filter: Filter) {
    if (filter === this.filter || this.mutationBusy) return;
    this.choose('');
    this.switchFeed(filter);
  }
  private switchFeed(filter: Filter) {
    this.filter = filter;
    clearTimeout(this.inboxStartup);
    this.listSequence++;
    this.listBusy = false;
    this.selectedApprovals.clear();
    this.rows = [];
    this.cursor = null;
    void this.loadList();
  }
  choose(id: string) {
    if (this.mutationBusy || id === this.selectedId) return;
    this.actionError = '';
    this.notice = '';
    this.showRescan = false;
    this.closeReferencePicker();
    this.referenceEditor = '';
    const previous = this.selectedId;
    this.selectedId = id;
    this.onSelect(id);
    if (id) void this.loadDetail(id, true);
    else {
      this.clearSelection();
      if (previous) requestAnimationFrame(() => {
        if (!this.closed && !this.selectedId) document.getElementById('submission-row-' + previous)?.focus();
      });
      this.trailRefresh();
    }
  }
  private clearSelection() {
    this.detailSequence++;
    this.requestedId = '';
    this.selected = undefined;
    this.detailBusy = false;
    this.closePreviews();
  }
  private resetAccess(error: unknown) {
    if (![401, 403].includes((error as {status?: number})?.status ?? 0)) return false;
    this.listSequence++;
    this.listBusy = false;
    this.loadingInbox = false;
    this.refreshPending = false;
    this.rows = [];
    this.cursor = null;
    this.showRescan = false;
    this.referenceEditor = '';
    this.closeReferencePicker();
    this.references = [];
    this.showInvitations = false;
    this.invitations = [];
    this.invitationLink = '';
    this.selectedApprovals.clear();
    this.selectedId = '';
    this.onSelect('');
    this.clearSelection();
    this.stopInboxEvents();
    this.paint();
    return true;
  }
  private updateRow(row: Submission) {
    const {questionMarks, ...summary} = row;
    this.rows = this.rows.map(item => item.id === row.id && row.version >= item.version ? summary : item);
    if (this.filter !== 'all') this.rows = this.rows.filter(item => item.status === this.filter);
  }
  private async loadDetail(id: string, focus = false) {
    this.requestedId = id;
    const seq = ++this.detailSequence;
    const previous = this.selected;
    if (id !== previous?.id) {
      this.selected = undefined;
      this.closePreviews();
      this.scanKind = 'answer';
      this.scanPage = 1;
      this.detailBusy = true;
    }
    try {
      const { submission } = await this.api.request<{ submission: Submission }>(this.endpoint(id));
      if (this.closed || seq !== this.detailSequence) return;
      const listed = this.rows.find(row => row.id === id);
      const current = listed && listed.version > submission.version ? listed : submission;
      if (previous?.version !== current.version) this.clearReport();
      if (previous?.revision !== current.revision) this.closeScans();
      this.selected = current;
      this.updateRow(current);
      if (focus) requestAnimationFrame(() => {
        if (!this.closed && seq === this.detailSequence) this.reviewHeading?.nativeElement.focus();
      });
    } catch (error) {
      if (seq === this.detailSequence) {
        this.actionError = this.message(error, 'Could not open this submission.');
        if (!this.resetAccess(error) && (error as {status?: number})?.status === 404) {
          this.rows = this.rows.filter(row => row.id !== id);
          this.selectedApprovals.delete(id);
          this.selectedId = '';
          this.onSelect('');
          this.clearSelection();
        }
        this.paint();
      }
    } finally {
      if (seq === this.detailSequence) {
        this.detailBusy = false;
        this.paint();
        this.trailRefresh();
      }
    }
  }
  async loadList(older = false) {
    if (this.closed || this.listBusy || (older && (!this.cursor || this.refreshBusy))) return;
    const seq = ++this.listSequence;
    const previous = this.cursor;
    this.listBusy = true;
    this.listError = '';
    try {
      const params = new URLSearchParams();
      if (this.filter !== 'all') params.set('status', this.filter);
      if (older && previous) params.set('cursor', previous);
      const query = params.toString();
      const page = await this.api.request<SubmissionPage>(query ? base + '?' + query : base);
      if (this.closed || seq !== this.listSequence) return;
      if (!page || typeof page.enabled !== 'boolean' || !Array.isArray(page.submissions) ||
          (page.nextCursor !== null && typeof page.nextCursor !== 'string')) {
        throw Error('The submissions list could not be read. Try again.');
      }
      if (older && page.nextCursor && page.nextCursor === previous) throw Error('Could not load older submissions.');
      this.enabled = page.enabled;
      const current = new Map(this.rows.map(row => [row.id, row]));
      const next = older ? new Map(current) : new Map<string, Submission>();
      for (const row of page.submissions) {
        const listed = current.get(row.id);
        next.set(row.id, listed && listed.version > row.version ? listed : row);
      }
      this.rows = [...next.values()].filter(row => this.filter === 'all' || row.status === this.filter);
      this.cursor = page.nextCursor;
    } catch (error) {
      if (seq === this.listSequence) {
        this.listError = this.message(error, 'Could not load submissions.');
        this.resetAccess(error);
      }
    } finally {
      if (seq === this.listSequence) {
        this.listBusy = false;
        this.loadingInbox = false;
        this.paint();
        this.trailRefresh();
      }
    }
  }
  async refresh(showError = true) {
    if (this.closed || (!showError && document.hidden)) return;
    if (this.listBusy || this.refreshBusy || this.mutationBusy ||
        (!showError && (this.detailBusy || this.showRescan || this.referenceEditor))) {
      this.refreshPending = true;
      return;
    }
    this.refreshPending = false;
    this.refreshBusy = true;
    const id = this.selectedId;
    const detail = this.detailSequence;
    if (showError) this.actionError = '';
    try {
      await this.loadList();
      if (!this.closed && !document.hidden && id && this.selectedId === id && this.detailSequence === detail &&
          !this.detailBusy && !this.showRescan && !this.referenceEditor) {
        await this.loadDetail(id);
      }
    } finally {
      this.refreshBusy = false;
      this.paint();
      this.trailRefresh();
    }
  }
  private closePreviews() {
    this.closeScans();
    this.clearReport();
  }
  private closeScans() {
    this.scansOpen = false;
    this.clearScan();
  }
  toggleScans() {
    if (this.scansOpen) this.closeScans();
    else void this.loadScan('answer');
  }
  private clearScan() {
    this.scanSequence++;
    if (this.scanUrl) URL.revokeObjectURL(this.scanUrl);
    this.scanUrl = '';
    this.scanDownload = undefined;
    this.scanBusy = false;
    this.scanError = '';
  }
  async loadScan(kind: ScanKind, index = 1) {
    const row = this.selected;
    const file = kind === 'answer' ? row?.answer : row?.question;
    if (!row || !file || !file.pageCount) return;
    this.clearScan();
    this.scansOpen = true;
    const seq = this.scanSequence;
    this.scanKind = kind;
    this.scanPage = Math.min(Math.max(index, 1), file.pageCount);
    this.scanBusy = true;
    try {
      const blob = await this.api.checkingImage(this.endpoint(row.id, '/pages/' + kind + '/' + this.scanPage));
      if (this.closed || seq !== this.scanSequence || this.selected?.id !== row.id) return;
      this.scanDownload = blob;
      this.scanUrl = URL.createObjectURL(blob);
    } catch (error) {
      if (seq === this.scanSequence) {
        if (this.resetAccess(error)) this.actionError = this.message(error, 'Could not open this page.');
        else this.scanError = this.message(error, 'Could not open this page.');
        this.paint();
      }
    } finally {
      if (seq === this.scanSequence) { this.scanBusy = false; this.paint(); }
    }
  }
  downloadScanPage() {
    if (this.scanDownload && !this.closed) saveArtifact(this.scanDownload,this.scanDownload.name);
  }
  startRescan() {
    this.closeReferencePicker();
    this.showRescan = true;
    this.rescanKind = this.scansOpen ? this.scanKind : 'answer';
    this.rescanPage = this.scansOpen ? this.scanPage : null;
    this.rescanReason = '';
    this.actionError = '';
  }
  stopRescan() { this.showRescan = false; this.trailRefresh(); }
  async requestRescan(row: Submission) {
    const reason = this.rescanReason.trim();
    if (!reason) return;
    await this.mutate(async () => {
      const { submission } = await this.api.request<{ submission: Submission }>(
        this.endpoint(row.id, '/rescan'), 'POST',
        { version: row.version, kind: this.rescanKind, ...(this.rescanPage ? { page: this.rescanPage } : {}), reason },
      );
      this.showRescan = false;
      if (!this.closed) this.selected = submission;
      this.notice = 'Rescan requested. GTOP shows the student your note.';
    });
  }
  async prepare(row: Submission) {
    await this.mutate(async () => {
      const { referenceId } = await this.api.request<{ referenceId: string }>(
        this.endpoint(row.id, '/prepare-reference'), 'POST', { version: row.version },
      );
      if (this.closed) return;
      this.referenceEditor = referenceId;
      this.notice = 'Question paper saved for review.';
    });
  }
  async closeReference() {
    this.referenceEditor = '';
    await this.refresh();
  }
  async openReferencePicker() {
    this.showReferences = true;
    this.showRescan = false;
    this.chosenReference = undefined;
    await Promise.all([this.loadReferences(), this.scansOpen && this.scanKind === 'question' ? Promise.resolve() : this.loadScan('question')]);
  }
  closeReferencePicker() {
    this.showReferences = false;
    this.chosenReference = undefined;
    this.referenceQuery = '';
  }
  async loadReferences(older = false) {
    if (this.referenceBusy || (older && !this.referenceCursor)) return;
    const cursor = this.referenceCursor;
    this.referenceBusy = true;
    this.referenceError = '';
    try {
      const base = '/checking/references';
      const page = older
        ? await this.api.request<{references: SavedReference[]; nextCursor: string | null}>(base + '/history', 'POST', {cursor})
        : await this.api.request<{references: SavedReference[]; nextCursor: string | null}>(base);
      if (this.closed) return;
      const ready = page.references.filter(item => item.state === 'ready');
      this.references = older
        ? [...new Map([...this.references, ...ready].map(item => [item.id, item])).values()] : ready;
      this.referenceCursor = page.nextCursor;
    } catch (error) { this.referenceError = this.message(error, 'Could not load approved question papers.'); }
    finally { this.referenceBusy = false; this.paint(); }
  }
  async approve(row: Submission, selectedPaper?: SavedReference) {
    await this.mutate(async () => {
      await this.api.request(this.endpoint(row.id, '/approve'), 'POST', {
        version: row.version, ...(row.question ? { confirmReference: true } : {}),
        ...(selectedPaper ? { paperId: selectedPaper.id } : {}),
      });
      this.closeReferencePicker();
      this.notice = 'Approved and sent for checking.';
    });
  }
  async approveBatch(group: ApprovalSet) {
    const selected = this.groupSelected(group);
    if (!group.paperId || !group.approvalScope || !selected.length) return;
    await this.mutate(async () => {
      const { results } = await this.api.request<{ results: { id: string; ok: boolean; message?: string }[] }>(
        base + '/approve-batch', 'POST', {
          paperId: group.paperId, approvalScope: group.approvalScope,
          submissions: selected.map(row => ({ id: row.id, version: row.version })),
        },
      );
      for (const result of results) this.selectedApprovals.delete(result.id);
      const approved = results.filter(result => result.ok).length;
      const blocked = results.length - approved;
      if (approved) this.notice = approved + (approved === 1 ? ' submission sent' : ' submissions sent') + ' for checking.';
      if (blocked) this.actionError = blocked + (blocked === 1 ? ' submission needs attention. ' : ' submissions need attention. ') +
        (results.find(result => !result.ok)?.message ?? 'Open a submission to review it.');
    });
  }
  private clearReport() {
    this.closeShare?.();
    this.closeShare = undefined;
    this.reportSequence++;
    if (this.reportUrl) URL.revokeObjectURL(this.reportUrl);
    if (this.pdf) void this.pdf.close().catch(() => {});
    this.pdf = undefined;
    this.reportBytes = undefined;
    this.reportOpen = this.reportBusy = this.reportDownloadBusy = false;
    this.reportUrl = this.reportError = '';
    this.reportPage = 1;
    this.reportPages = 0;
  }
  private currentReport(row: Submission, sequence: number) {
    return !this.closed && sequence === this.reportSequence &&
      this.selected?.id === row.id && this.selected.version === row.version;
  }
  toggleReport() {
    if (this.reportOpen) this.clearReport();
    else {
      this.reportOpen = true;
      void this.loadReportPage(1);
    }
  }
  async loadReportPage(index: number) {
    const row = this.selected;
    if (!row || !this.reportOpen || this.reportBusy || row.status !== 'released') return;
    const sequence = ++this.reportSequence;
    this.reportBusy = true;
    this.reportError = '';
    try {
      if (!this.pdf) {
        const blob = this.reportBytes ?? await this.api.reportBlob(this.endpoint(row.id, '/report'));
        if (!this.currentReport(row, sequence)) return;
        this.reportBytes = blob;
        const {openReportPreview} = await import('./checking-intake');
        if (!this.currentReport(row, sequence)) return;
        const preview = await openReportPreview(blob);
        if (!this.currentReport(row, sequence)) { await preview.close(); return; }
        this.pdf = preview;
        this.reportPages = preview.pageCount;
      }
      const page = await this.pdf.page(index);
      if (!this.currentReport(row, sequence)) { URL.revokeObjectURL(page.url); return; }
      if (this.reportUrl) URL.revokeObjectURL(this.reportUrl);
      this.reportUrl = page.url;
      this.reportPage = index;
    } catch (error) {
      if (this.currentReport(row, sequence)) {
        const message = this.message(error, 'Could not preview the checking report.');
        if (this.resetAccess(error)) this.actionError = message;
        else this.reportError = message;
      }
    } finally {
      if (this.currentReport(row, sequence)) { this.reportBusy = false; this.paint(); }
    }
  }
  async downloadReport(row: Submission) {
    if (this.reportBusy || this.reportDownloadBusy) return;
    this.reportDownloadBusy = true;
    this.actionError = '';
    const sequence = this.reportSequence;
    try {
      const blob = this.reportBytes ?? await this.api.reportBlob(this.endpoint(row.id, '/report'));
      if (!this.currentReport(row, sequence)) return;
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = blob.name;
        link.click();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (error) {
      if (this.currentReport(row, sequence)) {
        this.resetAccess(error);
        this.actionError = this.message(error, 'Could not download the checking report.');
      }
    } finally {
      if (this.currentReport(row, sequence)) {
        this.reportDownloadBusy = false;
        this.paint();
      }
    }
  }
  shareResult(row: Submission) {
    if (row.status !== 'released') return;
    this.closeShare?.();
    this.closeShare = openResultShare({
      metadata: signal => this.api.assessment(this.endpoint(row.id,'/result'),signal),
      report: (revision,signal) => this.api.reportBlob(this.endpoint(row.id,'/report') +
        '?revision=' + encodeURIComponent(revision),signal),
      loadPdf: () => import('pdf-lib'),
    });
  }
  openSheet(row: Submission) {
    if (row.ownerWorkspace && row.paperId && row.sheetId) this.onOpenSheet(row.id, row.paperId, row.sheetId);
  }
  async release(row: Submission) {
    if (!row.paperId || !row.sheetId || this.markState(row) !== 'final') return;
    await this.mutate(async () => {
      const { publishStudentCopy } = await import('./student-submission-handback');
      await publishStudentCopy(this.api, row.id, row.version, message => {
        this.mutationProgress = message;
        this.paint();
      });
      this.notice = 'The marked copy is available in the student’s GTOP account.';
    });
  }
  private async mutate(run: () => Promise<void>) {
    if (this.mutationBusy) return;
    this.mutationBusy = true;
    this.actionError = '';
    this.notice = '';
    try { await run(); }
    catch (error) { this.resetAccess(error); this.actionError = this.message(error, 'Could not save the change. Try again.'); }
    finally {
      this.mutationBusy = false;
      this.mutationProgress = '';
      this.paint();
      if (!this.closed) await this.refresh(false);
    }
  }
  async toggleInvitations() {
    this.showInvitations = !this.showInvitations;
    if (this.showInvitations) await this.loadInvitations();
  }
  async loadInvitations() {
    try {
      const { invites } = await this.api.request<{ invites: Invitation[] }>(base + '/invites');
      if (!this.closed) this.invitations = invites;
    } catch (error) { this.invitationError = this.message(error, 'Could not load invitation links.'); }
    finally { this.paint(); }
  }
  async createInvitation() {
    if (this.invitationBusy || !Number.isInteger(this.invitationUses) || this.invitationUses < 1 || this.invitationUses > 30) return;
    this.invitationBusy = true;
    this.invitationError = '';
    this.invitationLink = '';
    try {
      const result = await this.api.request<{ code: string }>(base + '/invites', 'POST', { uses: this.invitationUses });
      this.invitationLink = studentSubmissionLink('invite', result.code);
      await this.loadInvitations();
    } catch (error) { this.invitationError = this.message(error, 'Could not create an invitation link.'); }
    finally { this.invitationBusy = false; this.paint(); }
  }
  inviteActive(invite: Invitation) {
    return !invite.revokedAt && Date.parse(invite.expiresAt) > Date.now() && (invite.used || 0) < invite.uses;
  }
  async revokeInvitation(invite: Invitation) {
    if (this.invitationBusy || !this.inviteActive(invite)) return;
    this.invitationBusy = true;
    this.invitationError = '';
    try {
      await this.api.request(base + '/invites/' + encodeURIComponent(invite.id) + '/revoke', 'POST', {});
      this.invitationLink = '';
      await this.loadInvitations();
    } catch (error) { this.invitationError = this.message(error, 'Could not close the invitation.'); }
    finally { this.invitationBusy = false; this.paint(); }
  }
  async copyInvite(input: HTMLInputElement) {
    try { await navigator.clipboard.writeText(input.value); this.invitationError = ''; this.notice = 'Invitation link copied.'; }
    catch { input.select(); this.invitationError = 'Select and copy the invitation link.'; }
    finally { this.paint(); }
  }
}
