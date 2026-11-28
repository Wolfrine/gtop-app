import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PacketCorrectionComponent, type ScanCorrection } from './packet-correction.component';
import { isAnonymous } from '../../assistant-service/domain/checking-intake.mjs';
import { AssistantApi } from './api.service';
import { StudentLookupComponent, getStudentAccount, type StudentAccount } from './student-lookup';
import { cameraDrafts, clearCameraDraft, loadCameraDraft, storeCameraDraft, type CameraDraft } from './camera-drafts';
import { isScanPdf, maxCheckingPages, packetFilePageCount, previewPacketPage, readScanPages, scanBase64, type Scan } from './checking-intake';

type PacketState = 'uploading' | 'queued' | 'running' | 'review' | 'completed' | 'failed';
type Source = { veryDark?:boolean; cameraKey?:string;missingSize?:number;file: File; pages: number; starts: boolean; rotations: Map<number, number> };
type Book = { label: string; pages: number[]; needsReview: boolean; reason: string; held?:boolean; withdrawn?:boolean; sheetId?: string };
type DraftBook = Book & { key: number };
type StoredPage = { index: number; sha: string; width: number; height: number };
type PacketSummary = {
  id: string; label: string; studentUid?: string; studentLabel?: string; pageCount: number; expectedStudents: number | null; paperId: string | null; gradingPaperId?: string; gradingRevision?: number;
  state: PacketState; version: number; processedPages: number; updatedAt: string; createdAt: string;
};
type Packet = PacketSummary & { uploaded: StoredPage[]; groups: Book[]; error?: string };
type PacketList = { packets: PacketSummary[]; nextCursor?: string };
export type QueuedPacket = { packetId: string; paperId: string; sheetIds: string[]; sheetId?: string };
const base = '/checking/packets';
const maxStackPages = 200;

async function sameSource(left:File,right:File) {
  if (left.name!==right.name || left.size!==right.size) return false;
  if (left===right) return true;
  for (let offset=0;offset<left.size;offset+=1024*1024) {
    const end=offset+1024*1024;
    const [a,b]=await Promise.all([left.slice(offset,end).arrayBuffer(),right.slice(offset,end).arrayBuffer()]);
    const bytes=new Uint8Array(b);
    if(!new Uint8Array(a).every((value,i)=>value===bytes[i]))return false;
  }
  return true;
}

@Component({
  selector: 'gtop-paper-packet', standalone: true, imports: [CommonModule, FormsModule, PacketCorrectionComponent, StudentLookupComponent],
  templateUrl: './paper-packet.html', styleUrl: './paper-packet.css'
})
export class PaperPacketComponent implements OnInit, OnChanges, OnDestroy {
  @Input() paperId = '';
  @Input() packetId = '';
  @Input() studentUid = '';
  @Output() studentChange = new EventEmitter<string>();
  @Input() referenceTitle = '';
  @Input() referenceChoice = 0;
  @Input() libraryAccess = false;
  @Input() papersAdmin = true;
  @Output() needPrinted = new EventEmitter<void>();
  @Output() linkedPaper = new EventEmitter<string>();
  @Output() packetChange = new EventEmitter<string>();
  @Output() needPaper = new EventEmitter<string>();
  @Output() queued = new EventEmitter<QueuedPacket>();
  @Output() busyChange = new EventEmitter<boolean>();
  @Output() selectionChange = new EventEmitter<boolean>();

  private api = inject(AssistantApi);
  private cd = inject(ChangeDetectorRef);
  private destroyed = false;
  private initialized = false;
  private staged?:{id:string;revision:number;owner:string;known:Set<string>;writes:Promise<void>};
  localDrafts:CameraDraft[]=[];
  cameraSaving=0;
  cameraSaved=false;
  cameraUnavailable=false;
  private openedId = '';
  single = true;
  student: StudentAccount | null = null;
  studentLoading = false;
  studentError = '';
  private studentRequest = 0;
  private lookupUid = '';
  historyOpen = false;
  private historyLoaded = false;
  dragDepth = 0;
  private createId = '';
  private defaultLabel = '';
  private pendingReference = '';
  private recheckRequest?: {packetId:string; paperId:string; version:number; requestId:string};
  private listRequest = 0;
  private detailRequest = 0;
  private previewRequest = 0;
  private sourceRequest = 0;
  private nextKey = 1;
  private unsubscribe?: () => void;
  private lastMarker = '';
  private freshAfterWork = false;
  private dirty = false;
  private lastSelection = false;
  private imagePacket = '';
  private imageCache = new Map<number, string>();
  private processingRefresh = false;

  recent: PacketSummary[] = [];
  cursor = '';
  loadingList = false;
  loadingDetail = false;
  ready = false;
  savedDuringUpload=0;
  packet?: Packet;
  sources: Source[] = [];
  books: DraftBook[] = [];
  matchingScans:number[][]=[];
  selectedKey = 0;
  selectedPage = 0;
  imageUrl = '';
  imageError = '';
  zoomed = false;
  selectedPages = new Set<number>();
  moving = false;
  moveTarget = '';
  sourceView?: Source;
  sourceIndex = 1;
  sourcePreview?: Scan;
  readingPreview = false;
  label = '';
  expected: number | null = null;
  countConfirmed = false;
  manual = false;
  busy = false;
  progress = '';
  error = '';
  notice = '';
  @ViewChild('bookDetail') private bookDetail?:ElementRef<HTMLElement>;
  @ViewChild('bookList') private bookList?:ElementRef<HTMLElement>;
  @ViewChild(PacketCorrectionComponent) correction?:PacketCorrectionComponent;
  correcting=false;
  readonly pageLimit = maxStackPages;
  readonly bookLimit = maxCheckingPages;

  get stage() { return this.submitted ? 3 : this.reviewing || this.processing || this.packet?.state === 'failed' ? 2 : 1; }
  get intakeSteps() {
    return this.accountCheck
      ? ['Student & scan', 'Question paper', 'Send for checking']
      : ['Add scans', 'Match answer books', 'Review marks'];
  }
  get intakeStage() {
    if (!this.accountCheck || this.submitted) return this.stage;
    if (!this.studentLabel || !this.sources.length) return 1;
    return this.attachedPaper ? 3 : 2;
  }
  get uploadLabel() {
    if (this.accountCheck && !this.attachedPaper) return 'Choose question paper';
    if (this.accountCheck) return 'Send for checking';
    if (this.incompleteUpload) return 'Finish uploading';
    return this.single ? 'Review this answer book' : this.allPdfs && this.separateFiles ? 'Review student books' : 'Find student books';
  }
  get accountCheck() { return this.papersAdmin && (this.packet ? !!this.packet.studentUid : this.single); }
  get studentLabel() { return this.packet?.studentLabel || this.student?.displayName || ''; }

  selectStudent(student: StudentAccount | null) {
    if (!this.papersAdmin || this.packet || this.busy) return;
    this.studentRequest++;
    this.lookupUid = student?.uid || '';
    this.studentLoading = false;
    this.studentError = '';
    if (this.student?.uid !== student?.uid) { this.createId = ''; this.defaultLabel = ''; }
    this.student = student;
    this.studentChange.emit(student?.uid || '');
    void this.saveCamera();
  }

  async loadStudent(uid: string) {
    if(!this.papersAdmin)return;
    const request = ++this.studentRequest;
    this.lookupUid = uid;
    this.student = null;
    this.studentLoading = !!uid;
    this.studentError = '';
    if (!uid) return;
    try {
      const student = await getStudentAccount(this.api, uid);
      if (request === this.studentRequest && !this.destroyed) this.student = student;
    } catch (error) {
      if (request === this.studentRequest && !this.destroyed)
        this.studentError = this.describe(error);
    } finally {
      if (request === this.studentRequest && !this.destroyed) { this.studentLoading = false; this.paint(); }
    }
  }

  chooseSize(single:boolean) {
    if (this.sourcesLocked || this.busy) return;
    if (single === this.single) return;
    this.createId=''; this.defaultLabel='';
    this.single=single;
    if (single) this.toggleFileStarts(false);
    else this.selectStudent(null);
  }
  showHistory() {
    if (this.hasOpenStack) this.home();
    if (this.hasOpenStack) return;
    this.historyOpen=true;
    if (!this.historyLoaded && !this.loadingList) void this.loadRecent();
  }
  get hasOpenStack() { return !!this.openedId; }
  get pageTotal() { return this.sources.reduce((n, source) => n + source.pages, 0); }
  get expectedCount() { return this.packet?.expectedStudents ?? this.expected; }
  get allPdfs() { return this.sources.length > 1 && this.sources.every(source => isScanPdf(source.file)); }
  get separateFiles() { return this.sources.length > 1 && this.sources.slice(1).every(source => source.starts); }
  get hasLocalChanges() {
    return this.dirty || this.correcting || this.sources.some(s=>!s.cameraKey&&s.missingSize===undefined) ||
      (this.cameraCount>0&&(!this.cameraSaved||this.cameraSaving>0));
  }
  get book() { return this.books.find(book => book.key === this.selectedKey); }
  get needsReview() { return this.books.filter(book => !book.held && !book.withdrawn && (book.needsReview || !book.label.trim() || (!this.packet?.studentUid && isAnonymous(book.label.trim())))); }
  get heldCount(){return this.books.filter(book=>book.held&&!book.withdrawn).length;}
  get markingCount(){return this.books.filter(book=>!book.held&&!book.withdrawn).length;}
  get submitted(){return this.packet?.state==='completed';}
  get gradeLabel(){
    if(this.busy)return 'Saving…';
    if(!this.attachedPaper)return 'Choose question paper';
    if(this.packet?.studentUid)return 'Send for checking';
    if(!this.markingCount)return 'Save held books';
    return 'Check '+this.markingCount+' '+(this.markingCount===1?'book':'books');
  }
  get reviewing() { return !!this.packet && (this.packet.state === 'review' || this.manual); }
  get processing() { return this.packet?.state === 'queued' || this.packet?.state === 'running'; }
  get attachedPaper() { return this.packet?.gradingPaperId || this.packet?.paperId || this.paperId || ''; }
  get sourcesLocked() { return !!this.packet && this.packet.state === 'uploading'; }
  get incompleteUpload() { return !!this.packet && this.packet.state === 'uploading' && this.packet.uploaded.length < this.packet.pageCount; }
  get intakeOpen() { return !this.openedId || (!this.loadingDetail && this.packet?.state === 'uploading' && !this.manual); }
  get countMismatch() { return !!this.expectedCount && this.expectedCount !== this.books.length; }
  get submitProblem() {
    if (!this.books.length) return 'Add at least one book.';
    const seenPages = new Set<number>(), labels = new Set<string>();
    for (const book of this.books) {
      const label = book.label.trim().normalize('NFKC').toLocaleLowerCase();
      if (!book.held) {
        if (!label || (!this.packet?.studentUid && isAnonymous(label))) return 'Identify or hold the unnamed books before checking.';
        if (labels.has(label)) return 'Give every book a different roll number or label.';
        labels.add(label);
      }
      if (!book.pages.length || book.pages.length > this.bookLimit)
        return 'Each book needs between 1 and '+this.bookLimit+' pages.';
      for (const page of book.pages) {
        if (seenPages.has(page) || page < 1 || page > (this.packet?.pageCount ?? 0)) return 'A page is assigned incorrectly.';
        seenPages.add(page);
      }
    }
    if (seenPages.size !== this.packet?.pageCount) return 'Assign every scanned page to a book.';
    if (this.needsReview.length) return 'Confirm the books marked for review.';
    if (this.countMismatch && !this.countConfirmed) return 'Check the number of books before grading.';
    return '';
  }

  ngOnInit() {
    this.initialized = true;void this.listCameraDrafts();
    if (!this.packetId && this.studentUid) void this.loadStudent(this.studentUid);
    if (this.packetId) {
      this.pendingReference = this.referenceChoice > 0 ? this.paperId : '';
      void this.open(this.packetId, false);
    }
    const uid = this.api.user?.uid;
    if (uid) {
      try {
        this.unsubscribe = this.api.watchMarker('assistantUiNotifications/'+uid, event => {
          const marker = event.data?.['revision'];
          if (event.fromCache || typeof marker !== 'string' || marker === this.lastMarker) return;
          this.lastMarker = marker;
          if (this.busy) { this.freshAfterWork = true; return; }
          void this.refreshOnChange();
        }, () => {});
      } catch { /* The same status can be refreshed manually. */ }
    }
  }
  ngOnChanges(changes: SimpleChanges) {
    if(changes['paperId']&&this.staged)void this.saveCamera();
    if (this.initialized && changes['packetId'] && this.packetId !== this.openedId) {
      if (this.packetId) {
        this.pendingReference=this.referenceChoice>0?this.paperId:'';
        void this.open(this.packetId,false);
      } else this.home(false);
    }
    if (this.initialized && (changes['studentUid'] || changes['packetId']) && !this.packetId && !this.openedId &&
        this.studentUid !== this.lookupUid) void this.loadStudent(this.studentUid);
    if (this.initialized && changes['referenceChoice'] && this.referenceChoice > 0 && this.paperId && this.openedId) {
      this.pendingReference = this.paperId;
      void this.applyReference();
    }
  }
  private async applyReference() {
    if (!this.packet || !this.pendingReference || this.busy || this.loadingDetail || this.destroyed) return;
    const paperId=this.pendingReference, packet=this.packet;
    this.pendingReference='';
    const previous = packet.gradingPaperId || packet.paperId || '';
    if (paperId===previous) return;
    const recheck = packet.state==='completed';
    if (recheck || previous) {
      const selected=this.referenceTitle ? '“'+this.referenceTitle+'”' : 'the newly selected question paper';
      const message = recheck
        ? 'Recheck this class using '+selected+'? Previous marks, including finalized marks, will be removed from current results. Held and withdrawn books will stay out of marking. Return fresh copies if you already handed out results.'
        : 'Use '+selected+' to mark this stack?';
      if (!window.confirm(message)) { this.linkedPaper.emit(previous); return; }
    }
    await this.work(async()=>{
      try {
        let updated:Packet;
        if (recheck) {
          const prior=this.recheckRequest;
          if (!prior || prior.packetId!==packet.id || prior.paperId!==paperId || prior.version!==packet.version)
            this.recheckRequest={packetId:packet.id,paperId,version:packet.version,requestId:crypto.randomUUID()};
          const result=await this.api.request<{packet:Packet; recheck:{queued:number;held:number;withdrawn:number}}>(
            this.path(packet.id)+'/recheck','POST',{version:packet.version,paperId,requestId:this.recheckRequest!.requestId});
          updated=result.packet;
          this.notice=result.recheck.queued+' books queued for checking against the corrected paper.';
          this.recheckRequest=undefined;
        } else {
          ({packet:updated}=await this.api.request<{packet:Packet}>(this.path(packet.id)+'/reference','POST',{version:packet.version,paperId}));
        }
        if (!this.destroyed && this.openedId===packet.id) {
          this.packet=updated;
          if(!this.dirty && updated.state==='review' && packet.state!=='review')this.setBooks(updated.groups);
          this.linkedPaper.emit(updated.gradingPaperId||updated.paperId||'');
        }
      } catch(e) {
        this.linkedPaper.emit(previous);
        throw e;
      }
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.unsubscribe?.();
    this.detailRequest++; this.listRequest++; this.previewRequest++;
    this.closeSource(); this.releaseImages();
  }
  @HostListener('window:beforeunload', ['$event'])
  warnWhenLeaving(event: BeforeUnloadEvent) {
    if (this.hasLocalChanges) { event.preventDefault(); event.returnValue=''; }
  }

  stateLabel(state: PacketState) {
    return {uploading:'Upload incomplete',queued:'Waiting to organize',running:'Finding books',review:'Match student books',completed:'Sent for marking',failed:'Needs attention'}[state];
  }
  async loadRecent(more = false) {
    if (this.destroyed || (more && (!this.cursor || this.loadingList))) return;
    const n = ++this.listRequest;
    this.loadingList = true;
    try {
      const result = more
        ? await this.api.request<PacketList>(base+'/history','POST',{cursor:this.cursor})
        : await this.api.request<PacketList>(base);
      if (this.destroyed || n !== this.listRequest) return;
      const old = more ? this.recent : [];
      const ids = new Set(old.map(p => p.id));
      this.recent = [...old,...result.packets.filter(p => !ids.has(p.id))];
      this.cursor = result.nextCursor ?? '';
      this.historyLoaded = true;
    } catch (e) { if (n === this.listRequest && !this.destroyed) this.error = this.describe(e); }
    finally { if (n === this.listRequest) { this.loadingList = false; this.ready = true; this.paint(); } }
  }
  private async refreshOnChange() {
    if(this.destroyed)return;
    if(this.busy||this.processingRefresh){this.freshAfterWork=true;return;}
    this.processingRefresh = true;
    try {
      if (this.processing && this.openedId) await this.open(this.openedId, false, true);
      else if (this.historyOpen && !this.openedId && this.recent.some(p => ['queued','running'].includes(p.state))) await this.loadRecent();
    } finally {
      this.processingRefresh=false;
      if(this.freshAfterWork&&!this.busy){this.freshAfterWork=false;void this.refreshOnChange();}
    }
  }
  async open(id: string, publish = true, quiet = false) {
    if (this.busy || this.destroyed) return;
    if (id !== this.openedId && this.hasLocalChanges && !window.confirm('Leave these unsaved changes?')) return;
    const changing = id !== this.openedId;
    this.historyOpen=false;
    if (changing) {
      if (publish) this.pendingReference='';
      this.resetForm(); this.packet = undefined; this.openedId = id;
      if (publish) this.packetChange.emit(id);
    }
    const n = ++this.detailRequest;
    if (!quiet) { this.loadingDetail = true; this.error = ''; }
    try {
      const {packet} = await this.api.request<{packet:Packet}>(this.path(id));
      if (this.destroyed || n !== this.detailRequest || id !== this.openedId) return;
      this.apply(packet);
      if (changing && !this.pendingReference) this.linkedPaper.emit(packet.gradingPaperId||packet.paperId||'');
    } catch (e) {
      if (n === this.detailRequest && id === this.openedId && !this.destroyed) this.error = this.describe(e);
    } finally {
      if (n === this.detailRequest) { this.loadingDetail = false; this.ready = true; this.paint(); void this.applyReference(); }
    }
  }
  async openRecent(recent:PacketSummary) {
    await this.open(recent.id);
    if (!this.destroyed && this.packet?.id===recent.id && this.packet.state==='completed') this.openResults();
  }
  async reload() {
    if (!this.openedId || this.busy) return;
    if (this.dirty && !window.confirm('Discard the unsaved changes and reload the saved book list?')) return;
    this.dirty = false; this.manual = false; this.changed();
    await this.open(this.openedId, false);
  }
  home(publish = true) {
    if (this.busy || (publish && this.hasLocalChanges && !window.confirm('Leave these unsaved changes?'))) return;
    this.openedId=''; this.pendingReference=''; this.packet=undefined; this.loadingDetail=false; this.detailRequest++;
    this.resetForm(); this.single=true; this.setScanLocation(0); if (publish) { this.packetChange.emit(''); this.linkedPaper.emit(''); } this.historyLoaded=false;
  }
  private resetForm() {
    this.studentRequest++;this.lookupUid='';this.student=null;this.studentLoading=false;this.studentError='';
    this.staged=undefined;this.cameraSaved=false;void this.listCameraDrafts();this.correcting=false;this.correction?.reset();this.closeSource(); this.releaseImages(); this.sources=[];this.savedDuringUpload=0; this.createId=''; this.defaultLabel=''; this.books=[];
    this.selectedKey=0; this.selectedPage=0; this.dirty=false; this.manual=false;
    this.countConfirmed=false; this.expected=null; this.label=''; this.notice=''; this.error='';
    this.resetMove(); this.changed();
  }
  private apply(packet: Packet) {
    this.packet=packet; this.openedId=packet.id;
    this.single=!!packet.studentUid || (packet.state==='uploading' && packet.expectedStudents===1);
    const fingerprints=new Map<string,number[]>();
    for(const {index,sha} of packet.uploaded){const pages=fingerprints.get(sha)??[];pages.push(index);fingerprints.set(sha,pages);}
    this.matchingScans=Array.from(fingerprints.values()).filter(pages=>pages.length>1);
    this.recent = [packet, ...this.recent.filter(p=>p.id!==packet.id)];
    if (packet.state === 'review' && !this.dirty) this.setBooks(packet.groups);
    if (packet.state === 'completed') {
      this.dirty=false;this.manual=false;this.setBooks(packet.groups);this.changed();
    }
    this.paint();
  }

  get missingSources(){return this.sources.filter(s=>s.missingSize!==undefined).length;}
  get cameraCount(){return this.sources.filter(s=>s.cameraKey).length;}
  get availableCameraDrafts(){
    if (this.sources.length) return [];
    return this.localDrafts.filter(draft => this.openedId ? draft.packetId === this.openedId :
      !this.lookupUid || draft.studentUid === this.lookupUid);
  }
  cameraPages(draft:CameraDraft){return draft.sources.filter(s=>s.key).length;}
  private async listCameraDrafts(){
    const owner=this.api.user?.uid;if(!owner){this.cameraUnavailable=true;return;}
    try {
      const drafts=await cameraDrafts(owner);
      if(!this.destroyed&&this.api.user?.uid===owner){this.localDrafts=drafts;this.cameraUnavailable=false;}
    }catch{if(!this.destroyed)this.cameraUnavailable=true;}
    this.paint();
  }
  async saveCamera(){
    const owner=this.api.user?.uid;if(!owner||this.destroyed)return;
    const cameras=this.sources.filter(s=>!!s.cameraKey);
    if(!cameras.length){
      if(this.staged)await this.eraseActiveCamera();
      return;
    }
    const stage=this.staged??={id:crypto.randomUUID(),revision:0,owner,known:new Set<string>(),writes:Promise.resolve()};
    const sources=this.sources.map(s=>({key:s.cameraKey||'',veryDark:!!s.veryDark,name:s.file.name,size:s.missingSize??s.file.size,modified:s.file.lastModified,pages:s.pages,starts:s.starts,rotations:[...s.rotations]}));
    const manifest:CameraDraft={id:stage.id,owner,revision:0,updated:0,expires:0,packetId:this.openedId,
      paperId:this.paperId,createId:this.createId,defaultLabel:this.defaultLabel || (this.single?this.studentLabel:''),label:this.label,expected:this.expected,single:this.single,studentUid:this.single?(this.packet ? this.packet.studentUid : this.lookupUid || undefined):undefined,sources};
    this.cameraSaving++;this.changed();
    const pending=stage.writes.then(async()=>{
      if(this.api.user?.uid!==owner)return;
      manifest.revision=stage.revision;
      const images=cameras.filter(s=>!stage.known.has(s.cameraKey!)).map(s=>({key:s.cameraKey!,blob:s.file}));
      stage.revision=await storeCameraDraft(manifest,images);
      for(const i of images)stage.known.add(i.key);
    });
    stage.writes=pending.catch(()=>{});
    try{await pending;if(!this.destroyed && this.staged===stage){this.cameraUnavailable=false;this.cameraSaved=true;}}
    catch{if(!this.destroyed && this.staged===stage){this.cameraUnavailable=true;this.cameraSaved=false;}}
    finally{if(!this.destroyed){this.cameraSaving--;this.changed();this.paint();}}
  }
  private async eraseActiveCamera(){
    const stage=this.staged;if(!stage)return;
    this.staged=undefined;this.cameraSaved=false;
    try{
      await stage.writes;await clearCameraDraft(stage.owner,stage.id);
      this.localDrafts=this.localDrafts.filter(d=>d.id!==stage.id);
    }catch{this.cameraUnavailable=true;}
  }
  async discardCamera(draft?:CameraDraft){
    const owner=this.api.user?.uid;if(!owner||this.busy)return;
    if(!window.confirm('Remove these camera photos saved on this device?'))return;
    await this.work(async()=>{
      if(draft){
        await clearCameraDraft(owner,draft.id);this.localDrafts=this.localDrafts.filter(d=>d.id!==draft.id);
      }else{
        await this.eraseActiveCamera();
        if(this.sourceView?.cameraKey)this.closeSource();
        this.sources=this.sources.filter(s=>!s.cameraKey);this.changed();
      }
    });
  }
  async restoreCamera(draft:CameraDraft){
    const owner=this.api.user?.uid;if(!owner||this.busy||this.sources.length)return;
    if(draft.packetId&&draft.packetId!==this.openedId)await this.open(draft.packetId);
    if(draft.packetId&&this.packet?.id!==draft.packetId)return;
    await this.work(async()=>{
      const {manifest,files}=await loadCameraDraft(owner,draft.id);
      if(this.destroyed||this.api.user?.uid!==owner)return;
      if(this.packet&&this.packet.state!=='uploading'){
        await clearCameraDraft(owner,draft.id);this.localDrafts=this.localDrafts.filter(d=>d.id!==draft.id);return;
      }
      this.staged={id:draft.id,revision:manifest.revision,owner,known:new Set(files.keys()),writes:Promise.resolve()};
      this.sources=manifest.sources.map(s=>({
        file:files.get(s.key)??new File([],s.name,{lastModified:s.modified}),
        ...(s.key?{cameraKey:s.key}:{missingSize:s.size}),veryDark:s.veryDark,pages:s.pages,starts:s.starts,rotations:new Map(s.rotations)
      }));
      this.label=manifest.label;this.expected=manifest.expected;this.single=this.packet ? !!this.packet.studentUid || this.packet.expectedStudents===1 : manifest.single??false;this.createId=manifest.createId;this.defaultLabel=manifest.defaultLabel;
      if(!this.packet){
        const uid=manifest.single ? manifest.studentUid || '' : '';
        await this.loadStudent(uid);
        this.studentChange.emit(uid);
        this.linkedPaper.emit(manifest.paperId || '');
      }
      this.cameraSaved=true;this.cameraUnavailable=false;this.changed();
    });
  }

  async add(event: Event, camera=false) {
    const input=event.target as HTMLInputElement, files=Array.from(input.files??[]);
    input.value='';
    await this.addFiles(files,camera);
  }
  drag(event:DragEvent,delta:number) {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragDepth=Math.max(0,this.dragDepth+delta);
  }
  async drop(event:DragEvent) {
    event.preventDefault();this.dragDepth=0;
    await this.addFiles(Array.from(event.dataTransfer?.files||[]));
  }
  private async addFiles(files:File[],camera=false) {
    if (!files.length || this.busy) return;
    await this.work(async () => {
      const errors:string[]=[];let duplicates=0;let darkCapture=false;
      for (const [i,original] of files.entries()) {
        let file=original;let veryDark=false;
        this.progress='Reading file '+(i+1)+' of '+files.length+'…'; this.paint();
        try {
          const pages=await packetFilePageCount(file);
          if(camera){
            const scan=await previewPacketPage(file,1,0);
            try{veryDark=!!scan.veryDark;file=new File([scan.blob],original.name,{type:'image/jpeg',lastModified:original.lastModified});}
            finally{URL.revokeObjectURL(scan.url);}
          }
          if(this.destroyed)return;
          const missing=this.sources.find(s=>s.missingSize===file.size&&s.file.name===file.name&&s.pages===pages);
          if(missing){missing.file=file;delete missing.missingSize;continue;}
          let duplicate=false;
          if(!camera)for (const existing of this.sources) { if(await sameSource(existing.file,file)){duplicate=true;break;} }
          if (duplicate) {duplicates++;continue;}
          if (this.destroyed) return;
          const limit=this.packet?.pageCount??(this.single?this.bookLimit:this.pageLimit);
          if (!pages || this.pageTotal+pages>limit) throw Error('This would exceed '+limit+' pages in the stack.');
          darkCapture ||= veryDark;
          this.sources.push({file,pages,veryDark,starts:false,rotations:new Map(),...(camera?{cameraKey:crypto.randomUUID()}:{})});
        } catch(e) { errors.push(file.name+' — '+this.describe(e)); }
      }
      await this.saveCamera();
      if (duplicates) this.notice=duplicates+(duplicates===1?' file is':' files are')+' already in this stack.';
      if (darkCapture) this.notice='This photo looks very dark. Preview it and retake it in better light if the writing is hard to read.';
      if (errors.length) this.error=errors.slice(0,3).join(' ')+(errors.length>3?' '+(errors.length-3)+' other files could not be added.':'');
      this.changed();
    });
  }
  reorderSource(source:Source,step:number) {
    const i=this.sources.indexOf(source), j=i+step;
    if (this.busy || i<0 || j<0 || j>=this.sources.length) return;
    [this.sources[i],this.sources[j]]=[this.sources[j],this.sources[i]];void this.saveCamera();
  }
  removeSource(source:Source) {
    if (this.busy) return;
    this.sources=this.sources.filter(s=>s!==source);
    if (this.sourceView===source) this.closeSource();
    this.changed();void this.saveCamera();
  }
  toggleFileStarts(enabled:boolean) { this.sources.forEach((source,i)=>source.starts=i>0&&enabled);void this.saveCamera(); }
  async inspectSource(source:Source,index=1) {
    this.closeSource();
    this.sourceView=source; this.sourceIndex=index; this.readingPreview=true;
    const n=++this.sourceRequest;
    try {
      const preview=await previewPacketPage(source.file,index,source.rotations.get(index)??0);
      if (this.destroyed || n!==this.sourceRequest) URL.revokeObjectURL(preview.url);
      else this.sourcePreview=preview;
    } catch(e) { if (n===this.sourceRequest) this.error=this.describe(e); }
    finally { if (n===this.sourceRequest) {this.readingPreview=false;this.paint();} }
  }
  turnSource() {
    if (!this.sourceView || this.readingPreview) return;
    this.sourceView.rotations.set(this.sourceIndex,((this.sourceView.rotations.get(this.sourceIndex)??0)+1)%4);
    void this.saveCamera();void this.inspectSource(this.sourceView,this.sourceIndex);
  }
  closeSource() {
    this.sourceRequest++;
    if (this.sourcePreview) URL.revokeObjectURL(this.sourcePreview.url);
    this.sourcePreview=undefined; this.sourceView=undefined; this.readingPreview=false;
  }
  async upload() {
    if (this.busy || this.missingSources || !this.sources.length || (this.packet && this.pageTotal!==this.packet.pageCount)) return;
    if (!this.packet && this.accountCheck && !this.student) {this.error='Choose the student who sent these pages.';return;}
    if (this.accountCheck && !this.attachedPaper) {this.needPaper.emit(this.openedId);return;}
    if(this.single && this.pageTotal>this.bookLimit){this.error='One answer book can contain up to '+this.bookLimit+' pages.';return;}
    if (!this.single && this.expected!==null && (!Number.isInteger(this.expected)||this.expected<1||this.expected>180)) { this.error='Enter the number of students present, between 1 and 180.'; return; }
    const selectedPaper=this.attachedPaper;
    const requestedUid=this.accountCheck ? this.packet?.studentUid || this.student?.uid : undefined;
    const directGroups=requestedUid ? undefined : this.knownBooks();
    this.closeSource();this.savedDuringUpload=this.packet?.uploaded.length??0;
    await this.work(async () => {
      if (!this.packet) {
        let start=1;
        const knownStarts=this.sources.flatMap((source,i)=>{ const index=start;start+=source.pages;return i===0||source.starts?[index]:[]; });
        this.createId ||= crypto.randomUUID();
        this.defaultLabel ||= this.student?.displayName || (this.single?'Answer book · ':'Class stack · ')+new Date().toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
        if(this.staged)await this.saveCamera();
        const {packet}=await this.api.request<{packet:Packet}>(base,'POST',{
          id:this.createId,pageCount:this.pageTotal,expectedStudents:this.single?1:this.expected,
          label:this.label.trim()||this.defaultLabel,...(this.paperId?{paperId:this.paperId}:{}),
          ...(requestedUid?{studentUid:requestedUid}:{}),knownStarts
        });
        if (this.destroyed) return;
        if ((packet.studentUid || undefined) !== requestedUid)
          throw Error('This upload could not be verified for the selected student. Reload before retrying.');
        this.apply(packet); this.packetChange.emit(packet.id);if(this.staged)await this.saveCamera();
      }
      const packet=this.packet!;
      if (packet.state!=='uploading') {
        await this.eraseActiveCamera();this.sources=[];this.changed();
        if (packet.state==='completed') this.openResults();
        return;
      }
      const saved=new Map(packet.uploaded.map(p=>[p.index,p.sha]));
      const contiguous=packet.uploaded.every(p=>p.index<=saved.size);
      if (saved.size && !contiguous) await this.uploadPages(packet,saved,true);
      await this.uploadPages(packet,saved,false);
      if (this.destroyed) return;
      if (packet.studentUid) {
        await this.submitStudentBook(selectedPaper);
        return;
      }
      this.progress=directGroups ? 'Saving the book list…' : 'Finding where each book starts…'; this.paint();
      if (directGroups) {
        await this.readCurrent();
        const current=this.packet!;
        const {packet:updated}=await this.api.request<{packet:Packet}>(this.path(current.id)+'/save','POST',{
          version:current.version,groups:directGroups
        });
        if (!this.destroyed) this.apply(updated);
      } else {
        await this.api.request(this.path(packet.id)+'/organize','POST',{});
        await this.readCurrent();
      }
      await this.eraseActiveCamera();this.sources=[];this.changed();
    });
  }
  async finishStudentUpload() {
    if (!this.packet?.studentUid || this.busy || this.incompleteUpload) return;
    if (!this.attachedPaper) { this.needPaper.emit(this.openedId); return; }
    const selectedPaper=this.attachedPaper;
    await this.work(() => this.submitStudentBook(selectedPaper));
  }

  private async submitStudentBook(selectedPaper:string) {
    this.progress = 'Sending the answer sheet for checking…'; this.paint();
    await this.readCurrent();
    const packet = this.packet;
    if (this.destroyed || !packet?.studentUid) return;
    const currentPaper=packet.gradingPaperId || packet.paperId || '';
    if (currentPaper !== selectedPaper) {
      this.linkedPaper.emit(currentPaper);
      throw Error('The question paper changed during upload. Review the current paper before sending again.');
    }
    if (packet.state === 'uploading') {
      if (!packet.studentLabel) throw Error('The student account on this upload could not be verified.');
      const group: Book = {label:packet.studentLabel, pages:Array.from({length:packet.pageCount}, (_, i) => i+1), needsReview:false, reason:''};
      const {packet: submitted} = await this.api.request<{packet:Packet}>(this.path(packet.id)+'/confirm','POST',{
        version:packet.version, paperId:selectedPaper, groups:[group],
      });
      if (this.destroyed) return;
      this.packet=submitted;
    }
    await this.eraseActiveCamera();
    this.sources=[]; this.changed();
    if (this.packet?.state === 'review') await this.submitBooks();
    else if (this.submitted) this.openResults();
  }

  private knownBooks():Book[]|undefined {
    if (this.single) return [{label:'',pages:Array.from({length:this.pageTotal},(_,i)=>i+1),needsReview:true,
      reason:'Read the cover and enter the student’s roll number or book label.'}];
    if (!this.allPdfs || !this.separateFiles) return;
    let first=1;
    return this.sources.map(source=>{
      const pages=Array.from({length:source.pages},(_,i)=>first+i);first+=source.pages;
      return {label:source.file.name.replace(/\.pdf$/i,'').slice(0,100),pages,needsReview:true,
        reason:'The label comes from the filename. Check it against the cover.'};
    });
  }
  private async uploadPages(packet:Packet,saved:Map<number,string>,verifyOnly:boolean) {
    let i=0;
    for (const source of this.sources) {
      for await (const scan of readScanPages(source.file,packet.pageCount-i,true,source.rotations)) {
        try {
          if (this.destroyed) return;
          i++;
          const prior=saved.get(i);
          this.progress=(prior?'Verifying saved page ':'Saving page ')+i+' of '+packet.pageCount+'…';this.paint();
          const jpeg=await scanBase64(scan.blob);
          if (prior) {
            const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([jpeg])));
            const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
            if (hash!==prior) throw Error('Page '+i+' differs from the saved scan. Select the original files in their original order and orientation, or start a new stack.');
          } else if (!verifyOnly) {
            await this.api.request(this.path(packet.id)+'/pages/'+i,'POST',{jpeg});
            this.savedDuringUpload++;this.paint();
          }
        } finally { URL.revokeObjectURL(scan.url); }
      }
    }
    if (!this.destroyed && i!==packet.pageCount) throw Error('Select the original '+packet.pageCount+' pages before continuing.');
  }
  async organize() {
    if (!this.packet || this.busy) return;
    await this.work(async()=>{
      await this.api.request(this.path(this.packet!.id)+'/organize','POST',this.packet!.state==='failed'?{version:this.packet!.version}:{});
      await this.readCurrent();
    });
  }
  async readCurrent() {
    const id=this.openedId;
    if (!id) return;
    const {packet}=await this.api.request<{packet:Packet}>(this.path(id));
    if (!this.destroyed && this.openedId===id) this.apply(packet);
  }
  async switchToManual() {
    const packet=this.packet;
    if(!packet||!this.processing||this.busy)return;
    await this.work(async()=>{
      const {packet:updated}=await this.api.request<{packet:Packet}>(this.path(packet.id)+'/manual','POST',{version:packet.version});
      if(!this.destroyed&&this.openedId===packet.id)this.apply(updated);
    });
  }
  manualGrouping() {
    if (!this.packet || this.busy || this.packet.uploaded.length!==this.packet.pageCount) return;
    this.manual=true;
    this.setBooks(this.packet.groups);
    this.dirty=true; this.changed();
  }

  private setBooks(groups:Book[]) {
    this.books=groups.map(b=>({...b,pages:[...b.pages],key:this.nextKey++}));
    const assigned=new Set(this.books.flatMap(book=>book.pages));
    const remaining=Array.from({length:this.packet!.pageCount},(_,i)=>i+1).filter(p=>!assigned.has(p));
    if (remaining.length) this.books.push({key:this.nextKey++,label:'',pages:remaining,reason:'Identify this book or move these pages to the correct book.',needsReview:true});
    this.countConfirmed=false;
    const url=new URL(location.href);
    let requested=url.searchParams.get('packet')===this.openedId?Number(url.searchParams.get('scan')):0;
    if (!requested && this.api.user?.uid) {
      try { requested=Number(sessionStorage.getItem(this.scanCursorKey)); } catch { /* Private browsing can disable storage. */ }
    }
    const restored=requested?this.books.find(book=>!book.withdrawn && book.pages.includes(requested)):undefined;
    const focus=restored??this.needsReview[0]??this.books.find(b=>!b.withdrawn&&b.held)??this.books.find(b=>!b.withdrawn);
    if (focus) this.selectBook(focus,restored?requested:undefined);
  }
  reviewNext() {
    const book=this.needsReview[0];
    if (!book) return;
    this.selectBook(book);
    requestAnimationFrame(()=>this.bookDetail?.nativeElement.scrollIntoView({block:'nearest'}));
  }
  selectBook(book:DraftBook,page?:number) {
    this.selectedKey=book.key; this.resetMove();
    this.keepCurrentBookVisible();

    if (book.pages.length) void this.showPage(page??book.pages[0]);
  }
  @HostListener('window:resize')
  keepCurrentBookVisible() {
    if(!this.books.length)return;
    requestAnimationFrame(()=>{
      const list=this.bookList?.nativeElement, active=list?.querySelector<HTMLElement>('.book-row.active');
      if(this.destroyed||!list||!active)return;
      const bounds=list.getBoundingClientRect(), row=active.getBoundingClientRect();
      if(row.right>bounds.right)list.scrollLeft+=row.right-bounds.right;
      else if(row.left<bounds.left)list.scrollLeft+=row.left-bounds.left;
      if(row.bottom>bounds.bottom)list.scrollTop+=row.bottom-bounds.bottom;
      else if(row.top<bounds.top)list.scrollTop+=row.top-bounds.top;
    });
  }
  private get scanCursorKey() {return 'gtop:scan:'+this.api.user?.uid+':'+this.openedId;}
  private setScanLocation(index:number) {
    const url=new URL(location.href);
    if (index) {
      url.searchParams.set('scan',String(index));
      if (this.api.user?.uid) {
        try { sessionStorage.setItem(this.scanCursorKey,String(index)); } catch { /* URL still preserves the selection. */ }
      }
    } else url.searchParams.delete('scan');
    history.replaceState(history.state,'',url);
  }
  async showPage(index:number) {
    const id=this.openedId;
    if (!id) return;
    this.setScanLocation(index);
    this.selectedPage=index; this.zoomed=false; this.imageError=''; this.imageUrl='';
    const n=++this.previewRequest;
    if (this.imagePacket!==id) { this.releaseImages(); this.imagePacket=id; }
    const cached=this.imageCache.get(index);
    if (cached) {this.imageUrl=cached;return;}
    try {
      const blob=await this.api.checkingImage(this.path(id)+'/pages/'+index);
      if (this.destroyed || this.openedId!==id || n!==this.previewRequest) return;
      const url=URL.createObjectURL(blob); this.imageCache.set(index,url); this.imageUrl=url;
      while (this.imageCache.size>7) {
        const key=this.imageCache.keys().next().value as number;
        URL.revokeObjectURL(this.imageCache.get(key)!); this.imageCache.delete(key);
      }
    } catch(e) { if (n===this.previewRequest) this.imageError=this.describe(e); }
    finally { if (n===this.previewRequest) this.paint(); }
  }
  private releaseImages() {
    for (const url of this.imageCache.values()) URL.revokeObjectURL(url);
    this.imageCache.clear(); this.imageUrl=''; this.imagePacket='';
  }
  inspectMatchingPage(index:number) {
    const owner=this.books.find(b=>b.pages.includes(index));
    if(owner){this.selectBook(owner);void this.showPage(index);}
  }
  previousPage(step:number) {
    const book=this.book;
    if (!book) return;
    const j=book.pages.indexOf(this.selectedPage)+step;
    if (j>=0 && j<book.pages.length) void this.showPage(book.pages[j]);
  }
  editLabel(book:DraftBook,label:string) {
    book.label=label;if(!label.trim()||isAnonymous(label.trim()))book.needsReview=true;this.edit();
  }
  confirmBook() {
    const book=this.book;
    if (!book?.label.trim()) { this.error='Enter a roll number or a distinctive book label first.';return; }
    if (isAnonymous(book.label.trim())) {this.error='Enter a student name or roll number, or hold this book for identification.';return;}
    if (this.books.some(b=>!b.held&&b.key!==book.key&&b.label.trim().normalize('NFKC').toLocaleLowerCase()===book.label.trim().normalize('NFKC').toLocaleLowerCase())) {this.error='Another book already has this label.';return;}
    if (book.pages.length>this.bookLimit) {this.error='Split this book into booklets of up to '+this.bookLimit+' pages before checking.';return;}
    book.needsReview=false;book.reason='';this.edit();
    const next=this.needsReview[0];if(next)this.selectBook(next);
  }
  holdBook(book:DraftBook) {
    book.held=!book.held;book.needsReview=!book.held;
    this.edit();
    const next=this.needsReview[0];if(book.held&&next)this.selectBook(next);
  }
  setCorrectionPending(active:boolean){this.correcting=active;this.changed();}
  async applyCorrection(request:ScanCorrection) {
    const selected=this.book,initial=this.packet;
    if(!initial||!selected||this.busy)return;
    const groupIndex=this.books.indexOf(selected);
    await this.work(async()=>{
      if(this.dirty||this.manual)await this.persistDraft();
      if(this.destroyed||this.openedId!==initial.id)return;
      const {packet:updated}=await this.api.request<{packet:Packet}>(this.path(initial.id)+'/correct','POST',{...request,version:this.packet!.version});
      if(this.destroyed||this.openedId!==initial.id)return;
      this.correcting=false;this.correction?.reset();this.releaseImages();this.apply(updated);
      const dest=request.op==='move'?request.targetBookId:selected.sheetId;
      const focus=dest?this.books.find(b=>b.sheetId===dest):this.books[groupIndex];
      if(focus) {
        this.selectBook(focus);
        const page=request.op==='append'?updated.pageCount:request.page;
        if(page&&focus.pages.includes(page))void this.showPage(page);
      }
      this.notice=request.op==='identify'?'Student identified. This book is queued for marking.':request.op==='move'?'Page moved to its student book.':request.op==='replace'?'Replacement scan saved.':'Missing page added to the book.';
    });
  }
  splitHere() {
    const book=this.book,j=book?.pages.indexOf(this.selectedPage)??-1;
    if (!book || j<=0) return;
    const split:DraftBook={key:this.nextKey++,label:'',pages:book.pages.splice(j),needsReview:true,reason:'Enter the roll number or a book label.'};
    this.books.splice(this.books.indexOf(book)+1,0,split);
    this.countConfirmed=false;this.edit();this.selectBook(split);
  }
  reorderPage(step:number) {
    const book=this.book,i=book?.pages.indexOf(this.selectedPage)??-1,j=i+step;
    if(!book||i<0||j<0||j>=book.pages.length)return;
    [book.pages[i],book.pages[j]]=[book.pages[j],book.pages[i]];
    this.edit();
  }
  toggleMove() {
    if (this.moving) this.resetMove();
    else {this.moving=true;this.selectedPages=new Set([this.selectedPage]);this.moveTarget='';}
  }
  private resetMove() {this.moving=false;this.selectedPages.clear();this.moveTarget='';}
  toggleSelected(page:number,checked:boolean) {if(checked)this.selectedPages.add(page);else this.selectedPages.delete(page);}
  toggleAllPages(yes:boolean) {this.selectedPages=new Set(yes?this.book?.pages??[]:[]);}
  movePages() {
    const source=this.book;
    if(!source||!this.selectedPages.size||!this.moveTarget)return;
    let destination=this.books.find(b=>String(b.key)===this.moveTarget);
    if(this.moveTarget==='new') {
      destination={key:this.nextKey++,label:'',pages:[],needsReview:true,reason:'Enter the roll number or a book label.'};
      this.books.push(destination);
    }
    if(!destination||source===destination)return;
    const picked=source.pages.filter(n=>this.selectedPages.has(n));
    destination.pages.push(...picked);
    source.pages=source.pages.filter(n=>!this.selectedPages.has(n));
    if(!source.pages.length)this.books=this.books.filter(b=>b!==source);
    this.countConfirmed=false;this.edit();this.selectBook(destination);if(picked.length)void this.showPage(picked[0]);
  }
  pageRange(pages:number[]) {
    const ranges:string[]=[];
    let i=0;
    while(i<pages.length) {
      const start=pages[i]; let end=start;
      while(i+1<pages.length&&pages[i+1]===end+1)end=pages[++i];
      ranges.push(start===end?String(start):start+'–'+end); i++;
    }
    return ranges.join(', ');
  }
  private edit() {this.dirty=true;this.error='';this.notice='';this.changed();}
  private payload() {return this.books.map(b=>({label:b.label.trim(),pages:b.pages,needsReview:b.needsReview,reason:b.reason,...(b.held?{held:true}:{})}));}
  async deleteStack() {
    const packet=this.packet;
    if (!packet || this.busy || packet.state==='completed') return;
    if (!window.confirm('Delete “'+packet.label+'” and its '+packet.uploaded.length+' saved scan pages? This cannot be undone.')) return;
    await this.work(async()=>{
      await this.api.request(this.path(packet.id)+'/delete','POST',{version:packet.version});
      if(this.destroyed)return;
      this.openedId='';this.packet=undefined;this.resetForm();this.packetChange.emit('');this.linkedPaper.emit('');
      await this.loadRecent();
    });
  }
  async saveDraft() {
    if (!this.packet || this.busy || !this.dirty) return;
    await this.work(async()=>{await this.persistDraft();this.notice='Book list saved.';});
  }
  private async persistDraft() {
    const packet=this.packet!;
    const {packet:updated}=await this.api.request<{packet:Packet}>(this.path(packet.id)+'/save','POST',{
      version:packet.version,groups:this.payload(),...(this.attachedPaper?{paperId:this.attachedPaper}:{})
    });
    if (this.destroyed) return;
    this.dirty=false;this.manual=false;this.packet=updated;
    this.recent=[updated,...this.recent.filter(p=>p.id!==updated.id)];
    this.changed();
  }
  async grade() {
    if (!this.packet || this.submitted || this.busy || this.correcting || this.submitProblem) return;
    if (!this.attachedPaper) {
      await this.work(async()=>{
        if (this.dirty||this.manual) await this.persistDraft();
        if (!this.destroyed) this.needPaper.emit(this.openedId);
      });return;
    }
    await this.work(() => this.submitBooks());
  }

  private async submitBooks() {
    const packet=this.packet!;
    await this.api.request(this.path(packet.id)+'/confirm','POST',{
      version:packet.version,paperId:this.attachedPaper,groups:this.payload()
    });
    this.dirty=false;await this.readCurrent();
    if (this.packet?.state==='completed') this.openResults();
  }
  openResults() {
    const packet=this.packet;
    if(packet?.state!=='completed'||!packet.paperId)return;
    const sheetIds=packet.groups.flatMap(b=>b.sheetId?[b.sheetId]:[]);
    this.queued.emit({packetId:packet.id,paperId:packet.paperId,sheetIds,
      ...(packet.studentUid && sheetIds.length===1 ? {sheetId:sheetIds[0]} : {})});
  }
  get canSave() { return this.dirty; }
  private path(id:string) { return base+'/'+encodeURIComponent(id); }
  private async work(fn:()=>Promise<void>) {
    if(this.busy)return;
    this.busy=true;this.busyChange.emit(true);this.error='';this.notice='';this.progress='';this.paint();
    try{await fn();}
    catch(e){
      if(!this.destroyed) {
        const message=this.describe(e);
        if(this.openedId&&this.packet?.state==='uploading'){
          try{await this.readCurrent();}catch{/* Keep the original upload error. */}
        }
        this.error=message;
      }
    }
    finally{
      this.busy=false;this.progress='';
      if(!this.destroyed){
        this.busyChange.emit(false);this.changed();this.paint();
        if(this.freshAfterWork){this.freshAfterWork=false;void this.refreshOnChange();}
        void this.applyReference();
      }
    }
  }
  private changed() {
    const active=this.hasLocalChanges;
    if(this.lastSelection!==active){this.lastSelection=active;this.selectionChange.emit(active);}
  }
  private paint() { if(!this.destroyed)this.cd.markForCheck(); }
  private describe(e:unknown) {return e instanceof Error?e.message:'The stack could not be updated. Try again.';}
}
