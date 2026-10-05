import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Use the same synchronous require(ESM) route as the Firebase worker, then call
// the actual SDK wrappers, not .run(). Inactive events never access Firestore.
const harness=`
const assert=require('node:assert/strict');
const {GoogleAuth}=require(${JSON.stringify(fileURLToPath(new URL('./node_modules/google-auth-library/build/src/index.js',import.meta.url)))});
const mode=process.env.PROJECT_TEST_MODE;let lookups=0;
delete process.env.GCLOUD_PROJECT;
if(mode==='provided')process.env.GCLOUD_PROJECT='demo-provided';
GoogleAuth.prototype.getProjectId=async()=>{lookups++;if(mode==='provided'||(mode==='failure'&&lookups===1))throw Error('Project discovery failed');return 'demo-discovered';};
const runtime=require(${JSON.stringify(fileURLToPath(new URL('./runtime.mjs',import.meta.url)))});
assert.equal(lookups,0,'Synchronous module discovery must not start network initialization.');
const project=mode==='provided'?'demo-provided':'demo-discovered';
const invoke=async(handler,collection,fields)=>{
  const resource='projects/'+project+'/databases/(default)/documents/'+collection+'/local-runtime-regression';
  await handler({value:{name:resource,fields,createTime:'2026-10-05T00:00:00Z',updateTime:'2026-10-05T00:00:00Z'},oldValue:{}},{eventType:'providers/cloud.firestore/eventTypes/document.write',resource,eventId:'local-runtime-regression',timestamp:'2026-10-05T00:00:00Z'});
};
const publish=()=>invoke(runtime.paperChatPublishPaper,'paperDrafts',{readyToPublish:{booleanValue:false}});
async function main(){
  if(mode==='failure'){
    await assert.rejects(publish(),/Project discovery failed/);
    assert.equal(process.env.GCLOUD_PROJECT,undefined,'A failed lookup must not invent a fallback project.');
  }
  await Promise.all([publish(),publish(),invoke(runtime.paperChatUploadAsset,'paperAssetUploads',{status:{stringValue:'staging'}})]);
  assert.equal(process.env.GCLOUD_PROJECT,project);
  assert.equal(lookups,mode==='provided'?0:mode==='failure'?2:1,'Concurrent adapters share discovery; a failed lookup can retry.');
  const triggers=Object.entries(runtime).filter(([name])=>name!=='paperGateway');
  assert.equal(triggers.length,7);
  for(const [name,handler] of triggers){
    assert.equal(typeof Object.getOwnPropertyDescriptor(handler,'__trigger').get,'function',name);
    assert.equal(typeof handler.run,'function',name);
    assert(handler.__trigger.eventTrigger.resource.startsWith('projects/'+project+'/databases/(default)/documents/'),name);
    assert.equal(handler.__endpoint.platform,'gcfv1',name);
    assert(handler.__endpoint.eventTrigger.eventFilters.resource.startsWith('projects/'+project+'/databases/(default)/documents/'),name);
  }
  console.log('Synchronous loader and actual SDK event case passed: '+mode);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;
function verify(mode){
  const result=spawnSync(process.execPath,['-e',harness],{encoding:'utf8',timeout:20000,env:{...process.env,PROJECT_TEST_MODE:mode}});
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.match(result.stdout,new RegExp('Synchronous loader and actual SDK event case passed: '+mode));
}
test('synchronous Firebase loading preserves metadata while concurrent real SDK events discover the project',()=>verify('discovered'));
test('Firebase and emulator project configuration is preserved without discovery',()=>verify('provided'));
test('failed project discovery rejects events without fallback and permits a later retry',()=>verify('failure'));
