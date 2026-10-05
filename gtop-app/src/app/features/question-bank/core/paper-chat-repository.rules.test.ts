// Regression cases ported from independent journey QA; real emulator transactions and rules.
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,query,setDoc,where} from 'firebase/firestore';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
vi.mock('@angular/core',()=>({Injectable:()=>(value:unknown)=>value}));
vi.mock('@angular/fire/firestore',async()=>({...await import('firebase/firestore'),Firestore:class{}}));
vi.mock('./firebase',()=>({FirebaseClient:class{}}));
vi.mock('../../../services/firestore-read.service',()=>({FirestoreReadService:class{}}));
vi.mock('../../../services/auth.service',()=>({AuthService:class{}}));
vi.mock('./question-paper.repository',()=>({QuestionPaperRepository:class{}}));
import {PaperChatRepository} from './paper-chat.repository';

let env:RulesTestEnvironment,db:any,repo:PaperChatRepository;
const uid='qa-repository-admin',tag='qa-op-'+Date.now();
beforeAll(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-paper-chat-repository',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync(process.env['GTOP_RULES_FILE']||'firestore.rules','utf8')}});
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'users',uid),{uid,role:'admin'}));
  db=env.authenticatedContext(uid).firestore();
  repo=new PaperChatRepository({firestore:db} as any,{} as any,{currentUser:{uid}} as any,{isAdmin:()=>true} as any,{} as any,{} as any);
});
afterAll(async()=>env?.cleanup());

it('same operation replay/concurrent retry creates one request and one admin message',async()=>{
  const id=tag+'-replay',text='ICSE 9 Biology, Cells, 2 marks.';
  expect(await Promise.all([repo.send(text,undefined,{id}),repo.send(text,undefined,{id})])).toEqual([id,id]);
  expect((await getDoc(doc(db,'paperConversations',id))).data()?.revision).toBe(1);
  const requests=await getDocs(query(collection(db,'paperRequests'),where('conversationId','==',id)));
  const messages=await getDocs(query(collection(db,'paperMessages'),where('conversationId','==',id)));
  expect(requests.size).toBe(1);expect(messages.size).toBe(2);
  await expect(repo.send(text+' changed',undefined,{id})).rejects.toThrow(/different requirement/);
});

it('stale revision refuses mutation and replay cannot reactivate superseded work',async()=>{
  const id=tag+'-stale',first='ICSE 9 Biology 2 marks.',second='Use 4 marks.',request2=id+'-v2',stale=id+'-stale-v2';
  await repo.send(first,undefined,{id});
  await repo.send(second,id,{id:request2,expectedRevision:1,expectedRequestId:id});
  await expect(repo.send('Use 6 marks.',id,{id:stale,expectedRevision:1,expectedRequestId:id})).rejects.toThrow(/changed while you were writing/);
  expect((await getDoc(doc(db,'paperRequests',stale))).exists()).toBe(false);
  await repo.send(first,undefined,{id});
  const conversation=(await getDoc(doc(db,'paperConversations',id))).data();
  expect(conversation?.activeRequestId).toBe(request2);expect(conversation?.revision).toBe(2);
  expect((await getDoc(doc(db,'paperRequests',id))).data()?.status).toBe('cancelled');
  expect((await getDoc(doc(db,'paperRequests',request2))).data()?.status).toBe('queued');
});

it('concurrent replies to the same revision produce one successor, with loser retained for retry',async()=>{
  const id=tag+'-race';await repo.send('Base requirement',undefined,{id});
  const attempts=await Promise.allSettled([
    repo.send('First admin revision',id,{id:id+'-a',expectedRevision:1,expectedRequestId:id}),
    repo.send('Second admin revision',id,{id:id+'-b',expectedRevision:1,expectedRequestId:id}),
  ]);
  expect(attempts.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect(attempts.filter(x=>x.status==='rejected')).toHaveLength(1);
  const requests=await getDocs(query(collection(db,'paperRequests'),where('conversationId','==',id)));
  expect(requests.size).toBe(2);
  expect(requests.docs.filter(x=>x.data().status==='queued')).toHaveLength(1);
  expect((await getDoc(doc(db,'paperConversations',id))).data()?.revision).toBe(2);
});

it('cancel reports completion truthfully and never cancels a completed request',async()=>{
  const id=tag+'-completed';await repo.send('Initial paper',undefined,{id});
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'paperRequests',id),{status:'completed',paperId:id+'-paper'},{merge:true});
    await setDoc(doc(ctx.firestore(),'paperConversations',id),{status:'completed'},{merge:true});
  });
  expect(await repo.cancel(id)).toBe('completed');
  expect((await getDoc(doc(db,'paperRequests',id))).data()?.status).toBe('completed');
  const queued=tag+'-cancel';await repo.send('Cancel me',undefined,{id:queued});
  expect(await repo.cancel(queued)).toBe('cancelled');
  expect(await repo.cancel(queued)).toBe('already-cancelled');
});
