import {HttpError} from './service.mjs';

export const papersPolicyPath = 'assistantConfig/pilot';
const requests = 'assistantPapersAccess';
const requestPath = uid => requests + '/' + uid;
const pageSize = 25;
const validUid = uid => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
const statuses = ['pending','approved','rejected','revoked'];
const denied = () => new HttpError(403,'papers_access_required','GT Papers access is required.');
const reviewDenied = () => new HttpError(403,'papers_admin_required','A GTOP administrator must review access requests.');
const paused = () => new HttpError(409,'papers_access_unavailable','Access requests are unavailable at the moment.');

export const managedPapersAccess = config => config?.managedAccess === true && config?.dispatchVersion === 2;
export function humanPapersUid(claims) {
  if (!validUid(claims?.uid) || claims.assistantWorker || claims.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpError(401,'sign_in_required','Sign in with your Growth Tutorials account.');
  }
  return claims.uid;
}
export function papersAdmin(profile,config,uid) {
  return profile?.role === 'admin' && (managedPapersAccess(config) || config?.allowedOwnerUids?.includes(uid));
}

export async function papersAuthority(reader, uid, known = {}) {
  const [profile, config] = await Promise.all([
    Object.hasOwn(known,'profile') ? known.profile : reader.get('users/' + uid),
    Object.hasOwn(known,'config') ? known.config : reader.get(papersPolicyPath)
  ]);
  const teacherLease = Number.isSafeInteger(known.version) && known.version > 0;
  if (!teacherLease && papersAdmin(profile,config,uid)) return {kind:'admin',version:0,profile,config};
  if (!managedPapersAccess(config) || (!teacherLease && profile?.role === 'admin')) return {kind:null,profile,config};
  const grant = await reader.get(requestPath(uid));
  const approved = grant?.status === 'approved' && Number.isSafeInteger(grant.version) && grant.version > 0;
  return {kind:approved?'teacher':null,version:approved?grant.version:null,profile,config,grant};
}

export function samePapersAuthority(current, expected) {
  return !!current.kind && current.version === (expected ?? 0);
}
export async function recheckPapersActor(reader, uid, version) {
  const access = await papersAuthority(reader, uid,{version});
  if (!samePapersAuthority(access,version)) throw denied();
  return {...access,uid};
}
export function requirePapersAdmin(user) {
  if (user.papersAdmin !== true) throw reviewDenied();
}
export function requirePapersAccess(access) {
  if (!access.kind) throw denied();
  return access;
}

function state(access) {
  if (access.kind === 'admin') return {status:'admin'};
  if (!managedPapersAccess(access.config) || access.profile?.role === 'admin') return {status:'unavailable'};
  return access.grant ? {status:access.grant.status,version:access.grant.version} : {status:'none'};
}

export async function papersAccessRoute(service, claims, method, path, query, body) {
  const uid = humanPapersUid(claims), {store} = service;
  if (path === '/access' && method === 'GET') return state(await papersAuthority(store,uid));
  if (path === '/access' && method === 'POST') {
    if (Object.keys(body).length) throw new HttpError(400,'invalid_request','Request access using your signed-in account.');
    return store.transaction(async tx => {
      const access = await papersAuthority(tx,uid);
      const prior = state(access);
      if (prior.status === 'unavailable') throw paused();
      if (['admin','approved','pending'].includes(prior.status)) return prior;
      const updatedAt = service.iso(), version = (access.grant?.version ?? 0) + 1;
      const grant = {
        status:'pending', version, updatedAt, requestedAt:updatedAt, reviewKey:'pending/' + updatedAt + '/' + uid,
        displayName:String(claims.name || access.profile?.displayName || access.profile?.name || '').slice(0,100),
        email:claims.email_verified === true ? String(claims.email || '').slice(0,254) : ''
      };
      tx.set(requestPath(uid),grant);
      tx.create(requestPath(uid) + '/decisions/' + version,{status:grant.status,actorUid:uid,at:updatedAt});
      return {status:grant.status,version};
    });
  }
  if (path === '/access/admin' && method === 'GET') {
    const access = await papersAuthority(store,uid);
    if (access.kind !== 'admin') throw reviewDenied();
    if (!managedPapersAccess(access.config)) throw paused();
    const status = query.get('status') || 'pending', token = query.get('cursor');
    if (!statuses.includes(status)) throw new HttpError(400,'invalid_status','Choose an access request status.');
    const from = status + '/', to = status + '0';
    let cursor;
    if (token) {
      if (!/^[A-Za-z0-9_-]{1,260}$/.test(token)) throw new HttpError(400,'invalid_cursor','Reload the access request list.');
      cursor = Buffer.from(token,'base64url').toString('utf8');
      if (!cursor.startsWith(from) || cursor >= to || cursor.length <= from.length) {
        throw new HttpError(400,'invalid_cursor','Reload the access request list.');
      }
    }
    const rows = await store.list(requests,[['reviewKey','>=',from],['reviewKey','<',to]],pageSize+1,{
      orderBy:['reviewKey','asc'], ...(cursor?{startAfter:cursor}:{}), includeId:true,
      select:['reviewKey','status','version','displayName','email','updatedAt']
    });
    const page = rows.slice(0,pageSize);
    return {
      items:page.map(({id, status, version, displayName, email, updatedAt})=>({uid:id,status,version,displayName,email,updatedAt})),
      nextCursor:rows.length>pageSize ? Buffer.from(page.at(-1).reviewKey,'utf8').toString('base64url') : null
    };
  }
  const target = /^\/access\/admin\/([A-Za-z0-9_-]{1,128})$/.exec(path)?.[1];
  if (target && method === 'POST') {
    const {decision,version} = body;
    if (target === uid || !['approved','rejected','revoked'].includes(decision) || !Number.isSafeInteger(version) || version < 1) {
      throw new HttpError(400,'invalid_decision','Choose a valid access decision.');
    }
    return store.transaction(async tx => {
      const [actor,grant,targetProfile] = await Promise.all([
        papersAuthority(tx,uid),tx.get(requestPath(target)),decision==='approved'?tx.get('users/'+target):null
      ]);
      if (actor.kind !== 'admin') throw reviewDenied();
      if (!managedPapersAccess(actor.config)) throw paused();
      if (grant?.status === decision && grant.version === version + 1 && grant.decisionBy === uid) {
        return {status:grant.status,version:grant.version};
      }
      if (targetProfile?.role === 'admin') throw new HttpError(409,'account_is_admin','This account already has administrator access.');
      const allowed = decision === 'revoked' ? grant?.status === 'approved' : grant?.status === 'pending';
      if (!allowed || grant.version !== version) throw new HttpError(409,'access_request_changed','Reload the latest access request.');
      const updatedAt = service.iso();
      tx.update(requestPath(target),{
        status:decision, version:version+1, updatedAt, decisionBy:uid,
        reviewKey:decision + '/' + updatedAt + '/' + target
      });
      tx.create(requestPath(target) + '/decisions/' + (version+1),{status:decision,actorUid:uid,at:updatedAt});
      return {status:decision,version:version+1};
    });
  }
  throw new HttpError(404,'not_found','Endpoint unavailable.');
}
