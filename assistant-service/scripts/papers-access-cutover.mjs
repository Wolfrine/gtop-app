import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {firestoreRuleSource} from './release-scope.mjs';
import {dispatchWorkerId} from '../dispatch-lanes.mjs';

const project='gtop-app';
const args=process.argv.slice(2);
const action=args[0]||'status';
if(!['status','fence','clear-fence','route','enable-access','rollback'].includes(action))throw Error('Choose status, fence, clear-fence, route, enable-access, or rollback.');
if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('This cutover requires the production project.');
const credential=applicationDefault();
initializeApp({projectId:project,credential});
const db=getFirestore();
const config=db.doc('assistantConfig/pilot'),pairing=db.doc('assistantWorkers/'+dispatchWorkerId);
const health=db.doc('assistantWorkerHealth/'+dispatchWorkerId);
const queues=[
  db.collection('assistantJobs').where('state','in',['queued','running','validating']).limit(1).select('state'),
  db.collection('assistantCheckingQueue').where('state','in',['queued','running']).limit(1).select('state')
];

async function cloud(path) {
  const {access_token}=await credential.getAccessToken();
  const headers={Authorization:'Bearer '+access_token};
  if(process.env.GOOGLE_CLOUD_QUOTA_PROJECT)headers['x-goog-user-project']=process.env.GOOGLE_CLOUD_QUOTA_PROJECT;
  const response=await fetch(path,{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok){
    const error=await response.json().catch(()=>({}));
    const reason=error.error?.details?.find(detail=>detail.reason)?.reason||error.error?.status;
    throw Error(new URL(path).hostname+' metadata: HTTP '+response.status+(reason?' '+reason:''));
  }
  return response.json();
}
const [fn, release]=await Promise.all([
  cloud('https://cloudfunctions.googleapis.com/v2/projects/'+project+'/locations/us-central1/functions/gtopAssistantGateway'),
  cloud('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases/cloud.firestore')
]);
const [[policy, worker, live], gen, check]=await Promise.all([
  db.getAll(config,pairing,health,{fieldMask:['dispatchVersion','managedAccess','enabled','allowedOwnerUids','version','build','lastSeenAt','state','routedOnly','checkingCutoverUntil','claimsPausedUntil']}),
  ...queues.map(query=>query.get())
]);
const status={
  release:fn.labels?.['gtop-release'],revision:fn.serviceConfig?.revision,active:fn.state==='ACTIVE',
  pushDisabled:fn.serviceConfig?.environmentVariables?.PAPERS_EXAM_WEB_PUSH_ENABLED!=='true',
  ruleset:release.rulesetName,dispatchVersion:policy.get('dispatchVersion')??1,managedAccess:policy.get('managedAccess')===true,
  pilotCount:policy.get('allowedOwnerUids')?.length??0,pairingCount:worker.get('allowedOwnerUids')?.length??0,
  cuttingOver:Date.parse(policy.get('checkingCutoverUntil'))>Date.now()||Date.parse(worker.get('claimsPausedUntil'))>Date.now(),
  enabled:worker.get('enabled')===true,generationVersion:live.get('version'),generationBuild:live.get('build'),generationState:live.get('state'),
  generationSeenAt:live.get('lastSeenAt'),generationRoutedOnly:live.get('routedOnly')===true,generationBusy:!gen.empty,checkingBusy:!check.empty
};
console.log(JSON.stringify(status));
if(action==='status')process.exit(0);

const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const fresh=(value,limit)=>{
  const age=Date.now()-Date.parse(value);
  return Number.isFinite(age)&&age>=0&&age<=limit;
};
if(!['rollback','clear-fence'].includes(action)){
  if(fn.labels?.['gtop-release']!==commit||!status.active||!status.pushDisabled)throw Error('Gateway revision or push safety gate failed.');
  if(!fresh(fn.updateTime,30*24*60*60*1000)||Date.now()-Date.parse(fn.updateTime)<65000||
      fn.serviceConfig?.allTrafficOnLatestRevision!==true)throw Error('Wait for the exact gateway revision to carry all traffic and for prior requests to finish.');
  const service=await cloud('https://run.googleapis.com/v2/projects/'+project+'/locations/us-central1/services/gtopassistantgateway');
  const traffic=service.trafficStatuses?.filter(target=>target.percent>0)||[];
  if(service.latestReadyRevision?.split('/').at(-1)!==status.revision||traffic.length!==1||
      traffic[0].percent!==100||traffic[0].revision?.split('/').at(-1)!==status.revision) {
    throw Error('Cloud Run traffic has not converged on the verified gateway revision.');
  }
  const deployed=await cloud('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
  const local=await readFile(new URL('../../gtop-app/firestore.rules',import.meta.url),'utf8');
  const normalize=source=>source.replaceAll('\r\n','\n').trimEnd();
  if(normalize(firestoreRuleSource(deployed))!==normalize(local))throw Error('The production rules do not match this release.');
  if(action!=='fence') {
  if(live.get('version')!=='harness-17-routed-papers'||live.get('build')!==commit||live.get('state')!=='ready'||
      !fresh(live.get('lastSeenAt'),90000))throw Error('Generation worker is not ready on the new dispatch build.');
  const checkingStatus=args[1];
  if(!checkingStatus)throw Error('Supply the observed production checking status file.');
  const receipt=JSON.parse(await readFile(checkingStatus,'utf8'));
  if(receipt.dispatchProtocol!==2||receipt.build!==commit||!receipt.connected||receipt.state!=='idle'||
      !fresh(receipt.listenerReadyAt||receipt.updatedAt,51*60*1000)) {
    throw Error('Checking worker is not ready on the new dispatch build.');
  }
  if(action==='enable-access'&&(!status.generationRoutedOnly||!receipt.routedOnly||
      Date.parse(receipt.listenerReadyAt)<policy.updateTime.toMillis()||
      Date.parse(status.generationSeenAt)<policy.updateTime.toMillis())) {
    throw Error('Both workers must confirm routed-only listeners after the routing switch.');
  }
  }
}
if(action==='enable-access'&&status.dispatchVersion!==2)throw Error('Verify new worker dispatch first.');
if(action==='route'&&status.dispatchVersion===2)throw Error('The worker route is already active.');
if(action==='rollback'&&status.dispatchVersion!==2)throw Error('The worker route is already on the legacy path.');
if(!status.enabled||status.pilotCount!==5||status.pairingCount!==5||
  !policy.get('allowedOwnerUids').every(uid=>worker.get('allowedOwnerUids').includes(uid))) {
  throw Error('The five retained admin assignments no longer agree.');
}
const until=action==='fence'?new Date(Date.now()+4*60*1000).toISOString():null;
await db.runTransaction(async tx=>{
  const [before,currentWorker,generation,checking]=await Promise.all([tx.get(config),tx.get(pairing),
    ...queues.map(query=>tx.get(query))]);
  if(!before.updateTime.isEqual(policy.updateTime)||!currentWorker.updateTime.isEqual(worker.updateTime)) {
    throw Error('The policy or pairing changed. Read them again before cutover.');
  }
  if(action!=='clear-fence'&&(!generation.empty||!checking.empty))throw Error('Wait for the existing queues and leases to drain.');
  const fence=before.get('checkingCutoverUntil');
  const matchingFence=typeof fence==='string'&&fence===currentWorker.get('claimsPausedUntil');
  if(action==='fence'){
    if(status.cuttingOver)throw Error('Another worker maintenance fence is active.');
    tx.update(config,{checkingCutoverUntil:until});
    tx.update(pairing,{claimsPausedUntil:until});
  }else if(['route','clear-fence'].includes(action)){
    if(!matchingFence||fence!==args.at(-1))throw Error('Supply the exact matching maintenance fence from this cutover.');
    if(action==='route'&&Date.parse(fence)<=Date.now())throw Error('The maintenance fence expired before the route switch.');
    tx.update(config,{checkingCutoverUntil:null,...(action==='route'?{dispatchVersion:2,managedAccess:false}:{})});
    tx.update(pairing,{claimsPausedUntil:null});
  }else{
    if(status.cuttingOver)throw Error('Clear the maintenance fence before changing access.');
    tx.update(config,action==='enable-access'?{managedAccess:true}:{dispatchVersion:1,managedAccess:false});
  }
});
console.log(JSON.stringify({cutover:action,commit,at:new Date().toISOString(),...(until?{until}:{})}));
