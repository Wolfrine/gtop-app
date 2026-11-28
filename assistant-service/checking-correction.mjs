import {randomUUID} from 'node:crypto';
import {removeStudentIndex} from './checking-student.mjs';
import {isAnonymous} from './domain/checking-intake.mjs';
import {maxCheckingPages} from './domain/checking-limits.mjs';
import {currentSheetGrade,digest,matchesStudentLabel,maxActive,orderedKey,queue,quota,sheets} from './checking-storage.mjs';

const active=state=>state==='queued'||state==='running';

export async function correctPacket(intake,uid,path,body){
  const checker=intake.checking,op=body.op,id=checker.id(body.requestId);
  if(!['identify','replace','append','move'].includes(op))checker.fail(400,'correction_type','Choose the correction to make.');
  const image=op==='replace'||op==='append'?checker.scan(body):null;
  const signature=digest(op,body.bookId??null,body.targetBookId??null,body.groupIndex??null,body.page??null,body.label??null,image?.sha??null);
  const sourceIndex=image?'revision-'+randomUUID():null;
  return intake.store.transaction(async tx=>{
    const packet=await tx.get(path);
    if(!packet||packet.state==='deleting')checker.notFound();
    if(packet.lastCorrection?.id===id&&packet.lastCorrection.signature===signature)return {packet:intake.visible(packet)};
    if(packet.lastCorrection?.id===id||packet.version!==body.version)
      checker.fail(409,'packet_changed','Reopen the class scan before applying the correction.');
    const completed=packet.state==='completed',now=checker.now();
    const groups=packet.groups.map(g=>({...g,pages:[...g.pages]}));
    const page=op==='append'?packet.pageCount+1:body.page;
    const previous=packet.uploaded.find(p=>p.index===page);
    if(op==='append'&&packet.studentUid&&page>maxCheckingPages)checker.fail(400,'booklet_size','This student book already has '+maxCheckingPages+' pages.');
    if(op==='append'&&page>200)checker.fail(400,'packet_size','A class scan can contain up to 200 pages.');
    if((op==='replace'||op==='move')&&(!Number.isInteger(page)||!previous))
      checker.fail(400,'missing_page','Choose an uploaded page to correct.');
    if((op==='identify'||op==='move')&&!completed)
      checker.fail(400,'edit_draft','Change the names or page assignments in the book list.');
    let owner=op==='replace'||op==='move'?groups.find(g=>g.pages.includes(page)):groups.find(g=>g.sheetId&&g.sheetId===body.bookId);
    if(op==='append'&&body.groupIndex!==undefined){
      if(packet.state!=='review'||!Number.isInteger(body.groupIndex)||!groups[body.groupIndex])
        checker.fail(400,'booklet_changed','Choose an existing book from the current review.');
      owner=groups[body.groupIndex];
    }
    const target=op==='move'?groups.find(g=>g.sheetId&&g.sheetId===body.targetBookId):null;
    if(completed&&(!owner||(body.bookId&&owner.sheetId!==body.bookId)))checker.fail(400,'booklet_changed','Choose the student book for this correction.');
    if(op==='move'&&(!target||target===owner))
      checker.fail(400,'page_assignment','Choose a different receiving book.');
    if((op==='append'&&owner&&owner.pages.length>=maxCheckingPages)||(op==='move'&&target.pages.length>=maxCheckingPages))
      checker.fail(400,'booklet_size','The receiving book already contains '+maxCheckingPages+' pages.');
    const affected=completed?[owner,...(target?[target]:[])]:[];
    const records=await Promise.all(affected.map(g=>tx.get(sheets(uid,packet.paperId)+'/'+g.sheetId)));
    if(records.some(sheet=>!sheet||sheet.packetId!==packet.id||sheet.scanSource!==packet.scanSource||['deleting','withdrawn'].includes(sheet.state)))
      checker.fail(409,'booklet_withdrawn','One of the selected books has been withdrawn.');
    if(records.some(sheet=>sheet.automatic))
      checker.fail(409,'automatic_result','Automatic assessments are preserved. Start a new check for changed scans.');
    if(records.some(sheet=>sheet.state==='final'))
      checker.fail(409,'final_booklet','Reopen the affected final result for review before correcting its scan or identity.');
    let label;
    if(op==='identify'){
      label=checker.text(body.label,100,true);
      const key=label.normalize('NFKC').toLocaleLowerCase();
      if(isAnonymous(label)||groups.some(g=>g!==owner&&!g.held&&!g.withdrawn&&g.label.normalize('NFKC').toLocaleLowerCase()===key))
        checker.fail(400,'booklet_identity','Enter a distinct roll number or student name.');
      if(owner.studentUid)owner.labelFromStudent=matchesStudentLabel(label,owner.studentLabel);
      owner.label=label;delete owner.held;owner.needsReview=false;owner.reason='';
    }
    if(op==='move'){
      owner.pages=owner.pages.filter(n=>n!==page);
      if(!owner.pages.length){owner.withdrawn=true;delete owner.held;}
      target.pages.push(page);
    }
    if(op==='append'&&owner)owner.pages.push(page);
    const uploaded=[...packet.uploaded];
    if(image){
      const descriptor={index:page,sourceIndex,sha:image.sha,...image.size};
      if(op==='append')uploaded.push(descriptor);
      else uploaded[uploaded.findIndex(p=>p.index===page)]=descriptor;
    }
    const byPage=new Map(uploaded.map(p=>[p.index,p]));
    const nextState=(g,sheet)=>g.withdrawn?'withdrawn':!g.held&&(op!=='identify'||sheet.state==='held')?'queued':sheet.state;
    const delta=affected.reduce((count,g,i)=>{
      const sheet=records[i];
      return count+Number(active(nextState(g,sheet)))-Number(active(sheet.state));
    },0);
    const usage=delta?await tx.get(quota(uid)):null;
    if(delta&&(usage?.active||0)+delta>maxActive)
      checker.fail(429,'grading_limit','Your marking queue is full. Try this correction again after a book finishes.');
    if(image){
      tx.create(checker.imagePath(path,packet,sourceIndex),{jpeg:image.bytes});
      // Before marks exist, replacing the original safely releases its private image.
      if(op==='replace'&&!completed)tx.delete(checker.imagePath(path,packet,previous.sourceIndex??page));
    }
    if(delta)tx.set(quota(uid),{...usage,active:Math.max(0,(usage?.active||0)+delta)});
    for(const [i,g] of affected.entries()){
      const sheet=records[i],sheetPath=sheets(uid,packet.paperId)+'/'+sheet.id;
      const state=nextState(g,sheet);
      const next={...sheet,label:g.label,...(op==='identify'&&sheet.studentUid?{labelFromStudent:!!g.labelFromStudent}:{}),uploaded:g.pages.map((n,j)=>({...byPage.get(n),index:j+1,sourceIndex:byPage.get(n).sourceIndex??n})),
        pageCount:g.pages.length,updatedAt:now,version:sheet.version+1};
      if(op==='replace')next.retiredSources=[...(sheet.retiredSources||[]),{sourceIndex:previous.sourceIndex??page}];
      if(g.withdrawn||(!g.held&&(op!=='identify'||sheet.state==='held'))){
        if(currentSheetGrade(sheet))tx.set(sheetPath+'/grading/before-correction',{grade:sheet.grade,previousState:sheet.state,
          previousPages:sheet.uploaded,previousLabel:sheet.label,correctedAt:now});
        delete next.grade;delete next.modelGrade;delete next.engine;delete next.finalizedAt;delete next.reviewedAt;
        Object.assign(next,{state,error:null,lease:null,leaseUntil:null});
        tx.delete(sheetPath+'/grading/original');
        if(g.withdrawn){
          tx.delete(queue(sheet.queueId));
          removeStudentIndex(tx,uid,sheet,'sheet',packet.paperId);
        }
        else tx.set(queue(sheet.queueId),{id:sheet.queueId,path:sheetPath,uid,paperId:sheet.gradingPaperId||packet.paperId,state:'queued',queuedAt:now,
          orderKey:orderedKey(uid,now,sheet.queueId)});
      }
      tx.set(sheetPath,next);
    }
    const next={...packet,uploaded,pageCount:op==='append'?page:packet.pageCount,groups,version:packet.version+1,
      updatedAt:now,lastCorrection:{id,signature}};
    if(!completed){
      if(active(packet.state)){
        // No old lease can contribute evidence after a source scan changes.
        Object.assign(next,{state:'queued',processedPages:0,readings:[],groups:[],groupCount:0,lease:null,leaseUntil:null,error:null});
        tx.set(queue(packet.queueId),{id:packet.queueId,uid,paperId:null,path,kind:'class-intake',state:'queued',
          queuedAt:now,intakeOrderKey:orderedKey(uid,now,packet.queueId)});
      }else if(packet.state==='failed'){
        Object.assign(next,{processedPages:0,readings:[],error:null,state:'uploading'});
      }else if(op==='replace'&&owner){
        owner.needsReview=true;owner.reason='This page was rescanned. Confirm the student and page assignment.';
      }
    }
    tx.set(path,next);
    checker.service.notifyDispatch(tx,uid,'checking');
    return {packet:intake.visible(next)};
  });
}
