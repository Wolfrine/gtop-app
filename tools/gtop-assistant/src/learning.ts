import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const fileFor=(dir:string,uid:string)=>path.join(dir,'learning',digest(uid)+'.json');
const load=async(file:string)=>{try{const v=JSON.parse(await readFile(file,'utf8'));return v.version===1&&Array.isArray(v.examples)?v:{version:1,examples:[]};}catch(e:any){if(e.code==='ENOENT')return {version:1,examples:[]};throw e;}};
/** Examples are quoted data, owner-scoped and non-authoritative. No generated answers or policy are learned. */
export async function recallExamples(dir:string,job:any){
  if(!job.ownerUid)return [];
  const data=await load(fileFor(dir,job.ownerUid));
  const r=job.taskBrief?.requirements||{};
  const words=new Set(String(job.request.text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);
  return data.examples.filter((e:any)=>e.ownerUid===job.ownerUid&&digest(e.request)===e.requestSha256&&e.validation==='controller-accepted-interpretation'&&['board','standard','subject'].every(k=>!r[k]||r[k]===e.requirements?.[k]))
    .map((e:any)=>({e,score:(String(e.request).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter((w:string)=>words.has(w)).length}))
    .filter((x:any)=>x.score>=2).sort((a:any,b:any)=>b.score-a.score).slice(0,2).map(({e}:any)=>({request:e.request,requirements:e.requirements,selection:e.selection,sourceJobId:e.jobId,kind:'untrusted_retrieval_example'}));
}
export async function rememberInterpretation(dir:string,job:any,plan:any){
  if(!job.ownerUid||job.taskBrief?.creationPaused||!['generate_paper','revise_paper'].includes(plan.action))return {retained:false};
  const r=job.taskBrief?.requirements;
  if(!r?.board||!r.standard||!r.subject)return {retained:false};
  const original=(job.history||[]).find((m:any)=>m.role==='user'&&m.id===job.taskBrief?.creationRequestId);
  const request=original&&original.id!==job.request.id?original.text+'\nUser follow-up: '+job.request.text:job.request.text;
  // Long input and instruction-like text stay in private job evidence, never promoted as examples.
  if(request.length>1800||/system prompt|ignore.{0,20}instruction|api.?key|password|credential|deploy|delete|permission|approved|授权|अनुमति/i.test(request))return {retained:false};
  const file=fileFor(dir,job.ownerUid),data=await load(file),key=digest(request);
  const example={ownerUid:job.ownerUid,conversationId:job.conversationId,jobId:job.id,request,requestSha256:key,requirements:{board:r.board,standard:r.standard,subject:r.subject,scope:r.scope,selectedChapters:r.selectedChapters||[],marks:r.marks},selection:plan.selection||null,validation:'controller-accepted-interpretation',createdAt:new Date().toISOString()};
  data.examples=[...data.examples.filter((e:any)=>e.requestSha256!==key),example].slice(-40);
  await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+digest(job.id).slice(0,12)+'.tmp';await writeFile(temp,JSON.stringify(data,null,2),'utf8');await rename(temp,file);
  return {retained:true,examples:data.examples.length,mode:'retrieval_examples_not_weight_training'};
}
