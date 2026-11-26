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
  handbackIdentity,
  marksRegister,
  registerStatus,
  type RegisterEntry,
  type ReturnDetail,
} from './class-return-data';
import type { ReturnArchive } from './class-return-archive';

type RegisterPage = {
  sheets: RegisterEntry[];
  nextCursor?: string | null;
  paperId?: string;
  gradingRevision?: number;
  packetLabel?: string;
  rubric?: { title: string; marks: number };
};
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
  @Input() classLabel = '';
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
  private downloadUrl = '';
  private releaseTimer?: ReturnType<typeof setTimeout>;
  readonly status = registerStatus;
  readonly identity = handbackIdentity;
  get base() {
    return '/papers/' + encodeURIComponent(this.paperId) + '/checking';
  }
  get chosen() {
    return this.entries.filter((row) => this.selected.has(row.id));
  }
  get finalCount() {
    return this.chosen.filter((row) => row.state === 'final' || row.state === 'completed').length;
  }
  get unavailableCount() {
    return this.chosen.filter((row) => row.state === 'held' || row.state === 'withdrawn').length;
  }
  get filtered() {
    const q = this.filter.trim().toLocaleLowerCase();
    return q
      ? this.entries.filter(row => {
          const recipient = this.identity(row);
          return [recipient.full, recipient.classLabel].some(value => value.toLocaleLowerCase().includes(q));
        })
      : this.entries;
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
    } else if (this.opened && !this.busy && !this.loading && changes['initialSheets']) {
      const latest = new Map(this.initialSheets.map((row) => [row.id, row]));
      const previous = new Map(this.entries.map((row) => [row.id, row]));
      // The packet register is complete. A paper-wide update can contain only its first page.
      const entries = this.scopePacketId
        ? this.initialSheets
        : [...this.initialSheets, ...this.entries.filter((row) => !latest.has(row.id))];
      const changed =
        entries.length !== previous.size ||
        entries.some((row) => {
          const before = previous.get(row.id);
          return (
            before?.version !== row.version ||
            before?.state !== row.state ||
            before?.pending !== row.pending
          );
        });
      if (changed) {
        const allSelected = this.selected.size === previous.size && this.selected.size > 0;
        this.entries = entries;
        this.selected = new Set(
          entries.filter((row) => allSelected || this.selected.has(row.id)).map((row) => row.id),
        );
        this.progress = '';
        this.releaseDownload();
      }
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
    clearTimeout(this.releaseTimer);
  }
  private check(epoch: number, uid: string) {
    if (this.dead || epoch !== this.epoch || this.api.user?.uid !== uid)
      throw Error('Download cancelled.');
  }
  private errorText(error: unknown) {
    return error instanceof Error ? error.message : 'Could not prepare the download. Please try again.';
  }

  private async readEntries(epoch: number, uid: string, useLoaded = false): Promise<RegisterPage> {
    // A packet is a specific class sitting. Its return must never fall through to the paper's other sittings.
    if (this.scopePacketId) {
      if (useLoaded && this.initialSheets.length) return { sheets: this.initialSheets };
      const result = await this.api.request<RegisterPage>(
        '/checking/packets/' + encodeURIComponent(this.scopePacketId) + '/results',
      );
      this.check(epoch, uid);
      if (result.paperId && result.paperId !== this.paperId)
        throw Error('This class belongs to a different question paper.');
      const onlyBook = result.sheets.length === 1 ? result.sheets[0] : undefined;
      const packetLabel = onlyBook?.singleStudentBook ? this.identity(onlyBook).full : result.packetLabel || this.classLabel;
      return { ...result, packetLabel, sheets: result.sheets.map((row) => ({ ...row, packetLabel })) };
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
    if (!useLoaded) {
      // The paper-wide register may contain several sections using the same roll numbers.
      const labels = new Map<string, string>();
      for (const row of rows.values()) {
        if (!row.packetId || row.packetLabel) continue;
        if (!labels.has(row.packetId)) {
          try {
            const packet = await this.api.request<RegisterPage>(
              '/checking/packets/' + encodeURIComponent(row.packetId) + '/results',
            );
            this.check(epoch, uid);
            if (packet.paperId && packet.paperId !== this.paperId)
              throw Error('This class belongs to a different question paper.');
            labels.set(row.packetId, packet.packetLabel || '');
          } catch (error) {
            this.check(epoch, uid);
            if ((error as { status?: number })?.status !== 404) throw error;
            // Older retained copies predate frozen class labels. Keep sections distinguishable after their packet is removed.
            labels.set(row.packetId, 'Archived class ' + row.packetId);
          }
        }
        rows.set(row.id, { ...row, packetLabel: labels.get(row.packetId) });
      }
    }
    return { ...initial, sheets: [...rows.values()], nextCursor: null };
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
      this.entries = (await this.readEntries(epoch, uid, true)).sheets;
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
    // A later click must recheck final marks and ownership. Keep no reusable link to an old result.
    this.releaseTimer = setTimeout(() => this.releaseDownload(), 60_000);
    const link = document.createElement('a');
    link.href = this.downloadUrl;
    link.download = name;
    link.click();
  }
  private async verifyForRelease(
    snapshot: RegisterPage,
    selected: RegisterEntry[],
    names: Map<string, string>,
    epoch: number,
    uid: string,
  ) {
    const current = await this.readEntries(epoch, uid);
    this.entries = current.sheets;
    if (
      snapshot.packetLabel !== current.packetLabel ||
      snapshot.gradingRevision !== current.gradingRevision ||
      snapshot.rubric?.title !== current.rubric?.title ||
      snapshot.rubric?.marks !== current.rubric?.marks
    )
      throw Error('The marking key changed. Download again for the latest result.');
    const currentRows = new Map(current.sheets.map((row) => [row.id, row]));
    const currentNames = filenames(current.sheets.filter((row) => row.state === 'final' || row.state === 'completed'));
    for (const row of selected) {
      const latest = currentRows.get(row.id);
      if (
        !latest ||
        latest.version !== row.version ||
        latest.state !== row.state ||
        latest.gradingRevision !== row.gradingRevision ||
        latest.max !== row.max ||
        latest.awarded !== row.awarded ||
        latest.label !== row.label ||
        latest.studentUid !== row.studentUid ||
        latest.studentLabel !== row.studentLabel ||
        latest.packetLabel !== row.packetLabel ||
        latest.pending !== row.pending ||
        currentNames.get(row.id) !== names.get(row.id)
      )
        throw Error('Marks changed for ' + this.identity(row).full + '. Download again for the latest result.');
    }
  }

  async download(kind: 'csv' | 'zip' | 'print') {
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
      const nameFor = (title: string, label?: string) =>
        label
          ? fileStem(label, 'Class', 80) + ' — ' + fileStem(title, 'GT Papers', 100) + suffix
          : fileStem(title, 'GT Papers') + suffix;
      const suffix = {
        csv: ' - marks.csv',
        zip: ' - marked copies.zip',
        print: ' - class print set.pdf',
      }[kind];
      // For large downloads, write the ZIP directly to disk on browsers that support it.
      const savePicker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
      if (
        kind === 'zip' &&
        savePicker &&
        this.chosen.filter((row) => row.state === 'final' || row.state === 'completed').reduce((n, r) => n + r.pageCount, 0) > 120
      ) {
        const file = await savePicker.call(window, {
          suggestedName: nameFor(this.paperTitle, this.classLabel),
          types: [{ description: 'Marked answer sheets', accept: { 'application/zip': ['.zip'] } }],
        });
        this.check(epoch, uid);
        writer = await file.createWritable();
      }
      const snapshot = await this.readEntries(epoch, uid);
      const name = nameFor(snapshot.rubric?.title || this.paperTitle, snapshot.packetLabel);
      const rows = snapshot.sheets.filter((row) => ids.has(row.id));
      if (rows.length !== ids.size)
        throw Error('A selected sheet was removed. Reopen the panel and select the current sheets.');
      this.entries = snapshot.sheets;
      const names = filenames(snapshot.sheets.filter((row) => row.state === 'final' || row.state === 'completed'));
      if (kind === 'csv') {
        const csv = new Blob([marksRegister(rows, snapshot.rubric?.marks ?? this.paperMaximum, names)], {
          type: 'text/csv;charset=utf-8',
        });
        await this.verifyForRelease(snapshot, rows, names, epoch, uid);
        this.check(epoch, uid);
        this.offer(csv, name);
        this.progress = `Register ready for ${rows.length} ${rows.length === 1 ? 'sheet' : 'sheets'}.`;
        return;
      }
      const returning = rows.filter((row) => row.state === 'final' || row.state === 'completed');
      if (!returning.length)
        throw Error('There are no completed reports among the selected sheets.');
      const { markedCopy } = await import('./class-return-pdf');
      const printSet =
        kind === 'print'
          ? await (
              await import('./class-return-print')
            ).ClassPrintSet.create(name.replace(/\.pdf$/i, ''))
          : null;
      if (!printSet) {
        const { ReturnArchive } = await import('./class-return-archive');
        archive = new ReturnArchive(writer);
      }
      this.check(epoch, uid);
      for (const [i, row] of returning.entries()) {
        this.check(epoch, uid);
        this.progress = `Preparing ${i + 1} of ${returning.length} · ${this.identity(row).full}`;
        this.repaint();
        const endpoint = this.base + '/' + encodeURIComponent(row.id);
        const detail = await this.api.request<ReturnDetail>(endpoint);
        this.check(epoch, uid);
        if (
          detail.sheet.state !== row.state ||
          detail.sheet.version !== row.version ||
          detail.sheet.label !== row.label ||
          detail.sheet.studentUid !== row.studentUid ||
          detail.sheet.studentLabel !== row.studentLabel ||
          (row.max != null && detail.sheet.grade?.max !== row.max) ||
          detail.sheet.grade?.awarded !== row.awarded
        )
          throw Error('Marks changed for ' + this.identity(row).full + '. Download again for the latest result.');
        const pdf = row.automatic
          ? new Uint8Array(await (await this.api.reportBlob(endpoint + '/result-pdf')).arrayBuffer())
          : await markedCopy(
          { ...detail, classLabel: this.identity(row).classLabel },
          (index) => this.api.checkingImage(endpoint + '/pages/' + index),
          () => this.check(epoch, uid),
        );
        if (printSet) await printSet.add(pdf);
        else await archive!.add(names.get(row.id)!, pdf);
      }
      this.check(epoch, uid);
      const printable = await printSet?.finish();
      await this.verifyForRelease(snapshot, rows, names, epoch, uid);
      this.check(epoch, uid);
      const output = printable || (await archive!.finish(() => this.check(epoch, uid)));
      this.check(epoch, uid);
      if (output) this.offer(output, name);
      const withdrawn = rows.filter((row) => row.state === 'withdrawn').length;
      const held = rows.filter((row) => row.state === 'held').length;
      const pending = rows.length - returning.length - withdrawn - held;
      this.progress =
        [
          printSet
            ? `Print set ready for ${returning.length} ${returning.length === 1 ? 'student' : 'students'}`
            : `${returning.length} marked ${returning.length === 1 ? 'copy' : 'copies'} ready`,
          pending ? `${pending} awaiting final marks` : '',
          held ? `${held} held for identification` : '',
          withdrawn ? `${withdrawn} withdrawn` : '',
        ]
          .filter(Boolean)
          .join(' · ') + '.';
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
