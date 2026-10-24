import {curriculum} from '../../../assistant-service/domain/index.mjs';
import {statusReply,socialReply,scopeClarificationReply} from './policy.js';
import {capabilitiesReply,scopeFromHistory} from '../../../assistant-service/domain/catalogue.mjs';
/** Arithmetic only: a bounded recursive-descent parser, never JavaScript evaluation. */
export function calculate(expression:string){
  if(expression.length>160||!/^[\d.eE+*/^()\s-]+$/.test(expression))throw Error('Use only a short numeric expression.');
  const tokens=expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+*/^-]/g) || [];let i=0,steps=0;
  if(tokens.join('')!==expression.replace(/\s/g,''))throw Error('Malformed numeric expression.');
  const primary=():number=>{if(++steps>100)throw Error('Calculation too complex.');if(tokens[i]==='('){i++;const v=sum();if(tokens[i++]!==')')throw Error('Unbalanced parentheses.');return v;}const token=tokens[i++];if(!token||!/^\d|^\.\d/.test(token))throw Error('Expected a number.');return Number(token);};
  const power=():number=>{const a=primary();if(tokens[i]==='^'){i++;const exponent=unary();if(Math.abs(exponent)>100)throw Error('Exponent too large.');return a**exponent;}return a;};
  const unary=():number=>{if(tokens[i]==='+'){i++;return unary();}if(tokens[i]==='-'){i++;return -unary();}return power();};
  const product=():number=>{let v=unary();while(['*','/'].includes(tokens[i])){const op=tokens[i++],b=unary();if(op==='/'&&b===0)throw Error('Division by zero.');v=op==='*'?v*b:v/b;}return v;};
  const sum=():number=>{let v=product();while(['+','-'].includes(tokens[i])){const op=tokens[i++],b=product();v=op==='+'?v+b:v-b;}return v;};
  const value=sum();if(i!==tokens.length||!Number.isFinite(value)||Math.abs(value)>1e100)throw Error('Calculation is incomplete or outside the safe range.');return value;
}
/** Closed capability registry. Model text never names executable commands or grants permission. */
export const tools=Object.freeze({
  syllabus:{version:2,description:'Read the controller-selected curriculum snapshot.',run:(job:any)=>job.context?.curriculum||null},
  status:{version:1,description:'Read gateway-owned job state.',run:(job:any)=>job.controllerFacts.activePaperJob},
  ownQuestion:{version:1,description:'Read a question from the gateway-verified current owned paper.',run:(job:any,number:number)=>{if(!Number.isInteger(number)||number<1||number>100)throw Error('Question number must be1–100.');return job.context?.latestPaper?.sections.flatMap((s:any)=>s.questions).find((q:any)=>q.number===number) || null;}},
  calculate:{version:1,description:'Evaluate a short numeric expression without code execution.',run:calculate},
});
export function groundedReply(job:any,p:any){
  const t=job.request.text, hindi=/हिंदी|हिन्दी|हिंग्लिश|Hindi|Hinglish|samjhao|kaun|honge|kya/i.test(t);
  const active=job.controllerFacts?.activePaperJob;
  const social=socialReply(job);if(social)return social;
  if(p.action==='describe_capabilities')return capabilitiesReply(job,job.catalogue||{});
  if(/I can only explain|my scope is limited to explaining|only support.{0,35}Class 12|cannot (?:generate|create) (?:any |question )?papers/i.test(p.reply||''))return capabilitiesReply(job,job.catalogue||{});
  const inFlight=active&&['queued','running','validating'].includes(active.state);
  if(/(?:cancel|stop).{0,25}(?:paper|request|task)|(?:paper|request|task).{0,25}(?:cancel|stop)|रद्द|रोक दो/i.test(t)&&inFlight)return (hindi?'अनुरोध रोकने के लिए “Cancel request” दबाएँ। ':'Use “Cancel request” to stop this task. ')+statusReply(job);
  const arithmetic=t.match(/^\s*(?:calculate|what is|evaluate)\s+([\d.eE+*/^()\s-]+)\??\s*$/i);if(arithmetic)try{return arithmetic[1].trim()+' = '+tools.calculate.run(arithmetic[1]);}catch(e:any){return e.message;}
  if(/(?:which|what|kaun|कौन).{0,35}(?:chapters?|अध्याय)|(?:chapters?|अध्याय).{0,35}(?:cover|होंगे|honge)/i.test(t)){
    const pinned=job.curriculumSnapshot||job.context?.curriculum;
    if(!pinned?.chapters?.length)return hindi?'कृपया board, class और subject बताइए ताकि मैं GTOP का सही syllabus देख सकूँ।':'Please tell me the board, class and subject so I can look up the right GTOP curriculum.';
    const titles=pinned.chapters.map((c:any)=>c.title).join('; ');
    return (hindi?'चुने हुए syllabus के chapters हैं: ':'The selected curriculum covers these chapters: ')+titles+'.'+(inFlight?(hindi?' आपका paper अभी बन रहा है। ':' Your paper is being prepared. ')+statusReply(job):'');
  }
  if(p.action==='status')return statusReply(job);
  const scope=scopeFromHistory(job,job.catalogue||{});
  const userTexts=[...(job.history||[]).filter((m:any)=>m.role==='user').map((m:any)=>m.text),t];
  const marksKnown=userTexts.some((text:string)=>/\b\d{2,3}\s*[- ]?\s*(?:marks?|अंक)/i.test(text));
  const repeatsKnown=(scope.board&&/which board|what board|कौन.?सा बोर्ड/i.test(p.reply||''))||(scope.standard&&/which (?:class|standard)|what (?:class|standard)|कौन.?सी कक्षा/i.test(p.reply||''))||(scope.subject&&/which subject|what subject|कौन.?सा विषय/i.test(p.reply||''))||(marksKnown&&/how many marks|what.{0,12}mark total|कितने (?:marks|अंक)/i.test(p.reply||''));
  if(repeatsKnown&&!inFlight&&!/(?:explain|why|how|समझा|क्यों)/i.test(t))return scopeClarificationReply(job);
  // Fail closed on unverified execution claims. Conversation may never invent a delivered artifact.
  const claimsDone=/(?:paper|files?|documents?).{0,35}(?:ready|completed|finished|generated)|(?:generated|created|completed).{0,20}(?:paper|files?)|पेपर.{0,20}(?:तैयार|बन गया)/i.test(p.reply || '');
  if(/(?:cancelled|canceled|stopped|रद्द)/i.test(p.reply || '')&&active?.state!=='cancelled')return statusReply(job);
  const asksToStart=/(?:shall|should|would you|do you want|kya aap).{0,100}(?:generate|codex|create)|(?:ready|तैयार).{0,30}(?:generate|बनाने)/i.test(p.reply || '');
  if((claimsDone&&!job.context?.latestPaper)||(inFlight&&(claimsDone||asksToStart)))return (hindi?'आपका अनुरोध सुरक्षित है। ':'Your request is saved. ')+statusReply(job);
  return p.reply?.trim() || (hindi?'बताइए, मैं आपकी किस तरह मदद करूँ?':'Please tell me what you would like help with.');
}
