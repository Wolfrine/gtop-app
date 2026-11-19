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
export const currentSheetGrade=sheet=>(sheet.state==='review'||sheet.state==='final')&&
  (sheet.gradeRevision??1)===(sheet.gradingRevision??1)?sheet.grade:null;
export const sheetFields=['id','label','state','createdAt','updatedAt','pageCount','version','grade.awarded','grade.max','grade.pending',
  'gradeRevision','gradingRevision','gradingPaperId','gradingMax','packetId','packetLabel'];
export function sheetSummary(sheet,max){
  const {id,label,state,createdAt,updatedAt,pageCount,version,packetId,packetLabel,gradingRevision,gradingPaperId,gradingMax}=sheet;
  const grade=currentSheetGrade(sheet);
  return {id,label,state,createdAt,updatedAt,pageCount,version,awarded:grade?.awarded??null,pending:grade?.pending??null,
    max:grade?.max??gradingMax??max,...(packetId?{packetId}:{}),...(packetLabel?{packetLabel}:{}),
    ...(gradingPaperId?{gradingPaperId,gradingRevision}:{})};
}
