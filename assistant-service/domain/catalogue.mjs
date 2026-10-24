import {createHash} from 'node:crypto';
import {curriculum as legacy} from './curriculum.mjs';

export const boards=Object.freeze([
  {name:'CBSE',standards:[5,6,7,8,9,10,11,12],aliases:['cbse'],domains:['cbseacademic.nic.in','cbse.gov.in','ncert.nic.in'],url:'https://cbseacademic.nic.in/curriculum_2027.html'},
  {name:'ICSE',standards:[5,6,7,8,9,10],aliases:['icse'],domains:['cisce.org'],url:'https://cisce.org/'},
  {name:'ISC',standards:[11,12],aliases:['isc'],domains:['cisce.org'],url:'https://cisce.org/'},
  {name:'Maharashtra State Board',standards:[5,6,7,8,9,10,11,12],aliases:['maharashtra state board','maharashtra','ssc','hsc'],domains:['ebalbharati.in','balbharati.in','mahahsscboard.in'],url:'https://ebalbharati.in/'},
  {name:'Cambridge IGCSE',standards:[9,10],aliases:['cambridge igcse','igcse'],domains:['cambridgeinternational.org'],url:'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/'},
  {name:'Cambridge',standards:[5,6,7,8,9,10,11,12],aliases:['cambridge'],domains:['cambridgeinternational.org'],url:'https://www.cambridgeinternational.org/programmes-and-qualifications/'},
  {name:'IB',standards:[5,6,7,8,9,10,11,12],aliases:['international baccalaureate','ib'],domains:['ibo.org'],url:'https://www.ibo.org/programmes/'},
]);
export const academicYear=(date=new Date())=>{const y=date.getUTCFullYear()-(date.getUTCMonth()<3?1:0);return `${y}-${String(y+1).slice(-2)}`;};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const scopeKeys=['board','standard','subject','academicYear','programme','level','subjectCode','examYear','edition'];
export const sameScope=(a,b)=>!!a&&!!b&&scopeKeys.every(k=>String(a[k]||'')===String(b[k]||''));
export function validateScope(r){
  const board=boards.find(b=>b.name===r.board);
  if(!board)throw Error('Please choose a board: '+boards.map(b=>b.name).join(', ')+'.');
  if(!/^([5-9]|1[0-2])$/.test(String(r.standard)))throw Error('Question papers support Classes 5–12. Please specify the class.');
  if(!board.standards.includes(Number(r.standard)))throw Error(`${r.board} does not name that class programme. ${r.board==='ICSE'?'For Classes 11–12, please choose ISC.':r.board==='Cambridge IGCSE'?'Please specify the Cambridge Primary, Lower Secondary or AS/A Level programme.':'Please clarify the programme.'}`);
  if(typeof r.subject!=='string'||!r.subject.trim()||r.subject.length>120)throw Error('Please specify the subject.');
  if(!/^20\d{2}-\d{2}$/.test(r.academicYear))throw Error('Please specify an academic year such as 2026-27.');
  for(const k of scopeKeys.slice(4))if(r[k]!=null&&(typeof r[k]!=='string'||r[k].length>160))throw Error('Invalid curriculum detail: '+k);
  return {...r,standard:String(r.standard),subject:r.subject.trim(),...Object.fromEntries(scopeKeys.slice(4).map(k=>[k,r[k]||'']))};
}
export function validateCurriculumScope(r){
  validateScope(r);
  if(r.board==='IB'&&r.programme&&!['PYP','MYP','DP','IBDP'].includes(r.programme.toUpperCase()))throw Error('Choose the IB programme PYP, MYP or DP.');
  if(r.board==='IB'&&r.level&&!['SL','HL'].includes(r.level.toUpperCase()))throw Error('IB subject levels must be SL or HL.');
  if(r.board.startsWith('Cambridge')&&r.level&&!['CORE','EXTENDED','AS','A'].includes(r.level.toUpperCase()))throw Error('Please specify the Cambridge Core/Extended or AS/A Level route.');
  if(r.board==='IB'&&(!r.programme||(Number(r.standard)>=11&&!r.level)))throw Error('Please specify the IB programme (PYP/MYP/DP) and, for DP, the subject level (SL/HL).');
  if(r.board.startsWith('Cambridge')&&(!r.programme||!r.subjectCode||!r.examYear))throw Error('Please specify the Cambridge programme, syllabus/subject code and examination year. Core/Extended or AS/A Level must be selected where applicable.');
  if(r.board==='Cambridge IGCSE'&&/math/i.test(r.subject)&&!r.level)throw Error('Please specify Core or Extended for this Cambridge Mathematics syllabus.');
  return r;
}
export function catalogueIndex(rows){
  if(rows.length>=5001)throw Error('Curriculum catalogue exceeds its read bound; narrow the catalogue before release.');
  const scopes=new Map();
  for(const row of rows){const standard=String(row.standard);if(!boards.some(b=>b.name===row.board&&b.standards.includes(Number(standard)))||!row.subject||!row.chapter)continue;const key=[row.board,standard,row.subject].join('|');const old=scopes.get(key)||{board:row.board,standard,subject:row.subject,chapters:0};old.chapters++;scopes.set(key,old);}
  return {boards:boards.map(({name,standards,url})=>({name,standards,url})),standards:[5,6,7,8,9,10,11,12],scopes:[...scopes.values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),basis:'GTOP saved syllabus; year/completeness are not inferred from question counts'};
}
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function extractScope(text,index={},base={}){
  // Strip explicitly rejected scope values before resolving corrections. Never treat them as selections.
  text=text.replace(/(?:do not want|don't want|not|नहीं)\s+(?:HL|SL|Core|Extended|CBSE|ICSE|ISC|IB|Maharashtra(?: State Board)?|Cambridge(?: IGCSE)?|(?:Class|Standard|Grade|कक्षा)\s*\d{1,2})\b/gi,' ');
  const out={...base};
  for(const board of [...boards].sort((a,b)=>b.name.length-a.name.length))if(board.aliases.some(a=>new RegExp('(?:^|\\b)'+escaped(a)+'(?:\\b|$)','i').test(text))){out.board=board.name;break;}
  const boardHits=[];
  for(const b of boards)for(const alias of b.aliases)for(const m of text.matchAll(new RegExp('(?:^|\\b)'+escaped(alias)+'(?:\\b|$)','ig')))boardHits.push({name:b.name,index:m.index,length:alias.length});
  const actualHits=boardHits.filter(h=>!boardHits.some(o=>o.index===h.index&&o.length>h.length)).sort((a,b)=>a.index-b.index);
  if(actualHits.length)out.board=new Set(actualHits.map(h=>h.name)).size===1||/instead|use|switch|change.{0,20}to/i.test(text)?actualHits.at(-1).name:'';
  const grade=text.match(/(?:class|standard|grade|std\.?|कक्षा)\s*(\d{1,2})(?:st|nd|rd|th)?\b|\b(\d{1,2})(?:st|nd|rd|th)\s*(?:standard|class|grade)?|कक्षा\s*([५६७८९]|१०|११|१२)/i);
  if(grade)out.standard=(grade[1]||grade[2]||grade[3]).replace(/[०-९]/g,c=>String('०१२३४५६७८९'.indexOf(c)));
  const year=text.match(/\b(20\d{2})[-–](\d{2})\b/);if(year)out.academicYear=year[1]+'-'+year[2];
  const candidates=[...new Set((index.scopes||[]).filter(s=>(!out.board||s.board===out.board)&&(!out.standard||s.standard===out.standard)).map(s=>s.subject)), 'Mathematics','Chemistry','Physics','Biology','Science','History','Geography','English','Hindi','Computer','Economics','Civics','Social Science','Accountancy','Business Studies'];
  const subjectText=text.replace(/(?:in|में)\s+(?:English|Hindi|हिंदी|अंग्रेजी)/gi,'');
  let matched=candidates.filter(s=>new RegExp('(?:^|\\b)'+escaped(s)+'(?:\\b|$)','i').test(subjectText));
  if(/\bmaths?\b|गणित/i.test(subjectText)){const saved=(index.scopes||[]).filter(s=>(!out.board||s.board===out.board)&&(!out.standard||s.standard===out.standard)).map(s=>s.subject);matched.push(saved.find(s=>/^mathematics$/i.test(s))||saved.find(s=>/^maths?$/i.test(s))||'Mathematics');}
  matched=[...new Set(matched)].sort((a,b)=>b.length-a.length);
  if(matched.length)out.subject=matched[0];
  if((base.board&&out.board!==base.board)||(base.standard&&out.standard!==base.standard)||(base.subject&&out.subject!==base.subject))for(const k of scopeKeys.slice(4))delete out[k];
  const programme=text.match(/\b(PYP|MYP|DP|IBDP|AS[ /-]?(?:and[ /-]?)?A[ -]?Level|AS[ -]?Level|A[ -]?Level|Lower Secondary|Primary|IGCSE)\b/i);if(programme)out.programme=programme[1].toUpperCase();
  const level=text.match(/\b(HL|SL|higher level|standard level|Core|Extended)\b(?!\s*\d)/i);if(level)out.level=({ 'higher level':'HL','standard level':'SL' })[level[1].toLowerCase()]||level[1].toUpperCase();
  const code=text.match(/(?:syllabus|subject|course)?\s*code\s*[:#-]?\s*([0-9A-Za-z-]{2,12})/i);if(code)out.subjectCode=code[1];
  const exam=text.match(/(?:exam(?:ination)?|cohort|session)\s*(?:year)?\s*[:#-]?\s*(20\d{2})/i);if(exam)out.examYear=exam[1];
  const edition=text.match(/(?:edition|textbook)\s*[:#-]?\s*([^.;!?\n]{1,100})/i);if(edition)out.edition=edition[1].trim();
  return out;
}
export function scopeFromHistory(job,index){
  let scope={...(job.context?.activeRequirements||{}),academicYear:job.context?.activeRequirements?.academicYear||academicYear()};
  let previousAssistant='';
  const languageAnswer=text=>/^\s*(?:Hindi|English|हिंदी)[,.!\s]*(?:please)?\s*$/i.test(text)&&/language|medium|भाषा/i.test(previousAssistant);
  for(const m of job.history||[])if(m.role==='assistant')previousAssistant=m.text;else if(m.role==='user'&&!languageAnswer(m.text))scope=extractScope(m.text,index,scope);
  return languageAnswer(job.request.text)?scope:extractScope(job.request.text,index,scope);
}
export const capabilityQuestion=t=>/what (?:all )?can you do|your (?:scope|capabilit)|what.*help.*with|do you support|which (?:boards|classes|standards|subjects)|able to (?:make|create|generate)|क्या.{0,30}कर सकते|कौन.{0,25}(?:बोर्ड|कक्षा)|kya kya|kaun.*(?:board|class)/i.test(t);
export const latestRequest=t=>/\b(?:check|verify|find|look up|fetch|update|latest|current)\b.{0,60}\b(?:curriculum|syllabus)\b|\b(?:curriculum|syllabus)\b.{0,60}\b(?:latest|online|check|verify|updated)\b|नवीनतम.{0,25}(?:पाठ्यक्रम|सिलेबस)|(?:सिलेबस|पाठ्यक्रम).{0,25}(?:जाँच|ऑनलाइन)|latest syllabus/i.test(t);
export function capabilityFacts(index,scope={}){return {identity:'GTOP assistant',actions:['discuss requirements and clarify','create papers through reviewed Codex workflow','revise papers preserving earlier versions','explain questions','report actual job status','check official curriculum online on request'],boards:(index.boards||boards.map(b=>({name:b.name,standards:b.standards}))).map(b=>({name:b.name,classes:b.standards})),scope,coverage:'Use GTOP saved curricula or a reviewed online check; missing curriculum is clarified, never invented.',permissions:{routinePaperWork:true,development:false,deployment:false,destructive:false,bankWrites:false}};}
export function capabilitiesReply(job,index){
  const scope=scopeFromHistory(job,index),hi=/हिंदी|हिन्दी|हिंग्लिश|Hindi|Hinglish|kya|kaun/i.test(job.request.text),names=boards.filter(b=>b.name!=='Cambridge IGCSE').map(b=>b.name).join(', ');
  return hi?`मैं Classes 5–12 के question papers की requirements समझने, paper और अलग worked answers बनवाने, पुराने version को सुरक्षित रखते हुए revision करने और questions समझाने में मदद कर सकता हूँ। Boards: ${names} (programme के अनुसार)। GTOP का saved syllabus इस्तेमाल कर सकता हूँ और आपके कहने पर latest official syllabus online check कर सकता हूँ। ${scope.standard?`Class ${scope.standard} के लिए `:''}${scope.board?'':'कौन-सा board, '}${scope.subject?'':'कौन-सा subject और '}कितने marks का paper चाहिए?`:`I can help plan and create question papers with separate worked answers, revise papers while preserving earlier versions, explain questions and report actual progress. Classes 5–12 are supported across ${names}, with the appropriate programme. I use GTOP's saved curricula and can check official curriculum online when you ask; missing coverage or programme details will be clarified. ${scope.standard?'For Class '+scope.standard+', ':''}${!scope.board?'which board, ':''}${!scope.subject?'which subject and ':''}how many marks would you like?`;
}
export function savedCurriculum(requirements,rows){
  const r=validateScope(requirements);
  if(scopeKeys.slice(4).some(k=>r[k]))throw Error('The saved GTOP chapter list has no verified programme/level/code/cohort/edition metadata. Please request an official curriculum check for this precise scope.');
  // Retain the already pinned, reviewed pilot version for old and matching papers.
  if(sameScope(r,legacy))return legacy;
  const titles=[...new Set(rows.filter(x=>x.board===r.board&&String(x.standard)===r.standard&&x.subject===r.subject&&typeof x.chapter==='string'&&x.chapter.trim()).map(x=>x.chapter.trim()))].sort();
  if(!titles.length)throw Error(`GTOP has no saved chapters for ${r.board} Class ${r.standard} ${r.subject}. Ask me to check the official curriculum online, including programme/textbook edition where applicable.`);
  if(titles.length>100)throw Error('This saved subject has more than 100 chapters; please select a reviewed subject scope.');
  const provenance={kind:'gtop-saved',yearVerified:false,completeOfficialSyllabus:false,records:rows.map(x=>x.id).filter(Boolean).sort(),retrievedAt:new Date().toISOString()};
  return {id:'gtop-'+digest({scope:scopeKeys.map(k=>r[k]||''),chapters:titles,records:provenance.records}).slice(0,28),...Object.fromEntries(scopeKeys.map(k=>[k,r[k]||''])),title:`GTOP saved ${r.board} Class ${r.standard} ${r.subject} chapter list`,url:'https://gtop-app.web.app/syllabus-preview',chapters:titles.map((title,i)=>({id:'chapter-'+(i+1),title,focus:''})),provenance,notice:'Custom practice paper based on GTOP’s saved chapter list. Current-year official completeness has not been verified. Teacher review is required.'};
}
export function officialUrl(value,board){
  const u=new URL(value),policy=boards.find(b=>b.name===board);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!policy?.domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))throw Error('Curriculum sources must use an official HTTPS board/publisher domain.');
  return u.href;
}
