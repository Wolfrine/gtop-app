import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {Firestore,Timestamp} from 'firebase-admin/firestore';
import {GoogleAuth,Impersonated,OAuth2Client} from 'google-auth-library';
import {credentials} from '@grpc/grpc-js';
import {createDelegatedFirestore} from './delegated-firestore.mjs';
import {hash,paperContentHash,renderPaper,validateBankSnapshot} from './paper-engine.mjs';

const resource='projects/demo-compat/databases/(default)/documents/paperDrafts/synthetic';
const fields=['title','board','standard','subjects','chapters','durationMinutes','marks','instructions','sections','conversationId','parentRequestId','requestRevision'];
const originalHash=paper=>hash(Object.fromEntries(fields.map(field=>[field,paper[field]??null])));
const reverseMaps=value=>Array.isArray(value)?value.map(reverseMaps):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reverseMaps(value[key])])):value;
const question={questionId:'synthetic-q1',sourceCollection:'paperQuestions',origin:'bank',board:'CBSE',standard:'9',subject:'Physics',chapter:'Motion',question:'Which quantity is a vector?',marks:1,questionType:'mcq',difficulty:'easy',options:['Speed','Velocity'],correctIndex:1,solutions:['Velocity includes direction.'],assets:[]};
const paper={title:'Synthetic motion paper',board:'CBSE',standard:'9',subjects:['Physics'],chapters:['Motion'],durationMinutes:30,marks:2,instructions:['Answer both questions.'],sections:[{title:'Section A',questions:[question,{...question,questionId:'synthetic-q2',question:'Which unit measures velocity?',options:['m/s','kg'],correctIndex:0,solutions:['Velocity is measured in m/s.']}]}],conversationId:'synthetic-conversation',parentRequestId:'synthetic-request',requestRevision:1};

test('actual Gen1 JSON and Firestore protobuf snapshots compare by map values, not map enumeration',async()=>{
  const app=initializeApp({projectId:'demo-compat'});
  const db=new Firestore({projectId:'demo-compat'});
  try{
    const require=createRequire(import.meta.url);
    const {createSnapshotFromJson}=require(join(dirname(require.resolve('firebase-functions')),'../common/providers/firestore.js'));
    const time={seconds:1791158400,nanos:0};
    const normal={name:resource,fields:db._serializer.encodeFields(paper),createTime:time,updateTime:time};
    const reordered={name:resource,fields:db._serializer.encodeFields(reverseMaps(paper)),createTime:'2026-10-05T00:00:00Z',updateTime:'2026-10-05T00:00:00Z'};
    const event=createSnapshotFromJson({value:reordered},resource,'2026-10-05T00:00:00Z','2026-10-05T00:00:00Z').data();
    const transaction=db.snapshot_(normal,{seconds:1791158400,nanos:0},'protobufJS').data();
    assert.deepEqual(event,transaction);
    assert.notEqual(originalHash(event),originalHash(transaction),'Reproduce the old order-sensitive guard failure.');
    assert.equal(paperContentHash(event),paperContentHash(transaction));
    assert.equal(renderPaper(event),renderPaper(transaction));
    assert.equal(renderPaper(event,true),renderPaper(transaction,true));
  }finally{await db.terminate();await deleteApp(app);}
});

test('publication guard still rejects every selected field change and nested question/answer/marks changes',()=>{
  const baseline=paperContentHash(paper);
  for(const field of fields){
    const changed=structuredClone(paper);
    changed[field]=typeof changed[field]==='number'?changed[field]+1:typeof changed[field]==='string'?changed[field]+' changed':Array.isArray(changed[field])?[...changed[field],'changed']:true;
    assert.notEqual(paperContentHash(changed),baseline,field);
  }
  for(const mutate of [q=>{q.question+=' changed';},q=>{q.marks++;},q=>{q.solutions[0]+=' changed';},q=>{q.correctIndex=0;},q=>{q.questionId+=' changed';},q=>{q.options.reverse();}]){
    const changed=structuredClone(paper);mutate(changed.sections[0].questions[0]);assert.notEqual(paperContentHash(changed),baseline);
  }
  const swapped=structuredClone(paper);swapped.sections[0].questions.reverse();assert.notEqual(paperContentHash(swapped),baseline);
  assert.equal(paperContentHash({...paper,status:'publishing',publicationLease:{id:'other'}}),baseline,'Operational lease/status fields are not content.');
});

test('artifact hashing remains byte-exact and never adopts canonical JSON semantics',()=>{
  const student=renderPaper(paper),key=renderPaper(paper,true);
  assert.notEqual(hash(student),hash(key));assert.notEqual(hash(student),hash(student+' '));
  assert.equal(renderPaper(reverseMaps(paper)),student);assert.equal(renderPaper(reverseMaps(paper),true),key);
  assert.notEqual(hash({a:1,b:2}),hash({b:2,a:1}),'Generic hash is unchanged; only publication content guard is canonical.');
});

test('canonical guard retains primitive types, null and native Date/Timestamp serialization',()=>{
  const values=[1,'1',null,false,{},new Date('2026-10-05T00:00:00Z'),new Date('2026-10-06T00:00:00Z'),new Timestamp(100,1),new Timestamp(100,2)];
  const digests=values.map(value=>{
    const changed=structuredClone(paper);changed.sections[0].questions[0].metadata=value;
    return paperContentHash(changed);
  });
  assert.equal(new Set(digests).size,values.length);
});

test('bank diagrams and blocks accept equivalent maps but retain asset/block order and value guards',()=>{
  const source={...question,status:'ready',assets:[{url:'https://example.test/a.png',alt:'Diagram A'},{url:'https://example.test/b.png',alt:'Diagram B'}],
    blocks:[{type:'text',text:'Read the diagram.'},{type:'table',rows:[['Speed','Velocity'],['Scalar','Vector']]}]};
  const candidate=reverseMaps(source);assert.deepEqual(candidate,source);
  assert.notEqual(JSON.stringify(candidate.assets),JSON.stringify(source.assets));
  assert.doesNotThrow(()=>validateBankSnapshot(candidate,source));
  for(const mutate of [p=>{p.assets[0].alt='Changed';},p=>{p.assets[0].url+='?changed';},p=>{p.assets.reverse();},p=>{p.blocks[0].text='Changed';},p=>{p.blocks[1].rows[0].reverse();},p=>{p.blocks.reverse();}]){
    const changed=structuredClone(candidate);mutate(changed);assert.throws(()=>validateBankSnapshot(changed,source),/diagrams or content blocks differ/);
  }
});

const metadataFor=client=>credentials.createFromGoogleCredential(client).generateMetadata({service_url:'https://firestore.googleapis.com/google.firestore.v1.Firestore',method_name:'BatchGetDocuments'});
test('actual grpc adapter reproduces authorization loss from unadapted auth-library10 Headers',async()=>{
  const sourceClient=new OAuth2Client();
  const impersonated=new Impersonated({sourceClient,targetPrincipal:'78765581239-compute@developer.gserviceaccount.com',targetScopes:['https://www.googleapis.com/auth/datastore'],lifetime:1200});
  impersonated.setCredentials({access_token:'synthetic-runtime',expiry_date:Date.now()+1200000});
  const auth=new GoogleAuth({projectId:'demo-compat',authClient:impersonated});
  const db=new Firestore({projectId:'demo-compat',auth});
  try{
    await db._clientPool.run('unadapted-auth-check',true,async client=>{
      assert.equal(client.auth,auth);assert.equal(await client.auth.getClient(),impersonated);
      const headers=await impersonated.getRequestHeaders();assert.equal(headers.has('authorization'),true);
      assert.deepEqual((await metadataFor(impersonated)).get('authorization'),[]);
    });
  }finally{await db.terminate();}
});

test('actual Firestore/GAX/grpc metadata carries only delegated authorization before and after refresh',async()=>{
  const sourceClient=new OAuth2Client();let refreshes=0;
  sourceClient.setCredentials({access_token:'synthetic-source',expiry_date:Date.now()+3600000});
  sourceClient.request=async options=>{
    assert.match(options.url,/serviceAccounts\/78765581239-compute@developer.gserviceaccount.com:generateAccessToken$/);
    assert.deepEqual(options.data.scope,['https://www.googleapis.com/auth/datastore']);
    assert.equal(options.data.lifetime,'1200s');
    return {data:{accessToken:'synthetic-runtime-'+(++refreshes),expireTime:new Date(Date.now()+1200000).toISOString()}};
  };
  const db=createDelegatedFirestore('demo-compat',sourceClient);
  try{
    await db._clientPool.run('adapted-auth-check',true,async client=>{
      const authClient=await client.auth.getClient();assert(authClient instanceof Impersonated);
      assert.deepEqual((await metadataFor(authClient)).get('authorization'),['Bearer synthetic-runtime-1']);
      assert.deepEqual((await metadataFor(authClient)).get('authorization'),['Bearer synthetic-runtime-1']);assert.equal(refreshes,1);
      authClient.setCredentials({...authClient.credentials,expiry_date:1});
      assert.deepEqual((await metadataFor(authClient)).get('authorization'),['Bearer synthetic-runtime-2']);assert.equal(refreshes,2);
    });
  }finally{await db.terminate();}
});
