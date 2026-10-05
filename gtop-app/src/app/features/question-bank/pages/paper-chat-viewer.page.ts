import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminUsageService } from '../../../services/admin-usage.service';
import { AuthService } from '../../../services/auth.service';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { PaperChatRepository } from '../core/paper-chat.repository';
import type { ChatSavedPaper } from '../core/paper-chat.models';
import { paperPrintHtml } from '../core/question-paper.domain';

@Component({selector:'app-paper-chat-viewer-page',standalone:true,imports:[RouterLink],templateUrl:'./paper-chat-viewer.page.html'})
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
  readonly authorized = signal(false);
  readonly ready = computed(() => {const paper = this.paper(); return !!paper && (paper.status === 'ready' || paper.status === 'draft' && !!paper.sections?.length && paper.actualMarks === paper.marks && !paper.coverage?.gapCount);});
  private readonly subscriptions = new Subscription();
  private id = '';
  private revision = 0;
  private authorizedUid = '';
  constructor(private readonly repository: PaperChatRepository, private readonly route: ActivatedRoute, private readonly router: Router, private readonly sanitizer: DomSanitizer,private readonly usage:AdminUsageService,private readonly profile:AuthService,private readonly auth:Auth) {}
  ngOnInit(): void {
    this.subscriptions.add(onAuthStateChanged(this.auth,user=>{if(this.authorizedUid&&user?.uid!==this.authorizedUid)this.clearPrivileged();}));
    this.subscriptions.add(this.profile.readyUser$.subscribe(user=>{
      if(!user||user.role!=='admin'||user.uid!==this.repository.uid){this.clearPrivileged();return;}
      if(this.authorizedUid===user.uid&&this.authorized())return;
      this.clearPrivileged();this.authorizedUid=user.uid;this.authorized.set(true);
      if(this.id)void this.load();
    }));
    this.subscriptions.add(this.route.queryParamMap.subscribe(params => {this.answers.set(params.get('answers') === '1'); this.updateDocument();}));
    this.subscriptions.add(this.route.paramMap.subscribe(params => {this.id = params.get('paperId') ?? ''; void this.load();}));
  }
  ngOnDestroy(): void {this.subscriptions.unsubscribe(); this.revision++;}
  private clearPrivileged():void {
    this.revision++;this.authorizedUid='';this.authorized.set(false);this.paper.set(null);this.document.set(null);this.documentReady.set(false);this.printing.set(false);this.imageError.set('');this.loading.set(false);this.error.set('A current admin account is required to open this saved paper.');
  }
  private canRead(uid=this.authorizedUid):boolean {return !!uid&&uid===this.authorizedUid&&uid===this.repository.uid&&this.profile.profile()?.uid===uid&&this.profile.isAdmin();}
  versionLabel(paper:ChatSavedPaper):string {return Number.isInteger(paper.requestRevision)&&Number(paper.requestRevision)>0?'Version '+paper.requestRevision:'Version not recorded';}
  async load(): Promise<void> {
    if(!this.canRead()){this.clearPrivileged();return;}
    const uid=this.authorizedUid;
    const revision = ++this.revision; this.loading.set(true); this.error.set(''); this.imageError.set(''); this.paper.set(null); this.document.set(null); this.documentReady.set(false);
    try {const paper = await this.repository.paper(this.id); if (revision !== this.revision||!this.canRead(uid)) return; this.paper.set(paper); this.updateDocument();this.usage.track('paper_opened');}
    catch (error) {if (revision === this.revision) this.error.set(error instanceof Error ? error.message : 'The saved paper could not load.');}
    finally {if (revision === this.revision) this.loading.set(false);}
  }
  switchDocument(answers: boolean): void { if (this.printing()) return; void this.router.navigate([], {relativeTo:this.route,queryParams:{answers:answers?'1':null},queryParamsHandling:'merge',replaceUrl:true}); }
  async onDocumentLoad(): Promise<void> {
    const frame = this.frame?.nativeElement; if (!frame || !this.document()||!this.canRead()) return;
    const revision=this.revision;
    try {
      const content = frame.contentDocument;
      if (content?.fonts) await content.fonts.ready;
      if (content !== frame.contentDocument||revision!==this.revision||!this.canRead()) return;
      // Measure the document body rather than its viewport, so switching copies
      // can shrink a long paper back to a short answer key without height drift.
      this.documentHeight.set(Math.max(600,Math.ceil(content?.body.getBoundingClientRect().height ?? 680) + 12));
      this.documentReady.set(true);
      const broken = Array.from(content?.images ?? []).some(image => image.complete && !image.naturalWidth);
      if (broken) this.imageError.set('A question diagram could not load. Reconnect and reload the paper before printing.');
    } catch {if(revision===this.revision&&this.canRead())this.documentReady.set(true);}
  }
  async print(): Promise<void> {
    const frame = this.frame?.nativeElement;
    if (!frame || !this.canRead() || !this.ready() || !this.documentReady() || this.printing()) return;
    this.printing.set(true); this.imageError.set('');
    const revision = this.revision; const content = frame.contentDocument;
    try {
      const images = Array.from(content?.images ?? []);
      const pending = images.filter(image => !image.complete).map(image => new Promise<void>(resolve => {image.addEventListener('load',() => resolve(),{once:true}); image.addEventListener('error',() => resolve(),{once:true});}));
      await Promise.race([Promise.all(pending),new Promise(resolve => setTimeout(resolve,8000))]);
      if (revision !== this.revision || content !== frame.contentDocument||!this.canRead()) return;
      if (images.some(image => !image.complete || !image.naturalWidth)) {this.imageError.set('A question diagram could not load. Reconnect and reload the paper before printing.'); return;}
      frame.contentWindow?.focus(); frame.contentWindow?.print();this.usage.track('paper_printed');
    } catch {if(revision===this.revision&&this.canRead())this.imageError.set('The print window could not open. Reload the paper and try again.');}
    finally {if(revision===this.revision)this.printing.set(false);}
  }
  private updateDocument(): void {
    const paper = this.paper(); if (!paper||!this.canRead()) return;
    const html = (this.answers() ? paper.answerHtml : paper.paperHtml) || (paper.sections?.length ? paperPrintHtml(paper,paper.sections,this.answers()) : '');
    if (!html) {this.error.set('This saved paper has no printable content. Open its conversation to check the request.'); this.document.set(null); return;}
    // The iframe prohibits scripts. Screen-only fitting leaves the saved print layout intact.
    const fitting = '<style media="screen">html{background:#fff;overflow-x:hidden}body{box-sizing:border-box;max-width:800px;margin:0 auto;padding:34px 32px}img,svg,table{max-width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere}.katex{display:inline-block;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:2px 0;vertical-align:middle}.katex-display{max-width:100%;overflow-x:auto;overflow-y:hidden}@media(max-width:500px){body{padding:24px 18px;font-size:13px}h1{font-size:21px}h2{font-size:16px}header span{float:none}}</style>';
    // Add viewer/print identity around the immutable saved body. Legacy records
    // without a recorded revision stay explicitly unknown; no version is inferred.
    const identity='<aside class="gtop-saved-identity">'+(this.answers()?'Answer key':'Question paper')+' · '+escapeHtml(this.versionLabel(paper))+'<br>Saved paper ID: '+escapeHtml(paper.id)+'</aside>';
    const identityStyle='<style>.gtop-saved-identity{font:11px/1.5 Arial,sans-serif;color:#526059;border-bottom:1px solid #cfd9d2;padding:0 0 10px;margin:0 0 20px;overflow-wrap:anywhere;break-inside:avoid}</style>';
    const withStyle=html.includes('</head>')?html.replace('</head>',fitting+identityStyle+'</head>'):fitting+identityStyle+html;
    const fitted=/<body(?:\s[^>]*)?>/i.test(withStyle)?withStyle.replace(/<body(?:\s[^>]*)?>/i,match=>match+identity):identity+withStyle;
    this.documentReady.set(false); this.imageError.set('');
    this.document.set(this.sanitizer.bypassSecurityTrustHtml(fitted));
  }
}
function escapeHtml(value:string):string{return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
