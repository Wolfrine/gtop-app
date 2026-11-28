import {createECDH, randomUUID} from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {onDocumentWritten,onDocumentCreated} from 'firebase-functions/v2/firestore';
import {onRequest} from 'firebase-functions/v2/https';
import webpush from 'web-push';
import {hash,paperContentHash as contentHash,validatePaper,validateBankSnapshot,renderPaper,imageType} from './paper-engine.mjs';
import {projectSource,refreshRegister,searchRegister} from './paper-register.mjs';
import {legacyAssetBase,legacyBucket,localLegacy,localPaperPolicy} from './legacy-environment.mjs';

initializeApp({storageBucket:legacyBucket});
const db=getFirestore();const bucket=getStorage().bucket();
const stamp=()=>FieldValue.serverTimestamp();
const region='us-central1';
const current=(request,conversation,paper)=>request?.source==='admin-paper-chat'&&['queued','generating','publishing'].includes(request.status)&&conversation?.activeRequestId===paper.parentRequestId&&request.revision===paper.requestRevision;
const cleanId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,140}$/.test(value);

async function immutableFile(path,content,contentType,metadata={}){
  const file=bucket.file(path);const checksum=hash(content);
  try{await file.save(content,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType,cacheControl:'private,max-age=31536000,immutable',metadata:{sha256:checksum,...metadata}}});}
  catch(error){if(Number(error.code)!==412)throw error;const [old]=await file.getMetadata();if(old.metadata?.sha256!==checksum)throw Error('An existing artifact has different content. Create a new paper revision.');}
}
async function immutableHtml(paperId,name,html){
  if(Buffer.byteLength(html)>950_000)throw Error('This printable document is too large. Reduce the paper size.');
  const ref=db.doc('paperArtifacts/'+paperId+'/documents/'+name);const checksum=hash(html);
  try{await ref.create({html,sha256:checksum,createdAt:stamp()});}
  catch(error){if(Number(error.code)!==6)throw error;const old=await ref.get();if(old.data()?.sha256!==checksum)throw Error('An existing artifact has different content. Create a new paper revision.');}
}

export const publishPaper=onDocumentWritten({document:'paperDrafts/{paperId}',region,timeoutSeconds:300,memory:'512MiB',maxInstances:2,retry:true},async event=>{
  const candidate=event.data?.after.data();if(!candidate?.readyToPublish||candidate.status==='ready'||candidate.status==='superseded')return;
  const paperId=event.params.paperId;const lease=randomUUID();const ref=db.doc('paperDrafts/'+paperId);
  if(!cleanId(candidate.parentRequestId)||!cleanId(candidate.conversationId))throw Error('Paper request/conversation IDs are required.');
  const requestRef=db.doc('paperRequests/'+candidate.parentRequestId);const conversationRef=db.doc('paperConversations/'+candidate.conversationId);
  let accepted=false;
  await db.runTransaction(async tx=>{
    const [paper,request,conversation]=await Promise.all([tx.get(ref),tx.get(requestRef),tx.get(conversationRef)]);
    if(paper.data()?.readyToPublish!==true||paper.data()?.status==='ready')return;
    if(!current(request.data(),conversation.data(),candidate)){tx.update(ref,{status:'superseded',readyToPublish:false});return;}
    if(paper.data()?.publicationLease?.expiresAt>Date.now())return;
    tx.update(ref,{status:'publishing',publicationLease:{id:lease,expiresAt:Date.now()+300_000}});
    tx.update(requestRef,{status:'publishing',updatedAt:stamp()});accepted=true;
  });
  if(!accepted)return;
  try{
    const validated=validatePaper(candidate);
    const sources=await db.getAll(...validated.questions.map(question=>db.doc(question.sourceCollection+'/'+question.questionId)));
    validated.questions.forEach((question,index)=>{
      validateBankSnapshot(question,sources[index].data());
      if(question.origin==='generated'&&sources[index].data()?.parentRequestId!==candidate.parentRequestId)throw Error('New question provenance does not match this request.');
    });
    const imageUrls=[...new Set(validated.questions.flatMap(question=>(question.assets??[]).map(asset=>asset.url)))];
    if(imageUrls.length>100)throw Error('A paper can contain at most 100 diagrams.');
    await Promise.all(imageUrls.map(async url=>{
      const response=await fetch(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('A question diagram is unavailable. Upload or replace it before publishing.');
    }));
    const paperHtml=renderPaper(candidate);const answerHtml=renderPaper(candidate,true);
    await Promise.all([immutableHtml(paperId,'paper',paperHtml),immutableHtml(paperId,'answers',answerHtml)]);
    const counts={reusedQuestionCount:validated.reusedQuestionCount,generatedQuestionCount:validated.generatedQuestionCount};
    const inline=Buffer.byteLength(JSON.stringify({...candidate,paperHtml,answerHtml}))<850_000?{paperHtml,answerHtml}:{};
    await db.runTransaction(async tx=>{
      const [paper,request,conversation]=await Promise.all([tx.get(ref),tx.get(requestRef),tx.get(conversationRef)]);
      if(paper.data()?.publicationLease?.id!==lease)return;
      if(!current(request.data(),conversation.data(),candidate)){tx.update(ref,{status:'superseded',readyToPublish:false});return;}
      if(contentHash(paper.data())!==contentHash(candidate))throw Error('The paper changed during publication. Create a new revision.');
      const text=`Your paper is ready: ${candidate.title}. ${validated.questionCount} questions, ${validated.totalMarks} marks. Reused ${counts.reusedQuestionCount} bank questions and created ${counts.generatedQuestionCount} new questions. The answer key is separate.`;
      tx.update(ref,{...inline,...counts,paperArtifactPath:'paperArtifacts/'+paperId+'/documents/paper',answerArtifactPath:'paperArtifacts/'+paperId+'/documents/answers',status:'ready',readyToPublish:false,publishedAt:stamp(),updatedAt:stamp(),contentHash:contentHash(candidate)});
      tx.update(requestRef,{status:'completed',paperId,updatedAt:stamp(),progress:{step:'Paper and answer key ready',reused:counts.reusedQuestionCount,generated:counts.generatedQuestionCount}});
      tx.update(conversationRef,{status:'completed',updatedAt:stamp()});
      tx.set(db.doc('paperMessages/'+paperId+'-delivered'),{conversationId:candidate.conversationId,requestId:candidate.parentRequestId,role:'agent',text,paperId,createdAt:stamp()});
      tx.set(db.doc('paperNotifications/'+candidate.parentRequestId+'-ready'),{ownerUid:request.data().requestedBy,conversationId:candidate.conversationId,paperId,text:`${candidate.title} is ready.`,read:false,createdAt:stamp()});
    });
  }catch(error){
    console.error('Paper publication failed',paperId,error.message);
    await db.runTransaction(async tx=>{
      const [paper,request,conversation]=await Promise.all([tx.get(ref),tx.get(requestRef),tx.get(conversationRef)]);
      if(paper.data()?.publicationLease?.id!==lease)return;
      if(!current(request.data(),conversation.data(),candidate)){tx.update(ref,{status:'superseded',readyToPublish:false,updatedAt:stamp()});return;}
      const reason=String(error.message).slice(0,500);
      tx.update(ref,{status:'publication-error',readyToPublish:false,error:reason,updatedAt:stamp()});
      tx.update(requestRef,{status:'error',error:reason,updatedAt:stamp()});
      tx.update(conversationRef,{status:'error',updatedAt:stamp()});
      tx.set(db.doc('paperMessages/'+paperId+'-error'),{conversationId:candidate.conversationId,requestId:candidate.parentRequestId,role:'agent',text:'The paper could not be completed: '+reason+'. Please reply here to revise or retry the requirement.',createdAt:stamp()});
      tx.set(db.doc('paperNotifications/'+candidate.parentRequestId+'-error'),{ownerUid:request.data().requestedBy,conversationId:candidate.conversationId,text:'Your paper request needs attention. Open the conversation for details.',read:false,createdAt:stamp()});
    });
  }
});

export const uploadPaperAsset=onDocumentWritten({document:'paperAssetUploads/{assetId}',region,timeoutSeconds:300,memory:'512MiB',maxInstances:2,retry:true},async event=>{
  const upload=event.data?.after.data();if(upload?.status!=='submitted')return;
  const id=event.params.assetId;const ref=db.doc('paperAssetUploads/'+id);
  try{
    if(!cleanId(upload.requestId)||!Number.isInteger(upload.partCount)||upload.partCount<1||upload.partCount>64)throw Error('Invalid diagram upload.');
    const request=await db.doc('paperRequests/'+upload.requestId).get();if(!request.exists||request.data().status==='cancelled')throw Error('The diagram request is no longer active.');
    const parts=await ref.collection('parts').orderBy('index').limit(65).get();
    if(parts.size!==upload.partCount||parts.docs.some((part,index)=>part.data().index!==index))throw Error('Diagram upload is incomplete.');
    const encoded=parts.docs.map(part=>part.data().base64).join('');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw Error('Invalid diagram encoding.');
    const bytes=Buffer.from(encoded,'base64');if(bytes.length<16||bytes.length>6*1024*1024||hash(bytes)!==upload.sha256)throw Error('Diagram bytes or checksum are invalid.');
    const type=imageType(bytes);const path='paper-assets/'+id+'.'+type.ext;
    const file=bucket.file(path);let token;
    try{const [metadata]=await file.getMetadata();token=metadata.metadata?.firebaseStorageDownloadTokens;if(metadata.metadata?.sha256!==upload.sha256)throw Error('Diagram ID already has different content.');}
    catch(error){if(Number(error.code)!==404)throw error;token=randomUUID();await immutableFile(path,bytes,type.mime,{firebaseStorageDownloadTokens:token});const [saved]=await file.getMetadata();token=saved.metadata?.firebaseStorageDownloadTokens;}
    if(!token)throw Error('The saved diagram has no download token.');
    const url=legacyAssetBase+'/v0/b/'+bucket.name+'/o/'+encodeURIComponent(path)+'?alt=media&token='+token;
    await ref.update({status:'ready',storagePath:path,url,contentType:type.mime,byteCount:bytes.length,updatedAt:stamp()});
    const batch=db.batch();parts.docs.forEach(part=>batch.delete(part.ref));await batch.commit();
  }catch(error){console.error('Diagram upload failed',id,error.message);await ref.update({status:'error',error:String(error.message).slice(0,500),updatedAt:stamp()});}
});

async function pushKeys(){
  const ref=db.doc('paperBackendSecrets/webPush');let snapshot=await ref.get();
  if(!snapshot.exists){try{await ref.create(webpush.generateVAPIDKeys());}catch(error){if(Number(error.code)!==6)throw error;}snapshot=await ref.get();}
  return snapshot.data();
}
function validSubscription(body){
  const url=new URL(body?.endpoint);
  if(url.protocol!=='https:'||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw Error('Unsupported browser push endpoint.');
  if(!/^[A-Za-z0-9_-]{30,200}$/.test(body.keys?.p256dh??'')||!/^[A-Za-z0-9_-]{16,80}$/.test(body.keys?.auth??''))throw Error('Invalid browser subscription.');
  return {endpoint:url.toString(),keys:body.keys};
}
const gatewayOrigins=localLegacy?['http://127.0.0.1:4300','http://localhost:4300','http://127.0.0.1:4200','http://localhost:4200']:
  ['https://gtop-app.web.app','https://gtop-app.firebaseapp.com','https://dev-gtop-app.web.app','http://127.0.0.1:4300'];
export const paperGateway=onRequest({region,cors:gatewayOrigins,timeoutSeconds:60,memory:'256MiB',maxInstances:3},async(req,res)=>{
  try{
    const match=/^Bearer (.+)$/.exec(req.headers.authorization??'');if(!match){res.status(401).send('Sign in required');return;}
    const identity=await getAuth().verifyIdToken(match[1]);const profile=await db.doc('users/'+identity.uid).get();if(profile.data()?.role!=='admin'){res.status(403).send('Admin access required');return;}
    const path=req.path.replace(/\/$/,'');
    if(localLegacy&&['/config','/subscribe'].includes(path)){res.status(409).send('Device push is unavailable in the emulator.');return;}
    if(req.method==='GET'&&path==='/register'){res.set('Cache-Control','private,no-store').json(await searchRegister(db,req.query,identity.uid));return;}
    if(req.method==='GET'&&path==='/config'){const keys=await pushKeys();res.json({publicKey:keys.publicKey});return;}
    if(req.method==='POST'&&path==='/subscribe'){const subscription=validSubscription(req.body);await db.doc('paperPushSubscriptions/'+identity.uid+'/devices/'+hash(subscription.endpoint)).set({...subscription,updatedAt:stamp()});res.json({saved:true});return;}
    const artifact=/^\/artifact\/([a-zA-Z0-9_-]{1,140})\/(paper|answers)$/.exec(path);
    if(req.method==='GET'&&artifact){const paper=await db.doc('paperDrafts/'+artifact[1]).get();if(paper.data()?.status!=='ready'){res.status(404).send('Paper unavailable');return;}const document=await db.doc('paperArtifacts/'+artifact[1]+'/documents/'+artifact[2]).get();if(!document.exists){res.status(404).send('Artifact unavailable');return;}res.set('Content-Type','text/html; charset=utf-8').set('Cache-Control','private,no-store').set('Content-Security-Policy',localLegacy?localPaperPolicy:"default-src 'none'; img-src https://firebasestorage.googleapis.com https://storage.googleapis.com; style-src 'unsafe-inline'; font-src https://gtop-app.web.app").send(document.data().html);return;}
    res.status(404).send('Not found');
  }catch(error){console.error('Paper gateway request failed',error.message);res.status(400).json({error:'This request could not be completed.'});}
});

// Additive, replaceable projections; original requests, conversations and papers
// remain authoritative. Every delivery re-reads the current source transactionally.
const registerTrigger=(document,collection,param)=>onDocumentWritten({document,region,timeoutSeconds:120,memory:'256MiB',maxInstances:2,retry:true},event=>projectSource(db,collection,event.params[param]));
export const registerConversation=registerTrigger('paperConversations/{id}','paperConversations','id');
export const registerRequest=registerTrigger('paperRequests/{id}','paperRequests','id');
export const registerPaper=registerTrigger('paperDrafts/{id}','paperDrafts','id');
export const registerMessage=onDocumentWritten({document:'paperMessages/{id}',region,timeoutSeconds:120,memory:'256MiB',maxInstances:2,retry:true},async event=>{
  const before=event.data?.before.data()?.conversationId,after=event.data?.after.data()?.conversationId;
  for(const id of new Set([before,after].filter(Boolean)))await refreshRegister(db,id);
});

// Examination updates use the exact existing Gen 1 create trigger. This branch
// keeps their recipients, browser subscriptions and payload apart from legacy chat.
const examPushSchema='gt-papers-exam-update';
const examPushLifeMs=600_000;
const examPushBudgetMs=16_000;
const examId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const examEndpoint=id=>db.doc('paperExamPushEndpoints/'+id);
const examDevice=(uid,id)=>db.doc('paperPushSubscriptions/'+uid+'/examDevices/'+id);
const examIso=()=>new Date().toISOString();

function examVapid(keys){
  const publicKey=keys?.publicKey,privateKey=keys?.privateKey;
  if(typeof publicKey!=='string'||!/^[A-Za-z0-9_-]{87}$/.test(publicKey)||
     typeof privateKey!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(privateKey))return null;
  try{
    const ecdh=createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(privateKey,'base64url'));
    if(!ecdh.getPublicKey().equals(Buffer.from(publicKey,'base64url')))return null;
    return {subject:'mailto:schttewary@gmail.com',publicKey,privateKey};
  }catch{return null;}
}
function validExamRecipient(row,uid){
  return row.examStream==='staff'
    ? row.scope==='submission'&&!row.recipientUid
    : examId(uid)&&row.examStream==='staff:'+uid&&row.recipientUid===uid&&['submission','paper','job'].includes(row.scope);
}
async function examTargetCurrent(row){
  if(row.scope==='submission'){
    const [snapshot]=await db.getAll(db.doc('assistantStudentSubmissions/'+row.entityId),{fieldMask:['ownerUid','status','teacherUpload']});
    const record=snapshot.data();
    return examId(record?.ownerUid)&&['submitted','needs_rescan','checking','released'].includes(record.status)&& (row.recipientUid?record.ownerUid===row.recipientUid:record.teacherUpload!==true);
  }
  if(!examId(row.targetConversationId))return false;
  const [target,conversation]=await db.getAll(
    db.doc((row.scope==='paper'?'assistantPapers/':'assistantJobs/')+row.entityId),
    db.doc('assistantConversations/'+row.targetConversationId),{fieldMask:['ownerUid','conversationId']}
  );
  return target.data()?.ownerUid===row.recipientUid&&target.data()?.conversationId===row.targetConversationId&&
    conversation.data()?.ownerUid===row.recipientUid;
}
function safeExamEndpoint(device){
  if(typeof device?.endpoint!=='string'||device.endpoint.length>2048)return false;
  try{
    const url=new URL(device.endpoint);
    const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','push.services.mozilla.com'];
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash&&
      hosts.some(host=>url.hostname===host||(host==='web.push.apple.com'&&url.hostname.endsWith('.'+host)));
  }catch{return false;}
}
async function expireExamDevice(uid,device,deadline){
  if(Date.now()>=deadline)return;
  await db.runTransaction(async tx=>{
    const mapping=examEndpoint(device.id),ref=examDevice(uid,device.id);
    const [owner,stored]=await tx.getAll(mapping,ref);
    const before=device.data(),after=stored.data();
    if(Date.now()>=deadline||owner.data()?.ownerUid!==uid||after?.ownerUid!==uid||
      !stored.updateTime?.isEqual(device.updateTime)||after.endpoint!==before.endpoint)return;
    tx.delete(ref);tx.delete(mapping);
  },{maxAttempts:2});
}
async function sendExamDevice(uid,device,vapidDetails,payload,deadline,expires){
  if(Date.now()>=deadline)return 'skipped';
  const data=device.data();
  if(data.ownerUid!==uid||data.publicKey!==vapidDetails.publicKey||!safeExamEndpoint(data)||hash(data.endpoint)!==device.id)return 'skipped';
  const [mapping,latest]=await db.getAll(examEndpoint(device.id),examDevice(uid,device.id),{fieldMask:['ownerUid']});
  if(mapping.data()?.ownerUid!==uid||latest.data()?.ownerUid!==uid||!latest.updateTime?.isEqual(device.updateTime))return 'skipped';
  const subscription={endpoint:data.endpoint,keys:data.keys};
  for(let attempt=0;attempt<2;attempt++){
    const remaining=deadline-Date.now();
    if(remaining<250)return 'skipped';
    try{
      const request=webpush.generateRequestDetails(subscription,payload,{
        TTL:Math.max(0,Math.floor((expires-Date.now())/1000)),vapidDetails,urgency:'normal'
      });
      const response=await fetch(request.endpoint,{
        method:request.method,headers:request.headers,body:request.body,redirect:'error',
        signal:AbortSignal.timeout(Math.min(4000,remaining))
      });
      void response.body?.cancel().catch(()=>{});
      if(response.ok)return 'accepted';
      if([404,410].includes(response.status)){
        await expireExamDevice(uid,device,deadline).catch(()=>{});
        return 'expired';
      }
      if(attempt||![429,500,502,503,504].includes(response.status))return 'failed';
      const retryAfter=response.headers.get('retry-after');
      const providerDelay=retryAfter===null?0:/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Date.parse(retryAfter)-Date.now();
      const delay=Math.max(300+Math.random()*350,Number.isFinite(providerDelay)?providerDelay:0);
      if(Date.now()+delay+1000>=deadline)return 'failed';
      await new Promise(resolve=>setTimeout(resolve,delay));
    }catch{
      // A disconnected response is ambiguous. Avoid a possible second delivery.
      return 'failed';
    }
  }
  return 'failed';
}

async function deliverExamPush(event,row){
  if(process.env.PAPERS_EXAM_WEB_PUSH_ENABLED!=='true'||row.schemaVersion!==1||!examId(row.entityId)||
    !validExamRecipient(row,row.recipientUid)||!/^[a-f0-9]{64}$/.test(event.params.notificationId))return;
  const started=Date.now(),expires=Date.parse(row.createdAt)+examPushLifeMs;
  const deadline=Math.min(started+examPushBudgetMs,expires);
  if(!Number.isFinite(expires)||deadline<=started||expires>started+examPushLifeMs+30_000)return;
  const ref=event.data.ref,leaseId=randomUUID();
  const acquired=await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(Date.now()>=deadline||snap.data()?.schema!==examPushSchema||snap.data()?.push)return false;
    // A consumed claim also fences ambiguous external sends after a process failure.
    tx.update(ref,{push:{leaseId,leaseUntil:new Date(deadline).toISOString()}});
    return true;
  },{maxAttempts:2});
  if(!acquired||Date.now()>=deadline)return;
  const [pilot,targetCurrent]=await Promise.all([
    db.doc('assistantConfig/pilot').get(),
    examTargetCurrent(row)
  ]);
  const allowed=pilot.data()?.allowedOwnerUids;
  if(!targetCurrent||!Array.isArray(allowed)||Date.now()>=deadline)return;
  const candidates=row.examStream==='staff'
    ? [...new Set(allowed.filter(examId))].slice(0,8)
    : allowed.includes(row.recipientUid)?[row.recipientUid]:[];
  if(!candidates.length)return;
  const profiles=await db.getAll(...candidates.map(uid=>db.doc('users/'+uid)),{fieldMask:['role']});
  const recipients=profiles.filter(profile=>profile.data()?.role==='admin').slice(0,2).map(profile=>profile.id);
  if(!recipients.length||Date.now()>=deadline)return;
  const deviceGroups=await Promise.all(recipients.map(async uid=>({uid,devices:(await db
    .collection('paperPushSubscriptions/'+uid+'/examDevices').orderBy('updatedAt','desc').limit(2).get()).docs})));
  if(!deviceGroups.some(group=>group.devices.length)||Date.now()>=deadline)return;
  const secret=await db.doc('paperBackendSecrets/webPush').get();
  const vapid=examVapid(secret.data());
  if(!vapid||Date.now()>=deadline)return;
  const url='https://gtop-question-papers.web.app/?update='+event.params.notificationId;
  const payload=JSON.stringify({notification:{
    title:'GT Papers',body:'A staff update is available.',icon:'https://gtop-question-papers.web.app/icons/growth-launcher-192.png',
    tag:'gt-papers-'+event.params.notificationId,data:{examUpdateId:event.params.notificationId,onActionClick:{default:{operation:'focusLastFocusedOrOpen',url}}}
  }});
  const deliveries=await Promise.all(deviceGroups.flatMap(({uid,devices})=>devices.map(device=>
    sendExamDevice(uid,device,vapid,payload,deadline,expires).catch(()=> 'failed'))));
  if(Date.now()>=deadline)return;
  const totals={accepted:0,expired:0,failed:0,skipped:0};
  for(const state of deliveries)totals[state]++;
  await ref.update({'push.finishedAt':examIso(),'push.totals':totals});
}

async function notifyExamUpdate(event,row){
  let timeout;
  try{
    await Promise.race([
      deliverExamPush(event,row),
      new Promise(resolve=>{timeout=setTimeout(resolve,examPushBudgetMs);})
    ]);
  }catch{
    // The saved in-app update is independent of best-effort device delivery.
    console.warn('GT Papers examination push could not complete.');
  }finally{clearTimeout(timeout);}
}

export const notifyPaperAdmin=onDocumentCreated({document:'paperNotifications/{notificationId}',region,timeoutSeconds:60,maxInstances:2,retry:true},async event=>{
  if(localLegacy)return;
  const notification=event.data?.data();
  if(notification?.schema===examPushSchema){
    if(process.env.PAPERS_EXAM_WEB_PUSH_ENABLED==='true')await notifyExamUpdate(event,notification);
    return;
  }
  if(!cleanId(notification?.ownerUid)||!cleanId(notification.conversationId))return;
  const devices=await db.collection('paperPushSubscriptions/'+notification.ownerUid+'/devices').limit(12).get();if(devices.empty)return;
  const keys=await pushKeys();webpush.setVapidDetails('mailto:schttewary@gmail.com',keys.publicKey,keys.privateKey);
  const url='https://gtop-app.web.app/admin/question-papers/chat/'+notification.conversationId;
  const payload=JSON.stringify({notification:{title:'GTOP question paper',body:notification.text,icon:'https://gtop-app.web.app/assets/icons/icon-192-192.png',tag:event.params.notificationId,data:{onActionClick:{default:{operation:'openWindow',url}}}}});
  await Promise.all(devices.docs.map(async device=>{
    const receipt=event.data.ref.collection('deliveries').doc(device.id);if((await receipt.get()).exists)return;
    const data=device.data();try{await webpush.sendNotification({endpoint:data.endpoint,keys:data.keys},payload,{TTL:24*3600});await receipt.set({sentAt:stamp()});}
    catch(error){if([404,410].includes(error.statusCode)){await device.ref.delete();await receipt.set({expiredAt:stamp()});}else throw error;}
  }));
});
