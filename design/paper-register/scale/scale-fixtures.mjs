// Seed only at the final scale gate, after coordinating exclusive emulator use.
import {fileURLToPath} from 'node:url';

export function makeScaleFixtures(uid,prefix=`qa-scale-${Date.now()}`){
  const records=[],totalRows=10_021;
  for(let i=0;i<totalRows;i++){
    const id=`${prefix}-${String(i).padStart(5,'0')}`;
    const date=new Date(Date.UTC(2011,0,1)+i*12*3600_000);
    const title=i===0?`${prefix} OLDEST-FULL-SEARCH-TARGET`:`${prefix} ${2011+Math.floor(i/731)} assessment ${i}`;
    if(i%2===0){
      const data={schemaVersion:1,title,board:i%3===0?'ICSE':'CBSE',standard:String(6+i%7),subjects:['Biology'],chapters:['Cells'],marks:2,actualMarks:2,durationMinutes:10,status:'ready',createdBy:uid,updatedBy:uid,createdAt:date,updatedAt:date,paperHtml:'<!doctype html><html><body><p>Scale fixture question.</p></body></html>',answerHtml:'<!doctype html><html><body><p>Scale fixture answer.</p></body></html>'};
      // Timestamp-less legacy records must be indexed without a time-order hole.
      if(i%1000===0){delete data.createdAt;delete data.updatedAt;}
      records.push({path:`paperDrafts/${id}`,data});
    }else{
      const requestId=id+'-request';
      records.push({path:`paperConversations/${id}`,data:{title,ownerUid:uid,status:i%7===0?'needs-info':'queued',activeRequestId:requestId,revision:1,createdAt:date,updatedAt:date}});
      records.push({path:`paperRequests/${requestId}`,data:{source:'admin-paper-chat',conversationId:id,brief:`${title}. ${i===1?'RARE-ORIGINAL-REQUIREMENT-'+prefix:'ICSE Class 9 Biology; Cells; 40 marks; short answers.'}`,requestedBy:uid,revision:1,status:i%7===0?'needs-info':'queued',createdAt:date,updatedAt:date}});
    }
  }
  const repeatedFamily=prefix+'-repeated-family',oldMatchedFamily=prefix+'-old-matched-family',duplicateTerm='DUPLICATE-SCAN-'+prefix;
  const newer=new Date('2025-01-01T00:00:00Z'),older=new Date('2010-01-01T00:00:00Z');
  records.push({path:`paperConversations/${repeatedFamily}`,data:{title:duplicateTerm,ownerUid:uid,status:'queued',activeRequestId:repeatedFamily+'-419',revision:420,createdAt:newer,updatedAt:newer}});
  for(let i=0;i<420;i++)records.push({path:`paperRequests/${repeatedFamily}-${i}`,data:{source:'admin-paper-chat',conversationId:repeatedFamily,brief:duplicateTerm+' revision '+i,requestedBy:uid,status:i===419?'queued':'cancelled',revision:i+1,createdAt:new Date(newer.getTime()+i*1000),updatedAt:new Date(newer.getTime()+i*1000)}});
  records.push({path:`paperConversations/${oldMatchedFamily}`,data:{title:duplicateTerm+' OLDER-SECOND-FAMILY',ownerUid:uid,status:'cancelled',activeRequestId:oldMatchedFamily+'-request',revision:1,createdAt:older,updatedAt:older}});
  records.push({path:`paperRequests/${oldMatchedFamily}-request`,data:{source:'admin-paper-chat',conversationId:oldMatchedFamily,brief:duplicateTerm+' OLDER-SECOND-FAMILY',requestedBy:uid,status:'cancelled',revision:1,createdAt:older,updatedAt:older}});
  return{records,manifest:{prefix,uid,totalRows:totalRows+2,totalDocuments:records.length,oldestPaper:`${prefix}-00000`,oldestChat:`${prefix}-00001`,latest:`${prefix}-10020`,yearSpan:'2010–2025',duplicateTerm,repeatedFamily,oldMatchedFamily}};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(process.argv.includes('--seed'))throw Error('Use scale-qa.mjs --seed; scale data belongs only to the isolated local demo project.');
  const {manifest}=makeScaleFixtures('dry-run-admin');
  console.log(JSON.stringify({dryRun:true,...manifest}));
}
