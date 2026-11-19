import {createHash} from 'node:crypto';

export const maxActive=180,maxDrafts=500;
export const quota=uid=>'assistantCheckingOwners/'+uid;
export const sheets=(uid,paper)=>quota(uid)+'/papers/'+paper+'/sheets';
export const packets=uid=>quota(uid)+'/packets';
export const queue=id=>'assistantCheckingQueue/'+id;
export const pagePath=(path,index)=>path+'/pages/'+index;
export const digest=(...values)=>createHash('sha256').update(JSON.stringify(values)).digest('hex');
export const day=now=>now.slice(0,10);
export const orderedKey=(uid,time,id)=>uid+'/'+time+'/'+id;
export const queueField=kind=>kind==='class-intake'?'intakeOrderKey':kind==='external-exam'?'referenceOrderKey':'orderKey';
export const sheetFields=['id','label','state','createdAt','updatedAt','pageCount','version','grade.awarded','grade.max','grade.pending','packetId'];
export const sheetSummary=({id,label,state,createdAt,updatedAt,pageCount,version,grade,packetId},max)=>({
  id,label,state,createdAt,updatedAt,pageCount,version,awarded:grade?.awarded??null,pending:grade?.pending??null,max:grade?.max??max,
  ...(packetId?{packetId}:{})
});
