import {initializeApp,applicationDefault,getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {AssistantService} from '../service.mjs';
import {FirestoreStore} from '../store.mjs';
import {papersAdmin} from '../papers-access.mjs';
import {catalogueKey,catalogueMigrationPath} from '../paper-catalogue.mjs';

// Live, read-only release evidence from genuine existing papers (no fixtures).
// Do not log titles, identity keys, question text or student data.
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'gtop-app'});
const db=getFirestore(),store=new FirestoreStore(db);
const marker=(await db.doc(catalogueMigrationPath).get()).data();
if(!marker?.completed)throw Error('Generated-paper catalogue backfill incomplete.');
const facetMigration=(await db.doc('assistantCatalogueMigrations/facetsV1').get()).data();
if(!facetMigration?.completed)throw Error('Curriculum facet backfill incomplete.');
const sample=await db.collection('assistantPapers').orderBy('__name__').limit(30)
  .select('ownerUid','board','standard','subject','sections','createdAt').get();
if(sample.empty)throw Error('No original generated papers available for catalogue verification.');
const indexed=await db.getAll(...sample.docs.map(doc=>db.doc('paperCatalogue/'+doc.id)));
if(indexed.some(doc=>!doc.exists))throw Error('Catalogue projection missing for a sampled original.');
for(let i=0;i<sample.size;i++){
  const source=sample.docs[i].data(),entry=indexed[i].data();
  const found=new Set((source.sections||[]).flatMap(section=>(section.questions||[])
    .map(q=>catalogueKey(q.chapter))).filter(Boolean));
  if([...found].some(key=>!entry.chapterKeys.includes(key)))
    throw Error('A chapter membership does not match its original paper.');
  if(entry.paperId!==sample.docs[i].id||entry.ownerUid!==source.ownerUid)
    throw Error('A derived paper identity does not match its source.');
}
const config=(await db.doc('assistantConfig/pilot').get()).data();
const owners=[...new Set(sample.docs.map(doc=>doc.data().ownerUid).filter(Boolean))];
const profiles=await store.getSelected(owners.map(uid=>'users/'+uid),['role']);
const uid=owners.find((candidate,i)=>papersAdmin(profiles[i],config,candidate));
if(!uid)throw Error('No current administrator in the bounded paper sample.');
const known=sample.docs.find(doc=>doc.data().ownerUid===uid),paper=known.data();
const chapter=(paper.sections||[]).flatMap(section=>section.questions||[]).find(q=>q.chapter)?.chapter;
if(!chapter)throw Error('An existing paper has no tagged chapter for verification.');
let indexQueries=0,indexDocumentsRead=0;
const baseList=store.list.bind(store);
store.list=async(...args)=>{const rows=await baseList(...args);if(args[0]==='paperCatalogue'){
  indexQueries++;indexDocumentsRead+=rows.length;
}return rows;};
const service=new AssistantService(store);
const options=await service.adminLibraryFacets(uid,{filters:{ownerScope:'mine'}});
if(options.level!=='board'||!options.options.some(row=>row.key===catalogueKey(paper.board)))
  throw Error('An invited teacher cannot browse the board of an existing owned paper.');
const start=Date.now();
const result=await service.adminLibrarySearch(uid,{kind:'papers',
  filters:{boardKey:catalogueKey(paper.board),standardKey:catalogueKey(paper.standard),
    subjectKey:catalogueKey(paper.subject),chapterKey:catalogueKey(chapter),ownerScope:'mine'},
  latestRevisionOnly:false,pageSize:50,sort:'recent'});
const latencyMs=Date.now()-start;
if(!result.items.some(p=>p.paperId===known.id))throw Error('Known authorized paper absent from chapter query.');
if(result.items.some(p=>p.ownerUid!==uid))throw Error('Owner-scoped search leaked another teacher.');
const accessible=await service.adminLibrarySearch(uid,{kind:'papers',filters:{ownerScope:'accessible'},
  latestRevisionOnly:false,pageSize:50,sort:'recent'});
const restricted=new Map(indexed.filter(doc=>doc.exists).map(doc=>[doc.data().paperId,doc.data()]));
if(accessible.items.some(item=>restricted.get(item.paperId)?.nativePrivate&&item.ownerUid!==uid))
  throw Error('A private paper was returned to another owner.');
console.log(JSON.stringify({paperCatalogueVerified:true,originalsCompared:sample.size,
  indexedSearchResults:result.items.length,latencyMs,indexQueries,indexDocumentsRead,
  accessibleResults:accessible.items.length,facetBoardOptions:options.options.length,
  facetBackfillComplete:facetMigration.completed,coverage:result.indexCoverage}));
