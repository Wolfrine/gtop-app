# GT Papers idle reads and request-scoped Qwen retention

Owner-authorized implementation, single agent, active checkout `F:/Workspace/Programs/Growth-Tutorials/gtop-assistant`, main, no PR. References: development chat `01a19b1f-687a-72a1-aee2-26c337c5db74`, inspection `01a196ff-e562-7733-974d-674823c802da`, and `F:/Workspace/Codex/2026-11-02/local-codex-listeners/outputs/DELIVERY.md`. PTI references were read only. This is engineering evidence, not teacher/device acceptance or a billing guarantee.

## Evidence before changes

At 09:19:30–09:29:25 UTC, Cloud Run request logs for `gtopassistantgateway` contained 195 successful `/worker/claim` calls, 31 `/worker/service/poll`, 19 `/worker/heartbeat` and one `/worker/session`. There were no frontend session/history calls in that sample. The raw bounded sample is `F:/Workspace/Codex/2026-11-02/gtop-optimization/outputs/gateway-before.json`. This measures requests, not billed document operations. It confirms a continuously active backend consumer even without foreground user traffic.

Each empty claim performs one `assistantWorkers` lookup in gateway authentication and one `assistantJobs` query. Empty queries have a one-read minimum. 195 calls / 595 seconds extrapolates to about **56,600 reads/day** at the observed rate. The old two lanes each wait five seconds *after* the request finishes: zero-latency theoretical cadence is 34,560 calls / **69,120 reads/day**; real network latency lowers that cadence. This is a proven sufficient source for the reported 50k/day scale, not an attribution of every Firebase read to GTOP polling.

| Component | Source path and idle cost before | Remaining/new behavior |
| --- | --- | --- |
| Local worker dispatch | `worker.ts` two five-second loops; two reads minimum per empty claim | Assigned-owner exact-document listeners; initial/revision/reconnect drains only; no periodic queue query |
| Worker health | Gateway worker lookup plus transactional worker lookup, one worker write every 30s: 5,760 reads / 2,880 writes per theoretical day | Retained for liveness; separate from dispatch, active job renewal and model residency |
| PTI starter → GTOP mailbox | Existing 15s starter loop; gateway worker lookup plus worker/control transaction: 17,280 reads / 5,760 writes per theoretical day | Retained unchanged. Actual cadence includes native process checks and HTTP time; sample had 31 calls in 595s. PTI/One Piece initiator untouched |
| GT Papers visible UI | Full refresh every 15s idle / 2s pending; session + conversation list + messages/jobs/papers including expiry scan | Idle 60s; one revision lookup before history; pending detail cadence retained, overview limited to 30s; hidden tabs already stop polling |
| Legacy core app | `PaperChatRepository` watches `paperConversations`, `paperMessages`, `paperRequests`, `paperDrafts`, `paperNotifications`; `FirestoreReadService` shares identical listeners, closes unused entries after 15s | No fixed five-second poll found in these paths. Initial result reads, changes, rule dependencies and reconnects remain. No live per-client attribution or legacy scheduler inventory established |
| Curriculum and request processing | Catalogue up to 5,001 syllabus documents per gateway cache fill; scoped curriculum reads, saved history, ownership/lease validation | On-demand costs retained. Catalogue has six-hour gateway and one-hour worker caches; no idle catalogue queries |

For an owned conversation, let W/C/J/M/P be returned worker/conversation/job/message/paper counts, each query count floored at one. An old full refresh costs approximately `10 + W + C + 2J + M + P`, plus reads for active expiry checks and transaction retries. Even the minimum is 16 reads: **92,160/day** for one continuously visible idle tab. New unchanged idle refresh is `9 + W + C` per 60s, minimum **15,840/day**. These are code-derived continuous-tab scenarios, not measured user usage. Active historical lists remain bounded (250 messages, 100 jobs/papers); frequent pending detail reads remain a disclosed cost.

Local Cloud Monitoring inspection could not obtain Application Default Credentials; it returned unavailable, not zero usage. The release pipeline attempts the same read-only aggregate metrics using its existing identity, without adding IAM. Metrics can lag, aggregate all clients and do not alone identify a collection/consumer. A short quiet interval cannot prove daily billed savings.

Billing semantics: [Firestore pricing](https://firebase.google.com/docs/firestore/pricing). Listeners still incur initial/update/reconnect reads, and rules that read pairing/profile/configuration documents have dependent reads. The worker pairing document changes with health; dependent-rule reevaluation may therefore remain a recurring read cost. No zero-read claim is made.

## Dispatch and security change

`assistantDispatch/{ownerUid}` contains only `schemaVersion:1`, random revision and timestamp. Submit, retry, delegation and automatic curriculum continuation write it in the same transaction as enqueue. Idempotent replays, health, leases and progress do not write it. Existing jobs require no migration: the initial server snapshot drains both lanes, even when the marker does not yet exist.

The existing Firebase worker identity can get only markers for assigned owners while its pairing remains enabled. An invited admin can get only their own marker. Anonymous/other-owner/unpaired worker access, collection queries, client writes and direct payload access remain denied. Shared-rule deployment removes only the exact reviewed grant when comparing against the prior policy; unrelated live drift still blocks release.

Each lane serially drains after a wake; a wake received during a job is retained. Revisions coalesce. Cached-only/disconnected listeners suspend admission. Existing leases continue independently, with one non-overlapping 30s renewal timer; duplicate Codex progress renewal timers were removed. SDK reconnects retain SDK backoff. Terminal listener failures back off with jitter to 60s; the bearer/session refresh is deliberate at 50 minutes, never every health tick. `transport.json` records safe local counters. An atomic main-process `worker.lock` supplements native role mutexes. A crash leaves a refusal requiring PID/native-ownership verification before stale-lock removal.

A hosted SSE alternative would keep billable gateway requests alive and reconnect at the function's timeout, while still needing server-side subscriptions and authorization. REST long polling already repeatedly queries the queue. The direct exact-marker listener uses the existing Firebase identity, keeps prompts/payloads behind the gateway, and is the smaller fit. The frontend retains bounded HTTP polling rather than introducing streaming or token writes.

## Qwen regression and storage

Commit `056aa777132ca21c24c40eaf9541c1c3d86c1227` changed the active tool loop from `keep_alive:30` to zero. Saved real runtime turn `turn-6ea74…` took 83.603s, including 77.101s load across three calls; `turn-74e12…` took 101.496s including 88.109s load across three calls. Those non-thinking calls repeatedly paid about 25–30s to load. The dedicated Ollama log reports full 33-layer GPU offload; this is not evidence of CPU-only inference.

The loop now retains Qwen for at most 60 seconds *between calls in the same turn*, then explicitly unloads immediately in `finally`, including invalid-output/error/cancellation. No follow-up grace, startup warm-up, idle GPU retention, model/provider switch or paid API was added. A process crash has the short Ollama fallback expiry. `local-runs.json`/final metrics add prompt/generation milliseconds alongside existing load counts; `queue-timing.json` records queue wait locally. Final messages remain single persisted outputs.

Windows reports the existing model root `H:/GTOP-Local-AI/models/ollama` on disk 0, **WDC WD10EZEX-08WN4A0, SATA HDD**, approximately 1TB. This is a plausible contributor to uncached model loading, not proof of the exact delay or its increase over earlier warm/cold records. No heavy disk benchmark, weights copy, SSD migration, cache flush or unrelated GPU process manipulation was performed. Port 11435 and its owned Ollama dispatcher remain distinct from the SEFPO tray on 11434. The immutable PTI runner-v1 document still describes the old per-call-zero policy; this GTOP request explicitly authorizes request-scoped retention.

## Verification and delivery status

Local worker suite initially passed 93/93, gateway/domain 60/60, frontend 24/24 and production build. Four actual Auth/Firestore/functions/database integration checks passed, including the new marker access rules and concurrent atomic claims. The first cold Functions emulator discovery timed out at 10s; the unchanged retry passed with local `FUNCTIONS_DISCOVERY_TIMEOUT=60`. No model inference or paper generation was used by these checks; deterministic unit/emulator fixtures are synthetic.

Rendered desktop/mobile inspection could not be completed: browser host unavailable; native Chrome had no usable input geometry and screenshot capture timed out. Frontend changes affect polling behavior and do not change templates/styles, but authenticated browser/visual acceptance remains open.

Release CI, actual idle cutover, one explicit non-paper dispatch acceptance, quiet counters and available metric outcomes are appended in the delivery record. Before cutover, preserve all queued/active jobs and verify both cloud state and exact native process ownership. The pre-existing uncommitted `scripts/verify-installed-runner.ts` change is excluded from delivery.
