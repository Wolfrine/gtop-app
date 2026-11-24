import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Unknown changes or unavailable history retain the normal cloud release gate.
// A local controller or documentation change needs verification, not a repeat
// deployment of byte-for-byte unchanged gateway and Hosting sources.
export function cloudReleasePlan(files:string[]){
  const scopedPath=/^(?:assistant-service\/|question-papers\/|tools\/gtop-assistant\/|gtop-app\/(?:src\/|angular\.json$)|gtop-v2\/|(?:docs|design|raw|wiki|codex)\/|AGENTS\.md$|\.github\/workflows\/(?:gtop-assistant-release|gt-papers-growth-preview|firebase-deploy|firebase-v2-uat)\.yml$)/;
  if(files.length>0&&files.every(file=>scopedPath.test(file))){
    const sharedWithPapers=new Set(['assistant-service/domain/exam-copy.mjs','assistant-service/domain/checking.mjs','assistant-service/domain/checking-limits.mjs','assistant-service/domain/checking-intake.mjs','assistant-service/domain/external-reference.mjs']);
    return {backend:files.some(file=>file.startsWith('assistant-service/')),hosting:files.some(file=>file.startsWith('question-papers/')||sharedWithPapers.has(file))};
  }
  return {backend:true,hosting:true};
}
export const cloudReleaseRequired=(files:string[])=>{const plan=cloudReleasePlan(files);return plan.backend||plan.hosting;};

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let plan={backend:true,hosting:true};
  let directory=true,catalogue=true;
  const before=process.env.RELEASE_BEFORE || '';
  if(process.env.GITHUB_EVENT_NAME==='push'&&/^[a-f0-9]{40}$/.test(before)&&!/^[0]+$/.test(before)){
    try{
      const files=execFileSync('git',['diff','--no-renames','--name-only','-z',before,'HEAD'],{encoding:'utf8'}).split('\0').filter(Boolean);
      plan=cloudReleasePlan(files);
      directory=files.some(file=>/^assistant-service\/(?:student-(?:directory|index)|runtime\.mjs$|store\.mjs$|package(?:-lock)?\.json$|scripts\/deploy-student-directory\.mjs$)/.test(file));
      catalogue=files.some(file=>/^assistant-service\/(?:paper-catalogue\.mjs$|paper-library-facets\.mjs$|scripts\/backfill-paper-(?:catalogue|facets)\.mjs$)/.test(file));
    }
    catch{console.warn('Release history unavailable; retaining cloud deployment.');}
  }
  if(!process.env.GITHUB_OUTPUT)throw Error('Run this release classification only inside GitHub Actions.');
  appendFileSync(process.env.GITHUB_OUTPUT,`deploy_required=${plan.backend||plan.hosting}\nbackend_required=${plan.backend}\nhosting_required=${plan.hosting}\ndirectory_required=${directory}\ncatalogue_backfill_required=${catalogue}\n`);
  console.log(`Verified release scope: backend=${plan.backend}; hosting=${plan.hosting}. All required verification remains enabled.`);
}
