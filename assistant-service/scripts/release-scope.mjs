import {isDeepStrictEqual} from 'node:util';
/** RTDB returns its commented JSON rules source, rather than strict JSON. No evaluation. */
export function parseRulesJson(source){
  let out='',quoted=false,escaped=false;
  for(let i=0;i<source.length;i++){
    const c=source[i],next=source[i+1];
    if(quoted){out+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;out+=c;continue;}
    if(c==='/'&&next==='/'){while(i<source.length&&source[i]!=='\n')i++;out+='\n';continue;}
    if(c==='/'&&next==='*'){const end=source.indexOf('*/',i+2);if(end<0)throw Error('Unterminated JSON rule comment.');out+=' ';i=end+1;continue;}
    out+=c;
  }
  return JSON.parse(out);
}
function expression(value){let out='',quote=null,escaped=false;for(const c of value){if(quote){out+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote=null;}else if(c==='"'||c==="'"){quote=c;out+=c;}else if(!/\s/.test(c))out+=c;}return out;}
export function equivalentDatabaseRules(left,right){
  const normalize=(value,key='')=>Array.isArray(value)?value.map(v=>normalize(v)):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k],k)])):typeof value==='string'&&['.read','.write','.validate'].includes(key)?expression(value):value;
  return isDeepStrictEqual(normalize(left),normalize(right));
}
/** Exact worker-only privilege reductions; any human permission change retains core gates. */
export function withoutWorkerFirestoreRule(source){return source.replace(/return request\.auth != null\s*&& request\.auth\.token\.get\('assistantWorker', false\) != true;/,'return request.auth != null;');}
export function withoutWorkerDatabaseRule(source){const rules=JSON.parse(source);for(const location of [rules.rules?.activeUsers,rules.rules?.activeUsers?.$uid])if(location)for(const key of ['.read','.write'])if(typeof location[key]==='string')location[key]=location[key].replace(' && auth.token.assistantWorker !== true','');return rules;}
export function assistantOnlyRelease(files,readBefore,readCurrent){
  const allowed=/^(?:assistant-service\/|question-papers\/|tools\/gtop-assistant\/|docs\/|design\/assistant-pilot\/|wiki\/|raw\/|codex\/|firebase\.assistant\.json$|\.gitignore$|\.github\/workflows\/(?:gtop-assistant-release|firebase-deploy)\.yml$|gtop-app\/(?:firestore\.rules|database\.rules\.json)$)/;
  if(!files.length || files.some(file=>!allowed.test(file)))return false;
  const rulePaths=files.filter(file=>file.startsWith('gtop-app/'));
  // Assistant/pipeline-only follow-ups must not deploy the unchanged core either.
  if(!rulePaths.length)return true;
  try{
    for(const path of rulePaths){
      const before=readBefore(path),current=readCurrent(path);
      if(path.endsWith('firestore.rules')){const normalize=s=>s.replace(/\s/g,'');if(normalize(before)!==normalize(withoutWorkerFirestoreRule(current)))return false;}
      else if(!isDeepStrictEqual(JSON.parse(before),withoutWorkerDatabaseRule(current)))return false;
    }
    return true;
  }catch{return false;}
}
