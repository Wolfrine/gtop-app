import {initializeApp,applicationDefault,getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {paperCatalogueFacetEntries} from '../paper-library-facets.mjs';

// Explicit, bounded, idempotent migration of DERIVED paper metadata only.
// Never scheduled, no paper/answer/scan rewriting.
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'gtop-app'});
const db=getFirestore();
const stateRef=db.doc('assistantCatalogueMigrations/facetsV1');
const state=(await stateRef.get()).data()||{};
if(state.completed){console.log(JSON.stringify({paperFacets:'already_complete',processed:state.processed||0}));process.exit(0);}
const maxRun=240,pageSize=40;
let processed=state.processed||0,optionsWritten=state.optionsWritten||0,cursor=state.cursor||null,handled=0,finished=false;
while(handled<maxRun){
  let query=db.collection('paperCatalogue').orderBy('__name__').limit(Math.min(pageSize,maxRun-handled));
  if(cursor)query=query.startAfter(cursor);
  const page=await query.get();
  if(page.empty){finished=true;break;}
  let writes=[];
  for(const doc of page.docs){
    const entries=paperCatalogueFacetEntries({...doc.data(),paperId:doc.id});
    writes.push(...entries);
    if(writes.length>=350){
      const batch=db.batch();
      for(const item of writes)batch.set(db.doc(item.path),item.fields);
      await batch.commit();optionsWritten+=writes.length;writes=[];
    }
    processed++;handled++;cursor=doc.id;
  }
  if(writes.length){
    const batch=db.batch();
    for(const item of writes)batch.set(db.doc(item.path),item.fields);
    await batch.commit();optionsWritten+=writes.length;
  }
  if(page.size<pageSize){finished=true;}
  await stateRef.set({schemaVersion:1,completed:finished,processed,optionsWritten,cursor,
    updatedAt:new Date().toISOString(),source:'paperCatalogue',runCommit:process.env.GITHUB_SHA||null});
  if(finished)break;
}
console.log(JSON.stringify({paperFacets:finished?'complete':'checkpointed',processed,optionsWritten,completed:finished}));
if(!finished)throw Error('Facet migration checkpointed after bounded page limit; an explicit release re-run is required.');
