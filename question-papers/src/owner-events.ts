export interface MarkerSnapshot {fromCache:boolean;data:Record<string,unknown>|null}
export type WatchMarker=(path:string,next:(snapshot:MarkerSnapshot)=>void,error:(error:unknown)=>void)=>()=>void;
export interface Notifications {schemaVersion:1;contentPath:string;presencePath:string|null;freshnessMs:number}
export interface WorkerHealth {schemaVersion:1;state:'ready'|'loading'|'busy'|'offline';modelReady:boolean;version:string;lastSeenAt:string}

// Notifications invalidate gateway data; they never carry private workspace content.
export class InvalidationQueue {
  private pending=false;private running=false;private stopped=false;
  constructor(private work:()=>Promise<void>,private failed:(error:unknown)=>void){}
  request(){this.pending=true;if(!this.running&&!this.stopped)void this.drain();}
  stop(){this.stopped=true;this.pending=false;}
  private async drain(){
    this.running=true;
    try{while(this.pending&&!this.stopped){this.pending=false;try{await this.work();}catch(error){if(!this.stopped)this.failed(error);}}}
    finally{this.running=false;}
  }
}

export function validNotifications(value:Notifications|undefined,uid:string):value is Notifications {
  return value?.schemaVersion===1&&value.contentPath===`assistantUiNotifications/${uid}`
    &&(value.presencePath===null||value.presencePath==='assistantWorkerHealth/sachit-windows')&&value.freshnessMs===90000;
}
export function workerHealth(data:Record<string,unknown>|null):WorkerHealth|undefined {
  return data?.schemaVersion===1&&['ready','loading','busy','offline'].includes(String(data.state))
    &&typeof data.modelReady==='boolean'&&typeof data.version==='string'&&typeof data.lastSeenAt==='string'
    &&Number.isFinite(Date.parse(data.lastSeenAt))?data as unknown as WorkerHealth:undefined;
}
export function freshHealth(health:WorkerHealth|undefined,now=Date.now(),freshnessMs=90000):boolean {
  const age=now-Date.parse(health?.lastSeenAt||'');
  return !!health&&age>=0&&age<freshnessMs&&['ready','busy','loading'].includes(health.state);
}

// Firestore owns network reconnect/backoff. Only terminal listener failures recreate
// a subscription; visibility/account teardown cancels retries and stale callbacks.
export class OwnerEvents {
  contentReady=false;presenceReady=false;
  private stopped=false;private cleanups=new Set<()=>void>();
  private presenceCleanup?:()=>void;
  private contentCleanup?:()=>void;
  constructor(private watch:WatchMarker,private config:Notifications,private callbacks:{content:()=>void;presence:(health:WorkerHealth|undefined)=>void;state:()=>void;denied?:(kind:'content'|'presence',code:string)=>void},private clock:{set:typeof setTimeout;clear:typeof clearTimeout}={set:setTimeout,clear:clearTimeout}){}
  start(){this.attach('content',this.config.contentPath);if(this.config.presencePath)this.attach('presence',this.config.presencePath);}
  retryPresence(){if(this.presenceCleanup){this.presenceCleanup();this.cleanups.delete(this.presenceCleanup);}if(this.config.presencePath)this.attach('presence',this.config.presencePath);}
  retryContent(){if(this.contentCleanup){this.contentCleanup();this.cleanups.delete(this.contentCleanup);}this.attach('content',this.config.contentPath);}
  stop(){this.stopped=true;this.contentReady=false;this.presenceReady=false;for(const cleanup of this.cleanups)cleanup();this.cleanups.clear();}
  private attach(kind:'content'|'presence',path:string,attempt=0){
    if(this.stopped)return;
    let closed=false,failed=false,unsubscribe=()=>{},retry:ReturnType<typeof setTimeout>|undefined;
    let ready=false,lastRevision:string|undefined;
    const cleanup=()=>{if(closed)return;closed=true;unsubscribe();if(retry!==undefined)this.clock.clear(retry);};
    this.cleanups.add(cleanup);
    if(kind==='presence')this.presenceCleanup=cleanup;
    else this.contentCleanup=cleanup;
    const fail=(error?:unknown)=>{
      if(this.stopped||closed||failed)return;
      failed=true;
      ready=false;this[kind==='content'?'contentReady':'presenceReady']=false;this.callbacks.state();
      const code=String((error as {code?:unknown})?.code||'').split('/').at(-1)||'';
      if(['permission-denied','unauthenticated'].includes(code)){cleanup();this.cleanups.delete(cleanup);this.callbacks.denied?.(kind,code);return;}
      unsubscribe();retry=this.clock.set(()=>{cleanup();this.cleanups.delete(cleanup);this.attach(kind,path,attempt+1);},Math.min(60000,2000*2**Math.min(attempt,5)));
    };
    try{unsubscribe=this.watch(path,snapshot=>{
      if(this.stopped||closed||failed)return;
      if(snapshot.fromCache){if(ready){ready=false;this[kind==='content'?'contentReady':'presenceReady']=false;this.callbacks.state();}return;}
      const reconnect=!ready;
      if(kind==='content'){
        const data=snapshot.data;
        if(data&&(data.schemaVersion!==1||typeof data.revision!=='string'||typeof data.updatedAt!=='string')){fail();return;}
        const revision=data?String(data.revision):'';
        ready=true;this.contentReady=true;
        if(reconnect||revision!==lastRevision){lastRevision=revision;this.callbacks.content();}
      }else{
        const health=workerHealth(snapshot.data);
        ready=!!health;this.presenceReady=ready;this.callbacks.presence(health);
      }
      this.callbacks.state();
    },fail);}catch{fail();}
  }
}
