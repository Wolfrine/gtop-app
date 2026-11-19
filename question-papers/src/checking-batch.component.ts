import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssistantApi } from './api.service';
import { maxCheckingPages, scanBase64, scanFiles, scanPdfPageCount, type Scan } from './checking-intake';

type UploadState = 'ready' | 'uploading' | 'sent' | 'failed' | 'invalid';
type Receipt = { id: string; label: string; sent: boolean };
type BatchSheet = {
  id: string;
  key: string;
  name: string;
  label: string;
  pages: number;
  saved: number;
  file?: File;
  state: UploadState;
  started: boolean;
  detail: string;
};
type StoredSheet = { sheet: { state: string; uploaded: { index: number }[] } };

@Component({
  selector: 'gtop-checking-batch',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './checking-batch.html',
  styleUrl: './checking-batch.css'
})
export class PaperCheckingBatchComponent implements OnInit, OnDestroy {
  @Input({required: true}) paperId = '';
  @Input() firstSheetNumber = 1;
  @Output() closed = new EventEmitter<void>();
  @Output() uploadingChange = new EventEmitter<boolean>();
  @Output() selectionChange = new EventEmitter<boolean>();

  private api = inject(AssistantApi);
  private receipts = new Map<string, Receipt>();
  private storageKey = '';
  private nextNumber = 1;
  private destroyed = false;
  readonly maxPages = maxCheckingPages;
  sheets: BatchSheet[] = [];
  inspecting = false;
  sending = false;
  inspectionProgress = '';
  notice = '';
  recoverable = false;
  issuesOnly = false;

  ngOnInit() {
    this.nextNumber = Math.max(1, this.firstSheetNumber);
    if (!this.api.user) return;
    this.storageKey = 'gt-papers:batch:' + this.api.user.uid + ':' + this.paperId;
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (stored) this.receipts = new Map(JSON.parse(stored));
      this.recoverable = this.receipts.size > 0;
    } catch { /* This tab can still retry each sheet from memory. */ }
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (!this.busy && this.sent && !this.candidates.length) this.forgetCompleted();
  }

  get busy() { return this.inspecting || this.sending; }
  get candidates() { return this.sheets.filter(row => row.state === 'ready' || row.state === 'failed'); }
  get issues() { return this.sheets.filter(row => row.state === 'invalid' || row.state === 'failed'); }
  get visibleSheets() { return this.issuesOnly && this.issues.length ? this.issues : this.sheets; }
  get sent() { return this.sheets.filter(row => row.state === 'sent').length; }
  get hasBlankLabels() { return this.candidates.some(row => !row.label.trim()); }
  get unsavedFiles() { return this.inspecting || this.sheets.some(row => row.state !== 'invalid' && row.saved < row.pages); }
  get totalPages() { return this.sheets.reduce((sum, row) => sum + row.pages, 0); }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent) {
    if (this.unsavedFiles) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  close() {
    if (this.busy) return;
    if (this.unsavedFiles && !window.confirm('Leave the class upload? Choose the remaining PDFs again to continue. Sheets already sent will keep checking.')) return;
    this.closed.emit();
  }

  private updateSelection() {
    this.selectionChange.emit(this.unsavedFiles);
  }

  private remember(row: BatchSheet) {
    this.receipts.set(row.key, {id: row.id, label: row.label, sent: row.state === 'sent'});
    try {
      if (this.storageKey) sessionStorage.setItem(this.storageKey, JSON.stringify([...this.receipts]));
    } catch { /* Keep this tab's in-memory receipt when storage is unavailable. */ }
  }

  private forgetCompleted() {
    for (const row of this.sheets) if (row.state === 'sent') this.receipts.delete(row.key);
    try {
      if (!this.storageKey) return;
      if (this.receipts.size) sessionStorage.setItem(this.storageKey, JSON.stringify([...this.receipts]));
      else sessionStorage.removeItem(this.storageKey);
    } catch { /* Storage is optional. */ }
  }

  async selectFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (this.busy || !files.length) return;
    this.inspecting = true;
    this.uploadingChange.emit(true);
    this.updateSelection();
    this.notice = '';
    let duplicates = 0;
    try {
      for (const [index, file] of files.entries()) {
        if (this.destroyed) return;
        this.inspectionProgress = 'Reading file ' + (index + 1) + ' of ' + files.length + '…';
        const row: BatchSheet = {
          id: crypto.randomUUID(), key: '', name: file.name, label: '', file,
          pages: 0, saved: 0, started: false, state: 'ready', detail: ''
        };
        try {
          if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw Error('Choose a PDF for this sheet.');
          if (file.size > 64 * 1024 * 1024) throw Error('Choose a file up to 64 MB.');
          const bytes = await file.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
          const identity = new TextEncoder().encode(file.name + '/' + hash);
          const keyHash = await crypto.subtle.digest('SHA-256', identity);
          row.key = Array.from(new Uint8Array(keyHash), x => x.toString(16).padStart(2, '0')).join('');
          if (this.sheets.some(existing => existing.key === row.key)) {
            duplicates++;
            continue;
          }
          row.pages = await scanPdfPageCount(file, bytes);
          if (row.pages < 1 || row.pages > this.maxPages) {
            throw Error('Each sheet can have 1–' + this.maxPages + ' pages.');
          }
          const receipt = this.receipts.get(row.key);
          row.label = receipt?.label ?? ('Sheet ' + String(this.nextNumber).padStart(2, '0'));
          this.nextNumber++;
          if (receipt) {
            row.id = receipt.id;
            row.started = true;
            if (receipt.sent) {
              row.state = 'sent';
              row.saved = row.pages;
              row.file = undefined;
            }
          }
        } catch (error) {
          row.state = 'invalid';
          row.pages = 0;
          row.file = undefined;
          row.detail = this.describe(error);
        }
        this.sheets.push(row);
      }
      if (duplicates) this.notice = duplicates + (duplicates === 1 ? ' file was' : ' files were') + ' already in this upload.';
    } finally {
      this.inspecting = false;
      if (!this.destroyed) {
        this.uploadingChange.emit(false);
        this.updateSelection();
      }
    }
  }

  remove(row: BatchSheet) {
    if (this.busy || row.started) return;
    this.sheets = this.sheets.filter(item => item !== row);
    this.updateSelection();
  }

  async send(rows = this.candidates) {
    if (this.busy || !rows.length || rows.some(row => !row.label.trim())) return;
    this.sending = true;
    this.issuesOnly = false;
    this.notice = '';
    this.uploadingChange.emit(true);
    try {
      for (const row of rows) {
        if (this.destroyed) return;
        try {
          await this.sendSheet(row);
        } catch (error) {
          row.state = 'failed';
          row.detail = this.describe(error);
        }
        this.updateSelection();
      }
    } finally {
      this.sending = false;
      if (!this.destroyed) this.uploadingChange.emit(false);
    }
  }

  private async sendSheet(row: BatchSheet) {
    const base = '/papers/' + encodeURIComponent(this.paperId) + '/checking';
    const path = base + '/' + row.id;
    const saved = new Set<number>();
    row.state = 'uploading';
    row.label = row.label.trim();
    row.detail = 'Preparing sheet…';
    if (row.started) {
      try {
        const {sheet} = await this.api.request<StoredSheet>(path);
        if (sheet.state !== 'uploading') { this.markSent(row); return; }
        for (const page of sheet.uploaded) saved.add(page.index);
      } catch (error) {
        if ((error as {status?: number}).status !== 404) throw error;
      }
    }
    row.saved = saved.size;
    let images: Scan[] = [];
    try {
      if (saved.size < row.pages) {
        if (!row.file) throw Error('Select the original PDF to finish this upload.');
        images = await scanFiles([row.file], this.maxPages);
        if (images.length !== row.pages) throw Error('The PDF page count changed. Reopen the original file.');
      }
      if (this.destroyed) return;
      if (!saved.size) {
        // Record the ID before the first write, including when its reply is lost.
        row.started = true;
        this.remember(row);
        await this.api.request(base, 'POST', {id: row.id, label: row.label, notes: '', pageCount: row.pages});
      }
      for (let i = 0; i < images.length; i++) {
        if (this.destroyed) return;
        const page = i + 1;
        if (saved.has(page)) continue;
        row.detail = 'Saving page ' + page + ' of ' + row.pages + '…';
        const jpeg = await scanBase64(images[i].blob);
        await this.api.request(path + '/pages/' + page, 'POST', {jpeg});
        row.saved++;
      }
      if (this.destroyed) return;
      row.detail = 'Sending to checker…';
      await this.api.request(path + '/queue', 'POST', {});
      this.markSent(row);
    } finally {
      for (const image of images) URL.revokeObjectURL(image.url);
    }
  }

  private markSent(row: BatchSheet) {
    row.state = 'sent';
    row.saved = row.pages;
    row.file = undefined;
    row.detail = '';
    this.remember(row);
  }

  private describe(error: unknown) {
    return error instanceof Error ? error.message : 'The file could not be processed. Try again.';
  }
}
