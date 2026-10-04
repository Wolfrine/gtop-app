import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import assert from 'node:assert/strict';
initializeApp({projectId:'gtop-app',storageBucket:'gtop-app.firebasestorage.app'});
const gateway='https://us-central1-gtop-app.cloudfunctions.net/paperGateway';
const unauthenticated=await fetch(gateway+'/config',{signal:AbortSignal.timeout(30000)});
assert.equal(unauthenticated.status,401,'Paper gateway must reject anonymous access.');
const admins=await getFirestore().collection('users').where('role','==','admin').limit(1).get();
assert(!admins.empty,'An existing admin is required for deployment verification.');
// Use the workflow's existing Firebase Admin credentials. No test account,
// fictional paper requirement, subscriptions or messages are written to live data.
const token=await getAuth().createCustomToken(admins.docs[0].id);
const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyATxEIUYY7rPgJriy_0q7yjfcP-QyBMZkM',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true}),signal:AbortSignal.timeout(30000)});
assert(response.ok,'Existing admin authentication must work.');const identity=await response.json();
const config=await fetch(gateway+'/config',{headers:{Authorization:'Bearer '+identity.idToken},signal:AbortSignal.timeout(30000)});
assert(config.ok,'Signed-in admins must be able to enable browser notifications.');assert((await config.json()).publicKey?.length>50,'A valid public push key is required.');
const [storageReady]=await getStorage().bucket().exists();
assert(storageReady,'The configured Firebase Storage bucket must exist before diagram delivery.');
console.log('Live paper backend verified: anonymous denial, existing admin access, public push configuration and Firebase diagram bucket. No fictional requests or papers created.');
