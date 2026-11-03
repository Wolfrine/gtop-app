export const workerFreshnessMs=90000;
const states=new Set(['ready','busy','loading','offline']);

/** Authorization always comes from pairing; health can supply telemetry only.
 * Missing health supports the rolling deployment from the legacy combined doc.
 * An existing malformed health doc fails closed instead of reviving legacy data.
 */
export function withWorkerHealth(pairing,health){
  if(!pairing)return null;
  if(health===null||health===undefined)return pairing;
  const valid=health.schemaVersion===1&&states.has(health.state)&&typeof health.modelReady==='boolean'&&Number.isFinite(Date.parse(health.lastSeenAt));
  return {...pairing,...(valid?{state:health.state,modelReady:health.modelReady,version:health.version,lastSeenAt:health.lastSeenAt}:{state:'offline',modelReady:false,lastSeenAt:null})};
}
