// Deliberately synthetic identities, isolated demo project only. No inference.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const project='demo-gtop-assistant';
assert(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST,'Auth/Firestore emulator variables are required.');
assert(/^127\.0\.0\.1:/.test(process.env.FIRESTORE_EMULATOR_HOST)&&/^127\.0\.0\.1:/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST),'Only loopback emulators may be seeded.');
initializeApp({projectId:project});
const auth=getAuth(),db=getFirestore();
const account={uid:'pilot-admin',email:'aparna-pilot@example.test',password:'SyntheticEmulatorPasswordOnly!',displayName:'Aparna (synthetic emulator fixture)'};
try{await auth.createUser(account);}catch(error){if(error.code!=='auth/uid-already-exists' && error.code!=='auth/email-already-exists')throw error;await auth.updateUser(account.uid,account);}
await Promise.all([
  db.doc('users/pilot-admin').set({role:'admin',displayName:account.displayName,email:account.email}),
  db.doc('assistantConfig/pilot').set({allowedOwnerUids:['pilot-admin']}),
  db.doc('assistantWorkers/sachit-windows').set({enabled:true,allowedOwnerUids:['pilot-admin'],bootstrapSecretSha256:createHash('sha256').update('emulator-only-worker-secret-with-more-than-32-characters').digest('hex')})
]);
console.log('Seeded only synthetic demo-gtop-assistant pilot admin/config/worker; no model invoked.');
