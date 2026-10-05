import {createHash} from 'node:crypto';
import katex from 'katex';
import {readFileSync} from 'node:fs';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const canonicalJson=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
// Firestore event and transactional snapshots can enumerate map keys in
// different orders. Compare values canonically while retaining array order.
// Artifact byte checksums continue using the unchanged hash() above.
export function paperContentHash(paper){
  const fields=['title','board','standard','subjects','chapters','durationMinutes','marks','instructions','sections','conversationId','parentRequestId','requestRevision'];
  const content=Object.fromEntries(fields.map(field=>[field,paper[field]??null]));
  return hash(canonicalJson(content));
}
const kind=value=>String(value??'mcq').trim().toLowerCase().replace(/[ -]+/g,'_');
const aliases={mcq_single:'mcq',single_choice:'mcq',single_correct:'mcq',multiple_choice:'mcq',multiple_choice_question:'mcq',objective:'mcq',assertion_and_reason:'assertion_reason',assertion_reasoning:'assertion_reason',match_the_following:'matching',match:'matching',fill_in_the_blank:'fill_blank',fill_in_the_blanks:'fill_blank',fill_blanks:'fill_blank',short:'short_answer',long:'long_answer',very_short:'very_short_answer',numerical_based:'numerical',case_study:'case_based',statement:'statement_based',application:'short_answer',analysis:'short_answer',reason:'short_answer'};
const questionType=value=>aliases[kind(value)]??kind(value);
const difficulty=value=>{const token=kind(value??'unspecified');return ['medium','standard','normal'].includes(token)?'moderate':['difficult','advanced'].includes(token)?'hard':['basic','simple'].includes(token)?'easy':token;};
const objective=new Set(['mcq','assertion_reason','statement','statement_based','multiple_choice']);
export function validatePaper(paper){
  if(!paper||!String(paper.title??'').trim()||!paper.board||!String(paper.standard??'').trim()||!Array.isArray(paper.sections)||!paper.sections.length)throw Error('Paper title, board, class and sections are required.');
  if(!Number.isFinite(paper.marks)||paper.marks<=0||paper.marks>1000)throw Error('Paper marks are invalid.');
  const questions=paper.sections.flatMap(section=>section.questions??[]);
  if(!questions.length||questions.length>400)throw Error('A paper must contain between 1 and 400 questions.');
  const ids=new Set();let total=0,reused=0,generated=0;
  for(const question of questions){
    if(typeof question.questionId!=='string'||!/^[^/]{1,140}$/.test(question.questionId)||ids.has(question.questionId))throw Error('Question IDs must be present and unique.');
    ids.add(question.questionId);
    if(!String(question.question??'').trim()||!question.subject||!question.chapter)throw Error('Every question needs content and a syllabus scope.');
    if(question.board!==paper.board||String(question.standard)!==String(paper.standard))throw Error('Question board/class does not match the paper.');
    if(!Number.isFinite(question.marks)||question.marks<=0)throw Error('Every question needs valid marks.');
    if(!Array.isArray(question.solutions)||!question.solutions.length||question.solutions.some(answer=>!String(answer).trim()))throw Error('Every question needs a worked answer.');
    if(objective.has(questionType(question.questionType))&&(!Array.isArray(question.options)||question.options.length<2||question.options.some(option=>!String(option).trim())||!Number.isInteger(question.correctIndex)||question.correctIndex<0||question.correctIndex>=question.options.length))throw Error('Objective questions need valid options and an answer.');
    if(!['questions','devQuestions','paperQuestions'].includes(question.sourceCollection))throw Error('Every question needs its bank source.');
    if(!['bank','generated'].includes(question.origin))throw Error('Every question needs its reuse/generation origin.');
    if(question.origin==='generated')generated++;else reused++;
    for(const asset of question.assets??[]){
      const url=new URL(asset.url);
      if(url.protocol!=='https:'||!['firebasestorage.googleapis.com','storage.googleapis.com'].includes(url.hostname))throw Error('Paper diagrams must be stored in Firebase Storage.');
      if(!asset.alt)throw Error('Every diagram needs a description.');
    }
    if((kind(question.questionType)==='diagram_based'||question.diagramRequired)&&!question.assets?.length)throw Error('A required diagram is missing.');
    total+=question.marks;
  }
  if(Math.abs(total-paper.marks)>0.001)throw Error(`Questions total ${total} marks; ${paper.marks} requested.`);
  for(const section of paper.sections){
    if(!section.title||!section.questions?.length)throw Error('Every section needs a title and questions.');
    if(section.requiredCount!==undefined&&section.requiredCount!==section.questions.length)throw Error('A section has an incomplete question count.');
    if(section.marksPerQuestion!==undefined&&section.questions.some(question=>question.marks!==section.marksPerQuestion))throw Error('Question marks do not match their section.');
  }
  return {questionCount:questions.length,totalMarks:total,reusedQuestionCount:reused,generatedQuestionCount:generated,questions};
}
export function validateBankSnapshot(question,source){
  if(!source||source.status==='deleted'||source.status==='rejected'||Number(source.flagCount??0)>0)throw Error('A source question is missing, retired or flagged.');
  if(question.sourceCollection==='devQuestions'&&source.reviewStatus!=='approved-paper-only')throw Error('Unreviewed legacy drafts cannot be reused.');
  if(question.sourceCollection==='paperQuestions'&&source.status!=='ready')throw Error('The generated source question is incomplete.');
  if(question.sourceCollection==='questions'&&!['approved','active','published'].includes(source.status??'approved'))throw Error('The bank question is not active.');
  for(const field of ['board','subject','chapter','question'])if(String(question[field])!==String(source[field]))throw Error(`Reused question ${question.questionId} differs from its source ${field}.`);
  if(String(question.standard)!==String(source.standard))throw Error('Source class differs.');
  if(question.marks!==Number(source.marks??1))throw Error('A reused question cannot be relabelled with different marks.');
  if(questionType(question.questionType)!==questionType(source.questionType??source.type??source.question_type)||difficulty(question.difficulty)!==difficulty(source.difficulty??source.level))throw Error('Question type or difficulty differs from its source.');
  const solutions=source.solutions??(typeof source.answer==='string'?[source.answer]:source.answer??[]);
  if(JSON.stringify(question.options??[])!==JSON.stringify(source.options??[])||Number(question.correctIndex??-1)!==Number(source.correctIndex??-1)||JSON.stringify(question.solutions)!==JSON.stringify(solutions))throw Error('Question answers or options differ from the saved source.');
  const assets=[...(source.assets??[])];const image=source.imageUrl??source.diagramUrl;
  if(image&&!assets.some(asset=>asset.url===image))assets.push({url:image,alt:source.imageAlt||'Question diagram'});
  if(canonicalJson(question.assets??[])!==canonicalJson(assets)||canonicalJson(question.blocks??[])!==canonicalJson(source.blocks??[]))throw Error('Question diagrams or content blocks differ from the saved source.');
}
function text(value){
  return String(value??'').split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map(part=>{
    if(part.startsWith('$')&&part.endsWith('$')){const display=part.startsWith('$$');return katex.renderToString(part.slice(display?2:1,display?-2:-1),{displayMode:display,throwOnError:true,trust:false,strict:'error'});}
    return escape(part).replace(/\n/g,'<br>');
  }).join('');
}
const baseCss=`*{box-sizing:border-box}html{color:#192329;background:#fff;font:12pt/1.5 Georgia,'Times New Roman',serif}body{margin:0;padding:18mm 16mm;max-width:210mm;margin-inline:auto}header{text-align:center;border-bottom:1.5pt solid #253b3a;padding-bottom:10pt;margin-bottom:16pt}h1{font:700 17pt/1.3 Arial,sans-serif;margin:3pt 0}h2{font:700 13pt/1.3 Arial,sans-serif;margin:20pt 0 9pt}.brand{font:700 12pt Arial,sans-serif;letter-spacing:2pt}.meta{display:flex;justify-content:space-between;gap:10pt;margin-top:10pt;font:10pt Arial,sans-serif}.scope{font:10pt/1.5 Arial,sans-serif;margin-bottom:12pt}.student{margin-bottom:14pt}.instructions{padding-left:16pt;font-size:10pt}.question{margin:0 0 15pt;break-inside:avoid}.question-line{display:flex;gap:8pt}.number{min-width:19pt;font-weight:bold}.stem{flex:1;min-width:0;overflow-wrap:anywhere}.marks{white-space:nowrap;font-weight:bold}.options{list-style:none;margin:6pt 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:4pt 12pt}.diagram{display:block;max-width:100%;max-height:85mm;width:auto;height:auto;margin:9pt auto}figure{margin:7pt 0}figcaption{font:9pt Arial,sans-serif;text-align:center}.answer{padding:8pt 0 0;font-size:11pt}.section-note{font:10pt Arial,sans-serif}.end{text-align:center;font:9pt Arial,sans-serif;border-top:1pt solid #ddd;margin-top:18pt;padding-top:8pt}.matching{width:100%;border-collapse:collapse;margin:7pt 0}.matching td,.matching th{border:1px solid #888;padding:4pt;text-align:left}.katex{font-size:1.05em}.katex-display{overflow-wrap:normal}@page{size:A4;margin:14mm 14mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9pt Arial,sans-serif;color:#53616a}}@media print{body{padding:0;max-width:none}header,h2{break-after:avoid}.question{break-inside:avoid}p{orphans:3;widows:3}a{color:inherit;text-decoration:none}}@media(max-width:640px){body{padding:18px 14px;font-size:11pt}.meta{flex-wrap:wrap}.options{grid-template-columns:1fr}}`;
function blocks(question){
  let html='';
  for(const block of question.blocks??[]){
    if(block.type==='text')html+='<p>'+text(block.text)+'</p>';
    else if(block.type==='table'&&Array.isArray(block.rows))html+='<table class="matching">'+(block.headers?'<thead><tr>'+block.headers.map(value=>'<th>'+text(value)+'</th>').join('')+'</tr></thead>':'')+'<tbody>'+block.rows.map(row=>'<tr>'+row.map(value=>'<td>'+text(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    else throw Error('Unsupported question content block.');
  }
  return html;
}
export function renderPaper(paper,answerKey=false){
  validatePaper(paper);let number=0;
  const sections=paper.sections.map(section=>'<section><h2>'+escape(section.title)+'</h2>'+(section.instructions?'<p class="section-note">'+text(section.instructions)+'</p>':'')+section.questions.map(question=>{
    number++;
    const options=(question.options??[]).length?'<ol class="options">'+question.options.map((value,index)=>'<li>('+String.fromCharCode(65+index)+') '+text(value)+'</li>').join('')+'</ol>':'';
    const assets=(question.assets??[]).map(asset=>'<figure><img class="diagram" src="'+escape(asset.url)+'" alt="'+escape(asset.alt)+'">'+(asset.caption?'<figcaption>'+text(asset.caption)+'</figcaption>':'')+'</figure>').join('');
    const answer=answerKey?'<div class="answer">'+(objective.has(questionType(question.questionType))?'<strong>Answer: ('+String.fromCharCode(65+question.correctIndex)+')</strong><br>':'')+question.solutions.map(text).join('<br>')+'</div>':'';
    return '<article class="question"><div class="question-line"><span class="number">'+number+'.</span><div class="stem">'+text(question.question)+blocks(question)+options+assets+answer+'</div><span class="marks">['+question.marks+']</span></div></article>';
  }).join('')+'</section>').join('');
  const katexCss=readFileSync(new URL('./node_modules/katex/dist/katex.min.css',import.meta.url),'utf8').replace(/url\(fonts\//g,'url(https://gtop-app.web.app/assets/paper-fonts/');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(paper.title)+(answerKey?' — Answer key':'')+'</title><style>'+katexCss+baseCss+'</style></head><body><header><div class="brand">GROWTH TUTORIALS</div><h1>'+escape(paper.title)+'</h1><div>'+escape(paper.board)+' · Class '+escape(paper.standard)+' · '+escape((paper.subjects??[]).join(', '))+(answerKey?' · Answer key':'')+'</div><div class="meta"><span>Time: '+escape(paper.durationMinutes??60)+' minutes</span><span>Maximum marks: '+escape(paper.marks)+'</span></div></header>'+(answerKey?'':'<p class="student">Name: __________________________ &nbsp; Roll no.: __________</p>')+'<p class="scope">Chapters: '+escape((paper.chapters??[]).join(', '))+'</p><ol class="instructions">'+(paper.instructions??['Attempt all questions.','Marks are shown in brackets.']).map(value=>'<li>'+text(value)+'</li>').join('')+'</ol>'+sections+'<div class="end">'+(answerKey?'End of answer key':'End of question paper')+'</div></body></html>';
}
export function imageType(bytes){
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',ext:'png'};
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',ext:'jpg'};
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return {mime:'image/webp',ext:'webp'};
  throw Error('Only PNG, JPEG and WebP diagram files are supported.');
}
