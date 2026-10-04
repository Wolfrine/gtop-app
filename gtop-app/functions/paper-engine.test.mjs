import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePaper,validateBankSnapshot,renderPaper,hash,imageType} from './paper-engine.mjs';

const question=(overrides={})=>({questionId:'q1',sourceCollection:'questions',origin:'bank',board:'ICSE',standard:'9',subject:'Biology',chapter:'Cells',questionType:'mcq',difficulty:'easy',question:'Which organelle releases energy?',marks:1,options:['Mitochondrion','Nucleus'],correctIndex:0,solutions:['Cellular respiration releases energy in mitochondria.'],...overrides});
const paper=(questions=[question()])=>({title:'Cell revision',board:'ICSE',standard:'9',subjects:['Biology'],chapters:['Cells'],marks:questions.reduce((sum,q)=>sum+q.marks,0),durationMinutes:30,sections:[{title:'Section A',requiredCount:questions.length,questions}]});

test('reuse counts describe this run even when a source was generated earlier',()=>{
  const result=validatePaper(paper([question({sourceCollection:'paperQuestions'}),question({questionId:'q2',sourceCollection:'paperQuestions',origin:'generated'})]));
  assert.equal(result.reusedQuestionCount,1);assert.equal(result.generatedQuestionCount,1);
});
test('incomplete totals, answers, sections and repeated questions cannot publish',()=>{
  for(const candidate of [{...paper(),marks:4},paper([question({solutions:[]})]),paper([question(),question()]),{...paper(),sections:[{title:'A',requiredCount:2,questions:[question()]}]},paper([question({correctIndex:2})]),paper([question({questionId:'escape/path'})])])assert.throws(()=>validatePaper(candidate));
});
test('required images are real Firebase assets with descriptions',()=>{
  assert.throws(()=>validatePaper(paper([question({diagramRequired:true})])),/diagram/);
  assert.throws(()=>validatePaper(paper([question({assets:[{url:'https://example.com/x.png',alt:'Cell'}]})])),/Firebase/);
  assert.doesNotThrow(()=>validatePaper(paper([question({diagramRequired:true,assets:[{url:'https://firebasestorage.googleapis.com/v0/b/gtop/o/cell.png?alt=media',alt:'A cell'}]})])));
});
test('reuse preserves content, answer, marks, type, difficulty and illustrations',()=>{
  const original=question();assert.doesNotThrow(()=>validateBankSnapshot(original,original));
  for(const changes of [{marks:2},{correctIndex:1},{question:'Different stem'},{questionType:'short_answer'},{difficulty:'hard'},{solutions:['Another answer']},{assets:[{url:'https://storage.googleapis.com/a/cell.png',alt:'Cell'}]},{blocks:[{type:'text',text:'Altered passage'}]}])assert.throws(()=>validateBankSnapshot({...original,...changes},original));
  assert.throws(()=>validateBankSnapshot(original,{...original,flagCount:1}));
  assert.throws(()=>validateBankSnapshot({...original,sourceCollection:'devQuestions'},{...original,reviewStatus:'pending-admin-review'}));
  assert.doesNotThrow(()=>validateBankSnapshot({...original,sourceCollection:'paperQuestions'},{...original,status:'ready'}));
});
test('legacy aliases and answer strings reuse without changing their meaning',()=>{
  const original=question({questionType:undefined,type:'single_choice',difficulty:undefined,level:'basic',solutions:undefined,answer:'Respiration.'});
  assert.doesNotThrow(()=>validateBankSnapshot(question({solutions:['Respiration.']}),original));
});
test('student HTML omits answers and renders safe text, tables and maths',()=>{
  const q=question({question:'Find $x^2$ <script>alert(1)</script>',solutions:['CONFIDENTIAL ANSWER'],blocks:[{type:'table',headers:['A','B'],rows:[['<img src=x>','2']]}]});
  const student=renderPaper(paper([q]));const answers=renderPaper(paper([q]),true);
  assert(!student.includes('CONFIDENTIAL ANSWER'));assert(answers.includes('CONFIDENTIAL ANSWER'));
  assert(!student.includes('<script>'));assert(student.includes('&lt;script&gt;'));assert(student.includes('class="katex"'));assert(student.includes('<table'));assert(student.includes('@page{size:A4'));
  assert.throws(()=>renderPaper(paper([question({question:'$\\badunknowncommand$'})])));
});
test('asset checksums hash the actual bytes and image type excludes active SVG',()=>{
  assert.equal(hash(Buffer.from('test')),hash('test'));assert.deepEqual(imageType(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0])),{mime:'image/png',ext:'png'});
  assert.throws(()=>imageType(Buffer.from('<svg onload="alert(1)"></svg>')));
});
