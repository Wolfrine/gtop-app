export const dispatchWorkerId = 'sachit-windows';
export const dispatchVersion = config => config?.dispatchVersion === 2 ? 2 : 1;
export const dispatchMarkerPath = route => 'assistantWorkerDispatch/' + dispatchWorkerId + '-' + route;
export const isDispatchRoute = route => ['generation','checking'].includes(route);
export const isRouteWorker = (worker,config) => dispatchVersion(config) === 2
  && worker?.enabled === true && worker.id === dispatchWorkerId;

export function workerCanServe(worker, config, uid) {
  return worker?.enabled === true && (dispatchVersion(config) === 2
    ? isRouteWorker(worker,config)
    : worker.allowedOwnerUids?.includes(uid));
}

function scopedKey(scope, then, id) {
  return scope + '/' + then + '/' + id;
}
export function generationLane(kind,native) {
  return kind === 'turn' ? (native ? 'native-turn' : 'turn') : 'paper';
}
export const generationLeaseLane = (kind,native) => 'lease-'+generationLane(kind,native);
export const generationLeaseKey = (job,time) => scopedKey(generationLeaseLane(job.kind,job.native),time,job.id);
export function checkingLane(kind) {
  if (kind === 'class-intake') return 'checking-intake';
  if (kind === 'external-exam') return 'checking-reference';
  if (['auto-grade','auto-reference','auto-print-reference'].includes(kind)) return 'checking-auto';
  return 'checking';
}

export function stampDispatchRecord(path, row, actor) {
  if (!/^(?:assistantJobs|assistantCheckingQueue)\/[^/]+$/.test(path) || !row?.state) return row;
  const checking = path.startsWith('assistantCheckingQueue/');
  if (row.state !== 'queued') {
    const running = checking && row.state === 'running' && row.leaseUntil && row.id;
    const activeGeneration=!checking&&['running','validating'].includes(row.state);
    return {...row, dispatchQueueKey:null,
      ...(checking?{dispatchLeaseKey:running?scopedKey('checking-lease',row.leaseUntil,row.id):null}:
        !activeGeneration?{dispatchLeaseKey:null}:row.id&&row.leaseUntil?{dispatchLeaseKey:generationLeaseKey(row,row.leaseUntil)}:{})};
  }
  if (!row.id || !(checking ? row.queuedAt : row.createdAt)) return row;
  const lane = checking ? checkingLane(row.kind) : generationLane(row.kind,row.native);
  const owner = checking ? row.uid : row.ownerUid;
  const version = actor?.uid === owner ? actor.version : (row.accessVersion ?? 0);
  return {...row, accessVersion:version,
    dispatchQueueKey:scopedKey(lane,checking?row.queuedAt:row.createdAt,row.id),
    dispatchLeaseKey:null};
}

export function dispatchHead(store, collection, lane, size, field='dispatchQueueKey') {
  return store.list(collection,[[field,'>=',lane+'/'],[field,'<',lane+'0']],size,{
    orderBy:[field,'asc'], includeId:true
  });
}
