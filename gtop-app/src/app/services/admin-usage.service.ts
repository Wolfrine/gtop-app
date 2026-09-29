import { Injectable, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { doc, increment, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { FirebaseClient } from '../features/question-bank/core/firebase';

export type UsageEvent = 'page_view'|'paper_step'|'coverage_checked'|'paper_requested'|'paper_saved'|'paper_printed'|'review_approved'|'review_rejected'|'bank_saved'|'bank_archived'|'priority_saved'|'operation_failed';
export function activeInterval(now:number, previous:number, lastInput:number, visible:boolean, focused:boolean):number {
  return visible&&focused&&now-lastInput<60_000?Math.max(0,Math.min(now-previous,15_000)):0;
}
export function usageArea(url:string):string {
  const path=url.split(/[?#]/)[0];
  if(path==='/admin/question-paper-generator')return 'paper-builder';
  if(path==='/admin/question-papers')return 'papers';
  if(path==='/admin/question-review')return 'review';
  if(path==='/admin/question-library'||path==='/admin/mcq-management'||path==='/admin/add-mcq')return 'bank';
  if(path==='/admin/question-bank')return 'requests';
  if(path==='/syllabus-preview'||path.startsWith('/admin/manage-syllabus'))return 'syllabus';
  return path.startsWith('/admin')?'other-admin':'';
}
/** Internal operational aggregates. Never records typed text, question content, URLs or click labels. */
@Injectable({providedIn:'root'})
export class AdminUsageService {
  private started=false;private uid='';private session='';private area='';private lastInput=Date.now();private lastTick=Date.now();private flushing=false;
  private minutes:Record<string,number>={};private events:Record<string,number>={};private startedAt='';
  constructor(private readonly auth:AuthService,private readonly router:Router,private readonly client:FirebaseClient,private readonly zone:NgZone){}
  start():void {
    if(this.started||typeof document==='undefined')return;this.started=true;
    this.auth.readyUser$.subscribe(profile=>{
      const next=profile?.role==='admin'?profile.uid:'';
      if(next===this.uid)return;
      this.tick();void this.flush();this.uid=next;this.session=next?crypto.randomUUID():'';this.startedAt=new Date().toISOString();this.minutes={};this.events={};this.lastInput=Date.now();this.lastTick=Date.now();this.area=usageArea(this.router.url);
      if(next&&this.area)this.track('page_view');
    });
    this.router.events.subscribe(event=>{if(event instanceof NavigationEnd){this.tick();void this.flush();this.area=usageArea(event.urlAfterRedirects);if(this.area)this.track('page_view');}});
    this.zone.runOutsideAngular(()=>{
      const input=()=>{this.lastInput=Date.now();};
      ['pointerdown','keydown','touchstart','scroll'].forEach(name=>document.addEventListener(name,input,{passive:true,capture:true}));
      document.addEventListener('visibilitychange',()=>{this.tick();if(document.hidden)void this.flush();else {this.lastTick=Date.now();this.lastInput=Date.now();}});
      window.addEventListener('pagehide',()=>{this.tick();void this.flush();});
      window.addEventListener('blur',()=>{this.tick();void this.flush();});
      window.addEventListener('focus',()=>{this.lastTick=Date.now();this.lastInput=Date.now();});
      setInterval(()=>this.tick(),15_000);setInterval(()=>void this.flush(),60_000);
    });
  }
  track(event:UsageEvent,count=1):void {if(!this.uid||!this.area||!Number.isFinite(count)||count<=0)return;const key=this.area+'__'+event;this.events[key]=Math.min(10000,(this.events[key]??0)+Math.floor(count));if(event!=='page_view'&&event!=='paper_step')void this.flush();}
  private tick():void{const now=Date.now();if(this.uid&&this.area){const active=activeInterval(now,this.lastTick,this.lastInput,!document.hidden,document.hasFocus());this.minutes[this.area]=Math.min(3600_000,(this.minutes[this.area]??0)+active);}this.lastTick=now;}
  async flush():Promise<void> {
    if(this.flushing||!this.uid||!this.session||(!Object.keys(this.events).length&&!Object.values(this.minutes).some(Boolean)))return;
    const uid=this.uid;const session=this.session;const active=this.minutes;const events=this.events;this.minutes={};this.events={};this.flushing=true;
    const duration=Object.values(active).reduce((a,b)=>a+b,0);
    const activeMs=Object.fromEntries(Object.entries(active).map(([k,v])=>[k,increment(v)]));
    const eventCounts=Object.fromEntries(Object.entries(events).map(([k,v])=>[k,increment(v)]));
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    try {await setDoc(doc(this.client.firestore,'adminUsageSessions',day+'_'+session),{schemaVersion:1,day,actorUid:uid,startedAtIso:this.startedAt,updatedAtIso:new Date().toISOString(),updatedAt:serverTimestamp(),
      device:window.innerWidth<641?'phone':window.innerWidth<1100?'tablet':'desktop',activeMs,eventCounts,totalActiveMs:increment(duration)}, {merge:true});}
    catch {if(this.session===session){for(const[k,v]of Object.entries(active))this.minutes[k]=Math.min(3600_000,(this.minutes[k]??0)+v);for(const[k,v]of Object.entries(events))this.events[k]=Math.min(10000,(this.events[k]??0)+v);}}
    finally{this.flushing=false;}
  }
}
