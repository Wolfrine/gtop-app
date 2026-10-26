import {createHash} from 'node:crypto';

export const serviceWorkerId='sachit-windows';
export const ptiProjectId='pti-app-2ab59';
export const ptiOwnerUid='5PbKbpGf3AbarNrp6pyqJ5C5Ziu2';
const controlPath=`assistantServiceControls/${serviceWorkerId}`;
const workerPath=`assistantWorkers/${serviceWorkerId}`;
const pendingStates=new Set(['pending','claimed','started']);
const errors=new Set(['start_failed','model_unavailable','port_in_use','configuration_invalid','worker_start_timeout']);
const heartbeatMs=90000,requestMs=120000,cooldownMs=30000;
const fresh=(at,now)=>Number.isFinite(Date.parse(at))&&now-Date.parse(at)>=0&&now-Date.parse(at)<heartbeatMs;
const publicRequest=r=>r?Object.fromEntries(['id','state','requestedAt','expiresAt','errorCode'].map(k=>[k,r[k]??null])):null;

/** Fixed start-only mailbox. Models and browsers never select a command, process or path. */
export class ServiceControl {
  constructor(service,fail){this.service=service;this.fail=fail;}
  now(){return this.service.now().getTime();}
  ptiUser(claims){
    if(claims?.uid!==ptiOwnerUid||claims.aud!==ptiProjectId||claims.iss!==`https://securetoken.google.com/${ptiProjectId}`||claims.assistantWorker)this.fail(403,'host_owner_required','This control is restricted to the PTI owner.');
    return {uid:claims.uid,realm:'pti'};
  }
  requireWorker(worker){if(worker?.enabled!==true||!Array.isArray(worker.allowedOwnerUids))this.fail(503,'worker_unavailable','The paired local assistant is unavailable.');}
  normalRequest(request,worker){
    if(!request||!pendingStates.has(request.state))return request;
    if(fresh(worker?.lastSeenAt,this.now())&&['ready','busy'].includes(worker.state))return {...request,state:'completed',completedAt:this.service.iso(),errorCode:null};
    if(Date.parse(request.expiresAt)<=this.now())return {...request,state:'expired',completedAt:this.service.iso(),errorCode:'worker_start_timeout'};
    return request;
  }
  status(worker,control={}){
    const online=fresh(control.lastSeenAt,this.now()),workerOnline=fresh(worker?.lastSeenAt,this.now())&&['ready','busy','loading'].includes(worker?.state),ready=workerOnline&&['ready','busy'].includes(worker.state),request=this.normalRequest(control.request,worker);
    const pending=!!request&&pendingStates.has(request.state),cooling=Number.isFinite(Date.parse(control.lastRequestedAt))&&this.now()-Date.parse(control.lastRequestedAt)<cooldownMs;
    const enabled=worker?.enabled===true;
    const state=enabled&&ready?'ready':enabled&&workerOnline||pending?'starting':!online?'starter_offline':['failed','expired'].includes(request?.state)?'failed':'offline';
    return {workerId:serviceWorkerId,state,starter:{state:online?'online':'offline',lastSeenAt:control.lastSeenAt||null},worker:{state:enabled&&workerOnline?worker.state:'offline',lastSeenAt:worker?.lastSeenAt||null,modelReady:!!(enabled&&ready&&worker.modelReady)},request:publicRequest(request),canStart:!!(enabled&&online&&!workerOnline&&!pending&&!cooling)};
  }
  async get(user){
    const [worker,control]=await Promise.all([this.service.store.get(workerPath),this.service.store.get(controlPath)]);
    this.requireWorker(worker);
    if(user.realm!=='pti'&&!worker.allowedOwnerUids.includes(user.uid))this.fail(403,'worker_access_required','This local assistant is not paired with your account.');
    return this.status(worker,control||{});
  }
  async start(user,body){
    if(Object.keys(body).some(k=>k!=='clientRequestId')||typeof body.clientRequestId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(body.clientRequestId))this.fail(400,'invalid_start_request','A start request identifier is required.');
    const requestId=createHash('sha256').update(`${user.realm||'gtop'}:${user.uid}:${body.clientRequestId}`).digest('hex').slice(0,40),requestPath=`${controlPath}/requests/${requestId}`;
    return this.service.store.transaction(async tx=>{
      const [worker,stored,existing,profile,config]=await Promise.all([tx.get(workerPath),tx.get(controlPath),tx.get(requestPath),user.realm==='pti'?null:tx.get('users/'+user.uid),user.realm==='pti'?null:tx.get('assistantConfig/pilot')]);
      this.requireWorker(worker);
      if(user.realm!=='pti'&&(profile?.role!=='admin'||!config?.allowedOwnerUids?.includes(user.uid)||!worker.allowedOwnerUids.includes(user.uid)))this.fail(403,'worker_access_required','This local assistant is not paired with your account.');
      const control=stored||{},status=this.status(worker,control);
      if(existing)return {service:status};
      const receipt={id:requestId,requestedAt:this.service.iso(),expiresAt:new Date(this.now()+requestMs).toISOString()};
      if(['ready','loading','busy'].includes(status.worker.state)){tx.create(requestPath,receipt);return {service:status};}
      if(status.starter.state!=='online')this.fail(409,'starter_offline','The PC starter is offline. Open the local starter on the PC before trying again.');
      if(control.request&&pendingStates.has(status.request?.state)){tx.create(requestPath,receipt);return {service:status};}
      if(!status.canStart)this.fail(429,'start_cooldown','Please wait briefly before requesting another start.');
      const request={id:requestId,state:'pending',requestedAt:this.service.iso(),expiresAt:new Date(this.now()+requestMs).toISOString(),errorCode:null,requestedBy:{uid:user.uid,realm:user.realm||'gtop'}};
      const next={...control,request,lastRequestedAt:request.requestedAt};
      // Keep an immutable idempotency receipt. Client retries cannot resurrect an old start.
      tx.create(requestPath,receipt);tx.set(controlPath,next);
      return {service:this.status(worker,next)};
    });
  }
  async poll(worker,body){
    if(worker.id!==serviceWorkerId)this.fail(403,'worker_access_required','This worker cannot control the local starter.');
    if(Object.keys(body).some(k=>!['version','workerRunning','lastStartResult'].includes(k))||typeof body.workerRunning!=='boolean'||typeof body.version!=='string'||!body.version.trim()||body.version.length>100)this.fail(400,'invalid_starter_heartbeat','Invalid local starter heartbeat.');
    const result=body.lastStartResult;
    if(result&&(Object.keys(result).some(k=>!['requestId','state','errorCode'].includes(k))||typeof result.requestId!=='string'||!/^[a-f0-9]{40}$/.test(result.requestId)||!['started','failed'].includes(result.state)||(result.errorCode!==undefined&&!errors.has(result.errorCode))))this.fail(400,'invalid_start_result','Invalid local start result.');
    return this.service.store.transaction(async tx=>{
      const [currentWorker,stored]=await Promise.all([tx.get(workerPath),tx.get(controlPath)]);this.requireWorker(currentWorker);
      let request=this.normalRequest(stored?.request,currentWorker);
      if(result&&request?.id===result.requestId&&['claimed','started'].includes(request.state))request={...request,state:result.state,acknowledgedAt:this.service.iso(),errorCode:result.state==='failed'?result.errorCode||'start_failed':null};
      if(request?.state==='pending')request={...request,state:'claimed',claimedAt:this.service.iso()};
      const next={...(stored||{}),lastSeenAt:this.service.iso(),version:body.version,workerRunning:body.workerRunning,...(request?{request}:{})};
      tx.set(controlPath,next);
      // Replay the same claim until its acknowledgement or expiry. The initiator persists
      // the ID locally before spawn; a lost HTTP response cannot create another process.
      return {request:request?.state==='claimed'?{id:request.id,action:'start',expiresAt:request.expiresAt}:null,service:this.status(currentWorker,next)};
    });
  }
}
