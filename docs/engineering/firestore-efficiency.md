# Firestore access and read budgets

## Access standard

- Prohibit fixed-interval remote polling by default, eager full reads, and no-op writes. Prefer shared, scoped AngularFire cache and listeners, or an event-driven one-shot request. Require an explicit, measured exception for existing lease renewal and authorization revalidation without an authorized event source.
- Verify document reads, scanned index entries, billable index entries, and writes before and after. Count query minimums, index-entry batches, rule-dependent reads, retries, and any cache-maintenance writes. Report explain output and code budgets independently of project-wide billing.
- Attach a data query at its consumer. Resolve the authenticated identity and academic scope before opening a listener. Share identical live queries for concurrent consumers and release them when idle. A profile, progress page, or sign-in should not implicitly open a syllabus catalogue.
- Use the existing AngularFire Firestore persistent multi-tab cache for reusable GTOP documents and offline practice. Treat an empty cache as incomplete until the server answers. Keep private gateway data in account-scoped memory and clear it when the identity changes.
- Prefer bounded server queries, stable cursors, and lazy pagination. Retain the authoritative question scope and selection rules. A cap on returned rows must not present missing results as an empty scope or silently remove eligible questions from random selection.
- Keep authoritative records and role checks in their existing paths. Protect caches and invalidation with identity, scope, and freshness. Keep older contracts available while updated clients roll out.
- Log query shape, mode, origin, and counts at the first cache and server result and at an observable reconnect. For gateway work use the existing service logs. Include release attribution from the served build or Cloud Run revision. Omit identities, academic content, paths containing IDs, and per-event database writes. Document result counts, index-entry charges and project Monitoring observations independently.

## Development and deployment

Production browser origins are listed in each app's Firebase configuration. Localhost, GTOP development Hosting, and GTOP v2 UAT use loopback emulators in `demo-gtop-assistant`. They never fall back to production. GT Papers uses the same rule for local development and non-production preview origins. Use localhost for authenticated rehearsal if the browser restricts loopback access from a hosted origin.

Start the suites from a fresh shell with the explicit demo project. Use the existing emulator configuration and existing authorized local data. Keep emulator exports, logs, build output and cache on H:.

| App | Configuration | Local ports |
| --- | --- | --- |
| GTOP v1 | `gtop-app/firebase.local.json` | Auth 9099, Firestore 8080, Realtime Database 9000, Functions 5001, Storage 9199 |
| GTOP v2 | `gtop-v2/firebase.json` | Auth 9099, Firestore 8080, Realtime Database 9000 |
| GT Papers | `firebase.assistant.json` at repository root | Auth 9299, Firestore 8280, Realtime Database 9380, Functions 5201 |

From the configuration's directory, run `firebase-owner.cmd emulators:start --project demo-gtop-assistant --config <config-path> --only <services>` and serve the corresponding Angular app. A production bundle opened on localhost still uses emulators. Existing hosted preview tabs can continue running the previously loaded code until the updated application loads. Review served versions when closing an environment cutover.

For GTOP v1 and v2 Firestore work, select `auth,firestore,database`. For v1 legacy Paper Chat, add `functions,storage`, serve GTOP on `http://127.0.0.1:4300`, and run with the demo project. The demo Functions refuse non-loopback backend settings, use the demo Storage bucket and local fonts, and disable device push. In-app notifications still use the demo Firestore. For GT Papers gateway work, run the Papers suite locally on port 4317. Hosted previews render the app shell and authenticated work belongs on localhost.

## 23–24 November RCA

Native RCA `01a20bfd-c421-7b42-bd8e-a4da545de018` measured 69,689 reads on 23 November IST, including 57,185 query reads. Direct SDK queries and listener reloads fit the timing and operation mix. The existing 1,381-document eager syllabus listener predates Lumen and remained after its release. One logged worker catalogue miss overlapped a 1,451-query-read minute that also included other requests. The exact SDK caller and collection remain unverified. The baseline is a project Monitoring observation. It does not establish billed reads or what a single request cost.

## GTOP read budgets

| Workflow | Previous behavior | Current code budget |
| --- | --- | --- |
| Sign-in, Progress and learner live-room entry | The shared dependency started an unfiltered syllabus listener once authenticated | Zero syllabus results until a workflow requests curriculum |
| Open curriculum in Practice | Initial unfiltered listener, measured at 1,381 documents in the RCA | One shared board/class query. Subsequent consumers reuse the active target. The 24 November read-only aggregate returned 285 CBSE Class 10 documents with the string class value. The scoped query also supports numeric class records and Cambridge aliases. |
| Select board or class | Derive options from the full listener | Cursor over distinct indexed values, one document per raw value and one terminal empty query. A selected-board existence probe returns up to one document per candidate class. Options are reused briefly per signed-in user. |
| Quick quiz | Read all questions in one randomly selected eligible chapter | Cold and offline use the complete SDK scope. Eligible repeat launches use bounded aggregate counts and a uniform rank draw on a single Firestore read time. |
| Custom quiz | Read eligible matches within the requested subjects and chapters | Use disjoint query blocks. The warm sampler admits the entire eligible scope before drawing. Large or unsupported scopes retain complete SDK reads. |

Explicit admin catalogue management, deliberate all-curriculum search, and the legacy all-scope quiz action can still load the catalogue. Their consumers own the read. Academic totals continue to come from their canonical sources.

The figures above include live aggregate observations and code budgets. Capture actual initial and reconnect counts from the `[firestore-read]` console events for the same origin, release and workflow before attributing usage savings. A reconnect may reuse the existing target or be billed as a new query depending on connection duration and Firestore persistence.

The quiz sampler keeps at most 64 ranges and accepts up to 24 questions, with a 768-read admission budget including selected-document hydration. Open range ends and contiguous intervals keep legacy IDs eligible. Counts and payloads share one server read time. If admission fails, the full SDK query runs before any rank is drawn. A sampling transport error after the draw requests a retry instead of replacing the draw. Warm boundaries expire after five minutes. Offline retains the most recent complete SDK pool and any selected documents refreshed since then. Cold loads and over-budget scopes still pay for a complete scoped read. A scoped production explain for CBSE Class 12 Chemistry Solutions scanned 309 index entries for a count of five matches and billed one read operation. An eight-document limit on the same range returned five documents, scanned 135 index entries, and billed five reads. These are sampled range measurements and do not represent every quiz.

An isolated demo Firestore exercise used the sampler and Firebase SDK 10.14.1. The cold query returned 322 eligible questions. One warm draw returned 10 distinct questions after 30 aggregate requests, 61 question result rows and 10 successful cache refresh reads. It wrote zero documents. With Firestore networking disabled, the SDK's LRU cache returned the same 322 IDs, including two legacy IDs. This exercise used an in-memory LRU cache and measured request and result counts. The browser uses persistent multi-tab caching.

## GT Papers history verification

The 24 November read-only service comparison used one authorized owner's eight saved requests and a completed thread. The legacy thread returned 12 messages, two papers and 10 job records in three queries returning 24 rows, plus four point lookups. Once the exact composite indexes reached `READY`, the current initial thread returned 12 messages and two papers in two queries, plus three job point lookups in the service. An unchanged status request for that same thread made two job point lookups, zero message or paper queries, and zero writes in the service. Gateway authentication and conversation lookups are outside these service counts.

Production Query Explain reported eight billed document reads for the owner's request list, 12 for the thread's messages, and two for its papers. Each query scanned the same number of index entries as rows returned and reported zero billable index entries. Firestore Admin confirmed the exact ready composites for `assistantConversations` (`CICAgLjy8IAK`), `assistantPapers` (`CICAgLiIkYMK`) and syllabus scope and chapter (`CICAgJil0IYK`).

Owner history pages cap initial request, message and paper queries at 31, 41 and 13 results respectively, including one lookahead. Job status uses scoped point reads. A visible shared thread retains one status-only authorization and freshness check per minute because the viewer cannot subscribe to the author's private notification. Owner reconnects and lease checks use notification changes and actual deadlines. Unchanged request history has zero writes. A lease that really expires can still transition once.

The shared catalogue stores a content version and freshness deadline. A process hit reads zero documents and a fresh hit on another instance reads one. A single lease holder refreshes on demand using the syllabus compound index, with at most 384 distinct-scope probes and one count per eligible subject. It preserves the existing full outline shape without reading every chapter document. Lease and publication take two writes per successful refresh. An unchanged version updates only freshness and lease metadata. A scoped production explain found one billed document read and two scanned entries for the first subject probe, and one billed read operation across 18 billable index entries for the Chemistry count.

The isolated worker catalogue exercise built a version from a three-row syllabus and returned the same outline on a process hit and an independent process hit. The cold refresh recorded nine point and minimum reads and two count queries. The warm paths measured zero and one document reads respectively. The isolated legacy release exercise uploaded and served a diagram through emulator Storage, published the paper with local assets, and wrote an in-app notification. Its device push request was rejected with HTTP 409.
