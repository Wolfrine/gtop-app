import {officialUrl} from '../../../assistant-service/domain/catalogue.mjs';
/** Keep incomplete research useful without activating it or implying curriculum approval. */
export function incompleteCurriculumReply(value:any,board:string){
  const sources=(value.sources||[]).slice(0,3).flatMap((s:any)=>{try{return [String(s.title||'Official source')+' — '+officialUrl(s.url,board)+' ('+String(s.applicableYear||'year unverified')+'; '+String(s.locator||'section unverified')+')'];}catch{return [];}});
  const chapters=(value.chapters||[]).slice(0,100).map((c:any)=>String(c.title||'')).filter(Boolean);
  const issues=(value.limitations||[]).slice(0,6).map((s:any)=>String(s));
  return [String(value.reply||'The official curriculum check needs clarification.'),chapters.length?'Provisional chapter findings (incomplete; not activated): '+chapters.join('; '):'',sources.length?'Official sources consulted:\n'+sources.join('\n'):'',issues.length?'Issues for review:\n'+issues.map((s:string)=>'- '+s).join('\n'):'','The selected curriculum and existing papers are unchanged. Please have the teacher resolve any disputed coverage before treating this as the complete examination syllabus.'].filter(Boolean).join('\n\n').slice(0,12000);
}
