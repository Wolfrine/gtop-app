import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnDestroy, OnInit, ElementRef, ViewChild, HostListener, inject, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { GtPwaControls } from './pwa-controls';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AssistantApi } from './api.service';
import { OwnerEvents, InvalidationQueue, WorkerHealth, validNotifications, freshHealth } from './owner-events';
import { Conversation, ConversationDetail, Job, PaperSummary, PilotSession, Transport, LibraryKind, LibraryItem, LibraryPage, LibraryFilters, AssistantServiceStatus, libraryMatches, mergeLibraryItems, conversationReadOnly } from './contracts';
import { getDevTransport } from './dev-transport';
import { presentArtifact } from './artifact-presentation.mjs';
import { ChatMathDirective } from './chat-math.directive';
import { formatAssistantText, idForRequest, pendingStates, phaseLabel, pollingDelay, readableError, visibleJobs, servicePresentation } from './presentation.mjs';

@Component({
  selector:'gtop-paper-app',standalone:true,imports:[CommonModule,FormsModule,ChatMathDirective,GtPwaControls],templateUrl:'./workspace.html'
})
export class PaperWorkspace implements OnInit,OnDestroy {
  private api=inject(AssistantApi);private sanitizer=inject(DomSanitizer);
  @ViewChild('messageList') messageList?:ElementRef<HTMLElement>;
  transport:Transport=this.api;session?:PilotSession;conversations:Conversation[]=[];detail?:ConversationDetail;
  loading=true;sending=false;authenticating=false;emailForm=false;email='';password='';error='';draft='';drawer=false;fixture='';
  serviceStarting=false;serviceError='';serviceStale=false;private serviceRequestId='';
  private lastOverviewAt=0;private refreshPending?:Promise<void>;
  private authEpoch=0;private authUnsubscribe?:()=>void;private events?:OwnerEvents;private contentQueue?:InvalidationQueue;
  private health?:WorkerHealth;private serviceTimer?:ReturnType<typeof setTimeout>;private servicePending?:Promise<void>;
  private libraryRefreshRequested=false;
  private contentRetryTimer?:ReturnType<typeof setTimeout>;private contentRetryAttempt=0;
  private presenceDenied=false;private capabilityPending?:Promise<void>;private eventConfig='';
  private contentDenied=false;private contentAccessAllowed=false;private contentAccessPending?:Promise<void>;private contentAccessTimer?:ReturnType<typeof setTimeout>;
  document?:{paper:PaperSummary;kind:'student'|'answers';safe:SafeHtml;adminView:boolean;readOnly:boolean};documentLoading=false;
  view:'chat'|'library'='chat';libraryKind:LibraryKind='papers';libraryLoading=false;libraryError='';libraryFiltersOpen=false;
  libraryFilters:LibraryFilters={board:'',standard:'',subject:'',text:''};
  libraryPages:Record<LibraryKind,{items:LibraryItem[];nextCursor:string|null;loaded:boolean}>={papers:{items:[],nextCursor:null,loaded:false},conversations:{items:[],nextCursor:null,loaded:false}};
  public adminConversation=false;
  feedbackMessage='';feedbackText='';feedbackPaperId='';feedbackOpen=false;newRequestId='';private sendId='';private sendText='';private documentRequest=0;private timer?:ReturnType<typeof setTimeout>;private destroyed=false;private openingId='';
  get user(){return this.session?.user;}
  get worker(){return this.serviceStale?{label:'Assistant status unavailable',detail:'Could not check the assistant. Check your connection and refresh status.',tone:'offline'}:servicePresentation(this.session?.service,this.session?.worker);}
  get canStartService(){return !!this.session?.service?.canStart&&!this.serviceStarting&&!this.serviceStale;}
  get activeJobs(){return (this.detail?.jobs||[]).filter(j=>pendingStates.has(j.state));}
  get paperJobs():Job[]{return visibleJobs(this.detail);}
  get currentPaper(){return this.detail?.papers?.at(-1);}
  get previousPapers(){return this.detail?.papers?.slice(0,-1).reverse() || [];}
  get blockedTurn(){return (this.detail?.jobs||[]).some(j=>j.kind==='turn'&&pendingStates.has(j.state));}
  get readyTitle(){return this.detail?.conversation.title || 'New conversation';}
  get readOnly(){return conversationReadOnly(this.detail,this.user?.uid);}
  get libraryPage(){return this.libraryPages[this.libraryKind];}
  get filteredLibraryItems(){return this.libraryPage.items.filter(item=>libraryMatches(item,this.libraryFilters));}
  get libraryPapers(){return this.filteredLibraryItems as PaperSummary[];}
  get libraryScopeCount(){return [this.libraryFilters.board,this.libraryFilters.standard,this.libraryFilters.subject].filter(Boolean).length;}
  get libraryScopeSummary(){return [this.libraryFilters.board,this.libraryFilters.standard?'Class '+this.libraryFilters.standard:'',this.libraryFilters.subject].filter(Boolean).join(' · ');}
  libraryOptions(field:'board'|'standard'|'subject'){return [...new Set([...this.libraryPage.items.map(item=>item[field]||''),this.libraryFilters[field]].filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}
  creatorInitials(){return (this.readOnly?(this.detail?.creatorName||this.detail?.conversation.creatorName||'Teacher'):(this.user?.displayName||'Teacher')).split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();}
  creatorLabel(){return this.readOnly?(this.detail?.creatorName||this.detail?.conversation.creatorName||'Paper creator'):'You';}
  absoluteDate(value:string|undefined){if(!value)return 'Date not recorded';const date=new Date(value);return Number.isNaN(date.getTime())?'Date not recorded':date.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}
  async openLibrary(){if(!this.user?.libraryAccess)return;this.openingId='';this.view='library';this.drawer=false;this.error='';this.closeDocument();if(!this.libraryPage.loaded)await this.loadLibrary();this.schedulePoll();}
  async switchLibrary(kind:LibraryKind){if(this.libraryLoading)return;this.libraryKind=kind;this.closeDocument();if(!this.libraryPage.loaded)await this.loadLibrary();}
  clearLibraryFilters(){this.libraryFilters={board:'',standard:'',subject:'',text:''};}
  async loadLibrary(reset=false){
    if(!this.contentAuthorized||!this.user?.libraryAccess||this.libraryLoading)return;
    const epoch=this.authEpoch,kind=this.libraryKind,page=this.libraryPages[kind];this.libraryLoading=true;this.libraryError='';
    try{const result=await this.transport.request<LibraryPage>('/admin/library','POST',{kind,...(!reset&&page.nextCursor?{cursor:page.nextCursor}:{})});if(!this.current(epoch)||!this.user?.libraryAccess)return;this.libraryPages[kind]={items:mergeLibraryItems(reset?[]:page.items,result.items),nextCursor:result.nextCursor,loaded:true};}
    catch(e){if(this.current(epoch)){this.libraryError=readableError(e);this.reportError(e);}}finally{if(this.current(epoch)){this.libraryLoading=false;if(this.libraryRefreshRequested){this.libraryRefreshRequested=false;void this.loadLibrary(true);}}}
  }
  async openLibraryConversation(id:string){
    if(!this.contentAuthorized||!this.user?.libraryAccess)return;
    const epoch=this.authEpoch;this.openingId=id;this.error='';this.drawer=false;this.closeDocument();this.draft='';this.feedbackPaperId='';this.feedbackOpen=false;this.feedbackText='';this.feedbackMessage='';
    try{const result=await this.transport.request<ConversationDetail>('/admin/conversations/'+encodeURIComponent(id));if(!this.current(epoch)||this.openingId!==id)return;this.detail={...result,readOnly:result.readOnly??true};this.adminConversation=true;this.view='chat';this.scrollMessages(true);}
    catch(e){if(this.current(epoch)){this.libraryError=readableError(e);this.reportError(e);}}finally{if(this.current(epoch))this.schedulePoll();}
  }
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
  @HostListener('document:visibilitychange') visibilityChanged(){this.stopEvents();if(!document.hidden&&this.session){this.startEvents();if(!this.events)void this.reconnect().finally(()=>this.schedulePoll());else if(this.presenceDenied||!this.session.notifications?.presencePath)void this.reconcileCapabilities(true);}}
  @HostListener('window:online') connectionRestored(){if(!document.hidden&&this.session){if(!this.events)void this.reconnect().finally(()=>this.startEvents());else if(this.presenceDenied||!this.session.notifications?.presencePath)void this.reconcileCapabilities(true);}}
  phase(job:Job){return phaseLabel(job,this.worker.tone==='offline');}
  assistantText(text:string){return formatAssistantText(text);}
  jobError(job:Job){return readableError(job.error);}
  async ngOnInit(){
    const preview=getDevTransport();
    try{
      if(preview){this.transport=preview.transport;this.fixture=preview.scenario;await this.loadSession();if(this.fixture.startsWith('library'))void this.openLibrary();}
      else{await this.api.initialize();this.authUnsubscribe=this.api.observeUser(user=>{this.resetAccount();if(user)void this.loadSession().catch(e=>this.reportError(e));});}
    }catch(e){this.error=readableError(e);}
    finally{if(this.fixture||!this.api.user)this.loading=false;}
  }
  ngOnDestroy(){this.destroyed=true;this.authEpoch++;this.authUnsubscribe?.();this.stopEvents();this.closeDocument();}
  private current(epoch:number){return epoch===this.authEpoch&&!this.destroyed;}
  private get contentAuthorized(){return !this.contentDenied||this.contentAccessAllowed;}
  private reportError(error:unknown){if([401,403].includes((error as {status?:number})?.status||0))this.resetAccount();this.error=readableError(error);}
  private resetAccount(){
    this.authEpoch++;this.stopEvents();this.refreshPending=undefined;this.servicePending=undefined;this.capabilityPending=undefined;this.contentAccessPending=undefined;this.contentDenied=false;this.contentAccessAllowed=false;this.presenceDenied=false;this.session=undefined;this.detail=undefined;this.conversations=[];
    this.serviceError='';this.serviceRequestId='';this.serviceStale=false;this.health=undefined;this.lastOverviewAt=0;this.openingId='';
    this.draft='';this.email='';this.password='';this.sendId='';this.sendText='';this.newRequestId='';this.feedbackText='';this.feedbackMessage='';this.feedbackPaperId='';this.feedbackOpen=false;
    this.loading=false;this.sending=false;this.serviceStarting=false;this.libraryLoading=false;this.libraryRefreshRequested=false;this.libraryError='';this.adminConversation=false;this.view='chat';this.drawer=false;
    this.libraryFilters={board:'',standard:'',subject:'',text:''};this.libraryPages={papers:{items:[],nextCursor:null,loaded:false},conversations:{items:[],nextCursor:null,loaded:false}};this.closeDocument();
  }
  async login(email=false){this.error='';this.authenticating=true;try{if(email)await this.api.loginEmail(this.email,this.password);else await this.api.login();this.password='';if(!this.loading&&!this.session&&this.api.user)await this.loadSession();}catch(e){this.reportError(e);}finally{this.authenticating=false;}}
  async logout(){if(this.fixture)return;this.resetAccount();try{await this.api.logout();}catch(e){this.reportError(e);}}
  private async loadSession(){
    const epoch=this.authEpoch;this.loading=true;
    try{const session=await this.transport.request<PilotSession>('/session');if(!this.current(epoch))return;this.session=session;this.serviceStale=false;await this.loadConversations();if(!this.current(epoch))return;if(this.conversations.length)await this.openConversation(this.conversations[0].id);this.startEvents();}
    catch(e){if(this.current(epoch))this.reportError(e);}finally{if(this.current(epoch))this.loading=false;}
  }
  private async loadConversations(){const epoch=this.authEpoch;const result=await this.transport.request<{conversations:Conversation[]}>('/conversations');if(this.current(epoch))this.conversations=result.conversations;}
  async openConversation(id:string){if(!this.contentAuthorized)return;const epoch=this.authEpoch;this.openingId=id;this.error='';this.drawer=false;this.closeDocument();try{const result=await this.transport.request<ConversationDetail>('/conversations/'+encodeURIComponent(id));if(this.current(epoch)&&this.openingId===id){this.detail=result;this.adminConversation=false;this.view='chat';this.feedbackPaperId='';this.feedbackOpen=false;this.feedbackText='';this.feedbackMessage='';this.scrollMessages(true);}}catch(e){if(this.current(epoch))this.reportError(e);}finally{if(this.current(epoch))this.schedulePoll();}}
  async newConversation(){this.detail=undefined;this.view='chat';this.adminConversation=false;this.draft='';this.drawer=false;this.openingId='';this.error='';this.sendId='';this.closeDocument();this.schedulePoll();setTimeout(()=>document.querySelector<HTMLTextAreaElement>('#message-input')?.focus(),0);}
  async send(){
    const text=this.draft.trim();if(!this.contentAuthorized||this.readOnly||this.view!=='chat'||!text||this.sending||this.blockedTurn)return;
    const epoch=this.authEpoch;this.sending=true;this.error='';if(this.sendText!==text){this.sendId=idForRequest();this.sendText=text;}this.sendId||=idForRequest();
    try{
      if(!this.detail){this.newRequestId||=idForRequest();const result=await this.transport.request<{conversation:Conversation}>('/conversations','POST',{clientRequestId:this.newRequestId});if(!this.current(epoch))return;this.detail={conversation:result.conversation,messages:[],jobs:[],papers:[]};this.openingId=result.conversation.id;this.newRequestId='';}
      const id=this.detail.conversation.id;
      await this.transport.request('/conversations/'+encodeURIComponent(id)+'/messages','POST',{text,clientMessageId:this.sendId});
      if(!this.current(epoch))return;
      this.sendId='';this.sendText='';this.draft='';await this.refresh();this.scrollMessages(true);
    }catch(e){if(this.current(epoch))this.reportError(e);}finally{if(this.current(epoch)){this.sending=false;this.schedulePoll();}}
  }
  composerKey(event:KeyboardEvent){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void this.send();}}
  useSuggestion(text:string){if(this.readOnly)return;this.draft=text;document.querySelector<HTMLTextAreaElement>('#message-input')?.focus();}
  async jobAction(job:Job,action:'cancel'|'retry'){if(!this.contentAuthorized||this.readOnly)return;const epoch=this.authEpoch;this.error='';try{await this.transport.request('/jobs/'+encodeURIComponent(job.id)+'/'+action,'POST',{});if(this.current(epoch))await this.refresh();}catch(e){if(this.current(epoch))this.reportError(e);}}
  async refresh(automatic=false,contentOnly=false){
    if(!this.contentAuthorized)return;
    const epoch=this.authEpoch;
    if(this.refreshPending){await this.refreshPending;if(automatic||!this.current(epoch))return;}
    if(!this.session||!this.current(epoch))return;
    const pending=this.refreshNow(automatic,contentOnly);this.refreshPending=pending;
    try{await pending;}finally{if(this.refreshPending===pending)this.refreshPending=undefined;}
  }
  private async refreshNow(automatic:boolean,contentOnly:boolean){
    const epoch=this.authEpoch;
    const id=this.view==='chat'?this.detail?.conversation.id:undefined;
    const nearBottom=this.messageList ? this.messageList.nativeElement.scrollHeight-this.messageList.nativeElement.scrollTop-this.messageList.nativeElement.clientHeight<150 : true;
    const oldCount=this.detail?.messages.length;
    const admin=this.adminConversation;
    const overview=!contentOnly&&(!automatic||Date.now()-this.lastOverviewAt>=30000);
    const path=(admin?'/admin/conversations/':'/conversations/')+encodeURIComponent(id||'');
    const getDetail=async()=>{
      if(!id)return undefined;
      if(automatic&&!this.fixture&&!this.activeJobs.length){
        const revision=await this.transport.request<{updatedAt:string}>(path+'/revision');
        if(revision.updatedAt===this.detail?.conversation.updatedAt)return undefined;
      }
      return this.transport.request<ConversationDetail>(path);
    };
    const [session,conversations,detail]=await Promise.all([overview?this.transport.request<PilotSession>('/session'):Promise.resolve(this.session!),overview||contentOnly&&!automatic?this.transport.request<{conversations:Conversation[]}>('/conversations'):Promise.resolve({conversations:this.conversations}),getDetail()]);
    if(!this.current(epoch)||!this.session)return;
    if(overview){this.session=session;this.serviceStale=false;if(this.events?.presenceReady&&this.eventConfig===JSON.stringify(session.notifications)&&session.notifications?.presencePath&&freshHealth(this.health))this.receiveHealth(this.health);}
    if(this.session.service?.state==='ready')this.serviceError='';this.conversations=conversations.conversations;if(this.view==='chat'&&id===this.detail?.conversation.id&&admin===this.adminConversation&&detail){this.detail=admin?{...detail,readOnly:detail.readOnly??true}:detail;if(nearBottom&&oldCount!==detail.messages.length)this.scrollMessages();}
    if(overview)this.lastOverviewAt=Date.now();
    this.configureEvents();
    this.scheduleService();this.schedulePoll();
  }
  async reconnect(){const epoch=this.authEpoch;this.error='';try{if(!this.contentAuthorized)await this.reconcileContentAccess();if(this.contentAuthorized)await this.refresh();}catch(e){if(this.current(epoch)){this.serviceStale=true;this.reportError(e);}}}
  async startService(){
    if(!this.contentAuthorized||!this.canStartService)return;
    const epoch=this.authEpoch;
    this.serviceStarting=true;this.serviceError='';this.serviceRequestId||=idForRequest();
    try{const result=await this.transport.request<{service:AssistantServiceStatus}>('/service/start','POST',{clientRequestId:this.serviceRequestId});if(this.session&&this.current(epoch)){this.session={...this.session,service:result.service,worker:result.service.worker};this.serviceRequestId='';}}
    catch(e){if(this.current(epoch)){this.serviceStale=true;this.serviceError='Start could not be confirmed. Refresh status before trying again.';if([401,403].includes((e as {status?:number})?.status||0))this.reportError(e);}}
    finally{if(this.current(epoch)){this.serviceStarting=false;this.schedulePoll();this.scheduleService();}}
  }
  private stopEvents(){clearTimeout(this.timer);clearTimeout(this.serviceTimer);clearTimeout(this.contentRetryTimer);clearTimeout(this.contentAccessTimer);this.contentRetryAttempt=0;this.events?.stop();this.events=undefined;this.eventConfig='';this.contentQueue?.stop();this.contentQueue=undefined;}
  private configureEvents(){if(this.events&&this.eventConfig!==JSON.stringify(this.session?.notifications)){this.stopEvents();this.health=undefined;}if(!this.events)this.startEvents();}
  private startEvents(){
    if(this.destroyed||!this.session||document.hidden||this.events)return;
    const config=this.session.notifications,epoch=this.authEpoch;
    if(!this.fixture&&validNotifications(config,this.session.user.uid)){
      this.eventConfig=JSON.stringify(config);
      this.contentQueue=new InvalidationQueue(async()=>{
        if(!this.current(epoch)||document.hidden||!this.contentAuthorized)return;
        await this.refresh(false,true);
        if(!this.current(epoch)||document.hidden)return;
        clearTimeout(this.contentRetryTimer);if(this.contentRetryAttempt)this.error='';this.contentRetryAttempt=0;
        for(const page of Object.values(this.libraryPages))page.loaded=false;
        if(this.view==='library'){if(this.libraryLoading)this.libraryRefreshRequested=true;else await this.loadLibrary(true);}
      },error=>{
        if(!this.current(epoch))return;this.reportError(error);
        if(!this.current(epoch)||!this.session||document.hidden)return;
        clearTimeout(this.contentRetryTimer);this.contentRetryTimer=setTimeout(()=>this.contentQueue?.request(),Math.min(60000,2000*2**Math.min(this.contentRetryAttempt++,5)));
      });
      this.events=new OwnerEvents(this.api.watchMarker.bind(this.api),config,{
        content:()=>{this.contentDenied=false;this.contentAccessAllowed=false;clearTimeout(this.contentAccessTimer);this.contentQueue?.request();},
        presence:health=>{if(this.current(epoch))this.receiveHealth(health);},
        state:()=>{if(this.current(epoch)){this.schedulePoll();this.scheduleService();}},
        denied:(kind,code)=>{
          if(!this.current(epoch))return;
          if(kind==='content'){this.contentDenied=true;this.contentAccessAllowed=false;clearTimeout(this.timer);void this.reconcileContentAccess();}
          else{this.presenceDenied=true;this.health=undefined;this.serviceStale=true;void this.reconcileCapabilities();}
        }
      });
      this.events.start();
    }
    this.schedulePoll();this.scheduleService();
  }
  private async reconcileContentAccess(){
    if(this.fixture||!this.session||document.hidden||this.destroyed)return;
    if(this.contentAccessPending)return this.contentAccessPending;
    const epoch=this.authEpoch;
    const pending=(async()=>{
      try{
        // Direct Firestore policy failure does not establish gateway revocation.
        const session=await this.transport.request<PilotSession>('/session');
        if(!this.current(epoch)||!this.session)return;
        this.session=session;this.contentAccessAllowed=true;this.error='';
        if(this.events?.presenceReady&&this.eventConfig===JSON.stringify(session.notifications)&&freshHealth(this.health))this.receiveHealth(this.health);
        this.configureEvents();this.contentQueue?.request();this.schedulePoll();
      }catch(e){if(this.current(epoch)){this.contentAccessAllowed=false;this.reportError(e);}}
      finally{if(this.current(epoch)){
        this.contentAccessPending=undefined;clearTimeout(this.contentAccessTimer);
        if(this.contentDenied&&!document.hidden)this.contentAccessTimer=setTimeout(()=>{if(this.contentAccessAllowed)this.events?.retryContent();else void this.reconcileContentAccess();},60000);
      }}
    })();
    this.contentAccessPending=pending;return pending;
  }
  private receiveHealth(health:WorkerHealth|undefined){
    const previous=this.health;this.health=health;
    if(!this.session)return;
    if(freshHealth(health)){
      this.presenceDenied=false;
      const worker={state:health!.state,modelReady:health!.state!=='loading'&&health!.modelReady,lastSeenAt:health!.lastSeenAt};
      this.session={...this.session,worker,...(this.session.service?{service:{...this.session.service,worker,state:health!.state==='loading'?'starting':'ready',canStart:false}}:{})};
      this.serviceStale=false;if(health!.state!=='loading')this.serviceError='';
    }else{
      this.serviceStale=true;
      if(previous?.lastSeenAt!==health?.lastSeenAt||previous?.state!==health?.state||!previous){
        if(this.activeJobs.length)this.contentQueue?.request();
        void this.refreshService();
      }
    }
    this.scheduleService();
  }
  private async refreshService(){
    if(this.fixture||!this.session?.service||document.hidden||this.destroyed)return;
    if(this.servicePending)return this.servicePending;
    const epoch=this.authEpoch;
    const pending=(async()=>{
      try{const result=await this.transport.request<{service:AssistantServiceStatus}>('/service/status');if(!this.current(epoch)||!this.session)return;this.session={...this.session,service:result.service,worker:result.service.worker};this.serviceStale=false;const seen=Date.parse(result.service.worker.lastSeenAt||'');if(this.events?.presenceReady&&freshHealth(this.health)&&(!Number.isFinite(seen)||Date.parse(this.health!.lastSeenAt)>=seen))this.receiveHealth(this.health);if(this.session.service?.state==='ready')this.serviceError='';}
      catch(e){if(this.current(epoch)){this.serviceStale=true;if([403,503].includes((e as {status?:number})?.status||0)){this.presenceDenied=true;void this.reconcileCapabilities();}else this.reportError(e);}}
      finally{if(this.current(epoch)){this.servicePending=undefined;this.scheduleService();}}
    })();
    this.servicePending=pending;return pending;
  }
  private async reconcileCapabilities(retryPresence=false){
    if(this.fixture||!this.session||document.hidden||this.destroyed)return;
    if(this.capabilityPending)return this.capabilityPending;
    const epoch=this.authEpoch;
    const pending=(async()=>{
      try{
        // A denied presence grant may mean worker unpairing, rather than loss of
        // user access. Only the normal user session can distinguish those cases.
        const session=await this.transport.request<PilotSession>('/session');
        if(!this.current(epoch)||!this.session)return;
        if(this.presenceDenied&&session.service){
          try{const result=await this.transport.request<{service:AssistantServiceStatus}>('/service/status');if(!this.current(epoch)||!this.session)return;session.service=result.service;session.worker=result.service.worker;}
          catch(e){if(![403,503].includes((e as {status?:number})?.status||0))throw e;}
        }
        this.session=session;this.serviceStale=this.presenceDenied;
        const previous=this.events;this.configureEvents();
        if(retryPresence&&previous===this.events&&this.presenceDenied)this.events?.retryPresence();
        if(this.events?.presenceReady&&freshHealth(this.health))this.receiveHealth(this.health);
      }catch(e){if(this.current(epoch))this.reportError(e);}
      finally{if(this.current(epoch)){this.capabilityPending=undefined;this.scheduleService();}}
    })();
    this.capabilityPending=pending;return pending;
  }
  private scheduleService(){
    clearTimeout(this.serviceTimer);
    if(this.destroyed||document.hidden||!this.session||this.fixture||!this.events)return;
    let delay:number;
    if(this.presenceDenied||!this.session.service||!this.session.notifications?.presencePath)delay=60000;
    else if(this.serviceStale)delay=5000;
    else if(this.session.service.state==='starting')delay=5000;
    else if(this.session.service.state==='ready'&&Number.isFinite(Date.parse(this.session.worker.lastSeenAt||'')))delay=Math.max(1000,Date.parse(this.session.worker.lastSeenAt!)+90000-Date.now());
    else delay=60000; // migration/offline starter facts have no health-write event
    const epoch=this.authEpoch;
    this.serviceTimer=setTimeout(()=>{
      if(!this.current(epoch)||document.hidden)return;
      if(this.presenceDenied||!this.session?.service||!this.session.notifications?.presencePath){void this.reconcileCapabilities(true);return;}
      if(!freshHealth(this.health)&&(!this.health||Date.parse(this.session?.worker.lastSeenAt||'')+90000<=Date.now())){
        this.serviceStale=true;
        if(this.activeJobs.length)this.contentQueue?.request();
      }
      void this.refreshService();
    },delay);
  }
  private schedulePoll(){
    clearTimeout(this.timer);if(this.destroyed||!this.session||document.hidden||!this.contentAuthorized)return;
    const connected=!!this.events?.contentReady,crossAdmin=this.adminConversation&&this.readOnly;
    const jobs=this.view==='chat'?this.activeJobs:[];
    if(connected&&!crossAdmin&&!jobs.length)return;
    // Job lease renewals intentionally do not notify. Reconcile its public update
    // deadline so a dead worker cannot leave an active card indefinitely.
    const expiry=jobs.length?Math.min(...jobs.map(job=>Date.parse(job.updatedAt)||Date.now()))+125000-Date.now():60000;
    const delay=connected&&!crossAdmin?Math.max(5000,expiry):this.session.service?.state==='starting'&&!connected?5000:pollingDelay(this.view==='chat'?this.detail?.jobs||[]:[]);
    const epoch=this.authEpoch;
    this.timer=setTimeout(async()=>{try{await this.refresh(true,connected);}catch(e){if(this.current(epoch)){this.serviceStale=true;this.reportError(e);}}if(this.current(epoch))this.schedulePoll();},delay);
  }
  private scrollMessages(force=false){setTimeout(()=>{const el=this.messageList?.nativeElement;if(el)el.scrollTo({top:el.scrollHeight,behavior:force?'instant':'auto'});},30);}
  relativeTime(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const minutes=Math.floor((Date.now()-date.getTime())/60000);if(minutes<1)return 'Just now';if(minutes<60)return minutes+' min ago';if(minutes<1440)return date.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});return date.toLocaleDateString('en-IN',{day:'numeric',month:'short'});}
  initials(){return (this.user?.displayName || this.user?.email || 'Teacher').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();}
  async showDocument(paper:PaperSummary,kind:'student'|'answers',adminView=this.adminConversation){
    if(!this.contentAuthorized||adminView&&!this.user?.libraryAccess)return;
    const epoch=this.authEpoch,request=++this.documentRequest;this.documentLoading=true;this.error='';this.libraryError='';try{if(adminView&&!this.transport.adminArtifact)throw Error('Library documents are not available yet.');const html=await (adminView?this.transport.adminArtifact!(paper.id,kind):this.transport.artifact(paper.id,kind));if(!this.current(epoch)||request!==this.documentRequest)return;this.releaseDocument();this.document={paper,kind,adminView,readOnly:adminView&&paper.ownerUid!==this.user?.uid,safe:this.sanitizer.bypassSecurityTrustHtml(presentArtifact(html,paper.revision))};}catch(e){if(this.current(epoch)){this.reportError(e);this.libraryError=readableError(e);}}finally{if(this.current(epoch)&&request===this.documentRequest)this.documentLoading=false;}
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
  revise(paper:PaperSummary){if(this.readOnly||this.view!=='chat')return;const latest=this.currentPaper || paper;this.closeDocument();this.draft='In revision '+latest.revision+', please ';setTimeout(()=>document.querySelector<HTMLTextAreaElement>('#message-input')?.focus(),0);}
  async feedback(rating:'helpful'|'needs_work',paperId?:string){if(!this.contentAuthorized||this.readOnly)return;const epoch=this.authEpoch;this.feedbackMessage='';const messageId=[...(this.detail?.messages||[])].reverse().find(m=>m.role==='assistant')?.id;try{await this.transport.request('/feedback','POST',{conversationId:this.detail!.conversation.id,...(paperId?{paperId}:{}),...(messageId?{messageId}:{}),rating,...(this.feedbackText.trim()?{text:this.feedbackText.trim()}:{})});if(!this.current(epoch))return;this.feedbackMessage='Thank you. Your feedback has been saved.';this.feedbackText='';this.feedbackPaperId='';this.feedbackOpen=false;}catch(e){if(this.current(epoch))this.reportError(e);}}
}
bootstrapApplication(PaperWorkspace,{providers:[provideZoneChangeDetection(),provideServiceWorker('ngsw-worker.js',{enabled:!isDevMode(),registrationStrategy:'registerWhenStable:30000'})]}).catch(error=>{console.error(error);document.body.textContent='The workspace could not start. Please reload and try again.';});
