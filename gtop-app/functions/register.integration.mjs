import {initializeApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import assert from 'node:assert/strict';
import {projectSource,refreshRegister,searchRegister,runBackfill} from './paper-register.mjs';
assert(process.env.FIRESTORE_EMULATOR_HOST,'Register integration is local-emulator-only.');
initializeApp({projectId:process.env.GCLOUD_PROJECT||'demo-gtop'});
const db=getFirestore(),tag='register-'+Date.now(),owner=tag+'-admin';
await db.doc('users/'+owner).set({role:'admin',displayName:'Local register verifier'});
const conversationId=tag+'-chat',oldRequest=tag+'-old',newRequest=tag+'-new',paperId=tag+'-paper';
const stamp=n=>Timestamp.fromMillis(1_700_000_000_000+n);
await db.doc('paperConversations/'+conversationId).set({title:'Cell paper',ownerUid:owner,activeRequestId:newRequest,status:'needs-info',revision:2,createdAt:stamp(1),updatedAt:stamp(4)});
await db.doc('paperRequests/'+oldRequest).set({source:'admin-paper-chat',conversationId,status:'completed',revision:1,brief:'Historical chloroplast requirement',requestedBy:owner,createdAt:stamp(1)});
await db.doc('paperRequests/'+newRequest).set({source:'admin-paper-chat',conversationId,status:'needs-info',revision:2,brief:'Current cell requirement',requestedBy:owner,createdAt:stamp(4)});
await db.doc('paperDrafts/'+paperId).set({conversationId,parentRequestId:oldRequest,title:'Cell paper version one',requestRevision:1,status:'ready',board:'ICSE',standard:'9',subjects:['Biology'],chapters:['Cells'],createdAt:stamp(2),paperHtml:'DO NOT COPY PRIVATE FULL HTML'});
await db.doc('paperMessages/'+tag+'-question').set({conversationId,requestId:newRequest,role:'agent',text:'Should the revision include plant cells?',createdAt:stamp(5)});
for(const [collection,id] of [['paperConversations',conversationId],['paperRequests',oldRequest],['paperRequests',newRequest],['paperDrafts',paperId]])await projectSource(db,collection,id);
await refreshRegister(db,conversationId);
const summary=(await db.doc('paperRegister/'+conversationId).get()).data();
assert.equal(summary.hasReady,true);assert.equal(summary.status,'needs-info');assert.equal(summary.latestPaperId,paperId);assert.equal(summary.requestRevision,2);assert.equal(summary.creatorName,'Local register verifier');assert.equal(summary.clarificationText,'Should the revision include plant cells?');assert(!JSON.stringify(summary).includes('PRIVATE FULL HTML'));
const ready=await searchRegister(db,{view:'ready',mine:'1'},owner);assert(ready.items.some(i=>i.id===conversationId));
const old=await searchRegister(db,{q:'chloroplast',mine:'1'},owner);assert.equal(old.items[0].id,conversationId);
const before=(await db.doc('paperRequests/'+newRequest).get()).data();
await db.doc('paperRequests/'+newRequest).update({status:'error',error:'Source selection failed'});
await Promise.all([projectSource(db,'paperRequests',newRequest),projectSource(db,'paperRequests',newRequest)]);
assert.equal((await db.doc('paperRegister/'+conversationId).get()).data().status,'error');
assert.equal((await searchRegister(db,{view:'ready',mine:'1'},owner)).items[0].latestPaperId,paperId);
assert.equal((await db.doc('paperRequests/'+newRequest).get()).data().brief,before.brief);

// A legacy request and its saved draft form one family using the explicit link.
const legacyRequest=tag+'-legacy',legacyPaper=tag+'-legacy-paper';
await db.doc('paperRequests/'+legacyRequest).set({title:'Legacy geometry',savedDraftId:legacyPaper,status:'completed',createdBy:owner,createdAt:stamp(6)});
await db.doc('paperDrafts/'+legacyPaper).set({title:'Legacy geometry',status:'draft',createdBy:owner,marks:10,actualMarks:10,sections:[{}],coverage:{gapCount:0},createdAt:stamp(7)});
await projectSource(db,'paperDrafts',legacyPaper);await projectSource(db,'paperRequests',legacyRequest);
const legacy=await searchRegister(db,{q:'geometry',mine:'1'},owner);assert.equal(legacy.items.length,1);assert.equal(legacy.items[0].id,'legacy-request-'+legacyRequest);assert(legacy.items[0].hasReady);

// The scan ceiling must expose continuation, even when its first 200 matches
// for the anchor word fail a second word. The matching old record is page two.
const batch=db.batch();
for(let n=0;n<205;n++)batch.set(db.doc('paperRequests/'+tag+'-scan-'+String(n).padStart(3,'0')),{title:'Register scan boundary',brief:'ubiquitous '+(n===204?'needle':'other'),createdBy:owner,status:'cancelled',createdAt:stamp(1000-n)});
await batch.commit();
for(let n=0;n<205;n+=5)await Promise.all(Array.from({length:Math.min(5,205-n)},(_,i)=>projectSource(db,'paperRequests',tag+'-scan-'+String(n+i).padStart(3,'0'))));
const first=await searchRegister(db,{q:'ubiquitous needle',mine:'1'},owner);assert.equal(first.items.length,0);assert.equal(first.scanned,200);assert(first.continuing&&first.nextCursor);
const second=await searchRegister(db,{q:'ubiquitous needle',mine:'1',cursor:first.nextCursor},owner);assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);

// Resume migration from a small budget; readiness cannot be set mid-scan.
let migration=await runBackfill(db,{maxDocuments:3,reset:true});assert.equal(migration.ready,false);
for(let n=0;n<10&&!migration.ready;n++)migration=await runBackfill(db,{maxDocuments:1000});
assert(migration.ready,'Full projection and verification must complete');
assert.equal((await searchRegister(db,{q:'chloroplast',mine:'1'},owner)).indexReady,true);
await db.doc('paperDrafts/'+paperId).delete();await projectSource(db,'paperDrafts',paperId);
assert.equal((await db.doc('paperRegister/'+conversationId).get()).data().hasReady,false);
console.log('Register integration passed: historical search, legacy links, creator attribution, active clarification, ready older versions, scan continuation, source preservation, resumable verified migration and deletion repair.');
await db.terminate();
