import {randomUUID} from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {onDocumentWritten,onDocumentCreated} from 'firebase-functions/v2/firestore';
import {onRequest} from 'firebase-functions/v2/https';
import webpush from 'web-push';
import {hash,validatePaper,validateBankSnapshot,renderPaper,imageType} from './paper-engine.mjs';

initializeApp({storageBucket:'gtop-app.firebasestorage.app'});
const db=getFirestore();const bucket=getStorage().bucket();
const stamp=()=>FieldValue.serverTimestamp();
const region='us-central1';
const current=(request,conversation,paper)=>request?.source==='admin-paper-chat'&&['queued','generating','publishing'].includes(request.status)&&conversation?.activeRequestId===paper.parentRequestId&&request.revision===paper.requestRevision;
const cleanId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,140}$/.test(value);
const contentHash=paper=>hash(Object.fromEntries(['title','board','standard','subjects','chapters','durationMinutes','marks','instructions','sections','conversationId','parentRequestId','requestRevision'].map(field=>[field,paper[field]??null])));

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
    const url='https://firebasestorage.googleapis.com/v0/b/'+bucket.name+'/o/'+encodeURIComponent(path)+'?alt=media&token='+token;
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
export const paperGateway=onRequest({region,cors:['https://gtop-app.web.app','https://gtop-app.firebaseapp.com','https://dev-gtop-app.web.app','http://127.0.0.1:4300'],timeoutSeconds:60,memory:'256MiB',maxInstances:3},async(req,res)=>{
  try{
    const match=/^Bearer (.+)$/.exec(req.headers.authorization??'');if(!match){res.status(401).send('Sign in required');return;}
    const identity=await getAuth().verifyIdToken(match[1]);const profile=await db.doc('users/'+identity.uid).get();if(profile.data()?.role!=='admin'){res.status(403).send('Admin access required');return;}
    const path=req.path.replace(/\/$/,'');
    if(req.method==='GET'&&path==='/config'){const keys=await pushKeys();res.json({publicKey:keys.publicKey});return;}
    if(req.method==='POST'&&path==='/subscribe'){const subscription=validSubscription(req.body);await db.doc('paperPushSubscriptions/'+identity.uid+'/devices/'+hash(subscription.endpoint)).set({...subscription,updatedAt:stamp()});res.json({saved:true});return;}
    const artifact=/^\/artifact\/([a-zA-Z0-9_-]{1,140})\/(paper|answers)$/.exec(path);
    if(req.method==='GET'&&artifact){const paper=await db.doc('paperDrafts/'+artifact[1]).get();if(paper.data()?.status!=='ready'){res.status(404).send('Paper unavailable');return;}const document=await db.doc('paperArtifacts/'+artifact[1]+'/documents/'+artifact[2]).get();if(!document.exists){res.status(404).send('Artifact unavailable');return;}res.set('Content-Type','text/html; charset=utf-8').set('Cache-Control','private,no-store').set('Content-Security-Policy',"default-src 'none'; img-src https://firebasestorage.googleapis.com https://storage.googleapis.com; style-src 'unsafe-inline'; font-src https://gtop-app.web.app").send(document.data().html);return;}
    res.status(404).send('Not found');
  }catch(error){console.error('Paper gateway request failed',error.message);res.status(400).json({error:'This request could not be completed.'});}
});

export const notifyPaperAdmin=onDocumentCreated({document:'paperNotifications/{notificationId}',region,timeoutSeconds:60,maxInstances:2,retry:true},async event=>{
  const notification=event.data?.data();if(!cleanId(notification?.ownerUid)||!cleanId(notification.conversationId))return;
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
