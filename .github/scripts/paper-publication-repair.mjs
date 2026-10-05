// One reviewed configuration mutation, no source deployment or Firestore writes.
// API: https://cloud.google.com/functions/docs/reference/rest/v1/projects.locations.functions/patch
// GCF v1 offers no etag precondition. Pinned double-read preflight plus exclusive
// workflow execution detect observed drift; they cannot lock direct cloud edits.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';

const name='projects/gtop-app/locations/us-central1/functions/paperChatPublishPaper';
const endpoint='https://cloudfunctions.googleapis.com/v1/'+name;
const project='gtop-app';
const expectedRelease='fb386cb93f2fd5e8f96b6cc42c9a86975f7af79c';
const expectedUpdateTime='2026-10-04T09:35:17.764Z';
const expectedVersion='3';
assert(process.env.ACCESS_TOKEN,'Existing deployment access token is required.');
const log=data=>console.log(JSON.stringify(data));
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const fingerprint=value=>createHash('sha256').update(stable(value)).digest('hex');
const safeError=value=>String(value??'').replace(/Bearer\s+\S+|ya29\.[\w.-]+|eyJ[\w.-]+|([?&](?:token|key|access_token|signature)=)[^&\s]+/gi,'[redacted]').slice(0,4000);
async function api(url,method='GET',body){
  const response=await fetch(url,{method,headers:{Authorization:'Bearer '+process.env.ACCESS_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    // Retain the validation reason for this one reviewed request. Never print
    // headers, bearer credentials, request environment values or raw responses.
    log({type:'cloud-api-error',method,path:new URL(url).pathname,http:response.status,status:result.error?.status,message:safeError(result.error?.message),details:safeError(JSON.stringify(result.error?.details??[]))});
    throw Error(method+' '+new URL(url).pathname+' HTTP '+response.status+' '+(result.error?.status??'')+'. No automatic retry or broader permissions will be attempted.');
  }
  return result;
}
const invariantFields=['name','description','entryPoint','runtime','timeout','availableMemoryMb','serviceAccountEmail','labels','buildEnvironmentVariables','network','maxInstances','minInstances','vpcConnector','vpcConnectorEgressSettings','ingressSettings','kmsKeyName','buildWorkerPool','secretEnvironmentVariables','secretVolumes','dockerRepository','dockerRegistry','buildServiceAccount','sourceArchiveUrl','sourceRepository','sourceUploadUrl','eventTrigger','httpsTrigger','automaticUpdatePolicy','onDeployUpdatePolicy'];
const invariants=fn=>Object.fromEntries(invariantFields.map(field=>[field,fn[field]??null]));
function validate(fn){
  assert.equal(fn.name,name);assert.equal(fn.status,'ACTIVE');
  assert.equal(fn.entryPoint,'paperChatPublishPaper');assert.equal(fn.runtime,'nodejs22');
  assert.equal(fn.serviceAccountEmail,'78765581239-compute@developer.gserviceaccount.com');
  assert.equal(fn.labels?.['gtop-release'],expectedRelease);assert.equal(fn.labels?.['firebase-functions-codebase'],'paper-service');
  assert.equal(fn.eventTrigger?.resource,'projects/gtop-app/databases/(default)/documents/paperDrafts/{paperId}');
  assert.equal(fn.eventTrigger?.eventType,'providers/cloud.firestore/eventTypes/document.write');
  assert.equal(fn.eventTrigger?.service,'firestore.googleapis.com');assert(fn.eventTrigger?.failurePolicy?.retry);
  assert.equal(fn.maxInstances,2);assert.equal(fn.timeout,'300s');assert.equal(fn.availableMemoryMb,512);
  assert(fn.sourceArchiveUrl||fn.sourceUploadUrl||fn.sourceRepository,'Existing source reference must be present.');
}
const before=await api(endpoint);validate(before);
if(before.environmentVariables?.GCLOUD_PROJECT===project){
  log({result:'already-configured',function:name,release:expectedRelease,mutated:false});
}else{
  assert.equal(before.updateTime,expectedUpdateTime,'Function changed since the reviewed audit; stop.');
  assert.equal(before.versionId,expectedVersion,'Function version changed since the reviewed audit; stop.');
  assert.equal(before.environmentVariables?.GCLOUD_PROJECT,undefined,'Unexpected configured project; stop.');
  const immediatelyBefore=await api(endpoint);validate(immediatelyBefore);
  assert.equal(stable(immediatelyBefore),stable(before),'Concurrent function change observed before mutation; stop.');
  const environmentVariables={...(before.environmentVariables??{}),GCLOUD_PROJECT:project};
  log({action:'patch-environment-only',function:name,updateMask:'environmentVariables',previousVersion:before.versionId,previousUpdateTime:before.updateTime,preservedConfigurationSha256:fingerprint(invariants(before)),existingEnvironmentCount:Object.keys(before.environmentVariables??{}).length});
  let operation=await api(endpoint+'?updateMask=environmentVariables','PATCH',{name,environmentVariables});
  log({operation:safeError(operation.name),operationAccepted:true});
  assert(typeof operation.name==='string'&&/^(?:operations\/[-\w]+|projects\/gtop-app\/locations\/us-central1\/operations\/[-\w]+)$/.test(operation.name),'Unexpected operation resource; stop and inspect manually.');
  const operationUrl='https://cloudfunctions.googleapis.com/v1/'+operation.name;
  for(let attempt=0;!operation.done&&attempt<36;attempt++){
    await setTimeout(10000);operation=await api(operationUrl);
  }
  assert(operation.done,'Operation still running after six minutes; inspect its recorded ID before any retry.');
  if(operation.error)throw Error('Configuration operation failed: code '+operation.error.code+' '+String(operation.error.message??'').slice(0,500));
  const after=await api(endpoint);validate(after);
  assert.equal(stable(invariants(after)),stable(invariants(before)),'Source or other preserved function configuration changed; inspect before proceeding.');
  assert.equal(stable(after.environmentVariables),stable(environmentVariables),'Environment preservation or project verification failed.');
  assert.equal(BigInt(after.versionId),BigInt(before.versionId)+1n,'Unexpected intervening deployment version; inspect concurrent changes.');
  log({result:'environment-repaired',function:name,release:after.labels['gtop-release'],version:after.versionId,updateTime:after.updateTime,preservedConfigurationSha256:fingerprint(invariants(after)),GCLOUD_PROJECT:after.environmentVariables.GCLOUD_PROJECT,sourceAndTriggerPreserved:true,firestoreWrites:0});
}
