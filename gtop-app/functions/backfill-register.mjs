import {Firestore} from 'firebase-admin/firestore';
import {GoogleAuth,Impersonated,OAuth2Client} from 'google-auth-library';
import {runBackfill} from './paper-register.mjs';

// Uses the same existing runtime delegation as deploy-paper-indexes.mjs. No
// source documents, permanent keys or IAM grants are written. Trigger deployment
// must precede this step; its checkpoint is safe to resume after exit code 2.
const project=process.env.GCLOUD_PROJECT||'gtop-app';
if(!process.env.FIRESTORE_EMULATOR_HOST&&!process.argv.includes('--live-derived-index'))throw Error('Pass --live-derived-index to authorize writing the derived register using existing credentials.');
let delegatedAuth;
if(!process.env.FIRESTORE_EMULATOR_HOST){
  // ADC is used only to refresh the existing impersonation source credential.
  // All datastore reads/writes still use the same pre-authorized runtime target.
  let sourceClient;
  if(process.env.GOOGLE_APPLICATION_CREDENTIALS)sourceClient=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
  else{if(!process.env.ACCESS_TOKEN)throw Error('Existing deployment ADC or an authenticated deployment token is required.');sourceClient=new OAuth2Client();sourceClient.setCredentials({access_token:process.env.ACCESS_TOKEN});}
  const authClient=new Impersonated({sourceClient,targetPrincipal:'78765581239-compute@developer.gserviceaccount.com',targetScopes:['https://www.googleapis.com/auth/datastore'],lifetime:1200});
  delegatedAuth=new GoogleAuth({projectId:project,authClient});
}
const db=new Firestore({projectId:project,...(delegatedAuth?{auth:delegatedAuth}:{})});
const boundedInteger=(name,fallback,maximum)=>{
  const value=Number(process.env[name]??fallback);
  if(!Number.isInteger(value)||value<1||value>maximum)throw Error(`${name} must be an integer from 1 to ${maximum}.`);
  return value;
};
const budget=boundedInteger('REGISTER_BACKFILL_BUDGET',10000,10000);
const untilReady=process.argv.includes('--until-ready');
const passes=untilReady?boundedInteger('REGISTER_BACKFILL_MAX_PASSES',30,100):1;
const maxMs=boundedInteger('REGISTER_BACKFILL_MAX_MS',2400000,7200000),started=Date.now();
let result;
try{
  for(let pass=1;pass<=passes&&Date.now()-started<maxMs;pass++){
    result=await runBackfill(db,{maxDocuments:budget,reset:pass===1&&process.argv.includes('--restart')});
    console.log(JSON.stringify({project,pass,ready:result.ready,processed:result.processed,phase:result.state.phase,collectionIndex:result.state.collectionIndex,cursor:result.state.cursor,checked:result.state.checked,elapsedMs:Date.now()-started}));
    if(result.ready)break;
  }
}finally{await db.terminate();}
if(!result?.ready){console.error('Historical register verification is incomplete; hosting remains blocked. Checkpoints were retained. Resume: node backfill-register.mjs --live-derived-index --until-ready (do not add --restart).');process.exitCode=2;}
