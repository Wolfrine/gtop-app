import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,curriculum,validateRequirements,validatePaper,validateRevision,renderPaper,hash,paperContent} from './index.mjs';
import {paperSchema,assertSchema} from './schemas.mjs';

// Structural fixtures only; no claim of academic content or real bank provenance.
export function fixture(){return {...defaults,title:'Structural test — 80 marks',instructions:['Attempt all questions; OR alternatives carry the same marks.'],sections:[{title:'Chemistry',instructions:'',questions:curriculum.chapters.map((c,i)=>({number:i+1,chapter:c.title,type:'long_answer',marks:8,question:`Fixture question ${i+1}: evaluate $\\ce{H2 + Cl2 -> 2HCl}$.`,options:[],correctIndex:null,answer:'PRIVATE ANSWER '+i,markingPoints:['PRIVATE MARKING '+i],alternative:i===0?{question:'Alternative fixture one',options:[],correctIndex:null,answer:'PRIVATE ALTERNATIVE',markingPoints:['PRIVATE ALT MARKING']}:null}))}],sourceReferences:[{id:curriculum.id,url:curriculum.url,title:curriculum.title}]};}
test('OR alternatives do not inflate attempted marks and all chapters are checked',()=>{
  const p=fixture();assertSchema(Object.fromEntries(Object.keys(paperSchema.properties).map(k=>[k,p[k]])),paperSchema);const v=validatePaper(p,defaults);assert.equal(v.attemptedMarks,80);assert.equal(v.internalChoices,1);assert.equal(v.chaptersCovered.length,10);
  const wrong=structuredClone(p);wrong.sections[0].questions[0].marks=7;assert.throws(()=>validatePaper(wrong,defaults),/total/);
  wrong.sections[0].questions[0].marks=8;wrong.sections[0].questions[1].chapter=wrong.sections[0].questions[0].chapter;assert.throws(()=>validatePaper(wrong,defaults),/all 10/);
});
test('student artifact contains no answer fields and hostile markup is escaped',()=>{
  const p=fixture();p.title='<script>alert(1)</script>';const student=renderPaper(p),answers=renderPaper(p,true);
  assert(!student.includes('PRIVATE ANSWER'));assert(!student.includes('PRIVATE MARKING'));assert(!student.includes('PRIVATE ALTERNATIVE'));assert(answers.includes('PRIVATE ANSWER'));assert(!student.includes('<script>'));assert(student.includes('&lt;script&gt;'));assert(student.includes('data:font/woff2;base64,'));assert(student.length<950000);
});
test('final classroom copies omit provenance and workflow notes but retain examination rules and immutable content',()=>{
  const p=fixture();p.instructions=['Attempt all questions. This paper follows the GTOP syllabus.','This is not an official paper. Teacher review is required.','Show working; use a ruler where needed.'];p.sections[0].instructions='Answer either alternative. Curriculum coverage is unverified.';
  const before=hash(p);for(const answers of [false,true]){const html=renderPaper(p,answers);assert(!/<p class="(?:notice|source)">/.test(html));assert(!/GTOP syllabus|not an official|Teacher review|unverified/.test(html));assert.match(html,/Attempt all questions\./);assert.match(html,/Show working; use a ruler/);assert.match(html,/Answer either alternative\./);assert.match(html,/@page\{size:A4/);}assert.equal(hash(p),before);
});
test('revision changes only the requested question and preserves previous content',()=>{
  const base=fixture(),before=hash(paperContent(base)),p=structuredClone(base);p.sections[0].questions[5].question='Updated fixture Q6';assert(validateRevision(base,p,6).passed);assert.equal(hash(paperContent(base)),before);
  p.sections[0].questions[4].answer='Changed another answer';assert.throws(()=>validateRevision(base,p,6),/untargeted/);
});
test('requirements and incomplete artifacts fail closed without implicit bank fallback',()=>{
  assert.throws(()=>validateRequirements({...defaults,sourcePolicy:'bank_only'}),/Bank-only/);assert.throws(()=>validateRequirements({...defaults,standard:'4'}),/Classes 5/);
  const p=fixture();p.sections[0].questions[0].markingPoints=[];assert.throws(()=>validatePaper(p),/marking/);p.sections[0].questions[0].markingPoints=['valid'];p.sourceReferences[0].url='https://example.com';assert.throws(()=>validatePaper(p),/source/);
});
test('whole-paper changes may change totals/choices while targeted changes cannot alter sections',()=>{
  const base=fixture(),p=structuredClone(base);p.marks=60;for(const q of p.sections[0].questions){q.marks=6;q.alternative=null;}assert(validateRevision(base,p,null).passed);assert.throws(()=>validateRevision(base,p,6),/marks|choices/);
  const changed=structuredClone(base);changed.sections[0].title='Changed';assert.throws(()=>validateRevision(base,changed,6),/section metadata/);
});
test('canonical nested shapes and unsupported selective attempt rules fail before publication',()=>{
  const p=fixture();p.sections[0].instructions={bad:'object'};assert.throws(()=>validatePaper(p),/invalid type/);p.sections[0].instructions='Attempt any one question';assert.throws(()=>validatePaper(p),/selective/);
});
