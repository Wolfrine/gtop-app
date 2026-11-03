import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as presentation from '../src/presentation.mjs';

function compile(file,dependencies={},globals={}){
  const exports={};
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  runInNewContext(code,{exports,require(name){if(!(name in dependencies))throw Error('Unexpected import '+name);return dependencies[name];},setTimeout,clearTimeout,Date,console,...globals});
  return exports;
}
function clock(){
  let now=Date.parse('2026-11-03T10:00:00Z'),id=0;const tasks=new Map();
  return {get now(){return now;},Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},
    set(fn,delay){const key=++id;tasks.set(key,{fn,at:now+delay});return key;},clear(key){tasks.delete(key);},
    async tick(ms){const end=now+ms;for(;;){const next=[...tasks.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;tasks.delete(next[0]);next[1].fn();await flush();}now=end;await flush();},
    delays(){return [...tasks.values()].map(t=>t.at-now).sort((a,b)=>a-b);},tasks};
}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const config={schemaVersion:1,contentPath:'assistantUiNotifications/owner',presencePath:'assistantWorkerHealth/sachit-windows',freshnessMs:90000};
const health=(time,state='ready')=>({schemaVersion:1,state,modelReady:false,version:'test',lastSeenAt:new Date(time).toISOString()});
function watches(){const entries=[];return {entries,watch(path,next,error){const entry={path,next,error,closed:false};entries.push(entry);return ()=>entry.closed=true;},content(){return entries.filter(x=>x.path.startsWith('assistantUi')).at(-1);},presence(){return entries.filter(x=>x.path.startsWith('assistantWorker')).at(-1);}};}

test('owner subscriptions accept server missing baseline, coalesce metadata, reconcile reconnect and stop terminal retries',async()=>{
  const time=clock(),w=watches();const {OwnerEvents}=compile('owner-events.ts');let contents=0,states=0;
  const stream=new OwnerEvents(w.watch,config,{content(){contents++;},presence(){},state(){states++;}},time);stream.start();
  assert.equal(w.entries.length,2);w.content().next({fromCache:true,data:null});assert.equal(contents,0);assert.equal(stream.contentReady,false);
  w.content().next({fromCache:false,data:null});assert.equal(contents,1);assert.equal(stream.contentReady,true);
  w.content().next({fromCache:false,data:null});assert.equal(contents,1);
  w.content().next({fromCache:true,data:null});assert.equal(stream.contentReady,false);
  w.content().next({fromCache:false,data:null});assert.equal(contents,2);
  w.content().error();assert.equal(stream.contentReady,false);w.content().error();assert.deepEqual(time.delays(),[2000]);
  await time.tick(2000);assert.equal(w.entries.length,3);
  w.content().next({fromCache:false,data:{schemaVersion:1,revision:'new',updatedAt:'now'}});assert.equal(contents,3);
  stream.stop();w.content().next({fromCache:false,data:null});await time.tick(60000);assert.equal(contents,3);assert.equal(w.entries.length,3);assert(w.entries.every(x=>x.closed));assert(states>0);
});

test('invalidation bursts retain exactly one trailing reconciliation and stop ignores late failures',async()=>{
  const {InvalidationQueue}=compile('owner-events.ts');const first=deferred(),second=deferred();let calls=0,errors=0;
  const queue=new InvalidationQueue(()=>{calls++;return calls===1?first.promise:second.promise;},()=>errors++);
  queue.request();for(let i=0;i<20;i++)queue.request();assert.equal(calls,1);first.resolve();await flush();assert.equal(calls,2);
  queue.stop();second.reject(Error('late'));await flush();assert.equal(calls,2);assert.equal(errors,0);
});

function workspace(){
  const time=clock(),w=watches(),calls=[];let response;
  const api={user:{uid:'owner'},watchMarker:w.watch,request:async(path,method,body)=>{calls.push({path,method,body});if(response)return response(path,method,body);if(path==='/conversations')return {conversations:[]};if(path==='/service/status')return {service:ui.session.service};if(path.endsWith('/revision'))return {updatedAt:ui.detail?.conversation.updatedAt};if(path.startsWith('/conversations/'))return ui.detail;if(path==='/admin/library')return {items:[],nextCursor:null};throw Error('Unexpected request '+path);},artifact:async()=>'<html></html>',adminArtifact:async()=>'<html></html>'};
  const decorator=()=>()=>{},Api=class{},Sanitizer=class{};
  const events=compile('owner-events.ts',{}, {Date:time.Date,setTimeout:time.set,clearTimeout:time.clear});
  const contracts=compile('contracts.ts');
  const document={hidden:false,querySelector:()=>null,body:{}};
  const {PaperWorkspace}=compile('main.ts',{
    '@angular/platform-browser':{bootstrapApplication:()=>Promise.resolve(),DomSanitizer:Sanitizer},
    '@angular/core':{Component:decorator,ViewChild:decorator,HostListener:decorator,inject:token=>token===Api?api:{bypassSecurityTrustHtml:value=>value},provideZoneChangeDetection:()=>{},isDevMode:()=>true},
    '@angular/service-worker':{provideServiceWorker:()=>{}},'@angular/common':{},'@angular/forms':{},'./pwa-controls':{},'./api.service':{AssistantApi:Api},'./contracts':contracts,
    './owner-events':events,'./dev-transport':{getDevTransport:()=>null},'./artifact-presentation.mjs':{presentArtifact:x=>x},'./chat-math.directive':{},'./presentation.mjs':presentation
  },{document,Date:time.Date,setTimeout:time.set,clearTimeout:time.clear});
  const ui=new PaperWorkspace();
  ui.session={user:{uid:'owner',displayName:'Owner',email:'owner@example.invalid',libraryAccess:true},worker:{state:'ready',modelReady:false,lastSeenAt:new Date(time.now).toISOString()},service:{workerId:'sachit-windows',state:'ready',starter:{state:'online',lastSeenAt:new Date(time.now).toISOString()},worker:{state:'ready',modelReady:false,lastSeenAt:new Date(time.now).toISOString()},request:null,canStart:false},notifications:config,capabilities:{},defaults:{}};
  ui.detail={conversation:{id:'conversation',ownerUid:'owner',title:'Existing',updatedAt:'unchanged'},messages:[],jobs:[],papers:[]};
  return {ui,api,time,w,calls,document,respond(fn){response=fn;},async connect(){ui.startEvents();w.content().next({fromCache:false,data:null});w.presence().next({fromCache:false,data:health(time.now)});await flush();calls.length=0;}};
}

test('connected visible idle and unchanged health do not poll gateway history/session, hidden stops everything',async()=>{
  const c=workspace();await c.connect();
  for(let i=0;i<4;i++){await c.time.tick(45000);c.w.presence().next({fromCache:false,data:health(c.time.now)});await flush();}
  assert.deepEqual(c.calls,[]);assert.equal(c.ui.worker.tone,'online');assert.equal(c.ui.session.worker.modelReady,false);
  c.document.hidden=true;c.ui.visibilityChanged();assert(c.w.entries.every(x=>x.closed));assert.equal(c.time.tasks.size,0);await c.time.tick(180000);assert.deepEqual(c.calls,[]);
  c.ui.ngOnDestroy();
});

test('content invalidation fetches direct job progress despite unchanged conversation revision',async()=>{
  const c=workspace();await c.connect();c.ui.detail.jobs=[{id:'job',kind:'turn',state:'running',updatedAt:new Date(c.time.now).toISOString()}];
  c.w.content().next({fromCache:false,data:{schemaVersion:1,revision:'phase',updatedAt:'now'}});await flush();
  assert(c.calls.some(x=>x.path==='/conversations/conversation'));assert(!c.calls.some(x=>x.path.endsWith('/revision')||x.path==='/session'));
  c.ui.ngOnDestroy();
});

test('foreground return reconciles once, creates one listener pair and ignores the detached callbacks',async()=>{
  const c=workspace();await c.connect();const detached=c.w.content();c.document.hidden=true;c.ui.visibilityChanged();
  c.respond(async path=>path==='/session'?c.ui.session:path==='/conversations'?{conversations:[]}:c.ui.detail);
  c.document.hidden=false;c.ui.visibilityChanged();c.w.content().next({fromCache:false,data:null});c.w.presence().next({fromCache:false,data:health(c.time.now)});await flush();assert.equal(c.calls.filter(x=>x.path==='/conversations/conversation').length,1);assert.equal(c.w.entries.length,4);
  const onlineCount=c.calls.length;c.ui.connectionRestored();await flush();assert.equal(c.calls.length,onlineCount);
  const before=c.calls.length;detached.next({fromCache:false,data:{schemaVersion:1,revision:'late',updatedAt:'now'}});await flush();assert.equal(c.calls.length,before);
  c.ui.ngOnDestroy();
});

test('a marker arriving during the gateway fetch gets one trailing production detail refresh',async()=>{
  const c=workspace();await c.connect();const first=deferred();let details=0;
  c.respond(path=>path==='/conversations'?Promise.resolve({conversations:[]}):(++details===1?first.promise:Promise.resolve(c.ui.detail)));
  c.w.content().next({fromCache:false,data:{schemaVersion:1,revision:'first',updatedAt:'now'}});
  for(let i=0;i<8;i++)c.w.content().next({fromCache:false,data:{schemaVersion:1,revision:String(i),updatedAt:'now'}});
  assert.equal(details,1);first.resolve(c.ui.detail);await flush();assert.equal(details,2);assert(!c.calls.some(x=>x.path==='/session'));c.ui.ngOnDestroy();
});

test('a failed gateway refresh retries a retained invalidation even if the live marker stays unchanged',async()=>{
  const c=workspace();await c.connect();let details=0;
  c.respond(path=>path==='/conversations'?Promise.resolve({conversations:[]}):(++details===1?Promise.reject(Error('network disconnected')):Promise.resolve(c.ui.detail)));
  c.w.content().next({fromCache:false,data:{schemaVersion:1,revision:'reply',updatedAt:'now'}});await flush();assert.equal(details,1);assert(c.ui.error);
  await c.time.tick(2000);assert.equal(details,2);assert.equal(c.ui.error,'');assert(!c.calls.some(x=>x.path==='/session'));c.ui.ngOnDestroy();
});

test('health expires at ninety seconds and missing/offline/starting health uses narrow authoritative status only',async()=>{
  const c=workspace();await c.connect();c.respond(async path=>{assert.equal(path,'/service/status');return {service:{...c.ui.session.service,state:'offline',worker:{state:'offline',modelReady:false,lastSeenAt:new Date(c.time.now-90000).toISOString()},canStart:true}};});
  await c.time.tick(90000);assert.deepEqual(c.calls.map(x=>x.path),['/service/status']);assert.equal(c.ui.session.service.state,'offline');assert.equal(c.ui.canStartService,true);
  c.calls.length=0;c.w.presence().next({fromCache:false,data:health(c.time.now,'loading')});await c.time.tick(5000);assert.deepEqual(c.calls.map(x=>x.path),['/service/status']);
  c.calls.length=0;c.w.presence().next({fromCache:false,data:null});await flush();assert(c.calls.every(x=>x.path==='/service/status'));c.ui.ngOnDestroy();
});

test('active jobs retain a bounded lease-expiry reconciliation with a connected content stream',async()=>{
  const c=workspace();await c.connect();c.ui.detail.jobs=[{id:'job',kind:'turn',state:'running',updatedAt:new Date(c.time.now).toISOString()}];c.ui.schedulePoll();
  for(let i=0;i<2;i++){await c.time.tick(45000);c.w.presence().next({fromCache:false,data:health(c.time.now)});await flush();}
  assert(!c.calls.some(x=>x.path.includes('/conversations')));await c.time.tick(35000);assert(c.calls.some(x=>x.path==='/conversations/conversation'));assert(!c.calls.some(x=>x.path==='/session'));c.ui.ngOnDestroy();
});

test('newer live health wins over an older in-flight offline service response',async()=>{
  const c=workspace();await c.connect();const status=deferred();c.respond(path=>{assert.equal(path,'/service/status');return status.promise;});
  c.w.presence().next({fromCache:false,data:health(c.time.now,'offline')});
  c.w.presence().next({fromCache:false,data:health(c.time.now,'ready')});
  status.resolve({service:{...c.ui.session.service,state:'offline',worker:{state:'offline',modelReady:false,lastSeenAt:null},canStart:true}});await flush();
  assert.equal(c.ui.worker.tone,'online');assert.equal(c.ui.canStartService,false);c.ui.ngOnDestroy();
});

test('library invalidation during an existing page load retains one trailing fresh gateway page',async()=>{
  const c=workspace();await c.connect();c.ui.view='library';const oldPage=deferred();let pages=0;
  c.respond(path=>path==='/conversations'?Promise.resolve({conversations:[]}):(++pages===1?oldPage.promise:Promise.resolve({items:[{id:'new'}],nextCursor:null})));
  const pending=c.ui.loadLibrary();c.w.content().next({fromCache:false,data:{schemaVersion:1,revision:'paper-ready',updatedAt:'now'}});await flush();
  oldPage.resolve({items:[{id:'old'}],nextCursor:null});await pending;await flush();assert.equal(pages,2);assert.equal(c.ui.libraryPage.items[0].id,'new');c.ui.ngOnDestroy();
});

test('account reset clears private views/drafts and rejects pending library/artifact/overview responses',async()=>{
  const c=workspace();await c.connect();const library=deferred(),artifact=deferred(),overview=deferred();
  c.respond(path=>path==='/admin/library'?library.promise:path==='/session'?overview.promise:path==='/conversations'?Promise.resolve({conversations:[{id:'old'}]}):Promise.resolve(c.ui.detail));
  c.api.artifact=()=>artifact.promise;c.ui.draft='private draft';c.ui.feedbackText='private feedback';
  const loading=c.ui.loadLibrary(),show=c.ui.showDocument({id:'paper',revision:1},'student'),refresh=c.ui.refresh();
  c.ui.loading=true;c.ui.resetAccount();assert.equal(c.ui.loading,false);c.api.user={uid:'new-owner'};c.ui.session={user:{uid:'new-owner',libraryAccess:true},worker:{state:'offline',modelReady:false},capabilities:{},defaults:{}};
  library.resolve({items:[{id:'old-private-paper'}],nextCursor:null});artifact.resolve('<html>old private paper</html>');overview.resolve({user:{uid:'owner'}});await Promise.all([loading,show,refresh]);
  assert.equal(c.ui.user.uid,'new-owner');assert.equal(c.ui.document,undefined);assert.equal(c.ui.draft,'');assert.equal(c.ui.feedbackText,'');assert.equal(c.ui.libraryPage.items.length,0);assert.deepEqual(Array.from(c.ui.conversations),[]);assert(c.w.entries.every(x=>x.closed));c.ui.ngOnDestroy();
});

test('listener failure falls back only while visible; cross-admin viewing stays read-only and gateway-only',async()=>{
  const c=workspace();await c.connect();c.ui.detail.jobs=[{id:'job',kind:'turn',state:'running',updatedAt:new Date(c.time.now).toISOString()}];
  c.w.content().error();await c.time.tick(2000);assert(c.calls.some(x=>x.path==='/conversations/conversation'));
  c.calls.length=0;c.document.hidden=true;c.ui.visibilityChanged();await c.time.tick(60000);assert.deepEqual(c.calls,[]);
  c.document.hidden=false;c.ui.adminConversation=true;c.ui.detail.conversation.ownerUid='other';assert.equal(c.ui.readOnly,true);c.ui.startEvents();c.w.content().next({fromCache:false,data:null});await flush();
  assert(c.w.entries.every(x=>!x.path.includes('other')));c.calls.length=0;await c.ui.jobAction({id:'job'},'retry');assert.deepEqual(c.calls,[]);c.ui.ngOnDestroy();
});

test('content permission denial plus authoritative gateway denial clears private state promptly without retries',async()=>{
  const c=workspace();await c.connect();c.ui.draft='private draft';c.ui.document={safe:'private'};
  c.respond(path=>{assert.equal(path,'/session');return Promise.reject(Object.assign(Error('Pilot permission denied'),{status:403}));});
  c.w.content().error({code:'permission-denied'});await flush();assert.equal(c.ui.session,undefined);assert.equal(c.ui.detail,undefined);assert.equal(c.ui.document,undefined);assert.equal(c.ui.draft,'');assert(c.w.entries.every(x=>x.closed));
  const subscriptions=c.w.entries.length;await c.time.tick(180000);assert.equal(c.w.entries.length,subscriptions);assert.deepEqual(c.calls.map(x=>x.path),['/session']);c.ui.ngOnDestroy();
});

test('direct content denial with an authorized gateway preserves usable data and throttles SDK retry',async()=>{
  const c=workspace();await c.connect();const session=c.ui.session;
  c.respond(path=>Promise.resolve(path==='/session'?session:path==='/conversations'?{conversations:[]}:c.ui.detail));
  c.w.content().error({code:'permission-denied'});await flush();assert.equal(c.ui.user.uid,'owner');assert.equal(c.ui.detail.conversation.id,'conversation');assert.equal(c.ui.contentAuthorized,true);assert(c.calls.some(x=>x.path==='/session'));assert(c.calls.some(x=>x.path==='/conversations/conversation'));
  const subscriptions=c.w.entries.length;await c.time.tick(59000);assert.equal(c.w.entries.length,subscriptions);await c.time.tick(1000);assert.equal(c.w.entries.length,subscriptions+1);c.ui.ngOnDestroy();
});

test('failed authority revalidation retains the prior view but blocks newer private reads until retry succeeds',async()=>{
  const c=workspace();await c.connect();c.ui.draft='existing draft';
  c.respond(path=>{assert.equal(path,'/session');return Promise.reject(Error('network disconnected'));});
  c.w.content().error({code:'permission-denied'});await flush();assert.equal(c.ui.user.uid,'owner');assert.equal(c.ui.detail.conversation.id,'conversation');assert.equal(c.ui.contentAuthorized,false);assert(c.ui.error);
  await c.ui.refresh();await c.ui.loadLibrary();await c.ui.openConversation('other');await c.ui.send();await c.ui.showDocument({id:'paper',revision:1},'student');assert.deepEqual(c.calls.map(x=>x.path),['/session']);
  await c.time.tick(59000);assert.equal(c.calls.length,1);await c.time.tick(1000);assert.deepEqual(c.calls.map(x=>x.path),['/session','/session']);c.ui.ngOnDestroy();
});

test('presence pairing denial checks user access and keeps authorized conversations while status pairing is unavailable',async()=>{
  const c=workspace();await c.connect();const session=c.ui.session;
  c.respond(path=>{if(path==='/session')return Promise.resolve(session);if(path==='/service/status')return Promise.reject(Object.assign(Error('Pairing unavailable'),{status:503}));throw Error(path);});
  c.w.presence().error({code:'permission-denied'});await flush();assert.equal(c.ui.user.uid,'owner');assert.equal(c.ui.detail.conversation.id,'conversation');assert.equal(c.ui.canStartService,false);assert.equal(c.ui.worker.tone,'offline');assert.equal(c.w.content().closed,false);
  assert.deepEqual(c.calls.map(x=>x.path),['/session','/service/status']);const subscriptions=c.w.entries.length;await c.time.tick(59000);assert.equal(c.w.entries.length,subscriptions);assert.equal(c.calls.length,2);c.ui.ngOnDestroy();
});

test('unpaired capability revalidation restores presence without periodic history or list reads',async()=>{
  const c=workspace();await c.connect();const paired=c.ui.session;let sessions=0;
  c.respond(path=>{if(path==='/session'){sessions++;return Promise.resolve(sessions===1?{...paired,service:null,worker:{state:'offline',modelReady:false},notifications:{...config,presencePath:null}}:paired);}if(path==='/service/status')return Promise.resolve({service:paired.service});if(path==='/conversations')return Promise.resolve({conversations:[]});if(path==='/conversations/conversation')return Promise.resolve(c.ui.detail);throw Error(path);});
  c.w.presence().error({code:'permission-denied'});await flush();assert.equal(c.ui.session.service,null);c.w.content().next({fromCache:false,data:null});await flush();c.calls.length=0;
  await c.time.tick(60000);assert.deepEqual(c.calls.map(x=>x.path),['/session','/service/status']);assert.equal(c.w.presence().closed,false);
  c.w.content().next({fromCache:false,data:null});c.w.presence().next({fromCache:false,data:health(c.time.now)});await flush();assert.equal(c.ui.worker.tone,'online');c.calls.length=0;
  await c.time.tick(40000);c.w.presence().next({fromCache:false,data:health(c.time.now)});await c.time.tick(40000);assert.deepEqual(c.calls,[]);c.ui.ngOnDestroy();
});

test('manual session capability removal cannot revive availability from an older healthy pairing snapshot',async()=>{
  const c=workspace();await c.connect();const session={...c.ui.session,service:null,worker:{state:'offline',modelReady:false},notifications:{...config,presencePath:null}};
  c.respond(path=>Promise.resolve(path==='/session'?session:path==='/conversations'?{conversations:[]}:c.ui.detail));
  await c.ui.refresh();assert.equal(c.ui.session.service,null);assert.equal(c.ui.worker.tone,'offline');assert.equal(c.ui.session.worker.state,'offline');assert.equal(c.ui.canStartService,false);c.ui.ngOnDestroy();
});

test('configuration grants only exact owner and fixed health paths',()=>{
  const {validNotifications,freshHealth}=compile('owner-events.ts');assert.equal(validNotifications(config,'owner'),true);assert.equal(validNotifications(config,'other'),false);assert.equal(validNotifications({...config,presencePath:'assistantWorkers/sachit-windows'},'owner'),false);assert.equal(freshHealth(health(Date.now()+10000)),false);
});
