# Private pilot contract v1

Parent owns `assistant-service/domain/**` (runtime JSON validation, paper schemas,
renderer and shared TypeScript types). Backend owns the rest of assistant-service,
Firebase/deployment configuration. UI owns question-papers/**. Controller owns
tools/gtop-assistant/**. Do not commit/push from subagents.

Project gtop-app; private site gtop-question-papers.web.app; API function
`gtopAssistantGateway` in us-central1. All user requests carry Firebase ID bearer
token, checked against users/{uid}.role == admin AND assistantConfig/pilot's
allowedOwnerUids. No browser admin bypass, no OpenAI credentials in Firebase.
Worker identity is Firebase custom claim assistantWorker + workerId. Its bootstrap
secret SHA256 is stored server-only in assistantWorkers/{workerId}; plaintext stays
only on this Windows PC. POST /worker/session {workerId,secret} exchanges it for a
customToken. Existing runtime service account signs it; do not add IAM silently.

## User API

- GET /session => {user:{uid,displayName,email}, worker:{state,lastSeenAt,modelReady}, capabilities, defaults}
- GET /conversations => {conversations:[{id,title,status,updatedAt,activePaperJobId?,latestPaperId?}]}
- POST /conversations {clientRequestId?} => {conversation}
- GET /conversations/:id => {conversation,messages,jobs,papers}
- POST /conversations/:id/messages {text,clientMessageId} => {message,job}
- POST /jobs/:id/cancel {} => {job}; POST /jobs/:id/retry {} => {job}
- GET /papers/:id => {paper: PaperRevision}; GET /papers/:id/artifact/student|answers => private HTML
- POST /feedback {conversationId,messageId?,paperId?,rating:'helpful'|'needs_work',text?} => {saved:true}

Messages: {id,conversationId,role:'user'|'assistant'|'system',text,createdAt,jobId?,paperId?}.
Jobs: {id,kind:'turn'|'paper',ownerUid,conversationId,state,phase,createdAt,
updatedAt,startedAt?,elapsedSeconds?,error?,requestRevision?,paperId?}.
States: queued,running,validating,review_required,completed,needs_info,failed,cancelled.
Papers in conversation view are summaries: {id,title,revision,marks,createdAt,jobId}.
All dates serialized ISO8601. No backend-internal tokens/leases in user responses.
UI may poll own open conversation every 2s while pending, 15s while idle.

## Worker API

- POST /worker/heartbeat {state:'ready'|'loading'|'busy'|'offline',modelReady,version} => {ok:true}
- POST /worker/claim {kind:'turn'|'paper',waitSeconds?:20} => {job:null|WorkerJob}
  bounded outbound long-poll of worker inbox; claim atomic, leases 120s, renew every 30s.
- POST /worker/jobs/:id/heartbeat {leaseId,phase?} => {active:boolean}
- POST /worker/jobs/:id/event {leaseId,phase?,state?,reply?,metrics?} => {active:boolean}
- POST /worker/jobs/:id/delegate {leaseId,operation:'generate_paper'|'revise_paper',requirements,
  interpretation,proposedActions,basePaperId?,targetQuestionNumber?} => {job:WorkerJob}
  Creates paper job, copies original user/history, invalidates any older active paper job.
- POST /worker/jobs/:id/complete {leaseId,reply?,paper?:PaperRevision,metrics?,memoryPatch?} => {active:boolean,paperId?}
- POST /worker/jobs/:id/fail {leaseId,error,retryable?} => {active:boolean}

WorkerJob contains job fields plus leaseId, request:{id,text,sha256Utf8},
rootRequest:{id,text,sha256Utf8}, history:[message], profile:{}, context:{},
controllerFacts:{permissions,activePaperJob?,availableData}, requirements?,
interpretation?,proposedActions?,basePaper?,targetQuestionNumber?.
Server must reconstruct trusted handoff history from saved messages, never accept
model-written owner/permissions/original request. Worker can touch only assigned
owners/jobs, not general GTOP collections. Separate turn and paper claim loops allow
local conversation while a single Codex paper is in flight. No automatic retries of
expired in-flight paper generation; mark recoverable failure with explicit Retry.

## Paper domain

Parent will export `validateRequirements`, `validatePaper`, `validateRevision`,
`renderPaper(paper,answerKey=false)`, `paperSchema`, `revisionSchema`, `reviewSchema`,
`defaults`, `curriculum` from domain/index.mjs. validate* throws on invalid inputs.
`validatePaper` returns a serializable validation summary. PaperRevision:
{id?,title,board,standard,subject,academicYear,scope,marks,durationMinutes,
questionLanguage,answerLanguage,instructions:string[],sections:[{title,
instructions?,questions:[{number,chapter,type,marks,question,options:string[],
correctIndex:integer|null,answer,markingPoints:string[],alternative:null|
{question,options:string[],correctIndex:integer|null,answer,markingPoints:string[]}}]}],
sourceReferences:[{id,url,title}],revision?,parentPaperId?,createdAt?,jobId?,validation?}.
Questions have one optional whole-question OR alternative of identical marks.
Numbering continuous. Original authored material only for this slice: no fabricated
bank IDs, no new bank writes. Full syllabus means all 10 pinned Chemistry chapters.
Student HTML must contain no answer/marking points. Renderer escapes text and uses
KaTeX with trust:false; no raw HTML from models. New immutable artifact IDs.

Initial requirements fields: {board:'CBSE',standard:'12',subject:'Chemistry',
academicYear:'2026-27',scope:'full_syllabus',marks:80,durationMinutes:180,
questionLanguage:'English',answerLanguage:'English',sourcePolicy:'original',
internalChoices:true}. Preserve explicit language/marks corrections. Bank-only is
blocked: no live bank connector in this first pilot. Other board/class/subject is
needs_info (never silently substitute). Source and worker logs are private.
# Local service starter

The fixed `sachit-windows` starter supports **start only**. It cannot stop/restart arbitrary processes, execute browser commands, select a host/path, deploy, or resume the legacy scheduler. The small Windows initiator must already be running; the web app cannot wake a powered-off PC or a stopped initiator.

- GTOP `GET /session` includes `service` (or `null` for an account without the fixed worker pairing). GTOP `POST /service/start` takes `{clientRequestId}` and returns `{service}`. Existing admin, pilot invitation and worker owner checks apply.
- PTI `GET /host/status` returns `{service}`; `POST /host/start` takes `{clientRequestId}` and returns `{service}`. Only the fixed PTI owner UID is accepted. Firebase Admin verifies the PTI token's signature, expiry, audience and issuer through a named secondary app for `pti-app-2ab59`. PTI tokens are never accepted for GTOP conversations or other routes. PTI token revocation is not checked cross-project, so a revoked signed token can remain valid until its normal expiry; no cross-project IAM permission is added.
- `service` has `workerId`, `state` (`ready`, `offline`, `starting`, `failed`, `starter_offline`), `starter:{state,lastSeenAt}`, `worker:{state,lastSeenAt,modelReady}`, `request` and `canStart`. `request` is null or `{id,state,requestedAt,expiresAt,errorCode}`. Worker readiness requires its own heartbeat less than 90 seconds old; a launched child or starter observation never proves readiness. A ready worker can legitimately have `modelReady:false` while on-demand weights are unloaded.
- Authenticated fixed worker `POST /worker/service/poll` takes `{version,workerRunning,lastStartResult?:{requestId,state:'started'|'failed',errorCode?}}`. It reports initiator liveness and returns `{request:null|{id,action:'start',expiresAt},service}`. Pending requests are atomically claimed and the same claim is replayed until acknowledgement or its 120-second expiry. The initiator must persist the request ID before spawning and reuse its stored acknowledgement after any lost response. `started` means child launch only. Allowed failure codes: `start_failed`, `model_unavailable`, `port_in_use`, `configuration_invalid`, `worker_start_timeout`; raw paths, logs and credential errors are never returned.
- Different concurrent cross-app requests coalesce. Immutable server-owned receipt documents prevent delayed client retries from resurrecting a prior request. New attempts after failure need a new client request ID and a 30-second cooldown. Timeout reports failure rather than indefinitely promising startup.

Only server code accesses `assistantServiceControls/sachit-windows` and its `requests` receipts. Existing default-deny Firestore rules remain unchanged. Neither models nor direct client writes grant start authority. The initiator uses the existing scoped local worker identity and outbound HTTPS; no public PC/Ollama endpoint is introduced.
