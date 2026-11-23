import {initializeApp,applicationDefault,getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {stagePaperCatalogue,catalogueMigrationPath,catalogueSchemaVersion} from '../paper-catalogue.mjs';

// Intentionally not scheduled. Explicit release-time, bounded, resumable once-only
// projection of original generated papers; source papers are never written.
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'gtop-app'});
const db=getFirestore();
const stateRef=db.doc(catalogueMigrationPath);
const limit=40,maxPerRun=240;
const started=new Date().toISOString();
const old=(await stateRef.get()).data()||{};
if(old.completed===true&&old.schemaVersion===catalogueSchemaVersion){
  console.log(JSON.stringify({catalogueBackfill:'already_complete',processed:old.processed||0,updated:old.updated||0}));
  process.exit(0);
}
let cursor=old.cursor||null,processed=old.processed||0,updated=old.updated||0,needsReview=old.needsReview||0;
let failures=old.failures||0,handled=0,done=false;
const failuresSample=[];
while(handled<maxPerRun){
  let query=db.collection('assistantPapers').orderBy('__name__').limit(Math.min(limit,maxPerRun-handled));
  if(cursor)query=query.startAfter(cursor);
  const page=await query.get();
  for(const doc of page.docs){
    const paper={...doc.data(),id:doc.id};
    try{
      const result=await db.runTransaction(tx=>stagePaperCatalogue({
        get:async path=>{const snap=await tx.get(db.doc(path));return snap.exists?snap.data():null;},
        set:(path,data)=>tx.set(db.doc(path),data)
      },paper,new Date().toISOString()),{maxAttempts:4});
      updated+=result.updated?1:0;
      needsReview+=result.classificationStatus==='needs_review'?1:0;
    }catch(error){
      failures++;if(failuresSample.length<8)failuresSample.push({paperId:doc.id,message:String(error.message||error).slice(0,120)});
    }
    processed++;handled++;cursor=doc.id;
  }
  done=page.size<Math.min(limit,maxPerRun-handled+page.size);
  await stateRef.set({schemaVersion:catalogueSchemaVersion,status:done&&failures===0?'complete':done?'partial':'in_progress',
    completed:done&&failures===0,cursor,processed,updated,needsReview,failures,startedAt:old.startedAt||started,
    checkedAt:new Date().toISOString(),lastRunCommit:process.env.GITHUB_SHA||null});
  if(done||page.empty)break;
}
console.log(JSON.stringify({catalogueBackfill:done?'finished':'checkpointed',cursor,processed,updated,needsReview,failures,failuresSample}));
if(failures)throw Error('Catalogue backfill has '+failures+' unresolved record(s). Source papers unchanged.');
if(!done)throw Error('Catalogue backfill paused after its bounded page limit; invoke the release again to resume.');
