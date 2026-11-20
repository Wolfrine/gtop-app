import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { AssistantApi } from './api.service';
import { handbackIdentity } from './class-return-data';
import { StudentLookupComponent, getStudentAccount, type StudentAccount } from './student-lookup';

export interface StudentHistoryRecord {
  kind: 'packet' | 'sheet';
  id: string;
  paperId: string | null;
  paperTitle: string | null;
  subject?: string;
  standard?: string;
  packetId?: string;
  label: string;
  studentUid?: string;
  studentLabel?: string;
  labelFromStudent?: boolean;
  state: string;
  awarded: number | null;
  max: number | null;
  pending: number | null;
  createdAt: string;
}

interface HistoryPage {
  sheets: StudentHistoryRecord[];
  nextCursor: string | null;
}

@Component({
  selector: 'gtop-student-history',
  standalone: true,
  imports: [CommonModule, StudentLookupComponent],
  templateUrl: './student-history.html',
  styleUrl: './student-history.css',
})
export class StudentHistoryComponent implements OnChanges, OnDestroy {
  @Input() selectedUid = '';
  @Input({required: true}) onSelect!: (uid: string) => void;
  @Input({required: true}) onCheck!: (uid: string) => void;
  @Input({required: true}) onOpen!: (row: StudentHistoryRecord) => void;

  private api = inject(AssistantApi);
  private change = inject(ChangeDetectorRef);
  private epoch = 0;
  private activeUid = '';
  selected: StudentAccount | null = null;
  rows: StudentHistoryRecord[] = [];
  nextCursor: string | null = null;
  loading = false;
  resolving = false;
  error = '';
  private failedCursor: string | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedUid'] && this.selectedUid !== this.activeUid) {
      void this.restoreStudent(this.selectedUid);
    }
  }

  ngOnDestroy() { ++this.epoch; }

  private reset(uid: string, account: StudentAccount | null = null) {
    ++this.epoch;
    this.activeUid = uid;
    this.selected = account;
    this.rows = [];
    this.nextCursor = null;
    this.failedCursor = null;
    this.error = '';
    this.loading = false;
    this.resolving = false;
  }

  select(account: StudentAccount | null) {
    const uid = account?.uid || '';
    if (uid === this.activeUid) return;
    this.reset(uid, account);
    this.onSelect(uid);
    if (account) void this.load();
  }

  private async restoreStudent(uid: string) {
    this.reset(uid);
    if (!uid) return;
    const epoch = this.epoch;
    this.resolving = true;
    try {
      const account = await getStudentAccount(this.api, uid);
      if (epoch !== this.epoch) return;
      this.selected = account;
      this.resolving = false;
      await this.load();
    } catch (error) {
      if (epoch === this.epoch) this.error = this.message(error);
    } finally {
      if (epoch === this.epoch) { this.resolving = false; this.change.markForCheck(); }
    }
  }

  async load(cursor: string | null = null) {
    if (!this.selected || this.loading) return;
    const epoch = this.epoch;
    this.loading = true;
    this.error = '';
    try {
      const page = await this.api.request<HistoryPage>('/checking/student-history', 'POST', {
        studentUid: this.selected.uid,
        ...(cursor ? { cursor } : {}),
      });
      if (epoch !== this.epoch) return;
      if (cursor && page.nextCursor === cursor) throw new Error('Could not load older checks. Try again.');
      const rows = cursor ? [...this.rows] : [];
      const seen = new Set(rows.map(row => this.recordKey(row)));
      for (const row of page.sheets) {
        const key = this.recordKey(row);
        if (!seen.has(key)) {
          rows.push(row);
          seen.add(key);
        }
      }
      this.rows = rows;
      this.nextCursor = page.nextCursor;
      this.failedCursor = null;
    } catch (error) {
      if (epoch === this.epoch) {
        this.error = this.message(error);
        this.failedCursor = cursor;
      }
    } finally {
      if (epoch === this.epoch) { this.loading = false; this.change.markForCheck(); }
    }
  }

  retry() {
    if (this.selected) void this.load(this.failedCursor);
    else void this.restoreStudent(this.activeUid);
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : 'Could not load the student’s checks. Try again.';
  }

  bookLabel(row: StudentHistoryRecord) {
    const identity = handbackIdentity(row);
    return identity.sheetLabel || identity.name || 'Answer book';
  }

  recordKey(row: StudentHistoryRecord) {
    return JSON.stringify([row.kind, row.paperId, row.id]);
  }

  status(row: StudentHistoryRecord) {
    if (row.kind === 'packet') {
      const states: Record<string, string> = {
        uploading: 'Upload incomplete', queued: 'Waiting to organize', running: 'Organizing pages',
        review: 'Ready to send for marking', failed: 'Needs attention', completed: 'Sent for marking',
      };
      return states[row.state] || 'In progress';
    }
    if (row.state === 'review') {
      if (row.pending == null) return 'Awaiting review';
      return row.pending ? row.pending + (row.pending === 1 ? ' decision to review' : ' decisions to review') : 'Ready for approval';
    }
    const states: Record<string, string> = {
      final: 'Approved', queued: 'Queued for marking', running: 'Marking', uploading: 'Upload incomplete',
      failed: 'Checking failed', withdrawn: 'Withdrawn', held: 'Identity on hold',
    };
    return states[row.state] || 'In progress';
  }

  action(row: StudentHistoryRecord) {
    if (row.kind === 'packet' || row.state === 'uploading') return 'Resume';
    if (row.state === 'review') return 'Review';
    return row.state === 'final' ? 'View result' : 'Open';
  }
}
