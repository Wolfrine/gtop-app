import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const project='gtop-app';
const runtimeAccount='78765581239-compute@developer.gserviceaccount.com';
const indexRoot='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/collectionGroups/';
const delegationUrl='https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+encodeURIComponent(runtimeAccount)+':generateAccessToken';
const allowedGroups=new Set(['paperMessages','paperRequests','paperNotifications','paperDrafts','paperRegister','paperRegisterSearch']);
const fullFields=fields=>fields.some(f=>f.fieldPath==='__name__')?fields:[...fields,{fieldPath:'__name__',order:fields.at(-1)?.order??'ASCENDING'}];
const signature=fields=>JSON.stringify(fullFields(fields));

// The workflow already supplies refreshable ADC. Its initial ACCESS_TOKEN must
// not be held for an entire deployment: index builds can outlive that token.
export function createSourceTokenProvider(createClient){
  let clientPromise;
  return async(forceRefresh=false)=>{
    clientPromise??=Promise.resolve().then(createClient);
    const client=await clientPromise;
    if(forceRefresh)client.setCredentials({...client.credentials,expiry_date:1});
    const result=await client.getAccessToken();
    const token=typeof result==='string'?result:result?.token;
    assert(token,'Existing deployment ADC returned no access token.');
    return token;
  };
}

async function mapBounded(items,operation){
  let cursor=0,failed=false;
  const workers=Array.from({length:Math.min(3,items.length)},async()=>{
    while(!failed&&cursor<items.length){
      const item=items[cursor++];
      try{await operation(item);}catch(error){failed=true;throw error;}
    }
  });
  const results=await Promise.allSettled(workers);
  for(const result of results)if(result.status==='rejected')throw result.reason;
}

export async function deployPaperIndexes({indexes,getSourceToken,request=fetch,now=Date.now,
  wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),log=console.log,
  readyTimeoutMs=12*60*1000,pollIntervalMs=15000}={}){
  assert(Array.isArray(indexes)&&indexes.length>0,'Reviewed indexes are required.');
  assert.equal(typeof getSourceToken,'function','Refreshable deployment ADC is required.');
  for(const wanted of indexes)assert(allowedGroups.has(wanted.collectionGroup),'Only the reviewed chat indexes may be deployed.');
  let delegatedToken,delegatedExpiresAt=0,delegationPending;

  async function send(url,method,body,token){
    return request(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  }
  async function sourceApi(url,method='GET',body){
    for(let attempt=0;attempt<2;attempt++){
      const response=await send(url,method,body,await getSourceToken(attempt===1));
      if(response.status===401&&attempt===0)continue;
      if(!response.ok)throw Error('Index deployment HTTP '+response.status+' during '+method+'.');
      return response.json();
    }
  }
  async function indexToken(){
    if(delegatedToken&&now()<delegatedExpiresAt-60000)return delegatedToken;
    if(!delegationPending){
      delegationPending=(async()=>{
        const result=await sourceApi(delegationUrl,'POST',{scope:['https://www.googleapis.com/auth/datastore'],lifetime:'1200s'});
        const expiry=Date.parse(result.expireTime);
        assert(result.accessToken&&Number.isFinite(expiry)&&expiry>now()+60000,'Runtime delegation returned missing or expired credentials.');
        delegatedToken=result.accessToken;delegatedExpiresAt=expiry;
        return delegatedToken;
      })().finally(()=>{delegationPending=undefined;});
    }
    return delegationPending;
  }
  async function createIndex(wanted){
    for(let attempt=0;attempt<2;attempt++){
      const token=await indexToken();
      const response=await send(indexRoot+wanted.collectionGroup+'/indexes','POST',{
        queryScope:wanted.queryScope,fields:fullFields(wanted.fields)},token);
      if(response.status===401&&attempt===0){
        // Do not invalidate a newer token refreshed by a concurrent create.
        if(delegatedToken===token){delegatedToken=undefined;delegatedExpiresAt=0;}
        continue;
      }
      // A concurrent authorized deployment may create the same index. Its
      // existence and READY state remain mandatory below; nothing is deleted.
      if(response.status===409){log('Index already exists; verifying:',wanted.collectionGroup);return;}
      if(!response.ok)throw Error('Index deployment HTTP '+response.status+' during CREATE '+wanted.collectionGroup+'.');
      log('Created required index:',wanted.collectionGroup);return;
    }
  }
  async function listGroup(group){
    const values=[];let pageToken;
    do{
      const url=new URL(indexRoot+group+'/indexes');
      if(pageToken)url.searchParams.set('pageToken',pageToken);
      const data=await sourceApi(url.href);values.push(...data.indexes??[]);pageToken=data.nextPageToken;
    }while(pageToken);
    return values;
  }
  const matches=(wanted,values)=>values.find(index=>
    index.name?.startsWith('projects/'+project+'/databases/(default)/collectionGroups/'+wanted.collectionGroup+'/indexes/')&&
    index.queryScope===wanted.queryScope&&signature(index.fields)===signature(wanted.fields));
  const groups=[...new Set(indexes.map(index=>index.collectionGroup))];
  const listed=new Map();
  await mapBounded(groups,async group=>listed.set(group,await listGroup(group)));
  const missing=[];
  for(const wanted of indexes){
    const existing=matches(wanted,listed.get(wanted.collectionGroup));
    if(existing?.state==='NEEDS_REPAIR')throw Error('Index needs repair: '+wanted.collectionGroup);
    if(existing)log('Preserved matching index:',wanted.collectionGroup,existing.state);
    else missing.push(wanted);
  }
  // Start independent additive builds before polling. Three in-flight creates
  // bound request pressure without a four-minute wait per new index.
  await mapBounded(missing,createIndex);
  const deadline=now()+readyTimeoutMs;
  let pending=[...indexes];
  while(pending.length){
    const states=new Map();
    await mapBounded([...new Set(pending.map(index=>index.collectionGroup))],async group=>states.set(group,await listGroup(group)));
    pending=pending.filter(wanted=>{
      const index=matches(wanted,states.get(wanted.collectionGroup));
      if(index?.state==='NEEDS_REPAIR')throw Error('Index needs repair: '+wanted.collectionGroup);
      if(index?.state==='READY'){log('Verified READY:',wanted.collectionGroup);return false;}
      return true;
    });
    if(!pending.length)break;
    if(now()>=deadline)throw Error('Required indexes did not become READY before timeout: '+[...new Set(pending.map(index=>index.collectionGroup))].join(', '));
    await wait(Math.min(pollIntervalMs,deadline-now()));
  }
  log('All reviewed paper indexes are ready. Existing indexes and IAM bindings were preserved.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const require=createRequire(new URL('../functions/package.json',import.meta.url));
  const {GoogleAuth}=require('google-auth-library');
  const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
  const {indexes}=JSON.parse(await readFile(new URL('../firestore.indexes.json',import.meta.url),'utf8'));
  await deployPaperIndexes({indexes,getSourceToken:createSourceTokenProvider(()=>auth.getClient())});
}
