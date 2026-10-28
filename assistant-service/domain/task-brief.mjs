import {extractScope,academicYear,scopeKeys,capabilityQuestion} from './catalogue.mjs';

const normalized=s=>String(s).normalize('NFKC').toLowerCase().replace(/cordinate/g,'coordinate').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const allTopics=t=>/\ball (?:the )?(?:topics?|chapters?)\b|\bfull chapters?\b|सभी\s*(?:टॉपिक|विषय|अध्याय)|पूरे?\s*अध्याय|saare\s*(?:topics?|chapters?)/i.test(t);
export const creationIntent=t=>/(?:create|generate|prepare|make|want|need|start creating|बनाओ|बना दो|बनाइए|बनाना|चाहिए).{0,100}(?:paper|पेपर|प्रश्नपत्र)|(?:paper|पेपर|प्रश्नपत्र).{0,65}(?:creation now|banana|banao|banaiye|chahiye|banwa|बनाओ|बना दो|बनाइए|बनाना|चाहिए)|(?:pass|share|send).{0,45}codex/i.test(t);
export const prohibitedCreation=t=>/(?:do not|don't|not yet|never|मत|नहीं|\bmat\b|\bnahi\b).{0,55}(?:create|generate|make|prepare|start|banao|बना)|(?:create|generate|banao|बना).{0,25}(?:\bmat\b|\bnahi\b|मत|नहीं)/i.test(t);
export const requirementDiscussion=t=>!/^\s*(?:do not include|don.t include|exclude|remove|छोड़कर|हटाओ)\b/i.test(t)&&(/^\s*(?:what (?:is|are|does)|tell me about|why (?:would|should|is|do)|explain|compare|difference between|क्या.{0,25}है|समझा|फर्क|antar|samjhao)/i.test(t)||(!creationIntent(t)&&!/^\s*(?:use|choose|select|switch to|please use|रखो|चुनो)\b/i.test(t)&&(/[?？]|^\s*(?:how|what|why|which|can|could|would|should|is|are|does|do|क्या|कैसे|क्यों|कौन)\b/i.test(t)||/\b(?:versus|vs\.?|or)\b|या/.test(t))));
const cleanNames=names=>[...new Set(names.map(s=>s.trim().replace(/[.।]+$/,'')).filter(Boolean))];
const excluded=(text,name)=>{const n=normalized(text),v=normalized(name);return ['do not include ','don t include ','exclude ','except ','without ','not ','हटाओ ','छोड़कर '].some(prefix=>n.includes(prefix+v));};

// Recover a plainly named focus in comma/period-separated paper requirements.
// This records user intent only; selectedCurriculum must still verify its title.
function inlineChapters(text){
  if(!/(?:paper|पेपर|प्रश्नपत्र)/i.test(text))return [];
  return cleanNames(text.split(/[,.;।\n]+/).map(s=>s.trim()).filter(s=>
    s.length>2&&s.length<=120&&s.split(/\s+/).length<=12&&/\p{L}/u.test(s)&&
    !/[?!]/.test(s)&&!Object.keys(extractScope(s)).length&&
    !/\b(?:papers?|questions?|answers?|solutions?|marks?|boards?|class|standards?|grades?|patterns?|formats?|duration|hours?|minutes?|create|generate|prepare|make|please|include|exclude|without|only|all|full|yes|no|hi|hello|thanks?|codex|use|want|need|start|stop|check|verify|print|english|hindi|hinglish)\b|पेपर|प्रश्न|उत्तर|अंक|बोर्ड|बनाओ|सभी|पूरा/i.test(s)
  ));
}

// The model may identify spans, but only saved USER text can establish a selection.
// Names must occur in the quoted span; assistant messages and invented source IDs fail closed.
/** @param {any} job @param {any} selection */
export function buildTaskBrief(job,selection=null){
  // Version 1 could retain deleted programme fields. Rebuild from preserved
  // original messages on the next turn; never rewrite historical messages.
  const saved=job.context?.taskBrief;
  const prior=saved?.version===2?saved:null;
  const brief=structuredClone(prior||{version:2,requirements:{...(job.context?.activeRequirements||{}),academicYear:job.context?.activeRequirements?.academicYear||academicYear()},sources:{},creationRequestId:null,pendingClarification:saved?.pendingClarification||null});
  const messages=[...new Map([...(job.history||[]).filter(m=>m.role==='user'),{...job.request,role:'user'}].map(m=>[m.id,m])).values()];
  const cursor=messages.findIndex(m=>m.id===prior?.lastMessageId);
  const fresh=prior?cursor>=0?messages.slice(cursor+1):messages.filter(m=>(m.id===job.request.id&&m.id!==prior.lastMessageId&&(!m.createdAt||!prior.lastMessageAt||m.createdAt>=prior.lastMessageAt))||(m.createdAt&&prior.lastMessageAt&&m.createdAt>prior.lastMessageAt)):messages;
  const r=brief.requirements;
  const set=(field,value,m,quote=m.text)=>{r[field]=value;brief.sources[field]={messageId:m.id,quote:quote.slice(0,300)};};
  for(const m of fresh){
    const text=m.text;
    if(prohibitedCreation(text)||/^\s*(?:wait|hold on|not now|later|pause|रुको|अभी नहीं|abhi nahi)\b/i.test(text)){brief.creationRequestId=null;brief.creationPaused=true;}
    if(requirementDiscussion(text)||capabilityQuestion(text)){brief.lastMessageId=m.id;brief.lastMessageAt=m.createdAt||null;continue;}
    const previousScope={...r};const next=extractScope(text,job.catalogue||{},r);
    const changedScope=['board','standard','subject','academicYear'].some(k=>r[k]&&next[k]!==r[k]);
    const explicit=extractScope(text,job.catalogue||{});
    // extractScope intentionally deletes incompatible qualifiers. Assignment
    // alone resurrects those fields from the previous requirements object.
    for(const k of scopeKeys){if(Object.hasOwn(next,k))r[k]=next[k];else{delete r[k];delete brief.sources[k];}}
    for(const k of scopeKeys)if(Object.hasOwn(explicit,k)||(next[k]&&next[k]!==previousScope[k]))brief.sources[k]={messageId:m.id,quote:text.slice(0,300)};
    if(changedScope){brief.scopeChangedAtMessageId=m.id;delete r.selectedChapters;r.scope='full_syllabus';delete brief.sources.selectedChapters;delete brief.sources.scope;delete brief.sources.coverage;brief.pendingClarification=null;}
    const marks=text.match(/\b(\d{2,3})\s*[- ]?\s*(?:marks?|अंक)/i);
    if(marks)set('marks',Number(marks[1]),m,marks[0]);
    else if(/^\s*\d{2,3}[.!\s]*$/.test(text)&&brief.pendingClarification?.field==='marks')set('marks',Number(text.replace(/\D/g,'')),m);
    if(/(?:exam|board|official)\s+(?:paper\s+)?(?:pattern|format)|\b(?:ICSE|ISC|CBSE|IGCSE)\s+(?:exam\s+)?(?:pattern|format)/i.test(text))set('format','board',m);
    if(/custom practice (?:paper|format)|practice format (?:is fine|works)|all numbered questions (?:required|compulsory)/i.test(text))set('format','practice',m);
    if(creationIntent(text)&&!capabilityQuestion(text)&&!prohibitedCreation(text)&&!/(?:only|just).{0,20}(?:discuss|explain|plan)|(?:if|suppose|hypothetically).{0,35}(?:create|make)/i.test(text)){
      const previousRoot=messages.find(x=>x.id===brief.creationRequestId);
      const completed=job.context?.latestPaper;
      if(changedScope||!brief.creationRequestId||(completed?.createdAt&&previousRoot?.createdAt&&previousRoot.createdAt<=completed.createdAt&&m.createdAt>completed.createdAt))brief.creationRequestId=m.id;
      brief.creationPaused=false;
    }
    if(prohibitedCreation(text))brief.creationRequestId=null;
    const minutes=text.match(/(?:duration|time limit|paper for|exam for|अवधि)[^.;\n]{0,20}?\b(\d{2,3})\s*(?:minutes?|mins?|मिनट)/i);if(minutes)set('durationMinutes',Number(minutes[1]),m,minutes[0]);
    const hours=text.match(/(?:duration|time limit|paper for|exam for|अवधि)[^.;\n]{0,20}?\b([1-5](?:\.5)?)\s*(?:hours?|hrs?|घंटे)/i);if(hours)set('durationMinutes',Number(hours[1])*60,m,hours[0]);
    if(/without.{0,10}(?:internal )?choices|no internal choices|बिना.{0,10}विकल्प/i.test(text))set('internalChoices',false,m);
    else if(/with.{0,10}(?:internal )?choices|include.{0,10}(?:internal )?choices/i.test(text))set('internalChoices',true,m);
    if(/bank[ -]?only|only.{0,15}bank|सिर्फ.{0,15}बैंक/i.test(text))set('sourcePolicy','bank_only',m);
    else if(/original questions|generate original/i.test(text))set('sourcePolicy','original',m);
    for(const [name,pattern] of [['questionLanguage',/(?:paper|questions?|प्रश्नपत्र)[^;.!?\n]{0,35}(?:in (Hindi|English)|(हिंदी) में)/i],['answerLanguage',/(?:answers?|solutions?|उत्तर)[^;.!?\n]{0,30}(?:in (Hindi|English)|(हिंदी) में)/i]]){const hit=text.match(pattern);if(hit)set(name,/hindi|हिंदी/i.test(hit[1]||hit[2])?'Hindi':'English',m,hit[0]);}
    const questionPrefix=text.match(/\b(Hindi|English)\s+(?:question\s+)?paper\b|(हिंदी|अंग्रेजी)\s*(?:का\s*)?(?:पेपर|प्रश्नपत्र)/i);if(questionPrefix)set('questionLanguage',/hindi|हिंदी/i.test(questionPrefix[1]||questionPrefix[2])?'Hindi':'English',m,questionPrefix[0]);
    const answerPrefix=text.match(/\b(Hindi|English)\s+(?:answers?|solutions?)\b|(हिंदी|अंग्रेजी)\s*(?:में\s*)?उत्तर/i);if(answerPrefix)set('answerLanguage',/hindi|हिंदी/i.test(answerPrefix[1]||answerPrefix[2])?'Hindi':'English',m,answerPrefix[0]);
    if(/full syllabus|entire syllabus|whole syllabus|पूरा\s*(?:सिलेबस|पाठ्यक्रम)/i.test(text)){delete r.selectedChapters;set('scope','full_syllabus',m);brief.sources.coverage={messageId:m.id,quote:text.slice(0,300)};}
    else {
      // Common explicit list forms also recover older conversations, before this brief existed.
      const list=text.match(/^\s*(.{1,500}?)\s+(?:are (?:the )?chapters?|chapters? hain|अध्याय हैं)/i)?.[1]||text.match(/(?:chapters?|अध्याय)\s*[:：]\s*([^.;!?\n]{1,500})/i)?.[1];
      if(list&&!/[?]|which|what|कौन/i.test(list)){
        const known=job.context?.curriculum?.chapters||[];
        const whole=known.find(c=>normalized(c.title)===normalized(list));
        const names=cleanNames(whole?[list]:list.split(/[,;]/.test(list)?/\s*[,;]\s*/:/\s*(?:\band\b|और)\s*/i));
        if(names.length&&names.length<=30){set('selectedChapters',names,m,list);set('scope','selected_chapters',m,list);}
      }else{
        const names=inlineChapters(text);
        if(names.length&&names.length<=30){set('selectedChapters',names,m);set('scope','selected_chapters',m);}
      }
    }
    if(r.selectedChapters?.length){const kept=r.selectedChapters.filter(name=>!excluded(text,name));if(kept.length!==r.selectedChapters.length){set('selectedChapters',kept,m);set('scope','selected_chapters',m);}}
    if(allTopics(text))brief.sources.coverage={messageId:m.id,quote:text.slice(0,300)};
    brief.lastMessageId=m.id;brief.lastMessageAt=m.createdAt||null;
  }
  if(selection){
    const m=messages.find(m=>m.id===selection.sourceMessageId);
    if(!m||typeof selection.quote!=='string'||!m.text.includes(selection.quote)||!Array.isArray(selection.chapters)||selection.chapters.length>30||!selection.chapters.length||!selection.chapters.every(s=>typeof s==='string'&&s.length<=200&&normalized(selection.quote).includes(normalized(s))))throw Error('Chapter selection must quote the saved user message containing every chapter.');
    if(requirementDiscussion(m.text)||capabilityQuestion(m.text))throw Error('A discussion of chapters is not a chapter selection.');
    if(selection.chapters.some(name=>excluded(m.text,name)))throw Error('Chapter selection includes a chapter explicitly excluded by the user.');
    // Replayed model output cannot override a more recent user correction.
    if(m.id!==job.request.id&&!fresh.some(x=>x.id===m.id)&&prior&&r.selectedChapters?.length)return brief;
    const latestScopeSource=[brief.scopeChangedAtMessageId,brief.creationRequestId].map(id=>messages.findIndex(x=>x.id===id));
    if(messages.indexOf(m)<Math.max(-1,...latestScopeSource))throw Error('Chapter selection predates the current curriculum scope.');
    if(brief.sources.scope&&messages.findIndex(x=>x.id===brief.sources.scope.messageId)>messages.indexOf(m))return brief;
    const names=cleanNames(selection.chapters);set('selectedChapters',names,m,selection.quote);set('scope','selected_chapters',m,selection.quote);
  }
  // In the dedicated paper app, a complete requirement packet is an actionable
  // request even when the user omits the verb "create". Discussion and pauses stay inert.
  if(!brief.creationRequestId&&!brief.creationPaused&&!requirementDiscussion(job.request.text)&&!capabilityQuestion(job.request.text)&&!prohibitedCreation(job.request.text)&&r.board&&r.standard&&r.subject&&r.selectedChapters?.length){brief.creationRequestId=job.request.id;}
  brief.coverage=r.scope==='selected_chapters'?'all_topics_in_selected_chapters':'full_syllabus';
  return brief;
}

export function missingTaskField(brief){
  const r=brief.requirements;
  for(const key of ['board','standard','subject'])if(!r[key])return key;
  if(r.scope==='selected_chapters'&&!r.selectedChapters?.length)return 'selectedChapters';
  if(r.board==='IB'){if(!r.programme)return 'programme';if((Number(r.standard)>=11||['DP','IBDP'].includes(r.programme.toUpperCase()))&&!r.level)return 'level';if(Number(r.standard)>=11&&/math/i.test(r.subject)&&!['AA','AI'].includes(r.subjectCode))return 'subjectCode';}
  if(r.board?.startsWith('Cambridge')){for(const key of ['programme','subjectCode','examYear'])if(!r[key])return key;if(/math/i.test(r.subject)&&!r.level)return 'level';}
  return null;
}
export function clarificationText(field,language='en'){
  const en={board:'Which board is this for?',standard:'Which class is this for?',subject:'Which subject would you like?',selectedChapters:'Which chapters should remain after those exclusions?',programme:'Which IB programme is this for: PYP, MYP or DP?',level:'Which subject level should I use?',subjectCode:'What is the syllabus or subject code?',examYear:'Which examination year should I use?',marks:'How many marks should the paper have?'};
  if(language==='hi')return ({board:'यह किस बोर्ड के लिए है?',standard:'यह किस कक्षा के लिए है?',subject:'कौन-सा विषय चाहिए?',programme:'यह IB के किस programme के लिए है: PYP, MYP या DP?',level:'कौन-सा subject level चाहिए?',marks:'पेपर कितने अंकों का चाहिए?'})[field]||en[field];
  if(language==='hinglish')return ({board:'Kaun-sa board hai?',standard:'Kaun-si class hai?',subject:'Kaun-sa subject chahiye?',programme:'IB ka kaun-sa programme hai: PYP, MYP ya DP?',level:'Kaun-sa subject level chahiye?',marks:'Paper kitne marks ka chahiye?'})[field]||en[field];
  return en[field]||'Please clarify the remaining requirement.';
}
export function selectedCurriculum(pinned,requirements){
  if(requirements.scope!=='selected_chapters')return pinned;
  const requested=requirements.selectedChapters||[];
  const chosen=requested.map(name=>pinned.chapters.find(c=>normalized(c.title)===normalized(name)));
  if(chosen.some(c=>!c))throw Error('These selected chapters are not in the pinned curriculum: '+requested.filter((_,i)=>!chosen[i]).join(', ')+'. Please use the saved chapter titles or request an official curriculum check.');
  return {...pinned,chapters:[...new Map(chosen.map(c=>[c.id||c.title,c])).values()],selection:{kind:'selected_chapters',requested}};
}
