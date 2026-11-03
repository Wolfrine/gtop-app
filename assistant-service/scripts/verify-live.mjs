import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
initializeApp({projectId:'gtop-app'});
const gateway='https://us-central1-gtop-app.cloudfunctions.net/gtopAssistantGateway';
assert.equal((await fetch(gateway+'/session',{signal:AbortSignal.timeout(30000)})).status,401);
const config=(await getFirestore().doc('assistantConfig/pilot').get()).data();
assert(Array.isArray(config?.allowedOwnerUids)&&config.allowedOwnerUids.length>0,'Private pilot allowlist must be configured explicitly.');
const uid=config.allowedOwnerUids[0];
assert.equal((await getFirestore().doc('users/'+uid).get()).data()?.role,'admin');
const token=await getAuth().createCustomToken(uid);
const login=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyATxEIUYY7rPgJriy_0q7yjfcP-QyBMZkM',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true}),signal:AbortSignal.timeout(30000)});assert(login.ok,'Existing Firebase token signing/authentication must work; no automatic IAM grants are permitted.');
const idToken=(await login.json()).idToken;
const session=await fetch(gateway+'/session',{headers:{Authorization:'Bearer '+idToken},signal:AbortSignal.timeout(30000)});assert(session.ok);const data=await session.json();assert.equal(data.user.uid,uid);assert.equal(data.capabilities.identity,'GTOP assistant');assert(Array.isArray(data.capabilities.actions));assert(data.capabilities.boards.some(b=>b.name==='CBSE'&&b.classes.includes(5)&&b.classes.includes(12)));assert(!JSON.stringify(data).includes('bootstrapSecret'));
console.log('Live assistant gateway verified: anonymous denial, existing invited admin access and capabilities. No paper/chat fixture written.');
assert.equal(data.notifications?.schemaVersion,1);
assert.equal(data.notifications.contentPath,'assistantUiNotifications/'+uid);
assert.equal(data.notifications.freshnessMs,90000);
const status=await fetch(gateway+'/service/status',{headers:{Authorization:'Bearer '+idToken},signal:AbortSignal.timeout(30000)});
if(data.service){assert(status.ok);assert.equal((await status.json()).service.workerId,data.service.workerId);}
const documents='https://firestore.googleapis.com/v1/projects/gtop-app/databases/(default)/documents/';
const direct=(path,token=idToken)=>fetch(documents+path,{headers:token?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(30000)});
const own=await direct(data.notifications.contentPath);assert([200,404].includes(own.status),'Owner notification get must be permitted, including an absent initial marker.');
const other=config.allowedOwnerUids.find(value=>value!==uid)||'unrelated-notification-owner';
assert.equal((await direct('assistantUiNotifications/'+other)).status,403);
assert.equal((await direct(data.notifications.contentPath,null)).status,403);
assert.equal((await direct('assistantJobs/turn-dispatch-acceptance-20261102')).status,403);
if(data.notifications.presencePath){
  const presence=await direct(data.notifications.presencePath);assert([200,404].includes(presence.status));
  if(presence.ok){const fields=Object.keys((await presence.json()).fields||{}).sort();assert.deepEqual(fields,['lastSeenAt','modelReady','schemaVersion','state','version']);}
  assert.equal((await direct(data.notifications.presencePath,null)).status,403);
}
console.log('Live owner-only notification/presence metadata and narrow status verified; anonymous, cross-owner and direct job access denied. Read-only smoke created no job or paper.');
