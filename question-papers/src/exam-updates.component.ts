import {CommonModule} from '@angular/common';
import {Component, ElementRef, HostListener, Input, OnDestroy, ViewChild, inject} from '@angular/core';
import {SwPush} from '@angular/service-worker';
import {firstValueFrom, take, timeout} from 'rxjs';
import {AssistantApi} from './api.service';
import type {MarkerSnapshot} from './owner-events';

export type ExamUpdateTarget =
  {kind:'submission'; submissionId:string} |
  {kind:'conversation'; conversationId:string; paperId?:string};
interface UpdateRow {id:string; kind:string; label:string; createdAt:string; sortKey:string}
interface UpdatePage {items:UpdateRow[]; readThrough:string; nextCursor:string|null}
interface PushConfig {available:boolean; publicKey?:string; subscribed:boolean}

export const validUpdateId = (id:unknown): id is string => typeof id==='string' && /^[a-f0-9]{64}$/.test(id);
export async function resolveExamUpdate(api:AssistantApi,id:string):Promise<ExamUpdateTarget> {
  const result = await api.request<{target:ExamUpdateTarget}>('/exam-updates/' + encodeURIComponent(id));
  return result.target;
}
async function endpointHash(subscription:PushSubscription) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(new URL(subscription.endpoint).href));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}

@Component({
  selector:'gt-exam-updates',
  standalone:true,
  imports:[CommonModule],
  templateUrl:'./exam-updates.html',
  styleUrl:'./exam-updates.css'
})
export class ExamUpdatesComponent implements OnDestroy {
  @Input({required:true}) ownerUid='';
  @Input({required:true}) navigate!: (target:ExamUpdateTarget)=>Promise<boolean>;
  @ViewChild('trigger') private trigger?:ElementRef<HTMLButtonElement>;
  @ViewChild('heading') private heading?:ElementRef<HTMLHeadingElement>;
  private readonly api=inject(AssistantApi);
  private readonly sw=inject(SwPush);
  private readonly host=inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly clicks=this.sw.notificationClicks.subscribe(event=>{
    const id=event.notification.data?.examUpdateId;
    if (!validUpdateId(id)||!document.hasFocus()||new URL(location.href).searchParams.get('update')===id) return;
    if (!this.open) this.toggle();
    void this.select(id);
  });
  private supportsPush=this.sw.isEnabled&&'PushManager' in window&&'Notification' in window;
  private config?:PushConfig;
  private subscription?:PushSubscription|null;
  private watchers:(()=>void)[]=[];
  private revisions=new Map<string,string>();
  private refreshTimer?:ReturnType<typeof setTimeout>;
  private refreshPending=false;
  private epoch=0;
  private watchEpoch=0;
  private readyAfter?:ReturnType<typeof setTimeout>;

  open=false;
  loading=false;
  loaded=false;
  paged=false;
  error='';
  actionError='';
  selected='';
  items:UpdateRow[]=[];
  nextCursor:string|null=null;
  readThrough='';
  marking=false;
  newUpdates=false;
  deviceBusy=false;
  deviceNotice='';
  deviceLoaded=false;
  get canMark(){return this.items.some(row=>row.sortKey>this.readThrough);}
  get deviceConfigured(){return this.config?.available===true&&!!this.config.publicKey;}
  get deviceSubscribed(){return this.config?.subscribed===true;}
  get deviceDenied(){return this.supportsPush&&Notification.permission==='denied';}

  toggle() {
    if (this.open) {this.close();return;}
    this.open=true;
    this.startWatching();
    void this.readDevice();
    setTimeout(()=>{if(this.open)this.heading?.nativeElement.focus();});
  }
  close(focus=true) {
    if(!this.open)return;
    this.open=false;this.epoch++;this.stopWatching();
    this.loaded=false;this.loading=false;this.paged=false;this.refreshPending=false;this.selected='';
    this.items=[];this.nextCursor=null;this.readThrough='';this.error='';this.actionError='';this.marking=false;
    this.newUpdates=false;this.deviceNotice='';this.deviceLoaded=false;this.deviceBusy=false;this.config=undefined;
    if(focus)this.trigger?.nativeElement.focus();
  }
  @HostListener('document:pointerdown',['$event'])
  outside(event:PointerEvent) {
    if(this.open&&event.target instanceof Node&&!this.host.nativeElement.contains(event.target))this.close(false);
  }
  @HostListener('document:keydown.escape',['$event'])
  escape(event:Event){
    if(!this.open||event.defaultPrevented)return;
    event.preventDefault();this.close();
  }
  @HostListener('document:visibilitychange')
  visibility(){
    if(!this.open)return;
    if(document.hidden)this.stopWatching();
    else this.startWatching();
  }
  @HostListener('window:online')
  connected(){
    if(!this.open||document.hidden)return;
    this.stopWatching();this.startWatching();
  }

  private startWatching(){
    if(document.hidden||this.watchers.length)return;
    const watchEpoch=++this.watchEpoch;
    const paths=['assistantExamUpdateMarkers/staff','assistantExamUpdateMarkers/staff/owners/'+this.ownerUid];
    const pending=new Set(paths);
    let initial=false;
    const begin=()=>{
      if(initial||watchEpoch!==this.watchEpoch)return;
      initial=true;clearTimeout(this.readyAfter);
      if(this.loaded)this.invalidate();
      else void this.load();
    };
    const receive=(path:string,snapshot:MarkerSnapshot|null)=>{
      if(watchEpoch!==this.watchEpoch||snapshot?.fromCache)return;
      const revision=snapshot?.data?.['revision'];
      if(snapshot)this.revisions.set(path,typeof revision==='string'?revision:'');
      const first=pending.delete(path);
      if(!initial&&pending.size===0)begin();
      else if(initial&&(!first||snapshot))this.invalidate();
    };
    this.readyAfter=setTimeout(begin,650);
    for(const path of paths){
      try{
        const unsubscribe=this.api.watchMarker(path,value=>{
          const known=this.revisions.has(path), previous=this.revisions.get(path);
          const revision=value.data?.['revision'];
          if(!value.fromCache&&(!known||previous!==(typeof revision==='string'?revision:'')))receive(path,value);
        },()=>receive(path,null));
        this.watchers.push(unsubscribe);
      }catch{receive(path,null);}
    }
  }
  private stopWatching(){
    this.watchEpoch++;clearTimeout(this.readyAfter);clearTimeout(this.refreshTimer);this.refreshTimer=undefined;
    this.watchers.forEach(stop=>stop());this.watchers=[];this.revisions.clear();
  }
  private invalidate(){
    if(this.paged){this.newUpdates=true;return;}
    this.refreshPending=true;
    if(this.refreshTimer||this.loading)return;
    this.refreshTimer=setTimeout(()=>{
      this.refreshTimer=undefined;
      if(this.refreshPending&&this.open&&!document.hidden)void this.load();
    },120);
  }
  async load(older=false) {
    if(this.loading||!this.open||(older&&!this.nextCursor))return;
    const epoch=this.epoch;
    const cursor=older?this.nextCursor:null;
    this.error='';this.loading=true;this.refreshPending=false;
    try{
      const page=await this.api.request<UpdatePage>('/exam-updates'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
      if(this.epoch!==epoch)return;
      const ids=new Set(this.items.map(row=>row.id));
      this.items=older?[...this.items,...page.items.filter(row=>!ids.has(row.id))]:page.items;
      this.paged=older;this.loaded=true;this.nextCursor=page.nextCursor;
      if(page.readThrough>this.readThrough)this.readThrough=page.readThrough;
      if(!older)this.newUpdates=false;
    }catch(error){
      if(this.epoch!==epoch)return;
      if([401,403].includes((error as {status?:number})?.status??0)){
        this.items=[];this.nextCursor=null;this.readThrough='';this.stopWatching();
      }
      this.error='Could not load updates. Try refreshing.';
    }finally{
      if(this.epoch===epoch){
        this.loading=false;
        if(this.refreshPending)this.invalidate();
      }
    }
  }
  async markRead(){
    const through=this.items[0]?.sortKey;
    if(!through||!this.canMark||this.marking)return;
    const epoch=this.epoch;
    this.marking=true;this.actionError='';
    try{
      const result=await this.api.request<{readThrough:string}>('/exam-updates/read','POST',{through});
      if(this.epoch===epoch&&result.readThrough>this.readThrough)this.readThrough=result.readThrough;
    }catch{
      if(this.epoch===epoch)this.actionError='Could not mark updates as read. Try again.';
    }finally{
      if(this.epoch===epoch)this.marking=false;
    }
  }
  async select(id:string){
    if(this.selected)return;
    const epoch=this.epoch;
    this.selected=id;this.actionError='';
    try{
      const target=await resolveExamUpdate(this.api,id);
      if(this.epoch===epoch&&await this.navigate(target)&&this.epoch===epoch)this.close(false);
    }catch(error){
      if(this.epoch!==epoch)return;
      const status=(error as {status?:number})?.status;
      this.actionError=status===404?'This item is no longer available.':'Could not open this update. Try again.';
    }finally{if(this.epoch===epoch)this.selected='';}
  }

  private async readDevice(){
    const epoch=this.epoch;
    if(!this.supportsPush){this.deviceLoaded=true;return;}
    try{
      const subscription=await firstValueFrom(this.sw.subscription.pipe(take(1),timeout(3000)));
      if(this.epoch!==epoch)return;
      const hash=subscription?await endpointHash(subscription):'';
      if(this.epoch!==epoch)return;
      const config=await this.api.request<PushConfig>('/exam-updates/push'+(hash?'?endpointHash='+hash:''));
      if(this.epoch===epoch){this.subscription=subscription;this.config=config;}
    }catch{
      if(this.epoch===epoch)this.deviceNotice='Could not check device notifications.';
    }finally{
      if(this.epoch===epoch)this.deviceLoaded=true;
    }
  }
  async changeDevice(){
    const publicKey=this.config?.publicKey;
    if((!this.deviceSubscribed&&!publicKey)||this.deviceBusy)return;
    const epoch=this.epoch, uid=this.api.user?.uid;
    this.deviceBusy=true;this.deviceNotice='';
    try{
      if(this.config?.subscribed&&this.subscription){
        await this.api.request('/exam-updates/push','POST',{action:'unsubscribe',endpointHash:await endpointHash(this.subscription)});
        await this.subscription.unsubscribe();
        this.subscription=null;
        if(this.epoch===epoch)this.config={available:!!publicKey,subscribed:false,publicKey};
      }else if(publicKey){
        const subscription=await this.sw.requestSubscription({serverPublicKey:publicKey});
        if(this.api.user?.uid!==uid){await subscription.unsubscribe();return;}
        try{
          await this.api.request('/exam-updates/push','POST',{action:'subscribe',publicKey,subscription:subscription.toJSON()});
        }catch(error){
          if(!this.subscription)await subscription.unsubscribe().catch(()=>{});
          throw error;
        }
        this.subscription=subscription;
        if(this.epoch===epoch)this.config={available:true,subscribed:true,publicKey};
      }
    }catch{
      if(this.epoch===epoch)this.deviceNotice=this.deviceDenied
        ? 'Allow notifications in your browser settings and try again.'
        : 'Could not change device notifications. Try again.';
    }finally{if(this.epoch===epoch)this.deviceBusy=false;}
  }
  async disconnectDevice(){
    if(!this.supportsPush)return;
    try{
      const subscription=await firstValueFrom(this.sw.subscription.pipe(take(1),timeout(1000)));
      if(!subscription)return;
      const endpoint=await endpointHash(subscription);
      await Promise.race([
        this.api.request('/exam-updates/push','POST',{action:'unsubscribe',endpointHash:endpoint}).catch(()=>{}),
        new Promise<void>(resolve=>setTimeout(resolve,1200))
      ]);
      await subscription.unsubscribe();
    }catch{ /* Signing out remains available when the browser or network is offline. */ }
  }
  track(_index:number,row:UpdateRow){return row.id;}
  ngOnDestroy(){this.close(false);this.clicks.unsubscribe();}
}
