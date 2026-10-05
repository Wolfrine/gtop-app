import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const project='gtop-app';
const runtimeAccount='78765581239-compute@developer.gserviceaccount.com';
const initialToken=process.env.ACCESS_TOKEN;
assert(initialToken,'The authenticated deployment token is required.');
const {indexes}=JSON.parse(await readFile(new URL('../firestore.indexes.json',import.meta.url),'utf8'));
const root='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/collectionGroups/';
let delegatedToken;
async function api(url,token,method='GET',body){
  const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok)throw Error('Index deployment HTTP '+response.status+': '+String(data.error?.message??'request failed'));
  return data;
}
async function indexToken(){
  if(!delegatedToken){
    // Existing Token Creator access is verified. No persistent key or IAM grant.
    const result=await api('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+encodeURIComponent(runtimeAccount)+':generateAccessToken',initialToken,'POST',{scope:['https://www.googleapis.com/auth/datastore'],lifetime:'1200s'});
    delegatedToken=result.accessToken;
    assert(delegatedToken,'A short-lived index deployment token is required.');
  }
  return delegatedToken;
}
const fullFields=fields=>fields.some(f=>f.fieldPath==='__name__')?fields:[...fields,{fieldPath:'__name__',order:fields.at(-1)?.order??'ASCENDING'}];
const signature=fields=>JSON.stringify(fullFields(fields));
async function matching(wanted){
  const list=await api(root+wanted.collectionGroup+'/indexes',initialToken);
  const parent='projects/'+project+'/databases/(default)/collectionGroups/'+wanted.collectionGroup+'/indexes/';
  return (list.indexes??[]).find(index=>index.name?.startsWith(parent)&&index.queryScope===wanted.queryScope&&signature(index.fields)===signature(wanted.fields));
}
for(const wanted of indexes){
  assert(['paperMessages','paperRequests','paperNotifications','paperDrafts','paperRegister','paperRegisterSearch'].includes(wanted.collectionGroup),'Only the reviewed chat indexes may be deployed.');
  let index=await matching(wanted);
  if(!index){
    await api(root+wanted.collectionGroup+'/indexes',await indexToken(),'POST',{queryScope:wanted.queryScope,fields:fullFields(wanted.fields)});
    console.log('Created required index:',wanted.collectionGroup);
  }else console.log('Preserved matching index:',wanted.collectionGroup,index.state);
  const deadline=Date.now()+12*60*1000;
  while(Date.now()<deadline){
    index=await matching(wanted);
    if(index?.state==='READY')break;
    if(index?.state==='NEEDS_REPAIR')throw Error('Index needs repair: '+wanted.collectionGroup);
    await new Promise(resolve=>setTimeout(resolve,15000));
  }
  assert.equal(index?.state,'READY','Required index must be ready: '+wanted.collectionGroup);
  console.log('Verified READY:',wanted.collectionGroup);
}
console.log('All reviewed paper indexes are ready. Existing indexes and IAM bindings were preserved.');
