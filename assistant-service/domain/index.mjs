import {examInstruction,examTitle} from './exam-copy.mjs';
import {createHash} from 'node:crypto';
import katex from 'katex';
import 'katex/contrib/mhchem';
import {readFileSync} from 'node:fs';
import {curriculum,defaults} from './curriculum.mjs';
import {assertSchema,paperSchema} from './schemas.mjs';
import {validateScope,scopeKeys,sameScope} from './catalogue.mjs';
import {selectedCurriculum as selectPaperCurriculum} from './task-brief.mjs';
export {curriculum,defaults};
export {paperSchema,questionSchema,revisionSchema,reviewSchema,proposalSchema,assertSchema} from './schemas.mjs';

export const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
function require(test,message){if(!test)throw Error(message);}
const cleanText=(v,max=12000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function validateRequirements(input){
  require(input&&typeof input==='object'&&!Array.isArray(input),'Paper requirements are missing.');
  const allowed=new Set([...Object.keys(defaults),...scopeKeys,'selectedChapters','format']);require(Object.keys(input).every(k=>allowed.has(k)),'Unknown paper requirement.');
  const r={...defaults,...input};
  Object.assign(r,validateScope(r));require(['full_syllabus','selected_chapters'].includes(r.scope),'Choose full syllabus or selected chapters.');
  if(r.scope==='selected_chapters')require(Array.isArray(r.selectedChapters)&&r.selectedChapters.length>0&&r.selectedChapters.length<=30&&r.selectedChapters.every(c=>cleanText(c,200)),'Selected chapter names are required.');
  else require(!r.selectedChapters?.length,'Full-syllabus papers cannot retain a chapter restriction.');
  require(Number.isInteger(r.marks)&&r.marks>=10&&r.marks<=100,'Choose a whole mark total between 10 and 100.');
  require(Number.isInteger(r.durationMinutes)&&r.durationMinutes>=15&&r.durationMinutes<=360,'Duration must be 15–360 minutes.');
  require(['English','Hindi'].includes(r.questionLanguage)&&['English','Hindi'].includes(r.answerLanguage),'Paper and answer languages must be English or Hindi.');
  require(r.sourcePolicy==='original','Bank-only cannot run: this pilot has no verified live-bank connector.');
  require(typeof r.internalChoices==='boolean','Internal-choice setting must be explicit.');require(r.format===undefined||['practice','board'].includes(r.format),'Unknown paper format.');return r;
}
export function validatePaper(p,requirements=null,selectedCurriculum=null){
  require(p&&typeof p==='object','Missing paper.');
  assertSchema(paperContent(p),paperSchema);
  const r=validateRequirements(requirements??Object.fromEntries(Object.keys(defaults).map(k=>[k,k in p?p[k]:defaults[k]])));
  const pinned=selectPaperCurriculum(selectedCurriculum||p.curriculumSnapshot||curriculum,r);
  require(sameScope(pinned,r),'Selected curriculum programme, level, code, cohort or edition differs from the verified requirements.');
  for(const k of ['board','standard','subject','academicYear'])require(pinned[k]===r[k],`Selected curriculum ${k} differs from the paper scope.`);
  for(const k of ['board','standard','subject','academicYear','scope','marks','durationMinutes','questionLanguage','answerLanguage'])require(p[k]===r[k],`Paper ${k} differs from verified requirements.`);
  require(cleanText(p.title,200)&&Array.isArray(p.sections)&&p.sections.length>0&&p.sections.length<=12,'Paper title/sections are incomplete.');
  require(Array.isArray(p.instructions)&&p.instructions.length>0&&p.instructions.every(x=>cleanText(x,2000)),'Paper instructions missing.');
  const attemptInstructions=[...p.instructions,...p.sections.map(s=>s.instructions)].join('\n').replace(/(?:attempt|answer|choose|select)\s+any\s+one\s+(?:of the (?:two )?)?(?:OR )?(?:alternative|version)s?/gi,'attempt either alternative');
  const choiceRule=/attempt any|answer any|choose any|select any|out of|(?:attempt|answer|solve)\s+(?:only\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:questions|of)|किन्हीं|किसी\s*(?:एक|दो|तीन)\s*प्रश्न/i;
  require(!choiceRule.test(attemptInstructions)||p.sections.some(s=>Number.isInteger(s.attemptCount)&&s.attemptCount<s.questions.length),'Selective attempts require a controller-validated section attemptCount.');
  if(r.format==='board'){
    const pattern=pinned.paperPattern;require(pattern&&pattern.academicYear===r.academicYear&&pattern.marks===r.marks,'Verified applicable board pattern is unavailable for these marks/year.');
    require(p.durationMinutes===pattern.durationMinutes,'Paper duration differs from the verified board blueprint.');
    require(pattern.sections.length===p.sections.length,'Paper differs from verified board sections.');
    for(let i=0;i<p.sections.length;i++){const s=p.sections[i],expected=pattern.sections[i];require(s.questions.length===expected.questionCount&&(s.attemptCount??s.questions.length)===expected.attemptCount,'Paper differs from verified section attempt rules.');}
  }
  const questions=p.sections.flatMap(s=>{require(cleanText(s.title,200)&&Array.isArray(s.questions)&&s.questions.length>0,'Empty paper section.');return s.questions;});
  require(questions.length>=1&&questions.length<=100,'Paper must contain 1–100 numbered questions or question groups.');
  const chapterSet=new Set(pinned.chapters.map(c=>c.title)),seen=new Set(),stems=new Set();let total=0,choices=0;
  for(let i=0;i<p.sections.length;i++){const s=p.sections[i],n=s.attemptCount??s.questions.length;require(Number.isInteger(n)&&n>=1&&n<=s.questions.length,'Invalid section attempt count.');require(n===s.questions.length||new Set(s.questions.map(q=>q.marks)).size===1,'Optional section questions must have equal marks so every permitted path has the same total.');const marks=n===s.questions.length?s.questions.reduce((sum,q)=>sum+q.marks,0):n*s.questions[0].marks;total+=marks;if(r.format==='board')require(marks===pinned.paperPattern.sections[i].attemptedMarks,'Section marks differ from the verified board blueprint.');}
  const checkVariant=(v,q,where)=>{
    require(cleanText(v.question)&&cleanText(v.answer)&&Array.isArray(v.markingPoints)&&v.markingPoints.length>0&&v.markingPoints.every(x=>cleanText(x,4000)),`${where} needs a question, worked answer and marking points.`);
    require(!/https?:\/\//i.test(v.question),'Questions may not embed remote assets or links.');
    require(Array.isArray(v.options)&&v.options.every(o=>cleanText(o,3000)),`${where} has invalid options.`);
    if(['mcq','assertion_reason'].includes(q.type))require(v.options.length===4&&Number.isInteger(v.correctIndex)&&v.correctIndex>=0&&v.correctIndex<4,`${where} needs four options and a valid correct index.`);
    else require(v.options.length===0&&v.correctIndex===null,`${where} must not contain objective answer metadata.`);
    const normalized=v.question.toLowerCase().replace(/\s+/g,' ').trim();require(!stems.has(normalized),'Duplicate question stem.');stems.add(normalized);
  };
  for(let i=0;i<questions.length;i++){
    const q=questions[i];require(q.number===i+1,'Question numbering must be continuous.');
    require(chapterSet.has(q.chapter),'Question chapter is not in the pinned syllabus.');seen.add(q.chapter);
    require(['mcq','assertion_reason','short_answer','long_answer','numerical','case_based'].includes(q.type),'Unsupported question type.');
    require(Number.isInteger(q.marks)&&q.marks>=1&&q.marks<=20,'Invalid question marks.');
    checkVariant(q,q,'Question '+q.number);
    if(q.alternative!==null&&q.alternative!==undefined){require(r.internalChoices,'Unexpected internal choice.');checkVariant(q.alternative,q,'Question '+q.number+' alternative');choices++;}
  }
  require(total===r.marks,`Attempted marks total ${total}; ${r.marks} requested. OR alternatives do not add marks.`);
  require(seen.size===chapterSet.size,`Full selected syllabus must cover all ${chapterSet.size} chapters.`);
  if(r.internalChoices)require(choices>0,'Requested internal choices are missing.');
  require(Array.isArray(p.sourceReferences)&&p.sourceReferences.some(s=>s.id===pinned.id&&s.url===pinned.url),'Pinned curriculum source is missing.');
  require(p.sourceReferences.every(s=>s.id===pinned.id&&s.url===pinned.url&&cleanText(s.title,300)),'Unverified source reference.');
  // Invalid maths must fail before delivery rather than printing raw TeX.
  renderPaper({...p,curriculumSnapshot:pinned},false);renderPaper({...p,curriculumSnapshot:pinned},true);
  return {passed:true,questionCount:questions.length,attemptedMarks:total,attemptPolicy:p.sections.some(s=>s.attemptCount&&s.attemptCount<s.questions.length)?'section_choice_with_whole_question_or':'all_required_with_whole_question_or',chaptersCovered:[...seen],internalChoices:choices,sourceId:pinned.id,paperContentSha256:hash(paperContent(p)),academicApproval:false};
}
export function paperContent(p){return Object.fromEntries(['title','board','standard','subject','academicYear','scope','marks','durationMinutes','questionLanguage','answerLanguage','instructions','sections','sourceReferences'].map(k=>[k,p[k]]));}
export function validateRevision(base,candidate,targetQuestionNumber=null,selectedCurriculum=null){
  const pinned=selectedCurriculum||base.curriculumSnapshot;
  const variants={...Object.fromEntries(scopeKeys.slice(4).map(k=>[k,base.requirements?.[k]||pinned?.[k]||''])),...(base.requirements?.format?{format:base.requirements.format}:{})};
  const requirements={...variants,...(base.requirements?.selectedChapters?{selectedChapters:base.requirements.selectedChapters}:{}),...Object.fromEntries(Object.keys(defaults).map(k=>[k,k in base?base[k]:defaults[k]]))};
  requirements.internalChoices=base.sections.some(s=>s.questions.some(q=>q.alternative));
  const candidateRequirements={...variants,...(requirements.selectedChapters?{selectedChapters:requirements.selectedChapters}:{}),...Object.fromEntries(Object.keys(defaults).map(k=>[k,k in candidate?candidate[k]:defaults[k]]))};
  candidateRequirements.internalChoices=candidate.sections.some(s=>s.questions.some(q=>q.alternative));
  validatePaper(candidate,targetQuestionNumber==null?candidateRequirements:requirements,selectedCurriculum||base.curriculumSnapshot||null);
  if(targetQuestionNumber!==null&&targetQuestionNumber!==undefined){
    require(Number.isInteger(targetQuestionNumber),'Target question number is invalid.');
    const before=base.sections.flatMap(s=>s.questions),after=candidate.sections.flatMap(s=>s.questions);
    require(before.some(q=>q.number===targetQuestionNumber),'Target question does not exist.');
    require(before.length===after.length,'A single-question revision cannot change question count.');
    for(let i=0;i<before.length;i++){
      if(before[i].number!==targetQuestionNumber)require(stable(before[i])===stable(after[i]),`Revision changed untargeted question ${before[i].number}.`);
      else for(const k of ['number','marks','chapter','type'])require(before[i][k]===after[i][k],`Revision changed locked target ${k}.`);
    }
    require(base.sections.length===candidate.sections.length,'Revision changed paper sections.');
    for(let i=0;i<base.sections.length;i++)require(stable({...base.sections[i],questions:base.sections[i].questions.map(q=>q.number)})===stable({...candidate.sections[i],questions:candidate.sections[i].questions.map(q=>q.number)}),'Revision changed section metadata or question placement.');
    require(stable(paperContent({...candidate,sections:base.sections}))===stable(paperContent(base)),'Revision changed untargeted paper metadata.');
  }
  return {passed:true,targetQuestionNumber:targetQuestionNumber??null,baseContentSha256:hash(paperContent(base)),revisedContentSha256:hash(paperContent(candidate))};
}
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const mathPresentationCss='/* GTOP math presentation v1: only formulae scroll on narrow screens. */ @media screen{.katex{display:inline-block;box-sizing:border-box;max-width:100%;padding-inline-end:.35em;overflow-x:auto;overflow-y:hidden;vertical-align:middle}.katex-display{max-width:100%;overflow-x:auto;overflow-y:hidden}}@media print{.katex{display:inline;max-width:none;padding-inline-end:0;overflow:visible}.katex-display{max-width:none;overflow:visible}}';
function formatted(value){
  return String(value??'').split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map(part=>{
    if(part.startsWith('$')&&part.endsWith('$')){const display=part.startsWith('$$');return katex.renderToString(part.slice(display?2:1,display?-2:-1),{displayMode:display,throwOnError:true,trust:false,strict:'error',maxExpand:200}).replace('<span class="katex">','<span class="katex" tabindex="0" title="Scroll the formula horizontally if needed">');}
    return escape(part).replace(/\n/g,'<br>');
  }).join('');
}
export function renderPaper(p,answerKey=false){
  const hasChoices=p.sections.some(s=>Number.isInteger(s.attemptCount)&&s.attemptCount<s.questions.length);
  const cleanInstruction=t=>{const clean=examInstruction(t);return hasChoices&&/(?:attempt|answer|choose|select).{0,25}(?:any|all|compulsory|questions)|किन्हीं|सभी.{0,15}प्रश्न/i.test(clean||'')?null:clean;};
  const sectionNote=s=>{const own=cleanInstruction(s.instructions),n=s.attemptCount??s.questions.length;const rule=!hasChoices?'':p.questionLanguage==='Hindi'?(n<s.questions.length?`इस खंड के ${s.questions.length} प्रश्नों में से किन्हीं ${n} प्रश्नों के उत्तर दें।`:'इस खंड के सभी प्रश्नों के उत्तर दें।'):(n<s.questions.length?`Answer any ${n} of the ${s.questions.length} questions in this section.`:'Answer all questions in this section.');return [own,rule].filter(Boolean).join(' ');};
  const classLabel='Class '+escape(p.standard)+' · '+escape(p.subject)+' · '+escape(p.board);
  const optionList=v=>v.options?.length?'<ol class="options" type="a">'+v.options.map(o=>'<li>'+formatted(o)+'</li>').join('')+'</ol>':'';
  const solution=v=>answerKey?'<div class="answer"><strong>Worked answer</strong><p>'+formatted(v.answer)+'</p><ol class="marking">'+v.markingPoints.map(m=>'<li>'+formatted(m)+'</li>').join('')+'</ol>'+(v.correctIndex!==null?'<p class="correct">Correct option: '+String.fromCharCode(65+v.correctIndex)+'</p>':'')+'</div>':'';
  const sections=p.sections.map(s=>'<section><h2>'+escape(s.title)+'</h2>'+(sectionNote(s)?'<p class="section-note">'+formatted(sectionNote(s))+'</p>':'')+s.questions.map(q=>'<article class="question"><div class="question-line"><b class="number">'+q.number+'.</b><div class="stem">'+formatted(q.question)+optionList(q)+solution(q)+(q.alternative?'<div class="alternative"><b class="or">OR</b>'+formatted(q.alternative.question)+optionList(q.alternative)+solution(q.alternative)+'</div>':'')+'</div><b class="marks">['+q.marks+']</b></div></article>').join('')+'</section>').join('');
  let katexCss=readFileSync(new URL('../node_modules/katex/dist/katex.min.css',import.meta.url),'utf8');
  // Embedded woff2 makes private Blob/printed artifacts independent of another origin.
  katexCss=katexCss.replace(/src:url\((fonts\/[^)]+\.woff2)\) format\("woff2"\)[^;]*;/g,(_match,font)=>'src:url(data:font/woff2;base64,'+readFileSync(new URL('../node_modules/katex/dist/'+font,import.meta.url)).toString('base64')+') format("woff2");');
  const lang=(answerKey?p.answerLanguage:p.questionLanguage)==='Hindi'?'hi':'en';
  const css='*{box-sizing:border-box}html{background:#fff;color:#172c39;font:11.5pt/1.55 Georgia,"Noto Sans Devanagari",serif}body{max-width:210mm;margin:0 auto;padding:15mm 16mm}header{text-align:center;border-bottom:1.5pt solid #294254;padding-bottom:11pt}.brand{font:700 11pt Arial,sans-serif;letter-spacing:1.5pt}h1{font:700 17pt/1.3 Arial,sans-serif;margin:6pt 0}h2{font:700 13pt Arial,sans-serif;margin:20pt 0 10pt;break-after:avoid}.meta{display:flex;justify-content:space-between;margin-top:12pt;font:10pt Arial,sans-serif}.notice,.section-note,.source{font:9pt/1.5 Arial,sans-serif;color:#47596a}.notice{background:#f4f7fa;padding:8pt;border:1px solid #dce5ec}.instructions{padding-left:18pt}.question{margin-bottom:16pt;break-inside:avoid}.question-line{display:flex;gap:8pt}.number{min-width:18pt}.stem{flex:1;min-width:0}.marks{white-space:nowrap}.options{display:grid;grid-template-columns:1fr 1fr;gap:4pt 18pt;padding-left:18pt;margin:7pt 0}.answer{border-left:2pt solid #d1dce5;padding:5pt 0 2pt 10pt;margin-top:8pt}.answer p{margin:4pt 0}.marking{padding-left:16pt}.alternative{border-top:1px dashed #b6c4d0;margin-top:10pt;padding-top:8pt}.or{display:block;text-align:center;margin:0 0 8pt}.correct{font:10pt Arial,sans-serif}.end{margin-top:20pt;padding-top:10pt;border-top:1px solid #dce5ec;text-align:center;font:9pt Arial,sans-serif}.source{overflow-wrap:anywhere}.katex{font-size:1.03em}@page{size:A4;margin:15mm}@media print{body{padding:0;max-width:none}.notice{background:none}.question{break-inside:avoid}p{orphans:3;widows:3}a{color:inherit;text-decoration:none}}@media(max-width:640px){body{padding:20px 16px;font-size:11pt}.meta{flex-wrap:wrap;gap:8px}.options{grid-template-columns:1fr}}';
  return '<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(examTitle(p.title))+(answerKey?' — Worked answers':' — Question paper')+'</title><style>'+katexCss+css+mathPresentationCss+'</style></head><body><header><div class="brand">GROWTH TUTORIALS</div><h1>'+escape(examTitle(p.title))+'</h1><div>'+classLabel+' · '+escape(p.academicYear)+(answerKey?' · Worked answers':' · Question paper')+'</div><div class="meta"><span>Time: '+escape(p.durationMinutes)+' minutes</span><strong>Maximum marks: '+escape(p.marks)+'</strong></div></header>'+(answerKey?'':'<p>Name: ____________________ &nbsp; Roll no.: __________</p>')+'<ol class="instructions">'+p.instructions.map(cleanInstruction).filter(Boolean).map(i=>'<li>'+formatted(i)+'</li>').join('')+'</ol>'+sections+'<div class="end">End of '+(answerKey?'worked answers':'question paper')+'</div>'+'</body></html>';
}
