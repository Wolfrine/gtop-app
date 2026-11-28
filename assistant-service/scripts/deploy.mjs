import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const project='gtop-app',name='gtopAssistantGateway',runtime='78765581239-compute@developer.gserviceaccount.com';
if(process.env.GITHUB_REF!=='refs/heads/main' || !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || ''))throw Error('Deployment requires a verified main commit in GitHub Actions.');
function command(args,capture=false){return new Promise((resolve,reject)=>{const p=spawn('gcloud',args,{stdio:['ignore','pipe','pipe']});let result='';p.stdout.on('data',b=>{if(capture)result+=b;else process.stdout.write(b);});p.stderr.on('data',b=>process.stderr.write(b));p.on('error',reject);p.on('exit',code=>code===0?resolve(result):reject(Error('gcloud deployment failed: '+code)));});}
// Verify only the indexes used by this gateway. All operations are additive.
const indexArgs=['firestore','indexes','composite'];
const indexDatabase=['--project='+project,'--database=(default)'];
const requiredIndexes=[
  {group:'assistantStudentSubmissions', scope:'collection', fields:[['status','ASCENDING'],['createdAt','DESCENDING']]},
  {group:'paperNotifications', scope:'collection', fields:[['examStream','ASCENDING'],['examSortKey','DESCENDING']]},
  {group:'sheets', scope:'collection-group', fields:[['state','ASCENDING'],['updatedAt','DESCENDING']]},
  {group:'paperCatalogue', scope:'collection', fields:[['lookupKeys','CONTAINS'],['createdAt','DESCENDING']]},
  {group:'assistantConversations', scope:'collection', fields:[['ownerUid','ASCENDING'],['updatedAt','DESCENDING']]},
  {group:'assistantPapers', scope:'collection', fields:[['conversationId','ASCENDING'],['ownerUid','ASCENDING'],['createdAt','DESCENDING']]},
  {group:'syllabus', scope:'collection', fields:[['board','ASCENDING'],['standard','ASCENDING'],['subject','ASCENDING'],['chapter','ASCENDING']]},
];

async function ensureIndex({group,scope,fields}){
  const groupPath='/collectionGroups/'+group+'/indexes/';
  const expected=[...fields,['__name__',fields.at(-1)[1]]];
  const queryScope=scope.toUpperCase().replace('-','_');
  async function find(){
    const available=JSON.parse(await command([...indexArgs,'list',...indexDatabase,
      '--filter=name~'+groupPath.slice(1),'--format=json'],true));
    return available.find(index=>index.name.includes(groupPath)&&index.queryScope===queryScope&&
      index.fields.length===expected.length&&index.fields.every((field,i)=>
        field.fieldPath===expected[i][0]&&(field.order??field.arrayConfig)===expected[i][1]));
  }
  let index=await find();
  if(!index){
    const fieldArgs=fields.map(([field,kind])=>'--field-config=field-path='+field+
      (kind==='CONTAINS'?',array-config=contains':',order='+kind.toLowerCase()));
    try {
      await command([...indexArgs,'create',...indexDatabase,'--collection-group='+group,
        '--query-scope='+scope,...fieldArgs,'--impersonate-service-account='+runtime,'--async','--quiet']);
    } catch(error) {
      if(!await find())throw error;
    }
  }
  const deadline=Date.now()+15*60_000;
  while(index?.state!=='READY'){
    if(index?.state==='NEEDS_REPAIR'||Date.now()>=deadline)throw Error('Index did not become ready: '+group);
    await new Promise(resolve=>setTimeout(resolve,10_000));
    index=await find();
  }
  console.log('Verified READY: '+group);
}
await Promise.all(requiredIndexes.map(ensureIndex));
const pushEnabled=process.env.PAPERS_EXAM_WEB_PUSH_ENABLED==='true'?'true':'false';
await command(['functions','deploy',name,'--project='+project,'--gen2','--region=us-central1','--runtime=nodejs22','--source=assistant-service','--entry-point='+name,'--service-account='+runtime,'--build-service-account=projects/'+project+'/serviceAccounts/'+runtime,'--memory=512Mi','--cpu=1','--timeout=60s','--max-instances=3','--concurrency=40','--trigger-http','--allow-unauthenticated','--update-env-vars=PAPERS_EXAM_WEB_PUSH_ENABLED='+pushEnabled,'--update-labels=firebase-functions-codebase=gtop-assistant,gtop-release='+process.env.GITHUB_SHA,'--quiet']);
const fn=JSON.parse(await command(['functions','describe',name,'--project='+project,'--region=us-central1','--gen2','--format=json'],true));
assert.equal(fn.state,'ACTIVE');assert.equal(fn.buildConfig.runtime,'nodejs22');assert.equal(fn.buildConfig.entryPoint,name);assert.equal(fn.serviceConfig.serviceAccountEmail,runtime);assert.equal(fn.labels['gtop-release'],process.env.GITHUB_SHA);
assert.equal(Number(fn.serviceConfig.availableCpu),1);assert.equal(fn.serviceConfig.maxInstanceRequestConcurrency,40);
assert.equal(Number(fn.serviceConfig.minInstanceCount||0),0);
assert.equal(fn.serviceConfig.environmentVariables?.PAPERS_EXAM_WEB_PUSH_ENABLED,pushEnabled);
console.log('Verified gtopAssistantGateway, Node22, one CPU, expected runtime account and release.');
