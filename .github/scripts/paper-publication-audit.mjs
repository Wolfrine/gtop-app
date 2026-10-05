// Read-only follow-up for the rejected 2026-10-05 06:17 UTC config PATCH.
// No PATCH, function invocation, deployment or Firestore mutation is possible.
const project='gtop-app';
const name='projects/gtop-app/locations/us-central1/functions/paperChatPublishPaper';
const runtime='78765581239-compute@developer.gserviceaccount.com';
const token=process.env.ACCESS_TOKEN;
if(!token)throw Error('Existing deployment access token is required.');
const safe=value=>String(value??'').replace(/Bearer\s+\S+|ya29\.[\w.-]+|eyJ[\w.-]+|([?&](?:token|key|access_token|signature)=)[^&\s]+/gi,'[redacted]').slice(0,1500);
const report=data=>console.log(JSON.stringify(data));
async function read(url,accessToken,body){
  if(!['cloudfunctions.googleapis.com','logging.googleapis.com','iamcredentials.googleapis.com'].includes(new URL(url).hostname))throw Error('Unexpected endpoint.');
  const response=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>({}));return {status:response.status,data};
}
const fn=await read('https://cloudfunctions.googleapis.com/v1/'+name,token);
if(fn.status===200)report({type:'function',name:fn.data.name,state:fn.data.status,updateTime:fn.data.updateTime,versionId:fn.data.versionId,release:fn.data.labels?.['gtop-release'],GCLOUD_PROJECT:fn.data.environmentVariables?.GCLOUD_PROJECT??null});
else report({type:'function-read-error',http:fn.status,error:safe(fn.data.error?.message)});
const body={resourceNames:['projects/'+project],filter:'protoPayload.serviceName="cloudfunctions.googleapis.com" AND (protoPayload.resourceName="'+name+'" OR resource.labels.function_name="paperChatPublishPaper") AND timestamp >= "2026-10-05T06:16:00Z" AND timestamp < "2026-10-05T06:20:00Z"',pageSize:20,orderBy:'timestamp asc'};
let result=await read('https://logging.googleapis.com/v2/entries:list',token,body);
if(result.status===403){
  const delegated=await read('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+encodeURIComponent(runtime)+':generateAccessToken',token,{scope:['https://www.googleapis.com/auth/cloud-platform'],lifetime:'600s'});
  if(delegated.status!==200)throw Error('Existing runtime delegation HTTP '+delegated.status+' '+safe(delegated.data.error?.message));
  result=await read('https://logging.googleapis.com/v2/entries:list',delegated.data.accessToken,body);
}
if(result.status!==200)throw Error('Cloud audit read HTTP '+result.status+' '+safe(result.data.error?.message));
report({type:'update-function-audit',entryCount:(result.data.entries??[]).length,truncated:!!result.data.nextPageToken,entries:(result.data.entries??[]).map(entry=>{
  const p=entry.protoPayload??{};
  return {timestamp:entry.timestamp,insertId:entry.insertId,severity:entry.severity,method:p.methodName,resource:p.resourceName,status:{code:p.status?.code,message:safe(p.status?.message),details:(p.status?.details??[]).map(detail=>({type:detail['@type'],fieldViolations:(detail.fieldViolations??[]).map(item=>({field:item.field,description:safe(item.description)})),violations:(detail.violations??[]).map(item=>({type:item.type,subject:safe(item.subject),description:safe(item.description)}))}))},requestFields:Object.keys(p.request??{}),functionFields:Object.keys(p.request?.function??{}),updateMask:p.request?.updateMask,responseFields:Object.keys(p.response??{})};
})});
report({readOnly:true,configurationWrites:0,firestoreWrites:0});
