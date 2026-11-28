import { Injectable } from '@angular/core';
import { clearCameraDraft } from './camera-drafts';
import { initializeApp } from 'firebase/app';
import { getAuth, Auth, User, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { Transport } from './contracts';
import { MarkerSnapshot } from './owner-events';
import { emulatorConfig, useEmulators } from './firebase-environment';
import { attachmentName } from '../../assistant-service/domain/artifact-filenames.mjs';
import type { ShareAssessment } from '../../assistant-service/domain/result-share.mjs';

@Injectable({providedIn:'root'})
export class AssistantApi implements Transport {
  private auth?:Auth;
  private apiBase='';
  private database?:Firestore;
  private firestore?:typeof import('firebase/firestore');
  private authEpoch=0;
  private cameraCleanup:Promise<void>=Promise.resolve();
  private observers=new Set<(user:User|null)=>void>();
  user:User|null=null;
  async initialize():Promise<void> {
    let config=emulatorConfig;
    if(!useEmulators){
      const response=await fetch('/assistant-config.json',{cache:'no-store'});
      if(!response.ok)throw new Error('The workspace configuration could not be loaded.');
      config=await response.json();
    }
    if(!config.apiBase || !config.firebase?.projectId)throw new Error('The workspace is not configured.');
    const apiUrl=new URL(config.apiBase,location.origin);
    if(!useEmulators && apiUrl.protocol!=='https:')throw new Error('A secure workspace connection is required.');
    this.apiBase=apiUrl.href.replace(/\/$/,'');
    const app=initializeApp(config.firebase);
    this.auth=getAuth(app);
    if(useEmulators)connectAuthEmulator(this.auth,'http://127.0.0.1:9299',{disableWarnings:true});
    // Stream loading failure keeps the authenticated gateway fallback usable.
    // Private gateway data is never persisted in Firestore's browser cache.
    try{
      this.firestore=await import('firebase/firestore');
      this.database=this.firestore.initializeFirestore(app,{localCache:this.firestore.memoryLocalCache()});
      if(useEmulators)this.firestore.connectFirestoreEmulator(this.database,'127.0.0.1',8280);
    }catch{this.database=undefined;this.firestore=undefined;}
    await setPersistence(this.auth,browserLocalPersistence);
    // The hosted auth helper shares this app's origin, including on browsers
    // with partitioned storage. Return through Firebase's normal OAuth flow.
    const redirected=await getRedirectResult(this.auth);
    if(redirected)this.setUser(redirected.user);
    await new Promise<void>(resolve=>{onAuthStateChanged(this.auth!,user=>{this.setUser(user);resolve();});});
  }
  private setUser(user:User|null){
    const previous=this.user?.uid,changed=user?.uid!==previous;this.user=user;
    if(changed){
      this.authEpoch++;
      if(previous)this.cameraCleanup=this.cameraCleanup.then(()=>clearCameraDraft(previous)).catch(()=>{});
      for(const observer of this.observers)observer(user);
    }
  }
  observeUser(observer:(user:User|null)=>void){this.observers.add(observer);observer(this.user);return ()=>this.observers.delete(observer);}
  watchMarker(path:string,next:(snapshot:MarkerSnapshot)=>void,error:(error:unknown)=>void):()=>void {
    if(!this.database||!this.firestore||!this.user)throw Error('Notification connection unavailable');
    const markerPaths=[`assistantUiNotifications/${this.user.uid}`,'assistantWorkerHealth/sachit-windows','assistantInboxNotifications/submissions',
      'assistantExamUpdateMarkers/staff',`assistantExamUpdateMarkers/staff/owners/${this.user.uid}`];
    if(!markerPaths.includes(path))throw Error('Invalid notification path');
    const epoch=this.authEpoch;
    return this.firestore.onSnapshot(this.firestore.doc(this.database,path),{includeMetadataChanges:true},snapshot=>{if(epoch===this.authEpoch)next({fromCache:snapshot.metadata.fromCache,data:snapshot.exists()?snapshot.data():null});},reason=>{if(epoch===this.authEpoch)error(reason);});
  }
  async login():Promise<void> {const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithRedirect(this.auth!,provider);}
  async loginEmail(email:string,password:string):Promise<void> {const result=await signInWithEmailAndPassword(this.auth!,email,password);this.setUser(result.user);}
  async logout():Promise<void> {
    await signOut(this.auth!);this.setUser(null);
    await this.cameraCleanup;
  }
  private async authorized(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<Response> {
    const user=this.user,epoch=this.authEpoch;
    if(!user)throw new Error('Unauthenticated');
    const token=await user.getIdToken();
    if(epoch!==this.authEpoch)throw Error('Account changed');
    let response:Response;
    const timeout=AbortSignal.timeout(20000);
    try{response=await fetch(this.apiBase+path,{method,cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
    catch(error){if((error as {name?:string})?.name==='TimeoutError')throw Error('This connection took longer than expected. Please try again; saved work remains available.');throw error;}
    if(epoch!==this.authEpoch)throw Error('Account changed');
    if(!response.ok){let reason='Request failed ('+response.status+')';try{const payload=await response.json();reason=payload.error?.message || payload.error || payload.message || reason;}catch{}throw Object.assign(new Error(typeof reason==='string'?reason:JSON.stringify(reason)),{status:response.status});}
    return response;
  }
  private async read<T>(path:string,method='GET',body?:unknown,text=false):Promise<T>{const epoch=this.authEpoch;const response=await this.authorized(path,method,body);const result=await (text?response.text():response.json());if(epoch!==this.authEpoch)throw Error('Account changed');return result as T;}
  async request<T>(path:string,method='GET',body?:unknown):Promise<T> {return this.read<T>(path,method,body);}
  async assessment(path:string,signal:AbortSignal):Promise<ShareAssessment>{
    const epoch=this.authEpoch;
    const response=await this.authorized(path,'GET',undefined,signal);
    const result=await response.json();
    if(epoch!==this.authEpoch)throw Error('Account changed');
    return result.share;
  }
  async reportBlob(path:string,signal?:AbortSignal):Promise<File>{
    const epoch=this.authEpoch;
    const response=await this.authorized(path,'GET',undefined,signal);
    if(!response.ok||response.headers.get('Content-Type')!=='application/pdf')throw Error('The checking report is unavailable.');
    const blob=await response.blob();
    if(epoch!==this.authEpoch)throw Error('Account changed');
    return new File([blob],attachmentName(response.headers.get('Content-Disposition'),'checking-report.pdf'),{type:'application/pdf'});
  }
  async checkingReport(path:string):Promise<void>{
    const pdf=await this.reportBlob(path);
    const url=URL.createObjectURL(pdf);
    try{
      const link=document.createElement('a');
      link.href=url;link.download=pdf.name;link.click();
    }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  async checkingImage(path:string):Promise<File>{
    const epoch=this.authEpoch;
    const response=await this.authorized(path);
    if(response.headers.get('Content-Type')!=='image/jpeg')throw Error('The saved scan is unavailable.');
    const image=await response.blob();
    if(epoch!==this.authEpoch)throw Error('Account changed');
    return new File([image],attachmentName(response.headers.get('Content-Disposition'),'original-scan.jpg'),{type:'image/jpeg'});
  }
  async artifact(id:string,kind:'student'|'answers'):Promise<string> {return this.read('/papers/'+encodeURIComponent(id)+'/artifact/'+kind,'GET',undefined,true);}
  async adminArtifact(id:string,kind:'student'|'answers'):Promise<string> {return this.read('/admin/papers/'+encodeURIComponent(id)+'/artifact/'+kind,'GET',undefined,true);}
}
