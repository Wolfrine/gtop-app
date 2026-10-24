import {isDeepStrictEqual} from 'node:util';
/** Exact worker-only privilege reductions; any human permission change retains core gates. */
export function withoutWorkerFirestoreRule(source){return source.replace(/return request\.auth != null\s*&& request\.auth\.token\.get\('assistantWorker', false\) != true;/,'return request.auth != null;');}
export function withoutWorkerDatabaseRule(source){const rules=JSON.parse(source);for(const location of [rules.rules?.activeUsers,rules.rules?.activeUsers?.$uid])if(location)for(const key of ['.read','.write'])if(typeof location[key]==='string')location[key]=location[key].replace(' && auth.token.assistantWorker !== true','');return rules;}
export function assistantOnlyRelease(files,readBefore,readCurrent){
  const allowed=/^(?:assistant-service\/|question-papers\/|tools\/gtop-assistant\/|docs\/|design\/assistant-pilot\/|wiki\/|raw\/|codex\/|firebase\.assistant\.json$|\.gitignore$|\.github\/workflows\/(?:gtop-assistant-release|firebase-deploy)\.yml$|gtop-app\/(?:firestore\.rules|database\.rules\.json)$)/;
  if(!files.length || files.some(file=>!allowed.test(file)))return false;
  const rulePaths=files.filter(file=>file.startsWith('gtop-app/'));
  if(!rulePaths.length)return false;
  try{
    for(const path of rulePaths){
      const before=readBefore(path),current=readCurrent(path);
      if(path.endsWith('firestore.rules')){const normalize=s=>s.replace(/\s/g,'');if(normalize(before)!==normalize(withoutWorkerFirestoreRule(current)))return false;}
      else if(!isDeepStrictEqual(JSON.parse(before),withoutWorkerDatabaseRule(current)))return false;
    }
    return true;
  }catch{return false;}
}
