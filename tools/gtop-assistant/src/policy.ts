import {createHash} from 'node:crypto';
import {defaults,validateRequirements,curriculum} from '../../../assistant-service/domain/index.mjs';
import {capabilityFacts,scopeFromHistory,capabilityQuestion,latestRequest,extractScope,sameScope,missingScopeReply,replyLanguage} from '../../../assistant-service/domain/catalogue.mjs';
import {buildTaskBrief,missingTaskField,clarificationText,requirementDiscussion,creationIntent as hasCreationIntent} from '../../../assistant-service/domain/task-brief.mjs';

export const hash=(v:string)=>createHash('sha256').update(v,'utf8').digest('hex');
export function verifyOriginals(job:any){for(const original of [job.request,job.rootRequest])if(!original || hash(original.text)!==original.sha256Utf8)throw Error('Original request integrity check failed.');}
export function selectContext(job:any){
  const qmatch=job.request.text.match(/(?:question|ques|q\.?|प्रश्न)\s*(\d+)/i);
  const latest=job.context?.latestPaper;
  const questions=latest?.sections?.flatMap((s:any)=>s.questions) || [];
  const paper=latest?{id:latest.id,title:latest.title,revision:latest.revision,questions:qmatch?questions.filter((q:any)=>q.number===Number(qmatch[1])):questions.map((q:any)=>({number:q.number,chapter:q.chapter,marks:q.marks,question:q.question.slice(0,160)}))}:null;
  // Keep useful assistant clarification and explanation turns; execution claims are not memory facts.
  const recent:any[]=[];let budget=11500;
  for(const m of [...job.history].reverse()){const item={role:m.role,text:m.text,id:m.id};if(m.id===job.request.id||item.role==='system'||(item.role==='assistant'&&/deployed|(?:paper|job|file).{0,30}(?:ready|started|completed|running)|I can only explain|my scope is limited to explaining|only support.{0,35}Class 12/i.test(item.text)))continue;const size=JSON.stringify(item).length;if(size>budget)continue;recent.unshift(item);budget-=size;}
  const active=job.controllerFacts.activePaperJob;
  const brief=job.taskBrief||buildTaskBrief(job),scope=brief.requirements;
  const capabilities=capabilityFacts(job.catalogue||{},scope);
  // Ordinary chat needs the capability summary, not every configured board/class.
  if(!capabilityQuestion(job.request.text)){delete capabilities.boards;delete capabilities.savedSubjects;}
  const sources=Object.fromEntries(Object.entries(brief.sources||{}).map(([k,v]:any)=>[k,{messageId:v.messageId,quote:v.quote.slice(0,80)}]));
  return {originalCurrentRequest:{id:job.request.id,text:job.request.text},rootRequest:{id:job.rootRequest.id,text:job.rootRequest.text},relevantConversation:recent.slice(-12),explicitMemory:job.profile,requirements:scope,taskBrief:{coverage:brief.coverage,sources,pendingClarification:brief.pendingClarification},capabilities,latestPaper:paper,currentExecutionFacts:{permissions:job.controllerFacts.permissions,activePaperJob:active?{state:active.state,phase:active.phase,elapsedSeconds:active.elapsedSeconds}:null,activeCurriculumJob:job.controllerFacts.activeCurriculumJob?{state:job.controllerFacts.activeCurriculumJob.state,phase:job.controllerFacts.activeCurriculumJob.phase,elapsedSeconds:job.controllerFacts.activeCurriculumJob.elapsedSeconds}:null,availableData:{bankConnector:job.controllerFacts.availableData?.bankConnector,curriculumId:job.context?.curriculum?.id}}};
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
export function taskRoot(job:any){return (job.taskBrief||buildTaskBrief(job)).creationRequestId||job.request.id;}
export function socialReply(job:any){
  const t=job.request.text.trim(),language=replyLanguage(job);
  if(/^(?:how (?:are you|are you doing|have you been)(?: today)?|how's it going|kaise ho(?: aap)?|aap kaise (?:ho|hain)|आप कैसे हैं|कैसे हो)[?!.\s]*$/i.test(t))return language==='hi'?'मैं ठीक हूँ, धन्यवाद! आप कैसे हैं?':language==='hinglish'?'Main theek hoon, shukriya! Aap kaise hain?':'Doing well, thanks! How are you?';
  if(/^(?:hi|hello|hey|namaste|नमस्ते|नमस्कार)[!,.\s]*$/i.test(t))return language==='hi'?'नमस्ते! कैसे मदद करूँ?':language==='hinglish'?'Namaste! Kaise madad karoon?':'Hi! How can I help?';
  if(/^(?:thanks?(?: you)?(?: so much)?|thank you(?: so much)?|dhanyavaad|shukriya|धन्यवाद|शुक्रिया)[!,.\s]*$/i.test(t))return language==='hi'?'आपका स्वागत है!':language==='hinglish'?'Aapka swagat hai!':'You’re welcome!';
  return null;
}
export const examPatternRequested=(t:string)=>/\b(?:exam|board|official)\s+(?:paper\s+)?(?:pattern|format)\b|\b(?:ICSE|ISC|CBSE|IGCSE)\s+(?:exam\s+)?(?:pattern|format)\b|बोर्ड.{0,15}(?:पैटर्न|प्रारूप)|exam pattern/i.test(t);
export function patternClarification(job:any){return replyLanguage(job)==='hi'?'अभी सभी numbered questions ज़रूरी रखने और पूरे question में OR choices वाला practice paper बना सकता हूँ। क्या यह format चलेगा?':replyLanguage(job)==='hinglish'?'Abhi har numbered question required aur whole-question OR choices wala practice paper bana sakta hoon. Kya yeh format chalega?':'This format doesn’t support every board choice rule. Would a practice paper with every numbered question required and whole-question OR choices work?';}
export function curriculumHelp(job:any){
  const r=(job.taskBrief||buildTaskBrief(job)).requirements;
  const scope=[r.board,r.standard?'Class '+r.standard:'',r.subject].filter(Boolean).join(' ');
  const focus=r.selectedChapters?.slice(0,2).join(', ');
  const saved=[scope,focus,r.marks?r.marks+' marks':''].filter(Boolean).join(' · ');
  return replyLanguage(job)==='hi'?`${saved} — जानकारी सुरक्षित है। इसके लिए verified syllabus उपलब्ध नहीं है। क्या मैं online जाँच करूँ?`:replyLanguage(job)==='hinglish'?`${saved} — details saved hain. Iska verified syllabus available nahi hai. Kya main online check karoon?`:`Saved: ${saved}. I don’t have a verified syllabus for this scope. Shall I check it online?`;
}
export function scopeClarificationReply(job:any){
  const scope=scopeFromHistory(job,job.catalogue||{}),language=replyLanguage(job),missing=missingScopeReply(scope,language);
  if(missing)return missing;
  const originals=[...(job.history||[]).filter((m:any)=>m.role==='user').map((m:any)=>m.text),job.request.text];
  const explicitMarks=originals.map((t:string)=>t.match(/\b(\d{2,3})\s*[- ]?\s*(?:marks?|अंक)/i)?.[1]).filter(Boolean).at(-1);
  const summary=`${scope.board} Class ${scope.standard} ${scope.subject}${explicitMarks?', '+explicitMarks+' marks':''}`;
  return language==='hi'?`${summary} — समझ गया। क्या paper बना दूँ?`:language==='hinglish'?`${summary} — samajh gaya. Paper bana doon?`:`Got it—${summary}. Shall I create the paper?`;
}
export function verifiedRequirements(job:any,proposal:any){
  const original=job.request.text,lower=original.toLowerCase();
  if(/bank[ -]?only|only.{0,15}bank|सिर्फ.{0,15}बैंक/i.test(original))throw Error('Bank-only creation is unavailable in this pilot. Please authorize original questions.');
  const selected:any=(job.taskBrief||buildTaskBrief(job)).requirements;
  const missing=['board','standard','subject'].filter(k=>!selected[k]);
  if(missing.length)throw Error(missingScopeReply(selected,replyLanguage(job))||'Which board is this for?');
  // The brief already incorporates the old paper and user corrections.
  // Re-merging that paper would resurrect intentionally removed qualifiers.
  const r:any={...defaults,...selected};
  if(proposal.action==='revise_paper'&&job.context?.latestPaper){for(const key of ['board','standard','subject','academicYear'])if(r[key]!==job.context.latestPaper[key])throw Error('A revision must keep the existing paper curriculum. Please request a new paper for a different board, class, subject or year.');}
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
  // Short clarification answers come from the original text and a field-specific question, not model patches.
  if(/^\s*\d{2,3}\s*[.!]?\s*$/.test(original)&&/marks?|अंक/i.test(priorAssistant))r.marks=Number(original.replace(/\D/g,''));
  if(/^\s*(?:Hindi|हिंदी|English)\s*[.!]?\s*$/i.test(original)&&/language|medium|भाषा/i.test(priorAssistant)){
    const language=/hindi|हिंदी/i.test(original)?'Hindi':'English';
    if(/answers?|solutions?|उत्तर/i.test(priorAssistant))r.answerLanguage=language;
    if(/paper|questions?|प्रश्न|पेपर/i.test(priorAssistant))r.questionLanguage=language;
  }
  if(proposal.action==='revise_paper'&&proposal.targetQuestionNumber!=null&&r.marks!==(job.context?.activeRequirements?.marks ?? r.marks))throw Error('Changing a single question cannot change the paper total. Please request a whole-paper revision.');
  if(proposal.action==='revise_paper'&&job.context?.latestPaper?.curriculumSnapshot&&!sameScope(r,job.context.latestPaper.curriculumSnapshot))throw Error('Please create a new paper when changing programme, level, subject code, exam year or textbook edition.');
  if(proposal.action==='revise_paper'&&job.context?.latestPaper?.requirements){const base=job.context.latestPaper.requirements;if(base.scope!==r.scope||JSON.stringify(base.selectedChapters||[])!==JSON.stringify(r.selectedChapters||[]))throw Error('Please create a new paper when changing the selected chapters or syllabus coverage.');}
  return validateRequirements(r);
}
export function route(job:any,p:any){
  const t=job.request.text.normalize('NFKC').replace(/[’‘]/g,"'");
  if(/\b(?:deploy|restart.{0,20}schedul|delete.{0,15}data|modify.{0,15}(?:code|application)|develop.{0,15}app)\b/i.test(t))return {action:'unsupported',reply:'Development, deployment and destructive operations are unavailable in this paper pilot. Sachit must approve those separately.'};
  const social=socialReply(job);if(social)return {action:'local_answer',reply:social};
  if(capabilityQuestion(t))return {...p,action:'describe_capabilities'};
  if(/(?:do not|don't|dont|not yet|not asking|never|मत|नहीं|\bmat\b|\bnahi\b)[^.;!?\n]{0,55}(?:check|verify|fetch|update|generate|create|make|prepare|banao|banana|banaana|revise|replace|change|बना|बदल|जाँच)|(?:check|verify|fetch|update|generate|create|make|prepare|banao|banana|banaana|revise|replace|change|जाँच|बना|बदल).{0,25}(?:\bmat\b|\bnahi\b|मत|नहीं)/i.test(t))return {action:'local_answer',reply:p.reply};
  const discussionOnly=/(?:only|just).{0,25}(?:discuss|understand|plan|explain)|(?:discuss|understand|explain|tell me).{0,45}(?:how|process|workflow)|(?:if|suppose|hypothetically).{0,50}(?:create|make|paper)|(?:sirf|bas).{0,30}(?:samajh|baat|discuss|planning)|सिर्फ.{0,30}(?:समझ|चर्चा)|कैसे.{0,25}(?:बनाते|बनता|बनाएंगे)/i.test(t);
  if(discussionOnly)return {...p,action:'local_answer'};
  if(/\b(?:status|progress|how long|finished|ready yet)\b|कहाँ तक|कितना समय/i.test(t))return {action:'status',reply:statusReply(job)};
  if(requirementDiscussion(t))return {...p,action:'local_answer'};
  if(latestRequest(t)&&!/(?:do not|don't|not yet).{0,30}(?:check|verify|fetch|update)/i.test(t))return {...p,action:'check_curriculum'};
  const currentBrief=job.taskBrief||buildTaskBrief(job);
  if(currentBrief.pendingClarification?.field==='curriculum'&&!currentBrief.creationPaused&&currentBrief.creationRequestId&&!missingTaskField(currentBrief)&&/^\s*(?:yes(?: please)?|okay|ok|go ahead|proceed|haan|हाँ|हां|जी)[.!\s]*$/i.test(t))return {...p,action:'check_curriculum'};
  if(examPatternRequested(t))return {...p,action:'clarify',reply:patternClarification(job)};
  if(p.action==='check_curriculum')return {...p,action:'clarify',reply:'I can check the official curriculum online when you ask. '+(missingScopeReply(scopeFromHistory(job,job.catalogue||{}),replyLanguage(job))||'Would you like me to check it?')};
  if(/^(?:why|how|क्यों|कैसे).{0,60}(?:change|revis|replace|बदल)/i.test(t))return {action:'explain_paper',reply:p.reply};
  let action=p.action;
  const creationIntent=hasCreationIntent;
  const explicitCreation=creationIntent(t);
  if(explicitCreation){
    const recent=(job.history||[]).slice(-12);let patternPending=false,formatQuestion=false;
    for(const m of recent){
      if(m.role==='user'&&examPatternRequested(m.text))patternPending=true;
      if(m.role==='assistant')formatQuestion=/every numbered question required|har numbered question required|सभी numbered questions ज़रूरी/i.test(m.text);
      else if(m.role==='user'&&formatQuestion&&/^(?:yes(?: please)?|go ahead|proceed|haan|हाँ|हां|जी)[.!\s]*$/i.test(m.text))patternPending=false;
      if(m.role==='user'&&/custom practice (?:paper|format)|practice format (?:is fine|works)|all numbered questions (?:required|compulsory)/i.test(m.text))patternPending=false;
    }
    if(patternPending&&!/custom practice (?:paper|format)|practice format (?:is fine|works)/i.test(t))return {...p,action:'clarify',reply:patternClarification(job)};
  }
  if(explicitCreation)action='generate_paper';
  const brief=job.taskBrief||buildTaskBrief(job);
  if(brief.creationPaused&&!explicitCreation)return {...p,action:'local_answer',reply:replyLanguage(job)==='hi'?'पेपर बनाना अभी रुका हुआ है। जब तैयार हों, बनाने को कहिए।':'Paper creation is on hold. Ask me to create it when you are ready.'};
  const topicAnswer=/\ball (?:the )?topics?\b|\bfull chapters?\b|सभी\s*(?:टॉपिक|विषय)|पूरे?\s*अध्याय|saare\s*topics?|are (?:the )?chapters?|chapters?\s*:/i.test(t)||!!p.selection;
  const fieldAnswer=topicAnswer||Object.keys(extractScope(t,job.catalogue||{})).length>0||/^\s*\d{2,3}\s*(?:marks?)?[.!\s]*$/i.test(t);
  const latestPaper=job.context?.latestPaper;
  const root=(job.history||[]).find((m:any)=>m.id===brief.creationRequestId)||job.request;
  const pendingCreation=brief.creationRequestId&&(!latestPaper||(root.createdAt&&latestPaper.createdAt&&root.createdAt>latestPaper.createdAt));
  if(explicitCreation||(pendingCreation&&fieldAnswer)){
    const active=job.controllerFacts?.activePaperJob;
    if(active&&['queued','running','validating'].includes(active.state)&&!/\b(?:new|another|different)\s+paper\b/i.test(t))return {action:'status',reply:statusReply(job)};
    const field=missingTaskField(brief);
    if(field){const attempts=brief.pendingClarification?.field===field?(brief.pendingClarification.attempts||0):0;const r=brief.requirements;let reply=clarificationText(field,replyLanguage(job));if(field==='level'&&r.board==='IB')reply=replyLanguage(job)==='hi'?'IB DP के लिए SL चाहिए या HL?':replyLanguage(job)==='hinglish'?'IB DP ke liye SL chahiye ya HL?':'For IB DP, should this be SL or HL?';if(attempts)reply=(replyLanguage(job)==='hi'?'बाकी जानकारी सुरक्षित है। ':replyLanguage(job)==='hinglish'?'Baaki details saved hain. ':'The other details are saved. ')+reply;return {...p,action:'clarify',clarificationField:field,reply};}
    action='generate_paper';
  }
  if(['generate_paper','clarify','local_answer'].includes(action)&&!explicitCreation&&!(pendingCreation&&fieldAnswer)){
    const previous=(job.history || []).filter((m:any)=>m.id!==job.request.id);
    const priorAssistant=[...previous].reverse().find((m:any)=>m.role==='assistant')?.text || '';
    const scopeAnswer=Object.keys(extractScope(t,job.catalogue||{})).length>0;
    const affirmation=/^\s*(?:yes(?: please)?|go ahead|proceed|confirmed?|haan|Hindi|English|हिंदी|हाँ|हां|जी|\d{2,3}(?:\s*marks?)?)\s*[.!]?\s*$/i.test(t);
    const latest=job.context?.latestPaper;
    const requested=previous.slice(-8).some((m:any)=>m.role==='user'&&creationIntent(m.text)&&!capabilityQuestion(m.text)&&(!latest||(m.createdAt&&latest.createdAt&&m.createdAt>latest.createdAt)));
    const agreedToOffer=affirmation&&/shall I create|paper (?:bana doon|बना दूँ)|would a practice paper|would that format work|har numbered question required|सभी numbered questions ज़रूरी/i.test(priorAssistant)&&['board','standard','subject'].every(k=>scopeFromHistory(job,job.catalogue||{})[k]);
    const clarificationAsked=/(?:which|what.{0,18}(?:board|class|standard|subject)|language|marks|missing|please tell|भाषा|अंक|कौन|kaun|shall I create|paper (?:bana doon|बना दूँ)|would a practice paper|har numbered question required|सभी numbered questions ज़रूरी)|(?:shall|should|would).{0,35}(?:create|generate|prepare|make)/i.test(priorAssistant);
    const answersClarification=(scopeAnswer||affirmation)&&clarificationAsked&&(requested||agreedToOffer);
    if(answersClarification){
      const active=job.controllerFacts?.activePaperJob;
      if(active&&['queued','running','validating'].includes(active.state))return {action:'status',reply:statusReply(job)};
      action='generate_paper';
    }else if(action==='generate_paper')return affirmation?{action:'local_answer',reply:replyLanguage(job)==='en'?'What would you like to do next?':'आगे क्या करना चाहेंगे?'}:{action:'clarify',reply:scopeClarificationReply(job)};
  }
  const revisionIntent=/(?:^|[.!?]\s*|please\s+|you\s+)(?:revise|replace|change|make\b)|बदलो|बदल दो|बदल दीजिए|कठिन.{0,15}(?:करो|कर दो|बनाओ)/i.test(t);
  const newPaper=explicitCreation&&!/harder|easier|revise|replace|change|existing|same|whole|कठिन|आसान|बदल/i.test(t);
  if(job.context?.latestPaper&&revisionIntent&&!newPaper)action='revise_paper';
  if(action==='revise_paper'&&!revisionIntent)return {action:'clarify',reply:'Please state the change you want to make. I have not started a revision.'};
  let target=null;
  const m=t.match(/(?:question|ques|q\.?|प्रश्न)\s*(\d+)/i);if(m)target=Number(m[1]);
  if(action==='revise_paper'&&!job.context?.latestPaper)return {action:'clarify',reply:'Please create or select a paper in this conversation before requesting a revision.'};
  if(action==='clarify'&&(Object.keys(extractScope(t,job.catalogue||{})).length||/\b\d{2,3}\s*[- ]?\s*marks?\b/i.test(t)))return {...p,action,reply:scopeClarificationReply(job)};
  if(/^(?:yes(?: please)?|okay|ok|haan|हाँ|हां|जी)[!,.\s]*$/i.test(t)&&action!=='generate_paper')return {action:'local_answer',reply:replyLanguage(job)==='en'?'What would you like to do next?':'आगे क्या करना चाहेंगे?'};
  return {...p,action,targetQuestionNumber:target};
}
export function statusReply(job:any){const research=job.controllerFacts?.activeCurriculumJob;const a=research&&['queued','running','validating'].includes(research.state)?research:job.controllerFacts?.activePaperJob;if(!a)return 'There is no active paper task in this conversation.';const stage:Record<string,string>={waiting_for_codex:'waiting to begin',checking_curriculum_online:'checking the official curriculum online',reviewing_curriculum:'reviewing official curriculum sources',codex_starting:'starting the paper',codex_generating:'writing questions and worked answers',structure_validation:'checking marks, syllabus and structure',codex_reviewing:'reviewing the educational content',codex_correcting:'correcting review findings',preparing_documents:'preparing the printable documents',paper_ready_for_teacher_review:'ready for teacher review',retry_queued:'waiting to retry'};return `The ${a.kind==='curriculum'?'curriculum check':'paper task'} is ${a.state.replaceAll('_',' ')}. Current stage: ${stage[a.phase] || 'checking the current task'}.${a.error?' '+(a.error.message || a.error):''}`;}
export function handoff(job:any){verifyOriginals(job);return {originalUserRequest:job.request,rootUserRequest:job.rootRequest,relevantConversationHistory:job.history,establishedContext:{profile:job.profile,curriculum:job.curriculumSnapshot||job.context?.curriculum||curriculum,basePaper:job.basePaper || null},localInterpretation:{interpretation:job.interpretation,proposedActions:job.proposedActions},controllerVerified:{requirements:job.requirements,permissions:job.controllerFacts.permissions,availableData:job.controllerFacts.availableData,ownerUid:job.ownerUid,conversationId:job.conversationId,requestRevision:job.requestRevision,targetQuestionNumber:job.targetQuestionNumber ?? null}};}
