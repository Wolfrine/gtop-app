import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const project='gtop-app';
const runtime='78765581239-compute@developer.gserviceaccount.com';
// Reuse the existing deployment delegation. This command can only obtain a
// short-lived token and GET the derived readiness document; it never backfills.
export async function checkPaperRegisterReady({accessToken,request=fetch}={}){
  if(!accessToken)throw Error('Existing deployment authentication is required for the readiness check.');
  const delegated=await request('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+runtime+':generateAccessToken',{
    method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
    body:JSON.stringify({scope:['https://www.googleapis.com/auth/datastore'],lifetime:'300s'}),signal:AbortSignal.timeout(30000)
  });
  if(!delegated.ok)throw Error('The existing runtime delegation failed ('+delegated.status+').');
  const token=(await delegated.json()).accessToken;
  if(!token)throw Error('The runtime delegation returned no access token.');
  const response=await request('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/paperRegisterState/v1',{
    method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)
  });
  if(response.status===404)return {ready:false,reason:'The shared paper register has not been initialized.'};
  if(!response.ok)throw Error('Shared paper register readiness could not be read ('+response.status+').');
  const fields=(await response.json()).fields??{};
  const ready=fields.schemaVersion?.integerValue==='1'&&fields.ready?.booleanValue===true;
  return {ready,reason:ready?'The shared paper register schema 1 is ready.':'The shared paper register schema or historical verification is incomplete.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=await checkPaperRegisterReady({accessToken:process.env.ACCESS_TOKEN});
  console.log((result.ready?'Development hosting may proceed. ':'Development hosting skipped. ')+result.reason);
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'ready='+result.ready+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### Paper register readiness\n\n'+(result.ready?'Ready for development hosting. ':'Development hosting skipped; build and test verification remains available. ')+result.reason+'\n');
}
