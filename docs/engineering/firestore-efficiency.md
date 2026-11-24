# Firestore access and read budgets

## Access standard

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
| GTOP v1 | `gtop-app/firebase.json` | Auth 9099, Firestore 8080, Realtime Database 9000 |
| GTOP v2 | `gtop-v2/firebase.json` | Auth 9099, Firestore 8080, Realtime Database 9000 |
| GT Papers | `firebase.assistant.json` at repository root | Auth 9299, Firestore 8280, Realtime Database 9380, Functions 5201 |

From the configuration's directory, run `firebase-owner.cmd emulators:start --project demo-gtop-assistant --config <config-path> --only <services>` and serve the corresponding Angular app. A production bundle opened on localhost still uses emulators. Existing hosted preview tabs can continue running the previously loaded code until the updated application loads. Review served versions when closing an environment cutover.

For GTOP v1 and v2 Firestore work, select `auth,firestore,database`. The legacy v1 Paper Chat Functions configuration still has a production diagram bucket and remote push/asset endpoints. Leave that Functions emulator stopped for isolated development until its Storage and outbound routes have been isolated. For GT Papers gateway work, run the Papers suite locally on port 4317. The gateway allows that local origin. Hosted previews can render the app shell, and authenticated work belongs on localhost.

## 23–24 November RCA

Native RCA `01a20bfd-c421-7b42-bd8e-a4da545de018` measured 69,689 reads on 23 November IST, including 57,185 query reads. Direct SDK queries and listener reloads fit the timing and operation mix. The existing 1,381-document eager syllabus listener predates Lumen and remained after its release. One logged worker catalogue miss overlapped a 1,451-query-read minute that also included other requests. The exact SDK caller and collection remain unverified. The baseline is a project Monitoring observation. It does not establish billed reads or what a single request cost.

## GTOP read budgets

| Workflow | Previous behavior | Current code budget |
| --- | --- | --- |
| Sign-in, Progress and learner live-room entry | The shared dependency started an unfiltered syllabus listener once authenticated | Zero syllabus results until a workflow requests curriculum |
| Open curriculum in Practice | Initial unfiltered listener, measured at 1,381 documents in the RCA | One shared board/class query. Subsequent consumers reuse the active target. The 24 November read-only aggregate returned 285 CBSE Class 10 documents with the string class value. The scoped query also supports numeric class records and Cambridge aliases. |
| Select board or class | Derive options from the full listener | Cursor over distinct indexed values, one document per raw value and one terminal empty query. A selected-board existence probe returns up to one document per candidate class. Options are reused briefly per signed-in user. |
| Quick quiz | Load eligible questions for one random eligible chapter before sampling | Keep the complete chapter pool and Firebase offline cache. Coalesce overlapping identical app requests and decode the chosen documents. By authorized aggregate, CBSE Class 12 Chemistry Solutions had 454 matching questions. |
| Custom quiz | Read eligible matches within the requested subjects and chapters | Same eligibility and random draw. A broad CBSE Class 10 aggregate returned 32,289 questions across the class and illustrates the upper cost risk of multi-subject selection. A total read cap requires a verified sampler or index with full eligibility and offline compatibility. |

Explicit admin catalogue management, deliberate all-curriculum search, and the legacy all-scope quiz action can still load the catalogue. Their consumers own the read. Academic totals continue to come from their canonical sources.

The figures above include live aggregate observations and code budgets. Capture actual initial and reconnect counts from the `[firestore-read]` console events for the same origin, release and workflow before attributing usage savings. A reconnect may reuse the existing target or be billed as a new query depending on connection duration and Firestore persistence.
