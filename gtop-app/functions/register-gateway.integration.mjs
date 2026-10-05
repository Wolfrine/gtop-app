import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import assert from 'node:assert/strict';
assert(process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_AUTH_EMULATOR_HOST,'Gateway integration is local-emulator-only.');
const gateway=process.env.REGISTER_GATEWAY_URL;
assert(gateway&&['localhost','127.0.0.1'].includes(new URL(gateway).hostname),'Specify the local gateway URL.');
initializeApp({projectId:process.env.GCLOUD_PROJECT||'demo-gtop'});
const db=getFirestore(),auth=getAuth(),tag='gateway-'+Date.now();
async function identity(suffix,role){
  const uid=tag+'-'+suffix;await auth.createUser({uid});await db.doc('users/'+uid).set({role,displayName:'Gateway local '+suffix});
  const token=await auth.createCustomToken(uid);
  const response=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=local-only',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true})});
  assert(response.ok);return {uid,token:(await response.json()).idToken};
}
const admin=await identity('admin','admin'),learner=await identity('learner','student');
assert.equal((await fetch(gateway+'/register')).status,401);
assert.equal((await fetch(gateway+'/register',{headers:{Authorization:'Bearer '+learner.token}})).status,403);
const conversationId=tag+'-chat',requestId=tag+'-request';
const batch=db.batch();
batch.set(db.doc('paperConversations/'+conversationId),{title:'Triggered register requirement',ownerUid:admin.uid,activeRequestId:requestId,status:'queued',revision:1,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
batch.set(db.doc('paperRequests/'+requestId),{source:'admin-paper-chat',conversationId,brief:'Triggered archival microscopy brief',requestedBy:admin.uid,status:'queued',revision:1,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
await batch.commit();
const deadline=Date.now()+45000;let row;
while(Date.now()<deadline){row=(await db.doc('paperRegister/'+conversationId).get()).data();if(row?.activeRequestId===requestId)break;await new Promise(resolve=>setTimeout(resolve,250));}
assert.equal(row?.activeRequestId,requestId,'Actual document triggers must create the summary without a test projection call.');
let body;
while(Date.now()<deadline){
  const result=await fetch(gateway+'/register?q=microscopy&mine=1',{headers:{Authorization:'Bearer '+admin.token}});
  assert.equal(result.status,200);body=await result.json();if(body.items.some(i=>i.id===conversationId))break;await new Promise(resolve=>setTimeout(resolve,250));
}
assert(body.items.some(i=>i.id===conversationId));assert(body.items.length<=30);assert(body.scanned<=200);
console.log('Register gateway integration passed: anonymous401, learner403, admin search, actual source triggers and bounded response.');
await db.terminate();
