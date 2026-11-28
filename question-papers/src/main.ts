import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnDestroy, OnInit, ElementRef, ViewChild, HostListener, Injector, inject, provideZoneChangeDetection, isDevMode, type Type } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { GtPwaControls } from './pwa-controls';
import { PapersAccessReviewComponent } from './access-review.component';
import { ExamUpdatesComponent, type ExamUpdateTarget, resolveExamUpdate, validUpdateId } from './exam-updates.component';
import { PaperLibraryComponent, type CataloguePaper } from './paper-library.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AssistantApi } from './api.service';
import type { StudentHistoryRecord } from './student-history.component';
import { handbackIdentity } from './class-return-data';
import { OwnerEvents, InvalidationQueue, WorkerHealth, validNotifications, freshHealth } from './owner-events';
import { Conversation, ConversationDetail, ConversationList, Job, Message, PaperSummary, PilotSession, Transport, LibraryKind, LibraryItem, LibraryPage, LibraryFilters, AssistantServiceStatus, PapersAccess, PapersAccessStatus, libraryMatches, mergeLibraryItems, conversationReadOnly } from './contracts';
import { getDevTransport } from './dev-transport';
import { presentArtifact } from './artifact-presentation.mjs';
import { artifactFilename, saveArtifact } from '../../assistant-service/domain/artifact-filenames.mjs';
import { ChatMathDirective } from './chat-math.directive';
import { formatAssistantText, idForRequest, pendingStates, phaseLabel, readableError, visibleJobs, servicePresentation } from './presentation.mjs';

interface DeskPacket {id:string; label:string; studentLabel?:string; pageCount:number; state:string; updatedAt:string; paperId?:string|null}
interface DeskSheet {id:string; paperId:string; label:string; studentUid?:string; studentLabel?:string; labelFromStudent?:boolean; singleStudentBook?:boolean; state:string; pending:number|null; updatedAt:string; packetId?:string; packetLabel?:string}
interface DeskItem {kind:'request'|'packet'|'sheet'|'draft'; id:string; title:string; description:string; action:string; updatedAt:string; paperId?:string; packetId?:string}
type ThreadHistory='messages'|'papers';
type ThreadStatus=ConversationDetail|{unchanged:true;jobs:Job[]};
const mergeRows=<T extends {id:string}>(previous:T[],incoming:T[])=>[...new Map([...previous,...incoming].map(row=>[row.id,row])).values()];
const timeOrder=(a:{id:string;createdAt:string},b:{id:string;createdAt:string})=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id);

function mergedHistoryCursor<T extends {id:string}>(prior:T[],incoming:T[],priorCursor:string|null,incomingCursor:string|null){
  if(!incomingCursor)return null;
  return incoming.length&&prior.some(row=>row.id===incoming[0].id)?priorCursor:incomingCursor;
}

@Component({
  selector:'gtop-paper-app',standalone:true,imports:[CommonModule,FormsModule,ChatMathDirective,GtPwaControls,PaperLibraryComponent,ExamUpdatesComponent,PapersAccessReviewComponent],templateUrl:'./workspace.html',
  styles:[`
    @media (min-width:761px) and (max-width:1050px) {
      .desk-bar.with-updates {grid-template-columns:auto minmax(0,1fr) auto;gap:12px;padding-inline:16px}
      .desk-bar.with-updates .desk-nav {justify-content:center;gap:2px}
      .desk-bar.with-updates .desk-nav button {padding-inline:6px;gap:5px}
      .desk-bar.with-updates .desk-tools {gap:5px}
    }
  `]
})
export class PaperWorkspace implements OnInit,OnDestroy {
  private api=inject(AssistantApi);private sanitizer=inject(DomSanitizer);
  @ViewChild('messageList') messageList?:ElementRef<HTMLElement>;
  @ViewChild(ExamUpdatesComponent) private examUpdates?:ExamUpdatesComponent;
  transport:Transport=this.api;session?:PilotSession;conversations:Conversation[]=[];detail?:ConversationDetail;
  loading=true;sending=false;authenticating=false;emailForm=false;email='';password='';error='';draft='';drawer=false;fixture='';
  accessStatus:PapersAccessStatus='unavailable';
  accessBusy=false;accessError='';
  private accessTask?:Promise<void>;
  private sessionTask?:Promise<PilotSession>;
  private accessUnsubscribe?:()=>void;
  serviceStarting=false;serviceError='';serviceStale=false;private serviceRequestId='';
  private lastOverviewAt=0;private refreshPending?:Promise<void>;
  private authEpoch=0;private authUnsubscribe?:()=>void;private events?:OwnerEvents;private contentQueue?:InvalidationQueue;
  private contentRevision?:string;
  private contentConfirmed=false;
  private sharedProbeOnAttach=false;
  private workReady=false;private workRevision?:string;
  private requestsFresh=false;private requestsPending?:{older:boolean;promise:Promise<void>};
  conversationCursor:string|null=null;ownHistoryLoading=false;ownHistoryError='';
  threadHistoryLoading:ThreadHistory|null=null;threadHistoryError:Partial<Record<ThreadHistory,string>>={};
  private health?:WorkerHealth;private serviceTimer?:ReturnType<typeof setTimeout>;private servicePending?:Promise<void>;
  private libraryRefreshRequested=false;
  private contentRetryTimer?:ReturnType<typeof setTimeout>;private contentRetryAttempt=0;
  private presenceDenied=false;private capabilityPending?:Promise<void>;private eventConfig='';
  private contentDenied=false;private contentAccessAllowed=false;private contentAccessPending?:Promise<void>;
  document?:{paper:PaperSummary;kind:'student'|'answers';source:string;safe:SafeHtml;adminView:boolean;readOnly:boolean};documentLoading=false;
  checkingPaperId='';checkingComponent?:Type<unknown>;
  checkingHome=false;
  checkingHubComponent?:Type<unknown>;
  checkingPacketId='';
  private workspaceUpdatesPending=false;
  private readonly returnFromChecking=()=>this.closeChecking();
  private readonly returnToWorkspace=()=>this.closeCheckingHome();
  private readonly viewCheckedClass=(paperId:string,packetId='',sheetId='')=>{
    const params=new URL(location.href).searchParams;
    const historyUid=params.get('view')==='students' ? params.get('studentUid') || '' : '';
    if(sheetId){
      // The submitted upload is complete. Back returns to the desk, paper or student that opened it.
      this.writeRoute({check:paperId,sheet:sheetId,view:historyUid?'students':'',studentUid:historyUid},true);
      this.openChecking(paperId,'',sheetId,false,historyUid);
    }else this.openChecking(paperId,packetId,sheetId);
  };
  studentHistoryComponent?:Type<unknown>;
  studentSubmissionsComponent?:Type<unknown>;
  private inboxSubmissionId='';
  private checkingSubmissionId='';
  previewStudentLink='';
  previewLinkError='';
  previewLinkNotice='';
  previewLinkBusy=false;
  previewInviteUses=10;
  previewLinkMode:'test'|'invite'='test';
  private linkRequest=0;
  private readonly selectInboxSubmission=(id:string)=>{
    this.inboxSubmissionId=id;
    this.writeRoute({view:'submissions',submission:id},true);
  };
  private readonly openInboxSheet=(id:string,paperId:string,sheetId:string)=>this.openChecking(paperId,'',sheetId,true,'',id);
  get submissionsOpen(){return this.papersAdmin&&this.view==='submissions'&&!this.checkingOpen&&this.contentAuthorized;}
  get studentSubmissionsInputs(){
    return {selectedId:this.inboxSubmissionId,onSelect:this.selectInboxSubmission,onOpenSheet:this.openInboxSheet};
  }
  private studentUid='';
  private sheetHistoryUid='';
  private readonly selectHistoryStudent=(uid:string)=>{
    this.studentUid=uid;
    this.writeRoute({view:'students',studentUid:uid});
  };
  private readonly startStudentCheck=(uid:string)=>this.openCheckingHome('','',true,uid);
  private readonly openStudentRecord=(row:StudentHistoryRecord)=>{
    if(row.kind==='packet')this.openCheckingHome('',row.id,true,this.studentUid);
    else if(row.paperId)this.openChecking(row.paperId,'',row.id,true,this.studentUid);
  };
  get studentsOpen(){return this.papersAdmin&&this.view==='students'&&!this.checkingOpen&&this.contentAuthorized;}
  get studentHistoryInputs(){
    return {selectedUid:this.studentUid,onSelect:this.selectHistoryStudent,onCheck:this.startStudentCheck,onOpen:this.openStudentRecord};
  }
  view:'home'|'chat'|'library'|'students'|'submissions'|'access'='home';libraryKind:LibraryKind='papers';libraryLoading=false;libraryError='';libraryFiltersOpen=false;
  libraryFilters:LibraryFilters={board:'',standard:'',subject:'',text:'',year:''};
  libraryPages:Record<LibraryKind,{items:LibraryItem[];nextCursor:string|null;loaded:boolean}>={papers:{items:[],nextCursor:null,loaded:false},conversations:{items:[],nextCursor:null,loaded:false}};
  public adminConversation=false;
  feedbackMessage='';feedbackText='';feedbackPaperId='';feedbackOpen=false;newRequestId='';private sendId='';private sendText='';private documentRequest=0;private timer?:ReturnType<typeof setTimeout>;private sharedAccessTimer?:ReturnType<typeof setTimeout>;private checkedLeases=new Map<string,string>();private destroyed=false;private openingId='';
  get user(){return this.session?.user;}
  get papersAdmin(){return !!this.user&&this.user.papersAdmin!==false;}
  get sharedLibrary(){return this.papersAdmin&&!!this.user?.libraryAccess;}
  get managesAccess(){return this.papersAdmin&&!!this.user?.accessManagement;}
  get applicant(){return !this.user?this.api.user:null;}
  get accessAction(){
    if(this.accessStatus==='none')return 'Request access';
    if(this.accessStatus==='rejected'||this.accessStatus==='revoked')return 'Request access again';
    if(this.accessStatus==='approved'||this.accessStatus==='admin')return 'Open your desk';
    return 'Check access status';
  }
  get accessMessage(){
    switch(this.accessStatus){
      case 'none':return 'Request access to create question papers and check answer books in your own teaching desk.';
      case 'pending':return 'Your request is waiting for review. Return here to check its status.';
      case 'rejected':return 'Your access request was declined. You can submit a new request.';
      case 'revoked':return 'Your access was removed. You can submit a new request.';
      case 'approved':
      case 'admin':return 'You have access to GT Papers.';
      default:return 'Access status is temporarily unavailable. Try again in a moment.';
    }
  }
  get checkingOpen(){return (!!this.checkingPaperId||this.checkingHome)&&!!this.user&&this.contentAuthorized;}
  get checkingInputs(){return {paperId:this.checkingPaperId,scopePacketId:this.checkingPacketId,fromStudentHistory:!!this.sheetHistoryUid,fromSubmissionInbox:!!this.checkingSubmissionId,papersAdmin:this.papersAdmin,onClose:this.returnFromChecking,onScanClass:this.scanForPaper,onManageClass:this.managePacket};}
  get hubInputs(){return {libraryAccess:this.sharedLibrary||!this.papersAdmin,papersAdmin:this.papersAdmin,onClose:this.returnToWorkspace,onResults:this.viewCheckedClass};}
  get worker(){return this.serviceStale?{label:'Assistant status unavailable',detail:'Could not check the assistant. Check your connection and refresh status.',tone:'offline'}:servicePresentation(this.session?.service,this.session?.worker);}
  get canStartService(){return this.papersAdmin&&!!this.session?.service?.canStart&&!this.serviceStarting&&!this.serviceStale;}
  get activeJobs(){return (this.detail?.jobs||[]).filter(j=>pendingStates.has(j.state));}
  get paperJobs():Job[]{return visibleJobs(this.detail);}
  get currentPaper(){return this.detail?.papers?.at(-1);}
  get previousPapers(){return this.detail?.papers?.slice(0,-1).reverse() || [];}
  get blockedTurn(){return (this.detail?.jobs||[]).some(j=>j.kind==='turn'&&pendingStates.has(j.state));}
  get readyTitle(){return this.detail?.conversation.title || 'New conversation';}
  get readOnly(){return conversationReadOnly(this.detail,this.user?.uid);}
  legacyLibraryMode=false;
  libraryPageNumber = 1;
  readonly libraryPageSize = 12;
  private archiveSearch?: {items: LibraryItem[]; filters: string; matches: LibraryItem[]};
  get libraryPage(){return this.libraryPages[this.libraryKind];}
  get filteredLibraryItems(){
    const items = this.libraryPage.items;
    const filters = JSON.stringify(this.libraryFilters);
    if (this.archiveSearch?.items !== items || this.archiveSearch.filters !== filters) {
      this.archiveSearch = {items, filters, matches: items.filter(item => libraryMatches(item, this.libraryFilters))};
    }
    return this.archiveSearch.matches;
  }
  get archivePageCount(){return Math.max(1, Math.ceil(this.filteredLibraryItems.length / this.libraryPageSize));}
  get archivePage(){return Math.min(this.libraryPageNumber,this.archivePageCount);}
  get archiveStart(){return (this.archivePage - 1) * this.libraryPageSize;}
  get visibleArchiveItems(){return this.filteredLibraryItems.slice(this.archiveStart, this.archiveStart + this.libraryPageSize);}
  get libraryPapers(){return this.visibleArchiveItems as PaperSummary[];}
  get libraryScopeCount(){return [this.libraryFilters.board, this.libraryFilters.standard, this.libraryFilters.subject, this.libraryFilters.year].filter(Boolean).length;}
  get libraryHasFilters(){return !!(this.libraryScopeCount || this.libraryFilters.text.trim());}
  libraryOptions(field:'board'|'standard'|'subject'|'year'){
    const values = this.libraryPage.items.map(item => field === 'year' ? (item.updatedAt || item.createdAt || '').slice(0,4) : item[field]);
    const options = [...new Set([...values, this.libraryFilters[field]].filter((value):value is string=>!!value))];
    options.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    return field === 'year' ? options.reverse() : options;
  }
  archiveTrack(_index:number,item:LibraryItem){return item.id;}
  archiveEarlierError = false;
  archiveProgress = '';
  private archiveTail: Partial<Record<LibraryKind,{anchors:Map<string,string>;cursor:string|null}>> = {};
  get archiveNoun(){return this.libraryKind==='papers'?'papers':'requests';}
  get archiveResultLabel(){
    if(this.libraryLoading)return 'Loading '+this.archiveNoun+'…';
    const count=this.filteredLibraryItems.length;
    if(!count)return '0 results';
    const noun=this.libraryHasFilters ? (count===1?'match':'matches') : this.libraryKind==='papers' ? (count===1?'paper':'papers') : (count===1?'request':'requests');
    if(count<=this.libraryPageSize)return count+' '+noun+(this.libraryPage.nextCursor&&!this.libraryHasFilters?' loaded':'');
    return (this.archiveStart+1)+'–'+Math.min(count,this.archiveStart+this.libraryPageSize)+' of '+count+' '+noun;
  }
  get archiveCoverage(){
    const count=this.libraryPage.items.length;
    const noun=count===1 ? this.libraryKind==='papers'?'paper':'request' : this.archiveNoun;
    return this.libraryPage.nextCursor ? count+' '+noun+(this.libraryHasFilters?' searched.':' loaded.')+' Older '+this.archiveNoun+' are available.' : 'Searched all '+count+' '+noun+'.';
  }
  archiveFilterChanged(){this.libraryPageNumber=1;this.archiveProgress='';}
  toggleLibraryFilters(){this.libraryFiltersOpen=!this.libraryFiltersOpen;}
  moveLibraryPage(direction:-1|1){
    this.libraryPageNumber=Math.min(this.archivePageCount, Math.max(1,this.archivePage+direction));
    document.querySelector<HTMLElement>('.archive-result-summary')?.scrollIntoView({block:'nearest'});
  }
  async loadOlderArchive(){
    if(this.libraryLoading || !this.libraryPage.nextCursor)return;
    const epoch=this.authEpoch,kind=this.libraryKind,filters=JSON.stringify(this.libraryFilters);
    const oldMatches=new Set(this.filteredLibraryItems.map(item=>item.id));
    await this.loadLibrary(false);
    if(!this.current(epoch) || this.view!=='library' || kind!==this.libraryKind || this.libraryError || filters!==JSON.stringify(this.libraryFilters))return;
    const firstNew=this.filteredLibraryItems.findIndex(item=>!oldMatches.has(item.id));
    if(firstNew!==-1)this.libraryPageNumber=Math.floor(firstNew/this.libraryPageSize)+1;
    else if(this.libraryHasFilters)this.archiveProgress='No additional matches in this batch.';
  }
  creatorInitials(){return (this.readOnly?(this.detail?.creatorName||this.detail?.conversation.creatorName||'Teacher'):(this.user?.displayName||'Teacher')).split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();}
  creatorLabel(){return this.readOnly?(this.detail?.creatorName||this.detail?.conversation.creatorName||'Paper creator'):'You';}
  absoluteDate(value:string|undefined){if(!value)return 'Date not recorded';const date=new Date(value);return Number.isNaN(date.getTime())?'Date not recorded':date.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}
  readonly todayLabel=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  readonly todayIso=new Date().toLocaleDateString('en-CA');
  get greeting(){const hour=new Date().getHours();return hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';}
  get teacherName(){return this.user?.displayName?.trim() || 'Teacher';}
  get reviewCount(){return this.workSheets.filter(item=>item.state==='review'||(item.pending??0)>0).length;}
  // Ready-to-return totals require inbox data; do not invent a number from recent work.
  get savedTestCount(){return this.conversations.slice(0,30).filter(item=>!!item.latestPaperId).length;}
  ownQuery=''; allWork=false; workLoading=false; workError='';
  workPackets:DeskPacket[]=[]; workSheets:DeskSheet[]=[];
  private workRequest=0;
  private workPending?:Promise<void>;
  private composePage=0;
  private savedBrief?:{text:string;updatedAt:string};
  private get onDesk(){return this.view==='home'&&!this.checkingOpen;}
  get readingRequest(){return !!this.openingId&&!this.detail;}
  retryView(){
    if(this.readingRequest){
      if(this.adminConversation)void this.openLibraryConversation(this.openingId,false);
      else void this.openConversation(this.openingId,false);
    }else void this.reconnect();
  }
  private readonly routeKeys=['view','request','shared','checking','check','sheet','packet','reference','scan','printed','q','page','pane','studentUid','submission','update'];
  private readonly injector=inject(Injector);
  checkingInjector?:Injector;
  private checkedOwner='';
  private routeDepth=0;
  private returningAfterCancel=false;
  private confirmedBack=false;
  get ownRequests(){
    const query=this.ownQuery.trim().toLocaleLowerCase();
    return this.conversations.filter(item=>!query||item.title.toLocaleLowerCase().includes(query));
  }
  get workItems():DeskItem[]{
    const requests:DeskItem[]=this.conversations.map(item=>({kind:'request',id:item.id,title:item.title||'Paper request',
      description:item.latestPaperId?'Paper request · Paper available':'Paper request',action:'Open',updatedAt:item.updatedAt}));
    const packetState:Record<string,[string,string]>={
      uploading:['Upload in progress','Resume'],queued:['Waiting to organize','View'],running:['Organizing books','View'],
      review:['Check book boundaries','Review'],completed:['Sent for marking','Results'],failed:['Organization needs attention','Open']
    };
    const packets:DeskItem[]=this.workPackets.map(item=>{
      const [state,action]=packetState[item.state]||['Answer books','Open'];
      return {kind:'packet',id:item.id,title:item.studentLabel||item.label||'Class answer books',description:[item.pageCount+' '+(item.pageCount===1?'page':'pages'),state].join(' · '),action,updatedAt:item.updatedAt,
        paperId:item.state==='completed'?(item.paperId||undefined):undefined};
    });
    const paperTitles=new Map(this.libraryPages.papers.items.map(item=>[item.id,item.title]));
    for(const conversation of this.conversations){
      if(conversation.latestPaperId&&conversation.title&&!paperTitles.has(conversation.latestPaperId)){
        paperTitles.set(conversation.latestPaperId,conversation.title);
      }
    }
    const sheets:DeskItem[]=this.workSheets.map(item=>{
      const identity=handbackIdentity(item);
      const status=item.state==='review'?(item.pending?item.pending+' '+(item.pending===1?'question':'questions')+' to review':'Review marks'):item.state==='uploading'?'Upload incomplete':'Checking needs attention';
      return {kind:'sheet',id:item.id,paperId:item.paperId,packetId:item.studentUid?undefined:item.packetId,title:identity.name||'Answer book',
        description:[paperTitles.get(item.paperId),identity.reference,identity.classLabel,status].filter(Boolean).join(' · '),
        action:item.state==='review'?'Review':item.state==='uploading'?'Resume':'Open',updatedAt:item.updatedAt};
    });
    const priority=(item:DeskItem)=>item.kind==='sheet'?0:item.kind==='packet'&&item.action!=='Results'?1:2;
    const draft:DeskItem[]=this.savedBrief?[{kind:'draft',id:'new',title:'Unsent paper brief',description:this.savedBrief.text,action:'Resume',updatedAt:this.savedBrief.updatedAt}]:[];
    return [...draft,...[...sheets,...packets,...requests].sort((a,b)=>priority(a)-priority(b)||b.updatedAt.localeCompare(a.updatedAt))];
  }
  get shownWork(){return this.allWork?this.workItems:this.workItems.slice(0,4);}
  trackWork(_index:number,item:DeskItem){return item.kind+item.id;}
  resumeWork(item:DeskItem){
    if(item.kind==='draft')void this.newConversation();
    else if(item.kind==='request')void this.openConversation(item.id);
    else if(item.kind==='sheet'&&item.paperId)this.openChecking(item.paperId,item.packetId,item.id);
    else if(item.kind==='packet'&&item.paperId)this.openChecking(item.paperId,item.id);
    else if(item.kind==='packet')this.openCheckingHome('',item.id);
  }
  async reloadDesk(){
    if(!this.user || !this.contentAuthorized)return;
    if(this.workPending)return this.workPending;
    const pending=this.loadDeskWork();
    this.workPending=pending;
    try{await pending;}finally{if(this.workPending===pending)this.workPending=undefined;}
  }
  private async loadDeskWork(){
    const epoch=this.authEpoch, request=++this.workRequest, revision=this.contentRevision;
    this.error='';this.workError='';this.workLoading=true;
    const [requests,packets,sheets]=await Promise.allSettled([
      this.loadConversations(),
      this.transport.request<{packets:DeskPacket[]}>('/checking/packets'),
      this.transport.request<{sheets:DeskSheet[]}>('/checking/work')
    ]);
    if(!this.current(epoch)||request!==this.workRequest)return;
    if(packets.status==='fulfilled')this.workPackets=packets.value.packets;
    if(sheets.status==='fulfilled')this.workSheets=sheets.value.sheets;
    this.workLoading=false;
    const missing=[requests.status==='rejected'?'requests':'',packets.status==='rejected'?'class stacks':'',sheets.status==='rejected'?'answer books':''].filter(Boolean);
    this.workReady=!missing.length&&revision===this.contentRevision;
    this.workRevision=revision;
    if(missing.length)this.workError='Could not load '+missing.join(', ')+'.';
    if(requests.status==='rejected'&&[401,403].includes(requests.reason?.status))this.reportError(requests.reason);
  }
  private writeRoute(params:Record<string,string>,replace=false){
    const url=new URL(location.href);
    for(const key of this.routeKeys)url.searchParams.delete(key);
    for(const [key,value] of Object.entries(params))if(value)url.searchParams.set(key,value);
    if(url.href===location.href&&(!replace||history.state?.gtDeskOwner===this.user?.uid))return;
    if(!replace)this.routeDepth++;
    const state={gtDeskOwner:this.user?.uid,gtDeskDepth:this.routeDepth,gtDeskParent:replace?!!history.state?.gtDeskParent:true};
    if(replace)history.replaceState(state,'',url);else history.pushState(state,'',url);
  }
  private prepareNavigation(){
    ++this.composePage;
    if(!this.checkingOpen&&this.view==='chat'&&!this.detail&&!this.openingId){
      const text=this.draft;
      if(!text.trim())this.savedBrief=undefined;
      else if(this.savedBrief?.text!==text)this.savedBrief={text,updatedAt:new Date().toISOString()};
    }
    this.checkingHome=false;this.checkingPaperId='';this.checkingPacketId='';this.checkingSubmissionId='';
    this.resumeWorkspaceUpdates();
  }
  // Keep the checking job and on-device scans safe when changing destinations.
  // Both checking views already subscribe to this cancelable leave event.
  navigateFromShell(destination:'home'|'papers'|'check'|'inbox'|'students'|'access'){
    if(!this.user)return;
    if(this.checkingOpen){
      if(destination==='check')return;
      const mayLeave=new Event('gtop-checking-may-leave',{cancelable:true});
      if(!window.dispatchEvent(mayLeave))return;
    }
    if(destination==='home')this.openHome();
    else if(destination==='papers')void this.openLibrary();
    else if(destination==='check')this.openCheckingHome();
    else if(destination==='inbox')void this.openSubmissions();
    else if(destination==='students')void this.openStudents();
    else this.openAccessReview();
  }
  openAccessReview(write=true){
    if(!this.managesAccess||!this.contentAuthorized)return;
    this.prepareNavigation();this.openingId='';this.drawer=false;this.closeDocument();
    this.view='access';
    if(write)this.writeRoute({view:'access'});
    setTimeout(()=>document.querySelector<HTMLElement>('#access-review-title')?.focus(),0);
  }
  closeUnavailableAccessReview(){
    this.openHome();
    void this.reconcileCapabilities();
  }
  logoutFromShell(){
    if(this.checkingOpen&&!window.dispatchEvent(new Event('gtop-checking-may-leave',{cancelable:true})))return;
    void this.logout();
  }
  openHome(write=true){
    if(!this.user)return;
    if(write)this.writeRoute({});
    this.prepareNavigation();this.openingId='';this.view='home';this.drawer=false;this.closeDocument();this.allWork=false;
    if(!this.workReady||!this.events?.contentReady)void this.reloadDesk();this.scheduleThreadCheck();
  }
  openChecking(paperId:string,packetId='',sheet='',write=true,historyUid='',submissionId=''){
    if(!this.user||!this.contentAuthorized||(!this.papersAdmin&&(historyUid||submissionId)))return;
    if(write)this.writeRoute({check:paperId,packet:packetId,sheet,checking:this.checkingHome?'class':'',view:submissionId?'submissions':historyUid?'students':'',studentUid:historyUid,submission:submissionId});
    this.prepareNavigation();
    this.openingId='';this.checkingHome=false;this.checkingPacketId=packetId;this.sheetHistoryUid=historyUid;this.checkingSubmissionId=submissionId;
    this.closeDocument();this.drawer=false;this.checkingPaperId=paperId;
    void this.loadCheckingComponent();
  }
  private readonly managePacket=(packetId:string)=>this.openCheckingHome('',packetId);
  private readonly scanForPaper=(paperId:string)=>this.openCheckingHome(paperId);
  openCheckingHome(reference='',packet='',write=true,studentUid=''){
    if(!this.user||!this.contentAuthorized||(!this.papersAdmin&&studentUid))return;
    if(write)this.writeRoute({checking:'class',reference,packet,studentUid,view:studentUid&&this.studentsOpen?'students':''});
    this.prepareNavigation();
    this.openingId='';this.checkingPaperId='';this.checkingPacketId='';
    this.closeDocument();this.drawer=false;this.checkingHome=true;
    void this.loadCheckingHub();
  }
  startPaperCheck(paper:PaperSummary){
    if(this.document?.paper.id===paper.id){
      const {kind,adminView}=this.document;
      history.replaceState({...history.state,gtDeskOwner:this.user?.uid,gtDeskPreview:{paperId:paper.id,kind,adminView}},'',location.href);
    }
    this.openCheckingHome(paper.id);
  }
  async openStudents(uid='',write=true){
    if(!this.papersAdmin||!this.contentAuthorized)return;
    this.prepareNavigation();
    this.writeRoute({view:'students',studentUid:uid},!write);
    this.view='students';this.studentUid=uid;this.openingId='';this.drawer=false;this.error='';this.closeDocument();
    const epoch=this.authEpoch;
    try{this.studentHistoryComponent||=(await import('./student-history.component')).StudentHistoryComponent;}
    catch(error){if(this.current(epoch)&&this.studentsOpen)this.reportError(error);}
    this.scheduleThreadCheck();
  }
  readonly openExamUpdate=async(target:ExamUpdateTarget,replace=false):Promise<boolean>=>{
    if(!this.updatesAvailable||!this.user)return false;
    if(!replace&&this.checkingOpen&&!window.dispatchEvent(new Event('gtop-checking-may-leave',{cancelable:true})))return false;
    const epoch=this.authEpoch;
    if(target.kind==='submission'){
      if(replace)this.writeRoute({view:'submissions',submission:target.submissionId},true);
      await this.openSubmissions(target.submissionId,!replace);
      return this.current(epoch)&&this.submissionsOpen&&this.inboxSubmissionId===target.submissionId;
    }
    const {conversationId,paperId}=target;
    if(replace)this.writeRoute({request:conversationId},true);
    await this.openConversation(conversationId,!replace);
    if(!this.current(epoch)||this.detail?.conversation.id!==conversationId)return false;
    if(paperId){
      let paper=this.detail.papers.find(item=>item.id===paperId);
      if(!paper){
        const response=await this.transport.request<{paper:PaperSummary}>(this.threadPath(conversationId,false,'paper',{paperId}));
        paper=response.paper;
      }
      if(!this.current(epoch)||this.detail?.conversation.id!==conversationId)return false;
      await this.showDocument(paper,'student',false);
    }
    return true;
  };
  private async openExamDeepLink(id:string){
    const epoch=this.authEpoch,url=location.href;
    try{
      if(!validUpdateId(id))throw Error('Invalid update');
      const target=await resolveExamUpdate(this.api,id);
      if(this.current(epoch)&&url===location.href)await this.openExamUpdate(target,true);
    }catch{
      if(!this.current(epoch)||url!==location.href)return;
      this.writeRoute({},true);this.openHome(false);this.error='This update is no longer available.';
    }
  }
  async openSubmissions(id='',write=true){
    if(!this.papersAdmin||!this.contentAuthorized)return;
    this.prepareNavigation();
    if(write)this.writeRoute({view:'submissions',submission:id});
    this.view='submissions';this.inboxSubmissionId=id;this.openingId='';this.drawer=false;this.error='';this.closeDocument();
    const epoch=this.authEpoch;
    try{this.studentSubmissionsComponent||=(await import('./student-submissions.component')).StudentSubmissionsComponent;}
    catch(error){if(this.current(epoch)&&this.submissionsOpen)this.reportError(error);}
    this.scheduleThreadCheck();
  }
  private async loadCheckingHub(){
    const epoch=this.authEpoch;
    try{this.checkingHubComponent||=(await import('./checking-hub.component')).CheckingHubComponent;}
    catch(error){if(this.current(epoch)&&this.checkingHome){this.openHome();this.reportError(error);}}
  }
  private closeCheckingHome(){this.returnFromCheck();}
  private returnFromCheck(){
    if(history.state?.gtDeskParent&&history.state?.gtDeskOwner===this.user?.uid){this.confirmedBack=true;history.back();return;}
    const params=new URL(location.href).searchParams;
    if(params.get('view')==='students' && params.get('studentUid')){
      void this.openStudents(params.get('studentUid')!,false);return;
    }
    if(params.get('view')==='submissions'){
      const submission=params.get('submission')||'';
      this.writeRoute({view:'submissions',submission},true);
      void this.openSubmissions(submission,false);
      return;
    }
    this.writeRoute({},true);this.openHome(false);
  }
  private resumeWorkspaceUpdates(){
    if(!this.workspaceUpdatesPending)return;
    this.workspaceUpdatesPending=false;
    this.contentQueue?.request();
  }
  private async loadCheckingComponent(){
    const epoch=this.authEpoch;
    try{
      this.checkingComponent ||= (await import('./checking.component')).PaperCheckingComponent;
    }catch(error){
      if(this.current(epoch)&&this.checkingPaperId){this.closeChecking();this.reportError(error);}
    }
  }
  closeChecking(){this.returnFromCheck();}
  openCatalogueDocument(event:{paper:CataloguePaper;kind:'student'|'answers';print:boolean}){
    const item=event.paper;
    const paper:PaperSummary={
      id:item.paperId,title:item.title,revision:item.revision,marks:item.marks,
      createdAt:item.createdAt,ownerUid:item.ownerUid,conversationId:item.sourceConversationId,
      board:item.board.raw,standard:item.standard.raw,subject:item.subject.raw,
      academicYear:item.academicYear,jobId:''
    };
    void this.showDocument(paper,event.kind,this.sharedLibrary,event.print);
  }
  openCatalogueChecking(paper:CataloguePaper){this.openCheckingHome(paper.paperId);}
  async openClassicPaperArchive(){
    if(!this.sharedLibrary)return;
    this.libraryKind='papers';this.legacyLibraryMode=true;
    if(!this.libraryPages.papers.loaded)await this.loadLibrary();
  }
  async openLibrary(write=true){
    if(!this.user||!this.contentAuthorized)return;
    if(write){this.libraryKind='papers';this.legacyLibraryMode=false;}
    this.prepareNavigation();if(write)this.writeRoute({view:'library'});
    this.openingId='';this.view='library';this.drawer=false;this.error='';this.closeDocument();
    if(this.sharedLibrary){if((this.legacyLibraryMode||this.libraryKind==='conversations')&&!this.libraryPage.loaded)await this.loadLibrary();}
    else if((this.papersAdmin||this.libraryKind==='conversations')&&!this.requestsFresh){const epoch=this.authEpoch;try{await this.loadConversations();}catch(e){if(this.current(epoch))this.reportError(e);}}
    this.scheduleThreadCheck();
  }
  async switchLibrary(kind:LibraryKind){
    if(this.libraryLoading || kind===this.libraryKind)return;
    this.libraryKind=kind;this.legacyLibraryMode=false;this.archiveFilterChanged();this.libraryError='';this.closeDocument();
    if(kind!=='conversations')return;
    if(this.sharedLibrary){
      if(!this.libraryPage.loaded)await this.loadLibrary();
    }else if(!this.requestsFresh){
      const epoch=this.authEpoch;
      try{await this.loadConversations();}catch(error){if(this.current(epoch))this.reportError(error);}
    }
  }
  clearLibraryFilters(){this.libraryFilters={board:'',standard:'',subject:'',text:'',year:''};this.archiveFilterChanged();}
  async loadLibrary(refresh=true){
    if(!this.contentAuthorized || !this.sharedLibrary || this.libraryLoading)return;
    const epoch=this.authEpoch,kind=this.libraryKind,page=this.libraryPages[kind];
    const cursor=refresh ? null : page.nextCursor;
    if(!refresh && !cursor)return;
    const stamp=(item:LibraryItem)=> (kind==='papers' ? item.createdAt : item.updatedAt || item.createdAt) || '';
    const order=(a:LibraryItem,b:LibraryItem)=>stamp(b).localeCompare(stamp(a)) || (a.id===b.id?0:a.id<b.id?1:-1);
    this.libraryLoading=true;this.libraryError='';this.archiveProgress='';this.archiveEarlierError=false;
    try {
      const result=await this.transport.request<LibraryPage>('/admin/library','POST',{kind,...(cursor?{cursor}:{})});
      if(!this.current(epoch) || !this.sharedLibrary)return;
      if(cursor && result.nextCursor===cursor)throw Error('The archive could not advance. Refresh to try again.');
      let nextCursor=result.nextCursor;
      let cached=page.items;
      if(refresh && page.items.length && !this.archiveTail[kind]){
        // A refreshed head can overlap a range already fetched by this account. Resume at its tail.
        this.archiveTail[kind]={anchors:new Map(page.items.map(item=>[item.id,stamp(item)])),cursor:page.nextCursor};
      }
      const tail=this.archiveTail[kind],edge=result.items.at(-1);
      if(!nextCursor){
        if(refresh)cached=[];
        delete this.archiveTail[kind];
      }else if(edge && tail?.anchors.get(edge.id)===stamp(edge)){
        nextCursor=tail.cursor;
        delete this.archiveTail[kind];
      }
      if(refresh && edge)cached=cached.filter(item=>order(item,edge)>0);
      const items=mergeLibraryItems(cached,result.items).sort(order);
      this.libraryPages[kind]={items,nextCursor,loaded:true};
    } catch(e) {
      if(this.current(epoch)){this.archiveEarlierError=!refresh;this.libraryError=readableError(e);this.reportError(e);}
    } finally {
      if(this.current(epoch)){
        this.libraryLoading=false;
        if(this.libraryRefreshRequested){this.libraryRefreshRequested=false;if(this.view==='library')void this.loadLibrary();}
      }
    }
  }
  async openLibraryConversation(id:string,write=true){
    if(!this.contentAuthorized||!this.sharedLibrary)return;
    this.prepareNavigation();if(write)this.writeRoute({request:id,shared:'1'});
    this.view='chat';this.detail=undefined;this.adminConversation=true;
    const epoch=this.authEpoch;this.openingId=id;this.error='';this.drawer=false;this.closeDocument();this.draft='';this.feedbackPaperId='';this.feedbackOpen=false;this.feedbackText='';this.feedbackMessage='';
    this.threadHistoryLoading=null;this.threadHistoryError={};
    try{const result=await this.transport.request<ConversationDetail>(this.threadPath(id,true,'recent'));if(!this.current(epoch)||this.openingId!==id)return;this.detail={...result,readOnly:result.readOnly??true};this.adminConversation=true;this.view='chat';this.scrollMessages(true);}
    catch(e){if(this.current(epoch)&&this.openingId===id){this.libraryError=readableError(e);this.reportError(e);}}finally{if(this.current(epoch))this.scheduleThreadCheck();}
  }
  toggleDrawer(){
    this.drawer=!this.drawer;
    if(this.drawer){
      if(!this.requestsFresh)void this.loadOwnHistory(true);
      setTimeout(()=>document.querySelector<HTMLButtonElement>('.rail-close')?.focus(),0);
    }else document.querySelector<HTMLButtonElement>('.desk-profile')?.focus();
  }
  @HostListener('document:keydown',['$event']) drawerKeyboard(event:KeyboardEvent){
    if(!this.drawer)return;
    if(event.key==='Escape'){event.preventDefault();this.toggleDrawer();return;}
    if(event.key!=='Tab')return;
    const controls=Array.from(document.querySelectorAll<HTMLButtonElement>('.desk-account button:not(:disabled)'));
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  @HostListener('window:resize') updateFormulaFocus(){this.prepareDocument();}
  @HostListener('document:visibilitychange') visibilityChanged(){
    if(document.hidden){this.sharedProbeOnAttach=false;this.stopEvents();return;}
    if(this.applicant){
      if(this.accessStatus==='pending')void this.checkApplicantAccess();
      return;
    }
    if(!this.session)return;
    void this.resumeForeground();
  }
  private async resumeForeground(){
    const epoch=this.authEpoch;
    if(!this.fixture)await this.reconcileCapabilities(true);
    if(!this.current(epoch)||!this.session||document.hidden)return;
    const probeShared=this.viewingSharedThread;
    this.sharedProbeOnAttach=probeShared;
    this.startEvents();
    if(this.view==='home'&&!this.checkingOpen&&!this.workReady)void this.reloadDesk();
    if(probeShared)void this.probeSharedThread();
    else if(!this.events){
      try{await this.refresh(false,true);}
      catch(error){if(this.current(epoch))this.reportError(error);}
    }
    if(this.current(epoch))this.scheduleThreadCheck();
  }
  @HostListener('window:online') connectionRestored(){
    if(document.hidden||!this.session)return;
    if(!this.events){void this.reconnect().finally(()=>this.startEvents());return;}
    if(!this.events.contentReady){this.events.retryContent();if(this.contentDenied)void this.reconcileContentAccess();}
    if(!this.events.presenceReady||this.presenceDenied)void this.reconcileCapabilities(true);
    this.scheduleThreadCheck();
  }
  phase(job:Job){return phaseLabel(job,this.worker.tone==='offline');}
  assistantText(text:string){return formatAssistantText(text);}
  pendingJobAction:{id:string;action:'cancel'|'retry'}|null=null;
  jobProgress(job:Job){
    if(job.phase==='codex_generating'&&job.progress)return job.progress.completed+' of '+job.progress.total+' questions drafted.';
    if(!this.readOnly&&job.native)return 'You can draft your next message while Codex works.';
    if(!this.readOnly&&job.kind==='turn')return 'You can draft your next message below.';
    if(!this.readOnly&&job.kind==='paper')return 'You can keep talking while I work.';
    return '';
  }
  jobError(job:Job){return job.errorCode&&typeof job.error==='string'?job.error:readableError(job.error);}
  async ngOnInit(){
    this.routeDepth=history.state?.gtDeskDepth||0;
    const preview=getDevTransport();
    try{
      if(preview){
        this.transport=preview.transport;this.fixture=preview.scenario;
        this.checkingInjector=Injector.create({parent:this.injector,providers:[{provide:AssistantApi,useValue:preview.transport}]});
        await this.loadSession();
      }
      else{
        await this.api.initialize();
        this.accessUnsubscribe=this.api.observeAccessDenied(()=>this.loseWorkspaceAccess());
        this.authUnsubscribe=this.api.observeUser(user=>{
          this.resetAccount();
          if(user)void this.loadSession();
        });
      }
    }catch(e){this.error=readableError(e);}
    finally{if(this.fixture||!this.api.user)this.loading=false;}
  }
  ngOnDestroy(){this.destroyed=true;this.authEpoch++;this.authUnsubscribe?.();this.accessUnsubscribe?.();this.stopEvents();this.closeDocument();}
  private current(epoch:number){return epoch===this.authEpoch&&!this.destroyed;}
  private get contentAuthorized(){return !this.contentDenied||this.contentAccessAllowed;}
  get updatesAvailable(){return this.papersAdmin&&!this.fixture&&this.contentAuthorized;}
  private acceptSession(session:PilotSession){
    const lostLibrary=!!this.session?.user.libraryAccess&&!session.user.libraryAccess;
    const lostAdmin=this.papersAdmin&&session.user.papersAdmin===false;
    if(lostAdmin){
      this.resetAccount();this.session=session;this.contentRevision=session.contentRevision;
      this.writeRoute({},true);this.openHome(false);this.startEvents();
      return;
    }
    this.session=session;
    if(this.view==='access'&&!this.managesAccess)this.openHome();
    if(!lostLibrary)return;
    this.archiveSearch=undefined;this.clearLibraryFilters();this.libraryError='';this.libraryFiltersOpen=false;
    this.libraryPages={papers:{items:[],nextCursor:null,loaded:false},conversations:{items:[],nextCursor:null,loaded:false}};
    if(this.document?.adminView||this.documentLoading)this.closeDocument();
    if(this.adminConversation){
      this.openingId='';this.adminConversation=false;this.detail=undefined;this.draft='';this.view='home';
      if(!this.checkingOpen){this.writeRoute({},true);void this.reloadDesk();}
    }
  }
  private reportError(error:unknown){
    const {status,code}=(error||{}) as {status?:number;code?:string};
    if(status===403&&['papers_access_required','pilot_access_required'].includes(code||'')){
      this.loseWorkspaceAccess();
      return;
    }
    if(status===401)this.resetAccount();
    this.error=readableError(error);
  }
  private loseWorkspaceAccess(){
    if(!this.api.user||this.destroyed)return;
    const hadSession=!!this.session;
    if(hadSession)this.writeRoute({},true);
    this.resetAccount();
    void this.checkApplicantAccess(false,false);
  }
  private checkApplicantAccess(request=false,openApproved=true){
    if(!this.applicant)return Promise.resolve();
    if(this.accessTask)return this.accessTask;
    const epoch=this.authEpoch;
    this.accessBusy=true;this.accessError='';
    const pending=(async()=>{
      try{
        const result=await this.transport.request<PapersAccess>('/access',request?'POST':'GET',request?{}:undefined);
        if(!this.current(epoch))return;
        this.accessStatus=result.status;
        if(openApproved&&(result.status==='approved'||result.status==='admin'))await this.loadSession();
      }catch(error){
        if(!this.current(epoch))return;
        const {status,code}=(error||{}) as {status?:number;code?:string};
        if(status===404||code==='papers_access_unavailable')this.accessStatus='unavailable';
        else this.accessError=request?'Could not confirm your request. Check your status before trying again.':'Could not check your access status. Try again.';
      }finally{
        if(this.current(epoch)){this.accessBusy=false;this.accessTask=undefined;}
      }
    })();
    this.accessTask=pending;
    return pending;
  }
  advanceAccess(){
    if(this.accessBusy)return;
    if(this.accessStatus==='approved'||this.accessStatus==='admin'){void this.loadSession();return;}
    const request=['none','rejected','revoked'].includes(this.accessStatus)&&!this.accessError;
    void this.checkApplicantAccess(request);
  }
  private readSession(includeContentRevision=false){
    if(this.sessionTask)return this.sessionTask;
    const path=!this.fixture&&includeContentRevision?'/session?contentRevision=1':'/session';
    const pending=this.transport.request<PilotSession>(path);
    this.sessionTask=pending;
    void pending.then(
      ()=>{if(this.sessionTask===pending)this.sessionTask=undefined;},
      ()=>{if(this.sessionTask===pending)this.sessionTask=undefined;}
    );
    return pending;
  }
  private resetAccount(){
    this.accessStatus='unavailable';this.accessError='';this.accessBusy=false;this.accessTask=undefined;this.sessionTask=undefined;
    this.inboxSubmissionId='';this.checkingSubmissionId='';this.checkedLeases.clear();
    this.contentRevision=undefined;this.contentConfirmed=false;this.sharedProbeOnAttach=false;this.workReady=false;this.workRevision=undefined;this.requestsFresh=false;this.requestsPending=undefined;
    this.conversationCursor=null;this.ownHistoryLoading=false;this.ownHistoryError='';this.threadHistoryLoading=null;this.threadHistoryError={};
    this.confirmedBack=false;this.returningAfterCancel=false;this.composePage++;this.savedBrief=undefined;this.workRequest++;this.workPending=undefined;this.workPackets=[];this.workSheets=[];this.workError='';this.workLoading=false;this.ownQuery='';this.allWork=false;this.error='';this.emailForm=false;this.checkingInjector=undefined;
    this.checkingHome=false;this.checkingPacketId='';this.studentUid='';this.sheetHistoryUid='';this.workspaceUpdatesPending=false;
    this.authEpoch++;this.pendingJobAction=null;this.checkingPaperId='';this.stopEvents();this.refreshPending=undefined;this.servicePending=undefined;this.capabilityPending=undefined;this.contentAccessPending=undefined;this.contentDenied=false;this.contentAccessAllowed=false;this.presenceDenied=false;this.session=undefined;this.detail=undefined;this.conversations=[];
    this.serviceError='';this.serviceRequestId='';this.serviceStale=false;this.health=undefined;this.lastOverviewAt=0;this.openingId='';
    this.draft='';this.email='';this.password='';this.sendId='';this.sendText='';this.newRequestId='';this.feedbackText='';this.feedbackMessage='';this.feedbackPaperId='';this.feedbackOpen=false;
    this.loading=false;this.sending=false;this.serviceStarting=false;this.libraryKind='papers';this.legacyLibraryMode=false;this.libraryLoading=false;this.libraryRefreshRequested=false;this.libraryError='';this.adminConversation=false;this.view='home';this.drawer=false;
    this.clearLibraryFilters();this.libraryFiltersOpen=false;this.archiveSearch=undefined;this.archiveTail={};this.archiveEarlierError=false;this.libraryPages={papers:{items:[],nextCursor:null,loaded:false},conversations:{items:[],nextCursor:null,loaded:false}};this.closeDocument();
  }
  async login(email=false){this.error='';this.authenticating=true;try{if(email)await this.api.loginEmail(this.email,this.password);else await this.api.login();this.password='';if(!this.loading&&!this.session&&this.api.user)await this.loadSession();}catch(e){this.reportError(e);}finally{this.authenticating=false;}}
  async logout(){
    if(this.examUpdates)await this.examUpdates.disconnectDevice();
    this.writeRoute({},true);this.resetAccount();
    if(this.fixture)return;
    try{await this.api.logout();}catch(e){this.reportError(e);}
  }
  private async loadSession(){
    const epoch=this.authEpoch;this.loading=true;
    try{
      const session=await this.readSession(true);
      if(!this.current(epoch))return;
      this.acceptSession(session);this.serviceStale=false;
      this.contentRevision=session.contentRevision;
      if(this.checkedOwner && this.checkedOwner!==session.user.uid)this.writeRoute({},true);
      this.checkedOwner=session.user.uid;
      this.loading=false;
      const params=new URL(location.href).searchParams;
      if(this.fixture&&!this.fixture.startsWith('desk')&&!['view','checking','check','request'].some(key=>params.has(key))){
        if(this.fixture.startsWith('library'))await this.openLibrary(false);
        else{await this.loadConversations();if(!this.current(epoch))return;if(this.conversations.length)await this.openConversation(this.conversations[0].id,false);else await this.newConversation(false);}
      }else await this.restoreRoute();
      if(this.current(epoch))this.startEvents();
    }catch(e){if(this.current(epoch))this.reportError(e);}
    finally{if(this.current(epoch))this.loading=false;}
  }
  @HostListener('window:popstate',['$event'])
  async restoreRoute(event?:PopStateEvent){
    if(!this.user)return;
    if(event){
      const nextDepth=event.state?.gtDeskDepth||0;
      if(this.returningAfterCancel){
        this.returningAfterCancel=false;event.stopImmediatePropagation();return;
      }
      if(this.checkingOpen&&!this.confirmedBack&&nextDepth!==this.routeDepth){
        const mayLeave=new Event('gtop-checking-may-leave',{cancelable:true});
        if(!window.dispatchEvent(mayLeave)){
          event.stopImmediatePropagation();this.returningAfterCancel=true;history.go(this.routeDepth-nextDepth);return;
        }
      }
      this.confirmedBack=false;this.routeDepth=nextDepth;
    }
    const params=new URL(location.href).searchParams;
    if(history.state?.gtDeskOwner&&history.state.gtDeskOwner!==this.user.uid){
      this.writeRoute({},true);this.openHome(false);return;
    }
    const restoredUrl=location.href;
    const epoch=this.authEpoch;
    const update=params.get('update'), view=params.get('view');
    const staffRoute=update||view==='students'||view==='submissions'||params.has('studentUid')||params.has('submission')||params.has('shared');
    if((!this.papersAdmin&&staffRoute)||(view==='access'&&!this.managesAccess)){
      this.writeRoute({},true);this.openHome(false);return;
    }
    if(view==='access'){this.openAccessReview(false);return;}
    if(update&&this.updatesAvailable){await this.openExamDeepLink(update);return;}
    const check=params.get('check'),request=params.get('request');
    if(check)this.openChecking(check,params.get('packet')||'',params.get('sheet')||'',false,params.get('view')==='students'?params.get('studentUid')||'':'',params.get('view')==='submissions'?params.get('submission')||'':'');
    else if(params.get('checking')==='class')this.openCheckingHome(params.get('reference')||'',params.get('packet')||'',false);
    else if(request){
      if(params.get('shared')==='1'&&this.sharedLibrary)await this.openLibraryConversation(request,false);
      else await this.openConversation(request,false);
    }
    else if(params.get('view')==='create')await this.newConversation(false);
    else if(params.get('view')==='library')await this.openLibrary(false);
    else if(params.get('view')==='students')await this.openStudents(params.get('studentUid')||'',false);
    else if(params.get('view')==='submissions')await this.openSubmissions(params.get('submission')||'',false);
    else this.openHome(false);
    const preview=history.state?.gtDeskPreview;
    if(preview && history.state?.gtDeskOwner===this.user?.uid && restoredUrl===location.href && !this.checkingOpen){
      const papers=this.view==='library' ? this.libraryPages.papers.items as PaperSummary[] : this.detail?.papers || [];
      let paper=papers.find(item=>item.id===preview.paperId);
      const thread=this.view==='chat'?this.detail:undefined;
      if(!paper&&thread?.history&&typeof preview.paperId==='string'){
        const path=this.threadPath(thread.conversation.id,this.adminConversation,'paper',{paperId:preview.paperId});
        try{paper=(await this.transport.request<{paper:PaperSummary}>(path)).paper;}catch(error){
          if(this.current(epoch)&&[401,403].includes((error as {status?:number})?.status||0))this.reportError(error);
        }
      }
      if(this.current(epoch)&&restoredUrl===location.href&&paper&&(preview.kind==='student'||preview.kind==='answers'))await this.showDocument(paper,preview.kind,!!preview.adminView);
    }
  }
  private async loadConversations(older=false){
    const epoch=this.authEpoch;
    if(this.requestsPending){
      const pending=this.requestsPending;
      await pending.promise;
      if(!this.current(epoch)||pending.older===older)return;
    }
    const cursor=older?this.conversationCursor:null;
    if(older&&!cursor)return;
    const revision=this.contentRevision;
    const promise=(async()=>{
      const path=this.fixture?'/conversations':'/conversations?view=recent'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
      const result=await this.transport.request<ConversationList>(path);
      if(!this.current(epoch))return;
      const newCursor=result.nextCursor??null;
      const overlaps=result.conversations.length&&this.conversations.some(row=>row.id===result.conversations.at(-1)?.id);
      if(older||overlaps&&newCursor){
        this.conversations=mergeRows(this.conversations,result.conversations).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id));
      }else this.conversations=result.conversations;
      if(older||!overlaps||!newCursor)this.conversationCursor=newCursor;
      if(!older)this.requestsFresh=revision===this.contentRevision;
    })();
    const pending={older,promise};
    this.requestsPending=pending;
    try{await promise;}finally{if(this.requestsPending===pending)this.requestsPending=undefined;}
  }
  async loadOwnHistory(refresh=false){
    if(!this.user||!this.contentAuthorized||this.ownHistoryLoading)return;
    const epoch=this.authEpoch;
    this.ownHistoryLoading=true;this.ownHistoryError='';
    try{await this.loadConversations(!refresh);}catch(error){
      if(this.current(epoch)){
        if([401,403].includes((error as {status?:number})?.status||0))this.reportError(error);
        else this.ownHistoryError=readableError(error);
      }
    }finally{if(this.current(epoch))this.ownHistoryLoading=false;}
  }
  private threadPath(id:string,admin:boolean,view:string,extra?:Record<string,string>){
    const path=(admin?'/admin/conversations/':'/conversations/')+encodeURIComponent(id);
    return this.fixture?path:path+'?'+new URLSearchParams({view,...extra});
  }
  async loadThreadHistory(kind:ThreadHistory){
    const detail=this.detail,cursor=detail?.history?.[kind];
    if(!detail||!cursor||!this.contentAuthorized||this.threadHistoryLoading)return;
    const epoch=this.authEpoch,id=detail.conversation.id,admin=this.adminConversation,page=this.composePage;
    const current=()=>this.current(epoch)&&this.composePage===page&&this.view==='chat'&&this.detail?.conversation.id===id&&this.adminConversation===admin;
    this.threadHistoryLoading=kind;this.threadHistoryError[kind]='';
    try{
      const result=await this.transport.request<{items:Message[]|PaperSummary[];nextCursor:string|null}>(this.threadPath(id,admin,kind,{cursor}));
      if(!current()||!this.detail?.history||this.detail.history[kind]!==cursor)return;
      const el=this.messageList?.nativeElement;
      const height=el?.scrollHeight||0,top=el?.scrollTop||0;
      const rows=kind==='messages'?{messages:mergeRows(this.detail.messages,result.items as Message[]).sort(timeOrder)}:
        {papers:mergeRows(this.detail.papers,result.items as PaperSummary[]).sort(timeOrder)};
      this.detail={...this.detail,...rows,history:{...this.detail.history,[kind]:result.nextCursor}};
      if(el&&kind==='messages')requestAnimationFrame(()=>{if(current())el.scrollTop=top+el.scrollHeight-height;});
    }catch(error){
      if(current()){
        if(admin&&(error as {status?:number})?.status===404){this.clearSharedThread();this.reportError(error);return;}
        if([401,403].includes((error as {status?:number})?.status||0))this.reportError(error);
        else this.threadHistoryError[kind]=readableError(error);
      }
    }finally{if(current())this.threadHistoryLoading=null;}
  }
  async openConversation(id:string,write=true){
    if(!this.user||!this.contentAuthorized)return;
    this.prepareNavigation();if(write)this.writeRoute({request:id});
    const epoch=this.authEpoch;this.view='chat';this.detail=undefined;this.draft='';this.adminConversation=false;
    this.openingId=id;this.error='';this.drawer=false;this.closeDocument();this.feedbackPaperId='';this.feedbackOpen=false;this.feedbackText='';this.feedbackMessage='';
    this.threadHistoryLoading=null;this.threadHistoryError={};
    try{const result=await this.transport.request<ConversationDetail>(this.threadPath(id,false,'recent'));if(this.current(epoch)&&this.openingId===id){this.detail=result;this.scrollMessages(true);}}
    catch(e){if(this.current(epoch)&&this.openingId===id)this.reportError(e);}
    finally{if(this.current(epoch))this.scheduleThreadCheck();}
  }
  async newConversation(write=true){
    if(!this.user||!this.contentAuthorized)return;
    this.prepareNavigation();if(write)this.writeRoute({view:'create'});
    this.detail=undefined;this.view='chat';this.adminConversation=false;this.draft=this.savedBrief?.text||'';this.drawer=false;this.openingId='';this.error='';this.sendId='';this.newRequestId='';this.closeDocument();this.scheduleThreadCheck();
    setTimeout(()=>{
      const target=matchMedia('(pointer:coarse)').matches?'.new-paper h1':'#message-input';
      document.querySelector<HTMLElement>(target)?.focus({preventScroll:true});
    },0);
  }
  async send(){
    const text=this.draft;
    if(!this.user||!this.contentAuthorized||this.readOnly||this.readingRequest||this.view!=='chat'||!text.trim()||this.sending||this.blockedTurn)return;
    const epoch=this.authEpoch, page=this.composePage;
    this.sending=true;this.error='';
    if(this.sendText!==text){this.sendId=idForRequest();this.sendText=text;}
    this.sendId||=idForRequest();
    const messageId=this.sendId;
    let conversation=this.detail?.conversation;
    try{
      if(!conversation){
        this.newRequestId||=idForRequest();
        const result=await this.transport.request<{conversation:Conversation}>('/conversations','POST',{clientRequestId:this.newRequestId});
        if(!this.current(epoch))return;
        conversation=result.conversation;
        if(page===this.composePage){
          this.detail={conversation,messages:[],jobs:[],papers:[]};
          this.openingId=conversation.id;this.writeRoute({request:conversation.id},true);this.newRequestId='';
        }
      }
      await this.transport.request('/conversations/'+encodeURIComponent(conversation.id)+'/messages','POST',{text,clientMessageId:messageId});
      if(!this.current(epoch))return;
      if(this.savedBrief?.text.trim()===text.trim())this.savedBrief=undefined;
      if(page===this.composePage){
        this.sendId='';this.sendText='';this.draft='';await this.refresh(false,true);this.scrollMessages(true);
      }else if(this.onDesk)await this.reloadDesk();
      else await this.loadConversations();
    }catch(e){if(this.current(epoch))this.reportError(e);}
    finally{if(this.current(epoch)){this.sending=false;this.scheduleThreadCheck();}}
  }
  composerKey(event:KeyboardEvent){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void this.send();}}
  useSuggestion(text:string){if(this.readOnly)return;this.draft=text;document.querySelector<HTMLTextAreaElement>('#message-input')?.focus();}
  async jobAction(job:Job,action:'cancel'|'retry'){
    if(!this.contentAuthorized||this.readOnly||this.pendingJobAction)return;
    const epoch=this.authEpoch,pending={id:job.id,action};
    this.pendingJobAction=pending;
    this.error='';
    try{
      await this.transport.request('/jobs/'+encodeURIComponent(job.id)+'/'+action,'POST',{});
      if(this.current(epoch))await this.refresh(false,true);
    }catch(error){if(this.current(epoch))this.reportError(error);}
    finally{if(this.pendingJobAction===pending)this.pendingJobAction=null;}
  }
  async refresh(automatic=false,contentOnly=false){
    if(!this.contentAuthorized)return;
    const epoch=this.authEpoch;
    if(this.refreshPending){await this.refreshPending;if(automatic||!this.current(epoch))return;}
    if(!this.session||!this.current(epoch))return;
    const pending=this.refreshNow(automatic,contentOnly);this.refreshPending=pending;
    try{await pending;}finally{if(this.refreshPending===pending)this.refreshPending=undefined;}
  }
  private get viewingSharedThread(){return this.view==='chat'&&!this.checkingOpen&&this.adminConversation&&this.readOnly&&!!this.detail;}
  private clearSharedThread(){this.threadHistoryLoading=null;this.threadHistoryError={};this.detail=undefined;this.closeDocument();}
  private async probeSharedThread(){
    if(!this.viewingSharedThread)return;
    const epoch=this.authEpoch,page=this.composePage;
    try{await this.refresh(true,true);}
    catch(error){if(this.current(epoch)&&this.composePage===page)this.reportError(error);}
  }
  private async refreshNow(automatic:boolean,contentOnly:boolean){
    const epoch=this.authEpoch,page=this.composePage;
    const prior=this.view==='chat'?this.detail:undefined,id=prior?.conversation.id;
    const nearBottom=this.messageList ? this.messageList.nativeElement.scrollHeight-this.messageList.nativeElement.scrollTop-this.messageList.nativeElement.clientHeight<150 : true;
    const oldCount=this.detail?.messages.length;
    const admin=this.adminConversation;
    const overview=!contentOnly&&(!automatic||Date.now()-this.lastOverviewAt>=30000);
    const path=(admin?'/admin/conversations/':'/conversations/')+encodeURIComponent(id||'');
    const getDetail=async():Promise<ThreadStatus|undefined>=>{
      if(!id)return undefined;
      if(prior?.history)return this.transport.request<ThreadStatus>(this.threadPath(id,admin,'status',{updatedAt:prior.conversation.updatedAt}));
      if(automatic&&!this.fixture&&!this.activeJobs.length){
        const revision=await this.transport.request<{updatedAt:string}>(path+'/revision');
        if(revision.updatedAt===this.detail?.conversation.updatedAt)return undefined;
      }
      return this.transport.request<ConversationDetail>(this.threadPath(id,admin,'recent'));
    };
    const [session,detail]=await Promise.all([overview?this.readSession():Promise.resolve(this.session!),getDetail().catch(error=>{
      if(admin&&(error as {status?:number})?.status===404&&this.current(epoch)&&page===this.composePage)this.clearSharedThread();
      throw error;
    })]);
    if(!this.current(epoch)||!this.session)return;
    if(overview){this.acceptSession(session);this.serviceStale=false;if(this.events?.presenceReady&&this.eventConfig===JSON.stringify(session.notifications)&&session.notifications?.presencePath&&freshHealth(this.health))this.receiveHealth(this.health);}
    if(this.session.service?.state==='ready')this.serviceError='';
    const current=this.detail;
    if(this.view==='chat'&&page===this.composePage&&current&&id===current.conversation.id&&admin===this.adminConversation&&detail){
      if('unchanged' in detail)this.detail={...current,jobs:detail.jobs};
      else {
        let next=detail;
        if(current.history&&detail.history){
          next={...detail,messages:mergeRows(current.messages,detail.messages).sort(timeOrder),papers:mergeRows(current.papers,detail.papers).sort(timeOrder),history:{
            messages:mergedHistoryCursor(current.messages,detail.messages,current.history.messages,detail.history.messages),
            papers:mergedHistoryCursor(current.papers,detail.papers,current.history.papers,detail.history.papers)
          }};
        }
        this.detail=admin?{...next,readOnly:next.readOnly??true,creatorName:next.creatorName||current.creatorName}:next;
        if(nearBottom&&oldCount!==next.messages.length)this.scrollMessages();
      }
    }
    if(overview)this.lastOverviewAt=Date.now();
    this.configureEvents();
    this.scheduleService();this.scheduleThreadCheck();
  }
  async reconnect(){const epoch=this.authEpoch;this.error='';try{if(!this.contentAuthorized)await this.reconcileContentAccess();if(this.contentAuthorized){await this.refresh();if(this.current(epoch)&&this.onDesk&&!this.events)await this.reloadDesk();}}catch(e){if(this.current(epoch)){this.serviceStale=true;this.reportError(e);}}}
  async startService(){
    if(!this.contentAuthorized||!this.canStartService)return;
    const epoch=this.authEpoch;
    this.serviceStarting=true;this.serviceError='';this.serviceRequestId||=idForRequest();
    try{const result=await this.transport.request<{service:AssistantServiceStatus}>('/service/start','POST',{clientRequestId:this.serviceRequestId});if(this.session&&this.current(epoch)){this.session={...this.session,service:result.service,worker:result.service.worker};this.serviceRequestId='';}}
    catch(e){if(this.current(epoch)){this.serviceStale=true;this.serviceError='Start could not be confirmed. Refresh status before trying again.';if([401,403].includes((e as {status?:number})?.status||0))this.reportError(e);}}
    finally{if(this.current(epoch)){this.serviceStarting=false;this.scheduleThreadCheck();this.scheduleService();}}
  }
  private stopEvents(){clearTimeout(this.timer);clearTimeout(this.sharedAccessTimer);this.sharedAccessTimer=undefined;clearTimeout(this.serviceTimer);clearTimeout(this.contentRetryTimer);this.contentRetryAttempt=0;this.events?.stop();this.events=undefined;this.eventConfig='';this.contentQueue?.stop();this.contentQueue=undefined;}
  private configureEvents(){if(this.events&&this.eventConfig!==JSON.stringify(this.session?.notifications)){this.stopEvents();this.health=undefined;}if(!this.events)this.startEvents();}
  private startEvents(){
    if(this.destroyed||!this.session||document.hidden||this.events)return;
    const config=this.session.notifications,epoch=this.authEpoch;
    if(!this.fixture&&validNotifications(config,this.session.user.uid)){
      this.eventConfig=JSON.stringify(config);
      this.contentQueue=new InvalidationQueue(async()=>{
        if(!this.current(epoch)||document.hidden||!this.contentAuthorized)return;
        if(this.view==='home'&&!this.checkingOpen){
          await this.reloadDesk();
          if(this.workRevision!==this.contentRevision&&this.current(epoch)&&!document.hidden)await this.reloadDesk();
        }else{
          if(this.view==='chat'&&!this.checkingOpen)await this.refresh(false,true);
          if(this.drawer||this.view==='library'&&!this.sharedLibrary)await this.loadConversations();
        }
        if(!this.current(epoch)||document.hidden)return;
        clearTimeout(this.contentRetryTimer);if(this.contentRetryAttempt)this.error='';this.contentRetryAttempt=0;
        for(const page of Object.values(this.libraryPages))page.loaded=false;
        if(this.view==='library'&&(this.legacyLibraryMode||this.libraryKind==='conversations')){
          if(this.libraryLoading)this.libraryRefreshRequested=true;else await this.loadLibrary(true);
        }
      },error=>{
        if(!this.current(epoch))return;this.reportError(error);
        if(!this.current(epoch)||!this.session||document.hidden)return;
        clearTimeout(this.contentRetryTimer);if(this.contentRetryAttempt<3)this.contentRetryTimer=setTimeout(()=>this.contentQueue?.request(),2000*2**this.contentRetryAttempt++);
      });
      this.events=new OwnerEvents(this.api.watchMarker.bind(this.api),config,{
        content:(revision,signal)=>{
          const regainedAccess=this.contentDenied;
          this.contentDenied=false;this.contentAccessAllowed=false;
          const changed=regainedAccess||revision!==this.contentRevision;
          const phase=signal==='attach'?(this.contentConfirmed?'reconnect':'initial'):signal;
          const probeShared=phase==='reconnect'&&(signal!=='attach'||!this.sharedProbeOnAttach);
          if(signal==='attach')this.sharedProbeOnAttach=false;
          const marker='gt-papers:content:'+phase+(changed?':changed':':unchanged');
          performance.clearMarks(marker);performance.mark(marker);
          this.contentConfirmed=true;
          if(!changed){if(probeShared)void this.probeSharedThread();return;}
          this.contentRevision=revision;this.workReady=false;this.requestsFresh=false;
          if(this.checkingOpen){
            this.workspaceUpdatesPending=true;
            window.dispatchEvent(new Event('gtop-paper-content-updated'));
          }else if(!this.submissionsOpen)this.contentQueue?.request();
        },
        presence:health=>{if(this.current(epoch))this.receiveHealth(health);},
        state:()=>{if(this.current(epoch)){this.scheduleThreadCheck();this.scheduleService();}},
        denied:(kind,code)=>{
          if(!this.current(epoch))return;
          if(kind==='content'){this.contentDenied=true;this.contentAccessAllowed=false;clearTimeout(this.timer);void this.reconcileContentAccess();}
          else{this.presenceDenied=true;this.health=undefined;this.serviceStale=true;void this.reconcileCapabilities();}
        }
      });
      this.events.start();
    }
    this.scheduleThreadCheck();this.scheduleService();
  }
  private async reconcileContentAccess(){
    if(this.fixture||!this.session||document.hidden||this.destroyed)return;
    if(this.contentAccessPending)return this.contentAccessPending;
    const epoch=this.authEpoch;
    const pending=(async()=>{
      try{
        // Direct Firestore policy failure does not establish gateway revocation.
        const session=await this.readSession();
        if(!this.current(epoch)||!this.session)return;
        this.acceptSession(session);this.contentAccessAllowed=true;this.error='';
        if(this.events?.presenceReady&&this.eventConfig===JSON.stringify(session.notifications)&&freshHealth(this.health))this.receiveHealth(this.health);
        this.configureEvents();this.contentQueue?.request();this.scheduleThreadCheck();
      }catch(e){if(this.current(epoch)){this.contentAccessAllowed=false;this.reportError(e);}}
      finally{if(this.current(epoch)){
        this.contentAccessPending=undefined;
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
        const session=await this.readSession();
        if(!this.current(epoch)||!this.session)return;
        if(this.presenceDenied&&session.service){
          try{const result=await this.transport.request<{service:AssistantServiceStatus}>('/service/status');if(!this.current(epoch)||!this.session)return;session.service=result.service;session.worker=result.service.worker;}
          catch(e){if(![403,503].includes((e as {status?:number})?.status||0))throw e;}
        }
        this.acceptSession(session);this.serviceStale=this.presenceDenied;
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
    const deadline=Date.parse(this.session.worker.lastSeenAt||'')+90000;
    const startup=this.session.service?.request;
    const starterDeadline=startup&&['pending','claimed','started'].includes(startup.state)?Date.parse(startup.expiresAt):NaN;
    if(starterDeadline>Date.now()){
      const epoch=this.authEpoch;
      this.serviceTimer=setTimeout(()=>{
        if(this.current(epoch)&&!document.hidden)void this.refreshService();
      },starterDeadline-Date.now());
      return;
    }
    if(this.serviceStale)return;
    if(!(deadline>Date.now())){if(Number.isFinite(deadline)&&!freshHealth(this.health))this.serviceStale=true;return;}
    const epoch=this.authEpoch;
    this.serviceTimer=setTimeout(()=>{
      if(this.current(epoch)&&!document.hidden&&!freshHealth(this.health))this.serviceStale=true;
    },Math.max(1,deadline-Date.now()));
  }
  private scheduleThreadCheck(){
    clearTimeout(this.timer);
    if(this.destroyed||!this.session||document.hidden||!this.contentAuthorized)return;
    const epoch=this.authEpoch;
    const jobs=this.view==='chat'?this.activeJobs:[];
    const activeIds=new Set(jobs.map(job=>job.id));
    for(const id of this.checkedLeases.keys())if(!activeIds.has(id))this.checkedLeases.delete(id);
    const pending=jobs.filter(job=>job.nextLeaseCheckAt&&this.checkedLeases.get(job.id)!==job.nextLeaseCheckAt)
      .map(job=>({id:job.id,deadline:job.nextLeaseCheckAt!,time:Date.parse(job.nextLeaseCheckAt!)}))
      .filter(job=>Number.isFinite(job.time)).sort((a,b)=>a.time-b.time);
    if(pending.length)this.timer=setTimeout(async()=>{
      if(!this.current(epoch)||document.hidden)return;
      const due=pending.filter(job=>job.time<=Date.now());
      try{
        await this.refresh(false,true);
        if(!this.current(epoch))return;
        for(const job of due)this.checkedLeases.set(job.id,job.deadline);
        this.scheduleThreadCheck();
      }catch(error){if(this.current(epoch))this.reportError(error);}
    },Math.max(100,pending[0].time-Date.now()));
    // An invited viewer cannot subscribe to the author's private owner marker.
    // Revalidate this one visible shared thread, including revocation.
    if(!this.viewingSharedThread){clearTimeout(this.sharedAccessTimer);this.sharedAccessTimer=undefined;}
    else if(!this.sharedAccessTimer)this.sharedAccessTimer=setTimeout(async()=>{
      this.sharedAccessTimer=undefined;
      if(!this.current(epoch)||document.hidden)return;
      await this.probeSharedThread();
      if(this.current(epoch))this.scheduleThreadCheck();
    },60000);
  }
  private scrollMessages(force=false){setTimeout(()=>{const el=this.messageList?.nativeElement;if(el)el.scrollTo({top:el.scrollHeight,behavior:force?'instant':'auto'});},30);}
  relativeTime(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const minutes=Math.floor((Date.now()-date.getTime())/60000);if(minutes<1)return 'Just now';if(minutes<60)return minutes+' min ago';if(minutes<1440)return date.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});return date.toLocaleDateString('en-IN',{day:'numeric',month:'short'});}
  initials(){return (this.user?.displayName || this.user?.email || 'Teacher').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();}
  private printRequest = 0;
  private previewOpener?: HTMLElement;
  previewReady = false;
  async showDocument(paper:PaperSummary,kind:'student'|'answers',adminView=this.adminConversation,printOnOpen=false){
    if(!this.contentAuthorized || (adminView && !this.sharedLibrary))return;
    const epoch=this.authEpoch, request=++this.documentRequest;
    if(!this.document && typeof HTMLElement!=='undefined' && document.activeElement instanceof HTMLElement)this.previewOpener=document.activeElement;
    this.documentLoading=true;this.error='';this.libraryError='';this.printRequest=0;
    try{
      if(adminView && !this.transport.adminArtifact)throw Error('Library documents are not available yet.');
      const html=await (adminView ? this.transport.adminArtifact!(paper.id,kind) : this.transport.artifact(paper.id,kind));
      if(!this.current(epoch) || request!==this.documentRequest)return;
      if(this.document?.paper.id!==paper.id)this.clearStudentLink();
      this.previewReady=false;
      this.printRequest=printOnOpen ? request : 0;
      this.document={paper,kind,source:html,adminView,readOnly:adminView&&paper.ownerUid!==this.user?.uid,safe:this.sanitizer.bypassSecurityTrustHtml(presentArtifact(html,paper.revision))};
      if (!printOnOpen) setTimeout(() => {
        if (this.documentRequest === request) document.querySelector<HTMLElement>('.preview-title')?.focus({preventScroll:true});
      });
    }catch(e){
      if(this.current(epoch) && request===this.documentRequest){this.reportError(e);this.libraryError=readableError(e);}
    }finally{if(this.current(epoch) && request===this.documentRequest)this.documentLoading=false;}
  }
  async getStudentLink(invite=false){
    const paper=this.document?.paper;
    if(!paper||!this.papersAdmin||!this.contentAuthorized||this.previewLinkBusy)return;
    const uses=this.previewInviteUses;
    if(invite&&(!Number.isInteger(uses)||uses<1||uses>30))return;
    const epoch=this.authEpoch, request=++this.linkRequest;
    this.previewLinkBusy=true;this.previewLinkError='';this.previewLinkNotice='';
    const base='/staff/student-submissions';
    try{
      const response=await this.transport.request<{code:string;testCode?:string}>(
        base+(invite?'/invites':'/tests'),'POST',{paperId:paper.id,...(invite?{uses}:{})}
      );
      if(!this.current(epoch)||this.document?.paper.id!==paper.id||request!==this.linkRequest)return;
      const {studentSubmissionLink}=await import('./student-submissions.component');
      if(!this.current(epoch)||this.document?.paper.id!==paper.id||request!==this.linkRequest)return;
      const url=new URL(studentSubmissionLink(invite?'invite':'test',response.code));
      if(invite&&response.testCode)url.searchParams.set('test',response.testCode);
      this.previewLinkMode=invite?'invite':'test';
      this.previewStudentLink=url.href;
    }catch(error){
      if(this.current(epoch)&&request===this.linkRequest)this.previewLinkError=readableError(error);
    }finally{
      if(this.current(epoch)&&request===this.linkRequest)this.previewLinkBusy=false;
    }
  }
  async copyStudentLink(input:HTMLInputElement){
    try{await navigator.clipboard.writeText(input.value);this.previewLinkNotice='Link copied.';}
    catch{input.select();this.previewLinkNotice='Select and copy the link.';}
  }
  closeDocument(){
    ++this.documentRequest;this.documentLoading=false;this.previewReady=false;this.printRequest=0;
    this.document=undefined;this.previewOpener=undefined;this.clearStudentLink();
  }
  private clearStudentLink(){
    ++this.linkRequest;this.previewStudentLink='';this.previewLinkError='';this.previewLinkNotice='';
    this.previewLinkBusy=false;this.previewInviteUses=10;this.previewLinkMode='test';
  }
  async reviseArchivePaper(paper:PaperSummary){
    if (!paper.conversationId || paper.ownerUid!==this.user?.uid)return;
    if(this.sharedLibrary)await this.openLibraryConversation(paper.conversationId);
    else await this.openConversation(paper.conversationId);
    if (this.detail?.conversation.id===paper.conversationId && !this.readOnly)this.revise(this.currentPaper || paper);
  }
  @HostListener('document:keydown.escape',['$event'])
  dismissPreview(event:Event){
    if(this.document && !this.drawer){event.preventDefault();this.closePreview();}
  }
  closePreview(){
    if(history.state?.gtDeskPreview){
      const {gtDeskPreview,...state}=history.state;
      history.replaceState(state,'',location.href);
    }
    const opener=this.previewOpener;this.closeDocument();
    setTimeout(()=>{if(opener?.isConnected)opener.focus({preventScroll:true});});
  }
  prepareDocument(fromLoad=false){
    const frame=document.querySelector<HTMLIFrameElement>('#paper-frame');
    const doc=frame?.contentDocument;
    if(!doc?.getElementById('gtop-artifact-presentation') || !frame)return;
    if(fromLoad){
      doc.addEventListener('keydown',event=>{if(event.key==='Escape')this.dismissPreview(event);});
      this.previewReady=true;
      if(this.printRequest && this.printRequest===this.documentRequest){
        const request=this.printRequest;this.printRequest=0;
        void Promise.resolve(doc.fonts?.ready).then(()=>{
          if(request===this.documentRequest && frame.contentDocument===doc)this.printDocument();
        });
      }
    }
    const apply=()=>{if(frame?.contentDocument!==doc)return;for(const formula of Array.from(doc.querySelectorAll<HTMLElement>('.katex,.katex-display'))){
      const overflow=formula.scrollWidth>formula.clientWidth+1;
      if(overflow){formula.tabIndex=0;formula.setAttribute('aria-label','Scrollable formula');}
      else{formula.removeAttribute('tabindex');formula.removeAttribute('aria-label');}
    }};
    apply();void doc.fonts?.ready.then(apply);
  }
  private paperFilename(extension:string):string {
    const doc=this.document;
    return doc?artifactFilename({label:doc.paper.title,id:doc.paper.id,revision:doc.paper.revision,
      kind:doc.kind==='student'?'question-paper':'answer-key',extension}):'GT Papers.'+extension;
  }
  downloadDocument(){
    if(!this.document||!this.contentAuthorized||this.documentLoading)return;
    saveArtifact(new Blob([this.document.source],{type:'text/html;charset=utf-8'}),this.paperFilename('html'));
  }
  printDocument(){
    const frame=document.querySelector<HTMLIFrameElement>('#paper-frame');
    if(frame?.contentDocument)frame.contentDocument.title=this.paperFilename('pdf').slice(0,-4);
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  }
  revise(paper:PaperSummary){if(this.readOnly||this.view!=='chat')return;const latest=this.currentPaper || paper;this.closeDocument();this.draft='In revision '+latest.revision+', please ';setTimeout(()=>document.querySelector<HTMLTextAreaElement>('#message-input')?.focus(),0);}
  async feedback(rating:'helpful'|'needs_work',paperId?:string){if(!this.contentAuthorized||this.readOnly)return;const epoch=this.authEpoch;this.feedbackMessage='';const messageId=[...(this.detail?.messages||[])].reverse().find(m=>m.role==='assistant')?.id;try{await this.transport.request('/feedback','POST',{conversationId:this.detail!.conversation.id,...(paperId?{paperId}:{}),...(messageId?{messageId}:{}),rating,...(this.feedbackText.trim()?{text:this.feedbackText.trim()}:{})});if(!this.current(epoch))return;this.feedbackMessage='Thank you. Your feedback has been saved.';this.feedbackText='';this.feedbackPaperId='';this.feedbackOpen=false;}catch(e){if(this.current(epoch))this.reportError(e);}}
}
bootstrapApplication(PaperWorkspace,{providers:[provideZoneChangeDetection(),provideServiceWorker('ngsw-worker.js',{enabled:!isDevMode(),registrationStrategy:'registerWhenStable:30000'})]}).catch(error=>{console.error(error);document.body.textContent='The workspace could not start. Please reload and try again.';});
