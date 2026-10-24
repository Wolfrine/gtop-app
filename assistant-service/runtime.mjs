import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {onRequest} from 'firebase-functions/v2/https';
import {AssistantService} from './service.mjs';
import {FirestoreStore} from './store.mjs';
import {createGateway} from './gateway.mjs';
if(!getApps().length)initializeApp();
const auth=getAuth();
const service=new AssistantService(new FirestoreStore(getFirestore()),{signer:(uid,claims)=>auth.createCustomToken(uid,claims)});
const route=createGateway(service,token=>auth.verifyIdToken(token,true),{allowLocalOrigins:process.env.FUNCTIONS_EMULATOR==='true'});
export const gtopAssistantGateway=onRequest({region:'us-central1',memory:'512MiB',timeoutSeconds:60,maxInstances:3,concurrency:40,invoker:'public'},async(req,res)=>{
  const result=await route({method:req.method,path:req.path,headers:req.headers,body:req.body});
  for(const [key,value]of Object.entries(result.headers))res.setHeader(key,value);
  res.status(result.status);if(result.status===204)res.end();else if(typeof result.body==='string')res.send(result.body);else res.json(result.body);
});
