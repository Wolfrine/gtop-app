import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const skillNames=['conversation','create-paper','revise-paper','explain-paper','plan-request'] as const;
export async function skill(name:typeof skillNames[number]){if(!skillNames.includes(name))throw Error('Unknown skill.');const text=await readFile(new URL(`../skills/${name}.md`,import.meta.url),'utf8');const version=Number(text.match(/\bversion (\d+)/)?.[1]);if(!Number.isInteger(version)||version<1)throw Error('Skill version is missing.');return {name,version,sha256:createHash('sha256').update(text).digest('hex'),text};}
export async function assistantInstructions(){const text=await readFile(new URL('../AGENTS.md',import.meta.url),'utf8');return {name:'AGENTS.md',text,sha256:createHash('sha256').update(text).digest('hex')};}
