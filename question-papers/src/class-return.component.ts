import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
} from '@angular/core';
import { AssistantApi } from './api.service';
import {
  fileStem,
  filenames,
  marksRegister,
  registerStatus,
  type RegisterEntry,
  type ReturnDetail,
} from './class-return-data';
import type { ReturnArchive } from './class-return-archive';

type RegisterPage = { sheets: RegisterEntry[]; nextCursor?: string | null };
type SavePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

@Component({
  selector: 'gtop-class-return',
  standalone: true,
  templateUrl: './class-return.html',
  styleUrl: './class-return.css',
})
export class ClassReturnComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) paperId = '';
  @Input() scopePacketId = '';
  @Input() paperTitle = '';
  @Input() paperMaximum?: number;
  @Input() initialSheets: RegisterEntry[] = [];
  @Input() nextCursor: string | null = null;

  private api = inject(AssistantApi);
  private change = inject(ChangeDetectorRef);
  private epoch = 0;
  private dead = false;
  private selected = new Set<string>();
  opened = false;
  choosing = false;
  busy = false;
  loading = false;
  filter = '';
  displayLimit = 40;
  entries: RegisterEntry[] = [];
  progress = '';
  error = '';
  downloadUrl = '';
  downloadName = '';
  readonly status = registerStatus;
  get base() {
    return '/papers/' + encodeURIComponent(this.paperId) + '/checking';
  }
  get chosen() {
    return this.entries.filter((row) => this.selected.has(row.id));
  }
  get finalCount() {
    return this.chosen.filter((row) => row.state === 'final').length;
  }
  get filtered() {
    const q = this.filter.trim().toLocaleLowerCase();
    return q ? this.entries.filter((row) => row.label.toLocaleLowerCase().includes(q)) : this.entries;
  }
  get visible() {
    return this.filtered.slice(0, this.displayLimit);
  }
  get allFiltered() {
    return !!this.filtered.length && this.filtered.every((row) => this.selected.has(row.id));
  }
  isSelected(id: string) {
    return this.selected.has(id);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['paperId'] || changes['scopePacketId']) {
      this.epoch++;
      this.opened = false;
      this.choosing = false;
      this.busy = false;
      this.loading = false;
      this.progress = '';
      this.error = '';
      this.entries = [];
      this.selected.clear();
      this.filter = '';
      this.releaseDownload();
    }
  }
  ngOnDestroy() {
    this.dead = true;
    this.epoch++;
    this.releaseDownload();
  }
  private repaint() {
    if (!this.dead) this.change.markForCheck();
  }
  private releaseDownload() {
    if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
    this.downloadUrl = '';
    this.downloadName = '';
  }
  private check(epoch: number, uid: string) {
    if (this.dead || epoch !== this.epoch || this.api.user?.uid !== uid)
      throw Error('Download cancelled.');
  }
  private errorText(error: unknown) {
    return error instanceof Error ? error.message : 'Could not prepare the download. Please try again.';
  }

  private async readEntries(epoch: number, uid: string, useLoaded = false) {
    // A packet is a specific class sitting. Its return must never fall through to the paper's other sittings.
    if (this.scopePacketId) {
      const result = await this.api.request<RegisterPage>(
        '/checking/packets/' + encodeURIComponent(this.scopePacketId) + '/results',
      );
      this.check(epoch, uid);
      return result.sheets;
    }
    const initial =
      useLoaded && this.initialSheets.length
        ? { sheets: this.initialSheets, nextCursor: this.nextCursor }
        : await this.api.request<RegisterPage>(this.base);
    this.check(epoch, uid);
    const rows = new Map(initial.sheets.map((row) => [row.id, row]));
    let cursor = initial.nextCursor;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) throw Error('The sheet register changed. Reopen the download panel.');
      seen.add(cursor);
      const page = await this.api.request<RegisterPage>(this.base + '/history', 'POST', { cursor });
      this.check(epoch, uid);
      for (const row of page.sheets) rows.set(row.id, row);
      cursor = page.nextCursor;
    }
    return [...rows.values()];
  }
  async toggle() {
    if (this.busy || this.loading) return;
    this.opened = !this.opened;
    this.error = '';
    this.progress = '';
    this.releaseDownload();
    if (!this.opened) return;
    const epoch = ++this.epoch,
      uid = this.api.user?.uid;
    if (!uid) {
      this.error = 'Sign in to download checked copies.';
      return;
    }
    this.loading = true;
    try {
      this.entries = await this.readEntries(epoch, uid, true);
      this.selected = new Set(this.entries.map((row) => row.id));
      this.choosing = false;
      this.displayLimit = 40;
      this.filter = '';
    } catch (error) {
      if (this.epoch === epoch) this.error = this.errorText(error);
    } finally {
      if (this.epoch === epoch) {
        this.loading = false;
        this.repaint();
      }
    }
  }
  choose(id: string, checked: boolean) {
    if (checked) this.selected.add(id);
    else this.selected.delete(id);
    this.releaseDownload();
    this.progress = '';
  }
  chooseFiltered(checked: boolean) {
    for (const item of this.filtered) this.choose(item.id, checked);
  }
  search(query: string) {
    this.filter = query;
    this.displayLimit = 40;
  }
  cancel() {
    this.epoch++;
    this.busy = false;
    this.progress = 'Download cancelled.';
    this.repaint();
  }

  private offer(blob: Blob, name: string) {
    this.releaseDownload();
    this.downloadUrl = URL.createObjectURL(blob);
    this.downloadName = name;
    const link = document.createElement('a');
    link.href = this.downloadUrl;
    link.download = name;
    link.click();
  }
  async download(kind: 'csv' | 'zip') {
    const uid = this.api.user?.uid;
    if (this.busy || this.loading || !uid || !this.chosen.length) return;
    const epoch = ++this.epoch,
      ids = new Set(this.selected);
    this.busy = true;
    this.error = '';
    this.progress = 'Checking latest marks…';
    this.releaseDownload();
    let archive: ReturnArchive | undefined, writer: FileSystemWritableFileStream | undefined;
    try {
      const name =
        fileStem(this.paperTitle, 'GT Papers') +
        (kind === 'csv' ? ' - marks.csv' : ' - marked copies.zip');
      // For large downloads, write the ZIP directly to disk on browsers that support it.
      const savePicker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
      if (
        kind === 'zip' &&
        savePicker &&
        this.chosen.filter((row) => row.state === 'final').reduce((n, r) => n + r.pageCount, 0) > 120
      ) {
        const file = await savePicker.call(window, {
          suggestedName: name,
          types: [{ description: 'Marked answer sheets', accept: { 'application/zip': ['.zip'] } }],
        });
        this.check(epoch, uid);
        writer = await file.createWritable();
      }
      const snapshot = await this.readEntries(epoch, uid);
      const rows = snapshot.filter((row) => ids.has(row.id));
      if (rows.length !== ids.size)
        throw Error('A selected sheet was removed. Reopen the panel and select the current sheets.');
      this.entries = snapshot;
      const names = filenames(snapshot.filter((row) => row.state === 'final'));
      if (kind === 'csv') {
        this.offer(
          new Blob([marksRegister(rows, this.paperMaximum, names)], { type: 'text/csv;charset=utf-8' }),
          name,
        );
        this.progress = `Register ready for ${rows.length} ${rows.length === 1 ? 'sheet' : 'sheets'}.`;
        return;
      }
      const returning = rows.filter((row) => row.state === 'final');
      if (!returning.length)
        throw Error('Finalize at least one selected sheet to download its marked copy.');
      const [{ markedCopy }, { ReturnArchive }] = await Promise.all([
        import('./class-return-pdf'),
        import('./class-return-archive'),
      ]);
      this.check(epoch, uid);
      archive = new ReturnArchive(writer);
      for (const [i, row] of returning.entries()) {
        this.check(epoch, uid);
        this.progress = `Preparing ${i + 1} of ${returning.length} · ${row.label}`;
        this.repaint();
        const endpoint = this.base + '/' + encodeURIComponent(row.id);
        const detail = await this.api.request<ReturnDetail>(endpoint);
        this.check(epoch, uid);
        if (detail.sheet.state !== 'final' || detail.sheet.version !== row.version)
          throw Error('Marks changed for ' + row.label + '. Download again for the latest result.');
        const pdf = await markedCopy(
          detail,
          (index) => this.api.checkingImage(endpoint + '/pages/' + index),
          () => this.check(epoch, uid),
        );
        await archive.add(names.get(row.id)!, pdf);
      }
      // Reconcile once after generating. A reopened or deleted copy cannot leave as a final result.
      const recheck = new Map((await this.readEntries(epoch, uid)).map((row) => [row.id, row]));
      for (const row of returning) {
        const latest = recheck.get(row.id);
        if (latest?.state !== 'final' || latest.version !== row.version)
          throw Error('Marks changed for ' + row.label + '. Download again for the latest result.');
      }
      this.check(epoch, uid);
      const zip = await archive.finish();
      this.check(epoch, uid);
      if (zip) this.offer(zip, name);
      const pending = rows.length - returning.length;
      this.progress = `${returning.length} marked ${returning.length === 1 ? 'copy' : 'copies'} ready${pending ? ' · ' + pending + ' awaiting final marks' : ''}.`;
    } catch (error) {
      if (archive) await archive.cancel();
      else await writer?.abort().catch(() => {});
      if (this.epoch === epoch) {
        this.progress = '';
        if ((error as { name?: string })?.name !== 'AbortError') this.error = this.errorText(error);
      }
    } finally {
      if (this.epoch === epoch) {
        this.busy = false;
        this.repaint();
      }
    }
  }
}
