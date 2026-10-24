import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function skill(name:'conversation'|'create-paper'|'revise-paper'|'explain-paper'){const text=await readFile(new URL(`../skills/${name}.md`,import.meta.url),'utf8');const version=Number(text.match(/\bversion (\d+)/)?.[1]);if(!Number.isInteger(version)||version<1)throw Error('Skill version is missing.');return {name,version,sha256:createHash('sha256').update(text).digest('hex'),text};}
