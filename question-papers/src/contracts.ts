export interface UserSummary {uid:string;displayName:string;email:string;libraryAccess?:boolean}
export interface WorkerStatus {state:string;lastSeenAt?:string|null;modelReady:boolean}
export interface AssistantServiceStatus {workerId:string;launchMode?:'host';state:'ready'|'offline'|'starting'|'failed'|'starter_offline';starter:{state:'online'|'offline';lastSeenAt:string|null};worker:WorkerStatus;request:{id:string;state:string;requestedAt:string;expiresAt:string;errorCode:string|null}|null;canStart:boolean}
export interface PilotSession {user:UserSummary;worker:WorkerStatus;service?:AssistantServiceStatus|null;notifications?:import('./owner-events').Notifications;contentRevision?:string;capabilities:unknown;defaults:Record<string,unknown>}
export interface Conversation {id:string;title:string;status:string;updatedAt:string;activePaperJobId?:string;activeCurriculumJobId?:string;latestPaperId?:string;ownerUid?:string;creatorName?:string;createdAt?:string}
export interface ConversationList {conversations:Conversation[];nextCursor?:string|null}
export interface Message {id:string;conversationId:string;role:'user'|'assistant'|'system';text:string;createdAt:string;jobId?:string;paperId?:string}
export interface Job {id:string;kind:'turn'|'paper'|'curriculum';native?:boolean;ownerUid:string;conversationId:string;state:string;phase:string;createdAt:string;updatedAt:string;nextLeaseCheckAt?:string;elapsedSeconds?:number;progress?:{completed:number;total:number}|null;errorCode?:string|null;error?:string|{message?:string;code?:string};paperId?:string;retryable?:boolean}
export interface LibraryMetadata {ownerUid?:string;creatorName?:string;board?:string;standard?:string;subject?:string;academicYear?:string}
export interface PaperSummary extends LibraryMetadata {id:string;title:string;revision:number;marks:number;createdAt:string;jobId:string;conversationId?:string;verifiedSectionPattern?:boolean}
export interface ConversationDetail {conversation:Conversation;messages:Message[];jobs:Job[];papers:PaperSummary[];history?:{messages:string|null;papers:string|null};readOnly?:boolean;creatorName?:string}
export type LibraryKind='papers'|'conversations';
export interface LibraryItem extends LibraryMetadata {id:string;title:string;createdAt:string;updatedAt?:string;conversationId?:string;revision?:number;marks?:number;jobId?:string;status?:string;latestPaperId?:string}
export interface LibraryPage {items:LibraryItem[];nextCursor:string|null}
export interface LibraryFilters {board:string;standard:string;subject:string;text:string;year?:string}
export interface Transport {request<T>(path:string,method?:string,body?:unknown):Promise<T>;artifact(id:string,kind:'student'|'answers'):Promise<string>;adminArtifact?(id:string,kind:'student'|'answers'):Promise<string>}

export function libraryMatches(item:LibraryItem,filters:LibraryFilters):boolean {
  const normal=(value:unknown)=>String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  const date = item.updatedAt || item.createdAt || '';
  if (filters.year && date.slice(0, 4) !== filters.year) return false;
  const searchable = (value: unknown) => normal(value)
    .replace(/\b(?:standard|grade|std)\.?\s*(?=\d)/g, 'class ')
    .replace(/\bclass\s*(?=\d)/g, 'class ')
    .replace(/\bmaths?\b/g, 'mathematics');
  const standard=(value:unknown)=>searchable(value).replace(/^class\s+/,'');
  if (filters.board && normal(filters.board)!==normal(item.board)) return false;
  if (filters.standard && standard(filters.standard)!==standard(item.standard)) return false;
  if (filters.subject && searchable(filters.subject)!==searchable(item.subject)) return false;
  const words = searchable(filters.text).split(/\s+/).filter(Boolean);
  const context = searchable([item.title, item.creatorName, item.board, item.standard && 'Class ' + item.standard,
    item.subject, item.academicYear, date.slice(0, 10), item.marks && item.marks + ' marks'].filter(Boolean).join(' '));
  return words.every(word => context.includes(word));
}
export function mergeLibraryItems(current:LibraryItem[],incoming:LibraryItem[]):LibraryItem[]{return Array.from(new Map([...current,...incoming].map(item=>[item.id,item])).values());}
export function conversationReadOnly(detail:ConversationDetail|undefined,uid:string|undefined):boolean{return detail?.readOnly===true||!!(detail?.conversation.ownerUid&&detail.conversation.ownerUid!==uid);}
