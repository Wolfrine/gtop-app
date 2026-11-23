import {scopeKeys,validateCurriculumScope} from './domain/catalogue.mjs';
import {selectedCurriculum} from './domain/task-brief.mjs';

const paperScopeKeys=['board','standard','subject','academicYear','scope','marks','durationMinutes','questionLanguage','answerLanguage'];
const practiceNotice='Practice paper based on your requested chapters. Official syllabus coverage and exam format have not been verified.';
const normalizeWords=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim();
export class NativePaperError extends Error {}

function validate(fn){
  try{return fn();}
  catch(error){
    if(error.code)throw error;
    throw new NativePaperError(error.message);
  }
}

export function workerPaper(domain,paper,conversation){
  if(paper?.ownerUid!==conversation.ownerUid||paper.conversationId!==conversation.id||paper.validation?.passed!==true)return null;
  const content=domain.paperContent(paper);
  if(paper.validation.paperContentSha256&&paper.validation.paperContentSha256!==domain.hash(content))return null;
  const {id,revision,requirements,curriculumSnapshot}=paper;
  return {id,revision,...content,requirements,curriculumSnapshot};
}

function requestedPractice(domain,requirements,messages){
  const selected=requirements.selectedChapters.map(title=>{
    const words=normalizeWords(title);
    const message=words&&messages.find(m=>(' '+normalizeWords(m.text)+' ').includes(' '+words+' '));
    if(!message)throw new NativePaperError('Use the exact chapter titles requested by the teacher when an approved curriculum is unavailable.');
    return {title,messageId:message.id,sha256Utf8:domain.hash(message.text)};
  });
  return {
    ...Object.fromEntries(scopeKeys.map(key=>[key,requirements[key]||''])),
    id:'request-chapters-'+domain.hash(selected).slice(0,28),url:'urn:gtop:paper-request:'+selected[0].messageId,
    title:'Teacher-requested chapters',chapters:selected.map(({title},index)=>({id:'chapter-'+(index+1),title})),
    provenance:{kind:'teacher-requested-chapters',coverage:'selected_chapters',yearVerified:false,patternVerified:false,chapterEvidence:selected},
    notice:practiceNotice
  };
}

export async function nativePaper(domain,{candidate,requirements:submitted,base,targetQuestionNumber,resolveCurriculum,userMessages}){
  const paper=domain.paperContent(candidate);
  validate(()=>domain.assertSchema(paper,domain.paperSchema));
  if(/\bofficial\s+(?:(?:CBSE|ICSE|ISC|board|exam|examination|sample|question)\s+)*(?:exam(?:ination)?|paper|blueprint)\b|आधिकारिक\s+(?:परीक्षा|प्रश्नपत्र)/iu.test(paper.title))throw new NativePaperError('Give this teacher-authored paper a title without an official issuer claim.');
  if(submitted!==undefined&&(!submitted||typeof submitted!=='object'||Array.isArray(submitted)))throw new NativePaperError('Paper requirements must be an object.');
  const declared=Object.fromEntries(paperScopeKeys.map(key=>[key,paper[key]]));
  let requirements=validate(()=>domain.validateRequirements({...declared,...submitted,format:submitted?.format??'practice'}));
  validate(()=>validateCurriculumScope(requirements));
  const reportedSourceReferences=paper.sourceReferences;
  if(Buffer.byteLength(JSON.stringify(reportedSourceReferences))>16000)throw new NativePaperError('Paper source references exceed the delivery limit.');
  for(const [key,value] of Object.entries(declared))if(value!==requirements[key])throw new NativePaperError('Paper '+key+' differs from its requirements.');

  let curriculum;
  if(targetQuestionNumber!=null){
    curriculum=base?.curriculumSnapshot;
    if(!curriculum)throw new NativePaperError('The base paper needs a saved curriculum to validate a single-question revision.');
  }else{
    try{curriculum=await resolveCurriculum(requirements);}
    catch(error){
      if(error.code!=='curriculum_unavailable'||requirements.scope!=='selected_chapters'||requirements.format!=='practice')throw error;
      curriculum=requestedPractice(domain,requirements,await userMessages());
    }
  }
  if(requirements.scope==='selected_chapters')requirements={...requirements,selectedChapters:curriculum.chapters.map(chapter=>chapter.title)};
  const chapterTitles=new Set(curriculum.chapters.map(chapter=>chapter.title));
  for(const question of paper.sections.flatMap(section=>section.questions)){
    if(chapterTitles.has(question.chapter))continue;
    const match=validate(()=>selectedCurriculum(curriculum,{scope:'selected_chapters',selectedChapters:[question.chapter]}));
    if(match.chapters.length===1)question.chapter=match.chapters[0].title;
  }
  const requestedOnly=curriculum.provenance?.kind==='teacher-requested-chapters';
  if(requestedOnly&&!/practice paper|अभ्यास प्रश्नपत्र/iu.test(paper.title))paper.title+=' - Practice Paper';
  paper.sourceReferences=targetQuestionNumber!=null?base.sourceReferences:[{id:curriculum.id,url:curriculum.url,title:curriculum.title}];
  const validation=validate(()=>domain.validatePaper(paper,requirements,curriculum));
  if(targetQuestionNumber!=null)validate(()=>domain.validateRevision(base,paper,targetQuestionNumber,curriculum));
  return {paper,requirements,curriculumSnapshot:curriculum,validation,reportedSourceReferences,notice:requestedOnly?practiceNotice:null};
}
