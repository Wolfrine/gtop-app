import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkPaperRegisterReady} from '../scripts/check-paper-register-ready.mjs';

function requestFor(body,status=200){
  const calls=[];
  return {calls,request:async(url,options)=>{
    calls.push({url,...options});
    return calls.length===1?new Response(JSON.stringify({accessToken:'delegated-fixture'}),{status:200}):new Response(JSON.stringify(body),{status});
  }};
}
test('ready schema permits hosting through existing short-lived delegation and one datastore GET only',async()=>{
  const fixture=requestFor({fields:{schemaVersion:{integerValue:'1'},ready:{booleanValue:true}}});
  assert.equal((await checkPaperRegisterReady({accessToken:'fixture',request:fixture.request})).ready,true);
  assert.equal(fixture.calls.length,2);
  assert.equal(fixture.calls[0].method,'POST');assert.match(fixture.calls[0].url,/78765581239-compute@developer.gserviceaccount.com:generateAccessToken$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].body),{scope:['https://www.googleapis.com/auth/datastore'],lifetime:'300s'});
  assert.equal(fixture.calls[1].method,'GET');assert.match(fixture.calls[1].url,/\/documents\/paperRegisterState\/v1$/);assert.equal(fixture.calls[1].body,undefined);
});
test('absent, incomplete and mismatched schemas skip without writing source or derived data',async()=>{
  for(const [body,status] of [[{},404],[{},200],[{fields:{schemaVersion:{integerValue:'1'},ready:{booleanValue:false}}},200],[{fields:{schemaVersion:{integerValue:'2'},ready:{booleanValue:true}}},200]]){
    const fixture=requestFor(body,status);assert.equal((await checkPaperRegisterReady({accessToken:'fixture',request:fixture.request})).ready,false);assert.equal(fixture.calls.length,2);
  }
});
test('authentication and transport failures stay errors rather than reporting index readiness',async()=>{
  await assert.rejects(()=>checkPaperRegisterReady(),/authentication/);
  await assert.rejects(()=>checkPaperRegisterReady({accessToken:'fixture',request:async()=>new Response('',{status:403})}),/delegation failed/);
  const fixture=requestFor({},503);await assert.rejects(()=>checkPaperRegisterReady({accessToken:'fixture',request:fixture.request}),/could not be read/);
});
test('workflow gates development promotion when protected backend is skipped and preserves production verification',()=>{
  const workflow=readFileSync(new URL('../../.github/workflows/firebase-deploy.yml',import.meta.url),'utf8');
  assert.match(workflow,/needs: \[reviewed-backend, build-and-verify\]/);
  assert.match(workflow,/if: needs\.reviewed-backend\.result == 'success' \|\| steps\.register-ready\.outputs\.ready == 'true'/);
  assert.match(workflow,/if: steps\.deploy\.outcome == 'success'/);
  assert.match(workflow,/if: needs\.promote-hosting\.outputs\.promoted == 'true'/);
  assert.match(workflow,/inputs\.target != 'production' \|\| github\.ref_name == 'main'/);
});
