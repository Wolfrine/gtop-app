import {createHash} from 'node:crypto';
import {mkdir,open,readFile,realpath,unlink} from 'node:fs/promises';
import {createServer} from 'node:net';
import path from 'node:path';

function errorCode(error:unknown) {
  return (error as NodeJS.ErrnoException).code;
}

// Retain compatibility with an older Windows worker during the cutover.
async function clearLegacyLock(file:string) {
  let record:string;
  try { record=await readFile(file,'utf8'); }
  catch (error) { if(errorCode(error)==='ENOENT')return; throw error; }
  const pid=JSON.parse(record)?.pid;
  if(!Number.isInteger(pid) || pid<=0 || pid>0x7fffffff)throw Error('GTOP legacy worker lock has no valid PID.');
  try { process.kill(pid,0); }
  catch (error) {
    if(errorCode(error)!=='ESRCH')throw error;
    await unlink(file);
    console.log('Cleared the legacy GTOP worker lock for an exited process.');
    return;
  }
  throw Error('GTOP worker lock exists for a live PID.');
}

export async function acquireWorkerLock(directory:string) {
  await mkdir(directory,{recursive:true});
  const file=path.join(directory,'worker.lock');
  if(process.platform!=='win32') {
    const handle=await open(file,'wx').catch(error=>{
      if(errorCode(error)==='EEXIST')throw Error('GTOP worker lock exists.');
      throw error;
    });
    try { await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})); }
    catch (error) { await handle.close();await unlink(file);throw error; }
    return async()=>{await handle.close();await unlink(file);};
  }

  // This pipe carries no data. Windows removes it when the process exits,
  // including after a hard stop. Use the physical directory as its identity.
  const identity=createHash('sha256').update((await realpath(directory)).toLowerCase()).digest('hex');
  const pipe=String.raw`\\.\pipe\gtop-worker-${identity}`;
  const server=createServer(socket=>socket.destroy());
  await new Promise<void>((resolve,reject)=>{
    server.once('error',reject);
    server.listen(pipe,()=>{server.off('error',reject);resolve();});
  }).catch(error=>{
    if(errorCode(error)==='EADDRINUSE')throw Error('GTOP worker lock exists for this runtime directory.');
    throw error;
  });
  const release=()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  try { await clearLegacyLock(file); }
  catch (error) { await release();throw error; }
  return release;
}
