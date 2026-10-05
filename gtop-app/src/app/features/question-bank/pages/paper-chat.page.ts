import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminUsageService } from '../../../services/admin-usage.service';
import { AuthService } from '../../../services/auth.service';
import { PaperChatRepository } from '../core/paper-chat.repository';
import { PaperRegisterRepository, type RegisterFilters, type RegisterRecord, type RegisterView, type RegisterWindow } from '../core/paper-register.repository';
import { nextPaperRun, paperStatusLabels, type ChatSavedPaper, type PaperChatMessage, type PaperChatRequest, type PaperConversation, type PaperNotification } from '../core/paper-chat.models';

@Component({selector:'app-paper-chat-page',standalone:true,imports:[FormsModule,RouterLink],templateUrl:'./paper-chat.page.html'})
export class PaperChatPage implements OnInit,OnDestroy {
  @ViewChild('composer') composer?:ElementRef<HTMLTextAreaElement>;
  @ViewChild('updates') updates?:ElementRef<HTMLDetailsElement>;
  readonly mode=signal<'register'|'new'|'detail'>('register');
  readonly rows=signal<RegisterRecord[]>([]);readonly notifications=signal<PaperNotification[]>([]);
  readonly conversation=signal<PaperConversation|null>(null);readonly requests=signal<PaperChatRequest[]>([]);
  readonly messages=signal<PaperChatMessage[]>([]);readonly papers=signal<ChatSavedPaper[]>([]);
  readonly current=computed<PaperChatRequest|undefined>(()=>this.requests().find(item=>item.id===this.conversation()?.activeRequestId)??this.requests()[0]);
  readonly readyPapers=computed(()=>this.papers().filter(item=>item.status==='ready'||item.status==='draft'&&!!item.sections?.length&&item.actualMarks===item.marks&&!item.coverage?.gapCount));
  readonly clarification=computed(()=>this.messages().filter(item=>item.role==='agent'&&item.requestId===this.current()?.id).at(-1)?.text??'');
  readonly unlinkedRequests=computed(()=>this.requests().filter(request=>!this.messages().some(message=>message.role==='admin'&&message.requestId===request.id)));
  readonly messagesLoading=signal(true);readonly requestsLoading=signal(true);
  readonly unread=computed(()=>this.notifications().filter(item=>!item.read).length);
  readonly loading=signal(true);readonly loadingMore=signal(false);readonly fromCache=signal(false);readonly indexReady=signal(false);
  readonly error=signal('');readonly sendError=signal('');readonly notice=signal('');readonly sending=signal(false);readonly actionBusy=signal('');
  readonly nextCursor=signal<string|null>(null);readonly continuing=signal(false);readonly editing=signal(false);
  readonly historyOpen=signal(false);readonly moreHistory=signal(false);readonly moreVersions=signal(false);readonly historyBusy=signal(false);
  readonly clock=signal(Date.now());readonly online=signal(navigator.onLine);readonly view=signal<RegisterView>('all');
  search='';mine=false;requirement='';private uid='';private id='';private generation=0;private saveAttempt=0;private windows:RegisterWindow[]=[];private appliedFilters:RegisterFilters={view:'all',q:'',mine:false};private returnAnchor='';
  private composeContext?:{expectedRevision:number;expectedRequestId:string};
  private operation?:{id:string;expectedRevision?:number;expectedRequestId?:string};
  private readonly subscriptions=new Subscription();private pageSubscriptions=new Subscription();
  private readonly timer=setInterval(()=>this.clock.set(Date.now()),30000);
  private readonly connection=()=>{this.online.set(navigator.onLine);if(navigator.onLine&&this.mode()==='register')void this.loadRegister(true);};
  constructor(private readonly repository:PaperChatRepository,private readonly register:PaperRegisterRepository,private readonly profile:AuthService,private readonly route:ActivatedRoute,private readonly router:Router,private readonly usage:AdminUsageService){}
  ngOnInit(){
    window.addEventListener('online',this.connection);window.addEventListener('offline',this.connection);
    this.subscriptions.add(this.profile.readyUser$.subscribe(user=>{
      if(!user||user.role!=='admin'){this.clearPrivileged();return;}
      if(this.uid&&this.uid!==user.uid)this.clearPrivileged();this.uid=user.uid;
    }));
    this.subscriptions.add(this.repository.notifications$().subscribe({next:items=>this.notifications.set(items),error:()=>this.notifications.set([])}));
    this.subscriptions.add(this.route.paramMap.subscribe(params=>this.open(params.get('conversationId')??'')));
  }
  ngOnDestroy(){this.rememberDraft();if(this.mode()==='register')this.rememberRegister();this.subscriptions.unsubscribe();this.pageSubscriptions.unsubscribe();clearInterval(this.timer);window.removeEventListener('online',this.connection);window.removeEventListener('offline',this.connection);this.generation++;}
  private clearPrivileged(){if(this.uid)this.register.clearCache(this.uid);this.generation++;this.pageSubscriptions.unsubscribe();this.rows.set([]);this.conversation.set(null);this.messages.set([]);this.requests.set([]);this.papers.set([]);this.notifications.set([]);this.requirement='';this.operation=undefined;this.composeContext=undefined;this.windows=[];this.nextCursor.set(null);this.loading.set(false);this.loadingMore.set(false);this.sending.set(false);this.actionBusy.set('');this.historyBusy.set(false);}
  open(id:string){
    if(this.id||this.mode()==='new')this.rememberDraft();
    this.id=id;this.pageSubscriptions.unsubscribe();this.pageSubscriptions=new Subscription();this.generation++;this.saveAttempt++;this.sending.set(false);this.historyBusy.set(false);this.actionBusy.set('');this.messagesLoading.set(!!id);this.requestsLoading.set(!!id);
    this.mode.set(id?'detail':this.route.snapshot.data['paperMode']==='new'?'new':'register');
    this.error.set('');this.sendError.set('');this.notice.set('');this.editing.set(false);this.historyOpen.set(false);this.operation=undefined;this.composeContext=undefined;this.moreHistory.set(false);
    this.conversation.set(null);this.requests.set([]);this.messages.set([]);this.papers.set([]);this.restoreDraft();
    if(this.mode()==='register'){this.restoreRegisterFilters();void this.loadRegister(true);return;}
    this.loading.set(!!id);if(!id)return;
    let conversationLoaded=false,requestsLoaded=false;
    const fail=(error:any)=>{if(error?.code==='permission-denied'){this.clearPrivileged();}this.error.set('This record could not update. Reconnect and try again. Your typed text is kept.');this.loading.set(false);this.messagesLoading.set(false);this.requestsLoading.set(false);};
    this.pageSubscriptions.add(this.repository.conversation$(id).subscribe({next:items=>{this.conversation.set(items[0]??null);conversationLoaded=true;this.loading.set(!requestsLoaded);},error:fail}));
    this.pageSubscriptions.add(this.repository.requests$(id).subscribe({next:items=>{this.requests.set(merge(items,this.requests()));this.requestsLoading.set(false);this.moreHistory.set(items.length===100||this.moreHistory());requestsLoaded=true;this.loading.set(!conversationLoaded);},error:fail}));
    this.pageSubscriptions.add(this.repository.messages$(id).subscribe({next:items=>{this.messages.set(merge(items,this.messages()).sort((a,b)=>time(a.createdAt)-time(b.createdAt)||a.id.localeCompare(b.id)));this.messagesLoading.set(false);this.moreHistory.set(items.length===150||this.moreHistory());},error:fail}));
    this.pageSubscriptions.add(this.repository.conversationPapers$(id).subscribe({next:items=>{this.papers.set(merge(items,this.papers()));this.moreVersions.set(items.length===20);},error:fail}));
  }
  filters():RegisterFilters{return {view:this.view(),q:this.search.trim(),mine:this.mine};}
  async loadRegister(restore=false){
    const generation=++this.generation;this.pageSubscriptions.unsubscribe();this.pageSubscriptions=new Subscription();
    const filters=this.filters(),stored=restore?this.register.context():null;
    const saved=stored&&JSON.stringify(stored.filters)===JSON.stringify(filters)?stored:null;
    this.appliedFilters=filters;this.windows=saved?.windows??[];this.returnAnchor=saved?.anchor??'';
    void this.router.navigate([],{relativeTo:this.route,queryParams:{paperQ:filters.q||null,paperView:filters.view==='all'?null:filters.view,paperMine:filters.mine?'1':null},queryParamsHandling:'merge',replaceUrl:true});
    this.loading.set(true);this.loadingMore.set(false);this.error.set('');
    const cached=this.register.cached(filters),last=this.windows.at(-1)?.page;
    this.rows.set(saved?this.windowRows():cached?.items??[]);this.fromCache.set(!!saved||!!cached);
    this.nextCursor.set(last?.nextCursor??null);this.continuing.set(last?.continuing??false);
    if(saved)this.restoreRegisterPosition(generation);
    this.pageSubscriptions.add(this.register.readiness$().subscribe({next:value=>this.indexReady.set(value.ready),error:()=>this.indexReady.set(false)}));
    if(!filters.q)this.pageSubscriptions.add(this.register.watch(filters).subscribe({next:value=>{
      if(generation!==this.generation||this.windows[0]?.before)return;
      if(this.windows[0])this.windows[0].page.items=value.items;
      this.rows.set(merge(value.items,this.windowRows()));this.fromCache.set(value.fromCache);
    },error:(error)=>{if(generation!==this.generation)return;if(error?.code==='permission-denied')this.clearPrivileged();this.error.set('The register could not update. Try again when connected.');this.loading.set(false);}}));
    try{
      // Revalidate the same bounded saved window after rendering its cached rows.
      // The cursor before that window avoids rereading all intervening history.
      let cursor=this.windows[0]?.before??null;const count=Math.max(1,this.windows.length),fresh:RegisterWindow[]=[];
      for(let i=0;i<count;i++){
        const page=await this.register.page(filters,cursor??undefined);if(generation!==this.generation)return;
        fresh.push({before:cursor,page});cursor=page.nextCursor;if(!cursor)break;
      }
      this.windows=fresh;const page=fresh.at(-1)!.page;this.rows.set(this.windowRows());this.indexReady.set(page.indexReady);this.nextCursor.set(page.nextCursor);this.continuing.set(page.continuing);this.fromCache.set(false);
      this.rememberRegister();if(saved)this.restoreRegisterPosition(generation);
    }catch(error){if(generation===this.generation){if([401,403].includes((error as any)?.status))this.clearPrivileged();this.error.set(error instanceof Error?error.message:'Papers could not update.');}}
    finally{if(generation===this.generation)this.loading.set(false);}
  }
  chooseView(view:RegisterView){this.view.set(view);void this.loadRegister();}
  async loadMore(){
    const cursor=this.nextCursor();if(!cursor||this.loadingMore())return;
    const generation=this.generation;this.loadingMore.set(true);this.error.set('');
    try{const page=await this.register.page(this.appliedFilters,cursor);if(generation!==this.generation)return;
      this.windows.push({before:cursor,page});this.windows=this.windows.slice(-10);this.rows.set(this.windowRows());this.nextCursor.set(page.nextCursor);this.continuing.set(page.continuing);this.rememberRegister();
    }catch(error){if(generation===this.generation){if([401,403].includes((error as any)?.status))this.clearPrivileged();this.error.set(error instanceof Error?error.message:'Older papers could not load.');}}
    finally{if(generation===this.generation)this.loadingMore.set(false);}
  }
  olderWindow(){return !!this.windows[0]?.before;}
  private windowRows(){return this.windows.reduce((rows,window)=>merge(rows,window.page.items),[] as RegisterRecord[]);}
  rememberRegister(anchor?:string){
    if(this.mode()!=='register'||!this.windows.length)return;
    if(anchor)this.returnAnchor=anchor;
    this.register.remember({filters:this.appliedFilters,windows:this.windows,anchor:this.returnAnchor});
  }
  private restoreRegisterFilters(){
    const params=this.route.snapshot.queryParamMap;
    if(params.has('paperQ')||params.has('paperView')||params.has('paperMine')){
      this.search=params.get('paperQ')??'';const view=params.get('paperView');this.view.set(['needs-action','in-progress','ready'].includes(view??'')?view as RegisterView:'all');this.mine=params.get('paperMine')==='1';
    }else{this.search='';this.view.set('all');this.mine=false;}
  }
  private restoreRegisterPosition(generation:number){
    const anchor=this.returnAnchor;if(!anchor)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(generation!==this.generation||this.mode()!=='register')return;document.getElementById('paper-row-'+anchor)?.scrollIntoView({block:'center'});}));
  }
  clearSearch(){this.search='';this.view.set('all');this.mine=false;void this.loadRegister();}
  rowLink(row:RegisterRecord){return row.conversationId?['/admin/question-papers/chat',row.conversationId]:row.latestPaperId?['/admin/question-papers/view',row.latestPaperId]:['/admin/question-paper-generator'];}
  rowParams(row:RegisterRecord){return !row.conversationId&&!row.latestPaperId?(row.legacyPaperId?{draftId:row.legacyPaperId}:{requestId:row.legacyRequestId}):{};}
  rowAction(row:RegisterRecord){return row.status==='needs-info'?'Reply':row.status==='error'?'Review issue':row.hasReady?'Open record':'View status';}
  rowScope(row:RegisterRecord){return [row.board,row.className?'Class '+row.className:'',...(row.subjects??[])].filter(Boolean).join(' · ');}
  creator(uid:string){return uid===this.repository.uid?'You':uid?'Admin · '+uid.slice(0,8):'Earlier record';}
  messageActor(message:PaperChatMessage){if(message.role!=='admin')return message.role==='agent'?'Paper service':'Service update';const uid=message.createdBy||this.requests().find(request=>request.id===message.requestId)?.requestedBy;return uid?'Admin request · '+this.creator(uid):'Admin request · actor not recorded';}
  status(value:string){return paperStatusLabels[value as keyof typeof paperStatusLabels]??({'draft':'Earlier draft','awaiting-syllabus':'Checking syllabus','awaiting-coverage':'Checking coverage','creating-questions':'Preparing questions','awaiting-review':'Needs review','ready':'Request ready'}[value]??value);}
  active(value:string){return ['queued','generating','publishing','needs-info'].includes(value);}
  edit(){this.editing.set(true);this.composeContext??={expectedRevision:this.conversation()?.revision??0,expectedRequestId:this.conversation()?.activeRequestId??''};setTimeout(()=>this.composer?.nativeElement.focus(),0);}
  changed(){this.operation=undefined;this.composeContext??={expectedRevision:this.conversation()?.revision??0,expectedRequestId:this.conversation()?.activeRequestId??''};this.rememberDraft();}
  async send(){
    if(this.sending()||!this.requirement.trim())return;
    const text=this.requirement,recordId=this.id,generation=this.generation,attempt=++this.saveAttempt;
    const kind=!recordId?'paper_requested':this.current()?.status==='needs-info'?'paper_replied':'paper_revised';
    this.operation??={id:crypto.randomUUID(),...this.composeContext};
    const operation=this.operation,draftKey=this.draftKey();this.rememberDraft();
    this.sending.set(true);this.sendError.set('');this.notice.set('');
    try{
      const id=await this.repository.send(text,recordId||undefined,operation);
      // Acknowledgement belongs to the submitted draft, even after navigation.
      // Do not clear a newer draft or redirect an admin who has moved elsewhere.
      try{const saved=JSON.parse(localStorage.getItem(draftKey)??'null');if(saved?.text===text&&saved?.operation?.id===operation.id)localStorage.removeItem(draftKey);}catch{}
      if(generation!==this.generation||recordId!==this.id)return;
      this.usage.track(kind);
      if(this.requirement===text){this.requirement='';this.operation=undefined;this.composeContext=undefined;this.editing.set(false);}
      this.rememberDraft();this.notice.set('Request saved. Next scheduled opportunity: '+this.nextRunLabel()+'. You can leave this page.');
      if(id!==recordId)await this.router.navigate(['/admin/question-papers/chat',id],{queryParamsHandling:'preserve'});
    }catch(error){
      if(generation!==this.generation||recordId!==this.id)return;
      this.usage.track('operation_failed');
      this.sendError.set(error instanceof Error?error.message:'Your request could not be saved. Your text is kept.');
      if(this.sendError().includes('record changed')){this.operation=undefined;this.composeContext={expectedRevision:this.conversation()?.revision??0,expectedRequestId:this.conversation()?.activeRequestId??''};}
      this.rememberDraft();
    }finally{if(attempt===this.saveAttempt)this.sending.set(false);}
  }
  async cancel(request:PaperChatRequest){
    const generation=this.generation;this.actionBusy.set('cancel');this.error.set('');
    try{const result=await this.repository.cancel(request.id);if(generation!==this.generation)return;
      if(result==='cancelled')this.usage.track('paper_cancelled');
      this.notice.set(result==='completed'?'The paper finished before cancellation. Its saved files are available below.':result==='already-cancelled'?'This request was already cancelled.':'Request cancelled. Any completed versions remain available.');
    }catch(error){if(generation===this.generation){this.usage.track('operation_failed');this.error.set(error instanceof Error?error.message:'Cancellation could not be confirmed.');}}
    finally{if(generation===this.generation)this.actionBusy.set('');}
  }
  async loadOlderHistory(){
    if(this.historyBusy()||this.messagesLoading()||this.requestsLoading())return;
    const generation=this.generation,id=this.id;
    const messageCursor=this.messages()[0]?.id,requestCursor=this.requests().at(-1)?.id;
    this.historyBusy.set(true);
    try{
      const [olderMessages,olderRequests]=await Promise.all([
        messageCursor?this.repository.olderMessages(id,messageCursor):[],
        requestCursor?this.repository.olderRequests(id,requestCursor):[],
      ]);
      if(generation!==this.generation||id!==this.id)return;
      // Merge into the latest listener state, never an array captured before IO.
      this.messages.update(items=>merge(items,olderMessages).sort((a,b)=>time(a.createdAt)-time(b.createdAt)||a.id.localeCompare(b.id)));
      this.requests.update(items=>merge(items,olderRequests));
      this.moreHistory.set(olderMessages.length===50||olderRequests.length===50);
    }catch{if(generation===this.generation)this.error.set('Earlier activity could not load. Reconnect and try again.');}
    finally{if(generation===this.generation)this.historyBusy.set(false);}
  }
  async loadOlderVersions(){
    const cursor=this.papers().at(-1)?.id;if(!cursor)return;
    const generation=this.generation,id=this.id;this.actionBusy.set('versions');
    try{const older=await this.repository.olderConversationPapers(id,cursor);if(generation!==this.generation||id!==this.id)return;
      this.papers.update(items=>merge(items,older));this.moreVersions.set(older.length===20);
    }catch{if(generation===this.generation)this.error.set('Earlier versions could not load. Try again.');}
    finally{if(generation===this.generation)this.actionBusy.set('');}
  }
  searchRegister(){this.usage.track('paper_searched');void this.loadRegister();}
  nextRunLabel(){this.clock();return this.date(nextPaperRun());}
  date(value:unknown){const date=new Date(time(value));return date.getTime()?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(date)+' IST':'Date unavailable';}
  shortId(id:string){return id.length>16?id.slice(0,4)+'…'+id.slice(-8):id;}
  async copyId(){try{await navigator.clipboard.writeText(this.id);this.notice.set('Full paper record ID copied.');}catch{this.notice.set('Paper record ID: '+this.id);}}
  scheduled(value?:string){this.clock();return value&&time(value)>this.clock()?this.date(value):this.nextRunLabel();}
  elapsed(value?:string){this.clock();return !!value&&time(value)<this.clock();}
  async enablePush(){this.actionBusy.set('push');try{await this.repository.enablePush();this.notice.set('Device notifications are enabled.');}catch(error){this.notice.set(error instanceof Error?error.message:'Device notifications could not be enabled.');}finally{this.actionBusy.set('');}}
  async openNotification(item:PaperNotification){if(this.updates)this.updates.nativeElement.open=false;try{if(!item.read)await this.repository.markRead(item.id);}catch{this.error.set('The update could not be marked as read.');}await this.router.navigate(item.paperId?['/admin/question-papers/view',item.paperId]:['/admin/question-papers/chat',item.conversationId],{queryParamsHandling:'preserve'});}
  retry(){this.mode()==='register'?void this.loadRegister(true):this.open(this.id);}
  private draftKey(){return 'gtop-paper-draft:'+(this.uid||this.repository.uid)+':'+(this.id||'new');}
  private rememberDraft(){if(this.mode()==='register')return;try{if(this.requirement)localStorage.setItem(this.draftKey(),JSON.stringify({text:this.requirement,operation:this.operation,context:this.composeContext}));else localStorage.removeItem(this.draftKey());}catch{}}
  private restoreDraft(){try{const draft=JSON.parse(localStorage.getItem(this.draftKey())??'null');this.requirement=draft?.text??'';this.operation=draft?.operation;this.composeContext=draft?.context;}catch{this.requirement='';}}
}
function merge<T extends {id:string}>(first:T[],second:T[]):T[]{const ids=new Set(first.map(item=>item.id));return [...first,...second.filter(item=>!ids.has(item.id))];}
function time(value:any):number{return value instanceof Date?value.getTime():typeof value==='number'?value:value?.toMillis?.()??(value?.seconds?value.seconds*1000:Date.parse(value?.iso??value??'')||0);}
