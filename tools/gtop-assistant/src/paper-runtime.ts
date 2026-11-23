import {createReadStream} from 'node:fs';
import {readdir,readFile,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {createInterface} from 'node:readline';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export interface PaperRuntime {
  schemaVersion: 1;
  revision: number;
  model: string;
  reasoningEffort: ReasoningEffort;
}
export const defaultPaperRuntime:Readonly<PaperRuntime> = Object.freeze({
  schemaVersion:1,revision:1,model:'gpt-6.2-sol',reasoningEffort:'xhigh',
});

export async function readPaperRuntime(file:string):Promise<Readonly<PaperRuntime>>{
  const value=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
  if(!value||Object.keys(value).some(key=>!Object.hasOwn(defaultPaperRuntime,key))||
    value.schemaVersion!==1||!Number.isSafeInteger(value.revision)||value.revision<1||
    typeof value.model!=='string'||!/^[a-z0-9][a-z0-9._-]{0,95}$/i.test(value.model)||
    !['low','medium','high','xhigh'].includes(value.reasoningEffort)){
    throw Error('Invalid GT Papers runtime profile. Check its schema version, revision, model ID and reasoning effort.');
  }
  return Object.freeze({schemaVersion:1,revision:value.revision,model:value.model,reasoningEffort:value.reasoningEffort});
}

const stamp=(date:Date)=>[date.getFullYear(),date.getMonth()+1,date.getDate()]
  .map(n=>String(n).padStart(2,'0')).join(path.sep);

// Inspect only the session issued by this child. Never read credentials or other turns.
export async function nativeTurnContext(threadId:unknown,startedAt:number){
  if(typeof threadId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(threadId))return null;
  const sessions=path.join(process.env.CODEX_HOME||path.join(homedir(),'.codex'),'sessions');
  const days=new Set([stamp(new Date(startedAt)),stamp(new Date())]);
  for(const day of days){
    const directory=path.join(sessions,day);
    const entries=await readdir(directory,{withFileTypes:true}).catch(()=>[]);
    const entry=entries.find(item=>item.isFile()&&item.name.startsWith('rollout-')&&item.name.endsWith('-'+threadId+'.jsonl'));
    if(!entry)continue;
    const file=path.join(directory,entry.name);
    const info=await stat(file);
    if(info.mtimeMs<startedAt-2000)continue;
    const stream=createReadStream(file,{encoding:'utf8'});
    const lines=createInterface({input:stream,crlfDelay:Infinity});
    try{
      let remaining=32;
      for await(const line of lines){
        if(--remaining<0)break;
        const event=JSON.parse(line);
        if(event.type!=='turn_context')continue;
        const {model,effort}=event.payload||{};
        return typeof model==='string'&&typeof effort==='string'?{model,reasoningEffort:effort}:null;
      }
    }finally{lines.close();stream.destroy();}
  }
  return null;
}
