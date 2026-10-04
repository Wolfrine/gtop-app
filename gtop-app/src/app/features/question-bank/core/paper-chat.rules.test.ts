import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,getDocs,collection,query,where} from 'firebase/firestore';
import {beforeAll,afterAll,it} from 'vitest';
let env:RulesTestEnvironment;
beforeAll(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-paper-chat',firestore:{rules:readFileSync(process.env['GTOP_RULES_FILE']||'firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
  await env.withSecurityRulesDisabled(async ctx=>{
    for(const [uid,role] of [['admin-chat','admin'],['admin-other','admin'],['learner-chat','user']])await setDoc(doc(ctx.firestore(),'users',uid),{uid,role});
    for(const [path,data] of [['paperArtifacts/one/documents/answers',{html:'Private answers'}],['paperQuestions/q',{solutions:['Private solution'],status:'ready'}],['paperNotifications/n',{ownerUid:'admin-chat',read:false}],['paperBackendSecrets/webPush',{privateKey:'secret'}],['paperPushSubscriptions/admin-chat/devices/one',{endpoint:'private'}]] as const)await setDoc(doc(ctx.firestore(),path),data);
  });
});
afterAll(async()=>env?.cleanup());
it('admins can submit a chat request and read saved artifacts without fabricating agent output',async()=>{
  const db=env.authenticatedContext('admin-chat').firestore();
  await assertSucceeds(setDoc(doc(db,'paperConversations/c'),{ownerUid:'admin-chat',status:'queued'}));
  await assertSucceeds(setDoc(doc(db,'paperRequests/r'),{source:'admin-paper-chat',status:'queued'}));
  await assertSucceeds(setDoc(doc(db,'paperMessages/m'),{role:'admin',createdBy:'admin-chat',conversationId:'c'}));
  await assertSucceeds(getDoc(doc(db,'paperArtifacts/one/documents/answers')));
  await assertFails(setDoc(doc(db,'paperMessages/fake-agent'),{role:'agent',text:'Ready'}));
  await assertFails(setDoc(doc(db,'paperArtifacts/one/documents/answers'),{html:'Changed answers'}));
  await assertFails(updateDoc(doc(db,'paperQuestions/q'),{status:'ready'}));
});
it('notifications belong to their requesting admin and only read state can change',async()=>{
  const db=env.authenticatedContext('admin-chat').firestore();
  await assertSucceeds(getDocs(query(collection(db,'paperNotifications'),where('ownerUid','==','admin-chat'))));
  await assertSucceeds(updateDoc(doc(db,'paperNotifications/n'),{read:true}));
  await assertFails(updateDoc(doc(db,'paperNotifications/n'),{text:'Spoofed'}));
  await assertFails(getDoc(doc(env.authenticatedContext('admin-other').firestore(),'paperNotifications/n')));
});
it('learners and visitors cannot read paper chat, generated bank or answer artifacts',async()=>{
  for(const db of [env.authenticatedContext('learner-chat').firestore(),env.unauthenticatedContext().firestore()])for(const path of ['paperConversations/c','paperRequests/r','paperMessages/m','paperArtifacts/one/documents/answers','paperQuestions/q','paperNotifications/n'])await assertFails(getDoc(doc(db,path)));
});
it('push keys and subscription endpoints are inaccessible to browser admins',async()=>{
  const db=env.authenticatedContext('admin-chat').firestore();
  for(const path of ['paperBackendSecrets/webPush','paperPushSubscriptions/admin-chat/devices/one']){
    await assertFails(getDoc(doc(db,path)));await assertFails(setDoc(doc(db,path),{value:'changed'}));
  }
});
