import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Unknown changes or unavailable history retain the normal cloud release gate.
// A local controller or documentation change needs verification, not a repeat
// deployment of byte-for-byte unchanged gateway and Hosting sources.
export const cloudReleaseRequired=(files:string[])=>files.length===0||files.some(file=>! /^(?:tools\/gtop-assistant\/|docs\/|\.github\/workflows\/gtop-assistant-release\.yml$)/.test(file));

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let required=true;
  const before=process.env.RELEASE_BEFORE || '';
  if(process.env.GITHUB_EVENT_NAME==='push'&&/^[a-f0-9]{40}$/.test(before)&&!/^[0]+$/.test(before)){
    try{const files=execFileSync('git',['diff','--no-renames','--name-only','-z',before,'HEAD'],{encoding:'utf8'}).split('\0').filter(Boolean);required=cloudReleaseRequired(files);}
    catch{console.warn('Release history unavailable; retaining cloud deployment.');}
  }
  if(!process.env.GITHUB_OUTPUT)throw Error('Run this release classification only inside GitHub Actions.');
  appendFileSync(process.env.GITHUB_OUTPUT,`deploy_required=${required}\n`);
  console.log(required?'Verified scope requires the normal cloud release.':'Local controller/docs scope: required checks remain; unchanged cloud resources will not redeploy.');
}
