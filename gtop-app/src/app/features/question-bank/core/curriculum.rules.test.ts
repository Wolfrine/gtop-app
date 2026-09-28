import {readFileSync} from 'node:fs';
import {assertFails,assertSucceeds,initializeTestEnvironment,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
import {beforeAll,afterAll,describe,it} from 'vitest';

describe('curriculum publication permissions',()=>{
 let env:RulesTestEnvironment;
 beforeAll(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-curriculum',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync(process.env['GTOP_RULES_FILE']||'firestore.rules','utf8')}});
  await env.withSecurityRulesDisabled(async context=>{
   await setDoc(doc(context.firestore(),'users/admin'),{role:'admin'});
   await setDoc(doc(context.firestore(),'users/learner'),{role:'user'});
  });
 });
 afterAll(async()=>env?.cleanup());
 it('keeps draft curricula and paper requests private',async()=>{
  const admin=env.authenticatedContext('admin').firestore();
  await assertSucceeds(setDoc(doc(admin,'curriculumSubjects/scope'),{id:'scope',revision:1,academicYear:'2026-27'}));
  await assertSucceeds(setDoc(doc(admin,'paperRequests/request'),{source:'admin-question-paper-generator',status:'awaiting-syllabus'}));
  for(const db of [env.authenticatedContext('learner').firestore(),env.unauthenticatedContext().firestore()]){
   for(const path of ['curriculumSubjects/scope','paperRequests/request']){
    await assertFails(getDoc(doc(db,path)));await assertFails(setDoc(doc(db,path),{status:'approved'}));
   }
  }
 });
 it('publishes a linked, reviewed snapshot and forbids rewriting its history',async()=>{
  const db=env.authenticatedContext('admin').firestore();
  const version={id:'scope',academicYear:'2026-27',versionId:'v1',reviewStatus:'approved',completeness:'complete',sourceStatus:'official-source',approvedBy:'admin',approvedAt:serverTimestamp(),sources:[{url:'https://example.edu/syllabus'}],chapters:[{title:'Motion'}]};
  const batch=writeBatch(db);
  batch.set(doc(db,'curriculumVersions/v1'),version);
  batch.set(doc(db,'curriculumReleases/scope'),{id:'scope',academicYear:'2026-27',versionId:'v1',approvedBy:'admin',approvedAt:serverTimestamp()});
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(env.authenticatedContext('learner').firestore(),'curriculumVersions/v1')));
  await assertFails(updateDoc(doc(db,'curriculumVersions/v1'),{chapters:[]}));
  await assertFails(deleteDoc(doc(db,'curriculumVersions/v1')));
  await assertFails(setDoc(doc(db,'curriculumReleases/forged'),{id:'forged',academicYear:'2026-27',versionId:'v1',approvedBy:'admin',approvedAt:serverTimestamp()}));
 });
 it('rejects incomplete or impersonated approval',async()=>{
  const db=env.authenticatedContext('admin').firestore();
  await assertFails(setDoc(doc(db,'curriculumVersions/incomplete'),{versionId:'incomplete',reviewStatus:'approved',completeness:'incomplete',sourceStatus:'unverified',approvedBy:'admin',approvedAt:serverTimestamp(),sources:[],chapters:[]}));
  await assertFails(setDoc(doc(env.authenticatedContext('learner').firestore(),'curriculumVersions/forged'),{reviewStatus:'approved',approvedBy:'admin'}));
 });
});
