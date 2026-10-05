import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { SwPush } from '@angular/service-worker';
import { collection,doc,getDocFromServer,getDoc,getDocsFromServer,documentId,startAfter,limit,orderBy,query,runTransaction,serverTimestamp,where,updateDoc,type Query } from '@angular/fire/firestore';
import { map,filter,switchMap,of } from 'rxjs';
import { FirebaseClient } from './firebase';
import { FirestoreReadService } from '../../../services/firestore-read.service';
import { AuthService } from '../../../services/auth.service';
import { QuestionPaperRepository } from './question-paper.repository';
import { nextPaperRun,type PaperConversation,type PaperChatMessage,type PaperChatRequest,type ChatSavedPaper,type PaperNotification } from './paper-chat.models';

@Injectable({providedIn:'root'})
export class PaperChatRepository {
  private readonly gateway=['127.0.0.1','localhost'].includes(window.location.hostname)&&new URLSearchParams(window.location.search).has('emulator')
    ?'http://127.0.0.1:5001/gtop-app/us-central1/paperGateway'
    :'https://us-central1-gtop-app.cloudfunctions.net/paperGateway';
  constructor(private readonly client:FirebaseClient,private readonly reads:FirestoreReadService,private readonly auth:Auth,private readonly profile:AuthService,private readonly legacy:QuestionPaperRepository,private readonly push:SwPush){}
  private watch<T>(q:Query){return this.reads.watch(q).pipe(filter(snapshot=>!snapshot.metadata.fromCache||!snapshot.empty),map(snapshot=>snapshot.docs.map(item=>({...item.data(),id:item.id}) as T)));}
  conversations$(){return this.watch<PaperConversation>(query(collection(this.client.firestore,'paperConversations'),orderBy('updatedAt','desc'),limit(40)));}
  messages$(id:string){return this.watch<PaperChatMessage>(query(collection(this.client.firestore,'paperMessages'),where('conversationId','==',id),orderBy('createdAt','desc'),limit(150))).pipe(map(items=>items.sort((a,b)=>time(a.createdAt)-time(b.createdAt)||a.id.localeCompare(b.id))));}
  requests$(id:string){return this.watch<PaperChatRequest>(query(collection(this.client.firestore,'paperRequests'),where('conversationId','==',id),orderBy('createdAt','desc'),limit(100)));}
  savedPapers$(){return this.legacy.draftUpdates().pipe(map(items=>items as ChatSavedPaper[]));}
  async olderPapers(cursor:string){return await this.legacy.recentDrafts(cursor) as ChatSavedPaper[];}
  notifications$(){return this.profile.readyUser$.pipe(switchMap(profile=>profile?.uid?this.watch<PaperNotification>(query(collection(this.client.firestore,'paperNotifications'),where('ownerUid','==',profile.uid),orderBy('createdAt','desc'),limit(50))):of([])));}
  get uid(){return this.auth.currentUser?.uid??'';}
  conversation$(id:string){return this.watch<PaperConversation>(query(collection(this.client.firestore,'paperConversations'),where(documentId(),'==',id),limit(1)));}
  conversationPapers$(id:string){return this.watch<ChatSavedPaper>(query(collection(this.client.firestore,'paperDrafts'),where('conversationId','==',id),orderBy('createdAt','desc'),limit(20)));}
  async olderMessages(id:string,cursor:string){return this.older<PaperChatMessage>('paperMessages',id,cursor,50);}
  async olderRequests(id:string,cursor:string){return this.older<PaperChatRequest>('paperRequests',id,cursor,50);}
  async olderConversationPapers(id:string,cursor:string){return this.older<ChatSavedPaper>('paperDrafts',id,cursor,20);}
  private async older<T>(name:string,id:string,cursor:string,count:number):Promise<T[]>{
    const anchor=await getDocFromServer(doc(this.client.firestore,name,cursor));
    if(!anchor.exists())throw Error('The history position changed. Refresh this record and try again.');
    const snapshot=await getDocsFromServer(query(collection(this.client.firestore,name),where('conversationId','==',id),orderBy('createdAt','desc'),startAfter(anchor),limit(count)));
    return snapshot.docs.map(item=>({...item.data(),id:item.id}) as T);
  }
  async send(text:string,conversationId?:string,operation?:{id:string;expectedRevision?:number;expectedRequestId?:string}):Promise<string>{
    const brief=text.trim();const uid=this.auth.currentUser?.uid;
    if(!uid||!this.profile.isAdmin())throw Error('Sign in as an admin to request a paper.');
    if(!brief||brief.length>12000)throw Error('Enter a requirement of up to 12,000 characters.');
    const conversation=doc(this.client.firestore,'paperConversations',conversationId||operation?.id||crypto.randomUUID());
    const request=doc(this.client.firestore,'paperRequests',operation?.id||crypto.randomUUID());
    const message=doc(this.client.firestore,'paperMessages',request.id+'-admin');
    const ack=doc(this.client.firestore,'paperMessages',request.id+'-queued');
    // A revision supersedes in-flight work. The publisher checks the current ID
    // before delivering, so an older worker cannot answer a newer requirement.
    try {await runTransaction(this.client.firestore,async tx=>{
      const replay=await tx.get(request);
      if(replay.exists()){
        if(replay.data()['requestedBy']!==uid||replay.data()['brief']!==brief||replay.data()['conversationId']!==conversation.id)throw Error('This saved attempt belongs to a different requirement. Refresh and try again.');
        return;
      }
      const old=await tx.get(conversation);
      if(conversationId&&!old.exists())throw Error('This paper record no longer exists. Your text is still here.');
      if(operation&&conversationId&&(Number(old.data()?.['revision']??0)!==operation.expectedRevision||(old.data()?.['activeRequestId']??'')!==(operation.expectedRequestId??'')))throw Error('This record changed while you were writing. Your text is still here. Review the current request, then submit it again.');
      const previousId=old.data()?.['activeRequestId'];
      const previous=previousId?await tx.get(doc(this.client.firestore,'paperRequests',previousId)):null;
      const revision=Number(old.data()?.['revision']??0)+1;
      if(previous?.exists()&&!['completed','cancelled'].includes(previous.data()['status']))tx.update(previous.ref,{status:'cancelled',supersededBy:request.id,updatedAt:serverTimestamp()});
      tx.set(conversation,{title:old.data()?.['title']||brief.slice(0,90),ownerUid:old.data()?.['ownerUid']||uid,status:'queued',activeRequestId:request.id,revision,updatedAt:serverTimestamp(),...(!old.exists()?{createdAt:serverTimestamp()}: {})},{merge:true});
      tx.set(request,{source:'admin-paper-chat',conversationId:conversation.id,brief,requestedBy:uid,revision,status:'queued',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),nextRunAtIso:nextPaperRun().toISOString(),progress:{step:'Waiting for the scheduled agent',reused:0,generated:0}});
      tx.set(message,{conversationId:conversation.id,role:'admin',text:brief,requestId:request.id,createdAt:serverTimestamp(),createdBy:uid});
      tx.set(ack,{conversationId:conversation.id,role:'system',text:'Requirement saved. The agent will check the existing question bank first and prepare your paper at the next scheduled run.',requestId:request.id,createdAt:serverTimestamp()});
    });} catch(error) {
      // A concurrent identical attempt may lose at create-only message rules
      // before the SDK retries. Reconcile only the exact atomic saved request;
      // changed text, another identity, or lost read permission still fails.
      if(operation){
        try {
          const saved=await getDocFromServer(request);
          const data=saved.data();
          if(saved.exists()&&data?.['requestedBy']===uid&&data?.['brief']===brief&&data?.['conversationId']===conversation.id)return conversation.id;
        } catch { /* Preserve the original error if current access is denied. */ }
      }
      throw error;
    }
    return conversation.id;
  }
  async cancel(requestId:string):Promise<'cancelled'|'completed'|'already-cancelled'>{
    return runTransaction(this.client.firestore,async tx=>{
      const ref=doc(this.client.firestore,'paperRequests',requestId);const item=await tx.get(ref);
      if(!item.exists())throw Error('This request could not be found.');
      if(item.data()['status']==='completed')return 'completed';
      if(item.data()['status']==='cancelled')return 'already-cancelled';
      const conversation=doc(this.client.firestore,'paperConversations',item.data()['conversationId']);const parent=await tx.get(conversation);
      tx.update(ref,{status:'cancelled',updatedAt:serverTimestamp()});
      if(parent.data()?.['activeRequestId']===requestId)tx.update(conversation,{status:'cancelled',updatedAt:serverTimestamp()});
      return 'cancelled';
    });
  }
  async markRead(id:string){await updateDoc(doc(this.client.firestore,'paperNotifications',id),{read:true});}
  async paper(id:string):Promise<ChatSavedPaper>{
    const item=await getDoc(doc(this.client.firestore,'paperDrafts',id));
    if(!item.exists())throw Error('This paper could not be found.');
    const paper={...item.data(),id:item.id} as ChatSavedPaper;
    if(['publishing','publication-error','superseded'].includes(paper.status))throw Error('This paper has not been completed. Open its conversation for details.');
    if(paper.status==='ready'&&(!paper.paperHtml||!paper.answerHtml)){
      const [question,answer]=await Promise.all(['paper','answers'].map(name=>getDoc(doc(this.client.firestore,'paperArtifacts',id,'documents',name))));
      paper.paperHtml=question.data()?.['html'];paper.answerHtml=answer.data()?.['html'];
      if(!paper.paperHtml||!paper.answerHtml)throw Error('The saved paper files could not be loaded. Please try again.');
    }
    return paper;
  }
  async enablePush(){
    if(!this.push.isEnabled)throw Error('Device notifications are available in the installed or production app.');
    const token=await this.auth.currentUser?.getIdToken();if(!token)throw Error('Sign in again to enable notifications.');
    const config=await fetch(this.gateway+'/config',{headers:{Authorization:'Bearer '+token}});
    if(!config.ok)throw Error('Notifications could not be enabled. Please try again.');
    const {publicKey}=await config.json();
    const subscription=await this.push.requestSubscription({serverPublicKey:publicKey});
    const saved=await fetch(this.gateway+'/subscribe',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(subscription.toJSON())});
    if(!saved.ok)throw Error('Could not save this device. Your in-app notifications will still appear.');
  }
}
function time(value:any):number{return value?.toMillis?.()??(value?.seconds?value.seconds*1000:Date.parse(value?.iso??value??'')||0);}
