import {initializeApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import assert from 'node:assert/strict';
assert(process.env.FIRESTORE_EMULATOR_HOST,'This verification runs only against the local emulator.');
initializeApp({projectId:process.env.GCLOUD_PROJECT||'demo-gtop'});
const db=getFirestore();const tag='service-'+Date.now();const stamp=()=>FieldValue.serverTimestamp();
const question={questionId:tag+'-q',sourceCollection:'paperQuestions',origin:'bank',board:'ICSE',standard:'9',subject:'Biology',chapter:'Cells',question:'Where does respiration release energy?',marks:2,questionType:'short_answer',difficulty:'easy',options:[],correctIndex:-1,solutions:['Mitochondria release energy during respiration.'],status:'ready'};
await db.doc('paperQuestions/'+question.questionId).set(question);
async function submit(suffix,change={},active=true){
  const id=tag+'-'+suffix,requestId=id+'-request',conversationId=id+'-chat';
  const batch=db.batch();
  batch.set(db.doc('paperRequests/'+requestId),{source:'admin-paper-chat',revision:1,status:'queued',requestedBy:tag+'-admin',conversationId,createdAt:stamp()});
  batch.set(db.doc('paperConversations/'+conversationId),{activeRequestId:active?requestId:'a-newer-request',status:'queued'});
  batch.set(db.doc('paperDrafts/'+id),{title:'Cell revision '+suffix,board:'ICSE',standard:'9',subjects:['Biology'],chapters:['Cells'],durationMinutes:30,marks:2,sections:[{title:'Section A',questions:[question]}],conversationId,parentRequestId:requestId,requestRevision:1,status:'publishing',readyToPublish:true,createdAt:stamp(),...change});
  await batch.commit();return {id,requestId,conversationId};
}
async function wait(id,status){
  const until=Date.now()+60000;
  while(Date.now()<until){const data=(await db.doc('paperDrafts/'+id).get()).data();if(data?.status===status)return data;await new Promise(resolve=>setTimeout(resolve,200));}
  throw Error('Timed out publishing '+id+' as '+status);
}
const good=await submit('valid');const ready=await wait(good.id,'ready');
assert.equal(ready.reusedQuestionCount,1);assert.equal(ready.generatedQuestionCount,0);
assert(!ready.paperHtml.includes(question.solutions[0]));assert(ready.answerHtml.includes(question.solutions[0]));
assert.equal((await db.doc('paperRequests/'+good.requestId).get()).data().status,'completed');
assert.equal((await db.doc('paperMessages/'+good.id+'-delivered').get()).data().paperId,good.id);
assert.equal((await db.doc('paperNotifications/'+good.requestId+'-ready').get()).data().ownerUid,tag+'-admin');
await db.doc('paperDrafts/'+good.id).update({updatedAt:stamp()});
assert.equal((await db.doc('paperArtifacts/'+good.id+'/documents/paper').get()).data().html,ready.paperHtml);
const bad=await submit('bad-marks',{marks:8});await wait(bad.id,'publication-error');
assert.equal((await db.doc('paperRequests/'+bad.requestId).get()).data().status,'error');
assert(!(await db.doc('paperArtifacts/'+bad.id+'/documents/paper').get()).exists);
const stale=await submit('superseded',{},false);await wait(stale.id,'superseded');
assert(!(await db.doc('paperMessages/'+stale.id+'-delivered').get()).exists);
console.log('Publication integration passed: exact snapshot, separate answers, one delivery, failed totals and superseded requests.');
await db.terminate();
