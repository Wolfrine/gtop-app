import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { collection,documentId,limit,orderBy,query,where,type QueryConstraint } from '@angular/fire/firestore';
import { map } from 'rxjs';
import { FirebaseClient } from './firebase';
import { AuthService } from '../../../services/auth.service';
import { FirestoreReadService } from '../../../services/firestore-read.service';
import type { ChatRequestStatus } from './paper-chat.models';

export type RegisterView='all'|'needs-action'|'in-progress'|'ready';
export interface RegisterRecord {
  id:string;legacyRequestId?:string;legacyPaperId?:string;creatorName?:string;kind:'chat'|'legacy';conversationId?:string;title:string;ownerUid:string;
  createdAt:number;updatedAt:number;status:ChatRequestStatus|string;activeRequestId?:string;requestRevision?:number;
  brief?:string;progress?:{step:string;reused:number;generated:number};error?:string;nextRunAtIso?:string;
  hasReady:boolean;latestPaperId?:string;latestPaperTitle?:string;latestPaperRevision?:number;
  board?:string;className?:string;subjects:string[];chapters:string[];clarificationText?:string;matchedPaperId?:string;
}
export interface RegisterPage {items:RegisterRecord[];nextCursor:string|null;indexReady:boolean;continuing:boolean;scanned:number;}
export interface RegisterWindow {before:string|null;page:RegisterPage;}
export interface RegisterContext {filters:RegisterFilters;windows:RegisterWindow[];anchor:string;}
export interface RegisterFilters {view:RegisterView;q:string;mine:boolean;}

@Injectable({providedIn:'root'})
export class PaperRegisterRepository {
  private readonly gateway=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('emulator')
    ?'http://127.0.0.1:5001/gtop-app/us-central1/paperGateway':'https://us-central1-gtop-app.cloudfunctions.net/paperGateway';
  constructor(private readonly client:FirebaseClient,private readonly reads:FirestoreReadService,private readonly auth:Auth,private readonly profile:AuthService){}
  watch(filters:RegisterFilters){
    const constraints:QueryConstraint[]=[];
    if(filters.view==='needs-action')constraints.push(where('needsAction','==',true));
    if(filters.view==='in-progress')constraints.push(where('inProgress','==',true));
    if(filters.view==='ready')constraints.push(where('hasReady','==',true));
    if(filters.mine)constraints.push(where('ownerUid','==',this.auth.currentUser?.uid??''));
    constraints.push(orderBy('updatedAt','desc'),orderBy(documentId(),'desc'),limit(30));
    return this.reads.watch(query(collection(this.client.firestore,'paperRegister'),...constraints)).pipe(map(snapshot=>({items:snapshot.docs.map(item=>({...item.data(),id:item.id}) as RegisterRecord),fromCache:snapshot.metadata.fromCache})));
  }
  readiness$(){return this.reads.watch(query(collection(this.client.firestore,'paperRegisterState'),where(documentId(),'==','v1'),limit(1))).pipe(map(snapshot=>({ready:snapshot.docs[0]?.data()['ready']===true,fromCache:snapshot.metadata.fromCache})));}
  cached(filters:RegisterFilters):RegisterPage|null {
    if(!this.adminUid())return null;
    try {const value=localStorage.getItem(this.key(filters));return value?JSON.parse(value).page:null;}catch{return null;}
  }
  async page(filters:RegisterFilters,cursor?:string):Promise<RegisterPage>{
    const uid=this.adminUid();const token=await this.auth.currentUser?.getIdToken();if(!token||!uid||uid!==this.adminUid())throw Error('Sign in as an admin to view papers.');
    const params=new URLSearchParams({view:filters.view,q:filters.q,mine:filters.mine?'1':'0',limit:'30'});if(cursor)params.set('cursor',cursor);
    const response=await fetch(this.gateway+'/register?'+params,{headers:{Authorization:'Bearer '+token}});
    if(uid!==this.adminUid())throw Error('Your admin session changed. Sign in again.');
    if(!response.ok){if(response.status===403||response.status===401)this.clearCache(uid!);let message='Papers could not update. Reconnect and try again.';try{const body=await response.json();message=body.error??message;}catch{}throw Object.assign(Error(message),{status:response.status});}
    const result=await response.json() as RegisterPage;
    if(uid!==this.adminUid())throw Error('Your admin session changed. Sign in again.');
    // Only a bounded first page is retained, scoped to the signed-in admin.
    // Live Firestore rows still own the unsearched view and reconnect updates.
    if(!cursor){try{const prefix='gtop-paper-register:'+uid+':';const keys=Object.keys(localStorage).filter(key=>key.startsWith(prefix));for(const key of keys.slice(0,Math.max(0,keys.length-7)))localStorage.removeItem(key);localStorage.setItem(this.key(filters,uid),JSON.stringify({page:result}));}catch{}}
    return result;
  }
  context():RegisterContext|null {
    const uid=this.adminUid();if(!uid)return null;
    try{return JSON.parse(sessionStorage.getItem('gtop-paper-position:'+uid)??'null');}catch{return null;}
  }
  remember(context:RegisterContext){
    const uid=this.adminUid();if(!uid)return;
    // Ten gateway pages, at most 300 lightweight rows, retained in this tab.
    try{sessionStorage.setItem('gtop-paper-position:'+uid,JSON.stringify({...context,windows:context.windows.slice(-10)}));}catch{}
  }
  private adminUid(){const uid=this.auth.currentUser?.uid;return uid&&this.profile.profile()?.uid===uid&&this.profile.isAdmin()?uid:null;}
  clearCache(uid:string){try{sessionStorage.removeItem('gtop-paper-position:'+uid);}catch{}try{for(const key of Object.keys(localStorage))if(key.startsWith('gtop-paper-register:'+uid+':'))localStorage.removeItem(key);}catch{}}
  private key(filters:RegisterFilters,uid=this.adminUid()){return 'gtop-paper-register:'+(uid??'')+':'+JSON.stringify(filters);}
}
