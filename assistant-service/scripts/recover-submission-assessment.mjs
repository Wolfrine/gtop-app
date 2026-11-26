import {parseArgs} from 'node:util';

const usage='Usage: node assistant-service/scripts/recover-submission-assessment.mjs --project gtop-app --apply '+
  '--submission-id ID --version VERSION --revision REVISION --reference-id ID --report-sha SHA256 --attempt-id ID';
const publicErrors=new Set([
  'invalid_id','invalid_recovery_target','recovery_target_changed','recovery_owner_unavailable','recovery_already_started',
  'recovery_student_unavailable','recovery_queue_unavailable','invalid_result','result_upload_incomplete','result_integrity'
]);
const states=new Set(['reference_queued','grading_queued','published','failed']);

async function run(){
  let values;
  try{
    const parsed=parseArgs({options:{
      project:{type:'string'},apply:{type:'boolean'},help:{type:'boolean'},
      'submission-id':{type:'string'},version:{type:'string'},revision:{type:'string'},
      'reference-id':{type:'string'},'report-sha':{type:'string'},'attempt-id':{type:'string'}
    },tokens:true});
    if(new Set(parsed.tokens.map(token=>token.name)).size!==parsed.tokens.length)throw Error();
    values=parsed.values;
  }catch{
    console.error(usage);
    process.exitCode=2;
    return;
  }
  if(values.help){
    console.log(usage);
    return;
  }
  if(values.project!=='gtop-app'||!values.apply||process.env.FIRESTORE_EMULATOR_HOST||
      !values['submission-id']||!values['reference-id']||!values['report-sha']||!values['attempt-id']||
      !/^[1-9][0-9]*$/.test(values.version??'')||!/^[1-9][0-9]*$/.test(values.revision??'')){
    console.error(usage);
    process.exitCode=2;
    return;
  }

  const [{initializeApp,applicationDefault,deleteApp},{getFirestore},{AssistantService},{FirestoreStore},{startAssessmentRecovery}]=
    await Promise.all([
      import('firebase-admin/app'),import('firebase-admin/firestore'),import('../service.mjs'),
      import('../store.mjs'),import('../assessment-recovery.mjs')
    ]);
  const app=initializeApp({credential:applicationDefault(),projectId:values.project});
  try{
    const service=new AssistantService(new FirestoreStore(getFirestore(app)));
    const result=await startAssessmentRecovery(service.checking,{
      id:values['submission-id'],version:Number(values.version),revision:Number(values.revision),
      referenceId:values['reference-id'],reportSha:values['report-sha'],attemptId:values['attempt-id']
    });
    console.log(JSON.stringify({state:states.has(result.state)?result.state:'recorded',replayed:result.replayed}));
  }finally{
    await deleteApp(app).catch(()=>{});
  }
}

try{
  await run();
}catch(error){
  console.error(JSON.stringify({error:publicErrors.has(error?.code)?error.code:'assessment_recovery_unavailable'}));
  process.exitCode=1;
}
