# Question module operations

## Admin journey
- `/admin/question-papers`: active paper requests, next actions, cancellation, saved snapshots and older-page loading.
- `/admin/question-paper-generator`: format → syllabus/sections → exact approved coverage → preview, answer key and print/PDF. `requestId` resumes pinned curriculum/rules; `draftId` opens the original snapshot. A complete saved request becomes completed.
- `/admin/question-library`: independent board/class/subject/chapter navigation, objective and written/paper banks, manual written creation, edits, archive and pagination. Search explicitly applies to loaded questions. Admin-authored written answers stay outside the learner MCQ collection.
- `/admin/question-review`: pending review, corrections, bounded bulk approval/rejection and request-scoped return links.
- `/admin/question-bank`: chapter growth targets and paper child requests. A paper's setup owns its linked priorities; cancel it from Papers.

Written questions must match section marks. Objective paper formats retain their scoring rules. Reviewed syllabus versions and exact stored snapshots remain the trust boundaries; catalogue completeness is not implied by this release.

## Scheduled creator
The existing daily 08:00 Asia/Kolkata creator reads `questionBankAgentInstructions/creator-workflow-v3` first, retaining subject quality/reference contracts. It replaces conflicting legacy cooldown and force-run policies.

Only explicit admin requests are eligible. Reconcile approved and pending counts; generate max(target − approved − pending, 0). Pending-only coverage is review work, never completion. Parent paper requests retain their exact type, section, marks, year and curriculum constraints; allocate with the shared `createPaperPlan` behavior. Completed/cancelled parents remain terminal.

At most three chapter scopes and 50 total drafts per run; global pending cap 500 and scope cap 200. Claim a 20-minute lease with the observed update token, recheck parent state before each bounded write batch, deduplicate against both banks, and use deterministic draft IDs. Stage for admin review only. Continue unfinished work on the next run without the former seven-day cooldown. Report genuine blockers and actual counts in agent run records.

`curriculum-review-v1.paperRequestEnabled` is the release gate for parent-paper processing. Enable only after the current browser code and shared backend rules have both been verified live. No fictitious request should be inserted into production merely to demonstrate generation.

## Internal activity evidence
`adminUsageSessions/{India-day}_{random-session}` stores actor UID, device category, coarse area/event counters and approximate active milliseconds. It excludes typed text, question content, complete URLs, query strings and click labels. Time counts only while visible, focused and recently active; each interval is capped at 15 seconds. Failed writes retain a bounded in-memory buffer; leaving a tab can lose the last interval, so time is approximate.

Admins can write only their own session; learners and anonymous clients cannot read or write these records. `adminUsageReports` is admin-readable and server-write-only. No stats dashboard is added. The creator's monthly routine reads the previous completed calendar month once, writes one bounded evidence-based report, identifies actors only as needed internally, and acknowledges missing/sampled data. Print counters mean the browser print dialog was invoked, not that physical printing completed. No productivity rankings or fabricated usage conclusions.

## Persistent reads and confirmed writes
The module injects the same AngularFire Firestore instance as the rest of GTOP. Its existing IndexedDB persistence now uses the multiple-tab manager, so open admin tabs share the persistent cache. There is no separate module database or localStorage copy.

`FirestoreReadService` shares identical live queries for the signed-in account. Cached snapshots render immediately, then server snapshots update the view. The catalogue reuses `SyllabusService`; templates, the first bank page, recent requests and saved papers use shared listeners. Unused listeners survive 15 seconds for warm navigation, with at most 12 idle queries, then unsubscribe. Account changes clear the shared in-memory listeners. Firestore still owns disk persistence and synchronization.

Bank reads display 25 records with one lookahead; requests and saved papers display 20. Loading older records uses cursor pages and stops the corresponding first-page subscription so a shifting live boundary cannot drop older rows. Refresh restores the live first page. Question-type toggles reuse one scope coverage read for display instead of scanning both banks on every toggle; saving a target independently rechecks current coverage.

Cached results can be incomplete. The module shows a checking status while active queries are cache-backed, and does not treat a cache-only empty list as confirmed empty. Coverage/allocation, aggregation counts, duplicate preflight, review and mutable request checks explicitly require server reads. Existing revision-checked transactions and awaited writes remain the confirmation boundary; cached or locally pending data never makes an approval/save successful. Transactions require connectivity.

Regression coverage includes query sharing, listener cleanup, account changes and retry, plus real emulator-backed desktop and 320 px browser journeys for persistent reload with Firestore unavailable, reconnection after an external edit, and confirmed written-question saves across tabs. Emulator persistence is opt-in through a localhost-only test flag; production always uses the shared persistent setup.

## Release
A main push calls the existing protected backend workflow for Firestore rules, then runs module/rules/browser gates before hosting. Rehearsal or unconfirmed manual dispatch must not deploy live rules. The protected environment and post-deploy active-rule verification remain in place. Local portable Chromium override is scoped to Chromium projects; CI still covers Chromium and WebKit devices.
