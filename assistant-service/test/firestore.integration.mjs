import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {getDoc,setDoc,doc} from 'firebase/firestore';
import {get,ref,set} from 'firebase/database';
import {AssistantService} from '../service.mjs';
import {FirestoreStore} from '../store.mjs';

const project='demo-gtop-assistant';
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !project.startsWith('demo-'))throw Error('Isolated demo Firestore and Auth emulators are required.');
const base=`http://127.0.0.1:5201/${project}/us-central1/gtopAssistantGateway`;
const app=initializeApp({projectId:project},'assistant-integration');
const db=getFirestore(app),auth=getAuth(app);
async function login(email,uid,claims){
  const password='SyntheticEmulatorPasswordOnly!';
  await auth.createUser({uid,email,password});
  if(claims)await auth.setCustomUserClaims(uid,claims);
  const r=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  assert.equal(r.status,200);return (await r.json()).idToken;
}
async function request(method,path,body,token){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(method==='POST'?{body:JSON.stringify(body || {})}:{})});return {status:r.status,body:await r.json()};}
test('actual Auth/Firestore/function endpoint enforces identity, durable ownership, leasing and revoked access',async()=>{
  const suffix=Date.now().toString(),owner='emulator-admin-'+suffix,other='emulator-other-'+suffix,learner='emulator-learner-'+suffix,worker='emulator-worker-'+suffix;
  const [ownerToken,otherToken,learnerToken,workerToken]=await Promise.all([login(owner+'@example.test',owner),login(other+'@example.test',other),login(learner+'@example.test',learner),login(worker+'@example.test','assistant-worker-'+worker,{assistantWorker:true,workerId:worker})]);
  await Promise.all([db.doc('users/'+owner).set({role:'admin'}),db.doc('users/'+other).set({role:'admin'}),db.doc('users/'+learner).set({role:'user'}),db.doc('assistantConfig/pilot').set({allowedOwnerUids:[owner,other]}),db.doc('assistantWorkers/'+worker).set({enabled:true,allowedOwnerUids:[owner]})]);
  assert.equal((await request('GET','/session')).status,401);
  assert.equal((await request('GET','/session',null,learnerToken)).status,403);
  assert.equal((await request('GET','/session',null,ownerToken)).status,200);
  const created=await request('POST','/conversations',{},ownerToken);assert.equal(created.status,200);const cid=created.body.conversation.id;
  const sent=await request('POST',`/conversations/${cid}/messages`,{text:'Synthetic emulator Hindi request: पूरा syllabus — 80 marks',clientMessageId:'fixture-one'},ownerToken);assert.equal(sent.status,200);
  assert.equal((await request('GET',`/conversations/${cid}`,null,otherToken)).status,404);
  const claim=await request('POST','/worker/claim',{kind:'turn'},workerToken);assert.equal(claim.status,200);assert.equal(claim.body.job.request.text,sent.body.message.text);
  const jid=claim.body.job.id,leaseId=claim.body.job.leaseId;
  assert.equal((await request('POST',`/worker/jobs/${jid}/heartbeat`,{leaseId},workerToken)).body.active,true);
  await db.doc('assistantJobs/'+jid).update({leaseUntil:'2020-01-01T00:00:00.000Z'});
  assert.equal((await request('POST',`/worker/jobs/${jid}/complete`,{leaseId,reply:'Must not publish'},workerToken)).body.active,false);
  const view=await request('GET',`/conversations/${cid}`,null,ownerToken);assert.equal(view.body.jobs[0].state,'failed');assert(!JSON.stringify(view).includes('leaseId'));
  const retry=await request('POST',`/jobs/${jid}/retry`,{},ownerToken);assert.equal(retry.status,200);assert.notEqual(retry.body.job.id,jid);
  const service=new AssistantService(new FirestoreStore(db));
  const workerDoc=await service.worker({uid:'assistant-worker-'+worker,assistantWorker:true,workerId:worker});
  const [a,b]=await Promise.all([service.claim(workerDoc,{kind:'turn'}),service.claim(workerDoc,{kind:'turn'})]);assert.equal([a,b].filter(x=>x.job).length,1);
  await deleteApp(app);
});

test('canonical shared rules deny all direct assistant access, including admins and worker claims',async()=>{
  const env=await initializeTestEnvironment({projectId:project,firestore:{rules:await readFile(new URL('../../gtop-app/firestore.rules',import.meta.url),'utf8')},database:{host:'127.0.0.1',port:9380,rules:await readFile(new URL('../security/worker-database.rules.json',import.meta.url),'utf8')}});
  try{
    await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'users','rules-admin'),{role:'admin'});await setDoc(doc(ctx.firestore(),'assistantConfig','pilot'),{allowedOwnerUids:['rules-admin']});await setDoc(doc(ctx.firestore(),'assistantPapers','rules-paper'),{ownerUid:'rules-admin'});await setDoc(doc(ctx.firestore(),'questions','rules-question'),{question:'Synthetic rule test'});});
    for(const ctx of [env.unauthenticatedContext(),env.authenticatedContext('rules-admin'),env.authenticatedContext('rules-worker',{assistantWorker:true,workerId:'rules-worker'})]){
      await assertFails(getDoc(doc(ctx.firestore(),'assistantConfig','pilot')));
      await assertFails(getDoc(doc(ctx.firestore(),'assistantPapers','rules-paper')));
      await assertFails(getDoc(doc(ctx.firestore(),'assistantCurricula','rules-curriculum')));
      await assertFails(setDoc(doc(ctx.firestore(),'assistantCurricula','forged'),{ownerUid:'rules-admin'}));
      await assertFails(setDoc(doc(ctx.firestore(),'assistantJobs','forged'),{ownerUid:'rules-admin',state:'completed'}));
    }
    await assertSucceeds(getDoc(doc(env.authenticatedContext('rules-admin').firestore(),'users','rules-admin')));
    const human=env.authenticatedContext('normal-human'),worker=env.authenticatedContext('rules-worker',{assistantWorker:true,workerId:'rules-worker'});
    await assertSucceeds(getDoc(doc(human.firestore(),'questions','rules-question')));
    await assertSucceeds(setDoc(doc(human.firestore(),'users','normal-human'),{role:'user'}));
    await assertFails(getDoc(doc(worker.firestore(),'questions','rules-question')));
    await assertFails(setDoc(doc(worker.firestore(),'users','rules-worker'),{role:'user'}));
    await assertSucceeds(set(ref(human.database(),'activeUsers/normal-human'),{userId:'normal-human',isOnline:true}));
    await assertSucceeds(get(ref(human.database(),'activeUsers')));
    await assertFails(get(ref(worker.database(),'activeUsers')));
    await assertFails(set(ref(worker.database(),'activeUsers/rules-worker'),{userId:'rules-worker',isOnline:true}));
  }finally{await env.cleanup();}
});
