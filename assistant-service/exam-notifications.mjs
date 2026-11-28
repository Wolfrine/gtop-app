import {createECDH, createHash} from 'node:crypto';
import {HttpError} from './service.mjs';
import {hasSubmissionOwner, staffSubmissionStates, submissionPath} from './student-submission-storage.mjs';

const collection = 'paperNotifications';
const schema = 'gt-papers-exam-update';
const schemaVersion = 1;
const sharedStream = 'staff';
const sharedMarker = 'assistantExamUpdateMarkers/staff';
const privateMarker = uid => sharedMarker + '/owners/' + uid;
const ownerStream = uid => 'staff:' + uid;
const labels = Object.freeze({
  'submission-awaiting': 'Submission awaiting review',
  'submission-replacement': 'Replacement scan received',
  'result-complete': 'Complete result released',
  'result-partial': 'Partial result released',
  'result-unassessable': 'Unassessable result released',
  'paper-created': 'Question paper created',
  'operational-failure': 'Work needs attention'
});
const knownKind = kind => Object.hasOwn(labels, kind);
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
const membershipConfig = 'assistantConfig/pilot';
const devicesPath = uid => 'paperPushSubscriptions/' + uid + '/examDevices';
const endpointPath = hash => 'paperExamPushEndpoints/' + hash;
const pageSize = 20;
const checkpointPath = uid => 'assistantExamUpdateCheckpoints/' + uid;
const validSortKey = value => typeof value === 'string' && iso(value.slice(0,24)) && value[24] === ':' && validHash(value.slice(25));

export function enqueueExamUpdate(tx, {kind, entityId, version, at, ownerUid, conversationId, scope}) {
  const identity = String(version ?? '');
  const target = scope ?? (kind === 'operational-failure' ? null : kind === 'paper-created' ? 'paper' : 'submission');
  const privateTarget = ownerUid !== undefined && ownerUid !== null;
  if (!knownKind(kind) || !safeId(entityId) || !safeId(identity) || !iso(at) ||
      (privateTarget && !safeId(ownerUid)) ||
      (target === 'submission' ? kind === 'paper-created' || Boolean(conversationId) :
        !privateTarget || !safeId(conversationId) || !['paper','job'].includes(target) ||
        (kind !== 'operational-failure' && (kind !== 'paper-created' || target !== 'paper')))) {
    throw Error('Invalid GT Papers update event');
  }
  const id = digest([schema, schemaVersion, target, kind, entityId, identity].join('/'));
  const examStream = privateTarget ? ownerStream(ownerUid) : sharedStream;
  // The source transition, its event, and the tiny feed revision commit together.
  tx.create(collection + '/' + id, {
    schema, schemaVersion, examStream, examSortKey: at + ':' + id,
    kind, scope: target, entityId, entityVersion: identity, createdAt: at,
    ...(privateTarget ? {recipientUid: ownerUid} : {}),
    ...(conversationId ? {targetConversationId: conversationId} : {})
  });
  tx.set(privateTarget ? privateMarker(ownerUid) : sharedMarker, {schemaVersion, revision: id});
  return id;
}

function visible(event, uid) {
  if (event?.schema !== schema || event.schemaVersion !== schemaVersion || !knownKind(event.kind)) return false;
  return event.examStream === sharedStream
    ? event.scope === 'submission' && !event.recipientUid
    : event.examStream === ownerStream(uid) && event.recipientUid === uid &&
      ['submission','paper','job'].includes(event.scope);
}
function notFound() {throw new HttpError(404, 'update_unavailable', 'This update is unavailable.');}

async function listUpdates(store, uid, cursor) {
  if (cursor && !validSortKey(cursor)) {
    throw new HttpError(400, 'invalid_cursor', 'Updates could not be loaded from this point.');
  }
  const [rows, checkpoint] = await Promise.all([store.list(collection, [['examStream','in',[sharedStream,ownerStream(uid)]]], pageSize + 1, {
    orderBy: ['examSortKey','desc'], ...(cursor ? {startAfter:cursor} : {}), includeId:true,
    select:['schema','schemaVersion','examStream','examSortKey','recipientUid','scope','kind','createdAt']
  }), store.get(checkpointPath(uid))]);
  const readThrough = checkpoint?.readThrough || '';
  const items = rows.slice(0, pageSize).filter(row => visible(row, uid))
    .map(({id,kind,createdAt,examSortKey}) => ({id,kind,label:labels[kind],createdAt,sortKey:examSortKey}));
  return {items, readThrough, nextCursor:rows.length > pageSize ? rows[pageSize - 1].examSortKey : null};
}

async function markUpdatesRead(service, uid, through) {
  if (!validSortKey(through)) throw new HttpError(400, 'invalid_checkpoint', 'Refresh Updates before marking them read.');
  return service.store.transaction(async tx => {
    await verifyStaffTransaction(tx, uid);
    const path = checkpointPath(uid), current = await tx.get(path);
    if (current?.readThrough >= through) return {readThrough:current.readThrough};
    const event = await tx.get(collection + '/' + through.slice(25));
    if (!visible(event, uid) || event.examSortKey !== through) notFound();
    tx.set(path,{schemaVersion,readThrough:through,updatedAt:service.iso()});
    return {readThrough:through};
  });
}

async function resolveUpdate(store, uid, id) {
  if (!validHash(id)) notFound();
  const row = await store.get(collection + '/' + id);
  if (!visible(row, uid) || !safeId(row.entityId)) notFound();
  if (row.scope === 'submission') {
    const [submission] = await store.getSelected([submissionPath(row.entityId)], ['ownerUid','status','teacherUpload']);
    if (!hasSubmissionOwner(submission) || !staffSubmissionStates.includes(submission.status) ||
        (row.recipientUid ? submission.ownerUid !== uid : submission.teacherUpload === true)) notFound();
    return {target:{kind:'submission',submissionId:row.entityId}};
  }
  const conversationId = row.targetConversationId;
  if (!safeId(conversationId)) notFound();
  const source = (row.scope === 'paper' ? 'assistantPapers/' : 'assistantJobs/') + row.entityId;
  const [entity, conversation] = await store.getSelected(
    [source,'assistantConversations/' + conversationId], ['ownerUid','conversationId']
  );
  if (entity?.ownerUid !== uid || entity.conversationId !== conversationId || conversation?.ownerUid !== uid) notFound();
  return {target:{kind:'conversation',conversationId,...(row.scope === 'paper' ? {paperId:row.entityId} : {})}};
}

const base64url = (value, length) => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value)
  && value.length === Math.ceil(length * 4 / 3) && Buffer.from(value, 'base64url').length === length;
function existingPublicKey(keys) {
  if (!base64url(keys?.publicKey, 65) || !base64url(keys?.privateKey, 32)) return null;
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(keys.privateKey, 'base64url'));
    return ecdh.getPublicKey().equals(Buffer.from(keys.publicKey, 'base64url')) ? keys.publicKey : null;
  } catch {return null;}
}
async function pushKey(store) {
  if (process.env.PAPERS_EXAM_WEB_PUSH_ENABLED !== 'true' || process.env.FUNCTIONS_EMULATOR === 'true') return null;
  // This reads the existing configuration server-side, with no bootstrap or key creation.
  return existingPublicKey(await store.get('paperBackendSecrets/webPush'));
}
function validateSubscription(input) {
  let url;
  try {if (typeof input?.endpoint === 'string' && input.endpoint.length <= 2048) url = new URL(input.endpoint);}
  catch { /* Return the same error for every malformed endpoint. */ }
  const hosts = ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','push.services.mozilla.com'];
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
      !hosts.some(host => url.hostname === host || (host === 'web.push.apple.com' && url.hostname.endsWith('.' + host))) ||
      !base64url(input?.keys?.p256dh, 65) || !base64url(input?.keys?.auth, 16)) {
    throw new HttpError(400, 'invalid_subscription', 'This browser push subscription is unsupported.');
  }
  return {endpoint:url.href,keys:{p256dh:input.keys.p256dh,auth:input.keys.auth}};
}
async function verifyStaffTransaction(tx, uid) {
  const [pilot, profile] = await tx.getSelected([membershipConfig, 'users/' + uid], ['allowedOwnerUids','role']);
  if (profile?.role !== 'admin' || !Array.isArray(pilot?.allowedOwnerUids) || !pilot.allowedOwnerUids.includes(uid)) {
    throw new HttpError(403, 'pilot_access_required', 'Your staff access has changed.');
  }
}
async function pushConfig(store, uid, endpointHash) {
  const publicKey = await pushKey(store);
  if (!validHash(endpointHash)) return {available:!!publicKey,...(publicKey ? {publicKey} : {}),subscribed:false};
  const [endpoint, device] = await store.getSelected(
    [endpointPath(endpointHash),devicesPath(uid) + '/' + endpointHash], ['ownerUid','publicKey']
  );
  return {
    available:!!publicKey,...(publicKey ? {publicKey} : {}),
    subscribed:endpoint?.ownerUid === uid && device?.ownerUid === uid
  };
}
async function setPush(service, uid, body) {
  const {store} = service;
  if (body.action === 'unsubscribe' && validHash(body.endpointHash)) {
    const id = body.endpointHash;
    await store.transaction(async tx => {
      await verifyStaffTransaction(tx, uid);
      const mapping = await tx.get(endpointPath(id));
      if (mapping?.ownerUid !== uid) return;
      tx.delete(endpointPath(id));
      tx.delete(devicesPath(uid) + '/' + id);
    });
    return {subscribed:false};
  }
  if (body.action !== 'subscribe') throw new HttpError(400, 'invalid_push_action', 'Choose a device notification action.');
  const publicKey = await pushKey(store);
  if (!publicKey) throw new HttpError(409, 'push_unavailable', 'Device notifications are unavailable.');
  const subscription = validateSubscription(body.subscription);
  if (body.publicKey !== publicKey) throw new HttpError(409, 'push_key_changed', 'Refresh Updates and reconnect this device.');
  const id = digest(subscription.endpoint), path = devicesPath(uid) + '/' + id;
  await store.transaction(async tx => {
    await verifyStaffTransaction(tx, uid);
    const [mapping, existing] = await Promise.all([tx.get(endpointPath(id)),tx.get(path)]);
    if (mapping?.ownerUid === uid && existing?.publicKey === publicKey &&
        existing.keys?.auth === subscription.keys.auth && existing.keys?.p256dh === subscription.keys.p256dh) return;
    if (safeId(mapping?.ownerUid) && mapping.ownerUid !== uid) tx.delete(devicesPath(mapping.ownerUid) + '/' + id);
    tx.set(path,{...subscription,ownerUid:uid,publicKey,updatedAt:service.iso()});
    if (mapping?.ownerUid !== uid) tx.set(endpointPath(id),{ownerUid:uid});
  });
  return {subscribed:true};
}

export async function examUpdatesRoute(service, user, method, path, query, body) {
  const {store} = service, {uid} = user;
  if (method === 'GET' && path === '/exam-updates') return listUpdates(store, uid, query.get('cursor'));
  if (method === 'POST' && path === '/exam-updates/read') return markUpdatesRead(service, uid, body.through);
  if (path === '/exam-updates/push') {
    if (method === 'GET') return pushConfig(store, uid, query.get('endpointHash'));
    if (method === 'POST') return setPush(service, uid, body);
  }
  const id = method === 'GET' && /^\/exam-updates\/([^/]+)$/.exec(path)?.[1];
  if (id) return resolveUpdate(store, uid, id);
  notFound();
}
