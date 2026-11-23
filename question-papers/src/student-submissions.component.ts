import { DatePipe } from '@angular/common';
import {
  ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnChanges, OnDestroy,
  OnInit, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssistantApi } from './api.service';
import { ExternalExamComponent } from './external-exam.component';

const base = '/staff/student-submissions';
const batchLimit = 30;
const gtopOrigin = 'https://gtop.growthtutorials.in';

export function studentSubmissionLink(kind: 'test' | 'invite', code: string) {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const origin = local && new URL(location.href).searchParams.has('emulator')
    ? 'http://localhost:4200' : gtopOrigin;
  const url = new URL('/answer-sheets', origin);
  if (kind === 'invite') {
    url.hash = new URLSearchParams({ invite: code }).toString();
    url.searchParams.set('ngsw-bypass', '1');
  } else url.searchParams.set('test', code);
  if (origin !== gtopOrigin) url.searchParams.set('emulator', '');
  return url.href;
}

type ScanKind = 'answer' | 'question';
type Status = 'submitted' | 'needs_rescan' | 'checking' | 'released';
type MarkingState = 'queued' | 'running' | 'failed' | 'review' | 'final';
type ReferenceState = 'uploading' | 'queued' | 'running' | 'review' | 'ready' | 'failed';
interface FileSummary { name: string; pageCount: number }
interface Submission {
  id: string;
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
interface SubmissionGroup { key: string; title: string; rows: Submission[]; paperId?: string; batch?: Submission[] }
interface Invitation { id: string; expiresAt: string; uses: number; used: number; revokedAt?: string }
interface SavedReference { id: string; title: string; state: string; referenceRevision: number; marks: number | null }
type Filter = Status;

const filterLabels: Record<Filter, string> = {
  submitted: 'For approval', checking: 'Checking', needs_rescan: 'Rescan requested', released: 'Released',
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
  private refreshPending = false;
  private selectedApprovals = new Map<string, number>();
  readonly filters = Object.keys(filterLabels) as Filter[];
  readonly filterLabels = filterLabels;
  readonly fileKinds: { value: ScanKind; label: string }[] = [
    { value: 'answer', label: 'Answer sheet' }, { value: 'question', label: 'Question paper' },
  ];
  filter: Filter = 'submitted';
  rows: Submission[] = [];
  selected?: Submission;
  listBusy = false;
  detailBusy = false;
  mutationBusy = false;
  mutationProgress = '';
  listError = '';
  actionError = '';
  notice = '';
  cursor: string | null = null;
  enabled = true;
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

  ngOnInit() { void this.loadList(); }
  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedId'] && this.selectedId !== this.requestedId) {
      if (this.selectedId) void this.loadDetail(this.selectedId);
      else this.clearSelection();
    }
  }
  ngOnDestroy() {
    this.closed = true;
    this.clearScan();
  }
  @HostListener('window:gtop-paper-content-updated')
  onWorkspaceUpdate() {
    if (this.mutationBusy || this.listBusy || this.showRescan || this.referenceEditor) {
      this.refreshPending = true;
      return;
    }
    void this.refresh(false);
  }
  private paint() { if (!this.closed) this.change.markForCheck(); }
  private message(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
  }
  private trailRefresh() {
    if (!this.refreshPending || this.closed || this.listBusy || this.mutationBusy || this.showRescan || this.referenceEditor) return;
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
      switch (this.markState(row)) {
        case 'final': return 'Ready to release';
        case 'review': return 'Review marks';
        case 'running': return 'Marking';
        case 'failed': return 'Checking needs attention';
        default: return 'Queued for checking';
      }
    }
    return row.status === 'needs_rescan' ? 'Rescan requested' : row.updatedCopyReady ? 'Updated copy ready' : 'Released';
  }
  canApprove(row: Submission) {
    return row.status === 'submitted' && row.paperReady === true;
  }
  get scanFile() { return this.scanKind === 'answer' ? this.selected?.answer : this.selected?.question; }
  get fileCount() { return this.scanFile?.pageCount || 0; }
  get visibleReferences() {
    const query = this.referenceQuery.trim().toLocaleLowerCase();
    return this.references.filter(item => item.title.toLocaleLowerCase().includes(query));
  }
  selectedForApproval(row: Submission) { return this.selectedApprovals.get(row.id) === row.version; }
  groupSelected(group: SubmissionGroup) { return (group.batch ?? []).filter(row => this.selectedForApproval(row)); }
  canSelectRow(group: SubmissionGroup, row: Submission) {
    return (group.batch?.length ?? 0) > 1 && group.batch?.some(item => item.id === row.id);
  }
  selectionChange(row: Submission, checked: boolean) {
    if (checked) this.selectedApprovals.set(row.id, row.version);
    else this.selectedApprovals.delete(row.id);
  }
  selectGroup(group: SubmissionGroup, checked: boolean) {
    for (const row of group.batch ?? []) this.selectionChange(row, checked);
  }
  get rescanFileCount() { return (this.rescanKind === 'answer' ? this.selected?.answer : this.selected?.question)?.pageCount || 0; }
  get groups() {
    const byPaper = new Map<string, SubmissionGroup>();
    for (const row of this.rows) {
      if (row.status !== this.filter) continue;
      const paperId = row.paperId || (row.paperReady ? row.referenceId : undefined);
      const key = paperId || row.questionFingerprint || row.id;
      let group = byPaper.get(key);
      if (!group) {
        group = { key, title: row.paperTitle || row.title, rows: [], paperId };
        byPaper.set(key, group);
      }
      group.rows.push(row);
    }
    return [...byPaper.values()].map(group => ({
      ...group,
      batch: group.paperId ? group.rows.filter(row => this.canApprove(row)).slice(0, batchLimit) : [],
    }));
  }
  trackFilter(filter: Filter) {
    if (filter === this.filter) return;
    this.choose('');
    this.switchFeed(filter);
  }
  private switchFeed(filter: Filter) {
    this.filter = filter;
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
    this.selectedId = id;
    this.onSelect(id);
    if (id) void this.loadDetail(id, true);
    else {
      this.clearSelection();
      this.trailRefresh();
    }
  }
  private clearSelection() {
    this.detailSequence++;
    this.requestedId = '';
    this.selected = undefined;
    this.detailBusy = false;
    this.clearScan();
  }
  private updateRow(row: Submission) {
    this.rows = this.rows.map(item => item.id === row.id ? row : item);
  }
  private async loadDetail(id: string, focus = false, keepPreview = false) {
    this.requestedId = id;
    const seq = ++this.detailSequence;
    const previous = this.selected;
    if (id !== previous?.id) {
      this.selected = undefined;
      this.clearScan();
      this.detailBusy = true;
    }
    try {
      const { submission } = await this.api.request<{ submission: Submission }>(this.endpoint(id));
      if (this.closed || seq !== this.detailSequence) return;
      this.selected = submission;
      this.updateRow(submission);
      if (this.filter !== submission.status) this.switchFeed(submission.status);
      this.paint();
      if (!keepPreview || previous?.revision !== submission.revision || !this.scanUrl) {
        const kind = keepPreview && this.scanKind === 'question' && submission.question ? 'question' : 'answer';
        await this.loadScan(kind, keepPreview ? this.scanPage : 1);
      }
      if (focus) requestAnimationFrame(() => this.reviewHeading?.nativeElement.focus());
    } catch (error) {
      if (seq === this.detailSequence) this.actionError = this.message(error, 'Could not open this submission.');
    } finally {
      if (seq === this.detailSequence) { this.detailBusy = false; this.paint(); }
    }
  }
  async loadList(older = false) {
    if (this.listBusy || (older && !this.cursor)) return;
    const seq = ++this.listSequence;
    const previous = this.cursor;
    this.listBusy = true;
    this.listError = '';
    try {
      const params = new URLSearchParams({ status: this.filter });
      if (older && previous) params.set('cursor', previous);
      const page = await this.api.request<SubmissionPage>(base + '?' + params);
      if (this.closed || seq !== this.listSequence) return;
      if (older && page.nextCursor && page.nextCursor === previous) throw Error('Could not load older submissions.');
      this.enabled = page.enabled;
      this.rows = older
        ? [...new Map([...this.rows, ...page.submissions].map(row => [row.id, row])).values()]
        : page.submissions;
      this.cursor = page.nextCursor;
    } catch (error) {
      if (seq === this.listSequence) this.listError = this.message(error, 'Could not load submissions.');
    } finally {
      if (seq === this.listSequence) {
        this.listBusy = false;
        this.paint();
        this.trailRefresh();
      }
    }
  }
  async refresh(showError = true) {
    if (this.closed) return;
    if (this.listBusy || this.mutationBusy) { this.refreshPending = true; return; }
    if (showError) this.actionError = '';
    await this.loadList();
    if (!this.closed && this.selectedId && !this.showRescan && !this.referenceEditor) {
      await this.loadDetail(this.selectedId, false, true);
    }
  }
  private clearScan() {
    this.scanSequence++;
    if (this.scanUrl) URL.revokeObjectURL(this.scanUrl);
    this.scanUrl = '';
    this.scanBusy = false;
    this.scanError = '';
  }
  async loadScan(kind: ScanKind, index = 1) {
    const row = this.selected;
    const file = kind === 'answer' ? row?.answer : row?.question;
    if (!row || !file) return;
    this.clearScan();
    const seq = this.scanSequence;
    this.scanKind = kind;
    this.scanPage = Math.min(Math.max(index, 1), file.pageCount);
    this.scanBusy = true;
    try {
      const blob = await this.api.checkingImage(this.endpoint(row.id, '/pages/' + kind + '/' + this.scanPage));
      if (this.closed || seq !== this.scanSequence || this.selected?.id !== row.id) return;
      this.scanUrl = URL.createObjectURL(blob);
    } catch (error) {
      if (seq === this.scanSequence) this.scanError = this.message(error, 'Could not open this page.');
    } finally {
      if (seq === this.scanSequence) { this.scanBusy = false; this.paint(); }
    }
  }
  startRescan() {
    this.closeReferencePicker();
    this.showRescan = true;
    this.rescanKind = this.scanKind;
    this.rescanPage = this.scanPage;
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
    await Promise.all([this.loadReferences(), this.scanKind === 'question' ? Promise.resolve() : this.loadScan('question')]);
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
  async approveBatch(group: SubmissionGroup) {
    const selected = this.groupSelected(group);
    if (!group.paperId || !selected.length) return;
    await this.mutate(async () => {
      const { results } = await this.api.request<{ results: { id: string; ok: boolean; message?: string }[] }>(
        base + '/approve-batch', 'POST', {
          paperId: group.paperId,
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
  openSheet(row: Submission) {
    if (row.paperId && row.sheetId) this.onOpenSheet(row.id, row.paperId, row.sheetId);
  }
  async release(row: Submission) {
    if (!row.paperId || !row.sheetId || this.markState(row) !== 'final') return;
    await this.mutate(async () => {
      const { publishStudentCopy } = await import('./student-submission-handback');
      await publishStudentCopy(this.api, row.id, row.version, row.paperId!, row.sheetId!, message => {
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
    catch (error) { this.actionError = this.message(error, 'Could not save the change. Try again.'); }
    finally {
      this.mutationBusy = false;
      this.mutationProgress = '';
      this.paint();
      if (!this.closed) {
        this.refreshPending = false;
        await this.refresh(false);
      }
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
