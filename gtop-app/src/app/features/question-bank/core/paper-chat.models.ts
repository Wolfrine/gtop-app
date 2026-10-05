import type { SavedPaperDraft } from './question-paper.domain';

export type ChatRequestStatus = 'queued'|'needs-info'|'generating'|'publishing'|'completed'|'error'|'cancelled';
export interface PaperConversation { id:string; title:string; ownerUid:string; status:ChatRequestStatus; createdAt:unknown; updatedAt:unknown; activeRequestId?:string; revision?:number; }
export interface PaperChatMessage { id:string; conversationId:string; role:'admin'|'agent'|'system'; createdBy?:string; text:string; createdAt:unknown; requestId?:string; paperId?:string; }
export interface PaperChatRequest { id:string; conversationId:string; brief:string; status:ChatRequestStatus; progress?:{step:string;reused:number;generated:number}; paperId?:string; error?:string; createdAt:unknown; revision?:number; nextRunAtIso?:string; requestedBy?:string; }
export interface ChatSavedPaper extends Omit<SavedPaperDraft,'status'> { conversationId?:string; requestRevision?:number; paperHtml?:string; answerHtml?:string; paperArtifactPath?:string; answerArtifactPath?:string; reusedQuestionCount?:number; generatedQuestionCount?:number; status:string; }
export interface PaperNotification { id:string; ownerUid:string; conversationId:string; paperId?:string; text:string; read:boolean; createdAt:unknown; }

/** Exact IST slots. At a slot already in progress, the next slot is advertised. */
export function nextPaperRun(now=new Date()):Date {
  const shifted=new Date(now.getTime()+330*60_000);
  const day=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate());
  for(const hour of [8,10,12,14,16,18,20]) {
    const slot=new Date(day+hour*3600_000-330*60_000);
    if(slot.getTime()>now.getTime())return slot;
  }
  return new Date(day+24*3600_000+8*3600_000-330*60_000);
}
export const paperStatusLabels:Record<ChatRequestStatus,string>={queued:'Queued', 'needs-info':'Needs your reply',generating:'Preparing questions',publishing:'Preparing paper',completed:'Ready',error:'Needs attention',cancelled:'Cancelled'};
