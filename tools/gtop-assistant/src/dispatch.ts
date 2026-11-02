import {initializeServerApp,deleteApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore,doc,onSnapshot,terminate} from 'firebase/firestore';

export class DispatchState {
  online:Map<string,boolean>;revisions=new Map<string,string|undefined>();
  constructor(owners:string[]){this.online=new Map(owners.map(uid=>[uid,false]));}
  accept(uid:string,data:any,fromCache:boolean){
    if(data&&(data.schemaVersion!==1||typeof data.revision!=='string'))throw Error('Invalid dispatch marker.');
    const server=!fromCache,resumed=server&&!this.online.get(uid);
    this.online.set(uid,server);
    const changed=server&&(resumed||data?.revision!==this.revisions.get(uid));
    if(changed)this.revisions.set(uid,data?.revision);
    return {ready:[...this.online.values()].every(Boolean),changed};
  }
}

/** One exact marker per assigned owner. SDK reconnects retain their backoff. */
export async function listenForDispatch({apiKey,idToken,workerId,ownerUids,changed,connection,failed}:any){
  if(!Array.isArray(ownerUids)||!ownerUids.length||ownerUids.length>20||ownerUids.some(uid=>! /^[a-zA-Z0-9_-]{1,128}$/.test(uid)))throw Error('Invalid dispatch assignment.');
  const app=initializeServerApp({apiKey,projectId:'gtop-app',authDomain:'gtop-app.firebaseapp.com'},{authIdToken:idToken});
  const db=getFirestore(app),auth=getAuth(app),subscriptions:(()=>void)[]=[];
  const state=new DispatchState(ownerUids);let closed=false;
  try{
    await auth.authStateReady();
    if(auth.currentUser?.uid!==`assistant-worker-${workerId}`)throw Error('Dispatch identity mismatch.');
    for(const uid of ownerUids){subscriptions.push(onSnapshot(doc(db,`assistantDispatch/${uid}`),{includeMetadataChanges:true},snapshot=>{
      if(closed)return;
      try{const accepted=state.accept(uid,snapshot.data(),snapshot.metadata.fromCache);connection(accepted.ready);if(accepted.changed)changed();}
      catch(error){connection(false);failed(error);}
    },error=>{if(!closed){connection(false);failed(error);}}));}
  }catch(error){subscriptions.forEach(unsub=>unsub());await terminate(db).catch(()=>{});await deleteApp(app);throw error;}
  return async()=>{closed=true;subscriptions.forEach(unsub=>unsub());await terminate(db).catch(()=>{});await deleteApp(app);};
}

/** Coalesces revisions, including wakeups received while a lane is busy. */
export class DispatchWake {
  private dirty=new Set<string>();private waiting=new Map<string,()=>void>();
  wake(kind?:string){for(const lane of kind?[kind]:['turn','paper']){this.dirty.add(lane);this.waiting.get(lane)?.();}}
  async wait(kind:string,signal:AbortSignal){
    while(!this.dirty.has(kind)){
      signal.throwIfAborted();
      await new Promise<void>((resolve,reject)=>{
        const done=()=>{signal.removeEventListener('abort',stop);this.waiting.delete(kind);resolve();};
        const stop=()=>{this.waiting.delete(kind);reject(signal.reason);};
        this.waiting.set(kind,done);signal.addEventListener('abort',stop,{once:true});
        if(signal.aborted)stop();
      });
    }
    this.dirty.delete(kind);signal.throwIfAborted();
  }
}
