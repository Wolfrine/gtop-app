import {object} from '../../../assistant-service/domain/schemas.mjs';
import {buildTaskBrief,creationIntent,prohibitedCreation,requirementDiscussion,missingTaskField} from '../../../assistant-service/domain/task-brief.mjs';
import {capabilityQuestion,latestRequest} from '../../../assistant-service/domain/catalogue.mjs';

export const planSchema=object({reply:{type:'string'},action:{type:'string',enum:['local_answer','clarify','generate_paper','revise_paper','explain_paper','check_curriculum','status','unsupported']},interpretation:{type:'string'},clarificationField:{type:['string','null'],enum:[null,'board','standard','subject','selectedChapters','programme','level','course','subjectCode','examYear','edition','curriculum','format']},selection:{anyOf:[{type:'null'},object({chapters:{type:'array',items:{type:'string'}},sourceMessageId:{type:'string'},quote:{type:'string'}})]}});
export function escalationReason(job:any,proposal?:any){
  const t=job.request.text,brief=job.taskBrief||buildTaskBrief(job),r=brief.requirements;
  if(prohibitedCreation(t)||brief.creationPaused||capabilityQuestion(t)||/\b(?:status|progress|how long|deploy|delete|credentials?)\b|कहाँ तक/i.test(t))return null;
  const asked=(job.history||[]).some((m:any)=>m.role==='assistant'&&(m.clarificationField||/[?？]/.test(m.text)));
  if(proposal&&/cannot understand|can.t understand|couldn.t understand|not sure what|please clarify|samajh.{0,12}nahi|समझ.{0,12}नहीं/i.test(proposal.reply||''))return 'local_interpretation_unresolved';
  if(proposal?.action==='unsupported'||(proposal?.action==='clarify'&&(!brief.creationRequestId||!missingTaskField(brief)||asked)))return 'local_interpretation_unresolved';
  if(requirementDiscussion(t))return null;
  if(job.controllerFacts?.activePaperJob&&['queued','running','validating'].includes(job.controllerFacts.activePaperJob.state))return null;
  if(latestRequest(t))return 'requested_curriculum_check';
  const pending=!!brief.creationRequestId;
  if(pending&&r.board&&r.standard&&r.subject)return 'paper_requirements_ready';
  const rootIndex=(job.history||[]).findIndex((m:any)=>m.id===brief.creationRequestId);
  const recent=(job.history||[]).slice(Math.max(0,rootIndex));
  const clarifications=Math.max(brief.clarificationTurns||0,recent.filter((m:any)=>m.role==='assistant'&&(m.clarificationField||/[?？]/.test(m.text))).length);
  if(pending&&clarifications>=1)return 'clarification_budget_reached';
  if(proposal&&(proposal.action==='unsupported'||proposal.action==='clarify')&&(pending||creationIntent(t)))return 'local_interpretation_unresolved';
  return null;
}
