import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild, inject } from '@angular/core';
import { AssistantApi } from './api.service';
import type { PapersAccessDecision, PapersAccessFilter, PapersAccessPage, PapersAccessRow } from './contracts';

@Component({
  selector:'gtop-papers-access-review',
  standalone:true,
  imports:[CommonModule],
  templateUrl:'./access-review.html',
  styleUrl:'./access-review.css'
})
export class PapersAccessReviewComponent implements OnInit,OnDestroy {
  @Output() closed=new EventEmitter<void>();
  @Output() accessLost=new EventEmitter<void>();
  @ViewChild('feedback') private feedback?:ElementRef<HTMLElement>;
  private api=inject(AssistantApi);
  private disposed=false;
  filter:PapersAccessFilter='pending';
  rows:PapersAccessRow[]=[];
  nextCursor:string|null=null;
  loading=false;
  changing='';
  error='';
  notice='';
  retryPage=false;

  ngOnInit(){void this.load();}
  ngOnDestroy(){this.disposed=true;}

  select(filter:PapersAccessFilter){
    if(this.filter===filter||this.loading||this.changing)return;
    this.filter=filter;
    this.rows=[];
    this.nextCursor=null;
    this.notice='';
    void this.load();
  }

  async load(older=false){
    if(this.disposed||this.loading||this.changing)return;
    const cursor=older?this.nextCursor:null;
    if(older&&!cursor)return;
    this.loading=true;this.error='';this.retryPage=older;
    try{
      const query=new URLSearchParams({status:this.filter});
      if(cursor)query.set('cursor',cursor);
      const page=await this.api.request<PapersAccessPage>('/access/admin?'+query);
      if(this.disposed)return;
      const previous=older?this.rows:[];
      this.rows=[...new Map([...previous,...page.items].map(row=>[row.uid,row])).values()];
      this.nextCursor=page.nextCursor;
    }catch(error){
      if(!this.disposed&&!this.handleAccessError(error))this.error='Could not load access records. Try again.';
    }finally{
      if(!this.disposed)this.loading=false;
    }
  }

  private handleAccessError(error:unknown){
    const {status,code}=(error||{}) as {status?:number;code?:string};
    if(status!==401&&status!==403&&code!=='papers_access_unavailable')return false;
    this.rows=[];this.nextCursor=null;this.disposed=true;
    this.accessLost.emit();
    return true;
  }

  async decide(row:PapersAccessRow,decision:PapersAccessDecision){
    if(this.loading||this.changing)return;
    this.changing=row.uid;this.notice='';this.error='';
    let refresh=false;
    try{
      await this.api.request('/access/admin/'+encodeURIComponent(row.uid),'POST',{decision,version:row.version});
      if(this.disposed)return;
      this.rows=this.rows.filter(item=>item.uid!==row.uid);
      this.notice=decision==='approved'?'Access approved.':decision==='rejected'?'Request declined.':'Access revoked.';
    }catch(error){
      if(this.disposed||this.handleAccessError(error))return;
      const changed=(error as {code?:string})?.code==='access_request_changed';
      this.notice=changed?'This record changed. The latest list is being loaded.':'Could not confirm the decision. The list is being refreshed.';
      refresh=true;
    }finally{
      if(!this.disposed){
        this.changing='';
        this.feedback?.nativeElement.focus();
        if(refresh)void this.load();
      }
    }
  }
}
