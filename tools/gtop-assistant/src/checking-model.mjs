import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {gradingPrompt,gradingSchema,studentGradingSchema} from '../../../assistant-service/domain/checking.mjs';
import {intakeChunkSize,intakePrompt,intakeSchema,validateIntakePages} from '../../../assistant-service/domain/checking-intake.mjs';
import {externalReferencePrompt,externalReferenceSchema,maxExternalPages} from '../../../assistant-service/domain/external-reference.mjs';

import {checkingModelBudgetMs,maxCheckingPages} from '../../../assistant-service/domain/checking-limits.mjs';
export function checkingConfig(env=process.env) {
  const engine=env.GTOP_CHECKING_ENGINE||'codex-cli';
  if(!['codex-cli','openai-api'].includes(engine))throw Error('Unsupported GTOP checking engine.');
  if(engine==='openai-api'){
    if(!env.OPENAI_API_KEY||!env.GTOP_CHECKING_API_MODEL)throw Error('API mode requires a server-side key and model.');
    return {engine,model:env.GTOP_CHECKING_API_MODEL,key:env.OPENAI_API_KEY};
  }
  const effort=env.GTOP_CHECKING_CODEX_EFFORT||'xhigh';
  if(!['low','medium','high','xhigh'].includes(effort))throw Error('Unsupported Codex reasoning effort.');
  return {engine,model:env.GTOP_CHECKING_CODEX_MODEL||'gpt-6.2-sol',effort};
}

export function gradeScans(config,rubric,notes,images,options={}){
  return analyzeScans(config,images,{
    name:'paper_grades',schema:options.automatic?studentGradingSchema:gradingSchema,
    prompt:gradingPrompt(rubric,images.length,notes,{student:options.automatic,recheck:options.recheck}),
    timeoutMs:checkingModelBudgetMs(images.length,rubric.questions.length),maxOutputTokens:16000,
  },options);
}

export async function organizeScans(config,job,images,options={}){
  const {firstPage,lastPage,pageCount,knownStarts=[]}=job;
  if(!Number.isInteger(firstPage)||!Number.isInteger(lastPage)||!Number.isInteger(pageCount)||
      firstPage<1||lastPage<firstPage||lastPage>pageCount||lastPage-firstPage>=intakeChunkSize||
      images.length!==lastPage-Math.max(1,firstPage-1)+1)throw Error('invalid_packet_range');
  const result=await analyzeScans(config,images,{
    name:'scan_packet_pages',schema:intakeSchema,prompt:intakePrompt(firstPage,lastPage,pageCount,knownStarts),
    timeoutMs:checkingModelBudgetMs(images.length,1),maxOutputTokens:4000,
  },options);
  return {pages:validateIntakePages(result,firstPage,lastPage)};
}

export async function readExternalExam(config,job,images,options={}){
  if(!Number.isInteger(job.questionPages)||job.questionPages<1||job.questionPages>images.length||
      images.length!==job.pageCount||images.length>maxExternalPages)throw Error('invalid_exam_pages');
  const reference=await analyzeScans(config,images,{
    name:'external_exam',schema:externalReferenceSchema,prompt:externalReferencePrompt(job.questionPages,images.length,{recheck:options.recheck}),
    timeoutMs:checkingModelBudgetMs(images.length,50),maxOutputTokens:16000,
  },options);
  return {reference};
}

async function analyzeScans(config,images,task,{executable,root,signal}={}){
  if(!images.length||images.length>maxCheckingPages||images.some(image=>!Buffer.isBuffer(image)||!image.length||image.length>400000))
    throw Error('image_bounds');
  const deadline=AbortSignal.timeout(task.timeoutMs);
  const stop=signal?AbortSignal.any([signal,deadline]):deadline;
  if(config.engine==='openai-api')return requestApi(config,task,images,stop);
  const dir=await mkdtemp(path.join(root,'checking-'));
  try{
    const files=await Promise.all(images.map(async (image,index)=>{
      const file=path.join(dir,'page-'+(index+1)+'.jpg');
      await writeFile(file,image,{mode:0o600});
      return file;
    }));
    const schema=path.join(dir,'schema.json'),result=path.join(dir,'result.json');
    await writeFile(schema,JSON.stringify(task.schema));
    await runCodex(executable,config,dir,task.prompt,files,schema,result,stop);
    return JSON.parse(await readFile(result,'utf8'));
  }finally{
    await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:150});
  }
}

function runCodex(executable,config,dir,prompt,files,schema,result,signal){
  signal.throwIfAborted();
  const args=['exec','--ignore-user-config','--ephemeral','--skip-git-repo-check',
    '--sandbox','read-only','--disable','shell_tool','--disable','apps','--disable','plugins',
    '-c','approval_policy="never"','-c','web_search="disabled"','-c','model_provider="openai"',
    '-c','forced_login_method="chatgpt"',
    '-c','model_reasoning_effort='+JSON.stringify(config.effort),
    '--model',config.model,'--json','--output-schema',schema,'--output-last-message',result,
    ...files.map(file=>'--image='+file),'-'];
  const allowed=/^(SystemRoot|WINDIR|COMSPEC|USERPROFILE|HOME|LOCALAPPDATA|APPDATA|PATH|PATHEXT|CODEX_HOME|HOMEDRIVE|HOMEPATH)$/i;
  const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>allowed.test(name)));
  Object.assign(env,{TEMP:dir,TMP:dir,TMPDIR:dir});
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{cwd:dir,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let pending='',bytes=0,finished=false,toolAttempt=false;
    const stop=()=>child.kill();
    signal.addEventListener('abort',stop,{once:true});
    if(signal.aborted)stop();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',chunk=>{
      bytes+=Buffer.byteLength(chunk);
      if(bytes>1_000_000){stop();return;}
      const lines=(pending+chunk).split('\n');
      pending=lines.pop();
      for(const line of lines){
        try{
          const event=JSON.parse(line);
          if(event.type==='turn.completed')finished=true;
          if(event.type==='item.started'&&['command_execution','mcp_tool_call','web_search','file_change'].includes(event.item?.type)){
            toolAttempt=true;stop();
          }
        }catch{/* CLI progress is not included in the result. */}
      }
    });
    child.stderr.resume();
    child.stdin.on('error',()=>{});
    child.once('error',error=>{signal.removeEventListener('abort',stop);reject(error);});
    child.once('close',code=>{
      signal.removeEventListener('abort',stop);
      if(signal.aborted)reject(signal.reason);
      else if(toolAttempt||code!==0||!finished)reject(Error('codex_grading_failed (exit '+code+')'));
      else resolve();
    });
    child.stdin.end(prompt,'utf8');
  });
}

async function requestApi(config,task,images,signal){
  const result=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal,redirect:'error',
    headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:config.model,store:false,max_output_tokens:task.maxOutputTokens,
      input:[{role:'user',content:[{type:'input_text',text:task.prompt},...images.map(image=>({
        type:'input_image',image_url:'data:image/jpeg;base64,'+image.toString('base64'),detail:'high'
      }))]}],
      text:{format:{type:'json_schema',name:task.name,strict:true,schema:task.schema}}
    })
  });
  if(!result.ok)throw Error('openai_grading_http_'+result.status);
  const reply=await result.json();
  if(reply.status!=='completed')throw Error('openai_grading_incomplete');
  const output=reply.output?.flatMap(item=>item.content||[]).find(item=>item.type==='output_text');
  if(!output)throw Error('openai_grading_no_output');
  return JSON.parse(output.text);
}
