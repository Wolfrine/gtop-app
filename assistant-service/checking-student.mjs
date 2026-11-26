import {resolveStudent} from './student-directory.mjs';
import {digest,matchesStudentLabel,packets,quota,sheets,sheetFields,sheetSummary} from './checking-storage.mjs';

const collection=(uid,studentUid)=>quota(uid)+'/students/'+digest(studentUid)+'/history';
const sourcePath=(uid,entry)=>entry.kind==='packet'?packets(uid)+'/'+entry.sourceId:
  sheets(uid,entry.paperId)+'/'+entry.sourceId;

// Only the source location and its original date are indexed. All marks, scan pages
// and workflow state remain on the checking record through review and rechecking.
export function indexStudent(tx,uid,record,kind,paperId=null){
  if(!record.studentUid)return;
  const id=digest(kind,record.id,paperId);
  tx.set(collection(uid,record.studentUid)+'/'+id,{kind,sourceId:record.id,paperId,createdAt:record.createdAt});
}

export function removeStudentIndex(tx,uid,record,kind,paperId=null){
  if(!record.studentUid)return;
  const id=digest(kind,record.id,paperId);
  tx.delete(collection(uid,record.studentUid)+'/'+id);
}

export async function studentHistory(checker,uid,{studentUid,cursor}){
  if(typeof studentUid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(studentUid))
    checker.fail(400,'invalid_student','Choose a GTOP student.');
  const limit=40;
  const found=await checker.store.list(collection(uid,studentUid),[],limit+1,{
    orderBy:['createdAt','desc'],orderById:true,cursorValues:checker.readCursor(cursor),includeId:true
  });
  const page=found.slice(0,limit);
  const records=await checker.store.getSelected(page.map(entry=>sourcePath(uid,entry)),[...sheetFields,'paperId']);
  const items=page.flatMap((entry,i)=>{
    const record=records[i];
    if(!record||record.studentUid!==studentUid||['deleting','withdrawn'].includes(record.state)||
      (entry.kind==='packet'&&record.state==='completed'))return [];
    const paperId=entry.paperId??record.paperId??null;
    return [{kind:entry.kind,record,paperId,gradingPaperId:record.gradingPaperId??paperId}];
  });
  const paperIds=[...new Set(items.map(item=>item.gradingPaperId).filter(Boolean))];
  const paperPaths=paperIds.map(id=>id.startsWith('ext-')?checker.references.path(uid,id):'assistantPapers/'+id);
  const paperFields=['title','marks','subject','standard','paper.marks','paper.subject','paper.standard'];
  const papers=await checker.store.getSelected(paperPaths,paperFields);
  const paperById=new Map(paperIds.map((id,i)=>[id,papers[i]]));
  const rows=items.map(({kind,record,paperId,gradingPaperId})=>{
    const paper=paperById.get(gradingPaperId);
    const {marks=null,subject,standard}=paper?.paper??paper??{};
    return {...sheetSummary(record,marks),kind,paperId,paperTitle:paper?.title??null,
      ...(kind==='packet'?{packetId:record.id}:{}),...(subject?{subject}:{}),...(standard?{standard}:{})};
  });
  const last=page.at(-1);
  return {sheets:rows,nextCursor:found.length>limit?Buffer.from(JSON.stringify([last.createdAt,last.id])).toString('base64url'):null};
}

export async function linkSheetStudent(checker,uid,paperId,path,body){
  return checker.store.transaction(async tx=>{
    const sheet=await tx.get(path);
    if(!sheet||['deleting','withdrawn'].includes(sheet.state))checker.notFound();
    if((sheet.submissionUploadId||sheet.automatic&&sheet.state!=='uploading')&&sheet.studentUid!==body.studentUid)
      checker.fail(409,'student_submission_identity','This answer sheet is linked to the GTOP account that submitted it.');
    if(sheet.studentUid&&sheet.studentUid===body.studentUid)
      return {studentUid:sheet.studentUid,studentLabel:sheet.studentLabel,version:sheet.version,
        ...(sheet.packetLabel?{packetLabel:sheet.packetLabel}:{}),...(sheet.labelFromStudent?{labelFromStudent:true}:{})};
    if(sheet.version!==body.version)checker.fail(409,'sheet_changed','Reopen the latest sheet before changing its student.');
    const student=await resolveStudent(tx,body.studentUid);
    const packetPath=sheet.packetId?packets(uid)+'/'+checker.id(sheet.packetId):null;
    const packet=packetPath?await tx.get(packetPath):null;
    const now=checker.now(),version=sheet.version+1;
    const belongsToPacket=packet?.scanSource===sheet.scanSource&&packet?.paperId===paperId;
    const single=sheet.singleStudentBook===true||(belongsToPacket&&!!packet.studentUid);
    const packetLabel=single?student.studentLabel:sheet.packetLabel;
    const labelFromStudent=!!sheet.labelFromStudent||matchesStudentLabel(sheet.label,sheet.studentLabel)||
      matchesStudentLabel(sheet.label,student.studentLabel);
    if(belongsToPacket){
      const groupIndex=packet.groups.findIndex(group=>group.sheetId===sheet.id&&!group.withdrawn);
      if(groupIndex<0)checker.fail(409,'booklet_changed','Reopen the class scan before changing its student.');
      const groups=packet.groups.map((group,i)=>i===groupIndex?{...group,...student,labelFromStudent}:group);
      // A legacy class can link each book separately. Only a dedicated single
      // intake carries a packet-wide identity.
      const packetChanges={groups,version:packet.version+1,updatedAt:now};
      if(single)Object.assign(packetChanges,student,{label:packetLabel,labelFromStudent:true,
        originalPacketLabel:packet.originalPacketLabel??packet.label});
      tx.update(packetPath,packetChanges);
    }
    removeStudentIndex(tx,uid,sheet,'sheet',paperId);
    const changes={...student,labelFromStudent,version,updatedAt:now};
    if(single)Object.assign(changes,{packetLabel,originalPacketLabel:sheet.originalPacketLabel??sheet.packetLabel??sheet.label});
    tx.update(path,changes);
    indexStudent(tx,uid,{...sheet,...student},'sheet',paperId);
    checker.service.notifyContent(tx,uid);
    return {...student,version,labelFromStudent,...(packetLabel?{packetLabel}:{})};
  });
}
