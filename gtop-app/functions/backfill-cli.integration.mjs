import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Firestore,Timestamp} from 'firebase-admin/firestore';

assert(process.env.FIRESTORE_EMULATOR_HOST,'CLI migration test requires an emulator.');
const projectId='demo-register-cli-'+Date.now(),db=new Firestore({projectId});
const stamp=Timestamp.fromDate(new Date('2011-01-01T00:00:00Z'));
for(let i=0;i<3;i++)await db.doc('paperConversations/source-'+i).set({title:'Historical CLI source '+i,ownerUid:'fixture-admin',status:'cancelled',createdAt:stamp,updatedAt:stamp});
const original=(await db.collection('paperConversations').get()).docs.map(doc=>({id:doc.id,data:doc.data()}));
const sourceCount=(await Promise.all(['paperConversations','paperRequests','paperDrafts'].map(async name=>(await db.collection(name).get()).size))).reduce((sum,count)=>sum+count,0);
// An imported emulator export can seed a new project namespace too. Restart
// only this unique test project's checkpoint; preserve all its source documents.
const invoke=(passes,budget,restart=false)=>spawnSync(process.execPath,[fileURLToPath(new URL('./backfill-register.mjs',import.meta.url)),'--until-ready',...(restart?['--restart']:[])],{encoding:'utf8',timeout:60000,env:{...process.env,GCLOUD_PROJECT:projectId,REGISTER_BACKFILL_BUDGET:String(budget),REGISTER_BACKFILL_MAX_PASSES:String(passes),REGISTER_BACKFILL_MAX_MS:'50000'}});
try{
  const interrupted=invoke(1,2,true);assert.equal(interrupted.status,2,interrupted.stdout+interrupted.stderr);
  const checkpoint=(await db.doc('paperRegisterState/v1').get()).data();assert.equal(checkpoint.ready,false);assert.equal(checkpoint.checked,2);
  const resumed=invoke(20,Math.max(2,Math.floor(sourceCount/2)));assert.equal(resumed.status,0,resumed.stderr);
  const passes=resumed.stdout.trim().split('\n').map(line=>JSON.parse(line));assert(passes.length>1);assert.equal(passes.at(-1).ready,true);
  assert.equal((await db.doc('paperRegisterState/v1').get()).data().ready,true);
  assert.deepEqual((await db.collection('paperConversations').get()).docs.map(doc=>({id:doc.id,data:doc.data()})),original);
  for(let i=0;i<3;i++)assert((await db.doc('paperRegister/source-'+i).get()).exists);
  console.log(JSON.stringify({test:'bounded CLI migration resumes automatically without source changes',projectId,partialExit:interrupted.status,partialChecked:checkpoint.checked,resumedPasses:passes.length,finalChecked:passes.at(-1).checked,ready:true}));
}finally{await db.terminate();}
