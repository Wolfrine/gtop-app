// Independent QA fixtures. Every network endpoint is a hardcoded local emulator.
// This file never starts services or changes implementation files.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function makeFixtureDocuments(prefix, uid) {
  const records = [];
  const put = (path, data) => records.push({path, data});
  const at = offset => new Date(Date.UTC(2020, 0, 1) + offset * 60_000);
  const id = suffix => `${prefix}-${suffix}`;
  const brief = `ICSE Class 9 Biology. Cells, 2 marks, short answer. Fixture ${prefix}.`;
  const html = (version, answer = false) => `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4}body{font:16px/1.6 Georgia}h1{overflow-wrap:anywhere}</style></head><body><h1>Immutable paper version ${version}</h1><p>Explain membrane folding ${version}.</p>${answer ? `<p>PRIVATE-KEY-${prefix}-${version}: folded membrane increases surface area.</p>` : ''}</body></html>`;
  const paper = (title, extra = {}) => ({schemaVersion:2, title, board:'ICSE', standard:'9', subjects:['Biology'], primarySubject:'Biology', chapters:['Cells'], chapterScopes:[{subject:'Biology',chapter:'Cells'}], marks:2, actualMarks:2, durationMinutes:10, templateId:'custom', templateName:'Written', negativeMarking:0, rules:[], coverage:{availableQuestionCount:1,requiredQuestionCount:1,gapCount:0,gaps:[]}, sections:[{id:'written',title:'Short answer',questionType:'short_answer',questionTypes:['short_answer'],subject:'Biology',difficulty:'medium',requiredCount:1,marksPerQuestion:2,competencyTags:[],questions:[{id:id('source'),questionId:id('source'),sourceCollection:'paperQuestions',origin:'bank',board:'ICSE',standard:'9',subject:'Biology',chapter:'Cells',question:'Explain membrane folding.',questionType:'short_answer',difficulty:'medium',marks:2,options:[],correctIndex:null,solutions:['Surface area increases.'],assets:[],blocks:[]}]}], status:'ready', createdBy:uid, updatedBy:uid, createdAt:at(1),updatedAt:at(1),paperHtml:html('filler'),answerHtml:html('filler',true), ...extra});

  put(`users/${uid}`, {uid,role:'admin',displayName:'Independent journey QA',board:'ICSE',standard:'9'});
  // Ensure both previous 40-chat and 20-paper caps would miss the target.
  for (let i=0;i<65;i++) {
    const conversationId=id(`filler-chat-${String(i).padStart(3,'0')}`);
    const requestId=id(`filler-request-${String(i).padStart(3,'0')}`);
    put(`paperConversations/${conversationId}`,{title:`${prefix} filler ${i}`,ownerUid:uid,status:'completed',activeRequestId:requestId,revision:1,createdAt:at(1000+i),updatedAt:at(1000+i)});
    put(`paperRequests/${requestId}`,{source:'admin-paper-chat',conversationId,brief:`${brief} filler ${i}`,requestedBy:uid,revision:1,status:'completed',paperId:id(`filler-paper-${i}`),createdAt:at(1000+i),updatedAt:at(1000+i)});
    put(`paperDrafts/${id(`filler-paper-${i}`)}`,paper(`${prefix} filler paper ${i}`,{conversationId,parentRequestId:requestId,requestRevision:1,createdAt:at(1000+i),updatedAt:at(1000+i)}));
  }

  const oldConversation=id('old-chat'), oldRequest=id('old-request'), oldPaper=id('old-paper');
  put(`paperConversations/${oldConversation}`,{title:`${prefix} buried paleontology target`,ownerUid:uid,status:'completed',activeRequestId:oldRequest,revision:1,createdAt:at(2),updatedAt:at(2)});
  put(`paperRequests/${oldRequest}`,{source:'admin-paper-chat',conversationId:oldConversation,brief:`${brief} REQUIRED-BRIEF-${prefix} full original scope.`,requestedBy:uid,revision:1,status:'completed',paperId:oldPaper,createdAt:at(2),updatedAt:at(2)});
  put(`paperMessages/${id('old-admin-message')}`,{role:'admin',createdBy:uid,conversationId:oldConversation,requestId:oldRequest,text:`${brief} REQUIRED-BRIEF-${prefix} full original scope.`,createdAt:at(2)});
  put(`paperDrafts/${oldPaper}`,paper(`${prefix} buried paleontology target`,{conversationId:oldConversation,parentRequestId:oldRequest,requestRevision:1}));

  // No conversation and no ordering timestamps: old manual data must survive.
  const dateless=paper(`${prefix} DATELESS-ARCHIVE-TARGET`,{status:'draft'});
  delete dateless.createdAt; delete dateless.updatedAt; delete dateless.paperHtml; delete dateless.answerHtml;
  put(`paperDrafts/${id('dateless-legacy')}`,dateless);
  put(`paperDrafts/${id('incomplete-legacy')}`,paper(`${prefix} incomplete legacy`,{status:'draft',actualMarks:0,sections:[],coverage:{availableQuestionCount:0,requiredQuestionCount:1,gapCount:1,gaps:[]},paperHtml:null,answerHtml:null}));

  // A completed version stays usable while its active revision needs a reply.
  const revisions=id('revisions'), active=id('revision-3');
  put(`paperConversations/${revisions}`,{title:`${prefix} retained versions`,ownerUid:uid,status:'needs-info',activeRequestId:active,revision:3,createdAt:at(5),updatedAt:at(1900)});
  for(let revision=1;revision<=3;revision++){
    const requestId=id(`revision-${revision}`),paperId=id(`version-${revision}`);
    put(`paperRequests/${requestId}`,{source:'admin-paper-chat',conversationId:revisions,brief:revision===1?brief:`Revise version ${revision-1}: use ${revision*2} marks. ${prefix}`,requestedBy:uid,revision,status:revision===3?'needs-info':'completed',...(revision<3?{paperId}:{}),createdAt:at(10+revision),updatedAt:at(10+revision)});
    put(`paperMessages/${id(`revision-message-${revision}`)}`,{role:'admin',createdBy:uid,conversationId:revisions,requestId,text:revision===1?brief:`Revise version ${revision-1}: use ${revision*2} marks. ${prefix}`,createdAt:at(10+revision)});
    if(revision<3){
      put(`paperDrafts/${paperId}`,paper(`${prefix} completed version ${revision}`,{conversationId:revisions,parentRequestId:requestId,requestRevision:revision,createdAt:at(10+revision),updatedAt:at(10+revision),paperHtml:html(revision),answerHtml:html(revision,true)}));
      put(`paperMessages/${id(`delivery-${revision}`)}`,{role:'agent',conversationId:revisions,requestId,paperId,text:`Version ${revision} is ready.`,createdAt:at(10+revision+0.1)});
    }
  }
  put(`paperMessages/${id('clarification')}`,{role:'agent',conversationId:revisions,requestId:active,text:`CLARIFY-${prefix}: Include diagrams or text only?`,createdAt:at(20)});
  put(`paperNotifications/${id('notification')}`,{ownerUid:uid,conversationId:revisions,paperId:id('version-2'),text:`${prefix} Version 2 is ready.`,read:false,createdAt:at(20)});

  // Oldest original submission is outside both former request/message windows.
  const long=id('long-history'), newest=id('history-request-160');
  put(`paperConversations/${long}`,{title:`${prefix} long conversation`,ownerUid:uid,status:'queued',activeRequestId:newest,revision:161,createdAt:at(30),updatedAt:at(1800)});
  for(let i=0;i<=160;i++){
    const requestId=id(`history-request-${i}`),text=i===0?`ORIGINAL-HISTORY-${prefix}: ICSE Biology 80 marks, diagrams required.`:`Revision ${i} ${prefix}: maintain original scope.`;
    put(`paperRequests/${requestId}`,{source:'admin-paper-chat',conversationId:long,brief:text,requestedBy:uid,revision:i+1,status:i===160?'queued':'cancelled',createdAt:at(30+i),updatedAt:at(30+i)});
    put(`paperMessages/${id(`history-message-${String(i).padStart(3,'0')}`)}`,{role:'admin',createdBy:uid,conversationId:long,requestId,text,createdAt:at(30+i)});
  }
  for(const status of ['queued','generating','publishing','error','cancelled']){
    const conversationId=id(`state-${status}`),requestId=id(`state-request-${status}`);
    put(`paperConversations/${conversationId}`,{title:`${prefix} ${status} request`,ownerUid:uid,status,activeRequestId:requestId,revision:1,createdAt:at(2100),updatedAt:at(2100)});
    put(`paperRequests/${requestId}`,{source:'admin-paper-chat',conversationId,brief,requestedBy:uid,status,revision:1,progress:{step:status==='generating'?'Checking existing bank':'Waiting for agent',reused:3,generated:1},...(status==='error'?{error:'QA deliberate publication failure; source question changed.'}:{}),createdAt:at(2100),updatedAt:at(2100)});
    put(`paperMessages/${id(`state-message-${status}`)}`,{role:'admin',createdBy:uid,conversationId,requestId,text:brief,createdAt:at(2100)});
  }
  return {records,manifest:{prefix,uid,oldConversation,oldRequest,oldPaper,revisions,active,long,newest,datelessLegacy:id('dateless-legacy'),incompleteLegacy:id('incomplete-legacy'),version1:id('version-1'),version2:id('version-2'),count:records.length}};
}

function encode(value){
  if(value===null)return{nullValue:null};
  if(value instanceof Date)return{timestampValue:value.toISOString()};
  if(Array.isArray(value))return{arrayValue:{values:value.map(encode)}};
  if(typeof value==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
  if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  if(typeof value==='boolean')return{booleanValue:value};
  return{stringValue:String(value)};
}
export async function seedLocalFixtures(prefix=`qa-journey-${Date.now()}`){
  const email=prefix+'@gtop.test',password='Independent-journey-2026';
  const signup=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  if(!signup.ok)throw Error('Local Auth fixture setup failed: '+await signup.text());
  const {localId:uid}=await signup.json();
  const {records,manifest}=makeFixtureDocuments(prefix,uid);
  await writeLocalDocuments(records);
  return{...manifest,email,password};
}
export async function writeLocalDocuments(records){
  for(let i=0;i<records.length;i+=200){
    const result=await fetch('http://127.0.0.1:8080/v1/projects/gtop-app/databases/(default)/documents:commit',{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({writes:records.slice(i,i+200).map(({path,data})=>({update:{name:'projects/gtop-app/databases/(default)/documents/'+path,fields:encode(data).mapValue.fields}}))})});
    if(!result.ok)throw Error('Local Firestore fixture setup failed: '+await result.text());
  }
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(process.argv.includes('--seed')){
    const manifest=await seedLocalFixtures();
    const path=new URL('./manifest.json',import.meta.url);
    writeFileSync(path,JSON.stringify(manifest,null,2));
    console.log(JSON.stringify({localOnly:true,prefix:manifest.prefix,records:manifest.count,manifest:fileURLToPath(path)}));
  } else {
    const {manifest}=makeFixtureDocuments('qa-dry-run','local-admin');
    console.log(JSON.stringify({dryRun:true,...manifest}));
  }
}
