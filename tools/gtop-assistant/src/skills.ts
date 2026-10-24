import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function skill(name:'create-paper'|'revise-paper'|'explain-paper'){const text=await readFile(new URL(`../skills/${name}.md`,import.meta.url),'utf8');return {name,version:1,sha256:createHash('sha256').update(text).digest('hex'),text};}
