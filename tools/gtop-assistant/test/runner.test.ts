import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareRunner,resolveDesktopCodex,scopedEndpoint,MODEL_ROOT} from '../src/runner.js';
import {runtimeHealth,waitForRuntime,ollamaFetch,resolveJobCodex,type Config} from '../src/adapters.js';

const bin='C:\\Users\\synthetic\\AppData\\Local\\OpenAI\\Codex\\bin';
const executable=bin+'\\current\\codex.exe';
const configFile='F:\\Workspace\\Support\\GTOP\\assistant-runtime\\worker.json';
const resolver='F:\\Workspace\\Support\\PTI\\local-service-initiator\\releases\\1.2.0-abcdef0\\src\\gtop-runner.mjs';
function fixture(){
  const config={workerId:'sachit-windows',runnerContractVersion:1,ollama:'http://127.0.0.1:11435',model:'qwen3.5:4b-q4_K_M'};
  const body:any={schemaVersion:1,workerId:config.workerId,workerConfig:configFile,ollamaEndpoint:config.ollama,
    modelDirectory:MODEL_ROOT,model:config.model,codexExecutable:executable,codexResolverModule:resolver};
  const seal=()=>({...body,id:createHash('sha256').update(JSON.stringify(body)).digest('hex')});
  const env={LOCALAPPDATA:'C:\\Users\\synthetic\\AppData\\Local',GTOP_RUNNER_CONTRACT:'F:\\Workspace\\Support\\PTI\\local-service-initiator\\data\\gtop-runner.json',
    GTOP_OLLAMA_ENDPOINT:config.ollama,GTOP_CODEX_EXECUTABLE:executable,GTOP_CODEX_RESOLVER:resolver};
  const files:any={real:async(file:string)=>file,info:async()=>({isFile:()=>true,size:100}),read:async()=>JSON.stringify(seal()),list:async()=>[]};
  return {config,body,seal,env,files};
}
test('all URL aliases, paths, default/shared ports, credentials and non-loopback targets fail closed',()=>{
  for(const value of ['http://127.0.0.1:11434','http://localhost:11435','http://0.0.0.0:11435','http://127.0.0.1:11435/',
    'https://127.0.0.1:11435','http://a:b@127.0.0.1:11435','http://127.0.0.1:11435?x=1','http://127.0.0.1:65536','http://127.0.0.1:1023',undefined])assert.throws(()=>scopedEndpoint(value));
  assert.equal(scopedEndpoint('http://127.0.0.1:11435'),'http://127.0.0.1:11435');
});
test('launch v1 validates identity and re-resolves a newer executable on each job',async()=>{
  const f=fixture();let jobs=0;const loaded:string[]=[];
  const runner=await prepareRunner(f.config,configFile,f.env,{files:f.files,load:async url=>{loaded.push(url);return {resolveCodexExecutable:async()=>bin+`\\build-${++jobs}\\codex.exe`};}});
  assert.equal(runner.contractId,f.seal().id);
  assert.equal(await runner.resolveCodex(),bin+'\\build-1\\codex.exe');
  assert.equal(await runner.resolveCodex(),bin+'\\build-2\\codex.exe');
  assert(loaded.every(url=>url.startsWith('file:///')));
});
test('contract model, worker, version, root, endpoint, config and hash mismatches never load code',async()=>{
  for(const change of [{model:'wrong'},{workerId:'other'},{schemaVersion:2},{modelDirectory:'F:\\SEFPO'},
    {ollamaEndpoint:'http://127.0.0.1:11434'},{workerConfig:'F:\\another.json'}]){
    const f=fixture();Object.assign(f.body,change);
    await assert.rejects(()=>prepareRunner(f.config,configFile,f.env,{files:f.files,load:async()=>{throw Error('must not load');}}),/mismatch/);
  }
  const f=fixture();f.files.read=async()=>JSON.stringify({...f.seal(),id:'0'.repeat(64)});
  await assert.rejects(()=>prepareRunner(f.config,configFile,f.env,{files:f.files}),/mismatch/);
  await assert.rejects(()=>prepareRunner({...f.config,runnerContractVersion:undefined},configFile,{}),/runnerContractVersion/);
});
test('partial launch environments cannot silently use standalone or stale-config fallback',async()=>{
  const f=fixture();
  await assert.rejects(()=>prepareRunner(f.config,configFile,{GTOP_OLLAMA_ENDPOINT:f.config.ollama}),/launch contract/);
  await assert.rejects(()=>prepareRunner(f.config,configFile,{...f.env,GTOP_OLLAMA_ENDPOINT:'http://127.0.0.1:11436'},{files:f.files}),/mismatch/);
  await assert.rejects(()=>prepareRunner(f.config,configFile,{...f.env,GTOP_CODEX_EXECUTABLE:bin+'\\old\\codex.exe'},{files:f.files}),/mismatch/);
});
test('helper failures, removed binaries and arbitrary executable paths are actionable without fallback',async()=>{
  for(const helper of [async()=>{throw Error('private detail');},async()=>({}),async()=>({resolveCodexExecutable:async()=>{throw Error('private detail');}}),
    async()=>({resolveCodexExecutable:async()=>'F:\\arbitrary\\codex.exe'})]){
    const f=fixture(),runner=await prepareRunner(f.config,configFile,f.env,{files:f.files,load:helper});
    await assert.rejects(()=>runner.resolveCodex(),e=>e instanceof Error&&/GTOP runner:/.test(e.message)&&!e.message.includes('private detail'));
  }
  const f=fixture(),runner=await prepareRunner(f.config,configFile,f.env,{files:f.files,load:async()=>({resolveCodexExecutable:async()=>executable})});
  f.files.info=async()=>{throw Error('removed');};
  await assert.rejects(()=>runner.resolveCodex(),/missing/);
});
test('untrusted, missing or redirected helper/contract is rejected before import',async()=>{
  const f=fixture();f.body.codexResolverModule='F:\\untrusted\\src\\gtop-runner.mjs';f.env.GTOP_CODEX_RESOLVER=f.body.codexResolverModule;
  await assert.rejects(()=>prepareRunner(f.config,configFile,f.env,{files:f.files}),/untrusted/);
  const g=fixture();g.files.real=async()=> 'F:\\redirected';
  await assert.rejects(()=>prepareRunner(g.config,configFile,g.env,{files:g.files}),/invalid/);
  const h=fixture();h.files.info=async(file:string)=>{if(file===resolver)throw Error('missing');return {isFile:()=>true,size:100};};
  await assert.rejects(()=>prepareRunner(h.config,configFile,h.env,{files:h.files}),/resolver module is missing/);
});
test('compatible v1 without a helper checks the explicit contract executable every time',async()=>{
  const f=fixture();delete f.body.codexResolverModule;delete (f.env as any).GTOP_CODEX_RESOLVER;
  const runner=await prepareRunner(f.config,configFile,f.env,{files:f.files});
  assert.equal(await runner.resolveCodex(),executable);
  f.files.info=async()=>{throw Error('removed');};await assert.rejects(()=>runner.resolveCodex(),/missing/);
});
test('standalone discovery ignores unversioned pins, tolerates removed updates and breaks ties stably',async()=>{
  const entries=['old','removed','b-new','a-new'].map(name=>({name,isDirectory:()=>true}));
  const args={localAppData:'C:\\Users\\synthetic\\AppData\\Local',list:async()=>entries,
    info:async(file:string)=>{if(file.includes('removed'))throw Error('removed');return {isFile:()=>true,mtimeMs:file.includes('old')?1:2};}};
  assert.equal(await resolveDesktopCodex(args),bin+'\\a-new\\codex.exe');
  await assert.rejects(()=>resolveDesktopCodex({...args,list:async()=>[]}),/no current/);
  const f=fixture();const runner=await prepareRunner(f.config,configFile,{LOCALAPPDATA:args.localAppData},{files:{...f.files,list:args.list,info:args.info} as any});
  assert.equal(await resolveJobCodex({runner,codexExecutable:'F:\\obsolete'} as Config),bin+'\\a-new\\codex.exe');
});
function healthConfig():Config{return {ollama:'http://127.0.0.1:11435',model:'qwen',runner:{resolveCodex:async()=>executable}} as Config;}
test('installed, residency and executable checks remain separate; health never warms a model',async t=>{
  const config=healthConfig(),calls:string[]=[];
  t.mock.method(globalThis,'fetch',async(input:any,init:any)=>{calls.push(String(input));assert.equal(init.redirect,'error');assert.equal(init.body,undefined);return Response.json({models:String(input).endsWith('/tags')?[{name:config.model}]:[]});});
  assert.deepEqual(await runtimeHealth(config),{available:true,modelInstalled:true,modelResident:false,codexAvailable:true,errorCode:null});
  assert(calls.every(url=>url.startsWith(config.ollama+'/api/')));
  config.runner!.resolveCodex=async()=>{throw Error('stale executable');};
  assert.equal((await runtimeHealth(config)).errorCode,'codex_unavailable');
});
test('missing model fails startup once without any claims or inference',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({models:[]}));
  let probes=0;const probe=async(config:Config)=>{probes++;return runtimeHealth(config);};
  await assert.rejects(()=>waitForRuntime(healthConfig(),new AbortController().signal,probe),/model_unavailable/);assert.equal(probes,1);
});
test('dispatcher retries are bounded; cancellation stops waiting; chat is never auto-retried',async t=>{
  let calls=0;const probe=async()=>{calls++;return {available:false,modelInstalled:false,modelResident:false,codexAvailable:false,errorCode:'dispatcher_unavailable'};};
  await assert.rejects(()=>waitForRuntime(healthConfig(),new AbortController().signal,probe),/dispatcher_unavailable/);assert.equal(calls,3);
  const stop=new AbortController();stop.abort(Error('cancelled'));await assert.rejects(()=>waitForRuntime(healthConfig(),stop.signal,probe),/cancelled/);assert.equal(calls,3);
  let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;throw Error('transport');});
  await assert.rejects(()=>ollamaFetch(healthConfig(),'chat'),/transport/);assert.equal(requests,1);
});
test('no Ollama operation can fall back to the shared endpoint',async t=>{
  let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;return Response.json({});});
  assert.throws(()=>ollamaFetch({...healthConfig(),ollama:'http://127.0.0.1:11434'},'ps'));assert.equal(requests,0);
});
