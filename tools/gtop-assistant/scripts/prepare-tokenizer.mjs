import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const directory=process.argv[2];
if(!directory||!path.isAbsolute(directory)||!/^F:[\\/]/i.test(directory))throw Error('Provide the private F-drive worker data directory.');
const revision='851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a';
const root=path.join(directory,'tokenizer');await mkdir(root,{recursive:true});const files=[];
for(const file of ['tokenizer.json','tokenizer_config.json']){
  const response=await fetch(`https://huggingface.co/Qwen/Qwen3.5-4B/resolve/${revision}/${file}`,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('Tokenizer download failed: '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>30_000_000)throw Error('Tokenizer exceeds size bound.');JSON.parse(bytes.toString('utf8'));
  await writeFile(path.join(root,file),bytes);files.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(path.join(root,'source.json'),JSON.stringify({model:'Qwen/Qwen3.5-4B',revision,files},null,2));console.log(JSON.stringify({revision,files}));
