import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {applicationDefault} from 'firebase-admin/app';
import {withoutWorkerFirestoreRule,withoutWorkerDatabaseRule,parseRulesJson,equivalentDatabaseRules,firestoreRuleSource} from './release-scope.mjs';

const project='gtop-app';
assert.equal(process.env.GITHUB_REF,'refs/heads/main','Scoped rules deployment requires main.');
const token=(await applicationDefault().getAccessToken()).access_token;
async function get(url){const r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});assert(r.ok,'Read-only rule prerequisite failed: HTTP '+r.status);return parseRulesJson(await r.text());}
const normalize=s=>s.replace(/\s/g,'');
const checked=await readFile('gtop-app/firestore.rules','utf8');
const release=await get('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases/cloud.firestore');
const ruleset=await get('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
const live=firestoreRuleSource(ruleset);
assert([normalize(checked),normalize(withoutWorkerFirestoreRule(checked))].includes(normalize(live)),'Unrelated live Firestore rule drift blocks assistant-only deployment.');

// The new worker must gain no legacy Storage access from its Firebase token.
// Existing configured image buckets are server-only; preserve them and fail if
// live policies differ rather than rewriting unknown human permissions.
let page='',storageCount=0;
do{
  const list=await get('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases?pageSize=100'+(page?'&pageToken='+encodeURIComponent(page):''));
  for(const storageRelease of list.releases || [])if(storageRelease.name.includes('/releases/firebase.storage/')){
    const storageRules=await get('https://firebaserules.googleapis.com/v1/'+storageRelease.rulesetName);
    const source=storageRules.source.files.map(f=>f.content).join('\n').replace(/\/\/[^\n]*/g,'');
    const expected="rules_version='2';servicefirebase.storage{match/b/{bucket}/o{match/{path=**}{allowread,write:iffalse;}}}";
    assert.equal(normalize(source).replaceAll('"',"'"),expected,'Storage policy is not the inspected server-only policy; review worker access before release.');storageCount++;
  }
  page=list.nextPageToken || '';
}while(page);
assert(storageCount>0,'Configured Firebase Storage policy must be inspected before adding worker identity.');

// Live inspection found collection-level presence grants. Preserve that human
// baseline; the canonical core file's child validation is a separate migration.
const checkedDatabase=JSON.parse(await readFile('assistant-service/security/worker-database.rules.json','utf8'));
const instances=await get('https://firebasedatabase.googleapis.com/v1beta/projects/'+project+'/locations/-/instances');
const database=(instances.instances || []).find(i=>i.type==='DEFAULT_DATABASE');assert(database?.databaseUrl,'Existing default Realtime Database must be located.');
const liveDatabase=await get(database.databaseUrl.replace(/\/$/,'')+'/.settings/rules.json');
if(!equivalentDatabaseRules(liveDatabase,checkedDatabase)&&!equivalentDatabaseRules(liveDatabase,withoutWorkerDatabaseRule(JSON.stringify(checkedDatabase)))){
  console.log('Live rule source for access-policy review (rules only, no user data):',JSON.stringify(liveDatabase));
  throw Error('Unrelated live Realtime Database rule drift blocks deployment. Review the actual policy before changing it.');
}

await new Promise((resolve,reject)=>{const p=spawn('npx',['--yes','firebase-tools@15','deploy','--project',project,'--config','firebase.assistant.json','--only','firestore:rules,database','--non-interactive'],{stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('Scoped rules deployment failed: '+code)));});
const readbackRelease=await get('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases/cloud.firestore');
const readback=await get('https://firebaserules.googleapis.com/v1/'+readbackRelease.rulesetName);
assert.equal(normalize(firestoreRuleSource(readback)),normalize(checked));
assert(equivalentDatabaseRules(await get(database.databaseUrl.replace(/\/$/,'')+'/.settings/rules.json'),checkedDatabase));
console.log('Verified only worker-claim privilege reductions in Firestore/Realtime Database; existing server-only Storage rules inspected and unchanged.');
