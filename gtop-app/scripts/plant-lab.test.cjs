const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtop-plants-'));
require('esbuild').buildSync({entryPoints:['plant-lesson','plant-attempt'].map(n=>path.join(__dirname,'../src/app/pages/learning-lab/'+n+'.ts')),bundle:true,platform:'node',format:'cjs',outdir:dir});
const lesson = require(path.join(dir,'plant-lesson.js'));
const state = require(path.join(dir,'plant-attempt.js'));
const answers = items => Object.fromEntries(items.map(q=>[q.id,q.answer]));
const start = () => state.newAttempt('one',answers(lesson.baseline),1);
const finish = () => lesson.missions.reduce((a,m)=>state.changeAttempt(state.changeAttempt(a,{kind:'prediction',mission:m.id,answer:m.answer},2),{kind:'experiment',mission:m.id},3),start());
process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));
test('pollination separates destination, compatibility, and self/cross routes',()=>{
 for(const source of ['same-flower','same-plant','other-plant','other-species']) assert.equal(lesson.pollinate(source,'petal').accepted,false);
 assert.equal(lesson.pollinate('other-species','stigma').accepted,false);
 assert.equal(lesson.pollinate('same-plant','stigma').label,'Self-pollination');
 assert.equal(lesson.pollinate('other-plant','stigma').label,'Cross-pollination');
 assert.equal(lesson.pollinate('same-flower','stigma').accepted,true);
});
test('fertilisation remains separate from arrival and finishes at gamete fusion',()=>{
 assert.deepEqual([0,24,25,64,65,99,100].map(lesson.fertilisationStep),[0,0,1,1,2,2,3]);
 assert.match(lesson.journey[3].text,/male gamete fuses with the egg/);
});
test('all five explorations and confidence are required before assessment',()=>{
 assert.throws(()=>state.changeAttempt(start(),{kind:'experiment',mission:'unknown'},2));
 assert.throws(()=>state.changeAttempt(start(),{kind:'assessment',answers:answers(lesson.questions),confidence:3},2));
 assert.throws(()=>state.changeAttempt(finish(),{kind:'assessment',answers:answers(lesson.questions),confidence:0},4));
 const a=state.changeAttempt(finish(),{kind:'assessment',answers:answers(lesson.questions),confidence:3},4);
 assert.equal(a.phase,'checked');assert.equal(lesson.score(a.answers),5);
});
test('first predictions and checked answers survive repeated submissions',()=>{
 let a=state.changeAttempt(start(),{kind:'prediction',mission:'anatomy',answer:0},2);
 a=state.changeAttempt(a,{kind:'prediction',mission:'anatomy',answer:1},3);
 assert.equal(a.predictions.anatomy,0);
 const checked=state.changeAttempt(finish(),{kind:'assessment',answers:answers(lesson.questions),confidence:3},4);
 assert.deepEqual(state.changeAttempt(checked,{kind:'assessment',answers:{},confidence:1},5),checked);
 assert.throws(()=>state.changeAttempt(start(),{kind:'prediction',mission:'anatomy',answer:99},2));
});
test('feedback is bounded, retained per lesson, and malformed history is ignored',()=>{
 const checked=state.changeAttempt(finish(),{kind:'assessment',answers:answers(lesson.questions),confidence:3},4);
 assert.throws(()=>state.changeAttempt(checked,{kind:'feedback',rating:5,feedback:'x'.repeat(801),friction:''},5));
 const a=state.changeAttempt(checked,{kind:'feedback',rating:4,feedback:'Clear cutaway',friction:''},5);
 assert.equal(state.readHistory({lessonId:'plant-reproduction',attempts:[a]})[0].feedback,'Clear cutaway');
 assert.equal(state.readHistory({lessonId:'current-lab',attempts:[a]}).length,0);
 assert.equal(state.readHistory({lessonId:'plant-reproduction',attempts:[{...a,experiments:[]}]}).length,0);
 let history=[];for(let i=0;i<8;i++) history=state.appendAttempt(history,{...a,id:String(i)});
 assert.deepEqual(history.map(a=>a.id),['7','6','5','4','3']);
});

test('new visits start immediately, old visits remain readable, and fieldwork survives resume',()=>{
 const a=state.newAttempt('new',{},1); assert.deepEqual(a.baseline,{});
 let f=state.freshFieldwork(); f.opened=true; f.inspected=['anther']; f.pollenTrials=[{source:'other-plant',landing:'stigma'}];
 const b=state.changeAttempt(a,{kind:'fieldwork',fieldwork:f},2); f.inspected.push('ovary');
 assert.deepEqual(b.fieldwork.inspected,['anther']);
 assert.deepEqual(state.readHistory({lessonId:'plant-reproduction',attempts:[b]})[0].fieldwork,b.fieldwork);
 const old={...start(),version:'plant-reproduction-1.0'}; delete old.fieldwork;
 assert.equal(state.readHistory({lessonId:'plant-reproduction',attempts:[old]}).length,1);
 assert.throws(()=>state.changeAttempt(b,{kind:'fieldwork',fieldwork:{...b.fieldwork,journeyStage:99}},3));
});
