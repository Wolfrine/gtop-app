import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { RouterLink } from '@angular/router';
import { QuestionModuleHeaderComponent } from './question-module-header.component';
import { QuestionPaperRepository, type PaperRequestRecord, type SavedPaperDraft } from '../core/question-paper.repository';

@Component({selector:'app-question-papers', standalone:true, imports:[RouterLink, QuestionModuleHeaderComponent], template:`
  <div class="page qm-page">
    <app-question-module-header active="papers" title="Question papers" description="Create a paper, review missing questions, then print." />
    @if(error()) { <p class="qm-alert" role="alert">{{error()}} <button type="button" (click)="load()">Try again</button></p> }
    <div class="qm-section-title"><h2>In progress <span>{{requests().length}}</span></h2><button class="btn btn-secondary" (click)="load()" [disabled]="loading()">Refresh</button></div>
    @if(loading()) { <p role="status">Loading papers…</p> }
    @if(!loading() && !requests().length && !error()) {
      <section class="qm-empty"><h3>Your next paper starts here</h3><p>Choose a format and chapters. Use approved questions immediately, or request the missing ones.</p><a class="btn btn-primary" routerLink="/admin/question-paper-generator">Create your first paper</a></section>
    }
    <div class="qm-paper-list">
      @for(request of requests(); track request.id) {
        <article class="qm-paper-row">
          <div><span class="qm-status" [class.ready]="request.status === 'ready'">{{status(request)}}</span><h3>{{request.title}}</h3>
            <p>{{request.board}} · Class {{request.standard}} · {{request.subjects.join(', ')}} · {{request.marks}} marks</p>
            @if(request.progress?.pendingReview) { <small>{{request.progress!.pendingReview}} questions to review</small> }
            <small>{{nextStep(request)}}</small>
          </div>
          <div class="qm-row-actions">
            @if(request.status === 'awaiting-syllabus' || request.status === 'awaiting-approval') { <a class="btn btn-secondary" routerLink="/syllabus-preview">Review syllabus</a> }
            @if(request.progress?.pendingReview || request.status === 'awaiting-review') { <a class="btn btn-secondary" routerLink="/admin/question-review" [queryParams]="{requestId:request.id}">Review questions</a> }
            <a class="btn btn-primary" routerLink="/admin/question-paper-generator" [queryParams]="{requestId:request.id}">Check & continue</a>
            <button type="button" class="qm-cancel" [disabled]="busy()===request.id" (click)="cancel(request)">{{confirmCancel===request.id?'Confirm cancellation':'Cancel request'}}</button>
            <a routerLink="/admin/question-bank" [queryParams]="{requestId:request.id}">View requests</a>
          </div>
        </article>
      }
    </div>
    @if(moreRequests()){<button type="button" class="btn btn-secondary" (click)="loadOlder(false)" [disabled]="loading()">Load older requests</button>}
    <div class="qm-section-title"><h2>Saved papers <span>{{drafts().length}}</span></h2><a routerLink="/syllabus-preview">Manage syllabus →</a></div>
    @if(!loading() && !drafts().length) { <p class="qm-muted">Saved papers and their answer keys appear here.</p> }
    <div class="qm-paper-list">@for(draft of drafts(); track draft.id) {
      <article class="qm-paper-row"><div><h3>{{draft.title}}</h3><p>{{draft.board}} · Class {{draft.standard}} · {{draft.subjects.join(', ')}} · {{draft.marks}} marks</p></div>
        <a class="btn btn-secondary" routerLink="/admin/question-paper-generator" [queryParams]="{draftId:draft.id}">Open paper</a></article>
    }</div>
    @if(moreDrafts()){<button type="button" class="btn btn-secondary" (click)="loadOlder(true)" [disabled]="loading()">Load older saved papers</button>}
  </div>
`})
export class QuestionPapersPage implements OnInit, OnDestroy {
  requests=signal<PaperRequestRecord[]>([]); drafts=signal<SavedPaperDraft[]>([]); loading=signal(false); error=signal('');
  moreRequests=signal<string|null>(null);moreDrafts=signal<string|null>(null);busy=signal('');confirmCancel='';
  private requestSubscription?:Subscription;private draftSubscription?:Subscription;
  constructor(private readonly papers:QuestionPaperRepository,private readonly auth:AuthService) {}
  ngOnInit():void { void this.load(); }
  ngOnDestroy():void{this.requestSubscription?.unsubscribe();this.draftSubscription?.unsubscribe();}
  async load():Promise<void> {this.ngOnDestroy();this.loading.set(true);this.error.set('');let requestsReady=false,draftsReady=false;
    const failed=(e:unknown)=>{this.error.set(e instanceof Error?e.message:'Papers could not load.');this.loading.set(false);};
    this.requestSubscription=this.papers.requestUpdates().subscribe({next:requests=>{this.requests.set(requests.filter(r=>!['cancelled','completed'].includes(r.status)));this.moreRequests.set(requests.length===20?requests.at(-1)!.id:null);requestsReady=true;this.loading.set(!draftsReady);},error:failed});
    this.draftSubscription=this.papers.draftUpdates().subscribe({next:drafts=>{this.drafts.set(drafts);this.moreDrafts.set(drafts.length===20?drafts.at(-1)!.id:null);draftsReady=true;this.loading.set(!requestsReady);},error:failed});
  }
  async loadOlder(saved:boolean):Promise<void>{if(this.loading())return;this.loading.set(true);try{
    if(saved){this.draftSubscription?.unsubscribe();const page=await this.papers.recentDrafts(this.moreDrafts()??undefined);this.drafts.update(items=>[...items,...page]);this.moreDrafts.set(page.length===20?page.at(-1)!.id:null);}
    else{this.requestSubscription?.unsubscribe();const page=await this.papers.recentRequests(this.moreRequests()??undefined);this.requests.update(items=>[...items,...page.filter(r=>!['cancelled','completed'].includes(r.status))]);this.moreRequests.set(page.length===20?page.at(-1)!.id:null);}
  }catch(e){this.error.set(e instanceof Error?e.message:'Older papers could not load.');}finally{this.loading.set(false);}}
  async cancel(request:PaperRequestRecord):Promise<void>{if(this.confirmCancel!==request.id){this.confirmCancel=request.id;return;}this.busy.set(request.id);try{await this.papers.cancelRequest(request.id,this.auth.profile()?.uid??'');this.requests.update(items=>items.filter(i=>i.id!==request.id));this.confirmCancel='';}catch(e){this.error.set(e instanceof Error?e.message:'Could not cancel request.');}finally{this.busy.set('');}}
  status(r:PaperRequestRecord):string {return ({'awaiting-coverage':'Queued','awaiting-syllabus':'Syllabus needed','awaiting-approval':'Syllabus review','creating-questions':'Questions requested','awaiting-review':'Review needed',ready:'Ready to build',blocked:'Needs attention'} as Record<string,string>)[r.status]??r.status.replaceAll('-',' ');}
  nextStep(r:PaperRequestRecord):string {return r.status==='ready'?'Check availability and prepare your paper.':r.status.includes('syllabus')||r.status==='awaiting-approval'?'Approve the missing syllabus to continue.':r.status==='awaiting-review'?'Approve the drafts, then return to your paper.':'The daily creator works from this request. Check & continue uses the latest approved bank.';}
}
