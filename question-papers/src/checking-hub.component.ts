import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssistantApi } from './api.service';
import { LibraryItem, LibraryPage, mergeLibraryItems } from './contracts';
import { ExternalExamComponent } from './external-exam.component';
import { PaperPacketComponent } from './paper-packet.component';
import { PaperLibraryComponent, type CataloguePaper } from './paper-library.component';

type Picker = 'library' | 'import' | null;

@Component({
  selector: 'gtop-checking-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ExternalExamComponent, PaperPacketComponent, PaperLibraryComponent],
  templateUrl: './checking-hub.html',
  styleUrl: './checking-hub.css',
})
export class CheckingHubComponent implements OnInit, OnDestroy {
  @Input({required:true}) onClose!: () => void;
  @Input({required:true}) onResults!: (paperId:string, packetId?:string, sheetId?:string) => void;
  @Input() libraryAccess = false;
  @Input() papersAdmin = true;
  @ViewChild(ExternalExamComponent) externalExam?: ExternalExamComponent;
  private api = inject(AssistantApi);
  private destroyed = false;
  private paperEpoch = 0;
  studentUid = '';
  packetId = '';
  paperId = '';
  referenceChoice = 0;
  paperTitle = '';
  paperMarks?: number;
  printedId = '';
  paperError = '';
  picker: Picker = null;
  legacyPicker = false;
  papers: LibraryItem[] = [];
  nextCursor: string | null = null;
  libraryLoaded = false;
  loading = false;
  libraryError = '';
  search = '';
  busy = false;
  hasLocalFiles = false;

  ngOnInit() { this.readLocation(); }
  @HostListener('window:popstate') readLocation() {
    const params = new URL(location.href).searchParams;
    if (params.get('check') || params.get('checking') !== 'class') return;
    this.packetId = params.get('packet') || '';
    this.studentUid = this.packetId || !this.papersAdmin ? '' : params.get('studentUid') || '';
    const printed = params.get('printed');
    this.printedId = printed && printed !== 'new' ? printed : '';
    this.picker = printed ? 'import' : null;
    const reference = params.get('reference');
    if ((reference || '') !== this.paperId) void this.setReference(reference || '');
  }
  ngOnDestroy() { this.destroyed = true; }
  private setUrl(key: string, value: string) {
    const url = new URL(location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    history.replaceState(history.state, '', url);
  }
  rememberStudent(uid: string) {
    this.studentUid = uid;
    this.setUrl('studentUid', uid);
  }
  rememberPacket(id: string) {
    if ((id || this.packetId) && new URL(location.href).searchParams.get('view') !== 'students') this.rememberStudent('');
    if (id !== this.packetId) this.referenceChoice = 0;
    this.packetId = id;
    this.setUrl('packet', id);
  }
  chooseReference(id: string, title = '', marks?: number) {
    this.referenceChoice++;
    this.dismissPicker();
    void this.setReference(id, title, marks);
  }
  async setReference(id: string, title = '', marks?: number) {
    if (id === this.paperId && this.paperTitle && !title) return;
    const epoch = ++this.paperEpoch;
    this.paperId = id;
    this.paperTitle = title;
    this.paperMarks = marks;
    this.paperError = '';
    this.setUrl('reference', id);
    if (!id || title) return;
    try {
      const data = await this.api.request<{rubric:{title:string; marks:number}}>('/papers/'+encodeURIComponent(id)+'/checking/rubric-info');
      if (this.destroyed || epoch !== this.paperEpoch) return;
      this.paperTitle = data.rubric.title;
      this.paperMarks = data.rubric.marks;
    } catch (error) {
      if (!this.destroyed && epoch === this.paperEpoch) {
        this.paperId = ''; this.setUrl('reference', '');
        this.paperError = error instanceof Error ? error.message : 'This question paper could not be loaded.';
      }
    }
  }
  get visiblePapers() {
    const query = this.search.trim().toLocaleLowerCase();
    if (!query) return this.papers;
    return this.papers.filter(paper => [paper.title, paper.subject, paper.board, paper.standard, paper.academicYear]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  }
  paperContext(paper: LibraryItem) {
    return [paper.board, paper.standard ? 'Class ' + paper.standard : '', paper.subject].filter(Boolean).join(' · ');
  }
  choosePaper(packetId?: string) {
    if (packetId) this.rememberPacket(packetId);
    if (!this.libraryAccess) { this.choosePrinted(); return; }
    this.picker = 'library';this.legacyPicker=false;
  }
  chooseIndexedPaper(paper:CataloguePaper){this.chooseReference(paper.paperId,paper.title,paper.marks);}
  toggleLegacyPicker(){this.legacyPicker=!this.legacyPicker;if(this.legacyPicker&&!this.libraryLoaded)void this.loadPapers();}
  choosePrinted() {
    this.printedId = ''; this.picker = 'import'; this.rememberPrinted('');
  }
  rememberPrinted(id:string) { this.printedId = id; this.setUrl('printed', id || 'new'); }
  dismissPicker() { this.picker = null; this.printedId = ''; this.setUrl('printed', ''); }
  async loadPapers() {
    if (this.loading || (this.libraryLoaded && !this.nextCursor)) return;
    this.loading = true; this.libraryError = '';
    try {
      const page = await this.api.request<LibraryPage>('/admin/library','POST',
        {kind:'papers', ...(this.nextCursor ? {cursor:this.nextCursor} : {})});
      if (this.destroyed) return;
      this.papers = mergeLibraryItems(this.papers, page.items);
      this.nextCursor = page.nextCursor;
      this.libraryLoaded = true;
    } catch (error) {
      this.libraryError = error instanceof Error ? error.message : 'Could not load the paper library.';
    } finally { this.loading = false; }
  }
  @HostListener('window:gtop-checking-may-leave', ['$event'])
  protectHistory(event:Event) {
    if (this.busy || this.externalExam?.processing ||
        ((this.hasLocalFiles || this.externalExam?.dirty) && !window.confirm('Leave these unsaved changes?'))) event.preventDefault();
  }
  close() {
    if (this.busy) return;
    if (this.externalExam) { this.externalExam.close(); return; }
    if (this.picker) { this.dismissPicker(); return; }
    if (this.hasLocalFiles && !window.confirm('Leave these scans? Pages still on this device will need to be selected again.')) return;
    this.onClose();
  }
}
