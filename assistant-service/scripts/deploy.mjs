import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const project='gtop-app',name='gtopAssistantGateway',runtime='78765581239-compute@developer.gserviceaccount.com';
if(process.env.GITHUB_REF!=='refs/heads/main' || !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || ''))throw Error('Deployment requires a verified main commit in GitHub Actions.');
function command(args,capture=false){return new Promise((resolve,reject)=>{const p=spawn('gcloud',args,{stdio:['ignore','pipe','pipe']});let result='';p.stdout.on('data',b=>{if(capture)result+=b;else process.stdout.write(b);});p.stderr.on('data',b=>process.stderr.write(b));p.on('error',reject);p.on('exit',code=>code===0?resolve(result):reject(Error('gcloud deployment failed: '+code)));});}
// This group index also covers existing sheets without rewriting student data.
const indexArgs=['firestore','indexes','composite'];
const indexDatabase=['--project='+project,'--database=(default)'];
const indexFields=[['state','ASCENDING'],['updatedAt','DESCENDING'],['__name__','DESCENDING']];
async function sheetWorkIndex(){
  const found=JSON.parse(await command([...indexArgs,'list',...indexDatabase,'--filter=name~collectionGroups/sheets/indexes/','--format=json'],true));
  return found.find(index=>index.name.includes('/collectionGroups/sheets/indexes/')&&index.queryScope==='COLLECTION_GROUP'&&
    index.fields.length===indexFields.length&&index.fields.every((field,i)=>field.fieldPath===indexFields[i][0]&&field.order===indexFields[i][1]));
}
let workIndex=await sheetWorkIndex();
if(!workIndex){
  try{
    await command([...indexArgs,'create',...indexDatabase,'--collection-group=sheets','--query-scope=collection-group',
      '--field-config=field-path=state,order=ascending','--field-config=field-path=updatedAt,order=descending',
      '--impersonate-service-account='+runtime,'--async','--quiet']);
  }catch(error){
    if(!await sheetWorkIndex())throw error; // Another release may have created it.
  }
}
const indexDeadline=Date.now()+15*60_000;
while(workIndex?.state!=='READY'){
  if(workIndex?.state==='NEEDS_REPAIR'||Date.now()>=indexDeadline)throw Error('The checking desk index is not ready.');
  await new Promise(resolve=>setTimeout(resolve,10_000));
  workIndex=await sheetWorkIndex();
}
await command(['functions','deploy',name,'--project='+project,'--gen2','--region=us-central1','--runtime=nodejs22','--source=assistant-service','--entry-point='+name,'--service-account='+runtime,'--build-service-account=projects/'+project+'/serviceAccounts/'+runtime,'--memory=512Mi','--cpu=1','--timeout=60s','--max-instances=3','--concurrency=40','--trigger-http','--allow-unauthenticated','--update-labels=firebase-functions-codebase=gtop-assistant,gtop-release='+process.env.GITHUB_SHA,'--quiet']);
const fn=JSON.parse(await command(['functions','describe',name,'--project='+project,'--region=us-central1','--gen2','--format=json'],true));
assert.equal(fn.state,'ACTIVE');assert.equal(fn.buildConfig.runtime,'nodejs22');assert.equal(fn.buildConfig.entryPoint,name);assert.equal(fn.serviceConfig.serviceAccountEmail,runtime);assert.equal(fn.labels['gtop-release'],process.env.GITHUB_SHA);
assert.equal(Number(fn.serviceConfig.availableCpu),1);assert.equal(fn.serviceConfig.maxInstanceRequestConcurrency,40);
console.log('Verified the checking desk index and gtopAssistantGateway, Node22, one CPU, expected runtime account and release.');
