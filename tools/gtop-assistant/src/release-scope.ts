import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Unknown changes or unavailable history retain the normal cloud release gate.
// A local controller or documentation change needs verification, not a repeat
// deployment of byte-for-byte unchanged gateway and Hosting sources.
export function cloudReleasePlan(files:string[]){
  if(files.length>0&&files.every(file=>/^(?:assistant-service\/|question-papers\/|tools\/gtop-assistant\/|docs\/|design\/|\.github\/workflows\/gtop-assistant-release\.yml$)/.test(file))){
    return {backend:files.some(file=>file.startsWith('assistant-service/')),hosting:files.some(file=>file.startsWith('question-papers/')||file==='assistant-service/domain/exam-copy.mjs')};
  }
  return {backend:true,hosting:true};
}
export const cloudReleaseRequired=(files:string[])=>{const plan=cloudReleasePlan(files);return plan.backend||plan.hosting;};

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let plan={backend:true,hosting:true};
  const before=process.env.RELEASE_BEFORE || '';
  if(process.env.GITHUB_EVENT_NAME==='push'&&/^[a-f0-9]{40}$/.test(before)&&!/^[0]+$/.test(before)){
    try{const files=execFileSync('git',['diff','--no-renames','--name-only','-z',before,'HEAD'],{encoding:'utf8'}).split('\0').filter(Boolean);plan=cloudReleasePlan(files);}
    catch{console.warn('Release history unavailable; retaining cloud deployment.');}
  }
  if(!process.env.GITHUB_OUTPUT)throw Error('Run this release classification only inside GitHub Actions.');
  appendFileSync(process.env.GITHUB_OUTPUT,`deploy_required=${plan.backend||plan.hosting}\nbackend_required=${plan.backend}\nhosting_required=${plan.hosting}\n`);
  console.log(`Verified release scope: backend=${plan.backend}; hosting=${plan.hosting}. All required verification remains enabled.`);
}
