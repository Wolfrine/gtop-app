import test from 'node:test';
import assert from 'node:assert/strict';
import {OAuth2Client} from 'google-auth-library';
import {deployPaperIndexes,createSourceTokenProvider} from '../scripts/deploy-paper-indexes.mjs';

const pause=()=>new Promise(resolve=>setImmediate(resolve));
const wanted=id=>({collectionGroup:'paperRegister',queryScope:'COLLECTION',fields:[{fieldPath:'field'+id,order:'ASCENDING'}]});
const completeFields=fields=>[...fields,{fieldPath:'__name__',order:'ASCENDING'}];
const stored=(index,state='READY')=>({name:'projects/gtop-app/databases/(default)/collectionGroups/paperRegister/indexes/'+index.fields[0].fieldPath,queryScope:index.queryScope,fields:completeFields(index.fields),state});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});

function fixture({count=4,existing=[],advanceAfterFirstBatch=0,createStatus=200,readyAfterWait=false,expireTime,source401=false,delegation401=false,create401=false,paginate=false}={}){
  let clock=Date.parse('2026-10-05T00:00:00Z'),active=0,maxActive=0,delegations=0,created=0,sourceRejected=false,delegateRejected=false;
  const indexes=Array.from({length:count},(_,i)=>wanted(i));
  const records=existing.map(([id,state])=>stored(wanted(id),state));
  const calls=[],logs=[],sourceRequests=[],createAttempts=new Map(),credentials=new Map(),initialWaiters=[];
  let firstPoll=true,waits=0;
  const request=async(url,options)=>{
    const body=options.body?JSON.parse(options.body):undefined;
    const token=options.headers.Authorization.slice(7);
    calls.push({url,method:options.method,body,token});
    if(url.includes('iamcredentials')){
      if(delegation401&&!delegateRejected){delegateRejected=true;return json({},401);}
      assert.equal(token,'source-'+Math.floor((clock-Date.parse('2026-10-05T00:00:00Z'))/3600000));
      assert.deepEqual(body,{scope:['https://www.googleapis.com/auth/datastore'],lifetime:'1200s'});
      const accessToken='delegate-'+(++delegations),expiry=clock+1200000;credentials.set(accessToken,expiry);
      await pause();
      return json({accessToken,expireTime:expireTime??new Date(expiry).toISOString()});
    }
    if(options.method==='GET'){
      if(source401&&!sourceRejected){sourceRejected=true;return json({},401);}
      assert.equal(token,'source-'+Math.floor((clock-Date.parse('2026-10-05T00:00:00Z'))/3600000));
      if(paginate&&!url.includes('pageToken='))return json({indexes:[],nextPageToken:'later'});
      if(created&&firstPoll){firstPoll=false;assert.equal(created,count-existing.length,'All missing builds must start before polling.');}
      return json({indexes:records});
    }
    assert.equal(options.method,'POST','No index deletion or unrelated writes.');
    const key=body.fields[0].fieldPath;createAttempts.set(key,(createAttempts.get(key)??0)+1);
    if(create401&&token==='delegate-1')return json({},401);
    if(createStatus!==200)return json({},createStatus);
    assert(credentials.get(token)>clock,'Never submit a create with an expired delegated credential.');
    active++;maxActive=Math.max(maxActive,active);
    if(advanceAfterFirstBatch&&createAttempts.size<=3){
      await new Promise(resolve=>{
        initialWaiters.push(resolve);
        if(initialWaiters.length===3)setImmediate(()=>{clock+=advanceAfterFirstBatch;initialWaiters.forEach(done=>done());});
      });
    }else await pause();
    active--;created++;
    records.push({name:'projects/gtop-app/databases/(default)/collectionGroups/paperRegister/indexes/'+key,...body,state:readyAfterWait?'CREATING':'READY'});
    return json({name:'operations/fixture-create'});
  };
  return {indexes,calls,logs,sourceRequests,records,createAttempts,
    get maxActive(){return maxActive;},get delegations(){return delegations;},get waits(){return waits;},
    options:{indexes,request,now:()=>clock,getSourceToken:async force=>{sourceRequests.push(force);return 'source-'+Math.floor((clock-Date.parse('2026-10-05T00:00:00Z'))/3600000);},
      wait:async ms=>{waits++;clock+=ms;if(readyAfterWait)records.forEach(index=>{index.state='READY';});},
      log:(...values)=>logs.push(values.join(' ')),readyTimeoutMs:60000,pollIntervalMs:1000}};
}

test('resume preserves READY and CREATING indexes, starts all missing builds with concurrency three, and requires READY',async()=>{
  const f=fixture({count:9,existing:[[0,'READY'],[1,'CREATING']],readyAfterWait:true});
  await deployPaperIndexes(f.options);
  assert.equal(f.maxActive,3);assert.equal(f.delegations,1);assert.equal(f.waits,1);
  assert.equal(f.createAttempts.has('field0'),false);assert.equal(f.createAttempts.has('field1'),false);
  assert.equal(f.createAttempts.size,7);assert.equal(f.logs.filter(line=>line.startsWith('Verified READY:')).length,9);
  assert(f.logs.at(-1).startsWith('All reviewed paper indexes are ready.'));
});

for(const minutes of [19.2,21,61])test('delegation refresh before next create after '+minutes+' minutes, with renewed source ADC',async()=>{
  const f=fixture({advanceAfterFirstBatch:minutes*60000});await deployPaperIndexes(f.options);
  assert.equal(f.delegations,2);
  const delegated=f.calls.filter(call=>call.url.includes('iamcredentials'));
  assert.deepEqual(delegated.map(call=>call.token),['source-0',minutes>60?'source-1':'source-0']);
  assert.equal(f.calls.filter(call=>call.method==='POST'&&!call.url.includes('iamcredentials')).at(-1).token,'delegate-2');
});

test('source and delegated 401 refresh once; concurrent failures share one refreshed delegation',async()=>{
  const f=fixture({count:3,source401:true,delegation401:true,create401:true});await deployPaperIndexes(f.options);
  assert.equal(f.delegations,2);assert.equal(f.sourceRequests.filter(Boolean).length,2);
  assert.deepEqual([...f.createAttempts.values()],[2,2,2]);
  assert(f.logs.every(line=>!line.includes('delegate-')&&!line.includes('source-')));
});

test('permanent401 and403 fail closed with bounded retries and no false READY success',async()=>{
  for(const status of [401,403]){
    const f=fixture({count:8,createStatus:status});await assert.rejects(()=>deployPaperIndexes(f.options),new RegExp('HTTP '+status));
    assert(f.createAttempts.size<=3,'Stop launching further work after a failed create.');
    assert([...f.createAttempts.values()].every(count=>count<=(status===401?2:1)));
    assert(!f.logs.some(line=>line.startsWith('All reviewed')));
  }
});

test('invalid or expired delegation fails before any create',async()=>{
  for(const expiry of ['invalid','2026-10-05T00:00:30Z','2026-10-04T00:00:00Z']){
    const f=fixture({expireTime:expiry});await assert.rejects(()=>deployPaperIndexes(f.options),/missing or expired credentials/);
    assert.equal(f.createAttempts.size,0);
  }
});

test('existing repair failure and unready/absent409 result cannot bypass READY gate',async()=>{
  const repair=fixture({count:1,existing:[[0,'NEEDS_REPAIR']]});await assert.rejects(()=>deployPaperIndexes(repair.options),/needs repair/);assert.equal(repair.createAttempts.size,0);
  const waiting=fixture({count:1,existing:[[0,'CREATING']]});await assert.rejects(()=>deployPaperIndexes({...waiting.options,readyTimeoutMs:2000}),/did not become READY/);assert.equal(waiting.createAttempts.size,0);
  const conflict=fixture({count:1,createStatus:409});await assert.rejects(()=>deployPaperIndexes({...conflict.options,readyTimeoutMs:2000}),/did not become READY/);
});

test('paginated list finds matching existing index and makes no duplicate create',async()=>{
  const f=fixture({count:1,existing:[[0,'READY']],paginate:true});await deployPaperIndexes(f.options);
  assert.equal(f.createAttempts.size,0);assert.equal(f.delegations,0);
  assert(f.calls.some(call=>call.url.includes('pageToken=later')));
});

test('ADC provider uses actual auth-client refresh, preserves credential context and forces renewal after401',async()=>{
  const client=new OAuth2Client();let refreshed=0,created=0;
  client.setCredentials({access_token:'expired',expiry_date:1,refresh_token:'fixture-refresh'});
  client.refreshTokenNoCache=async token=>{assert.equal(token,'fixture-refresh');return {tokens:{access_token:'source-'+(++refreshed),expiry_date:Date.now()+3600000}};};
  const provider=createSourceTokenProvider(async()=>{created++;return client;});
  assert.equal(await provider(),'source-1');assert.equal(await provider(),'source-1');
  client.setCredentials({...client.credentials,expiry_date:Date.now()-1});
  assert.equal(await provider(),'source-2');assert.equal(await provider(true),'source-3');
  assert.equal(created,1);assert.equal(client.credentials.refresh_token,'fixture-refresh');
});
