import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, Auth, User, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { Transport } from './contracts';

@Injectable({providedIn:'root'})
export class AssistantApi implements Transport {
  private auth?:Auth;
  private apiBase='';
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
    this.auth=getAuth(initializeApp(config.firebase));
    if(local && config.authEmulatorUrl)connectAuthEmulator(this.auth,config.authEmulatorUrl,{disableWarnings:true});
    await setPersistence(this.auth,browserLocalPersistence);
    // The hosted auth helper shares this app's origin, including on browsers
    // with partitioned storage. Return through Firebase's normal OAuth flow.
    const redirected=await getRedirectResult(this.auth);
    if(redirected)this.user=redirected.user;
    await new Promise<void>(resolve=>{const unsubscribe=onAuthStateChanged(this.auth!,user=>{this.user=user;unsubscribe();resolve();});});
  }
  async login():Promise<void> {const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithRedirect(this.auth!,provider);}
  async loginEmail(email:string,password:string):Promise<void> {const result=await signInWithEmailAndPassword(this.auth!,email,password);this.user=result.user;}
  async logout():Promise<void> {await signOut(this.auth!);this.user=null;}
  private async authorized(path:string,method='GET',body?:unknown):Promise<Response> {
    if(!this.user)throw new Error('Unauthenticated');
    let response:Response;
    try{response=await fetch(this.apiBase+path,{method,signal:AbortSignal.timeout(20000),headers:{'Authorization':'Bearer '+await this.user.getIdToken(),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
    catch(error){if((error as {name?:string})?.name==='TimeoutError')throw Error('This connection took longer than expected. Please try again; saved work remains available.');throw error;}
    if(!response.ok){let reason='Request failed ('+response.status+')';try{const payload=await response.json();reason=payload.error?.message || payload.error || payload.message || reason;}catch{}throw new Error(typeof reason==='string'?reason:JSON.stringify(reason));}
    return response;
  }
  async request<T>(path:string,method='GET',body?:unknown):Promise<T> {return (await this.authorized(path,method,body)).json();}
  async artifact(id:string,kind:'student'|'answers'):Promise<string> {return (await this.authorized('/papers/'+encodeURIComponent(id)+'/artifact/'+kind)).text();}
  async adminArtifact(id:string,kind:'student'|'answers'):Promise<string> {return (await this.authorized('/admin/papers/'+encodeURIComponent(id)+'/artifact/'+kind)).text();}
}
