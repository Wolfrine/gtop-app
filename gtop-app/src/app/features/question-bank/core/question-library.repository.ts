import { Injectable } from '@angular/core';
import { collection, doc, documentId, getDocsFromServer as getDocs, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, where } from '@angular/fire/firestore';
import { currentAcademicYear,curriculumKey } from '../../../services/curriculum.domain';
import { FirebaseClient } from './firebase';
import { FirestoreReadService } from '../../../services/firestore-read.service';
import { map } from 'rxjs';
import { SyllabusItem } from './models';
import { normalizeQuestion, type NormalizedQuestion } from './question-paper.domain';

export interface LibraryQuestion extends NormalizedQuestion { source:'questions'|'devQuestions'; revision:string; }
export interface LibraryEdits { question:string; solutions:string[]; options:string[]; correctIndex:number; questionType:string; marks:number; difficulty:string; referenceUsed:string; }
export function bankRevision(raw:Record<string,unknown>):string {
  return JSON.stringify(['board','standard','subject','chapter','sourceSyllabusId','question','title','options','correctIndex','solutions','questionType','marks','marksPerQuestion','difficulty','reviewStatus','status','updatedAt','reviewedAt'].map(k=>raw[k]??null));
}
export function validateLibraryEdits(edits:LibraryEdits, written:boolean):string {
  if(!edits.question.trim() || edits.question.length>20000) return 'Enter a question of up to 20,000 characters.';
  if(!edits.solutions.length || edits.solutions.some(s=>!s.trim()) || edits.solutions.join('\n').length>50000) return 'Add a complete answer or worked solution.';
  if(!Number.isInteger(edits.marks) || edits.marks<1 || edits.marks>20) return 'Marks must be between 1 and 20.';
  if(!['easy','moderate','hard'].includes(edits.difficulty)) return 'Choose a difficulty.';
  if(written && ['mcq','assertion_reason','statement_based'].includes(edits.questionType)) return 'Choose a written question type.';
  if(!written && (edits.options.length<2 || edits.options.length>10 || edits.options.some(o=>!o.trim() || o.length>3000) || new Set(edits.options.map(o=>o.trim().toLowerCase())).size!==edits.options.length || !Number.isInteger(edits.correctIndex) || edits.correctIndex<0 || edits.correctIndex>=edits.options.length)) return 'Enter distinct options and select the correct answer.';
  return '';
}
export function libraryScopeFilters(scope:SyllabusItem) {
  return [where('board','==',scope.board),where('standard','in',[...new Set([scope.standard,Number(scope.standard)].filter(v=>typeof v==='string'||Number.isFinite(v)))]),where('subject','==',scope.subject),where('chapter','==',scope.chapter)];
}
@Injectable({providedIn:'root'})
export class QuestionLibraryRepository {
  constructor(private readonly firebase:FirebaseClient, private readonly reads:FirestoreReadService){}
  watch(scope:SyllabusItem, source:'questions'|'devQuestions') {
    const size=25;
    return this.reads.watch(query(collection(this.firebase.firestore,source),...libraryScopeFilters(scope),
      ...(source==='devQuestions'?[where('reviewStatus','==','approved-paper-only'),where('paperOnly','==',true)]:[]),
      orderBy(documentId()),limit(size+1))).pipe(map(snap=>({
        items:snap.docs.slice(0,size).map(d=>({...normalizeQuestion(d.id,d.data()),source,revision:bankRevision(d.data())})),
        next:snap.size>size?snap.docs[size-1].id:null,fromCache:snap.metadata.fromCache,changed:snap.docChanges().length>0,
    })));
  }
  async list(scope:SyllabusItem, source:'questions'|'devQuestions', cursor?:string):Promise<{items:LibraryQuestion[];next:string|null}> {
    const snap=await getDocs(query(collection(this.firebase.firestore,source),...libraryScopeFilters(scope),
      ...(source==='devQuestions'?[where('reviewStatus','==','approved-paper-only'),where('paperOnly','==',true)]:[]),
      orderBy(documentId()),...(cursor?[startAfter(cursor)]:[]),limit(26)));
    return {items:snap.docs.slice(0,25).map(d=>({...normalizeQuestion(d.id,d.data()),source,revision:bankRevision(d.data())})),next:snap.size>25?snap.docs[24].id:null};
  }
  async save(scope:SyllabusItem, previous:LibraryQuestion|null, edits:LibraryEdits, actor:string):Promise<void> {
    if(!actor)throw new Error('Sign in as an admin to save.');
    const written=!previous||previous.options.length===0;
    const invalid=validateLibraryEdits(edits,written);if(invalid)throw new Error(invalid);
    const normalized=edits.question.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode([scope.board,scope.standard,scope.subject,scope.chapter,normalized].join('|')));
    const id=previous?.id??'manual-'+Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
    for(const checkSource of ['questions','devQuestions']){
      const duplicates=await getDocs(query(collection(this.firebase.firestore,checkSource),...libraryScopeFilters(scope),where('question','==',edits.question.trim()),limit(3)));
      if(duplicates.docs.some(d=>d.id!==previous?.id && (checkSource==='questions'||['pending-admin-review','approved-paper-only'].includes(d.data()['reviewStatus']))))throw new Error('This question already exists in this chapter or is awaiting review.');
    }
    const source=previous?.source??'devQuestions';
    const ref=doc(this.firebase.firestore,source,id);const syllabusRef=doc(this.firebase.firestore,'syllabus',scope.id);
    await runTransaction(this.firebase.firestore,async tx=>{
      const existing=await tx.get(ref);const syllabus=await tx.get(syllabusRef);
      let curriculum:Record<string,unknown>={};
      if(!previous){
        const year=currentAcademicYear();const release=await tx.get(doc(this.firebase.firestore,'curriculumReleases',curriculumKey({...scope,academicYear:year})));
        const versionId=release.data()?.['versionId'];
        if(versionId){const version=await tx.get(doc(this.firebase.firestore,'curriculumVersions',versionId));const value=version.data();const chapter=value?.['chapters']?.find((c:{title:string})=>c.title===scope.chapter);if(value?.['reviewStatus']==='approved'&&chapter)curriculum={academicYear:year,curriculumVersionId:versionId,assessmentPurpose:chapter.assessment??'both'};}
      }
      if(!syllabus.exists()||['board','standard','subject','chapter'].some(key=>String(syllabus.data()[key])!==String(scope[key as keyof SyllabusItem])))throw new Error('The chapter changed. Refresh before saving.');
      if(previous&&existing.exists()&&['board','standard','subject','chapter'].some(key=>String(existing.data()[key])!==String(scope[key as keyof SyllabusItem])))throw new Error('This question moved to another chapter. Refresh before saving.');
      if(previous && (!existing.exists() || bankRevision(existing.data())!==previous.revision))throw new Error('Another admin changed this question. Refresh and reopen it.');
      if(!previous && existing.exists())throw new Error('This written question already exists.');
      const fields={...edits,question:edits.question.trim(),solutions:edits.solutions.map(s=>s.trim()),options:written?[]:edits.options.map(o=>o.trim()),correctIndex:written?-1:edits.correctIndex,
        updatedAt:serverTimestamp(),updatedBy:actor};
      if(previous){const {referenceUsed,...updated}=fields;tx.update(ref,updated);}
      else tx.set(ref,{...fields,...curriculum,board:scope.board,standard:scope.standard,subject:scope.subject,chapter:scope.chapter,title:edits.question.slice(0,120),sourceSyllabusId:scope.id,
        paperOnly:true,reviewStatus:'approved-paper-only',status:'approved',createdBy:actor,createdAt:serverTimestamp(),reviewedBy:actor,reviewedAt:serverTimestamp(),source:'admin-authored'});
    });
  }
  async archive(scope:SyllabusItem, row:LibraryQuestion, actor:string):Promise<void> {
    if(!actor)throw new Error('Sign in as an admin to archive.');
    const ref=doc(this.firebase.firestore,row.source,row.id);
    await runTransaction(this.firebase.firestore,async tx=>{
      const current=await tx.get(ref);
      const linkedId=current.data()?.['sourceSyllabusId'];
      const scopeRef=doc(this.firebase.firestore,'syllabus',typeof linkedId==='string'&&linkedId&&!linkedId.includes('/')?linkedId:scope.id);
      const syllabus=await tx.get(scopeRef);
      if(syllabus.exists()&&['board','standard','subject','chapter'].some(key=>String(syllabus.data()[key])!==String(scope[key as keyof SyllabusItem])))throw new Error('The linked chapter no longer matches. Refresh before archiving.');
      if(!current.exists() || bankRevision(current.data())!==row.revision)throw new Error('This question changed. Refresh before archiving.');
      tx.set(doc(this.firebase.firestore,'deletedQuestions',row.source+'-'+row.id),{...current.data(),originalCollection:row.source,originalId:row.id,archivedBy:actor,archivedAt:serverTimestamp()});
      if(row.source==='devQuestions')tx.update(ref,{reviewStatus:'archived',status:'archived',updatedAt:serverTimestamp(),updatedBy:actor});
      else {tx.delete(ref);if(syllabus.exists())tx.update(scopeRef,{mcqCount:Math.max(0,Number(syllabus.data()['mcqCount']||0)-1),updatedAt:serverTimestamp()});}
    });
  }
}
