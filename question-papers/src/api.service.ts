import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, Auth, User, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { Transport } from './contracts';
import { MarkerSnapshot } from './owner-events';

@Injectable({providedIn:'root'})
export class AssistantApi implements Transport {
  private auth?:Auth;
  private apiBase='';
  private database?:Firestore;
  private firestore?:typeof import('firebase/firestore');
  private authEpoch=0;
  private observers=new Set<(user:User|null)=>void>();
  user:User|null=null;
  async initialize():Promise<void> {
    const response=await fetch('/assistant-config.json',{cache:'no-store'});
    if(!response.ok)throw new Error('The workspace configuration could not be loaded.');
    const config=await response.json();
    if(!config.apiBase || !config.firebase?.projectId)throw new Error('The workspace is not configured.');
    const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
    if(local && new URLSearchParams(location.search).has('emulator')){
      config.apiBase='http://127.0.0.1:5201/demo-gtop-assistant/us-central1/gtopAssistantGateway';
      config.authEmulatorUrl='http://127.0.0.1:9299';
      config.firebase={...config.firebase,projectId:'demo-gtop-assistant',apiKey:'demo-key',authDomain:'localhost'};
    }
    const apiUrl=new URL(config.apiBase,location.origin);
    if(apiUrl.protocol!=='https:' && !(local && ['127.0.0.1','localhost'].includes(apiUrl.hostname)))throw new Error('A secure workspace connection is required.');
    this.apiBase=apiUrl.href.replace(/\/$/,'');
    const app=initializeApp(config.firebase);
    this.auth=getAuth(app);
    // Stream loading failure keeps the authenticated gateway fallback usable.
    // Private gateway data is never persisted in Firestore's browser cache.
    try{
      this.firestore=await import('firebase/firestore');
      this.database=this.firestore.initializeFirestore(app,{localCache:this.firestore.memoryLocalCache()});
      if(local&&new URLSearchParams(location.search).has('emulator'))this.firestore.connectFirestoreEmulator(this.database,'127.0.0.1',8280);
    }catch{this.database=undefined;this.firestore=undefined;}
    if(local && config.authEmulatorUrl)connectAuthEmulator(this.auth,config.authEmulatorUrl,{disableWarnings:true});
    await setPersistence(this.auth,browserLocalPersistence);
    // The hosted auth helper shares this app's origin, including on browsers
    // with partitioned storage. Return through Firebase's normal OAuth flow.
    const redirected=await getRedirectResult(this.auth);
    if(redirected)this.setUser(redirected.user);
    await new Promise<void>(resolve=>{onAuthStateChanged(this.auth!,user=>{this.setUser(user);resolve();});});
  }
  private setUser(user:User|null){const changed=user?.uid!==this.user?.uid;this.user=user;if(changed){this.authEpoch++;for(const observer of this.observers)observer(user);}}
  observeUser(observer:(user:User|null)=>void){this.observers.add(observer);observer(this.user);return ()=>this.observers.delete(observer);}
  watchMarker(path:string,next:(snapshot:MarkerSnapshot)=>void,error:(error:unknown)=>void):()=>void {
    if(!this.database||!this.firestore||!this.user)throw Error('Notification connection unavailable');
    if(path!==`assistantUiNotifications/${this.user.uid}`&&path!=='assistantWorkerHealth/sachit-windows')throw Error('Invalid notification path');
    const epoch=this.authEpoch;
    return this.firestore.onSnapshot(this.firestore.doc(this.database,path),{includeMetadataChanges:true},snapshot=>{if(epoch===this.authEpoch)next({fromCache:snapshot.metadata.fromCache,data:snapshot.exists()?snapshot.data():null});},reason=>{if(epoch===this.authEpoch)error(reason);});
  }
  async login():Promise<void> {const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithRedirect(this.auth!,provider);}
  async loginEmail(email:string,password:string):Promise<void> {const result=await signInWithEmailAndPassword(this.auth!,email,password);this.setUser(result.user);}
  async logout():Promise<void> {await signOut(this.auth!);this.setUser(null);}
  private async authorized(path:string,method='GET',body?:unknown):Promise<Response> {
    const user=this.user,epoch=this.authEpoch;
    if(!user)throw new Error('Unauthenticated');
    const token=await user.getIdToken();
    if(epoch!==this.authEpoch)throw Error('Account changed');
    let response:Response;
    try{response=await fetch(this.apiBase+path,{method,signal:AbortSignal.timeout(20000),headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
    catch(error){if((error as {name?:string})?.name==='TimeoutError')throw Error('This connection took longer than expected. Please try again; saved work remains available.');throw error;}
    if(epoch!==this.authEpoch)throw Error('Account changed');
    if(!response.ok){let reason='Request failed ('+response.status+')';try{const payload=await response.json();reason=payload.error?.message || payload.error || payload.message || reason;}catch{}throw Object.assign(new Error(typeof reason==='string'?reason:JSON.stringify(reason)),{status:response.status});}
    return response;
  }
  private async read<T>(path:string,method='GET',body?:unknown,text=false):Promise<T>{const epoch=this.authEpoch;const response=await this.authorized(path,method,body);const result=await (text?response.text():response.json());if(epoch!==this.authEpoch)throw Error('Account changed');return result as T;}
  async request<T>(path:string,method='GET',body?:unknown):Promise<T> {return this.read<T>(path,method,body);}
  async artifact(id:string,kind:'student'|'answers'):Promise<string> {return this.read('/papers/'+encodeURIComponent(id)+'/artifact/'+kind,'GET',undefined,true);}
  async adminArtifact(id:string,kind:'student'|'answers'):Promise<string> {return this.read('/admin/papers/'+encodeURIComponent(id)+'/artifact/'+kind,'GET',undefined,true);}
}
