import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const project='gtop-app';
const runtime='78765581239-compute@developer.gserviceaccount.com';
const databaseResponse=await fetch('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)',{headers:{Authorization:'Bearer '+process.env.ACCESS_TOKEN},signal:AbortSignal.timeout(30000)});
assert(databaseResponse.ok,'The database location must be verified before trigger deployment.');
const location=(await databaseResponse.json()).locationId;
assert(location,'Firestore trigger location is required.');
const specs=[
  {name:'paperGateway',memory:'256Mi',timeout:'60s',max:3},
  {name:'paperChatPublishPaper',memory:'512Mi',timeout:'300s',max:2,path:'paperDrafts/{paperId}',type:'write'},
  {name:'paperChatUploadAsset',memory:'512Mi',timeout:'300s',max:2,path:'paperAssetUploads/{assetId}',type:'write'},
  {name:'paperChatNotifyAdmin',memory:'256Mi',timeout:'60s',max:2,path:'paperNotifications/{notificationId}',type:'create'},
  ...['Conversation','Request','Paper','Message'].map((name,i)=>({name:'paperRegister'+name,memory:'256Mi',timeout:'120s',max:2,path:['paperConversations','paperRequests','paperDrafts','paperMessages'][i]+'/{id}',type:'write'}))
];
function command(args,capture=false){
  return new Promise((resolve,reject)=>{
    const child=spawn('gcloud',args,{stdio:['ignore','pipe','pipe']});let output='',errors='';
    child.stdout.on('data',chunk=>{if(capture)output+=chunk;else process.stdout.write(chunk);});
    child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-12000);process.stderr.write(chunk);});
    child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(Error('gcloud failed with exit '+code+': '+errors)));
  });
}
async function deploy(spec){
  const args=['functions','deploy',spec.name,'--project='+project,spec.path?'--no-gen2':'--gen2','--region=us-central1','--runtime=nodejs22','--source=functions','--entry-point='+spec.name,'--service-account='+runtime,'--build-service-account=projects/'+project+'/serviceAccounts/'+runtime,'--memory='+spec.memory,'--timeout='+spec.timeout,'--max-instances='+spec.max,'--update-labels=firebase-functions-codebase=paper-service,gtop-release='+process.env.GITHUB_SHA,'--quiet'];
  if(spec.path)args.push('--trigger-event=providers/cloud.firestore/eventTypes/document.'+spec.type,'--trigger-resource=projects/'+project+'/databases/(default)/documents/'+spec.path,'--retry');
  else args.push('--trigger-http','--allow-unauthenticated');
  console.log('Deploying reviewed function:',spec.name,'Firestore location:',location);
  await command(args);
  const fn=JSON.parse(await command(['functions','describe',spec.name,'--project='+project,'--region=us-central1',spec.path?'--no-gen2':'--gen2','--format=json'],true));
  assert.equal(spec.path?fn.status:fn.state,'ACTIVE',spec.name+' must be active.');
  assert.equal(spec.path?fn.runtime:fn.buildConfig?.runtime,'nodejs22');assert.equal(spec.path?fn.entryPoint:fn.buildConfig?.entryPoint,spec.name);
  assert.equal(spec.path?fn.serviceAccountEmail:fn.serviceConfig?.serviceAccountEmail,runtime);
  assert.equal(fn.labels?.['gtop-release'],process.env.GITHUB_SHA);
  if(spec.path){assert.equal(fn.eventTrigger?.resource,'projects/'+project+'/databases/(default)/documents/'+spec.path);assert.equal(fn.eventTrigger?.eventType,'providers/cloud.firestore/eventTypes/document.'+spec.type);assert(fn.eventTrigger?.failurePolicy?.retry,'Retry policy must be enabled.');}
  console.log('Verified active function:',spec.name);
}
// Initialize the first service before independent background deployments.
await deploy(specs[0]);
const results=await Promise.allSettled(specs.slice(1).map(deploy));
for(const result of results)if(result.status==='rejected')throw result.reason;
// Remove only the failed Gen2 resources created by the earlier deployment.
for(const name of ['publishPaper','uploadPaperAsset','notifyPaperAdmin']){
  let failed;
  try{failed=JSON.parse(await command(['functions','describe',name,'--project='+project,'--region=us-central1','--gen2','--format=json'],true));}
  catch(error){if(/NOT_FOUND|not found|does not exist/i.test(error.message))continue;throw error;}
  if(failed.state==='FAILED'&&failed.labels?.['firebase-functions-codebase']==='paper-service')await command(['functions','delete',name,'--project='+project,'--region=us-central1','--gen2','--quiet']);
}
console.log('All eight reviewed functions are active with the verified runtime and triggers.');
