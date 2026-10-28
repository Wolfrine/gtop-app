import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {Tokenizer} from '@huggingface/tokenizers';

let cached:{directory:string;count:(text:string)=>number}|null=null;
export async function tokenCounter(directory:string){
  if(cached?.directory===directory)return cached.count;
  try{
    const root=path.join(directory,'tokenizer');
    const [json,config]=await Promise.all(['tokenizer.json','tokenizer_config.json'].map(file=>readFile(path.join(root,file),'utf8').then(JSON.parse)));
    const tokenizer=new Tokenizer(json,config);const count=(text:string)=>tokenizer.encode(text).ids.length;
    cached={directory,count};return count;
  }catch(e:any){if(e.code!=='ENOENT')throw e;return (text:string)=>Buffer.byteLength(text);}
}
/** Chat-template and tool rendering vary by runtime: reserve a margin in addition to content/schema tokens. */
export function requestTokens(body:any,count:(text:string)=>number){return count(JSON.stringify({messages:body.messages,tools:body.tools,format:body.format}))+256+body.messages.length*12;}
export function fitRequest(body:any,count:(text:string)=>number){
  const reserve=body.options.num_predict,limit=body.options.num_ctx-reserve;
  while(requestTokens(body,count)>limit&&body.messages.length>2)body.messages.splice(1,1);
  if(requestTokens(body,count)>limit)throw Error('Local context needs specialist handling.');
  return {inputTokensEstimated:requestTokens(body,count),generationTokensReserved:reserve,contextTokens:body.options.num_ctx};
}
