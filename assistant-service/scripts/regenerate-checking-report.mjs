import {open,realpath} from 'node:fs/promises';
import {win32} from 'node:path';
import {parseArgs} from 'node:util';

const usage='Usage: node assistant-service/scripts/regenerate-checking-report.mjs --project gtop-app '+
  '--submission-id ID --submission-version N --owner-uid UID --paper-id ID --sheet-id ID --sheet-version N '+
  '--old-sha SHA256 --attempt-id ID '+
  '(--prepare --output PRIVATE_H_PDF | --publish --input PRIVATE_H_PDF --candidate-sha SHA256 --source-sha SHA256)';
const publicErrors=new Set([
  'invalid_id','invalid_report_target','report_target_changed','report_owner_unavailable','report_scan_mismatch',
  'report_already_current','invalid_report_candidate','report_render_changed','invalid_result',
  'result_upload_incomplete','result_integrity','report_local_file_unavailable'
]);
const shaPattern=/^[a-f0-9]{64}$/;
const maxPdfBytes=22_000_000;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
const attemptPattern=/^[a-z0-9_-]{16,80}$/;
const workspace=/^H:\\Workspace(?:\\|$)/i;

const positiveInteger=value=>/^[1-9][0-9]*$/.test(value??'')&&Number.isSafeInteger(Number(value));
const localFileUnavailable=()=>Object.assign(Error('Use a private PDF path beneath H:\\Workspace.'),{code:'report_local_file_unavailable'});

async function checkedLocalPath(file,prepare){
  const normalized=win32.normalize(file);
  if(process.platform!=='win32'||!workspace.test(normalized)||win32.extname(normalized).toLowerCase()!=='.pdf')
    throw localFileUnavailable();
  try{
    const resolved=await realpath(prepare?win32.dirname(normalized):normalized);
    if(!workspace.test(resolved))throw localFileUnavailable();
    return prepare?win32.join(resolved,win32.basename(normalized)):resolved;
  }catch{
    throw localFileUnavailable();
  }
}

async function privatePdf(file){
  try{
    const handle=await open(file,'r');
    try{
      const info=await handle.stat();
      if(!info.isFile()||info.size<12||info.size>maxPdfBytes)throw localFileUnavailable();
      const bytes=Buffer.alloc(info.size+1);
      let offset=0;
      while(offset<bytes.length){
        const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);
        if(!bytesRead)break;
        offset+=bytesRead;
      }
      if(offset!==info.size)throw localFileUnavailable();
      return bytes.subarray(0,offset);
    }finally{
      await handle.close();
    }
  }catch{
    throw localFileUnavailable();
  }
}

async function savePrivatePdf(file,pdf){
  try{
    const handle=await open(file,'wx',0o600);
    try{await handle.writeFile(pdf);}
    finally{await handle.close();}
  }catch{
    throw localFileUnavailable();
  }
}

function parseOptions(){
  const parsed=parseArgs({options:{
    project:{type:'string'},prepare:{type:'boolean'},publish:{type:'boolean'},help:{type:'boolean'},
    'submission-id':{type:'string'},'submission-version':{type:'string'},'owner-uid':{type:'string'},
    'paper-id':{type:'string'},'sheet-id':{type:'string'},'sheet-version':{type:'string'},'old-sha':{type:'string'},
    'attempt-id':{type:'string'},input:{type:'string'},output:{type:'string'},
    'candidate-sha':{type:'string'},'source-sha':{type:'string'}
  },tokens:true});
  if(new Set(parsed.tokens.map(token=>token.name)).size!==parsed.tokens.length)throw Error();
  const value=parsed.values;
  if(value.help)return null;
  const ids=['submission-id','owner-uid','paper-id','sheet-id'];
  if(value.project!=='gtop-app'||process.env.FIRESTORE_EMULATOR_HOST||!!value.prepare===!!value.publish||
      !ids.every(key=>idPattern.test(value[key]??''))||!attemptPattern.test(value['attempt-id']??'')||
      !positiveInteger(value['submission-version'])||!positiveInteger(value['sheet-version'])||
      !shaPattern.test(value['old-sha']??''))throw Error();
  if(value.prepare?(!value.output||[value.input,value['candidate-sha'],value['source-sha']].some(item=>item!==undefined)):
      (!value.input||value.output!==undefined||!shaPattern.test(value['candidate-sha']??'')||
      !shaPattern.test(value['source-sha']??'')))throw Error();
  return value;
}

async function run(){
  let values;
  try{values=parseOptions();}
  catch{
    console.error(usage);
    process.exitCode=2;
    return;
  }
  if(!values){
    console.log(usage);
    return;
  }
  const file=await checkedLocalPath(values.prepare?values.output:values.input,values.prepare);
  const expected={
    submissionId:values['submission-id'],submissionVersion:Number(values['submission-version']),
    ownerUid:values['owner-uid'],paperId:values['paper-id'],sheetId:values['sheet-id'],
    sheetVersion:Number(values['sheet-version']),oldSha:values['old-sha'],attemptId:values['attempt-id']
  };
  const [{initializeApp,applicationDefault,deleteApp},{getFirestore},{AssistantService},{FirestoreStore},regeneration]=
    await Promise.all([
      import('firebase-admin/app'),import('firebase-admin/firestore'),import('../service.mjs'),
      import('../store.mjs'),import('../report-regeneration.mjs')
    ]);
  const app=initializeApp({credential:applicationDefault(),projectId:values.project});
  try{
    const {checking}=new AssistantService(new FirestoreStore(getFirestore(app)));
    if(values.prepare){
      const {pdf,...receipt}=await regeneration.prepareCheckingReportRegeneration(checking,expected);
      await savePrivatePdf(file,pdf);
      console.log(JSON.stringify({state:'prepared',...receipt}));
    }else{
      const result=await regeneration.publishCheckingReportRegeneration(checking,{
        ...expected,pdf:await privatePdf(file),candidateSha:values['candidate-sha'],sourceSha:values['source-sha']
      });
      console.log(JSON.stringify(result));
    }
  }finally{
    await deleteApp(app).catch(()=>{});
  }
}

try{await run();}
catch(error){
  console.error(JSON.stringify({error:publicErrors.has(error?.code)?error.code:'checking_report_regeneration_unavailable'}));
  process.exitCode=1;
}
