export interface UserSummary {uid:string;displayName:string;email:string;libraryAccess?:boolean}
export interface WorkerStatus {state:string;lastSeenAt?:string|null;modelReady:boolean}
export interface PilotSession {user:UserSummary;worker:WorkerStatus;capabilities:unknown;defaults:Record<string,unknown>}
export interface Conversation {id:string;title:string;status:string;updatedAt:string;activePaperJobId?:string;activeCurriculumJobId?:string;latestPaperId?:string;ownerUid?:string;creatorName?:string;createdAt?:string}
export interface Message {id:string;conversationId:string;role:'user'|'assistant'|'system';text:string;createdAt:string;jobId?:string;paperId?:string}
export interface Job {id:string;kind:'turn'|'paper';ownerUid:string;conversationId:string;state:string;phase:string;createdAt:string;updatedAt:string;elapsedSeconds?:number;error?:string|{message?:string;code?:string};paperId?:string;retryable?:boolean}
export interface LibraryMetadata {ownerUid?:string;creatorName?:string;board?:string;standard?:string;subject?:string;academicYear?:string}
export interface PaperSummary extends LibraryMetadata {id:string;title:string;revision:number;marks:number;createdAt:string;jobId:string;conversationId?:string}
export interface ConversationDetail {conversation:Conversation;messages:Message[];jobs:Job[];papers:PaperSummary[];readOnly?:boolean;creatorName?:string}
export type LibraryKind='papers'|'conversations';
export interface LibraryItem extends LibraryMetadata {id:string;title:string;createdAt:string;updatedAt?:string;conversationId?:string;revision?:number;marks?:number;jobId?:string;status?:string;latestPaperId?:string}
export interface LibraryPage {items:LibraryItem[];nextCursor:string|null}
export interface LibraryFilters {board:string;standard:string;subject:string;text:string}
export interface Transport {request<T>(path:string,method?:string,body?:unknown):Promise<T>;artifact(id:string,kind:'student'|'answers'):Promise<string>;adminArtifact?(id:string,kind:'student'|'answers'):Promise<string>}

export function libraryMatches(item:LibraryItem,filters:LibraryFilters):boolean {
  const normal=(value:unknown)=>String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  for(const key of ['board','standard','subject'] as const)if(filters[key]&&normal(item[key])!==normal(filters[key]))return false;
  const query=normal(filters.text);
  return !query||normal([item.title,item.creatorName,item.board,item.standard,item.subject,item.academicYear].filter(Boolean).join(' ')).includes(query);
}
export function mergeLibraryItems(current:LibraryItem[],incoming:LibraryItem[]):LibraryItem[]{return Array.from(new Map([...current,...incoming].map(item=>[item.id,item])).values());}
export function conversationReadOnly(detail:ConversationDetail|undefined,uid:string|undefined):boolean{return detail?.readOnly===true||!!(detail?.conversation.ownerUid&&detail.conversation.ownerUid!==uid);}
