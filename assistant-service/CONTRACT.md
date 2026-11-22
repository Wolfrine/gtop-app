# Private pilot contract v1

## Saved paper confirmation (controller and worker release together)

Clear complete initial requests retain direct delegation. An undelivered paper
request reaching three user turns, or a pending prerequisite research result,
uses Codex interpretation of the saved root and corrections to prepare one
concrete confirmation. Server-only conversation `paperProposal` stores the exact
requirements, curriculum snapshot, original/source message IDs and UTF-8 hashes,
interpretation, confirmation text, status and eventual generation job ID.

The message endpoint consumes a pending proposal transactionally only for an
unambiguous affirmative. It creates a `kind:paper`, `operation:generate_paper`
job directly, preserving the root and corrected requirements. Duplicate message
IDs and repeated affirmation reuse the same task. Ambiguous replies remain
pending; revisions supersede the proposal, and cancellation fences active work.
Role/owner, active slots, source evidence, leases and revision checks still apply.

Official syllabus coverage and exact sectional format are separate facts. Only
retrieved, independently reviewed syllabus candidates activate. Missing exact
format can produce an explicitly confirmed board-aligned practice proposal;
it never becomes an official board-issued paper or silently widens chapter scope.
Curriculum outcomes, including unavailable results, resume pending work toward
confirmation using the latest saved corrections. Identical scope/marks/format
research coalesces while active and is cached for 24 hours (last eight outcomes).
Research permits four official web actions and two minutes for discovery, then
two direct actions and two minutes for independent review; local evidence records
any enforced limit. A failed check is `curriculum_unavailable`, not checked success.

Selected chapters prefer exact titles, then one unique whole-word focus match
within the scoped curriculum. Ambiguous focus fails closed. Stored user evidence
keeps its original wording; queued paper requirements and question validation use
the matched canonical chapter titles.

Release this protocol with its matching worker. Follow the documented idle-cutover
precedent in `docs/ai-assistant/FIRESTORE_RUNTIME_RCA_2026-11-02.md`: stage and back
up the reviewed source, preserve unrelated dirty work, verify an empty active
queue and exact native PID/executable/start time, stop only the idle owned worker,
and restart through the existing native launcher with a scoped rollback ready.

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
- Session additionally includes `notifications:{schemaVersion:1,contentPath:'assistantUiNotifications/'+uid,presencePath:'assistantWorkerHealth/sachit-windows'|null,freshnessMs:90000}`.
- GET /service/status => {service}; invited user authorization and the existing sanitized service shape, without conversation/history reads.
- GET /conversations => {conversations:[{id,title,status,updatedAt,activePaperJobId?,latestPaperId?}]}
- GET /checking/work returns up to 20 of the signed-in teacher's most recently updated uploading, failed or review sheets. Each summary contains `id`, `paperId`, `label`, `state`, `updatedAt`, `pageCount`, `pending`, and optional `packetId` and `packetLabel`. Open the sheet with `?check=<paperId>&sheet=<id>`.
- POST /admin/library accepts `{kind:'papers'|'conversations', cursor?}` and returns `{items,nextCursor}`. Papers sort by creation time and conversations by update time, newest first. Pass the returned cursor unchanged. Saved raw-ID cursors finish their original traversal.
- POST /conversations {clientRequestId?} => {conversation}
- GET /conversations/:id => {conversation,messages,jobs,papers}
- GET /conversations/:id/revision => {updatedAt}; invited-admin equivalent under /admin/conversations/:id/revision.
- POST /conversations/:id/messages {text,clientMessageId} => {message,job}
- POST /jobs/:id/cancel {} => {job}; POST /jobs/:id/retry {} => {job}
- GET /papers/:id => {paper: PaperRevision}; GET /papers/:id/artifact/student|answers => private HTML
- POST /feedback {conversationId,messageId?,paperId?,rating:'helpful'|'needs_work',text?} => {saved:true}

Messages: {id,conversationId,role:'user'|'assistant'|'system',text,createdAt,jobId?,paperId?}.
Jobs: {id,kind:'turn'|'paper'|'curriculum',ownerUid,conversationId,state,phase,createdAt,
updatedAt,startedAt?,elapsedSeconds?,error?,errorCode?,requestRevision?,paperId?,progress?}.
Writing progress counts structurally validated drafts against the planned question count.
States: queued,running,validating,review_required,completed,needs_info,failed,cancelled.
Papers in conversation view are summaries: {id,title,revision,marks,createdAt,jobId}.
All dates serialized ISO8601. No backend-internal tokens/leases in user responses.
Visible UI subscribes only to its exact owner content marker and paired health
metadata. Meaningful content/job state/phase changes reconcile authoritative
gateway details; lease-only/elapsed/unchanged progress does not invalidate content.
Healthy connected idle views have no recurring history/list/session HTTP fetch.
Cached snapshots do not establish readiness. Hidden views, signout and account
changes detach streams/timers and fence stale asynchronous private responses.
Unavailable-stream fallback, cross-admin read-only views, service expiry/start
and active job lease expiry retain bounded HTTP reconciliation. Foreground return
reconnects; no partial model text or private payload is stored in a marker.

## Student-linked checking

The existing staff pilot authentication applies to each endpoint. Canonical student accounts are read from `users/{uid}`. Account selection uses a server-maintained name index and revalidates the live GTOP role and display name. The picker returns a bounded set with masked account hints.

- `GET /students/search?q=...&cursor=...` searches first name, surname or full-name prefixes of at least two characters. Returns `{students, hasMore, nextCursor}` with up to 12 accounts.
- `GET /students/:uid` returns `{student}` for a currently eligible account.
- Individual intake may include `studentUid`. The server resolves the display label and carries the identity from the answer book to its checked sheet.
- `POST /checking/student-history` accepts `{studentUid, cursor?}` and returns `{sheets, nextCursor}`, up to 40 lightweight records scoped to the requesting staff account. Open a record separately for pages, grading details and overlays.
- `POST /papers/:paperId/checking/:sheetId/student` accepts `{studentUid, version}` and returns the confirmed identity and current sheet version. Linking or correcting an account moves the history entry atomically.

## Worker API

- POST /worker/heartbeat {state:'ready'|'loading'|'busy'|'offline',modelReady,version} => {ok:true}
  Shape unchanged. The transaction authorizes against stable `assistantWorkers`
  then writes only `assistantWorkerHealth` telemetry. New worker cadence40s,
  freshness90s; legacy30s workers remain compatible. Job renewals remain30s.
- POST /worker/dispatch {} => {ownerUids}; paired worker subscribes to exact
  assistantDispatch/{ownerUid} documents with its existing Firebase identity.
  Marker fields are only schemaVersion, random revision and updatedAt. Enqueue,
  retry, delegation and curriculum continuation update the marker atomically.
  Health, lease and progress writes never update it. Initial server snapshots and
  reconnects drain both lanes; repeated revisions coalesce. Unready listeners
  suspend admission, while existing leases continue to renew. Bearer refresh is
  deliberate (50 minutes), terminal errors back off, and SDK network reconnects
  do not recreate listeners. No prompts or job payloads are directly readable.
- POST /worker/claim {kind:'turn'|'paper',waitSeconds?:20} => {job:null|WorkerJob}
  bounded outbound long-poll of worker inbox; claim atomic, leases 120s, renew every 30s.
- POST /worker/jobs/:id/heartbeat {leaseId,phase?} => {active:boolean,leaseUntil?}
- POST /worker/jobs/:id/event {leaseId,phase?,state?,reply?,metrics?,progress?:{completed,total}} => {active:boolean}
- POST /worker/jobs/:id/delegate {leaseId,operation:'generate_paper'|'revise_paper',requirements,
  interpretation,proposedActions,basePaperId?,targetQuestionNumber?,ackOnly?} => {job:WorkerJob|Job}
  Creates paper job, copies original user/history, invalidates any older active paper job.
- POST /worker/jobs/:id/complete {leaseId,reply?,paper?:PaperRevision,metrics?,memoryPatch?,receiptOnly?} => {active:boolean,paperId?}
  For paper delivery, a matching worker and exact lease/request receipt can recover the same paper ID after a lost response. A receipt-only replay cannot publish.
- POST /worker/jobs/:id/fail {leaseId,error,errorCode?,retryable?} => {active:boolean}

WorkerJob contains job fields plus leaseId, leaseUntil, request:{id,text,sha256Utf8},
rootRequest:{id,text,sha256Utf8}, history:[message], profile:{}, context:{},
controllerFacts:{permissions,activePaperJob?,availableData}, requirements?,
interpretation?,proposedActions?,basePaper?,targetQuestionNumber?.
Server must reconstruct trusted handoff history from saved messages, never accept
model-written owner/permissions/original request. Worker can touch only assigned
owners/jobs, not general GTOP collections. Separate turn and paper claim loops allow
local conversation while a single Codex paper is in flight. No automatic retries of
expired in-flight paper generation; mark recoverable failure with explicit Retry.
A server-only, short-lived paired-worker claimsPausedUntil prevents new claims
during a planned restart. Existing heartbeats, leases and completion continue.

New papers lock question number, chapter, marks and type in a controller-derived
allocation. Codex writes and reviews bounded groups with a 15-minute limit per attempt. The worker retains admitted drafts and review results under the private H runtime, bound to the owner, request revision and
curriculum snapshot. A retry revalidates the checkpoint and continues with the
remaining groups. The gateway validates the assembled paper and commits the two
printable copies with the immutable paper in one transaction.

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

The generic practice defaults are {board:'CBSE',standard:'12',subject:'Chemistry',
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
