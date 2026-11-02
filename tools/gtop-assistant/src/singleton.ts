import {mkdir,open,unlink} from 'node:fs/promises';
import path from 'node:path';

/** Atomic across launchers. A crash leaves a refusal, never a second worker. */
export async function acquireWorkerLock(directory:string){
  await mkdir(directory,{recursive:true});const file=path.join(directory,'worker.lock');
  let handle;try{handle=await open(file,'wx');}catch(error:any){if(error.code==='EEXIST')throw Error('GTOP worker lock exists. Inspect its PID and native ownership; remove only after proving the previous worker is stopped.');throw error;}
  await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
  return async()=>{await handle.close();await unlink(file);};
}
