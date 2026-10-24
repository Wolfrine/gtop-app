import {object} from './schemas.mjs';
import {validateScope,validateCurriculumScope,scopeKeys,sameScope,officialUrl} from './catalogue.mjs';
import {createHash} from 'node:crypto';
const string={type:'string'};
export const curriculumResearchSchema=object({status:{type:'string',enum:['found','needs_clarification','unavailable']},reply:string,board:string,standard:string,subject:string,academicYear:string,examYear:string,programme:string,level:string,subjectCode:string,edition:string,title:string,complete:{type:'boolean'},chapters:{type:'array',items:object({id:string,title:string,focus:string})},sources:{type:'array',items:object({url:string,title:string,applicableYear:string,locator:string})},limitations:{type:'array',items:string}});
export function validateResearchCandidate(result,requirements){
  validateCurriculumScope(requirements);
  if(result.status!=='found'||result.complete!==true)throw Error(result.reply||'The official curriculum is incomplete or needs clarification.');
  if(!sameScope(result,requirements))throw Error('Online curriculum scope or programme/level/code/cohort/edition changed. Please confirm the exact scope first.');
  if(!result.chapters?.length||result.chapters.length>100||new Set(result.chapters.map(c=>c.title.trim().toLowerCase())).size!==result.chapters.length||result.chapters.some(c=>!c.title.trim()||!c.focus.trim()))throw Error('Official chapter coverage is incomplete or duplicated.');
  if(!result.sources?.length||result.sources.length>3)throw Error('Provide 1–3 official curriculum sources.');
  const start=Number(requirements.academicYear.slice(0,4));
  for(const s of result.sources){officialUrl(s.url,requirements.board);if(!s.applicableYear||!s.locator||!s.title)throw Error('Every source needs its year and page/section.');if(![String(start),String(start+1)].some(y=>s.applicableYear.includes(y)))throw Error('Official source does not identify the requested academic/examination year.');}
  return result;
}
export function researchCurriculum(result,requirements,proofs=[]){
  validateResearchCandidate(result,requirements);
  if(!Array.isArray(proofs)||proofs.length!==result.sources.length)throw Error('Official source retrieval proofs are missing.');
  for(const s of result.sources){const p=proofs.find(p=>p.url===s.url);if(!p||!/^[a-f0-9]{64}$/.test(p.sha256)||p.bytes<=0||p.bytes>12_000_000||!Number.isFinite(Date.parse(p.checkedAt)))throw Error('Official source retrieval was not verified by the controller.');officialUrl(p.finalUrl,requirements.board);}
  const id='official-'+createHash('sha256').update(JSON.stringify({result,proofs:proofs.map(p=>({url:p.url,sha256:p.sha256}))})).digest('hex').slice(0,28);
  return {id,...Object.fromEntries(scopeKeys.map(k=>[k,result[k]||''])),title:result.title,url:result.sources[0].url,chapters:result.chapters,sources:result.sources,provenance:{kind:'official-online-check',yearVerified:true,checkedAt:proofs[0].checkedAt,sourceProofs:proofs,centralCatalogueApproval:false},notice:'Custom practice paper based on the selected official curriculum checked on '+proofs[0].checkedAt.slice(0,10)+'. Not an official examination paper. Teacher review is required.'};
}
export async function retrieveOfficialSource(source,board,fetcher=fetch){
  let url=officialUrl(source.url,board);
  for(let redirect=0;redirect<4;redirect++){
    const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
    if([301,302,303,307,308].includes(response.status)){const next=response.headers.get('location');if(!next)throw Error('Official source redirect has no destination.');url=officialUrl(new URL(next,url).href,board);continue;}
    if(!response.ok)throw Error('Official curriculum source could not be retrieved ('+response.status+').');
    const chunks=[];let bytes=0;for await(const part of response.body){bytes+=part.length;if(bytes>12_000_000)throw Error('Official source exceeds the 12 MB retrieval bound.');chunks.push(part);}
    if(!bytes)throw Error('Official source was empty.');
    return {url:source.url,finalUrl:url,sha256:createHash('sha256').update(Buffer.concat(chunks)).digest('hex'),bytes,contentType:response.headers.get('content-type')||'',checkedAt:new Date().toISOString()};
  }
  throw Error('Official source has too many redirects.');
}
