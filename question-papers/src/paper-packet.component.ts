import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssistantApi } from './api.service';
import { isScanPdf, maxCheckingPages, packetFilePageCount, previewPacketPage, readScanPages, scanBase64, type Scan } from './checking-intake';

type PacketState = 'uploading' | 'queued' | 'running' | 'review' | 'completed' | 'failed';
type Source = { file: File; pages: number; starts: boolean; rotations: Map<number, number> };
type Book = { label: string; pages: number[]; needsReview: boolean; reason: string; sheetId?: string };
type DraftBook = Book & { key: number };
type StoredPage = { index: number; sha: string; width: number; height: number };
type PacketSummary = {
  id: string; label: string; pageCount: number; expectedStudents: number | null; paperId: string | null;
  state: PacketState; version: number; processedPages: number; updatedAt: string; createdAt: string;
};
type Packet = PacketSummary & { uploaded: StoredPage[]; groups: Book[]; error?: string };
type PacketList = { packets: PacketSummary[]; nextCursor?: string };
export type QueuedPacket = { packetId: string; paperId: string; sheetIds: string[] };
const base = '/checking/packets';
const maxStackPages = 200;

@Component({
  selector: 'gtop-paper-packet', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './paper-packet.html', styleUrl: './paper-packet.css'
})
export class PaperPacketComponent implements OnInit, OnChanges, OnDestroy {
  @Input() paperId = '';
  @Input() packetId = '';
  @Input() referenceChoice = 0;
  @Output() linkedPaper = new EventEmitter<string>();
  @Output() packetChange = new EventEmitter<string>();
  @Output() needPaper = new EventEmitter<string>();
  @Output() queued = new EventEmitter<QueuedPacket>();
  @Output() closed = new EventEmitter<void>();
  @Output() busyChange = new EventEmitter<boolean>();
  @Output() selectionChange = new EventEmitter<boolean>();

  private api = inject(AssistantApi);
  private cd = inject(ChangeDetectorRef);
  private destroyed = false;
  private initialized = false;
  private openedId = '';
  private createId = '';
  private defaultLabel = '';
  private pendingReference = '';
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
  packet?: Packet;
  sources: Source[] = [];
  books: DraftBook[] = [];
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
  readonly pageLimit = maxStackPages;
  readonly bookLimit = maxCheckingPages;

  get hasOpenStack() { return !!this.openedId; }
  get pageTotal() { return this.sources.reduce((n, source) => n + source.pages, 0); }
  get expectedCount() { return this.packet?.expectedStudents ?? this.expected; }
  get allPdfs() { return this.sources.length > 1 && this.sources.every(source => isScanPdf(source.file)); }
  get separateFiles() { return this.sources.length > 1 && this.sources.slice(1).every(source => source.starts); }
  get hasLocalChanges() { return this.dirty || !!this.sources.length; }
  get book() { return this.books.find(book => book.key === this.selectedKey); }
  get needsReview() { return this.books.filter(book => book.needsReview); }
  get reviewing() { return !!this.packet && (this.packet.state === 'review' || this.manual); }
  get processing() { return this.packet?.state === 'queued' || this.packet?.state === 'running'; }
  get attachedPaper() { return this.packet?.paperId || this.paperId || ''; }
  get sourcesLocked() { return !!this.packet && this.packet.state === 'uploading'; }
  get incompleteUpload() { return !!this.packet && this.packet.state === 'uploading' && this.packet.uploaded.length < this.packet.pageCount; }
  get intakeOpen() { return !this.openedId || (!this.loadingDetail && this.packet?.state === 'uploading' && !this.manual); }
  get countMismatch() { return !!this.expectedCount && this.expectedCount !== this.books.length; }
  get submitProblem() {
    if (!this.books.length) return 'Add at least one book.';
    const seenPages = new Set<number>(), labels = new Set<string>();
    for (const book of this.books) {
      const label = book.label.trim().normalize('NFKC').toLocaleLowerCase();
      if (!label || labels.has(label)) return 'Give every book a different roll number or label.';
      labels.add(label);
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
    this.initialized = true;
    if (this.packetId) {
      this.pendingReference = this.referenceChoice > 0 ? this.paperId : '';
      void this.open(this.packetId, false);
    }
    else void this.loadRecent();
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
    if (this.initialized && changes['packetId'] && this.packetId !== this.openedId) {
      if (this.packetId) {
      this.pendingReference = this.referenceChoice > 0 ? this.paperId : '';
      void this.open(this.packetId, false);
    }
      else this.home(false);
    }
    if (this.initialized && changes['referenceChoice'] && this.referenceChoice > 0 && this.paperId && this.openedId) {
      this.pendingReference = this.paperId;
      void this.applyReference();
    }
  }
  private async applyReference() {
    if (!this.packet || !this.pendingReference || this.busy || this.loadingDetail || this.destroyed) return;
    const paperId=this.pendingReference, packet=this.packet;
    this.pendingReference='';
    if (paperId===packet.paperId) return;
    if (packet.state==='completed' || (packet.paperId && !window.confirm('Use the newly selected question paper to mark this stack?'))) {
      this.linkedPaper.emit(packet.paperId||'');
      if (packet.state==='completed') this.notice='This class was already sent with its selected paper.';
      return;
    }
    await this.work(async()=>{
      try {
        const {packet:updated}=await this.api.request<{packet:Packet}>(this.path(packet.id)+'/reference','POST',{version:packet.version,paperId});
        if (!this.destroyed && this.openedId===packet.id) {
          this.packet=updated;
          if(!this.dirty && updated.state==='review' && packet.state!=='review')this.setBooks(updated.groups);
          this.linkedPaper.emit(updated.paperId||'');
        }
      } catch(e) {this.linkedPaper.emit(packet.paperId||'');throw e;}
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
    return {uploading:'Upload incomplete',queued:'Waiting to organize',running:'Finding books',review:'Review book boundaries',completed:'Sent for marking',failed:'Needs attention'}[state];
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
    } catch (e) { if (n === this.listRequest && !this.destroyed) this.error = this.describe(e); }
    finally { if (n === this.listRequest) { this.loadingList = false; this.ready = true; this.paint(); } }
  }
  private async refreshOnChange() {
    if (this.processingRefresh || this.busy || this.destroyed) return;
    this.processingRefresh = true;
    try {
      if (this.processing && this.openedId) await this.open(this.openedId, false, true);
      else if (!this.openedId && this.recent.some(p => ['queued','running'].includes(p.state))) await this.loadRecent();
    } finally { this.processingRefresh = false; }
  }
  async open(id: string, publish = true, quiet = false) {
    if (this.busy || this.destroyed) return;
    if (id !== this.openedId && this.hasLocalChanges && !window.confirm('Leave these unsaved changes?')) return;
    const changing = id !== this.openedId;
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
      if (changing && !this.pendingReference) this.linkedPaper.emit(packet.paperId||'');
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
    this.resetForm(); if (publish) { this.packetChange.emit(''); this.linkedPaper.emit(''); } void this.loadRecent();
  }
  private resetForm() {
    this.closeSource(); this.releaseImages(); this.sources=[]; this.createId=''; this.defaultLabel=''; this.books=[];
    this.selectedKey=0; this.selectedPage=0; this.dirty=false; this.manual=false;
    this.countConfirmed=false; this.expected=null; this.label=''; this.notice=''; this.error='';
    this.resetMove(); this.changed();
  }
  private apply(packet: Packet) {
    this.packet=packet; this.openedId=packet.id;
    this.recent = [packet, ...this.recent.filter(p=>p.id!==packet.id)];
    if (packet.state === 'review' && !this.dirty) this.setBooks(packet.groups);
    if (packet.state === 'completed') { this.dirty=false; this.manual=false; this.changed(); }
    this.paint();
  }

  async add(event: Event) {
    const input=event.target as HTMLInputElement, files=Array.from(input.files??[]);
    input.value='';
    if (!files.length || this.busy) return;
    await this.work(async () => {
      const errors:string[]=[];
      for (const [i,file] of files.entries()) {
        this.progress='Reading file '+(i+1)+' of '+files.length+'…'; this.paint();
        try {
          const pages=await packetFilePageCount(file);
          if (this.destroyed) return;
          const limit=this.packet?.pageCount??this.pageLimit;
          if (!pages || this.pageTotal+pages>limit) throw Error('This would exceed '+limit+' pages in the stack.');
          this.sources.push({file,pages,starts:false,rotations:new Map()});
        } catch(e) { errors.push(file.name+' — '+this.describe(e)); }
      }
      if (errors.length) this.error=errors.slice(0,3).join(' ')+(errors.length>3?' '+(errors.length-3)+' other files could not be added.':'');
      this.changed();
    });
  }
  reorderSource(source:Source,step:number) {
    const i=this.sources.indexOf(source), j=i+step;
    if (this.busy || i<0 || j<0 || j>=this.sources.length) return;
    [this.sources[i],this.sources[j]]=[this.sources[j],this.sources[i]];
  }
  removeSource(source:Source) {
    if (this.busy) return;
    this.sources=this.sources.filter(s=>s!==source);
    if (this.sourceView===source) this.closeSource();
    this.changed();
  }
  toggleFileStarts(enabled:boolean) { this.sources.forEach((source,i)=>source.starts=i>0&&enabled); }
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
    void this.inspectSource(this.sourceView,this.sourceIndex);
  }
  closeSource() {
    this.sourceRequest++;
    if (this.sourcePreview) URL.revokeObjectURL(this.sourcePreview.url);
    this.sourcePreview=undefined; this.sourceView=undefined; this.readingPreview=false;
  }
  async upload() {
    if (this.busy || !this.sources.length || (this.packet && this.pageTotal!==this.packet.pageCount)) return;
    if (this.expected!==null && (!Number.isInteger(this.expected)||this.expected<1||this.expected>180)) { this.error='Enter the number of students present, between 1 and 180.'; return; }
    this.closeSource();
    await this.work(async () => {
      if (!this.packet) {
        let start=1;
        const knownStarts=this.sources.flatMap((source,i)=>{ const index=start;start+=source.pages;return i===0||source.starts?[index]:[]; });
        this.createId ||= crypto.randomUUID();
        this.defaultLabel ||= 'Class stack · '+new Date().toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
        const {packet}=await this.api.request<{packet:Packet}>(base,'POST',{
          id:this.createId,pageCount:this.pageTotal,expectedStudents:this.expected,
          label:this.label.trim()||this.defaultLabel,...(this.paperId?{paperId:this.paperId}:{}),knownStarts
        });
        if (this.destroyed) return;
        this.apply(packet); this.packetChange.emit(packet.id);
      }
      const packet=this.packet!;
      if (packet.state!=='uploading') {this.sources=[];this.changed();return;}
      const saved=new Map(packet.uploaded.map(p=>[p.index,p.sha]));
      const contiguous=packet.uploaded.every(p=>p.index<=saved.size);
      if (saved.size && !contiguous) await this.uploadPages(packet,saved,true);
      await this.uploadPages(packet,saved,false);
      if (this.destroyed) return;
      this.sources=[]; this.changed();
      this.progress='Starting book organization…'; this.paint();
      await this.api.request(this.path(packet.id)+'/organize','POST',{});
      await this.readCurrent();
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
    const focus=this.needsReview[0]??this.books[0];
    if (focus) this.selectBook(focus);
  }
  selectBook(book:DraftBook) {
    this.selectedKey=book.key; this.resetMove();
    if (book.pages.length) void this.showPage(book.pages[0]);
  }
  async showPage(index:number) {
    const id=this.openedId;
    if (!id) return;
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
  previousPage(step:number) {
    const book=this.book;
    if (!book) return;
    const j=book.pages.indexOf(this.selectedPage)+step;
    if (j>=0 && j<book.pages.length) void this.showPage(book.pages[j]);
  }
  editLabel(book:DraftBook,label:string) {
    book.label=label; this.edit();
  }
  confirmBook() {
    const book=this.book;
    if (!book?.label.trim()) { this.error='Enter a roll number or a distinctive book label first.';return; }
    if (this.books.some(b=>b.key!==book.key&&b.label.trim().toLowerCase()===book.label.trim().toLowerCase())) {this.error='Another book already has this label.';return;}
    if (book.pages.length>this.bookLimit) {this.error='Split this book into booklets of up to '+this.bookLimit+' pages before checking.';return;}
    book.needsReview=false;book.reason='';this.edit();
    const next=this.needsReview[0];if(next)this.selectBook(next);
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
  private payload() {return this.books.map(b=>({label:b.label.trim(),pages:b.pages,needsReview:b.needsReview,reason:b.reason}));}
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
    if (!this.packet || this.busy || this.submitProblem) return;
    if (!this.attachedPaper) {
      await this.work(async()=>{
        if (this.dirty||this.manual) await this.persistDraft();
        if (!this.destroyed) this.needPaper.emit(this.openedId);
      });return;
    }
    await this.work(async()=>{
      const packet=this.packet!;
      await this.api.request(this.path(packet.id)+'/confirm','POST',{
        version:packet.version,paperId:this.attachedPaper,groups:this.payload()
      });
      this.dirty=false;await this.readCurrent();
      if (this.packet?.state==='completed') this.openResults();
    });
  }
  openResults() {
    const packet=this.packet;
    if(packet?.paperId)this.queued.emit({packetId:packet.id,paperId:packet.paperId,sheetIds:packet.groups.flatMap(b=>b.sheetId?[b.sheetId]:[])});
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
