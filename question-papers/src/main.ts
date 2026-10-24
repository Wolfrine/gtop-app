import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnDestroy, OnInit, ElementRef, ViewChild, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AssistantApi } from './api.service';
import { Conversation, ConversationDetail, Job, PaperSummary, PilotSession, Transport } from './contracts';
import { getDevTransport } from './dev-transport';
import { presentArtifact } from './artifact-presentation.mjs';
import { ChatMathDirective } from './chat-math.directive';
import { formatAssistantText, idForRequest, pendingStates, phaseLabel, pollingDelay, readableError, visibleJobs, workerPresentation } from './presentation.mjs';

@Component({
  selector:'gtop-paper-app',standalone:true,imports:[CommonModule,FormsModule,ChatMathDirective],templateUrl:'./workspace.html'
})
class PaperWorkspace implements OnInit,OnDestroy {
  private api=inject(AssistantApi);private sanitizer=inject(DomSanitizer);
  @ViewChild('messageList') messageList?:ElementRef<HTMLElement>;
  transport:Transport=this.api;session?:PilotSession;conversations:Conversation[]=[];detail?:ConversationDetail;
  loading=true;sending=false;authenticating=false;emailForm=false;email='';password='';error='';draft='';drawer=false;fixture='';
  document?:{paper:PaperSummary;kind:'student'|'answers';safe:SafeHtml};documentLoading=false;
  feedbackMessage='';feedbackText='';feedbackPaperId='';newRequestId='';private sendId='';private sendText='';private documentRequest=0;private timer?:ReturnType<typeof setTimeout>;private destroyed=false;private openingId='';
  get user(){return this.session?.user;}
  get worker(){return workerPresentation(this.session?.worker);}
  get activeJobs(){return (this.detail?.jobs||[]).filter(j=>pendingStates.has(j.state));}
  get paperJobs():Job[]{return visibleJobs(this.detail);}
  get currentPaper(){return this.detail?.papers?.at(-1);}
  get previousPapers(){return this.detail?.papers?.slice(0,-1).reverse() || [];}
  get blockedTurn(){return (this.detail?.jobs||[]).some(j=>j.kind==='turn'&&pendingStates.has(j.state));}
  get readyTitle(){return this.detail?.conversation.title || 'New conversation';}
  toggleDrawer(){this.drawer=!this.drawer;if(this.drawer)setTimeout(()=>document.querySelector<HTMLButtonElement>('.rail-close')?.focus(),0);else document.querySelector<HTMLButtonElement>('.menu-button')?.focus();}
  @HostListener('document:keydown',['$event']) drawerKeyboard(event:KeyboardEvent){
    if(!this.drawer)return;
    if(event.key==='Escape'){event.preventDefault();this.toggleDrawer();return;}
    if(event.key!=='Tab')return;
    const controls=Array.from(document.querySelectorAll<HTMLButtonElement>('.conversation-rail button:not(:disabled)'));
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  @HostListener('window:resize') updateFormulaFocus(){this.prepareDocument();}
  phase(job:Job){return phaseLabel(job,this.worker.tone==='offline');}
  assistantText(text:string){return formatAssistantText(text);}
  jobError(job:Job){return readableError(job.error);}
  async ngOnInit(){
    const preview=getDevTransport();
    try{
      if(preview){this.transport=preview.transport;this.fixture=preview.scenario;await this.loadSession();}
      else{await this.api.initialize();if(this.api.user)await this.loadSession();}
    }catch(e){this.error=readableError(e);}
    finally{this.loading=false;}
  }
  ngOnDestroy(){this.destroyed=true;clearTimeout(this.timer);this.releaseDocument();}
  async login(email=false){this.error='';this.authenticating=true;try{if(email)await this.api.loginEmail(this.email,this.password);else await this.api.login();this.password='';await this.loadSession();}catch(e){this.error=readableError(e);}finally{this.authenticating=false;}}
  async logout(){if(this.fixture)return;await this.api.logout();clearTimeout(this.timer);this.session=undefined;this.detail=undefined;this.conversations=[];this.releaseDocument();}
  private async loadSession(){this.session=await this.transport.request<PilotSession>('/session');await this.loadConversations();if(this.conversations.length)await this.openConversation(this.conversations[0].id);else this.schedulePoll();}
  private async loadConversations(){const result=await this.transport.request<{conversations:Conversation[]}>('/conversations');this.conversations=result.conversations;}
  async openConversation(id:string){this.openingId=id;this.error='';this.drawer=false;this.releaseDocument();try{const result=await this.transport.request<ConversationDetail>('/conversations/'+encodeURIComponent(id));if(this.openingId===id){this.detail=result;this.scrollMessages(true);}}catch(e){this.error=readableError(e);}finally{this.schedulePoll();}}
  async newConversation(){this.detail=undefined;this.draft='';this.drawer=false;this.openingId='';this.error='';this.sendId='';this.releaseDocument();this.schedulePoll();setTimeout(()=>document.querySelector<HTMLTextAreaElement>('#message-input')?.focus(),0);}
  async send(){
    const text=this.draft.trim();if(!text||this.sending||this.blockedTurn)return;
    this.sending=true;this.error='';if(this.sendText!==text){this.sendId=idForRequest();this.sendText=text;}this.sendId||=idForRequest();
    try{
      if(!this.detail){this.newRequestId||=idForRequest();const result=await this.transport.request<{conversation:Conversation}>('/conversations','POST',{clientRequestId:this.newRequestId});this.detail={conversation:result.conversation,messages:[],jobs:[],papers:[]};this.openingId=result.conversation.id;this.newRequestId='';}
      const id=this.detail.conversation.id;
      await this.transport.request('/conversations/'+encodeURIComponent(id)+'/messages','POST',{text,clientMessageId:this.sendId});
      this.sendId='';this.sendText='';this.draft='';await this.refresh();this.scrollMessages(true);
    }catch(e){this.error=readableError(e);}finally{this.sending=false;this.schedulePoll();}
  }
  composerKey(event:KeyboardEvent){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void this.send();}}
  useSuggestion(text:string){this.draft=text;document.querySelector<HTMLTextAreaElement>('#message-input')?.focus();}
  async jobAction(job:Job,action:'cancel'|'retry'){this.error='';try{await this.transport.request('/jobs/'+encodeURIComponent(job.id)+'/'+action,'POST',{});await this.refresh();}catch(e){this.error=readableError(e);}}
  async refresh(){
    const id=this.detail?.conversation.id;
    const nearBottom=this.messageList ? this.messageList.nativeElement.scrollHeight-this.messageList.nativeElement.scrollTop-this.messageList.nativeElement.clientHeight<150 : true;
    const oldCount=this.detail?.messages.length;
    const [session,conversations,detail]=await Promise.all([this.transport.request<PilotSession>('/session'),this.transport.request<{conversations:Conversation[]}>('/conversations'),id?this.transport.request<ConversationDetail>('/conversations/'+encodeURIComponent(id)):Promise.resolve(undefined)]);
    this.session=session;this.conversations=conversations.conversations;if(id===this.detail?.conversation.id&&detail){this.detail=detail;if(nearBottom&&oldCount!==detail.messages.length)this.scrollMessages();}
  }
  async reconnect(){this.error='';try{await this.refresh();}catch(e){this.error=readableError(e);}}
  private schedulePoll(){clearTimeout(this.timer);if(this.destroyed||!this.session)return;this.timer=setTimeout(async()=>{try{await this.refresh();}catch(e){this.error=readableError(e);}this.schedulePoll();},pollingDelay(this.detail?.jobs||[]));}
  private scrollMessages(force=false){setTimeout(()=>{const el=this.messageList?.nativeElement;if(el)el.scrollTo({top:el.scrollHeight,behavior:force?'instant':'auto'});},30);}
  relativeTime(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const minutes=Math.floor((Date.now()-date.getTime())/60000);if(minutes<1)return 'Just now';if(minutes<60)return minutes+' min ago';if(minutes<1440)return date.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});return date.toLocaleDateString('en-IN',{day:'numeric',month:'short'});}
  initials(){return (this.user?.displayName || this.user?.email || 'Teacher').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();}
  async showDocument(paper:PaperSummary,kind:'student'|'answers'){
    const request=++this.documentRequest;this.documentLoading=true;this.error='';try{const html=await this.transport.artifact(paper.id,kind);if(request!==this.documentRequest)return;this.releaseDocument();this.document={paper,kind,safe:this.sanitizer.bypassSecurityTrustHtml(presentArtifact(html))};}catch(e){this.error=readableError(e);}finally{if(request===this.documentRequest)this.documentLoading=false;}
  }
  closeDocument(){++this.documentRequest;this.documentLoading=false;this.releaseDocument();}
  private releaseDocument(){this.document=undefined;}
  prepareDocument(){
    const frame=document.querySelector<HTMLIFrameElement>('#paper-frame');
    const doc=frame?.contentDocument;if(!doc)return;
    const apply=()=>{if(frame?.contentDocument!==doc)return;for(const formula of Array.from(doc.querySelectorAll<HTMLElement>('.katex,.katex-display'))){
      const overflow=formula.scrollWidth>formula.clientWidth+1;
      if(overflow){formula.tabIndex=0;formula.setAttribute('aria-label','Scrollable formula');}
      else{formula.removeAttribute('tabindex');formula.removeAttribute('aria-label');}
    }};
    apply();void doc.fonts?.ready.then(apply);
  }
  printDocument(){const frame=document.querySelector<HTMLIFrameElement>('#paper-frame');frame?.contentWindow?.focus();frame?.contentWindow?.print();}
  revise(paper:PaperSummary){const latest=this.currentPaper || paper;this.closeDocument();this.draft='In revision '+latest.revision+', please ';setTimeout(()=>document.querySelector<HTMLTextAreaElement>('#message-input')?.focus(),0);}
  async feedback(rating:'helpful'|'needs_work',paperId?:string){this.feedbackMessage='';try{await this.transport.request('/feedback','POST',{conversationId:this.detail!.conversation.id,...(paperId?{paperId}:{}),rating,...(this.feedbackText.trim()?{text:this.feedbackText.trim()}:{})});this.feedbackMessage='Thank you. Your feedback has been saved.';this.feedbackText='';this.feedbackPaperId='';}catch(e){this.error=readableError(e);}}
}
bootstrapApplication(PaperWorkspace).catch(error=>{console.error(error);document.body.textContent='The workspace could not start. Please reload and try again.';});
