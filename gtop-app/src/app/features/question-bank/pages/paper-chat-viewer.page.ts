import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PaperChatRepository } from '../core/paper-chat.repository';
import type { ChatSavedPaper } from '../core/paper-chat.models';
import { paperPrintHtml } from '../core/question-paper.domain';
import { QuestionModuleHeaderComponent } from './question-module-header.component';

@Component({selector:'app-paper-chat-viewer-page',standalone:true,imports:[RouterLink,QuestionModuleHeaderComponent],templateUrl:'./paper-chat-viewer.page.html'})
export class PaperChatViewerPage implements OnInit, OnDestroy {
  @ViewChild('documentFrame') private frame?: ElementRef<HTMLIFrameElement>;
  readonly paper = signal<ChatSavedPaper | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly answers = signal(false);
  readonly document = signal<SafeHtml | null>(null);
  readonly documentHeight = signal(680);
  readonly documentReady = signal(false);
  readonly printing = signal(false);
  readonly imageError = signal('');
  readonly ready = computed(() => {const paper = this.paper(); return !!paper && (paper.status === 'ready' || paper.status === 'draft' && !!paper.sections?.length && paper.actualMarks === paper.marks && !paper.coverage?.gapCount);});
  private readonly subscriptions = new Subscription();
  private id = '';
  private revision = 0;
  constructor(private readonly repository: PaperChatRepository, private readonly route: ActivatedRoute, private readonly router: Router, private readonly sanitizer: DomSanitizer) {}
  ngOnInit(): void {
    this.subscriptions.add(this.route.queryParamMap.subscribe(params => {this.answers.set(params.get('answers') === '1'); this.updateDocument();}));
    this.subscriptions.add(this.route.paramMap.subscribe(params => {this.id = params.get('paperId') ?? ''; void this.load();}));
  }
  ngOnDestroy(): void {this.subscriptions.unsubscribe(); this.revision++;}
  async load(): Promise<void> {
    const revision = ++this.revision; this.loading.set(true); this.error.set(''); this.imageError.set(''); this.paper.set(null); this.document.set(null); this.documentReady.set(false);
    try {const paper = await this.repository.paper(this.id); if (revision !== this.revision) return; this.paper.set(paper); this.updateDocument();}
    catch (error) {if (revision === this.revision) this.error.set(error instanceof Error ? error.message : 'The saved paper could not load.');}
    finally {if (revision === this.revision) this.loading.set(false);}
  }
  switchDocument(answers: boolean): void { if (this.printing()) return; void this.router.navigate([], {relativeTo:this.route,queryParams:{answers:answers?'1':null},queryParamsHandling:'merge',replaceUrl:true}); }
  async onDocumentLoad(): Promise<void> {
    const frame = this.frame?.nativeElement; if (!frame || !this.document()) return;
    try {
      const content = frame.contentDocument;
      if (content?.fonts) await content.fonts.ready;
      if (content !== frame.contentDocument) return;
      // Measure the document body rather than its viewport, so switching copies
      // can shrink a long paper back to a short answer key without height drift.
      this.documentHeight.set(Math.max(600,Math.ceil(content?.body.getBoundingClientRect().height ?? 680) + 12));
      this.documentReady.set(true);
      const broken = Array.from(content?.images ?? []).some(image => image.complete && !image.naturalWidth);
      if (broken) this.imageError.set('A question diagram could not load. Reconnect and reload the paper before printing.');
    } catch {this.documentReady.set(true);}
  }
  async print(): Promise<void> {
    const frame = this.frame?.nativeElement;
    if (!frame || !this.ready() || !this.documentReady() || this.printing()) return;
    this.printing.set(true); this.imageError.set('');
    const revision = this.revision; const content = frame.contentDocument;
    try {
      const images = Array.from(content?.images ?? []);
      const pending = images.filter(image => !image.complete).map(image => new Promise<void>(resolve => {image.addEventListener('load',() => resolve(),{once:true}); image.addEventListener('error',() => resolve(),{once:true});}));
      await Promise.race([Promise.all(pending),new Promise(resolve => setTimeout(resolve,8000))]);
      if (revision !== this.revision || content !== frame.contentDocument) return;
      if (images.some(image => !image.complete || !image.naturalWidth)) {this.imageError.set('A question diagram could not load. Reconnect and reload the paper before printing.'); return;}
      frame.contentWindow?.focus(); frame.contentWindow?.print();
    } catch {this.imageError.set('The print window could not open. Reload the paper and try again.');}
    finally {this.printing.set(false);}
  }
  private updateDocument(): void {
    const paper = this.paper(); if (!paper) return;
    const html = (this.answers() ? paper.answerHtml : paper.paperHtml) || (paper.sections?.length ? paperPrintHtml(paper,paper.sections,this.answers()) : '');
    if (!html) {this.error.set('This saved paper has no printable content. Open its conversation to check the request.'); this.document.set(null); return;}
    // The iframe prohibits scripts. Screen-only fitting leaves the saved print layout intact.
    const fitting = '<style media="screen">html{background:#fff;overflow-x:hidden}body{box-sizing:border-box;max-width:800px;margin:0 auto;padding:34px 32px}img,svg,table{max-width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:500px){body{padding:24px 18px;font-size:13px}h1{font-size:21px}h2{font-size:16px}header span{float:none}}</style>';
    const fitted = html.includes('</head>') ? html.replace('</head>',fitting+'</head>') : fitting+html;
    this.documentReady.set(false); this.imageError.set('');
    this.document.set(this.sanitizer.bypassSecurityTrustHtml(fitted));
  }
}
