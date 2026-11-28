import {maxActive,orderedKey,queue,quota,sheets} from './checking-storage.mjs';

const recheckFields=['id','packetId','scanSource','state','version','queueId','automatic'];

export async function recheckClass(intake,uid,path,body){
  const checker=intake.checking,requestId=checker.id(body.requestId),paperId=checker.id(body.paperId);
  return intake.store.transaction(async tx=>{
    const packet=await tx.get(path);
    if(!packet||packet.state==='deleting')checker.notFound();
    const receipt=packet.lastRecheck;
    if(receipt?.requestId===requestId){
      if(receipt.paperId!==paperId||receipt.sourceVersion!==body.version)
        checker.fail(409,'recheck_changed','This recheck request has already been used. Reload the current class.');
      return {packet:intake.visible(packet),recheck:receipt.counts};
    }
    if(packet.state!=='completed'||packet.version!==body.version)
      checker.fail(409,'packet_changed','Reload the completed class before changing its question paper.');
    if(paperId===(packet.gradingPaperId??packet.paperId))
      checker.fail(400,'same_grading_paper','Choose a different saved paper revision or corrected marking scheme.');
    const paths=packet.groups.map(g=>sheets(uid,packet.paperId)+'/'+g.sheetId);
    const [rubric,records,usage]=await Promise.all([
      checker.rubric(paperId,uid,tx),tx.getSelected(paths,recheckFields),tx.get(quota(uid))
    ]);
    const revision=(packet.gradingRevision??1)+1,now=checker.now();
    const counts={queued:0,held:0,withdrawn:0};
    let delta=0;
    if(records.some(sheet=>sheet?.automatic))
      checker.fail(409,'automatic_result','Automatic assessments are preserved. Start a new check for a revised paper.');
    for(const [i,sheet] of records.entries()){
      if(!sheet||packet.groups[i].withdrawn||sheet.state==='deleting'||sheet.state==='withdrawn'){counts.withdrawn++;continue;}
      if(sheet.id!==packet.groups[i].sheetId||sheet.packetId!==packet.id||sheet.scanSource!==packet.scanSource)
        checker.fail(409,'booklet_changed','One of the class books changed ownership. Reload the class.');
      const held=packet.groups[i].held===true||sheet.state==='held';
      const active=sheet.state==='running'||sheet.state==='queued';
      if(held)counts.held++;else counts.queued++;
      delta+=(held?0:1)-(active?1:0);
      // Grade bytes remain historical until this individual book is graded again. A revision mismatch
      // hides them at every read. Only small fields change in this transaction, even for 180 long scripts.
      tx.update(paths[i],{gradingPaperId:paperId,gradingMax:rubric.marks,gradingRevision:revision,
        state:held?'held':'queued',version:sheet.version+1,updatedAt:now,finalizedAt:null,reviewedAt:null,
        error:null,engine:null,lease:null,leaseUntil:null});
      if(!held)tx.set(queue(sheet.queueId),{id:sheet.queueId,path:paths[i],uid,paperId,state:'queued',
        queuedAt:now,orderKey:orderedKey(uid,now,sheet.queueId)});
      else if(active)tx.delete(queue(sheet.queueId));
    }
    if((usage?.active||0)+delta>maxActive)
      checker.fail(429,'grading_limit','The class will exceed the marking queue limit. Try again after other books finish.');
    tx.set(quota(uid),{...usage,active:Math.max(0,(usage?.active||0)+delta)});
    const next={...packet,gradingPaperId:paperId,gradingRevision:revision,version:packet.version+1,updatedAt:now,
      lastRecheck:{requestId,paperId,sourceVersion:body.version,counts}};
    tx.set(path,next);
    checker.service.notifyDispatch(tx,uid,'checking');
    return {packet:intake.visible(next),recheck:counts};
  });
}
