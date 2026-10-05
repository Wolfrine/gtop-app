// Read-only: configuration GETs, IAM permission checks, short-lived delegation,
// and Cloud Logging entries:list. No function calls, deployments or data writes.
import {createHash} from 'node:crypto';

const project='gtop-app';
const runtime='78765581239-compute@developer.gserviceaccount.com';
const originalToken=process.env.ACCESS_TOKEN;
if(!originalToken)throw Error('Existing deployment access token is required.');
const permissionFor={functions:'cloudfunctions.functions.get',eventarc:'eventarc.triggers.list',logging:'logging.logEntries.list'};
let runtimeToken;
let denials=0;
const report=(type,data)=>console.log(JSON.stringify({type,...data}));
async function request(url,token,body){
  const response=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  return {status:response.status,data:await response.json().catch(()=>({}))};
}
async function delegate(){
  if(runtimeToken!==undefined)return runtimeToken;
  const result=await request('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+encodeURIComponent(runtime)+':generateAccessToken',originalToken,{scope:['https://www.googleapis.com/auth/cloud-platform'],lifetime:'600s'});
  if(result.status!==200){report('access-denied',{operation:'existing-runtime-delegation',http:result.status,requiredPermission:'iam.serviceAccounts.getAccessToken'});runtimeToken=null;return null;}
  runtimeToken=result.data.accessToken;
  report('delegation',{account:runtime,lifetimeSeconds:600});
  return runtimeToken;
}
async function read(kind,label,url,body){
  let result=await request(url,originalToken,body);let identity='deployment';
  if(result.status===403){const token=await delegate();if(token){result=await request(url,token,body);identity='existing-runtime';}}
  if(result.status===403){denials++;report('access-denied',{operation:label,http:403,requiredPermission:permissionFor[kind]});return null;}
  if(result.status===404){report('not-found',{operation:label,http:404});return null;}
  if(result.status!==200){report('inspection-failed',{operation:label,http:result.status,code:result.data.error?.status});return null;}
  report('read',{operation:label,identity});return result.data;
}
function publicFunction(fn){
  const env=fn.environmentVariables??fn.serviceConfig?.environmentVariables??{};
  return {name:fn.name,state:fn.status??fn.state,runtime:fn.runtime??fn.buildConfig?.runtime,entryPoint:fn.entryPoint??fn.buildConfig?.entryPoint,serviceAccount:fn.serviceAccountEmail??fn.serviceConfig?.serviceAccountEmail,updateTime:fn.updateTime,release:fn.labels?.['gtop-release'],trigger:fn.eventTrigger,environment:{GCLOUD_PROJECT:env.GCLOUD_PROJECT??null,FIREBASE_CONFIG_present:Object.hasOwn(env,'FIREBASE_CONFIG'),GOOGLE_CLOUD_PROJECT:env.GOOGLE_CLOUD_PROJECT??null}};
}
for(const [generation,name] of [['v1','paperChatPublishPaper'],['v2','publishPaper']]){
  const fn=await read('functions',generation+':'+name,'https://cloudfunctions.googleapis.com/'+generation+'/projects/'+project+'/locations/us-central1/functions/'+name);
  if(fn)report('function',publicFunction(fn));
}
const triggers=await read('eventarc','publication-trigger-metadata','https://eventarc.googleapis.com/v1/projects/'+project+'/locations/us-central1/triggers?pageSize=30');
if(triggers){const matches=(triggers.triggers??[]).filter(t=>/paper|publish/i.test(t.name+' '+JSON.stringify(t.destination)));report('eventarc',{scanned:(triggers.triggers??[]).length,truncated:!!triggers.nextPageToken,matches:matches.map(t=>({name:t.name,eventFilters:t.eventFilters,destination:t.destination,serviceAccount:t.serviceAccount,conditions:t.conditions}))});}
function summarize(entry){
  const raw=String(entry.textPayload??entry.jsonPayload?.message??entry.jsonPayload?.error??'');
  const labels=[];
  const known=[[/process\.env\.GCLOUD_PROJECT is not set/i,'missing-GCLOUD_PROJECT'],[/FIREBASE_CONFIG and GCLOUD_PROJECT environment variables are missing/i,'missing-Firebase-config'],[/PERMISSION_DENIED|permission denied|does not have permission/i,'permission-denied'],[/DEADLINE_EXCEEDED|timed out|timeout/i,'timeout'],[/Paper publication failed/i,'publication-handler-error'],[/TypeError/i,'type-error'],[/ReferenceError/i,'reference-error'],[/Function execution started/i,'invocation-start'],[/Function execution took.*finished/i,'invocation-end']];
  for(const [pattern,label] of known)if(pattern.test(raw))labels.push(label);
  const errorLine=raw.split('\n').find(line=>/process\.env\.GCLOUD_PROJECT is not set|(?:^|\s)(?:Error|TypeError|ReferenceError):|PERMISSION_DENIED|Paper publication failed/.test(line));
  const safe=errorLine?.replace(/Bearer\s+\S+|ya29\.[\w.-]+|eyJ[\w.-]+|([?&](?:token|key|access_token)=)[^&\s]+/gi,'[redacted]').slice(0,300);
  return {timestamp:entry.timestamp,severity:entry.severity,insertId:entry.insertId,executionId:entry.labels?.execution_id,signals:labels,...(safe?{error:safe}:{}),payloadSha256:createHash('sha256').update(raw).digest('hex')};
}
const functionFilter='resource.type="cloud_function" AND resource.labels.function_name="paperChatPublishPaper" AND resource.labels.region="us-central1"';
const recent=new Date(Date.now()-6*60*60*1000).toISOString();
for(const [label,extra,pageSize,orderBy] of [
  ['original-publication-window','timestamp >= "2026-10-04T12:40:00Z" AND timestamp < "2026-10-04T13:10:00Z"',40,'timestamp asc'],
  ['recent-publication-errors','timestamp >= "'+recent+'" AND severity >= ERROR',30,'timestamp desc']
]){
  const data=await read('logging',label,'https://logging.googleapis.com/v2/entries:list',{resourceNames:['projects/'+project],filter:functionFilter+' AND '+extra,pageSize,orderBy});
  if(data)report('logs',{window:label,entryCount:(data.entries??[]).length,truncated:!!data.nextPageToken,entries:(data.entries??[]).map(summarize)});
}
report('complete',{readOnly:true,accessDenials:denials});
if(denials)process.exitCode=2;
