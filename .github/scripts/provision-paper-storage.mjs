import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const project='gtop-app';
const bucketName='gtop-app.firebasestorage.app';
const runtime='78765581239-compute@developer.gserviceaccount.com';
assert(process.env.ACCESS_TOKEN,'Existing workflow authentication is required.');
const original={Authorization:'Bearer '+process.env.ACCESS_TOKEN,'Content-Type':'application/json'};
async function request(url,headers,method='GET',body){
  const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok&&response.status!==404)throw Error('Backend setup HTTP '+response.status+': '+(data.error?.message??'Request failed.'));
  return {status:response.status,data};
}
const minted=await request('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+encodeURIComponent(runtime)+':generateAccessToken',original,'POST',{scope:['https://www.googleapis.com/auth/cloud-platform'],lifetime:'600s'});
assert.equal(minted.status,200,'Existing runtime delegation must work.');
const delegated={Authorization:'Bearer '+minted.data.accessToken,'Content-Type':'application/json'};
const service='https://serviceusage.googleapis.com/v1/projects/gtop-app/services/firebasestorage.googleapis.com';
const serviceState=await request(service,delegated);
if(serviceState.data.state!=='ENABLED'){
  const enabled=await request(service+':enable',delegated,'POST',{});
  assert(enabled.data.name,'Firebase Storage API enablement must return an operation.');
  let complete=false;
  for(let attempt=0;attempt<40;attempt++){
    const operation=await request('https://serviceusage.googleapis.com/v1/'+enabled.data.name,delegated);
    if(operation.data.done){assert(!operation.data.error,operation.data.error?.message);complete=true;break;}
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  assert(complete,'Firebase Storage API enablement must complete before bucket setup.');
  console.log('Enabled the Firebase Storage API required by the configured image bucket.');
}
const endpoint='https://firebasestorage.googleapis.com/v1alpha/projects/'+project+'/defaultBucket';
let linked;
for(let attempt=0;attempt<24;attempt++){
  try{linked=await request(endpoint,delegated);break;}
  catch(error){if(!/API has not been used|it is disabled|SERVICE_DISABLED/.test(error.message)||attempt===23)throw error;}
  await new Promise(resolve=>setTimeout(resolve,5000));
}
let provisioned=false;
if(linked.status===404){
  const previous=await request('https://storage.googleapis.com/storage/v1/b/'+bucketName,delegated);
  if(previous.status===200){
    const contents=await request('https://storage.googleapis.com/storage/v1/b/'+bucketName+'/o?maxResults=1',delegated);
    assert(!contents.data.items?.length,'An existing populated bucket requires review; it will not be overwritten.');
  }
  const database=await request('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)',original);
  assert(database.data.locationId,'Verify the project database location before provisioning.');
  linked=await request(endpoint,delegated,'POST',{name:'projects/'+project+'/defaultBucket',location:database.data.locationId.toUpperCase()});
  assert.equal(linked.status,200,'Default Firebase image bucket provisioning must succeed.');
  provisioned=true;
  console.log('Provisioned the configured Firebase image bucket:',bucketName);
}
assert.equal(linked.data.bucket?.name?.split('/').at(-1),bucketName,'An existing default bucket must match the configured image bucket.');

// This newly provisioned bucket uses server uploads and tokenized image URLs.
// Preserve any existing bucket's rules; do not broaden direct client access.
const releaseName='projects/'+project+'/releases/firebase.storage/'+bucketName;
if(provisioned){
  const content="rules_version = '2';\nservice firebase.storage {\n  match /b/{bucket}/o {\n    match /{path=**} { allow read, write: if false; }\n  }\n}\n";
  const ruleset=await request('https://firebaserules.googleapis.com/v1/projects/'+project+'/rulesets',original,'POST',{source:{files:[{name:'storage.rules',content}]}});
  assert(ruleset.data.name,'Storage rules must compile.');
  const current=await request('https://firebaserules.googleapis.com/v1/'+releaseName,original);
  const release={name:releaseName,rulesetName:ruleset.data.name};
  if(current.status===404)await request('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases',original,'POST',release);
  else await request('https://firebaserules.googleapis.com/v1/'+releaseName,original,'PATCH',{release});
  const active=await request('https://firebaserules.googleapis.com/v1/'+releaseName,original);
  assert.equal(active.data.rulesetName,ruleset.data.name,'The server-only image rules must be active.');
  console.log('Verified server-only client rules for the newly provisioned image bucket.');
}
const metadata=await request('https://storage.googleapis.com/storage/v1/b/'+bucketName,delegated);
assert.equal(metadata.status,200);assert.equal(metadata.data.name,bucketName);
const readback=await request(endpoint,delegated);
assert.equal(readback.data.bucket?.name?.split('/').at(-1),bucketName);
console.log('Firebase image bucket exists and is linked:',bucketName,'location:',metadata.data.location);
// Verify the same write/download path used by paper diagrams, then remove only
// this unique probe with an object-generation precondition. No paper is created.
const probe='paper-assets/deployment-check/'+(process.env.GITHUB_RUN_ID??'check')+'-'+randomUUID()+'.png';
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=','base64');
const objectEndpoint='https://storage.googleapis.com/storage/v1/b/'+bucketName+'/o/'+encodeURIComponent(probe);
let generation;
try{
  const uploaded=await fetch('https://storage.googleapis.com/upload/storage/v1/b/'+bucketName+'/o?uploadType=media&name='+encodeURIComponent(probe)+'&ifGenerationMatch=0',{method:'POST',headers:{Authorization:delegated.Authorization,'Content-Type':'image/png'},body:bytes,signal:AbortSignal.timeout(30000)});
  assert(uploaded.ok,'The existing runtime must be able to store paper images.');
  generation=(await uploaded.json()).generation;
  assert(generation,'A probe object generation is required for safe cleanup.');
  const token=randomUUID();
  await request(objectEndpoint+'?ifGenerationMatch='+generation,delegated,'PATCH',{metadata:{firebaseStorageDownloadTokens:token}});
  const downloaded=await fetch('https://firebasestorage.googleapis.com/v0/b/'+bucketName+'/o/'+encodeURIComponent(probe)+'?alt=media&token='+token,{signal:AbortSignal.timeout(30000)});
  assert(downloaded.ok,'Firebase diagram download URLs must work.');
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes,'Firebase must return the exact stored image bytes.');
  console.log('Verified actual runtime image upload and Firebase token download.');
}finally{
  if(generation){
    const deleted=await fetch(objectEndpoint+'?ifGenerationMatch='+generation,{method:'DELETE',headers:delegated,signal:AbortSignal.timeout(30000)});
    assert(deleted.ok,'The temporary image probe must be removed.');
    console.log('Removed the unique temporary image probe.');
  }
}
console.log('No IAM grants, credentials, paper requests or existing objects changed.');
