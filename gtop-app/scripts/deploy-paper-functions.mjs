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
  {name:'publishPaper',memory:'512Mi',timeout:'300s',max:2,path:'paperDrafts/{paperId}',type:'written'},
  {name:'uploadPaperAsset',memory:'512Mi',timeout:'300s',max:2,path:'paperAssetUploads/{assetId}',type:'written'},
  {name:'notifyPaperAdmin',memory:'256Mi',timeout:'60s',max:2,path:'paperNotifications/{notificationId}',type:'created'}
];
function command(args,capture=false){
  return new Promise((resolve,reject)=>{
    const child=spawn('gcloud',args,{stdio:capture?['ignore','pipe','inherit']:'inherit'});let output='';
    if(capture)child.stdout.on('data',chunk=>output+=chunk);
    child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(Error('gcloud failed with exit '+code)));
  });
}
async function deploy(spec){
  const args=['functions','deploy',spec.name,'--project='+project,'--gen2','--region=us-central1','--runtime=nodejs22','--source=functions','--entry-point='+spec.name,'--service-account='+runtime,'--build-service-account=projects/'+project+'/serviceAccounts/'+runtime,'--memory='+spec.memory,'--timeout='+spec.timeout,'--max-instances='+spec.max,'--update-labels=firebase-functions-codebase=paper-service,gtop-release='+process.env.GITHUB_SHA,'--quiet'];
  if(spec.path)args.push('--trigger-location='+location,'--trigger-service-account='+runtime,'--trigger-event-filters=type=google.cloud.firestore.document.v1.'+spec.type+',database=(default)','--trigger-event-filters-path-pattern=document='+spec.path,'--retry');
  else args.push('--trigger-http','--allow-unauthenticated');
  console.log('Deploying reviewed function:',spec.name,'Firestore location:',location);
  await command(args);
  const fn=JSON.parse(await command(['functions','describe',spec.name,'--project='+project,'--region=us-central1','--gen2','--format=json'],true));
  assert.equal(fn.state,'ACTIVE',spec.name+' must be active.');
  assert.equal(fn.buildConfig?.runtime,'nodejs22');assert.equal(fn.buildConfig?.entryPoint,spec.name);
  assert.equal(fn.serviceConfig?.serviceAccountEmail,runtime);
  assert.equal(fn.labels?.['gtop-release'],process.env.GITHUB_SHA);
  if(spec.path){assert.equal(fn.eventTrigger?.triggerRegion,location);assert.equal(fn.eventTrigger?.retryPolicy,'RETRY_POLICY_RETRY');assert(fn.eventTrigger.eventFilters.some(f=>f.attribute==='document'&&f.value===spec.path),'The document trigger must match.');}
  console.log('Verified active function:',spec.name);
}
// Initialize the first service before independent background deployments.
await deploy(specs[0]);
const results=await Promise.allSettled(specs.slice(1).map(deploy));
for(const result of results)if(result.status==='rejected')throw result.reason;
console.log('All four reviewed functions are active with the verified runtime and triggers.');
