import {createHash} from 'node:crypto';
import {defaults,validateRequirements,curriculum} from '../../../assistant-service/domain/index.mjs';

export const hash=(v:string)=>createHash('sha256').update(v,'utf8').digest('hex');
export function verifyOriginals(job:any){for(const original of [job.request,job.rootRequest])if(!original || hash(original.text)!==original.sha256Utf8)throw Error('Original request integrity check failed.');}
export function selectContext(job:any){
  const qmatch=job.request.text.match(/(?:question|ques|q\.?|प्रश्न)\s*(\d+)/i);
  const latest=job.context?.latestPaper;
  const questions=latest?.sections?.flatMap((s:any)=>s.questions) || [];
  const paper=latest?{id:latest.id,title:latest.title,revision:latest.revision,requirements:latest.requirements,questions:qmatch?questions.filter((q:any)=>q.number===Number(qmatch[1])):questions.map((q:any)=>({number:q.number,chapter:q.chapter,marks:q.marks,question:q.question.slice(0,160)}))}:null;
  // Keep useful assistant clarification and explanation turns; execution claims are not memory facts.
  const recent:any[]=[];let budget=11500;
  for(const m of [...job.history].reverse()){const item={role:m.role,text:m.text,id:m.id};if(item.role==='system'||(item.role==='assistant'&&/deployed|(?:paper|job|file).{0,30}(?:ready|started|completed|running)/i.test(item.text)))continue;const size=JSON.stringify(item).length;if(size>budget)continue;recent.unshift(item);budget-=size;}
  return {originalCurrentRequest:job.request,rootRequest:job.rootRequest,relevantConversation:recent,explicitMemory:job.profile,requirements:job.context?.activeRequirements || defaults,latestPaper:paper,currentExecutionFacts:{permissions:job.controllerFacts.permissions,activePaperJob:job.controllerFacts.activePaperJob,availableData:{bankConnector:job.controllerFacts.availableData?.bankConnector,curriculumId:job.context?.curriculum?.id}}};
}
const clipped=(v:string,bytes:number)=>{let out='';for(const c of v){if(Buffer.byteLength(out+c)>bytes)break;out+=c;}return out;};
export function boundedContext(job:any,maxBytes:number){
  const c:any=selectContext(job),size=()=>Buffer.byteLength(JSON.stringify(c));
  while(size()>maxBytes&&c.relevantConversation.length)c.relevantConversation.shift();
  if(size()>maxBytes&&c.latestPaper)c.latestPaper={id:c.latestPaper.id,title:c.latestPaper.title,questions:c.latestPaper.questions?.slice(0,1)};
  if(size()>maxBytes)c.explicitMemory={preferences:job.profile?.preferences?.slice(-2)};
  if(size()>maxBytes)c.rootRequest={id:job.rootRequest.id,sha256Utf8:job.rootRequest.sha256Utf8,storedInVerbatimHandoff:true};
  if(size()>maxBytes)c.latestPaper=null;
  if(size()>maxBytes){const full=c.originalCurrentRequest.text;const excess=size()-maxBytes;c.originalCurrentRequest={...c.originalCurrentRequest,text:clipped(full,Math.max(80,Buffer.byteLength(full)-excess-100)),isExcerpt:true};}
  if(size()>maxBytes)throw Error('Conversation context cannot fit the local model safely. Please use a shorter message.');
  return c;
}
export function taskRoot(job:any){const candidates=job.history.filter((m:any)=>m.role==='user'&&/(?:create|generate|prepare|want|need|बनाओ|बनाना|चाहिए).{0,100}(?:paper|प्रश्नपत्र)|(?:paper|प्रश्नपत्र).{0,45}(?:banana|banwa|बनाना|बनाओ|चाहिए)/i.test(m.text));return candidates.at(-1)?.id || job.request.id;}
export function verifiedRequirements(job:any,proposal:any){
  const original=job.request.text,lower=original.toLowerCase();
  if(/bank[ -]?only|only.{0,15}bank|सिर्फ.{0,15}बैंक/i.test(original))throw Error('Bank-only creation is unavailable in this pilot. Please authorize original questions.');
  if(/\bICSE\b|\bISC\b|\b(?:class|grade)\s*(?:[1-9]|10|11)\b|कक्षा\s*(?:[1-9]|10|11)\b/i.test(original))throw Error('This pilot currently supports CBSE Class 12 Chemistry. Please confirm that scope.');
  if(/\b(?:physics|mathematics|maths|biology|history|geography)\b/i.test(original)&&/paper|syllabus/i.test(original))throw Error('This first pilot supports Chemistry. Other subjects need a later capability.');
  const r:any={...defaults,...(job.context?.activeRequirements || {})};
  // Earlier explicit user requirements survive a clarification before any paper job exists.
  if(!job.context?.activeRequirements){for(const m of job.history || [])if(m.role==='user'&&m.id!==job.request.id){const v=m.text.match(/\b(\d{2,3})\s*[- ]?\s*(?:marks?|अंक)/i);if(v)r.marks=Number(v[1]);if(/(?:paper|questions?)[^;.!?\n]{0,35}in hindi/i.test(m.text))r.questionLanguage='Hindi';if(/(?:answers?|solutions?)[^;.!?\n]{0,30}in hindi/i.test(m.text))r.answerLanguage='Hindi';}}
  const marks=original.match(/\b(\d{2,3})\s*[- ]?\s*(?:marks?|अंक)/i);if(marks)r.marks=Number(marks[1]);
  const minutes=original.match(/(?:duration|time limit|paper for|exam for|अवधि)[^.;\n]{0,20}?\b(\d{2,3})\s*(?:minutes?|mins?|मिनट)/i);if(minutes)r.durationMinutes=Number(minutes[1]);
  const hours=original.match(/(?:duration|time limit|paper for|exam for|अवधि)[^.;\n]{0,20}?\b([1-5](?:\.5)?)\s*(?:hours?|hrs?|घंटे)/i);if(hours)r.durationMinutes=Number(hours[1])*60;
  if(/without.{0,10}(?:internal )?choices|no internal choices|बिना.{0,10}विकल्प/i.test(original))r.internalChoices=false;
  else if(/with.{0,10}(?:internal )?choices|include.{0,10}(?:internal )?choices|विकल्प.{0,10}रख/i.test(original))r.internalChoices=true;
  // A conversation-language preference does not change the language of the paper.
  if(/(?:paper|questions?|प्रश्नपत्र)[^;.!?\n]{0,35}(?:in hindi|हिंदी में)|(?:hindi|हिंदी).{0,20}(?:paper|प्रश्नपत्र)/i.test(original))r.questionLanguage='Hindi';
  if(/(?:answers?|solutions?|उत्तर).{0,30}(?:in hindi|हिंदी में)/i.test(original))r.answerLanguage='Hindi';
  if(/(?:paper|questions?)[^;.!?\n]{0,25}in english/i.test(original))r.questionLanguage='English';
  if(/(?:answers?|solutions?).{0,25}in english/i.test(original))r.answerLanguage='English';
  if(/(?:hindi|हिंदी)\s*(?:answers?|solutions?|उत्तर)/i.test(original))r.answerLanguage='Hindi';
  if(/english\s*(?:answers?|solutions?)/i.test(original))r.answerLanguage='English';
  const priorAssistant=[...(job.history || [])].reverse().find((m:any)=>m.role==='assistant')?.text || '';
  const patch=proposal.requirementsPatch || {};
  // Model patches are accepted only with original-text evidence and a field-specific clarification.
  if(/^\s*\d{2,3}\s*[.!]?\s*$/.test(original)&&/marks?|अंक/i.test(priorAssistant)&&Number(original.replace(/\D/g,''))===patch.marks)r.marks=patch.marks;
  if(/^\s*(?:Hindi|हिंदी|English)\s*[.!]?\s*$/i.test(original)&&/language|medium|भाषा/i.test(priorAssistant)){
    const language=/hindi|हिंदी/i.test(original)?'Hindi':'English';
    if(/answers?|solutions?|उत्तर/i.test(priorAssistant)&&patch.answerLanguage===language)r.answerLanguage=language;
    if(/paper|questions?|प्रश्न/i.test(priorAssistant)&&patch.questionLanguage===language)r.questionLanguage=language;
  }
  if(proposal.action==='revise_paper'&&proposal.targetQuestionNumber!=null&&r.marks!==(job.context?.activeRequirements?.marks ?? r.marks))throw Error('Changing a single question cannot change the paper total. Please request a whole-paper revision.');
  return validateRequirements(r);
}
export function route(job:any,p:any){
  const t=job.request.text;
  if(/\b(?:deploy|restart.{0,20}schedul|delete.{0,15}data|modify.{0,15}(?:code|application)|develop.{0,15}app)\b/i.test(t))return {action:'unsupported',reply:'Development, deployment and destructive operations are unavailable in this paper pilot. Sachit must approve those separately.'};
  if(/(?:do not|don't|not yet|मत).{0,25}(?:generate|create|revise|replace|change|बना|बदल)/i.test(t))return {action:'local_answer',reply:p.reply};
  if(/^(?:why|how|क्यों|कैसे).{0,60}(?:change|revis|replace|बदल)/i.test(t))return {action:'explain_paper',reply:p.reply};
  if(/\b(?:status|progress|how long|finished|ready yet)\b|कहाँ तक|कितना समय/i.test(t))return {action:'status',reply:statusReply(job)};
  let action=p.action;
  if(/(?:create|generate|prepare|बनाओ|बना दो|बनाइए).{0,80}(?:paper|प्रश्नपत्र)|(?:paper|प्रश्नपत्र).{0,50}(?:बनाओ|बना दो|बनाइए)/i.test(t))action='generate_paper';
  const revisionIntent=/(?:^|[.!?]\s*|please\s+|you\s+)(?:revise|replace|change|make\b)|बदलो|बदल दो|बदल दीजिए|कठिन.{0,15}(?:करो|कर दो|बनाओ)/i.test(t);
  if(job.context?.latestPaper&&revisionIntent)action='revise_paper';
  if(action==='revise_paper'&&!revisionIntent)return {action:'clarify',reply:'Please state the change you want to make. I have not started a revision.'};
  let target=null;
  const m=t.match(/(?:question|ques|q\.?|प्रश्न)\s*(\d+)/i);if(m)target=Number(m[1]);
  if(action==='revise_paper'&&!job.context?.latestPaper)return {action:'clarify',reply:'Please create or select a paper in this conversation before requesting a revision.'};
  return {...p,action,targetQuestionNumber:target};
}
export function statusReply(job:any){const a=job.controllerFacts?.activePaperJob;if(!a)return 'There is no active paper task in this conversation.';const stage:Record<string,string>={waiting_for_codex:'waiting to begin',codex_starting:'starting the paper',codex_generating:'writing questions and worked answers',structure_validation:'checking marks, syllabus and structure',codex_reviewing:'reviewing the educational content',codex_correcting:'correcting review findings',preparing_documents:'preparing the printable documents',paper_ready_for_teacher_review:'ready for teacher review',retry_queued:'waiting to retry'};return `The paper task is ${a.state.replaceAll('_',' ')}. Current stage: ${stage[a.phase] || 'checking the current task'}.${a.error?' '+(a.error.message || a.error):''}`;}
export function handoff(job:any){verifyOriginals(job);return {originalUserRequest:job.request,rootUserRequest:job.rootRequest,relevantConversationHistory:job.history,establishedContext:{profile:job.profile,curriculum,basePaper:job.basePaper || null},localInterpretation:{interpretation:job.interpretation,proposedActions:job.proposedActions},controllerVerified:{requirements:job.requirements,permissions:job.controllerFacts.permissions,availableData:job.controllerFacts.availableData,ownerUid:job.ownerUid,conversationId:job.conversationId,requestRevision:job.requestRevision,targetQuestionNumber:job.targetQuestionNumber ?? null}};}
