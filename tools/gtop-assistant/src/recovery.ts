import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {hash,paperContent,validatePaper,validateRevision} from '../../../assistant-service/domain/index.mjs';
import {record} from './adapters.js';
export function inputBinding(job:any){return hash({ownerUid:job.ownerUid,conversationId:job.conversationId,request:job.request,rootRequest:job.rootRequest,requirements:job.requirements,operation:job.operation || 'generate_paper',targetQuestionNumber:job.targetQuestionNumber ?? null,base:job.basePaper?hash(paperContent(job.basePaper)):null,...(job.curriculumSnapshot?{curriculumHash:hash(job.curriculumSnapshot)}:{})});}
export async function saveValidated(dir:string,job:any,paper:any,metrics:any){await record(dir,'validated-output.json',{version:1,binding:inputBinding(job),paper,paperHash:hash(paperContent(paper)),independentReviewPassed:true,metrics});}
export async function recoverValidated(root:string,job:any,depth=0):Promise<any>{
  if(depth>8)throw Error('Retry history is too deep; manual review is required.');
  if(!job.retryOf)return null;if(!/^[a-zA-Z0-9_-]{1,128}$/.test(job.retryOf))throw Error('Invalid retry source.');
  const dir=path.join(root,'jobs',job.retryOf);let cached:any;
  try{cached=JSON.parse(await readFile(path.join(dir,'validated-output.json'),'utf8'));}catch(e:any){if(e.code!=='ENOENT')throw Error('Retained result is corrupt; manual review is required.');
    // Upgrade the first pilot run's completed review after its artifact-size delivery failure.
    try{const [old,paper,validation,review,execution]=await Promise.all(['job.json','paper.json','validation.json','review.json','review/execution.json'].map(async f=>JSON.parse(await readFile(path.join(dir,f),'utf8'))));
      if(inputBinding(old)!==inputBinding(job)||!validation.passed||review.verdict!=='pass'||review.issues.length||!execution.completed||execution.exitCode!==0||validation.paperContentSha256!==hash(paperContent(paper)))return null;
      cached={version:1,binding:inputBinding(old),paper,paperHash:validation.paperContentSha256,independentReviewPassed:true,metrics:{recoveredFromInitialDeliveryFailure:true}};
    }catch{try{const old=JSON.parse(await readFile(path.join(dir,'job.json'),'utf8'));if(old.retryOf&&inputBinding(old)===inputBinding(job))return recoverValidated(root,{...job,retryOf:old.retryOf},depth+1);}catch{}return null;}
  }
  if(cached.version!==1||cached.binding!==inputBinding(job)||cached.paperHash!==hash(paperContent(cached.paper))||cached.independentReviewPassed!==true)throw Error('Retained result does not match this retry request.');
  validatePaper(cached.paper,job.requirements,job.curriculumSnapshot||job.context?.curriculum||null);if(job.basePaper)validateRevision(job.basePaper,cached.paper,job.targetQuestionNumber ?? null,job.curriculumSnapshot||job.context?.curriculum||null);
  return {...cached,reusedFrom:job.retryOf};
}
