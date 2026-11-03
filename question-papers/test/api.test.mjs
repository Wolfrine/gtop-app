import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(hostname='127.0.0.1',search='?emulator=1',firestoreUnavailable=false){
  let authCallback,fetcher;const listeners=[],emulators=[],requests=[];
  const user={uid:'owner',getIdToken:async()=> 'synthetic-test-token'};
  const auth={};
  const sdk={getAuth:()=>auth,onAuthStateChanged(_auth,callback){authCallback=callback;queueMicrotask(()=>callback(user));return ()=>{};},setPersistence:async()=>{},getRedirectResult:async()=>null,connectAuthEmulator:(_auth,url)=>emulators.push(url),browserLocalPersistence:{},GoogleAuthProvider:class{},signInWithRedirect:async()=>{},signInWithEmailAndPassword:async()=>({user}),signOut:async()=>authCallback(null)};
  const firestore={initializeFirestore:(_app,options)=>{if(firestoreUnavailable)throw Error('Unavailable SDK');assert.equal(options.localCache,'memory');return {};},memoryLocalCache:()=> 'memory',connectFirestoreEmulator:(_db,host,port)=>emulators.push(host+':'+port),doc:(_db,path)=>path,onSnapshot(path,options,next,error){const entry={path,options,next,error,closed:false};listeners.push(entry);return ()=>entry.closed=true;}};
  const exports={};const source=readFileSync(new URL('../src/api.service.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  runInNewContext(code,{exports,require(name){if(name==='@angular/core')return {Injectable:()=>()=>{}};if(name==='firebase/app')return {initializeApp:()=>({})};if(name==='firebase/auth')return sdk;if(name==='firebase/firestore')return firestore;throw Error('Unexpected import '+name);},location:{hostname,search,origin:'https://papers.example.invalid'},URL,URLSearchParams,AbortSignal,queueMicrotask,fetch:async(path,options)=>{requests.push({path,options});if(path==='/assistant-config.json')return {ok:true,json:async()=>({apiBase:'https://api.example.invalid',firebase:{projectId:'test'}})};if(fetcher)return fetcher(path,options);return {ok:true,json:async()=>({ok:true}),text:async()=>'<html>private</html>'};}});
  return {api:new exports.AssistantApi(),user,listeners,emulators,requests,setUser(next){authCallback(next);},respond(fn){fetcher=fn;}};
}

test('persistent Auth observer reports account/signout transitions and emulator setup is localhost only',async()=>{
  const c=harness();await c.api.initialize();const accounts=[];const unsubscribe=c.api.observeUser(user=>accounts.push(user?.uid??null));
  c.setUser({uid:'second',getIdToken:async()=> 'synthetic'});await c.api.logout();assert.deepEqual(accounts,['owner','second',null]);unsubscribe();c.setUser(c.user);assert.equal(accounts.length,3);
  assert(c.emulators.includes('127.0.0.1:8280'));assert(c.emulators.includes('http://127.0.0.1:9299'));
  const hosted=harness('papers.example.invalid');await hosted.api.initialize();assert.deepEqual(hosted.emulators,[]);
});

test('marker reads use exact own content/fixed health only and ignore callbacks after identity changes',async()=>{
  const c=harness();await c.api.initialize();let updates=0,reason;const stop=c.api.watchMarker('assistantUiNotifications/owner',()=>updates++,error=>reason=error);
  assert.throws(()=>c.api.watchMarker('assistantUiNotifications/other',()=>{},()=>{}),/Invalid notification path/);
  assert.throws(()=>c.api.watchMarker('assistantJobs/private',()=>{},()=>{}),/Invalid notification path/);
  c.listeners[0].next({metadata:{fromCache:false},exists:()=>false});assert.equal(updates,1);
  c.listeners[0].error({code:'permission-denied'});assert.equal(reason.code,'permission-denied');
  c.setUser(null);c.listeners[0].next({metadata:{fromCache:false},exists:()=>false});assert.equal(updates,1);stop();assert.equal(c.listeners[0].closed,true);
});

test('Firestore initialization failure preserves normal authenticated gateway access',async()=>{
  const c=harness('127.0.0.1','?emulator=1',true);await c.api.initialize();assert.equal(c.api.user.uid,'owner');assert.equal((await c.api.request('/session')).ok,true);assert.throws(()=>c.api.watchMarker('assistantUiNotifications/owner',()=>{},()=>{}),/unavailable/);
});

test('account switch prevents old token dispatch and rejects response/body reads from an old identity',async()=>{
  const c=harness();await c.api.initialize();const token=deferred();c.user.getIdToken=()=>token.promise;const request=c.api.request('/session');c.setUser({uid:'second',getIdToken:async()=> 'synthetic'});token.resolve('old-synthetic');await assert.rejects(request,/Account changed/);assert.equal(c.requests.length,1);
  const response=deferred();c.respond(()=>response.promise);const pending=c.api.request('/session');await Promise.resolve();c.setUser(null);response.resolve({ok:true,json:async()=>({private:true})});await assert.rejects(pending,/Account changed/);
  c.setUser({uid:'third',getIdToken:async()=> 'synthetic'});const body=deferred();c.respond(async()=>({ok:true,text:()=>body.promise}));const artifact=c.api.artifact('paper','student');for(let i=0;i<8;i++)await Promise.resolve();c.setUser(null);body.resolve('old private content');await assert.rejects(artifact,/Account changed/);
});
