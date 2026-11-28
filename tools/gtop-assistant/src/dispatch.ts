import {initializeServerApp,deleteApp} from 'firebase/app';
import {connectAuthEmulator,getAuth} from 'firebase/auth';
import {connectFirestoreEmulator,getFirestore,doc,onSnapshot,terminate} from 'firebase/firestore';

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

/** A route marker is sufficient after cutover. Include legacy paths during migration. */
export async function listenForDispatch({apiKey,idToken,workerId,route,markerPath,ownerUids,changed,connection,failed,authEmulator}:any){
  if(markerPath!==undefined&&markerPath!==('assistantWorkerDispatch/'+workerId+'-'+route))throw Error('Invalid dispatch route.');
  if(ownerUids!==undefined&&(!Array.isArray(ownerUids)||ownerUids.length>20||ownerUids.some(uid=>! /^[a-zA-Z0-9_-]{1,128}$/.test(uid))))throw Error('Invalid dispatch assignment.');
  const paths:string[]=[...(markerPath?[markerPath]:[]),...(ownerUids||[]).map((uid:string)=>'assistantDispatch/'+uid)];
  if(!paths.length)throw Error('Dispatch has no authorized marker.');
  const projectId=authEmulator?'demo-gtop-assistant':'gtop-app';
  const app=initializeServerApp({apiKey,projectId,authDomain:projectId+'.firebaseapp.com'},{authIdToken:idToken});
  const db=getFirestore(app),auth=getAuth(app),subscriptions:(()=>void)[]=[];
  const state=new DispatchState(paths);let closed=false;
  try{
    if(authEmulator){
      connectAuthEmulator(auth,authEmulator,{disableWarnings:true});
      connectFirestoreEmulator(db,'127.0.0.1',8280);
    }
    await auth.authStateReady();
    if(auth.currentUser?.uid!==`assistant-worker-${workerId}`)throw Error('Dispatch identity mismatch.');
    for(const path of paths){subscriptions.push(onSnapshot(doc(db,path),{includeMetadataChanges:true},snapshot=>{
      if(closed)return;
      try{const accepted=state.accept(path,snapshot.data(),snapshot.metadata.fromCache);connection(accepted.ready);if(accepted.changed)changed();}
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
