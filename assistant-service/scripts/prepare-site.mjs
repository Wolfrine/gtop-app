import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
assert.equal(process.env.GITHUB_REF,'refs/heads/main','Hosting setup requires the reviewed main release.');
assert(process.env.ACCESS_TOKEN,'Existing Actions identity is required.');
const headers={Authorization:'Bearer '+process.env.ACCESS_TOKEN,'Content-Type':'application/json'};
const site='gtop-question-papers',project='gtop-app';
const siteUrl=`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${site}`;
let existing=await fetch(siteUrl,{headers,signal:AbortSignal.timeout(30000)});
if(existing.status===404){
  await new Promise((resolve,reject)=>{const p=spawn('npx',['--yes','firebase-tools@15','hosting:sites:create',site,'--project',project,'--non-interactive'],{stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('Named Hosting site setup failed.')));});
  existing=await fetch(siteUrl,{headers,signal:AbortSignal.timeout(30000)});
}
assert(existing.ok,'Existing identity cannot inspect/create the named independent Hosting site.');
assert((await existing.json()).name.endsWith('/sites/'+site));
const configUrl=`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
const read=await fetch(configUrl,{headers,signal:AbortSignal.timeout(30000)});assert(read.ok,'Existing identity cannot inspect Firebase Auth domains.');
const current=await read.json();
const domains=[`${site}.web.app`,`${site}.firebaseapp.com`];
if(domains.some(domain=>!current.authorizedDomains?.includes(domain))){
  const update=await fetch(configUrl+'?updateMask=authorizedDomains',{method:'PATCH',headers,body:JSON.stringify({authorizedDomains:[...new Set([...(current.authorizedDomains || []),...domains])]}),signal:AbortSignal.timeout(30000)});assert(update.ok,'Existing identity cannot authorize the independent site; no IAM repair is attempted.');
}
const verified=await fetch(configUrl,{headers,signal:AbortSignal.timeout(30000)});assert(verified.ok);const after=await verified.json();
assert([...current.authorizedDomains || [],...domains].every(domain=>after.authorizedDomains.includes(domain)),'Auth domain setup must preserve all existing domains.');
console.log('Verified only gtop-question-papers site and its additive Auth domain pair; providers and existing domains preserved.');
