import {curriculum} from '../../../assistant-service/domain/index.mjs';
import {statusReply} from './policy.js';
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
  syllabus:{version:1,description:'Read the pinned ten-chapter Chemistry syllabus.',run:()=>curriculum},
  status:{version:1,description:'Read gateway-owned job state.',run:(job:any)=>job.controllerFacts.activePaperJob},
  ownQuestion:{version:1,description:'Read a question from the gateway-verified current owned paper.',run:(job:any,number:number)=>{if(!Number.isInteger(number)||number<1||number>100)throw Error('Question number must be1–100.');return job.context?.latestPaper?.sections.flatMap((s:any)=>s.questions).find((q:any)=>q.number===number) || null;}},
  calculate:{version:1,description:'Evaluate a short numeric expression without code execution.',run:calculate},
});
export function groundedReply(job:any,p:any){
  const t=job.request.text, hindi=/हिंदी|हिन्दी|हिंग्लिश|Hindi|Hinglish|samjhao|kaun|honge|kya/i.test(t);
  const active=job.controllerFacts?.activePaperJob;
  const inFlight=active&&['queued','running','validating'].includes(active.state);
  const arithmetic=t.match(/^\s*(?:calculate|what is|evaluate)\s+([\d.eE+*/^()\s-]+)\??\s*$/i);if(arithmetic)try{return arithmetic[1].trim()+' = '+tools.calculate.run(arithmetic[1]);}catch(e:any){return e.message;}
  if(/(?:which|what|kaun|कौन).{0,35}(?:chapters?|अध्याय)|(?:chapters?|अध्याय).{0,35}(?:cover|होंगे|honge)/i.test(t)){
    const titles=tools.syllabus.run().chapters.map(c=>c.title).join('; ');
    return (hindi?'पूरे syllabus में ये दस chapters हैं: ':'The full syllabus covers these ten chapters: ')+titles+'.'+(inFlight?(hindi?' आपका paper अभी बन रहा है। ':' Your paper is being prepared. ')+statusReply(job):'');
  }
  if(p.action==='status')return statusReply(job);
  // Fail closed on unverified execution claims. Conversation may never invent a delivered artifact.
  const claimsDone=/(?:paper|files?|documents?).{0,35}(?:ready|completed|finished|generated)|(?:generated|created|completed).{0,20}(?:paper|files?)|पेपर.{0,20}(?:तैयार|बन गया)/i.test(p.reply || '');
  const asksToStart=/(?:shall|should|would you|do you want|kya aap).{0,100}(?:generate|codex|create)|(?:ready|तैयार).{0,30}(?:generate|बनाने)/i.test(p.reply || '');
  if((claimsDone&&!job.context?.latestPaper)||(inFlight&&(claimsDone||asksToStart)))return (hindi?'आपका अनुरोध सुरक्षित है। ':'Your request is saved. ')+statusReply(job);
  return p.reply?.trim() || (hindi?'बताइए, मैं आपकी किस तरह मदद करूँ?':'Please tell me what you would like help with.');
}
