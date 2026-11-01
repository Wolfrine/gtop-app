import {readdir,stat,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

export const MODEL_ROOT='H:\\GTOP-Local-AI\\models\\ollama';
const INSTALL_ROOT='F:\\Workspace\\Support\\PTI\\local-service-initiator';
export interface RunnerConfig {workerId:string;runnerContractVersion?:number;ollama:string;model:string;}
export interface Runner {contractId?:string;resolveCodex:()=>Promise<string>;}
type Fs = {read:typeof readFile;real:typeof realpath;info:typeof stat;list:typeof readdir};
const fs:Fs={read:readFile,real:realpath,info:stat,list:readdir};
const same=(a:unknown,b:unknown)=>typeof a==='string'&&typeof b==='string'&&path.win32.resolve(a).toLowerCase()===path.win32.resolve(b).toLowerCase();
const fail=(detail:string):never=>{throw Error('GTOP runner: '+detail);};
export function scopedEndpoint(value:unknown):string {
  if(typeof value!=='string'||!/^http:\/\/127\.0\.0\.1:[1-9]\d{3,4}$/.test(value))return fail('use an explicit dedicated loopback endpoint');
  const port=Number(value.slice(value.lastIndexOf(':')+1));
  if(port<1024||port>65535||port===11434)return fail('shared/default Ollama port is outside GTOP scope');
  return value;
}
export async function resolveDesktopCodex({localAppData=process.env.LOCALAPPDATA,list=readdir,info=stat}:any={}):Promise<string>{
  if(!localAppData||!path.win32.isAbsolute(localAppData))return fail('desktop Codex installation root is unavailable');
  const base=path.win32.join(localAppData,'OpenAI','Codex','bin');
  let entries;try{entries=await list(base,{withFileTypes:true});}catch{return fail('desktop Codex bin directory is unavailable');}
  const candidates:{file:string;mtime:number}[]=[];
  for(const entry of entries){
    if(!entry.isDirectory()||!/^[A-Za-z0-9._-]+$/.test(entry.name))continue;
    const file=path.win32.join(base,entry.name,'codex.exe');
    try{const item=await info(file);if(item.isFile())candidates.push({file,mtime:item.mtimeMs});}catch{/* App updates can remove old directories during discovery. */}
  }
  candidates.sort((a,b)=>b.mtime-a.mtime||a.file.localeCompare(b.file));
  if(!candidates.length)return fail('no current desktop Codex executable; repair the desktop installation');
  return candidates[0].file;
}
function desktopPath(file:unknown,env:NodeJS.ProcessEnv):string {
  const base=path.win32.join(env.LOCALAPPDATA||'', 'OpenAI','Codex','bin');
  if(typeof file!=='string'||/[\r\n\0]/.test(file)||!path.win32.isAbsolute(file)||
    !same(path.win32.dirname(path.win32.dirname(file)),base)||path.win32.basename(file).toLowerCase()!=='codex.exe')return fail('resolver returned a path outside the desktop Codex bin directory');
  return file;
}
export async function prepareRunner(config:RunnerConfig,configFile:string,env:NodeJS.ProcessEnv=process.env,
  deps:{files?:Fs;load?:(url:string)=>Promise<any>}={}):Promise<Runner>{
  scopedEndpoint(config.ollama);
  if(config.runnerContractVersion!==1)return fail('runnerContractVersion=1 is required');
  const files=deps.files||fs,load=deps.load||((url:string)=>import(url));
  const names=['GTOP_RUNNER_CONTRACT','GTOP_OLLAMA_ENDPOINT','GTOP_CODEX_EXECUTABLE','GTOP_CODEX_RESOLVER'];
  if(!names.some(name=>env[name]!==undefined)){
    // Explicit standalone launch: resolve equivalently; never use the obsolete config pin.
    return {resolveCodex:()=>resolveDesktopCodex({localAppData:env.LOCALAPPDATA,list:files.list,info:files.info})};
  }
  const contractFile=env.GTOP_RUNNER_CONTRACT;
  if(!same(contractFile,path.win32.join(INSTALL_ROOT,'data','gtop-runner.json')))return fail('missing or untrusted launch contract');
  let contract:any;try{
    if(!same(await files.real(contractFile!),contractFile))return fail('launch contract cannot be redirected');
    const info=await files.info(contractFile!);if(!info.isFile()||info.size>16384)return fail('invalid launch contract');
    contract=JSON.parse(String(await files.read(contractFile!,'utf8')).replace(/^\uFEFF/,''));
  }catch{return fail('launch contract is unreadable or invalid');}
  const identity={schemaVersion:contract.schemaVersion,workerId:contract.workerId,workerConfig:contract.workerConfig,
    ollamaEndpoint:contract.ollamaEndpoint,modelDirectory:contract.modelDirectory,model:contract.model,
    codexExecutable:contract.codexExecutable,codexResolverModule:contract.codexResolverModule};
  if(contract.schemaVersion!==1||contract.workerId!=='sachit-windows'||contract.workerId!==config.workerId||
    !same(contract.workerConfig,configFile)||contract.ollamaEndpoint!==config.ollama||env.GTOP_OLLAMA_ENDPOINT!==config.ollama||
    !same(contract.modelDirectory,MODEL_ROOT)||contract.model!==config.model||
    !/^[a-f0-9]{64}$/.test(contract.id)||createHash('sha256').update(JSON.stringify(identity)).digest('hex')!==contract.id)
    return fail('launch contract identity/config/endpoint/model mismatch');
  if(!same(contract.codexExecutable,env.GTOP_CODEX_EXECUTABLE))return fail('Codex launch environment mismatch');
  const checked=async(file:unknown)=>{
    const candidate=desktopPath(file,env);
    try{if(!(await files.info(candidate)).isFile())return fail('resolved Codex executable is missing');}
    catch{return fail('resolved Codex executable is missing; retry after desktop update completes');}
    return candidate;
  };
  const resolver=contract.codexResolverModule;
  if(resolver!==undefined){
    const releases=path.win32.join(INSTALL_ROOT,'releases');
    const relative=typeof resolver==='string'?path.win32.relative(releases,resolver):'';
    if(!same(resolver,env.GTOP_CODEX_RESOLVER)||!/^\d+\.\d+\.\d+-[a-f0-9]+\\src\\gtop-runner\.mjs$/i.test(relative))return fail('untrusted Codex resolver module');
    try{if(!same(await files.real(resolver),resolver)||!(await files.info(resolver)).isFile())return fail('Codex resolver module is missing');}
    catch{return fail('Codex resolver module is missing; repair the selected PTI release');}
    // Import failure or a failed helper never falls back to the stale config/build pin.
    return {contractId:contract.id,resolveCodex:async()=>{
      let helper:any;try{helper=await load(pathToFileURL(resolver).href);}catch{return fail('Codex resolver failed to load; repair the selected PTI release');}
      if(typeof helper.resolveCodexExecutable!=='function')return fail('Codex resolver export is missing');
      let candidate;try{candidate=await helper.resolveCodexExecutable();}catch{return fail('Codex resolver failed; retry after checking the desktop installation');}
      return checked(candidate);
    }};
  }
  if(env.GTOP_CODEX_RESOLVER)return fail('Codex resolver environment mismatch');
  // Compatible older v1 launcher only: explicit contract executable must still exist.
  return {contractId:contract.id,resolveCodex:()=>checked(contract.codexExecutable)};
}
