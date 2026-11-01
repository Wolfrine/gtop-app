import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import {readConfig,Gateway,runtimeHealth} from '../src/adapters.js';

// Operational verification only: never launches a process, warms a model,
// claims a job, prints credentials, or changes pairing/global environment.
const root='F:\\Workspace\\Support\\PTI\\local-service-initiator';
const json=async(file:string)=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const active=await json(path.join(root,'active.json'));
assert(/^releases[\\/]\d+\.\d+\.\d+-[a-f0-9]+$/.test(active.release));
const release=path.join(root,active.release);
const {WorkerHost,readJson}=await import(pathToFileURL(path.join(release,'src','windows.mjs')).href);
const {validateSettings}=await import(pathToFileURL(path.join(release,'src','core.mjs')).href);
const settingsFile=path.join(root,'settings.json');
const settings=validateSettings(await readJson(settingsFile));
const contractFile=path.join(root,'data','gtop-runner.json'),contract=await json(contractFile);
// These values are scoped to this verifier process, never written to user/machine environment.
process.env.GTOP_RUNNER_CONTRACT=contractFile;process.env.GTOP_OLLAMA_ENDPOINT=contract.ollamaEndpoint;
process.env.GTOP_CODEX_EXECUTABLE=contract.codexExecutable;process.env.GTOP_CODEX_RESOLVER=contract.codexResolverModule;
const config=await readConfig(settings.workerConfig),host=new WorkerHost(settings,settingsFile);
assert.equal(await host.workerRunning(),true,'Exact owned worker must be running');
const snapshot=await host.snapshot(),ollama=await json(path.join(root,'data','ollama-host.json'));
assert(host.owns(ollama,'ollama',snapshot),'Dedicated dispatcher identity must match native ownership');
assert(snapshot.listeners.length&&snapshot.listeners.every((l:any)=>l.address==='127.0.0.1'&&l.pid===ollama.childPid));
const health=await runtimeHealth(config);assert.equal(health.available,true);
const local=await json(path.join(config.dataDirectory,'worker-health.json'));
assert.equal(local.runnerContractId,contract.id);assert.equal(local.available,true);
assert(Date.now()-Date.parse(local.checkedAt)<90000,'Local health must be fresh');
// Existing paired client performs its own protected authentication internally.
// No session tokens or protected config values enter the report.
const response=await new Gateway(config).post('/worker/service/poll',{version:active.version,workerRunning:true});
assert.equal(response.service?.state,'ready','Gateway must confirm the real worker heartbeat');
assert(['ready','busy'].includes(response.service.worker.state));
const report={capturedAt:new Date().toISOString(),evidenceKind:'installed-owned-runtime-and-authenticated-gateway',
  version:active.version,release:active.release,sourceRevision:active.sourceRevision,
  endpoint:config.ollama,runnerContractId:contract.id,workerPid:local.pid,dispatcherPid:ollama.childPid,
  health,gateway:{state:response.service.state,worker:response.service.worker,starter:response.service.starter},
  onePieceEnabled:settings.onePieceEnabled===true,productionJobsCreated:0,modelWarmup:false};
const output=JSON.stringify(report,null,2)+'\n';
if(process.argv[2]){
  const file=path.resolve(process.argv[2]);assert(/^F:[\\/]/i.test(file),'Report must remain on F:');
  await writeFile(file,output,{encoding:'utf8',flag:'wx'});
}
console.log(output);
